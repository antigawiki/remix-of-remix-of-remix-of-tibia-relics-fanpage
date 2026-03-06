

## Analysis: `parseTileDescription` and 0xFF Skip Logic

### Finding: The tile skip logic itself is NOT the bug

After comparing the C++ `ParseTileDescription` (tibiarc) with the JS `readTileItems`, the 0xFF skip mechanism is structurally identical in both:

```text
C++: while (peekValue < 0xFF00) { ParseObject(...); peek again; }
     readU16();  return value & 0xFF;

JS:  while (left >= 2) { peek16; if >= 0xFF00 → skip(2), return & 0xFF;
     skip(2); parse object; }
```

Both produce the same skip count. No divergence here.

### The Real Suspect: DAT Property Parsing Mismatch

The critical difference is in how items are loaded from the DAT file, which affects EVERY tile read:

**JS DAT loader** (datLoader.ts): Two-phase approach:
1. Scans forward to `0xFF` terminator first (guarantees correct byte alignment)
2. Then extracts metadata (stackable, fluid, splash) in a second pass

**C++ DAT loader** (dat_patch.py): Wraps `ReadProperties` in try-catch. If a TibiaRelic custom property (0x50, 0xC8, 0xD0) throws an exception, the function **returns early** — the item may be left WITHOUT critical flags like `Stackable` or `LiquidContainer`.

### How This Causes Byte Drift

When the C++ parser reads a tile and encounters an item:
- If `Stackable` or `LiquidContainer/LiquidPool` → reads 1 extra byte (count/fluid type)
- If neither → reads 0 extra bytes

If the C++ DAT loaded an item WITHOUT `Stackable=true` (because ReadProperties threw on a custom flag BEFORE reaching flag 0x05), but the JS DAT correctly identified it as stackable:
- **JS reads**: `u16(itemId) + u8(count)` = 3 bytes
- **C++ reads**: `u16(itemId)` = 2 bytes
- **Result**: 1 byte drift per occurrence, accumulates over time

This perfectly explains why corruption starts later in the recording (minute 59) — it takes many tile descriptions with affected items before the drift becomes catastrophic.

### Proposed Fix

Modify `dat_patch.py` to use the same two-phase approach as the JS loader:

1. First scan forward to `0xFF` terminator (guarantees alignment)
2. Then parse properties from the scanned bytes

This ensures the C++ and JS parsers load identical item flags, eliminating the root cause of drift in tile description parsing.

### Files to Change

1. **`tibiarc-player/dat_patch.py`** — Rewrite to inject a two-phase property reader that scans to `0xFF` first, then extracts known flags from the byte range. Mirrors the JS `extractMetadata` logic.

2. **`.github/workflows/build-tibiarc.yml`** — No changes needed (already calls dat_patch.py).

After rebuilding WASM with this fix, the tile descriptions should consume identical bytes in both parsers.

