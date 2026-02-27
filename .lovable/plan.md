

## Fix Video Freezing and Camera Following Wrong Creature

### Root Cause 1: Player Creature ID Gets Deleted (Main Bug)

In `readCreatureFull` (packetParser.ts, line 635-646), the protocol sends a "remove ID" (`rem`) and a "new ID" (`cid`). When a creature's ID changes (server reassigns IDs to manage its ID pool), the old creature is deleted:

```text
if (rem && rem !== cid) this.gs.creatures.delete(rem);
```

**Critical bug**: If `rem === g.playerId`, the player creature is completely removed from the creatures map, but `g.playerId` is never updated to `cid`. After this:
- `g.creatures.get(g.playerId)` returns `undefined`
- The renderer falls back to stale `g.camX/g.camY` coordinates
- The camera appears "stuck" or follows the wrong position
- The player sprite disappears because it's no longer in the creatures map

**Fix**: When `rem === g.playerId`, update `g.playerId = cid` before deleting the old entry.

### Root Cause 2: Floor Override Uses Wrong Z Source

In the animation loop (TibiarcPlayer.tsx, line 174), the floor override calculation uses `engine.gs.camZ`:

```text
const targetZ = Math.max(0, Math.min(15, engine.gs.camZ + floorOffsetVal));
```

But the renderer now derives camera Z from `player.z`, not `gs.camZ`. During floor transitions these can momentarily differ, causing the override to target the wrong floor.

**Fix**: When the player creature exists, use its Z coordinate for the floor override base.

### Files to Edit

**`src/lib/tibiaRelic/packetParser.ts`**
- In `readCreatureFull` (line 643): Before `this.gs.creatures.delete(rem)`, check if `rem === this.gs.playerId` and if so, update `this.gs.playerId = cid`.

**`src/components/TibiarcPlayer.tsx`**
- In the animation loop (line 172-178): Use the player creature's Z coordinate (when available) as the base for floor override calculation instead of `gs.camZ`.

### Expected Result
- Player creature ID is always tracked correctly even when the server reassigns IDs
- Camera never loses track of the player during extended playback
- Floor override stays synchronized with the player's actual floor
- Video continues playing normally through all sections without freezing

