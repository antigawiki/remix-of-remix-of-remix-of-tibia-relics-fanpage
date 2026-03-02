

## Fix: Replicate JS Heuristic in C++ WASM Parser

### Root Cause

The JS-based parser (`packetParser.ts`) successfully handles TibiaRelic `.cam` files because it inspects the **first byte of each frame payload** to decide how to parse it:

- If `firstByte < 0x0A`: the payload starts with a **TCP u16 length prefix** -- it reads the length, then parses opcodes within the sub-packet boundaries
- Otherwise: the payload contains **direct opcodes** -- it parses them as-is

The C++ `load_recording_tibiarelic` function **always skips 2 bytes** assuming every frame has a TCP length prefix. This corrupts frames that contain direct opcodes, causing `memory access out of bounds`.

Additionally, the JS parser handles **multiple sub-packets per frame** in TCP mode (a loop reading u16 length + opcodes until the frame ends), while the C++ code only reads one sub-packet.

### Solution

Update `load_recording_tibiarelic` in `web_player.cpp` to replicate the JS heuristic:

```text
For each frame payload:
  1. Read the first byte
  2. If firstByte < 0x0A (not a valid Tibia opcode):
     - TCP demux mode: loop reading u16 length prefix + feeding sub-packets to Parser::Parse
  3. Else:
     - Direct mode: feed the entire payload to Parser::Parse as-is
```

### File Changes

**`tibiarc-player/web_player.cpp`** -- Replace the frame parsing loop (lines 214-228) with:

```cpp
// Replicate JS heuristic: check first byte to decide parsing mode
if (sz > 0) {
    try {
        uint8_t firstByte = buf[pos];
        
        if (firstByte < 0x0A && sz >= 2) {
            // TCP demux mode: loop through sub-packets
            int subPos = 0;
            while (subPos + 2 <= sz) {
                uint16_t subLen = read_u16_le(buf + pos + subPos);
                subPos += 2;
                if (subLen == 0) continue;
                if (subPos + subLen > sz) break;
                
                DataReader packetReader(subLen, buf + pos + subPos);
                auto events = parser.Parse(packetReader);
                if (!events.empty()) {
                    recording->Frames.emplace_back(timestamp, std::move(events));
                    parsedFrames++;
                }
                subPos += subLen;
            }
        } else {
            // Direct opcode mode: feed entire payload
            DataReader packetReader(sz, buf + pos);
            auto events = parser.Parse(packetReader);
            if (!events.empty()) {
                recording->Frames.emplace_back(timestamp, std::move(events));
                parsedFrames++;
            }
        }
    } catch (...) {
        // Skip unparseable frames
    }
}
```

This exactly mirrors the logic in `packetParser.ts` lines 182-244 that has been working correctly for the JS-based extractor.

### Why This Fixes the Crash

- Frames with direct opcodes (e.g., `0x64` mapDesc, `0x6a` addThing) are no longer corrupted by skipping their first 2 bytes
- TCP-wrapped frames are properly demuxed with the u16 length loop, handling multiple sub-packets per frame
- The `try/catch` around each frame ensures one bad frame doesn't crash the entire loading process

### After Implementation

The WASM needs to be **recompiled** via the GitHub Actions workflow after merging these changes.

