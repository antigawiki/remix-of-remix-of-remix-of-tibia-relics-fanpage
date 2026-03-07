/**
 * Extraction Store — collects tiles and spawn data from ExtractionParser.
 * Stores tiles with absolute coordinates (no post-processing needed).
 * Tracks creature spawns per 32x32 chunk using visit-based averaging.
 */

import { DatLoader } from './datLoader';
import type { ExtractionLocation, ExtractionCreature, ExtractionTile } from './extractionParser';
import type { SpawnData } from './mapExtractor';

const DB_CHUNK = 32;
const VIEWPORT_RX = 9;  // ±9 tiles X from player
const VIEWPORT_RY = 7;  // ±7 tiles Y from player

// Per-visit creature count for a chunk
interface ChunkVisitData {
  creatures: Map<string, { count: number; outfitId: number; positions: Set<string> }>;
}

// Accumulated data across visits
interface ChunkAccumulator {
  creatures: Map<string, { totalCount: number; outfitId: number; visitsSeen: number; positions: Set<string> }>;
  totalVisits: number;
}

export class ExtractionStore {
  private tiles = new Map<string, number[]>();
  private dat: DatLoader;

  // Spawn tracking
  private chunkAccumulators = new Map<string, ChunkAccumulator>();
  private lastPlayerChunkKey = '';
  private currentVisitChunks = new Map<string, ChunkVisitData>();
  private lastPlayerLocation: ExtractionLocation = { x: 0, y: 0, z: 0 };

  constructor(dat: DatLoader) {
    this.dat = dat;
  }

  /** Called by parser for each tile with absolute coords */
  addTile(tile: ExtractionTile): void {
    const key = `${tile.location.x},${tile.location.y},${tile.location.z}`;
    this.tiles.set(key, tile.itemIds);
  }

  /** Called by parser for each creature sighting */
  addCreature(creature: ExtractionCreature, location: ExtractionLocation): void {
    // Skip the player themselves
    if (creature.name === '' || creature.health <= 0) return;
    // Skip player-like outfits (head/body/legs/feet colored = player)
    if (creature.head !== 0 || creature.body !== 0 || creature.legs !== 0 || creature.feet !== 0) return;
    // Skip invisible/item outfits and player outfit range 128-143
    if (creature.outfit === 0 && creature.outfitItem === 0) return;
    if (creature.outfit >= 128 && creature.outfit <= 143) return;

    // Validate position in reasonable world range
    if (location.x < 30000 || location.x > 35000 || location.y < 30000 || location.y > 35000) return;
    if (location.z < 0 || location.z > 15) return;

    // Check creature is within viewport of player
    if (Math.abs(location.x - this.lastPlayerLocation.x) > VIEWPORT_RX + 2) return;
    if (Math.abs(location.y - this.lastPlayerLocation.y) > VIEWPORT_RY + 2) return;

    // Filter creatures on non-walkable tiles (walls, etc.)
    const tileKey = `${location.x},${location.y},${location.z}`;
    const tileItems = this.tiles.get(tileKey);
    if (tileItems) {
      for (const itemId of tileItems) {
        const def = this.dat.items.get(itemId);
        if (def && def.isBlocking) return; // Skip creatures on blocking tiles
      }
    }

    // Compute chunk
    const cx = Math.floor(location.x / DB_CHUNK);
    const cy = Math.floor(location.y / DB_CHUNK);
    const chunkKey = `${cx},${cy},${location.z}`;
    const relX = location.x - cx * DB_CHUNK;
    const relY = location.y - cy * DB_CHUNK;

    let visit = this.currentVisitChunks.get(chunkKey);
    if (!visit) { visit = { creatures: new Map() }; this.currentVisitChunks.set(chunkKey, visit); }

    let entry = visit.creatures.get(creature.name);
    if (!entry) {
      entry = { count: 0, outfitId: creature.outfit, positions: new Set() };
      visit.creatures.set(creature.name, entry);
    }
    // Use max count per creature type in a visit (increment for each sighting)
    entry.count++;
    entry.outfitId = creature.outfit;
    entry.positions.add(`${relX},${relY}`);
  }

  /** Called after each frame to update player location and handle visit transitions */
  updatePlayerLocation(loc: ExtractionLocation): void {
    const playerChunkX = Math.floor(loc.x / DB_CHUNK);
    const playerChunkY = Math.floor(loc.y / DB_CHUNK);
    const playerChunkKey = `${playerChunkX},${playerChunkY},${loc.z}`;

    if (playerChunkKey !== this.lastPlayerChunkKey && this.lastPlayerChunkKey !== '') {
      this.flushVisit();
      this.currentVisitChunks = new Map();
    }
    this.lastPlayerChunkKey = playerChunkKey;
    this.lastPlayerLocation = { ...loc };
  }

  /** Flush current visit data into accumulators */
  private flushVisit(): void {
    for (const [chunkKey, visit] of this.currentVisitChunks) {
      let acc = this.chunkAccumulators.get(chunkKey);
      if (!acc) {
        acc = { creatures: new Map(), totalVisits: 0 };
        this.chunkAccumulators.set(chunkKey, acc);
      }
      acc.totalVisits++;

      for (const [name, data] of visit.creatures) {
        let existing = acc.creatures.get(name);
        if (!existing) {
          existing = { totalCount: 0, outfitId: data.outfitId, visitsSeen: 0, positions: new Set() };
          acc.creatures.set(name, existing);
        }
        existing.totalCount += data.count;
        existing.visitsSeen++;
        existing.outfitId = data.outfitId;
        for (const pos of data.positions) existing.positions.add(pos);
      }
    }
  }

  /** Get final results */
  getResults(): { tiles: Map<string, number[]>; spawns: SpawnData[] } {
    // Flush last visit
    this.flushVisit();

    const spawns: SpawnData[] = [];
    for (const [chunkKey, acc] of this.chunkAccumulators) {
      const [cxStr, cyStr, zStr] = chunkKey.split(',');
      const chunkX = parseInt(cxStr, 10);
      const chunkY = parseInt(cyStr, 10);
      const z = parseInt(zStr, 10);

      for (const [name, data] of acc.creatures) {
        const avgCount = data.totalCount / data.visitsSeen;
        const positions = Array.from(data.positions).map(p => {
          const [x, y] = p.split(',').map(Number);
          return { x, y };
        });

        spawns.push({
          chunkX, chunkY, z,
          creatureName: name,
          outfitId: data.outfitId,
          avgCount: Math.round(avgCount * 10) / 10,
          positions,
          visitCount: data.visitsSeen,
        });
      }
    }

    return { tiles: this.tiles, spawns };
  }

  get tileCount(): number { return this.tiles.size; }
}
