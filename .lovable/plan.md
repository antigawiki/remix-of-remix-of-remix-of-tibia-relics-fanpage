

## Fix: Camera Offset and Floor Transition Bugs (3 Critical Fixes)

The previous fixes were not applied — the bugs are still in the current code. Here are the 3 exact changes needed:

### Fix 1: Surface floors get wrong tile offset (`readMultiFloorArea`, line 1083)

**Current**: `const offset = camZ - nz;`
**Fix**: `const offset = camZ > 7 ? (camZ - nz) : 0;`

When camZ=4 (surface), the current code calculates offset=-3 for floor 7, placing every tile 3 positions northwest of where it belongs. On surface, all floors should have offset=0 — the underground perspective system only applies when camZ > 7.

### Fix 2: `floorUp` drifts camera on surface transitions (line 846)

**Current**: `g.camX++; g.camY++;` (unconditional)
**Fix**: Only apply when `g.camZ >= 7` (underground or transitioning to surface)

Surface-to-surface floor changes (e.g., z=4→z=3) should NOT adjust camX/Y. The perspective offset only exists underground.

### Fix 3: `floorDown` drifts camera on surface transitions (line 875)

**Current**: `g.camX--; g.camY--;` (unconditional)
**Fix**: Only apply when `g.camZ > 7` (underground)

Same issue as Fix 2 in reverse.

### Files Changed

| File | Line | Change |
|------|------|--------|
| `src/lib/tibiaRelic/packetParser.ts` | 1083 | offset = 0 for surface floors |
| `src/lib/tibiaRelic/packetParser.ts` | 846 | conditional camX++/camY++ |
| `src/lib/tibiaRelic/packetParser.ts` | 875 | conditional camX--/camY-- |

These are JS-only changes — no WASM rebuild needed. The C++ player uses tibiarc's own parser which handles this correctly.

