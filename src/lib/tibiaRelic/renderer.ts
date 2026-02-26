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
const DIR_MAP: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };

/**
 * Convert 8-bit Tibia outfit color index to RGB.
 * Matches tibiarc's Convert8BitColor: 6x6x6 RGB cube (0-215) + grayscale fallback.
 */
function convert8BitColor(color: number): [number, number, number] {
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
  private loggedCreature = false;

  public floorOverride: number | null = null;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private spr: SprLoader,
    private dat: DatLoader,
    public gs: GameState,
  ) {}

  incTick() { this.tick++; }

  draw(canvasWidth: number, canvasHeight: number) {
    const g = this.gs;
    const ctx = this.ctx;
    const tpx = Math.max(4, Math.min(Math.floor(canvasWidth / VP_W), Math.floor(canvasHeight / VP_H)));

    ctx.fillStyle = '#1a2420';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (!g.mapLoaded) {
      this.drawIdle(canvasWidth, canvasHeight);
      return;
    }

    const z = this.floorOverride ?? g.camZ;
    const ph = (Math.floor(this.tick / 8)) % 4;
    const scale = tpx / TILE_PX;

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

          const bx = tx * tpx;
          const by = ty * tpx;

          // Pass 1: Ground + clip + bottom (stackPrio 0, 1, 2)
          let elevationOffset = 0;
          for (const item of items) {
            if (item[0] === 'cr') continue;
            const it = this.dat.items.get(item[1]);
            if (!it || it.stackPrio > 2) continue;
            this.drawItem(it, bx, by, elevationOffset, scale, tpx, ph, wx, wy, canvasWidth, canvasHeight);
            if (it.elevation > 0) elevationOffset += it.elevation;
          }

          // Pass 2: Regular items (stackPrio 5, default)
          for (const item of items) {
            if (item[0] === 'cr') continue;
            const it = this.dat.items.get(item[1]);
            if (!it || it.stackPrio <= 2 || it.stackPrio === 3) continue;
            this.drawItem(it, bx, by, elevationOffset, scale, tpx, ph, wx, wy, canvasWidth, canvasHeight);
            if (it.elevation > 0) elevationOffset += it.elevation;
          }

          // Pass 3: Creatures
          for (const item of items) {
            if (item[0] !== 'cr') continue;
            const c = g.creatures.get(item[1]);
            if (c) {
              this.drawCreature(c, bx, by - Math.round(elevationOffset * scale), tpx, scale);
            }
          }

          // Pass 4: Top items (stackPrio 3)
          for (const item of items) {
            if (item[0] === 'cr') continue;
            const it = this.dat.items.get(item[1]);
            if (!it || it.stackPrio !== 3) continue;
            this.drawItem(it, bx, by, elevationOffset, scale, tpx, ph, wx, wy, canvasWidth, canvasHeight);
          }
        }
      }
    }

    // Draw creature HUDs on top (only current floor)
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
        const sx = tx2 * tpx;
        const sy = ty2 * tpx - Math.round(elev * scale);
        this.drawCreatureHud(sx, sy, c, tpx);
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

  private drawItem(it: ItemType, bx: number, by: number, elevationOffset: number, scale: number, tpx: number, ph: number, wx: number, wy: number, canvasWidth: number, canvasHeight: number) {
    const dispXPx = Math.round(it.dispX * scale);
    const dispYPx = Math.round(it.dispY * scale);

    for (let th = 0; th < it.height; th++) {
      for (let tw = 0; tw < it.width; tw++) {
        const sid = this.getSpriteIndex(it, ph, wx, wy, tw, th);
        const sprCanvas = this.getSpriteCanvas(sid, tpx);
        if (sprCanvas) {
          const dx = bx - tw * tpx + dispXPx;
          const dy = by - th * tpx + dispYPx - Math.round(elevationOffset * scale);
          if (dx > -tpx * 2 && dx < canvasWidth && dy > -tpx * 2 && dy < canvasHeight) {
            this.ctx.drawImage(sprCanvas, dx, dy);
          }
        }
      }
    }
  }

  

  private drawCreature(c: Creature, bx: number, by: number, tpx: number, scale: number) {
    const phCr = (Math.floor(this.tick / 6)) % 3;
    const ot = this.dat.outfits.get(c.outfit);

    if (!this.loggedCreature) {
      this.loggedCreature = true;
      console.log(`[Renderer] First creature: outfit=${c.outfit}, name=${c.name}, datHasOutfit=${!!ot}, layers=${ot?.layers}, spriteIds=${ot?.spriteIds?.slice(0, 8)}`);
    }

    let rendered = false;

    if (ot && ot.spriteIds.length > 0) {
      const xd = DIR_MAP[c.direction] ?? 0;
      const A = Math.max(1, ot.anim), PZ = Math.max(1, ot.patZ), PY = Math.max(1, ot.patY);
      const PX = Math.max(1, ot.patX), L = Math.max(1, ot.layers), H = ot.height, W = ot.width;
      const a = phCr % A;

      // Apply outfit displacement (like tibiarc/OTClient)
      const dispXPx = Math.round(ot.dispX * scale);
      const dispYPx = Math.round(ot.dispY * scale);

      // Draw base layer (layer 0) first
      for (let th = 0; th < H; th++) {
        for (let tw = 0; tw < W; tw++) {
          const patX = xd % PX;
          const patY = 0;
          const idx = ((((((a * PZ + 0) * PY + patY) * PX + patX) * L + 0) * H + th) * W + tw);
          const sid = (idx < ot.spriteIds.length) ? ot.spriteIds[idx] : 0;
          const sprCanvas = this.getSpriteCanvas(sid, tpx);
          if (sprCanvas) {
            const dx = bx - tw * tpx + dispXPx;
            const dy = by - th * tpx + dispYPx;
            this.ctx.drawImage(sprCanvas, dx, dy);
            rendered = true;
          }
        }
      }

      // Draw tinted mask layer (layer 1) if outfit has 2+ layers
      if (L >= 2) {
        for (let th = 0; th < H; th++) {
          for (let tw = 0; tw < W; tw++) {
            const patX = xd % PX;
            const patY = 0;
            const idx = ((((((a * PZ + 0) * PY + patY) * PX + patX) * L + 1) * H + th) * W + tw);
            const sid = (idx < ot.spriteIds.length) ? ot.spriteIds[idx] : 0;
            const sprCanvas = this.getSpriteCanvas(sid, tpx);
            if (sprCanvas) {
              const dx = bx - tw * tpx + dispXPx;
              const dy = by - th * tpx + dispYPx;
              this.drawTintedLayer(sprCanvas, dx, dy, tpx, c, sid);
              rendered = true;
            }
          }
        }
      }
    }

    if (!rendered) {
      const isPlayer = c.id === this.gs.playerId;
      this.ctx.fillStyle = isPlayer ? 'rgba(100,200,255,0.6)' : 'rgba(255,200,100,0.6)';
      this.ctx.fillRect(bx + 4, by + 4, tpx - 8, tpx - 8);
      this.ctx.strokeStyle = isPlayer ? '#64c8ff' : '#ffcc64';
      this.ctx.strokeRect(bx + 4, by + 4, tpx - 8, tpx - 8);
    }
  }

  /**
   * Draw tinted outfit mask layer using multiplicative tinting.
   * OTClient/tibiarc standard mask channel mapping:
   * - Yellow (R+G high, B low) → Head color
   * - Red (R high, G+B low) → Body color
   * - Green (G high, R+B low) → Legs color
   * - Blue (B high, R+G low) → Feet color
   * 
   * Uses multiplicative blending: output = maskIntensity * tintColor
   * This preserves shading/anti-aliasing instead of flat color replacement.
   */
  private drawTintedLayer(maskCanvas: HTMLCanvasElement, dx: number, dy: number, tpx: number, c: Creature, spriteId?: number) {
    const cacheKey = `tint_${spriteId ?? 'unk'}_${c.head}_${c.body}_${c.legs}_${c.feet}_${tpx}`;

    let cached = this.tintCache.get(cacheKey);
    if (cached === undefined) {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = tpx;
      tmpCanvas.height = tpx;
      const tmpCtx = tmpCanvas.getContext('2d')!;

      tmpCtx.drawImage(maskCanvas, 0, 0);
      const imgData = tmpCtx.getImageData(0, 0, tpx, tpx);
      const data = imgData.data;

      const headColor = convert8BitColor(c.head);
      const bodyColor = convert8BitColor(c.body);
      const legsColor = convert8BitColor(c.legs);
      const feetColor = convert8BitColor(c.feet);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a === 0) continue;

        // Determine which body part this pixel belongs to based on dominant channel
        // and compute the intensity from the mask pixel
        let color: [number, number, number] | null = null;
        let intensity = 0;

        if (r > 1 && g > 1 && b < r / 2 && b < g / 2) {
          // Yellow (R+G high, B low) → Head
          color = headColor;
          intensity = (r + g) / (2 * 255);
        } else if (r > 1 && g < r / 2 && b < r / 2) {
          // Red dominant → Body
          color = bodyColor;
          intensity = r / 255;
        } else if (g > 1 && r < g / 2 && b < g / 2) {
          // Green dominant → Legs
          color = legsColor;
          intensity = g / 255;
        } else if (b > 1 && r < b / 2 && g < b / 2) {
          // Blue dominant → Feet
          color = feetColor;
          intensity = b / 255;
        }

        if (color) {
          // Multiplicative tint: preserve shading from mask intensity
          data[i] = Math.min(255, Math.round(color[0] * intensity));
          data[i + 1] = Math.min(255, Math.round(color[1] * intensity));
          data[i + 2] = Math.min(255, Math.round(color[2] * intensity));
          // Keep original alpha
        } else {
          // Non-matching pixels: make transparent (not part of any body region)
          data[i + 3] = 0;
        }
      }

      tmpCtx.putImageData(imgData, 0, 0);
      this.tintCache.set(cacheKey, tmpCanvas);
      cached = tmpCanvas;
    }

    this.ctx.drawImage(cached, dx, dy);
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

  private getSpriteCanvas(sid: number, tpx: number): HTMLCanvasElement | null {
    if (sid <= 0) return null;
    const key = `${sid}_${tpx}`;
    if (this.spriteCanvasCache.has(key)) return this.spriteCanvasCache.get(key)!;

    const imgData = this.spr.getSprite(sid);
    if (!imgData) { this.spriteCanvasCache.set(key, null); return null; }

    const canvas = document.createElement('canvas');
    canvas.width = tpx;
    canvas.height = tpx;
    const sctx = canvas.getContext('2d')!;

    if (tpx === TILE_PX) {
      sctx.putImageData(imgData, 0, 0);
    } else {
      const tmp = document.createElement('canvas');
      tmp.width = TILE_PX; tmp.height = TILE_PX;
      tmp.getContext('2d')!.putImageData(imgData, 0, 0);
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(tmp, 0, 0, tpx, tpx);
    }

    this.spriteCanvasCache.set(key, canvas);
    return canvas;
  }

  private drawCreatureHud(px: number, py: number, c: { name: string; health: number; id: number }, tpx: number) {
    const ctx = this.ctx;
    const isPlayer = c.id === this.gs.playerId;
    const bw = tpx - 2;
    const fw = Math.max(1, Math.floor(bw * c.health / 100));
    const hc = c.health > 50 ? '#00c800' : (c.health > 25 ? '#c8c800' : '#c80000');

    ctx.fillStyle = '#500000';
    ctx.fillRect(px + 1, py - 6, bw, 4);
    ctx.fillStyle = hc;
    ctx.fillRect(px + 1, py - 6, fw, 4);

    const fs = Math.max(7, Math.min(10, Math.floor(tpx / 4)));
    const nameColor = isPlayer ? '#00FF00' : '#64c8ff';
    ctx.font = `bold ${fs}px Arial`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeText(c.name.substring(0, 16), px + tpx / 2, py - 7);
    ctx.fillStyle = nameColor;
    ctx.fillText(c.name.substring(0, 16), px + tpx / 2, py - 7);
  }

  clearCache() {
    this.spriteCanvasCache.clear();
    this.tintCache.clear();
  }
}
