/**
 * Map Tile Renderer - renders 256x256 pixel chunks (8x8 tiles of 32px)
 * for the LeafletJS custom tile layer.
 * 
 * Rendering logic aligned with reference Cam Mapper project:
 * - Background: minimap color or fallback color
 * - Single-tile: first valid sprite, no patterns/layers
 * - Multi-tile: flat index (sy * w + sx)
 * - No elevation, no displacement
 */
import { SprLoader } from './sprLoader';
import { DatLoader, type ItemType } from './datLoader';
import { getMinimapColor, getFallbackColor } from './tileColors';

const TILE_PX = 32;
const CHUNK_TILES = 8;
const CHUNK_PX = CHUNK_TILES * TILE_PX; // 256

const MAX_CACHE = 300;

// Special tile IDs for visual highlights (Tibia 7.x common IDs)
const ROPE_HOLE_IDS = new Set([384, 469, 470, 482, 484]);
const SHOVEL_SPOT_IDS = new Set([606, 593, 867, 868]);

export interface TileData {
  x: number;
  y: number;
  z: number;
  items: number[];
}

export interface CreatureData {
  x: number;
  y: number;
  z: number;
  name: string;
  outfit_id: number;
  direction: number;
}

export interface SpawnRenderData {
  creatureName: string;
  outfitId: number;
  avgCount: number;
  positions: Array<{ x: number; y: number }>;
}

export class MapTileRenderer {
  private cache = new Map<string, HTMLCanvasElement | null>();
  private cacheOrder: string[] = [];
  private spriteCanvasCache = new Map<number, HTMLCanvasElement | null>();

  constructor(
    private spr: SprLoader,
    private dat: DatLoader,
  ) {}

  /**
   * Render a chunk of 8x8 tiles into a 256x256 canvas.
   */
  renderChunk(
    chunkX: number,
    chunkY: number,
    z: number,
    tiles: TileData[],
    creatures?: CreatureData[],
    spawns?: SpawnRenderData[],
    options?: { hideLooseItems?: boolean; belowChunks?: Set<string> },
    borderTiles?: TileData[],
  ): HTMLCanvasElement | null {
    const hideLoose = options?.hideLooseItems ?? false;
    const hasBelowData = options?.belowChunks != null;
    const hasBorder = borderTiles != null && borderTiles.length > 0;
    const key = `${chunkX},${chunkY},${z}${hideLoose ? ',noitems' : ''}${hasBelowData ? ',below' : ''}${hasBorder ? ',border' : ''}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    if (tiles.length === 0 && (!creatures || creatures.length === 0)) {
      this.setCache(key, null);
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = CHUNK_PX;
    canvas.height = CHUNK_PX;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const baseX = chunkX * CHUNK_TILES;
    const baseY = chunkY * CHUNK_TILES;

    // Build tile lookup (includes border tiles for multi-tile bleed)
    const tileMap = new Map<string, number[]>();
    for (const t of tiles) {
      tileMap.set(`${t.x},${t.y}`, t.items);
    }
    if (borderTiles) {
      for (const t of borderTiles) {
        if (!tileMap.has(`${t.x},${t.y}`)) {
          tileMap.set(`${t.x},${t.y}`, t.items);
        }
      }
    }

    // Render expanded range for multi-tile sprite bleed
    const MARGIN = 2;
    for (let ty = -MARGIN; ty < CHUNK_TILES + MARGIN; ty++) {
      for (let tx = -MARGIN; tx < CHUNK_TILES + MARGIN; tx++) {
        const wx = baseX + tx;
        const wy = baseY + ty;
        const items = tileMap.get(`${wx},${wy}`);
        if (!items || items.length === 0) continue;

        const px = tx * TILE_PX;
        const py = ty * TILE_PX;
        const isInside = tx >= 0 && tx < CHUNK_TILES && ty >= 0 && ty < CHUNK_TILES;

        // === BACKGROUND COLOR (reference logic) ===
        // Paint minimap color or fallback as base so transparent sprites have a background
        if (isInside) {
          let bgColor = '';
          for (const itemId of items) {
            const def = this.dat.items.get(itemId);
            if (!def) continue;
            if (def.minimapColor > 0) {
              bgColor = getMinimapColor(def.minimapColor);
              break;
            }
          }
          if (!bgColor) {
            for (const itemId of items) {
              const def = this.dat.items.get(itemId);
              if (!def) continue;
              bgColor = getFallbackColor(def.isGround, def.isBlocking);
              break;
            }
          }
          if (bgColor) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(px, py, TILE_PX, TILE_PX);
          }
        }

        // === SPRITE RENDERING (reference logic) ===
        let hasRopeHole = false;
        let hasShovelSpot = false;

        for (const itemId of items) {
          if (isInside && ROPE_HOLE_IDS.has(itemId)) hasRopeHole = true;
          if (isInside && SHOVEL_SPOT_IDS.has(itemId)) hasShovelSpot = true;

          const def = this.dat.items.get(itemId);
          if (!def || !def.spriteIds || def.spriteIds.length === 0) continue;
          if (hideLoose && def.stackPrio >= 4) continue;

          if (def.width > 1 || def.height > 1) {
            // Multi-tile: flat index sy * w + sx (reference logic)
            const w = def.width;
            const h = def.height;
            for (let sy = 0; sy < h; sy++) {
              for (let sx = 0; sx < w; sx++) {
                const idx = sy * w + sx;
                if (idx >= def.spriteIds.length) continue;
                const sid = def.spriteIds[idx];
                if (sid <= 0) continue;
                const sprCanvas = this.getSpriteCanvas(sid);
                if (sprCanvas) {
                  ctx.drawImage(sprCanvas, px - sx * TILE_PX, py - sy * TILE_PX);
                }
              }
            }
          } else {
            // Single-tile: first valid sprite, no patterns (reference logic)
            for (const sid of def.spriteIds) {
              if (sid <= 0) continue;
              const sprCanvas = this.getSpriteCanvas(sid);
              if (sprCanvas) {
                ctx.drawImage(sprCanvas, px, py);
                break;
              }
            }
          }
        }

        // Draw special tile overlays (only inside chunk)
        if (isInside && hasRopeHole) {
          ctx.save();
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
          ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
          ctx.fillRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
          ctx.fillStyle = '#00ff88';
          ctx.font = '10px monospace';
          ctx.fillText('R', px + 2, py + 10);
          ctx.restore();
        }
        if (isInside && hasShovelSpot) {
          const belowChunkKey = `${Math.floor(wx / CHUNK_TILES)},${Math.floor(wy / CHUNK_TILES)}`;
          const explored = !hasBelowData || (options!.belowChunks!.has(belowChunkKey));
          const color = explored ? '#ffcc00' : '#ff4444';
          const label = explored ? 'S' : 'S!';
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
          ctx.fillStyle = explored ? 'rgba(255, 204, 0, 0.15)' : 'rgba(255, 68, 68, 0.2)';
          ctx.fillRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
          ctx.fillStyle = color;
          ctx.font = '10px monospace';
          ctx.fillText(label, px + 2, py + 10);
          ctx.restore();
        }
      }
    }

    // Draw creatures
    if (creatures && creatures.length > 0) {
      for (const c of creatures) {
        const tx = c.x - baseX;
        const ty = c.y - baseY;
        if (tx < 0 || tx >= CHUNK_TILES || ty < 0 || ty >= CHUNK_TILES) continue;
        this.drawCreature(ctx, c.outfit_id, c.direction, tx * TILE_PX, ty * TILE_PX);
      }
    }

    // Draw spawns
    if (spawns && spawns.length > 0) {
      for (const spawn of spawns) {
        const count = Math.round(spawn.avgCount);
        const positionsToRender = this.getSpawnPositions(spawn, count, baseX, baseY, CHUNK_TILES);
        for (const pos of positionsToRender) {
          if (pos.tx < 0 || pos.tx >= CHUNK_TILES || pos.ty < 0 || pos.ty >= CHUNK_TILES) continue;
          this.drawCreature(ctx, spawn.outfitId, 2, pos.tx * TILE_PX, pos.ty * TILE_PX);
        }
      }
    }

    this.setCache(key, canvas);
    return canvas;
  }

  private drawCreature(ctx: CanvasRenderingContext2D, outfitId: number, direction: number, px: number, py: number) {
    const ot = this.dat.outfits.get(outfitId);
    if (!ot || ot.spriteIds.length === 0) {
      ctx.fillStyle = '#ffcc64';
      ctx.fillRect(px + 8, py + 8, 16, 16);
      return;
    }

    // Simple: first valid sprite for the outfit direction
    const DIR_MAP: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };
    const xd = DIR_MAP[direction] ?? 2;
    const PX = Math.max(1, ot.patX);
    const PY = Math.max(1, ot.patY);
    const PZ = Math.max(1, ot.patZ);
    const L = Math.max(1, ot.layers);
    const H = ot.height, W = ot.width;
    const A = Math.max(1, ot.anim);
    const a = 0;

    for (let patY = 0; patY < PY; patY++) {
      for (let th = 0; th < H; th++) {
        for (let tw = 0; tw < W; tw++) {
          const patX = xd % PX;
          const idx = ((((((a * PZ + 0) * PY + patY) * PX + patX) * L + 0) * H + th) * W + tw);
          const sid = idx < ot.spriteIds.length ? ot.spriteIds[idx] : 0;
          if (!sid) continue;
          const sprCanvas = this.getSpriteCanvas(sid);
          if (sprCanvas) {
            ctx.drawImage(sprCanvas, px - tw * TILE_PX, py - th * TILE_PX);
          }
        }
      }
    }
  }

  private getSpawnPositions(
    spawn: SpawnRenderData, count: number, baseX: number, baseY: number, chunkTiles: number,
  ): Array<{ tx: number; ty: number }> {
    const result: Array<{ tx: number; ty: number }> = [];
    const used = new Set<string>();
    const dbChunkBaseX = Math.floor(baseX / 32) * 32;
    const dbChunkBaseY = Math.floor(baseY / 32) * 32;

    for (const pos of spawn.positions) {
      if (result.length >= count) break;
      const tx = dbChunkBaseX + pos.x - baseX;
      const ty = dbChunkBaseY + pos.y - baseY;
      const key = `${tx},${ty}`;
      if (tx >= 0 && tx < chunkTiles && ty >= 0 && ty < chunkTiles && !used.has(key)) {
        result.push({ tx, ty });
        used.add(key);
      }
    }

    if (result.length < count) {
      for (let gy = 1; gy < chunkTiles && result.length < count; gy += 3) {
        for (let gx = 1; gx < chunkTiles && result.length < count; gx += 3) {
          const key = `${gx},${gy}`;
          if (!used.has(key)) { result.push({ tx: gx, ty: gy }); used.add(key); }
        }
      }
    }
    return result;
  }

  /**
   * Render a single item sprite for external use (e.g. editor sidebar).
   */
  renderSingleSprite(itemId: number): HTMLCanvasElement | null {
    const def = this.dat.items.get(itemId);
    if (!def || !def.spriteIds || def.spriteIds.length === 0) return null;

    for (const sid of def.spriteIds) {
      if (sid <= 0) continue;
      const sprCanvas = this.getSpriteCanvas(sid);
      if (!sprCanvas) continue;
      const out = document.createElement('canvas');
      out.width = 32;
      out.height = 32;
      const outCtx = out.getContext('2d')!;
      outCtx.imageSmoothingEnabled = false;
      outCtx.drawImage(sprCanvas, 0, 0);
      return out;
    }
    return null;
  }

  getMaxItemId(): number {
    let max = 0;
    for (const id of this.dat.items.keys()) { if (id > max) max = id; }
    return max;
  }

  diagnose() {
    const maxSprId = this.spr.count;
    let totalItems = 0, validItems = 0, brokenItems = 0, noSpriteItems = 0;
    const brokenList: Array<{ id: number; badSprites: number[]; total: number }> = [];

    for (const [id, it] of this.dat.items) {
      totalItems++;
      if (it.spriteIds.length === 0) { noSpriteItems++; continue; }
      const badSprites = it.spriteIds.filter(sid => sid > 0 && !this.spr.hasSprite(sid));
      if (badSprites.length > 0) {
        brokenItems++;
        if (brokenList.length < 20) brokenList.push({ id, badSprites: badSprites.slice(0, 5), total: it.spriteIds.length });
      } else { validItems++; }
    }

    console.log(`[Diagnose] SPR count=${maxSprId}`);
    console.log(`[Diagnose] DAT items: ${totalItems} total, ${validItems} valid, ${brokenItems} broken, ${noSpriteItems} no-sprites`);
    if (brokenList.length > 0) {
      console.log(`[Diagnose] Broken items (first ${brokenList.length}):`);
      for (const b of brokenList) console.log(`  item ${b.id}: ${b.badSprites.length}/${b.total} bad, examples: [${b.badSprites.join(',')}]`);
    }
  }

  private getSpriteCanvas(sid: number): HTMLCanvasElement | null {
    if (this.spriteCanvasCache.has(sid)) return this.spriteCanvasCache.get(sid)!;
    const imgData = this.spr.getSprite(sid);
    if (!imgData) { this.spriteCanvasCache.set(sid, null); return null; }
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    c.getContext('2d')!.putImageData(imgData, 0, 0);
    this.spriteCanvasCache.set(sid, c);
    return c;
  }

  private setCache(key: string, value: HTMLCanvasElement | null) {
    this.cache.set(key, value);
    this.cacheOrder.push(key);
    while (this.cacheOrder.length > MAX_CACHE) {
      const old = this.cacheOrder.shift()!;
      this.cache.delete(old);
    }
  }

  invalidateFloor(z: number) {
    const toDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.split(',')[2] === String(z)) toDelete.push(key);
    }
    for (const k of toDelete) {
      this.cache.delete(k);
      const idx = this.cacheOrder.indexOf(k);
      if (idx >= 0) this.cacheOrder.splice(idx, 1);
    }
  }

  clearCache() {
    this.cache.clear();
    this.cacheOrder = [];
  }
}
