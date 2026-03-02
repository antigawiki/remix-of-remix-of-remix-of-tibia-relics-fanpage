

## Fix: Use native Tibia 7.72 viewport resolution (480x352)

### Problem
The tibiarc renderer internally uses the Tibia 7.72 game viewport size: **15 tiles wide x 11 tiles tall x 32px = 480x352 pixels**. The current code passes 640x480 to both `DrawGamestate` and `DrawOverlay`, causing:

1. **Visual desync** -- The game world renders at 480x352 (tile viewport limit), but text overlays (creature names, messages) are positioned based on 640x480 coordinates, so they appear offset from their actual positions.
2. **Stutters** -- Every frame copies 307,200 pixels instead of 168,960 (1.8x overhead), plus the renderer may attempt to fill unused canvas area.

### Solution
Change `RENDER_WIDTH` and `RENDER_HEIGHT` to the native resolution (480x352). The CSS `w-full h-full` on the canvas already scales it to fill the container, so it will still display at full size with crisp pixel scaling.

### Changes

**1. `tibiarc-player/web_player.cpp`**

Change the resolution constants (line 46-47):
```cpp
static const int RENDER_WIDTH = 480;   // Was: 640
static const int RENDER_HEIGHT = 352;  // Was: 480
```

No other changes needed in the C++ -- all uses of `RENDER_WIDTH`/`RENDER_HEIGHT` (canvas creation, texture, render loop) will automatically pick up the correct values.

**2. `src/components/TibiarcPlayer.tsx`**

Update the HTML canvas dimensions and aspect ratio to match (lines 272-283):
- Change `aspect-[4/3]` to `aspect-[480/352]` (or approximately `aspect-[15/11]`)
- Change `<canvas width={640} height={480}>` to `<canvas width={480} height={352}>`
- Set `imageRendering: 'pixelated'` for crisp upscaling of pixel art

### Why this fixes both issues
- Game tiles and text overlays will both use the same 480x352 coordinate space -- no more desync
- 45% fewer pixels to process per frame -- eliminates stutters
- Pixel-perfect rendering matching the original Tibia 7.72 client viewport

### After code changes
You will need to re-run the **Build WASM Player** GitHub Actions workflow to compile the updated C++ into new `.js` and `.wasm` files.

