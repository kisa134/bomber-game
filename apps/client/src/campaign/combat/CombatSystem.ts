/**
 * CombatSystem.ts — HP/Damage/Crit/Combo система для BomberMeme World campaign.
 *
 * ECS System: обрабатывает сущности с combat + physics компонентами.
 * - Урон с учетом защиты и критов (LUCK из RPGComponent)
 * - Комбо-система: последовательные попадания = множитель урона
 * - Лечение, смерть, инвуленерабильность
 */

import { GRID_W, GRID_H, TILE_PX } from "@bomberpump/shared";

// ============================================================
// Vec2 — минимальный вектор (совместим с ECS Agent 1)
// ============================================================
export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

// ============================================================
// Компоненты (интерфейсы для ECS)
// ============================================================

/** CombatComponent — здоровье, защита, статус смерти/инвулена. */
export interface CombatComponent {
  type: "combat";
  hp: number;
  maxHp: number;
  defense: number; // плоское снижение урона
  isAlive: boolean;
  isInvulnerable: boolean;
  invulnTimer: number; // ms осталось
  team: "player" | "enemy" | "neutral";
  // Комбо-трекинг
  comboCount: number;
  comboTimer: number; // ms до сброса комбо
  lastAttackerId: string;
}

/** RPGComponent — статы персонажа (LUCK влияет на криты). */
export interface RPGComponent {
  type: "rpg";
  level: number;
  strength: number;
  agility: number;
  luck: number; // 0..100, шанс крита = luck * 0.3%
  intelligence: number;
}

/** PhysicsComponent — позиция и скорость. */
export interface PhysicsComponent {
  type: "physics";
  position: Vec2;
  velocity: Vec2;
  speed: number;
  hitboxRadius: number;
}

/** ManaComponent — мана для скиллов. */
export interface ManaComponent {
  type: "mana";
  mana: number;
  maxMana: number;
  manaRegen: number; // в секунду
}

// ============================================================
// Типы урона
// ============================================================

export type DamageType = "bomb" | "melee" | "fire" | "poison" | "magic";

export interface DamageEvent {
  targetId: string;
  sourceId: string;
  baseDamage: number;
  damageType: DamageType;
  isCritical: boolean;
  finalDamage: number;
  comboMultiplier: number;
  timestamp: number;
}

// ============================================================
// CombatSystem
// ============================================================

/** Базовый класс System — адаптер под ECS Agent 1. */
export abstract class System {
  abstract componentsRequired: string[];
  abstract update(entities: Entity[], dt: number): void;
  /** Фильтр сущностей по наличию всех требуемых компонентов. */
  protected filter(entities: Entity[]): Entity[] {
    return entities.filter((e) =>
      this.componentsRequired.every((req) => e.components.has(req))
    );
  }
}

/** Базовая сущность ECS. */
export interface Entity {
  id: string;
  components: Map<string, unknown>;
  tags: Set<string>;
}

export interface World {
  entities: Entity[];
  addEntity(entity: Entity): void;
  removeEntity(entity: Entity): void;
  getEntitiesWith(...componentTypes: string[]): Entity[];
}

/** Время жизни комбо (ms) — если не попадаешь, сбрасывается. */
const COMBO_WINDOW_MS = 3000;
/** Максимальный множитель комбо. */
const MAX_COMBO_MULTIPLIER = 3.0;
/** Базовый шанс крита = luck * LUCK_TO_CRIT_RATE %. */
const LUCK_TO_CRIT_RATE = 0.3;
/** Критический множитель урона. */
const CRIT_MULTIPLIER = 2.0;
/** Время инвуленерабильности после получения урона (ms). */
const INVULN_DURATION_MS = 600;

export class CombatSystem extends System {
  componentsRequired = ["combat", "physics"];

  /** Слушатели событий урона (для UI, ачивок и т.д.). */
  private damageListeners: Array<(ev: DamageEvent) => void> = [];
  /** История событий урона текущего кадра. */
  private pendingEvents: DamageEvent[] = [];

  update(entities: Entity[], dt: number): void {
    this.pendingEvents = [];
    const relevant = this.filter(entities);

    for (const entity of relevant) {
      const combat = entity.components.get("combat") as CombatComponent;
      if (!combat.isAlive) continue;

      // Обновление таймера инвуленерабильности
      if (combat.isInvulnerable && combat.invulnTimer > 0) {
        combat.invulnTimer -= dt;
        if (combat.invulnTimer <= 0) {
          combat.isInvulnerable = false;
          combat.invulnTimer = 0;
        }
      }

      // Обновление комбо-таймера
      if (combat.comboCount > 0) {
        combat.comboTimer -= dt;
        if (combat.comboTimer <= 0) {
          combat.comboCount = 0;
          combat.comboTimer = 0;
        }
      }
    }

    // Рассылка накопленных событий
    for (const ev of this.pendingEvents) {
      this.notifyDamageListeners(ev);
    }
  }

  // ==========================================================
  // Урон
  // ==========================================================

  /**
   * Нанести урон цели.
   * @param target — целевая сущность
   * @param baseDamage — базовый урон
   * @param source — источник (опционально, для комбо и критов)
   * @param damageType — тип урона
   * @returns фактический нанесенный урон
   */
  applyDamage(
    target: Entity,
    baseDamage: number,
    source?: Entity,
    damageType: DamageType = "bomb"
  ): number {
    const combat = target.components.get("combat") as CombatComponent;
    if (!combat || !combat.isAlive || combat.isInvulnerable) return 0;

    // Получаем LUCK из RPGComponent источника (если есть)
    let luck = 0;
    if (source) {
      const rpg = source.components.get("rpg") as RPGComponent | undefined;
      if (rpg) luck = rpg.luck;
    }

    // Расчет крита
    const isCrit = this.isCritical(luck);

    // Комбо-множитель от источника
    let comboMultiplier = 1.0;
    if (source) {
      const sourceCombat = source.components.get("combat") as CombatComponent | undefined;
      if (sourceCombat) {
        comboMultiplier = this.getComboMultiplier(sourceCombat.comboCount);
      }
    }

    // Формула урона
    let finalDamage = Math.max(1, baseDamage - combat.defense);
    if (isCrit) finalDamage *= CRIT_MULTIPLIER;
    finalDamage *= comboMultiplier;
    finalDamage = Math.floor(finalDamage);

    // Применение
    combat.hp -= finalDamage;

    // Обновление комбо у источника
    if (source) {
      const sourceCombat = source.components.get("combat") as CombatComponent | undefined;
      if (sourceCombat) {
        sourceCombat.comboCount++;
        sourceCombat.comboTimer = COMBO_WINDOW_MS;
        sourceCombat.lastAttackerId = target.id;
      }
    }

    // Инвуленерабильность после удара
    combat.isInvulnerable = true;
    combat.invulnTimer = INVULN_DURATION_MS;

    // Проверка смерти
    if (combat.hp <= 0) {
      combat.hp = 0;
      combat.isAlive = false;
      target.tags.add("dead");
      target.tags.delete("alive");
    }

    // Событие
    const event: DamageEvent = {
      targetId: target.id,
      sourceId: source?.id ?? "environment",
      baseDamage,
      damageType,
      isCritical: isCrit,
      finalDamage,
      comboMultiplier,
      timestamp: performance.now(),
    };
    this.pendingEvents.push(event);

    return finalDamage;
  }

  /** Восстановить HP (не выше maxHp). */
  heal(target: Entity, amount: number): number {
    const combat = target.components.get("combat") as CombatComponent;
    if (!combat || !combat.isAlive) return 0;

    const before = combat.hp;
    combat.hp = Math.min(combat.maxHp, combat.hp + amount);
    return combat.hp - before;
  }

  /** Мгновенное убийство (для отладки / осадных уронов). */
  kill(target: Entity): void {
    const combat = target.components.get("combat") as CombatComponent;
    if (!combat) return;
    combat.hp = 0;
    combat.isAlive = false;
    target.tags.add("dead");
    target.tags.delete("alive");
  }

  // ==========================================================
  // Криты
  // ==========================================================

  /** Проверка на критический удар на основе LUCK. */
  isCritical(luck: number): boolean {
    const chance = Math.min(50, luck * LUCK_TO_CRIT_RATE); // max 50%
    return Math.random() * 100 < chance;
  }

  /** Получить шанс крита в процентах (для UI). */
  getCritChance(luck: number): number {
    return Math.min(50, luck * LUCK_TO_CRIT_RATE);
  }

  // ==========================================================
  // Комбо
  // ==========================================================

  /** Множитель комбо: каждое попадание +0.25x, max 3.0x. */
  getComboMultiplier(comboCount: number): number {
    if (comboCount <= 0) return 1.0;
    const mult = 1.0 + comboCount * 0.25;
    return Math.min(MAX_COMBO_MULTIPLIER, mult);
  }

  /** Сбросить комбо у сущности. */
  resetCombo(entity: Entity): void {
    const combat = entity.components.get("combat") as CombatComponent | undefined;
    if (combat) {
      combat.comboCount = 0;
      combat.comboTimer = 0;
    }
  }

  /** Получить текущий комбо-множитель сущности (для UI). */
  getCurrentComboMultiplier(entity: Entity): number {
    const combat = entity.components.get("combat") as CombatComponent | undefined;
    if (!combat) return 1.0;
    return this.getComboMultiplier(combat.comboCount);
  }

  // ==========================================================
  // AoE урон
  // ==========================================================

  /**
   * Нанести AoE урон всем сущностям в радиусе.
   * @param center — центр взрыва
   * @param radius — радиус в пикселях
   * @param baseDamage — базовый урон
   * @param source — источник
   * @param world — мир для поиска целей
   */
  applyAoEDamage(
    center: Vec2,
    radius: number,
    baseDamage: number,
    source: Entity | undefined,
    world: World,
    damageType: DamageType = "bomb"
  ): DamageEvent[] {
    const results: DamageEvent[] = [];
    const allEntities = world.entities;

    for (const target of allEntities) {
      const combat = target.components.get("combat") as CombatComponent | undefined;
      const physics = target.components.get("physics") as PhysicsComponent | undefined;
      if (!combat || !physics || !combat.isAlive) continue;

      // Не наносим урон самому себе (источнику)
      if (source && target.id === source.id) continue;

      const dist = vec2Dist(center, physics.position);
      if (dist <= radius) {
        // Падение урона с расстоянием: 100% в центре, 25% на краю
        const falloff = 1.0 - (dist / radius) * 0.75;
        const adjustedDamage = Math.floor(baseDamage * falloff);
        const dealt = this.applyDamage(target, adjustedDamage, source, damageType);
        if (dealt > 0) {
          results.push({
            targetId: target.id,
            sourceId: source?.id ?? "environment",
            baseDamage: adjustedDamage,
            damageType,
            isCritical: false,
            finalDamage: dealt,
            comboMultiplier: this.getCurrentComboMultiplier(source ?? target),
            timestamp: performance.now(),
          });
        }
      }
    }

    return results;
  }

  // ==========================================================
  // Подписки на события
  // ==========================================================

  onDamage(listener: (ev: DamageEvent) => void): () => void {
    this.damageListeners.push(listener);
    return () => {
      const i = this.damageListeners.indexOf(listener);
      if (i >= 0) this.damageListeners.splice(i, 1);
    };
  }

  private notifyDamageListeners(ev: DamageEvent): void {
    for (const fn of this.damageListeners) {
      try {
        fn(ev);
      } catch {
        // игнорируем ошибки слушателей
      }
    }
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  /** Создать CombatComponent с дефолтами. */
  static makeCombat(
    maxHp: number,
    team: "player" | "enemy" | "neutral",
    defense = 0
  ): CombatComponent {
    return {
      type: "combat",
      hp: maxHp,
      maxHp,
      defense,
      isAlive: true,
      isInvulnerable: false,
      invulnTimer: 0,
      team,
      comboCount: 0,
      comboTimer: 0,
      lastAttackerId: "",
    };
  }

  /** Создать RPGComponent. */
  static makeRPG(
    level = 1,
    strength = 10,
    agility = 10,
    luck = 10,
    intelligence = 10
  ): RPGComponent {
    return {
      type: "rpg",
      level,
      strength,
      agility,
      luck,
      intelligence,
    };
  }

  /** Создать PhysicsComponent. */
  static makePhysics(
    x: number,
    y: number,
    speed: number,
    hitboxRadius = TILE_PX * 0.4
  ): PhysicsComponent {
    return {
      type: "physics",
      position: vec2(x, y),
      velocity: vec2(0, 0),
      speed,
      hitboxRadius,
    };
  }

  /** Создать ManaComponent. */
  static makeMana(maxMana: number, manaRegen = 5): ManaComponent {
    return {
      type: "mana",
      mana: maxMana,
      maxMana,
      manaRegen,
    };
  }
}

/** Фабрика Entity для боевых юнитов. */
export function createCombatEntity(
  id: string,
  x: number,
  y: number,
  maxHp: number,
  team: "player" | "enemy" | "neutral",
  speed: number,
  options?: {
    defense?: number;
    level?: number;
    strength?: number;
    agility?: number;
    luck?: number;
    intelligence?: number;
    maxMana?: number;
    manaRegen?: number;
    tags?: string[];
  }
): Entity {
  const entity: Entity = {
    id,
    components: new Map(),
    tags: new Set(["alive", ...(options?.tags ?? [])]),
  };

  entity.components.set(
    "combat",
    CombatSystem.makeCombat(maxHp, team, options?.defense ?? 0)
  );
  entity.components.set(
    "physics",
    CombatSystem.makePhysics(x, y, speed)
  );
  entity.components.set(
    "rpg",
    CombatSystem.makeRPG(
      options?.level ?? 1,
      options?.strength ?? 10,
      options?.agility ?? 10,
      options?.luck ?? 10,
      options?.intelligence ?? 10
    )
  );

  if (team === "player") {
    entity.components.set(
      "mana",
      CombatSystem.makeMana(options?.maxMana ?? 100, options?.manaRegen ?? 5)
    );
  }

  return entity;
}
