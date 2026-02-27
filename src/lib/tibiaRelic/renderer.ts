/**
 * Renderer Canvas - draws game viewport
 * Multi-floor rendering with NW perspective offset, elevation, stack priority passes, and outfit tinting
 * Color system: 8-bit color conversion matching tibiarc/OTClient (6x6x6 RGB cube)
 * Mask channels: Head=Yellow, Body=Red, Legs=Green, Feet=Blue (OTClient standard)
 */
import { SprLoader } from './sprLoader';
import { DatLoader, type ItemType } from './datLoader';
import { GameState, type TileItem, type Creature } from './gameState';

const VP_W = 15, VP_H = 11;
const TILE_PX = 32;
const NATIVE_W = VP_W * TILE_PX; // 480
const NATIVE_H = VP_H * TILE_PX; // 352
const DIR_MAP: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };

/**
 * OTClient/tibiarc HSI-to-RGB outfit color algorithm.
 * 133 colors: 19 hue steps × 7 saturation/intensity levels.
 * Indices that are multiples of 19 are grayscale.
 */
const HSI_H_STEPS = 19;
const HSI_SI_VALUES = 7;
const HSI_SI_PAIRS: [number, number][] = [
  [0.25, 1.00],  // group 0: light, low saturation
  [0.25, 0.75],  // group 1
  [0.50, 0.75],  // group 2
  [0.667, 0.75], // group 3
  [1.00, 1.00],  // group 4: vivid
  [1.00, 0.75],  // group 5
  [1.00, 0.50],  // group 6: dark
];

function hsiToRgb(h: number, s: number, i: number): [number, number, number] {
  // h in [0,1), s in [0,1], i in [0,1]
  const hDeg = h * 360;
  let r: number, g: number, b: number;

  if (hDeg < 120) {
    const hRad = (hDeg * Math.PI) / 180;
    const cos60 = Math.cos(((60 - hDeg) * Math.PI) / 180);
    const cosH = Math.cos(hRad);
    b = i * (1 - s);
    r = i * (1 + (s * cos60) / Math.cos(((60 * Math.PI) / 180) - hRad));
    g = 3 * i - (r + b);
  } else if (hDeg < 240) {
    const hShift = hDeg - 120;
    const hRad = (hShift * Math.PI) / 180;
    r = i * (1 - s);
    g = i * (1 + (s * Math.cos(((60 - hShift) * Math.PI) / 180)) / Math.cos(((60 * Math.PI) / 180) - hRad));
    b = 3 * i - (r + g);
  } else {
    const hShift = hDeg - 240;
    const hRad = (hShift * Math.PI) / 180;
    g = i * (1 - s);
    b = i * (1 + (s * Math.cos(((60 - hShift) * Math.PI) / 180)) / Math.cos(((60 * Math.PI) / 180) - hRad));
    r = 3 * i - (g + b);
  }

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(b * 255))),
  ];
}

function getOutfitColor(color: number): [number, number, number] {
  if (color < 0 || color >= HSI_H_STEPS * HSI_SI_VALUES) return [255, 255, 255];

  if (color % HSI_H_STEPS === 0) {
    // Grayscale
    const groupIndex = color / HSI_H_STEPS;
    const intensity = 1.0 - groupIndex / HSI_SI_VALUES;
    const v = Math.max(0, Math.min(255, Math.round(intensity * 255)));
    return [v, v, v];
  }

  const group = Math.floor(color / HSI_H_STEPS);
  const hueIndex = color % HSI_H_STEPS;
  const hue = (hueIndex - 1) / (HSI_H_STEPS - 1);
  const [sat, int] = HSI_SI_PAIRS[group];

  return hsiToRgb(hue, sat, int);
}

/** Logged outfit IDs that were not found in DAT (log once per ID) */
const _missingOutfitWarned = new Set<number>();

export class Renderer {
  private tick = 0;
  private lastDrawTime = 0;
  private spriteCanvasCache: Map<string, HTMLCanvasElement | null> = new Map();
  private tintCache: Map<string, HTMLCanvasElement | null> = new Map();

  /** Offscreen canvas for native-resolution rendering (480x352) */
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;

  /** HUD entries collected during draw, rendered after upscale */
  private hudEntries: Array<{ px: number; py: number; c: Creature }> = [];

  public floorOverride: number | null = null;
  public smoothUpscale: boolean = true;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private spr: SprLoader,
    private dat: DatLoader,
    public gs: GameState,
  ) {
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = NATIVE_W;
    this.offscreen.height = NATIVE_H;
    this.offCtx = this.offscreen.getContext('2d')!;
    this.offCtx.imageSmoothingEnabled = false;
  }

  incTick() {
    this.tick++;
    this.lastDrawTime = performance.now();
  }

  draw(canvasWidth: number, canvasHeight: number) {
    const g = this.gs;
    const displayCtx = this.ctx;
    const oc = this.offCtx;

    // Clear display canvas
    displayCtx.fillStyle = '#1a2420';
    displayCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (!g.mapLoaded) {
      this.drawIdle(canvasWidth, canvasHeight);
      return;
    }

    // Clear offscreen at native resolution
    oc.fillStyle = '#1a2420';
    oc.fillRect(0, 0, NATIVE_W, NATIVE_H);

    const z = this.floorOverride ?? g.camZ;
    const now = this.lastDrawTime || performance.now();
    const ph = Math.floor(now / 200) % 4; // time-based animation: 200ms per frame
    this.hudEntries = [];

    // Smooth camera follow: apply player's walk offset to entire viewport
    let camOffX = 0, camOffY = 0;
    const player = g.playerId ? g.creatures.get(g.playerId) : undefined;
    if (player && player.walking && now < player.walkEndTick) {
      const progress = Math.min(1, (now - player.walkStartTick) / player.walkDuration);
      camOffX = Math.round(player.walkOffsetX * (1 - progress));
      camOffY = Math.round(player.walkOffsetY * (1 - progress));
    }

    // Determine visible floors
    const floors = this.getVisibleFloors(z);

    // Draw each floor with stack-priority passes
    for (const fz of floors) {
      const offset = z - fz;
      const cx0 = g.camX - 8 + offset;
      const cy0 = g.camY - 6 + offset;

      for (let ty = -1; ty < VP_H + 3; ty++) {
        for (let tx = -1; tx < VP_W + 3; tx++) {
          const wx = cx0 + tx;
          const wy = cy0 + ty;
          const items = g.getTile(wx, wy, fz);
          if (items.length === 0) continue;

          const bx = tx * TILE_PX + camOffX;
          const by = ty * TILE_PX + camOffY;

          // Pass 1: Ground + clip + bottom (stackPrio 0, 1, 2)
          let elevationOffset = 0;
          for (const item of items) {
            if (item[0] === 'cr') continue;
            const it = this.dat.items.get(item[1]);
            if (!it || it.stackPrio > 2) continue;
            this.drawItemNative(it, bx, by, elevationOffset, ph, wx, wy);
            if (it.elevation > 0) elevationOffset += it.elevation;
          }

          // Pass 2: Regular items (stackPrio 5, default)
          for (const item of items) {
            if (item[0] === 'cr') continue;
            const it = this.dat.items.get(item[1]);
            if (!it || it.stackPrio <= 2 || it.stackPrio === 3) continue;
            this.drawItemNative(it, bx, by, elevationOffset, ph, wx, wy);
            if (it.elevation > 0) elevationOffset += it.elevation;
          }

          // Pass 3: Creatures
          for (const item of items) {
            if (item[0] !== 'cr') continue;
            const c = g.creatures.get(item[1]);
            if (c) {
              this.drawCreatureNative(c, bx, by - elevationOffset);
            }
          }

          // Pass 4: Top items (stackPrio 3)
          for (const item of items) {
            if (item[0] === 'cr') continue;
            const it = this.dat.items.get(item[1]);
            if (!it || it.stackPrio !== 3) continue;
            this.drawItemNative(it, bx, by, elevationOffset, ph, wx, wy);
          }
        }
      }
    }

    // Upscale offscreen to display canvas
    displayCtx.imageSmoothingEnabled = this.smoothUpscale;
    if (this.smoothUpscale) {
      (displayCtx as any).imageSmoothingQuality = 'high';
    }
    displayCtx.drawImage(this.offscreen, 0, 0, NATIVE_W, NATIVE_H, 0, 0, canvasWidth, canvasHeight);

    // Compute scale factor for HUD positioning on display canvas
    const scaleX = canvasWidth / NATIVE_W;
    const scaleY = canvasHeight / NATIVE_H;

    // Draw creature HUDs AFTER upscale on the display canvas (high-res text)
    // Recompute camera offset for HUD positioning
    let hudCamOffX = 0, hudCamOffY = 0;
    if (player && player.walking && now < player.walkEndTick) {
      const progress = Math.min(1, (now - player.walkStartTick) / player.walkDuration);
      hudCamOffX = player.walkOffsetX * (1 - progress);
      hudCamOffY = player.walkOffsetY * (1 - progress);
    }
    for (const c of g.creatures.values()) {
      if (c.z !== z) continue;
      const tx2 = c.x - (g.camX - 8);
      const ty2 = c.y - (g.camY - 6);
      if (tx2 >= -2 && tx2 <= VP_W + 3 && ty2 >= -2 && ty2 <= VP_H + 3) {
        const tileItems = g.getTile(c.x, c.y, z);
        let elev = 0;
        for (const ti of tileItems) {
          if (ti[0] === 'it') {
            const it = this.dat.items.get(ti[1]);
            if (it && it.elevation > 0) elev += it.elevation;
          }
        }
        // Interpolate walk offset for HUD positioning
        let hudOx = hudCamOffX, hudOy = hudCamOffY;
        if (c.walking && now < c.walkEndTick) {
          const progress = Math.min(1, (now - c.walkStartTick) / c.walkDuration);
          hudOx += c.walkOffsetX * (1 - progress);
          hudOy += c.walkOffsetY * (1 - progress);
        }
        const sx = (tx2 * TILE_PX + hudOx) * scaleX;
        const sy = (ty2 * TILE_PX - elev + hudOy) * scaleY;
        this.drawCreatureHudHiRes(sx, sy, c, TILE_PX * scaleX, TILE_PX * scaleY);
      }
    }
  }

  private getVisibleFloors(z: number): number[] {
    if (z <= 7) {
      const firstFloor = this.calcFirstVisibleFloor(z);
      const floors: number[] = [];
      for (let fz = 7; fz >= firstFloor; fz--) {
        floors.push(fz);
      }
      return floors;
    } else {
      const bottomFloor = Math.min(z + 2, 15);
      const topFloor = Math.max(z - 2, 8);
      const floors: number[] = [];
      for (let fz = bottomFloor; fz >= topFloor; fz--) {
        floors.push(fz);
      }
      return floors;
    }
  }

  /**
   * OTClient/tibiarc-style first visible floor detection.
   * Checks tiles above the camera for roof/ground coverage.
   * Also considers NW diagonal offset (covered-up perspective) and dontHide flag.
   */
  private calcFirstVisibleFloor(z: number): number {
    if (z > 7) return Math.max(z - 2, 8);

    let firstFloor = 0;
    const g = this.gs;

    // Check a 3x3 area around camera position
    for (let ix = -1; ix <= 1; ix++) {
      for (let iy = -1; iy <= 1; iy++) {
        for (let dz = 1; dz <= z; dz++) {
          const checkZ = z - dz;

          // Direct position above
          const tile1 = g.getTile(g.camX + ix, g.camY + iy, checkZ);
          if (this.tileCoversFloor(tile1)) {
            firstFloor = Math.max(firstFloor, checkZ + 1);
          }

          // NW offset position (covered up perspective)
          const tile2 = g.getTile(g.camX + ix - dz, g.camY + iy - dz, checkZ);
          if (this.tileCoversFloor(tile2)) {
            firstFloor = Math.max(firstFloor, checkZ + 1);
          }
        }
      }
    }

    return firstFloor;
  }

  /**
   * Check if a tile covers floors below (acts as roof/ceiling).
   * Considers ground tiles and stack priority 2 items, but respects dontHide flag.
   */
  private tileCoversFloor(items: TileItem[]): boolean {
    for (const item of items) {
      if (item[0] !== 'it') continue;
      const it = this.dat.items.get(item[1]);
      if (!it) continue;
      if (it.dontHide) continue;
      if (it.isGround || it.stackPrio === 2) return true;
    }
    return false;
  }

  /** Draw item at native 32px resolution on offscreen canvas */
  private drawItemNative(it: ItemType, bx: number, by: number, elevationOffset: number, ph: number, wx: number, wy: number) {
    const oc = this.offCtx;
    for (let th = 0; th < it.height; th++) {
      for (let tw = 0; tw < it.width; tw++) {
        const sid = this.getSpriteIndex(it, ph, wx, wy, tw, th);
        const sprCanvas = this.getNativeSprite(sid);
        if (sprCanvas) {
          const dx = bx - tw * TILE_PX + it.dispX;
          const dy = by - th * TILE_PX + it.dispY - elevationOffset;
          if (dx > -TILE_PX * 2 && dx < NATIVE_W + TILE_PX && dy > -TILE_PX * 2 && dy < NATIVE_H + TILE_PX) {
            oc.drawImage(sprCanvas, dx, dy);
          }
        }
      }
    }
  }

  /** Draw creature at native 32px resolution on offscreen canvas */
  private drawCreatureNative(c: Creature, bx: number, by: number) {
    const now = this.lastDrawTime || performance.now();

    // Interpolate walk offset
    let ox = 0, oy = 0;
    if (c.walking) {
      if (now >= c.walkEndTick) {
        c.walking = false;
        c.walkOffsetX = 0;
        c.walkOffsetY = 0;
      } else {
        const progress = Math.min(1, (now - c.walkStartTick) / c.walkDuration);
        ox = Math.round(c.walkOffsetX * (1 - progress));
        oy = Math.round(c.walkOffsetY * (1 - progress));
      }
    }
    bx += ox;
    by += oy;

    if (c.outfit === 0 && c.outfitItem > 0) {
      const it = this.dat.items.get(c.outfitItem);
      if (it) {
        this.drawItemNative(it, bx, by, 0, 0, c.x, c.y);
        return;
      }
    }

    const ot = this.dat.outfits.get(c.outfit);
    const oc = this.offCtx;
    let rendered = false;

    if (!ot && c.outfit > 0 && !_missingOutfitWarned.has(c.outfit)) {
      _missingOutfitWarned.add(c.outfit);
      console.warn(`[Renderer] Outfit ID ${c.outfit} not found in DAT (creature: ${c.name})`);
    }

    if (ot && ot.spriteIds.length > 0) {
      const xd = DIR_MAP[c.direction] ?? 0;
      const A = Math.max(1, ot.anim), PZ = Math.max(1, ot.patZ), PY = Math.max(1, ot.patY);
      const PX = Math.max(1, ot.patX), L = Math.max(1, ot.layers), H = ot.height, W = ot.width;

      let a: number;
      if (ot.animateIdle) {
        a = Math.floor(now / 200) % A; // time-based: 200ms per frame
      } else if (c.walking) {
        if (A <= 2) {
          a = Math.floor(now / 150) % A;
        } else {
          a = (Math.floor(now / 150) % (A - 1)) + 1;
        }
      } else {
        a = 0;
      }

      for (let py = 0; py < PY; py++) {
        for (let th = 0; th < H; th++) {
          for (let tw = 0; tw < W; tw++) {
            const patX = xd % PX;
            const idx = ((((((a * PZ + 0) * PY + py) * PX + patX) * L + 0) * H + th) * W + tw);
            let sid = (idx < ot.spriteIds.length) ? ot.spriteIds[idx] : 0;
            let sprCanvas = this.getNativeSprite(sid);
            // Frame 0 fallback if current animation frame has no sprite
            if (!sprCanvas && a > 0) {
              const idx0 = ((((((0 * PZ + 0) * PY + py) * PX + patX) * L + 0) * H + th) * W + tw);
              const sid0 = (idx0 < ot.spriteIds.length) ? ot.spriteIds[idx0] : 0;
              sprCanvas = this.getNativeSprite(sid0);
            }
            if (sprCanvas) {
              const dx = bx - tw * TILE_PX - ot.dispX;
              const dy = by - th * TILE_PX - ot.dispY;
              oc.drawImage(sprCanvas, dx, dy);
              rendered = true;
            }
          }
        }

        if (L >= 2) {
          for (let th = 0; th < H; th++) {
            for (let tw = 0; tw < W; tw++) {
              const patX = xd % PX;
              // Get mask sprite (layer 1)
              const maskIdx = ((((((a * PZ + 0) * PY + py) * PX + patX) * L + 1) * H + th) * W + tw);
              let maskSid = (maskIdx < ot.spriteIds.length) ? ot.spriteIds[maskIdx] : 0;
              let maskCanvas = this.getNativeSprite(maskSid);
              if (!maskCanvas && a > 0) {
                const maskIdx0 = ((((((0 * PZ + 0) * PY + py) * PX + patX) * L + 1) * H + th) * W + tw);
                const maskSid0 = (maskIdx0 < ot.spriteIds.length) ? ot.spriteIds[maskIdx0] : 0;
                maskCanvas = this.getNativeSprite(maskSid0);
                if (maskCanvas) maskSid = maskSid0;
              }
              // Get base sprite (layer 0) for luminance/shading
              const baseIdx = ((((((a * PZ + 0) * PY + py) * PX + patX) * L + 0) * H + th) * W + tw);
              let baseSid = (baseIdx < ot.spriteIds.length) ? ot.spriteIds[baseIdx] : 0;
              let baseCanvas = this.getNativeSprite(baseSid);
              if (!baseCanvas && a > 0) {
                const baseIdx0 = ((((((0 * PZ + 0) * PY + py) * PX + patX) * L + 0) * H + th) * W + tw);
                const baseSid0 = (baseIdx0 < ot.spriteIds.length) ? ot.spriteIds[baseIdx0] : 0;
                baseCanvas = this.getNativeSprite(baseSid0);
              }
              if (maskCanvas) {
                const dx = bx - tw * TILE_PX - ot.dispX;
                const dy = by - th * TILE_PX - ot.dispY;
                this.drawTintedLayerNative(maskCanvas, dx, dy, c, maskSid, baseCanvas);
                rendered = true;
              }
            }
          }
        }
      }
    }

    if (!rendered) {
      const isPlayer = c.id === this.gs.playerId;
      // Highly visible fallback: solid outline + X
      const color = isPlayer ? '#64c8ff' : '#ffcc64';
      oc.strokeStyle = color;
      oc.lineWidth = 2;
      oc.strokeRect(bx + 4, by + 4, TILE_PX - 8, TILE_PX - 8);
      oc.beginPath();
      oc.moveTo(bx + 6, by + 6);
      oc.lineTo(bx + TILE_PX - 6, by + TILE_PX - 6);
      oc.moveTo(bx + TILE_PX - 6, by + 6);
      oc.lineTo(bx + 6, by + TILE_PX - 6);
      oc.stroke();
      oc.lineWidth = 1;
    }
  }

  /**
   * OTClient-style outfit tinting: mask (layer 1) determines body region,
   * base sprite (layer 0) provides luminance/shading for 3D detail.
   * Result = outfitColor * baseLuminance, preserving volume and shadows.
   */
  private drawTintedLayerNative(maskCanvas: HTMLCanvasElement, dx: number, dy: number, c: Creature, spriteId?: number, baseCanvas?: HTMLCanvasElement | null) {
    const baseSuffix = baseCanvas ? `_b${(baseCanvas as any).__sid ?? 'y'}` : '_nb';
    const cacheKey = `tint2_${spriteId ?? 'unk'}_${c.head}_${c.body}_${c.legs}_${c.feet}${baseSuffix}`;

    let cached = this.tintCache.get(cacheKey);
    if (cached === undefined) {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = TILE_PX;
      tmpCanvas.height = TILE_PX;
      const tmpCtx = tmpCanvas.getContext('2d')!;

      // Read mask pixels
      tmpCtx.drawImage(maskCanvas, 0, 0);
      const maskData = tmpCtx.getImageData(0, 0, TILE_PX, TILE_PX);
      const mask = maskData.data;

      // Read base pixels for luminance (if available)
      let base: Uint8ClampedArray | null = null;
      if (baseCanvas) {
        const baseCtx = document.createElement('canvas');
        baseCtx.width = TILE_PX;
        baseCtx.height = TILE_PX;
        const bCtx = baseCtx.getContext('2d')!;
        bCtx.drawImage(baseCanvas, 0, 0);
        base = bCtx.getImageData(0, 0, TILE_PX, TILE_PX).data;
      }

      const headColor = getOutfitColor(c.head);
      const bodyColor = getOutfitColor(c.body);
      const legsColor = getOutfitColor(c.legs);
      const feetColor = getOutfitColor(c.feet);

      for (let i = 0; i < mask.length; i += 4) {
        const r = mask[i], g = mask[i + 1], b = mask[i + 2], a = mask[i + 3];
        if (a === 0) continue;

        let color: [number, number, number] | null = null;

        // Detect mask channel: Yellow=Head, Red=Body, Green=Legs, Blue=Feet
        const maxC = Math.max(r, g, b);
        if (maxC < 2) { mask[i + 3] = 0; continue; }

        if (r > 2 && g > 2 && b <= Math.min(r, g) * 0.75) {
          color = headColor;
        } else if (r > 2 && r >= g * 1.5 && r >= b * 1.5) {
          color = bodyColor;
        } else if (g > 2 && g >= r * 1.5 && g >= b * 1.5) {
          color = legsColor;
        } else if (b > 2 && b >= r * 1.5 && b >= g * 1.5) {
          color = feetColor;
        } else {
          color = bodyColor;
        }

        // Get luminance from base sprite for 3D shading, fallback to mask intensity
        let lum: number;
        if (base && base[i + 3] > 0) {
          // Use base sprite grayscale luminance (Rec. 709)
          lum = (0.2126 * base[i] + 0.7152 * base[i + 1] + 0.0722 * base[i + 2]) / 255;
        } else {
          // Fallback: use mask channel intensity
          lum = maxC / 255;
        }

        // Multiply: outfit color * base luminance = colored with 3D shading
        mask[i] = Math.min(255, Math.round(color[0] * lum));
        mask[i + 1] = Math.min(255, Math.round(color[1] * lum));
        mask[i + 2] = Math.min(255, Math.round(color[2] * lum));
      }

      tmpCtx.putImageData(maskData, 0, 0);
      this.tintCache.set(cacheKey, tmpCanvas);
      cached = tmpCanvas;
    }

    this.offCtx.drawImage(cached, dx, dy);
  }

  private drawIdle(w: number, h: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#58a6ff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TibiaCamPlayer 7.4', w / 2, h / 2 - 12);
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px Arial';
    ctx.fillText('Carregando...', w / 2, h / 2 + 16);
  }

  private getSpriteIndex(it: ItemType, ph: number, wx: number, wy: number, tw: number, th: number): number {
    const A = Math.max(1, it.anim), PZ = Math.max(1, it.patZ), PY = Math.max(1, it.patY);
    const PX = Math.max(1, it.patX), L = Math.max(1, it.layers), H = it.height, W = it.width;
    const a = ph % A, z = 0, y = wy % PY, x = wx % PX, l = 0, h = th % H, w = tw % W;
    const idx = ((((((a * PZ + z) * PY + y) * PX + x) * L + l) * H + h) * W + w);
    return (it.spriteIds && idx < it.spriteIds.length) ? it.spriteIds[idx] : 0;
  }

  /** Get sprite at native 32px - no scaling */
  private getNativeSprite(sid: number): HTMLCanvasElement | null {
    if (sid <= 0) return null;
    const key = `n_${sid}`;
    if (this.spriteCanvasCache.has(key)) return this.spriteCanvasCache.get(key)!;

    const imgData = this.spr.getSprite(sid);
    if (!imgData) { this.spriteCanvasCache.set(key, null); return null; }

    const canvas = document.createElement('canvas');
    canvas.width = TILE_PX;
    canvas.height = TILE_PX;
    canvas.getContext('2d')!.putImageData(imgData, 0, 0);

    this.spriteCanvasCache.set(key, canvas);
    return canvas;
  }

  /** Draw creature HUD at display resolution (after upscale) */
  private drawCreatureHudHiRes(px: number, py: number, c: { name: string; health: number; id: number; outfit?: number }, tileW: number, tileH: number) {
    const ctx = this.ctx;
    const isPlayer = c.id === this.gs.playerId;

    let hudX = px;
    let hudY = py;
    let hudW = tileW;
    if (c.outfit) {
      const ot = this.dat.outfits.get(c.outfit);
      if (ot && (ot.width > 1 || ot.height > 1)) {
        hudX = px - (ot.width - 1) * tileW / 2;
        hudY = py - (ot.height - 1) * tileH;
        hudW = ot.width * tileW;
      }
    }

    const bw = Math.min(hudW - 2, tileW * 2);
    const fw = Math.max(1, Math.floor(bw * c.health / 100));
    const hc = c.health > 50 ? '#00c800' : (c.health > 25 ? '#c8c800' : '#c80000');
    const barX = hudX + (hudW - bw) / 2;
    const barH = Math.max(3, Math.round(tileH / 16));

    ctx.fillStyle = '#500000';
    ctx.fillRect(barX, hudY - barH * 2, bw, barH);
    ctx.fillStyle = hc;
    ctx.fillRect(barX, hudY - barH * 2, fw, barH);

    const fs = Math.max(9, Math.min(14, Math.floor(tileW / 4)));
    const nameColor = isPlayer ? '#00FF00' : '#64c8ff';
    ctx.font = `bold ${fs}px Arial`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeText(c.name.substring(0, 16), hudX + hudW / 2, hudY - barH * 2 - 2);
    ctx.fillStyle = nameColor;
    ctx.fillText(c.name.substring(0, 16), hudX + hudW / 2, hudY - barH * 2 - 2);
  }

  clearCache() {
    this.spriteCanvasCache.clear();
    this.tintCache.clear();
  }
}
