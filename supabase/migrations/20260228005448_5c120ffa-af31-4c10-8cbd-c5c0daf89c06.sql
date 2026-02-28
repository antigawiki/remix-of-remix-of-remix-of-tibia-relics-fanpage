
CREATE OR REPLACE FUNCTION public.merge_cam_tile(px integer, py integer, pz integer, new_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_items jsonb;
  merged jsonb;
BEGIN
  SELECT items INTO existing_items FROM cam_map_tiles WHERE x = px AND y = py AND z = pz;
  
  IF NOT FOUND THEN
    INSERT INTO cam_map_tiles (x, y, z, items, updated_at) VALUES (px, py, pz, new_items, now());
  ELSE
    -- Merge: union of both arrays without duplicates
    SELECT jsonb_agg(DISTINCT val) INTO merged
    FROM (
      SELECT val FROM jsonb_array_elements(existing_items) AS val
      UNION
      SELECT val FROM jsonb_array_elements(new_items) AS val
    ) combined;
    
    UPDATE cam_map_tiles SET items = COALESCE(merged, '[]'::jsonb), updated_at = now()
    WHERE x = px AND y = py AND z = pz;
  END IF;
END;
$$;
