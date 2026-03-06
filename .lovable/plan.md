

## Diagnóstico: scroll() lê 18x14 quando o servidor envia strips (1x14 / 18x1)

### Evidência do dissector

Frame #6943: 507B total, MOVE_CR (13B) + SCROLL_E → 290B left.
SCROLL_E consumiu apenas ~203B. Um viewport 18x14 × 8 floors = 2016 tiles (mínimo ~4KB com skip encoding). Mas 1x14 × 8 floors = 112 tiles ≈ 224B com skip encoding — exatamente o que os dados mostram.

### Bug no código atual

Linha 647 do `packetParser.ts`:
```typescript
// ERRADO — lê 18x14 multifloor para scrolls
this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, g.camZ, startz, endz, zstep);
```

Isso faz o `readTileItems` ler bytes de opcodes subsequentes (DEL_THING, FLOOR_DOWN, etc.) como dados de tile, causando desync acumulativo.

A nota de memória do projeto já confirma isso: *"O protocolo de rede para movimentos (scrolling) utiliza as dimensões padrão do Tibia (1x14 ou 18x1). Tentativas de implementar a leitura de viewport total (18x14) para os opcodes de scroll resultaram em desincronização massiva e foram permanentemente descartadas."*

### O que NÃO é o problema

- `floorDown` e `floorUp` — corretamente usam 18x14 para ler floors inteiros
- Ordem dos opcodes — cada opcode é processado em sequência, a ordem no frame está correta
- O GPT sugeriu reordenar SCROLL/FLOOR, mas isso é desnecessário — os opcodes são independentes

### Correção

Substituir a função `scroll(r, dx, dy)` genérica por 4 handlers direcionais que leem strips:

```text
scrollN (0x65): camY--, read row  at (camX-8, camY-6), W=18, H=1
scrollE (0x66): camX++, read col  at (camX+9, camY-6), W=1,  H=14
scrollS (0x67): camY++, read row  at (camX-8, camY+7), W=18, H=1
scrollW (0x68): camX--, read col  at (camX-8, camY-6), W=1,  H=14
```

Cada um lido com `readMultiFloorArea` para percorrer todos os floors visíveis (skip encoding compartilhado entre floors).

### Arquivo a editar

| Arquivo | Mudança |
|---------|---------|
| `src/lib/tibiaRelic/packetParser.ts` | Substituir `scroll(r, dx, dy)` com 18x14 por 4 funções `scrollN/E/S/W` que leem strips 18x1 ou 1x14 |

### Detalhes técnicos

As coordenadas de strip para cada direção (após atualizar a câmera):
- **North**: nova linha no topo do viewport → `(camX-8, camY-6, W=18, H=1)`
- **South**: nova linha no fundo do viewport → `(camX-8, camY+7, W=18, H=1)`
- **East**: nova coluna à direita → `(camX+9, camY-6, W=1, H=14)`
- **West**: nova coluna à esquerda → `(camX-8, camY-6, W=1, H=14)`

Cada strip é lido através de `readMultiFloorArea` com o floor range normal (surface: 7→0, underground: z±2), preservando o skip encoding compartilhado entre floors.

