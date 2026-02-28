
CREATE OR REPLACE FUNCTION public.compact_tiles_range(p_floor integer, p_min_cx integer, p_max_cx integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  chunk_count integer;
BEGIN
  DELETE FROM cam_map_chunks
  WHERE z = p_floor AND chunk_x >= p_min_cx AND chunk_x <= p_max_cx;

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
    AND floor(x / 8)::integer >= p_min_cx
    AND floor(x / 8)::integer <= p_max_cx
  GROUP BY floor(x / 8)::integer, floor(y / 8)::integer;

  GET DIAGNOSTICS chunk_count = ROW_COUNT;
  RETURN chunk_count;
END;
$$;
