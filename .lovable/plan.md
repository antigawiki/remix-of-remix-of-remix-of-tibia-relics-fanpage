

# Sistema de Top Gainers (Maiores Ganhadores de XP)

## Resumo

Como a API do Tibia Relic nao fornece dados de ganho de experiencia diario, vamos criar um sistema proprio que:
1. Salva automaticamente um snapshot dos top 100 jogadores a cada server save (06:00 UTC)
2. Compara o snapshot atual com o anterior para calcular o ganho de XP
3. Exibe uma pagina com os maiores ganhadores do dia

---

## Arquitetura

```text
+------------------+     +----------------------+     +------------------+
|   Cron Job       | --> | Edge Function        | --> | Tabela Supabase  |
|   (Diario 06h)   |     | save-highscores      |     | highscore_snapshots |
+------------------+     +----------------------+     +------------------+
                                                              |
                                                              v
+------------------+     +----------------------+     +------------------+
|   Frontend       | <-- | Edge Function        | <-- | Calculo de       |
|   TopGainersPage |     | get-top-gainers      |     | Diferenca XP     |
+------------------+     +----------------------+     +------------------+
```

---

## Etapas de Implementacao

### 1. Criar Tabela no Banco de Dados

Criar tabela `highscore_snapshots` para armazenar os dados diarios:

```sql
CREATE TABLE highscore_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  player_name TEXT NOT NULL,
  profession TEXT,
  level INTEGER,
  experience BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(snapshot_date, player_name)
);

-- Indices para performance
CREATE INDEX idx_snapshots_date ON highscore_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_player ON highscore_snapshots(player_name);

-- RLS: Leitura publica, escrita apenas via service role
ALTER TABLE highscore_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read snapshots" ON highscore_snapshots FOR SELECT USING (true);
```

### 2. Criar Edge Function para Salvar Snapshot

Arquivo: `supabase/functions/save-highscores/index.ts`

Esta funcao:
- Busca os top 100 jogadores da API do Tibia Relic
- Salva na tabela `highscore_snapshots` com a data atual
- Usa UPSERT para evitar duplicatas

### 3. Configurar Cron Job

Agendar a execucao diaria as 06:00 UTC (horario do server save + 1 hora para garantir atualizacao):

```sql
-- Habilitar extensoes necessarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job
SELECT cron.schedule(
  'save-daily-highscores',
  '0 9 * * *', -- 09:00 UTC (server save do Relic e 09:00)
  $$
  SELECT net.http_post(
    url:='https://adagjmvhlmghhmadtpwv.supabase.co/functions/v1/save-highscores',
    headers:='{"Authorization": "Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

### 4. Criar Edge Function para Calcular Top Gainers

Arquivo: `supabase/functions/get-top-gainers/index.ts`

Esta funcao:
- Busca o snapshot de hoje e de ontem
- Calcula a diferenca de XP para cada jogador
- Retorna os top 10 maiores ganhadores ordenados

### 5. Criar Hook React

Arquivo: `src/hooks/useTopGainers.ts`

Hook para buscar e cachear os dados dos top gainers.

### 6. Criar Pagina Top Gainers

Arquivo: `src/pages/TopGainersPage.tsx`

Pagina com:
- Tabela mostrando: Rank, Nome (com PlayerLink), Nivel, XP Ganha, XP Total
- Data de referencia (ontem para hoje)
- Icones de trofeu para top 3
- Estado de loading e erro

### 7. Atualizar Navegacao

Adicionar link na Sidebar esquerda com icone de tendencia (TrendingUp).

---

## Detalhes Tecnicos

### Estrutura de Dados do Snapshot

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | Identificador unico |
| snapshot_date | DATE | Data do snapshot (ex: 2026-01-30) |
| player_name | TEXT | Nome do personagem |
| profession | TEXT | Vocacao do personagem |
| level | INTEGER | Nivel atual |
| experience | BIGINT | Experiencia total |

### Resposta da API get-top-gainers

```json
{
  "gainers": [
    {
      "rank": 1,
      "name": "Weedhahaha",
      "profession": "Knight",
      "level": 30,
      "experienceGained": 45000,
      "currentExperience": 405042
    }
  ],
  "periodStart": "2026-01-29",
  "periodEnd": "2026-01-30"
}
```

### Consideracoes

- **Retencao de dados**: Manter apenas os ultimos 30 dias de snapshots para economizar espaco
- **Jogadores novos**: Se um jogador aparece hoje mas nao ontem, o ganho sera a XP total
- **Jogadores que sairam**: Nao aparecerao no ranking de gainers
- **Primeiro dia**: Sem dados anteriores, a pagina mostrara mensagem informativa

---

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| Tabela `highscore_snapshots` | Criar (migracao) |
| `supabase/functions/save-highscores/index.ts` | Criar |
| `supabase/functions/get-top-gainers/index.ts` | Criar |
| `supabase/config.toml` | Atualizar |
| `src/hooks/useTopGainers.ts` | Criar |
| `src/pages/TopGainersPage.tsx` | Criar |
| `src/components/Sidebar.tsx` | Atualizar |
| `src/App.tsx` | Atualizar rotas |

