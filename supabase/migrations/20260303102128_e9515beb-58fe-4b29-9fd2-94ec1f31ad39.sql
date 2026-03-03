
-- Add seen_count column
ALTER TABLE cam_map_tiles ADD COLUMN seen_count integer NOT NULL DEFAULT 1;

-- Replace merge_cam_tiles_batch with confidence logic
CREATE OR REPLACE FUNCTION public.merge_cam_tiles_batch(tiles jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
BEGIN
  INSERT INTO cam_map_tiles (x, y, z, items, seen_count, updated_at)
  SELECT
    (t.x)::integer,
    (t.y)::integer,
    (t.z)::integer,
    t.items,
    1,
    now()
  FROM jsonb_to_recordset(tiles) AS t(x integer, y integer, z integer, items jsonb)
  ON CONFLICT (x, y, z) DO UPDATE SET
    items = CASE
      WHEN cam_map_tiles.items = EXCLUDED.items THEN cam_map_tiles.items
      WHEN cam_map_tiles.seen_count <= 1 THEN EXCLUDED.items
      ELSE cam_map_tiles.items
    END,
    seen_count = CASE
      WHEN cam_map_tiles.items = EXCLUDED.items THEN cam_map_tiles.seen_count + 1
      WHEN cam_map_tiles.seen_count <= 1 THEN 1
      ELSE cam_map_tiles.seen_count + 1
    END,
    updated_at = now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$function$;
