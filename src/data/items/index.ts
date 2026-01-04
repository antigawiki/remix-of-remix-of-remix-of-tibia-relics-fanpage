export type { Item } from './foods';
export { foods } from './foods';
export { amulets } from './amulets';
export { rings } from './rings';
export { valuables } from './valuables';
export { backpacks } from './backpacks';

export const itemCategories = {
  foods: { name: 'Comidas', path: '/items/foods' },
  amulets: { name: 'Amuletos', path: '/items/amulets' },
  rings: { name: 'Anéis', path: '/items/rings' },
  valuables: { name: 'Valiosos', path: '/items/valuables' },
  backpacks: { name: 'Mochilas', path: '/items/backpacks' },
} as const;
