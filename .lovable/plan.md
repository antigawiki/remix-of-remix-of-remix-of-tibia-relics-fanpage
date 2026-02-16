

# Detector de Personagens do Mesmo Dono (Alt Detector)

## Resumo

Criar um sistema backend que monitora continuamente quais jogadores estao online, registra sessoes de login/logout, e cruza os horarios para identificar personagens que provavelmente pertencem ao mesmo dono. Inclui uma pagina oculta para visualizar os resultados.

## Arquitetura

O sistema tem 3 camadas:

```text
+------------------+        +---------------------+        +------------------+
|   pg_cron        | -----> |  Edge Function      | -----> |  Banco de Dados  |
|  (a cada 1 min)  |        |  (loop interno de   |        |  - sessoes       |
|                  |        |   ~55s, poll a cada  |        |  - matches       |
|                  |        |   5s = ~11 polls/min)|        |                  |
+------------------+        +---------------------+        +------------------+
                                                                    |
                                                           +--------v---------+
                                                           |  Pagina /alt-    |
                                                           |  detector        |
                                                           |  (oculta)        |
                                                           +------------------+
```

### Por que 5 segundos e nao 1 segundo?

Edge Functions tem timeout de ~60 segundos. O pg_cron dispara a cada 1 minuto. Dentro de cada execucao, a funcao faz um loop interno que consulta a API a cada 5 segundos durante ~55 segundos (~11 consultas por minuto). Polling a cada 1 segundo seria 60 requisicoes por minuto e pode causar rate-limiting na API. Comecaremos com 5 segundos e podemos ajustar depois.

## Tabelas do Banco de Dados

### 1. `online_tracker_sessions`
Registra cada sessao de um jogador (login ate logout).

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid | PK |
| player_name | text | Nome do personagem |
| login_at | timestamptz | Quando apareceu online |
| logout_at | timestamptz (nullable) | Quando saiu (null = ainda online) |
| created_at | timestamptz | Timestamp de criacao |

### 2. `online_tracker_state`
Estado atual - quem esta online agora (para comparacao entre polls).

| Coluna | Tipo | Descricao |
|---|---|---|
| player_name | text | PK |
| last_seen_at | timestamptz | Ultima vez visto online |

### 3. `alt_detector_matches`
Pares de personagens identificados como possiveis alts.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid | PK |
| player_a | text | Primeiro personagem |
| player_b | text | Segundo personagem |
| match_count | integer | Quantas vezes logout/login coincidiram em <5min |
| total_sessions_a | integer | Total de sessoes do player A |
| total_sessions_b | integer | Total de sessoes do player B |
| ever_online_together | boolean | Se ja foram vistos online ao mesmo tempo |
| probability | numeric | Probabilidade calculada (0-100%) |
| last_updated | timestamptz | Ultima atualizacao |

RLS: Todas as tabelas com SELECT publico (leitura), INSERT/UPDATE/DELETE apenas via service_role (edge function).

## Edge Function: `track-online-players`

Logica principal:

1. Buscar estado atual do banco (`online_tracker_state`)
2. Loop por ~55 segundos, a cada 5 segundos:
   a. Chamar API `who-is-online`
   b. Comparar com estado anterior
   c. Novos jogadores = INSERT em `online_tracker_sessions` (login_at = agora) + INSERT em `online_tracker_state`
   d. Jogadores que sairam = UPDATE `online_tracker_sessions` (logout_at = agora) + DELETE de `online_tracker_state`
3. Ao final, nao precisa fazer nada extra (proximo cron dispara em 1 minuto)

## Edge Function: `analyze-alt-matches`

Funcao separada para analise (chamada sob demanda pela pagina ou por cron menos frequente, ex: a cada 10 minutos):

1. Para cada par de jogadores que ja tiveram sessoes:
   - Verificar se alguma vez estiveram online juntos (overlap de sessoes)
   - Se nunca estiveram juntos, contar quantas vezes o logout de A coincidiu com login de B (ou vice-versa) em janela de 5 minutos
   - Calcular probabilidade baseada em: match_count / min(total_sessions_a, total_sessions_b)
2. Salvar/atualizar em `alt_detector_matches`

A analise sera feita via SQL otimizado diretamente no banco para performance.

## Pagina: `/alt-detector` (oculta)

- NAO sera adicionada ao menu de navegacao nem ao sitemap
- Acessivel apenas por URL direta
- Mostra:
  - Status do tracker (ultima execucao, total de sessoes registradas)
  - Tabela de matches ordenada por probabilidade
  - Filtro por nome de jogador
  - Detalhes de cada match (historico de coincidencias)

## Cron Job

- `track-online-players`: a cada 1 minuto (o loop interno faz ~11 polls)
- `analyze-alt-matches`: a cada 10 minutos

## Sobre o Bot do Discord

O Lovable nao consegue hospedar um bot Discord tradicional (que precisa de conexao WebSocket persistente). Porem, existem duas alternativas viaveis:

1. **Discord Webhook**: Criar uma edge function que envia os resultados para um canal do Discord via webhook. Simples de configurar e suficiente para notificacoes automaticas.
2. **Discord Slash Commands**: Mais complexo, permite comandos interativos mas precisa de configuracao no Discord Developer Portal.

Sugiro comecarmos com a coleta de dados e a pagina, e depois adicionamos o webhook do Discord como segundo passo.

## Ordem de Implementacao

1. Criar as 3 tabelas no banco de dados
2. Criar edge function `track-online-players` (coleta)
3. Configurar cron job para disparar a cada 1 minuto
4. Criar edge function `analyze-alt-matches` (analise)
5. Configurar cron de analise a cada 10 minutos
6. Criar pagina `/alt-detector` (frontend)
7. Adicionar rota no App.tsx (sem link no menu)

