

## Cam Player: Switch to TibiaRC WASM + Cam Map: Web Worker for Background Extraction

### The Root Problem with the Player

The current cam player uses a **custom JavaScript packet parser** that manually interprets every byte of the Tibia 7.72 protocol. This approach is inherently fragile:

- **Byte drift**: A single unknown opcode or misinterpreted payload causes all subsequent packets to parse incorrectly, leading to desync (player freezes while the world keeps moving).
- **Floor transitions**: The protocol uses perspective offsets during floor changes that are extremely hard to replicate correctly in JS -- this is why tiles from other floors keep appearing.
- **Performance**: Every frame creates/modifies JS objects, triggers garbage collection, and relies on `performance.now()` for walk animations. At higher speeds (4x, 8x), frames pile up faster than the parser can process.

### How TibiaRC Does It

TibiaRC already has a **complete, battle-tested C++ implementation** compiled to WASM (`tibiarc_player.js` + `tibiarc_player.wasm`) that is already in the project! It:

- Uses the official tibiarc library with full protocol support (no byte drift, no floor bugs)
- Renders via SDL2/Emscripten directly to a canvas
- Has built-in play/pause, speed control, and seek functionality
- Handles all floor transitions, creature movement, and animations natively

The WASM player exposes these JS functions: `load_data_files()`, `load_recording()`, `play()`, `pause_playback()`, `set_speed()`, `seek()`, `get_progress()`, `get_duration()`, `is_playing()`.

### Plan

#### Part 1: Replace JS Player with TibiaRC WASM Player

**File: `src/components/TibiarcPlayer.tsx`** -- Full rewrite

Strip out all the custom JS engine (GameState, PacketParser, Renderer, DebugLogger, keyframes, snapshot system) and replace with a thin wrapper around the WASM module:

1. On mount, load the WASM module and call `load_data_files()` with Tibia.pic, Tibia.spr, Tibia.dat
2. When user loads a .cam file, pass the raw bytes to `load_recording()` (which returns duration in ms, or -1 if version detection fails)
3. Play/Pause calls `play()` / `pause_playback()`
4. Speed control calls `set_speed(n)`
5. Seek calls `seek(ms)`
6. A polling interval reads `get_progress()` to update the seek bar
7. The WASM renders directly to a canvas element via SDL2/Emscripten -- our code just sizes the canvas

The UI stays identical: Play/Pause, Skip +/-10s, Speed cycle (1x-8x), timeline seek bar.

**Removed files/imports** (no longer needed for the player):
- No more imports of `packetParser`, `gameState`, `renderer`, `debugLogger`, `camParser`, `sprLoader`, `datLoader`
- No more `engineRef` with keyframes, snapshots, animation loop
- No more `requestAnimationFrame` loop -- WASM has its own `emscripten_set_main_loop`

#### Part 2: Web Worker for Background Cam Map Extraction

**Problem**: `setTimeout(..., 0)` gets throttled to 1s+ intervals when the browser tab is in background, making extraction freeze.

**Solution**: Move the extraction processing into a **Web Worker** that runs independently of the main thread.

**New file: `src/lib/tibiaRelic/extractionWorker.ts`**

A dedicated Web Worker that:
1. Receives the .cam file buffer + .dat file buffer via `postMessage`
2. Runs `extractMapTiles()` internally (the worker has its own event loop, unaffected by tab visibility)
3. Posts progress updates back to the main thread
4. Posts the final result (tiles + spawns) back when done

**File: `src/lib/tibiaRelic/mapExtractor.ts`** -- Minor change

Replace `setTimeout(processChunk, 0)` with synchronous processing inside the worker (no need for yielding since it's off the main thread). The worker processes all frames in a tight loop, posting progress every N frames.

**File: `src/pages/CamBatchExtractPage.tsx`** -- Update to use Worker

Instead of calling `extractMapTiles()` directly, create a Worker instance and communicate via messages:
```
worker.postMessage({ camBuffer, datBuffer })
worker.onmessage = (e) => { /* progress or result */ }
```

### Summary of Benefits

| Issue | Current | After |
|-------|---------|-------|
| Player desync | Frequent (JS byte drift) | None (native C++ parser) |
| Floor transitions | Buggy (perspective offset errors) | Correct (tibiarc handles natively) |
| Walk animations | Sometimes freeze | Smooth (native tick system) |
| Background extraction | Stops when tab hidden | Continues (Web Worker) |
| Code complexity | ~2000 lines of custom parser+renderer | ~150 lines WASM wrapper |

### Technical Notes

- The WASM player uses SDL2 rendered to an Emscripten canvas. We need to ensure the canvas element ID matches what Emscripten expects (typically `#canvas` or configured via `Module.canvas`).
- The `load_recording_with_version` function accepts manual version override (7, 72, 0 for TibiaRelic).
- Web Workers cannot access DOM, so all Supabase uploads remain on the main thread -- only the CPU-intensive extraction moves to the worker.
- The existing `.cam` parser and game state modules remain in the codebase since the map extractor still needs them.

