export type { Spell } from './sorcerer';
export { sorcererSpells } from './sorcerer';
export { druidSpells } from './druid';
export { paladinSpells } from './paladin';
export { knightSpells } from './knight';

export const spellVocations = {
  sorcerer: { name: 'Sorcerer', path: '/spells/sorcerer' },
  druid: { name: 'Druid', path: '/spells/druid' },
  paladin: { name: 'Paladin', path: '/spells/paladin' },
  knight: { name: 'Knight', path: '/spells/knight' },
} as const;
