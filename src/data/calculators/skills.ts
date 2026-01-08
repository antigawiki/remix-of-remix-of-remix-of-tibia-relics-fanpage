export interface SkillVocationData {
  id: string;
  name: string;
  multipliers: {
    melee: { base: number; exponent: number };
    distance: { base: number; exponent: number };
    shield: { base: number; exponent: number };
  };
}

export const skillVocations: SkillVocationData[] = [
  {
    id: 'knight',
    name: 'Knight',
    multipliers: {
      melee: { base: 120, exponent: 1.1 },
      distance: { base: 120, exponent: 1.2 },
      shield: { base: 120, exponent: 1.1 },
    },
  },
  {
    id: 'paladin',
    name: 'Paladin',
    multipliers: {
      melee: { base: 120, exponent: 1.2 },
      distance: { base: 60, exponent: 1.1 },
      shield: { base: 120, exponent: 1.1 },
    },
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    multipliers: {
      melee: { base: 240, exponent: 1.4 },
      distance: { base: 240, exponent: 1.3 },
      shield: { base: 240, exponent: 1.4 },
    },
  },
  {
    id: 'druid',
    name: 'Druid',
    multipliers: {
      melee: { base: 240, exponent: 1.4 },
      distance: { base: 240, exponent: 1.3 },
      shield: { base: 240, exponent: 1.4 },
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

export function calculateSkillTime(
  currentSkill: number,
  desiredSkill: number,
  base: number,
  exponent: number
): TimeResult {
  let totalSeconds = 0;

  for (let skill = currentSkill; skill < desiredSkill; skill++) {
    totalSeconds += base * Math.pow(exponent, skill - 9);
  }

  return convertSecondsToTime(totalSeconds);
}

export function formatTime(time: TimeResult): string {
  const parts: string[] = [];

  if (time.days > 0) {
    parts.push(`${time.days} dia${time.days > 1 ? 's' : ''}`);
  }
  if (time.hours > 0) {
    parts.push(`${time.hours} hora${time.hours > 1 ? 's' : ''}`);
  }
  if (time.minutes > 0) {
    parts.push(`${time.minutes} minuto${time.minutes > 1 ? 's' : ''}`);
  }
  if (time.seconds > 0 || parts.length === 0) {
    parts.push(`${time.seconds} segundo${time.seconds !== 1 ? 's' : ''}`);
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
    melee?: { current: number; desired: number };
    distance?: { current: number; desired: number };
    shield?: { current: number; desired: number };
  }
): SkillsCalculationResult {
  const results: SkillResult[] = [];

  if (skills.melee) {
    const time = calculateSkillTime(
      skills.melee.current,
      skills.melee.desired,
      vocation.multipliers.melee.base,
      vocation.multipliers.melee.exponent
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
      vocation.multipliers.distance.base,
      vocation.multipliers.distance.exponent
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
      vocation.multipliers.shield.base,
      vocation.multipliers.shield.exponent
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
