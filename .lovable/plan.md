

## Fix Effects + Add Damage Numbers + Creature Walk Fixes

### 1. Restore Effect/Missile ID +1 Offset

The effects were working correctly with `+1` before our changes. The TibiaRelic server appears to use 0-based effect IDs (non-standard), so the `+1` mapping is needed to align with the DatLoader which stores effects starting at ID 1.

**File**: `src/lib/tibiaRelic/packetParser.ts`
- Opcode 0x83: Change `effectId: effectType` back to `effectId: effectType + 1`
- Opcode 0x85: Change `missileId: missileType` back to `missileId: missileType + 1`

### 2. Implement Animated Text (Damage Numbers) - Opcode 0x84

Currently opcode 0x84 is just skipped. This is the "animated text" packet that shows damage numbers, healing numbers, and XP gains floating above creatures.

**File**: `src/lib/tibiaRelic/gameState.ts`
- Add `AnimatedText` interface: `{ x, y, z, color, text, startTick, duration }`
- Add `animatedTexts: AnimatedText[]` array to GameState
- Add pruning in `pruneEffects()`
- Include in `snapshot()`/`restore()`/`reset()`

**File**: `src/lib/tibiaRelic/packetParser.ts`
- Parse 0x84 properly: `pos3` + `u8 color` + `str16 text`
- Convert the protocol color byte to an RGB hex string (Tibia uses an 8-bit color index)
- Push to `gs.animatedTexts` array (skip in seekMode)

**File**: `src/lib/tibiaRelic/renderer.ts`
- Add Pass 3.7 (after projectiles, before top items): render animated texts
- Text floats upward over ~1 second (linear Y interpolation from tile position to -20px above)
- Draw at native resolution on offscreen canvas with small font (~8px)
- Use the parsed color for the text, with black outline for readability

### 3. Fix Creature Walk Animation Occasionally Missing

The walk animation disappears when `moveCr` Format B (0xFFFF) resolves a creature whose stored position already matches the destination (dx=0, dy=0). This happens when the creature's position was updated by a previous packet but the tile reference wasn't cleaned up. The walk offset becomes (0,0), so no visual movement occurs.

**File**: `src/lib/tibiaRelic/packetParser.ts`
- In `moveCr` Format B: After resolving `fromX/Y/Z` from the creature's stored position, verify `dx` or `dy` is non-zero before setting walk animation. If both are 0, skip the walk offset setup but still update the tile placement.
- Also ensure that when a creature starts a new walk while still walking, the previous walk is properly finalized (snap position) before starting the new one -- this part already exists but double-check the edge case where `fromX` equals the creature's already-snapped position.

### 4. Fix Creature Overlap (Player on Top of Another)

When `moveCr` removes a creature from a tile by stackpos, it might grab the wrong creature if the stackpos is stale (items were added/removed between the move packets). This causes the wrong creature to be moved, leaving the intended creature orphaned on the tile.

**File**: `src/lib/tibiaRelic/packetParser.ts`
- In `moveCr` Format A: After finding a creature by stackpos, verify its stored position matches `(fx, fy, fz)`. If it doesn't match, fall through to the position-based search instead of using the stale stackpos entry.

### Files to Edit

1. **`src/lib/tibiaRelic/gameState.ts`** -- Add AnimatedText type and array
2. **`src/lib/tibiaRelic/packetParser.ts`** -- Restore +1 for effects, parse 0x84, fix moveCr edge cases
3. **`src/lib/tibiaRelic/renderer.ts`** -- Render animated text (damage numbers)

### Expected Results
- Attack effects and projectiles show correct sprites (restored +1 mapping)
- Damage numbers float upward when monsters are hit
- Walk animations play consistently even for Format B creature moves
- Creatures don't overlap incorrectly due to stale stackpos references

