

## Plano: Corrigir Tiles Duplicados/Fora de Posicao e Criaturas Mortas

### Diagnostico

Analisando as imagens e o codigo, identifiquei dois problemas raiz:

**1. Tiles fora de posicao (stale data do GameState)**

O `GameState.tiles` acumula TODOS os tiles ja vistos durante a reproducao da .cam. Quando o jogador se move, os tiles antigos de posicoes anteriores nunca sao removidos do estado. Ao removermos o filtro de viewport na funcao `snapshotTilesWithCounts`, tiles de 500+ posicoes de distancia (de onde o jogador esteve minutos atras) sao re-contados em CADA snapshot, atingindo o threshold de persistencia (2 snapshots) e sendo extraidos como se fossem tiles validos. Isso gera a duplicacao e os itens "fantasma" fora de posicao.

**2. Criaturas mortas que nao sao purgadas**

O sistema de dedup usa um grid 5x5 para agrupar criaturas. Uma criatura viva em (102,103) gera a chave "100,105,7,Rat", mas quando morre em (99,99) gera "100,100,7,Rat" -- chaves diferentes. Assim, o registro de morte nao consegue purgar o registro de vida anterior.

### Solucao

#### 1. Re-adicionar filtro de viewport para tiles (apenas distancia, sem filtro de andar)

O servidor Tibia envia tiles dentro de uma viewport de aproximadamente 18x14 tiles ao redor do jogador. Tiles fora dessa faixa no `gs.tiles` sao dados obsoletos de posicoes anteriores. Re-adicionar o filtro de distancia resolve a duplicacao sem perder dados de outros andares.

**Arquivo: `src/lib/tibiaRelic/mapExtractor.ts`** - funcao `snapshotTilesWithCounts`

Adicionar apos a validacao de coordenadas do mundo:
```text
// Filtro de viewport: o servidor envia tiles dentro de ~18x14 do jogador.
// Tiles fora disso sao dados obsoletos de posicoes anteriores no GameState.
const camX = gs.camX;
const camY = gs.camY;
if (camX > 0 && camY > 0) {
  if (Math.abs(tx - camX) > 18 || Math.abs(ty - camY) > 14) continue;
}
```

Isso mantém a captura multi-floor (sem filtro de Z) mas impede que tiles de posicoes anteriores do jogador sejam contados repetidamente.

#### 2. Corrigir rastreamento de criaturas mortas usando ID em vez de grid

Em vez de rastrear morte por chave de grid (que falha quando a criatura se move), rastrear por ID da criatura. Assim, se a criatura ID 12345 (um "Rat") foi vista viva e depois morta, a versao morta sempre cancela a viva independente da posicao.

**Arquivo: `src/lib/tibiaRelic/mapExtractor.ts`** - funcao `snapshotCreatures`

Mudancas:
- Usar `Map<number, string>` para mapear creature ID -> grid key da ultima posicao viva
- Usar `Set<number>` para IDs de criaturas vistas mortas
- No final, para cada ID morto, remover a entry correspondente do creatureMap

```text
// Novo: mapear creature ID -> grid key para rastrear posicao
const creatureIdToKey = new Map<number, string>(); // passado como parametro
const deadCreatureIds = new Set<number>();          // substitui deadCreatures

// Quando criatura esta viva:
creatureIdToKey.set(c.id, key);
deadCreatureIds.delete(c.id);

// Quando criatura esta morta:
deadCreatureIds.add(c.id);

// No final (em extractMapTiles):
for (const deadId of deadCreatureIds) {
  const key = creatureIdToKey.get(deadId);
  if (key) creatureMap.delete(key);
}
```

### Arquivos Modificados

1. **`src/lib/tibiaRelic/mapExtractor.ts`**
   - `snapshotTilesWithCounts`: Adicionar filtro de distancia da camera (18x14) sem filtro de andar. Precisa receber `gs` para acessar camX/camY.
   - `snapshotCreatures`: Trocar rastreamento de morte de grid key para creature ID
   - `extractMapTiles`: Adicionar `creatureIdToKey` map, ajustar logica de purge final

### Resultado Esperado

- Tiles serao capturados apenas dentro da viewport real do servidor (~18x14), eliminando tiles "fantasma" de posicoes anteriores
- Todos os andares (z) continuam sendo capturados normalmente
- Criaturas mortas serao corretamente purgadas independente de onde morreram
- Sera necessario limpar o banco e re-extrair as .cam

