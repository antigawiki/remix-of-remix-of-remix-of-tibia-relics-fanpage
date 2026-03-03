/**
 * Cam Packet Analyzer — offline batch analysis of .cam files
 * Processes all frames and detects position anomalies (jumps, floor changes, desyncs)
 */
import { parseCamFile, type CamFrame } from './camParser';
import { GameState } from './gameState';
import { DatLoader } from './datLoader';
import { PacketParser } from './packetParser';

export interface PositionSnapshot {
  camX: number;
  camY: number;
  camZ: number;
  playerX: number;
  playerY: number;
  playerZ: number;
}

export interface Anomaly {
  frameIndex: number;
  timestamp: number;
  type: 'POSITION_JUMP' | 'FLOOR_JUMP' | 'WALK_FAIL' | 'DESYNC';
  description: string;
  before: PositionSnapshot;
  after: PositionSnapshot;
  opcodes: number[];
}

export interface FrameDetail {
  frameIndex: number;
  timestamp: number;
  opcodes: number[];
  posAfter: PositionSnapshot;
}

export interface AnalysisResult {
  totalFrames: number;
  totalMs: number;
  anomalies: Anomaly[];
  positionTimeline: (PositionSnapshot & { ms: number })[];
  frameDetails: FrameDetail[];
}

function getSnapshot(gs: GameState): PositionSnapshot {
  const player = gs.playerId ? gs.creatures.get(gs.playerId) : null;
  return {
    camX: gs.camX,
    camY: gs.camY,
    camZ: gs.camZ,
    playerX: player?.x ?? gs.camX,
    playerY: player?.y ?? gs.camY,
    playerZ: player?.z ?? gs.camZ,
  };
}

/**
 * Extract opcodes from a frame payload (reads the opcode bytes without full parsing)
 */
function extractOpcodes(payload: Uint8Array): number[] {
  const opcodes: number[] = [];
  // Simple extraction: just grab the first byte(s) that look like opcodes
  // For a more detailed view, we track them during parsing
  if (payload.length > 0) {
    const firstByte = payload[0];
    if (firstByte < 0x0A && payload.length >= 2) {
      // TCP demux format - extract opcodes from sub-packets
      let pos = 0;
      while (pos + 2 < payload.length) {
        const subLen = payload[pos] | (payload[pos + 1] << 8);
        pos += 2;
        if (subLen === 0 || pos + subLen > payload.length) break;
        if (pos < payload.length) opcodes.push(payload[pos]);
        pos += subLen;
      }
    } else {
      // Direct opcodes
      opcodes.push(firstByte);
      // Try to get more opcodes (simplified — full parsing would be needed for accuracy)
    }
  }
  return opcodes;
}

export async function analyzeCamFile(
  data: ArrayBuffer,
  datLoader: DatLoader,
  onProgress?: (current: number, total: number) => void,
): Promise<AnalysisResult> {
  const cam = parseCamFile(data);
  const gs = new GameState();
  const parser = new PacketParser(gs, datLoader, { looktypeU16: true });
  parser.seekMode = true; // skip animations for speed

  const anomalies: Anomaly[] = [];
  const timeline: (PositionSnapshot & { ms: number })[] = [];
  const frameDetails: FrameDetail[] = [];

  let prevSnap: PositionSnapshot = getSnapshot(gs);
  let initialized = false;

  for (let i = 0; i < cam.frames.length; i++) {
    const frame = cam.frames[i];

    // Report progress every 500 frames
    if (onProgress && i % 500 === 0) {
      onProgress(i, cam.frames.length);
      // Yield to UI thread
      await new Promise(r => setTimeout(r, 0));
    }

    const beforeSnap = getSnapshot(gs);
    const opcodes = extractOpcodes(frame.payload);

    try {
      parser.process(frame.payload);
    } catch (e) {
      // Parser error — record but continue
    }

    const afterSnap = getSnapshot(gs);

    // Record timeline point
    timeline.push({ ms: frame.timestamp, ...afterSnap });

    // Record frame detail
    frameDetails.push({
      frameIndex: i,
      timestamp: frame.timestamp,
      opcodes,
      posAfter: afterSnap,
    });

    // Skip anomaly detection until map is loaded (first mapDesc)
    if (!initialized) {
      if (gs.mapLoaded) {
        initialized = true;
        prevSnap = afterSnap;
      }
      continue;
    }

    // Detect anomalies
    const dCamX = Math.abs(afterSnap.camX - beforeSnap.camX);
    const dCamY = Math.abs(afterSnap.camY - beforeSnap.camY);
    const dCamZ = afterSnap.camZ - beforeSnap.camZ;
    const dPlayerX = Math.abs(afterSnap.playerX - beforeSnap.playerX);
    const dPlayerY = Math.abs(afterSnap.playerY - beforeSnap.playerY);
    const dPlayerZ = afterSnap.playerZ - beforeSnap.playerZ;

    // Check for floor changes (via floorUp/floorDown opcodes 0xBE/0xBF or mapDesc 0x64)
    const hasFloorOpcode = opcodes.some(op => op === 0xBE || op === 0xBF || op === 0x64);

    if (dCamZ !== 0 && !hasFloorOpcode) {
      anomalies.push({
        frameIndex: i,
        timestamp: frame.timestamp,
        type: 'FLOOR_JUMP',
        description: `Floor changed Z ${beforeSnap.camZ} → ${afterSnap.camZ} without floor opcode`,
        before: beforeSnap,
        after: afterSnap,
        opcodes,
      });
    } else if (dCamX > 2 || dCamY > 2 || dPlayerX > 2 || dPlayerY > 2) {
      // Position jump — more than 2 tiles in a single frame (excluding mapDesc which is a teleport)
      const isMapDesc = opcodes.includes(0x64);
      const isPlayerPos = opcodes.includes(0x9A);
      anomalies.push({
        frameIndex: i,
        timestamp: frame.timestamp,
        type: 'POSITION_JUMP',
        description: `Jump: cam(${beforeSnap.camX},${beforeSnap.camY}) → (${afterSnap.camX},${afterSnap.camY}), ` +
          `player(${beforeSnap.playerX},${beforeSnap.playerY}) → (${afterSnap.playerX},${afterSnap.playerY})` +
          (isMapDesc ? ' [mapDesc]' : '') + (isPlayerPos ? ' [playerPos]' : ''),
        before: beforeSnap,
        after: afterSnap,
        opcodes,
      });
    }

    // Desync: camera and player are on different floors
    if (afterSnap.camZ !== afterSnap.playerZ && gs.playerId) {
      anomalies.push({
        frameIndex: i,
        timestamp: frame.timestamp,
        type: 'DESYNC',
        description: `Camera Z=${afterSnap.camZ} ≠ Player Z=${afterSnap.playerZ}`,
        before: beforeSnap,
        after: afterSnap,
        opcodes,
      });
    }

    prevSnap = afterSnap;
  }

  if (onProgress) onProgress(cam.frames.length, cam.frames.length);

  return {
    totalFrames: cam.frames.length,
    totalMs: cam.totalMs,
    anomalies,
    positionTimeline: timeline,
    frameDetails,
  };
}
