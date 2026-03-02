

## Fix: Surface tiles contaminated by mid-chunk floor transitions

### Problem
The floor change detection runs AFTER processing a batch of 500 frames, and only compares the FINAL `camZ` to the previous value. If the player transitions floors and returns within the same batch (e.g., `camZ: 7 -> 8 -> 7`), the code sees `lastCamZ=7, camZ=7` -- no change detected.

However, while `camZ=8`, the protocol stores floor-7 tiles with a `+1` perspective offset baked into their X/Y coordinates. These offset tiles remain in `gs.tiles` with `tz=7`. When the snapshot runs (thinking no floor change occurred), it captures these offset tiles as legitimate floor-7 data -- placing them at wrong coordinates on the surface map.

### Solution
Move the floor change detection INSIDE the per-frame loop so that `gs.tiles` is cleared immediately when `camZ` changes, and track whether ANY floor change happened during the batch to skip the snapshot.

### Changes

**File: `src/lib/tibiaRelic/mapExtractor.ts`** (lines 82-105)

Move `camZ` tracking into the frame processing loop:

```typescript
let frameIdx = 0;

return new Promise((resolve) => {
  function processChunk() {
    const end = Math.min(frameIdx + chunkSize, cam.frames.length);
    let anyFloorChange = false;

    for (; frameIdx < end; frameIdx++) {
      try {
        parser.process(cam.frames[frameIdx].payload);
      } catch {
        // Skip broken frames
      }

      // Detect floor change per-frame, not per-chunk
      if (lastCamZ >= 0 && gs.camZ !== lastCamZ) {
        gs.tiles.clear(); // Purge stale offset tiles immediately
        anyFloorChange = true;
      }
      lastCamZ = gs.camZ;
    }

    // Only snapshot if no floor transitions happened during this batch
    if (!anyFloorChange) {
      snapshotTiles(gs, dat, latestTiles);
    }

    // ... rest unchanged (chunk tracking, creature snapshot, progress)
```

This ensures:
1. Tiles are purged the instant `camZ` changes, even mid-batch
2. If any floor transition occurred during the batch, we skip the snapshot entirely to avoid capturing any residual offset tiles
3. The next batch (if camZ is stable) will snapshot clean data

### Database Cleanup
Run a SQL migration to delete surface tiles (z=7) that have item 101 (grass) appearing at coordinates where the external map already has data -- or more practically, re-extract the affected `.cam` files after the fix. Since this is a re-extraction scenario, no SQL cleanup needed if the user re-runs extraction.

