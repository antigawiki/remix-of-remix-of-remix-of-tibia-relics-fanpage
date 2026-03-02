/**
 * Web Worker for map extraction from .cam files.
 * Runs in a separate thread so it continues even when the browser tab is hidden.
 */
import { parseCamFile } from './camParser';
import { DatLoader } from './datLoader';
import { extractMapTilesSync } from './mapExtractor';

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
  spawns: import('./mapExtractor').SpawnData[];
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

    const result = extractMapTilesSync(cam, dat, (progress) => {
      (self as any).postMessage({
        type: 'progress',
        ...progress,
      } satisfies WorkerProgressMessage);
    });

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
