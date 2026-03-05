

## Problem Found: DAT sprite IDs read as u16 instead of u32

The SPR file uses signature `0x439852BE` (Tibia 7.6+). In this version, sprite IDs in the DAT file are stored as **u32 (4 bytes)**, not u16 (2 bytes).

The DAT loader at line 235 reads:
```typescript
it.spriteIds.push(view.getUint16(p, true)); p += 2;  // WRONG for 7.6+
```

This means:
- Every sprite ID is read from only 2 bytes instead of 4
- The parser position advances by 2 instead of 4, causing **all subsequent data to be misaligned**
- This corrupts sprite IDs for nearly every item after the first few

This is why most items show empty (X) in the sidebar -- their sprite IDs are garbage values that don't match any real sprite in the SPR file.

## Fix

**`src/lib/tibiaRelic/datLoader.ts`** -- Change sprite ID reading from u16 to u32:

- Line 234: boundary check `p + 1` → `p + 3`
- Line 235: `getUint16` → `getUint32`, `p += 2` → `p += 4`

This single change should fix all the broken sprites in the sidebar by reading the correct 4-byte sprite IDs and keeping the parser aligned.

