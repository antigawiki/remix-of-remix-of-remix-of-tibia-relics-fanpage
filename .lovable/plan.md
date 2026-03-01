

## Melhorias do Gesior otclient_mapgen para o nosso Cam Map

Apos analisar o projeto Gesior em detalhe e comparar com o nosso renderer, identifiquei **3 melhorias concretas** que podem corrigir artefatos visuais e melhorar a qualidade do mapa.

---

### 1. Elevation Accumulation (Acumulo de Elevacao)

**Problema atual**: Nosso `drawItem` desenha cada item independentemente sem considerar elevation. Itens empilhados (ex: caixas, pedras decorativas) ficam sobrepostos exatamente na mesma posicao, criando uma aparencia "achatada".

**Como o Gesior faz**: No `tile.cpp`, ele acumula `m_drawElevation` por item, deslocando cada item subsequente por `-(elevation, elevation)` pixels. Limita em `MAX_ELEVATION` (24px).

```text
Tile::drawToImage:
  m_drawElevation = 0
  for each thing:
    draw at (x - m_drawElevation, y - m_drawElevation)
    m_drawElevation += thing.elevation
    clamp to MAX_ELEVATION
```

**Mudanca**: No `renderChunk`, manter um acumulador de elevacao por tile ao iterar os items. Cada item deslocado por `-elevation` em ambos os eixos.

---

### 2. Ordem de Desenho por Stack Priority (Draw Order)

**Problema atual**: Nosso renderer itera os items na ordem em que foram salvos, sem separar ground/borders/walls/items. Se a ordem no banco estiver incorreta, items aparecem sobrepostos de forma errada.

**Como o Gesior faz**: O `tile.cpp` usa 3 passes de desenho distintas:
1. Ground + GroundBorders + OnBottom (prioridade 0-3) - ordem normal
2. Items normais (prioridade 5) - ordem reversa (`rbegin`)
3. OnTop (prioridade 3) - por cima de tudo

**Mudanca**: No `renderChunk`, separar os items de cada tile em 3 grupos baseados no `stackPrio` do dat, e desenhar na ordem correta. Items com `stackPrio >= 4` devem ser desenhados em ordem reversa.

---

### 3. Sprite Index com Layer Support

**Problema atual**: Nosso `getItemSpriteIndex` ignora layers (sempre usa `l=0`). Para itens com multiplas layers (como paredes com transparencia), isso pode causar renderizacao incompleta.

**Como o Gesior faz**: No `drawToImage`, itera `for l = 0; l < m_layers; l++` desenhando cada layer sequencialmente.

**Mudanca**: Iterar por todas as layers no `drawItem`, desenhando `l=0` ate `l=def.layers-1`.

---

### Detalhes Tecnicos de Implementacao

**Arquivo: `src/lib/tibiaRelic/mapTileRenderer.ts`**

#### Mudanca 1 - Elevation no drawItem/renderChunk:

```typescript
// No loop de items dentro de renderChunk, adicionar acumulo:
const MAX_ELEVATION = 24;
let drawElevation = 0;

for (const itemId of items) {
  const def = this.dat.items.get(itemId);
  if (!def) continue;
  // desenhar com offset de elevacao
  this.drawItem(ctx, def, px - drawElevation, py - drawElevation, wx, wy);
  // acumular elevacao
  drawElevation = Math.min(drawElevation + def.elevation, MAX_ELEVATION);
}
```

#### Mudanca 2 - Separar passes por prioridade:

```typescript
// Separar items em grupos
const ground: number[] = [];   // stackPrio 0-3
const normal: number[] = [];   // stackPrio 4-5
const onTop: number[] = [];    // stackPrio 3 com flag isOnTop (usar stackPrio === 3)

for (const itemId of items) {
  const def = this.dat.items.get(itemId);
  if (!def) continue;
  if (def.stackPrio <= 3) ground.push(itemId);
  else normal.push(itemId);
}

// Ground: ordem normal
// Normal items: ordem reversa
normal.reverse();

// Desenhar ground, depois normal
```

#### Mudanca 3 - Multi-layer support:

```typescript
private drawItem(ctx, def, px, py, wx, wy) {
  const L = Math.max(1, def.layers);
  for (let l = 0; l < L; l++) {
    for (let th = 0; th < def.height; th++) {
      for (let tw = 0; tw < def.width; tw++) {
        const sid = this.getItemSpriteIndex(def, wx, wy, tw, th, l);
        // ... draw
      }
    }
  }
}
```

---

### O que NAO se aplica ao nosso caso

- **Multifloor rendering/coveredUp**: O Gesior renderiza tiles de multiplos andares com transparencia. Nosso mapa ja mostra um floor por vez, entao nao precisamos disso.
- **isCompletelyCovered**: Otimizacao de oclusao para quando um tile acima cobre completamente o de baixo. Nao relevante para nosso mapa single-floor.
- **Light system**: O sistema de iluminacao nao se aplica ao nosso mapa estatico 2D.

