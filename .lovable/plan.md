

## Correcao: Tiles perdidos entre snapshots por causa do gs.tiles.clear()

### Problema identificado

O bug esta na linha 85 do `mapExtractor.ts`. Quando uma mudanca de andar e detectada, `gs.tiles.clear()` e chamado **imediatamente**, sem antes salvar os tiles acumulados em `latestTiles`. Isso significa que todos os tiles acumulados desde o ultimo snapshot sao **perdidos para sempre**.

Fluxo atual:
```text
[Batch N: 500 frames processados]
  -> jogador anda no andar 7, acumulando tiles em gs.tiles
  -> no frame 300, muda para andar 8
  -> gs.tiles.clear() -- PERDE todos os tiles do andar 7!
  -> frames 301-500 acumulam tiles do andar 8
[Fim do batch]
  -> anyFloorChange = true, floorStableBatches = 0
  -> NAO faz snapshot (precisa >= 1 batch estavel)

[Batch N+1: 500 frames sem mudanca de andar]
  -> floorStableBatches = 1
  -> snapshot -- mas so captura tiles do andar 8 (os do 7 ja foram apagados)
```

Resultado: grandes trechos do caminho percorrido sao perdidos, gerando gaps no mapa.

### Correcao

Chamar `snapshotTiles()` **antes** de `gs.tiles.clear()` para salvar os tiles acumulados do andar atual antes de limpar. O filtro `tz !== camZ` dentro de `snapshotTiles` ja garante que so tiles do andar correto (o anterior, antes da mudanca) sejam capturados.

### Mudancas

**`src/lib/tibiaRelic/mapExtractor.ts`**

1. Na funcao `extractMapTilesSync` (linha 84-86), adicionar snapshot antes do clear:

```typescript
if (lastCamZ >= 0 && gs.camZ !== lastCamZ) {
  // Salvar tiles do andar anterior ANTES de limpar
  snapshotTiles(gs, dat, latestTiles);
  gs.tiles.clear();
  anyFloorChange = true;
}
```

Nota: `snapshotTiles` filtra por `tz !== camZ`. Neste ponto, `gs.camZ` ja mudou para o novo andar, mas `lastCamZ` ainda aponta para o antigo. Os tiles em `gs.tiles` sao do andar antigo (`lastCamZ`). Como `camZ` ja e o novo valor, o filtro `tz !== camZ` vai **rejeitar** os tiles antigos.

Correcao necessaria: precisamos fazer o snapshot usando `lastCamZ` como referencia, nao `gs.camZ`. Duas opcoes:

**Opcao escolhida**: Temporariamente restaurar `gs.camZ` ao valor antigo para o snapshot, ou passar o Z diretamente. A solucao mais limpa e salvar o camZ atual, restaurar o antigo, snapshot, e restaurar:

```typescript
if (lastCamZ >= 0 && gs.camZ !== lastCamZ) {
  const newZ = gs.camZ;
  gs.camZ = lastCamZ; // Temporariamente volta ao andar antigo
  snapshotTiles(gs, dat, latestTiles); // Captura tiles do andar antigo
  gs.camZ = newZ; // Restaura
  gs.tiles.clear();
  anyFloorChange = true;
}
```

2. A mesma correcao na funcao `extractMapTiles` (versao async), linhas 173-175:

```typescript
if (lastCamZ >= 0 && gs.camZ !== lastCamZ) {
  const newZ = gs.camZ;
  gs.camZ = lastCamZ;
  snapshotTiles(gs, dat, latestTiles);
  gs.camZ = newZ;
  gs.tiles.clear();
  anyFloorChange = true;
}
```

### Por que isso resolve

- Nenhum tile acumulado entre snapshots sera perdido
- O filtro `tz !== camZ` (com camZ temporariamente setado ao andar antigo) garante que so tiles do andar correto sejam salvos
- A limpeza de `gs.tiles` continua acontecendo apos o snapshot, evitando contaminacao cross-floor
- Isso explica porque "antes demorava mais e extraia corretamente" -- o comportamento antigo provavelmente nao limpava tiles tao agressivamente

