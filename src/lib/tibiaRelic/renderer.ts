/**
 * Renderer Canvas - desenha o viewport do jogo
 * Suporte a multi-floor, elevation, dispX/dispY e stack priority
 */
import { SprLoader } from './sprLoader';
import { DatLoader, type ItemType } from './datLoader';
import { GameState, type TileItem } from './gameState';

const VP_W = 15, VP_H = 11;
const TILE_PX = 32;
const DIR_MAP: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };

export class Renderer {
  private tick = 0;
  private spriteCanvasCache: Map<string, HTMLCanvasElement | null> = new Map();

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

    const cx0 = g.camX - 8;
    const cy0 = g.camY - 6;
    const ph = (Math.floor(this.tick / 8)) % 4;
    const scale = tpx / TILE_PX;

    // Determine visible floors
    const floors: number[] = [];
    if (g.camZ > 7) {
      // Underground: current floor only (no multi-floor perspective)
      floors.push(g.camZ);
    } else {
      // Ground/above: draw from current floor (7) then upper floors (6, 5, ..., 0)
      for (let z = g.camZ; z >= 0; z--) {
        floors.push(z);
      }
    }

    // Draw each floor, from current (bottom) to topmost (drawn on top)
    for (const z of floors) {
      const zOffset = g.camZ - z; // 0 for current floor, 1 for one above, etc.

      // Draw tile items for this floor
      for (let ty = 0; ty < VP_H + 3; ty++) {
        for (let tx = 0; tx < VP_W + 3; tx++) {
          // World position: upper floors are shifted, so the world tile
          // at screen position (tx, ty) on floor z is shifted by zOffset
          const wx = cx0 + tx + zOffset;
          const wy = cy0 + ty + zOffset;
          const items = g.getTile(wx, wy, z);
          if (items.length === 0) continue;

          const bx = tx * tpx;
          const by = ty * tpx;

          const sorted = this.sortByStackPrio(items);
          let elevationOffset = 0;

          for (const item of sorted) {
            if (item[0] !== 'it') continue;
            const it = this.dat.items.get(item[1]);
            if (!it) continue;

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
                    ctx.drawImage(sprCanvas, dx, dy);
                  }
                }
              }
            }

            if (it.elevation > 0) {
              elevationOffset += it.elevation;
            }
          }
        }
      }

      // Draw creatures on this floor
      for (const c of g.creatures.values()) {
        if (c.z !== z) continue;
        const tx2 = c.x - cx0 - zOffset;
        const ty2 = c.y - cy0 - zOffset;
        if (tx2 < -1 || tx2 > VP_W + 3 || ty2 < -1 || ty2 > VP_H + 3) continue;

        // Get elevation from tile items under creature
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
        const phCr = (Math.floor(this.tick / 6)) % 3;
        const sid = this.getOutfitSid(c, phCr);
        const sprCanvas = this.getSpriteCanvas(sid, tpx);
        if (sprCanvas && sx > -tpx * 2 && sx < canvasWidth && sy > -tpx * 2 && sy < canvasHeight) {
          ctx.drawImage(sprCanvas, sx, sy);
        }

        // Draw HUD for creature
        if (tx2 >= 0 && tx2 <= VP_W + 1 && ty2 >= 0 && ty2 <= VP_H + 1) {
          this.drawCreatureHud(sx, sy, c, tpx);
        }
      }
    }

    this.drawMessages(canvasWidth, canvasHeight);

    ctx.fillStyle = '#444444';
    ctx.font = '7px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`cam=(${g.camX},${g.camY},${g.camZ}) crs=${g.creatures.size}`, 3, canvasHeight - 3);
  }

  private sortByStackPrio(items: TileItem[]): TileItem[] {
    if (items.length <= 1) return items;
    return [...items].sort((a, b) => {
      const prioA = a[0] === 'cr' ? 4 : (this.dat.items.get(a[1])?.stackPrio ?? 5);
      const prioB = b[0] === 'cr' ? 4 : (this.dat.items.get(b[1])?.stackPrio ?? 5);
      return prioA - prioB;
    });
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

  private getOutfitSid(c: { outfit: number; direction: number }, ph: number): number {
    const xd = DIR_MAP[c.direction] ?? 0;
    const ot = this.dat.outfits.get(c.outfit);
    if (!ot || !ot.spriteIds.length) return 0;
    const A = Math.max(1, ot.anim), PZ = Math.max(1, ot.patZ), PY = Math.max(1, ot.patY);
    const PX = Math.max(1, ot.patX), L = Math.max(1, ot.layers), H = ot.height, W = ot.width;
    const a = ph % A;
    const idx = ((((((a * PZ + 0) * PY + 0) * PX + xd % PX) * L + 0) * H + 0) * W + 0);
    return (idx < ot.spriteIds.length) ? ot.spriteIds[idx] : 0;
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
  }
}
