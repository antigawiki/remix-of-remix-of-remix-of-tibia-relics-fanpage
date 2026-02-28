
CREATE TABLE public.cam_map_creatures (
  x integer NOT NULL,
  y integer NOT NULL,
  z integer NOT NULL,
  name text NOT NULL,
  outfit_id integer NOT NULL DEFAULT 0,
  direction integer NOT NULL DEFAULT 2,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (x, y, z, name)
);

ALTER TABLE public.cam_map_creatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read map creatures" ON public.cam_map_creatures FOR SELECT USING (true);
CREATE POLICY "Anyone can insert map creatures" ON public.cam_map_creatures FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update map creatures" ON public.cam_map_creatures FOR UPDATE USING (true);
