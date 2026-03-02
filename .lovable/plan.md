

## Fix: Extractor Floor Contamination + WASM Player Files + Build Errors

### Problem Analysis

The map extractor still uses the JS packet parser. After `floorDown`/`floorUp`, tiles for the current floor (`camZ`) are stored with perspective offsets (-1, -2, etc.) baked into their X/Y coordinates. Even though `gs.tiles.clear()` fires on floor change, the tiles repopulated by subsequent frames in nearby batches may still carry residual offset data from the transition.

The current `anyFloorChange` flag only skips the CURRENT batch. The very next batch sees `camZ` as stable and snapshots tiles that may still contain offset data from the floor transition's `readFloorArea`.

### Plan

#### 1. Copy uploaded WASM player files to project

Copy `tibiarc_player-3.js` and `tibiarc_player-3.wasm` to `public/tibiarc/` (replacing existing `tibiarc_player.js` and `tibiarc_player.wasm`).

#### 2. Add floor-change cooldown in the extractor

**File: `src/lib/tibiaRelic/mapExtractor.ts`** (both sync and async versions)

After a floor change is detected, set a cooldown counter (e.g., 3 batches). Skip `snapshotTiles` until the cooldown expires. This gives the parser time to fully rebuild the viewport with correct-offset data from scroll packets.

```text
Before:
  if (!anyFloorChange) snapshotTiles(...)

After:
  if (anyFloorChange) {
    floorStableBatches = 0;
  } else {
    floorStableBatches++;
  }
  // Only snapshot after 3+ stable batches since last floor change
  if (floorStableBatches >= 3) {
    snapshotTiles(...)
  }
```

#### 3. Add tile-floor validation in snapshotTiles

Add a secondary guard: when capturing tiles for underground floors (z > 7), verify the tile coordinates are within the expected viewport bounds relative to `camX/camY`. Also, for each tile, check that the tile key's Z matches the expected floor. Reject tiles whose coordinates suggest they came from a different floor's perspective offset.

Specifically, compute `expectedOffset = camZ - tz`. For `tz === camZ`, offset should be 0. If a tile's position relative to the camera center doesn't match a zero-offset viewport (18x14 centered on camX, camY), skip it.

#### 4. Fix build errors in edge functions

These are pre-existing TypeScript errors unrelated to the extractor:

- **`cast-vote/index.ts`**: Change `err.message` to `(err as Error).message`
- **`analyze-alt-matches/index.ts`**, **`scrape-character-accounts/index.ts`**, **`track-online-players/index.ts`**: Add type annotations to fix Supabase client type inference issues (cast to `any` where needed)

### Files to Modify

| File | Change |
|------|--------|
| `public/tibiarc/tibiarc_player.js` | Replace with uploaded WASM JS |
| `public/tibiarc/tibiarc_player.wasm` | Replace with uploaded WASM binary |
| `src/lib/tibiaRelic/mapExtractor.ts` | Add cooldown + viewport validation |
| `src/lib/tibiaRelic/extractionWorker.ts` | No changes needed (already uses sync version) |
| `supabase/functions/cast-vote/index.ts` | Fix `err` type |
| `supabase/functions/analyze-alt-matches/index.ts` | Fix Supabase client type |
| `supabase/functions/scrape-character-accounts/index.ts` | Fix Supabase client type |
| `supabase/functions/track-online-players/index.ts` | Fix Supabase client type |

