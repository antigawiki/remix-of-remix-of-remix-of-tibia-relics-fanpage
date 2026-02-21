
-- Create table for player deaths
CREATE TABLE public.player_deaths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  death_timestamp timestamptz NOT NULL,
  level integer NOT NULL,
  killers jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_name, death_timestamp)
);

-- Enable RLS
ALTER TABLE public.player_deaths ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read player deaths"
  ON public.player_deaths
  FOR SELECT
  USING (true);

-- Index for faster queries
CREATE INDEX idx_player_deaths_timestamp ON public.player_deaths (death_timestamp DESC);
CREATE INDEX idx_player_deaths_player ON public.player_deaths (player_name);
