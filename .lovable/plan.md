

## Fix: Game scene not filling full canvas

### Problem
In `web_player.cpp`, the `RenderFrame()` function renders the game world (tiles, creatures) at **640x352** pixels (RENDER_HEIGHT - 128), reserving 128px for the original Tibia client's bottom panel (inventory, hotkeys, etc.). However, since we're a standalone player without a client UI, this creates a gap -- the game scene appears "shrunk" while text overlays (names, messages) are positioned correctly on the full 640x480 canvas.

### Fix
Change `RenderFrame()` to use the full canvas height for the game scene, removing the `-128` offset since we don't render the Tibia client bottom panel.

### Changes

**`tibiarc-player/web_player.cpp`** (lines 355-374)

Replace the render logic to use full height:

```cpp
static void RenderFrame() {
    if (!g_gamestate || !g_recording) return;

    Renderer::Options options{
        .Width = RENDER_WIDTH,
        .Height = RENDER_HEIGHT    // Was: RENDER_HEIGHT - 128
    };

    Canvas mapCanvas(RENDER_WIDTH, RENDER_HEIGHT);  // Was: RENDER_HEIGHT - 128
    mapCanvas.DrawRectangle(Pixel(0, 0, 0), 0, 0,
                            RENDER_WIDTH, RENDER_HEIGHT);  // Was: RENDER_HEIGHT - 128

    Renderer::DrawGamestate(options, *g_gamestate, mapCanvas);

    Canvas outputCanvas(RENDER_WIDTH, RENDER_HEIGHT);
    // Skip DrawClientBackground - not needed for standalone player

    for (int y = 0; y < RENDER_HEIGHT; y++) {
        for (int x = 0; x < RENDER_WIDTH; x++) {
            outputCanvas.GetPixel(x, y) = mapCanvas.GetPixel(x, y);
        }
    }

    Renderer::DrawOverlay(options, *g_gamestate, outputCanvas);

    SDL_UpdateTexture(g_texture, nullptr, outputCanvas.Buffer, outputCanvas.Stride);
    SDL_RenderClear(g_renderer);
    SDL_RenderCopy(g_renderer, g_texture, nullptr, nullptr);
    SDL_RenderPresent(g_renderer);
}
```

Key changes:
1. `RENDER_HEIGHT - 128` becomes `RENDER_HEIGHT` (3 occurrences)
2. Remove `DrawClientBackground` call (it draws the Tibia client chrome which we don't need)

### After code change
You'll need to re-run the **Build WASM Player** GitHub Actions workflow to compile the updated `web_player.cpp` into new `.js` and `.wasm` files, then upload them back to the project.

