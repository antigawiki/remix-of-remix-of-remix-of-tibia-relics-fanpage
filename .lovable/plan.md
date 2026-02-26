

## Fix: Complete Creature Sprite Rendering

### Root Cause

Two problems remain in how creatures are rendered:

**1. Missing patZ layers (addon/overlay parts)**

In OTClient/tibiarc, creature outfits can have multiple `patZ` layers that together compose the full creature appearance. For example, a creature with `patZ=2` has:
- z=0: base body
- z=1: overlay part (e.g., armor, accessories, extra body parts)

Our renderer **hardcodes `patZ = 0`**, only drawing the base layer. Any creature whose outfit has `patZ > 1` will appear incomplete -- missing parts of its body.

The fix: iterate through ALL `patZ` levels when drawing creatures, drawing each one on top of the previous. For each patZ level, both layer 0 (base) and layer 1 (tint mask) must be drawn.

**2. Item-based creature appearances (looktype = 0)**

When a creature has `looktype = 0`, the protocol sends a u16 item ID instead of outfit colors. This creature should be rendered using the **item sprite** from the items DAT section (like a corpse or object). Our code currently discards this item ID and falls back to default outfit 128, making these creatures show as generic citizens.

The fix: store the item-based looktype in the Creature struct and render it using `drawItem` logic when `outfit = 0`.

### Changes

**File: `src/lib/tibiaRelic/gameState.ts`**
- Add `outfitItem: number` field to the `Creature` interface and `createCreature()` function
- This stores the item ID when a creature uses looktype=0

**File: `src/lib/tibiaRelic/packetParser.ts`**
- Update `readOutfit` to return the item ID when looktype=0
- Update `updateCreatureCommon` to store the item ID in `c.outfitItem`

**File: `src/lib/tibiaRelic/renderer.ts`**
- **drawCreature**: Iterate through ALL patZ levels (z=0 to PZ-1), drawing both base layer and tint mask for each level
- **drawCreature**: When `c.outfit === 0 && c.outfitItem > 0`, render the creature using the item's sprite data from `this.dat.items` instead of the outfit data
- Current code (simplified):
```text
// Only draws patZ=0
idx = ((((((a * PZ + 0) * PY + 0) * PX + patX) * L + layer) * H + th) * W + tw)
```
- Fixed code (simplified):
```text
// Draw ALL patZ levels
for (let pz = 0; pz < PZ; pz++) {
  idx = ((((((a * PZ + pz) * PY + 0) * PX + patX) * L + layer) * H + th) * W + tw)
  // draw base layer (l=0)
  // draw tint mask layer (l=1) if layers >= 2
}
```

### Summary of rendering loop (after fix)

```text
For each creature:
  if outfit == 0 and outfitItem > 0:
    draw as item sprite (same as ground items)
  else if outfit found in DAT:
    for each patZ level (z=0..PZ-1):
      for each tile part (th, tw):
        draw base sprite (layer 0)
        draw tinted mask (layer 1, if exists)
  else:
    draw colored rectangle fallback
```

