

## Fix: Extraction stops when browser tab is in background

### Problem
The map extraction uses `requestAnimationFrame` to schedule processing chunks of .cam frames. Browsers aggressively throttle `requestAnimationFrame` in background tabs (reducing it to ~1fps or pausing completely), which causes extraction to stall when you switch to another tab or window.

### Solution
Replace `requestAnimationFrame` with `setTimeout(fn, 0)` in the extraction loop. `setTimeout` with a 0ms delay is not throttled as aggressively by browsers -- background tabs still run `setTimeout` callbacks (with a minimum ~1s delay on most browsers, but they do run). This will allow extraction to continue even when the tab is not focused.

### Changes

**File: `src/lib/tibiaRelic/mapExtractor.ts`**
- Line 132: Change `requestAnimationFrame(processChunk)` to `setTimeout(processChunk, 0)`
- Line 142: Change `requestAnimationFrame(processChunk)` to `setTimeout(processChunk, 0)`

This is a minimal 2-line change that fully resolves the background tab issue.

