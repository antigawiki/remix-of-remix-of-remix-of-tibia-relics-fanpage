/**
 * Map Extractor - processes all frames of a .cam file and extracts
 * static tile data (ground items) for building the Cam Map.
 * 
 * Filters out creatures, keeping only items with stackPrio 0-5.
 * Returns a Map<string, number[]> with key "x,y,z" and value = array of item IDs.
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

/**
 * Extract all static tiles from a .cam file.
 * Uses chunked processing via requestAnimationFrame to avoid blocking the UI.
 */
export async function extractMapTiles(
  cam: CamFile,
  dat: DatLoader,
  onProgress?: ProgressCallback,
  chunkSize = 500,
): Promise<Map<string, number[]>> {
  const gs = new GameState();
  const parser = new PacketParser(gs, dat, {
    looktypeU16: true,
    outfitWindowRangeU16: true,
  });
  parser.seekMode = true; // No animations needed

  const result = new Map<string, number[]>();
  let frameIdx = 0;

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

      // After each chunk, snapshot current tiles
      snapshotTiles(gs, dat, result);

      if (onProgress) {
        onProgress({
          processedFrames: frameIdx,
          totalFrames: cam.frames.length,
          tilesExtracted: result.size,
          percent: Math.round((frameIdx / cam.frames.length) * 100),
        });
      }

      if (frameIdx < cam.frames.length) {
        requestAnimationFrame(processChunk);
      } else {
        resolve(result);
      }
    }

    requestAnimationFrame(processChunk);
  });
}

/**
 * Snapshot all tiles from the current GameState, keeping only items (no creatures).
 * Merges intelligently: keeps the version with the most items.
 */
function snapshotTiles(
  gs: GameState,
  dat: DatLoader,
  result: Map<string, number[]>,
) {
  for (const [key, tileItems] of gs.tiles.entries()) {
    // Filter to only static items (no creatures)
    const itemIds: number[] = [];
    for (const item of tileItems) {
      if (item[0] !== 'it') continue;
      const id = item[1];
      if (id < 100 || id > 9999) continue;
      const def = dat.items.get(id);
      // Keep ground, clip, bottom, top, and regular items
      if (def && def.stackPrio <= 5) {
        itemIds.push(id);
      }
    }

    if (itemIds.length === 0) continue;

    // Merge: keep the version with more items (more complete tile)
    const existing = result.get(key);
    if (!existing || itemIds.length >= existing.length) {
      result.set(key, itemIds);
    }
  }
}
