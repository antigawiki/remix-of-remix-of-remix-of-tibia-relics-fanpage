
CREATE OR REPLACE FUNCTION public.compact_tiles_to_chunks(p_floor integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  chunk_count integer := 0;
  batch_count integer;
  min_cx integer;
  max_cx integer;
  batch_start integer;
  batch_end integer;
  batch_size integer := 50; -- process 50 chunk_x values at a time
BEGIN
  -- Delete existing chunks for this floor
  DELETE FROM cam_map_chunks WHERE z = p_floor;

  -- Get the range of chunk_x values for this floor
  SELECT floor(min(x) / 8)::integer, floor(max(x) / 8)::integer
  INTO min_cx, max_cx
  FROM cam_map_tiles
  WHERE z = p_floor;

  IF min_cx IS NULL THEN
    RETURN 0;
  END IF;

  batch_start := min_cx;
  WHILE batch_start <= max_cx LOOP
    batch_end := batch_start + batch_size - 1;

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
      AND floor(x / 8)::integer >= batch_start
      AND floor(x / 8)::integer <= batch_end
    GROUP BY floor(x / 8)::integer, floor(y / 8)::integer;

    GET DIAGNOSTICS batch_count = ROW_COUNT;
    chunk_count := chunk_count + batch_count;
    batch_start := batch_end + 1;
  END LOOP;

  RETURN chunk_count;
END;
$function$;
