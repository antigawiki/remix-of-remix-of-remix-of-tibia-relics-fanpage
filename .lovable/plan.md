

## FloorDown z==7 Fix + Robust Sanitization

Based on Claude's analysis, the root cause of corruption at ~59:17 is clear: opcode 0xBF (FloorChangeDown) at z=7 sends 3 floors of tile data (~3848 bytes), but the parser reads only 1 floor, leaving ~2600 bytes that corrupt everything after.

### Changes

**1. Create `tibiarc-player/floor_down_patch.py`**
Python script that patches `ParseFloorChangeDown` in `lib/parser.cpp`:
- When `Position_.Z == 8` (player was at z=7, surface → cave): read **3 floors** (z=8, 9, 10)
- When `Position_.Z > 8` (already underground): read **1 floor** (as before)
- Uses regex to find the function and wrap the `ParseFloorDescription` call in a conditional loop

**2. Update `.github/workflows/build-tibiarc.yml`**
- Remove the "FLOORDOWN patch REMOVED" comment (lines 141-143)
- Add step to copy and execute `floor_down_patch.py` on `lib/parser.cpp`
- Add FloorDown verification to the verification section

**3. Update `tibiarc-player/web_player.cpp` — Enhanced SanitizeCreatureState**
More aggressive cleanup on floor changes:
- On surface↔underground transitions (crossing z=7/8 boundary), purge **ALL** non-player creatures (not just old-floor ones)
- This handles the case where corrupted parsing left creatures with wrong positions before the patch takes effect

**4. Update `.lovable/plan.md`** with FloorDown fix documentation

### After changes
Run the GitHub Actions workflow "Build tibiarc WASM Player" to compile new WASM.

