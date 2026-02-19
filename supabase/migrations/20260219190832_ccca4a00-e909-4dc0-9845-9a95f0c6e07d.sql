-- Recriar cron jobs do projeto original

-- Habilitar pg_cron se não estiver habilitado
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cron: track-online-players a cada 1 minuto
SELECT cron.schedule(
  'track-online-players',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/track-online-players',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Cron: analyze-alt-matches a cada 10 minutos
SELECT cron.schedule(
  'analyze-alt-matches',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/analyze-alt-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Cron: scrape-character-accounts a cada 15 minutos
SELECT cron.schedule(
  'scrape-character-accounts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/scrape-character-accounts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);