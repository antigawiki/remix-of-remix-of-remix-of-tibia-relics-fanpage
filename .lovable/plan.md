

## Diagnóstico: A Causa Real dos "BYTES_LEFTOVER"

Analisei o JSON do Protocol Lab e a causa raiz é definitiva:

**O TibiaRelic envia TODOS os andares da superfície (7→0), não apenas ±2.**

### Prova nos Dados

Frame 0 (z=7, payload=3362 bytes):

```text
Estratégia A (±2, lê floors 7,6,5):    2602 bytes consumidos → 759 bytes sobrando
Estratégia C (±3, lê floors 7,6,5,4):  2696 bytes consumidos → 651 bytes sobrando  
Estratégia E (7→0, lê floors 7→0):     2716 bytes consumidos → 0 bytes sobrando, 46 opcodes parseados!
```

Os andares distantes custam apenas 2 bytes cada (marcador de skip 0xFFFF):
- Floor 7: 1296 bytes (andar principal)
- Floor 6: 816 bytes
- Floor 5: 476 bytes
- Floor 4: 108 bytes
- Floor 3: 0 bytes (exhausted)
- Floor 2: 2 bytes (skip marker)
- Floor 1: 2 bytes (skip marker)
- Floor 0: 2 bytes (skip marker)

Com ±2, paramos no floor 5. Os bytes dos floors 4-0 (114 bytes) ficam no buffer + 645 bytes de opcodes válidos (talk, effects, etc) = 759 bytes "leftover". Esses opcodes NUNCA são processados.

Frame 24 (z=7): estratégia A deixa 17 bytes, estratégia C (±3) deixa 0. O floor 4 tinha 36 bytes de dados.

**150 de 150 anomalias são BYTES_LEFTOVER. Zero desyncs reais. O parser funciona corretamente — só não lê andares suficientes.**

### Plano de Correção

A correção é simples e cirúrgica: mudar `getFloorRange` para ler todos os andares que o TibiaRelic envia.

**`packetParser.ts` — `getFloorRange`:**

Atual:
```typescript
// Surface: ±2 floors only
return { startz: Math.min(z + 2, 7), endz: Math.max(z - 2, 0), zstep: -1 };
// Underground: z-2 to z+2
return { startz: z - 2, endz: Math.min(z + 2, 15), zstep: 1 };
```

Novo:
```typescript
// Surface: FULL range 7→0 (TibiaRelic sends all surface floors)
return { startz: 7, endz: 0, zstep: -1 };
// Underground: FULL range z-2 → z+2 (manter ±2 por enquanto)
return { startz: z - 2, endz: Math.min(z + 2, 15), zstep: 1 };
```

**`packetParser.ts` — `floorUp` e `floorDown`:**

Os handlers de mudança de andar também precisam ser ajustados para ler a quantidade correta de novos floors quando o jogador sobe/desce. Atualmente leem apenas 1 novo floor (o ±2 mais distante). Com range completo na superfície, quando sobe de z=8→z=7, precisa ler todos os floors de superfície que ficaram visíveis (5 a 0), não apenas o floor 5.

**`camProtocolLab.ts`:**

Atualizar a estratégia "A" para refletir o novo range (7→0) e remover a estratégia E (que se torna idêntica à A). Adicionar uma nota no resumo indicando que o range correto foi identificado.

### Resultado Esperado

Com essa mudança, todos os bytes de cada frame serão consumidos corretamente. Os 759 bytes de opcodes que hoje são "perdidos" (talks, effects, creature updates) passarão a ser processados, corrigindo problemas visuais no player como chat messages faltando, efeitos não aparecendo, e estados de criaturas desatualizados.

