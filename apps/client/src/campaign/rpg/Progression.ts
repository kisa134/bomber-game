/**
 * Progression System for BomberMeme World.
 * XP table, level conversion, and point awards.
 */

import {
  MAX_LEVEL,
  XP_TABLE,
  getXpForLevel,
  getLevelFromXp,
  getAttributePointsForLevel,
  getTalentPointsForLevel,
} from "@bomberpump/shared";

export {
  MAX_LEVEL,
  XP_TABLE,
  getXpForLevel,
  getLevelFromXp,
  getAttributePointsForLevel,
  getTalentPointsForLevel,
};

/** Progress towards next level as a 0-1 fraction */
export function getLevelProgress(xp: number): number {
  const currentLevel = getLevelFromXp(xp);
  if (currentLevel >= MAX_LEVEL) return 1;
  const xpForCurrent = getXpForLevel(currentLevel);
  const xpForNext = getXpForLevel(currentLevel + 1);
  const needed = xpForNext - xpForCurrent;
  const earned = xp - xpForCurrent;
  return Math.max(0, Math.min(1, earned / needed));
}

/** XP remaining to reach next level */
export function getXpToNextLevel(xp: number): number {
  const currentLevel = getLevelFromXp(xp);
  if (currentLevel >= MAX_LEVEL) return 0;
  return getXpForLevel(currentLevel + 1) - xp;
}

/** XP awarded for defeating an enemy of a given level */
export function getKillReward(playerLevel: number, enemyLevel: number): number {
  const base = 50;
  const levelDiff = enemyLevel - playerLevel;
  const multiplier = 1 + levelDiff * 0.1;
  return Math.max(5, Math.floor(base * multiplier));
}

/** XP awarded for completing a quest */
export function getQuestReward(
  questLevel: number,
  difficulty: "easy" | "medium" | "hard" = "medium",
): number {
  const multipliers = { easy: 0.5, medium: 1, hard: 2 };
  return Math.floor(questLevel * 30 * multipliers[difficulty]);
}

/** XP awarded for crafting an item */
export function getCraftingReward(itemRarity: number): number {
  return itemRarity * 15;
}

/** Progression state for a hero */
export interface ProgressionState {
  level: number;
  xp: number;
  attributePoints: number;
  talentPoints: number;
  totalXpEarned: number;
}

/** Create a fresh progression state for a new hero */
export function createProgressionState(): ProgressionState {
  return {
    level: 1,
    xp: 0,
    attributePoints: 0,
    talentPoints: 0,
    totalXpEarned: 0,
  };
}

/** Award XP and auto-level up, returning point grants */
export function awardXp(
  state: ProgressionState,
  amount: number,
): {
  newState: ProgressionState;
  levelsGained: number;
  attributePointsGained: number;
  talentPointsGained: number;
} {
  const newState = {
    ...state,
    xp: state.xp + amount,
    totalXpEarned: state.totalXpEarned + amount,
  };
  const newLevel = getLevelFromXp(newState.xp);
  const levelsGained = newLevel - state.level;
  const attributePointsGained =
    getAttributePointsForLevel(newLevel) -
    getAttributePointsForLevel(state.level);
  const talentPointsGained =
    getTalentPointsForLevel(newLevel) -
    getTalentPointsForLevel(state.level);
  newState.level = newLevel;
  newState.attributePoints += attributePointsGained;
  newState.talentPoints += talentPointsGained;
  return { newState, levelsGained, attributePointsGained, talentPointsGained };
}

/** Preview XP table as human-readable entries */
export function getXpTablePreview(): Array<{
  level: number;
  xpRequired: number;
  cumulative: number;
}> {
  const preview: Array<{ level: number; xpRequired: number; cumulative: number }> = [];
  for (let i = 1; i <= Math.min(20, MAX_LEVEL); i++) {
    const prevCumulative = i > 1 ? XP_TABLE[i - 2] : 0;
    preview.push({
      level: i,
      xpRequired: XP_TABLE[i - 1] - prevCumulative,
      cumulative: XP_TABLE[i - 1],
    });
  }
  return preview;
}
