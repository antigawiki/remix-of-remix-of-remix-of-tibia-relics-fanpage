

## Analise do Log de Debug e Plano de Correcao

### Descobertas Criticas

Analisando os 2000 eventos do log, identifiquei **duas causas raiz** que explicam TODOS os problemas visuais:

---

### Causa Raiz 1: syncPlayerToCamera sobrescreve a posicao correta do player

O log mostra claramente o que acontece:

```text
[4535.66s] MOVE_CR cid=268 isPlayer=true ... toX=32926 toY=32592  (player vai pro sul, Y=32592)
[4536.47s] MOVE_CR cid=268 isPlayer=true ... toX=32927 toY=32592  (player vai pro leste, Y=32592)
[4536.47s] SCROLL dx=1 ... newCam="32927,32591"  (camera: Y=32591)
[4536.47s] SYNC_PLAYER oldPlayerPos="32927,32592" camPos="32927,32591"  <-- SOBRESCREVE Y de 32592 para 32591!
```

O `syncPlayerToCamera` e chamado a cada scroll (0x65-0x68) e FORCA `player.x/y/z = g.camX/Y/Z`. Mas o player ja tem a posicao correta via `moveCr`. Resultado: o player "pula" 1 tile na direcao errada a cada scroll.

**Correcao:** NAO chamar `syncPlayerToCamera` nos scrolls. O scroll atualiza a camera e le novos tiles, mas a posicao do player vem exclusivamente do `moveCr`. Manter `syncPlayerToCamera` apenas para `mapDesc`, `floorUp`, `floorDown` e opcode `0x9A` (teleports e mudancas de andar).

---

### Causa Raiz 2: WALK_FAIL em massa (~80% dos moveCr falham)

O log mostra centenas de WALK_FAIL com `tileLength=1` -- o tile existe mas nao tem criatura. Isso acontece porque:

1. `readMultiFloorArea` (chamado pelo scroll) reconstroi tiles a partir dos dados do protocolo
2. Os dados do protocolo NAO incluem criaturas existentes -- elas sao entidades separadas
3. Quando o tile e reconstruido, a referencia `['cr', cid]` da criatura e APAGADA
4. No proximo `moveCr`, o tile de origem nao tem a criatura, entao `WALK_FAIL`

O `setTilePreservingCreatures` ja existe (linha 170) mas nao esta sendo usado corretamente no `readTileItems`.

**Correcao:** Ao ler tiles do protocolo (readTileItems/readMultiFloorArea), PRESERVAR as referencias de criaturas que ja estao no tile. Isso evita que criaturas "desaparecam" do tile apos um scroll.

---

### Plano de Implementacao

**Arquivo: `src/lib/tibiaRelic/packetParser.ts`**

**Mudanca 1: Remover syncPlayerToCamera do scroll**

No metodo `scroll()` (linha 468), remover a chamada `this.syncPlayerToCamera()`. O scroll so atualiza `g.camX/Y` e le novos tiles. A posicao do player e mantida pelo `moveCr`.

**Mudanca 2: Preservar criaturas ao ler tiles do protocolo**

No `readTileItems` (ou na funcao que popula tiles durante scroll/mapDesc), ao definir um tile novo, manter as entradas `['cr', cid]` que ja existiam naquele tile. Verificar se `setTilePreservingCreatures` esta sendo usado onde o tile e inicializado antes de `readTileItems`.

**Mudanca 3: Re-inserir criaturas nos tiles apos area read**

Apos `readMultiFloorArea` finalizar, percorrer todas as criaturas conhecidas e garantir que cada uma tenha uma referencia `['cr', cid]` no tile correspondente a sua posicao `(c.x, c.y, c.z)`. Isso funciona como um "safety net" apos leitura de mapa.

---

### Resumo tecnico

| Mudanca | Local | Efeito |
|---|---|---|
| Remover syncPlayerToCamera do scroll | `scroll()` linha 468 | Player nao pula de posicao a cada passo |
| Preservar criaturas nos tiles | `readTileItems` / area read | Criaturas nao desaparecem apos scroll |
| Safety net pos-area read | Apos `readMultiFloorArea` | Garante consistencia creature <-> tile |

### Por que isso vai funcionar

1. O log PROVA que `syncPlayerToCamera` sobrescreve a posicao correta (linhas 206-219 do log)
2. O log PROVA que WALK_FAIL acontece porque tiles nao tem criaturas (`tileLength=1`)
3. Ambos os problemas tem correcoes cirurgicas que nao afetam o fluxo normal do protocolo
4. `mapDesc`, `floorUp/Down` e `0x9A` continuam sincronizando (necessario para teleports/mudanca de andar)

