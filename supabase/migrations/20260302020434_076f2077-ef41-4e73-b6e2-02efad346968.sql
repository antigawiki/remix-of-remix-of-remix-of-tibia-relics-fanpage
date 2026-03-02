CREATE INDEX IF NOT EXISTS idx_cam_map_tiles_z_chunk_x ON cam_map_tiles (z, (floor(x / 8)::integer));

CREATE OR REPLACE FUNCTION public.generate_map_chunks(p_floor integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chunk_count integer := 0;
  batch_count integer;
  min_cx integer;
  max_cx integer;
  batch_start integer;
  batch_size integer := 5;
BEGIN
  SELECT floor(min(x) / 8)::integer, floor(max(x) / 8)::integer
  INTO min_cx, max_cx
  FROM cam_map_tiles
  WHERE z = p_floor;

  IF min_cx IS NULL THEN
    RETURN 0;
  END IF;

  batch_start := min_cx;
  WHILE batch_start <= max_cx LOOP
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
      AND floor(x / 8)::integer >= batch_start
      AND floor(x / 8)::integer < batch_start + batch_size
    GROUP BY floor(x / 8)::integer, floor(y / 8)::integer
    ON CONFLICT (chunk_x, chunk_y, z)
    DO UPDATE SET tiles_data = EXCLUDED.tiles_data, updated_at = now();

    GET DIAGNOSTICS batch_count = ROW_COUNT;
    chunk_count := chunk_count + batch_count;
    batch_start := batch_start + batch_size;
  END LOOP;

  RETURN chunk_count;
END;
$$;