/**
 * DropTable.ts — система дропа для BomberMeme World campaign.
 *
 * Таблицы дропа для каждого моба, ролл предметов, учет luck игрока.
 */

import { MOBS, DropTable, DropEntry, MobData } from "./EnemyAI";

// ============================================================
// Типы предметов
// ============================================================

export interface ItemData {
  id: string;
  name: string;
  description: string;
  /** Редкость: common, uncommon, rare, epic, legendary. */
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  /** Можно ли складывать в стак. */
  stackable: boolean;
  maxStack: number;
  /** Цена продажи торговцу. */
  sellPrice: number;
  /** Иконка (имя ассета). */
  icon: string;
}

// ============================================================
// Каталог предметов
// ============================================================

export const ITEMS: Record<string, ItemData> = {
  // --- Common ---
  gel_blob: {
    id: "gel_blob",
    name: "Сгусток слайма",
    description: "Липкая субстанция из бомбового слайма.",
    rarity: "common",
    stackable: true,
    maxStack: 20,
    sellPrice: 3,
    icon: "powerup_bomb",
  },
  meat: {
    id: "meat",
    name: "Кабанятина",
    description: "Сырое мясо взрывного кабана.",
    rarity: "common",
    stackable: true,
    maxStack: 10,
    sellPrice: 5,
    icon: "powerup_health",
  },
  cloth_scrap: {
    id: "cloth_scrap",
    name: "Лоскут ткани",
    description: "Обрывок одежды бандита.",
    rarity: "common",
    stackable: true,
    maxStack: 30,
    sellPrice: 2,
    icon: "powerup_wall",
  },
  wood_log: {
    id: "wood_log",
    name: "Бревно",
    description: "Крепкое древесина с бомбодрева.",
    rarity: "common",
    stackable: true,
    maxStack: 20,
    sellPrice: 4,
    icon: "powerup_fire",
  },

  // --- Uncommon ---
  slime_essence: {
    id: "slime_essence",
    name: "Эссенция слайма",
    description: "Концентрированная слизь с магическими свойствами.",
    rarity: "uncommon",
    stackable: true,
    maxStack: 10,
    sellPrice: 15,
    icon: "powerup_speed",
  },
  boar_hide: {
    id: "boar_hide",
    name: "Шкура кабана",
    description: "Прочная шкура взрывного кабана.",
    rarity: "uncommon",
    stackable: true,
    maxStack: 5,
    sellPrice: 20,
    icon: "powerup_kick",
  },
  boar_tusk: {
    id: "boar_tusk",
    name: "Бивень кабана",
    description: "Острый бивень — ценный реагент.",
    rarity: "uncommon",
    stackable: true,
    maxStack: 10,
    sellPrice: 12,
    icon: "powerup_kick",
  },
  coin_pouch: {
    id: "coin_pouch",
    name: "Кошелёк",
    description: "Небольшая сумма чипсов у бандита.",
    rarity: "uncommon",
    stackable: true,
    maxStack: 99,
    sellPrice: 25,
    icon: "powerup_health",
  },
  living_bark: {
    id: "living_bark",
    name: "Живая кора",
    description: "Кора, все еще пульсирующая энергией.",
    rarity: "uncommon",
    stackable: true,
    maxStack: 10,
    sellPrice: 18,
    icon: "powerup_wall",
  },
  nature_seed: {
    id: "nature_seed",
    name: "Семя природы",
    description: "Магическое семя из сердца бомбодрева.",
    rarity: "uncommon",
    stackable: true,
    maxStack: 15,
    sellPrice: 15,
    icon: "powerup_speed",
  },
  bandit_dagger: {
    id: "bandit_dagger",
    name: "Бандитский кинжал",
    description: "Ржавый, но острый.",
    rarity: "uncommon",
    stackable: false,
    maxStack: 1,
    sellPrice: 30,
    icon: "powerup_kick",
  },

  // --- Rare ---
  root_heart: {
    id: "root_heart",
    name: "Сердце Корней",
    description: "Ядро Пожирателя Корней. Легендарный реагент.",
    rarity: "rare",
    stackable: false,
    maxStack: 1,
    sellPrice: 200,
    icon: "powerup_health",
  },
  boss_chest_key: {
    id: "boss_chest_key",
    name: "Ключ Босс-сундука",
    description: "Открывает специальный сундук за убийство босса.",
    rarity: "rare",
    stackable: true,
    maxStack: 10,
    sellPrice: 50,
    icon: "powerup_bomb",
  },
  nature_orb: {
    id: "nature_orb",
    name: "Сфера Природы",
    description: "Светится зеленым светом.",
    rarity: "rare",
    stackable: false,
    maxStack: 1,
    sellPrice: 150,
    icon: "powerup_speed",
  },

  // --- Epic ---
  epic_gear_token: {
    id: "epic_gear_token",
    name: "Токен Эпической Экипировки",
    description: "Обменяйте на эпический предмет у торговца.",
    rarity: "epic",
    stackable: true,
    maxStack: 99,
    sellPrice: 500,
    icon: "powerup_fire",
  },
};

// ============================================================
// Результат дропа
// ============================================================

export interface DropResult {
  items: Array<{
    itemId: string;
    itemData: ItemData;
    count: number;
  }>;
  xp: number;
  chips: number;
}

// ============================================================
// DropTableSystem
// ============================================================

export class DropTableSystem {
  /**
   * Бросить дроп для убитого моба.
   * @param mobTypeId — тип моба
   * @param playerLuck — LUCK игрока (влияет на шансы)
   * @returns результат дропа
   */
  roll(mobTypeId: string, playerLuck = 10): DropResult {
    const mobData = MOBS[mobTypeId];
    if (!mobData) {
      return { items: [], xp: 0, chips: 0 };
    }

    const result: DropResult = {
      items: [],
      xp: mobData.drops.xpReward,
      chips: mobData.drops.chipsReward,
    };

    // Шанс на любой дроп
    const baseDropChance = mobData.drops.dropChance;
    const luckBonus = Math.min(0.2, playerLuck * 0.002); // max +20%
    const finalDropChance = Math.min(1, baseDropChance + luckBonus);

    if (Math.random() > finalDropChance) {
      // Ничего не выпало (но опыт и чипсы всегда)
      return result;
    }

    // Роллим каждый предмет из таблицы
    for (const entry of mobData.drops.items) {
      const rollChance = Math.min(1, entry.chance + luckBonus);
      if (Math.random() <= rollChance) {
        const count =
          entry.minCount +
          Math.floor(Math.random() * (entry.maxCount - entry.minCount + 1));
        const itemData = ITEMS[entry.itemId];
        if (itemData) {
          result.items.push({
            itemId: entry.itemId,
            itemData,
            count,
          });
        }
      }
    }

    return result;
  }

  /**
   * Бросить дроп для босса (гарантированный дроп + бонусы).
   */
  rollBoss(mobTypeId: string, playerLuck = 10): DropResult {
    const mobData = MOBS[mobTypeId];
    if (!mobData) {
      return { items: [], xp: 0, chips: 0 };
    }

    const result = this.roll(mobTypeId, playerLuck);

    // Боссы всегда дают все гарантированные предметы (chance = 1.0)
    for (const entry of mobData.drops.items) {
      if (entry.chance >= 1.0) {
        // Гарантированный предмет
        const alreadyDropped = result.items.find(
          (i) => i.itemId === entry.itemId
        );
        if (!alreadyDropped) {
          const itemData = ITEMS[entry.itemId];
          if (itemData) {
            result.items.push({
              itemId: entry.itemId,
              itemData,
              count: entry.maxCount,
            });
          }
        }
      }
    }

    // Бонус XP и chips за босса
    result.xp = Math.floor(result.xp * 1.2);
    result.chips = Math.floor(result.chips * 1.5);

    return result;
  }

  /**
   * Получить данные предмета.
   */
  getItem(itemId: string): ItemData | null {
    return ITEMS[itemId] ?? null;
  }

  /**
   * Получить все предметы моба (для отображения в бестиарии).
   */
  getMobDrops(mobTypeId: string): DropEntry[] {
    const mobData = MOBS[mobTypeId];
    return mobData?.drops.items ?? [];
  }

  /**
   * Получить таблицу дропа моба.
   */
  getDropTable(mobTypeId: string): DropTable | null {
    const mobData = MOBS[mobTypeId];
    return mobData?.drops ?? null;
  }
}

// ============================================================
// Глобальный инстанс
// ============================================================

export const dropTableSystem = new DropTableSystem();
