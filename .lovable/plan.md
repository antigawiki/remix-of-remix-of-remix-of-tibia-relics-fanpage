
## Fix: Surface tiles contaminating underground floors in map extraction

### Problem
When the .cam player transitions between floors, the game protocol stores tiles for adjacent floors with a "perspective offset" baked into coordinates. For example, when `camZ=7` (surface), a floor 8 tile at `(x, y)` gets stored in memory as `(x-1, y-1, 8)`.

The current fix (`tz !== camZ`) correctly prevents capturing these offset tiles while on floor 7. However, when the player moves to floor 8 (`camZ=8`), those stale offset tiles remain in memory with `tz=8`. Since `tz === camZ` now passes, they get captured as legitimate underground tiles -- but at wrong coordinates. This is why 135,000+ grass tiles (item 101) appear on floor 8.

### Solution

Two changes needed:

**1. Clear `gs.tiles` on floor change in the extractor**

In `src/lib/tibiaRelic/mapExtractor.ts`, when a floor change is detected (`camZ` differs from `lastCamZ`), call `gs.tiles.clear()` to purge all stale offset tiles. The parser will repopulate tiles with correct coordinates as it processes subsequent frames.

```typescript
const floorChanged = lastCamZ >= 0 && gs.camZ !== lastCamZ;
lastCamZ = gs.camZ;

if (floorChanged) {
  gs.tiles.clear(); // Purge stale offset tiles from previous floor
}

if (!floorChanged) {
  snapshotTiles(gs, dat, latestTiles);
}
```

**2. Database cleanup: remove contaminated z=8 tiles**

Delete all `cam_map_tiles` where `z = 8` AND items contain only grass/surface ground tiles (item 101). Also regenerate `cam_map_chunks` for floor 8 afterward.

A broader approach: delete ALL `cam_map_tiles` for floors 8-15 that contain items typically exclusive to the surface (item 101 = grass). This affects ~135K rows on floor 8 alone. After cleanup, the user re-extracts and re-generates the map.

Alternatively, since the extractor fix will prevent future contamination, we can simply truncate all floor 8+ data and let the user re-extract cleanly.

### Technical Details

- **Root cause**: `readFloorArea()` in `packetParser.ts` stores tiles at `ox + tx + offset, oy + ty + offset, z` where `offset = camZ - nz`. These offset tiles persist in `gs.tiles` across floor transitions.
- **Why the previous fix was insufficient**: `tz !== camZ` only filters cross-floor tiles. It cannot detect same-floor tiles that were stored with wrong coordinates from a previous `camZ`.
- **Risk**: Clearing `gs.tiles` on floor change means losing 1 batch of data right after the transition. This is acceptable since floor transitions are infrequent and the data would be recaptured as the player explores.
