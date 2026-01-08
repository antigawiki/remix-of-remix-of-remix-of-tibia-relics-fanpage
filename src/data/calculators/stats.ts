export interface StatsVocationData {
  id: string;
  name: string;
  multipliers: {
    hp: number;
    mp: number;
    cap: number;
  };
}

export const statsVocations: StatsVocationData[] = [
  { id: 'no-vocation', name: 'No Vocation', multipliers: { hp: 5, mp: 5, cap: 10 } },
  { id: 'knight', name: 'Knight', multipliers: { hp: 15, mp: 5, cap: 25 } },
  { id: 'paladin', name: 'Paladin', multipliers: { hp: 10, mp: 15, cap: 20 } },
  { id: 'sorcerer-druid', name: 'Sorcerer/Druid', multipliers: { hp: 5, mp: 30, cap: 10 } },
];

export interface StatsResult {
  hp: number;
  mp: number;
  cap: number;
  vocationName: string;
  level: number;
}

export function calculateStats(vocation: StatsVocationData, level: number): StatsResult {
  let hp: number;
  let mp: number;
  let cap: number;

  if (level <= 8) {
    // Levels 1-8: everyone has the same base values
    hp = 5 * level + 145;
    mp = 5 * level - 5;
    cap = 10 * level + 390;
  } else {
    // Levels > 8: apply vocation multipliers
    const levelHI = level - 8;
    const baseLevel = 8;

    hp = (vocation.multipliers.hp * levelHI) + (5 * baseLevel) + 145;
    mp = (vocation.multipliers.mp * levelHI) + (5 * baseLevel) - 5;
    cap = (vocation.multipliers.cap * levelHI) + (10 * baseLevel) + 390;
  }

  return {
    hp,
    mp,
    cap,
    vocationName: vocation.name,
    level,
  };
}
