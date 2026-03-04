/**
 * Protocol Reverse-Engineering Lab
 * Tests multiple floor-range strategies on each failed frame to determine
 * what the TibiaRelic server actually sends.
 */
import { parseCamFile, type CamFrame } from './camParser';
import { GameState, type GameStateSnapshot } from './gameState';
import { DatLoader } from './datLoader';
import { PacketParser, type TraceEntry } from './packetParser';

export interface FloorStrategy {
  name: string;
  label: string;
  plus: number;
  minus: number;
}

export const STRATEGIES: FloorStrategy[] = [
  { name: 'A', label: '±2 (atual)', plus: 2, minus: 2 },
  { name: 'B', label: '±1', plus: 1, minus: 1 },
  { name: 'C', label: '±3', plus: 3, minus: 3 },
  { name: 'D', label: 'Single floor (±0)', plus: 0, minus: 0 },
  { name: 'E', label: 'Surface full (7→0)', plus: 7, minus: 7 },
];

export interface StrategyResult {
  strategy: FloorStrategy;
  success: boolean;
  opcodesProcessed: number;
  bytesConsumed: number;
  bytesLeft: number;
  error: string | null;
  traceLog: TraceEntry[];
}

export interface ErrorFrame {
  frameIndex: number;
  timestamp: number;
  camZ: number;
  error: string;
  opcodesBefore: number[];
  failedOpcode: number | null;
  payload: Uint8Array;
  strategyResults: StrategyResult[];
  bestStrategy: string | null;
}

export interface LabResult {
  totalFrames: number;
  totalMs: number;
  errorFrames: ErrorFrame[];
  successFrames: number;
  strategySummary: Record<string, number>;
  opcodeErrorMap: Record<string, number>;
  recommendation: string;
}

export async function runProtocolLab(
  data: ArrayBuffer,
  datLoader: DatLoader,
  onProgress?: (current: number, total: number, phase: string) => void,
): Promise<LabResult> {
  const cam = parseCamFile(data);
  const gs = new GameState();
  const parser = new PacketParser(gs, datLoader, { looktypeU16: true });
  parser.seekMode = true;

  const errorFrameIndices: number[] = [];
  const frameSnapshots: Map<number, GameStateSnapshot> = new Map();
  const frameErrors: Map<number, { error: string; opcodes: number[]; camZ: number }> = new Map();

  // Phase 1: Process all frames, find errors, save snapshots before error frames
  let prevSnapshot: GameStateSnapshot = gs.snapshot();
  
  for (let i = 0; i < cam.frames.length; i++) {
    if (onProgress && i % 200 === 0) {
      onProgress(i, cam.frames.length, 'Scanning frames');
      await new Promise(r => setTimeout(r, 0));
    }

    const snap = gs.snapshot();
    const frame = cam.frames[i];

    try {
      parser.process(frame.payload);
    } catch (e: any) {
      errorFrameIndices.push(i);
      frameSnapshots.set(i, snap);
      frameErrors.set(i, {
        error: e?.message || String(e),
        opcodes: [...parser.lastFrameOpcodes],
        camZ: snap.camZ,
      });
    }
    prevSnapshot = gs.snapshot();
  }

  if (onProgress) onProgress(cam.frames.length, cam.frames.length, 'Scanning complete');

  // Phase 2: For each error frame, test all strategies
  const errorFrames: ErrorFrame[] = [];
  const strategySummary: Record<string, number> = {};
  const opcodeErrorMap: Record<string, number> = {};

  for (const strat of STRATEGIES) {
    strategySummary[strat.name] = 0;
  }

  for (let ei = 0; ei < errorFrameIndices.length; ei++) {
    const fi = errorFrameIndices[ei];
    if (onProgress && ei % 10 === 0) {
      onProgress(ei, errorFrameIndices.length, 'Testing strategies');
      await new Promise(r => setTimeout(r, 0));
    }

    const frame = cam.frames[fi];
    const snap = frameSnapshots.get(fi)!;
    const errInfo = frameErrors.get(fi)!;

    // Track which opcode caused the failure
    const failedOp = errInfo.opcodes.length > 0 ? errInfo.opcodes[errInfo.opcodes.length - 1] : null;
    if (failedOp !== null) {
      const key = '0x' + failedOp.toString(16).toUpperCase();
      opcodeErrorMap[key] = (opcodeErrorMap[key] || 0) + 1;
    }

    const strategyResults: StrategyResult[] = [];
    let bestStrategy: string | null = null;

    for (const strat of STRATEGIES) {
      const testGs = new GameState();
      testGs.restore(snap);
      const testParser = new PacketParser(testGs, datLoader, {
        looktypeU16: true,
        floorRangeOverride: { plus: strat.plus, minus: strat.minus },
        traceMode: true,
      });
      testParser.seekMode = true;

      let success = false;
      let error: string | null = null;

      try {
        testParser.process(frame.payload);
        success = true;
      } catch (e: any) {
        error = e?.message || String(e);
      }

      const result: StrategyResult = {
        strategy: strat,
        success,
        opcodesProcessed: testParser.lastFrameOpcodes.length,
        bytesConsumed: frame.payload.length - (error ? 0 : 0), // approximate
        bytesLeft: 0,
        error,
        traceLog: [...testParser.traceLog],
      };

      strategyResults.push(result);

      if (success && !bestStrategy) {
        bestStrategy = strat.name;
        strategySummary[strat.name]++;
      }
    }

    errorFrames.push({
      frameIndex: fi,
      timestamp: frame.timestamp,
      camZ: errInfo.camZ,
      error: errInfo.error,
      opcodesBefore: errInfo.opcodes,
      failedOpcode: failedOp,
      payload: frame.payload,
      strategyResults,
      bestStrategy,
    });
  }

  if (onProgress) onProgress(errorFrameIndices.length, errorFrameIndices.length, 'Analysis complete');

  // Generate recommendation
  let recommendation = '';
  if (errorFrames.length === 0) {
    recommendation = 'Nenhum erro encontrado! A estratégia atual (±2) funciona perfeitamente.';
  } else {
    const sorted = Object.entries(strategySummary).sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    const total = errorFrames.length;
    const irrecoverable = errorFrames.filter(ef => !ef.bestStrategy).length;

    if (best[1] > 0) {
      const strat = STRATEGIES.find(s => s.name === best[0])!;
      recommendation = `De ${total} frames com erro, ${best[1]} (${Math.round(best[1]/total*100)}%) funcionaram com a estratégia ${strat.label}. `;
    }
    if (irrecoverable > 0) {
      recommendation += `${irrecoverable} frames são irrecuperáveis com qualquer estratégia de floor range.`;
    }
    if (Object.keys(opcodeErrorMap).length > 0) {
      const topOp = Object.entries(opcodeErrorMap).sort((a, b) => b[1] - a[1])[0];
      recommendation += ` O opcode mais problemático é ${topOp[0]} (${topOp[1]} erros).`;
    }
  }

  return {
    totalFrames: cam.frames.length,
    totalMs: cam.totalMs,
    errorFrames,
    successFrames: cam.frames.length - errorFrameIndices.length,
    strategySummary,
    opcodeErrorMap,
    recommendation,
  };
}
