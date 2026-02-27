

## Fix Outfit Colors, Item Displacement, and Name/HP Rendering

### Bug 1: HSI Color Formula (RED appears PINK) -- Critical

**Root Cause**: The `hsiToRgb` function in renderer.ts has a mathematical error in ALL THREE sectors. The numerator of the HSI-to-RGB conversion uses `cos(60 - H')` when the standard formula requires `cos(H')`.

Example trace for color index 94 (should be vivid red):
- Sector 3, hShift = 100 degrees
- **Wrong** (current): numerator = cos(-40deg) = 0.766, denominator = cos(-40deg) = 0.766, ratio = 1.0
- B = 1*(1+1) = 2.0 -> clamped 255, R = 255 -> produces (255, 0, 255) = MAGENTA
- **Correct**: numerator = cos(100deg) = -0.174, denominator = cos(-40deg) = 0.766, ratio = -0.227
- B = 0.773, R = 2.227 -> clamped 255 -> produces (255, 0, 197) = RED-ISH

This affects ALL outfit colors that aren't at sector boundaries (0deg, 120deg, 240deg), causing systematic color shifts across the entire palette -- reds become pink, oranges become yellow, etc.

**Fix**: In `hsiToRgb`, change the numerator in each sector from `cos((60-H')*PI/180)` to `cos(H'*PI/180)`:

```text
Sector 1 (H < 120):
  r = I * (1 + S * cos(H_rad) / cos(PI/3 - H_rad))
  
Sector 2 (120 <= H < 240):
  H' = H - 120
  g = I * (1 + S * cos(H'_rad) / cos(PI/3 - H'_rad))

Sector 3 (240 <= H < 360):
  H' = H - 240
  b = I * (1 + S * cos(H'_rad) / cos(PI/3 - H'_rad))
```

### Bug 2: Item Displacement Sign (sprites mispositioned)

**Root Cause**: In `drawItemNative`, item displacement is ADDED (`+ it.dispX`, `+ it.dispY`), but OTClient SUBTRACTS displacement for all types (`dest -= displacement`). Our outfit code already subtracts correctly (`- ot.dispX`), but items are wrong.

This causes items with displacement (signs, wall decorations, furniture) to be drawn shifted right/down instead of up/left, explaining sprites appearing out of position.

**Fix**: Change line 395-396 from:
```text
const dx = bx - tw * TILE_PX + it.dispX;
const dy = by - th * TILE_PX + it.dispY - elevationOffset;
```
to:
```text
const dx = bx - tw * TILE_PX - it.dispX;
const dy = by - th * TILE_PX - it.dispY - elevationOffset;
```

### Bug 3: Name/HP Bar Style (doesn't match original Tibia)

Comparing the screenshots: the original Tibia client renders creature names with:
- A 1px black outline (stroke), tight around each character
- Font size approximately 8-9px at native 32px tile resolution (smaller than our current ~11px)
- Health bar narrower (about 27px native), with a thin 1px dark border
- Name positioned closer to the health bar
- Background behind names is semi-transparent black, not just stroke

**Fix**: Adjust `drawCreatureHudHiRes` to use:
- Smaller font size (~8px native scaled to display) 
- Thinner stroke (lineWidth 1.5 instead of 2)
- Tighter spacing between name and health bar
- 1px border outline on health bar (matching original)

### Bug 4: "Frozen Screen" During Playback

The user reports the screen appears frozen while HP bars update. This is largely EXPECTED behavior: when the player stands still fighting monsters, creatures take damage (HP decreases) but nobody moves. Since we don't render spell effects or hit animations (not implemented), the screen looks static.

However, there is a real optimization needed: stale creatures that are no longer visible accumulate in `gs.creatures` forever, causing the HUD loop (`for (const c of g.creatures.values())`) to iterate over hundreds of invisible creatures each frame.

**Fix**: In the HUD draw loop, add early-out checks before computing creature positions, and periodically cull creatures that haven't been updated (tiles they were on no longer exist in the viewport).

### Files to Edit

**`src/lib/tibiaRelic/renderer.ts`**:
1. Fix `hsiToRgb` function -- correct numerator in all 3 sectors
2. Fix `drawItemNative` -- subtract displacement instead of add
3. Adjust `drawCreatureHudHiRes` -- smaller font, tighter spacing, health bar border

### Expected Results
- Outfit colors match the original Tibia client (reds are red, not pink)
- Items positioned correctly (trees, signs, furniture aligned properly)
- Name/HP bars closer to original Tibia visual style

