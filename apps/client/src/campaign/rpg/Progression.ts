export interface LevelConfig {
  level: number;
  xpRequired: number;
  attributePoints: number;
}

export const XP_PER_LEVEL = 200;

export function xpForLevel(level: number): number {
  return level * XP_PER_LEVEL;
}

export function levelFromXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpInCurrentLevel(xp: number): number {
  const lvl = levelFromXp(xp);
  return xp - (lvl - 1) * XP_PER_LEVEL;
}
