/**
 * Buffer helper para leitura de dados binários (porta do Python Buf)
 * With strict bounds checking to prevent silent drift.
 */

export class BufOverflowError extends Error {
  constructor(pos: number, need: number, left: number) {
    super(`Buffer overflow at pos ${pos}: need ${need} bytes, only ${left} left`);
    this.name = 'BufOverflowError';
  }
}

export class Buf {
  d: Uint8Array;
  private view: DataView;
  /** Peek at byte at given offset without advancing position */
  peekU8(offset = 0): number {
    const idx = this.pos + offset;
    return idx < this.d.length ? this.d[idx] : 0xFF;
  }
  pos: number;

  constructor(data: Uint8Array) {
    this.d = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.pos = 0;
  }

  eof(): boolean { return this.pos >= this.d.length; }
  left(): number { return this.d.length - this.pos; }

  private check(n: number) {
    if (this.pos + n > this.d.length) {
      throw new BufOverflowError(this.pos, n, this.d.length - this.pos);
    }
  }

  u8(): number {
    this.check(1);
    const v = this.d[this.pos]; this.pos++; return v;
  }

  u16(): number {
    this.check(2);
    const v = this.view.getUint16(this.pos, true); this.pos += 2; return v;
  }

  u32(): number {
    this.check(4);
    const v = this.view.getUint32(this.pos, true); this.pos += 4; return v;
  }

  peek16(): number {
    if (this.pos + 1 >= this.d.length) return 0xFFFF;
    return this.view.getUint16(this.pos, true);
  }

  str16(): string {
    const n = this.u16();
    this.check(n);
    const bytes = this.d.slice(this.pos, this.pos + n);
    this.pos += n;
    // latin-1 decode
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  skip(n: number) {
    this.pos = Math.min(this.pos + n, this.d.length);
  }

  skip16() {
    const n = this.u16();
    this.skip(n);
  }
}
