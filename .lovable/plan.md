

## Diagnosis: The "Resilience" Patches Are the Problem

After careful analysis of the build workflow, I found **three patches that are actively corrupting data** across ALL recordings — not just at the 59-minute mark:

### Bug 1: `dat_patch.py` is corrupting the .dat item database

The two-phase DAT patch wraps `ReadProperties` in a try-catch that scans forward for byte `0xFF` on failure. The problem: `0xFF` can appear as a normal data byte inside property values (e.g., a color value of 255, a sprite ID containing 0xFF). When ANY custom item triggers an exception, the scanner lands on a false `0xFF`, and **every item after that point gets the wrong sprite IDs**. This is why tiles show wrong sprites in almost all cams — the .dat file is being parsed incorrectly at load time.

### Bug 2: OutfitWindow sed is too broad

```yaml
sed -i '/void Parser::ParseOutfitWindow/,/^}/{ s/ReadU16()/ReadU8()/g; }' lib/parser.cpp
```

This replaces **ALL** `ReadU16()` inside `ParseOutfitWindow` — including `event.Outfit.LookType`, which is legitimately `U16` in Tibia 7.x. The intention was only to change `RangeStart` and `RangeEnd`. This causes 1-byte drift every time an outfit window appears.

### Bug 3: Stuck-buffer detection and FloorDown patch are overly aggressive

These patches break out of valid tile-reading loops prematurely, causing floors to be partially read and corrupting the map state.

---

### Plan: Strip back to ONLY the known-correct opcode patches

**File: `.github/workflows/build-tibiarc.yml`**

1. **Remove `dat_patch.py` call entirely** — the tibiarc fork already handles .dat parsing. The try-catch wrapper is causing more corruption than it prevents.

2. **Fix OutfitWindow sed** — replace the blanket `s/ReadU16()/ReadU8()/g` with two targeted replacements for only `RangeStart` and `RangeEnd`:
   ```yaml
   sed -i '/void Parser::ParseOutfitWindow/,/^}/{
     s/RangeStart = reader.ReadU16()/RangeStart = reader.ReadU8()/
     s/RangeEnd = reader.ReadU16()/RangeEnd = reader.ReadU8()/
   }' lib/parser.cpp
   ```

3. **Remove stuck-buffer detection** — the `_posBeforeTile` check in `ParseFloorDescription` is breaking valid tile reads.

4. **Remove FloorDown patch** — the floor range sed may be matching incorrectly and altering valid code.

5. **Remove diagnostic opcode logging** — global `sed` on `switch (reader.ReadU8())` could match multiple switch statements throughout the codebase, not just the main opcode switch.

**Keep these patches** (they are correct and well-tested):
- 0xA4 SpellCooldown (5B → 2B)
- 0xA7 PlayerTactics (4B → 3B)
- 0xA8 CreatureSquare (5B)
- 0xB6 WalkCancel (2B → 0B)
- 0xAA Talk (+u32 statementGuid)
- 0x64 MapDesc (mini guard)
- 0xA0 PlayerStats (no stamina)
- 0xA5, 0xA6, 0x63 (new opcodes)
- 0x92 CreatureImpassable (removed assert)
- Position\_ public + save/restore in web\_player.cpp

**File: `tibiarc-player/dat_patch.py`** — no changes needed (just stop calling it)

After these changes, rebuild WASM via GitHub Actions.

