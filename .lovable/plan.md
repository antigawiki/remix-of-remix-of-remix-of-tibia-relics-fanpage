

## Diagnosis

The tibiarc C++ renderer (`renderer.cpp`, ~2300 lines) has **zero lighting implementation**. There is no light map, no ambient light blending, no per-tile or per-creature light calculation. The parser reads the light opcodes (0x82 world light, 0x8D creature light) but discards the values entirely -- the `Gamestate` struct has no fields for ambient light level/color, and the `Renderer::Options` struct has no skip flag for lighting because lighting was never implemented.

This means the WASM player always renders at full brightness, whether the character is on the surface at daytime or deep inside a dark cave.

## Solution: Post-Processing Light Overlay in web_player.cpp

Since modifying the tibiarc library's core renderer would require extensive C++ changes to the fork and a complex per-tile light map system, a much simpler approach works perfectly for the visual effect:

**Apply a dark overlay on the output canvas after rendering, based on the ambient light level stored in the gamestate.**

### How It Works

1. **Store ambient light data** -- Add two global variables in `web_player.cpp` to capture the world light level and color from opcode 0x82. The tibiarc parser already calls `ParseAmbientLight` which updates internal gamestate fields. We hook into the gamestate's known ambient light after each frame.

2. **Post-process the canvas** -- After `Renderer::DrawGamestate` and `Renderer::DrawOverlay`, iterate over all pixels in the output canvas and darken them proportionally to how far the ambient light level is from maximum (255). This is the same approach the real Tibia client uses: a multiplicative blend.

3. **Expose a JS toggle** -- Add an exported `set_lighting(int enabled)` function so the UI can toggle lighting on/off. Default: enabled.

### Implementation Details

**In `web_player.cpp`:**

```cpp
// New globals
static bool g_lighting_enabled = true;

// New exported function
EMSCRIPTEN_KEEPALIVE
void set_lighting(int enabled) {
    g_lighting_enabled = (enabled != 0);
}

// In RenderFrame(), after DrawOverlay:
if (g_lighting_enabled) {
    // Read ambient light from gamestate
    // tibiarc stores it internally; we access it via the
    // gamestate's known ambient light fields
    uint8_t ambientLevel = g_gamestate->AmbientLight.Level;
    
    if (ambientLevel < 255) {
        float factor = ambientLevel / 255.0f;
        uint8_t* buf = g_outputCanvas->Buffer;
        int total = RENDER_WIDTH * RENDER_HEIGHT * 4; // ABGR8888
        for (int i = 0; i < total; i += 4) {
            buf[i]   = (uint8_t)(buf[i]   * factor); // R/B
            buf[i+1] = (uint8_t)(buf[i+1] * factor); // G
            buf[i+2] = (uint8_t)(buf[i+2] * factor); // B/R
            // buf[i+3] = alpha, keep as-is
        }
    }
}
```

**Problem**: The `Gamestate` struct in tibiarc doesn't expose `AmbientLight` as a public field -- the parser processes it but there's no clear public accessor. We need to verify the exact field name.

### Alternative (Safer): JavaScript Canvas Post-Processing

Instead of modifying the C++ binary (which requires recompiling WASM), we can apply the lighting effect in JavaScript by:

1. **Store light level from opcode 0x82** in the existing JS packet parser (already parsed but discarded)
2. **Apply a CSS overlay or canvas compositing** on top of the WASM canvas element after each frame

This approach:
- Requires no WASM recompilation
- Uses the existing `TibiarcPlayer.tsx` component
- Applies a dark semi-transparent overlay synced to the light level from the .cam data

### Recommended: Hybrid Approach

1. **Parse and store light level in JS** -- Modify `packetParser.ts` to store the 0x82 world light values in `GameState` (currently discarded with `r.u8(); r.u8();`)
2. **Create a `CamLightOverlay` component** -- A canvas or div overlay positioned over the WASM player canvas that applies darkness based on the ambient light level
3. **Sync via shared state** -- The packet parser (which runs during Protocol Lab / Analyzer) already processes the same .cam data. We can extract the light timeline during initial parse and feed it to the overlay

### Concrete Plan

**Step 1**: Add `ambientLightLevel` and `ambientLightColor` fields to `GameState` in `gameState.ts`

**Step 2**: Update `packetParser.ts` opcode 0x82 handler to store the values instead of discarding:
```typescript
// Before: r.u8(); r.u8();
// After:
g.ambientLightLevel = r.u8();  // 0=full dark, 255=full bright
g.ambientLightColor = r.u8();
```

**Step 3**: During .cam loading in `TibiarcPlayer.tsx`, run the JS parser over all frames to build a **light timeline** (array of `{timestamp, level, color}`). This is lightweight since we only need opcode 0x82 events.

**Step 4**: In the playback loop, apply a CSS `background-color: rgba(0,0,0, darkness)` overlay div on top of the WASM canvas, where `darkness = 1 - (level / 255)`. Update it on each `requestAnimationFrame` based on current playback position.

**Step 5**: Add a toggle button in the player UI to enable/disable the lighting overlay.

### Files to Modify
- `src/lib/tibiaRelic/gameState.ts` -- Add ambient light fields
- `src/lib/tibiaRelic/packetParser.ts` -- Store opcode 0x82 data
- `src/components/TibiarcPlayer.tsx` -- Add light timeline extraction, overlay div, and toggle button

