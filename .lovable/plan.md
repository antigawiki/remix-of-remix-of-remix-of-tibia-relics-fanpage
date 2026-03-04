

# Root Cause Analysis: TibiaRelic Protocol vs tibiarc C++ Parser

## The Real Problem

After comparing the **tibiarc C++ parser** (used by the WASM player) against the **JS PacketParser** (hand-tuned for TibiaRelic), I found **multiple critical protocol mismatches**. The C++ parser expects vanilla Tibia 7.72, but TibiaRelic uses a custom protocol with different payload sizes for several opcodes. Each mismatch causes **byte drift** — the parser reads too many or too few bytes, causing all subsequent data to be misinterpreted (wrong creature IDs, ghost sprites, frozen animations).

## Confirmed Protocol Mismatches (C++ vs TibiaRelic)

```text
Opcode  | Name              | C++ reads     | TibiaRelic sends | Drift
--------|-------------------|---------------|------------------|------
0x9A    | PlayerPos         | NOT HANDLED   | pos3 (5 bytes)   | CRASH
0xA4    | SpellCooldown     | u8+u32 (5B)   | u16 (2B)         | +3B
0xA7    | PlayerTactics     | 4× u8 (4B)    | 3× u8 (3B)      | +1B
0xA8    | CreatureSquare    | NOT HANDLED   | u32+u8 (5B)      | CRASH
0xB6    | WalkCancel        | u16 (2B)      | no payload (0B)  | +2B
0xB7    | UnjustifiedPts    | 7 bytes       | not used (0B)    | +7B
0xB8    | PvPSituations     | u8 (1B)       | not used (0B)    | +1B
0x92    | CreatureImpass.   | ASSERT FAIL   | u32+u8 (5B)      | CRASH
0x96    | OpenEditText      | +author str   | 1 string only    | +N B
0x14    | Error/MOTD        | NOT HANDLED   | u16+string       | CRASH
```

**Any single "CRASH" opcode or drift >= 1 byte corrupts ALL subsequent parsing for the entire frame**, causing the wrong IDs, ghost creatures, and frozen animations you're seeing.

## Why Previous Patches Failed

The `sed` / `.patch` approaches only tried to fix the **floor range** in `ParseMapDescription`. But the floor range was never the root cause — it's the **opcode payload size mismatches** above. Even with the correct floor range, if `0x9A` or `0xA4` appears in any frame before a map read, the parser drifts and reads garbage data as tile/creature information.

## Proposed Fix: Two-Phase Approach

### Phase 1: Build a Binary Diagnostic Tool
Create a page that loads the uploaded `.cam` file and processes it frame-by-frame with the JS parser (which works correctly), logging:
- Every opcode encountered, its position, and bytes consumed
- Compare against what the C++ parser *would* read for each opcode
- Flag every frame where drift would occur
- Output a complete "protocol specification" for TibiaRelic

This will give us a definitive list of every protocol difference.

### Phase 2: Fork-Level C++ Fix
With the complete protocol spec, apply targeted fixes to the `antigawiki/tibiarc` fork:
- Add missing opcode handlers (0x9A, 0xA8, 0x14)
- Fix payload sizes for existing handlers (0xA4, 0xA7, 0xB6)
- Disable opcodes not used by TibiaRelic (0xB7, 0xB8, 0x92 assertion)
- These changes go directly into the fork source code (not patches)

### Data Files (.dat, .spr, .pic)
The DatLoader flag parsing in JS matches the tibiarc C++ `InitTypeProperties` for 7.55+ correctly — flag order, payload sizes, and sprite index reading all align. The `.spr` loader (RLE decode with u16 sprite count) and `.pic` usage are also standard. **The data files are NOT the problem** — the protocol parsing is.

## Implementation Priority
1. Build the diagnostic tool against the uploaded `.cam` to catalog every opcode occurrence
2. Generate a complete TibiaRelic protocol specification
3. Apply fixes to the C++ fork and rebuild the WASM

