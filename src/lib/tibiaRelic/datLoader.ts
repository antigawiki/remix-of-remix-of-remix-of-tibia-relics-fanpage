/**
 * Loader do Tibia.dat - definições de items/outfits
 * Single-pass sequential parser (no blind 0xFF scan)
 * Compatible with TibiaRelic 7.72 (extra patZ)
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
  minimapColor: number;
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
    speed: 0, elevation: 0, dispX: 0, dispY: 0, stackPrio: 5, minimapColor: 0,
  };
}

export class DatLoader {
  items: Map<number, ItemType> = new Map();
  outfits: Map<number, ItemType> = new Map();
  effects: Map<number, ItemType> = new Map();
  missiles: Map<number, ItemType> = new Map();
  private signature = 0;

  load(data: ArrayBuffer) {
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
    let parseErrors = 0;

    for (let i = 0; i < itemCount; i++) {
      const itemId = 100 + i;
      const [it, np] = this.readEntry(data, view, p);
      it.id = itemId;
      this.items.set(it.id, it);

      if (it.width > 4 || it.height > 4 || it.anim > 16 || it.spriteIds.length > 256) {
        if (parseErrors < 10) {
          console.warn(`[DatLoader] ⚠ item ${it.id}: suspicious dims w=${it.width} h=${it.height} anim=${it.anim} sprites=${it.spriteIds.length}`);
        }
        parseErrors++;
      }
      p = np;
    }
    for (let i = 0; i < outfitMaxId; i++) {
      const [it, np] = this.readEntry(data, view, p);
      it.id = 1 + i;
      this.outfits.set(it.id, it);
      p = np;
    }
    for (let i = 0; i < effectMaxId; i++) {
      const [it, np] = this.readEntry(data, view, p);
      it.id = 1 + i;
      this.effects.set(it.id, it);
      p = np;
    }
    for (let i = 0; i < missileMaxId; i++) {
      const [it, np] = this.readEntry(data, view, p);
      it.id = 1 + i;
      this.missiles.set(it.id, it);
      p = np;
    }

    if (parseErrors > 0) {
      console.warn(`[DatLoader] ⚠ ${parseErrors} items with suspicious dimensions`);
    }

    console.log(`[DatLoader] Items: ${this.items.size}, Outfits: ${this.outfits.size}, Effects: ${this.effects.size}, Missiles: ${this.missiles.size}`);
    console.log(`[DatLoader] Remaining bytes: ${data.byteLength - p}`);
    this.verify();
  }

  private verify() {
    const checks: [number, number | null][] = [[102, 42], [408, 39], [870, 559]];
    for (const [id, expectedSpr] of checks) {
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
   * Single-pass sequential parser. Reads flags one by one, consuming
   * exact payload bytes per flag. Stops only when flag === 0xFF.
   */
  private readEntry(data: ArrayBuffer, view: DataView, p: number): [ItemType, number] {
    const bytes = new Uint8Array(data);
    const it = createItemType();

    // --- Flags loop (single pass, no blind scan) ---
    while (p < bytes.length) {
      const flag = bytes[p]; p++;
      if (flag === 0xFF) break;

      switch (flag) {
        case 0x00: // Ground
          it.isGround = true; it.stackPrio = 0;
          if (p + 2 <= bytes.length) { it.speed = view.getUint16(p, true); p += 2; }
          break;
        case 0x01: it.stackPrio = 1; break; // top1
        case 0x02: it.stackPrio = 2; break; // top2
        case 0x03: it.stackPrio = 3; break; // top3
        case 0x04: break; // container
        case 0x05: it.isStackable = true; break;
        case 0x06: break; // multiuse
        case 0x07: break; // multiuse (boolean, no payload)
        case 0x08: // writable
          if (p + 2 <= bytes.length) p += 2;
          break;
        case 0x09: // writableOnce
          if (p + 2 <= bytes.length) p += 2;
          break;
        case 0x0A: it.isFluid = true; break;
        case 0x0B: it.isSplash = true; break;
        case 0x0C: it.isBlocking = true; break;
        case 0x0D: break; // notMovable
        case 0x0E: break; // blockMissile
        case 0x0F: break; // blockPath
        case 0x10: break; // pickupable
        case 0x11: it.isHangable = true; break;
        case 0x12: it.isVertical = true; break;
        case 0x13: it.isHorizontal = true; break;
        case 0x14: break; // rotateable
        case 0x15: // light
          if (p + 4 <= bytes.length) p += 4;
          break;
        case 0x16: it.dontHide = true; break;
        case 0x17: break; // translucent
        case 0x18: // displacement
          if (p + 4 <= bytes.length) {
            it.dispX = view.getUint16(p, true);
            it.dispY = view.getUint16(p + 2, true);
            p += 4;
          }
          break;
        case 0x19: // elevation
          if (p + 2 <= bytes.length) { it.elevation = view.getUint16(p, true); p += 2; }
          break;
        case 0x1A: break; // redrawNearbyTop
        case 0x1B: it.animateIdle = true; break;
        case 0x1C: // minimap color
          if (p + 2 <= bytes.length) { it.minimapColor = view.getUint16(p, true); p += 2; }
          break;
        case 0x1D: // helpAction
          if (p + 2 <= bytes.length) p += 2;
          break;
        case 0x1E: break; // fullGround
        case 0x1F: break; // look
        default:
          // Unknown flag — recovery: scan forward to next 0xFF
          console.warn(`[DatLoader] Unknown flag 0x${flag.toString(16)} at pos ${p - 1}, scanning to 0xFF`);
          while (p < bytes.length && bytes[p] !== 0xFF) p++;
          if (p < bytes.length) p++; // skip the 0xFF terminator
          // Return what we have — dimensions follow after flags
          return this.readDimensions(bytes, view, p, it);
      }
    }

    return this.readDimensions(bytes, view, p, it);
  }

  /**
   * Read dimensions and sprite IDs after the flags section.
   */
  private readDimensions(bytes: Uint8Array, view: DataView, p: number, it: ItemType): [ItemType, number] {
    if (p + 2 > bytes.length) return [it, p];

    const rawWidth = bytes[p]; p++;
    const rawHeight = bytes[p]; p++;
    if (rawWidth > 1 || rawHeight > 1) {
      if (p < bytes.length) p++; // exact_size
    }

    if (p + 5 > bytes.length) return [it, p];

    const rawLayers = bytes[p]; p++;
    const rawPatX = bytes[p]; p++;
    const rawPatY = bytes[p]; p++;
    const rawPatZ = bytes[p]; p++; // TibiaRelic always has patZ
    const rawAnim = bytes[p]; p++;

    it.width = Math.max(1, Math.min(rawWidth, 8));
    it.height = Math.max(1, Math.min(rawHeight, 8));
    it.layers = Math.max(1, Math.min(rawLayers, 8));
    it.patX = Math.max(1, Math.min(rawPatX, 8));
    it.patY = Math.max(1, Math.min(rawPatY, 8));
    it.patZ = Math.max(1, Math.min(rawPatZ, 8));
    it.anim = Math.max(1, Math.min(rawAnim, 32));

    const n = rawWidth * rawHeight * rawLayers * rawPatX * rawPatY * rawPatZ * rawAnim;

    it.spriteIds = [];
    for (let i = 0; i < n; i++) {
      if (p + 2 > bytes.length) break;
      it.spriteIds.push(view.getUint16(p, true)); p += 2;
    }

    return [it, p];
  }
}
