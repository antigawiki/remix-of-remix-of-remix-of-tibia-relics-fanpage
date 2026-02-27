

## Cam Map - Mapa gerado a partir de arquivos .cam

### Conceito

Criar uma pagina secreta "Cam Map" que funciona como um Google Maps do Tibia Relic. Cada vez que um arquivo .cam e processado (no cam player ou via upload dedicado), o sistema extrai os tiles (itens no chao) de cada coordenada X, Y, Z e salva no banco de dados. A pagina exibe esses tiles renderizados usando LeafletJS com controles de zoom e troca de andar.

### Abordagem Inspirada no gesior/otclient_mapgen

O projeto gesior/otclient_mapgen gera imagens PNG 256x256 (8x8 tiles de 32px) a partir de dados de mapa para LeafletJS. Nossa abordagem segue o mesmo principio, mas a fonte de dados sao os pacotes de rede dentro dos arquivos .cam em vez de arquivos .otbm.

### Arquitetura

```text
.cam upload
    |
    v
[Map Extractor] -- processa todos os frames
    |               extrai tiles (itemId[] por x,y,z)
    v
[Supabase DB] -- tabela cam_map_tiles
    |             (x, y, z, items jsonb)
    v
[Tile Image Generator] -- client-side
    |                      agrupa tiles em chunks 256x256
    |                      renderiza sprites com SprLoader/DatLoader
    v
[LeafletJS Viewer] -- custom TileLayer
                      zoom, pan, floor selector
```

### Plano de Implementacao

#### 1. Tabela no banco de dados: `cam_map_tiles`

Criar tabela para armazenar tiles extraidos dos .cam:

- `x` (integer) - coordenada X
- `y` (integer) - coordenada Y  
- `z` (integer) - coordenada Z (andar, 0-15)
- `items` (jsonb) - array de item IDs no tile [102, 408, ...]
- `updated_at` (timestamp) - ultima atualizacao

Chave primaria composta: (x, y, z). Ao processar um novo .cam, faz UPSERT - se o tile ja existe, atualiza os items. Isso permite acumular dados de multiplos .cam.

#### 2. Map Extractor (`src/lib/tibiaRelic/mapExtractor.ts`)

Classe que processa um .cam inteiro e extrai todos os tiles unicos:

- Reutiliza `PacketParser`, `GameState`, `DatLoader` existentes
- Processa todos os frames do .cam em modo seek (sem animacoes)
- Apos cada frame, captura os tiles do `GameState` que contem items
- Filtra apenas itens de chao (ground, stackPrio 0-3) - ignora criaturas
- Retorna um `Map<string, number[]>` com chave "x,y,z" e valor = array de item IDs
- Faz merge inteligente: se um tile ja foi visto com mais items, mantém a versao mais completa

#### 3. Tile Image Renderer (`src/lib/tibiaRelic/mapTileRenderer.ts`)

Renderiza chunks de 256x256 pixels (8x8 tiles) client-side:

- Recebe dados de tiles do banco + SprLoader + DatLoader (ja carregados)
- Para cada tile, renderiza os sprites de chao em ordem de stackPrio
- Gera um canvas 256x256 por chunk
- Usa cache para evitar re-renderizar chunks ja gerados
- Formato de coordenadas LeafletJS: chunk(x,y) = floor(tileX/8), floor(tileY/8)

#### 4. Pagina Cam Map (`src/pages/CamMapPage.tsx`)

Pagina com URL ofuscada (ex: `/b7d3e1a9f5c2`):

- LeafletJS como viewer principal (ja instalado como dependencia)
- Custom `L.TileLayer` que busca dados do banco por chunk e renderiza client-side
- Controles:
  - Zoom (LeafletJS nativo)
  - Pan/arrastar (LeafletJS nativo)
  - Floor selector (0-15) com botoes cima/baixo
  - Indicador de coordenadas do mouse (X, Y, Z)
- Carrega SprLoader/DatLoader uma vez na montagem (mesmo sistema do cam player)
- Busca tiles do banco sob demanda conforme o usuario navega pelo mapa

#### 5. Upload e extracao no Cam Player

Adicionar opcao no TibiarcPlayer para "Extrair Mapa" apos carregar um .cam:

- Botao "Extrair Mapa" visivel quando um .cam esta carregado
- Processa todos os frames em background (Web Worker ou chunked processing)
- Salva tiles extraidos no banco via UPSERT
- Mostra progresso da extracao
- Tiles acumulam entre multiplos uploads de diferentes jogadores/areas

#### 6. Rota e navegacao

- Adicionar rota no App.tsx com URL ofuscada
- Sem link visivel no menu (pagina secreta)

### Detalhes Tecnicos

**LeafletJS Custom TileLayer:**
- Coordenadas Tibia sao absolutas (ex: x=32000, y=31000)
- Mapeamento: leaflet tile (col, row) -> tibia chunk (baseX + col*8, baseY + row*8)
- Zoom levels: zoom 0 = 1 pixel por tile, zoom 3 = 8px por tile (256px chunk), zoom 5 = 32px por tile (resolucao nativa)
- O tile provider busca dados do Supabase, renderiza no canvas, e retorna como data URL

**Extracao de tiles do .cam:**
- Processar TODOS os frames (nao apenas ate o ponto atual de playback)
- Capturar snapshots do GameState a cada N frames
- Filtrar: so salvar tiles que contem items (nao salvar tiles vazios)
- Ignorar criaturas completamente (so items estaticos formam o mapa)

**Performance:**
- Extracao em background com chunked processing (processar 1000 frames por requestAnimationFrame)
- Cache de chunks renderizados no client (LRU com ~200 entradas)
- Busca de tiles do banco em batches por area visivel
- Indice no banco: (z, x, y) para queries de area eficientes

### Resultado Esperado

- Mapa navegavel estilo Google Maps de todas as areas visitadas em arquivos .cam
- Acumula dados entre multiplos uploads, construindo gradualmente o mapa completo do servidor
- Visualizacao por andar (0-15) com troca rapida
- Zoom de visao geral ate resolucao nativa (32px por tile)

