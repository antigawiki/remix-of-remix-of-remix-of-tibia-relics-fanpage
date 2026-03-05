

## Analysis: GPT's Creature ID Tracking Code

### The insight is correct, but the code won't work here

The GPT correctly identifies that **creature ID-based tracking** is superior to stackpos-based removal. However, the code it provided is a **standalone, parallel creature registry** that doesn't connect to tibiarc's actual rendering pipeline:

- It defines its own `struct Creature` and `std::unordered_map<uint32_t, Creature> creatures` — completely separate from `g_gamestate->Creatures` which is what tibiarc renders
- The exported functions (`replayAddCreature`, `replayMoveCreature`, etc.) would need to be called from JavaScript, but nothing calls them
- Even if called, they modify a shadow map that the renderer never reads — **zero visual effect**

### What we already have

Our current `SanitizeCreatureState` already does ID-based cleanup directly on `g_gamestate->Creatures` (the actual rendered state):

| GPT's code | Our current code |
|---|---|
| Shadow `creatures` map (not rendered) | Directly modifies `g_gamestate->Creatures` (rendered) |
| `purgeDuplicateIds` — redundant, `unordered_map` can't have duplicate keys | Dedup by **position** (same tile = ghost) |
| `purgeInvalidFloors` (±2 floors) | Same logic, ±2 floors |
| `purgeOutOfView` (VIEW_RANGE check) | Not needed — tibiarc's renderer already clips |
| `handleFloorChange` (purge all on Z change) | Same logic, purge old-floor creatures |

### Recommendation: No changes needed

Our `SanitizeCreatureState` already implements the same strategy (creature ID-based, not stackpos-based) but **correctly targets the actual gamestate**. The GPT code would be a regression — it creates a disconnected parallel state.

If ghost creatures or duplication still occur after the latest WASM build, the root cause is likely in the **protocol parser byte drift** (opcodes consuming wrong number of bytes), not in the creature tracking layer. That would require fixing the `sed` patches in the build workflow.

