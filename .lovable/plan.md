

## Reverter Mudanças Problemáticas e Corrigir de Forma Mais Segura

### O que deu errado

As duas mudanças introduzidas (renderCamZ safety check + 4th fallback + camZ sync no moveCr) estao interferindo com o fluxo existente do protocolo. O sistema ja tinha mecanismos funcionais para sincronizar andares (syncPlayerToCamera chamado por fullMapDesc, floorUp, floorDn) e as mudancas novas criam conflitos.

### Plano: Reverter ambas as mudancas

**Arquivo 1: `src/lib/tibiaRelic/renderer.ts`** (linha 191)

Reverter o renderCamZ para usar apenas `g.camZ` como antes:
```typescript
// ANTES (bugado):
const renderCamZ = (player && !this.floorOverride && player.z !== g.camZ) ? player.z : g.camZ;

// DEPOIS (revertido):
const renderCamZ = g.camZ;
```

O `g.camZ` e a fonte autoritativa de andar -- ele e atualizado pelo protocolo nos momentos corretos (fullMapDesc, floorUp, floorDn). Usar `player.z` como override causa saltos de andar durante transicoes normais.

---

**Arquivo 2: `src/lib/tibiaRelic/packetParser.ts`**

Duas reversoes:

1. **Remover o 4th global fallback** (linhas 556-564) -- a busca global por criatura nas coordenadas pode pegar a criatura errada e causar movimentos invalidos. Os 3 fallbacks existentes (stackpos exato, posicao matching no tile, qualquer criatura no tile) sao suficientes.

2. **Remover o camZ sync no moveCr** (linhas 586-593) -- a sincronizacao de camZ ja e feita corretamente pelos handlers de `floorUp`/`floorDn`/`fullMapDesc` que processam os pacotes de mapa. Sincronizar no `moveCr` causa dupla-atualizacao e estados inconsistentes.

### Resultado esperado

- O mapa volta a renderizar corretamente (sem areas escuras/vazias)
- O andar da camera volta a ser controlado exclusivamente pelo protocolo
- Nenhuma regressao nos movimentos de criaturas

### Sobre os bugs originais (desync de andar e walk animation)

Esses bugs provavelmente tem causas mais sutis no protocolo (ex: opcodes nao tratados, ou drift acumulado de bytes). A abordagem correta seria adicionar LOGGING para identificar exatamente quando o desync acontece, em vez de tentar corrigir com heuristicas que quebram o fluxo normal.

