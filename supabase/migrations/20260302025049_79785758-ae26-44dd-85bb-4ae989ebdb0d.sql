
-- Broad cleanup: delete ALL z=8 tiles that are stale copies of z=7 tiles
-- (perspective offset bug: z=7 tiles saved at x-1, y-1 on z=8)
DELETE FROM cam_map_tiles t8
USING cam_map_tiles t7
WHERE t8.z = 8
  AND t7.z = 7
  AND t7.x = t8.x + 1
  AND t7.y = t8.y + 1
  AND t8.items = t7.items;
