
## Fix Outfit Colors + Rendering Issues

### Bug 1: Color Algorithm is COMPLETELY Wrong (Critical)

The current code uses an HSI-to-RGB formula with cosine functions in 3 sectors. The **actual OTClient source code** (outfit.cpp) uses a completely different algorithm: a 6-sector linear HSV-like interpolation with NO cosine functions at all.

**OTClient's actual algorithm** (from outfit.cpp):
```text
loc1 = hue [0..1)
loc2 = saturation
loc3 = value

6 sectors based on hue:
  hue < 1/6: red=V, blue=V*(1-S), green=blue+(V-blue)*6*hue
  hue < 2/6: green=V, blue=V*(1-S), red=green-(V-blue)*(6*hue-1)
  hue < 3/6: green=V, red=V*(1-S), blue=red+(V-red)*(6*hue-2)
  hue < 4/6: blue=V, red=V*(1-S), green=blue-(V-red)*(6*hue-3)
  hue < 5/6: blue=V, green=V*(1-S), red=green+(V-green)*(6*hue-4)
  else:      red=V, green=V*(1-S), blue=red-(V-green)*(6*hue-5)
```

Our code uses `cos()` based HSI formula in 3 sectors -- this produces fundamentally different color values. That's why red appears as pink/magenta.

**Second bug in hue**: We compute hue as `(hueIndex - 1) / 18` but OTClient uses `hueIndex / 18.0` (where hueIndex = `color % 19`). This shifts every color by one step.

**Fix**: Replace `hsiToRgb` and `getOutfitColor` entirely with OTClient's exact algorithm from outfit.cpp.

### Bug 2: Grayscale Colors Wrong

OTClient's grayscale case:
- `loc2 = 0`, `loc3 = 1 - color / 19 / 7`
- Then goes through the if(loc2==0) path returning `(loc3*255, loc3*255, loc3*255)`

Our code computes intensity differently: `1.0 - groupIndex / 7` which is equivalent. But the early-return at loc3==0 and loc2==0 is missing, which could cause edge cases.

**Fix**: Match OTClient's exact flow including early returns for black and grayscale.

### Bug 3: Stuttering in Cities

Dense city tiles have many unique sprites. Each `getNativeSprite()` call that misses cache creates a new canvas element synchronously, causing frame drops. Additionally, the tint cache grows unbounded.

**Fix**: 
- Add periodic cache size limits (evict oldest entries when cache exceeds threshold)
- This won't fully eliminate stutter but will prevent memory growth

### Bug 4: Screen Appears "Frozen" During Combat

This is largely expected -- when creatures fight in place, without spell effects or damage numbers rendered, nothing visually changes except HP bars. The protocol sends effect opcodes (0x83, 0x84, 0x85) but we skip them.

No code change for this in this iteration -- effect rendering would be a separate feature.

### Files to Edit

**`src/lib/tibiaRelic/renderer.ts`**:
1. Replace `hsiToRgb` function with OTClient's exact 6-sector algorithm (no cosines)
2. Replace `getOutfitColor` to use `hueIndex / 18.0` instead of `(hueIndex-1) / 18`
3. Match OTClient's exact grayscale and early-return logic
4. Add cache size limiting to prevent unbounded memory growth

### Expected Results
- All outfit colors match the original Tibia client exactly (red is red, not pink)
- Reduced memory usage from cache management
- No regression in rendering or animation
