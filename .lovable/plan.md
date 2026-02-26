

## Fix: Viewport Size and Aspect Ratio

### Problem
The cam player canvas has two issues causing the viewport to look wrong compared to the original TibiaRelic cam player:

1. **Wrong aspect ratio**: CSS container uses `aspect-[4/3]` (1.333) but the Tibia viewport is 15:11 tiles (1.363). This squishes the display slightly.
2. **Low canvas resolution**: Canvas is hardcoded to 480x352 pixels. Even though CSS scales it up to fill the container, the internal resolution stays at 480x352, making everything look blurry/pixelated and limiting the effective display area. The original cam player renders at the full display resolution.

### Fix

**File: `src/components/TibiarcPlayer.tsx`**

1. Change CSS aspect ratio from `aspect-[4/3]` to `aspect-[15/11]` to match the Tibia viewport ratio exactly
2. Remove hardcoded `width={480} height={352}` from the canvas element
3. Add a ResizeObserver that dynamically sets the canvas resolution to match the actual display size of the container, ensuring crisp pixel-perfect rendering at any screen size
4. Remove `max-w-[800px]` constraint to allow the player to use more screen space (matching the original cam player behavior), or increase it to `max-w-[1000px]`

### Technical Detail

```text
Before:
  CSS container: aspect-[4/3], max-w-[800px]
  Canvas: 480x352 fixed
  -> tiles render at 32px, CSS stretches to fill
  -> blurry, wrong proportions

After:
  CSS container: aspect-[15/11], max-w-[960px]  
  Canvas: dynamically sized to container (e.g. 960x704)
  -> tiles render at ~64px natively
  -> crisp, correct proportions
```

### Changes Summary
- **`src/components/TibiarcPlayer.tsx`**: Fix aspect ratio, add ResizeObserver for dynamic canvas sizing, increase max width

