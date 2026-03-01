

## Corrigir bug de cache ao trocar de floor

### Problema
O metodo `invalidateFloor(z)` usa `key.endsWith(',${z}')` para encontrar entradas no cache. Com os novos sufixos (`,below`, `,noitems`), as chaves como `4151,4067,7,below` nao sao encontradas, causando tiles fantasma do floor anterior.

### Correcao

**Arquivo: `src/lib/tibiaRelic/mapTileRenderer.ts`**

Alterar o metodo `invalidateFloor` para extrair o valor de z pela posicao fixa (terceiro elemento) em vez de verificar o final da string:

```typescript
// De:
if (key.endsWith(`,${z}`)) toDelete.push(key);

// Para:
const parts = key.split(',');
if (parts[2] === String(z)) toDelete.push(key);
```

Isso garante que chaves como `4151,4067,7`, `4151,4067,7,below` e `4151,4067,7,noitems` sejam todas invalidadas corretamente ao trocar de floor.

### Nenhuma outra alteracao
- ID 231 NAO sera adicionado aos shovel spots (e areia normal)
- Nenhuma mudanca no upload, viewer ou banco de dados

