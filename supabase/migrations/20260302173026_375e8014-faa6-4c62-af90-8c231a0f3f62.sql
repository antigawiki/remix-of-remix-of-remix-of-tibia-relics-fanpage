DROP FUNCTION IF EXISTS public.merge_cam_tiles_batch(jsonb);

CREATE OR REPLACE FUNCTION public.merge_cam_tiles_batch(tiles jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO cam_map_tiles (x, y, z, items, updated_at)
  SELECT
    (t.x)::integer,
    (t.y)::integer,
    (t.z)::integer,
    t.items,
    now()
  FROM jsonb_to_recordset(tiles) AS t(x integer, y integer, z integer, items jsonb)
  ON CONFLICT (x, y, z) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;