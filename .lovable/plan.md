

## Analysis: Visual Bugs Without Parse Errors

### What the data shows

The debug log confirms **zero parse errors** — all frames end with `bytesLeft=0`. The protocol is being parsed correctly. However, there are **tons of `WALK_FAIL`** events where `tileLength=0` — meaning the JS parser can't find the creature on the expected source tile when a `moveCr` (0x6d) opcode arrives.

The screenshot shows **duplicate "Ashlord"** — a classic creature ghosting bug.

### Root cause

The issue is **not** in the JS debugger or the WASM player's parsing. It's a **tile state management** problem that affects both engines:

1. When `scroll` reads the full 18×14 area, `readTileItems` rebuilds tiles from scratch — correctly
2. But creatures on tiles **outside** the re-read viewport area retain stale `['cr', cid]` entries
3. When `moveCr` (0x6d) arrives for a creature at position `(33016, 32667, z=2)` but `camZ=3`, the creature's tile was never re-read on the current floor area — so `tileLength=0`
4. The `WALK_FAIL` means the creature reference is "lost" on the tiles but still exists in `gs.creatures` — creating a ghost

**The `z` mismatch is the smoking gun**: notice in the log that moves happen on `z=2` and `z=1` while `camZ=3`. The JS parser only reads tiles for the camera's floor range (z=7→0 on surface, or relative to camZ underground). Creatures on floors outside the rendered range don't get their tile entries maintained properly.

### What this means for the WASM C++ player

The C++ player likely has the **same issue** — creature state gets desynced from tile state during scrolls, causing duplicate renders. The fix needs to be in the C++ `moveCr` handler: when the source tile doesn't have the creature at `stackpos`, it should still find and move the creature by scanning all tiles or using the creature's stored position.

### Proposed fix (JS parser — will also serve as spec for C++ fix)

In `moveCr`, when `tileLength=0` or creature not found at stackpos, **use the creature map** to find any creature at `(fx, fy, fz)` by its stored position, not just by tile contents:

```typescript
// After fallback #2 fails, add:
// 3. Search creatures map for any creature at source position
if (cid === null) {
  for (const [id, cr] of this.gs.creatures) {
    if (cr.x === fx && cr.y === fy && cr.z === fz) {
      cid = id;
      fallback = 'creatures_map';
      break;
    }
  }
}
```

This handles the case where tiles were cleared/rebuilt by scroll but creatures still exist in the map with correct positions.

### Files to modify

| File | Change |
|------|--------|
| `src/lib/tibiaRelic/packetParser.ts` | Add creatures-map fallback in `moveCr` before the player-only fallback |
| `src/components/CamFrameDebugger.tsx` | Add WALK_FAIL count to stats bar for visibility |

