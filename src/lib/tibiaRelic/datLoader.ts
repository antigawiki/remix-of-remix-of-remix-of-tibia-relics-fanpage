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

/**
 * Payload sizes for each known DAT attribute flag.
 * 0 = boolean (no payload), N = N bytes to consume after the flag byte.
 */
const FLAG_PAYLOADS: Record<number, number> = {
  0x00: 2, // ground speed (u16)
  0x01: 0, // on-top (clip)
  0x02: 0, // on-top (bottom)
  0x03: 0, // on-top (top)
  0x04: 0, // container
  0x05: 0, // stackable
  0x06: 0, // multi-use
  0x07: 0, // force-use (boolean in 7.72)
  0x08: 2, // writeable (u16 max chars)
  0x09: 2, // writeable once (u16 max chars)
  0x0A: 0, // fluid container
  0x0B: 0, // splash
  0x0C: 0, // blocking
  0x0D: 0, // not movable
  0x0E: 0, // block missile
  0x0F: 0, // block path
  0x10: 0, // pickupable
  0x11: 0, // hangable
  0x12: 0, // vertical
  0x13: 0, // horizontal
  0x14: 0, // rotateable
  0x15: 4, // light (u16 intensity + u16 color)
  0x16: 0, // don't hide
  0x17: 0, // translucent
  0x18: 4, // displacement (u16 x + u16 y)
  0x19: 2, // elevation (u16)
  0x1A: 0, // redraw nearby top
  0x1B: 0, // animate idle
  0x1C: 2, // lens help (u16)
  0x1D: 2, // full ground (u16)
  0x1E: 0, // walkable (boolean)
};

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

    // Payload-aware flag parser — consumes each flag + its known payload
    // This prevents false 0xFF termination inside payload data
    while (p < bytes.length) {
      const flag = bytes[p]; p++;
      if (flag === 0xFF) break;
      flagsRead.push(flag);

      const payloadSize = FLAG_PAYLOADS[flag];
      if (payloadSize !== undefined) {
        // Known flag — extract metadata and advance by payload size
        this.applyFlag(flag, bytes, view, p, it);
        p += payloadSize;
      } else {
        // Unknown flag — could be boolean (0 bytes) or have unknown payload
        // For flags in 0x1F-0x4F range, treat as boolean (no payload)
        // For truly unknown flags, log and treat as boolean
        if (flag < 0x1F || flag > 0x4F) {
          console.warn(`[DatLoader] Unknown flag 0x${flag.toString(16).padStart(2, '0')} at offset ${p - 1}`);
        }
      }
    }

    // Read dimensions — use RAW values for sprite count calculation (matching reference parser)
    // Clamped values stored on the item are only for rendering safety
    if (p + 2 > bytes.length) return [it, p, flagsRead];

    const rawWidth = bytes[p]; p++;
    const rawHeight = bytes[p]; p++;
    if (rawWidth > 1 || rawHeight > 1) p++; // exact_size

    if (p + (hasPatZ ? 5 : 4) > bytes.length) return [it, p, flagsRead];

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

    // Sprite count uses RAW values — if any dimension is 0, spriteCount = 0 (no sprites to read)
    const n = rawWidth * rawHeight * rawLayers * rawPatX * rawPatY * rawPatZ * rawAnim;

    it.spriteIds = [];
    for (let i = 0; i < n; i++) {
      if (p + 1 >= bytes.length) break;
      it.spriteIds.push(view.getUint16(p, true)); p += 2;
    }

    return [it, p, flagsRead];
  }

  /**
   * Apply a single flag's metadata to the item type.
   * Position p points to the start of the payload (after the flag byte).
   */
  private applyFlag(flag: number, bytes: Uint8Array, view: DataView, p: number, it: ItemType) {
    try {
      switch (flag) {
        case 0x00: it.isGround = true; it.stackPrio = 0; if (p + 2 <= bytes.length) it.speed = view.getUint16(p, true); break;
        case 0x01: it.stackPrio = 1; break;
        case 0x02: it.stackPrio = 2; break;
        case 0x03: it.stackPrio = 3; break;
        case 0x05: it.isStackable = true; break;
        case 0x0A: it.isFluid = true; break;
        case 0x0B: it.isSplash = true; break;
        case 0x0C: it.isBlocking = true; break;
        case 0x11: it.isHangable = true; break;
        case 0x12: it.isVertical = true; break;
        case 0x13: it.isHorizontal = true; break;
        case 0x16: it.dontHide = true; break;
        case 0x18:
          if (p + 4 <= bytes.length) { it.dispX = view.getUint16(p, true); it.dispY = view.getUint16(p + 2, true); }
          break;
        case 0x19: if (p + 2 <= bytes.length) it.elevation = view.getUint16(p, true); break;
        case 0x1B: it.animateIdle = true; break;
      }
    } catch { /* ignore metadata errors */ }
  }
}
