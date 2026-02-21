

# Reverter Suspeitos: Separar Confirmados de Estatisticos

## Problema Atual
Apos a ultima mudanca, pares confirmados por conta (API) aparecem na aba Suspeitos, poluindo a lista. O usuario quer separacao clara:
- **Alts por Conta**: mostra apenas o que a API retorna (visivel)
- **Suspeitos**: mostra apenas pares detectados estatisticamente, mesmo que cheguem a probabilidade alta

## Solucao

Reverter as duas mudancas feitas anteriormente:

### 1. Backend: `supabase/functions/analyze-alt-matches/index.ts`
- Restaurar o `if (results[keyAB]) continue;` no loop estatistico (linha 121/179-184)
- Isso faz o backend voltar a pular pares ja confirmados por conta durante a analise estatistica
- Pares confirmados continuam sendo salvos com prob 99 no banco (via METHOD 1), mas nao recebem stats

### 2. Frontend: `src/pages/AltDetectorPage.tsx`
- Restaurar o filtro `.lt('probability', 99)` na query de matches
- Isso esconde pares confirmados da aba Suspeitos
- Se um par chegar a probabilidade alta (ate 80%, que e o cap estatistico) puramente por tracking, ele permanece visivel em Suspeitos
- Quando/se esse par sair do "hidden" e a API passar a retorna-lo, ele aparece em "Alts por Conta" e o sistema de conta o marca com prob 99, removendo-o automaticamente de Suspeitos

### Resultado
- Pares confirmados pela API: so aparecem em "Alts por Conta"
- Pares estatisticos (incluindo hidden): aparecem em "Suspeitos" com probabilidade ate 80%
- Se um par hidden for detectado pela API (sair do hidden): migra automaticamente de Suspeitos para Alts por Conta

