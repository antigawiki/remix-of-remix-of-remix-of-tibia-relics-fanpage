export interface VocationData {
  id: string;
  name: string;
  multiplier: number;
  manaRegenWithPromo: number; // mana per second
  manaRegenWithoutPromo: number;
  spellName: string;
  spellManaCost: number;
  spellImage: string;
}

export const vocations: VocationData[] = [
  {
    id: 'knight',
    name: 'Knight',
    multiplier: 3,
    manaRegenWithPromo: 1 / 12,
    manaRegenWithoutPromo: 1 / 12,
    spellName: 'Light Healing',
    spellManaCost: 25,
    spellImage: 'https://tibiara.netlify.app/en/img/runes/light_healing.gif'
  },
  {
    id: 'paladin',
    name: 'Paladin',
    multiplier: 1.4,
    manaRegenWithPromo: 1 / 6,
    manaRegenWithoutPromo: 1 / 12,
    spellName: 'HMM',
    spellManaCost: 70,
    spellImage: 'https://tibiara.netlify.app/en/img/runes/hmm.gif'
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    multiplier: 1.1,
    manaRegenWithPromo: 1 / 4,
    manaRegenWithoutPromo: 1 / 6,
    spellName: 'SD',
    spellManaCost: 220,
    spellImage: 'https://tibiara.netlify.app/en/img/runes/sd.gif'
  },
  {
    id: 'druid',
    name: 'Druid',
    multiplier: 1.1,
    manaRegenWithPromo: 1 / 4,
    manaRegenWithoutPromo: 1 / 6,
    spellName: 'UH',
    spellManaCost: 100,
    spellImage: 'https://tibiara.netlify.app/en/img/runes/uh.gif'
  }
];

export interface MagicLevelResult {
  manaNeeded: number;
  trainingTime: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
  spellCasts: number;
  fishesNeeded: number;
  manaFluids: number;
  manaFluidsCost: number;
}

// Calcula a mana total acumulada para atingir determinado ML
export function calculateManaForMagicLevel(ml: number, multiplier: number): number {
  return (400 * (Math.pow(multiplier, ml) - 1)) / (multiplier - 1);
}

// Calcula a mana necessária considerando ML atual, porcentagem e ML desejado
export function calculateManaNeeded(
  currentML: number,
  percentageToNext: number,
  desiredML: number,
  multiplier: number
): number {
  const manaAtCurrentML = calculateManaForMagicLevel(currentML, multiplier);
  const manaAtNextML = calculateManaForMagicLevel(currentML + 1, multiplier);
  
  // Mana já gasta no nível atual (baseado na porcentagem)
  const manaSpentInCurrentLevel = (manaAtNextML - manaAtCurrentML) * (1 - percentageToNext / 100);
  const currentMana = manaAtCurrentML + manaSpentInCurrentLevel;
  
  const manaAtDesiredML = calculateManaForMagicLevel(desiredML, multiplier);
  
  return Math.max(0, manaAtDesiredML - currentMana);
}

// Calcula o tempo de treino
export function calculateTrainingTime(
  manaNeeded: number,
  manaRegenPerSecond: number
): MagicLevelResult['trainingTime'] {
  const totalSeconds = manaNeeded / manaRegenPerSecond;
  
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor(((totalSeconds % 86400) % 3600) / 60);
  const seconds = Math.floor(((totalSeconds % 86400) % 3600) % 60);
  
  return { days, hours, minutes, seconds, totalSeconds };
}

// Calcula quantidade de magias que podem ser usadas
export function calculateSpellCasts(manaNeeded: number, spellManaCost: number): number {
  return Math.floor(manaNeeded / spellManaCost);
}

// Calcula peixes necessários (1 peixe = 144 segundos de sustento)
export function calculateFishesNeeded(totalSeconds: number): number {
  return Math.ceil(totalSeconds / 144);
}

// Calcula mana fluids necessárias e custo
export function calculateManaFluids(manaNeeded: number): { quantity: number; cost: number } {
  const quantity = Math.floor(manaNeeded / 50);
  const cost = quantity * 100;
  return { quantity, cost };
}

// Função principal que calcula tudo
export function calculateMagicLevel(
  vocation: VocationData,
  currentML: number,
  percentageToNext: number,
  desiredML: number,
  hasPromotion: boolean
): MagicLevelResult {
  const manaNeeded = calculateManaNeeded(currentML, percentageToNext, desiredML, vocation.multiplier);
  
  const manaRegenPerSecond = hasPromotion 
    ? vocation.manaRegenWithPromo 
    : vocation.manaRegenWithoutPromo;
  
  const trainingTime = calculateTrainingTime(manaNeeded, manaRegenPerSecond);
  const spellCasts = calculateSpellCasts(manaNeeded, vocation.spellManaCost);
  const fishesNeeded = calculateFishesNeeded(trainingTime.totalSeconds);
  const manaFluidsData = calculateManaFluids(manaNeeded);
  
  return {
    manaNeeded,
    trainingTime,
    spellCasts,
    fishesNeeded,
    manaFluids: manaFluidsData.quantity,
    manaFluidsCost: manaFluidsData.cost
  };
}
