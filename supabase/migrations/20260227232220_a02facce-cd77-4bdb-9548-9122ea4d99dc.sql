
CREATE TABLE public.cam_map_tiles (
  x integer NOT NULL,
  y integer NOT NULL,
  z integer NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (x, y, z)
);

-- Index for area queries (floor + bounding box)
CREATE INDEX idx_cam_map_tiles_z_x_y ON public.cam_map_tiles (z, x, y);

-- Enable RLS
ALTER TABLE public.cam_map_tiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read tiles
CREATE POLICY "Anyone can read map tiles" ON public.cam_map_tiles
  FOR SELECT USING (true);

-- Anyone can insert tiles (anonymous map contribution)
CREATE POLICY "Anyone can insert map tiles" ON public.cam_map_tiles
  FOR INSERT WITH CHECK (true);

-- Anyone can update tiles (upsert from different .cam files)
CREATE POLICY "Anyone can update map tiles" ON public.cam_map_tiles
  FOR UPDATE USING (true);
