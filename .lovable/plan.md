

## Diagnosis: Black Squares and Desync in WASM Player

The screenshots show **real rendering bugs** in the WASM engine — black squares (image 264) and misaligned tiles. The JS Packet Dissector shows 0 errors because it already has the correct parsing logic. The WASM engine (C++) does NOT.

### Root Cause: Scrolls Read Strips Instead of Full Viewport

The critical divergence is in the **scroll opcodes (0x65-0x68)**:

```text
JS parser (correct):     scroll() → readMultiFloorArea(18x14, all floors)
C++ engine (BROKEN):     ParseMoveNorth() → reads strip (18x1 or 1x14, single floor)
```

TibiaRelic sends the **full 18x14 multi-floor viewport** for every scroll, but the tibiarc C++ fork reads only a 1-tile-wide strip. This leaves **hundreds of bytes unconsumed per scroll**, which corrupt all subsequent opcode parsing — causing cascading black squares, misaligned creatures, and visual glitches.

The workflow comment `"The fork's scrolls already use the correct standard dimensions"` is **wrong** — that's correct for vanilla Tibia but not for TibiaRelic's custom protocol.

### Plan

**1. Create `tibiarc-player/scroll_patch.py`**

Python script to patch `lib/parser.cpp`, replacing the body of `ParseMoveNorth`, `ParseMoveEast`, `ParseMoveSouth`, `ParseMoveWest` to:
- Adjust `Position_` (camera) by ±1
- Call `ParseFullMapDescription` (or the equivalent multi-floor read with 18x14 and all floors)
- This mirrors exactly what the JS parser does in `scroll()`

The patch needs to handle the fork's specific function signatures and the `Position_` state management.

**2. Update `.github/workflows/build-tibiarc.yml`**

- Add `python3 $GITHUB_WORKSPACE/tibiarc-player/scroll_patch.py lib/parser.cpp` in the patches section
- Remove the incorrect comment about scrolls being correct
- Add verification grep

**3. Fix Packet Dissector false positives (secondary)**

Update `protocolDissector.ts` and `PacketDissector.tsx` to not flag expected camera changes (MAP_DESC, SCROLL, FLOOR_UP/DOWN, PLAYER_POS) as anomalies. This is a minor UI fix — the real fix is the WASM scroll patch above.

### Expected Result

After rebuilding the WASM with the scroll patch:
- No more black squares during horizontal movement
- Creatures stay aligned with tiles
- Scroll transitions consume the correct number of bytes
- The dissector will show 0 real errors

