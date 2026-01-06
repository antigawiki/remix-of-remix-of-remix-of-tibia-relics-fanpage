export interface SpellDamageData {
  id: string;
  name: string;
  words: string;
  type: 'heal' | 'attack';
  category: 'spell' | 'rune';
  baseMin: number;
  baseMax: number;
  image: string;
}

export const spellDamageData: SpellDamageData[] = [
  // Healing Spells
  { id: 'exura', name: 'Exura', words: 'exura', type: 'heal', category: 'spell', baseMin: 10, baseMax: 30, image: 'https://tibiara.netlify.app/en/img/runes/exura.gif' },
  { id: 'exuragran', name: 'Exura Gran', words: 'exura gran', type: 'heal', category: 'spell', baseMin: 20, baseMax: 60, image: 'https://tibiara.netlify.app/en/img/runes/exura.gif' },
  { id: 'exuravita', name: 'Exura Vita', words: 'exura vita', type: 'heal', category: 'spell', baseMin: 200, baseMax: 300, image: 'https://tibiara.netlify.app/en/img/runes/exura.gif' },
  { id: 'exurasio', name: 'Exura Sio', words: 'exura sio "name"', type: 'heal', category: 'spell', baseMin: 160, baseMax: 240, image: 'https://tibiara.netlify.app/en/img/runes/exura.gif' },
  
  // Healing Runes
  { id: 'ih', name: 'Intense Healing', words: 'IH Rune', type: 'heal', category: 'rune', baseMin: 40, baseMax: 100, image: 'https://tibiara.netlify.app/en/img/runes/ih.gif' },
  { id: 'uh', name: 'Ultimate Healing', words: 'UH Rune', type: 'heal', category: 'rune', baseMin: 250, baseMax: 250, image: 'https://tibiara.netlify.app/en/img/runes/uh.gif' },
  
  // Attack Runes
  { id: 'lmm', name: 'Light Magic Missile', words: 'LMM Rune', type: 'attack', category: 'rune', baseMin: 10, baseMax: 20, image: 'https://tibiara.netlify.app/en/img/runes/lmm.gif' },
  { id: 'hmm', name: 'Heavy Magic Missile', words: 'HMM Rune', type: 'attack', category: 'rune', baseMin: 20, baseMax: 40, image: 'https://tibiara.netlify.app/en/img/runes/hmm.gif' },
  { id: 'fb', name: 'Fireball', words: 'FB Rune', type: 'attack', category: 'rune', baseMin: 15, baseMax: 25, image: 'https://tibiara.netlify.app/en/img/runes/fb.gif' },
  { id: 'gfb', name: 'Great Fireball', words: 'GFB Rune', type: 'attack', category: 'rune', baseMin: 35, baseMax: 65, image: 'https://tibiara.netlify.app/en/img/runes/gfb.gif' },
  { id: 'explosion', name: 'Explosion', words: 'Explosion Rune', type: 'attack', category: 'rune', baseMin: 20, baseMax: 100, image: 'https://tibiara.netlify.app/en/img/runes/ex.gif' },
  { id: 'sd', name: 'Sudden Death', words: 'SD Rune', type: 'attack', category: 'rune', baseMin: 130, baseMax: 170, image: 'https://tibiara.netlify.app/en/img/runes/sd.gif' },
  { id: 'burst', name: 'Burst Arrow', words: 'Burst Arrow', type: 'attack', category: 'rune', baseMin: 0, baseMax: 60, image: 'https://tibiara.netlify.app/en/img/distance/burstarrow.gif' },
  
  // Attack Spells
  { id: 'estrike', name: 'Exori vis, flam, mort', words: 'exori vis/flam/mort', type: 'attack', category: 'spell', baseMin: 35, baseMax: 55, image: 'https://tibiara.netlify.app/en/img/runes/energy_strike.gif' },
  { id: 'firewave', name: 'Fire Wave', words: 'exevo flam hur', type: 'attack', category: 'spell', baseMin: 20, baseMax: 40, image: 'https://tibiara.netlify.app/en/img/runes/fire_wave.gif' },
  { id: 'energybeam', name: 'Energy Beam', words: 'exevo vis lux', type: 'attack', category: 'spell', baseMin: 40, baseMax: 80, image: 'https://tibiara.netlify.app/en/img/runes/energy_beam.gif' },
  { id: 'greatenergybeam', name: 'Great Energy Beam', words: 'exevo gran vis lux', type: 'attack', category: 'spell', baseMin: 40, baseMax: 200, image: 'https://tibiara.netlify.app/en/img/runes/great_energy_beam.gif' },
  { id: 'mort', name: 'Death Wave', words: 'exevo mort hur', type: 'attack', category: 'spell', baseMin: 100, baseMax: 200, image: 'https://tibiara.netlify.app/en/img/runes/energy_wave.gif' },
  { id: 'ue', name: 'Ultimate Explosion', words: 'exevo gran mas vis', type: 'attack', category: 'spell', baseMin: 200, baseMax: 300, image: 'https://tibiara.netlify.app/en/img/runes/ultimate_explosion.gif' },
];

export const calculateSpellDamage = (level: number, magicLevel: number, baseMin: number, baseMax: number) => {
  const formula = (magicLevel * 3 + level * 2) / 100;
  
  const min = Math.max(Math.round(formula * baseMin), baseMin);
  const max = Math.max(Math.round(formula * baseMax), baseMax);
  const avg = Math.round((min + max) / 2);
  
  return { min, max, avg };
};
