

# Fix: Stream desync bugs causing wrong sprites and broken floor changes

## Root Cause

The floor change logic and sprite index formulas are actually correct (verified against both OTClient and tibiarc). The real problem is **byte-level stream desynchronization** caused by several opcodes reading the wrong number of bytes for protocol 7.72. Once any of these opcodes fires, every subsequent opcode in the frame reads corrupted data.

## Bugs Found (confirmed via tibiarc `versions.cpp`)

### Bug 1: Player Icons (0xA2) reads u16 instead of u8

For protocol 7.72, `IconsU16` is only enabled from 7.80+. Our code reads `r.u16()` (2 bytes) but should read `r.u8()` (1 byte). Every icons update consumes 1 extra byte, desynchronizing the stream.

### Bug 2: NPC Trade (0x7A) reads extra weight field

For 7.72, `NPCVendorWeight` is only from 8.30+. Our code reads `u16 + u8 + string + u32 + u32 + u32` per item, but should be `u16 + u8 + string + u32 + u32` (no weight). Every trade item consumes 4 extra bytes.

### Bug 3: Talk (0xAA) speak mode mapping wrong for 7.72

The speak mode byte values for 7.72 differ from what our code assumes. Per tibiarc's `InitSpeakTypes` for 7.20-7.72:

```text
Type 14 (0x0E) = MonsterSay -> needs POSITION (5 bytes)
   Our code: treats as CHAN_TYPE -> reads CHANNEL (2 bytes) = 3 bytes short!

Type 9 (0x09) = Broadcast -> needs NO extra data
   Our code: not in any set -> falls through correctly

Type 11 (0x0B) = GMToPlayer -> needs NO extra data (not position)
   Our code: not in any set -> correct
```

This is the most frequent desync source since monsters speak often.

### Bug 4: Player Stats (0xA0) may have wrong size for custom server

TibiaRelic (Nekiro TFS-1.5-Downgrades-7.72) might include Stamina (u16) in player stats. Our hardcoded `r.skip(20)` doesn't account for this possibility. If stamina is present, we're 2 bytes short. Need to verify with actual data or make it adaptive.

## Fixes

### A. `src/lib/tibiaRelic/packetParser.ts`

1. **Fix 0xA2**: Change `r.u16()` to `r.u8()` for player icons (or make it version-aware)

2. **Fix 0x7A**: Remove the third `r.u32()` (weight) from NPC trade item loop:
   ```text
   Before: r.u16(); r.u8(); r.str16(); r.u32(); r.u32(); r.u32();
   After:  r.u16(); r.u8(); r.str16(); r.u32(); r.u32();
   ```

3. **Fix 0xAA talk**: Rewrite speak mode handling to match 7.72 protocol exactly:
   ```text
   Position types: 1,2,3,14,16 (Say, Whisper, Yell, MonsterSay, MonsterYell)
   Channel types:  5,10,12     (ChannelYellow, ChannelRed, ChannelOrange)
   Time types:     6           (RuleViolationChannel -> u32)
   No-data types:  4,7,8,9,11 (PrivateIn, RVAnswer, RVContinue, Broadcast, GMToPlayer)
   ```

4. **Fix 0xA0 stats**: Since TibiaRelic is a custom server, try a safer approach: instead of hardcoded `skip(20)`, parse the known fields individually so mismatches cause a controlled error rather than silent desync. Or keep 20 if verified working, and add stamina (22 bytes) as a fallback.

5. **Add defensive logging**: Log when creature outfits are parsed, showing the decoded looktype and colors, to help debug any remaining issues.

### B. `src/lib/tibiaRelic/renderer.ts`

No changes needed -- the rendering logic (sprite index formula, multi-floor drawing, outfit tinting) is correct. The visual bugs are entirely caused by the parser consuming wrong bytes.

## Why this explains both symptoms

- **"Floor changes don't work"**: After a MonsterSay message (which happens frequently), the parser is offset by 3 bytes. The next opcode read is garbage, causing frame abandonment. Floor change opcodes (0xBE/0xBF) in subsequent frames may also be affected.

- **"Outfits are wrong"**: When creature data is read from a desynchronized stream, the looktype, head/body/legs/feet colors, and even the creature ID become garbage values, producing wrong or missing sprites.

## Validation

After these fixes:
- Monster/NPC speech should no longer cause stream corruption
- Floor transitions should work since the actual floor change code already matches OTClient/tibiarc
- Creature outfits should render correctly since the looktype values will be read from properly synchronized data

