

# Suspeitos: Mostrar Todos os Matches (incluindo confirmados)

## Problema

Jogadores "hidden" na API do TibiaRelic nao aparecem no scraping de conta, entao nunca vao para "Alts por Conta". Porem, o tracker de sessoes captura seus logins/logouts normalmente. O problema e que o backend pula a analise estatistica para pares ja confirmados por conta (`if (results[keyAB]) continue;`), e o frontend filtra `.lt('probability', 99)` -- entao esses pares confirmados nunca aparecem na aba Suspeitos com dados estatisticos reais.

## Solucao

Fazer a aba **Suspeitos** mostrar TODOS os pares com match estatistico, independente de ja estarem confirmados por conta. A aba **Alts por Conta** continua igual (so mostra o que a API retorna).

## Mudancas

### 1. Backend: `supabase/functions/analyze-alt-matches/index.ts`

- Remover o `if (results[keyAB]) continue;` no loop estatistico
- Em vez de pular, quando o par ja tem resultado confirmado (prob 99), manter a probabilidade 99 mas atualizar os campos estatisticos (match_count, total_sessions_a/b, ever_online_together)
- Isso garante que pares confirmados tambem tenham dados de sessao preenchidos

### 2. Frontend: `src/pages/AltDetectorPage.tsx`

- Remover o filtro `.lt('probability', 99)` na query de matches
- Buscar TODOS os registros de `alt_detector_matches`
- Adicionar um indicador visual (badge "Confirmado") para matches com probability = 99, diferenciando-os dos puramente estatisticos na tabela

## Resultado

- **Alts por Conta**: sem mudanca, mostra apenas grupos da API
- **Suspeitos**: mostra todos os pares com adjacencias detectadas, incluindo os confirmados por conta (com badge "Confirmado" e dados reais de sessao) e os hidden que so aparecem via tracking

## Detalhes Tecnicos

### Backend (`analyze-alt-matches/index.ts`)

No loop estatistico (linha ~107), substituir:

```text
if (results[keyAB]) continue;
```

Por logica que, ao encontrar par ja confirmado, atualiza os campos estatisticos mantendo prob 99:

```typescript
const existingConfirmed = results[keyAB];
// Se ja confirmado, vamos calcular stats mas manter prob 99
// (continua o calculo normal, merge no final)
```

Apos calcular adjCount/probability normalmente, se o par ja existia com prob 99, fazer merge dos dados estatisticos no resultado existente em vez de criar novo.

### Frontend (`AltDetectorPage.tsx`)

- Linha 218: remover `.lt('probability', 99)`
- Na tabela de suspeitos, adicionar badge "Confirmado" quando `probability >= 99` para diferenciar visualmente

