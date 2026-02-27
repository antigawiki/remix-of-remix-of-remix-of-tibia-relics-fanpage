

## Fix Seek Bugs + Add Magic Effects/Projectile Rendering

### Issue 1: Seek Causes Visual Bugs

**Root Cause**: `handleSeek` in TibiarcPlayer.tsx calls `engine.renderer.clearCache()` which destroys ALL cached sprite canvases and tint canvases. After seek, every visible sprite must be recreated from scratch (hundreds of `document.createElement('canvas')` calls in the first few frames), causing massive stuttering and visual "bugs" as the renderer struggles to rebuild.

The sprite cache and tint cache are keyed by sprite ID and outfit colors -- they do NOT depend on game state or position, so clearing them during seek is unnecessary and harmful.

**Fix** (`src/components/TibiarcPlayer.tsx`):
- In `handleSeek`: Remove the `engine.renderer.clearCache()` call. Only clear cache when loading a NEW .cam file (which is already done in `handleFileSelect`).
- In `resetPlayback`: Same -- remove `clearCache()` since we're replaying the same recording with the same sprites.

### Issue 2: Magic Effects and Projectiles Not Rendered

Currently, opcodes 0x83 (magic effect) and 0x85 (distance shot/projectile) are parsed but immediately discarded. The DatLoader also reads effect and missile definitions from Tibia.dat but throws them away.

**Changes needed across 4 files:**

#### A. `src/lib/tibiaRelic/datLoader.ts` -- Store effects and missiles
- Add `effects: Map<number, ItemType>` and `missiles: Map<number, ItemType>` to DatLoader
- In the `load()` method, store effect entries (IDs 1..effectMaxId) and missile entries (IDs 1..missileMaxId) instead of discarding them
- Note: effects and missiles do NOT have patZ (pass `false` for hasPatZ)

#### B. `src/lib/tibiaRelic/gameState.ts` -- Add effect/projectile state
- Add `ActiveEffect` interface: `{ x, y, z, effectId, startTick, duration }`
- Add `ActiveProjectile` interface: `{ fromX, fromY, fromZ, toX, toY, toZ, missileId, startTick, duration }`
- Add `effects: ActiveEffect[]` and `projectiles: ActiveProjectile[]` arrays to GameState
- Add `pruneEffects(now)` method that removes expired effects/projectiles
- Clear these arrays in `reset()`

#### C. `src/lib/tibiaRelic/packetParser.ts` -- Parse and store effects
- **Opcode 0x83** (magic effect): Parse position (u16 x, u16 y, u8 z) + u8 effectType. Create an `ActiveEffect` with ~600ms duration, push to `gs.effects`
- **Opcode 0x85** (projectile): Parse fromPos(5 bytes) + toPos(5 bytes) + u8 missileType. Create an `ActiveProjectile` with duration based on distance (~150ms per tile), push to `gs.projectiles`
- Opcode 0x84 (animated text) can remain skipped for now

#### D. `src/lib/tibiaRelic/renderer.ts` -- Render effects and projectiles
- Add a new render pass (Pass 3.5, after creatures but before top items) that draws active effects:
  - For each `ActiveEffect`: look up sprite from `dat.effects`, compute animation frame from elapsed time, draw at world position using `drawItemNative` logic
  - For each `ActiveProjectile`: look up sprite from `dat.missiles`, interpolate position from source to destination based on elapsed time, draw at interpolated position
- Call `gs.pruneEffects(now)` at the start of `draw()` to remove expired ones
- The effect sprites use the same `getNativeSprite()` cache as items, so no new caching needed

### Files to Edit
1. **`src/components/TibiarcPlayer.tsx`** -- Remove unnecessary cache clears on seek/reset
2. **`src/lib/tibiaRelic/datLoader.ts`** -- Store effect and missile definitions
3. **`src/lib/tibiaRelic/gameState.ts`** -- Add effect/projectile arrays and pruning
4. **`src/lib/tibiaRelic/packetParser.ts`** -- Parse opcodes 0x83 and 0x85 into game state
5. **`src/lib/tibiaRelic/renderer.ts`** -- Render active effects and projectiles

### Expected Results
- Seeking via slider no longer causes stuttering or visual corruption
- Magic effects (explosion, fire, healing, etc.) appear at the correct position and animate
- Projectiles (arrows, bolts, spells) fly from source to destination
- Effects automatically expire after their animation completes

