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
import { DebugLogger } from './debugLogger';

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

  public debugLogger: DebugLogger | null = null;
  /** Opcodes processed in the last process() call — used by CamAnalyzer */
  public lastFrameOpcodes: number[] = [];

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

  /** Get the floor range for multi-floor reading — TibiaRelic sends ±2 floors only */
  private getFloorRange(z: number): { startz: number; endz: number; zstep: number } {
    if (z > 7) {
      // Underground: z-2 to z+2, capped at 15
      return { startz: z - 2, endz: Math.min(z + 2, 15), zstep: 1 };
    } else {
      // Surface: ±2 floors only (TibiaRelic), NOT full 7→0
      // startz is the highest floor (closest to surface), endz is the lowest
      // For z=7: reads 7→5 (3 floors)
      // For z=6: reads 7→4 (4 floors)  
      // For z=5: reads 7→3 (5 floors — max ±2)
      return { startz: Math.min(z + 2, 7), endz: Math.max(z - 2, 0), zstep: -1 };
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
   * Sync the player creature's position to gs.camX/Y/Z.
   * This ensures the renderer (which follows player.x/y) always shows
   * the correct map area after teleports, floor changes, or scroll packets.
   */
  private syncPlayerToCamera(oldCamZ?: number) {
    const g = this.gs;
    if (!g.playerId) return;
    const player = g.creatures.get(g.playerId);
    if (!player) return;
    
    const floorChanged = oldCamZ !== undefined ? oldCamZ !== g.camZ : false;
    
    const dl = this.debugLogger;
    if (dl && dl.enabled) {
      dl.log('SYNC_PLAYER', {
        oldPlayerPos: `${player.x},${player.y},${player.z}`,
        camPos: `${g.camX},${g.camY},${g.camZ}`,
        oldCamZ,
        floorChanged,
        alreadyInSync: player.x === g.camX && player.y === g.camY && player.z === g.camZ,
      });
    }
    
    if (player.x === g.camX && player.y === g.camY && player.z === g.camZ) {
      if (floorChanged) this.cleanupDistantCreatures(g.camZ);
      return;
    }
    this.removeCreatureFromTile(player.id, player.x, player.y, player.z);
    player.x = g.camX;
    player.y = g.camY;
    player.z = g.camZ;
    this.removeCreatureFromTile(player.id, player.x, player.y, player.z);
    const tile = g.getTile(player.x, player.y, player.z);
    tile.push(['cr', player.id]);
    g.setTile(player.x, player.y, player.z, tile);

    if (floorChanged) this.cleanupDistantCreatures(g.camZ);
  }

  /** Remove creatures more than 2 floors from current Z */
  private cleanupDistantCreatures(currentZ: number) {
    const g = this.gs;
    let cleaned = 0;
    for (const [cid, c] of g.creatures) {
      if (cid === g.playerId) continue;
      if (Math.abs(c.z - currentZ) > 2) {
        this.removeCreatureFromTile(cid, c.x, c.y, c.z);
        g.creatures.delete(cid);
        cleaned++;
      }
    }
    console.log(`[FloorChange] oldZ=${arguments[0]} -> newZ=${currentZ}, cleaned ${cleaned} distant creatures, remaining: ${g.creatures.size}`);
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

  /** Set tile to empty but preserve any creature references already on it */
  private setTilePreservingCreatures(x: number, y: number, z: number) {
    const key = this.gs.tileKey(x, y, z);
    const existing = this.gs.tiles.get(key);
    if (existing) {
      const creatures = existing.filter(i => i[0] === 'cr');
      this.gs.setTile(x, y, z, creatures);
    } else {
      this.gs.setTile(x, y, z, []);
    }
  }

  process(payload: Uint8Array) {
    this.lastFrameOpcodes = [];
    const r = new Buf(payload);
    if (payload.length === 0) return;

    // Heuristic: valid Tibia 7.72 opcodes start at 0x0A.
    // If first byte < 0x0A, it's almost certainly a TCP u16 length prefix.
    const firstByte = payload[0];

    if (firstByte < 0x0A && payload.length >= 2) {
      this.processTcpDemux(r, payload.length);
    } else {
      this.processOpcodes(r, payload.length);
    }
  }

  /** Demux TCP sub-packets: read u16 length prefix, then opcodes within each sub-packet */
  private processTcpDemux(r: Buf, totalLen: number) {
    while (r.pos + 2 <= totalLen) {
      try {
        const subLen = r.u16();
        if (subLen === 0) continue; // skip empty TCP packets
        if (r.pos + subLen > totalLen) {
          // Invalid length — maybe not TCP after all, try as direct opcodes
          r.pos -= 2; // rewind the u16
          this.processDirectOpcodes(r, totalLen);
          return;
        }
        const subEnd = r.pos + subLen;
        this.processDirectOpcodes(r, subEnd);
        r.pos = subEnd; // ensure alignment even if opcode parse stopped early
      } catch (e) {
        if (this.frameErrorCount < 30) {
          this.frameErrorCount++;
          console.warn(`[PacketParser] Error in TCP demux:`, e);
        }
        break;
      }
    }
  }

  /** Process opcodes with TCP fallback for unknown opcodes mid-stream */
  private processOpcodes(r: Buf, endPos: number) {
    while (r.pos < endPos) {
      try {
        const t = r.u8();
        if (this.dispatch(t, r)) continue;

        // Unknown opcode — try TCP demux for rest of frame
        r.pos -= 1;
        this.processTcpDemux(r, endPos);
        return;
      } catch (e) {
        if (this.frameErrorCount < 30) {
          this.frameErrorCount++;
          if (e instanceof BufOverflowError) {
            console.warn(`[PacketParser] Buffer overflow: ${e.message}`);
          } else {
            console.warn(`[PacketParser] Parse error:`, e);
          }
        }
        break;
      }
    }
  }

  /** Process opcodes directly — no TCP fallback (used inside demuxed sub-packets) */
  private processDirectOpcodes(r: Buf, endPos: number) {
    while (r.pos < endPos) {
      try {
        const t = r.u8();
        if (!this.dispatch(t, r)) {
          // Unknown opcode inside sub-packet — skip rest
          break;
        }
      } catch (e) {
        break;
      }
    }
  }

  private dispatch(t: number, r: Buf): boolean {
    this.lastFrameOpcodes.push(t);
    const g = this.gs;
    // Log relevant opcodes
    const dl = this.debugLogger;
    if (dl && dl.enabled) {
      const relevantOps = new Set([0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x6b,0x6c,0x6d,0x9a,0xbe,0xbf,0x0a]);
      if (relevantOps.has(t)) {
        dl.log('OPCODE', { opcode: '0x' + t.toString(16), pos: r.pos });
      }
    }
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
    else if (t === 0x0b) { /* GM actions — no payload for TibiaRelic */ }
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
    else if (t === 0x83) {
      const [ex, ey, ez] = this.pos3(r);
      const effectType = r.u8();
      if (!this.seekMode) {
        g.effects.push({ x: ex, y: ey, z: ez, effectId: effectType, startTick: performance.now(), duration: 600 });
      }
    }
    else if (t === 0x84) {
      // Animated text (damage numbers, healing, XP)
      const [ax, ay, az] = this.pos3(r);
      const colorByte = r.u8();
      const text = r.str16();
      if (!this.seekMode) {
        const color = this.protocolColorToHex(colorByte);
        g.animatedTexts.push({ x: ax, y: ay, z: az, color, text, startTick: performance.now(), duration: 1000 });
      }
    }
    else if (t === 0x85) {
      const [fx2, fy2, fz2] = this.pos3(r);
      const [tx2, ty2, tz2] = this.pos3(r);
      const missileType = r.u8();
      if (!this.seekMode) {
        const dist = Math.max(Math.abs(tx2 - fx2), Math.abs(ty2 - fy2));
        const dur = Math.max(150, dist * 150);
        g.projectiles.push({ fromX: fx2, fromY: fy2, fromZ: fz2, toX: tx2, toY: ty2, toZ: tz2, missileId: missileType, startTick: performance.now(), duration: dur });
      }
    }
    // Creature updates
    else if (t === 0x86) { r.u32(); r.u8(); }
    else if (t === 0x87) { const nt = r.u8(); for (let i = 0; i < nt; i++) r.u32(); }
    else if (t === 0x8c) { const cid = r.u32(); const hp = r.u8(); const c = g.creatures.get(cid); if (c) c.health = hp; }
    else if (t === 0x8d) { r.u32(); r.u8(); r.u8(); }
    else if (t === 0x8e) { r.u32(); this.skipOutfit(r); }
    else if (t === 0x8f) { r.u32(); r.u16(); }
    else if (t === 0x90) { r.u32(); r.u8(); }
    else if (t === 0x91) { r.u32(); r.u8(); }
    else if (t === 0x92) { r.u32(); r.u8(); /* creatureUnpass */ }
    // Text windows
    else if (t === 0x96) { r.u32(); r.u16(); r.u16(); r.skip16(); }
    else if (t === 0x97) { r.u8(); r.u32(); r.skip16(); }
    // Player pos
    else if (t === 0x9a) {
      const [x, y, z] = this.pos3(r);
      const prevZ = g.camZ;
      const dl2 = this.debugLogger;
      if (dl2 && dl2.enabled) {
        const player = g.creatures.get(g.playerId);
        dl2.log('PLAYER_POS', {
          received: `${x},${y},${z}`,
          prevCam: `${g.camX},${g.camY},${g.camZ}`,
          playerPos: player ? `${player.x},${player.y},${player.z}` : 'none',
        });
      }
      g.camX = x; g.camY = y; g.camZ = z;
      this.clampCamZ();
      this.syncPlayerToCamera(prevZ);
    }
    // Stats/skills/icons
    else if (t === 0xa0) this.readStats(r);
    else if (t === 0xa1) r.skip(14);
    else if (t === 0xa2) r.u8();
    else if (t === 0xa3) { /* cancelTarget */ }
    else if (t === 0xa4) { r.skip(2); /* spellCooldown: u16 spellId */ }
    else if (t === 0xa5) { r.skip(5); /* spellGroupCooldown: u8 groupId + u32 delay */ }
    else if (t === 0xa6) { r.u32(); /* multiUseDelay */ }
    else if (t === 0xa7) { r.skip(3); /* setPlayerModes: u8 fight + u8 chase + u8 safe */ }
    else if (t === 0xa8) { r.skip(5); /* creatureSquare: u32 creatureId + u8 color */ }
    // Chat
    else if (t === 0xaa) this.talk(r);
    else if (t === 0xab) { const nc = r.u8(); for (let i = 0; i < nc; i++) { r.u16(); r.str16(); } }
    else if (t === 0xac) { r.u16(); r.str16(); }
    else if (t === 0xad) r.str16();
    else if (t === 0xae) { /* ruleViolation channel — no payload */ }
    else if (t === 0xaf) { /* ruleViolation remove — no payload */ }
    else if (t === 0xb0) { r.skip(2); /* ruleViolation cancel */ }
    else if (t === 0xb1) { /* lockViolation */ }
    else if (t === 0xb2) { r.u16(); r.skip16(); }
    else if (t === 0xb3) r.u16();
    else if (t === 0xb4) this.textMsg(r);
    else if (t === 0xb5) r.u8();
    // Walk cancel / move delay (7.72 tibiarc parity)
    else if (t === 0xb6) { /* walk cancel — no payload for TibiaRelic */ }
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
    // Death
    else if (t === 0x28) { /* death — no payload for 7.72 */ }
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
    const prevZ = this.gs.camZ;
    this.gs.camX = x; this.gs.camY = y; this.gs.camZ = z;
    this.clampCamZ();
    this.gs.mapLoaded = true;

    const dl = this.debugLogger;
    if (dl && dl.enabled) {
      dl.log('MAP_DESC', { x, y, z, prevZ, bytesLeft: r.left() });
    }

    // Mini MAP_DESC guard: a full 18×14 multi-floor area needs hundreds of bytes.
    // Custom servers send position-only 0x64 (~5 bytes payload) every ~12s.
    // Without this guard, readMultiFloorArea would consume subsequent opcodes as tile data.
    if (r.left() < 100) {
      if (dl && dl.enabled) dl.log('MAP_DESC_MINI', { x, y, z, bytesLeft: r.left() });
      this.syncPlayerToCamera(prevZ);
      return;
    }

    const { startz, endz, zstep } = this.getFloorRange(z);
    this.readMultiFloorArea(r, x - 8, y - 6, 18, 14, z, startz, endz, zstep);
    this.syncPlayerToCamera(prevZ);

    if (!this.loggedFirst) {
      this.loggedFirst = true;
      console.log(`[PacketParser] First mapDesc: cam=(${x},${y},${z}), floors ${startz}->${endz}`);
    }
  }

  private scroll(r: Buf, dx: number, dy: number) {
    const g = this.gs;
    const oldX = g.camX, oldY = g.camY;
    g.camX += dx; g.camY += dy;

    const dl = this.debugLogger;
    if (dl && dl.enabled) {
      dl.log('SCROLL', { dx, dy, oldCam: `${oldX},${oldY},${g.camZ}`, newCam: `${g.camX},${g.camY},${g.camZ}` });
    }

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
    // Only sync player to camera if positions are close (normal 1-tile scroll).
    // After floor changes, cam has perspective offsets (camX++/camY++) that make it 2+ tiles
    // away from the player — syncing in that state would corrupt the player's correct position.
    const player = g.creatures.get(g.playerId);
    if (player && Math.abs(player.x - g.camX) + Math.abs(player.y - g.camY) <= 2 && player.z === g.camZ) {
      this.syncPlayerToCamera();
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
      const removed = tile[sp];
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
    let fallback = 'none';

    if (fx === 0xFFFF) {
      // Format B: 0xFFFF is ModernStacking (versions > 8.x).
      // For 7.72 protocol this should NOT happen — it indicates a prior parsing error.
      // Just consume the bytes to stay aligned but do NOT move any creature.
      return;
    } else {
      // Format A: normal tile-based move
      fromX = fx; fromY = fy; fromZ = fz;
      const ft = this.gs.getTile(fx, fy, fz);

      // 1. Try exact stackpos (trust stackpos like tibiarc — no position verification)
      if (sp >= 0 && sp < ft.length && ft[sp][0] === 'cr') {
        cid = ft[sp][1];
        ft.splice(sp, 1);
        this.gs.setTile(fx, fy, fz, ft);
        fallback = 'stackpos';
      }

      // 2. Fallback: first creature on tile
      if (cid === null) {
        for (let i = 0; i < ft.length; i++) {
          if (ft[i][0] === 'cr') {
            cid = ft[i][1];
            ft.splice(i, 1);
            this.gs.setTile(fx, fy, fz, ft);
            fallback = 'first_cr';
            break;
          }
        }
      }

      // 3. Last resort for player: tile lost creature ref (e.g. after scroll/floor area read)
      // but the creature still exists in g.creatures — find it by proximity to source position
      if (cid === null) {
        const player = this.gs.creatures.get(this.gs.playerId);
        if (player && Math.abs(player.x - fx) <= 2 && Math.abs(player.y - fy) <= 2 && player.z === fz) {
          this.removeCreatureFromTile(player.id, player.x, player.y, player.z);
          cid = player.id;
          fromX = player.x; fromY = player.y; fromZ = player.z;
          fallback = 'player_lookup';
        }
      }

    }

    if (cid !== null) {
      const c = this.gs.creatures.get(cid);
      if (c) {
        const dx = tx - fromX!, dy = ty - fromY!;
        if (dx === 0 && dy < 0) c.direction = DIR_N;
        else if (dx > 0) c.direction = DIR_E;
        else if (dx === 0 && dy > 0) c.direction = DIR_S;
        else if (dx < 0) c.direction = DIR_W;

        if (c.walking) {
          c.walking = false;
          c.walkOffsetX = 0;
          c.walkOffsetY = 0;
        }

        if (cid === this.gs.playerId && tz !== fz) {
          console.warn(`[moveCr] Player Z changed: ${fz} -> ${tz}, camZ=${this.gs.camZ}`);
        }

        c.x = tx; c.y = ty; c.z = tz;

        const dz = tz - fz;
        let walkAnimated = false;
        if (!this.seekMode && dz === 0 &&
            Math.abs(dx) <= 1 && Math.abs(dy) <= 1 &&
            (dx !== 0 || dy !== 0)) {
          c.walking = true;
          walkAnimated = true;
          const destTile = this.gs.getTile(tx, ty, tz);
          let groundSpeed = 150;
          for (const ti of destTile) {
            if (ti[0] === 'it') {
              const itemDat = this.dat.items.get(ti[1]);
              if (itemDat && itemDat.isGround && itemDat.stackPrio === 0 && itemDat.speed > 0) {
                groundSpeed = itemDat.speed;
                break;
              }
            }
          }
          const walkDuration = c.speed > 0
            ? Math.max(100, Math.floor(groundSpeed * 1000 / Math.max(1, c.speed)))
            : 300;
          c.walkDuration = walkDuration;
          c.walkStartTick = performance.now();
          c.walkEndTick = c.walkStartTick + walkDuration;
          c.walkOffsetX = -dx * 32;
          c.walkOffsetY = -dy * 32;
        }

        // Debug log
        const dl = this.debugLogger;
        if (dl && dl.enabled) {
          dl.log('MOVE_CR', {
            cid, isPlayer: cid === this.gs.playerId,
            fromX: fromX!, fromY: fromY!, fromZ: fromZ!,
            toX: tx, toY: ty, toZ: tz,
            stackpos: sp, fallback, walkAnimated,
            dx, dy, dz, speed: c.speed,
          });
        }

        this.removeCreatureFromTile(cid, tx, ty, tz);
        const tile = this.gs.getTile(tx, ty, tz);
        tile.push(['cr', cid]);
        this.gs.setTile(tx, ty, tz, tile);
      }
    } else {
      // WALK_FAIL
      const dl = this.debugLogger;
      if (dl && dl.enabled) {
        dl.log('WALK_FAIL', {
          fromX: fx, fromY: fy, fromZ: fz,
          toX: tx, toY: ty, toZ: tz,
          stackpos: sp, tileLength: this.gs.getTile(fx, fy, fz).length,
        });
      }
    }
  }

  /**
   * Place creature on tile, removing it from any previous tile first.
   */
  private placeCreatureOnTile(c: Creature, x: number, y: number, z: number) {
    // Always remove from old position (removeCreatureFromTile is defensive/no-op if not present)
    this.removeCreatureFromTile(c.id, c.x, c.y, c.z);
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
        // Exiting underground to surface — TibiaRelic ±2 floors
        // Old visible (z=8): [6,7,8,9,10]. New visible (z=7): [5,6,7]
        // Only NEW floor is z=5. Read it with perspective offset = 8 - 5 = 3
        const newFloor = Math.max(g.camZ - 2, 0);
        const offset = 8 - newFloor;
        this.readFloorArea(r, g.camX - 8, g.camY - 6, newFloor, 18, 14, offset, 0);
      } else if (g.camZ > 7) {
        // Underground going up — read the newly visible floor (camZ - 2)
        const nz = g.camZ - 2;
        if (nz >= 0) {
          this.readFloorAreaWithOffset(r, g.camX - 8, g.camY - 6, nz, 18, 14, 3);
        }
      }

      g.camX++; g.camY++;
    } catch (e) {
      g.camZ = oldZ; g.camX = oldX; g.camY = oldY;
      throw e;
    }
    this.syncPlayerToCamera(oldZ);
    this.cleanupDistantCreatures(g.camZ);
    this.reinsertCreaturesOnTiles();
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
    this.syncPlayerToCamera(oldZ);
    this.cleanupDistantCreatures(g.camZ);
    this.reinsertCreaturesOnTiles();
  }

  private talk(r: Buf) {
    try {
      r.u32(); // TibiaRelic sends statement guid (GameMessageStatements)
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
    r.skip(20); // TibiaRelic stats without stamina
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
    if (rem && rem !== cid) {
      if (rem === this.gs.playerId) this.gs.playerId = cid;
      this.gs.creatures.delete(rem);
    }
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
    // Preserve existing creature references that protocol data won't re-send
    const existingTile = this.gs.getTile(x, y, z);
    const preservedCreatures: TileItem[] = existingTile.filter(i => i[0] === 'cr');

    const items: TileItem[] = [];
    const newCreatureIds = new Set<number>();

    while (r.left() >= 2) {
      const word = r.peek16();
      if (word >= 0xFF00) {
        r.skip(2);
        // Re-add preserved creatures that weren't re-sent by the protocol
        for (const pc of preservedCreatures) {
          if (!newCreatureIds.has(pc[1])) {
            const c = this.gs.creatures.get(pc[1]);
            if (c && c.x === x && c.y === y && c.z === z) {
              items.push(pc);
            }
          }
        }
        this.gs.setTile(x, y, z, items);
        return word & 0xFF;
      }
      r.skip(2);
      if (word === CR_FULL) {
        const c = this.readCreatureFull(r);
        if (c.x !== x || c.y !== y || c.z !== z) {
          this.removeCreatureFromTile(c.id, c.x, c.y, c.z);
        }
        c.x = x; c.y = y; c.z = z;
        items.push(['cr', c.id]);
        newCreatureIds.add(c.id);
      } else if (word === CR_KNOWN) {
        const c = this.readCreatureKnown(r);
        if (c.x !== x || c.y !== y || c.z !== z) {
          this.removeCreatureFromTile(c.id, c.x, c.y, c.z);
        }
        c.x = x; c.y = y; c.z = z;
        items.push(['cr', c.id]);
        newCreatureIds.add(c.id);
      } else if (word === CR_OLD) {
        const cid = r.u32();
        const dir = r.u8();
        const c = this.gs.creatures.get(cid);
        if (c) {
          if (c.x !== x || c.y !== y || c.z !== z) {
            this.removeCreatureFromTile(cid, c.x, c.y, c.z);
          }
          c.direction = dir; c.x = x; c.y = y; c.z = z;
        }
        items.push(['cr', cid]);
        newCreatureIds.add(cid);
      } else if (word >= 100 && word <= 9999) {
        const it = this.dat.items.get(word);
        if (it && (it.isStackable || it.isFluid || it.isSplash)) {
          r.u8();
        }
        items.push(['it', word]);
      }
    }
    // Re-add preserved creatures at end-of-buffer too
    for (const pc of preservedCreatures) {
      if (!newCreatureIds.has(pc[1])) {
        const c = this.gs.creatures.get(pc[1]);
        if (c && c.x === x && c.y === y && c.z === z) {
          items.push(pc);
        }
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
          this.setTilePreservingCreatures(ox + tx, oy + ty, z);
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
          this.setTilePreservingCreatures(ox + tx + offset, oy + ty + offset, z);
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
          this.setTilePreservingCreatures(ox + tx + offset, oy + ty + offset, z);
          skip--;
          continue;
        }
        skip = this.readTileItems(r, ox + tx + offset, oy + ty + offset, z);
      }
    }
  }

  private readMultiFloorArea(r: Buf, ox: number, oy: number, W: number, H: number, camZ: number, startz: number, endz: number, zstep: number) {
    let skip = 0;
    const startPos = r.pos;
    const dl = this.debugLogger;
    let floorCount = 0;
    for (let nz = startz; nz !== endz + zstep; nz += zstep) {
      if (r.left() < 2) {
        if (dl && dl.enabled) {
          dl.log('MULTIFLOOR_EXHAUSTED', {
            floor: nz, floorIndex: floorCount, bytesLeft: r.left(),
            totalConsumed: r.pos - startPos,
            expectedFloors: Math.abs(endz - startz) / Math.abs(zstep) + 1,
          });
        }
        break;
      }
      const floorStartPos = r.pos;
      const offset = camZ - nz;
      skip = this.readFloorArea(r, ox, oy, nz, W, H, offset, skip);
      floorCount++;
      if (dl && dl.enabled) {
        dl.log('MULTIFLOOR_STEP', {
          floor: nz, floorIndex: floorCount - 1, offset,
          bytesConsumed: r.pos - floorStartPos,
          totalConsumed: r.pos - startPos,
          bytesLeft: r.left(),
          skipCarry: skip,
        });
      }
    }
    if (dl && dl.enabled) {
      dl.log('MULTIFLOOR_DONE', {
        floorsRead: floorCount,
        expectedFloors: Math.abs(endz - startz) / Math.abs(zstep) + 1,
        totalBytesConsumed: r.pos - startPos,
        bytesLeft: r.left(),
        camZ, startz, endz,
      });
    }
    // Safety net: re-insert creature references into their tiles after area read
    this.reinsertCreaturesOnTiles();
  }

  /** Ensure every known creature has a ['cr', cid] entry on its current tile */
  private reinsertCreaturesOnTiles() {
    const g = this.gs;
    for (const [cid, c] of g.creatures) {
      const tile = g.getTile(c.x, c.y, c.z);
      const hasCr = tile.some(i => i[0] === 'cr' && i[1] === cid);
      if (!hasCr) {
        tile.push(['cr', cid]);
        g.setTile(c.x, c.y, c.z, tile);
      }
    }
  }

  /**
   * Convert Tibia protocol color byte to hex string.
   * Uses the same 216-color cube (6x6x6) as the client.
   */
  private protocolColorToHex(c: number): string {
    // Tibia 6x6x6 RGB cube (216 colors): color 215=white, 180=red, etc.
    const r = Math.floor(c / 36) % 6;
    const g = Math.floor(c / 6) % 6;
    const b = c % 6;
    const toHex = (v: number) => Math.round(v * 51).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
