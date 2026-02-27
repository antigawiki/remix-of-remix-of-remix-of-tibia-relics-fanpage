

## Fix Dead Monster HUD + Stale Creatures + Floor Bugs

### Root Cause Analysis

All three issues share a single root cause: **creatures are never removed from `gs.creatures` map**.

When a creature dies or leaves the screen:
1. `delThing` (opcode 0x6c) removes it from the tile array
2. But the creature object stays in `gs.creatures` forever
3. The HUD loop iterates ALL creatures in the map, drawing name/HP for dead or off-screen creatures
4. After seeking, hundreds of stale creatures accumulate at old positions and floors

### Changes

#### 1. `src/lib/tibiaRelic/packetParser.ts` - Clean up creatures on removal

**In `delThing`**: When a creature reference (`['cr', id]`) is removed from a tile, also delete it from `gs.creatures` (unless it's the player). This ensures dead monsters and creatures that leave the viewport are properly cleaned up.

**In `moveCr`**: No change needed -- creatures that move are correctly tracked.

#### 2. `src/lib/tibiaRelic/renderer.ts` - Only draw HUD for creatures on tiles

**In the HUD loop** (line 377): Before drawing a creature's HUD, verify the creature actually exists on its tile. Check that the tile at `(c.x, c.y, c.z)` contains a `['cr', c.id]` entry. Skip HUD rendering if the creature isn't found on any tile (stale entry).

Additionally, skip HUD for creatures with `health <= 0` as an extra safety measure.

#### 3. `src/components/TibiarcPlayer.tsx` - Prune stale creatures after seek

**In `applyTo`** (after seek completes): After clearing walk animations, scan all creatures and remove any that are NOT present on their claimed tile. This handles edge cases where frames were skipped during seek replay.

### Files to Edit
1. **`src/lib/tibiaRelic/packetParser.ts`** -- Delete creature from `gs.creatures` when removed from tile via `delThing`
2. **`src/lib/tibiaRelic/renderer.ts`** -- Validate creature is on-tile before drawing HUD; skip health<=0
3. **`src/components/TibiarcPlayer.tsx`** -- Prune orphaned creatures from `gs.creatures` after seek

### Expected Results
- Dead monsters no longer show name/HP bars
- Seeking no longer leaves stale creatures on screen or on wrong floors
- Camera and tiles load correctly after seeking to any position

