

# Pagina de Ultimas Mortes do Servidor

## Situacao Atual

- Nao existe endpoint global de mortes na API do TibiaRelic
- A API de character (`/api/Community/character/by-name?name=X`) retorna mortes individuais no campo `deaths`
- Cada morte tem: `timestamp`, `level`, `killers` (array com `name`, `isPlayer`, `relatedPlayerName`)
- Ja temos o tracking de jogadores online (`online_tracker_sessions`) com lista de jogadores ativos

## Solucao: Coletar mortes via character API

### 1. Nova tabela: `player_deaths`

```sql
CREATE TABLE player_deaths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  death_timestamp timestamptz NOT NULL,
  level integer NOT NULL,
  killers jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_name, death_timestamp)
);
```

A constraint UNIQUE evita duplicatas ao re-coletar mortes do mesmo personagem.

### 2. Nova edge function: `collect-deaths`

- Busca jogadores distintos da tabela `online_tracker_sessions` (ultimos 7 dias para limitar)
- Para cada jogador, chama a API de character e extrai o campo `deaths`
- Insere mortes novas na tabela `player_deaths` (upsert para evitar duplicatas)
- Processa em batches para nao sobrecarregar a API (ex: 5 por vez com delay)
- Endpoint para ser chamado periodicamente (via cron ou manualmente)

### 3. Nova pagina: `src/pages/LatestDeathsPage.tsx`

- Rota: `/latest-deaths`
- Busca mortes da tabela `player_deaths` ordenadas por `death_timestamp` DESC
- Layout similar a DeathRowPage (tabela com wood-panel)
- Colunas: Data/Hora, Personagem, Level, Causa da morte (monstro ou player)
- Icone de caveira para mortes por player, icone de monstro para PvE
- Nome do personagem clicavel (link para tibiarelic.com)
- Filtros opcionais: PvP vs PvE, busca por nome

### 4. Proxy: adicionar endpoint no `tibia-relic-proxy`

- Nao necessario - a edge function `collect-deaths` chamara a API diretamente do backend

### 5. Navegacao

- Adicionar link "Ultimas Mortes" no Sidebar/menu
- Adicionar rota no App.tsx

## Fluxo de dados

```text
[Cron/Manual] -> collect-deaths (edge function)
                    |
                    v
        Busca jogadores de online_tracker_sessions
                    |
                    v
        Para cada jogador: GET character API -> extrai deaths
                    |
                    v
        Insere em player_deaths (ignora duplicatas)
                    |
                    v
[Frontend] -> SELECT * FROM player_deaths ORDER BY death_timestamp DESC
```

## Detalhes Tecnicos

### Edge function `collect-deaths`

- Busca `SELECT DISTINCT player_name FROM online_tracker_sessions WHERE login_at > now() - interval '7 days'`
- Processa em batches de 5 com delay de 500ms entre cada batch
- Para cada character response, extrai `deaths` e faz upsert
- Retorna contagem de mortes novas inseridas

### Formato dos killers no banco

Armazena o array `killers` como JSONB direto da API:
```json
[{"name": "an orc berserker", "isPlayer": false, "relatedPlayerName": null}]
```

Na UI, mostra o `name` do primeiro killer. Se `isPlayer: true`, destaca em vermelho.

### Pagina frontend

- Hook `useLatestDeaths` com react-query
- Paginacao simples (limit 50, botao "carregar mais")
- Badge colorido: "PvP" vermelho ou "PvE" cinza
- Componente PlayerLink ja existente para links dos nomes

