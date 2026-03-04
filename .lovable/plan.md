

## Plan: Fix scroll() dimensions in packetParser.ts

### Problem
The `scroll()` function reads only a single column (1×14) or row (18×1) per scroll direction, but the server sends the full 18×14 tile area with skip encoding. The skip encoding compresses empty tiles, so `readMultiFloorArea(18, 14)` correctly handles both standard scrolls (14 explicit tiles + big skip) and full-screen refreshes (all tiles explicit). Reading only 1×14 leaves hundreds of bytes unconsumed, corrupting subsequent opcodes.

### What was already correct
- `scroll()` already uses `getMapDescFloorRange` (7→0 on surface) -- line 542
- `scroll()` already uses `readMultiFloorArea` -- just with wrong dimensions

### Fix (single change in `packetParser.ts`, lines 544-548)
Change all four scroll directions from narrow reads to full 18×14:

```typescript
// Before:
if (dx === 1) this.readMultiFloorArea(r, g.camX + 9, g.camY - 6, 1, 14, ...);
else if (dx === -1) this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 1, 14, ...);
else if (dy === 1) this.readMultiFloorArea(r, g.camX - 8, g.camY + 7, 18, 1, ...);
else if (dy === -1) this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 1, ...);

// After (all use 18×14, same origin as mapDesc):
if (dx === 1) this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, ...);
else if (dx === -1) this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, ...);
else if (dy === 1) this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, ...);
else if (dy === -1) this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 14, ...);
```

The origin is always `camX-8, camY-6` (viewport top-left) because `readMultiFloorArea` reads the full viewport area -- the skip encoding handles which tiles actually have data.

### About reverting
The user also asked to revert recent changes. I'll check what was recently changed and revert anything that broke the player before applying this fix.

