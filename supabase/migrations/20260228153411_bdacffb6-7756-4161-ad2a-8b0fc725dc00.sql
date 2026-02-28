
CREATE OR REPLACE FUNCTION public.merge_cam_chunks_batch(chunks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  chunk_item jsonb;
  px integer;
  py integer;
  pz integer;
  new_data jsonb;
  existing_data jsonb;
  merged jsonb;
  k text;
  existing_arr jsonb;
  new_arr jsonb;
  merged_arr jsonb;
BEGIN
  FOR chunk_item IN SELECT * FROM jsonb_array_elements(chunks) LOOP
    px := (chunk_item->>'cx')::integer;
    py := (chunk_item->>'cy')::integer;
    pz := (chunk_item->>'z')::integer;
    new_data := chunk_item->'data';

    SELECT tiles_data INTO existing_data FROM cam_map_chunks WHERE chunk_x = px AND chunk_y = py AND z = pz;

    IF NOT FOUND THEN
      INSERT INTO cam_map_chunks (chunk_x, chunk_y, z, tiles_data, updated_at)
      VALUES (px, py, pz, new_data, now());
    ELSE
      merged := existing_data;
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
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_cam_spawns_batch(spawns jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s jsonb;
  px integer; py integer; pz integer;
  p_creature_name text; p_outfit_id integer;
  p_avg_count real; p_positions jsonb; p_visit_count integer;
  existing_avg real; existing_visits integer; existing_positions jsonb;
  new_visits integer; new_avg real; merged_positions jsonb;
BEGIN
  FOR s IN SELECT * FROM jsonb_array_elements(spawns) LOOP
    px := (s->>'px')::integer;
    py := (s->>'py')::integer;
    pz := (s->>'pz')::integer;
    p_creature_name := s->>'creature_name';
    p_outfit_id := (s->>'outfit_id')::integer;
    p_avg_count := (s->>'avg_count')::real;
    p_positions := s->'positions';
    p_visit_count := (s->>'visit_count')::integer;

    SELECT avg_count, visit_count, positions
    INTO existing_avg, existing_visits, existing_positions
    FROM cam_map_spawns
    WHERE chunk_x = px AND chunk_y = py AND z = pz AND creature_name = p_creature_name;

    IF NOT FOUND THEN
      INSERT INTO cam_map_spawns (chunk_x, chunk_y, z, creature_name, outfit_id, avg_count, positions, visit_count, updated_at)
      VALUES (px, py, pz, p_creature_name, p_outfit_id, p_avg_count, p_positions, p_visit_count, now());
    ELSE
      new_visits := existing_visits + p_visit_count;
      new_avg := (existing_avg * existing_visits + p_avg_count * p_visit_count) / new_visits;

      SELECT COALESCE(jsonb_agg(pos), '[]'::jsonb) INTO merged_positions
      FROM (
        SELECT DISTINCT ON ((pos->>'x')::int, (pos->>'y')::int) pos
        FROM (
          SELECT pos FROM jsonb_array_elements(existing_positions) AS pos
          UNION ALL
          SELECT pos FROM jsonb_array_elements(p_positions) AS pos
        ) all_pos
      ) deduped;

      UPDATE cam_map_spawns
      SET avg_count = new_avg, visit_count = new_visits, positions = merged_positions,
          outfit_id = p_outfit_id, updated_at = now()
      WHERE chunk_x = px AND chunk_y = py AND z = pz AND creature_name = p_creature_name;
    END IF;
  END LOOP;
END;
$function$;
