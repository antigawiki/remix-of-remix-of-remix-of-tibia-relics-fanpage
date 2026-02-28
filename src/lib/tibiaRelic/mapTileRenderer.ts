/**
 * Map Tile Renderer - renders 256x256 pixel chunks (8x8 tiles of 32px)
 * for the LeafletJS custom tile layer.
 * 
 * Uses SprLoader and DatLoader to render actual Tibia sprites.
 * Includes LRU cache for rendered chunks.
 */
import { SprLoader } from './sprLoader';
import { DatLoader, type ItemType } from './datLoader';

const TILE_PX = 32;
const CHUNK_TILES = 8;
const CHUNK_PX = CHUNK_TILES * TILE_PX; // 256

const MAX_CACHE = 300;

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
   * chunkX/chunkY are in chunk coordinates (tileX / 8, tileY / 8).
   */
  renderChunk(
    chunkX: number,
    chunkY: number,
    z: number,
    tiles: TileData[],
    creatures?: CreatureData[],
  ): HTMLCanvasElement | null {
    const key = `${chunkX},${chunkY},${z}`;
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

    // Build lookup for quick access
    const tileMap = new Map<string, number[]>();
    for (const t of tiles) {
      tileMap.set(`${t.x},${t.y}`, t.items);
    }

    for (let ty = 0; ty < CHUNK_TILES; ty++) {
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        const wx = baseX + tx;
        const wy = baseY + ty;
        const items = tileMap.get(`${wx},${wy}`);
        if (!items) continue;

        const px = tx * TILE_PX;
        const py = ty * TILE_PX;

        for (const itemId of items) {
          const def = this.dat.items.get(itemId);
          if (!def) continue;
          this.drawItem(ctx, def, px, py);
        }
      }
    }

    // Draw creatures on top of tiles
    if (creatures && creatures.length > 0) {
      for (const c of creatures) {
        const tx = c.x - baseX;
        const ty = c.y - baseY;
        if (tx < 0 || tx >= CHUNK_TILES || ty < 0 || ty >= CHUNK_TILES) continue;
        const px = tx * TILE_PX;
        const py = ty * TILE_PX;
        this.drawCreature(ctx, c.outfit_id, c.direction, px, py);
      }
    }

    this.setCache(key, canvas);
    return canvas;
  }

  private drawCreature(ctx: CanvasRenderingContext2D, outfitId: number, direction: number, px: number, py: number) {
    const ot = this.dat.outfits.get(outfitId);
    if (!ot || ot.spriteIds.length === 0) {
      // Fallback: small colored square
      ctx.fillStyle = '#ffcc64';
      ctx.fillRect(px + 8, py + 8, 16, 16);
      return;
    }

    const DIR_MAP: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };
    const xd = DIR_MAP[direction] ?? 2;
    const PX = Math.max(1, ot.patX);
    const PY = Math.max(1, ot.patY);
    const PZ = Math.max(1, ot.patZ);
    const L = Math.max(1, ot.layers);
    const H = ot.height, W = ot.width;
    const A = Math.max(1, ot.anim);
    const a = 0; // Static frame 0

    for (let patY = 0; patY < PY; patY++) {
      for (let th = 0; th < H; th++) {
        for (let tw = 0; tw < W; tw++) {
          const patX = xd % PX;
          const idx = ((((((a * PZ + 0) * PY + patY) * PX + patX) * L + 0) * H + th) * W + tw);
          const sid = idx < ot.spriteIds.length ? ot.spriteIds[idx] : 0;
          if (!sid) continue;
          const sprCanvas = this.getSpriteCanvas(sid);
          if (sprCanvas) {
            ctx.drawImage(sprCanvas, px - tw * TILE_PX - ot.dispX, py - th * TILE_PX - ot.dispY);
          }
        }
      }
    }
  }

  private drawItem(ctx: CanvasRenderingContext2D, def: ItemType, px: number, py: number) {
    const W = def.width;
    const H = def.height;

    // For simple 1x1 items, just draw the first sprite
    if (W === 1 && H === 1) {
      const sid = def.spriteIds[0];
      if (sid) {
        const sprCanvas = this.getSpriteCanvas(sid);
        if (sprCanvas) ctx.drawImage(sprCanvas, px, py);
      }
      return;
    }

    // Multi-tile items: draw each sub-sprite
    for (let th = 0; th < H; th++) {
      for (let tw = 0; tw < W; tw++) {
        const idx = th * W + tw;
        const sid = idx < def.spriteIds.length ? def.spriteIds[idx] : 0;
        if (!sid) continue;
        const sprCanvas = this.getSpriteCanvas(sid);
        if (sprCanvas) {
          ctx.drawImage(sprCanvas, px - tw * TILE_PX, py - th * TILE_PX);
        }
      }
    }
  }

  private getSpriteCanvas(sid: number): HTMLCanvasElement | null {
    if (this.spriteCanvasCache.has(sid)) return this.spriteCanvasCache.get(sid)!;
    const imgData = this.spr.getSprite(sid);
    if (!imgData) {
      this.spriteCanvasCache.set(sid, null);
      return null;
    }
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
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
      if (key.endsWith(`,${z}`)) toDelete.push(key);
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
