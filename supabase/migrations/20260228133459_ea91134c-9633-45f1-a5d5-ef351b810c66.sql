
CREATE OR REPLACE FUNCTION public.clear_cam_map_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM cam_map_chunks;
  DELETE FROM cam_map_spawns;
  DELETE FROM cam_map_tiles;
  DELETE FROM cam_map_creatures;
END;
$$;
