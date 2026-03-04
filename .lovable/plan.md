

## Root Cause Analysis: C++ Parser Byte Drift in Underground Areas

### The Smoking Gun

There are **two critical discrepancies** between the JS parser (which works with 0 errors) and the C++ parser (which produces ghosting):

---

### Problem 1: Scroll Dimensions (THE MAIN BUG)

**Original tibiarc C++ scroll handlers read 1-tile strips** (standard Tibia protocol):
```text
ParseMoveEast:  (+9, -6,  1, 14)  → 1 column
ParseMoveNorth: (-8, -6, 18,  1)  → 1 row
ParseMoveSouth: (-8, +7, 18,  1)  → 1 row
ParseMoveWest:  (-8, -6,  1, 14)  → 1 column
```

**But TibiaRelic sends the FULL 18×14 viewport for every scroll** (modified OTHire behavior). The JS parser confirms this — it reads full 18×14 for all 4 directions and reports 0 parse errors:
```typescript
// JS parser scroll — works correctly:
this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, ...)
```

**Impact**: Every single scroll underground leaves ~200+ tiles of unread data in the stream. These bytes get interpreted as the next opcode's data, creating phantom creatures, wrong positions, duplications — exactly what the screenshots show. This cascading byte drift explains why "it works fine until entering the cave" — that's when scrolls start happening underground.

The existing `fix-scroll-floor-range.patch` only changes the Z floor range (`isScroll=true`), but **never touches the width/height**. This is why ghosting persists.

---

### Problem 2: FloorUp z=7→ Surface Transition

**C++ reads 6 floors** when transitioning from underground to surface (z=8→7):
```cpp
// C++ (original tibiarc):
for (int zIdx = 5; zIdx >= 0; zIdx--) {  // reads floors 5,4,3,2,1,0
    ParseFloorDescription(..., zIdx, 18, 14, ...);
}
```

**JS reads only 1 floor**:
```typescript
// JS parser:
const newFloor = Math.max(g.camZ - 2, 0); // = 5
this.readFloorArea(r, ..., newFloor, 18, 14, offset, 0); // only floor 5
```

TibiaRelic only sends 1 floor's data. The C++ over-reads by 5 floors, consuming ~1000+ bytes of subsequent opcodes.

---

### Problem 3: isScroll Z Range (Minor, consequence of #1)

The patch added `isScroll` to use ±2 floors instead of full 7→0 on surface scrolls. But this was a workaround for the wrong strip dimensions. With correct full-viewport dimensions, the default 7→0 range is correct (matches JS parser's `getMapDescFloorRange`).

---

### Fix Plan

| File | Change |
|------|--------|
| `tibiarc-player/fix-scroll-floor-range.patch` | **Rewrite completely**: (a) Change all 4 scroll functions to read full 18×14 viewport with offset `(-8, -6)`, (b) Remove `isScroll` parameter entirely — revert Z range to default 7→0 on surface, (c) Fix `ParseFloorChangeUp` z=7 case to read only 1 floor (z=5) instead of 6 floors |
| `.github/workflows/build-player.yml` | No changes needed — already applies the patch via `git apply` |

### Detailed patch changes

**Scroll functions** (all 4 become identical viewport read):
```text
Before: ParseMapDescription(reader, events, +9, -6, 1, TileBufferHeight, true)
After:  ParseMapDescription(reader, events, -8, -6, TileBufferWidth, TileBufferHeight)
```

**ParseFloorChangeUp z=7**:
```text
Before: for (zIdx = 5; zIdx >= 0; zIdx--) { read floor zIdx }  // 6 floors
After:  read only floor 5 with offset 3                         // 1 floor
```

**ParseMapDescription signature**: remove `isScroll` parameter, revert to original signature.

