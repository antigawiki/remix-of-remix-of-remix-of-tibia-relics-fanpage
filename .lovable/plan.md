
# Melhorar o Algoritmo de Detecção: Não Descartar Pares Vistos Online Juntos

## Diagnóstico do problema atual

No algoritmo atual (`analyze-alt-matches`), linha 141:

```typescript
if (everTogether) continue; // ← descarte total
```

Qualquer par que tenha sido visto online junto por mais de 6 minutos é **completamente ignorado**, mesmo que tenha dezenas de padrões adjacentes suspeitos. Isso elimina casos legítimos onde:
- Um amigo logou na conta do outro temporariamente
- Um evento pontual fez os dois ficarem online ao mesmo tempo

## Solução proposta

### Algoritmo (backend): Penalizar em vez de descartar

Em vez de `continue`, o par é incluído nos resultados **com penalidade na probabilidade** proporcional ao número de vezes que foram vistos juntos versus o total de sessões:

```
penaltyFactor = 1 - (overlapCount / totalSessions) * 0.5
probability = probability * penaltyFactor
ever_online_together = true  ← salvo no banco
```

Quanto mais vezes foram vistos juntos em relação às sessões totais, menor a probabilidade final. Poucas ocorrências de overlap (ex: 2 em 50 sessões) → penalidade leve. Muitas ocorrências (ex: 20 em 40 sessões) → probabilidade cai muito, provavelmente não são alts.

O campo `ever_online_together` já existe no banco e na `makeResult`, mas nunca era `true` no método estatístico — agora será usado.

O threshold mínimo de adjacências sobe de `MIN_ADJACENCIES = 2` para `3` para casos de `everTogether = true`, exigindo mais evidência quando há overlap.

### UI (frontend): Mostrar ressalva na tabela

Na aba "Suspeitos", para linhas onde `ever_online_together = true`, adicionar:
- Um ícone de aviso (ex: `Eye`) na coluna de probabilidade ou em coluna separada
- Tooltip ou badge informando "Vistos online juntos X vez(es)"
- Cor de fundo levemente diferente na linha (amarelo claro) para diferenciar visualmente

Adicionar também um toggle/switch **"Incluir vistos juntos"** acima da tabela (marcado por padrão como `true` já que a nova lógica os inclui com penalidade). Isso permite o usuário filtrar e ver apenas os que **nunca** foram vistos juntos se preferir.

## Arquivos a modificar

### 1. `supabase/functions/analyze-alt-matches/index.ts`

Mudanças no Método 2:
- Remover o `if (everTogether) continue`
- Contar o número de overlaps (`overlapCount`) em vez de apenas detectar se houve algum
- Aplicar `penaltyFactor` na probabilidade final quando `overlapCount > 0`
- Salvar `ever_online_together: true` e `match_count` de overlaps nos resultados

```typescript
// ANTES:
if (everTogether) continue;

// DEPOIS:
let overlapCount = 0;
for (const sa of sessA) {
  for (const sb of sessB) {
    const overlapStart = Math.max(sa.login_at, sb.login_at);
    const overlapEnd = Math.min(sa.logout_at, sb.logout_at);
    if (overlapEnd - overlapStart > OVERLAP_TOLERANCE_MS) {
      overlapCount++;
    }
  }
}

// Aplicar penalidade se houver overlap
let probability = /* cálculo normal */;
if (overlapCount > 0) {
  const totalSessions = sessA.length + sessB.length;
  const penaltyFactor = Math.max(0.1, 1 - (overlapCount / totalSessions) * 0.6);
  probability = probability * penaltyFactor;
}

// Incluir no resultado com flag ever_online_together
results[keyAB] = makeResult(a, b, {
  ...
  ever_online_together: overlapCount > 0,
  probability,
});
```

### 2. `src/pages/AltDetectorPage.tsx`

- Adicionar toggle "Incluir vistos online juntos" acima da tabela de suspeitos (estado local, default `true`)
- Filtrar `filteredSuspected` pelo toggle
- Nas linhas da tabela, quando `ever_online_together = true`:
  - Mostrar badge/ícone `Eye` com texto "Visto junto" em amarelo
  - Leve fundo diferenciado na linha (`bg-yellow-500/5`)
- Adicionar coluna "Ressalva" ou integrar o ícone na coluna de probabilidade

## Resultado esperado

- Pares com 1-2 ocorrências de overlap esporádico → mantidos na lista com probabilidade levemente reduzida e marcador visual claro
- Pares vistos juntos frequentemente → probabilidade muito baixa, dificilmente passarão do threshold de 3%
- O usuário tem contexto completo para julgar cada caso
- Nenhum alt potencial é eliminado silenciosamente pelo algoritmo
