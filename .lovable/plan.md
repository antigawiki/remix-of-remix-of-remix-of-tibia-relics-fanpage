

## Diagnostico: Acumulacao de itens fantasma entre snapshots

### Causa raiz

O `snapshotTilesWithCounts` funciona como um **acumulador permanente**: ele coleta IDs de itens de TODOS os snapshots em um `Map<string, Map<number, number>>` que nunca remove entradas. Isso causa dois problemas graves:

1. **Itens fantasma**: Se um tile teve o item 300 no snapshot 1, mas o item foi removido no snapshot 5 (porta abriu, item foi pego, etc.), o item 300 permanece na saida final. Resultado: tiles com itens que nao existem mais, causando o visual "atropelado".

2. **Perda de duplicatas legitimas**: O `Map<number, number>` (id -> count) colapsa duplicatas. Se um tile tem legitimamente DOIS itens com o mesmo ID (ex: duas paredes iguais empilhadas), apenas um eh salvo. O CamPlayer nao tem esse problema pois renderiza diretamente do GameState que preserva a lista completa.

3. **Perda de ordem**: O `Map` perde a ordem de empilhamento dos itens. O CamPlayer renderiza na ordem correta do Tibia (chao primeiro, depois paredes, depois topo), mas o extrator devolve em ordem arbitraria.

### Por que o CamPlayer funciona e o mapa nao

O CamPlayer renderiza direto do `GameState.tiles` -- que sempre tem o estado ATUAL de cada tile com a lista completa de itens na ordem correta. O extrator, por outro lado, acumula dados de todos os snapshots e os colapsa em um set de IDs unicos.

### Correcao

Substituir o sistema de contagem por um sistema de "ultimo snapshot vence" (`last-write-wins`). Em vez de acumular contagens, simplesmente armazenar a lista COMPLETA de itens do tile como vista no ultimo snapshot em que o tile estava dentro da area de proximidade. Isso:

- Preserva a ordem de empilhamento (igual ao CamPlayer)
- Preserva duplicatas legitimas do mesmo item ID
- Remove automaticamente itens que nao existem mais no tile
- Simplifica drasticamente o codigo

### Arquivo a modificar

**`src/lib/tibiaRelic/mapExtractor.ts`**:

- Trocar `itemCounts: Map<string, Map<number, number>>` por `latestTiles: Map<string, number[]>` -- armazena a lista completa de item IDs do ultimo snapshot
- `snapshotTilesWithCounts` vira `snapshotTiles`: para cada tile dentro da proximidade, extrai a lista de item IDs (com stackPrio <= 5) e SUBSTITUI a entrada anterior (nao acumula)
- `buildFilteredTiles` se torna desnecessario -- o `latestTiles` ja eh o resultado final
- Manter toda a logica de spawns inalterada

### Logica simplificada

```text
snapshotTiles(gs, dat, latestTiles):
  para cada tile em gs.tiles:
    filtrar por proximidade (±18x, ±14y)
    filtrar por coordenadas validas
    coletar items: para cada item 'it' com stackPrio <= 5, push(id)
    se items.length > 0:
      latestTiles.set(key, items)  // SUBSTITUI, nao acumula

extractMapTiles():
  latestTiles = new Map()
  ...processar frames...
  snapshotTiles(gs, dat, latestTiles)  // chamado a cada chunk
  ...
  resolve({ tiles: latestTiles, spawns })  // sem buildFilteredTiles
```

