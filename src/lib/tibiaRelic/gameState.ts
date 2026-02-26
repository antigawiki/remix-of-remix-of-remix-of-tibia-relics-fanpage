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
}

export function createCreature(): Creature {
  return {
    id: 0, name: '', health: 100, direction: DIR_S,
    outfit: 128, outfitItem: 0, head: 0, body: 0, legs: 0, feet: 0,
    x: 0, y: 0, z: 0, speed: 200,
    walking: false, walkEndTick: 0,
  };
}

export type TileItem = ['it', number] | ['cr', number];

export interface ChatMessage {
  text: string;
  color: string;
  expireAt: number; // performance.now() + duration
}

export class GameState {
  tiles: Map<string, TileItem[]> = new Map();
  creatures: Map<number, Creature> = new Map();
  camX = 0;
  camY = 0;
  camZ = 7;
  playerId = 0;
  mapLoaded = false;
  messages: ChatMessage[] = [];

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

  reset() {
    this.tiles.clear();
    this.creatures.clear();
    this.camX = 0;
    this.camY = 0;
    this.camZ = 7;
    this.playerId = 0;
    this.mapLoaded = false;
    this.messages = [];
  }
}
