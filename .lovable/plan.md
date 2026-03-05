

## Analysis: Flag Parameter Size Mismatch Causing Parse Drift

The ChatGPT code skips ALL bytes until `0xFF` without trying to interpret flag parameters:
```
while(true){
  let flag = view.getUint8(pos); pos++
  if(flag == 0xFF) break
}
```

Our code tries to consume parameter bytes for known flags (e.g., flag `0x15` consumes 4 bytes for light data). If **any** flag's parameter byte count is wrong for this specific DAT version, it causes cascading drift for all subsequent items. This is why items ~1028+ show wrong sprites.

The likely culprit is one or more parameterized flags consuming the wrong number of bytes (e.g., `0x15` reading 4 bytes when the format only has 2, or flags `0x08`/`0x09` having different sizes).

### Plan

**`src/lib/tibiaRelic/datLoader.ts` — Two-phase flag parsing**

Phase 1 (positioning): Save the start position, then skip byte-by-byte to `0xFF` exactly like the ChatGPT code. This guarantees the pointer is always correctly aligned for reading dimensions and sprite IDs.

Phase 2 (metadata, best-effort): Go back over the saved byte range and try to extract known flag data (isGround, stackPrio, elevation, displacement, etc.) for map rendering. If this extraction fails or encounters issues, default values are used — it never affects the main parser position.

Phase 3 (unchanged): Read width, height, layers, patterns, anim, and sprite IDs from the guaranteed-correct position.

This gives us both: correct sprite alignment (matching ChatGPT) AND item metadata for proper map rendering.

