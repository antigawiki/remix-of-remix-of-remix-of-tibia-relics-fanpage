export type { Equipment } from './helmets';
export { helmets } from './helmets';
export { armors } from './armors';
export { legs } from './legs';
export { boots } from './boots';
export { shields } from './shields';
export { swords } from './swords';
export { axes } from './axes';
export { clubs } from './clubs';
export { distance } from './distance';
export { ammo } from './ammo';

export const equipmentCategories = {
  helmets: { name: 'Capacetes', path: '/equipment/helmets' },
  armors: { name: 'Armaduras', path: '/equipment/armors' },
  legs: { name: 'Perneiras', path: '/equipment/legs' },
  boots: { name: 'Botas', path: '/equipment/boots' },
  shields: { name: 'Escudos', path: '/equipment/shields' },
  swords: { name: 'Espadas', path: '/equipment/swords' },
  axes: { name: 'Machados', path: '/equipment/axes' },
  clubs: { name: 'Clavas', path: '/equipment/clubs' },
  distance: { name: 'Distância', path: '/equipment/distance' },
  ammo: { name: 'Munição', path: '/equipment/ammo' },
} as const;
