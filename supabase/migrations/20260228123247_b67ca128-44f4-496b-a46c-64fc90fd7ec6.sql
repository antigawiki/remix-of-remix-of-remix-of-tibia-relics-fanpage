
-- Create cam_map_spawns table
CREATE TABLE public.cam_map_spawns (
  chunk_x integer NOT NULL,
  chunk_y integer NOT NULL,
  z integer NOT NULL,
  creature_name text NOT NULL,
  outfit_id integer NOT NULL DEFAULT 0,
  avg_count real NOT NULL DEFAULT 1,
  positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  visit_count integer NOT NULL DEFAULT 1,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (chunk_x, chunk_y, z, creature_name)
);

-- RLS
ALTER TABLE public.cam_map_spawns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read spawns" ON public.cam_map_spawns FOR SELECT USING (true);
CREATE POLICY "Anyone can insert spawns" ON public.cam_map_spawns FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update spawns" ON public.cam_map_spawns FOR UPDATE USING (true);

-- Merge function: weighted average of avg_count + dedup positions
CREATE OR REPLACE FUNCTION public.merge_cam_spawn(
  px integer, py integer, pz integer,
  p_creature_name text, p_outfit_id integer,
  p_avg_count real, p_positions jsonb, p_visit_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_avg real;
  existing_visits integer;
  existing_positions jsonb;
  new_avg real;
  new_visits integer;
  merged_positions jsonb;
BEGIN
  SELECT avg_count, visit_count, positions
  INTO existing_avg, existing_visits, existing_positions
  FROM cam_map_spawns
  WHERE chunk_x = px AND chunk_y = py AND z = pz AND creature_name = p_creature_name;

  IF NOT FOUND THEN
    INSERT INTO cam_map_spawns (chunk_x, chunk_y, z, creature_name, outfit_id, avg_count, positions, visit_count, updated_at)
    VALUES (px, py, pz, p_creature_name, p_outfit_id, p_avg_count, p_positions, p_visit_count, now());
  ELSE
    -- Weighted average
    new_visits := existing_visits + p_visit_count;
    new_avg := (existing_avg * existing_visits + p_avg_count * p_visit_count) / new_visits;

    -- Merge positions: union distinct by x,y values
    SELECT COALESCE(jsonb_agg(pos), '[]'::jsonb) INTO merged_positions
    FROM (
      SELECT DISTINCT ON ((pos->>'x')::int, (pos->>'y')::int) pos
      FROM (
        SELECT pos FROM jsonb_array_elements(existing_positions) AS pos
        UNION ALL
        SELECT pos FROM jsonb_array_elements(p_positions) AS pos
      ) all_pos
    ) deduped;

    UPDATE cam_map_spawns
    SET avg_count = new_avg, visit_count = new_visits, positions = merged_positions,
        outfit_id = p_outfit_id, updated_at = now()
    WHERE chunk_x = px AND chunk_y = py AND z = pz AND creature_name = p_creature_name;
  END IF;
END;
$$;
