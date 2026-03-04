

## Root Cause: Missing Data-Exhaustion Guard in C++ ParseMapDescription

### The Problem (confirmed by reading the actual C++ source)

The scroll dimension fix (18x14) was correct but **insufficient**. The real killer is `ParseMapDescription` (line 438-452 in `lib/parser.cpp`):

```text
ParseMapDescription called from scroll → loops through 5 floors (z-2 to z+2)
  → Floor 6 (z=6): reads 250 bytes ✓
  → Floor 7 (z=7): 0 bytes remaining → DataReader::CheckRemaining throws
  → Exception propagates up, frame events LOST
  → But Parser::Position_ was ALREADY modified by scroll handler
  → ALL subsequent frames parse with wrong Position_ → cascading corruption
```

The JS parser handles this with `if (r.left() < 2) break;` (MULTIFLOOR_EXHAUSTED in the debug log). The C++ has no such guard.

**This also explains why "nothing changed"**: the 18x14 fix was applied, but the multi-floor exception kills the frame before the tile data can be used.

### Fix: Three Changes in One Patch

| Change | Location | What |
|--------|----------|------|
| **1. Add data-exhaustion guard** | `ParseMapDescription` (line 439) | Add `if (reader.Remaining() < 2) break;` inside the floor loop |
| **2. Relax end assertion** | `ParseMapDescription` (line 451) | Remove `ParseAssert(tileSkip == 0)` — server sends fewer floors |
| **3. Keep scroll + floorUp fixes** | Scroll handlers + FloorChangeUp | 18x14 viewport + single floor for z=7 transition |

### Patch File: `tibiarc-player/fix-scroll-floor-range.patch`

Rewrite the patch to include ALL three fixes in a single consolidated diff against `lib/parser.cpp`:

**Hunk 1 — ParseMapDescription (NEW)**:
```text
Before:
    for (; zIdx != (endZ + zStep); zIdx += zStep) {
        tileSkip = ParseFloorDescription(reader, ...);
    }
    ParseAssert(tileSkip == 0);

After:
    for (; zIdx != (endZ + zStep); zIdx += zStep) {
        if (reader.Remaining() < 2) break;    ← NEW GUARD
        tileSkip = ParseFloorDescription(reader, ...);
    }
    /* relaxed: TibiaRelic sends fewer floors */  ← ASSERTION REMOVED
```

**Hunk 2 — FloorChangeUp z=7** (existing fix, unchanged):
Read only floor 5 instead of loop 5→0.

**Hunks 3-6 — Scroll handlers** (existing fix, unchanged):
All 4 directions use `(-8, -6, TileBufferWidth, TileBufferHeight)`.

### Why This Fixes Everything

1. Underground scrolls: ParseMapDescription reads floor 6 (250 bytes), then `Remaining() < 2` → breaks cleanly → no exception → events preserved → `Position_` remains correct
2. Surface scrolls: all 8 floors have data → guard never triggers → works normally
3. Floor transitions: floorUp z=7 reads 1 floor → correct
4. No cascading corruption: every frame completes successfully

### No Other File Changes Needed

The `web_player.cpp` DeduplicateCreatures and the build workflow already handle everything else. This is purely a patch file rewrite.

