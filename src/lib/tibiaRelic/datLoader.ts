/**
 * Loader do Tibia.dat - definições de items/outfits
 * Formato Tibia 7.72 com patZ extra (TibiaRelic)
 * 
 * Single-pass parser inteligente: lê payloads corretos por flag,
 * evitando o bug do "blind scan" onde 0xFF em payloads era
 * interpretado como terminador de atributos.
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

/**
 * Payload size table for Tibia 7.72 DAT flags.
 * Returns the number of bytes to read AFTER the flag byte.
 * -1 means unknown flag (triggers recovery).
 */
function getFlagPayloadSize(flag: number): number {
  switch (flag) {
    case 0x00: return 2;  // ground: u16 speed
    case 0x01: return 0;  // groundBorder
    case 0x02: return 0;  // onBottom
    case 0x03: return 0;  // onTop
    case 0x04: return 0;  // container
    case 0x05: return 0;  // stackable
    case 0x06: return 0;  // forceUse
    case 0x07: return 0;  // multiUse
    case 0x08: return 2;  // writable: u16 maxTextLen
    case 0x09: return 2;  // writableOnce: u16 maxTextLen
    case 0x0A: return 0;  // fluidContainer
    case 0x0B: return 0;  // splash
    case 0x0C: return 0;  // blocking
    case 0x0D: return 0;  // immovable
    case 0x0E: return 0;  // blockMissiles
    case 0x0F: return 0;  // blockPathfinder
    case 0x10: return 0;  // noMoveAnimation
    case 0x11: return 0;  // pickupable
    case 0x12: return 0;  // hangable
    case 0x13: return 0;  // horizontal
    case 0x14: return 0;  // vertical
    case 0x15: return 0;  // rotatable
    case 0x16: return 4;  // light: u16 intensity + u16 color
    case 0x17: return 0;  // dontHide
    case 0x18: return 0;  // translucent
    case 0x19: return 4;  // displacement: u16 x + u16 y
    case 0x1A: return 2;  // elevation: u16
    case 0x1B: return 0;  // lyingCorpse
    case 0x1C: return 0;  // animateAlways
    case 0x1D: return 2;  // minimapColor: u16
    case 0x1E: return 2;  // lensHelp: u16
    case 0x1F: return 0;  // fullGround
    case 0x20: return 0;  // look (ignoreLook)
    case 0x21: return 2;  // cloth: u16
    case 0x22: return 4;  // market: u16 + u16
    case 0x23: return 1;  // defaultAction: u8
    case 0x24: return 0;  // usable
    case 0x25: return 0;  // wrappable
    case 0x26: return 0;  // unwrappable
    case 0x27: return 0;  // topEffect
    case 0x28: return 0;  // usable2
    default: return -1;   // unknown
  }
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
    let parseErrors = 0;
    let recoveryCount = 0;

    // Parse items (start at id 100)
    for (let i = 0; i < itemCount; i++) {
      const [it, np, recovered] = this.readEntry(bytes, view, p, true);
      it.id = 100 + i;
      this.items.set(it.id, it);
      if (recovered) recoveryCount++;
      if (it.width > 4 || it.height > 4 || it.anim > 16 || it.spriteIds.length > 256) {
        if (parseErrors < 10) {
          console.warn(`[DatLoader] ⚠ item ${it.id}: w=${it.width} h=${it.height} layers=${it.layers} patX=${it.patX} patY=${it.patY} patZ=${it.patZ} anim=${it.anim} sprites=${it.spriteIds.length}`);
        }
        parseErrors++;
      }
      p = np;
    }

    // Parse outfits, effects, missiles
    for (let i = 0; i < outfitMaxId; i++) {
      const [it, np] = this.readEntry(bytes, view, p, true);
      it.id = 1 + i;
      this.outfits.set(it.id, it);
      p = np;
    }
    for (let i = 0; i < effectMaxId; i++) {
      const [it, np] = this.readEntry(bytes, view, p, true);
      it.id = 1 + i;
      this.effects.set(it.id, it);
      p = np;
    }
    for (let i = 0; i < missileMaxId; i++) {
      const [it, np] = this.readEntry(bytes, view, p, true);
      it.id = 1 + i;
      this.missiles.set(it.id, it);
      p = np;
    }

    if (parseErrors > 0) {
      console.warn(`[DatLoader] ⚠ ${parseErrors} items with suspicious dimensions`);
    }
    if (recoveryCount > 0) {
      console.warn(`[DatLoader] ⚠ ${recoveryCount} entries used 0xFF recovery (unknown flags)`);
    }

    // Stats
    let maxSpriteId = 0;
    let zeroSpriteItems = 0;
    for (const [, it] of this.items) {
      if (it.spriteIds.length === 0) zeroSpriteItems++;
      for (const sid of it.spriteIds) {
        if (sid > maxSpriteId) maxSpriteId = sid;
      }
    }
    console.log(`[DatLoader] Items: ${this.items.size}, ${zeroSpriteItems} with no sprites, maxSpriteId=${maxSpriteId}`);
    console.log(`[DatLoader] Outfits: ${this.outfits.size}, Effects: ${this.effects.size}, Missiles: ${this.missiles.size}`);
    console.log(`[DatLoader] Remaining bytes: ${bytes.length - p}`);

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
   * Read a single DAT entry with intelligent flag parsing.
   * Returns [ItemType, newPosition, usedRecovery].
   */
  private readEntry(bytes: Uint8Array, view: DataView, p: number, hasPatZ: boolean): [ItemType, number, boolean] {
    const it = createItemType();
    let usedRecovery = false;

    // Phase 1: Parse flags intelligently using known payload sizes
    while (p < bytes.length) {
      const flag = bytes[p]; p++;
      if (flag === 0xFF) break; // end of attributes

      const payloadSize = getFlagPayloadSize(flag);

      if (payloadSize === -1) {
        // Unknown flag — recovery: scan forward for 0xFF
        console.warn(`[DatLoader] Unknown flag 0x${flag.toString(16).padStart(2, '0')} at pos ${p - 1}, scanning for 0xFF`);
        usedRecovery = true;
        while (p < bytes.length) {
          if (bytes[p] === 0xFF) { p++; break; }
          p++;
        }
        break; // stop attribute parsing, move to dimensions
      }

      // Extract metadata from known flags
      this.applyFlag(view, p, flag, it);

      // Skip payload bytes
      p += payloadSize;
    }

    // Phase 2: Read dimensions
    if (p + 2 > bytes.length) return [it, p, usedRecovery];

    const rawWidth = bytes[p]; p++;
    const rawHeight = bytes[p]; p++;
    if (rawWidth > 1 || rawHeight > 1) p++; // exact_size

    if (p + (hasPatZ ? 5 : 4) > bytes.length) return [it, p, usedRecovery];

    const rawLayers = bytes[p]; p++;
    const rawPatX = bytes[p]; p++;
    const rawPatY = bytes[p]; p++;
    let rawPatZ = 1;
    if (hasPatZ) { rawPatZ = bytes[p]; p++; }
    const rawAnim = bytes[p]; p++;

    // Store clamped values for rendering
    it.width = Math.max(1, Math.min(rawWidth, 8));
    it.height = Math.max(1, Math.min(rawHeight, 8));
    it.layers = Math.max(1, Math.min(rawLayers, 8));
    it.patX = Math.max(1, Math.min(rawPatX, 8));
    it.patY = Math.max(1, Math.min(rawPatY, 8));
    it.patZ = Math.max(1, Math.min(rawPatZ, 8));
    it.anim = Math.max(1, Math.min(rawAnim, 32));

    // Sprite count uses raw values
    const n = rawWidth * rawHeight * rawLayers * rawPatX * rawPatY * rawPatZ * rawAnim;

    it.spriteIds = [];
    for (let i = 0; i < n; i++) {
      if (p + 1 >= bytes.length) break;
      it.spriteIds.push(view.getUint16(p, true)); p += 2;
    }

    return [it, p, usedRecovery];
  }

  /**
   * Apply metadata from a known flag to the ItemType.
   * Does NOT advance position — caller handles that via payload size.
   */
  private applyFlag(view: DataView, p: number, flag: number, it: ItemType) {
    switch (flag) {
      case 0x00: it.isGround = true; it.stackPrio = 0; it.speed = view.getUint16(p, true); break;
      case 0x01: it.stackPrio = 1; break;
      case 0x02: it.stackPrio = 2; break;
      case 0x03: it.stackPrio = 3; break;
      case 0x05: it.isStackable = true; break;
      case 0x0A: it.isFluid = true; break;
      case 0x0B: it.isSplash = true; break;
      case 0x0C: it.isBlocking = true; break;
      case 0x12: it.isHangable = true; break;
      case 0x13: it.isHorizontal = true; break;
      case 0x14: it.isVertical = true; break;
      case 0x17: it.dontHide = true; break;
      case 0x19: it.dispX = view.getUint16(p, true); it.dispY = view.getUint16(p + 2, true); break;
      case 0x1A: it.elevation = view.getUint16(p, true); break;
      case 0x1C: it.animateIdle = true; break;
    }
  }
}
