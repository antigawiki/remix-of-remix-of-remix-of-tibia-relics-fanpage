

## Fix Camera Freezing: Player Position Desync

### Root Cause (Critical)

The renderer derives the camera position from `player.x / player.y` (the player creature's stored coordinates), NOT from `gs.camX / gs.camY`:

```text
const renderCamX = player ? player.x : g.camX;   // line 183
const renderCamY = player ? player.y : g.camY;   // line 184
```

However, **multiple opcodes update `gs.camX/Y/Z` without updating the player creature's position**:

1. **Opcode 0x9a (Player Position / Cancel Walk)** -- Updates `gs.camX/Y/Z` only. This fires during teleports, cancel-walk corrections, and repositions.
2. **Opcodes 0x65-0x68 (Map Scroll)** -- Increment `gs.camX/Y` but never touch `player.x/y`. In the Tibia protocol, scroll packets fire when the player walks, alongside a `moveCr` packet that updates the creature. But if the `moveCr` parse fails (or is in a different frame), the camera stays stuck.
3. **Opcodes 0xbe/0xbf (Floor Up/Down)** -- Update `gs.camX/Y/Z` (including the diagonal offset `camX++/camY++`) but never update the player creature's floor or position.
4. **Opcode 0x64 (Full Map Description)** -- Updates `gs.camX/Y/Z`. The player creature IS in the tile data and gets repositioned via `readTileItems`, BUT if the tile read encounters a parse error and aborts, the player creature retains its old position while `gs.camX/Y/Z` has already jumped.

This means any time the camera position diverges from the player creature's stored position (which happens frequently during teleports, floor changes, or parse errors), the renderer shows a stale view -- the "frozen camera" the user sees.

### Solution: Sync Player Position After Camera Updates

Add a `syncPlayerToCamera()` helper method that updates the player creature's x/y/z to match `gs.camX/Y/Z`. Call it after every opcode that modifies camera coordinates.

This matches OTClient behavior where the "followed creature" position and camera position are always kept in sync by the protocol handler.

### Files to Edit

**`src/lib/tibiaRelic/packetParser.ts`**:

1. Add `syncPlayerToCamera()` method:
   - Gets the player creature from `gs.creatures.get(gs.playerId)`
   - Removes it from its old tile
   - Updates `player.x/y/z` to `gs.camX/Y/Z`
   - Places it on the new tile

2. Call `syncPlayerToCamera()` at the end of:
   - `mapDesc` (0x64) -- after reading all tile data
   - `scroll` (0x65-0x68) -- after successful map edge read
   - `floorUp` (0xbe) -- after camera position adjustment
   - `floorDown` (0xbf) -- after camera position adjustment
   - Opcode 0x9a handler -- after setting camX/Y/Z

### Why This Fixes the Freezing

The user's screenshots show: at timestamp ~58:00, the player's HP changes (combat is happening) but the view is stuck on an empty jungle. Meanwhile the real game (attachment 4) shows the player in a town with other players. This means:
- The server sent a teleport (mapDesc 0x64 or position update 0x9a) moving the player to the town
- `gs.camX/Y` was updated to the town coordinates
- But `player.x/y` stayed at the old jungle coordinates
- The renderer kept showing the jungle because it follows `player.x/y`
- HP updates (0x8c) still work because they reference creature ID, not position

After this fix, any camera update immediately repositions the player creature, so the renderer always shows the correct location.

### Expected Results
- Camera immediately follows teleports, floor changes, and walk corrections
- No more "frozen" view while HP bars change
- Smooth transitions between different map areas

