

## Plan: Fix sprite rendering to show ALL items correctly

### Problem
The current `renderSingleSprite` uses complex pattern/layer math that fails for many items, causing them to return `null`. The sidebar then filters these out. The ChatGPT approach works because it simply reads the first valid sprite ID from the DAT entry and decodes it directly from the SPR file -- no pattern composition needed for a thumbnail.

### Changes

**1. `src/lib/tibiaRelic/mapTileRenderer.ts` — Simplify `renderSingleSprite`**
- Replace the complex pattern iteration + pixel validation logic with a direct approach:
  - Get the item definition from DAT
  - Find the first non-zero sprite ID in `spriteIds`
  - Decode it via `getSpriteCanvas(sid)` and return it as a 32x32 canvas
  - Only return `null` if the item truly has zero sprite IDs in the DAT (no data at all)
- Keep the multi-tile composition logic only for the map chunk renderer, not for the sidebar thumbnail

**2. `src/components/cam-editor/SpriteSidebar.tsx` — Show ALL items**
- Remove the `validIds` filtering via `useMemo` that skips items where `renderSingleSprite` returns `null`
- Show every item from 100 to maxId in the grid
- Items with no sprite data in the DAT will simply show as empty cells with their ID visible (no placeholder graphics, just the ID number)

These two changes align with the ChatGPT approach: simple direct sprite lookup, no over-engineered pattern iteration for thumbnails, and no hiding of items.

