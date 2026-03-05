

## Root Cause Analysis: Scroll Dimensions Never Fixed

### The Real Problem

After reading the **actual source code of the antigawiki/tibiarc fork** (fetched from GitHub), I discovered that the fork uses **standard Tibia scroll dimensions**, identical to the original tibiacast/tibiarc:

```text
ParseMoveNorth: (-8, -6, width=18, height=1)   ← reads 18×1 tiles
ParseMoveEast:  (+9, -6, width=1,  height=14)  ← reads 1×14 tiles
ParseMoveSouth: (-8, +7, width=18, height=1)   ← reads 18×1 tiles
ParseMoveWest:  (-8, -6, width=1,  height=14)  ← reads 1×14 tiles
```

The build workflow comments say "KEPT AS FORK DEFAULTS (18x14)" — **this is wrong**. The fork never changed scroll dimensions. The previous patches that "reverted" scrolls were actually removing changes that never existed. So removing those patches did nothing.

**TibiaRelic sends a FULL 18×14 multi-floor viewport on every scroll**, as confirmed by the JS parser:
```typescript
// packetParser.ts line 596 — ALL scrolls read full viewport
this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, ...);
```

**Every player step causes ~250+ tiles of data to be left unconsumed**, which are then interpreted as opcodes, corrupting all subsequent parsing in the frame.

### FloorUp at z=7: Also Mismatched

The C++ reads **6 floors** (z=5 down to z=0) when going up to surface:
```cpp
for (int zIdx = 5; zIdx >= 0; zIdx--) { // 6 floors
    ParseFloorDescription(reader, ...);
}
```

The JS reads **1 floor** (z=5 only):
```typescript
if (g.camZ === 7) {
    const newFloor = Math.max(g.camZ - 2, 0); // z=5
    this.readFloorArea(r, ..., newFloor, 18, 14, offset, 0); // single floor
}
```

This is another source of massive byte drift during floor transitions.

### The Fix: Add sed Patches to Change Scroll and FloorUp Dimensions

**File: `.github/workflows/build-tibiarc.yml`**

Add 5 new sed patches in the "Apply TibiaRelic protocol fixes" step:

1. **ParseMoveNorth (0x65)**: Change `Map::TileBufferWidth, 1` → `Map::TileBufferWidth, Map::TileBufferHeight`
2. **ParseMoveEast (0x66)**: Change `+9, -6, 1, Map::TileBufferHeight` → `-8, -6, Map::TileBufferWidth, Map::TileBufferHeight`
3. **ParseMoveSouth (0x67)**: Change `-8, +7, Map::TileBufferWidth, 1` → `-8, -6, Map::TileBufferWidth, Map::TileBufferHeight`
4. **ParseMoveWest (0x68)**: Change `-8, -6, 1, Map::TileBufferHeight` → `-8, -6, Map::TileBufferWidth, Map::TileBufferHeight`
5. **FloorUp z=7 (0xBE)**: Change the 6-floor loop to read only 1 floor (z=5), matching JS parser behavior

### Creature Name Size Reduction

The renderer draws creature names using `DrawCenteredProperCaseString` with `version.Fonts.Game` — a bitmap font from Tibia.pic. Bitmap fonts can't be "halved" directly, but there are two practical approaches:

**Option A: Use the smaller built-in font** — Add a sed patch to replace `version.Fonts.Game` with `version.Fonts.InterfaceSmall` in the `DrawCreatureOverlay` function. This is the smallest available bitmap font.

**Option B: Skip non-player names entirely** — Set `options.SkipRenderingNonPlayerNames = true` in web_player.cpp, which removes monster/NPC names while keeping player names.

### Files to Change

1. **`.github/workflows/build-tibiarc.yml`** — Add sed patches for scroll dimensions + FloorUp single-floor + creature name font
2. **`tibiarc-player/web_player.cpp`** — Optionally set `SkipRenderingNonPlayerNames` flag
3. **`.lovable/plan.md`** — Update with findings

After changes, rebuild WASM via GitHub Actions.

