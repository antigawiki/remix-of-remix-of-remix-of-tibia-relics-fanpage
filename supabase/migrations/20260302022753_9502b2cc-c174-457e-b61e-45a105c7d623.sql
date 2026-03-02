
-- Delete contaminated z=8 tiles that are stale copies of z=7 tiles
-- These were caused by perspective offset bug: z=7 tiles persisting in GameState
-- after camera moved to z=8, getting re-saved with wrong offset (-1 in x/y)
DELETE FROM cam_map_tiles t8
USING cam_map_tiles t7
WHERE t8.z = 8
  AND t7.z = 7
  AND t7.x = t8.x + 1
  AND t7.y = t8.y + 1
  AND t8.items = t7.items
  AND (t8.items->0)::int IN (102, 231, 1128, 4597, 4598, 4599, 4600, 4601, 4602);
