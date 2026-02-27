

## Correcao de Criaturas Fora de Posicao e Invisiveis Apos Seek

### Problemas Identificados

#### Bug 1: `moveCr` Format A remove duas criaturas do tile (BUG CRITICO)

No codigo atual (linhas 462-497), quando o stackpos e valido e encontra uma criatura:
1. A criatura e encontrada no stackpos (linha 463-469) e `cid` e definido
2. O codigo **cai direto** no loop de busca por posicao (linha 474-485) **SEM verificar se `cid` ja foi encontrado**
3. Isso remove uma SEGUNDA criatura do mesmo tile
4. Resultado: criaturas desaparecem (ficam no `gs.creatures` mas sem referencia no tile)

Isso explica exatamente o que voce ve: o player "Ondeth Waters" existe no GameState (ataques aparecem nele), mas ele nao aparece visualmente porque foi removido do tile por um `moveCr` de outra criatura.

#### Bug 2: Seek nao recria criaturas que saem da viewport

Quando fazemos seek (adiantar o video), a limpeza pos-seek (linhas 220-230) remove criaturas "orfas" (que nao estao em nenhum tile). Porem, o problema e que durante o seek com `seekMode=true`, os movimentos de criaturas continuam acontecendo normalmente, e o Bug 1 acima causa perdas que se acumulam ao longo de milhares de frames processados rapidamente.

#### Bug 3: Criaturas com posicao (0,0,0) nunca sao limpas do tile antigo

Na funcao `placeCreatureOnTile` (linha 543-553), criaturas com posicao `(0,0,0)` nao tem sua posicao antiga limpa (`if (c.x !== 0 || c.y !== 0 || c.z !== 0)`). Uma criatura recem-criada com posicao padrao (0,0,0) pode ficar duplicada se colocada no tile (0,0,0) e depois movida.

### Plano de Implementacao

#### 1. Corrigir `moveCr` Format A -- guarda `if (cid === null)` (`src/lib/tibiaRelic/packetParser.ts`)

O loop de busca por posicao (linhas 474-485) e o fallback (linhas 487-496) devem estar dentro de blocos `if (cid === null)`. Sem isso, cada `moveCr` pode remover uma criatura extra do tile.

```text
Antes (simplificado):
  if (stackpos valido && criatura encontrada) {
    cid = ...; splice
  }
  // SEMPRE executa -- BUG!
  for (busca por posicao) { ... }
  if (cid === null) { fallback }

Depois:
  if (stackpos valido && criatura encontrada) {
    cid = ...; splice
  }
  if (cid === null) {      // <-- GUARDA ADICIONADA
    for (busca por posicao) { ... }
  }
  if (cid === null) { fallback }
```

#### 2. Melhorar limpeza pos-seek (`src/components/TibiarcPlayer.tsx`)

Alem de remover orfaos, fazer o inverso: verificar se criaturas no `gs.creatures` que TEM posicao valida estao realmente presentes no tile correspondente. Se nao, reinseri-las. Isso corrige criaturas que foram removidas indevidamente durante o processamento rapido do seek.

```text
// Apos limpar orfaos, reinserir criaturas validas que faltam no tile
for (const [cid, c] of gs.creatures.entries()) {
  const tile = gs.getTile(c.x, c.y, c.z);
  if (!tile.some(i => i[0] === 'cr' && i[1] === cid)) {
    tile.push(['cr', cid]);
    gs.setTile(c.x, c.y, c.z, tile);
  }
}
```

#### 3. Corrigir `placeCreatureOnTile` para sempre limpar posicao antiga (`src/lib/tibiaRelic/packetParser.ts`)

Remover a condicao `(c.x !== 0 || c.y !== 0 || c.z !== 0)` e sempre chamar `removeCreatureFromTile` na posicao anterior. A funcao `removeCreatureFromTile` ja e defensiva e nao faz nada se a criatura nao esta no tile.

### Arquivos a Editar

1. **`src/lib/tibiaRelic/packetParser.ts`**
   - Linhas 474-497: Adicionar `if (cid === null)` antes dos loops de busca
   - Linhas 543-547: Remover condicional em `placeCreatureOnTile`

2. **`src/components/TibiarcPlayer.tsx`**
   - Linhas 220-231: Adicionar reinsercao de criaturas validas nos tiles apos limpeza de orfaos

### Resultado Esperado

- Criaturas nao desaparecem mais apos seek/adiantar o video
- Players como "Ondeth Waters" aparecem corretamente na posicao onde estao sendo atacados
- Posicoes das criaturas ficam consistentes entre o GameState e os tiles

