/**
 * EnemyAI.ts — AI система мобов для BomberMeme World campaign.
 *
 * ECS System: 5 типов мобов с конечным автоматом состояний.
 * Состояния: IDLE -> PATROL -> CHASE -> ATTACK -> FLEE -> DEAD
 *
 * Phase 1: Grasslands мобы (Act 1):
 *   - Бомбовый Слайм (passive)
 *   - Взрывной Кабан (territorial)
 *   - Бомбический Бандит (aggressive)
 *   - Бомбодрево (territorial)
 *   - Пожиратель Корней (boss, aggressive)
 */

import { TILE_PX } from "@bomberpump/shared";
import {
  Vec2,
  vec2,
  vec2Dist,
  vec2Normalize,
  Entity,
  World,
  System,
  CombatSystem,
  PhysicsComponent,
  CombatComponent,
} from "./CombatSystem";
import { BombSystem } from "./BombSystem";

// ============================================================
// Типы поведения
// ============================================================

export type MobBehavior = "passive" | "aggressive" | "territorial" | "fleeing";

// ============================================================
// Таблица дропа
// ============================================================

export interface DropEntry {
  itemId: string;
  chance: number;   // 0..1
  minCount: number;
  maxCount: number;
}

export interface DropTable {
  items: DropEntry[];
  /** Шанс выпадения хоть чего-то. */
  dropChance: number;
  /** Базовый опыт за убийство. */
  xpReward: number;
  /** Базовые чипсы. */
  chipsReward: number;
}

// ============================================================
// Данные моба
// ============================================================

export interface MobData {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  aggroRange: number;   // px
  attackRange: number;  // px
  behavior: MobBehavior;
  drops: DropTable;
  /** Спринт: множитель скорости при преследовании. */
  sprintMultiplier?: number;
  /** Шанс уклонения от бомб (0..1). */
  dodgeChance?: number;
  /** Цвет для отрисовки (если нет спрайта). */
  color: string;
  /** Размер отрисовки (множитель TILE_PX). */
  renderSize: number;
  /** Босс-флаги. */
  isBoss?: boolean;
  /** Фазы босса (HP % -> phase). */
  bossPhases?: BossPhase[];
}

export interface BossPhase {
  hpThreshold: number; // 0..1 (доля HP)
  name: string;
  /** Множитель скорости. */
  speedMult: number;
  /** Множитель урона. */
  damageMult: number;
  /** Множитель aggroRange. */
  aggroMult: number;
  /** Новое поведение (если меняется). */
  behavior?: MobBehavior;
  /** Спавн доп. мобов. */
  spawnMobs?: string[];
}

// ============================================================
// AI State Machine
// ============================================================

export type AIState =
  | "idle"
  | "patrol"
  | "chase"
  | "attack"
  | "flee"
  | "dead";

export interface MobAIComponent {
  type: "mob_ai";
  mobTypeId: string;
  currentState: AIState;
  /** Время в текущем состоянии (ms). */
  stateTimer: number;
  /** Точка патруля (куда идем). */
  patrolTarget?: Vec2;
  /** Точка спавна (для territorial). */
  spawnPoint: Vec2;
  /** Текущая цель (entityId). */
  targetId: string;
  /** Таймер атаки (cd между атаками, ms). */
  attackTimer: number;
  /** Базовый кулдаун атаки. */
  attackCooldown: number;
  /** Текущая фаза босса (индекс). */
  currentPhase: number;
  /** Флаг: уже спавнил аддов в текущей фазе. */
  hasSpawnedAdds: boolean;
  /** Последняя позиция бомбы (для уклонения). */
  lastBombPosition?: Vec2;
  /** Таймер уклонения. */
  dodgeTimer: number;
  /** Направление уклонения. */
  dodgeDirection?: Vec2;
  /** Счетчик бездействия (для смены состояний). */
  idleTime: number;
}

// ============================================================
// 5 типов мобов (Phase 1: Grasslands)
// ============================================================

export const MOBS: Record<string, MobData> = {
  slime: {
    id: "slime",
    name: "Бомбовый Слайм",
    hp: 30,
    damage: 5,
    speed: 80,
    aggroRange: 200,
    attackRange: 50,
    behavior: "passive",
    dodgeChance: 0.1,
    color: "#7CFC00",
    renderSize: 0.7,
    drops: {
      items: [
        { itemId: "gel_blob", chance: 0.5, minCount: 1, maxCount: 2 },
        { itemId: "slime_essence", chance: 0.15, minCount: 1, maxCount: 1 },
      ],
      dropChance: 0.7,
      xpReward: 10,
      chipsReward: 5,
    },
  },
  boar: {
    id: "boar",
    name: "Взрывной Кабан",
    hp: 60,
    damage: 12,
    speed: 120,
    aggroRange: 250,
    attackRange: 60,
    behavior: "territorial",
    sprintMultiplier: 1.8,
    dodgeChance: 0.2,
    color: "#8B4513",
    renderSize: 0.9,
    drops: {
      items: [
        { itemId: "boar_hide", chance: 0.4, minCount: 1, maxCount: 1 },
        { itemId: "boar_tusk", chance: 0.25, minCount: 1, maxCount: 2 },
        { itemId: "meat", chance: 0.6, minCount: 1, maxCount: 2 },
      ],
      dropChance: 0.8,
      xpReward: 20,
      chipsReward: 12,
    },
  },
  bandit: {
    id: "bandit",
    name: "Бомбический Бандит",
    hp: 50,
    damage: 15,
    speed: 100,
    aggroRange: 300,
    attackRange: 100,
    behavior: "aggressive",
    dodgeChance: 0.35,
    color: "#4A4A4A",
    renderSize: 0.85,
    drops: {
      items: [
        { itemId: "bandit_dagger", chance: 0.1, minCount: 1, maxCount: 1 },
        { itemId: "cloth_scrap", chance: 0.5, minCount: 1, maxCount: 3 },
        { itemId: "coin_pouch", chance: 0.3, minCount: 1, maxCount: 1 },
      ],
      dropChance: 0.75,
      xpReward: 25,
      chipsReward: 15,
    },
  },
  treant: {
    id: "treant",
    name: "Бомбодрево",
    hp: 120,
    damage: 20,
    speed: 60,
    aggroRange: 150,
    attackRange: 80,
    behavior: "territorial",
    dodgeChance: 0.05,
    color: "#228B22",
    renderSize: 1.2,
    drops: {
      items: [
        { itemId: "wood_log", chance: 0.6, minCount: 1, maxCount: 3 },
        { itemId: "living_bark", chance: 0.2, minCount: 1, maxCount: 1 },
        { itemId: "nature_seed", chance: 0.15, minCount: 1, maxCount: 2 },
      ],
      dropChance: 0.85,
      xpReward: 35,
      chipsReward: 20,
    },
  },
  boss_root: {
    id: "boss_root",
    name: "Пожиратель Корней",
    hp: 500,
    damage: 30,
    speed: 40,
    aggroRange: 400,
    attackRange: 150,
    behavior: "aggressive",
    dodgeChance: 0.15,
    color: "#4B0082",
    renderSize: 1.5,
    isBoss: true,
    bossPhases: [
      {
        hpThreshold: 1.0,
        name: "Пробуждение",
        speedMult: 1.0,
        damageMult: 1.0,
        aggroMult: 1.0,
      },
      {
        hpThreshold: 0.7,
        name: "Ярость",
        speedMult: 1.3,
        damageMult: 1.25,
        aggroMult: 1.2,
        spawnMobs: ["slime"],
      },
      {
        hpThreshold: 0.4,
        name: "Истощение",
        speedMult: 0.8,
        damageMult: 1.5,
        aggroMult: 1.5,
        behavior: "aggressive",
        spawnMobs: ["slime", "boar"],
      },
      {
        hpThreshold: 0.15,
        name: "Последний Рывок",
        speedMult: 1.8,
        damageMult: 2.0,
        aggroMult: 2.0,
        spawnMobs: ["slime", "slime", "boar"],
      },
    ],
    drops: {
      items: [
        { itemId: "root_heart", chance: 1.0, minCount: 1, maxCount: 1 },
        { itemId: "boss_chest_key", chance: 1.0, minCount: 1, maxCount: 1 },
        { itemId: "nature_orb", chance: 0.3, minCount: 1, maxCount: 1 },
        { itemId: "epic_gear_token", chance: 0.15, minCount: 1, maxCount: 1 },
      ],
      dropChance: 1.0,
      xpReward: 200,
      chipsReward: 100,
    },
  },
};

// ============================================================
// Параметры AI
// ============================================================

const PATROL_RADIUS = TILE_PX * 5;
const PATROL_IDLE_MIN = 1000;
const PATROL_IDLE_MAX = 3000;
const FLEE_DURATION = 2000;
const ATTACK_COOLDOWN_BASE = 1500;
const DODGE_DURATION = 400;
const DODGE_SPEED_MULT = 2.5;
const BOSS_SUMMON_COOLDOWN = 8000;

// ============================================================
// MobAISystem
// ============================================================

export class MobAISystem extends System {
  componentsRequired = ["mob_ai", "combat", "physics"];

  /** Коллбэк на смерть моба (для дропа, опыта). */
  onMobDeath:
    | ((mob: Entity, mobData: MobData, killerId?: string) => void)
    | null = null;

  /** Коллбэк на спавн аддов босса. */
  onBossSummon:
    | ((boss: Entity, mobTypeId: string, positions: Vec2[]) => void)
    | null = null;

  /** Коллбэк на смену фазы босса. */
  onBossPhaseChange:
    | ((boss: Entity, phase: BossPhase) => void)
    | null = null;

  /** Последнее время саммона боссов: entityId -> timestamp. */
  private bossSummonTimers = new Map<string, number>();

  constructor(
    private combatSystem: CombatSystem,
    private bombSystem: BombSystem
  ) {
    super();
  }

  update(entities: Entity[], dt: number): void {
    const mobs = this.filter(entities);

    for (const mob of mobs) {
      const ai = mob.components.get("mob_ai") as MobAIComponent;
      const combat = mob.components.get("combat") as CombatComponent;
      const physics = mob.components.get("physics") as PhysicsComponent;
      if (!ai || !combat || !physics) continue;

      if (!combat.isAlive) {
        if (ai.currentState !== "dead") {
          ai.currentState = "dead";
          this.handleDeath(mob, ai, combat);
        }
        continue;
      }

      // Обновление таймеров
      ai.stateTimer += dt;
      if (ai.attackTimer > 0) ai.attackTimer -= dt;
      if (ai.dodgeTimer > 0) ai.dodgeTimer -= dt;
      ai.idleTime += dt;

      // Проверка фаз босса
      const mobData = MOBS[ai.mobTypeId];
      if (mobData?.isBoss && mobData.bossPhases) {
        this.updateBossPhase(mob, ai, combat, mobData);
      }

      // Уклонение от бомб
      this.checkBombDodge(mob, ai, physics, entities, dt);

      // State Machine
      switch (ai.currentState) {
        case "idle":
          this.stateIdle(mob, ai, combat, physics, entities, dt);
          break;
        case "patrol":
          this.statePatrol(mob, ai, combat, physics, entities, dt);
          break;
        case "chase":
          this.stateChase(mob, ai, combat, physics, entities, dt);
          break;
        case "attack":
          this.stateAttack(mob, ai, combat, physics, entities, dt);
          break;
        case "flee":
          this.stateFlee(mob, ai, combat, physics, entities, dt);
          break;
      }

      // Ограничение скорости
      const speed = Math.sqrt(
        physics.velocity.x ** 2 + physics.velocity.y ** 2
      );
      if (speed > physics.speed) {
        const scale = physics.speed / speed;
        physics.velocity.x *= scale;
        physics.velocity.y *= scale;
      }

      // Применение скорости к позиции
      const dtSec = dt / 1000;
      physics.position.x += physics.velocity.x * dtSec;
      physics.position.y += physics.velocity.y * dtSec;
    }
  }

  // ==========================================================
  // Состояния
  // ==========================================================

  private stateIdle(
    mob: Entity,
    ai: MobAIComponent,
    combat: CombatComponent,
    physics: PhysicsComponent,
    entities: Entity[],
    dt: number
  ): void {
    physics.velocity = vec2(0, 0);

    // Passive мобы дольше стоят
    const idleLimit =
      MOBS[ai.mobTypeId]?.behavior === "passive" ? 3000 : 1500;

    if (ai.idleTime >= idleLimit) {
      this.transitionTo(mob, ai, "patrol");
      this.pickPatrolPoint(ai);
    }

    // Проверка aggro
    this.checkAggro(mob, ai, combat, physics, entities);
  }

  private statePatrol(
    mob: Entity,
    ai: MobAIComponent,
    combat: CombatComponent,
    physics: PhysicsComponent,
    entities: Entity[],
    dt: number
  ): void {
    if (!ai.patrolTarget) {
      this.pickPatrolPoint(ai);
    }

    const toTarget = {
      x: ai.patrolTarget!.x - physics.position.x,
      y: ai.patrolTarget!.y - physics.position.y,
    };
    const dist = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2);

    if (dist < TILE_PX * 0.5) {
      // Достигли точки патруля
      this.transitionTo(mob, ai, "idle");
      return;
    }

    // Движение к точке патруля
    const dir = vec2Normalize(toTarget);
    const speed = physics.speed * 0.5; // патрулируем медленнее
    physics.velocity = { x: dir.x * speed, y: dir.y * speed };

    // Проверка aggro
    this.checkAggro(mob, ai, combat, physics, entities);
  }

  private stateChase(
    mob: Entity,
    ai: MobAIComponent,
    combat: CombatComponent,
    physics: PhysicsComponent,
    entities: Entity[],
    dt: number
  ): void {
    const target = entities.find((e) => e.id === ai.targetId);
    if (!target) {
      this.transitionTo(mob, ai, "patrol");
      return;
    }

    const targetPhys = target.components.get("physics") as
      | PhysicsComponent
      | undefined;
    const targetCombat = target.components.get("combat") as
      | CombatComponent
      | undefined;
    if (!targetPhys || !targetCombat?.isAlive) {
      this.transitionTo(mob, ai, "patrol");
      return;
    }

    const toTarget = {
      x: targetPhys.position.x - physics.position.x,
      y: targetPhys.position.y - physics.position.y,
    };
    const dist = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2);

    // В диапазоне атаки?
    const mobData = MOBS[ai.mobTypeId];
    const attackRange = mobData?.attackRange ?? 60;
    if (dist <= attackRange) {
      this.transitionTo(mob, ai, "attack");
      return;
    }

    // Потеряли из виду?
    const aggroRange = mobData?.aggroRange ?? 200;
    if (dist > aggroRange * 1.5) {
      this.transitionTo(mob, ai, "patrol");
      return;
    }

    // Движение к цели
    const dir = vec2Normalize(toTarget);
    let speed = physics.speed;

    // Спринт для territorial мобов
    if (mobData?.sprintMultiplier && dist > attackRange * 2) {
      speed *= mobData.sprintMultiplier;
    }

    physics.velocity = { x: dir.x * speed, y: dir.y * speed };

    // Уклонение от бомб имеет приоритет
    if (ai.dodgeTimer > 0 && ai.dodgeDirection) {
      physics.velocity = {
        x: ai.dodgeDirection.x * speed * DODGE_SPEED_MULT,
        y: ai.dodgeDirection.y * speed * DODGE_SPEED_MULT,
      };
    }
  }

  private stateAttack(
    mob: Entity,
    ai: MobAIComponent,
    combat: CombatComponent,
    physics: PhysicsComponent,
    entities: Entity[],
    dt: number
  ): void {
    const target = entities.find((e) => e.id === ai.targetId);
    if (!target) {
      this.transitionTo(mob, ai, "patrol");
      return;
    }

    const targetPhys = target.components.get("physics") as
      | PhysicsComponent
      | undefined;
    const targetCombat = target.components.get("combat") as
      | CombatComponent
      | undefined;
    if (!targetPhys || !targetCombat?.isAlive) {
      this.transitionTo(mob, ai, "patrol");
      return;
    }

    const toTarget = {
      x: targetPhys.position.x - physics.position.x,
      y: targetPhys.position.y - physics.position.y,
    };
    const dist = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2);

    const mobData = MOBS[ai.mobTypeId];
    const attackRange = mobData?.attackRange ?? 60;

    // Цель убежала?
    if (dist > attackRange * 1.3) {
      this.transitionTo(mob, ai, "chase");
      return;
    }

    // Атака
    if (ai.attackTimer <= 0) {
      this.performAttack(mob, ai, combat, physics, target, mobData);
      ai.attackTimer = ai.attackCooldown;
    }

    // Движение вокруг цели (кружим)
    const angle = Math.atan2(toTarget.y, toTarget.x) + 0.5;
    const circleSpeed = physics.speed * 0.6;
    physics.velocity = {
      x: Math.cos(angle) * circleSpeed,
      y: Math.sin(angle) * circleSpeed,
    };

    // Боссы не кружат — стоят на месте
    if (mobData?.isBoss) {
      physics.velocity = vec2(0, 0);
    }
  }

  private stateFlee(
    mob: Entity,
    ai: MobAIComponent,
    combat: CombatComponent,
    physics: PhysicsComponent,
    entities: Entity[],
    dt: number
  ): void {
    if (ai.stateTimer >= FLEE_DURATION) {
      this.transitionTo(mob, ai, "patrol");
      return;
    }

    const target = entities.find((e) => e.id === ai.targetId);
    if (!target) {
      this.transitionTo(mob, ai, "patrol");
      return;
    }

    const targetPhys = target.components.get("physics") as
      | PhysicsComponent
      | undefined;
    if (!targetPhys) {
      this.transitionTo(mob, ai, "patrol");
      return;
    }

    // Бежим от цели
    const away = {
      x: physics.position.x - targetPhys.position.x,
      y: physics.position.y - targetPhys.position.y,
    };
    const dir = vec2Normalize(away);
    physics.velocity = {
      x: dir.x * physics.speed * 1.5,
      y: dir.y * physics.speed * 1.5,
    };
  }

  // ==========================================================
  // Переходы состояний
  // ==========================================================

  private transitionTo(
    _mob: Entity,
    ai: MobAIComponent,
    newState: AIState
  ): void {
    ai.currentState = newState;
    ai.stateTimer = 0;
  }

  // ==========================================================
  // Aggro
  // ==========================================================

  private checkAggro(
    mob: Entity,
    ai: MobAIComponent,
    combat: CombatComponent,
    physics: PhysicsComponent,
    entities: Entity[]
  ): void {
    const mobData = MOBS[ai.mobTypeId];
    if (!mobData) return;

    let closestDist = Infinity;
    let closestTarget: Entity | null = null;

    for (const e of entities) {
      // Только игроки и их summoned entities
      if (!e.tags.has("player") && !e.tags.has("summoned")) continue;

      const eCombat = e.components.get("combat") as CombatComponent | undefined;
      const ePhys = e.components.get("physics") as PhysicsComponent | undefined;
      if (!eCombat?.isAlive || !ePhys) continue;

      const dist = vec2Dist(physics.position, ePhys.position);

      // Territorial: агримся только если цель близко к spawnPoint
      if (mobData.behavior === "territorial") {
        const distToSpawn = vec2Dist(ePhys.position, ai.spawnPoint);
        if (distToSpawn > mobData.aggroRange * 1.5) continue;
      }

      if (dist <= mobData.aggroRange && dist < closestDist) {
        closestDist = dist;
        closestTarget = e;
      }
    }

    if (closestTarget) {
      ai.targetId = closestTarget.id;
      this.transitionTo(mob, ai, "chase");
    }
  }

  // ==========================================================
  // Атака
  // ==========================================================

  private performAttack(
    mob: Entity,
    ai: MobAIComponent,
    combat: CombatComponent,
    physics: PhysicsComponent,
    target: Entity,
    mobData?: MobData
  ): void {
    const damage = mobData?.damage ?? combat.damage ?? 5;
    this.combatSystem.applyDamage(target, damage, mob, "melee");
  }

  // ==========================================================
  // Патруль
  // ==========================================================

  private pickPatrolPoint(ai: MobAIComponent): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = PATROL_RADIUS * (0.3 + Math.random() * 0.7);
    ai.patrolTarget = {
      x: ai.spawnPoint.x + Math.cos(angle) * dist,
      y: ai.spawnPoint.y + Math.sin(angle) * dist,
    };
  }

  // ==========================================================
  // Уклонение от бомб
  // ==========================================================

  private checkBombDodge(
    mob: Entity,
    ai: MobAIComponent,
    physics: PhysicsComponent,
    entities: Entity[],
    dt: number
  ): void {
    // Уже уклоняемся
    if (ai.dodgeTimer > 0) return;

    const mobData = MOBS[ai.mobTypeId];
    const dodgeChance = mobData?.dodgeChance ?? 0;
    if (dodgeChance <= 0) return;

    // Ищем бомбы рядом
    for (const e of entities) {
      if (!e.tags.has("bomb")) continue;
      const bombPhys = e.components.get("physics") as
        | PhysicsComponent
        | undefined;
      if (!bombPhys) continue;

      const dist = vec2Dist(physics.position, bombPhys.position);

      // Бомба в опасной зоне
      if (dist < TILE_PX * 3) {
        // Проверяем шанс уклонения
        if (Math.random() < dodgeChance) {
          // Выбираем направление уклонения — перпендикулярно к бомбе
          const toBomb = {
            x: bombPhys.position.x - physics.position.x,
            y: bombPhys.position.y - physics.position.y,
          };
          // Перпендикуляр
          const perp = {
            x: -toBomb.y,
            y: toBomb.x,
          };
          const dir = vec2Normalize(perp);

          // Случайное направление (влево или вправо)
          if (Math.random() < 0.5) {
            dir.x *= -1;
            dir.y *= -1;
          }

          ai.dodgeDirection = dir;
          ai.dodgeTimer = DODGE_DURATION;
          ai.lastBombPosition = { ...bombPhys.position };
          break;
        }
      }
    }
  }

  // ==========================================================
  // Фазы босса
  // ==========================================================

  private updateBossPhase(
    mob: Entity,
    ai: MobAIComponent,
    combat: CombatComponent,
    mobData: MobData
  ): void {
    if (!mobData.isBoss || !mobData.bossPhases) return;

    const hpRatio = combat.hp / combat.maxHp;

    // Определяем текущую фазу
    let targetPhase = 0;
    for (let i = mobData.bossPhases.length - 1; i >= 0; i--) {
      if (hpRatio <= mobData.bossPhases[i].hpThreshold) {
        targetPhase = i;
        break;
      }
    }

    if (targetPhase !== ai.currentPhase) {
      // Смена фазы!
      ai.currentPhase = targetPhase;
      const phase = mobData.bossPhases[targetPhase];
      ai.hasSpawnedAdds = false;

      // Применяем модификаторы
      physics.speed = (mobData.speed * (phase.speedMult ?? 1));
      ai.attackCooldown =
        ATTACK_COOLDOWN_BASE / (phase.damageMult ?? 1);

      // Коллбэк
      this.onBossPhaseChange?.(mob, phase);
    }

    // Спавн аддов
    const phase = mobData.bossPhases[targetPhase];
    if (phase.spawnMobs && !ai.hasSpawnedAdds) {
      const now = performance.now();
      const lastSummon = this.bossSummonTimers.get(mob.id) ?? 0;
      if (now - lastSummon >= BOSS_SUMMON_COOLDOWN) {
        this.summonAdds(mob, ai, physics, phase.spawnMobs);
        ai.hasSpawnedAdds = true;
        this.bossSummonTimers.set(mob.id, now);
      }
    }

    // Сброс hasSpawnedAdds если HP упало ниже следующего порога
    // (чтобы спавнить снова при повторном входе в фазу — но это одноразово)
  }

  private summonAdds(
    boss: Entity,
    ai: MobAISystemComponent,
    physics: PhysicsComponent,
    mobTypes: string[]
  ): void {
    const positions: Vec2[] = [];
    for (let i = 0; i < mobTypes.length; i++) {
      const angle = (Math.PI * 2 * i) / mobTypes.length + Math.random() * 0.5;
      const dist = TILE_PX * 4;
      positions.push({
        x: physics.position.x + Math.cos(angle) * dist,
        y: physics.position.y + Math.sin(angle) * dist,
      });
    }

    for (let i = 0; i < mobTypes.length; i++) {
      this.onBossSummon?.(boss, mobTypes[i], [positions[i]]);
    }
  }

  // ==========================================================
  // Смерть
  // ==========================================================

  private handleDeath(
    mob: Entity,
    ai: MobAIComponent,
    _combat: CombatComponent
  ): void {
    mob.tags.add("dead");

    const mobData = MOBS[ai.mobTypeId];
    if (mobData) {
      this.onMobDeath?.(mob, mobData, ai.targetId);
    }
  }

  // ==========================================================
  // Фабрики
  // ==========================================================

  /** Создать моба по типу. */
  static createMob(
    id: string,
    mobTypeId: string,
    x: number,
    y: number,
    level = 1
  ): Entity {
    const mobData = MOBS[mobTypeId];
    if (!mobData) {
      throw new Error(`Unknown mob type: ${mobTypeId}`);
    }

    // Масштабирование от уровня
    const levelMult = 1 + (level - 1) * 0.15;
    const hp = Math.floor(mobData.hp * levelMult);
    const damage = Math.floor(mobData.damage * levelMult);
    const speed = mobData.speed;

    const entity: Entity = {
      id,
      components: new Map(),
      tags: new Set(["mob", "enemy"]),
    };

    const ai: MobAIComponent = {
      type: "mob_ai",
      mobTypeId,
      currentState: "idle",
      stateTimer: 0,
      spawnPoint: vec2(x, y),
      targetId: "",
      attackTimer: 0,
      attackCooldown: ATTACK_COOLDOWN_BASE,
      currentPhase: 0,
      hasSpawnedAdds: false,
      dodgeTimer: 0,
      idleTime: 0,
    };

    entity.components.set("mob_ai", ai);
    entity.components.set(
      "combat",
      CombatSystem.makeCombat(hp, "enemy", Math.floor(level * 0.5))
    );
    (entity.components.get("combat") as CombatComponent).damage = damage;
    entity.components.set(
      "physics",
      CombatSystem.makePhysics(x, y, speed, TILE_PX * mobData.renderSize * 0.4)
    );

    return entity;
  }
}

// Type alias for the summon method
interface MobAISystemComponent extends MobAIComponent {}

// ============================================================
// Рендеринг мобов (Canvas 2D)
// ============================================================

export function renderMob(
  ctx: CanvasRenderingContext2D,
  mob: Entity,
  mobData: MobData,
  physics: PhysicsComponent
): void {
  const x = physics.position.x;
  const y = physics.position.y;
  const size = TILE_PX * mobData.renderSize;

  ctx.save();
  ctx.translate(x, y);

  // Тень
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.4, size * 0.4, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Тело
  ctx.fillStyle = mobData.color;
  ctx.beginPath();

  if (mobData.id === "slime") {
    // Слайм: капля
    const bounce = Math.sin(performance.now() * 0.005) * 3;
    ctx.ellipse(0, -size * 0.1 + bounce, size * 0.4, size * 0.35, 0, 0, Math.PI * 2);
  } else if (mobData.id === "boar") {
    // Кабан: овал
    ctx.ellipse(0, 0, size * 0.45, size * 0.35, 0, 0, Math.PI * 2);
  } else if (mobData.id === "bandit") {
    // Бандит: прямоугольник с капюшоном
    ctx.roundRect(-size * 0.3, -size * 0.4, size * 0.6, size * 0.7, 4);
  } else if (mobData.id === "treant") {
    // Древо: широкий овал + ветви
    ctx.ellipse(0, 0, size * 0.5, size * 0.4, 0, 0, Math.PI * 2);
  } else if (mobData.id === "boss_root") {
    // Босс: большой круг с пульсацией
    const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.05;
    ctx.arc(0, 0, size * 0.45 * pulse, 0, Math.PI * 2);
  } else {
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
  }

  ctx.fill();

  // Глаза
  const eyeY = -size * 0.1;
  const eyeOffset = size * 0.15;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-eyeOffset, eyeY, size * 0.1, 0, Math.PI * 2);
  ctx.arc(eyeOffset, eyeY, size * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Зрачки (смотрят на цель — упрощенно, просто двигаются)
  const pupilShift = Math.sin(performance.now() * 0.002) * 2;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(-eyeOffset + pupilShift, eyeY, size * 0.05, 0, Math.PI * 2);
  ctx.arc(eyeOffset + pupilShift, eyeY, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Босс: дополнительные визуальные эффекты
  if (mobData.isBoss) {
    // Аура вокруг босса
    ctx.strokeStyle = `rgba(139, 0, 139, ${0.3 + Math.sin(performance.now() * 0.004) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // Имя босса
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(mobData.name, 0, -size * 0.65);
  }

  // HP bar
  const combat = mob.components.get("combat") as CombatComponent | undefined;
  if (combat && combat.isAlive) {
    const barWidth = size * 0.8;
    const barHeight = 4;
    const barY = size * 0.5;
    const hpRatio = combat.hp / combat.maxHp;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    ctx.fillStyle = hpRatio > 0.5 ? "#44ff44" : hpRatio > 0.25 ? "#ffaa00" : "#ff4444";
    ctx.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);
  }

  ctx.restore();
}

/** Отрисовка имени моба. */
export function renderMobLabel(
  ctx: CanvasRenderingContext2D,
  mobData: MobData,
  physics: PhysicsComponent
): void {
  ctx.fillStyle = "#fff";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  const label = mobData.isBoss ? `★ ${mobData.name}` : mobData.name;
  ctx.strokeText(label, physics.position.x, physics.position.y - TILE_PX * mobData.renderSize * 0.7);
  ctx.fillText(label, physics.position.x, physics.position.y - TILE_PX * mobData.renderSize * 0.7);
}
