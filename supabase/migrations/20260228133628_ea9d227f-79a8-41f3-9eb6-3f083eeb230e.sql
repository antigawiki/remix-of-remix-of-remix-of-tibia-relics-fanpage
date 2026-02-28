
CREATE OR REPLACE FUNCTION public.clear_cam_map_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  TRUNCATE cam_map_chunks;
  TRUNCATE cam_map_spawns;
  TRUNCATE cam_map_tiles;
  TRUNCATE cam_map_creatures;
END;
$$;
