

# Porta do TibiaCamPlayer Python para TypeScript/Canvas

## Problema Identificado

O player WASM (tibiarc) **nao reconhece** o formato `.cam` do TibiaRelic. Esse formato e customizado e diferente dos formatos suportados (TibiaCAM, TibiaCast, TibiaMovie, etc.). Por isso o erro "Could not determine recording version".

O player Python que voce tem funciona porque implementa o formato diretamente. A solucao e **portar o player Python para TypeScript**, renderizando no Canvas do navegador.

## Formato .cam TibiaRelic (documentado no Python)

```text
Header (12 bytes):
  u32 version (= 8)
  f32 fps (= 125.0)
  4 bytes extras

Frames (sequenciais):
  u64 timestamp_ms (relativo ao inicio)
  u16 payload_size
  u8[] payload (pacotes protocolo Tibia 7.72)
```

## Plano de Implementacao

### 1. Criar parser do formato .cam
**Arquivo:** `src/lib/tibiaRelic/camParser.ts`

Porta da classe `CamFile` do Python. Le o header de 12 bytes e extrai os frames (timestamp + payload).

### 2. Criar loader do .spr (sprites)
**Arquivo:** `src/lib/tibiaRelic/sprLoader.ts`

Porta da classe `SprLoader`. Le o arquivo Tibia.spr (que ja temos em `/public/tibiarc/data/Tibia.spr`), decodifica sprites RLE para ImageData do Canvas.

- Signature u32 + count u16 + offsets u32[]
- Cada sprite: 3 bytes chroma key + u16 size + dados RLE (32x32 RGBA)

### 3. Criar loader do .dat (definicoes de items)
**Arquivo:** `src/lib/tibiaRelic/datLoader.ts`

Porta da classe `DatLoader` e `ItemType`. Le flags dos items (ground, stackable, fluid, blocking, etc.) e layout de sprites (width, height, layers, patterns, animations).

- Flags 0x00-0xFF com bytes extras conforme tipo
- Layout: width, height, [exact_size], layers, pat_x, pat_y, pat_z, anim, sprite_ids[]

### 4. Criar parser de pacotes do protocolo 7.72
**Arquivo:** `src/lib/tibiaRelic/packetParser.ts`

Porta da classe `PacketParser`. Interpreta os opcodes do protocolo:
- 0x0a: login (player_id)
- 0x64-0x68: mapa e scrolling
- 0x69-0x6d: atualizacoes de tiles/coisas/criaturas
- 0x6e-0x79: containers e inventario
- 0x82-0x91: efeitos, luz, criaturas
- 0xaa-0xb4: chat e mensagens
- Inclui logica de tiles (terminadores 0xFF00+), creatures (0x61/0x62/0x63), items com subtipo

### 5. Criar estado do jogo
**Arquivo:** `src/lib/tibiaRelic/gameState.ts`

Porta das classes `GameState` e `Creature`. Mantem tiles, criaturas, posicao da camera, mensagens.

### 6. Criar renderer Canvas
**Arquivo:** `src/lib/tibiaRelic/renderer.ts`

Porta da classe `Renderer`. Desenha no Canvas HTML5 usando ImageData:
- Viewport 15x11 tiles (32px cada) = 480x352
- Renderiza tiles com sprites compostos (alpha composite)
- Renderiza criaturas com outfits
- HUD: barras de vida, nomes, mensagens de chat

### 7. Atualizar o componente TibiarcPlayer
**Arquivo:** `src/components/TibiarcPlayer.tsx`

Substituir a logica WASM pelo novo player TypeScript:
- Ao carregar um .cam, usa o novo parser ao inves do WASM
- Carrega Tibia.spr e Tibia.dat via fetch na inicializacao
- Renderiza diretamente no Canvas com requestAnimationFrame
- Mantem todos os controles existentes (play/pause, seek, speed, progress)
- Remove dependencia do WASM completamente

## Ordem de Implementacao

1. camParser + gameState (sem dependencias)
2. sprLoader + datLoader (le arquivos de dados)
3. packetParser (depende de datLoader + gameState)
4. renderer (depende de todos acima)
5. Integracao no TibiarcPlayer.tsx

## Consideracoes

- Os arquivos Tibia.spr, Tibia.dat e Tibia.pic ja existem em `/public/tibiarc/data/`
- O seletor de versao pode ser removido (o formato e sempre TibiaRelic 7.72)
- O player Python tem ~1000 linhas que viram ~800-1000 linhas TypeScript
- Sem dependencia de compilacao C++/WASM - tudo roda no navegador puro
- Performance: sprites sao cacheados apos decodificacao, rendering via Canvas 2D

