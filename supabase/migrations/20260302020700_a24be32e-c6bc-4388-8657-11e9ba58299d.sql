CREATE OR REPLACE FUNCTION public.generate_map_chunks_range(p_floor integer, p_min_cx integer, p_max_cx integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chunk_count integer;
BEGIN
  INSERT INTO cam_map_chunks (chunk_x, chunk_y, z, tiles_data, updated_at)
  SELECT
    floor(x / 8)::integer,
    floor(y / 8)::integer,
    p_floor,
    jsonb_object_agg(
      (x - floor(x / 8)::integer * 8)::text || ',' || (y - floor(y / 8)::integer * 8)::text,
      items
    ),
    now()
  FROM cam_map_tiles
  WHERE z = p_floor
    AND x >= p_min_cx * 8
    AND x < (p_max_cx + 1) * 8
  GROUP BY floor(x / 8)::integer, floor(y / 8)::integer
  ON CONFLICT (chunk_x, chunk_y, z)
  DO UPDATE SET tiles_data = EXCLUDED.tiles_data, updated_at = now();

  GET DIAGNOSTICS chunk_count = ROW_COUNT;
  RETURN chunk_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tile_chunk_range(p_floor integer)
RETURNS TABLE(min_cx integer, max_cx integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT floor(min(x) / 8)::integer, floor(max(x) / 8)::integer
  FROM cam_map_tiles
  WHERE z = p_floor;
$$;