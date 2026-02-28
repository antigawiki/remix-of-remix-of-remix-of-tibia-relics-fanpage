

## Plano: Corrigir Junção de Tiles, Monstros Mortos e Players Brancos

### Problemas Identificados

1. **Tiles duplicados em areas com multiplas .cam**: A funcao SQL `merge_cam_chunk` faz UNION de arrays de items por tile. Quando 2+ cams cobrem a mesma area, os items se acumulam (ex: tile que tinha [100, 200] na cam1 e [100, 300] na cam2 vira [100, 200, 300]). Isso empilha sprites desnecessarios e gera desalinhamento visual.

2. **Monstros mortos na cena**: O extrator captura criaturas na primeira vez que sao vistas vivas (`if (!creatureMap.has(key))`). Se o monstro morre depois, a entrada antiga permanece. Precisa usar "ultimo avistamento" e verificar se a criatura ainda esta viva.

3. **Criaturas com outfit de player branco**: O filtro atual (`head !== 0 || body !== 0 || legs !== 0 || feet !== 0`) so pega players com cores customizadas. Players com cores padrao (tudo zero) passam pelo filtro e aparecem como "bonecos brancos".

---

### Solucao

#### 1. Deduplicar tiles no carregamento (`CamMapPage.tsx`)

Na funcao `loadChunks`, ao processar cada tile de um chunk, verificar se ja existe um `TileData` para aquela coordenada absoluta no sub-chunk. Se existir, fazer merge dos item IDs (sem duplicatas) em vez de adicionar outra entrada.

```text
// Antes: arr.push({ x: absX, y: absY, z, items: itemIds })
// Depois: verificar se ja existe entry para (absX, absY), mergear items
const existingIdx = arr.findIndex(t => t.x === absX && t.y === absY);
if (existingIdx >= 0) {
  // Union de item IDs (Set para deduplicar)
  const merged = new Set([...arr[existingIdx].items, ...itemIds]);
  arr[existingIdx].items = Array.from(merged);
} else {
  arr.push({ x: absX, y: absY, z, items: itemIds });
}
```

Porem o problema principal e que **dentro de um chunk** cada posicao relativa e unica (chave JSONB). A duplicacao vem do UNION no merge SQL que acumula items diferentes de cams diferentes para a mesma posicao. A solucao real e **filtrar items durante o rendering**:

No `mapTileRenderer.ts`, na hora de renderizar cada tile, manter apenas items com `stackPrio <= 1` (ground + borders). Isso remove itens soltos, cadaveres e qualquer lixo acumulado, mantendo apenas o terreno limpo.

#### 2. Corrigir criaturas mortas (`mapExtractor.ts`)

Mudar estrategia de "primeiro avistamento" para "ultimo avistamento com validacao":
- Sempre sobrescrever a entrada no creatureMap (remover o `if (!creatureMap.has(key))`)
- Apos a extracao completa, fazer uma passagem final removendo criaturas que foram vistas mortas (health <= 0) na ultima snapshot

Adicionar tracking de criaturas mortas: quando `c.health <= 0`, registrar o nome+grid como "morto" e remover do creatureMap no final.

#### 3. Filtrar players brancos (`mapExtractor.ts`)

Adicionar filtro extra para excluir criaturas cujo `outfitId` esta na faixa de outfits de player (tipicamente 128-143 no Tibia 7.x) E que nao sao monstros conhecidos. Como nao temos lista de monstros no extrator, usar heuristica:

- Se `c.outfit` esta na faixa 128-143 (outfits basicos de jogadores humanos) E as cores sao todas zero, e muito provavel que seja um player com outfit padrao. Pular.
- Monstros com esses outfit IDs geralmente sao NPCs que tem nomes conhecidos. Essa heuristica pode perder alguns NPCs, mas resolve o problema dos players brancos.

Alternativa mais segura: manter uma lista de nomes de criaturas conhecidas (da tabela `creatures` do banco) e so aceitar criaturas cujo nome esta na lista. Isso requer carregar a lista antes da extracao.

---

### Arquivos Modificados

1. **`src/lib/tibiaRelic/mapExtractor.ts`**
   - `snapshotCreatures`: remover `if (!creatureMap.has(key))` para sempre sobrescrever (ultimo avistamento)
   - Adicionar tracking de mortos: criar `deadCreatures` Set para rastrear criaturas vistas mortas
   - Apos extracao, remover do creatureMap qualquer criatura que aparece no deadCreatures
   - Adicionar filtro de outfit ID para pular faixa 128-143 com cores zero

2. **`src/lib/tibiaRelic/mapTileRenderer.ts`**
   - `renderChunk`: filtrar items por `stackPrio <= 1` antes de renderizar, mantendo apenas ground e bordas

3. **`src/pages/CamBatchExtractPage.tsx`**
   - Antes de iniciar extracao, carregar lista de nomes de criaturas do banco para usar como whitelist (opcional, se a heuristica de outfit nao for suficiente)

### Observacao
Sera necessario limpar os dados existentes no banco (deletar criaturas com nomes de players e re-extrair as .cam) para que as correcoes tenham efeito completo.

