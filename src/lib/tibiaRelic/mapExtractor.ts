/**
 * Map Extractor - processes all frames of a .cam file and extracts
 * static tile data (ground items) and creature spawns for building the Cam Map.
 * 
 * Filters out creatures from tiles, keeping only items with stackPrio 0-5.
 * Uses persistence heuristic to filter out corpses (items seen in < 2 snapshots).
 * Also extracts living creatures (health > 0) with outfit/position/direction.
 * 
 * Returns tiles Map<string, number[]> and creatures Map<string, CreatureSpawn>.
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

export interface CreatureSpawn {
  x: number;
  y: number;
  z: number;
  name: string;
  outfitId: number;
  direction: number;
}

export interface MapExtractionResult {
  tiles: Map<string, number[]>;
  creatures: Map<string, CreatureSpawn>;
}

/**
 * Extract all static tiles and creature spawns from a .cam file.
 * Uses chunked processing via requestAnimationFrame to avoid blocking the UI.
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
  parser.seekMode = true; // No animations needed

  // Persistence counters: key "x,y,z" -> Map<itemId, snapshotCount>
  const itemCounts = new Map<string, Map<number, number>>();
  // Creature spawns: key "gridX,gridY,z,name" -> CreatureSpawn (last sighting wins)
  const creatureMap = new Map<string, CreatureSpawn>();
  // Track creatures seen dead — will be purged at end
  const deadCreatures = new Set<string>();

  let frameIdx = 0;
  let snapshotNum = 0;

  return new Promise((resolve) => {
    function processChunk() {
      const end = Math.min(frameIdx + chunkSize, cam.frames.length);

      for (; frameIdx < end; frameIdx++) {
        try {
          parser.process(cam.frames[frameIdx].payload);
        } catch {
          // Skip broken frames
        }
      }

      // After each chunk, snapshot current tiles and creatures
      snapshotNum++;
      snapshotTilesWithCounts(gs, dat, itemCounts, snapshotNum);
      snapshotCreatures(gs, creatureMap, deadCreatures);

      if (onProgress) {
        onProgress({
          processedFrames: frameIdx,
          totalFrames: cam.frames.length,
          tilesExtracted: itemCounts.size,
          percent: Math.round((frameIdx / cam.frames.length) * 100),
        });
      }

      if (frameIdx < cam.frames.length) {
        requestAnimationFrame(processChunk);
      } else {
        // Build final tiles using persistence filter (items seen in >= 2 snapshots)
        const tiles = buildFilteredTiles(itemCounts, dat);
        // Purge creatures that were last seen dead
        for (const deadKey of deadCreatures) {
          creatureMap.delete(deadKey);
        }
        resolve({ tiles, creatures: creatureMap });
      }
    }

    requestAnimationFrame(processChunk);
  });
}

/**
 * Snapshot all tiles, incrementing per-item counters for persistence tracking.
 */
function snapshotTilesWithCounts(
  gs: GameState,
  dat: DatLoader,
  itemCounts: Map<string, Map<number, number>>,
  _snapshotNum: number,
) {
  // Only accept tiles within the camera viewport (~18x14 around camera center)
  // This prevents broken frames from placing tiles at completely wrong coordinates
  const camX = gs.camX;
  const camY = gs.camY;
  const camZ = gs.camZ;
  const VIEW_RANGE_X = 20; // generous margin beyond 18x14 viewport
  const VIEW_RANGE_Y = 16;

  for (const [key, tileItems] of gs.tiles.entries()) {
    // Parse exact coordinates from tile key
    const parts = key.split(',');
    if (parts.length !== 3) continue;
    const tx = parseInt(parts[0], 10);
    const ty = parseInt(parts[1], 10);
    const tz = parseInt(parts[2], 10);

    // Skip tiles with invalid/zero coordinates
    if (tx === 0 || ty === 0) continue;
    // Skip tiles on different floor than camera (only accept same floor)
    if (tz !== camZ) continue;
    // Skip tiles outside reasonable viewport range of camera
    if (Math.abs(tx - camX) > VIEW_RANGE_X || Math.abs(ty - camY) > VIEW_RANGE_Y) continue;
    // Skip tiles with obviously invalid world coordinates (Tibia map range)
    if (tx < 30000 || tx > 35000 || ty < 30000 || ty > 35000 || tz < 0 || tz > 15) continue;

    for (const item of tileItems) {
      if (item[0] !== 'it') continue;
      const id = item[1];
      if (id < 100 || id > 9999) continue;
      const def = dat.items.get(id);
      if (!def || def.stackPrio > 5) continue;

      let counts = itemCounts.get(key);
      if (!counts) { counts = new Map(); itemCounts.set(key, counts); }
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
}

/**
 * Snapshot living creatures from the GameState.
 * Uses "last sighting wins" — always overwrites previous entry.
 * Tracks dead creatures to purge them at the end.
 */
function snapshotCreatures(
  gs: GameState,
  creatureMap: Map<string, CreatureSpawn>,
  deadCreatures: Set<string>,
) {
  const camX = gs.camX;
  const camY = gs.camY;
  const camZ = gs.camZ;

  for (const c of gs.creatures.values()) {
    if (c.x === 0 && c.y === 0 && c.z === 0) continue;
    if (!c.name || c.name === '') continue;
    if (c.outfit === 0 && c.outfitItem === 0) continue;

    // Skip creatures with invalid world coordinates
    if (c.x < 30000 || c.x > 35000 || c.y < 30000 || c.y > 35000 || c.z < 0 || c.z > 15) continue;
    // Skip creatures too far from camera (likely stale data)
    if (Math.abs(c.x - camX) > 20 || Math.abs(c.y - camY) > 16) continue;
    // Skip creatures on different floor
    if (c.z !== camZ) continue;

    // Skip the recording player
    if (c.id === gs.playerId) continue;

    // Skip other players: those with customized outfit colors
    if (c.head !== 0 || c.body !== 0 || c.legs !== 0 || c.feet !== 0) continue;

    // Skip players with default white outfit (outfit 128-143 with all colors zero)
    if (c.outfit >= 128 && c.outfit <= 143) continue;

    // Round to 5x5 grid to deduplicate moving creatures
    const gridX = Math.round(c.x / 5) * 5;
    const gridY = Math.round(c.y / 5) * 5;
    const key = `${gridX},${gridY},${c.z},${c.name}`;

    if (c.health <= 0) {
      // Mark as dead — will be purged at end
      deadCreatures.add(key);
      creatureMap.delete(key);
      continue;
    }

    // Always overwrite with latest sighting (removes "first only" limitation)
    // Also remove from dead set if it respawned
    deadCreatures.delete(key);
    creatureMap.set(key, {
      x: gridX,
      y: gridY,
      z: c.z,
      name: c.name,
      outfitId: c.outfit,
      direction: c.direction,
    });
  }
}

/**
 * Build final tile map, keeping only items seen in >= 2 snapshots (filters corpses).
 * Ground tiles (stackPrio 0) are always kept (they don't decay).
 */
function buildFilteredTiles(
  itemCounts: Map<string, Map<number, number>>,
  dat: DatLoader,
): Map<string, number[]> {
  const result = new Map<string, number[]>();

  for (const [key, counts] of itemCounts.entries()) {
    const itemIds: number[] = [];
    for (const [id, count] of counts.entries()) {
      const def = dat.items.get(id);
      // Ground tiles (stackPrio 0) always kept; others need >= 2 sightings
      if (def && (def.stackPrio === 0 || count >= 2)) {
        itemIds.push(id);
      }
    }
    if (itemIds.length > 0) {
      result.set(key, itemIds);
    }
  }

  return result;
}
