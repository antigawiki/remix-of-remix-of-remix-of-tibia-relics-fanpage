-- Tabela para armazenar snapshots diários dos highscores
CREATE TABLE public.highscore_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  player_name TEXT NOT NULL,
  profession TEXT,
  level INTEGER,
  experience BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(snapshot_date, player_name)
);

-- Índices para performance
CREATE INDEX idx_snapshots_date ON public.highscore_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_player ON public.highscore_snapshots(player_name);

-- RLS: Leitura pública, escrita apenas via service role
ALTER TABLE public.highscore_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read snapshots" 
ON public.highscore_snapshots 
FOR SELECT 
USING (true);