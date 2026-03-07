/**
 * Map Extractor — wrapper that delegates to ExtractionParser + ExtractionStore.
 * Maintains backward-compatible interface for callers.
 */
import { type CamFile } from './camParser';
import { DatLoader } from './datLoader';
import { ExtractionParser } from './extractionParser';
import { ExtractionStore } from './extractionStore';

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

/**
 * Synchronous extraction for use inside a Web Worker.
 */
export function extractMapTilesSync(
  cam: CamFile,
  dat: DatLoader,
  onProgress?: ProgressCallback,
  _chunkSize = 500,
): MapExtractionResult {
  const store = new ExtractionStore(dat);
  const parser = new ExtractionParser(dat);

  parser.onTile = (tile) => store.addTile(tile);
  parser.onCreature = (creature, location) => store.addCreature(creature, location);

  const totalFrames = cam.frames.length;
  const progressInterval = Math.max(1, Math.floor(totalFrames / 100));

  for (let i = 0; i < totalFrames; i++) {
    parser.parsePacket(cam.frames[i].payload);
    store.updatePlayerLocation(parser.location);

    if (onProgress && (i % progressInterval === 0 || i === totalFrames - 1)) {
      onProgress({
        processedFrames: i + 1,
        totalFrames,
        tilesExtracted: store.tileCount,
        percent: Math.round(((i + 1) / totalFrames) * 100),
      });
    }
  }

  return store.getResults();
}

/**
 * Async extraction using setTimeout for main-thread usage.
 */
export async function extractMapTiles(
  cam: CamFile,
  dat: DatLoader,
  onProgress?: ProgressCallback,
  chunkSize = 500,
): Promise<MapExtractionResult> {
  const store = new ExtractionStore(dat);
  const parser = new ExtractionParser(dat);

  parser.onTile = (tile) => store.addTile(tile);
  parser.onCreature = (creature, location) => store.addCreature(creature, location);

  const totalFrames = cam.frames.length;
  let frameIdx = 0;

  return new Promise((resolve) => {
    function processChunk() {
      const end = Math.min(frameIdx + chunkSize, totalFrames);

      for (; frameIdx < end; frameIdx++) {
        parser.parsePacket(cam.frames[frameIdx].payload);
        store.updatePlayerLocation(parser.location);
      }

      if (onProgress) {
        onProgress({
          processedFrames: frameIdx,
          totalFrames,
          tilesExtracted: store.tileCount,
          percent: Math.round((frameIdx / totalFrames) * 100),
        });
      }

      if (frameIdx < totalFrames) {
        setTimeout(processChunk, 0);
      } else {
        resolve(store.getResults());
      }
    }

    setTimeout(processChunk, 0);
  });
}
