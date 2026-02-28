
-- Create cam_map_chunks table for aggregated tile storage (32x32 tiles per chunk)
CREATE TABLE public.cam_map_chunks (
  chunk_x integer NOT NULL,
  chunk_y integer NOT NULL,
  z integer NOT NULL,
  tiles_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (chunk_x, chunk_y, z)
);

-- RLS policies
ALTER TABLE public.cam_map_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read map chunks" ON public.cam_map_chunks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert map chunks" ON public.cam_map_chunks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update map chunks" ON public.cam_map_chunks FOR UPDATE USING (true);

-- merge_cam_chunk: deep-merges tiles_data from different .cam extractions
CREATE OR REPLACE FUNCTION public.merge_cam_chunk(px integer, py integer, pz integer, new_data jsonb)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  existing_data jsonb;
  merged jsonb;
  k text;
  existing_arr jsonb;
  new_arr jsonb;
  merged_arr jsonb;
BEGIN
  SELECT tiles_data INTO existing_data FROM cam_map_chunks WHERE chunk_x = px AND chunk_y = py AND z = pz;

  IF NOT FOUND THEN
    INSERT INTO cam_map_chunks (chunk_x, chunk_y, z, tiles_data, updated_at)
    VALUES (px, py, pz, new_data, now());
  ELSE
    -- Start with existing data
    merged := existing_data;
    -- For each key in new_data, merge arrays (union distinct)
    FOR k IN SELECT jsonb_object_keys(new_data) LOOP
      new_arr := new_data -> k;
      IF merged ? k THEN
        existing_arr := merged -> k;
        SELECT jsonb_agg(DISTINCT val) INTO merged_arr
        FROM (
          SELECT val FROM jsonb_array_elements(existing_arr) AS val
          UNION
          SELECT val FROM jsonb_array_elements(new_arr) AS val
        ) combined;
        merged := jsonb_set(merged, ARRAY[k], COALESCE(merged_arr, '[]'::jsonb));
      ELSE
        merged := jsonb_set(merged, ARRAY[k], new_arr);
      END IF;
    END LOOP;

    UPDATE cam_map_chunks SET tiles_data = merged, updated_at = now()
    WHERE chunk_x = px AND chunk_y = py AND z = pz;
  END IF;
END;
$function$;
