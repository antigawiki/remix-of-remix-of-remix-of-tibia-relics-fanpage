// Interface para monstros de referência
export interface MonsterData {
  id: string;
  name: string;
  experience: number;
}

// Lista de monstros de referência para calcular kills necessárias
export const referenceMonsters: MonsterData[] = [
  { id: 'ghoul', name: 'Ghoul', experience: 85 },
  { id: 'cyclops', name: 'Cyclops', experience: 150 },
  { id: 'bonebeast', name: 'Bonebeast', experience: 580 },
  { id: 'dragon', name: 'Dragon', experience: 700 },
  { id: 'dragonlord', name: 'Dragon Lord', experience: 2100 },
];

// Fórmula oficial do Tibia para XP necessária para atingir um level
// Formula: ((50 * (level - 1)³ - 150 * (level - 1)² + 400 * (level - 1)) / 3)
export const calculateExperienceForLevel = (level: number): number => {
  if (level < 1) return 0;
  const n = level - 1;
  return Math.floor((50 * n * n * n - 150 * n * n + 400 * n) / 3);
};

// Calcular level baseado em XP (busca o level correspondente)
export const getLevelFromExperience = (exp: number): number => {
  if (exp < 0) return 1;
  let level = 1;
  while (calculateExperienceForLevel(level + 1) <= exp) {
    level++;
  }
  return level;
};

// Calcular progresso dentro do level atual (0-100%)
export const getLevelProgress = (exp: number): number => {
  const currentLevel = getLevelFromExperience(exp);
  const currentLevelExp = calculateExperienceForLevel(currentLevel);
  const nextLevelExp = calculateExperienceForLevel(currentLevel + 1);
  const range = nextLevelExp - currentLevelExp;
  if (range <= 0) return 100;
  return ((exp - currentLevelExp) / range) * 100;
};

// Resultado do cálculo de diferença de XP
export interface ExperienceDifferenceResult {
  neededExp: number;
  targetExp: number;
  currentLevel: number;
  monstersNeeded: { monster: MonsterData; count: number }[];
  alreadyReached: boolean;
}

// Calcular diferença de XP e monstros necessários
export const calculateExperienceDifference = (
  currentExp: number,
  targetLevel: number
): ExperienceDifferenceResult => {
  const targetExp = calculateExperienceForLevel(targetLevel);
  const currentLevel = getLevelFromExperience(currentExp);
  const neededExp = targetExp - currentExp;
  const alreadyReached = neededExp <= 0;

  const monstersNeeded = referenceMonsters.map(monster => ({
    monster,
    count: alreadyReached ? 0 : Math.ceil(neededExp / monster.experience)
  }));

  return { neededExp, targetExp, currentLevel, monstersNeeded, alreadyReached };
};
