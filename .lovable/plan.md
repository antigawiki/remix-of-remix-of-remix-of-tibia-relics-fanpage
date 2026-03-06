

## Corrections: Scroll 18x14 + FloorUp 1-floor

### What the C++ does vs. what TibiaRelic sends

**Scroll (0x65-0x68):**
- C++ reads: 1 row or 1 column (`18x1` or `1x14`) via `ParseMapDescription(..., 1, 14)` or `(..., 18, 1)` — standard Tibia protocol
- JS reads (works): full `18x14` multi-floor via `readMultiFloorArea(r, camX-8, camY-6, 18, 14, ...)` with the same floor range as MapDescription
- The offsets also differ: C++ uses directional offsets (+9/-6 for East, -8/+7 for South), JS always uses (-8, -6)

**FloorUp (0xBE) at z==7:**
- C++ reads: 6 floors (`for (int zIdx = 5; zIdx >= 0; zIdx--)`) — floors 5,4,3,2,1,0
- JS reads (works): 1 floor only (z=5) via `readFloorArea(r, ..., 5, 18, 14, 3, 0)`

### Implementation

Create a Python patch script (`tibiarc-player/scroll_floor_patch.py`) that modifies `lib/parser.cpp`:

1. **ParseMoveNorth**: Replace `ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, 1)` with `ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight)`

2. **ParseMoveEast**: Replace `ParseMapDescription(reader, events, +9, -6, 1, Map::TileBufferHeight)` with `ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight)`

3. **ParseMoveSouth**: Replace `ParseMapDescription(reader, events, -8, +7, Map::TileBufferWidth, 1)` with `ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight)`

4. **ParseMoveWest**: Replace `ParseMapDescription(reader, events, -8, -6, 1, Map::TileBufferHeight)` with `ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight)`

5. **ParseFloorChangeUp (z==7)**: Replace the 6-floor loop `for (int zIdx = 5; zIdx >= 0; zIdx--)` with a single-floor read of z=5 only

### Files to change

1. **`tibiarc-player/scroll_floor_patch.py`** (new) — Python script that patches `lib/parser.cpp` with regex replacements
2. **`.github/workflows/build-tibiarc.yml`** — Add call to `scroll_floor_patch.py` and remove the "SCROLL, FLOORUP patches REMOVED" comment
3. **`tibiarc-player/fix-scroll-floor-range.patch`** — Update documentation

