
## Comprehensive Bug Fix: Revert Broken Changes + Keep Good Ones

### Root Cause Analysis

The previous round of changes introduced **3 critical regressions** while fixing dead monster cleanup. Here's exactly what went wrong:

### Bug 1: Creatures in Wrong Positions (Tsunade far from Resenha)

**Cause**: `delThing` (opcode 0x6c) now deletes creatures from `gs.creatures`. This is WRONG.

In OTClient's `parseTileRemoveThing`, removing a thing from a tile does NOT destroy the creature object. The creature data (name, outfit, position) is preserved. In Tibia protocol, creatures can be moved via `delThing` + `addThing` sequences (not just `moveCr`). Deleting from `gs.creatures` in `delThing` destroys the creature's data, so when it's re-added, it gets a fresh object with no name, wrong outfit, or wrong position.

**Fix**: Remove the creature deletion from `delThing`. Only delete from the tile array.

### Bug 2: Attack Effects Completely Disappeared

**Cause**: Effect and missile IDs were changed from `effectType + 1` to `effectType`.

After checking OTClient source code, the protocol sends 1-based effect IDs and the dat stores effects starting at ID 1. Direct mapping SHOULD work. However, this specific TibiaRelic server appears to use 0-based IDs (the original `+1` code was working -- effects showed correct visuals). Since `effectType + 1` was producing visible effects before, we must restore it.

**Fix**: Restore `effectType + 1` and `missileType + 1` for the ID mapping.

### Bug 3: Dead Monster Invisible Gap (alive sprite vanishes, delay, then corpse)

**Cause**: Renderer Pass 3 now skips drawing creatures with `health <= 0`. The death sequence is:
1. Server sends health update (0x8c): health = 0
2. (Some frames pass)
3. Server sends chgThing (0x6b): replaces creature with corpse item

Between steps 1 and 2, the creature is invisible because the renderer refuses to draw it. This creates the visible "gap."

In OTClient, dead creatures are still drawn with their alive outfit until the server replaces them with a corpse. Only the HUD (name/health bar) should be hidden for dead creatures.

**Fix**: Remove the `health > 0` check from Pass 3 (creature body drawing). Keep the `health <= 0` skip only in the HUD loop (already there).

### Bug 4: No Walk Animation

**Cause**: Side effect of `delThing` deleting creatures from `gs.creatures`. When a creature's data is destroyed and recreated, the walk animation state (walkStartTick, walkEndTick, walkOffset) is lost. The creature appears to teleport instead of walking smoothly.

**Fix**: Resolved by fixing Bug 1 (reverting `delThing` deletion).

---

### What to KEEP from previous changes

- `chgThing` creature deletion -- When a creature's tile slot is replaced by an item (corpse), deleting from `gs.creatures` IS correct. This is the proper death cleanup.
- Keyframe/snapshot system -- The `GameState.snapshot()` / `restore()` system and keyframe-based seeking are solid improvements.
- HUD validation -- The HUD loop already validates creature is on-tile and has health > 0. This stays.
- Post-seek pruning of orphaned creatures -- Good, but remove the `health <= 0` deletion (a creature can be at 0 HP briefly during death sequence and still be valid).

---

### Files to Edit

#### 1. `src/lib/tibiaRelic/packetParser.ts`

**`delThing` method (lines 399-412)**: Remove the creature deletion from `gs.creatures`. Only splice from tile array.

**Effect opcode 0x83 (line 231)**: Restore `effectType + 1` for the effectId.

**Missile opcode 0x85 (line 242)**: Restore `missileType + 1` for the missileId.

#### 2. `src/lib/tibiaRelic/renderer.ts`

**Pass 3 creature drawing (line 271)**: Remove the `c.health > 0` check. Draw all creatures found on tiles regardless of health. The death cleanup via `chgThing` handles removing dead creatures properly.

#### 3. `src/components/TibiarcPlayer.tsx`

**Post-seek pruning (lines 220-234)**: Remove the `health <= 0` deletion. Only prune truly orphaned creatures (those not found on any tile).

### Expected Results
- Creatures appear at correct positions (Tsunade next to Resenha)
- Attack effects and projectiles render with correct sprites
- Death sequence is seamless: alive sprite shown until corpse replaces it
- Walk animations work properly
- Seek still works fast via keyframe system
- Dead creature HUD (name/health bar) still hidden correctly
