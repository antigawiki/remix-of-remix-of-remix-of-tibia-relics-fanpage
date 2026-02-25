

# Correção do CAM Player - Offset de Andares e Criaturas Invisíveis

## Diagnóstico Raiz

Analisei o código fonte do OTClient (edubart/otclient) e encontrei a causa raiz dos dois problemas. O código chave do OTClient e':

```text
setFloorDescription(msg, x, y, nz, width, height, z - nz, skip);

// Dentro de setFloorDescription:
Position tilePos(x + nx + offset, y + ny + offset, z);
//                        ^^^^^^           ^^^^^^
//                    offset = z - nz aplicado a AMBAS coordenadas
```

### Problema 1: Coordenadas por andar sem offset

Quando o Tibia envia dados de multiplos andares, cada andar tem um **offset de perspectiva** de `(camZ - nz)` aplicado tanto a X quanto a Y. Nosso parser aplica todas as tiles na mesma posicao base `(ox, oy)` para todos os andares, o que faz:

- Tiles do andar 7 serem armazenadas nas coordenadas do andar 6
- Criaturas serem salvas em posicoes (x,y) erradas
- Tiles de andares diferentes se sobreporem no mesmo ponto

### Problema 2: Renderer so mostra 1 andar

O renderer atual so desenha `z = camZ`. No Tibia real, andares superiores/inferiores sao visíveis com offset NW/SE, criando a perspectiva de profundidade que voce ve na imagem de referencia (image-37).

### Problema 3: Criaturas "invisiveis"

As criaturas estao sendo parseadas (crs=22 aparece no debug), mas seus sprites nao renderizam porque:
- Se o outfit tem spriteIds validos mas nenhum sprite carrega do SPR, nada e desenhado (falta fallback)
- As criaturas podem estar em coordenadas erradas por causa do bug do offset

## Plano de Correcoes

### 1. Corrigir o PacketParser - aplicar offset por andar

**Arquivo:** `src/lib/tibiaRelic/packetParser.ts`

Seguindo exatamente o OTClient, o `readFloorArea` deve receber um parametro `offset` e aplicar `offset` a cada coordenada de tile:

```text
readFloorArea(r, ox, oy, z, W, H, offset, skip):
  for each tile at (tx, ty):
    readTileItems(r, ox + tx + offset, oy + ty + offset, z)
```

E `readMultiFloorArea` passa `camZ - nz` como offset:

```text
readMultiFloorArea(r, ox, oy, W, H, camZ, startz, endz, zstep):
  for nz = startz to endz:
    skip = readFloorArea(r, ox, oy, nz, W, H, camZ - nz, skip)
```

Mudancas especificas:
- `mapDesc`: Passa `z` (camZ) para `readMultiFloorArea`
- `scroll`: Mesma logica, passa `g.camZ` para offset
- `floorUp`: Usar offsets corretos: `8 - i` para acima do mar, `3` para underground
- `floorDown`: Usar offsets corretos: `j` (comeca em -1) para underground, `-3` para deep underground
- `readFloorArea`: Adicionar parametro `offset` e aplicar a `ox + tx + offset, oy + ty + offset`

### 2. Corrigir o Renderer - desenhar multiplos andares

**Arquivo:** `src/lib/tibiaRelic/renderer.ts`

Quando o jogador esta acima do nivel do mar (z <= 7), desenhar andares de baixo para cima com offset NW:

```text
Para z <= 7:
  Desenhar do andar 7 ate andar max(0, z-2):
    offset = camZ - fz
    viewport origin = (camX - 8 + offset, camY - 6 + offset)
    tiles deste andar aparecem na posicao de tela correta

Para z > 7:
  Desenhar apenas o andar atual (underground nao tem perspectiva multi-andar)
```

Para cada andar `fz`:
- Calcular `offset = camZ - fz`
- O viewport de mundo para este andar e: `(camX - 8 + offset, camY - 6 + offset)` a `(camX + 9 + offset, camY + 7 + offset)`
- Desenhar tiles na mesma posicao de tela `(tx * tpx, ty * tpx)`, mas buscando tiles do mundo com offset
- Tiles de andares superiores (com offset positivo) ficam NW na tela
- Isso cria a perspectiva "isometrica" do Tibia

### 3. Corrigir o fallback de criaturas

**Arquivo:** `src/lib/tibiaRelic/renderer.ts`

Na funcao `drawCreature`, adicionar fallback quando outfit tem spriteIds mas nenhum sprite carrega:

```text
drawCreature(c, bx, by, tpx, scale):
  ot = dat.outfits.get(c.outfit)
  if ot and ot.spriteIds.length > 0:
    rendered = false
    for each sprite cell:
      sprCanvas = getSpriteCanvas(sid, tpx)
      if sprCanvas:
        drawImage(sprCanvas, dx, dy)
        rendered = true
    if not rendered:
      drawFallbackRectangle()  // <-- NOVO
  else:
    drawFallbackRectangle()
```

### 4. Corrigir floorUp/floorDown com offsets do OTClient

**Arquivo:** `src/lib/tibiaRelic/packetParser.ts`

Baseado no OTClient:

**floorUp (0xBE):**
- `camZ--; camX++; camY++;`
- Se `camZ == 7` (chegou no nivel do mar): ler andares 5 ate 0, offset = `8 - i`
- Se `camZ > 7` (underground): ler andar `camZ - 2`, offset = `3`

**floorDown (0xBF):**
- `camZ++; camX--; camY--;`
- Se `camZ == 8` (entrou underground): ler andares 8 ate 10, offset = `-1, -2, -3`
- Se `camZ > 8`: ler andar `camZ + 2`, offset = `-3`

## Secao Tecnica - Detalhes de Implementacao

### Iteracao de tiles (column-major)

O OTClient itera `nx` (x) como loop externo e `ny` (y) como interno. Nosso codigo usa `tileIdx` com `tx = tileIdx % W, ty = floor(tileIdx / W)`, o que resulta em: para tx=0: ty=0..H-1, tx=1: ty=0..H-1. Isso e equivalente a column-major do OTClient. Correto.

### Outfit dialog (0xC8)

No OTClient 7.4 (sem `GameLooktypeU16`), outfit start/end sao u8, nao u16. Corrigir `skipOutfitWindow`:
- `readOutfit(r)` (full outfit reading, not just skip)
- `outfitStart = r.u8()` (nao u16)
- `outfitEnd = r.u8()`

Mas para 7.72 (TibiaRelic), pode ser u16. Manter u16 por seguranca.

### NPC Trade (0x7A)

No OTClient 7.4 (sem versao 900+), listCount e u8 e inclui `name: str16`. O formato e:
- u8 count (nao u16)
- Para cada item: u16 itemId, u8 count, str16 name, u32 weight, u32 buyPrice, u32 sellPrice

Nosso parser le: `u8 n; for: u16, u8, str16, u32, u32, u32` - mas falta o str16 (name)! Isso causa dessincronia. Corrigir para incluir `r.str16()`.

### Campos de criatura extras

No OTClient para versoes < 854, nao ha byte `unpass`. Nosso protocolo 7.4/7.72 pode ou nao ter isso. Como estamos no 7.72 customizado, manter skull+shield (2 bytes) sem byte extra.

## Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `packetParser.ts` | Aplicar offset `(camZ - nz)` por andar em `readFloorArea` |
| `packetParser.ts` | Corrigir `floorUp`/`floorDown` com offsets corretos |
| `packetParser.ts` | Corrigir `skipNpcTrade` para incluir `str16` name |
| `renderer.ts` | Renderizar multiplos andares com offset NW/SE |
| `renderer.ts` | Adicionar fallback de sprite para criaturas |

