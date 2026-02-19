
-- Hunt Cities table
CREATE TABLE public.hunt_cities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Hunt Spots table
CREATE TABLE public.hunt_spots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.hunt_cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_duration_minutes INTEGER NOT NULL DEFAULT 240,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Hunt Sessions table
CREATE TABLE public.hunt_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id UUID NOT NULL REFERENCES public.hunt_spots(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ending', 'finished')),
  notified_1h BOOLEAN NOT NULL DEFAULT false,
  notified_15min BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Hunt Queue table
CREATE TABLE public.hunt_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id UUID NOT NULL REFERENCES public.hunt_spots(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'claimed', 'expired')),
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.hunt_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read for cities and spots (no sensitive data)
CREATE POLICY "Anyone can read hunt_cities" ON public.hunt_cities FOR SELECT USING (true);
CREATE POLICY "Anyone can insert hunt_cities" ON public.hunt_cities FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update hunt_cities" ON public.hunt_cities FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete hunt_cities" ON public.hunt_cities FOR DELETE USING (true);

CREATE POLICY "Anyone can read hunt_spots" ON public.hunt_spots FOR SELECT USING (true);
CREATE POLICY "Anyone can insert hunt_spots" ON public.hunt_spots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update hunt_spots" ON public.hunt_spots FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete hunt_spots" ON public.hunt_spots FOR DELETE USING (true);

-- Sessions: allow full access (password protection handled in frontend)
CREATE POLICY "Anyone can read hunt_sessions" ON public.hunt_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert hunt_sessions" ON public.hunt_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update hunt_sessions" ON public.hunt_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete hunt_sessions" ON public.hunt_sessions FOR DELETE USING (true);

-- Queue: allow full access (password protection handled in frontend)
CREATE POLICY "Anyone can read hunt_queue" ON public.hunt_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can insert hunt_queue" ON public.hunt_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update hunt_queue" ON public.hunt_queue FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete hunt_queue" ON public.hunt_queue FOR DELETE USING (true);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.hunt_cities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hunt_spots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hunt_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hunt_queue;
