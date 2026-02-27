

## Fix Magic Effects + Improve Damage/XP Text

### Root Cause Analysis

#### Bug 1: Magic Effects Show Wrong Sprites (or "don't appear")

The screenshot clearly shows visual effects rendering (orange bursts, black holes, sparkles), but they are the WRONG effects for the context. This is caused by the `+1` offset on effect IDs.

**How it works:**
- `DatLoader` stores effects starting at ID 1 (`it.id = 1 + i`)
- Standard Tibia 7.72 protocol sends 1-based effect IDs (e.g., DRAWBLOOD = 1, LOSEENERGY = 2)
- With `effectType + 1`: protocol blood (1) maps to dat ID 2 (energy) -- every effect is shifted by one position
- Without `+1`: protocol blood (1) maps to dat ID 1 (blood) -- correct

The previous attempt to remove `+1` failed because other bugs (invisible creatures, broken rendering) were active simultaneously, making it impossible to evaluate. Those bugs are now fixed.

**Fix** (`src/lib/tibiaRelic/packetParser.ts`):
- Opcode 0x83: Change `effectId: effectType + 1` to `effectId: effectType`
- Opcode 0x85: Change `missileId: missileType + 1` to `missileId: missileType`
- Add temporary `console.log` for the first 20 effects to verify IDs in browser console

#### Bug 2: Animated Text Colors Are Wrong

The `protocolColorToHex` method has a hardcoded color map that overrides correct values with wrong ones. Tibia uses a 6x6x6 RGB cube (216 colors) where:
- Color 215 = white (XP gain text) -- but hardcoded map says `'#5555ff'` (blue!)
- Color 180 = red (physical damage) -- hardcoded says `'#cc0000'` (close but not exact)
- Color 30 = green (not white as hardcoded)

The 6x6x6 cube formula already produces correct colors. The hardcoded map is actively breaking them.

**Fix** (`src/lib/tibiaRelic/packetParser.ts`):
- Remove the entire hardcoded `colorMap` object
- Use only the 6x6x6 RGB cube calculation (already implemented as fallback)

#### Improvement: Animated Text Too Small and Hard to Read

Currently 8px monospace with a simple 1px shadow is too small at native 480x352 resolution.

**Fix** (`src/lib/tibiaRelic/renderer.ts`):
- Increase font to `bold 11px monospace`
- Use `strokeText` with 2px black stroke for proper outline (like original Tibia client)
- Float upward 24px instead of 20px for better visibility
- Keep the fade-out alpha animation

---

### Files to Edit

#### 1. `src/lib/tibiaRelic/packetParser.ts`

- **Line 231**: Change `effectId: effectType + 1` to `effectId: effectType`
- **Line 251**: Change `missileId: missileType + 1` to `missileId: missileType`
- **Lines 834-861**: Replace `protocolColorToHex` -- remove hardcoded colorMap, keep only 6x6x6 cube math

#### 2. `src/lib/tibiaRelic/renderer.ts`

- **Lines 342-363**: Improve animated text rendering -- larger font (11px), strokeText outline, 24px float distance

### Expected Results
- Blood effects appear when monsters take physical damage
- Energy/fire/ice effects match the actual spell being cast
- XP gain text appears in white
- Physical damage text appears in red
- Text is larger and readable with proper black outline like original Tibia
