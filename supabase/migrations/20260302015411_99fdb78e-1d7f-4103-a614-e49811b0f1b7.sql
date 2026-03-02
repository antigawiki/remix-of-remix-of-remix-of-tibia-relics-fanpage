CREATE OR REPLACE FUNCTION generate_map_chunks(p_floor integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chunk_count integer := 0;
  chunk_rec RECORD;
BEGIN
  FOR chunk_rec IN
    SELECT
      floor(x / 8)::integer AS cx,
      floor(y / 8)::integer AS cy,
      jsonb_object_agg(
        (x - floor(x/8)::integer * 8) || ',' || (y - floor(y/8)::integer * 8),
        items
      ) AS data
    FROM cam_map_tiles
    WHERE z = p_floor
    GROUP BY floor(x / 8)::integer, floor(y / 8)::integer
  LOOP
    INSERT INTO cam_map_chunks (chunk_x, chunk_y, z, tiles_data, updated_at)
    VALUES (chunk_rec.cx, chunk_rec.cy, p_floor, chunk_rec.data, now())
    ON CONFLICT (chunk_x, chunk_y, z)
    DO UPDATE SET tiles_data = EXCLUDED.tiles_data, updated_at = now();

    chunk_count := chunk_count + 1;
  END LOOP;

  RETURN chunk_count;
END;
$$;