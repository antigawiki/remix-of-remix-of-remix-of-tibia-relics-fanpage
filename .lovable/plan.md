

## Fix: Cam Map Data Distortion and Missing Underground Tiles

### Root Causes Identified

**1. SURFACE_ONLY_ITEMS filter is removing legitimate underground tiles**
The filter removes IDs 351-356 and 405-430 on floors Z >= 8. However, in Tibia 7.72, these IDs are earth/cliff borders and transition tiles that appear on BOTH surface AND underground. The underground data shows IDs 357-386 (stone/cave ground) but the adjacent border IDs 351-356 are being stripped, creating gaps in cave walls and borders. IDs 405-430 are border transition tiles also used underground.

Evidence: Underground chunks show sparse data (5-10 tiles per 64-slot chunk) with gaps where border/transition tiles should connect wall segments.

**2. Floor stability threshold too low (1 batch = 500 frames)**
After a floor change, `gs.tiles` is cleared and snapshotting resumes after just 1 batch. During transitions (especially surface-to-underground), the first batch may still contain perspective-contaminated tiles from the multi-floor read that triggered the floor change.

**3. Multi-floor read desync causes cross-floor contamination**
During `readMultiFloorArea`, the `skip` variable carries across floors. If reading floor 6 or 7 encounters a parsing error (outfit, creature data), the skip count gets corrupted, and floor 8 tiles end up with surface item IDs. These tiles have z=8 (correct) but wrong item data — passing the `tz === camZ` filter.

### Changes

**A) `src/lib/tibiaRelic/mapExtractor.ts` — Fix SURFACE_ONLY_ITEMS filter:**

Remove IDs 351-356 and 405-430 from the filter. Keep only true grass IDs (101-106) that never appear underground. Additionally, add IDs 107-114 (sand/beach) which are also surface-exclusive.

```
const SURFACE_ONLY_ITEMS: Set<number> = new Set([
  101, 102, 103, 104, 105, 106,  // Grass
  107, 108, 109, 110, 111, 112, 113, 114, // Sand/beach
]);
```

**B) `src/lib/tibiaRelic/mapExtractor.ts` — Increase floor stability threshold:**

Change `floorStableBatches >= 1` to `floorStableBatches >= 3`. This ensures 3 full batches (1500 frames) of stable data before snapshotting, giving enough time for clean tiles to accumulate.

```
if (floorStableBatches >= 3) snapshotTiles(gs, dat, latestTiles);
```

(Both in the sync and async versions)

**C) `src/lib/tibiaRelic/mapExtractor.ts` — Add ground validation:**

In `snapshotTiles`, validate that each underground tile has at least one ground item (stackPrio 0). Tiles without a ground item on Z >= 8 are almost certainly contaminated (partial desync data).

```javascript
// After collecting items, before storing:
if (camZ >= 8) {
  const hasGround = items.some(id => {
    const d = dat.items.get(id);
    return d && d.stackPrio === 0;
  });
  if (!hasGround) continue; // Skip tiles without ground on underground floors
}
```

**D) Database cleanup — Re-generate chunks after re-extraction:**

After deploying these fixes, the user should re-extract the problematic .cam files and run "Generate Chunks" to rebuild `cam_map_chunks` from the corrected `cam_map_tiles` data.

### Summary

| Fix | What | Impact |
|-----|------|--------|
| A | Remove 351-356, 405-430 from filter | Restores missing cave borders and transitions |
| B | Increase stability from 1 to 3 batches | Prevents capturing stale tiles after floor changes |
| C | Require ground item on underground tiles | Rejects contaminated tiles from desync |
| D | Re-extract + regenerate | Cleans existing bad data |

### Technical Notes

- Fixes A, B, C are all in `src/lib/tibiaRelic/mapExtractor.ts`
- No database migration needed
- After deploying, problematic .cam files need to be re-extracted via the batch extract page
- The generate_map_chunks RPC rebuilds chunks from the corrected raw tiles

