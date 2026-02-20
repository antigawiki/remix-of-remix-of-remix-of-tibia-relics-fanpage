
# Remover Penalização — Apenas Indicador Visual

## Problema atual

O backend (`analyze-alt-matches`) aplica duas penalidades para pares que já foram vistos online juntos:

1. **Threshold mais alto**: `minAdjRequired = overlapCount > 0 ? 3 : MIN_ADJACENCIES` — exige mais adjacências para pares com overlap.
2. **Penalização da probabilidade**: `probability = probability * penaltyFactor` — reduz o score proporcionalmente.

Isso derruba ou exclui pares legítimos como Toru + Amstel.

## Solução

Remover ambas as penalidades. O par é analisado normalmente, e o campo `ever_online_together` é salvo como `true` apenas para uso visual no frontend (ícone + badge "Juntos"), sem impactar a probabilidade.

## Arquivo a modificar

### `supabase/functions/analyze-alt-matches/index.ts`

Remover as linhas de:

```typescript
// REMOVER: threshold diferente por overlap
const minAdjRequired = overlapCount > 0 ? 3 : MIN_ADJACENCIES;

// REMOVER: bloco de penalização
if (overlapCount > 0) {
  const totalSessions = sessA.length + sessB.length;
  const penaltyFactor = Math.max(0.1, 1 - (overlapCount / totalSessions) * 0.6);
  probability = Math.round(probability * penaltyFactor * 100) / 100;
}
```

Manter apenas:

```typescript
// Threshold fixo independente de overlap
if (adjCount < MIN_ADJACENCIES) continue;

// Probabilidade calculada normalmente sem penalidade
// ever_online_together salvo apenas para exibição visual
ever_online_together: overlapCount > 0,
```

Após o deploy, será necessário disparar `analyze-alt-matches` manualmente para reprocessar os dados — o par Toru + Amstel deverá aparecer na aba "Suspeitos" com o ícone "Juntos" e a probabilidade real sem desconto.

## O que NÃO muda

- O ícone/badge "Juntos" no frontend continua igual
- O toggle "Incluir vistos juntos" continua funcionando
- O campo `ever_online_together` continua sendo salvo no banco
- A lógica de contagem de overlaps continua (apenas para marcar o campo, não para penalizar)
