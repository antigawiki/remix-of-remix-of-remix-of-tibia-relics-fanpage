/**
 * Map Extractor - processes all frames of a .cam file and extracts
 * static tile data (ground items) and spawn data aggregated by chunk.
 * 
 * Spawn system: tracks "visits" to 32x32 chunks based on player movement.
 * For each visit, counts living creatures (health > 0) by type per chunk.
 * Final output: average count per creature type per chunk + positions.
 */
import { type CamFile } from './camParser';
import { DatLoader } from './datLoader';
import { PacketParser } from './packetParser';
import { GameState, type TileItem } from './gameState';

export interface MapExtractionProgress {
  processedFrames: number;
  totalFrames: number;
  tilesExtracted: number;
  percent: number;
}

export type ProgressCallback = (progress: MapExtractionProgress) => void;

export interface SpawnData {
  chunkX: number;
  chunkY: number;
  z: number;
  creatureName: string;
  outfitId: number;
  avgCount: number;
  positions: Array<{ x: number; y: number }>;
  visitCount: number;
}

export interface MapExtractionResult {
  tiles: Map<string, number[]>;
  spawns: SpawnData[];
}

const DB_CHUNK = 32;

// Per-visit creature count for a chunk
interface ChunkVisitData {
  // creature_name -> { count, outfitId, positions: Set<"x,y"> }
  creatures: Map<string, { count: number; outfitId: number; positions: Set<string> }>;
}

// Accumulated data across visits
interface ChunkAccumulator {
  // creature_name -> { totalCount (sum across visits), outfitId, visitsSeen, positions: Set<"x,y"> }
  creatures: Map<string, { totalCount: number; outfitId: number; visitsSeen: number; positions: Set<string> }>;
  totalVisits: number;
}

/**
 * Synchronous extraction for use inside a Web Worker.
 * Processes all frames in a tight loop (no yielding).
 */
export function extractMapTilesSync(
  cam: CamFile,
  dat: DatLoader,
  onProgress?: ProgressCallback,
  chunkSize = 500,
): MapExtractionResult {
  const gs = new GameState();
  const parser = new PacketParser(gs, dat, {
    looktypeU16: true,
    outfitWindowRangeU16: true,
  });
  parser.seekMode = true;

  const latestTiles = new Map<string, number[]>();
  const chunkAccumulators = new Map<string, ChunkAccumulator>();
  let lastPlayerChunkKey = '';
  let currentVisitChunks = new Map<string, ChunkVisitData>();
  let lastCamZ = -1;
  let floorStableBatches = 0;

  for (let frameIdx = 0; frameIdx < cam.frames.length; ) {
    const end = Math.min(frameIdx + chunkSize, cam.frames.length);
    let anyFloorChange = false;

    for (; frameIdx < end; frameIdx++) {
      try { parser.process(cam.frames[frameIdx].payload); } catch { /* skip */ }
      if (lastCamZ >= 0 && gs.camZ !== lastCamZ) {
        gs.tiles.clear();
        anyFloorChange = true;
      }
      lastCamZ = gs.camZ;
    }

    if (anyFloorChange) {
      floorStableBatches = 0;
    } else {
      floorStableBatches++;
    }

    if (floorStableBatches >= 2) snapshotTiles(gs, dat, latestTiles);

    const playerChunkX = Math.floor(gs.camX / DB_CHUNK);
    const playerChunkY = Math.floor(gs.camY / DB_CHUNK);
    const playerChunkKey = `${playerChunkX},${playerChunkY},${gs.camZ}`;

    if (playerChunkKey !== lastPlayerChunkKey && lastPlayerChunkKey !== '') {
      flushVisit(currentVisitChunks, chunkAccumulators);
      currentVisitChunks = new Map();
    }
    lastPlayerChunkKey = playerChunkKey;

    snapshotCreaturesForVisit(gs, currentVisitChunks);

    if (onProgress) {
      onProgress({
        processedFrames: frameIdx,
        totalFrames: cam.frames.length,
        tilesExtracted: latestTiles.size,
        percent: Math.round((frameIdx / cam.frames.length) * 100),
      });
    }
  }

  // Final snapshot to capture any remaining tiles
  if (floorStableBatches > 0) snapshotTiles(gs, dat, latestTiles);

  flushVisit(currentVisitChunks, chunkAccumulators);
  return { tiles: latestTiles, spawns: buildSpawnData(chunkAccumulators) };
}

/**
 * Extract all static tiles and spawn data from a .cam file.
 * Async version using setTimeout for main-thread usage.
 */
export async function extractMapTiles(
  cam: CamFile,
  dat: DatLoader,
  onProgress?: ProgressCallback,
  chunkSize = 500,
): Promise<MapExtractionResult> {
  const gs = new GameState();
  const parser = new PacketParser(gs, dat, {
    looktypeU16: true,
    outfitWindowRangeU16: true,
  });
  parser.seekMode = true;

  // Last-write-wins tile storage
  const latestTiles = new Map<string, number[]>();

  // Spawn tracking
  const chunkAccumulators = new Map<string, ChunkAccumulator>();
  let lastPlayerChunkKey = '';
  // Current visit data for chunks in viewport
  let currentVisitChunks = new Map<string, ChunkVisitData>();

  // Track camZ to detect floor changes and skip stale tile snapshots
  let lastCamZ = -1;
  let floorStableBatches = 0;

  let frameIdx = 0;

  return new Promise((resolve) => {
    function processChunk() {
      const end = Math.min(frameIdx + chunkSize, cam.frames.length);
      let anyFloorChange = false;

      for (; frameIdx < end; frameIdx++) {
        try {
          parser.process(cam.frames[frameIdx].payload);
        } catch {
          // Skip broken frames
        }

        // Detect floor change per-frame, not per-chunk
        if (lastCamZ >= 0 && gs.camZ !== lastCamZ) {
          gs.tiles.clear(); // Purge stale offset tiles immediately
          anyFloorChange = true;
        }
        lastCamZ = gs.camZ;
      }

      // Cooldown: skip snapshots for 3 batches after any floor change
      if (anyFloorChange) {
        floorStableBatches = 0;
      } else {
        floorStableBatches++;
      }

      if (floorStableBatches >= 2) {
        snapshotTiles(gs, dat, latestTiles);
      }

      // Check if player moved to a new chunk -> flush old visit
      const playerChunkX = Math.floor(gs.camX / DB_CHUNK);
      const playerChunkY = Math.floor(gs.camY / DB_CHUNK);
      const playerChunkKey = `${playerChunkX},${playerChunkY},${gs.camZ}`;

      if (playerChunkKey !== lastPlayerChunkKey && lastPlayerChunkKey !== '') {
        // Flush current visit data into accumulators
        flushVisit(currentVisitChunks, chunkAccumulators);
        currentVisitChunks = new Map();
      }
      lastPlayerChunkKey = playerChunkKey;

      // Snapshot creatures into current visit
      snapshotCreaturesForVisit(gs, currentVisitChunks);

      if (onProgress) {
        onProgress({
          processedFrames: frameIdx,
          totalFrames: cam.frames.length,
          tilesExtracted: latestTiles.size,
          percent: Math.round((frameIdx / cam.frames.length) * 100),
        });
      }

      if (frameIdx < cam.frames.length) {
        setTimeout(processChunk, 0);
      } else {
        // Final snapshot before resolving
        if (floorStableBatches > 0) snapshotTiles(gs, dat, latestTiles);

        // Flush last visit
        flushVisit(currentVisitChunks, chunkAccumulators);

        const spawns = buildSpawnData(chunkAccumulators);
        resolve({ tiles: latestTiles, spawns });
      }
    }

    setTimeout(processChunk, 0);
  });
}

/**
 * Snapshot living creatures into current visit data, grouped by chunk.
 * Uses max count per creature type seen during a visit (not sum).
 */
function snapshotCreaturesForVisit(
  gs: GameState,
  visitChunks: Map<string, ChunkVisitData>,
) {
  const camX = gs.camX;
  const camY = gs.camY;
  const camZ = gs.camZ;

  // Count creatures per chunk+name in this snapshot
  const snapshotCounts = new Map<string, Map<string, { count: number; outfitId: number; positions: string[] }>>();

  for (const c of gs.creatures.values()) {
    if (c.x === 0 && c.y === 0 && c.z === 0) continue;
    if (!c.name || c.name === '') continue;
    if (c.outfit === 0 && c.outfitItem === 0) continue;
    if (c.health <= 0) continue; // Only living creatures
    if (c.x < 30000 || c.x > 35000 || c.y < 30000 || c.y > 35000 || c.z < 0 || c.z > 15) continue;
    if (Math.abs(c.x - camX) > 20 || Math.abs(c.y - camY) > 16) continue;
    // Accept creatures from all visible floors (no Z filter)
    if (c.id === gs.playerId) continue;
    if (c.head !== 0 || c.body !== 0 || c.legs !== 0 || c.feet !== 0) continue;
    if (c.outfit >= 128 && c.outfit <= 143) continue;

    const cx = Math.floor(c.x / DB_CHUNK);
    const cy = Math.floor(c.y / DB_CHUNK);
    const chunkKey = `${cx},${cy},${c.z}`;
    const relX = c.x - cx * DB_CHUNK;
    const relY = c.y - cy * DB_CHUNK;

    let chunkSnap = snapshotCounts.get(chunkKey);
    if (!chunkSnap) { chunkSnap = new Map(); snapshotCounts.set(chunkKey, chunkSnap); }

    let entry = chunkSnap.get(c.name);
    if (!entry) { entry = { count: 0, outfitId: c.outfit, positions: [] }; chunkSnap.set(c.name, entry); }
    entry.count++;
    entry.positions.push(`${relX},${relY}`);
  }

  // Merge snapshot into visit: keep MAX count per creature type
  for (const [chunkKey, creatures] of snapshotCounts) {
    let visit = visitChunks.get(chunkKey);
    if (!visit) { visit = { creatures: new Map() }; visitChunks.set(chunkKey, visit); }

    for (const [name, snap] of creatures) {
      let existing = visit.creatures.get(name);
      if (!existing) {
        existing = { count: 0, outfitId: snap.outfitId, positions: new Set() };
        visit.creatures.set(name, existing);
      }
      // Keep max count seen in any single snapshot during this visit
      existing.count = Math.max(existing.count, snap.count);
      existing.outfitId = snap.outfitId;
      for (const pos of snap.positions) existing.positions.add(pos);
    }
  }
}

/**
 * Flush a completed visit into the accumulators.
 */
function flushVisit(
  visitChunks: Map<string, ChunkVisitData>,
  accumulators: Map<string, ChunkAccumulator>,
) {
  for (const [chunkKey, visit] of visitChunks) {
    let acc = accumulators.get(chunkKey);
    if (!acc) { acc = { creatures: new Map(), totalVisits: 0 }; accumulators.set(chunkKey, acc); }
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

/**
 * Build final SpawnData array from accumulators.
 */
function buildSpawnData(accumulators: Map<string, ChunkAccumulator>): SpawnData[] {
  const spawns: SpawnData[] = [];

  for (const [chunkKey, acc] of accumulators) {
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
        avgCount: Math.round(avgCount * 10) / 10, // 1 decimal
        positions,
        visitCount: data.visitsSeen,
      });
    }
  }

  return spawns;
}

/**
 * Snapshot tiles using last-write-wins: stores the complete ordered
 * item list from the current GameState, replacing any previous data.
 */
function snapshotTiles(
  gs: GameState,
  dat: DatLoader,
  latestTiles: Map<string, number[]>,
) {
  const camX = gs.camX;
  const camY = gs.camY;
  const camZ = gs.camZ;

  for (const [key, tileItems] of gs.tiles.entries()) {
    const parts = key.split(',');
    if (parts.length !== 3) continue;
    const tx = parseInt(parts[0], 10);
    const ty = parseInt(parts[1], 10);
    const tz = parseInt(parts[2], 10);

    if (tx === 0 || ty === 0) continue;

    // Only capture tiles on the camera's current floor.
    if (tz !== camZ) continue;

    if (tx < 30000 || tx > 35000 || ty < 30000 || ty > 35000) continue;

    // Viewport validation: reject tiles whose coordinates are outside
    // the expected 18x14 viewport centered on camera position.
    // This catches tiles that have residual perspective offsets baked in
    // from floor transitions (readFloorArea).
    if (camX > 0 && camY > 0) {
      const dx = Math.abs(tx - camX);
      const dy = Math.abs(ty - camY);
      // Tibia 7.72 viewport is 18x14, half = 9x7
      if (dx > 9 || dy > 7) continue;
    }

    const items: number[] = [];
    for (const item of tileItems) {
      if (item[0] !== 'it') continue;
      const id = item[1];
      if (id < 100 || id > 9999) continue;
      const def = dat.items.get(id);
      if (!def || def.stackPrio > 5) continue;
      items.push(id);
    }

    if (items.length > 0) {
      const correctedKey = `${tx},${ty},${tz}`;
      latestTiles.set(correctedKey, items);
    }
  }
}
