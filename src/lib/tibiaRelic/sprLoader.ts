/**
 * Loader do Tibia.spr - decodifica sprites RLE para ImageData
 * Suporta auto-detecção de formato:
 *   - 7.4 (740): u16 count, offsets em byte 6
 *   - 7.5+ (750+): u32 count, offsets em byte 8
 */

const SPR_SIZE = 32;

// Known signatures
const SIG_740 = 0x41B9EA86; // Tibia 7.4
const SIG_760 = 0x439852BE; // Tibia 7.6

export class SprLoader {
  private raw: Uint8Array = new Uint8Array(0);
  private view: DataView = new DataView(new ArrayBuffer(0));
  private offsets: number[] = [];
  private cache: Map<number, ImageData | null> = new Map();
  count = 0;
  private signature = 0;
  private isU32Count = false;

  load(data: ArrayBuffer) {
    this.raw = new Uint8Array(data);
    this.view = new DataView(data);

    // Read signature
    this.signature = this.view.getUint32(0, true);
    const sigHex = '0x' + this.signature.toString(16).toUpperCase().padStart(8, '0');

    // Auto-detect count size using heuristic
    const countU16 = this.view.getUint16(4, true);
    const countU32 = this.view.getUint32(4, true);

    // Heuristic: try u16 first. Check if offset[0] at byte 6 points to valid data
    const offsetIfU16 = 6 + countU16 * 4;
    const firstOffsetU16 = countU16 > 0 ? this.view.getUint32(6, true) : 0;

    // Try u32: offset[0] at byte 8
    const offsetIfU32 = 8 + countU32 * 4;
    const firstOffsetU32 = countU32 > 0 && data.byteLength >= 12 ? this.view.getUint32(8, true) : 0;

    // Decision: if u16 count produces a reasonable first offset (within file), use u16
    // If first offset from u16 is outside file but u32 works, use u32
    const fileSz = data.byteLength;

    if (countU16 > 0 && firstOffsetU16 > 0 && firstOffsetU16 < fileSz && offsetIfU16 < fileSz) {
      // u16 looks valid
      this.isU32Count = false;
      this.count = countU16;
    } else if (countU32 > 0 && countU32 < 0x100000 && firstOffsetU32 > 0 && firstOffsetU32 < fileSz && offsetIfU32 < fileSz) {
      // u32 looks valid
      this.isU32Count = true;
      this.count = countU32;
    } else {
      // Fallback to u16
      this.isU32Count = false;
      this.count = countU16;
    }

    const headerSize = this.isU32Count ? 8 : 6;

    console.log(`[SprLoader] signature=${sigHex}, fileSize=${fileSz}`);
    console.log(`[SprLoader] countU16=${countU16}, countU32=${countU32}, chosen=${this.count} (${this.isU32Count ? 'u32' : 'u16'})`);
    console.log(`[SprLoader] offsets start at byte ${headerSize}`);

    // Read offset table
    this.offsets = [];
    for (let i = 0; i < this.count; i++) {
      const pos = headerSize + i * 4;
      if (pos + 3 >= fileSz) break;
      this.offsets.push(this.view.getUint32(pos, true));
    }

    // Diagnostic: count valid vs zero offsets
    let validOffsets = 0;
    let zeroOffsets = 0;
    let outOfRange = 0;
    for (const off of this.offsets) {
      if (off === 0) zeroOffsets++;
      else if (off >= fileSz) outOfRange++;
      else validOffsets++;
    }
    console.log(`[SprLoader] offsets: ${validOffsets} valid, ${zeroOffsets} zero, ${outOfRange} out-of-range (total ${this.offsets.length})`);

    if (outOfRange > 0) {
      console.warn(`[SprLoader] ⚠ ${outOfRange} offsets point beyond file! Format detection may be wrong.`);
      // If many are out of range and we used u16, try u32
      if (!this.isU32Count && outOfRange > this.offsets.length * 0.5) {
        console.warn(`[SprLoader] Retrying with u32 count...`);
        this.isU32Count = true;
        this.count = countU32;
        this.offsets = [];
        for (let i = 0; i < this.count; i++) {
          const pos = 8 + i * 4;
          if (pos + 3 >= fileSz) break;
          this.offsets.push(this.view.getUint32(pos, true));
        }
        let v2 = 0, o2 = 0;
        for (const off of this.offsets) {
          if (off > 0 && off < fileSz) v2++;
          else if (off >= fileSz) o2++;
        }
        console.log(`[SprLoader] u32 retry: ${v2} valid, ${o2} out-of-range (total ${this.offsets.length})`);
      }
    }
  }

  getSprite(sid: number): ImageData | null {
    if (sid <= 0 || sid > this.offsets.length) return null;
    if (this.cache.has(sid)) return this.cache.get(sid)!;

    const off = this.offsets[sid - 1];
    if (off === 0) { this.cache.set(sid, null); return null; }

    const raw = this.raw;
    if (off + 5 > raw.length) { this.cache.set(sid, null); return null; }

    // Skip 3 legacy "color key" bytes
    const sz = this.view.getUint16(off + 3, true);
    if (sz === 0) { this.cache.set(sid, null); return null; }

    const N = SPR_SIZE * SPR_SIZE;
    const px = new Uint8ClampedArray(N * 4);

    let p = off + 5;
    let pixel = 0;
    const end = off + 5 + sz;

    while (p + 3 < end && pixel < N) {
      const tr = this.view.getUint16(p, true); p += 2;
      const cl = this.view.getUint16(p, true); p += 2;
      pixel += tr;
      for (let j = 0; j < cl && pixel < N; j++) {
        if (p + 2 >= end) break;
        const r = raw[p], g = raw[p + 1], b = raw[p + 2]; p += 3;
        const i = pixel * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
        pixel++;
      }
    }

    const img = new ImageData(px, SPR_SIZE, SPR_SIZE);
    this.cache.set(sid, img);
    return img;
  }

  /** Check if a sprite ID is valid (exists and has data) */
  hasSprite(sid: number): boolean {
    if (sid <= 0 || sid > this.offsets.length) return false;
    const off = this.offsets[sid - 1];
    return off > 0 && off < this.raw.length;
  }

  clearCache() {
    this.cache.clear();
  }
}
