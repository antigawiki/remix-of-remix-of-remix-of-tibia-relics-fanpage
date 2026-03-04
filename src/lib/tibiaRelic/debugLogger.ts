/**
 * Debug Logger for .cam player — circular buffer of protocol events
 * Disabled by default. When enabled, records up to 2000 events.
 */

export type DebugEventType =
  | 'OPCODE'
  | 'MOVE_CR'
  | 'FLOOR_CHANGE'
  | 'SYNC_PLAYER'
  | 'PLAYER_POS'
  | 'DESYNC'
  | 'WALK_FAIL'
  | 'TILE_UPDATE'
  | 'SCROLL'
  | 'MAP_DESC'
  | 'MAP_DESC_MINI'
  | 'MULTIFLOOR_EXHAUSTED'
  | 'MULTIFLOOR_STEP'
  | 'MULTIFLOOR_DONE'
  | 'FRAME_START'
  | 'FRAME_END'
  | 'PARSE_ERROR'
  | 'CREATURE_ADD'
  | 'CREATURE_REMOVE';

export interface DebugEvent {
  ts: number; // performance.now()
  camMs: number; // playback ms
  type: DebugEventType;
  data: Record<string, unknown>;
  description?: string; // human-readable description
}

export interface DebugSnapshot {
  camX: number;
  camY: number;
  camZ: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerOnCorrectFloor: boolean;
  creatureCount: number;
  lastMoveCr: Record<string, unknown> | null;
}

const MAX_EVENTS = 2000;

export class DebugLogger {
  public enabled = false;
  public events: DebugEvent[] = [];
  private _camMs = 0;
  private _lastMoveCr: Record<string, unknown> | null = null;

  setCamMs(ms: number) {
    this._camMs = ms;
  }

  get lastMoveCr() {
    return this._lastMoveCr;
  }

  log(type: DebugEventType, data: Record<string, unknown>) {
    if (!this.enabled) return;
    if (type === 'MOVE_CR') this._lastMoveCr = data;
    this.events.push({
      ts: performance.now(),
      camMs: this._camMs,
      type,
      data,
    });
    // Circular buffer — trim oldest when over limit
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }
  }

  clear() {
    this.events = [];
    this._lastMoveCr = null;
  }

  getFiltered(types: DebugEventType[]): DebugEvent[] {
    if (types.length === 0) return this.events;
    const set = new Set(types);
    return this.events.filter(e => set.has(e.type));
  }

  exportJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }

  exportText(): string {
    return this.events.map(e => {
      const t = (e.camMs / 1000).toFixed(2);
      const d = Object.entries(e.data).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
      return `[${t}s] ${e.type} ${d}`;
    }).join('\n');
  }
}
