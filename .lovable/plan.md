

## Analysis of GPT's Diagnosis

The GPT analysis identifies a real problem: **stackpos-based creature removal in tibiarc's gamestate causes ghost duplicates when the replay state doesn't match expected stackpos order**. This explains:
- Creature duplication (RemoveThing misses the target, new AddThing creates a copy)
- Character appearing frozen (two creatures with same ID, one never moves)
- Wrong floor rendering (inconsistent map state confuses the Z-level calculation)

However, the fix the GPT suggests (patching `removeThing` / `MoveCreature` deep inside tibiarc's library) requires modifying `lib/gamestate.cpp` and `lib/map.cpp` — files we can't inspect right now and would need to patch blindly via `sed`. This is very risky and could introduce more corruption.

### Practical approach: Enhanced cleanup in `web_player.cpp`

Instead of patching blind inside the library, we can add **aggressive per-event creature state management** in the wrapper we control:

**File: `tibiarc-player/web_player.cpp`**

1. **Replace `DeduplicateCreatures` with `SanitizeCreatureState`** — a more comprehensive cleanup:
   - Remove creatures with duplicate IDs (keep the one closest to the player's floor)
   - Remove creatures on floors that differ from the player's current Z by more than 2 (they shouldn't be visible)
   - Remove creatures at position (0,0,0) or (0xFFFF,0xFFFF,0xFFFF) — invalid positions from failed removals

2. **Run sanitization per-frame in `MainLoop`** (already done with `DeduplicateCreatures`, just making it smarter)

3. **Add creature-ID tracking around event updates**: After each batch of events in a frame, check if any creature ID appears in multiple tiles and force-remove the ghost from the old tile

4. **Floor-change cleanup**: When the player's Z coordinate changes between frames, purge all creatures from the old floor to prevent cross-floor ghosts

```text
Before (current):
  MainLoop → process events → DeduplicateCreatures (position-only) → Render

After (proposed):
  MainLoop → process events → SanitizeCreatureState → Render
                                  ├─ deduplicate by creature ID
                                  ├─ remove wrong-floor creatures  
                                  └─ purge invalid positions
```

### What this fixes vs. what it doesn't

**Fixes**: creature duplication, frozen player, cross-floor ghosts — the three symptoms described

**Doesn't fix**: wrong tile sprites (if still happening, that's a separate byte-drift issue in the protocol parser, not related to creature state)

### Files to change
- `tibiarc-player/web_player.cpp` — replace DeduplicateCreatures with SanitizeCreatureState

After editing, rebuild WASM via GitHub Actions.

