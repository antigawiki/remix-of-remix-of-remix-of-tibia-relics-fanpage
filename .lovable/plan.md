

## Fix: Creature Rendering Based on tibiarc Reference

### Root Cause Analysis

After studying the tibiarc C++ source code (renderer.cpp, types.cpp, versions.cpp), I identified several rendering differences between our implementation and the reference that explain the "cut" creature sprites:

### Problem 1: Wrong Animation Frame Selection (Main Cause)

Our renderer cycles all creatures through animation frames 0-1-2 constantly (`phCr = (tick/6) % 3`), regardless of whether the creature is walking or standing still.

In tibiarc, standing creatures use frame 0 (idle pose). Only walking creatures cycle through frames. This means our renderer shows mid-step walk poses on creatures that should be standing still, making them look "cut" or awkward compared to the reference player.

tibiarc's logic:
```text
if (AnimateIdle):
    frame = (tick / 500) % frameCount
else if (walking):
    if frameCount <= 2: cycle all frames
    if frameCount >= 3: frame = (tick/100) % (frameCount-1) + 1  (skip idle frame 0)
else (standing still):
    frame = 0  (idle pose)
```

### Problem 2: Displacement Direction Inverted

Our renderer adds displacement (bx + dispX), which shifts sprites right/down. tibiarc subtracts displacement (rightX -= DisplacementX), shifting sprites left/up. This shifts multi-tile and displaced creatures to wrong positions.

### Problem 3: patY/patZ Semantics Wrong

tibiarc uses:
- patX (XDiv) = direction (0-3)
- **patY (YDiv) = addon layer** (0=base, 1+=addons)
- **patZ (ZDiv) = mount** (0=unmounted, 1=mounted)

Our code iterates patZ for "addons" and hardcodes patY=0. While this doesn't matter for TibiaRelic 7.72 (all outfits have patY=1, patZ=1), it's semantically wrong.

### Problem 4: HUD Positioning for Multi-tile Creatures

The name and health bar for 2x2+ creatures is positioned above the anchor tile (bottom-right) instead of centered over the full creature area.

### Changes

**File: `src/lib/tibiaRelic/renderer.ts`**

1. **Fix animation frame selection in drawCreature**:
   - Standing creatures (not walking): always use frame 0
   - Walking creatures with 3+ frames: use `(tick/100) % (frameCount-1) + 1` (skip idle frame)
   - Walking creatures with <=2 frames: cycle normally
   - AnimateIdle creatures: `(tick/500) % frameCount`
   - Add walking state check using creature speed and tick

2. **Fix displacement direction**:
   - Change `bx + dispXPx` to `bx - dispXPx` for creatures
   - Change `by + dispYPx` to `by - dispYPx` for creatures
   - Items keep current direction (displacement semantics differ for items)

3. **Fix patY addon iteration**:
   - Iterate `patY` (0 to PY-1) for addon layers instead of patZ
   - Use patZ=0 (no mount) as constant
   - For each patY level, draw base layer (l=0) and tint mask (l=1)

4. **Fix HUD positioning for multi-tile creatures**:
   - For creatures with outfit width/height > 1, center the name and health bar over the full creature area, not just the anchor tile

5. **Remove diagnostic logs** added in previous iterations (creatureLogCount, verify hex dumps)

### Rendering Loop After Fix

```text
For each creature:
  Get outfit from DAT
  Determine animation frame:
    if creature is idle -> frame = 0
    if creature is walking -> frame = cycle through walk frames
    if outfit has AnimateIdle flag -> frame = (tick/500) % frameCount

  For each addon layer (patY = 0..PY-1):
    Draw base sprite (layer 0) with corrected displacement
    Draw tinted mask (layer 1) if layers >= 2

  Draw HUD centered over full creature width/height
```

### Files to Modify
- `src/lib/tibiaRelic/renderer.ts` - All rendering fixes
- `src/lib/tibiaRelic/gameState.ts` - Add `walking: boolean` and `walkEndTick: number` to Creature (needed for animation state)
- `src/lib/tibiaRelic/packetParser.ts` - Track walking state when creatures move

