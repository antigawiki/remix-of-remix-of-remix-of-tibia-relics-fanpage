

## Diagnosis

The visual cam player uses a **precompiled C++ WASM binary** (`tibiarc_player.wasm`) with its own protocol parser that has hardcoded bugs for TibiaRelic's custom protocol. All your TypeScript fixes in `packetParser.ts` only affect the Protocol Lab and Cam Analyzer -- they never reach the visual player.

The patch approach (modifying C++ source via `.patch` files in CI) is fragile and hasn't successfully produced a corrected WASM binary yet.

## Solution: Pure JS Cam Player

You already have **100% of the infrastructure** needed to render .cam files without WASM:

- `camParser.ts` -- parses .cam file format (header + frames)
- `packetParser.ts` -- decodes Tibia protocol packets (with all TibiaRelic fixes)
- `gameState.ts` -- tracks tiles, creatures, camera, effects
- `renderer.ts` -- full Canvas2D renderer (847 lines: multi-floor, outfits, effects, projectiles, animated text, HUD)
- `sprLoader.ts` + `datLoader.ts` -- sprite/data file loaders

The WASM binary duplicates all of this in C++ but without the protocol fixes. **Replace the WASM player with a pure JS player** that chains: `camParser` → `packetParser` → `gameState` → `renderer`.

## Implementation Plan

### 1. Create `JsCamPlayer` component (~250 lines)

New component `src/components/JsCamPlayer.tsx` that:

- On mount: loads `Tibia.dat`, `Tibia.spr`, `Tibia.pic` (pic not needed for JS renderer -- only dat + spr)
- On file upload: calls `parseCamFile(data)` to get frames
- Playback loop via `requestAnimationFrame`:
  - Advances `currentTick` based on elapsed time and speed
  - Feeds frames whose `timestamp <= currentTick` into `packetParser.process(frame.payload)`
  - Calls `renderer.draw(canvasWidth, canvasHeight)` to render the current game state
- Controls: play/pause, speed cycle (1x/2x/4x/8x), seek slider, overlay toggle
- Seek: resets `GameState`, replays all frames up to target timestamp with `parser.seekMode = true` (suppresses walk animations during fast-forward)

### 2. Wire into existing page

Replace the `<TibiarcPlayer>` import in `CamPlayerPage.tsx` (or wherever it's used) with `<JsCamPlayer>`.

### 3. Keep WASM as fallback (optional)

The old `TibiarcPlayer.tsx` can remain in the codebase but won't be the default. This gives a fallback if needed.

## Key Architecture

```text
User uploads .cam
       │
       ▼
  camParser.ts        → CamFrame[] (timestamp + payload)
       │
       ▼
  packetParser.ts     → Updates GameState (tiles, creatures, camera)
       │                 (all TibiaRelic protocol fixes applied here)
       ▼
  renderer.ts         → Draws to Canvas2D (480x352 native, upscaled)
       │
       ▼
  <canvas> element    → User sees the game
```

### Seek Implementation

Seeking backwards requires replaying from frame 0. To make this fast:
- Store periodic **snapshots** every ~500 frames using `gameState.snapshot()`
- On seek, find nearest snapshot before target, restore it, then replay remaining frames
- During replay, set `parser.seekMode = true` to skip walk animations and effects

### What This Fixes

Since the JS parser already handles:
- TibiaRelic protocol divergences (0xA4, 0xA7, 0xB6, 0xA8 payloads)
- Correct floor ranges for scrolls vs mapDesc
- Creature deduplication (`dedupCreaturesOnTiles`)
- CR_OLD marker handling inside `addThing`
- TCP demux + direct opcode detection

All the visual bugs (duplicated creatures, wrong floor, frozen animations) should be eliminated because the **same parser that works correctly in Protocol Lab** will now drive the visual output.

