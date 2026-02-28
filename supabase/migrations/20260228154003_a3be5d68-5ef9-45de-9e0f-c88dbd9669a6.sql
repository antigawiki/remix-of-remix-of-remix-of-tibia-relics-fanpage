
CREATE OR REPLACE FUNCTION public.merge_cam_tiles_batch(tiles jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t jsonb;
BEGIN
  FOR t IN SELECT * FROM jsonb_array_elements(tiles) LOOP
    INSERT INTO cam_map_tiles (x, y, z, items, updated_at)
    VALUES ((t->>'x')::integer, (t->>'y')::integer, (t->>'z')::integer, t->'items', now())
    ON CONFLICT (x, y, z) DO UPDATE SET items = (t->'items'), updated_at = now();
  END LOOP;
END;
$function$;
