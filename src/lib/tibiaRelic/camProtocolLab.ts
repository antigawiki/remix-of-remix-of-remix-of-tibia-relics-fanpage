/**
 * Protocol Reverse-Engineering Lab v3
 * Memory-efficient: uses lightweight position tracking in Phase 1,
 * checkpoint-based replay in Phase 2 for strategy testing.
 */
import { parseCamFile } from './camParser';
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
  { name: 'A', label: '7→0 (atual)', plus: 7, minus: 7 },
  { name: 'B', label: '±1', plus: 1, minus: 1 },
  { name: 'C', label: '±3', plus: 3, minus: 3 },
  { name: 'D', label: 'Single floor (±0)', plus: 0, minus: 0 },
];

export type AnomalyType = 'POSITION_JUMP' | 'FLOOR_JUMP' | 'DESYNC' | 'PARSE_ERROR' | 'BYTES_LEFTOVER';

export interface Anomaly {
  type: AnomalyType;
  detail: string;
  playerDelta?: number;
  floorDelta?: number;
}

export interface StrategyResult {
  strategy: FloorStrategy;
  success: boolean;
  opcodesProcessed: number;
  bytesLeft: number;
  playerCamDelta: number;
  playerFloorMatch: boolean;
  error: string | null;
  traceLog: TraceEntry[];
}

export interface ErrorFrame {
  frameIndex: number;
  timestamp: number;
  camZ: number;
  anomalies: Anomaly[];
  opcodes: number[];
  failedOpcode: number | null;
  payload: Uint8Array;
  bytesLeftover: number;
  playerPosBefore: { x: number; y: number; z: number } | null;
  camPosBefore: { x: number; y: number; z: number };
  playerPosAfter: { x: number; y: number; z: number } | null;
  camPosAfter: { x: number; y: number; z: number };
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
  anomalyTypeSummary: Record<string, number>;
  recommendation: string;
}

// Lightweight frame info — no deep clone of tiles/creatures
interface LightFrameInfo {
  index: number;
  playerBefore: { x: number; y: number; z: number } | null;
  camBefore: { x: number; y: number; z: number };
  playerAfter: { x: number; y: number; z: number } | null;
  camAfter: { x: number; y: number; z: number };
  opcodes: number[];
  bytesLeft: number;
  parseError: string | null;
  anomalies: Anomaly[];
}

const CHECKPOINT_INTERVAL = 500;
const MAX_ANOMALY_FRAMES = 150; // Cap strategy testing to avoid OOM

function getPlayerPos(gs: GameState): { x: number; y: number; z: number } | null {
  if (!gs.playerId) return null;
  const p = gs.creatures.get(gs.playerId);
  if (!p) return null;
  return { x: p.x, y: p.y, z: p.z };
}

function posDelta(a: { x: number; y: number; z: number } | null, b: { x: number; y: number; z: number }): number {
  if (!a) return 0;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
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

  // Phase 1: Process all frames with lightweight tracking
  // Save checkpoints periodically, detect anomalies by position comparison
  const checkpoints: Map<number, GameStateSnapshot> = new Map();
  const anomalyInfos: LightFrameInfo[] = [];

  for (let i = 0; i < cam.frames.length; i++) {
    if (onProgress && i % 500 === 0) {
      onProgress(i, cam.frames.length, 'Scanning frames');
      await new Promise(r => setTimeout(r, 0));
    }

    // Save checkpoint periodically (only for frames we might need to replay)
    if (i % CHECKPOINT_INTERVAL === 0) {
      checkpoints.set(i, gs.snapshot());
    }

    const frame = cam.frames[i];
    const playerBefore = getPlayerPos(gs);
    const camBefore = { x: gs.camX, y: gs.camY, z: gs.camZ };

    let parseError: string | null = null;
    try {
      parser.process(frame.payload);
    } catch (e: any) {
      parseError = e?.message || String(e);
    }

    const playerAfter = getPlayerPos(gs);
    const camAfter = { x: gs.camX, y: gs.camY, z: gs.camZ };
    const bytesLeft = parser.bytesLeftAfterProcess;
    const opcodes = [...parser.lastFrameOpcodes];

    // Detect anomalies (lightweight — no snapshots needed)
    const anomalies: Anomaly[] = [];

    if (parseError) {
      anomalies.push({ type: 'PARSE_ERROR', detail: parseError });
    }

    if (playerAfter && gs.mapLoaded) {
      const delta = posDelta(playerAfter, camAfter);
      if (delta > 2) {
        anomalies.push({
          type: 'DESYNC',
          detail: `Player (${playerAfter.x},${playerAfter.y},${playerAfter.z}) vs Cam (${camAfter.x},${camAfter.y},${camAfter.z}) delta=${delta}`,
          playerDelta: delta,
        });
      }
    }

    if (playerAfter && gs.mapLoaded && playerAfter.z !== camAfter.z) {
      anomalies.push({
        type: 'FLOOR_JUMP',
        detail: `Player Z=${playerAfter.z} vs Cam Z=${camAfter.z}`,
        floorDelta: Math.abs(playerAfter.z - camAfter.z),
      });
    }

    if (playerBefore && playerAfter && gs.mapLoaded && !opcodes.includes(0x64)) {
      const jump = posDelta(playerBefore, playerAfter);
      if (jump > 3) {
        anomalies.push({
          type: 'POSITION_JUMP',
          detail: `Player jumped ${jump} tiles: (${playerBefore.x},${playerBefore.y}) → (${playerAfter.x},${playerAfter.y})`,
          playerDelta: jump,
        });
      }
    }

    if (bytesLeft > 0 && !parseError) {
      anomalies.push({
        type: 'BYTES_LEFTOVER',
        detail: `${bytesLeft} bytes unconsumed after processing`,
      });
    }

    if (anomalies.length > 0 && anomalyInfos.length < MAX_ANOMALY_FRAMES) {
      anomalyInfos.push({
        index: i,
        playerBefore,
        camBefore,
        playerAfter,
        camAfter,
        opcodes,
        bytesLeft,
        parseError,
        anomalies,
      });
    }
  }

  if (onProgress) onProgress(cam.frames.length, cam.frames.length, 'Scanning complete');

  // Phase 2: For each anomaly frame, replay from nearest checkpoint and test strategies
  const errorFrames: ErrorFrame[] = [];
  const strategySummary: Record<string, number> = {};
  const opcodeErrorMap: Record<string, number> = {};
  const anomalyTypeSummary: Record<string, number> = {};

  for (const strat of STRATEGIES) strategySummary[strat.name] = 0;

  for (let ei = 0; ei < anomalyInfos.length; ei++) {
    const af = anomalyInfos[ei];
    if (onProgress && ei % 10 === 0) {
      onProgress(ei, anomalyInfos.length, 'Testing strategies');
      await new Promise(r => setTimeout(r, 0));
    }

    const frame = cam.frames[af.index];

    for (const a of af.anomalies) {
      anomalyTypeSummary[a.type] = (anomalyTypeSummary[a.type] || 0) + 1;
    }

    const lastOp = af.opcodes.length > 0 ? af.opcodes[af.opcodes.length - 1] : null;
    if (lastOp !== null && af.parseError) {
      const key = '0x' + lastOp.toString(16).toUpperCase();
      opcodeErrorMap[key] = (opcodeErrorMap[key] || 0) + 1;
    }

    // Find nearest checkpoint before this frame
    const checkpointIdx = Math.floor(af.index / CHECKPOINT_INTERVAL) * CHECKPOINT_INTERVAL;
    const checkpoint = checkpoints.get(checkpointIdx);

    // Test each strategy by replaying from checkpoint
    const strategyResults: StrategyResult[] = [];
    let bestStrategy: string | null = null;
    let bestDelta = Infinity;

    for (const strat of STRATEGIES) {
      const testGs = new GameState();
      if (checkpoint) {
        testGs.restore(checkpoint);
      }

      // Replay from checkpoint to the anomaly frame
      const replayParser = new PacketParser(testGs, datLoader, {
        looktypeU16: true,
        floorRangeOverride: { plus: strat.plus, minus: strat.minus },
      });
      replayParser.seekMode = true;

      // Replay intermediate frames (checkpoint → anomaly frame - 1)
      let replayOk = true;
      for (let ri = checkpointIdx; ri < af.index; ri++) {
        try {
          replayParser.process(cam.frames[ri].payload);
        } catch {
          // If replay fails before our target frame, this strategy can't work
          replayOk = false;
          break;
        }
      }

      if (!replayOk) {
        strategyResults.push({
          strategy: strat,
          success: false,
          opcodesProcessed: 0,
          bytesLeft: 0,
          playerCamDelta: Infinity,
          playerFloorMatch: false,
          error: 'Replay from checkpoint failed before target frame',
          traceLog: [],
        });
        continue;
      }

      // Now process the anomaly frame with tracing enabled
      const traceParser = new PacketParser(testGs, datLoader, {
        looktypeU16: true,
        floorRangeOverride: { plus: strat.plus, minus: strat.minus },
        traceMode: true,
        strictMode: true,
      });
      traceParser.seekMode = true;

      let success = false;
      let error: string | null = null;

      try {
        traceParser.process(frame.payload);
        success = true;
      } catch (e: any) {
        error = e?.message || String(e);
      }

      const playerAfter = getPlayerPos(testGs);
      const camAfter = { x: testGs.camX, y: testGs.camY, z: testGs.camZ };
      const playerCamDelta = playerAfter ? posDelta(playerAfter, camAfter) : 0;
      const playerFloorMatch = playerAfter ? playerAfter.z === camAfter.z : true;

      strategyResults.push({
        strategy: strat,
        success,
        opcodesProcessed: traceParser.lastFrameOpcodes.length,
        bytesLeft: traceParser.bytesLeftAfterProcess,
        playerCamDelta,
        playerFloorMatch,
        error,
        traceLog: [...traceParser.traceLog],
      });

      if (success && playerFloorMatch && playerCamDelta < bestDelta) {
        bestDelta = playerCamDelta;
        bestStrategy = strat.name;
      }
    }

    // Fallback: if no strategy succeeded with floor match
    if (!bestStrategy) {
      for (const sr of strategyResults) {
        if (sr.success && sr.playerCamDelta < bestDelta) {
          bestDelta = sr.playerCamDelta;
          bestStrategy = sr.strategy.name;
        }
      }
    }

    if (bestStrategy) strategySummary[bestStrategy]++;

    errorFrames.push({
      frameIndex: af.index,
      timestamp: frame.timestamp,
      camZ: af.camBefore.z,
      anomalies: af.anomalies,
      opcodes: af.opcodes,
      failedOpcode: lastOp,
      payload: frame.payload,
      bytesLeftover: af.bytesLeft,
      playerPosBefore: af.playerBefore,
      camPosBefore: af.camBefore,
      playerPosAfter: af.playerAfter,
      camPosAfter: af.camAfter,
      strategyResults,
      bestStrategy,
    });
  }

  // Free checkpoints
  checkpoints.clear();

  if (onProgress) onProgress(anomalyInfos.length, anomalyInfos.length, 'Analysis complete');

  // Generate recommendation
  let recommendation = '';
  if (errorFrames.length === 0) {
    recommendation = 'Nenhuma anomalia detectada! O parsing está funcionando corretamente.';
  } else {
    const sorted = Object.entries(strategySummary).sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    const total = errorFrames.length;
    const irrecoverable = errorFrames.filter(ef => !ef.bestStrategy).length;

    if (best[1] > 0) {
      const strat = STRATEGIES.find(s => s.name === best[0])!;
      recommendation = `De ${total} frames com anomalia, ${best[1]} (${Math.round(best[1] / total * 100)}%) tiveram melhor resultado com ${strat.label}. `;
    }
    if (irrecoverable > 0) {
      recommendation += `${irrecoverable} frames não melhoraram com nenhuma estratégia. `;
    }

    const typeEntries = Object.entries(anomalyTypeSummary).sort((a, b) => b[1] - a[1]);
    recommendation += `Tipos: ${typeEntries.map(([t, c]) => `${t}(${c})`).join(', ')}. `;

    if (Object.keys(opcodeErrorMap).length > 0) {
      const topOp = Object.entries(opcodeErrorMap).sort((a, b) => b[1] - a[1])[0];
      recommendation += `Opcode mais problemático: ${topOp[0]} (${topOp[1]} erros de parsing).`;
    }
  }

  return {
    totalFrames: cam.frames.length,
    totalMs: cam.totalMs,
    errorFrames,
    successFrames: cam.frames.length - errorFrames.length,
    strategySummary,
    opcodeErrorMap,
    anomalyTypeSummary,
    recommendation,
  };
}
