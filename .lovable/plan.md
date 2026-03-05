

## Root Cause Found: Scroll Dimension Mismatch in C++ Parser

### The Problem
The WASM build pipeline contains `sed` patches that **incorrectly revert** the fork's scroll dimensions to standard Tibia protocol sizes. The fork (`antigawiki/tibiarc`) had 18x14 scroll reads because TibiaRelic sends a **full viewport** on every scroll — not just the newly visible row/column like vanilla Tibia.

### Evidence

**JS parser (working correctly):**
```typescript
// packetParser.ts line 596 — ALL scroll directions read full 18×14 multi-floor
this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, ...);
```

**C++ build patches (breaking the parser):**
```bash
# ScrollEast: 18x14 → 1×14   ← WRONG
# ScrollNorth: 18x14 → 18×1  ← WRONG  
# ScrollSouth: 18x14 → 18×1  ← WRONG
# ScrollWest: 18x14 → 1×14   ← WRONG
```

**OTClient reference confirms** standard Tibia uses 1-row/1-column for scrolls. But TibiaRelic is NOT standard — it sends full viewport data. The fork knew this and read 18×14.

### Why this causes all the symptoms

Every time the player walks (which triggers a scroll opcode), the C++ parser reads ~14-18 tiles but TibiaRelic sent ~252 tiles × multiple floors. The hundreds of unconsumed bytes are interpreted as the next opcode, causing:

1. **Creature duplication/ghosts** — creature data bytes interpreted as item IDs or vice versa
2. **Wrong floor rendering** — floor change bytes consumed as creature data
3. **Tiles appearing incorrectly** — tile data from one position rendered at another
4. **Cascading corruption** — one bad scroll corrupts ALL subsequent packets in the frame

No amount of `SanitizeCreatureState` can fix this because the problem is upstream — the data is being fundamentally misread.

### The Fix

**File: `.github/workflows/build-tibiarc.yml`**

1. **Remove the 4 scroll revert patches** (lines 148-163) — keep the fork's original 18×14 scroll dimensions
2. **Remove the FloorUp revert patch** (lines 166-173) — the fork's single-floor read for floorUp at z=7 is likely correct for TibiaRelic too, since the JS parser also reads only the newly visible floor (not 6 floors)
3. Keep all other patches (opcode payload fixes, new opcodes, etc.) as they are correct

```text
Before (broken):
  ScrollNorth → read 18×1 (standard)  → 238 bytes unconsumed → DRIFT
  ScrollEast  → read 1×14 (standard)  → 238 bytes unconsumed → DRIFT

After (fixed):
  ScrollNorth → read 18×14 (TibiaRelic) → 0 bytes unconsumed → CORRECT
  ScrollEast  → read 18×14 (TibiaRelic) → 0 bytes unconsumed → CORRECT
```

### Secondary fix: FloorUp at z=7

The JS `floorUp` (line 908) reads only 1 new floor when exiting underground. The C++ patch forces 6 floors (5→0). If TibiaRelic only sends 1 floor, this also causes drift. Reverting to the fork's original single-floor behavior for this case would fix floor transition corruption.

### Files to change
- `.github/workflows/build-tibiarc.yml` — remove scroll revert patches and FloorUp revert patch

After editing, rebuild WASM via GitHub Actions.

