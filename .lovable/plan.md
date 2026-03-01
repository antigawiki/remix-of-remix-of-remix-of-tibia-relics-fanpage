

## Corrigir tiles fora de posicao (perspective offset)

### Causa raiz

O protocolo Tibia envia dados de multiplos andares simultaneamente, aplicando um **perspective offset** visual: `offset = camZ - floorZ`. Isso faz tiles de andares adjacentes serem armazenados no GameState com coordenadas X,Y deslocadas.

Exemplo concreto:
- Jogador no andar 7 (superficie). Parser le andar 5 com offset = 7-5 = **2**
- Tile real em (32100, 32200, 5) e armazenado como (32102, 32202, 5) no GameState
- O extrator (`snapshotTiles`) captura essa coordenada errada e salva no banco
- No mapa, essa parede subterranea aparece 2 tiles deslocada, em cima do deserto

Isso explica tanto as "paredes no deserto" quanto as "montanhas quebradas" -- sao tiles de andares adjacentes renderizados com offset incorreto.

### Correcao

**Arquivo: `src/lib/tibiaRelic/mapExtractor.ts`**

Na funcao `snapshotTiles`, reverter o perspective offset antes de salvar:

```text
Para cada tile no GameState com coordenadas (tx, ty, tz):
  offset = camZ - tz
  realX = tx - offset
  realY = ty - offset
  Salvar com chave "realX,realY,tz" ao inves de "tx,ty,tz"
```

Mudanca especifica no codigo:

```typescript
// ANTES (salva coordenadas com offset):
const items: number[] = [];
for (const item of tileItems) { ... }
if (items.length > 0) {
  latestTiles.set(key, items);
}

// DEPOIS (corrige offset antes de salvar):
const offset = camZ - tz;
const realX = tx - offset;
const realY = ty - offset;

// Validar coordenadas corrigidas
if (realX < 30000 || realX > 35000 || realY < 30000 || realY > 35000) continue;

const items: number[] = [];
for (const item of tileItems) { ... }
if (items.length > 0) {
  const correctedKey = `${realX},${realY},${tz}`;
  latestTiles.set(correctedKey, items);
}
```

A checagem de proximidade tambem usa as coordenadas corrigidas:
```typescript
if (camX > 0 && camY > 0) {
  if (Math.abs(realX - camX) > 18 || Math.abs(realY - camY) > 14) continue;
}
```

### Impacto

- Tiles de todos os andares visiveis serao salvos com coordenadas mundiais corretas
- O offset e zero para o andar atual (camZ == tz), entao nao afeta tiles do floor corrente
- Necessario re-extrair as .cam e re-gerar o mapa para corrigir dados existentes no banco

### Nenhuma outra alteracao necessaria
- O renderizador (`mapTileRenderer.ts`) nao precisa de mudanca
- O viewer (`CamMapPage.tsx`) nao precisa de mudanca
- O upload e compactacao continuam iguais
