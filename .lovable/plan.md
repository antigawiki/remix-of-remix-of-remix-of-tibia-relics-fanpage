
## Fix: Tile Duplication and Misplacement in Map Extraction

### Confirmed Bug: `floorUp` Perspective Offset Inversion

In `packetParser.ts`, when transitioning from underground to surface (camZ becomes 7), the offset formula is **inverted** compared to OTClient.

**OTClient (correct):**
```text
for i = 5 down to 0:
    offset = 8 - i    // floor 5 -> offset 3, floor 0 -> offset 8
```

**Our code (wrong):**
```text
for nz = 5 down to 0:
    offset = 2 + nz   // floor 5 -> offset 7, floor 0 -> offset 2
```

This stores floor 0-5 tiles at wrong (X,Y) positions in `gs.tiles` during every underground-to-surface transition. While these tiles are on floors 0-5 (filtered by Z in snapshotTiles), the corrupted state in `gs.tiles` can indirectly affect subsequent operations.

### Protective Measure: Viewport Radius Filter in `snapshotTiles`

Currently, `snapshotTiles` captures ALL tiles in `gs.tiles` that match camZ, including stale tiles from positions visited thousands of frames ago. During multi-floor reads, the perspective offset system creates tiles on other floors at shifted coordinates. In edge cases (parser errors, truncated packets), these could leak into wrong positions.

Adding a viewport radius filter (e.g., 40 tiles from camera center) ensures only tiles near the player's current position are captured, preventing stale or misplaced tiles from entering the output.

### Changes

**1. `src/lib/tibiaRelic/packetParser.ts`** - Fix `floorUp` offset formula
- Line ~742: Change `const offset = 2 + nz;` to `const offset = 8 - nz;`
- This matches OTClient's `setFloorDescription(msg, ..., i, ..., 8 - i, skip)`

**2. `src/lib/tibiaRelic/mapExtractor.ts`** - Add viewport radius filter in `snapshotTiles`
- Before storing a tile, verify it's within a reasonable distance (40 tiles) from the camera position
- This prevents stale/displaced tiles from being captured regardless of source

**3. Database cleanup** - Clear and re-extract
- After code fixes, the user should clear the database and re-extract all .cam files to rebuild with corrected data

### After Changes
1. Clear database (Limpar DB)
2. Re-extract all .cam files
3. Regenerate map (Gerar Mapa)
