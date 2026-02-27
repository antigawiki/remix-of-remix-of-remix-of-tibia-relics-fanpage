/**
 * Parser de pacotes do protocolo Tibia 7.4 (OTHire/TibiaRelic)
 * Multi-floor map reading with OTClient-compatible perspective offsets
 * 
 * Deterministic u16 looktype for TibiaRelic 7.72 — no adaptive fallback.
 * Frame-level error recovery: abort current frame on error, resume next.
 */
import { Buf, BufOverflowError } from './buf';
import { DatLoader } from './datLoader';
import { GameState, createCreature, DIR_N, DIR_E, DIR_S, DIR_W, type Creature, type TileItem } from './gameState';

const CR_FULL = 0x61, CR_KNOWN = 0x62, CR_OLD = 0x63;

export interface PacketParserOptions {
  looktypeU16?: boolean;
  outfitWindowRangeU16?: boolean;
}

export class PacketParser {
  private looktypeU16: boolean;
  private outfitWindowRangeU16: boolean;
  /** When true, walk animations are suppressed (used during seek/fast-replay) */
  public seekMode = false;

  constructor(public gs: GameState, public dat: DatLoader, opts: PacketParserOptions = {}) {
    this.looktypeU16 = !!opts.looktypeU16;
    this.outfitWindowRangeU16 = opts.outfitWindowRangeU16 ?? this.looktypeU16;
  }

  private readLooktype(r: Buf): number {
    return this.looktypeU16 ? r.u16() : r.u8();
  }

  private skipItem(r: Buf): number {
    const iid = r.u16();
    if (iid >= 100 && iid <= 9999) {
      const it = this.dat.items.get(iid);
      if (it && (it.isStackable || it.isFluid || it.isSplash)) {
        r.u8();
      }
    }
    return iid;
  }

  private skipOutfit(r: Buf) {
    const oid = this.readLooktype(r);
    if (oid) r.skip(4);
    else r.u16();
  }

  /** Deterministic outfit read — no adaptive fallback */
  private readOutfit(r: Buf): { type: number; itemId: number; head: number; body: number; legs: number; feet: number } {
    const oid = this.readLooktype(r);
    if (oid === 0) {
      const itemId = r.u16();
      return { type: 0, itemId, head: 0, body: 0, legs: 0, feet: 0 };
    }
    const h = r.u8(), b = r.u8(), l = r.u8(), f = r.u8();
    return { type: oid, itemId: 0, head: h, body: b, legs: l, feet: f };
  }

  private pos3(r: Buf): [number, number, number] {
    return [r.u16(), r.u16(), r.u8()];
  }

  private loggedFirst = false;
  private unknownWarnCount = 0;
  private frameErrorCount = 0;

  /** Get the floor range for multi-floor reading */
  private getFloorRange(z: number): { startz: number; endz: number; zstep: number } {
    if (z > 7) {
      return { startz: z - 2, endz: Math.min(z + 2, 15), zstep: 1 };
    } else {
      return { startz: 7, endz: 0, zstep: -1 };
    }
  }

  /** Clamp camZ to valid range [0..15] */
  private clampCamZ() {
    if (this.gs.camZ < 0) {
      if (this.unknownWarnCount < 20) {
        this.unknownWarnCount++;
        console.warn(`[PacketParser] camZ clamped from ${this.gs.camZ} to 0`);
      }
      this.gs.camZ = 0;
    } else if (this.gs.camZ > 15) {
      if (this.unknownWarnCount < 20) {
        this.unknownWarnCount++;
        console.warn(`[PacketParser] camZ clamped from ${this.gs.camZ} to 15`);
      }
      this.gs.camZ = 15;
    }
  }

  /**
   * Remove creature `cid` from the tile at (x,y,z).
   * Defensive: scans all entries and removes all matches.
   */
  private removeCreatureFromTile(cid: number, x: number, y: number, z: number) {
    const key = this.gs.tileKey(x, y, z);
    const tile = this.gs.tiles.get(key);
    if (!tile) return;
    let i = tile.length;
    while (i-- > 0) {
      if (tile[i][0] === 'cr' && tile[i][1] === cid) {
        tile.splice(i, 1);
      }
    }
  }

  process(payload: Uint8Array) {
    const r = new Buf(payload);

    // Detect u16 length prefix (TCP framing)
    if (payload.length >= 4) {
      const prefixLen = r.peek16();
      if (prefixLen === payload.length - 2) {
        r.skip(2);
      }
    }

    while (!r.eof()) {
      try {
        const t = r.u8();
        if (!this.dispatch(t, r)) {
          // Unknown opcode — abort this frame entirely
          if (this.frameErrorCount < 30) {
            this.frameErrorCount++;
            console.warn(`[PacketParser] Unknown opcode 0x${t.toString(16)} at pos ${r.pos - 1}, abandoning frame (${r.left()} bytes left)`);
          }
          break;
        }
      } catch (e) {
        // Any parse error (including BufOverflow) — abort frame
        if (this.frameErrorCount < 30) {
          this.frameErrorCount++;
          if (e instanceof BufOverflowError) {
            console.warn(`[PacketParser] Buffer overflow, abandoning frame: ${e.message}`);
          } else {
            console.warn(`[PacketParser] Parse error, abandoning frame:`, e);
          }
        }
        break;
      }
    }
  }

  private dispatch(t: number, r: Buf): boolean {
    const g = this.gs;
    // Map
    if (t === 0x64) this.mapDesc(r);
    else if (t === 0x65) this.scroll(r, 0, -1);
    else if (t === 0x66) this.scroll(r, 1, 0);
    else if (t === 0x67) this.scroll(r, 0, 1);
    else if (t === 0x68) this.scroll(r, -1, 0);
    else if (t === 0x69) this.tileUpd(r);
    else if (t === 0x6a) this.addThing(r);
    else if (t === 0x6b) this.chgThing(r);
    else if (t === 0x6c) this.delThing(r);
    else if (t === 0x6d) this.moveCr(r);
    // Creature turn (opcode 0x63 at top level, not inside tile read)
    else if (t === 0x63) { const cid = r.u32(); const dir = r.u8(); const c = g.creatures.get(cid); if (c) c.direction = dir; }
    // Login
    else if (t === 0x0a) this.login(r);
    else if (t === 0x0b) { /* GM actions */ }
    else if (t === 0x0f) { /* FYI token */ }
    else if (t === 0x1d) { /* pingback (7.72) */ }
    else if (t === 0x1e) { /* ping */ }
    // Container
    else if (t === 0x6e) this.openCont(r);
    else if (t === 0x6f) r.u8();
    else if (t === 0x70) { r.u8(); this.skipItem(r); }
    else if (t === 0x71) { r.u8(); r.u8(); this.skipItem(r); }
    else if (t === 0x72) { r.u8(); r.u8(); }
    // Inventory
    else if (t === 0x78) { r.u8(); this.skipItem(r); }
    else if (t === 0x79) r.u8();
    // NPC Trade
    else if (t === 0x7a) this.skipNpcTrade(r);
    else if (t === 0x7b) this.skipNpcTradeAck(r);
    else if (t === 0x7c) { /* close npc trade */ }
    // Player Trade
    else if (t === 0x7d) this.skipTrade(r);
    else if (t === 0x7e) { r.skip16(); const n2 = r.u8(); for (let i = 0; i < n2; i++) this.skipItem(r); }
    else if (t === 0x7f) { /* close trade */ }
    // World light
    else if (t === 0x82) { r.u8(); r.u8(); }
    // Effects
    else if (t === 0x83) { r.skip(5); r.u8(); }
    else if (t === 0x84) { r.skip(5); r.u8(); r.skip16(); }
    else if (t === 0x85) { r.skip(5); r.skip(5); r.u8(); }
    // Creature updates
    else if (t === 0x86) { r.u32(); r.u8(); }
    else if (t === 0x87) { const nt = r.u8(); for (let i = 0; i < nt; i++) r.u32(); }
    else if (t === 0x8c) { const cid = r.u32(); const hp = r.u8(); const c = g.creatures.get(cid); if (c) c.health = hp; }
    else if (t === 0x8d) { r.u32(); r.u8(); r.u8(); }
    else if (t === 0x8e) { r.u32(); this.skipOutfit(r); }
    else if (t === 0x8f) { r.u32(); r.u16(); }
    else if (t === 0x90) { r.u32(); r.u8(); }
    else if (t === 0x91) { r.u32(); r.u8(); }
    // Text windows
    else if (t === 0x96) { r.u32(); r.u16(); r.u16(); r.skip16(); }
    else if (t === 0x97) { r.u8(); r.u32(); r.skip16(); }
    // Player pos
    else if (t === 0x9a) {
      const [x, y, z] = this.pos3(r);
      g.camX = x; g.camY = y; g.camZ = z;
      this.clampCamZ();
    }
    // Stats/skills/icons
    else if (t === 0xa0) this.readStats(r);
    else if (t === 0xa1) r.skip(14);
    else if (t === 0xa2) r.u8();
    else if (t === 0xa3) { /* cancelTarget */ }
    // Chat
    else if (t === 0xaa) this.talk(r);
    else if (t === 0xab) { const nc = r.u8(); for (let i = 0; i < nc; i++) { r.u16(); r.str16(); } }
    else if (t === 0xac) { r.u16(); r.str16(); }
    else if (t === 0xad) r.str16();
    else if (t === 0xae) { /* close channel */ }
    else if (t === 0xaf) { /* close channel */ }
    else if (t === 0xb0) r.skip(2);
    else if (t === 0xb1) { /* lockViolation */ }
    else if (t === 0xb2) { r.u16(); r.skip16(); }
    else if (t === 0xb3) r.u16();
    else if (t === 0xb4) this.textMsg(r);
    else if (t === 0xb5) r.u8();
    // Walk cancel / move delay (7.72 tibiarc parity)
    else if (t === 0xb6) { /* walk cancel — no payload beyond opcode */ }
    else if (t === 0xb7) { /* unused / reserved */ }
    else if (t === 0xb8) { /* unused / reserved */ }
    // Floor change
    else if (t === 0xbe) this.floorUp(r);
    else if (t === 0xbf) this.floorDown(r);
    // Outfit dialog
    else if (t === 0xc8) this.skipOutfitWindow(r);
    // VIP
    else if (t === 0xd2) { r.u32(); r.skip16(); r.u8(); }
    else if (t === 0xd3) r.u32();
    else if (t === 0xd4) r.u32();
    // Tutorial / minimap mark (7.72)
    else if (t === 0xdc) r.u8();
    else if (t === 0xdd) { r.skip(5); r.u8(); r.skip16(); }
    // Quest dialog
    else if (t === 0xf0) this.skipQuestLog(r);
    else if (t === 0xf1) this.skipQuestLine(r);
    // Error/MOTD
    else if (t === 0x14) { r.u16(); r.skip16(); }
    else return false;
    return true;
  }

  // --- Handlers ---

  private login(r: Buf) {
    this.gs.playerId = r.u32(); r.u16(); r.u8();
  }

  private mapDesc(r: Buf) {
    const [x, y, z] = this.pos3(r);
    this.gs.camX = x; this.gs.camY = y; this.gs.camZ = z;
    this.clampCamZ();
    this.gs.mapLoaded = true;

    const { startz, endz, zstep } = this.getFloorRange(z);
    this.readMultiFloorArea(r, x - 8, y - 6, 18, 14, z, startz, endz, zstep);

    if (!this.loggedFirst) {
      this.loggedFirst = true;
      console.log(`[PacketParser] First mapDesc: cam=(${x},${y},${z}), floors ${startz}->${endz}`);
    }
  }

  private scroll(r: Buf, dx: number, dy: number) {
    const g = this.gs;
    // Transactional: save old cam, update, read map, revert on failure
    const oldX = g.camX, oldY = g.camY;
    g.camX += dx; g.camY += dy;

    const { startz, endz, zstep } = this.getFloorRange(g.camZ);

    try {
      if (dx === 1) this.readMultiFloorArea(r, g.camX + 9, g.camY - 6, 1, 14, g.camZ, startz, endz, zstep);
      else if (dx === -1) this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 1, 14, g.camZ, startz, endz, zstep);
      else if (dy === 1) this.readMultiFloorArea(r, g.camX - 8, g.camY + 7, 18, 1, g.camZ, startz, endz, zstep);
      else if (dy === -1) this.readMultiFloorArea(r, g.camX - 8, g.camY - 6, 18, 1, g.camZ, startz, endz, zstep);
    } catch (e) {
      // Revert camera on parse failure
      g.camX = oldX; g.camY = oldY;
      throw e;
    }
  }

  private tileUpd(r: Buf) {
    const [x, y, z] = this.pos3(r);
    this.readSingleFloorArea(r, x, y, z, 1, 1);
  }

  private addThing(r: Buf) {
    const [x, y, z] = this.pos3(r);
    const word = r.peek16();
    if (word === CR_FULL) {
      r.skip(2);
      const c = this.readCreatureFull(r);
      this.placeCreatureOnTile(c, x, y, z);
    } else if (word === CR_KNOWN) {
      r.skip(2);
      const c = this.readCreatureKnown(r);
      this.placeCreatureOnTile(c, x, y, z);
    } else if (word >= 100 && word <= 9999) {
      const iid = this.skipItem(r);
      const tile = this.gs.getTile(x, y, z);
      tile.push(['it', iid]);
      this.gs.setTile(x, y, z, tile);
    }
  }

  private chgThing(r: Buf) {
    const [x, y, z] = this.pos3(r);
    const sp = r.u8();
    const word = r.peek16();
    if (word === CR_OLD) {
      r.skip(2);
      const cid = r.u32();
      const dir = r.u8();
      const c = this.gs.creatures.get(cid);
      if (c) c.direction = dir;
    } else {
      const iid = this.skipItem(r);
      const tile = [...this.gs.getTile(x, y, z)];
      if (sp >= 0 && sp < tile.length) {
        tile[sp] = ['it', iid];
        this.gs.setTile(x, y, z, tile);
      }
    }
  }

  private delThing(r: Buf) {
    const [x, y, z] = this.pos3(r);
    const sp = r.u8();
    const tile = [...this.gs.getTile(x, y, z)];
    if (sp >= 0 && sp < tile.length) {
      tile.splice(sp, 1);
      this.gs.setTile(x, y, z, tile);
    }
  }

  /**
   * Move creature — supports two formats (OTClient/tibiarc-aligned):
   * A) fromPos(x,y,z) + stackpos + toPos(x,y,z)   — normal tile move
   * B) 0xFFFF as x → next u16 is creatureId high/low → move by creature ID
   *    In 7.x protocol: pos3 reads x=0xFFFF, y and z are ignored;
   *    stackpos byte is read; then toPos is read.
   *    We find the creature by scanning known creatures or use the ID embedded.
   */
  private moveCr(r: Buf) {
    const [fx, fy, fz] = this.pos3(r);
    const sp = r.u8();
    const [tx, ty, tz] = this.pos3(r);

    let cid: number | null = null;
    let fromX: number, fromY: number, fromZ: number;

    if (fx === 0xFFFF) {
      // Format B: creature referenced by ID, not by tile position
      const candidateId = fy;
      let c = this.gs.creatures.get(candidateId);
      if (c) {
        cid = candidateId;
        fromX = c.x; fromY = c.y; fromZ = c.z;
      } else {
        // Scan all creatures for one at destination
        for (const cr of this.gs.creatures.values()) {
          if (cr.x === tx && cr.y === ty && cr.z === tz) {
            cid = cr.id;
            fromX = cr.x; fromY = cr.y; fromZ = cr.z;
            break;
          }
        }
        if (cid === null) return;
      }
      this.removeCreatureFromTile(cid, fromX!, fromY!, fromZ!);
    } else {
      // Format A: normal tile-based move
      fromX = fx; fromY = fy; fromZ = fz;
      const ft = this.gs.getTile(fx, fy, fz);
      // 1. Try exact stackpos
      if (sp >= 0 && sp < ft.length && ft[sp][0] === 'cr') {
        cid = ft[sp][1];
        ft.splice(sp, 1);
        this.gs.setTile(fx, fy, fz, ft);
      } else {
        // 2. Search by creature whose stored position matches source
        for (let i = 0; i < ft.length; i++) {
          if (ft[i][0] === 'cr') {
            const cc = this.gs.creatures.get(ft[i][1]);
            if (cc && cc.x === fx && cc.y === fy && cc.z === fz) {
              cid = ft[i][1];
              ft.splice(i, 1);
              this.gs.setTile(fx, fy, fz, ft);
              break;
            }
          }
        }
        // 3. Last fallback: any creature on tile
        if (cid === null) {
          for (let i = 0; i < ft.length; i++) {
            if (ft[i][0] === 'cr') {
              cid = ft[i][1];
              ft.splice(i, 1);
              this.gs.setTile(fx, fy, fz, ft);
              break;
            }
          }
        }
      }
    }

    if (cid !== null) {
      const c = this.gs.creatures.get(cid);
      if (c) {
        // Use REAL from position for direction/offset (never 0xFFFF)
        const dx = tx - fromX!, dy = ty - fromY!;
        if (dx === 0 && dy < 0) c.direction = DIR_N;
        else if (dx > 0) c.direction = DIR_E;
        else if (dx === 0 && dy > 0) c.direction = DIR_S;
        else if (dx < 0) c.direction = DIR_W;

        // Snap any previous walk before starting new one
        if (c.walking) {
          c.walking = false;
          c.walkOffsetX = 0;
          c.walkOffsetY = 0;
        }

        c.x = tx; c.y = ty; c.z = tz;

        // Smooth walking (only in real-time playback, not during seek)
        if (!this.seekMode) {
          c.walking = true;
          const groundSpeed = 150;
          const walkDuration = c.speed > 0 ? Math.max(100, Math.floor(groundSpeed * 1000 / Math.max(1, c.speed))) : 300;
          c.walkDuration = walkDuration;
          c.walkStartTick = performance.now();
          c.walkEndTick = c.walkStartTick + walkDuration;
          c.walkOffsetX = -dx * 32;
          c.walkOffsetY = -dy * 32;
        }

        // Place on destination tile (defensive: remove duplicates first)
        this.removeCreatureFromTile(cid, tx, ty, tz);
        const tile = this.gs.getTile(tx, ty, tz);
        tile.push(['cr', cid]);
        this.gs.setTile(tx, ty, tz, tile);
      }
    }
  }

  /**
   * Place creature on tile, removing it from any previous tile first.
   */
  private placeCreatureOnTile(c: Creature, x: number, y: number, z: number) {
    // Remove from old position if different
    if (c.x !== 0 || c.y !== 0 || c.z !== 0) {
      this.removeCreatureFromTile(c.id, c.x, c.y, c.z);
    }
    // Remove any duplicate at destination
    this.removeCreatureFromTile(c.id, x, y, z);
    c.x = x; c.y = y; c.z = z;
    const tile = this.gs.getTile(x, y, z);
    tile.push(['cr', c.id]);
    this.gs.setTile(x, y, z, tile);
  }

  private openCont(r: Buf) {
    r.u8(); r.u16(); r.skip16(); r.u8(); r.u8();
    const n = r.u8();
    for (let i = 0; i < n; i++) this.skipItem(r);
  }

  private skipNpcTrade(r: Buf) {
    const n = r.u8();
    for (let i = 0; i < n; i++) {
      r.u16(); r.u8(); r.str16(); r.u32(); r.u32();
    }
  }

  private skipNpcTradeAck(r: Buf) {
    r.u32();
    const n = r.u8();
    for (let i = 0; i < n; i++) { r.u16(); r.u16(); }
  }

  private skipTrade(r: Buf) {
    r.skip16();
    const n = r.u8();
    for (let i = 0; i < n; i++) this.skipItem(r);
  }

  private skipOutfitWindow(r: Buf) {
    this.skipOutfit(r);
    if (this.outfitWindowRangeU16) {
      r.u16(); r.u16();
    } else {
      r.u8(); r.u8();
    }
  }

  private skipQuestLog(r: Buf) {
    const n = r.u16();
    for (let i = 0; i < n; i++) { r.u16(); r.skip16(); r.u8(); }
  }

  private skipQuestLine(r: Buf) {
    r.u16(); const n = r.u8();
    for (let i = 0; i < n; i++) { r.skip16(); r.skip16(); }
  }

  private floorUp(r: Buf) {
    const g = this.gs;
    const oldZ = g.camZ, oldX = g.camX, oldY = g.camY;
    g.camZ--;
    this.clampCamZ();

    try {
      if (g.camZ === 7) {
        let skip = 0;
        for (let nz = 5; nz >= 0; nz--) {
          const offset = 2 + nz;
          skip = this.readFloorArea(r, g.camX - 8, g.camY - 6, nz, 18, 14, offset, skip);
        }
      } else if (g.camZ > 7) {
        const nz = g.camZ - 2;
        this.readFloorAreaWithOffset(r, g.camX - 8, g.camY - 6, nz, 18, 14, 3);
      }

      g.camX++; g.camY++;
    } catch (e) {
      // Revert camera on failure
      g.camZ = oldZ; g.camX = oldX; g.camY = oldY;
      throw e;
    }
  }

  private floorDown(r: Buf) {
    const g = this.gs;
    const oldZ = g.camZ, oldX = g.camX, oldY = g.camY;
    g.camZ++;
    this.clampCamZ();

    try {
      if (g.camZ === 8) {
        let skip = 0;
        let j = -1;
        for (let nz = g.camZ; nz <= Math.min(g.camZ + 2, 15); nz++) {
          skip = this.readFloorArea(r, g.camX - 8, g.camY - 6, nz, 18, 14, j, skip);
          j--;
        }
      } else if (g.camZ > 8 && g.camZ < 14) {
        const nz = Math.min(g.camZ + 2, 15);
        this.readFloorAreaWithOffset(r, g.camX - 8, g.camY - 6, nz, 18, 14, -3);
      }

      g.camX--; g.camY--;
    } catch (e) {
      // Revert camera on failure
      g.camZ = oldZ; g.camX = oldX; g.camY = oldY;
      throw e;
    }
  }

  private talk(r: Buf) {
    try {
      r.u32();
      const name = r.str16();
      const tp = r.u8();
      const POS_TYPES = new Set([0x01, 0x02, 0x03, 0x0E, 0x10]);
      const CHAN_TYPES = new Set([0x05, 0x0A, 0x0C]);
      const TIME_TYPES = new Set([0x06]);
      if (POS_TYPES.has(tp)) r.skip(5);
      else if (CHAN_TYPES.has(tp)) r.u16();
      else if (TIME_TYPES.has(tp)) r.u32();
      const msg = r.str16();
      if (msg.length >= 2) {
        const col = [0x01, 0x02, 0x03].includes(tp) ? '#ffffff'
          : CHAN_TYPES.has(tp) ? '#ffdd88'
          : [0x0E, 0x10].includes(tp) ? '#ff8888' : '#cccccc';
        this.gs.addMsg(name ? `${name}: ${msg}` : msg, col);
      }
    } catch { /* ignore */ }
  }

  private readStats(r: Buf) {
    r.skip(20);
  }

  private textMsg(r: Buf) {
    const mt = r.u8();
    const msg = r.str16();
    if (msg.length >= 3) {
      const cols: Record<number, string> = { 18: '#ff4444', 19: '#ff4444', 20: '#ffff00', 22: '#ffffff' };
      this.gs.addMsg(msg, cols[mt] || '#aaaaaa');
    }
  }


  // --- Creature readers ---

  private updateCreatureCommon(r: Buf, c: Creature) {
    c.health = r.u8();
    c.direction = r.u8();
    const outfit = this.readOutfit(r);
    r.u8(); r.u8(); // light
    c.speed = r.u16();
    r.u8(); r.u8(); // skull+shield
    c.outfit = outfit.type;
    c.outfitItem = outfit.itemId;
    c.head = outfit.head; c.body = outfit.body;
    c.legs = outfit.legs; c.feet = outfit.feet;
  }

  private readCreatureFull(r: Buf): Creature {
    const rem = r.u32();
    const cid = r.u32();
    const name = r.str16();
    let c = this.gs.creatures.get(cid);
    if (!c) { c = createCreature(); c.id = cid; }
    c.name = name;
    this.gs.creatures.set(cid, c);
    if (rem && rem !== cid) this.gs.creatures.delete(rem);
    this.updateCreatureCommon(r, c);
    return c;
  }

  private readCreatureKnown(r: Buf): Creature {
    const cid = r.u32();
    let c = this.gs.creatures.get(cid);
    if (!c) { c = createCreature(); c.id = cid; }
    this.gs.creatures.set(cid, c);
    this.updateCreatureCommon(r, c);
    return c;
  }

  // --- Tile/block readers ---

  private readTileItems(r: Buf, x: number, y: number, z: number): number {
    const items: TileItem[] = [];
    while (r.left() >= 2) {
      const word = r.peek16();
      if (word >= 0xFF00) {
        r.skip(2);
        this.gs.setTile(x, y, z, items);
        return word & 0xFF;
      }
      r.skip(2);
      if (word === CR_FULL) {
        const c = this.readCreatureFull(r);
        c.x = x; c.y = y; c.z = z;
        items.push(['cr', c.id]);
      } else if (word === CR_KNOWN) {
        const c = this.readCreatureKnown(r);
        c.x = x; c.y = y; c.z = z;
        items.push(['cr', c.id]);
      } else if (word === CR_OLD) {
        const cid = r.u32();
        const dir = r.u8();
        const c = this.gs.creatures.get(cid);
        if (c) { c.direction = dir; c.x = x; c.y = y; c.z = z; }
        items.push(['cr', cid]);
      } else if (word >= 100 && word <= 9999) {
        const it = this.dat.items.get(word);
        if (it && (it.isStackable || it.isFluid || it.isSplash)) {
          r.u8();
        }
        items.push(['it', word]);
      }
    }
    this.gs.setTile(x, y, z, items);
    return 0;
  }

  private readSingleFloorArea(r: Buf, ox: number, oy: number, z: number, W: number, H: number) {
    let skip = 0;
    for (let tx = 0; tx < W; tx++) {
      for (let ty = 0; ty < H; ty++) {
        if (r.left() < 2) return;
        if (skip > 0) {
          this.gs.setTile(ox + tx, oy + ty, z, []);
          skip--;
          continue;
        }
        skip = this.readTileItems(r, ox + tx, oy + ty, z);
      }
    }
  }

  private readFloorArea(r: Buf, ox: number, oy: number, z: number, W: number, H: number, offset: number, skip: number): number {
    for (let tx = 0; tx < W; tx++) {
      for (let ty = 0; ty < H; ty++) {
        if (r.left() < 2) return skip;
        if (skip > 0) {
          this.gs.setTile(ox + tx + offset, oy + ty + offset, z, []);
          skip--;
          continue;
        }
        skip = this.readTileItems(r, ox + tx + offset, oy + ty + offset, z);
      }
    }
    return skip;
  }

  private readFloorAreaWithOffset(r: Buf, ox: number, oy: number, z: number, W: number, H: number, offset: number) {
    let skip = 0;
    for (let tx = 0; tx < W; tx++) {
      for (let ty = 0; ty < H; ty++) {
        if (r.left() < 2) return;
        if (skip > 0) {
          this.gs.setTile(ox + tx + offset, oy + ty + offset, z, []);
          skip--;
          continue;
        }
        skip = this.readTileItems(r, ox + tx + offset, oy + ty + offset, z);
      }
    }
  }

  private readMultiFloorArea(r: Buf, ox: number, oy: number, W: number, H: number, camZ: number, startz: number, endz: number, zstep: number) {
    let skip = 0;
    for (let nz = startz; nz !== endz + zstep; nz += zstep) {
      if (r.left() < 2) break;
      const offset = camZ - nz;
      skip = this.readFloorArea(r, ox, oy, nz, W, H, offset, skip);
    }
  }
}
