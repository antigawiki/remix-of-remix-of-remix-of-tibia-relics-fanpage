
-- Update merge_cam_tile to REPLACE items instead of accumulating
CREATE OR REPLACE FUNCTION public.merge_cam_tile(px integer, py integer, pz integer, new_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO cam_map_tiles (x, y, z, items, updated_at)
  VALUES (px, py, pz, new_items, now())
  ON CONFLICT (x, y, z) DO UPDATE SET items = new_items, updated_at = now();
END;
$function$;

-- Create compact_tiles_to_chunks function
CREATE OR REPLACE FUNCTION public.compact_tiles_to_chunks(p_floor integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  chunk_count integer := 0;
BEGIN
  -- Delete existing chunks for this floor
  DELETE FROM cam_map_chunks WHERE z = p_floor;

  -- Insert new 8x8 chunks from individual tiles
  INSERT INTO cam_map_chunks (chunk_x, chunk_y, z, tiles_data, updated_at)
  SELECT
    floor(x / 8)::integer AS chunk_x,
    floor(y / 8)::integer AS chunk_y,
    p_floor,
    jsonb_object_agg(
      (x - floor(x / 8)::integer * 8)::text || ',' || (y - floor(y / 8)::integer * 8)::text,
      items
    ),
    now()
  FROM cam_map_tiles
  WHERE z = p_floor
  GROUP BY floor(x / 8)::integer, floor(y / 8)::integer;

  GET DIAGNOSTICS chunk_count = ROW_COUNT;
  RETURN chunk_count;
END;
$function$;
