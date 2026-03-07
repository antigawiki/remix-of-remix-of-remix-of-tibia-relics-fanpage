/**
 * Parser do formato .cam TibiaRelic
 * Header (12 bytes): u32 version + f32 fps + 4 bytes extras
 * Frames: u64 timestamp_ms + u16 payload_size + payload
 */

export interface CamFrame {
  timestamp: number; // ms relativo ao início
  payload: Uint8Array;
}

export interface CamFile {
  version: number;
  fps: number;
  frames: CamFrame[];
  totalMs: number;
}

const HDR = 12;
const FH = 10; // u64 ts + u16 size

export function parseCamFile(data: ArrayBuffer): CamFile {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);

  const version = view.getUint32(0, true);
  const fps = view.getFloat32(4, true);

  const frames: CamFrame[] = [];
  let pos = HDR;
  let ts0: number | null = null;

  while (pos + FH <= data.byteLength) {
    // u64 timestamp - read as two u32s (JS doesn't have native u64)
    const tsLo = view.getUint32(pos, true);
    const tsHi = view.getUint32(pos + 4, true);
    const ts = tsLo + tsHi * 0x100000000;

    const sz = view.getUint16(pos + 8, true);

    // Sanity checks
    if (tsHi > 0xFFFF || sz === 0 || pos + FH + sz > data.byteLength) break;

    if (ts0 === null) ts0 = ts;

    frames.push({
      timestamp: ts - ts0,
      payload: bytes.slice(pos + FH, pos + FH + sz),
    });

    pos += FH + sz;
  }

  const totalMs = frames.length > 0 ? frames[frames.length - 1].timestamp : 0;

  return { version, fps, frames, totalMs };
}
