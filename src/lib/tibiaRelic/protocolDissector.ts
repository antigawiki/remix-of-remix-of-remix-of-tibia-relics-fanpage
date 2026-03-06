/**
 * Protocol Dissector — byte-level opcode tracer for .cam debugging
 * 
 * Wraps PacketParser to capture exact bytes consumed per opcode,
 * providing hex dumps, decoded field values, and camera state changes.
 */

export interface DissectedOpcode {
  frameIdx: number;
  camMs: number;
  opcode: number;
  opName: string;
  posBefore: number;
  posAfter: number;
  bytesConsumed: number;
  hexDump: string;       // hex of consumed bytes (max 64)
  camBefore: string;     // "x,y,z"
  camAfter: string;      // "x,y,z"
  playerBefore: string;  // "x,y,z" or "N/A"
  playerAfter: string;
  fields: Record<string, unknown>; // decoded fields
  error?: string;
  isMapOp: boolean;      // MAP_DESC, SCROLL, FLOOR_UP/DOWN
}

export interface DissectedFrame {
  frameIdx: number;
  camMs: number;
  totalBytes: number;
  opcodes: DissectedOpcode[];
  bytesLeft: number;
  error?: string;
}

const OPCODE_NAMES: Record<number, string> = {
  0x0a: 'LOGIN', 0x0b: 'GM_ACTIONS', 0x0f: 'FYI', 0x14: 'ERROR_MOTD',
  0x16: 'ENTER_WORLD', 0x1d: 'PINGBACK', 0x1e: 'PING', 0x28: 'DEATH',
  0x63: 'CR_TURN', 0x64: 'MAP_DESC', 0x65: 'SCROLL_N', 0x66: 'SCROLL_E',
  0x67: 'SCROLL_S', 0x68: 'SCROLL_W', 0x69: 'TILE_UPD', 0x6a: 'ADD_THING',
  0x6b: 'CHG_THING', 0x6c: 'DEL_THING', 0x6d: 'MOVE_CR',
  0x6e: 'OPEN_CONT', 0x6f: 'CLOSE_CONT', 0x70: 'ADD_CONT_ITEM',
  0x71: 'CHG_CONT_ITEM', 0x72: 'DEL_CONT_ITEM',
  0x78: 'INV_SET', 0x79: 'INV_CLR', 0x7a: 'NPC_TRADE', 0x7b: 'NPC_TRADE_ACK',
  0x7c: 'CLOSE_NPC_TRADE', 0x7d: 'TRADE', 0x7e: 'TRADE_ACK', 0x7f: 'CLOSE_TRADE',
  0x82: 'WORLD_LIGHT', 0x83: 'EFFECT', 0x84: 'ANIM_TEXT', 0x85: 'MISSILE',
  0x86: 'MARK_CR', 0x87: 'TRAP_CR', 0x8c: 'CR_HEALTH', 0x8d: 'CR_LIGHT',
  0x8e: 'CR_OUTFIT', 0x8f: 'CR_SPEED', 0x90: 'CR_SKULL', 0x91: 'CR_SHIELD',
  0x92: 'CR_UNPASS',
  0x96: 'TEXT_WINDOW', 0x97: 'HOUSE_WINDOW',
  0x9a: 'PLAYER_POS',
  0xa0: 'STATS', 0xa1: 'SKILLS', 0xa2: 'ICONS', 0xa3: 'CANCEL_TARGET',
  0xa4: 'SPELL_CD', 0xa5: 'SPELL_GROUP_CD', 0xa6: 'MULTI_USE_DELAY',
  0xa7: 'PLAYER_MODES', 0xa8: 'CR_SQUARE',
  0xaa: 'TALK', 0xab: 'CHANNELS', 0xac: 'OPEN_CHANNEL', 0xad: 'OPEN_PRIV',
  0xae: 'RULE_VIO_CHAN', 0xaf: 'RULE_VIO_REM', 0xb0: 'RULE_VIO_CANCEL',
  0xb1: 'LOCK_VIO', 0xb2: 'PRIV_CHANNEL', 0xb3: 'CLOSE_CHANNEL',
  0xb4: 'TEXT_MSG', 0xb5: 'CANCEL_WALK_MARKER', 0xb6: 'WALK_CANCEL',
  0xbe: 'FLOOR_UP', 0xbf: 'FLOOR_DOWN',
  0xc8: 'OUTFIT_WINDOW',
  0xd2: 'VIP_ADD', 0xd3: 'VIP_LOGIN', 0xd4: 'VIP_LOGOUT',
  0xdc: 'TUTORIAL', 0xdd: 'MINIMAP_MARK',
  0xf0: 'QUEST_LOG', 0xf1: 'QUEST_LINE',
};

export function getOpcodeName(op: number): string {
  return OPCODE_NAMES[op] || `UNK_0x${op.toString(16).padStart(2, '0')}`;
}

export function hexDumpSlice(data: Uint8Array, start: number, end: number, maxBytes = 64): string {
  const len = Math.min(end - start, maxBytes);
  const bytes = Array.from(data.slice(start, start + len));
  const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
  return end - start > maxBytes ? hex + '…' : hex;
}

/** Circular buffer for dissected frames */
export class DissectorBuffer {
  frames: DissectedFrame[] = [];
  private maxFrames = 500;

  addFrame(frame: DissectedFrame) {
    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) {
      this.frames = this.frames.slice(-this.maxFrames);
    }
  }

  clear() {
    this.frames = [];
  }

  /** Get all opcodes across all frames, optionally filtered */
  getAllOpcodes(filter?: Set<number>): DissectedOpcode[] {
    const all: DissectedOpcode[] = [];
    for (const f of this.frames) {
      for (const op of f.opcodes) {
        if (!filter || filter.has(op.opcode)) {
          all.push(op);
        }
      }
    }
    return all;
  }

  /** Get opcodes with errors or anomalies */
  getAnomalies(): DissectedOpcode[] {
    return this.getAllOpcodes().filter(op => 
      op.error || 
      op.camBefore !== op.camAfter ||
      (op.isMapOp && op.bytesConsumed < 10) // suspiciously small map op
    );
  }

  /** Get frames where bytesLeft > 0 */
  getIncompleteFrames(): DissectedFrame[] {
    return this.frames.filter(f => f.bytesLeft > 0 || f.error);
  }

  exportText(): string {
    const lines: string[] = [];
    for (const f of this.frames) {
      lines.push(`\n=== FRAME #${f.frameIdx} @ ${(f.camMs/1000).toFixed(2)}s | ${f.totalBytes}B | left=${f.bytesLeft} ${f.error ? '⚠ '+f.error : ''} ===`);
      for (const op of f.opcodes) {
        const cam = op.camBefore !== op.camAfter ? ` cam:${op.camBefore}→${op.camAfter}` : '';
        const player = op.playerBefore !== op.playerAfter ? ` player:${op.playerBefore}→${op.playerAfter}` : '';
        const err = op.error ? ` ⚠${op.error}` : '';
        const fields = Object.keys(op.fields).length > 0 
          ? ' ' + Object.entries(op.fields).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(' ')
          : '';
        lines.push(`  [${op.posBefore}→${op.posAfter}] ${op.opName} (${op.bytesConsumed}B)${cam}${player}${fields}${err}`);
        lines.push(`    hex: ${op.hexDump}`);
      }
    }
    return lines.join('\n');
  }
}
