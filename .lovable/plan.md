

## Corrigir Tiles Desenhados Por Cima do Player

### Problema

Quando o player anda, o sprite do tile vizinho aparece **por cima** do sprite do player (como mostra a imagem). Isso acontece porque o renderer atual desenha **tile por tile** -- ou seja, para cada tile (tx,ty), desenha chao, itens, criaturas e topo antes de passar pro proximo tile. Quando o player esta entre dois tiles (walk offset ativo), o tile seguinte ainda nao foi processado, e quando e processado, seu chao e itens sao desenhados por cima da criatura ja renderizada no tile anterior.

### Como o OTClient/Tibiarc Resolve

No cliente original e no OTClient, a renderizacao e feita em **passes globais**:
1. Primeiro, desenha o chao de **todos** os tiles
2. Depois, desenha itens de **todos** os tiles
3. Depois, desenha **todas** as criaturas
4. Por ultimo, desenha itens de topo de **todos** os tiles

Isso garante que criaturas sempre fiquem acima de qualquer chao/item regular, independente da posicao de walk.

### Correcao

**Arquivo: `src/lib/tibiaRelic/renderer.ts`**

Reestruturar o loop de renderizacao no metodo `draw()` de per-tile para passes globais:

**Antes (per-tile):**
```
for each tile:
  draw ground
  draw items  
  draw creatures  // <-- pode ficar atras do chao do tile vizinho
  draw top
```

**Depois (passes globais):**
```
Pass 1: for each tile -> draw ground + clip + bottom (stackPrio 0,1,2)
Pass 2: for each tile -> draw regular items (stackPrio 4,5)
Pass 3: for each tile -> draw creatures (com walk offset)
Pass 4: for each tile -> draw top items (stackPrio 3)
```

Na implementacao, para cada floor visivel, coleto a informacao de elevacao e posicao dos tiles, e depois itero 4 vezes separadamente. Criaturas que estao andando entre tiles serao desenhadas no Pass 3, que ocorre **depois** de todos os chao e itens regulares ja estarem na tela.

Tambem preciso armazenar o `elevationOffset` calculado no Pass 1 para reutilizar nos passes seguintes (em um array temporario indexado por tx,ty).

### Detalhes Tecnicos

- Criar um array 2D temporario `elevMap[ty][tx]` para guardar elevacao calculada no Pass 1
- Separar os 4 `for` loops internos em 4 loops externos independentes sobre todos os tiles
- Manter a mesma logica de `camOffX/camOffY` e bounds checking
- Nenhuma mudanca em outros arquivos
