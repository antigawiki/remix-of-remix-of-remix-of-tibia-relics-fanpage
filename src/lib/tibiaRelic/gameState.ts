/**
 * Estado do jogo - tiles, criaturas, câmera, mensagens
 */

export const DIR_N = 0, DIR_E = 1, DIR_S = 2, DIR_W = 3;

export interface Creature {
  id: number;
  name: string;
  health: number;
  direction: number;
  outfit: number;
  outfitItem: number;
  head: number;
  body: number;
  legs: number;
  feet: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  walking: boolean;
  walkEndTick: number;
  walkOffsetX: number;
  walkOffsetY: number;
  walkStartTick: number;
  walkDuration: number;
}

export function createCreature(): Creature {
  return {
    id: 0, name: '', health: 100, direction: DIR_S,
    outfit: 128, outfitItem: 0, head: 0, body: 0, legs: 0, feet: 0,
    x: 0, y: 0, z: 0, speed: 200,
    walking: false, walkEndTick: 0,
    walkOffsetX: 0, walkOffsetY: 0, walkStartTick: 0, walkDuration: 0,
  };
}

export type TileItem = ['it', number] | ['cr', number];

export interface ChatMessage {
  text: string;
  color: string;
  expireAt: number; // performance.now() + duration
}

export interface ActiveEffect {
  x: number;
  y: number;
  z: number;
  effectId: number;
  startTick: number;
  duration: number;
}

export interface ActiveProjectile {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  missileId: number;
  startTick: number;
  duration: number;
}

export interface AnimatedText {
  x: number;
  y: number;
  z: number;
  color: string;
  text: string;
  startTick: number;
  duration: number;
}

export class GameState {
  tiles: Map<string, TileItem[]> = new Map();
  creatures: Map<number, Creature> = new Map();
  camX = 0;
  camY = 0;
  camZ = 7;
  playerId = 0;
  mapLoaded = false;
  ambientLightLevel = 255; // 0=total darkness, 255=full bright
  ambientLightColor = 215; // default daylight color
  messages: ChatMessage[] = [];
  effects: ActiveEffect[] = [];
  projectiles: ActiveProjectile[] = [];
  animatedTexts: AnimatedText[] = [];

  tileKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  getTile(x: number, y: number, z: number): TileItem[] {
    return this.tiles.get(this.tileKey(x, y, z)) || [];
  }

  setTile(x: number, y: number, z: number, items: TileItem[]) {
    this.tiles.set(this.tileKey(x, y, z), items);
  }

  addMsg(text: string, color = '#ffffff') {
    const now = performance.now();
    this.messages.push({ text, color, expireAt: now + 6000 });
    this.messages = this.messages.filter(m => m.expireAt > now);
  }

  pruneEffects(now: number) {
    if (this.effects.length > 0) {
      this.effects = this.effects.filter(e => now - e.startTick < e.duration);
    }
    if (this.projectiles.length > 0) {
      this.projectiles = this.projectiles.filter(p => now - p.startTick < p.duration);
    }
    if (this.animatedTexts.length > 0) {
      this.animatedTexts = this.animatedTexts.filter(a => now - a.startTick < a.duration);
    }
  }

  /** Create a serializable snapshot of the full game state */
  snapshot(): GameStateSnapshot {
    // Deep clone tiles
    const tilesObj: Record<string, TileItem[]> = {};
    for (const [k, v] of this.tiles.entries()) {
      tilesObj[k] = v.map(i => [...i] as TileItem);
    }
    // Deep clone creatures
    const creaturesObj: Record<number, Creature> = {};
    for (const [k, v] of this.creatures.entries()) {
      creaturesObj[k] = { ...v };
    }
    return {
      tiles: tilesObj,
      creatures: creaturesObj,
      camX: this.camX,
      camY: this.camY,
      camZ: this.camZ,
      playerId: this.playerId,
      mapLoaded: this.mapLoaded,
    };
  }

  /** Restore state from a snapshot */
  restore(snap: GameStateSnapshot) {
    this.tiles.clear();
    for (const k in snap.tiles) {
      this.tiles.set(k, snap.tiles[k].map(i => [...i] as TileItem));
    }
    this.creatures.clear();
    for (const k in snap.creatures) {
      this.creatures.set(Number(k), { ...snap.creatures[k] });
    }
    this.camX = snap.camX;
    this.camY = snap.camY;
    this.camZ = snap.camZ;
    this.playerId = snap.playerId;
    this.mapLoaded = snap.mapLoaded;
    this.messages = [];
    this.effects = [];
    this.projectiles = [];
    this.animatedTexts = [];
  }

  reset() {
    this.tiles.clear();
    this.creatures.clear();
    this.camX = 0;
    this.camY = 0;
    this.camZ = 7;
    this.playerId = 0;
    this.mapLoaded = false;
    this.ambientLightLevel = 255;
    this.ambientLightColor = 215;
    this.messages = [];
    this.effects = [];
    this.projectiles = [];
    this.animatedTexts = [];
  }
}

export interface GameStateSnapshot {
  tiles: Record<string, TileItem[]>;
  creatures: Record<number, Creature>;
  camX: number;
  camY: number;
  camZ: number;
  playerId: number;
  mapLoaded: boolean;
}
