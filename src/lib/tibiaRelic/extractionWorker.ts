/**
 * Web Worker for map extraction from .cam files.
 * Uses the new ExtractionParser + ExtractionStore for correct absolute coordinates.
 * Runs in a separate thread so it continues even when the browser tab is hidden.
 */
import { parseCamFile } from './camParser';
import { DatLoader } from './datLoader';
import { ExtractionParser } from './extractionParser';
import { ExtractionStore } from './extractionStore';
import type { SpawnData } from './mapExtractor';

export interface WorkerRequest {
  camBuffer: ArrayBuffer;
  datBuffer: ArrayBuffer;
}

export interface WorkerProgressMessage {
  type: 'progress';
  processedFrames: number;
  totalFrames: number;
  tilesExtracted: number;
  percent: number;
}

export interface WorkerResultMessage {
  type: 'result';
  /** Tiles serialized as array of [key, items[]] */
  tiles: Array<[string, number[]]>;
  spawns: SpawnData[];
}

export interface WorkerErrorMessage {
  type: 'error';
  message: string;
}

export type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const { camBuffer, datBuffer } = e.data;

    const dat = new DatLoader();
    dat.load(datBuffer);

    const cam = parseCamFile(camBuffer);
    if (cam.frames.length === 0) {
      (self as any).postMessage({ type: 'error', message: 'Empty .cam file' } satisfies WorkerErrorMessage);
      return;
    }

    const store = new ExtractionStore(dat);
    const parser = new ExtractionParser(dat);

    // Wire callbacks
    parser.onTile = (tile) => store.addTile(tile);
    parser.onCreature = (creature, location) => store.addCreature(creature, location);

    const totalFrames = cam.frames.length;
    const progressInterval = Math.max(1, Math.floor(totalFrames / 100));

    // Process each frame individually (no batching = no floor desync)
    for (let i = 0; i < totalFrames; i++) {
      parser.parsePacket(cam.frames[i].payload);

      // Update player location for spawn tracking
      store.updatePlayerLocation(parser.location);

      // Report progress periodically
      if (i % progressInterval === 0 || i === totalFrames - 1) {
        (self as any).postMessage({
          type: 'progress',
          processedFrames: i + 1,
          totalFrames,
          tilesExtracted: store.tileCount,
          percent: Math.round(((i + 1) / totalFrames) * 100),
        } satisfies WorkerProgressMessage);
      }
    }

    const result = store.getResults();

    // Serialize Map to array for transferability
    const tilesArray: Array<[string, number[]]> = [];
    for (const [key, items] of result.tiles.entries()) {
      tilesArray.push([key, items]);
    }

    const msg: WorkerResultMessage = {
      type: 'result',
      tiles: tilesArray,
      spawns: result.spawns,
    };
    (self as any).postMessage(msg);
  } catch (err) {
    (self as any).postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown extraction error',
    } satisfies WorkerErrorMessage);
  }
};
