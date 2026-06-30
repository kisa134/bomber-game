/**
 * Attributes & RPG Formulas for BomberMeme World.
 * Maps hero attributes to combat-effective stats.
 *
 * str  - Урон бомб, грузоподъемность
 * dex  - Скорость, скорость каста, уклонение
 * int  - Мана, магический урон, кулдаун-редукция
 * vit  - HP, регенерация, сопротивление урону
 * luck - Крит-шанс, качество дропа, крафт
 */

import {
  type Attributes,
  type AttributeKey,
  type EffectiveStats,
  ATTRIBUTE_NAMES,
  ATTRIBUTE_DESCRIPTIONS,
  getMaxHp,
  getMaxMana,
  getMoveSpeed,
  getBombDamage,
  getCritChance,
  computeEffectiveStats,
} from "@bomberpump/shared";

export {
  type Attributes,
  type AttributeKey,
  type EffectiveStats,
  ATTRIBUTE_NAMES,
  ATTRIBUTE_DESCRIPTIONS,
  getMaxHp,
  getMaxMana,
  getMoveSpeed,
  getBombDamage,
  getCritChance,
  computeEffectiveStats,
};

/** Base attributes for all heroes at level 1 */
export const BASE_ATTRIBUTES: Attributes = {
  str: 5,
  dex: 5,
  int: 5,
  vit: 5,
  luck: 5,
};

/** Cost to allocate one attribute point */
export const ATTRIBUTE_POINT_COST = 1;

/** Minimum value any attribute can have */
export const MIN_ATTRIBUTE = 1;

/** Maximum value any attribute can have (soft cap) */
export const MAX_ATTRIBUTE = 100;

/**
 * Helper to allocate attribute points.
 * Returns the new attributes and remaining points.
 */
export function allocateAttribute(
  attrs: Attributes,
  attr: AttributeKey,
  points: number,
): { newAttrs: Attributes; remaining: number } {
  const newAttrs = { ...attrs };
  const maxAdd = MAX_ATTRIBUTE - newAttrs[attr];
  const toAdd = Math.min(points, maxAdd);
  newAttrs[attr] += toAdd;
  return { newAttrs, remaining: points - toAdd };
}

/** Get dodge chance % based on dexterity (diminishing returns) */
export function getDodgeChance(dex: number): number {
  return Math.min(2 + dex * 0.3, 40);
}

/** Get cooldown reduction % based on intelligence (diminishing returns) */
export function getCooldownReduction(int: number): number {
  return Math.min(int * 0.4, 30);
}

/** Get HP regeneration per second based on vitality */
export function getHpRegen(vit: number): number {
  return 0.5 + vit * 0.1;
}

/** Get carrying capacity (bomb slots) based on strength */
export function getCarryCapacity(str: number): number {
  return 3 + Math.floor(str / 5);
}

/** Extended effective stats with derived values */
export interface ExtendedStats extends EffectiveStats {
  dodgeChance: number;
  cooldownReduction: number;
  hpRegen: number;
  carryCapacity: number;
}

/** Compute all stats including derived ones */
export function computeExtendedStats(
  attrs: Attributes,
  level: number,
): ExtendedStats {
  const base = computeEffectiveStats(attrs, level);
  return {
    ...base,
    dodgeChance: getDodgeChance(attrs.dex),
    cooldownReduction: getCooldownReduction(attrs.int),
    hpRegen: getHpRegen(attrs.vit),
    carryCapacity: getCarryCapacity(attrs.str),
  };
}
