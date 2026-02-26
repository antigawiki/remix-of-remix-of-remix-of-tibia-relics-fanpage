/**
 * Loader do Tibia.dat - definições de items/outfits
 * Formato TibiaRelic 7.72 customizado com pat_z extra
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
    dontHide: false,
    speed: 0, elevation: 0, dispX: 0, dispY: 0, stackPrio: 5,
  };
}

export class DatLoader {
  items: Map<number, ItemType> = new Map();
  outfits: Map<number, ItemType> = new Map();

  load(data: ArrayBuffer) {
    const bytes = new Uint8Array(data);
    const view = new DataView(data);
    let p = 0;

    /* const sig = */ view.getUint32(p, true); p += 4;
    const itemMaxId = view.getUint16(p, true); p += 2;
    const outfitMaxId = view.getUint16(p, true); p += 2;
    const effectMaxId = view.getUint16(p, true); p += 2;
    const missileMaxId = view.getUint16(p, true); p += 2;

    const itemCount = itemMaxId - 100 + 1;
    const outfitCount = outfitMaxId;
    const effectCount = effectMaxId;
    const missileCount = missileMaxId;

    console.log(`[DatLoader] maxIds: items=${itemMaxId} outfits=${outfitMaxId} fx=${effectMaxId} dist=${missileMaxId} | counts: items=${itemCount} outfits=${outfitCount} fx=${effectCount} dist=${missileCount}`);

    for (let i = 0; i < itemCount; i++) {
      const [it, np] = this.readEntry(bytes, view, p, true);
      it.id = 100 + i;
      this.items.set(it.id, it);
      p = np;
    }
    for (let i = 0; i < outfitCount; i++) {
      const [it, np] = this.readEntry(bytes, view, p, true);
      it.id = 1 + i;
      this.outfits.set(it.id, it);
      p = np;
    }
    for (let i = 0; i < effectCount + missileCount; i++) {
      const [, np] = this.readEntry(bytes, view, p, true);
      p = np;
    }

    // Verification checks
    this.verify();
  }

  private verify() {
    const itemChecks: [number, number | null][] = [[102, 42], [408, 39], [870, 559]];
    for (const [id, expectedSpr] of itemChecks) {
      const it = this.items.get(id);
      if (!it) { console.warn(`[DatLoader] MISSING item ${id}`); continue; }
      const spr0 = it.spriteIds[0] ?? -1;
      if (expectedSpr !== null && spr0 !== expectedSpr) {
        console.warn(`[DatLoader] item ${id}: sprite[0]=${spr0}, expected=${expectedSpr} — flags may be wrong`);
      } else {
        console.log(`[DatLoader] item ${id}: sprite[0]=${spr0} ✓`);
      }
    }

    // Verify known outfits — Rotworm looktype ~36 should have sprites around 2962-2965
    const outfitChecks: [number, string][] = [[36, 'Rotworm'], [1, 'First outfit']];
    for (const [id, name] of outfitChecks) {
      const ot = this.outfits.get(id);
      if (!ot) { console.warn(`[DatLoader] MISSING outfit ${id} (${name})`); continue; }
      console.log(`[DatLoader] outfit ${id} (${name}): sprites=${ot.spriteIds.slice(0, 8).join(',')}, dims=${ot.width}x${ot.height}, layers=${ot.layers}, patX=${ot.patX}, patY=${ot.patY}, patZ=${ot.patZ}, anim=${ot.anim}`);
    }
  }

  /**
   * Read a single DAT entry (item, outfit, effect, or distance).
   * @param hasPatZ - true for items (TibiaRelic extra field), false for outfits/fx/dist
   */
  private readEntry(bytes: Uint8Array, view: DataView, p: number, hasPatZ: boolean): [ItemType, number] {
    const it = createItemType();

    // Parse flags
    for (let iter = 0; iter < 100; iter++) {
      if (p >= bytes.length) break;
      const flag = bytes[p]; p++;
      if (flag === 0xFF) break;

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
      else if (flag === 0x1B) { /* animateIdle */ }
      else if (flag === 0x1C) { if (p + 1 >= bytes.length) break; p += 2; }
      else if (flag === 0x1D) { if (p + 1 >= bytes.length) break; p += 2; }
      else if (flag === 0x1E) { /* walkable */ }
      else if (flag >= 0x1F && flag <= 0x28) { /* boolean flags */ }
      else { p--; break; /* unknown flag */ }
    }

    // Read dimensions — need at least 6 bytes (w,h,layers,patX,patY,anim) or 7 with patZ
    const minBytes = hasPatZ ? 8 : 7;
    if (p + minBytes > bytes.length) return [it, p];

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

    return [it, p];
  }
}
