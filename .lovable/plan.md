
## Fix: Creature Outfit Sprites Wrong (DAT Loader Off-by-99)

### Root Cause

The Tibia.dat file header stores **max IDs**, not entry counts:
- `ItemMaxId` (items range from ID 100 to ItemMaxId)
- `OutfitMaxId` (outfits range from ID 1 to OutfitMaxId)
- `EffectMaxId` / `MissileMaxId` (both range from ID 1 to max)

The current DatLoader treats these as counts, reading `nItems` item entries instead of `nItems - 99`. This causes 99 extra entries to be consumed from the items section, eating into the outfit section. All outfit IDs end up shifted by 99, making every living creature display the wrong sprite.

This explains why:
- Dead monsters show correct sprites (corpse items are in the items section, which is mostly correct)
- Living monsters show wrong sprites (outfit IDs are shifted by 99)

### Confirmed via tibiarc source (types.cpp)

```text
Items:    minId=100, maxId=ItemMaxId   -> count = ItemMaxId - 100 + 1
Outfits:  minId=1,   maxId=OutfitMaxId -> count = OutfitMaxId
Effects:  minId=1,   maxId=EffectMaxId -> count = EffectMaxId
Missiles: minId=1,   maxId=MissileMaxId-> count = MissileMaxId
```

### Changes

**File: `src/lib/tibiaRelic/datLoader.ts`**

1. Rename header variables to clarify they are max IDs, not counts
2. Fix item count calculation: `itemMaxId - 100 + 1` instead of `itemMaxId`
3. Update the console log to show both max IDs and actual counts
4. Update verification log with more outfit checks to confirm the fix

### Technical Detail

```text
Before (WRONG):
  header: nItems=4000 -> reads 4000 items (IDs 100..4099)
  -> eats 99 outfits as items
  -> outfit 1 in map = actually outfit 100 in file

After (CORRECT):
  header: itemMaxId=4000 -> reads 3901 items (IDs 100..4000)
  -> outfits start at correct position
  -> outfit 1 = first outfit in file
```
