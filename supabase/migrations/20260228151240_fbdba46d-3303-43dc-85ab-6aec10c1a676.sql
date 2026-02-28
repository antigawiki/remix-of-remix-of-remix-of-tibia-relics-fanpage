DO $$
DECLARE
  f integer;
BEGIN
  FOR f IN 0..15 LOOP
    PERFORM compact_tiles_to_chunks(f);
  END LOOP;
END;
$$;