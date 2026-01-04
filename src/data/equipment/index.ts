export type { Equipment } from './helmets';
export { helmets } from './helmets';
export { armors } from './armors';
export { legs } from './legs';
export { boots } from './boots';
export { shields } from './shields';
export { swords } from './swords';
export { axes } from './axes';
export { clubs } from './clubs';

export const equipmentCategories = {
  helmets: { name: 'Helmets', path: '/equipment/helmets' },
  armors: { name: 'Armors', path: '/equipment/armors' },
  legs: { name: 'Legs', path: '/equipment/legs' },
  boots: { name: 'Boots', path: '/equipment/boots' },
  shields: { name: 'Shields', path: '/equipment/shields' },
  swords: { name: 'Swords', path: '/equipment/swords' },
  axes: { name: 'Axes', path: '/equipment/axes' },
  clubs: { name: 'Clubs', path: '/equipment/clubs' },
} as const;
