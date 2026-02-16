
-- 1. online_tracker_sessions
CREATE TABLE public.online_tracker_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ots_player_name ON public.online_tracker_sessions (player_name);
CREATE INDEX idx_ots_login_at ON public.online_tracker_sessions (login_at);
CREATE INDEX idx_ots_logout_at ON public.online_tracker_sessions (logout_at);

ALTER TABLE public.online_tracker_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sessions" ON public.online_tracker_sessions FOR SELECT USING (true);

-- 2. online_tracker_state
CREATE TABLE public.online_tracker_state (
  player_name text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.online_tracker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read state" ON public.online_tracker_state FOR SELECT USING (true);

-- 3. alt_detector_matches
CREATE TABLE public.alt_detector_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a text NOT NULL,
  player_b text NOT NULL,
  match_count integer NOT NULL DEFAULT 0,
  total_sessions_a integer NOT NULL DEFAULT 0,
  total_sessions_b integer NOT NULL DEFAULT 0,
  ever_online_together boolean NOT NULL DEFAULT false,
  probability numeric NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_a, player_b)
);

CREATE INDEX idx_adm_probability ON public.alt_detector_matches (probability DESC);
CREATE INDEX idx_adm_player_a ON public.alt_detector_matches (player_a);
CREATE INDEX idx_adm_player_b ON public.alt_detector_matches (player_b);

ALTER TABLE public.alt_detector_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read matches" ON public.alt_detector_matches FOR SELECT USING (true);
