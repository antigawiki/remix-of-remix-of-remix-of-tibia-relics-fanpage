

## Real-Time Frame Debugger for .cam Player

### Idea

The WASM player is a black box (C++ binary), but we already have the full JS packet parser (`PacketParser`) and the .cam frame parser (`camParser`). The plan is to run the JS parser **in parallel** with the WASM player, feeding it the same frames at the same timestamps, and showing a rich real-time log of every opcode, action, and state change.

### How it works

1. **When a .cam file is loaded**, also parse it with `parseCamFile()` to get all frames with timestamps
2. **During playback**, the existing 100ms polling loop already reads `get_progress()` from WASM -- use that timestamp to find which frames the JS parser should process next
3. **Feed frames** to a `PacketParser` instance in sync with playback progress, logging every opcode via the existing `DebugLogger`
4. **Display** a new `CamFrameDebugger` panel below the player with:
   - Current game state snapshot (camX/Y/Z, playerX/Y/Z, creature count, floor sync status)
   - Scrolling event log with color-coded entries per opcode type
   - Human-readable descriptions: "Player moved to (x,y,z)", "Floor change UP 7→6", "New creature: Rat at (x,y)", "Scroll EAST", "mapDesc at (x,y,z) - 252 tiles"
   - Filters by event type
   - Export to text file
   - Pause-on-error toggle (freezes the log when a parse error occurs)

### Technical approach

**New file: `src/components/CamFrameDebugger.tsx`**
- Accepts `camBuffer: Uint8Array | null`, `progress: number`, `isPlaying: boolean`
- On mount with buffer: parses .cam with `parseCamFile()`, creates `GameState` + `DatLoader` + `PacketParser` + `DebugLogger`
- Tracks `lastProcessedFrame` index; on each tick, processes all frames between last position and current `progress`
- Enhanced logging: wraps `PacketParser.dispatch` calls to produce human-readable descriptions for key opcodes (0x64 mapDesc, 0x65-0x68 scroll, 0x6d moveCr, 0xbe/0xbf floorUp/Down, 0x9a playerPos)
- Shows parse errors inline with hex dump of the problematic frame

**Enhanced `DebugLogger`**
- Add new event types: `FRAME_START`, `FRAME_END`, `PARSE_ERROR`, `CREATURE_ADD`, `CREATURE_REMOVE`
- Add `description` field to `DebugEvent` for human-readable text

**Modifications to `TibiarcPlayer.tsx`**
- Pass `camBufferRef.current`, `progress`, and `state` down to the debugger component
- Toggle button to show/hide the debugger (off by default)

**Modifications to `CamPlayerPage.tsx`**
- Render the debugger panel below the player

### What you'll see in the log

```text
[0.00s] FRAME #0 (127 bytes)
[0.00s] LOGIN playerId=123456
[0.00s] MAP_DESC pos=(32000,32000,7) floors=7→0 bytesLeft=0
[0.12s] FRAME #1 (14 bytes)
[0.12s] MOVE_CR cid=123456 (32000,32000,7)→(32001,32000,7) dir=EAST
[0.24s] FRAME #2 (490 bytes)
[0.24s] SCROLL dx=1 dy=0 cam=(32002,32000,7)
[0.24s]   readMultiFloorArea 18×14 floors=7→0 bytesConsumed=485
[5.10s] FRAME #42 (312 bytes)
[5.10s] FLOOR_UP camZ: 7→6
[5.10s]   ⚠ PARSE_ERROR: BufOverflow at pos=287 (25 bytes remaining)
[5.10s]   HEX: 6a 00 7d 12 00 7d 07 00 61 ...
```

### Files to create/modify

| File | Action |
|------|--------|
| `src/components/CamFrameDebugger.tsx` | **Create** — main debugger component |
| `src/lib/tibiaRelic/debugLogger.ts` | **Modify** — add new event types and description field |
| `src/components/TibiarcPlayer.tsx` | **Modify** — expose camBuffer/progress/state, add toggle |
| `src/pages/CamPlayerPage.tsx` | **Modify** — render debugger |

