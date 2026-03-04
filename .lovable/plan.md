

## Diagnosis: The TCP Demux Heuristic is the Shared Root Cause

You're absolutely right — if both players produce the same corruption, the bug is shared. After deep analysis, I found what both parsers share: **the `firstByte < 0x0A` TCP demux heuristic**. It's literally the same logic in both the JS `packetParser.ts` (line 256) and the C++ `web_player.cpp` (line 280).

### Why This Heuristic is Broken

The `.cam` file frames contain raw server TCP packets. Each server packet starts with `[u16 length][opcodes...]`. The u16 length is little-endian, so the first byte is the LOW byte of the packet length.

```text
Example: a 100-byte packet
  TCP bytes: [0x64, 0x00] [opcode_data...]
  First byte = 0x64 = MAP_DESC opcode!
  
  Heuristic says: "0x64 >= 0x0A → direct opcode mode"
  Parser reads 0x64 as MAP_DESC → reads pos3 from [0x00, ...] → GARBAGE positions
  → Tiles written to wrong coordinates → State permanently corrupted
```

This happens whenever the TCP packet length's low byte happens to match a valid opcode (0x0A, 0x64-0x68, 0x82, 0x9A, 0xAA, etc.). Most packet sizes would trigger this — it's NOT rare.

The reason we see "0 parse errors" in the debugger: the garbage data often happens to form sequences that don't cause buffer overflows (they just write wrong tiles to wrong positions silently).

### Plan: Fix the Frame Parsing, Not the Protocol Parser

**Step 1: Add frame-level diagnostics to CamFrameDebugger**

Add logging of each frame's first 4 bytes (hex) and which parsing mode was chosen (TCP vs direct). This will immediately show whether the format always uses TCP wrapping or not.

**Step 2: Remove the heuristic — always use TCP demux**

Since the `.cam` recorder likely captures raw server TCP data (like tibianic-dll does), every frame payload should start with a `u16 length` prefix. Change both JS and C++ to ALWAYS use TCP demux mode:

```text
JS:  process() → always call processTcpDemux()
C++: load_recording_tibiarelic() → always use TCP sub-packet loop
```

If this doesn't work, try the opposite: always treat as direct opcodes (meaning the recorder already stripped TCP lengths).

**Step 3: Update the C++ web_player.cpp** with the same fix

**Step 4: Rebuild WASM** with the corrected frame parsing

### Why Previous Patches Failed

All our patches targeted the C++ protocol parser (scroll dimensions, floor ranges, opcode sizes). But if the frame-level TCP demux is wrong, those protocol fixes never even get a chance to run on the correct byte stream — the data is already misaligned before any opcode is dispatched.

### Files to Change

| File | Change |
|------|--------|
| `src/lib/tibiaRelic/packetParser.ts` | Remove `firstByte < 0x0A` heuristic, try always-TCP and always-direct modes |
| `src/components/CamFrameDebugger.tsx` | Add first-bytes hex dump per frame for diagnosis |
| `tibiarc-player/web_player.cpp` | Mirror the TCP demux fix in C++ |

