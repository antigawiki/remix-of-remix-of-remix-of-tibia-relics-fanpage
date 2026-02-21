

# Unificar coleta: Uma unica funcao para mortes E alts

## Problema

Hoje existem **duas funcoes separadas** que chamam **a mesma API** (`/api/Community/character/by-name`):
- `scrape-character-accounts` - extrai `characters` (alts)
- `collect-deaths` - extrai `deaths`

Isso dobra o numero de requests desnecessariamente e causa rate limiting (429).

## Solucao

Unificar tudo em `scrape-character-accounts`, que ja roda a cada 15 minutos. Cada chamada de API ja retorna AMBOS os dados (`characters` + `deaths`), entao basta extrair os dois de uma vez.

## Mudancas

### 1. Atualizar `scrape-character-accounts/index.ts`

- Remover o TTL de 4 horas e o limite de 50 por run
- Processar TODOS os jogadores em cada execucao
- De cada resposta da API, extrair:
  - `characters` -> upsert em `character_accounts` (como ja faz)
  - `deaths` -> upsert em `player_deaths` (novo)
- Request sequencial com delay de 200ms (= 5 req/s)
- 518 jogadores x 200ms = ~104 segundos (dentro do timeout de 150s)
- Retry 1x com 2s backoff se receber 429

### 2. Remover `collect-deaths` edge function

- Deletar a pasta `supabase/functions/collect-deaths/`
- Nao precisa mais existir como funcao separada

### 3. Atualizar cron para rodar a cada 2 minutos

- Mudar o schedule de `*/15` para `*/2`
- Cada execucao cobre todos os 518 jogadores em ~104s
- A proxima execucao comeca 2 minutos depois, criando um ciclo quase continuo

### 4. Nenhuma mudanca no frontend

- A pagina `LatestDeathsPage` continua lendo de `player_deaths` normalmente
- O hook `useLatestDeaths` nao muda

## Fluxo otimizado

```text
[Cron cada 2 min] -> scrape-character-accounts
                          |
                          v
                Para cada jogador (5/s):
                  GET character API
                          |
                    +-----+-----+
                    |           |
                    v           v
              characters    deaths
                    |           |
                    v           v
           character_accounts  player_deaths
              (upsert)        (upsert)
```

## Resultado esperado

- Cobertura completa de todos os jogadores a cada ~2 minutos
- Zero requests duplicados (uma API call = dois dados)
- Mortes detectadas em ate 2 minutos apos ocorrerem
- Alt detector tambem atualizado com mesma frequencia

