/**
 * RPG types for BomberMeme World - shared between client and server.
 * Issue #3: Character RPG System
 */

// --- Factions ---

export enum Faction {
  NEON_CARTEL = 'neon_cartel',
  CHAPPIE_CULT = 'chappie_cult',
  WILD_CIRCLE = 'wild_circle',
  GRATE_CLAN = 'grate_clan',
  INDUSTRIAL_GUILD = 'industrial_guild',
  SANDS_ETERNAL = 'sands_eternal',
  VOID_LEGION = 'void_legion',
}

export const FACTION_NAMES: Record<Faction, string> = {
  [Faction.NEON_CARTEL]: 'Неоновый Картель',
  [Faction.CHAPPIE_CULT]: 'Культ Чаппи',
  [Faction.WILD_CIRCLE]: 'Зеленый Круг',
  [Faction.GRATE_CLAN]: 'Клан Решетки',
  [Faction.INDUSTRIAL_GUILD]: 'Индустриальная Гильдия',
  [Faction.SANDS_ETERNAL]: 'Пески Вечности',
  [Faction.VOID_LEGION]: 'Легион Пустоты',
};

// --- Attributes ---

export interface Attributes {
  str: number;
  dex: number;
  int: number;
  vit: number;
  luck: number;
}

export type AttributeKey = keyof Attributes;

export const ATTRIBUTE_NAMES: Record<AttributeKey, string> = {
  str: 'Сила',
  dex: 'Ловкость',
  int: 'Интеллект',
  vit: 'Живучесть',
  luck: 'Удача',
};

export const ATTRIBUTE_DESCRIPTIONS: Record<AttributeKey, string> = {
  str: 'Урон бомб и грузоподъемность',
  dex: 'Скорость передвижения и уклонение',
  int: 'Мана, магический урон и кулдаун-редукция',
  vit: 'Максимум HP и регенерация',
  luck: 'Шанс крита и качество дропа',
};

/** Soft cap any single attribute can reach. */
export const MAX_ATTRIBUTE = 100;

/**
 * Allocate attribute points onto a single attribute, respecting the soft cap.
 * Returns a new attributes object plus the number of points left over.
 */
export const allocateAttribute = (
  attrs: Attributes,
  attr: AttributeKey,
  points: number,
): { newAttrs: Attributes; remaining: number } => {
  const newAttrs = { ...attrs };
  const maxAdd = MAX_ATTRIBUTE - newAttrs[attr];
  const toAdd = Math.max(0, Math.min(points, maxAdd));
  newAttrs[attr] += toAdd;
  return { newAttrs, remaining: points - toAdd };
};

// --- RPG Formulas ---

export const getMaxHp = (vit: number, level: number): number =>
  100 + vit * 10 + level * 5;

export const getMaxMana = (int: number, level: number): number =>
  50 + int * 8 + level * 3;

export const getMoveSpeed = (dex: number): number => 200 + dex * 5;

export const getBombDamage = (str: number, int: number): number =>
  20 + str * 2 + int;

export const getCritChance = (luck: number): number =>
  Math.min(5 + luck * 0.5, 50);

export interface EffectiveStats {
  damage: number;
  speed: number;
  maxHp: number;
  maxMana: number;
  critChance: number;
}

export const computeEffectiveStats = (
  attrs: Attributes,
  level: number,
): EffectiveStats => ({
  damage: getBombDamage(attrs.str, attrs.int),
  speed: getMoveSpeed(attrs.dex),
  maxHp: getMaxHp(attrs.vit, level),
  maxMana: getMaxMana(attrs.int, level),
  critChance: getCritChance(attrs.luck),
});

// --- Progression ---

export const MAX_LEVEL = 100;

export const XP_TABLE: readonly number[] = (() => {
  const table: number[] = [];
  let cumulative = 0;
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const required = Math.floor(100 * Math.pow(level, 1.8));
    cumulative += required;
    table[level - 1] = cumulative;
  }
  return table;
})();

export const getXpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return XP_TABLE[MAX_LEVEL - 1];
  return XP_TABLE[level - 2];
};

export const getLevelFromXp = (xp: number): number => {
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp < XP_TABLE[i]) return i + 1;
  }
  return MAX_LEVEL;
};

export const getAttributePointsForLevel = (level: number): number =>
  Math.max(0, level - 1);

export const getTalentPointsForLevel = (level: number): number =>
  Math.floor(level / 5);

// --- Talents ---

export enum TalentBranch {
  BOMBER = 'bomber',
  WARRIOR = 'warrior',
  MAGE = 'mage',
  SHADOW = 'shadow',
  CRAFTER = 'crafter',
}

export const BRANCH_NAMES: Record<TalentBranch, string> = {
  [TalentBranch.BOMBER]: 'Подрывник',
  [TalentBranch.WARRIOR]: 'Воин',
  [TalentBranch.MAGE]: 'Маг',
  [TalentBranch.SHADOW]: 'Тень',
  [TalentBranch.CRAFTER]: 'Крафтер',
};

export interface Talent {
  id: string;
  name: string;
  description: string;
  branch: TalentBranch;
  maxRank: number;
  currentRank: number;
  requires: string[];
  effect: Partial<
    Record<
      | 'str'
      | 'dex'
      | 'int'
      | 'vit'
      | 'luck'
      | 'bombRadius'
      | 'cooldownReduction'
      | 'armor'
      | 'hpRegen'
      | 'craftSlots',
      number
    >
  >;
}

// --- Inventory ---

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'material' | 'bomb';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#9e9e9e',
  uncommon: '#4caf50',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ff9800',
};

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  stackable: boolean;
  maxStack: number;
  quantity: number;
  description: string;
  stats?: Partial<Attributes>;
  icon?: string;
}

// --- Bomb Types ---

export enum BombType {
  STANDARD = 'standard',
  REMOTE = 'remote',
  MINE = 'mine',
  SPIKE = 'spike',
  CLUSTER = 'cluster',
  NAPALM = 'napalm',
  ICE = 'ice',
  VOID = 'void',
  GOLDEN = 'golden',
}

export const BOMB_TYPE_NAMES: Record<BombType, string> = {
  [BombType.STANDARD]: 'Стандартная',
  [BombType.REMOTE]: 'Дистанционная',
  [BombType.MINE]: 'Мина',
  [BombType.SPIKE]: 'Шипастая',
  [BombType.CLUSTER]: 'Кластерная',
  [BombType.NAPALM]: 'Напалм',
  [BombType.ICE]: 'Ледяная',
  [BombType.VOID]: 'Пустотная',
  [BombType.GOLDEN]: 'Золотая',
};

// --- Hero ---

export interface HeroSkill {
  id: string;
  name: string;
  description: string;
  cooldownMs: number;
  manaCost: number;
}

export interface HeroDefinition {
  heroId: string;
  skinId: number;
  name: string;
  faction: Faction;
  baseAttributes: Attributes;
  skill: HeroSkill;
  lore: string;
  isStub?: boolean;
}

export interface RPGComponentData {
  level: number;
  xp: number;
  attributes: Attributes;
  attributePoints: number;
  talentPoints: number;
  talents: Map<string, Talent>;
  heroDef: HeroDefinition;
}
