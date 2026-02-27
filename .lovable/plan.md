

## Fix Dead Creature Ghost + Effect Sprite Offset

### Bug 1: Dead creature alive body visible for ~1 second alongside corpse

**What's happening**: The death sequence in Tibia protocol is:
1. Server sends health=0 (opcode 0x8c)
2. Server adds corpse item to tile (addThing)
3. Server removes creature from tile (delThing)

Between steps 1-3, the creature with health=0 is STILL drawn with its alive outfit because we removed the `health > 0` check from Pass 3. This means both the corpse AND the alive-looking creature render simultaneously for up to 1 second.

**Fix** (`src/lib/tibiaRelic/renderer.ts`):
- Re-add `c.health > 0` check in Pass 3 (creature body drawing, line 271). Creatures at 0 HP become invisible immediately, and the corpse item (already added to the tile) shows in its place. The gap between health=0 and corpse appearing is typically 1-2 frames (imperceptible), much better than showing both simultaneously for a full second.

### Bug 2: Effect/projectile sprites showing wrong visuals

**What's happening**: The DatLoader stores effects starting at ID 1 (`it.id = 1 + i`). Standard Tibia 7.72 protocol sends 1-based effect IDs (e.g., CONST_ME_DRAWBLOOD = 1). The code currently does `effectType + 1`, which maps server ID 1 to dat ID 2 -- shifting every effect and projectile by one position, showing the WRONG sprite.

When we previously tried removing `+1`, effects seemed to "disappear," but that was likely due to other visual bugs happening simultaneously (invisible creatures, etc.) making it hard to evaluate.

**Fix** (`src/lib/tibiaRelic/packetParser.ts`):
- Opcode 0x83 (Magic Effect): Change `effectType + 1` back to `effectType` (direct 1-based mapping)
- Opcode 0x85 (Projectile): Change `missileType + 1` back to `missileType` (direct 1-based mapping)

### Files to Edit

1. **`src/lib/tibiaRelic/renderer.ts`** (line 271) -- Add `c.health > 0` condition to creature drawing in Pass 3
2. **`src/lib/tibiaRelic/packetParser.ts`** (lines 231, 242) -- Remove `+ 1` from effectId and missileId

### Expected Results
- Dead monsters disappear immediately when health reaches 0, corpse replaces them seamlessly
- Magic effects and projectile sprites show the correct visual for each attack type

