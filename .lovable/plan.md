

## Fix: Correct WASM Resolution and Display Quality

### Root Cause Analysis (from tibiarc source code)

The tibiarc renderer has two separate rendering passes with **different coordinate systems**:

1. **`DrawGamestate`** -- Renders tiles, creatures, effects at **fixed 32px-per-tile** positions. The game world ALWAYS occupies a 480x352 pixel area (15x11 tiles), regardless of canvas size.

2. **`DrawOverlay`** -- Renders creature names, health bars, messages. It calculates scale factors:
   ```
   scaleX = canvas.Width / 480.0
   scaleY = canvas.Height / 352.0
   ```
   All text positions are multiplied by these scale factors.

**This means**: If the canvas is 480x352, scale = 1.0 and everything aligns perfectly. If the canvas is ANY other size (like 640x480), the game world stays in 480x352 while text gets repositioned to 640x480 coordinates -- causing the desync you see.

### The Problem with v8 WASM

The compiled WASM binary (v8) may not have been built with our 480x352 changes. If it still uses 640x480 internally, the SDL texture and window are created at 640x480, but our HTML canvas is set to 480x352 -- causing a mismatch that produces both visual artifacts and quality loss.

### Solution

**1. Verify and fix `web_player.cpp`** -- Constants MUST be 480x352 (matching tibiarc's `NativeResolutionX/Y`):
```cpp
static const int RENDER_WIDTH = 480;
static const int RENDER_HEIGHT = 352;
```
This is already correct in our source. The WASM just needs to be recompiled from this source.

**2. Update `TibiarcPlayer.tsx`** -- Improve display quality:
- Keep canvas at 480x352 (native WASM resolution)
- Change `imageRendering` from `'pixelated'` to `'auto'` for smoother upscaling (the TibiaRelic client uses smooth filtering, not nearest-neighbor)
- Alternatively, use a larger CSS display with `image-rendering: auto` for bilinear filtering

**3. Recompile WASM** -- The v8 binary must be rebuilt from the current `web_player.cpp` that has 480x352 constants.

### File Changes

**`src/components/TibiarcPlayer.tsx`**
- Change `imageRendering: 'pixelated'` to `imageRendering: 'auto'` for smoother upscaling that matches TibiaRelic's visual quality
- Keep canvas dimensions at `width={480} height={352}` (must match WASM constants)

### After Code Change

You MUST recompile the WASM using the GitHub Actions workflow to ensure the binary uses 480x352 internally. The current v8 binary may still be using 640x480, which is the primary cause of both the quality loss and the misalignment.

