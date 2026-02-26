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
 * Classic Tibia outfit color palette (133 colors).
 * Matches OTClient/tibiarc HSI-based palette used for outfit colorization.
 * Index 0-132 maps to specific RGB values.
 */
const OUTFIT_PALETTE: [number, number, number][] = [
  [255,255,255],[255,212,191],[255,170,128],[255,128,64],[255,85,0],
  [255,255,191],[255,255,128],[255,255,64],[255,255,0],[192,192,0],
  [255,191,191],[255,128,128],[255,64,64],[255,0,0],[192,0,0],
  [255,191,255],[255,128,255],[255,64,255],[255,0,255],[192,0,192],
  [191,191,255],[128,128,255],[64,64,255],[0,0,255],[0,0,192],
  [191,255,255],[128,255,255],[64,255,255],[0,255,255],[0,192,192],
  [191,255,191],[128,255,128],[64,255,64],[0,255,0],[0,192,0],
  [220,220,220],[187,187,187],[153,153,153],[120,120,120],[86,86,86],
  // Extended palette entries (colors 40-132)
  [255,233,191],[255,212,128],[255,191,64],[255,170,0],[192,128,0],
  [255,233,128],[255,233,64],[255,233,0],[255,212,0],[192,170,0],
  [255,233,191],[255,233,128],[255,212,64],[255,191,0],[192,148,0],
  [255,212,191],[255,191,128],[255,170,64],[255,148,0],[192,112,0],
  [255,191,191],[255,148,128],[255,106,64],[255,64,0],[192,48,0],
  [255,191,212],[255,128,170],[255,64,128],[255,0,85],[192,0,64],
  [255,191,233],[255,128,212],[255,64,191],[255,0,170],[192,0,128],
  [233,191,255],[212,128,255],[191,64,255],[170,0,255],[128,0,192],
  [212,191,255],[170,128,255],[128,64,255],[85,0,255],[64,0,192],
  [191,191,255],[148,128,255],[106,64,255],[64,0,255],[48,0,192],
  [191,212,255],[128,170,255],[64,128,255],[0,85,255],[0,64,192],
  [191,233,255],[128,212,255],[64,191,255],[0,170,255],[0,128,192],
  [191,255,233],[128,255,212],[64,255,191],[0,255,170],[0,192,128],
  [191,255,212],[128,255,170],[64,255,128],[0,255,85],[0,192,64],
  [191,255,191],[128,255,148],[64,255,106],[0,255,64],[0,192,48],
  [212,255,191],[170,255,128],[128,255,64],[85,255,0],[64,192,0],
  [233,255,191],[212,255,128],[191,255,64],[170,255,0],[128,192,0],
  [255,255,191],[233,255,128],[212,255,64],[191,255,0],[148,192,0],
  [255,233,191],[255,212,128],[255,233,64],[255,212,0],[192,170,0],
];

/**
 * Convert 8-bit Tibia outfit color index to RGB.
 * Uses the classic 133-color palette; falls back to 6x6x6 cube for out-of-range.
 */
function convert8BitColor(color: number): [number, number, number] {
  if (color >= 0 && color < OUTFIT_PALETTE.length) {
    return OUTFIT_PALETTE[color];
  }
  // Fallback: 6x6x6 RGB cube
  if (color < 0 || color > 215) return [128, 128, 128];
  const r = Math.floor(color / 36);
  const g = Math.floor((color % 36) / 6);
  const b = color % 6;
  return [r * 51, g * 51, b * 51];
}

export class Renderer {
  private tick = 0;
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

  incTick() { this.tick++; }

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
    const ph = (Math.floor(this.tick / 8)) % 4;
    this.hudEntries = [];

    // Determine visible floors
    const floors = this.getVisibleFloors(z);

    // Draw each floor with stack-priority passes
    for (const fz of floors) {
      const offset = z - fz;
      const cx0 = g.camX - 8 + offset;
      const cy0 = g.camY - 6 + offset;

      for (let ty = 0; ty < VP_H + 3; ty++) {
        for (let tx = 0; tx < VP_W + 3; tx++) {
          const wx = cx0 + tx;
          const wy = cy0 + ty;
          const items = g.getTile(wx, wy, fz);
          if (items.length === 0) continue;

          const bx = tx * TILE_PX;
          const by = ty * TILE_PX;

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
    for (const c of g.creatures.values()) {
      if (c.z !== z) continue;
      const tx2 = c.x - (g.camX - 8);
      const ty2 = c.y - (g.camY - 6);
      if (tx2 >= 0 && tx2 <= VP_W + 1 && ty2 >= 0 && ty2 <= VP_H + 1) {
        const tileItems = g.getTile(c.x, c.y, z);
        let elev = 0;
        for (const ti of tileItems) {
          if (ti[0] === 'it') {
            const it = this.dat.items.get(ti[1]);
            if (it && it.elevation > 0) elev += it.elevation;
          }
        }
        const sx = tx2 * TILE_PX * scaleX;
        const sy = (ty2 * TILE_PX - elev) * scaleY;
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
    if (c.walking && performance.now() > c.walkEndTick) {
      c.walking = false;
    }

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

    if (ot && ot.spriteIds.length > 0) {
      const xd = DIR_MAP[c.direction] ?? 0;
      const A = Math.max(1, ot.anim), PZ = Math.max(1, ot.patZ), PY = Math.max(1, ot.patY);
      const PX = Math.max(1, ot.patX), L = Math.max(1, ot.layers), H = ot.height, W = ot.width;

      let a: number;
      if (ot.animateIdle) {
        a = Math.floor(this.tick / 8) % A;
      } else if (c.walking) {
        if (A <= 2) {
          a = Math.floor(this.tick / 6) % A;
        } else {
          a = (Math.floor(this.tick / 6) % (A - 1)) + 1;
        }
      } else {
        a = 0;
      }

      for (let py = 0; py < PY; py++) {
        for (let th = 0; th < H; th++) {
          for (let tw = 0; tw < W; tw++) {
            const patX = xd % PX;
            const idx = ((((((a * PZ + 0) * PY + py) * PX + patX) * L + 0) * H + th) * W + tw);
            const sid = (idx < ot.spriteIds.length) ? ot.spriteIds[idx] : 0;
            const sprCanvas = this.getNativeSprite(sid);
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
              const idx = ((((((a * PZ + 0) * PY + py) * PX + patX) * L + 1) * H + th) * W + tw);
              const sid = (idx < ot.spriteIds.length) ? ot.spriteIds[idx] : 0;
              const sprCanvas = this.getNativeSprite(sid);
              if (sprCanvas) {
                const dx = bx - tw * TILE_PX - ot.dispX;
                const dy = by - th * TILE_PX - ot.dispY;
                this.drawTintedLayerNative(sprCanvas, dx, dy, c, sid);
                rendered = true;
              }
            }
          }
        }
      }
    }

    if (!rendered) {
      const isPlayer = c.id === this.gs.playerId;
      oc.fillStyle = isPlayer ? 'rgba(100,200,255,0.6)' : 'rgba(255,200,100,0.6)';
      oc.fillRect(bx + 4, by + 4, TILE_PX - 8, TILE_PX - 8);
      oc.strokeStyle = isPlayer ? '#64c8ff' : '#ffcc64';
      oc.strokeRect(bx + 4, by + 4, TILE_PX - 8, TILE_PX - 8);
    }
  }

  /** Tinted layer at native 32px using proper multiply blending */
  private drawTintedLayerNative(maskCanvas: HTMLCanvasElement, dx: number, dy: number, c: Creature, spriteId?: number) {
    const cacheKey = `tint_${spriteId ?? 'unk'}_${c.head}_${c.body}_${c.legs}_${c.feet}`;

    let cached = this.tintCache.get(cacheKey);
    if (cached === undefined) {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = TILE_PX;
      tmpCanvas.height = TILE_PX;
      const tmpCtx = tmpCanvas.getContext('2d')!;

      tmpCtx.drawImage(maskCanvas, 0, 0);
      const imgData = tmpCtx.getImageData(0, 0, TILE_PX, TILE_PX);
      const data = imgData.data;

      const headColor = convert8BitColor(c.head);
      const bodyColor = convert8BitColor(c.body);
      const legsColor = convert8BitColor(c.legs);
      const feetColor = convert8BitColor(c.feet);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a === 0) continue;

        let color: [number, number, number] | null = null;
        let intensity = 0;

        // OTClient mask channel detection:
        // Yellow (R+G high, B low) = Head
        // Red (R high, G+B low) = Body
        // Green (G high, R+B low) = Legs
        // Blue (B high, R+G low) = Feet
        if (r > 1 && g > 1 && b < r / 2 && b < g / 2) {
          color = headColor;
          intensity = (r + g) / (2 * 255);
        } else if (r > 1 && g < r / 2 && b < r / 2) {
          color = bodyColor;
          intensity = r / 255;
        } else if (g > 1 && r < g / 2 && b < g / 2) {
          color = legsColor;
          intensity = g / 255;
        } else if (b > 1 && r < b / 2 && g < b / 2) {
          color = feetColor;
          intensity = b / 255;
        }

        if (color) {
          // Multiply blend: preserves shading/volume from the mask intensity
          data[i] = Math.min(255, Math.round(color[0] * intensity));
          data[i + 1] = Math.min(255, Math.round(color[1] * intensity));
          data[i + 2] = Math.min(255, Math.round(color[2] * intensity));
        } else {
          // Non-mask pixels: make transparent (only tint layer is drawn here)
          data[i + 3] = 0;
        }
      }

      tmpCtx.putImageData(imgData, 0, 0);
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
