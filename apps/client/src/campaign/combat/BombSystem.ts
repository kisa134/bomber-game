/**
 * BombSystem.ts — система бомб для BomberMeme World campaign.
 *
 * ECS System: обрабатывает бомбы (fuse, траектория, взрыв, AoE, цепные реакции).
 * - Заряд броска (чем дольше ЛКМ, тем дальше)
 * - Траектория: дуга с гравитацией / прямая / отскок
 * - AoE урон через CombatSystem
 * - Цепные взрывы
 */

import { TILE_PX, BOMB_TIMER_MS } from "@bomberpump/shared";
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
  DamageType,
} from "./CombatSystem";

// ============================================================
// Типы бомб
// ============================================================

export interface BombType {
  id: string;
  name: string;
  damage: number;
  radius: number; // px
  fuseTime: number; // ms
  throwDistance: number; // px max
  trajectory: "arc" | "straight" | "bounce";
  /** Специальный эффект: cluster — разделяется на 3 маленькие. */
  special?: string;
  /** Спрайт для отрисовки (переиспользуем ассеты игры). */
  sprite: string;
}

export const BOMB_TYPES: Record<string, BombType> = {
  basic: {
    id: "basic",
    name: "Обычная бомба",
    damage: 20,
    radius: 100,
    fuseTime: 2000,
    throwDistance: 300,
    trajectory: "arc",
    sprite: "bomb",
  },
  sticky: {
    id: "sticky",
    name: "Липучка",
    damage: 25,
    radius: 100,
    fuseTime: 3000,
    throwDistance: 250,
    trajectory: "straight",
    special: "sticky",
    sprite: "bomb",
  },
  bounce: {
    id: "bounce",
    name: "Отскакивающая",
    damage: 15,
    radius: 120,
    fuseTime: 2500,
    throwDistance: 400,
    trajectory: "bounce",
    sprite: "bomb",
  },
  remote: {
    id: "remote",
    name: "Управляемая",
    damage: 30,
    radius: 150,
    fuseTime: 999999, // взрывается по команде
    throwDistance: 200,
    trajectory: "straight",
    special: "remote",
    sprite: "bomb",
  },
  cluster: {
    id: "cluster",
    name: "Кассетная",
    damage: 10,
    radius: 80,
    fuseTime: 2000,
    throwDistance: 200,
    trajectory: "arc",
    special: "cluster",
    sprite: "bomb",
  },
};

// ============================================================
// Компонент бомбы
// ============================================================

export interface BombComponent {
  type: "bomb";
  ownerId: string;
  bombType: BombType;
  /** Время установки (performance.now()). */
  plantedAt: number;
  /** Текущий таймер фитиля (ms). */
  fuseLeft: number;
  /** Радиус взрыва в пикселях. */
  radius: number;
  /** Урон. */
  damage: number;
  /** Прилипла к поверхности? */
  isStuck: boolean;
  /** Для remote-бомбы: активирована? */
  isPrimed: boolean;
  /** Отскоки (для bounce). */
  bounceCount: number;
  maxBounces: number;
  /** Для cluster: выпущены ли осколки? */
  hasFragmented: boolean;
}

// ============================================================
// Заряд броска
// ============================================================

export interface ChargeState {
  isCharging: boolean;
  chargeStartTime: number;
  maxChargeMs: number;
  currentCharge: number; // 0..1
}

export function createChargeState(maxChargeMs = 1500): ChargeState {
  return {
    isCharging: false,
    chargeStartTime: 0,
    maxChargeMs,
    currentCharge: 0,
  };
}

/** Начать заряд. */
export function startCharge(charge: ChargeState): void {
  charge.isCharging = true;
  charge.chargeStartTime = performance.now();
  charge.currentCharge = 0;
}

/** Обновить заряд (возвращает 0..1). */
export function updateCharge(charge: ChargeState): number {
  if (!charge.isCharging) {
    charge.currentCharge = 0;
    return 0;
  }
  const elapsed = performance.now() - charge.chargeStartTime;
  charge.currentCharge = Math.min(1, elapsed / charge.maxChargeMs);
  return charge.currentCharge;
}

/** Отпустить заряд, получить итоговое значение. */
export function releaseCharge(charge: ChargeState): number {
  const result = charge.currentCharge;
  charge.isCharging = false;
  charge.currentCharge = 0;
  return result;
}

// ============================================================
// Траектория
// ============================================================

/** Гравитация для дуговой траектории (px/s^2). */
const GRAVITY = 1200;

export interface TrajectoryState {
  startPos: Vec2;
  targetPos: Vec2;
  velocity: Vec2;
  startTime: number;
  duration: number; // ms
  elapsed: number;  // ms
  isFlying: boolean;
  trajectory: "arc" | "straight" | "bounce";
  /** Отскоки: позиции + направления. */
  bounces: Array<{ pos: Vec2; velocity: Vec2 }>;
}

/**
 * Вычислить начальную скорость для дугового броска.
 * Используем фиксированный угол ~45° для красивой дуги.
 */
function calcArcVelocity(
  from: Vec2,
  to: Vec2,
  distance: number
): Vec2 {
  const dir = vec2Normalize({ x: to.x - from.x, y: to.y - from.y });
  const angle = -Math.PI / 4; // 45° вверх
  const speed = Math.sqrt(distance * GRAVITY); // упрощенный расчет
  return {
    x: dir.x * speed * Math.cos(Math.abs(angle)),
    y: dir.y * speed * 0.5 + Math.sin(angle) * speed * 0.5,
  };
}

/**
 * Вычислить позицию по дуговой траектории.
 */
function getArcPosition(state: TrajectoryState): Vec2 {
  const t = state.elapsed / 1000; // в секунды
  return {
    x: state.startPos.x + state.velocity.x * t,
    y: state.startPos.y + state.velocity.y * t + 0.5 * GRAVITY * t * t,
  };
}

/**
 * Вычислить позицию по прямой траектории.
 */
function getStraightPosition(state: TrajectoryState): Vec2 {
  const t = state.elapsed / 1000;
  return {
    x: state.startPos.x + state.velocity.x * t,
    y: state.startPos.y + state.velocity.y * t,
  };
}

// ============================================================
// BombSystem
// ============================================================

/** Цепной радиус: бомбы ближе этого расстояния детонируют цепью. */
const CHAIN_RADIUS = 140;
/** Порог для кассетной бомбы: количество осколков. */
const CLUSTER_FRAGMENTS = 3;
/** Разброс осколков (px). */
const CLUSTER_SPREAD = 60;

export class BombSystem extends System {
  componentsRequired = ["bomb", "physics"];

  /** Заряд броска игрока. */
  playerCharge: ChargeState = createChargeState(1500);

  /** Траектории летящих бомб: entityId -> state. */
  private trajectories = new Map<string, TrajectoryState>();

  /** Активные взрывы: entityId -> { center, radius, elapsed }. */
  private explosions = new Map<
    string,
    { center: Vec2; radius: number; damage: number; elapsed: number; maxLife: number }
  >();

  /** Коллбэк на событие взрыва (для эффектов, звука). */
  onExplosion:
    | ((
        center: Vec2,
        radius: number,
        bombType: BombType,
        sourceId: string
      ) => void)
    | null = null;

  constructor(private combatSystem: CombatSystem) {
    super();
  }

  update(entities: Entity[], dt: number): void {
    const bombs = this.filter(entities);

    // 1. Обновление фитилей и траекторий
    for (const bombEntity of bombs) {
      const bomb = bombEntity.components.get("bomb") as BombComponent;
      const physics = bombEntity.components.get("physics") as PhysicsComponent;

      // Обновление таймера
      bomb.fuseLeft -= dt;

      // Если летит — обновить траекторию
      const traj = this.trajectories.get(bombEntity.id);
      if (traj && traj.isFlying) {
        traj.elapsed += dt;
        let pos: Vec2;

        if (bomb.bombType.trajectory === "arc") {
          pos = getArcPosition(traj);
        } else if (bomb.bombType.trajectory === "bounce") {
          pos = this.updateBounceTrajectory(bombEntity, bomb, traj, dt);
        } else {
          pos = getStraightPosition(traj);
        }

        physics.position = pos;

        // Проверка приземления для дуги
        if (
          bomb.bombType.trajectory === "arc" &&
          pos.y >= traj.targetPos.y
        ) {
          traj.isFlying = false;
          physics.position = { ...traj.targetPos };
          this.trajectories.delete(bombEntity.id);

          // Липучка прилипает
          if (bomb.bombType.special === "sticky") {
            bomb.isStuck = true;
          }
        }

        // Прямая траектория — остановка по таймеру или расстоянию
        if (bomb.bombType.trajectory === "straight") {
          const distFlown = vec2Dist(traj.startPos, pos);
          if (distFlown >= vec2Dist(traj.startPos, traj.targetPos)) {
            traj.isFlying = false;
            physics.position = { ...traj.targetPos };
            this.trajectories.delete(bombEntity.id);
            if (bomb.bombType.special === "sticky") {
              bomb.isStuck = true;
            }
          }
        }
      }

      // Автовзрыв по таймеру
      if (bomb.fuseLeft <= 0 && bomb.bombType.special !== "remote") {
        this.detonate(bombEntity, entities);
      }
    }

    // 2. Обновление взрывов (визуальная жизнь)
    for (const [key, exp] of this.explosions) {
      exp.elapsed += dt;
      if (exp.elapsed >= exp.maxLife) {
        this.explosions.delete(key);
      }
    }
  }

  // ==========================================================
  // Бросок бомбы
  // ==========================================================

  /**
   * Бросить бомбу от имени сущности.
   * @param owner — сущность-владелец
   * @param direction — направление броска (нормализованное)
   * @param charge — 0..1 сила заряда
   * @param bombTypeId — тип бомбы
   * @returns созданная сущность бомбы
   */
  throwBomb(
    owner: Entity,
    direction: Vec2,
    charge: number,
    bombTypeId = "basic",
    world?: World
  ): Entity | null {
    const bombType = BOMB_TYPES[bombTypeId];
    if (!bombType) return null;

    const ownerPhysics = owner.components.get("physics") as PhysicsComponent;
    if (!ownerPhysics) return null;

    // Дистанция броска = заряд * max дистанция типа
    const distance = charge * bombType.throwDistance;
    const dir = vec2Normalize(direction);

    // Целевая позиция
    const targetPos: Vec2 = {
      x: ownerPhysics.position.x + dir.x * distance,
      y: ownerPhysics.position.y + dir.y * distance,
    };

    // Создаем сущность бомбы
    const bombEntity: Entity = {
      id: `bomb_${owner.id}_${performance.now()}_${Math.random().toString(36).slice(2, 6)}`,
      components: new Map(),
      tags: new Set(["bomb"]),
    };

    const bombComp: BombComponent = {
      type: "bomb",
      ownerId: owner.id,
      bombType,
      plantedAt: performance.now(),
      fuseLeft: bombType.fuseTime,
      radius: bombType.radius,
      damage: bombType.damage,
      isStuck: false,
      isPrimed: bombType.special === "remote" ? false : true,
      bounceCount: 0,
      maxBounces: bombType.trajectory === "bounce" ? 3 : 0,
      hasFragmented: false,
    };

    const bombPhysics: PhysicsComponent = {
      type: "physics",
      position: { ...ownerPhysics.position },
      velocity: vec2(0, 0),
      speed: 0,
      hitboxRadius: TILE_PX * 0.3,
    };

    bombEntity.components.set("bomb", bombComp);
    bombEntity.components.set("physics", bombPhysics);

    // Инициализация траектории
    if (bombType.trajectory === "arc") {
      const vel = calcArcVelocity(ownerPhysics.position, targetPos, distance);
      const traj: TrajectoryState = {
        startPos: { ...ownerPhysics.position },
        targetPos,
        velocity: vel,
        startTime: performance.now(),
        duration: 1000, // ms estimated
        elapsed: 0,
        isFlying: true,
        trajectory: "arc",
        bounces: [],
      };
      this.trajectories.set(bombEntity.id, traj);
    } else if (bombType.trajectory === "straight") {
      const speed = distance > 0 ? 400 : 0;
      const traj: TrajectoryState = {
        startPos: { ...ownerPhysics.position },
        targetPos,
        velocity: { x: dir.x * speed, y: dir.y * speed },
        startTime: performance.now(),
        duration: (distance / speed) * 1000,
        elapsed: 0,
        isFlying: true,
        trajectory: "straight",
        bounces: [],
      };
      this.trajectories.set(bombEntity.id, traj);
    } else if (bombType.trajectory === "bounce") {
      const speed = 350;
      const traj: TrajectoryState = {
        startPos: { ...ownerPhysics.position },
        targetPos,
        velocity: { x: dir.x * speed, y: dir.y * speed },
        startTime: performance.now(),
        duration: (distance / speed) * 1000,
        elapsed: 0,
        isFlying: true,
        trajectory: "bounce",
        bounces: [],
      };
      this.trajectories.set(bombEntity.id, traj);
    }

    if (world) {
      world.addEntity(bombEntity);
    }

    return bombEntity;
  }

  // ==========================================================
  // Отскок
  // ==========================================================

  private updateBounceTrajectory(
    entity: Entity,
    bomb: BombComponent,
    traj: TrajectoryState,
    dt: number
  ): Vec2 {
    const t = traj.elapsed / 1000;
    let pos = {
      x: traj.startPos.x + traj.velocity.x * t,
      y: traj.startPos.y + traj.velocity.y * t,
    };

    // Упрощенный отскок: инвертируем скорость при "столкновении"
    if (bomb.bounceCount < bomb.maxBounces) {
      // Имитируем отскок через случайное изменение направления
      const bounceInterval =
        (traj.duration / (bomb.maxBounces + 1)) * (bomb.bounceCount + 1);
      if (traj.elapsed >= bounceInterval) {
        bomb.bounceCount++;
        // Отражаем с небольшим случайным отклонением
        const angle = (Math.random() - 0.5) * Math.PI;
        const speed = Math.sqrt(
          traj.velocity.x ** 2 + traj.velocity.y ** 2
        );
        traj.velocity.x = Math.cos(angle) * speed * 0.7; // теряем 30% скорости
        traj.velocity.y = Math.sin(angle) * speed * 0.7;
        traj.startPos = { ...pos };
        traj.elapsed = 0;
        traj.bounces.push({ pos: { ...pos }, velocity: { ...traj.velocity } });
      }
    }

    return pos;
  }

  // ==========================================================
  // Детонация
  // ==========================================================

  /**
   * Взорвать бомбу. Наносит AoE урон, запускает цепные реакции.
   */
  detonate(bombEntity: Entity, allEntities: Entity[]): void {
    const bomb = bombEntity.components.get("bomb") as BombComponent;
    const physics = bombEntity.components.get("physics") as PhysicsComponent;
    if (!bomb || !physics) return;

    const center = { ...physics.position };

    // Удаляем траекторию если была
    this.trajectories.delete(bombEntity.id);

    // Спец-эффекты
    if (bomb.bombType.special === "cluster" && !bomb.hasFragmented) {
      this.spawnClusterFragments(bomb, center, allEntities);
      bomb.hasFragmented = true;
    }

    // AoE урон через CombatSystem
    const owner = allEntities.find((e) => e.id === bomb.ownerId);
    // Создаем временный "мир" для applyAoEDamage
    const mockWorld: World = {
      entities: allEntities,
      addEntity: () => {},
      removeEntity: () => {},
      getEntitiesWith: () => allEntities,
    };
    this.combatSystem.applyAoEDamage(
      center,
      bomb.radius,
      bomb.damage,
      owner,
      mockWorld,
      "bomb"
    );

    // Запоминаем взрыв (для визуализации)
    this.explosions.set(bombEntity.id, {
      center,
      radius: bomb.radius,
      damage: bomb.damage,
      elapsed: 0,
      maxLife: 400, // ms
    });

    // Цепная реакция: взрываем соседние бомбы
    this.triggerChainExplosion(bombEntity, center, allEntities);

    // Коллбэк
    this.onExplosion?.(center, bomb.radius, bomb.bombType, bomb.ownerId);

    // Помечаем бомбу как взорванную
    bombEntity.tags.add("exploded");
    bombEntity.tags.delete("bomb");
    bomb.fuseLeft = 0;
  }

  /**
   * Детонировать бомбу по ID (для remote-бомб).
   */
  detonateById(bombId: string, allEntities: Entity[]): boolean {
    const bomb = allEntities.find(
      (e) => e.id === bombId && e.tags.has("bomb")
    );
    if (bomb) {
      this.detonate(bomb, allEntities);
      return true;
    }
    return false;
  }

  /**
   * Активировать remote-бомбу (взрыв по нажатию).
   */
  primeRemote(bombEntity: Entity): void {
    const bomb = bombEntity.components.get("bomb") as BombComponent;
    if (bomb && bomb.bombType.special === "remote") {
      bomb.isPrimed = true;
      bomb.fuseLeft = 0; // взрываем сразу
    }
  }

  // ==========================================================
  // Цепные взрывы
  // ==========================================================

  private triggerChainExplosion(
    sourceBomb: Entity,
    center: Vec2,
    allEntities: Entity[]
  ): void {
    for (const other of allEntities) {
      if (other.id === sourceBomb.id) continue;
      if (!other.tags.has("bomb")) continue;

      const otherPhysics = other.components.get("physics") as
        | PhysicsComponent
        | undefined;
      if (!otherPhysics) continue;

      const dist = vec2Dist(center, otherPhysics.position);
      if (dist <= CHAIN_RADIUS) {
        // Цепной взрыв с небольшой задержкой
        const otherBomb = other.components.get("bomb") as BombComponent;
        if (otherBomb) {
          otherBomb.fuseLeft = Math.min(otherBomb.fuseLeft, 100); // мгновенный взрыв
        }
      }
    }
  }

  // ==========================================================
  // Кассетная бомба
  // ==========================================================

  private spawnClusterFragments(
    parentBomb: BombComponent,
    center: Vec2,
    allEntities: Entity[]
  ): void {
    for (let i = 0; i < CLUSTER_FRAGMENTS; i++) {
      const angle = (Math.PI * 2 * i) / CLUSTER_FRAGMENTS;
      const offset = {
        x: Math.cos(angle) * CLUSTER_SPREAD,
        y: Math.sin(angle) * CLUSTER_SPREAD,
      };
      const fragPos: Vec2 = {
        x: center.x + offset.x,
        y: center.y + offset.y,
      };

      // Создаем маленькие бомбы-осколки
      const fragEntity: Entity = {
        id: `frag_${parentBomb.ownerId}_${i}_${performance.now()}`,
        components: new Map(),
        tags: new Set(["bomb", "fragment"]),
      };

      const fragType = { ...BOMB_TYPES.basic };
      fragType.damage = Math.floor(parentBomb.damage * 0.5);
      fragType.radius = 60;
      fragType.fuseTime = 500;

      const fragComp: BombComponent = {
        type: "bomb",
        ownerId: parentBomb.ownerId,
        bombType: fragType,
        plantedAt: performance.now(),
        fuseLeft: 500,
        radius: 60,
        damage: fragType.damage,
        isStuck: false,
        isPrimed: true,
        bounceCount: 0,
        maxBounces: 0,
        hasFragmented: false,
      };

      const fragPhysics: PhysicsComponent = {
        type: "physics",
        position: fragPos,
        velocity: vec2(0, 0),
        speed: 0,
        hitboxRadius: TILE_PX * 0.2,
      };

      fragEntity.components.set("bomb", fragComp);
      fragEntity.components.set("physics", fragPhysics);
      allEntities.push(fragEntity);
    }
  }

  // ==========================================================
  // Получение сущностей в радиусе
  // ==========================================================

  getEntitiesInRadius(center: Vec2, radius: number, entities: Entity[]): Entity[] {
    const result: Entity[] = [];
    for (const e of entities) {
      const phys = e.components.get("physics") as PhysicsComponent | undefined;
      const combat = e.components.get("combat") as
        | import("./CombatSystem").CombatComponent
        | undefined;
      if (!phys || !combat?.isAlive) continue;
      if (vec2Dist(center, phys.position) <= radius) {
        result.push(e);
      }
    }
    return result;
  }

  // ==========================================================
  // Рендеринг
  // ==========================================================

  /** Отрисовка всех взрывов (Canvas 2D). */
  renderExplosions(ctx: CanvasRenderingContext2D): void {
    for (const [, exp] of this.explosions) {
      const alpha = 1 - exp.elapsed / exp.maxLife;
      const r = exp.radius * (0.5 + 0.5 * (exp.elapsed / exp.maxLife));

      // Внешнее свечение
      const gradient = ctx.createRadialGradient(
        exp.center.x,
        exp.center.y,
        0,
        exp.center.x,
        exp.center.y,
        r
      );
      gradient.addColorStop(0, `rgba(255, 200, 50, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(255, 100, 20, ${alpha * 0.8})`);
      gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.center.x, exp.center.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Ядро взрыва
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(exp.center.x, exp.center.y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Отрисовка заряда (индикатор над персонажем). */
  renderChargeIndicator(
    ctx: CanvasRenderingContext2D,
    playerPos: Vec2,
    charge: number
  ): void {
    if (charge <= 0) return;

    const barWidth = 40;
    const barHeight = 6;
    const x = playerPos.x - barWidth / 2;
    const y = playerPos.y - TILE_PX * 0.8;

    // Фон
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, y, barWidth, barHeight);

    // Заполнение (цвет меняется от зеленого к красному)
    const r = Math.floor(255 * charge);
    const g = Math.floor(255 * (1 - charge));
    ctx.fillStyle = `rgb(${r},${g},0)`;
    ctx.fillRect(x, y, barWidth * charge, barHeight);

    // Обводка
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
  }

  /** Отрисовка траектории прицеливания (пунктирная линия). */
  renderAimLine(
    ctx: CanvasRenderingContext2D,
    from: Vec2,
    direction: Vec2,
    charge: number,
    bombTypeId = "basic"
  ): void {
    const bombType = BOMB_TYPES[bombTypeId];
    if (!bombType) return;

    const distance = charge * bombType.throwDistance;
    const dir = vec2Normalize(direction);
    const to = {
      x: from.x + dir.x * distance,
      y: from.y + dir.y * distance,
    };

    // Пунктирная линия
    ctx.setLineDash([8, 4]);
    ctx.strokeStyle = charge >= 1 ? "#ff4444" : "#ffffff";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);

    if (bombType.trajectory === "arc") {
      // Дуга
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - distance * 0.4;
      ctx.quadraticCurveTo(midX, midY, to.x, to.y);
    } else {
      ctx.lineTo(to.x, to.y);
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Точка падения
    ctx.fillStyle = charge >= 1 ? "#ff4444" : "#ffffff";
    ctx.beginPath();
    ctx.arc(to.x, to.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Радиус взрыва (полупрозрачный круг)
    ctx.strokeStyle = `rgba(255, 100, 0, 0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(to.x, to.y, bombType.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
