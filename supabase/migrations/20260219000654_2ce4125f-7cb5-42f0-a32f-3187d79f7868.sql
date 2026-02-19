
-- Tabela para armazenar mapeamento de personagem → todos os chars da mesma conta
CREATE TABLE IF NOT EXISTS public.character_accounts (
  character_name text PRIMARY KEY,
  account_chars text[] NOT NULL DEFAULT '{}',
  last_scraped_at timestamptz NOT NULL DEFAULT now(),
  scrape_error text
);

ALTER TABLE public.character_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read character accounts"
ON public.character_accounts
FOR SELECT
USING (true);
