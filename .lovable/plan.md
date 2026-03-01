

## Correcao: Bordas de Montanhas Quebradas no Mapa

### Causa Raiz

Itens multi-tile no Tibia (como bordas de montanhas) possuem `width > 1` ou `height > 1`. Quando desenhados, o sprite se estende para a **esquerda e para cima** a partir da posicao do tile. Exemplo: um item com `width=2` no tile (baseX+8, baseY) (primeiro tile do chunk vizinho a direita) desenha seus pixels em `px=256` e `px=224`. O pixel 224 esta DENTRO do chunk atual, mas o item pertence ao chunk vizinho.

O **cam player** resolve isso renderizando tiles extras alem do viewport (`tx=-1` ate `VP_W+3`). O **mapa** renderiza exatamente 8x8 tiles por chunk, sem margem. Resultado: sprites de itens nos chunks vizinhos que deveriam "sangrar" para dentro do chunk atual sao cortados, criando bordas quebradas.

### Solucao

Duas mudancas cirurgicas:

**Arquivo 1: `src/lib/tibiaRelic/mapTileRenderer.ts`**

Modificar o metodo `renderChunk` para aceitar um parametro opcional `borderTiles: TileData[]` contendo tiles dos chunks adjacentes (ate 2 tiles alem da borda). Expandir o loop de renderizacao de `tx=0..7` para `tx=-2..9, ty=-2..9`. Os tiles fora do range 0-7 serao buscados no `borderTiles`. A area de desenho continua sendo 256x256 -- sprites que caem fora do canvas sao automaticamente clippados pelo browser.

Mudancas especificas:
- Adicionar parametro `borderTiles?: TileData[]` na assinatura de `renderChunk`
- Mesclar `borderTiles` no `tileMap` lookup (mesmo Map, tiles com coordenadas absolutas)
- Mudar os loops de `for ty=0..CHUNK_TILES-1` para `for ty=-2..CHUNK_TILES+1`
- NAO desenhar overlays (rope/shovel) para tiles fora do chunk (evita duplicacao)

**Arquivo 2: `src/pages/CamMapPage.tsx`**

No `drawCamData`, ao chamar `renderer.renderChunk`, coletar tiles dos 8 chunks adjacentes (cima, baixo, esquerda, direita, e diagonais) e passar como `borderTiles`. Filtrar apenas tiles que estao a ate 2 posicoes da borda do chunk sendo renderizado.

Mudancas especificas:
- Criar funcao helper `getBorderTiles(chunkX, chunkY)` que coleta tiles relevantes dos chunks vizinhos
- Passar resultado como `borderTiles` ao `renderChunk`

### Impacto em Performance

Minimo. Para cada chunk, adicionamos no maximo ~40 tiles extras (perimetro de 2 tiles de largura ao redor do chunk 8x8). O calculo de sprites e o mesmo, e a maioria desses tiles ja esta em memoria. O cache do renderer continua funcionando normalmente.

### Resumo

| Arquivo | Acao | Descricao |
|---|---|---|
| `mapTileRenderer.ts` | EDITAR | Aceitar borderTiles, expandir loop de renderizacao |
| `CamMapPage.tsx` | EDITAR | Coletar tiles vizinhos e passar ao renderer |

