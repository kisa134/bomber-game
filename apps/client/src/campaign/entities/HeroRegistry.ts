/**
 * Hero Registry for BomberMeme World.
 * 100 playable characters across 7 factions.
 *
 * Phase 1 — 3 full characters with unique skills and lore.
 * Phase 1 — 97 stubs (id, skinId, faction, placeholder name).
 *
 * Faction distribution (100 total):
 *   neon_cartel:      14
 *   chappie_cult:     14
 *   wild_circle:      14
 *   grate_clan:       14
 *   industrial_guild: 14
 *   sands_eternal:    14
 *   void_legion:      16
 */

import {
  type HeroDefinition,
  type Attributes,
  type HeroSkill,
  Faction,
} from "@bomberpump/shared";

export { type HeroDefinition, Faction };

// ─── Skill Definitions ───

/** Скилл "Цепная Реакция" — следующая бомба взрывает все бомбы в радиусе 200px */
const SKILL_CHAIN_REACTION: HeroSkill = {
  id: "chain_reaction",
  name: "Цепная Реакция",
  description:
    "Следующая бомба взрывает все бомбы в радиусе 200px",
  cooldownMs: 15000,
  manaCost: 25,
};

/** Скилл "Гнев Природы" — призывает 3 терновых ловушки */
const SKILL_NATURES_WRATH: HeroSkill = {
  id: "natures_wrath",
  name: "Гнев Природы",
  description: "Призывает 3 терновых ловушки вокруг героя",
  cooldownMs: 20000,
  manaCost: 30,
};

/** Скилл "Песчаная Буря" — враги замедлены 50%, вы невидимы 3 сек */
const SKILL_SAND_STORM: HeroSkill = {
  id: "sand_storm",
  name: "Песчаная Буря",
  description:
    "Все враги замедлены на 50%, герой становится невидимым на 3 секунды",
  cooldownMs: 25000,
  manaCost: 35,
};

// ─── 3 Full Characters ───

const HERO_ZERO: HeroDefinition = {
  heroId: "hero_0",
  skinId: 0,
  name: "Зеро",
  faction: Faction.NEON_CARTEL,
  baseAttributes: { str: 8, dex: 10, int: 12, vit: 7, luck: 8 },
  skill: SKILL_CHAIN_REACTION,
  lore: "Бывший корпоративный хакер, внедривший вирус в системы Неонового Картеля. Теперь скрывается в трущобах кибер-города, используя свои знания технологий для создания бомб с цепной реакцией. Ищет redemption, помогая слабым против корпоративного гнета.",
};

const HERO_WILD: HeroDefinition = {
  heroId: "hero_28",
  skinId: 28,
  name: "Вайлд",
  faction: Faction.WILD_CIRCLE,
  baseAttributes: { str: 10, dex: 8, int: 10, vit: 10, luck: 7 },
  skill: SKILL_NATURES_WRATH,
  lore: "Последний хранитель Зеленого Круга — древнего ордена друидов, защищающих природу в мире разрушенном технологиями. Вайлд может призывать терновые ловушки из самой земли, используя остатки живой энергии планеты.",
};

const HERO_SCORP: HeroDefinition = {
  heroId: "hero_70",
  skinId: 70,
  name: "Скорп",
  faction: Faction.SANDS_ETERNAL,
  baseAttributes: { str: 9, dex: 14, int: 6, vit: 8, luck: 10 },
  skill: SKILL_SAND_STORM,
  lore: "Наемник из Песков Вечности — бескрайней пустыни, где время остановилось. Скорп выжил в смертельной буре и обрел способность манипулировать песком. Его Песчаная Буря скрывает от врагов и замедляет их, давая преимущество в бою.",
};

// ─── Faction Distribution ───

/** Ordered faction assignment for 100 hero slots */
const FACTION_SLOTS: Faction[] = [
  ...Array(14).fill(Faction.NEON_CARTEL),
  ...Array(14).fill(Faction.CHAPPIE_CULT),
  ...Array(14).fill(Faction.WILD_CIRCLE),
  ...Array(14).fill(Faction.GRATE_CLAN),
  ...Array(14).fill(Faction.INDUSTRIAL_GUILD),
  ...Array(14).fill(Faction.SANDS_ETERNAL),
  ...Array(16).fill(Faction.VOID_LEGION),
];

/** Generate a placeholder name for a stub hero */
function generateStubName(heroId: number): string {
  return `Герой #${heroId}`;
}

/** Generate default base attributes for stub heroes */
function generateStubAttributes(): Attributes {
  return { str: 5, dex: 5, int: 5, vit: 5, luck: 5 };
}

/** Generate a placeholder skill for stubs */
function generateStubSkill(heroId: number): HeroSkill {
  return {
    id: `stub_skill_${heroId}`,
    name: "Базовый Взрыв",
    description: "Стандартный взрыв бомбы",
    cooldownMs: 10000,
    manaCost: 10,
  };
}

/** Generate placeholder lore for stubs */
function generateStubLore(faction: Faction): string {
  const factionLores: Record<Faction, string> = {
    [Faction.NEON_CARTEL]:
      "Член Неонового Картеля. История будет раскрыта в будущем обновлении.",
    [Faction.CHAPPIE_CULT]:
      "Последователь Культа Чаппи. История будет раскрыта в будущем обновлении.",
    [Faction.WILD_CIRCLE]:
      "Странник Зеленого Круга. История будет раскрыта в будущем обновлении.",
    [Faction.GRATE_CLAN]:
      "Боец Клана Решетки. История будет раскрыта в будущем обновлении.",
    [Faction.INDUSTRIAL_GUILD]:
      "Рабочий Индустриальной Гильдии. История будет раскрыта в будущем обновлении.",
    [Faction.SANDS_ETERNAL]:
      "Воин Песков Вечности. История будет раскрыта в будущем обновлении.",
    [Faction.VOID_LEGION]:
      "Служитель Легиона Пустоты. История будет раскрыта в будущем обновлении.",
  };
  return factionLores[faction];
}

// ─── Registry Build ───

/** Full hero definitions map */
const HERO_MAP = new Map<string, HeroDefinition>();

/** Register the 3 full heroes */
HERO_MAP.set(HERO_ZERO.heroId, HERO_ZERO);
HERO_MAP.set(HERO_WILD.heroId, HERO_WILD);
HERO_MAP.set(HERO_SCORP.heroId, HERO_SCORP);

/** Generate 97 stub heroes (ids 1-99 excluding 0, 28, 70) */
for (let i = 0; i < 100; i++) {
  const heroId = `hero_${i}`;
  if (HERO_MAP.has(heroId)) continue; // Skip full heroes

  const faction = FACTION_SLOTS[i];
  const stub: HeroDefinition = {
    heroId,
    skinId: i,
    name: generateStubName(i),
    faction,
    baseAttributes: generateStubAttributes(),
    skill: generateStubSkill(i),
    lore: generateStubLore(faction),
    isStub: true,
  };
  HERO_MAP.set(heroId, stub);
}

// ─── Registry API ───

export class HeroRegistry {
  private static instance: HeroRegistry;
  private heroes: Map<string, HeroDefinition> = new Map(HERO_MAP);

  static getInstance(): HeroRegistry {
    if (!HeroRegistry.instance) {
      HeroRegistry.instance = new HeroRegistry();
    }
    return HeroRegistry.instance;
  }

  /** Get a hero definition by ID */
  get(heroId: string): HeroDefinition | undefined {
    return this.heroes.get(heroId);
  }

  /** Check if hero exists */
  has(heroId: string): boolean {
    return this.heroes.has(heroId);
  }

  /** Get all hero definitions */
  getAll(): HeroDefinition[] {
    return Array.from(this.heroes.values());
  }

  /** Get all non-stub heroes */
  getFullHeroes(): HeroDefinition[] {
    return this.getAll().filter((h) => !h.isStub);
  }

  /** Get stub heroes only */
  getStubs(): HeroDefinition[] {
    return this.getAll().filter((h) => h.isStub);
  }

  /** Get heroes by faction */
  getByFaction(faction: Faction): HeroDefinition[] {
    return this.getAll().filter((h) => h.faction === faction);
  }

  /** Get total hero count */
  get count(): number {
    return this.heroes.size;
  }

  /** Get count of full (non-stub) heroes */
  get fullCount(): number {
    return this.getAll().filter((h) => !h.isStub).length;
  }

  /** Get count of stub heroes */
  get stubCount(): number {
    return this.getAll().filter((h) => h.isStub).length;
  }

  /** Update a stub hero with full data (for future content unlocks) */
  upgradeHero(heroDef: HeroDefinition): void {
    this.heroes.set(heroDef.heroId, { ...heroDef, isStub: false });
  }
}

/** Convenience: get hero definition without registry instance */
export function getHeroDef(heroId: string): HeroDefinition | undefined {
  return HeroRegistry.getInstance().get(heroId);
}

/** Convenience: get all hero definitions */
export function getAllHeroDefs(): HeroDefinition[] {
  return HeroRegistry.getInstance().getAll();
}

/** Export the 3 Phase 1 full heroes for direct import */
export { HERO_ZERO, HERO_WILD, HERO_SCORP };

/** Quick reference: faction counts */
export const FACTION_COUNTS: Record<Faction, number> = {
  [Faction.NEON_CARTEL]: 14,
  [Faction.CHAPPIE_CULT]: 14,
  [Faction.WILD_CIRCLE]: 14,
  [Faction.GRATE_CLAN]: 14,
  [Faction.INDUSTRIAL_GUILD]: 14,
  [Faction.SANDS_ETERNAL]: 14,
  [Faction.VOID_LEGION]: 16,
};
