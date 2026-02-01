export type { Item } from './foods';
export { foods } from './foods';
export { amulets } from './amulets';
export { rings } from './rings';
export { valuables } from './valuables';
export { backpacks } from './backpacks';

export const itemCategories = {
  foods: { nameKey: 'items.foods', path: '/items/foods' },
  amulets: { nameKey: 'items.amulets', path: '/items/amulets' },
  rings: { nameKey: 'items.rings', path: '/items/rings' },
  valuables: { nameKey: 'items.valuables', path: '/items/valuables' },
  backpacks: { nameKey: 'items.backpacks', path: '/items/backpacks' },
} as const;
