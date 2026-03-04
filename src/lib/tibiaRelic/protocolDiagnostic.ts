/**
 * Protocol Diagnostic — analyzes .cam files frame-by-frame,
 * running the real PacketParser and tracking opcode consumption.
 * Compares against known C++ tibiarc behavior to identify drift.
 */
import { parseCamFile } from './camParser';
import { Buf } from './buf';
import { DatLoader } from './datLoader';
import { GameState } from './gameState';
import { PacketParser } from './packetParser';

// ─── C++ tibiarc expected behavior per opcode ───
export interface CppOpcodeSpec {
  name: string;
  /** Fixed bytes C++ reads (excluding opcode byte), or special markers */
  cppBytes: number | 'dynamic' | 'NOT_HANDLED';
  /** Brief note */
  note?: string;
}

export const CPP_OPCODE_SPEC: Record<number, CppOpcodeSpec> = {
  0x0a: { name: 'SelfAppear', cppBytes: 'dynamic', note: 'u32+u16+u8 (7B)' },
  0x0b: { name: 'GMActions', cppBytes: 'NOT_HANDLED' },
  0x0f: { name: 'FYIMessage', cppBytes: 'NOT_HANDLED' },
  0x14: { name: 'ErrorMessage', cppBytes: 'NOT_HANDLED', note: 'JS: u16+str' },
  0x1d: { name: 'Pingback', cppBytes: 0 },
  0x1e: { name: 'Ping', cppBytes: 0 },
  0x28: { name: 'Death', cppBytes: 0 },
  0x63: { name: 'CreatureTurn', cppBytes: 5, note: 'u32+u8' },
  0x64: { name: 'MapDescription', cppBytes: 'dynamic' },
  0x65: { name: 'ScrollNorth', cppBytes: 'dynamic' },
  0x66: { name: 'ScrollEast', cppBytes: 'dynamic' },
  0x67: { name: 'ScrollSouth', cppBytes: 'dynamic' },
  0x68: { name: 'ScrollWest', cppBytes: 'dynamic' },
  0x69: { name: 'TileUpdate', cppBytes: 'dynamic' },
  0x6a: { name: 'AddThing', cppBytes: 'dynamic' },
  0x6b: { name: 'ChangeThing', cppBytes: 'dynamic' },
  0x6c: { name: 'DeleteThing', cppBytes: 6 },
  0x6d: { name: 'MoveCreature', cppBytes: 'dynamic' },
  0x6e: { name: 'OpenContainer', cppBytes: 'dynamic' },
  0x6f: { name: 'CloseContainer', cppBytes: 1 },
  0x70: { name: 'ContainerAddItem', cppBytes: 'dynamic' },
  0x71: { name: 'ContainerChangeItem', cppBytes: 'dynamic' },
  0x72: { name: 'ContainerRemoveItem', cppBytes: 2 },
  0x78: { name: 'SetInventory', cppBytes: 'dynamic' },
  0x79: { name: 'ClearInventory', cppBytes: 1 },
  0x7a: { name: 'NpcTradeList', cppBytes: 'dynamic' },
  0x7b: { name: 'NpcTradeAck', cppBytes: 'dynamic' },
  0x7c: { name: 'NpcTradeClose', cppBytes: 0 },
  0x7d: { name: 'TradeRequest', cppBytes: 'dynamic' },
  0x7e: { name: 'TradeAck', cppBytes: 'dynamic' },
  0x7f: { name: 'TradeClose', cppBytes: 0 },
  0x82: { name: 'WorldLight', cppBytes: 2 },
  0x83: { name: 'MagicEffect', cppBytes: 6 },
  0x84: { name: 'AnimatedText', cppBytes: 'dynamic' },
  0x85: { name: 'Projectile', cppBytes: 11 },
  0x86: { name: 'CreatureSquare', cppBytes: 5, note: 'u32+u8 — vanilla puts creatureSquare here' },
  0x87: { name: 'CreatureHealth(multi)', cppBytes: 'dynamic' },
  0x8c: { name: 'CreatureHealth', cppBytes: 5 },
  0x8d: { name: 'CreatureLight', cppBytes: 6 },
  0x8e: { name: 'CreatureOutfit', cppBytes: 'dynamic' },
  0x8f: { name: 'CreatureSpeed', cppBytes: 6 },
  0x90: { name: 'CreatureSkull', cppBytes: 5 },
  0x91: { name: 'CreatureShield', cppBytes: 5 },
  0x92: { name: 'CreatureUnpass', cppBytes: 5, note: 'C++ may ASSERT on this' },
  0x96: { name: 'OpenEditText', cppBytes: 'dynamic', note: 'C++ reads +author str. JS reads no author. DRIFT' },
  0x97: { name: 'OpenHouseText', cppBytes: 'dynamic' },
  0x9a: { name: 'PlayerPosition', cppBytes: 'NOT_HANDLED', note: 'JS: pos3 (5B). C++ CRASH' },
  0xa0: { name: 'PlayerStats', cppBytes: 'dynamic', note: 'C++ may read stamina (+4B). JS: 20B' },
  0xa1: { name: 'PlayerSkills', cppBytes: 14 },
  0xa2: { name: 'PlayerIcons', cppBytes: 1 },
  0xa3: { name: 'CancelTarget', cppBytes: 0 },
  0xa4: { name: 'SpellCooldown', cppBytes: 5, note: 'C++: u8+u32(5B). JS: u16(2B). DRIFT +3B' },
  0xa5: { name: 'SpellGroupCooldown', cppBytes: 5 },
  0xa6: { name: 'MultiUseDelay', cppBytes: 4 },
  0xa7: { name: 'PlayerTactics', cppBytes: 4, note: 'C++: 4×u8. JS: 3×u8. DRIFT +1B' },
  0xa8: { name: 'CreatureSquare(TR)', cppBytes: 'NOT_HANDLED', note: 'JS: u32+u8(5B). C++ uses 0x86' },
  0xaa: { name: 'Talk', cppBytes: 'dynamic', note: 'JS has u32 GUID. C++ may not. DRIFT −4B if so' },
  0xab: { name: 'Channels', cppBytes: 'dynamic' },
  0xac: { name: 'OpenChannel', cppBytes: 'dynamic' },
  0xad: { name: 'OpenPrivateChat', cppBytes: 'dynamic' },
  0xae: { name: 'RuleViolationChannel', cppBytes: 0 },
  0xaf: { name: 'RuleViolationRemove', cppBytes: 0 },
  0xb0: { name: 'RuleViolationCancel', cppBytes: 2 },
  0xb1: { name: 'LockViolation', cppBytes: 0 },
  0xb2: { name: 'PrivateChannelCreate', cppBytes: 'dynamic' },
  0xb3: { name: 'CloseChannel', cppBytes: 2 },
  0xb4: { name: 'TextMessage', cppBytes: 'dynamic' },
  0xb5: { name: 'WalkWait', cppBytes: 1 },
  0xb6: { name: 'WalkCancel', cppBytes: 2, note: 'C++: u16(2B). JS: 0B. DRIFT +2B' },
  0xb7: { name: 'UnjustifiedPoints', cppBytes: 7, note: 'C++: 7B. JS: 0B. DRIFT +7B' },
  0xb8: { name: 'PvPSituations', cppBytes: 1, note: 'C++: u8(1B). JS: 0B. DRIFT +1B' },
  0xbe: { name: 'FloorUp', cppBytes: 'dynamic' },
  0xbf: { name: 'FloorDown', cppBytes: 'dynamic' },
  0xc8: { name: 'OutfitWindow', cppBytes: 'dynamic' },
  0xd2: { name: 'VIPAdd', cppBytes: 'dynamic' },
  0xd3: { name: 'VIPLogin', cppBytes: 4 },
  0xd4: { name: 'VIPLogout', cppBytes: 4 },
  0xdc: { name: 'Tutorial', cppBytes: 1 },
  0xdd: { name: 'MinimapMark', cppBytes: 'dynamic' },
  0xf0: { name: 'QuestLog', cppBytes: 'dynamic' },
  0xf1: { name: 'QuestLine', cppBytes: 'dynamic' },
};

// ─── What JS parser actually consumes (fixed-size only) ───
const JS_FIXED_BYTES: Record<number, number> = {
  0x0a: 7, 0x0b: 0, 0x0f: 0, 0x1d: 0, 0x1e: 0, 0x28: 0,
  0x63: 5, 0x6c: 6, 0x6f: 1, 0x72: 2, 0x79: 1,
  0x7c: 0, 0x7f: 0, 0x82: 2, 0x83: 6, 0x85: 11,
  0x86: 5, 0x8c: 5, 0x8d: 6, 0x8f: 6, 0x90: 5, 0x91: 5, 0x92: 5,
  0xa0: 20, 0xa1: 14, 0xa2: 1, 0xa3: 0,
  0xa4: 2, 0xa5: 5, 0xa6: 4, 0xa7: 3, 0xa8: 5,
  0xae: 0, 0xaf: 0, 0xb0: 2, 0xb1: 0, 0xb3: 2, 0xb5: 1,
  0xb6: 0, 0xb7: 0, 0xb8: 0,
  0xd3: 4, 0xd4: 4, 0xdc: 1,
};

// ─── Diagnostic result types ───

export interface OpcodeStats {
  opcode: number;
  name: string;
  count: number;
  jsBytes: number | 'dynamic';
  cppBytes: number | 'dynamic' | 'NOT_HANDLED';
  drift: number | null; // null = dynamic/can't compute
  driftNote: string;
  firstFrame: number;
}

export interface FrameDiag {
  frameIndex: number;
  timestamp: number;
  payloadSize: number;
  opcodes: number[];
  bytesLeft: number;
  error?: string;
}

export interface ProtocolDiagnosticResult {
  totalFrames: number;
  totalMs: number;
  opcodeStats: OpcodeStats[];
  /** Frames with errors or byte drift */
  problemFrames: FrameDiag[];
  /** All opcode occurrences sorted by frequency */
  opcodeFrequency: { opcode: number; name: string; count: number }[];
  errorFrameCount: number;
  /** Summary of critical drift issues */
  criticalDrifts: {
    opcode: number;
    name: string;
    jsBytes: number | 'dynamic';
    cppBytes: number | 'dynamic' | 'NOT_HANDLED';
    driftPerOccurrence: number | string;
    totalOccurrences: number;
    totalDriftBytes: number | string;
    note: string;
  }[];
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export async function runProtocolDiagnostic(
  data: ArrayBuffer,
  datLoader: DatLoader,
  onProgress?: (current: number, total: number) => void,
): Promise<ProtocolDiagnosticResult> {
  const cam = parseCamFile(data);
  const gs = new GameState();
  const parser = new PacketParser(gs, datLoader, { looktypeU16: true });
  parser.seekMode = true;

  const opcodeCount = new Map<number, number>();
  const opcodeFirstFrame = new Map<number, number>();
  const problemFrames: FrameDiag[] = [];
  let errorFrameCount = 0;

  for (let i = 0; i < cam.frames.length; i++) {
    if (onProgress && i % 300 === 0) {
      onProgress(i, cam.frames.length);
      await new Promise(r => setTimeout(r, 0));
    }

    const frame = cam.frames[i];
    let error: string | undefined;

    try {
      parser.process(frame.payload);
    } catch (e: any) {
      error = e?.message || String(e);
      errorFrameCount++;
    }

    const opcodes = [...parser.lastFrameOpcodes];
    const bytesLeft = parser.bytesLeftAfterProcess;

    // Count opcodes
    for (const op of opcodes) {
      opcodeCount.set(op, (opcodeCount.get(op) || 0) + 1);
      if (!opcodeFirstFrame.has(op)) opcodeFirstFrame.set(op, i);
    }

    // Record problem frames
    if (error || bytesLeft > 0) {
      if (problemFrames.length < 300) {
        problemFrames.push({
          frameIndex: i,
          timestamp: frame.timestamp,
          payloadSize: frame.payload.length,
          opcodes,
          bytesLeft,
          error,
        });
      }
    }
  }

  if (onProgress) onProgress(cam.frames.length, cam.frames.length);

  // Build opcode stats
  const opcodeStats: OpcodeStats[] = [];
  for (const [opcode, count] of opcodeCount) {
    const spec = CPP_OPCODE_SPEC[opcode];
    const name = spec?.name || `Unknown_0x${opcode.toString(16).toUpperCase()}`;
    const jsFixed = JS_FIXED_BYTES[opcode];
    const jsBytes: number | 'dynamic' = jsFixed !== undefined ? jsFixed : 'dynamic';
    const cppBytes = spec?.cppBytes ?? 'NOT_HANDLED';

    let drift: number | null = null;
    let driftNote = '';

    if (typeof jsBytes === 'number' && typeof cppBytes === 'number') {
      drift = cppBytes - jsBytes;
      if (drift !== 0) {
        driftNote = `C++ reads ${cppBytes}B but JS reads ${jsBytes}B → drift ${drift > 0 ? '+' : ''}${drift}B per occurrence`;
      }
    } else if (cppBytes === 'NOT_HANDLED') {
      driftNote = `C++ has NO handler → crash. JS consumes ${jsBytes === 'dynamic' ? 'variable' : jsBytes + 'B'}.`;
      drift = null;
    } else if (spec?.note?.includes('DRIFT')) {
      driftNote = spec.note;
    }

    opcodeStats.push({
      opcode, name, count,
      jsBytes, cppBytes,
      drift, driftNote,
      firstFrame: opcodeFirstFrame.get(opcode) ?? -1,
    });
  }

  // Sort: drift issues first, then by frequency
  opcodeStats.sort((a, b) => {
    const aDrift = a.drift !== null && a.drift !== 0 ? 1 : a.cppBytes === 'NOT_HANDLED' ? 1 : 0;
    const bDrift = b.drift !== null && b.drift !== 0 ? 1 : b.cppBytes === 'NOT_HANDLED' ? 1 : 0;
    if (aDrift !== bDrift) return bDrift - aDrift;
    return b.count - a.count;
  });

  // Build critical drifts summary
  const criticalDrifts = opcodeStats
    .filter(s => (s.drift !== null && s.drift !== 0) || s.cppBytes === 'NOT_HANDLED')
    .map(s => ({
      opcode: s.opcode,
      name: s.name,
      jsBytes: s.jsBytes,
      cppBytes: s.cppBytes,
      driftPerOccurrence: s.drift !== null ? s.drift : (s.cppBytes === 'NOT_HANDLED' ? 'CRASH' : '?'),
      totalOccurrences: s.count,
      totalDriftBytes: s.drift !== null ? s.drift * s.count : 'N/A',
      note: s.driftNote,
    }));

  // Frequency list
  const opcodeFrequency = opcodeStats
    .map(s => ({ opcode: s.opcode, name: s.name, count: s.count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalFrames: cam.frames.length,
    totalMs: cam.totalMs,
    opcodeStats,
    problemFrames,
    opcodeFrequency,
    errorFrameCount,
    criticalDrifts,
  };
}
