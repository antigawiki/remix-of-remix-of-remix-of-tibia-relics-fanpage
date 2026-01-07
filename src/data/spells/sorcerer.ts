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
  { name: "Light Healing", words: "exura", image: "https://tibiara.netlify.app/en/img/runes/exura.gif", level: 9, mana: 20, price: "170 gp", isPremium: false, type: "Healing" },
  { name: "Light Magic Missile", words: "adori min vis", image: "https://tibiara.netlify.app/en/img/runes/lmm.gif", level: 15, mana: 120, price: "500 gp", isPremium: false, type: "Attack" },
  { name: "Magic Rope", words: "exani tera", image: "https://tibiara.netlify.app/en/img/runes/magic_rope.gif", level: 9, mana: 20, price: "200 gp", isPremium: true, type: "Support" },
  { name: "Antidote", words: "exana pox", image: "https://tibiara.netlify.app/en/img/runes/antidote.gif", level: 10, mana: 30, price: "150 gp", isPremium: false, type: "Healing" },
  { name: "Force Strike", words: "exori mort", image: "https://tibiara.netlify.app/en/img/runes/force_strike.gif", level: 12, mana: 20, price: "400 gp", isPremium: true, type: "Attack" },
  { name: "Intense Healing", words: "exura gran", image: "https://tibiara.netlify.app/en/monsters/img/spells.gif", level: 20, mana: 70, price: "350 gp", isPremium: false, type: "Healing" },
  { name: "Poison Field", words: "adevo grav pox", image: "https://tibiara.netlify.app/en/img/runes/poison_field.gif", level: 14, mana: 200, price: "300 gp", isPremium: false, type: "Attack" },
  { name: "Energy Strike", words: "exori vis", image: "https://tibiara.netlify.app/en/img/runes/energy_strike.gif", level: 12, mana: 20, price: "400 gp", isPremium: true, type: "Attack" },
  { name: "Fire Field", words: "adevo grav flam", image: "https://tibiara.netlify.app/en/img/runes/fire_field.gif", level: 15, mana: 240, price: "500 gp", isPremium: false, type: "Attack" },
  { name: "Flame Strike", words: "exori flam", image: "https://tibiara.netlify.app/en/img/runes/flame_strike.gif", level: 12, mana: 20, price: "400 gp", isPremium: true, type: "Attack" },
  { name: "Great Light", words: "utevo gran lux", image: "https://tibiara.netlify.app/en/img/runes/great_light.gif", level: 13, mana: 60, price: "500 gp", isPremium: false, type: "Support" },
  { name: "Heavy Magic Missile", words: "adori vis", image: "https://tibiara.netlify.app/en/img/runes/hmm.gif", level: 25, mana: 350, price: "1500 gp", isPremium: false, type: "Attack" },
  { name: "Levitate", words: "exani hur", image: "https://tibiara.netlify.app/en/img/runes/levitate.gif", level: 12, mana: 50, price: "500 gp", isPremium: true, type: "Support" },
  { name: "Haste", words: "utani hur", image: "https://tibiara.netlify.app/en/img/runes/haste.gif", level: 14, mana: 60, price: "600 gp", isPremium: true, type: "Support" },
  { name: "Magic Shield", words: "utamo vita", image: "https://tibiara.netlify.app/en/img/runes/magic_shield.gif", level: 14, mana: 50, price: "450 gp", isPremium: false, type: "Support" },
  { name: "Energy Field", words: "adevo grav vis", image: "https://tibiara.netlify.app/en/img/runes/energy_field.gif", level: 18, mana: 320, price: "700 gp", isPremium: false, type: "Attack" },
  { name: "Fireball", words: "adori flam", image: "https://tibiara.netlify.app/en/img/runes/fireball.gif", level: 27, mana: 460, price: "1600 gp", isPremium: false, type: "Attack" },
  { name: "Destroy Field", words: "adito grav", image: "https://tibiara.netlify.app/en/img/runes/destroy_field.gif", level: 17, mana: 40, price: "700 gp", isPremium: false, type: "Support" },
  { name: "Animate Dead", words: "adana mort", image: "https://tibiara.netlify.app/en/img/runes/animate_dead.gif", level: 27, mana: 600, price: "1200 gp", isPremium: true, type: "Summon" },
  { name: "Fire Wave", words: "exevo flam hur", image: "https://tibiara.netlify.app/en/img/runes/fire_wave.gif", level: 18, mana: 25, price: "850 gp", isPremium: true, type: "Attack" },
  { name: "Desintegrate", words: "adito tera", image: "https://tibiara.netlify.app/en/img/runes/desintegrate.gif", level: 21, mana: 200, price: "900 gp", isPremium: true, type: "Support" },
  { name: "Strong Haste", words: "utani gran hur", image: "https://tibiara.netlify.app/en/img/runes/strong_haste.gif", level: 20, mana: 100, price: "1300 gp", isPremium: true, type: "Support" },
  { name: "Ultimate Healing", words: "exura vita", image: "https://tibiara.netlify.app/en/monsters/img/spells.gif", level: 30, mana: 160, price: "1000 gp", isPremium: false, type: "Healing" },
  { name: "Firebomb", words: "adevo mas flam", image: "https://tibiara.netlify.app/en/img/runes/fbo.gif", level: 27, mana: 600, price: "1500 gp", isPremium: false, type: "Attack" },
  { name: "Great Fireball", words: "adori mas flam", image: "https://tibiara.netlify.app/en/img/runes/great_fireball.gif", level: 30, mana: 530, price: "1800 gp", isPremium: false, type: "Attack" },
  { name: "Creature Illusion", words: "utevo res ina", image: "https://tibiara.netlify.app/en/img/runes/creature_illusion.gif", level: 23, mana: 100, price: "1000 gp", isPremium: true, type: "Support" },
  { name: "Energy Beam", words: "exevo vis lux", image: "https://tibiara.netlify.app/en/img/runes/energy_beam.gif", level: 23, mana: 40, price: "1000 gp", isPremium: true, type: "Attack" },
  { name: "Poison Wall", words: "adevo mas grav pox", image: "https://tibiara.netlify.app/en/img/runes/poison_wall.gif", level: 29, mana: 640, price: "1600 gp", isPremium: true, type: "Attack" },
  { name: "Cancel Invisibility", words: "exana vis", image: "https://tibiara.netlify.app/en/img/runes/cancel_invisibility.gif", level: 26, mana: 200, price: "1600 gp", isPremium: true, type: "Support" },
  { name: "Explosion", words: "adevo mas hur", image: "https://tibiara.netlify.app/en/img/runes/explosion.gif", level: 31, mana: 570, price: "1800 gp", isPremium: true, type: "Attack" },
  { name: "Ultimate Light", words: "utevo vis lux", image: "https://tibiara.netlify.app/en/img/runes/ultimate_light.gif", level: 26, mana: 140, price: "1600 gp", isPremium: true, type: "Support" },
  { name: "Fire Wall", words: "adevo mas grav flam", image: "https://tibiara.netlify.app/en/img/runes/fire_wall.gif", level: 33, mana: 780, price: "2000 gp", isPremium: false, type: "Attack" },
  { name: "Soulfire", words: "adevo res flam", image: "https://tibiara.netlify.app/en/img/runes/soulfire.gif", level: 27, mana: 420, price: "1800 gp", isPremium: true, type: "Attack" },
  { name: "Great Energy Beam", words: "exevo gran vis lux", image: "https://tibiara.netlify.app/en/img/runes/great_energy_beam.gif", level: 29, mana: 110, price: "1800 gp", isPremium: true, type: "Attack" },
  { name: "Magic Wall", words: "adevo grav tera", image: "https://tibiara.netlify.app/en/img/runes/magic_wall.gif", level: 32, mana: 750, price: "2100 gp", isPremium: true, type: "Support" },
  { name: "Invisible", words: "utana vid", image: "https://tibiara.netlify.app/en/img/runes/invisibility.gif", level: 35, mana: 440, price: "2000 gp", isPremium: true, type: "Support" },
  { name: "Summon Creature", words: 'utevo res "name"', image: "https://tibiara.netlify.app/en/monsters/img/spells.gif", level: 25, mana: 0, price: "2000 gp", isPremium: false, type: "Summon" },
  { name: "Energy Wall", words: "adevo mas grav vis", image: "https://tibiara.netlify.app/en/img/runes/energy_wall.gif", level: 41, mana: 1000, price: "2500 gp", isPremium: true, type: "Attack" },
  { name: "Energybomb", words: "adevo mas vis", image: "https://tibiara.netlify.app/en/img/runes/eb.gif", level: 37, mana: 880, price: "2300 gp", isPremium: true, type: "Attack" },
  { name: "Energy Wave", words: "exevo vis hur", image: "https://tibiara.netlify.app/en/img/runes/energy_wave.gif", level: 38, mana: 170, price: "2500 gp", isPremium: true, type: "Attack" },
  { name: "Enchant Staff", words: "exeta vis", image: "https://tibiara.netlify.app/en/img/runes/enchant_staff.gif", level: 41, mana: 80, price: "2000 gp", isPremium: false, type: "Support" },
  { name: "Sudden Death", words: "adori gran mort", image: "https://tibiara.netlify.app/en/img/runes/sudden_death.gif", level: 45, mana: 985, price: "3000 gp", isPremium: true, type: "Attack" },
  { name: "Ultimate Explosion", words: "exevo gran mas vis", image: "https://tibiara.netlify.app/en/img/runes/ultimate_explosion.gif", level: 60, mana: 250, price: "4000 gp", isPremium: true, type: "Attack" },
];
