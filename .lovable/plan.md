

# Fix Protocol Parser: Scroll Single-Floor + MapDesc Position-Only

## Root Cause Analysis (from diagnostic JSON)

The diagnostic reveals **two critical parsing issues** and one mystery to investigate:

### Issue 1: scroll() reads 8 floors, server sends 1
Currently `scroll()` uses `getMapDescFloorRange` (full surface 7→0 = 8 floors). For a 1-tile column, that attempts 1×14×8 = 112 tiles. TibiaRelic only sends 1×14×1 = 14 tiles. The extra reads silently consume subsequent opcode bytes as tile data — no parse error, but massive state corruption (wrong items, ghost creatures). This is the primary cause of visual bugs.

### Issue 2: mapDesc() after map loaded re-reads full tile area
The `< 100` bytes guard works for small frames but some mini-mapDesc packets are larger. A smarter heuristic is needed: peek at the next u16 and check if it looks like valid tile data.

### Issue 3: Unknown opcode 0xA8 (630 occurrences, ALL in error frames)
The pattern `[0x8C, 0xA8, 0x7F, 0x08, 0x08]` repeats hundreds of times. The 0xA8 handler reads 5 bytes but likely under-reads, causing everything after it to misalign. Need a hex dump tool to see the raw bytes and determine the correct payload size.

## Implementation Plan

### Task 1: Fix scroll() — single floor read
In `packetParser.ts`, replace the `readMultiFloorArea` calls in `scroll()` with `readSingleFloorArea` using only the current camera Z floor. Remove the `getMapDescFloorRange` call from scroll.

### Task 2: Fix mapDesc() — smarter mini-mapDesc detection
After reading x/y/z in `mapDesc()`, if `gs.mapLoaded` is already true, peek at the next u16:
- If it IS a skip marker (≥0xFF00), item ID (100-9999), or creature marker (0x61-0x63), proceed with full tile read
- Otherwise, treat as position-only update and return early

This replaces the crude `r.left() < 100` guard with a content-aware check.

### Task 3: Add hex dump to diagnostic tool
Add a raw hex dump of problem frame payloads to the diagnostic output, so we can definitively determine what opcode 0xA8's real payload should be. This will be visible in the Protocol Diagnostic tab.

