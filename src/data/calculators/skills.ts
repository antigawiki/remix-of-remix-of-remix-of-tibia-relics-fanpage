export const SKILL_CONSTANTS = {
  melee: 50,
  distance: 30,
  shield: 100,
} as const;

export interface SkillVocationData {
  id: string;
  name: string;
  multipliers: {
    melee: number;
    distance: number;
    shield: number;
  };
}

export const skillVocations: SkillVocationData[] = [
  {
    id: 'knight',
    name: 'Knight',
    multipliers: {
      melee: 1.1,
      distance: 1.4,
      shield: 1.1,
    },
  },
  {
    id: 'paladin',
    name: 'Paladin',
    multipliers: {
      melee: 1.2,
      distance: 1.1,
      shield: 1.1,
    },
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    multipliers: {
      melee: 2.0,
      distance: 2.0,
      shield: 1.5,
    },
  },
  {
    id: 'druid',
    name: 'Druid',
    multipliers: {
      melee: 1.8,
      distance: 1.8,
      shield: 1.5,
    },
  },
];

export interface TimeResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export interface SkillResult {
  skillType: 'melee' | 'distance' | 'shield';
  currentSkill: number;
  desiredSkill: number;
  time: TimeResult;
}

export interface SkillsCalculationResult {
  vocation: SkillVocationData;
  results: SkillResult[];
}

export function convertSecondsToTime(totalSeconds: number): TimeResult {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return { days, hours, minutes, seconds, totalSeconds };
}

/**
 * Tibia 7.4 skill formula:
 * tries_to_advance(skill) = 50 * multiplier^(skill - 10)
 * Each try = 2 seconds (1 combat round)
 *
 * With percentage support:
 * - First level: tries * (1 - percentage/100)
 * - Remaining levels: full tries
 */
export function calculateSkillTime(
  currentSkill: number,
  desiredSkill: number,
  multiplier: number,
  skillConstant: number,
  percentage: number = 0
): TimeResult {
  let totalTries = 0;

  // First level: percentage means "% remaining to next skill"
  const triesFirstLevel = skillConstant * Math.pow(multiplier, currentSkill - 10);
  totalTries += triesFirstLevel * (percentage / 100);

  // Remaining full levels
  for (let skill = currentSkill + 1; skill < desiredSkill; skill++) {
    totalTries += skillConstant * Math.pow(multiplier, skill - 10);
  }

  const totalSeconds = totalTries * 2;
  return convertSecondsToTime(totalSeconds);
}

export function formatTime(time: TimeResult, translations?: { days: string; hours: string; minutes: string; seconds: string }): string {
  const labels = translations || { days: 'dia(s)', hours: 'hora(s)', minutes: 'minuto(s)', seconds: 'segundo(s)' };
  const parts: string[] = [];

  if (time.days > 0) {
    parts.push(`${time.days} ${labels.days}`);
  }
  if (time.hours > 0) {
    parts.push(`${time.hours} ${labels.hours}`);
  }
  if (time.minutes > 0) {
    parts.push(`${time.minutes} ${labels.minutes}`);
  }
  if (time.seconds > 0 || parts.length === 0) {
    parts.push(`${time.seconds} ${labels.seconds}`);
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const lastPart = parts.pop();
  return `${parts.join(', ')} e ${lastPart}`;
}

export function calculateSkills(
  vocation: SkillVocationData,
  skills: {
    melee?: { current: number; desired: number; percentage?: number };
    distance?: { current: number; desired: number; percentage?: number };
    shield?: { current: number; desired: number; percentage?: number };
  }
): SkillsCalculationResult {
  const results: SkillResult[] = [];

  if (skills.melee) {
    const time = calculateSkillTime(
      skills.melee.current,
      skills.melee.desired,
      vocation.multipliers.melee,
      SKILL_CONSTANTS.melee,
      skills.melee.percentage || 0
    );
    results.push({
      skillType: 'melee',
      currentSkill: skills.melee.current,
      desiredSkill: skills.melee.desired,
      time,
    });
  }

  if (skills.distance) {
    const time = calculateSkillTime(
      skills.distance.current,
      skills.distance.desired,
      vocation.multipliers.distance,
      SKILL_CONSTANTS.distance,
      skills.distance.percentage || 0
    );
    results.push({
      skillType: 'distance',
      currentSkill: skills.distance.current,
      desiredSkill: skills.distance.desired,
      time,
    });
  }

  if (skills.shield) {
    const time = calculateSkillTime(
      skills.shield.current,
      skills.shield.desired,
      vocation.multipliers.shield,
      SKILL_CONSTANTS.shield,
      skills.shield.percentage || 0
    );
    results.push({
      skillType: 'shield',
      currentSkill: skills.shield.current,
      desiredSkill: skills.shield.desired,
      time,
    });
  }

  return { vocation, results };
}
