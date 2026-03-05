/**
 * Loader do Tibia.dat - definições de items/outfits
 * Formato TibiaRelic 7.72 customizado com pat_z extra
 * Inclui diagnóstico de parsing para identificar problemas
 */

export interface ItemType {
  id: number;
  spriteIds: number[];
  width: number;
  height: number;
  layers: number;
  patX: number;
  patY: number;
  patZ: number;
  anim: number;
  isGround: boolean;
  isBlocking: boolean;
  isStackable: boolean;
  isFluid: boolean;
  isSplash: boolean;
  isHangable: boolean;
  isVertical: boolean;
  isHorizontal: boolean;
  dontHide: boolean;
  animateIdle: boolean;
  speed: number;
  elevation: number;
  dispX: number;
  dispY: number;
  stackPrio: number;
}

function createItemType(): ItemType {
  return {
    id: 0, spriteIds: [],
    width: 1, height: 1, layers: 1,
    patX: 1, patY: 1, patZ: 1, anim: 1,
    isGround: false, isBlocking: false,
    isStackable: false, isFluid: false, isSplash: false,
    isHangable: false, isVertical: false, isHorizontal: false,
    dontHide: false, animateIdle: false,
    speed: 0, elevation: 0, dispX: 0, dispY: 0, stackPrio: 5,
  };
}

export class DatLoader {
  items: Map<number, ItemType> = new Map();
  outfits: Map<number, ItemType> = new Map();
  effects: Map<number, ItemType> = new Map();
  missiles: Map<number, ItemType> = new Map();
  private signature = 0;

  load(data: ArrayBuffer) {
    const bytes = new Uint8Array(data);
    const view = new DataView(data);
    let p = 0;

    this.signature = view.getUint32(p, true); p += 4;
    const sigHex = '0x' + this.signature.toString(16).toUpperCase().padStart(8, '0');
    const itemMaxId = view.getUint16(p, true); p += 2;
    const outfitMaxId = view.getUint16(p, true); p += 2;
    const effectMaxId = view.getUint16(p, true); p += 2;
    const missileMaxId = view.getUint16(p, true); p += 2;

    console.log(`[DatLoader] signature=${sigHex}, fileSize=${data.byteLength}`);
    console.log(`[DatLoader] maxIds: items=${itemMaxId}, outfits=${outfitMaxId}, effects=${effectMaxId}, missiles=${missileMaxId}`);

    const itemCount = itemMaxId - 100 + 1;
    const outfitCount = outfitMaxId;
    const effectCount = effectMaxId;
    const missileCount = missileMaxId;

    let parseErrors = 0;
    const flagStats = new Map<number, number>();

    for (let i = 0; i < itemCount; i++) {
      const startP = p;
      const [it, np, flags] = this.readEntry(bytes, view, p, true);
      it.id = 100 + i;
      this.items.set(it.id, it);
      for (const f of flags) flagStats.set(f, (flagStats.get(f) || 0) + 1);
      
      // Check for suspicious dimensions
      if (it.width > 4 || it.height > 4 || it.anim > 16 || it.spriteIds.length > 256) {
        if (parseErrors < 10) {
          console.warn(`[DatLoader] ⚠ item ${it.id}: suspicious dims w=${it.width} h=${it.height} layers=${it.layers} patX=${it.patX} patY=${it.patY} patZ=${it.patZ} anim=${it.anim} sprites=${it.spriteIds.length} (parsed ${np - startP} bytes)`);
        }
        parseErrors++;
      }
      p = np;
    }
    for (let i = 0; i < outfitCount; i++) {
      const [it, np] = this.readEntry(bytes, view, p, true);
      it.id = 1 + i;
      this.outfits.set(it.id, it);
      p = np;
    }
    for (let i = 0; i < effectCount; i++) {
      const [it, np] = this.readEntry(bytes, view, p, true);
      it.id = 1 + i;
      this.effects.set(it.id, it);
      p = np;
    }
    for (let i = 0; i < missileCount; i++) {
      const [it, np] = this.readEntry(bytes, view, p, true);
      it.id = 1 + i;
      this.missiles.set(it.id, it);
      p = np;
    }

    // Log flag usage stats
    const sortedFlags = [...flagStats.entries()].sort((a, b) => a[0] - b[0]);
    console.log(`[DatLoader] Flag usage:`, sortedFlags.map(([f, c]) => `0x${f.toString(16).padStart(2, '0')}:${c}`).join(' '));
    
    if (parseErrors > 0) {
      console.warn(`[DatLoader] ⚠ ${parseErrors} items with suspicious dimensions (possible parse drift)`);
    }

    // Stats
    let totalSprites = 0;
    let zeroSpriteItems = 0;
    let maxSpriteId = 0;
    for (const [, it] of this.items) {
      if (it.spriteIds.length === 0) zeroSpriteItems++;
      for (const sid of it.spriteIds) {
        totalSprites++;
        if (sid > maxSpriteId) maxSpriteId = sid;
      }
    }
    console.log(`[DatLoader] Items: ${this.items.size} loaded, ${zeroSpriteItems} with no sprites, maxSpriteId=${maxSpriteId}`);
    console.log(`[DatLoader] Outfits: ${this.outfits.size}, Effects: ${this.effects.size}, Missiles: ${this.missiles.size}`);
    console.log(`[DatLoader] Remaining bytes after parse: ${bytes.length - p}`);

    this.verify();
  }

  private verify() {
    const itemChecks: [number, number | null][] = [[102, 42], [408, 39], [870, 559]];
    for (const [id, expectedSpr] of itemChecks) {
      const it = this.items.get(id);
      if (!it) continue;
      const spr0 = it.spriteIds[0] ?? -1;
      if (expectedSpr !== null && spr0 !== expectedSpr) {
        console.warn(`[DatLoader] ⚠ verify item ${id}: sprite[0]=${spr0}, expected=${expectedSpr}`);
      } else {
        console.log(`[DatLoader] ✓ verify item ${id}: sprite[0]=${spr0} OK`);
      }
    }
  }

  /**
   * Read a single DAT entry. Returns [ItemType, newPosition, flagsRead].
   */
  private readEntry(bytes: Uint8Array, view: DataView, p: number, hasPatZ: boolean): [ItemType, number, number[]] {
    const it = createItemType();
    const flagsRead: number[] = [];

    // Parse flags
    for (let iter = 0; iter < 100; iter++) {
      if (p >= bytes.length) break;
      const flag = bytes[p]; p++;
      if (flag === 0xFF) break;

      flagsRead.push(flag);

      if (flag === 0x00) {
        it.isGround = true; it.stackPrio = 0;
        if (p + 1 >= bytes.length) break;
        it.speed = view.getUint16(p, true); p += 2;
      } else if (flag === 0x01) { it.stackPrio = 1; }
      else if (flag === 0x02) { it.stackPrio = 2; }
      else if (flag === 0x03) { it.stackPrio = 3; }
      else if (flag === 0x04) { /* container */ }
      else if (flag === 0x05) { it.isStackable = true; }
      else if (flag === 0x06) { /* multiuse */ }
      else if (flag === 0x07) { /* boolean */ }
      else if (flag === 0x08) { if (p + 1 >= bytes.length) break; p += 2; }
      else if (flag === 0x09) { if (p + 1 >= bytes.length) break; p += 2; }
      else if (flag === 0x0A) { it.isFluid = true; }
      else if (flag === 0x0B) { it.isSplash = true; }
      else if (flag === 0x0C) { it.isBlocking = true; }
      else if (flag === 0x0D) { /* notMovable */ }
      else if (flag === 0x0E) { /* blockMissile */ }
      else if (flag === 0x0F) { /* blockPath */ }
      else if (flag === 0x10) { /* pickupable */ }
      else if (flag === 0x11) { it.isHangable = true; }
      else if (flag === 0x12) { it.isVertical = true; }
      else if (flag === 0x13) { it.isHorizontal = true; }
      else if (flag === 0x14) { /* rotateable */ }
      else if (flag === 0x15) { if (p + 3 >= bytes.length) break; p += 4; }
      else if (flag === 0x16) { it.dontHide = true; }
      else if (flag === 0x17) { /* translucent */ }
      else if (flag === 0x18) {
        if (p + 3 >= bytes.length) break;
        it.dispX = view.getUint16(p, true); it.dispY = view.getUint16(p + 2, true); p += 4;
      }
      else if (flag === 0x19) { if (p + 1 >= bytes.length) break; it.elevation = view.getUint16(p, true); p += 2; }
      else if (flag === 0x1A) { /* redrawNearbyTop */ }
      else if (flag === 0x1B) { it.animateIdle = true; }
      else if (flag === 0x1C) { if (p + 1 >= bytes.length) break; p += 2; }
      else if (flag === 0x1D) { if (p + 1 >= bytes.length) break; p += 2; }
      else if (flag === 0x1E) { /* walkable */ }
      else if (flag >= 0x1F && flag <= 0x28) { /* boolean flags */ }
      // TibiaRelic custom flags (protection for future .dat versions)
      else if (flag === 0x50) { if (p >= bytes.length) break; p += 1; }
      else if (flag === 0xC8) { if (p >= bytes.length) break; p += 1; }
      else if (flag === 0xD0) { /* custom boolean flag, no param */ }
      else { p--; break; /* unknown flag */ }
    }

    // Read dimensions
    const minBytes = hasPatZ ? 8 : 7;
    if (p + minBytes > bytes.length) return [it, p, flagsRead];

    it.width = Math.max(1, Math.min(bytes[p], 8)); p++;
    it.height = Math.max(1, Math.min(bytes[p], 8)); p++;
    if (it.width > 1 || it.height > 1) p++; // exact_size
    it.layers = Math.max(1, Math.min(bytes[p], 8)); p++;
    it.patX = Math.max(1, Math.min(bytes[p], 8)); p++;
    it.patY = Math.max(1, Math.min(bytes[p], 8)); p++;
    if (hasPatZ) {
      it.patZ = Math.max(1, Math.min(bytes[p], 8)); p++;
    } else {
      it.patZ = 1;
    }
    it.anim = Math.max(1, Math.min(bytes[p], 32)); p++;

    let n = it.anim * it.patZ * it.patY * it.patX * it.layers * it.height * it.width;
    if (n < 1 || n > 4096) n = 1;

    it.spriteIds = [];
    for (let i = 0; i < n; i++) {
      if (p + 1 >= bytes.length) break;
      it.spriteIds.push(view.getUint16(p, true)); p += 2;
    }

    return [it, p, flagsRead];
  }
}
