/**
 * Extraction Protocol Parser — ported from Cam Mapper project
 * Adapted for TibiaRelic 7.72 with custom opcodes and u16 looktype.
 * 
 * Key difference from packetParser.ts: this parser stores tiles with
 * ABSOLUTE coordinates immediately (using the offset parameter), so
 * there's no need to reverse perspective offset later. This eliminates
 * the floor-desync bug caused by batched processing.
 * 
 * Also tracks creatures for spawn data extraction.
 */

import { DatLoader, type ItemType } from './datLoader';

// ── Types ──

export interface ExtractionLocation {
  x: number;
  y: number;
  z: number;
}

export interface ExtractionCreature {
  id: number;
  name: string;
  health: number;
  outfit: number;
  outfitItem: number;
  head: number;
  body: number;
  legs: number;
  feet: number;
  direction: number;
  x: number;
  y: number;
  z: number;
}

export interface ExtractionTile {
  location: ExtractionLocation;
  itemIds: number[];
}

export type OnTileCallback = (tile: ExtractionTile) => void;
export type OnCreatureCallback = (creature: ExtractionCreature, location: ExtractionLocation) => void;

// ── InputMessage (ported from Cam Mapper) ──

class InputMessage {
  private buffer: Uint8Array;
  private view: DataView;
  private position: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    this.position = 0;
  }

  getLocation(): ExtractionLocation {
    return { x: this.getU16(), y: this.getU16(), z: this.getByte() };
  }

  getByte(): number {
    if (this.position >= this.buffer.length) throw new Error('EOF');
    return this.buffer[this.position++];
  }

  getU16(): number {
    if (this.position + 2 > this.buffer.length) throw new Error('EOF');
    const val = this.view.getUint16(this.position, true);
    this.position += 2;
    return val;
  }

  getU32(): number {
    if (this.position + 4 > this.buffer.length) throw new Error('EOF');
    const val = this.view.getUint32(this.position, true);
    this.position += 4;
    return val;
  }

  peekU16(): number {
    if (this.position + 2 > this.buffer.length) return 0xFFFF;
    return this.view.getUint16(this.position, true);
  }

  getString(): string {
    const len = this.getU16();
    if (this.position + len > this.buffer.length) throw new Error('EOF');
    const bytes = this.buffer.slice(this.position, this.position + len);
    this.position += len;
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  getOutfit(): { lookType: number; head: number; body: number; legs: number; feet: number; lookTypeEx: number } {
    const lookType = this.getU16(); // TibiaRelic uses u16
    if (lookType !== 0) {
      return {
        lookType,
        head: this.getByte(),
        body: this.getByte(),
        legs: this.getByte(),
        feet: this.getByte(),
        lookTypeEx: 0,
      };
    }
    return { lookType: 0, head: 0, body: 0, legs: 0, feet: 0, lookTypeEx: this.getU16() };
  }

  getLength(): number { return this.buffer.length; }
  getPosition(): number { return this.position; }
  skipBytes(v: number): void { this.position += v; }
}

// ── ExtractionParser ──

export class ExtractionParser {
  private items: Map<number, ItemType>;
  private playerLocation: ExtractionLocation = { x: 65535, y: 65535, z: 255 };
  private playerName = '';
  private playerId = 0;
  private parseErrors = 0;

  // Creature tracking
  private creatures = new Map<number, ExtractionCreature>();

  // Callbacks
  public onTile: OnTileCallback | null = null;
  public onCreature: OnCreatureCallback | null = null;

  constructor(dat: DatLoader) {
    this.items = dat.items;
  }

  get location(): ExtractionLocation { return this.playerLocation; }
  get knownCreatures(): Map<number, ExtractionCreature> { return this.creatures; }
  get errors(): number { return this.parseErrors; }

  parsePacket(data: Uint8Array): void {
    const msg = new InputMessage(data);
    try {
      while (msg.getPosition() < msg.getLength()) {
        const head = msg.getByte();
        switch (head) {
          case 0x0A: this.parseLogin(msg); break;
          case 0x14: msg.getString(); break; // disconnect
          case 0x16: msg.getString(); msg.getByte(); break; // wait list
          case 0x1E: break; // ping
          case 0x64: this.parseMapDescription(msg); break;
          case 0x65: this.parseNorthMove(msg); break;
          case 0x66: this.parseEastMove(msg); break;
          case 0x67: this.parseSouthMove(msg); break;
          case 0x68: this.parseWestMove(msg); break;
          case 0x69: { // update tile
            const loc = msg.getLocation();
            const tid = msg.peekU16();
            if (tid === 0xFF01) { msg.getU16(); } else { this.parseTileDescription(msg, loc); msg.getU16(); }
            break;
          }
          case 0x6A: msg.getLocation(); this.getThing(msg); break; // add tile item
          case 0x6B: msg.getLocation(); msg.getByte(); this.getThing(msg); break; // update tile item
          case 0x6C: msg.getLocation(); msg.getByte(); break; // remove tile item
          case 0x6D: this.parseMoveCreature(msg); break;
          case 0x6E: this.parseContainer(msg); break;
          case 0x6F: msg.getByte(); break; // close container
          case 0x70: msg.getByte(); this.getThing(msg); break; // add container item
          case 0x71: msg.getByte(); msg.getByte(); this.getThing(msg); break; // update container item
          case 0x72: msg.getByte(); msg.getByte(); break; // remove container item
          case 0x78: msg.getByte(); this.getItem(msg, 0xFFFF); break; // set inventory
          case 0x79: msg.getByte(); break; // clear inventory
          case 0x7D: case 0x7E: this.parseTradeItemRequest(msg); break;
          case 0x7F: break; // close trade
          case 0x82: msg.getByte(); msg.getByte(); break; // world light
          case 0x83: msg.getLocation(); msg.getByte(); break; // magic effect
          case 0x84: msg.getLocation(); msg.getByte(); msg.getString(); break; // animated text
          case 0x85: msg.getLocation(); msg.getLocation(); msg.getByte(); break; // distance shoot
          case 0x86: msg.getU32(); msg.getByte(); break; // creature square (7.6 style)
          case 0x8C: this.parseCreatureHealth(msg); break;
          case 0x8D: msg.getU32(); msg.getByte(); msg.getByte(); break; // creature light
          case 0x8E: this.parseCreatureOutfit(msg); break;
          case 0x8F: msg.getU32(); msg.getU16(); break; // change speed
          case 0x90: msg.getU32(); msg.getByte(); break; // creature skull
          case 0x91: msg.getU32(); msg.getByte(); break; // creature shield
          case 0x92: break; // CreatureImpassable — TibiaRelic-specific (no data)
          case 0x96: msg.getU32(); msg.getU16(); msg.getU16(); msg.getString(); msg.getString(); break; // text window
          case 0x97: msg.getByte(); msg.getU32(); msg.getString(); break; // house window
          case 0x9A: break; // TibiaRelic PlayerPos — 0 bytes payload
          case 0xA0: this.parsePlayerStats(msg); break;
          case 0xA1: this.parsePlayerSkills(msg); break;
          case 0xA2: msg.getByte(); break; // player icons
          case 0xA3: break; // cancel target
          case 0xA8: msg.getU32(); msg.getByte(); break; // TibiaRelic CreatureSquare (5 bytes)
          case 0xAA: this.parseCreatureSpeak(msg); break;
          case 0xAB: this.parseChannelsDialog(msg); break;
          case 0xAC: msg.getU16(); msg.getString(); break; // open channel
          case 0xAD: msg.getString(); break; // open private channel
          case 0xAE: msg.getU16(); break; // rule violations channel
          case 0xAF: msg.getString(); break; // remove report
          case 0xB0: msg.getString(); break; // rule violation cancel
          case 0xB1: break; // lock rule violation
          case 0xB2: msg.getU16(); msg.getString(); break; // create private channel
          case 0xB3: msg.getU16(); break; // close private
          case 0xB4: msg.getByte(); msg.getString(); break; // text message
          case 0xB5: msg.getU16(); break; // TibiaRelic cancel walk (u16 move delay)
          case 0xB6: msg.getU16(); break; // TibiaRelic WalkCancel (u16 move delay)
          case 0xBE: this.parseFloorChangeUp(msg); break;
          case 0xBF: this.parseFloorChangeDown(msg); break;
          case 0xC8: this.parseOutfitWindow(msg); break;
          case 0xD2: msg.getU32(); msg.getString(); msg.getByte(); break; // VIP
          case 0xD3: msg.getU32(); break; // VIP login
          case 0xD4: msg.getU32(); break; // VIP logout
          // 0x63 — CreatureTurn, not handled (fall to default: return)
          default:
            // Unknown opcode — stop parsing this frame to prevent byte drift
            return;
        }
      }
    } catch {
      this.parseErrors++;
    }
  }

  // ── Map parsing ──

  private parseMapDescription(msg: InputMessage): void {
    const loc = msg.getLocation();
    this.playerLocation = loc;
    this.getMapDescription(msg, loc.x - 8, loc.y - 6, loc.z, 18, 14);
  }

  private parseNorthMove(msg: InputMessage): void {
    const loc = { ...this.playerLocation, y: this.playerLocation.y - 1 };
    this.playerLocation = loc;
    this.getMapDescription(msg, loc.x - 8, loc.y - 6, loc.z, 18, 1);
  }

  private parseEastMove(msg: InputMessage): void {
    const loc = { ...this.playerLocation, x: this.playerLocation.x + 1 };
    this.playerLocation = loc;
    this.getMapDescription(msg, loc.x + 9, loc.y - 6, loc.z, 1, 14);
  }

  private parseSouthMove(msg: InputMessage): void {
    const loc = { ...this.playerLocation, y: this.playerLocation.y + 1 };
    this.playerLocation = loc;
    this.getMapDescription(msg, loc.x - 8, loc.y + 7, loc.z, 18, 1);
  }

  private parseWestMove(msg: InputMessage): void {
    const loc = { ...this.playerLocation, x: this.playerLocation.x - 1 };
    this.playerLocation = loc;
    this.getMapDescription(msg, loc.x - 8, loc.y - 6, loc.z, 1, 14);
  }

  private getMapDescription(msg: InputMessage, x: number, y: number, z: number, width: number, height: number): void {
    let startz: number, endz: number, zstep: number;

    if (z > 7) {
      startz = z - 2;
      endz = Math.min(15, z + 2);
      zstep = 1;
    } else {
      // Surface: TibiaRelic sends ALL surface floors 7→0
      startz = 7;
      endz = 0;
      zstep = -1;
    }

    let skipTiles = 0;
    for (let nz = startz; nz !== endz + zstep; nz += zstep) {
      skipTiles = this.parseFloorDescription(msg, x, y, nz, width, height, z - nz, skipTiles);
    }
  }

  private parseFloorDescription(
    msg: InputMessage, x: number, y: number, z: number,
    width: number, height: number, offset: number, skipTiles: number,
  ): number {
    for (let nx = 0; nx < width; nx++) {
      for (let ny = 0; ny < height; ny++) {
        if (skipTiles === 0) {
          const tileOpt = msg.peekU16();
          if (tileOpt >= 0xFF00) {
            skipTiles = msg.getU16() & 0xFF;
          } else {
            // KEY FIX: Store with absolute coordinates using offset
            const location: ExtractionLocation = {
              x: x + nx + offset,
              y: y + ny + offset,
              z,
            };
            this.parseTileDescription(msg, location);
            skipTiles = msg.getU16() & 0xFF;
          }
        } else {
          skipTiles--;
        }
      }
    }
    return skipTiles;
  }

  private parseTileDescription(msg: InputMessage, location: ExtractionLocation): void {
    const itemIds: number[] = [];
    while (msg.peekU16() < 0xFF00) {
      const thing = this.getThing(msg, location);
      if (thing !== null && thing.type === 'item') {
        itemIds.push(thing.id);
      }
    }

    // Validate tile: must have valid coords and items
    if (location.z < 0 || location.z > 15) return;
    if (location.x < 30000 || location.x > 35000 || location.y < 30000 || location.y > 35000) return;

    // Check for valid ground sprite
    if (itemIds.length > 0) {
      const groundId = itemIds[0];
      const groundDef = this.items.get(groundId);
      if (groundDef && groundDef.isGround && groundDef.spriteIds.length > 0 && groundDef.spriteIds[0] > 0) {
        // Filter items: only keep items with reasonable IDs and stackPrio <= 5
        const filtered = itemIds.filter(id => {
          if (id < 100 || id > 9999) return false;
          const def = this.items.get(id);
          return def && def.stackPrio <= 5;
        });

        if (filtered.length > 0 && this.onTile) {
          this.onTile({ location, itemIds: filtered });
        }
      }
    }
  }

  // ── Thing parsing ──

  private getThing(msg: InputMessage, location?: ExtractionLocation): { type: 'item'; id: number } | { type: 'creature'; id: number } | null {
    const thingId = msg.getU16();

    if (thingId === 0x0061 || thingId === 0x0062) {
      // Full creature or known creature
      let name = '';
      let health = 0;
      let creatureId = 0;
      let outfit = { lookType: 0, head: 0, body: 0, legs: 0, feet: 0, lookTypeEx: 0 };
      let direction = 0;

      if (thingId === 0x0062) {
        creatureId = msg.getU32();
        health = msg.getByte();
      } else {
        msg.getU32(); // remove id
        creatureId = msg.getU32();
        name = msg.getString();
        health = msg.getByte();

        // Track player
        if (location &&
            this.playerLocation.x === location.x &&
            this.playerLocation.y === location.y &&
            this.playerLocation.z === location.z) {
          this.playerName = name;
          this.playerId = creatureId;
        }
      }

      direction = msg.getByte();
      outfit = msg.getOutfit();
      msg.getByte(); // light level
      msg.getByte(); // light color
      msg.getU16(); // speed
      msg.getByte(); // skull
      msg.getByte(); // shield

      // Update creature tracking
      const existing = this.creatures.get(creatureId) || {
        id: creatureId, name: '', health: 100, outfit: 0, outfitItem: 0,
        head: 0, body: 0, legs: 0, feet: 0, direction: 0, x: 0, y: 0, z: 0,
      };

      if (thingId === 0x0061) {
        existing.name = name;
      }
      existing.id = creatureId;
      existing.health = health;
      existing.outfit = outfit.lookType;
      existing.outfitItem = outfit.lookTypeEx;
      existing.head = outfit.head;
      existing.body = outfit.body;
      existing.legs = outfit.legs;
      existing.feet = outfit.feet;
      existing.direction = direction;

      if (location) {
        existing.x = location.x;
        existing.y = location.y;
        existing.z = location.z;

        // Notify creature callback
        if (this.onCreature && existing.name && existing.health > 0) {
          this.onCreature(existing, location);
        }
      }

      this.creatures.set(creatureId, existing);
      return { type: 'creature', id: creatureId };
    } else if (thingId === 0x0063) {
      // Creature turn
      const cid = msg.getU32();
      msg.getByte(); // direction
      return { type: 'creature', id: cid };
    } else {
      // Item
      this.readItemExtra(msg, thingId);
      return { type: 'item', id: thingId };
    }
  }

  private getItem(msg: InputMessage, itemid: number): void {
    if (itemid === 0xFFFF) {
      itemid = msg.getU16();
    }
    this.readItemExtra(msg, itemid);
  }

  private readItemExtra(msg: InputMessage, itemid: number): void {
    const type = this.items.get(itemid);
    if (type) {
      if (type.isStackable || type.isFluid || type.isSplash) {
        msg.getByte();
      }
    }
  }

  // ── Floor changes ──

  private parseFloorChangeUp(msg: InputMessage): void {
    const myPos: ExtractionLocation = { ...this.playerLocation, z: this.playerLocation.z - 1 };

    if (myPos.z === 7) {
      // Surface entry: read floors 5→0 (6 floors)
      let skip = 0;
      skip = this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, 5, 18, 14, 3, skip);
      skip = this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, 4, 18, 14, 4, skip);
      skip = this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, 3, 18, 14, 5, skip);
      skip = this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, 2, 18, 14, 6, skip);
      skip = this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, 1, 18, 14, 7, skip);
      this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, 0, 18, 14, 8, skip);
    } else if (myPos.z > 7) {
      this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, myPos.z - 2, 18, 14, 3, 0);
    }

    this.playerLocation = { x: myPos.x + 1, y: myPos.y + 1, z: myPos.z };
  }

  private parseFloorChangeDown(msg: InputMessage): void {
    const myPos: ExtractionLocation = { ...this.playerLocation, z: this.playerLocation.z + 1 };
    let skipTiles = 0;

    if (myPos.z === 8) {
      for (let i = myPos.z, j = -1; i < myPos.z + 3; ++i, --j) {
        skipTiles = this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, i, 18, 14, j, skipTiles);
      }
    } else if (myPos.z > 8 && myPos.z < 14) {
      this.parseFloorDescription(msg, myPos.x - 8, myPos.y - 6, myPos.z + 2, 18, 14, -3, skipTiles);
    }

    this.playerLocation = { x: myPos.x - 1, y: myPos.y - 1, z: myPos.z };
  }

  // ── Non-map handlers ──

  private parseMoveCreature(msg: InputMessage): void {
    const oldLoc = msg.getLocation();
    msg.getByte(); // old stack
    const newLoc = msg.getLocation();

    if (oldLoc.x !== 65535) {
      // Update creature positions in tracked creatures
      // Find creature at oldLoc and update to newLoc
      for (const c of this.creatures.values()) {
        if (c.x === oldLoc.x && c.y === oldLoc.y && c.z === oldLoc.z) {
          c.x = newLoc.x;
          c.y = newLoc.y;
          c.z = newLoc.z;
          break;
        }
      }
    }

    // Update player location if it's the player moving
    if (oldLoc.x === this.playerLocation.x && oldLoc.y === this.playerLocation.y && oldLoc.z === this.playerLocation.z) {
      this.playerLocation = newLoc;
    }
  }

  private parseLogin(msg: InputMessage): void {
    const pid = msg.getU32();
    this.playerId = pid;
    msg.getByte(); // draw speed
    msg.getByte(); // can report bugs
    const accessLevel = msg.getByte();
    if (accessLevel === 1) {
      msg.getByte(); // loop byte
      for (let b = 0; b < 32; b++) msg.getByte();
    }
  }

  private parseContainer(msg: InputMessage): void {
    msg.getByte(); msg.getU16(); msg.getString(); msg.getByte(); msg.getByte();
    const size = msg.getByte();
    for (let i = 0; i < size; i++) this.getThing(msg);
  }

  private parseTradeItemRequest(msg: InputMessage): void {
    msg.getString();
    const size = msg.getByte();
    for (let i = 0; i < size; i++) this.getThing(msg);
  }

  private parseCreatureHealth(msg: InputMessage): void {
    const cid = msg.getU32();
    const health = msg.getByte();
    const c = this.creatures.get(cid);
    if (c) c.health = health;
  }

  private parseCreatureOutfit(msg: InputMessage): void {
    const cid = msg.getU32();
    const outfit = msg.getOutfit();
    const c = this.creatures.get(cid);
    if (c) {
      c.outfit = outfit.lookType;
      c.outfitItem = outfit.lookTypeEx;
      c.head = outfit.head;
      c.body = outfit.body;
      c.legs = outfit.legs;
      c.feet = outfit.feet;
    }
  }

  private parseFloorChange_field(msg: InputMessage): void {
    // 0x9A — some floor change marker, consume nothing extra
  }

  private parsePlayerStats(msg: InputMessage): void {
    msg.getU16(); msg.getU16(); msg.getU16(); msg.getU32();
    msg.getByte(); msg.getByte(); msg.getU16(); msg.getU16();
    msg.getByte(); msg.getByte(); msg.getU16();
  }

  private parsePlayerSkills(msg: InputMessage): void {
    for (let i = 0; i < 7; i++) { msg.getByte(); msg.getByte(); }
  }

  private parseCreatureSpeak(msg: InputMessage): void {
    msg.getU32(); // statement guid (TibiaRelic ReportMessages)
    msg.getString(); // name
    const type = msg.getByte();
    switch (type) {
      case 1: case 2: case 3: case 0x10: case 0x11: msg.getLocation(); break;
      case 5: case 0xA: case 0xE: case 0xC: msg.getU16(); break;
      case 6: msg.getU16(); break;
      default: break;
    }
    msg.getString(); // message
  }

  private parseChannelsDialog(msg: InputMessage): void {
    const size = msg.getByte();
    for (let i = 0; i < size; i++) { msg.getU16(); msg.getString(); }
  }

  private parseOutfitWindow(msg: InputMessage): void {
    msg.getOutfit();
    // TibiaRelic uses u16 range
    const from = msg.getU16();
    const to = msg.getU16();
    // No extra data per outfit in 7.6/7.72 window
  }
}
