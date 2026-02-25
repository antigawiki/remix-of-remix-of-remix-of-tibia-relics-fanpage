/**
 * Parser de pacotes do protocolo Tibia 7.72 (OTHire/TibiaRelic)
 */
import { Buf } from './buf';
import { DatLoader } from './datLoader';
import { GameState, createCreature, DIR_N, DIR_E, DIR_S, DIR_W, type Creature, type TileItem } from './gameState';

const CR_FULL = 0x61, CR_KNOWN = 0x62, CR_OLD = 0x63;

export class PacketParser {
  constructor(public gs: GameState, public dat: DatLoader) {}

  private skipItem(r: Buf): number {
    const iid = r.u16();
    if (iid >= 100 && iid <= 9999) {
      const it = this.dat.items.get(iid);
      if (it && (it.isStackable || it.isFluid || it.isSplash)) {
        r.u8(); // count/subtype
      }
    }
    return iid;
  }

  private skipOutfit(r: Buf) {
    const oid = r.u16();
    if (oid) r.skip(4); // head+body+legs+feet
    else r.u16(); // lookTypeEx
  }

  private readOutfit(r: Buf): { type: number; head: number; body: number; legs: number; feet: number } {
    const oid = r.u16();
    if (oid === 0) { r.u16(); return { type: 0, head: 0, body: 0, legs: 0, feet: 0 }; }
    const h = r.u8(), b = r.u8(), l = r.u8(), f = r.u8();
    return { type: oid, head: h, body: b, legs: l, feet: f };
  }

  private pos3(r: Buf): [number, number, number] {
    return [r.u16(), r.u16(), r.u8()];
  }

  process(payload: Uint8Array) {
    const r = new Buf(payload);
    while (!r.eof()) {
      const posBefore = r.pos;
      try {
        const t = r.u8();
        this.dispatch(t, r);
      } catch {
        r.pos = posBefore + 1;
      }
    }
  }

  private dispatch(t: number, r: Buf) {
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
    // Login
    else if (t === 0x0a) this.login(r);
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
    // Trade
    else if (t === 0x7d) this.skipTrade(r);
    else if (t === 0x7e || t === 0x7f) { /* no data */ }
    // Effects/light
    else if (t === 0x82) { r.u8(); r.u8(); }
    else if (t === 0x83) { r.skip(5); r.u8(); }
    else if (t === 0x84) { r.skip(5); r.u8(); r.skip16(); }
    else if (t === 0x85) { r.skip(5); r.skip(5); r.u8(); }
    // Creature updates
    else if (t === 0x86) { r.u32(); r.u8(); }
    else if (t === 0x8c) { const cid = r.u32(); const hp = r.u8(); const c = g.creatures.get(cid); if (c) c.health = hp; }
    else if (t === 0x8d) { r.u32(); r.u8(); r.u8(); }
    else if (t === 0x8e) { r.u32(); this.skipOutfit(r); }
    else if (t === 0x8f) { r.u32(); r.u16(); }
    else if (t === 0x90) { r.u32(); r.u8(); r.u8(); }
    else if (t === 0x91) { r.u32(); r.u8(); }
    // Text
    else if (t === 0x96) { r.u32(); this.skipItem(r); r.u16(); r.skip16(); r.u16(); r.skip16(); }
    else if (t === 0x97) { r.u8(); r.u32(); r.skip16(); }
    else if (t === 0xa0) r.skip(20);
    else if (t === 0xa1) r.skip(14);
    else if (t === 0xa2) r.u16();
    else if (t === 0xa3) { /* cancelTarget */ }
    else if (t === 0xaa) this.talk(r);
    else if (t === 0xab) { r.u32(); r.u8(); r.skip16(); }
    else if (t === 0xac) { r.u16(); r.skip16(); }
    else if (t === 0xad) r.skip16();
    else if (t === 0xae) { r.u16(); r.skip16(); r.skip16(); r.u32(); }
    else if (t === 0xaf) r.skip16();
    else if (t === 0xb0) r.skip16();
    else if (t === 0xb1) { /* lockViolation */ }
    else if (t === 0xb2) { r.u16(); r.skip16(); }
    else if (t === 0xb3) r.u16();
    else if (t === 0xb4) this.textMsg(r);
    else if (t === 0xb5) r.u8();
    else if (t === 0xc8) this.skipOutfit(r);
    else if (t === 0xd2) { r.u32(); r.skip16(); r.u8(); }
    else if (t === 0xd3) r.u32();
    else if (t === 0xd4) r.u32();
    // Player pos/floor
    else if (t === 0x9a) { const [x, y, z] = this.pos3(r); g.camX = x; g.camY = y; g.camZ = z; }
    else if (t === 0xbe || t === 0xbf) { /* moveUp/Down */ }
    else if (t === 0x14) { r.u16(); r.skip16(); }
    else { throw new Error(`unknown opcode 0x${t.toString(16)}`); }
  }

  // --- Handlers ---

  private login(r: Buf) {
    this.gs.playerId = r.u32(); r.u16(); r.u8();
  }

  private mapDesc(r: Buf) {
    const [x, y, z] = this.pos3(r);
    this.gs.camX = x; this.gs.camY = y; this.gs.camZ = z;
    this.gs.mapLoaded = true;
    this.readBlock(r, x - 8, y - 6, z, 18, 14);
  }

  private scroll(r: Buf, dx: number, dy: number) {
    const g = this.gs;
    g.camX += dx; g.camY += dy;
    if (dx === 1) this.readBlock(r, g.camX + 9, g.camY - 6, g.camZ, 1, 14);
    else if (dx === -1) this.readBlock(r, g.camX - 8, g.camY - 6, g.camZ, 1, 14);
    else if (dy === 1) this.readBlock(r, g.camX - 8, g.camY + 7, g.camZ, 18, 1);
    else if (dy === -1) this.readBlock(r, g.camX - 8, g.camY - 6, g.camZ, 18, 1);
  }

  private tileUpd(r: Buf) {
    const [x, y, z] = this.pos3(r);
    this.readBlock(r, x, y, z, 1, 1);
  }

  private addThing(r: Buf) {
    const [x, y, z] = this.pos3(r);
    const word = r.peek16();
    if (word === CR_FULL) {
      r.skip(2);
      const c = this.readCreatureFull(r);
      c.x = x; c.y = y; c.z = z;
      const tile = this.gs.getTile(x, y, z);
      tile.push(['cr', c.id]);
      this.gs.setTile(x, y, z, tile);
    } else if (word === CR_KNOWN) {
      r.skip(2);
      this.readCreatureKnown(r, x, y, z);
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

  private moveCr(r: Buf) {
    const [fx, fy, fz] = this.pos3(r);
    const sp = r.u8();
    const [tx, ty, tz] = this.pos3(r);

    const ft = [...this.gs.getTile(fx, fy, fz)];
    let cid: number | null = null;
    if (sp >= 0 && sp < ft.length && ft[sp][0] === 'cr') {
      cid = ft[sp][1];
      ft.splice(sp, 1);
      this.gs.setTile(fx, fy, fz, ft);
    }
    if (cid !== null) {
      const c = this.gs.creatures.get(cid);
      if (c) {
        const dx = tx - fx, dy = ty - fy;
        if (dx === 0 && dy < 0) c.direction = DIR_N;
        else if (dx > 0) c.direction = DIR_E;
        else if (dx === 0 && dy > 0) c.direction = DIR_S;
        else if (dx < 0) c.direction = DIR_W;
        c.x = tx; c.y = ty; c.z = tz;
        const tile = this.gs.getTile(tx, ty, tz);
        tile.push(['cr', cid]);
        this.gs.setTile(tx, ty, tz, tile);
      }
    }
  }

  private openCont(r: Buf) {
    r.u8(); // cid
    r.u16(); // container item_id
    r.skip16(); // name
    r.u8(); // hasParent
    r.u8(); // capacity
    const n = r.u8();
    for (let i = 0; i < n; i++) this.skipItem(r);
  }

  private skipTrade(r: Buf) {
    r.skip16(); // player name
    const n = r.u8();
    for (let i = 0; i < n; i++) this.skipItem(r);
  }

  private talk(r: Buf) {
    try {
      r.u32(); // statement_id
      const name = r.str16();
      const tp = r.u8();
      const POS_TYPES = new Set([0x01, 0x02, 0x03, 0x10, 0x11]);
      const CHAN_TYPES = new Set([0x05, 0x0A, 0x0C, 0x0E]);
      const TIME_TYPES = new Set([0x06]);
      if (POS_TYPES.has(tp)) r.skip(5);
      else if (CHAN_TYPES.has(tp)) r.u16();
      else if (TIME_TYPES.has(tp)) r.u32();
      const msg = r.str16();
      if (msg.length >= 2) {
        const col = [0x01, 0x02, 0x03].includes(tp) ? '#ffffff'
          : CHAN_TYPES.has(tp) ? '#ffdd88'
          : [0x10, 0x11].includes(tp) ? '#ff8888' : '#cccccc';
        this.gs.addMsg(name ? `${name}: ${msg}` : msg, col);
      }
    } catch { /* ignore */ }
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
    r.u8(); r.u8(); // light level+color
    c.speed = r.u16();
    r.u8(); r.u8(); // skull+shield
    if (outfit.type) {
      c.outfit = outfit.type;
      c.head = outfit.head; c.body = outfit.body;
      c.legs = outfit.legs; c.feet = outfit.feet;
    }
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

  private readCreatureKnown(r: Buf, x?: number, y?: number, z?: number): Creature {
    const cid = r.u32();
    let c = this.gs.creatures.get(cid);
    if (!c) { c = createCreature(); c.id = cid; }
    this.gs.creatures.set(cid, c);
    this.updateCreatureCommon(r, c);
    if (x !== undefined && y !== undefined && z !== undefined) {
      c.x = x; c.y = y; c.z = z;
      const tile = this.gs.getTile(x, y, z);
      tile.push(['cr', cid]);
      this.gs.setTile(x, y, z, tile);
    }
    return c;
  }

  // --- Tile/block readers ---

  private readTileItems(r: Buf, x: number, y: number, z: number): number {
    const items: TileItem[] = [];
    while (r.left() >= 2) {
      const word = r.peek16();
      if (word >= 0xFF00) {
        r.skip(2); // consume terminator
        this.gs.setTile(x, y, z, items);
        return word & 0xFF; // extra tiles to skip
      }
      r.skip(2); // consume the item_id
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
          r.u8(); // count/subtype
        }
        items.push(['it', word]);
      }
    }
    this.gs.setTile(x, y, z, items);
    return 0;
  }

  private readBlock(r: Buf, ox: number, oy: number, z: number, W: number, H: number) {
    let tileIdx = 0;
    const total = W * H;
    while (tileIdx < total && r.left() >= 2) {
      const tx = tileIdx % W;
      const ty = Math.floor(tileIdx / W);
      const extra = this.readTileItems(r, ox + tx, oy + ty, z);
      tileIdx += 1 + extra;
    }
  }
}
