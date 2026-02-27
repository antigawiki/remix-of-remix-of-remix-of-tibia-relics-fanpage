

## Fix Camera Desync + Creature Name Rendering

### Issue 1: Camera Desyncing from Player

**Root Cause**: The renderer uses `g.camX / g.camY` to center the viewport. These values are set by protocol packets (`mapDesc`, `scroll`, `floorUp/Down`). However, in certain situations (floor transitions, teleports, being pushed), the protocol may move the player creature via `moveCr` or `mapDesc` without perfectly synchronizing `camX/camY` with the player creature's actual stored position. The result is the camera pointing at the wrong location while the player sprite stays at its real coordinates.

**OTClient Approach**: OTClient uses a "followed creature" concept. The viewport is ALWAYS centered on the followed creature's actual position, not on a separate camera variable. This is inherently self-correcting.

**Fix**: In the renderer's `draw()` method, derive the render camera from the player creature's actual stored position (if available) instead of `g.camX/g.camY`. This way even if protocol packets desync `camX/camY`, the viewport will always show the player centered.

```text
// Instead of:
const z = this.floorOverride ?? g.camZ;
// And using g.camX, g.camY everywhere

// Use:
const renderCamX = player ? player.x : g.camX;
const renderCamY = player ? player.y : g.camY;
const renderCamZ = player ? player.z : g.camZ;
```

This only affects rendering -- `g.camX/camY/camZ` remain untouched for protocol parsing purposes.

### Issue 2: Creature Name Size and Position

**Current Problem**: Names are drawn at font size `tileW / 4` which scales proportionally with canvas size but doesn't match original Tibia. The health bar width also scales oddly (`min(hudW-2, tileW*2)`). Names are truncated to 16 chars.

**OTClient/Original Tibia Approach**:
- Health bar is a fixed 27px wide (at native resolution), positioned centered above the creature
- Name font is a fixed size (~11-12px bitmap font)
- The name length is NOT truncated (full name shown)
- Health bar is positioned just above the creature, name above the bar

**Fix**: Use fixed sizes relative to native tile resolution (32px), then scale to display. Specifically:
- Health bar: fixed 27px (native) width, centered on creature
- Font: scale based on display DPI but with tighter bounds (~11px at native, roughly `Math.max(10, Math.min(13, tileW / 3))`)
- Remove the 16-char truncation
- Better vertical spacing between bar and name

### Files to Edit

**`src/lib/tibiaRelic/renderer.ts`**

1. In `draw()` method: compute `renderCamX`, `renderCamY`, `renderCamZ` from the player creature's position when available, and use those for all viewport coordinate calculations (floor iteration, tile iteration, HUD positioning). Keep the safety net that re-inserts the player on its tile.

2. In `drawCreatureHudHiRes()`: adjust health bar to fixed native-width (27px scaled), improve font sizing, remove 16-char name truncation, adjust vertical positioning.

### Expected Result
- Camera ALWAYS follows the player creature, never desyncing during floor transitions or creature movements
- Creature names and health bars match original Tibia proportions and positioning
- No regression in map rendering or walk animations

