/**
 * Lightweight extractor for ambient light events (opcode 0x82) from .cam files.
 * Scans raw frame payloads without full protocol parsing — just looks for 0x82 bytes.
 * 
 * Strategy: For each frame payload, use the same TCP demux heuristic as the WASM player,
 * then scan sub-packets for opcode 0x82 followed by 2 bytes (level + color).
 */

export interface LightEvent {
  timestamp: number; // ms relative to start
  level: number;     // 0 = total darkness, 255 = full bright
  color: number;     // light color index
}

/**
 * Extract light timeline from a raw .cam file buffer.
 * Returns sorted array of LightEvent entries.
 */
export function extractLightTimeline(data: Uint8Array): LightEvent[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const events: LightEvent[] = [];

  if (data.length < 12) return events;

  let pos = 12; // skip header (u32 version + f32 fps + 4 reserved)
  let ts0: number | null = null;

  while (pos + 10 <= data.length) {
    const tsLo = view.getUint32(pos, true);
    const tsHi = view.getUint32(pos + 4, true);
    const ts = tsLo + tsHi * 0x100000000;
    const sz = view.getUint16(pos + 8, true);
    pos += 10;

    if (tsHi > 0xFFFF || sz === 0 || pos + sz > data.length) break;
    if (ts0 === null) ts0 = ts;
    const timestamp = ts - ts0;

    // Scan payload for opcode 0x82
    const payloadStart = pos;
    const payloadEnd = pos + sz;
    scanPayloadForLight(data, payloadStart, payloadEnd, timestamp, events);

    pos = payloadEnd;
  }

  return events;
}

function scanPayloadForLight(
  data: Uint8Array, start: number, end: number,
  timestamp: number, events: LightEvent[]
) {
  // Simple scan: look for byte 0x82 and check if it could be the world light opcode
  // The opcode 0x82 is followed by exactly 2 bytes (level + color)
  for (let i = start; i < end - 2; i++) {
    if (data[i] === 0x82) {
      // Heuristic: level should be 0-255, color should be reasonable
      const level = data[i + 1];
      const color = data[i + 2];
      // Light levels in Tibia are typically 0-215 (max world light)
      if (level <= 215 && color <= 215) {
        events.push({ timestamp, level, color });
        // Don't break - there could be multiple packets in one frame
        // but skip past this opcode's data
        i += 2;
      }
    }
  }
}

/**
 * Get the ambient light level at a given playback time.
 * Uses binary search on the sorted timeline.
 */
export function getLightAtTime(timeline: LightEvent[], timeMs: number): number {
  if (timeline.length === 0) return 255; // default full bright

  // Binary search for last event <= timeMs
  let lo = 0, hi = timeline.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid].timestamp <= timeMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (result === -1) return 255; // before first event
  return timeline[result].level;
}
