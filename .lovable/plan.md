

## Fix Dead Creatures, Wrong Effect Sprites, and Seek Robustness

### Problem 1: Dead Monsters Still Showing with Alive Outfit

**Root Cause**: When a creature dies, the server sends `chgThing` (opcode 0x6b) to replace the creature at its stack position with a corpse item. Our `chgThing` handler replaces `tile[sp]` with `['it', itemId]` but never checks if the entry being replaced was a creature (`['cr', id]`). The dead creature stays in `gs.creatures` forever with its alive outfit data. During seek, parse errors can skip the death sequence entirely, leaving creatures fully intact.

**Fix** (`src/lib/tibiaRelic/packetParser.ts`):
- In `chgThing`: When replacing a tile entry with an item, check if the old entry was `['cr', id]`. If so, delete it from `gs.creatures` (unless it's the player).

Additionally, the renderer should skip drawing creatures with `health <= 0` entirely (body + HUD), not just HUD.

**Fix** (`src/lib/tibiaRelic/renderer.ts`):
- In Pass 3 (creature drawing loop): Skip creatures with `health <= 0` so dead creatures don't render with alive outfits even if they briefly remain in the state.

### Problem 2: Wrong Effect/Projectile Sprites

**Root Cause**: The effect and missile IDs have an off-by-one error. The protocol sends 1-based IDs (e.g., `CONST_ME_DRAWBLOOD = 1`), and the DatLoader stores effects starting at ID 1. But the code adds `+1` to both:
```
effectId: effectType + 1    // maps server ID 1 to dat ID 2 -- WRONG
missileId: missileType + 1  // same bug
```
This shifts every effect and projectile by one slot in the sprite sheet, showing incorrect visuals.

**Fix** (`src/lib/tibiaRelic/packetParser.ts`):
- Opcode 0x83: Change `effectType + 1` to `effectType` (direct mapping)
- Opcode 0x85: Change `missileType + 1` to `missileType` (direct mapping)

### Problem 3: Seek Desync and Missing Tiles

**Root Cause**: Seeking replays all frames from 0 to target. During replay, parse errors are silently caught and frames are skipped. Each skipped frame can miss critical map data, creature updates, or death sequences. Over thousands of frames, these compound into visible desync.

**Fix** -- Keyframe snapshot system (`src/lib/tibiaRelic/gameState.ts` + `src/components/TibiarcPlayer.tsx`):

1. **GameState**: Add `snapshot()` and `restore(snapshot)` methods that serialize/deserialize the full state (tiles map, creatures map, camera position, playerId).

2. **TibiarcPlayer**: During normal playback (not seek), save a snapshot every ~30 seconds into a keyframe array. When seeking:
   - Find the nearest keyframe BEFORE the target time
   - Restore that snapshot instead of replaying from frame 0
   - Replay only the frames between the keyframe and target
   
   This dramatically reduces the number of frames to replay (max ~30s worth vs potentially hours) and minimizes cumulative parse errors.

3. **Post-seek cleanup**: After seek, also prune creatures with `health <= 0` from `gs.creatures` (not just orphans).

### Files to Edit

1. **`src/lib/tibiaRelic/packetParser.ts`**
   - Fix `chgThing` to delete replaced creatures from `gs.creatures`
   - Fix effect ID: `effectType + 1` -> `effectType`
   - Fix missile ID: `missileType + 1` -> `missileType`

2. **`src/lib/tibiaRelic/renderer.ts`**
   - Skip drawing creature body (Pass 3) when `health <= 0`

3. **`src/lib/tibiaRelic/gameState.ts`**
   - Add `snapshot()` method: serializes tiles, creatures, camera, playerId into a plain object
   - Add `restore(snap)` method: deserializes back into live state

4. **`src/components/TibiarcPlayer.tsx`**
   - Add keyframe array to engine ref (`keyframes: { ms: number, frameIdx: number, snap: object }[]`)
   - During normal playback in `applyTo`, save snapshot every 30s
   - In `handleSeek`, find nearest keyframe, restore snapshot, replay from there
   - After seek, prune dead creatures (health <= 0) in addition to orphans

### Expected Results
- Dead monsters disappear properly (corpse item replaces creature)
- Magic effects and projectiles show correct sprites
- Seeking to any point loads quickly and shows correct state with minimal desync
- No more creatures stuck on wrong floors after seeking

