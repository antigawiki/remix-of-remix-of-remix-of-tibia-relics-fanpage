/**
 * Renderer Canvas - draws game viewport
 * Multi-floor rendering with NW perspective offset, elevation, stack priority passes, and outfit tinting
 */
import { SprLoader } from './sprLoader';
import { DatLoader, type ItemType } from './datLoader';
import { GameState, type TileItem, type Creature } from './gameState';

const VP_W = 15, VP_H = 11;
const TILE_PX = 32;
const DIR_MAP: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };

// Tibia outfit color palette (HSL-based, 133 colors indexed 0-132)
const OUTFIT_COLORS: [number, number, number][] = buildOutfitColorTable();

function buildOutfitColorTable(): [number, number, number][] {
  // Standard Tibia color palette - 19 hues x 7 shades = 133 colors
  const table: [number, number, number][] = [];
  const hues = [0, 15, 27, 38, 52, 66, 80, 95, 114, 135, 160, 186, 210, 230, 248, 268, 285, 303, 330];
  const saturations = [100, 100, 80, 60, 100, 80, 50];
  const lightnesses = [20, 35, 50, 65, 80, 90, 95];

  for (let h = 0; h < 19; h++) {
    for (let s = 0; s < 7; s++) {
      table.push([hues[h], saturations[s], lightnesses[s]]);
    }
  }
  return table;
}

function getOutfitColor(index: number): [number, number, number] {
  if (index < 0 || index >= OUTFIT_COLORS.length) return [0, 0, 50];
  return OUTFIT_COLORS[index];
}

export class Renderer {
  private tick = 0;
  private spriteCanvasCache: Map<string, HTMLCanvasElement | null> = new Map();
  private tintCache: Map<string, HTMLCanvasElement | null> = new Map();
  private loggedCreature = false;

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

    const z = g.camZ;
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

    this.drawMessages(canvasWidth, canvasHeight);

    ctx.fillStyle = '#444444';
    ctx.font = '7px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`cam=(${g.camX},${g.camY},${g.camZ}) crs=${g.creatures.size}`, 3, canvasHeight - 3);
  }

  private getVisibleFloors(z: number): number[] {
    if (z <= 7) {
      // Above ground: draw from floor 7 up to max(0, z-2), bottom first (painter's)
      const floors: number[] = [];
      for (let fz = 7; fz >= Math.max(0, z - 2); fz--) {
        floors.push(fz);
      }
      floors.reverse();
      return floors;
    } else {
      // Underground: draw z-2 to z+2 (clamped), bottom first
      const floors: number[] = [];
      const minZ = Math.max(z - 2, 8);
      const maxZ = Math.min(z + 2, 15);
      for (let fz = maxZ; fz >= minZ; fz--) {
        floors.push(fz);
      }
      floors.reverse();
      return floors;
    }
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

      // Draw all layers (layer 0 = base, layer 1 = mask for tinting)
      for (let layer = 0; layer < L; layer++) {
        for (let th = 0; th < H; th++) {
          for (let tw = 0; tw < W; tw++) {
            const idx = ((((((a * PZ + 0) * PY + 0) * PX + xd % PX) * L + layer) * H + th) * W + tw);
            const sid = (idx < ot.spriteIds.length) ? ot.spriteIds[idx] : 0;

            if (layer === 0) {
              // Base layer: draw normally
              const sprCanvas = this.getSpriteCanvas(sid, tpx);
              if (sprCanvas) {
                const dx = bx - tw * tpx;
                const dy = by - th * tpx;
                this.ctx.drawImage(sprCanvas, dx, dy);
                rendered = true;
              }
            } else if (layer === 1 && L >= 2) {
              // Mask layer: tint with outfit colors
              const sprCanvas = this.getSpriteCanvas(sid, tpx);
              if (sprCanvas) {
                this.drawTintedLayer(sprCanvas, bx - tw * tpx, by - th * tpx, tpx, c);
                rendered = true;
              }
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
   * Draw tinted outfit mask layer.
   * The mask sprite uses specific color channels to indicate which body part to tint:
   * - Red channel → head color
   * - Green channel → body color
   * - Blue channel → legs color
   * - Yellow (R+G) → feet color
   */
  private drawTintedLayer(maskCanvas: HTMLCanvasElement, dx: number, dy: number, tpx: number, c: Creature) {
    const key = `tint_${maskCanvas.width}_${c.head}_${c.body}_${c.legs}_${c.feet}`;

    let cached = this.tintCache.get(key + '_' + this.getSpriteCanvasKey(maskCanvas));
    if (cached === undefined) {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = tpx;
      tmpCanvas.height = tpx;
      const tmpCtx = tmpCanvas.getContext('2d')!;

      tmpCtx.drawImage(maskCanvas, 0, 0);
      const imgData = tmpCtx.getImageData(0, 0, tpx, tpx);
      const data = imgData.data;

      const headColor = getOutfitColor(c.head);
      const bodyColor = getOutfitColor(c.body);
      const legsColor = getOutfitColor(c.legs);
      const feetColor = getOutfitColor(c.feet);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a === 0) continue;

        let color: [number, number, number] | null = null;
        if (r > 128 && g < 64 && b < 64) color = headColor;       // Red → head
        else if (g > 128 && r < 64 && b < 64) color = bodyColor;   // Green → body
        else if (b > 128 && r < 64 && g < 64) color = legsColor;   // Blue → legs
        else if (r > 128 && g > 128 && b < 64) color = feetColor;  // Yellow → feet

        if (color) {
          const [h, s, l] = color;
          const rgb = hslToRgb(h / 360, s / 100, l / 100);
          data[i] = rgb[0];
          data[i + 1] = rgb[1];
          data[i + 2] = rgb[2];
        }
      }

      tmpCtx.putImageData(imgData, 0, 0);
      cached = tmpCanvas;
      // Don't cache too aggressively - just draw it
    }

    this.ctx.globalCompositeOperation = 'source-atop';
    this.ctx.drawImage(cached, dx, dy);
    this.ctx.globalCompositeOperation = 'source-over';
  }

  private getSpriteCanvasKey(canvas: HTMLCanvasElement): string {
    // Use canvas dimensions as a simple identifier
    return `${canvas.width}x${canvas.height}`;
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
    ctx.fillStyle = isPlayer ? '#64c8ff' : '#ffcc64';
    ctx.font = `${fs}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(c.name.substring(0, 16), px + tpx / 2, py - 7);
  }

  private drawMessages(cw: number, ch: number) {
    const now = performance.now();
    const msgs = this.gs.messages.filter(m => m.expireAt > now).slice(-6);
    const ctx = this.ctx;
    let y = ch - 18;

    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      const l = Math.min(m.text.length * 6, cw - 8);
      ctx.fillStyle = '#111827';
      ctx.fillRect(4, y - 12, l, 15);
      ctx.fillStyle = m.color;
      ctx.font = '9px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(m.text.substring(0, 80), 6, y);
      y -= 16;
    }
  }

  clearCache() {
    this.spriteCanvasCache.clear();
    this.tintCache.clear();
  }
}

/** Convert HSL to RGB */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
