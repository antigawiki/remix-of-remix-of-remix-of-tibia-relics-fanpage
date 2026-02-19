
# Sistema Automatizado 24/7 - Rastreamento e Detecção de Alts

## Diagnóstico do Problema Atual

Existem 3 processos agendados já configurados, mas todos com problemas:

```text
track-online-players    → roda a cada 1 minuto  ✓ (funciona - API pública)
scrape-character-accounts → roda a cada 15 min  ✗ (bloqueado por 429)
analyze-alt-matches     → roda a cada 10 min    ✗ (não tem dados para analisar)
```

O cron também está com problema de configuração: usa `current_setting('app.supabase_url')` que retorna vazio, então as chamadas nunca chegam nas funções.

O scraping de perfis falha porque o tibiarelic.com **bloqueia IPs de servidores** (Supabase/Cloudflare). 348 personagens pendentes, 0 com alts confirmados.

## Solução

### Parte 1 - Corrigir o Cron (URLs fixas)

Recriar os jobs de cron usando a URL direta do projeto ao invés de `current_setting()`, que não está configurado:

```sql
-- Deletar jobs antigos e recriar com URL fixa
SELECT cron.unschedule('track-online-players');
SELECT cron.unschedule('scrape-character-accounts');
SELECT cron.unschedule('analyze-alt-matches');

-- Recriar com URL hardcoded
SELECT cron.schedule('track-online-players', '* * * * *',
  $$ SELECT net.http_post(url:='https://rmofmkjmzwkxjzfirbpt.supabase.co/functions/v1/track-online-players', ...) $$
);
```

### Parte 2 - Contornar o Bloqueio de IP (Estratégia Principal)

Como o tibiarelic.com bloqueia IPs de servidores, a raspagem de perfis precisa de uma abordagem diferente. Existem duas opções:

**Opção A - API Oficial do Tibiarelic (preferida)**
O site tem uma API REST pública usada pelo próprio site: `https://api.tibiarelic.com/`. A função `track-online-players` já usa esta API com sucesso. Vamos verificar se existe um endpoint de characters/account pela mesma API — se houver, resolvemos sem scraping de HTML.

**Opção B - Proxy via Browser (cliente)**
A raspagem pelo navegador já funciona (confirmado anteriormente). Criar uma página de "Status do Sistema" que roda automaticamente quando um admin/usuário acessa, disparando lotes em background com `requestIdleCallback`.

**Plano real: Opção A + fallback Opção B**

### Parte 3 - Nova Edge Function: `fetch-character-api`

Criar uma nova função que usa a API JSON do tibiarelic (não scraping HTML) para buscar dados de conta:

```typescript
// Endpoint a investigar/testar:
GET https://api.tibiarelic.com/api/Community/Character/{name}
// Retorna dados JSON do personagem incluindo outros chars da conta
```

Se a API retornar os dados de conta, substituímos o scraping HTML por chamadas JSON, que são muito mais rápidas e menos propensas a bloqueio.

### Parte 4 - Página de Status do Sistema

Criar uma seção visual na página de Admin ou uma página dedicada mostrando:

- Status de cada processo automático (último sucesso, próxima execução)
- Contadores: players rastreados, perfis raspados, alts confirmados
- Botão "Forçar raspagem" (dispara lote pelo browser em background)
- Log das últimas execuções

## Arquivos a Modificar/Criar

1. **SQL Migration** - Recriar os cron jobs com URLs corretas
2. **`supabase/functions/fetch-character-api/index.ts`** (novo) - Tenta API JSON do tibiarelic para buscar chars da conta
3. **`supabase/functions/scrape-character-accounts/index.ts`** - Ajustar para usar API JSON quando disponível, com fallback para HTML
4. **`src/pages/AdminPage.tsx`** ou nova `SystemStatusPage.tsx` - Painel de status dos processos
5. **`src/App.tsx`** - Adicionar rota caso seja página nova

## Technical Details

- O cron `track-online-players` roda a cada minuto e coleta ~55s de dados de quem entra/sai online — isso está correto
- O `analyze-alt-matches` roda a cada 10 min para recalcular os pares — correto
- O `scrape-character-accounts` processa 3 chars por execução a cada 15 min = ~12 chars/hora = para raspar 348 chars precisaria de ~29 horas em condições ideais, ou mais rápido com a API JSON
- Com API JSON (sem HTML parsing), podemos aumentar o `MAX_PER_RUN` de 3 para 10-15 por execução

## Ordem de Implementação

1. Testar endpoint da API do tibiarelic para characters
2. Criar nova lógica de busca via API (sem scraping HTML)
3. Corrigir os cron jobs com URLs diretas
4. Atualizar `scrape-character-accounts` para usar API JSON
5. Adicionar painel de status visível no Admin
