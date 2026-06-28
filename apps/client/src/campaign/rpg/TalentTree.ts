/**
 * Talent Tree System for BomberMeme World.
 * 5 branches: Bomber, Warrior, Mage, Shadow, Crafter.
 */

import {
  type Talent,
  type TalentBranch,
  TalentBranch as Branch,
  BRANCH_NAMES,
} from "@bomberpump/shared";

export { type Talent, type TalentBranch, Branch as TalentBranch, BRANCH_NAMES };

/** Maximum total talents that can be allocated */
export const MAX_TALENT_POINTS = 20; // Level 100 gives 20 talent points

/** Check if a talent's prerequisites are met */
export function canLearn(talent: Talent, learnedIds: Set<string>): boolean {
  if (talent.currentRank >= talent.maxRank) return false;
  return talent.requires.every((id) => learnedIds.has(id));
}

/** Get the numeric bonus from a talent's effect at current rank */
export function getTalentBonus(
  talent: Talent,
  statKey: keyof Talent["effect"],
): number {
  const perRank = talent.effect[statKey] ?? 0;
  return perRank * talent.currentRank;
}

// --- Talent Definitions ---

const defineTalent = (
  id: string,
  name: string,
  description: string,
  branch: TalentBranch,
  maxRank: number,
  requires: string[],
  effect: Talent["effect"],
): Talent => ({
  id,
  name,
  description,
  branch,
  maxRank,
  currentRank: 0,
  requires,
  effect,
});

// === BRANCH: BOMBER (bomb radius, types, explosion speed) ===
export const BOMBER_TALENTS: Talent[] = [
  defineTalent(
    "bomb_radius_1",
    "Большой Бум I",
    "+5% к радиусу взрыва бомб за ранг",
    Branch.BOMBER,
    5,
    [],
    { bombRadius: 5 },
  ),
  defineTalent(
    "bomb_radius_2",
    "Большой Бум II",
    "+7% к радиусу взрыва бомб за ранг",
    Branch.BOMBER,
    3,
    ["bomb_radius_1"],
    { bombRadius: 7 },
  ),
  defineTalent(
    "blast_speed",
    "Скоростной Взрыв",
    "Взрыв распространяется на 10% быстрее за ранг",
    Branch.BOMBER,
    5,
    ["bomb_radius_1"],
    {}, // Game-speed handled by combat system
  ),
  defineTalent(
    "chain_reaction",
    "Цепная Реакция",
    "При уничтожении блока 5% шанс вызвать доп. взрыв",
    Branch.BOMBER,
    3,
    ["bomb_radius_2"],
    {},
  ),
  defineTalent(
    "dual_bomb",
    "Двойная Закладка",
    "+1 к макс. количеству бомб за ранг",
    Branch.BOMBER,
    3,
    ["blast_speed"],
    {},
  ),
  defineTalent(
    "bomb_mastery",
    "Мастер Бомб",
    "Все бомбы наносят +10% урона за ранг",
    Branch.BOMBER,
    3,
    ["chain_reaction", "dual_bomb"],
    { str: 2 },
  ),
];

// === BRANCH: WARRIOR (HP, armor, regen) ===
export const WARRIOR_TALENTS: Talent[] = [
  defineTalent(
    "vit_boost_1",
    "Стойкость I",
    "+3 к живучести за ранг",
    Branch.WARRIOR,
    5,
    [],
    { vit: 3 },
  ),
  defineTalent(
    "armor_plating",
    "Бронирование",
    "+5% сопротивления урону за ранг",
    Branch.WARRIOR,
    5,
    ["vit_boost_1"],
    { armor: 5 },
  ),
  defineTalent(
    "hp_regen",
    "Регенерация",
    "+0.5 HP/сек за ранг",
    Branch.WARRIOR,
    5,
    ["vit_boost_1"],
    { hpRegen: 0.5 },
  ),
  defineTalent(
    "second_wind",
    "Второе Дыхание",
    "При HP < 25%: +20% к уклонению",
    Branch.WARRIOR,
    1,
    ["armor_plating", "hp_regen"],
    {},
  ),
  defineTalent(
    "vit_boost_2",
    "Стойкость II",
    "+5 к живучести за ранг",
    Branch.WARRIOR,
    3,
    ["armor_plating"],
    { vit: 5 },
  ),
  defineTalent(
    "warrior_mastery",
    "Титан",
    "+10% к макс. HP за ранг",
    Branch.WARRIOR,
    3,
    ["second_wind", "vit_boost_2"],
    { vit: 3 },
  ),
];

// === BRANCH: MAGE (mana, cooldowns, magic damage) ===
export const MAGE_TALENTS: Talent[] = [
  defineTalent(
    "int_boost_1",
    "Разум I",
    "+3 к интеллекту за ранг",
    Branch.MAGE,
    5,
    [],
    { int: 3 },
  ),
  defineTalent(
    "mana_pool",
    "Мана-Бассейн",
    "+10% к макс. маны за ранг",
    Branch.MAGE,
    5,
    ["int_boost_1"],
    { int: 1 },
  ),
  defineTalent(
    "cooldown_red",
    "Быстрая Магия",
    "-3% ко всем кулдаунам за ранг",
    Branch.MAGE,
    5,
    ["int_boost_1"],
    { cooldownReduction: 3 },
  ),
  defineTalent(
    "magic_dmg",
    "Магический Урон",
    "+5% к маг. урону бомб за ранг",
    Branch.MAGE,
    5,
    ["mana_pool"],
    { int: 2 },
  ),
  defineTalent(
    "int_boost_2",
    "Разум II",
    "+5 к интеллекту за ранг",
    Branch.MAGE,
    3,
    ["cooldown_red"],
    { int: 5 },
  ),
  defineTalent(
    "mage_mastery",
    "Архимаг",
    "Скиллы не требуют маны (пассивно)",
    Branch.MAGE,
    1,
    ["magic_dmg", "int_boost_2"],
    { int: 5 },
  ),
];

// === BRANCH: SHADOW (speed, crit, dodge) ===
export const SHADOW_TALENTS: Talent[] = [
  defineTalent(
    "dex_boost_1",
    "Ловкость I",
    "+3 к ловкости за ранг",
    Branch.SHADOW,
    5,
    [],
    { dex: 3 },
  ),
  defineTalent(
    "crit_strike",
    "Критический Удар",
    "+2% к шансу крита за ранг",
    Branch.SHADOW,
    5,
    ["dex_boost_1"],
    { luck: 1 },
  ),
  defineTalent(
    "shadow_dodge",
    "Теневое Уклонение",
    "+3% к уклонению за ранг",
    Branch.SHADOW,
    5,
    ["dex_boost_1"],
    { dex: 1 },
  ),
  defineTalent(
    "swift_move",
    "Стремительность",
    "+4% к скорости передвижения за ранг",
    Branch.SHADOW,
    5,
    ["crit_strike"],
    { dex: 2 },
  ),
  defineTalent(
    "dex_boost_2",
    "Ловкость II",
    "+5 к ловкости за ранг",
    Branch.SHADOW,
    3,
    ["shadow_dodge"],
    { dex: 5 },
  ),
  defineTalent(
    "shadow_mastery",
    "Призрак",
    "После уклонения: +50% скорости на 2 сек",
    Branch.SHADOW,
    1,
    ["swift_move", "dex_boost_2"],
    { dex: 3 },
  ),
];

// === BRANCH: CRAFTER (crafting efficiency, slots) ===
export const CRAFTER_TALENTS: Talent[] = [
  defineTalent(
    "luck_boost_1",
    "Удача I",
    "+3 к удаче за ранг",
    Branch.CRAFTER,
    5,
    [],
    { luck: 3 },
  ),
  defineTalent(
    "craft_eff",
    "Эффективность Крафта",
    "-5% к стоимости крафта за ранг",
    Branch.CRAFTER,
    5,
    ["luck_boost_1"],
    { craftSlots: 1 },
  ),
  defineTalent(
    "inventory_slot",
    "Доп. Слоты",
    "+2 слота инвентаря за ранг",
    Branch.CRAFTER,
    3,
    ["luck_boost_1"],
    { craftSlots: 2 },
  ),
  defineTalent(
    "better_drops",
    "Удачливый Дроп",
    "+3% к качеству дропа за ранг",
    Branch.CRAFTER,
    5,
    ["craft_eff"],
    { luck: 2 },
  ),
  defineTalent(
    "luck_boost_2",
    "Удача II",
    "+5 к удаче за ранг",
    Branch.CRAFTER,
    3,
    ["inventory_slot"],
    { luck: 5 },
  ),
  defineTalent(
    "crafter_mastery",
    "Мастер Крафта",
    "10% шанс создать двойной предмет",
    Branch.CRAFTER,
    1,
    ["better_drops", "luck_boost_2"],
    { luck: 5 },
  ),
];

/** All talents grouped by branch */
export const ALL_TALENTS: Record<TalentBranch, Talent[]> = {
  [Branch.BOMBER]: BOMBER_TALENTS,
  [Branch.WARRIOR]: WARRIOR_TALENTS,
  [Branch.MAGE]: MAGE_TALENTS,
  [Branch.SHADOW]: SHADOW_TALENTS,
  [Branch.CRAFTER]: CRAFTER_TALENTS,
};

/** Flattened list of all talent definitions (rank 0) */
export function getAllTalentDefinitions(): Talent[] {
  return Object.values(ALL_TALENTS).flat();
}

/** Create a fresh talent map for a new hero */
export function createTalentMap(): Map<string, Talent> {
  const map = new Map<string, Talent>();
  for (const t of getAllTalentDefinitions()) {
    map.set(t.id, { ...t, currentRank: 0 });
  }
  return map;
}

/** Learn (increase rank of) a talent. Returns success/failure */
export function learnTalent(
  talents: Map<string, Talent>,
  talentId: string,
  learnedIds: Set<string>,
): boolean {
  const talent = talents.get(talentId);
  if (!talent) return false;
  if (!canLearn(talent, learnedIds)) return false;

  talent.currentRank++;
  if (talent.currentRank >= talent.maxRank) {
    learnedIds.add(talentId);
  }
  return true;
}

/** Get total spent talent points */
export function getSpentTalentPoints(talents: Map<string, Talent>): number {
  let total = 0;
  for (const t of talents.values()) {
    total += t.currentRank;
  }
  return total;
}

/** Get available (unlocked but not maxed) talents */
export function getAvailableTalents(
  talents: Map<string, Talent>,
  learnedIds: Set<string>,
): Talent[] {
  return Array.from(talents.values()).filter((t) => canLearn(t, learnedIds));
}
