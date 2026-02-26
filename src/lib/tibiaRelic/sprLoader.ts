/**
 * Loader do Tibia.spr - decodifica sprites RLE para ImageData
 * Formato: u32 signature + u16 count + u32[] offsets + sprite data (RLE)
 */

const SPR_SIZE = 32;

export class SprLoader {
  private raw: Uint8Array = new Uint8Array(0);
  private view: DataView = new DataView(new ArrayBuffer(0));
  private offsets: number[] = [];
  private cache: Map<number, ImageData | null> = new Map();
  count = 0;

  load(data: ArrayBuffer) {
    this.raw = new Uint8Array(data);
    this.view = new DataView(data);

    // Try u16 count first (standard 7.x), then u32 (some custom servers)
    const countU16 = this.view.getUint16(4, true);
    const countU32 = this.view.getUint32(4, true);

    // Heuristic: if u32 count makes sense (header + offsets fit in file), prefer it
    // u16 header: 4 (sig) + 2 (count) + count*4 (offsets)
    // u32 header: 4 (sig) + 4 (count) + count*4 (offsets)
    const u16HeaderEnd = 6 + countU16 * 4;
    const u32HeaderEnd = 8 + countU32 * 4;

    let useU32 = false;
    if (countU32 > countU16 && u32HeaderEnd < data.byteLength && countU32 < 200000) {
      // Validate: first few u32-based offsets should point within the file
      const testOff = this.view.getUint32(8, true);
      if (testOff > u32HeaderEnd && testOff < data.byteLength) {
        useU32 = true;
      }
    }

    if (useU32) {
      this.count = countU32;
      this.offsets = [];
      for (let i = 0; i < this.count; i++) {
        this.offsets.push(this.view.getUint32(8 + i * 4, true));
      }
      console.log(`[SprLoader] u32 count=${this.count}, offsets start at 8`);
    } else {
      this.count = countU16;
      this.offsets = [];
      for (let i = 0; i < this.count; i++) {
        this.offsets.push(this.view.getUint32(6 + i * 4, true));
      }
      console.log(`[SprLoader] u16 count=${this.count}, offsets start at 6`);
    }
  }

  getSprite(sid: number): ImageData | null {
    if (sid <= 0 || sid > this.offsets.length) return null;
    if (this.cache.has(sid)) return this.cache.get(sid)!;

    const off = this.offsets[sid - 1];
    if (off === 0) { this.cache.set(sid, null); return null; }

    const raw = this.raw;
    if (off + 5 > raw.length) { this.cache.set(sid, null); return null; }

    // Skip 3 legacy "color key" bytes (not used for filtering)
    // Transparency is handled by RLE encoding itself
    const sz = this.view.getUint16(off + 3, true);
    if (sz === 0) { this.cache.set(sid, null); return null; }

    const N = SPR_SIZE * SPR_SIZE;
    const px = new Uint8ClampedArray(N * 4); // RGBA, starts at 0 (transparent)

    let p = off + 5;
    let pixel = 0;
    const end = off + 5 + sz;

    while (pixel < N && p < end - 3) {
      if (p + 3 >= raw.length) break;
      const tr = this.view.getUint16(p, true); p += 2;
      const cl = this.view.getUint16(p, true); p += 2;
      pixel += tr;
      for (let j = 0; j < cl; j++) {
        if (pixel >= N || p + 2 >= raw.length) break;
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

  clearCache() {
    this.cache.clear();
  }
}
