

## Corrigir gaps na extração de tiles (snapshot muito infrequente)

### Diagnóstico

Analisando os dados no banco, confirmei que existem lacunas reais na extração. Exemplo no eixo X entre 32711-32717 (7 tiles de gap). O total de 24k tiles em z=7 para uma area de 1156x1356 confirma cobertura muito esparsa.

### Causa raiz

O `snapshotTiles` (que salva tiles do GameState para o resultado final) so roda quando `floorStableBatches >= 2`, ou seja, a cada **1000 frames** (2 batches de 500). Nesse intervalo, o jogador caminha 5-10+ tiles, e como o snapshot so captura tiles dentro do viewport de 18x14 ao redor da camera **naquele momento**, os tiles das posicoes intermediarias sao perdidos.

Antes de hoje, o threshold era provavelmente 1 (ou inexistente), fazendo snapshot a cada 500 frames. A mudanca para threshold >= 2 dobrou o intervalo entre snapshots, criando gaps sistematicos.

### Solucao

Reduzir o threshold de `floorStableBatches >= 2` para `floorStableBatches >= 1` no `mapExtractor.ts`. Isso significa:
- Snapshot a cada **500 frames** (1 batch) apos estabilidade
- Apenas **1 batch de cooldown** (500 frames) apos mudanca de andar
- O `gs.tiles.clear()` ja purga tiles contaminados, entao 1 batch de cooldown e suficiente

### Mudancas

**`src/lib/tibiaRelic/mapExtractor.ts`** - 2 alteracoes (sync e async):
- Linha 97: `floorStableBatches >= 2` -> `floorStableBatches >= 1`
- Linha 187: `floorStableBatches >= 2` -> `floorStableBatches >= 1`

### Resultado esperado

- Dobro da frequencia de snapshots (a cada 500 frames vs 1000)
- Gaps de 7+ tiles eliminados (max gap agora seria ~3-5 tiles)
- Cooldown pos-floor-change mantido (1 batch) para evitar contaminacao

