

## Simplify Cam Player: Remove Floor Controls and Spy Floor

### Overview
Strip the cam player down to essential playback controls only: play/pause, skip forward/back 10s, speed cycle (1x-8x), and the timeline seek bar. Remove all floor-related features and the reset button.

### Changes

**File: `src/components/TibiarcPlayer.tsx`**

1. **Remove unused imports**: `ChevronUp`, `ChevronDown`, `Layers`, `Eye`, `RotateCcw`, `Badge`, `Progress` (if no longer needed), and the map extraction imports/state
2. **Remove state variables**: `floorOffset`, `spyFloor`, `qualityMode`, `extracting`, `extractProgress`, and their corresponding refs (`floorOffsetRef`, `spyFloorRef`, `qualityModeRef`)
3. **Remove `useEffect` syncs** for `floorOffset`, `spyFloor`, `qualityMode` refs
4. **Simplify animation loop** (lines 186-199): Remove the `floorOverride` logic and `spyFloor` assignment. Set `renderer.floorOverride = null` always and `renderer.spyFloor = false` always
5. **Remove `resetPlayback` function** (lines 335-356)
6. **Remove `handleExtractMap` function** (lines 426-472)
7. **Remove floor control UI** (lines 632-693): The entire floor controls section with ChevronUp/Down, Layers icon, Eye button, and floor Badge
8. **Remove reset button** (lines 591-599)
9. **Remove quality toggle button** (lines 697-709)
10. **Remove extract map button** and extract progress bar (lines 721-738)
11. **Remove `CamDebugPanel`** import and rendering (line 752)

**File: `src/lib/tibiaRelic/renderer.ts`**

12. **Remove `spyFloor` property** and its usage in `getVisibleFloors` (lines 454-458) and in the xray alpha logic (lines 246-249)
13. **Remove `floorOverride` property** usage -- the renderer will always use `renderCamZ` directly (line 205: remove `this.floorOverride ??` prefix)
14. **Remove floor desync warning** (lines 194-204) since floor override is gone and the diagnostic is no longer relevant

### Result
The player will have a clean, minimal UI:
- Play/Pause button
- Skip Back 10s / Skip Forward 10s buttons
- Speed cycle button (1x, 2x, 4x, 8x)
- Timeline seek slider with timestamps
- "Load another .cam" button
- Status text

Floor rendering will always follow `g.camZ` from the protocol with no manual override, which should also reduce the floor transition bugs since there's no competing floor logic.

