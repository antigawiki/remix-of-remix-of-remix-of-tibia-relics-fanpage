

## Problem: Stuck-buffer detection aborts floor reading but leaves garbage bytes

The current fix correctly detects when `readTileItems` gets stuck, but after `readMultiFloorArea` breaks out of the floor loop, **hundreds of unconsumed bytes** remain in the buffer. These bytes (remaining tile data from floors the server sent) are then interpreted as opcodes by `processDirectOpcodes`, causing every subsequent opcode in the frame to be read from the wrong offset — the corruption cascades for the rest of the recording.

The 4-byte scan-forward window in `processDirectOpcodes` is far too small to skip past hundreds of bytes of orphaned tile data.

## Solution: Two changes in `packetParser.ts`

### 1. Add `scanForwardToOpcode(r)` method

When `readMultiFloorArea` detects a stuck floor, call a new method that scans forward through the buffer (up to 1024 bytes) looking for a known opcode byte. This consumes the orphaned tile data and lands `r.pos` at the next valid opcode.

```typescript
private scanForwardToOpcode(r: Buf): boolean {
  const maxScan = Math.min(r.left(), 1024);
  for (let i = 0; i < maxScan; i++) {
    if (this.isKnownOpcode(r.peekU8())) return true;
    r.pos++;
  }
  return false;
}
```

Called from `readMultiFloorArea` right after the stuck break, and from `readFloorAreaWithOffset` when stuck is detected.

### 2. Increase scan-forward window in `processDirectOpcodes`

Change the recovery scan window from 4 bytes to 128 bytes (both in the unknown-opcode path and the catch path). This provides a safety net in case `scanForwardToOpcode` doesn't fire or partially recovers.

### Files changed
- `src/lib/tibiaRelic/packetParser.ts` — add `scanForwardToOpcode`, call it from `readMultiFloorArea` + `readFloorAreaWithOffset`, widen scan in `processDirectOpcodes`

### Expected result
The video continues playing normally through cave transitions. Corrupted frames will have missing/empty tiles on the affected floors, but all subsequent frames parse correctly because the buffer position is recovered to the next valid opcode.

