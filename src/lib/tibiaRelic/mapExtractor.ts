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
  // Creature spawns: key "x,y,z,name" -> CreatureSpawn (last seen wins)
  const creatureMap = new Map<string, CreatureSpawn>();

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
      snapshotCreatures(gs, creatureMap);

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
  for (const [key, tileItems] of gs.tiles.entries()) {
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
 */
function snapshotCreatures(
  gs: GameState,
  creatureMap: Map<string, CreatureSpawn>,
) {
  for (const c of gs.creatures.values()) {
    if (c.health <= 0) continue;
    if (c.x === 0 && c.y === 0 && c.z === 0) continue;
    if (!c.name || c.name === '') continue;
    if (c.outfit === 0 && c.outfitItem === 0) continue;

    // Skip the recording player
    if (c.id === gs.playerId) continue;

    // Skip other players (they have customized outfit colors; monsters/NPCs have all zeros)
    if (c.head !== 0 || c.body !== 0 || c.legs !== 0 || c.feet !== 0) continue;

    // Round to 5x5 grid to deduplicate moving creatures
    const gridX = Math.round(c.x / 5) * 5;
    const gridY = Math.round(c.y / 5) * 5;
    const key = `${gridX},${gridY},${c.z},${c.name}`;
    // Only store first sighting per grid cell (don't accumulate)
    if (!creatureMap.has(key)) {
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
