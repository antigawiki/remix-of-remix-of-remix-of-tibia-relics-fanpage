
-- Tabela de snapshots intraday de XP (a cada 5 minutos)
CREATE TABLE IF NOT EXISTS public.xp_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name text NOT NULL,
  profession text,
  level integer,
  experience bigint,
  captured_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index para queries eficientes
CREATE INDEX IF NOT EXISTS idx_xp_snapshots_captured_at ON public.xp_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_snapshots_player_name ON public.xp_snapshots(player_name);
CREATE INDEX IF NOT EXISTS idx_xp_snapshots_player_captured ON public.xp_snapshots(player_name, captured_at DESC);

-- Enable RLS
ALTER TABLE public.xp_snapshots ENABLE ROW LEVEL SECURITY;

-- Anyone can read snapshots
CREATE POLICY "Anyone can read xp_snapshots"
ON public.xp_snapshots
FOR SELECT
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.xp_snapshots;
