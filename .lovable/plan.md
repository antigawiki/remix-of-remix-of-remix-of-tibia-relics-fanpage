

## Fix: Surface Tile Contamination on Underground Floors

### Problem
The database has massive contamination of surface tiles (grass, border tiles) on underground floors:
- Z=8: 91,317 grass tiles (60% of all Z=8 data)
- Z=9: 87,418 grass tiles
- Z=10: 43,995 grass tiles

These surface items (item IDs like 101-106 for grass, 351-355 for borders) should never appear underground.

### Root Cause
During multi-floor map reads (`readMultiFloorArea`), the protocol reads tiles for 5 floors simultaneously (camZ-2 to camZ+2). While the Z values are stored correctly in `gs.tiles`, the contamination appears to occur during floor transitions where stale surface tile data from `gs.tiles` isn't fully cleared before underground snapshots are taken. The `skip` variable shared across floors in `readMultiFloorArea` may also cause data from one floor's stream to be misattributed when there are parsing edge cases.

### Solution (Two Parts)

**Part 1: Extraction Filter in `snapshotTiles`** (`src/lib/tibiaRelic/mapExtractor.ts`)

Add a surface-item blocklist applied when `camZ >= 8` (underground). Known surface-only ground items will be stripped from the captured tile data:

- Grass tiles: IDs 101-106
- Common surface border/ground tiles: IDs 351-356, 405-430 (border variants)

The filter will:
1. Define a `SURFACE_ONLY_ITEMS` Set containing these IDs
2. In `snapshotTiles`, when `camZ >= 8`, filter out any items in the blocklist
3. Only store tiles that still have items after filtering

**Part 2: Database Cleanup**

Create a database migration to remove existing contaminated data:
```sql
DELETE FROM cam_map_tiles 
WHERE z >= 8 AND items @> '[101]'::jsonb;
```
Then regenerate affected chunks.

### Files Changed

1. **`src/lib/tibiaRelic/mapExtractor.ts`** -- Add `SURFACE_ONLY_ITEMS` Set and filter logic in `snapshotTiles` for underground floors
2. **Database migration** -- Clean up existing contaminated tiles and regenerate map chunks

### After Changes
You will need to:
1. Clear the database (Limpar DB button)
2. Re-extract all .cam files
3. Regenerate the map (Gerar Mapa button)

