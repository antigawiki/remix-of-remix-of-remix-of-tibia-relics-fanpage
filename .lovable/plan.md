

## Correcao: Remover syncPlayerToCamera de floorUp/floorDown

### Causa Raiz Confirmada pelo Log

O log prova EXATAMENTE o que acontece:

```text
[12.62s] MOVE_CR cid=268 toX=32953 toY=32076 toZ=6   <-- posicao CORRETA (moveCr)
[12.62s] 0xBE (floorUp) -> camZ--, camX++, camY++     <-- camera ajusta viewport
[12.62s] SYNC_PLAYER oldPlayerPos="32953,32076,6" camPos="32954,32078,6"  <-- SOBRESCREVE!
[13.55s] WALK_FAIL fromX=32953 fromY=32076 fromZ=6    <-- player nao esta mais aqui
[14.22s] WALK_FAIL ...                                  <-- tudo quebrado daqui em diante
```

O `floorUp` faz `camX++; camY++` como correcao de perspectiva para leitura de tiles. Isso e correto para o viewport, mas NAO representa a posicao do player. O `syncPlayerToCamera` copia essa posicao ajustada para o player, destruindo a posicao correta que `moveCr` ja definiu.

### Correcao

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`**

**Mudanca 1: floorUp** (linha 738)

Substituir `this.syncPlayerToCamera(oldZ)` por `this.cleanupDistantCreatures(g.camZ)`.

O `moveCr` ja definiu player.z corretamente. O cleanup de criaturas distantes ainda e necessario, mas a sincronizacao de posicao nao.

**Mudanca 2: floorDown** (linha 766)

Mesma mudanca: substituir `this.syncPlayerToCamera(oldZ)` por `this.cleanupDistantCreatures(g.camZ)`.

**Mudanca 3: Garantir que reinsertCreaturesOnTiles roda apos floor change**

Adicionar chamada a `this.reinsertCreaturesOnTiles()` apos o cleanup em floorUp e floorDown, garantindo que o player e outras criaturas estejam corretamente mapeados nos tiles do novo andar.

### Por que isso vai funcionar

1. O log PROVA que tudo funciona perfeitamente ANTES do sync no floor change (linhas 1-46)
2. O log PROVA que TUDO quebra IMEDIATAMENTE apos o sync (linhas 59+)
3. A unica mudanca entre "funciona" e "nao funciona" e a chamada `syncPlayerToCamera` no `floorUp`
4. `syncPlayerToCamera` continua sendo chamado em `mapDesc` (login/teleport) e opcode `0x9A` onde e realmente necessario
5. `cleanupDistantCreatures` continua limpando criaturas de andares distantes
6. `reinsertCreaturesOnTiles` garante que nenhuma criatura fique sem referencia no tile

### Resumo

| Local | Antes | Depois |
|---|---|---|
| `floorUp()` linha 738 | `syncPlayerToCamera(oldZ)` | `cleanupDistantCreatures(g.camZ)` + `reinsertCreaturesOnTiles()` |
| `floorDown()` linha 766 | `syncPlayerToCamera(oldZ)` | `cleanupDistantCreatures(g.camZ)` + `reinsertCreaturesOnTiles()` |

