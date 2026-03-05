

## Analise: Por que sprites aparecem em branco na SpriteSidebar

### Descoberta principal

Encontrei um **bug real** no `renderSingleSprite` em `mapTileRenderer.ts`. O problema nao esta no parser DAT/SPR (que funciona perfeitamente), mas na **renderizacao de itens com displacement**.

Na linha 263, `drawItem` desenha em:
```text
(px - tw*32 - dispX, py - th*32 - dispY)
```

Para itens single-tile (width=1, height=1) com `dispX` ou `dispY` > 0, o `renderSingleSprite` calcula:
- `ox = 0, oy = 0`
- Posicao final: `(-dispX, -dispY)` → **fora do canvas** → pixels invisiveis

Resultado: canvas vazio → placeholder "branco com X" na sidebar.

O viewer do ChatGPT nao tem esse problema porque ele renderiza **sprites crus** (direto do SPR por ID), sem aplicar displacement do DAT.

### Plano

**Corrigir `renderSingleSprite`** em `src/lib/tibiaRelic/mapTileRenderer.ts`:
- Incluir `dispX`/`dispY` no calculo do tamanho do canvas temporario
- Ajustar as coordenadas de origem para que o sprite fique dentro dos limites do canvas
- Garantir que itens com displacement sejam desenhados visivelmente e depois redimensionados para 32x32

### Arquivo a modificar
- `src/lib/tibiaRelic/mapTileRenderer.ts` — metodo `renderSingleSprite`

