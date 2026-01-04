export interface Spell {
  name: string;
  words: string;
  image: string;
  level: number;
  mana: number;
  mlvl?: number;
  price: string;
  isPremium: boolean;
  type?: string;
  cooldown?: number;
  description?: string;
}

export const sorcererSpells: Spell[] = [
  { name: "Find Person", words: 'exiva "name"', image: "https://tibiara.netlify.app/en/img/runes/find_person.gif", level: 8, mana: 20, price: "80 gp", isPremium: false, type: "Support" },
  { name: "Light", words: "utevo lux", image: "https://tibiara.netlify.app/en/img/runes/light.gif", level: 8, mana: 20, price: "100 gp", isPremium: false, type: "Support" },
  { name: "Magic Rope", words: "exani tera", image: "https://tibiara.netlify.app/en/img/runes/magic_rope.gif", level: 9, mana: 20, price: "200 gp", isPremium: true, type: "Support" },
  { name: "Levitate", words: "exani hur", image: "https://tibiara.netlify.app/en/img/runes/levitate.gif", level: 12, mana: 50, price: "500 gp", isPremium: true, type: "Support" },
  { name: "Great Light", words: "utevo gran lux", image: "https://tibiara.netlify.app/en/img/runes/great_light.gif", level: 13, mana: 60, price: "500 gp", isPremium: false, type: "Support" },
  { name: "Haste", words: "utani hur", image: "https://tibiara.netlify.app/en/img/runes/haste.gif", level: 14, mana: 60, price: "600 gp", isPremium: true, type: "Support" },
  { name: "Invisible", words: "utana vid", image: "https://tibiara.netlify.app/en/img/runes/invisible.gif", level: 35, mana: 440, price: "2000 gp", isPremium: false, type: "Support" },
  { name: "Light Healing", words: "exura", image: "https://tibiara.netlify.app/en/img/runes/exura.gif", level: 9, mana: 20, price: "170 gp", isPremium: false, type: "Healing" },
  { name: "Intense Healing", words: "exura gran", image: "https://tibiara.netlify.app/en/img/runes/exura_gran.gif", level: 20, mana: 70, price: "350 gp", isPremium: false, type: "Healing" },
  { name: "Light Magic Missile", words: "adori", image: "https://tibiara.netlify.app/en/img/runes/lmm.gif", level: 15, mana: 40, price: "500 gp", isPremium: false, type: "Attack" },
  { name: "Heavy Magic Missile", words: "adori gran", image: "https://tibiara.netlify.app/en/img/runes/hmm.gif", level: 25, mana: 70, price: "1500 gp", isPremium: false, type: "Attack" },
  { name: "Fireball", words: "adori flam", image: "https://tibiara.netlify.app/en/img/runes/fireball.gif", level: 27, mana: 80, price: "1600 gp", isPremium: false, type: "Attack" },
  { name: "Great Fireball", words: "adori mas flam", image: "https://tibiara.netlify.app/en/img/runes/gfb.gif", level: 30, mana: 120, price: "1800 gp", isPremium: false, type: "Attack" },
  { name: "Explosion", words: "adevo mas hur", image: "https://tibiara.netlify.app/en/img/runes/explosion.gif", level: 31, mana: 170, price: "1800 gp", isPremium: false, type: "Attack" },
  { name: "Sudden Death", words: "adori gran mort", image: "https://tibiara.netlify.app/en/img/runes/sd.gif", level: 45, mana: 200, price: "3000 gp", isPremium: false, type: "Attack" },
  { name: "Ultimate Explosion", words: "adevo mas hur", image: "https://tibiara.netlify.app/en/img/runes/ue.gif", level: 60, mana: 300, price: "4000 gp", isPremium: true, type: "Attack" },
  { name: "Fire Wave", words: "exevo flam hur", image: "https://tibiara.netlify.app/en/img/runes/fire_wave.gif", level: 18, mana: 25, price: "850 gp", isPremium: false, type: "Attack" },
  { name: "Energy Beam", words: "exevo vis lux", image: "https://tibiara.netlify.app/en/img/runes/energy_beam.gif", level: 23, mana: 40, price: "1000 gp", isPremium: false, type: "Attack" },
  { name: "Great Energy Beam", words: "exevo gran vis lux", image: "https://tibiara.netlify.app/en/img/runes/great_energy_beam.gif", level: 29, mana: 110, price: "1800 gp", isPremium: false, type: "Attack" },
  { name: "Energy Wave", words: "exevo mort hur", image: "https://tibiara.netlify.app/en/img/runes/energy_wave.gif", level: 38, mana: 170, price: "2500 gp", isPremium: false, type: "Attack" },
  { name: "Summon Creature", words: "utevo res", image: "https://tibiara.netlify.app/en/img/runes/summon_creature.gif", level: 25, mana: 0, price: "2000 gp", isPremium: false, type: "Summon" },
  { name: "Convince Creature", words: "exeta res", image: "https://tibiara.netlify.app/en/img/runes/convince_creature.gif", level: 16, mana: 0, price: "800 gp", isPremium: false, type: "Support" },
  { name: "Creature Illusion", words: "utevo res ina", image: "https://tibiara.netlify.app/en/img/runes/creature_illusion.gif", level: 23, mana: 100, price: "1000 gp", isPremium: false, type: "Support" },
  { name: "Ultimate Light", words: "utevo vis lux", image: "https://tibiara.netlify.app/en/img/runes/ultimate_light.gif", level: 26, mana: 140, price: "1600 gp", isPremium: true, type: "Support" },
  { name: "Destroy Field", words: "adito grav", image: "https://tibiara.netlify.app/en/img/runes/destroy_field.gif", level: 17, mana: 40, price: "700 gp", isPremium: false, type: "Support" },
  { name: "Conjure Bolt", words: "exevo con", image: "https://tibiara.netlify.app/en/img/runes/conjure_bolt.gif", level: 17, mana: 50, price: "750 gp", isPremium: false, type: "Conjure" },
  { name: "Magic Wall", words: "adevo grav", image: "https://tibiara.netlify.app/en/img/runes/magic_wall.gif", level: 32, mana: 100, price: "2000 gp", isPremium: true, type: "Support" },
  { name: "Fire Field", words: "adevo flam", image: "https://tibiara.netlify.app/en/img/runes/fire_field.gif", level: 15, mana: 28, price: "500 gp", isPremium: false, type: "Attack" },
  { name: "Energy Field", words: "adevo vis", image: "https://tibiara.netlify.app/en/img/runes/energy_field.gif", level: 18, mana: 50, price: "700 gp", isPremium: false, type: "Attack" },
  { name: "Poison Field", words: "adevo pox", image: "https://tibiara.netlify.app/en/img/runes/poison_field.gif", level: 14, mana: 28, price: "300 gp", isPremium: false, type: "Attack" },
  { name: "Fire Bomb", words: "adevo mas flam", image: "https://tibiara.netlify.app/en/img/runes/fire_bomb.gif", level: 27, mana: 160, price: "1500 gp", isPremium: false, type: "Attack" },
  { name: "Energy Bomb", words: "adevo mas vis", image: "https://tibiara.netlify.app/en/img/runes/energy_bomb.gif", level: 37, mana: 200, price: "2300 gp", isPremium: true, type: "Attack" },
  { name: "Poison Bomb", words: "adevo mas pox", image: "https://tibiara.netlify.app/en/img/runes/poison_bomb.gif", level: 25, mana: 130, price: "1000 gp", isPremium: false, type: "Attack" },
  { name: "Fire Wall", words: "adevo grav flam", image: "https://tibiara.netlify.app/en/img/runes/fire_wall.gif", level: 33, mana: 120, price: "2000 gp", isPremium: false, type: "Attack" },
  { name: "Energy Wall", words: "adevo grav vis", image: "https://tibiara.netlify.app/en/img/runes/energy_wall.gif", level: 41, mana: 200, price: "2500 gp", isPremium: false, type: "Attack" },
  { name: "Poison Wall", words: "adevo grav pox", image: "https://tibiara.netlify.app/en/img/runes/poison_wall.gif", level: 29, mana: 100, price: "1600 gp", isPremium: false, type: "Attack" },
  { name: "Stalagmite", words: "adori tera", image: "https://tibiara.netlify.app/en/img/runes/stalagmite.gif", level: 24, mana: 70, price: "1400 gp", isPremium: false, type: "Attack" },
  { name: "Icicle", words: "adori frigo", image: "https://tibiara.netlify.app/en/img/runes/icicle.gif", level: 28, mana: 85, price: "1700 gp", isPremium: true, type: "Attack" },
  { name: "Thunderstorm", words: "adori gran vis", image: "https://tibiara.netlify.app/en/img/runes/thunderstorm.gif", level: 28, mana: 85, price: "1700 gp", isPremium: false, type: "Attack" },
  { name: "Stone Shower", words: "adori mas tera", image: "https://tibiara.netlify.app/en/img/runes/stone_shower.gif", level: 28, mana: 90, price: "1800 gp", isPremium: false, type: "Attack" },
  { name: "Avalanche", words: "adori mas frigo", image: "https://tibiara.netlify.app/en/img/runes/avalanche.gif", level: 30, mana: 100, price: "1900 gp", isPremium: true, type: "Attack" },
  { name: "Hell's Core", words: "exevo gran mas flam", image: "https://tibiara.netlify.app/en/img/runes/hells_core.gif", level: 60, mana: 300, price: "4000 gp", isPremium: true, type: "Attack" },
  { name: "Rage of the Skies", words: "exevo gran mas vis", image: "https://tibiara.netlify.app/en/img/runes/rage_of_the_skies.gif", level: 55, mana: 280, price: "3500 gp", isPremium: true, type: "Attack" },
  { name: "Energy Strike", words: "exori vis", image: "https://tibiara.netlify.app/en/img/runes/energy_strike.gif", level: 12, mana: 20, price: "800 gp", isPremium: false, type: "Attack" },
  { name: "Flame Strike", words: "exori flam", image: "https://tibiara.netlify.app/en/img/runes/flame_strike.gif", level: 14, mana: 20, price: "800 gp", isPremium: false, type: "Attack" },
];
