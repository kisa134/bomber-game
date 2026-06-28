/**
 * SkillSystem.ts — система скиллов для BomberMeme World campaign.
 *
 * ECS System: уникальные скиллы с кулдаунами, маной и эффектами.
 * Phase 1: 3 скилла — Цепная Реакция, Гнев Природы, Песчаная Буря.
 */

import { TILE_PX } from "@bomberpump/shared";
import {
  Vec2,
  vec2,
  vec2Dist,
  Entity,
  World,
  System,
  CombatSystem,
  ManaComponent,
  PhysicsComponent,
  CombatComponent,
} from "./CombatSystem";
import { BombSystem } from "./BombSystem";

// ============================================================
// Эффекты скиллов
// ============================================================

export type SkillEffectType =
  | "chain"      // цепной взрыв
  | "summon"     // призыв сущностей
  | "aura";      // аура (замедление + невидимость)

export interface ChainEffect {
  type: "chain";
  /** Радиус цепного взрыва (px). */
  radius: number;
  /** Множитель урона цепи. */
  multiplier: number;
}

export interface SummonEffect {
  type: "summon";
  /** Тип призываемой сущности. */
  entityType: string;
  /** Количество. */
  count: number;
  /** Радиус размещения вокруг кастера (px). */
  radius: number;
}

export interface AuraEffect {
  type: "aura";
  /** Радиус ауры (px). */
  radius: number;
  /** Множитель скорости врагов (0.5 = -50%). */
  slowEnemy: number;
  /** Невидимость кастера. */
  stealthSelf: boolean;
}

export type SkillEffect = ChainEffect | SummonEffect | AuraEffect;

// ============================================================
// Скилл
// ============================================================

export interface Skill {
  id: string;
  name: string;
  description: string;
  cooldown: number;   // ms
  manaCost: number;
  castTime: number;   // ms (0 = мгновенно)
  /** Длительность эффекта (ms), undefined = мгновенный. */
  duration?: number;
  /** Иконка (имя файла в public/sprites/). */
  icon: string;
  effect: SkillEffect;
}

// ============================================================
// 3 уникальных скилла Phase 1
// ============================================================

export const UNIQUE_SKILLS: Record<string, Skill> = {
  chain_reaction: {
    id: "chain_reaction",
    name: "Цепная Реакция",
    description:
      "Следующая бомба мгновенно взрывает все бомбы в радиусе 200px",
    cooldown: 8000,
    manaCost: 30,
    castTime: 0,
    icon: "powerup_fire", // переиспользуем ассет
    effect: { type: "chain", radius: 200, multiplier: 1.5 },
  },
  nature_wrath: {
    id: "nature_wrath",
    name: "Гнев Природы",
    description: "Призывает 3 терновых ловушки вокруг себя",
    cooldown: 12000,
    manaCost: 40,
    castTime: 500,
    icon: "powerup_bomb", // переиспользуем ассет
    effect: {
      type: "summon",
      entityType: "thorn_trap",
      count: 3,
      radius: 150,
    },
  },
  sand_storm: {
    id: "sand_storm",
    name: "Песчаная Буря",
    description:
      "Враги в радиусе 300px замедлены на 50%, вы невидимы 3 сек",
    cooldown: 15000,
    manaCost: 45,
    castTime: 1000,
    duration: 3000,
    icon: "powerup_speed", // переиспользуем ассет
    effect: {
      type: "aura",
      radius: 300,
      slowEnemy: 0.5,
      stealthSelf: true,
    },
  },
};

// ============================================================
// Состояние кулдауна
// ============================================================

interface CooldownEntry {
  skillId: string;
  remaining: number; // ms
  total: number;     // ms
}

/** Активный эффект ауры. */
interface ActiveAura {
  entityId: string;
  skillId: string;
  startTime: number;
  duration: number;
  radius: number;
  slowEnemy: number;
  stealthSelf: boolean;
}

/** Активный каст (channeling). */
interface ActiveCast {
  entityId: string;
  skill: Skill;
  startTime: number;
  elapsed: number;
  isComplete: boolean;
}

// ============================================================
// ThornTrap — призываемая ловушка
// ============================================================

export interface ThornTrapComponent {
  type: "thorn_trap";
  ownerId: string;
  damage: number;
  radius: number;
  lifetime: number; // ms
  elapsed: number;
  isTriggered: boolean;
}

export function createThornTrap(
  id: string,
  ownerId: string,
  position: Vec2,
  damage = 15
): Entity {
  return {
    id,
    components: new Map([
      [
        "thorn_trap",
        {
          type: "thorn_trap",
          ownerId,
          damage,
          radius: TILE_PX * 1.5,
          lifetime: 8000,
          elapsed: 0,
          isTriggered: false,
        } as ThornTrapComponent,
      ],
      [
        "physics",
        {
          type: "physics",
          position: { ...position },
          velocity: vec2(0, 0),
          speed: 0,
          hitboxRadius: TILE_PX * 0.8,
        },
      ],
      [
        "combat",
        CombatSystem.makeCombat(1, "neutral", 0),
      ],
    ]),
    tags: new Set(["trap", "summoned"]),
  };
}

// ============================================================
// SkillSystem
// ============================================================

export class SkillSystem extends System {
  componentsRequired = ["combat", "physics"];

  /** Кулдауны: entityId -> Map<skillId, CooldownEntry> */
  private cooldowns = new Map<string, Map<string, CooldownEntry>>();

  /** Активные ауры. */
  private activeAuras: ActiveAura[] = [];

  /** Активные касты (channeling). */
  private activeCasts: ActiveAura[] = [];

  /** Коллбэк на использование скилла (для UI, частиц). */
  onSkillUse:
    | ((entity: Entity, skill: Skill, position: Vec2) => void)
    | null = null;

  /** Коллбэк на summon (для спавна ловушек). */
  onSummon:
    | ((entity: Entity, entityType: string, positions: Vec2[]) => void)
    | null = null;

  constructor(
    private combatSystem: CombatSystem,
    private bombSystem: BombSystem
  ) {
    super();
  }

  update(entities: Entity[], dt: number): void {
    // 1. Обновление кулдаунов
    this.updateCooldowns(dt);

    // 2. Обновление активных аур
    this.updateAuras(entities, dt);

    // 3. Обновление ловушек (thorn traps)
    this.updateTraps(entities, dt);
  }

  // ==========================================================
  // Использование скилла
  // ==========================================================

  /**
   * Использовать скилл.
   * @returns true если скилл успешно использован, false если кулдаун/нет маны.
   */
  useSkill(user: Entity, skill: Skill, world: World): boolean {
    const mana = user.components.get("mana") as ManaComponent | undefined;
    const combat = user.components.get("combat") as CombatComponent | undefined;
    const physics = user.components.get("physics") as PhysicsComponent | undefined;
    if (!combat || !physics) return false;

    // Проверка кулдауна
    const cd = this.getCooldownRemaining(user.id, skill.id);
    if (cd > 0) return false;

    // Проверка маны
    if (mana && mana.mana < skill.manaCost) return false;

    // Списание маны
    if (mana) {
      mana.mana -= skill.manaCost;
    }

    // Установка кулдауна
    this.setCooldown(user.id, skill.id, skill.cooldown);

    // Каст-тайм (channeling)
    if (skill.castTime > 0) {
      // Для простоты: каст мгновенно, но можно добавить channeling позже
      // В Phase 1 castTime используется как задержка визуального эффекта
    }

    // Применение эффекта
    switch (skill.effect.type) {
      case "chain":
        this.applyChainEffect(user, skill.effect, world);
        break;
      case "summon":
        this.applySummonEffect(user, skill.effect, world);
        break;
      case "aura":
        this.applyAuraEffect(user, skill);
        break;
    }

    // Коллбэк
    this.onSkillUse?.(user, skill, physics.position);

    return true;
  }

  // ==========================================================
  // Chain Reaction
  // ==========================================================

  private applyChainEffect(
    user: Entity,
    effect: ChainEffect,
    world: World
  ): void {
    const physics = user.components.get("physics") as PhysicsComponent;
    if (!physics) return;

    const center = physics.position;
    const allEntities = world.entities;

    // Ищем бомбы в радиусе и мгновенно взрываем
    for (const e of allEntities) {
      if (!e.tags.has("bomb")) continue;
      const ePhys = e.components.get("physics") as PhysicsComponent | undefined;
      if (!ePhys) continue;

      const dist = vec2Dist(center, ePhys.position);
      if (dist <= effect.radius) {
        // Усиливаем урон
        const bomb = e.components.get("bomb") as
          | import("./BombSystem").BombComponent
          | undefined;
        if (bomb) {
          bomb.damage = Math.floor(bomb.damage * effect.multiplier);
          bomb.fuseLeft = 0; // мгновенный взрыв
        }
      }
    }

    // Визуальный эффект: помечаем все бомбы в радиусе как "chained"
    // (для отрисовки связи линией)
    for (const e of allEntities) {
      if (!e.tags.has("bomb")) continue;
      const ePhys = e.components.get("physics") as PhysicsComponent | undefined;
      if (!ePhys) continue;
      if (vec2Dist(center, ePhys.position) <= effect.radius) {
        e.tags.add("chained");
      }
    }
  }

  // ==========================================================
  // Nature's Wrath (Summon)
  // ==========================================================

  private applySummonEffect(
    user: Entity,
    effect: SummonEffect,
    world: World
  ): void {
    const physics = user.components.get("physics") as PhysicsComponent;
    if (!physics) return;

    const positions: Vec2[] = [];
    for (let i = 0; i < effect.count; i++) {
      const angle = (Math.PI * 2 * i) / effect.count;
      const pos: Vec2 = {
        x: physics.position.x + Math.cos(angle) * effect.radius,
        y: physics.position.y + Math.sin(angle) * effect.radius,
      };
      positions.push(pos);

      // Создаем ловушку
      const trap = createThornTrap(
        `trap_${user.id}_${i}_${performance.now()}`,
        user.id,
        pos,
        15 + Math.floor(Math.random() * 10)
      );
      world.addEntity(trap);
    }

    this.onSummon?.(user, effect.entityType, positions);
  }

  // ==========================================================
  // Sand Storm (Aura)
  // ==========================================================

  private applyAuraEffect(user: Entity, skill: Skill): void {
    const effect = skill.effect as AuraEffect;
    const physics = user.components.get("physics") as PhysicsComponent;
    if (!physics) return;

    // Добавляем активную ауру
    this.activeAuras.push({
      entityId: user.id,
      skillId: skill.id,
      startTime: performance.now(),
      duration: skill.duration ?? 3000,
      radius: effect.radius,
      slowEnemy: effect.slowEnemy,
      stealthSelf: effect.stealthSelf,
    });

    // Невидимость
    if (effect.stealthSelf) {
      user.tags.add("stealthed");
    }
  }

  // ==========================================================
  // Обновление аур
  // ==========================================================

  private updateAuras(entities: Entity[], dt: number): void {
    const now = performance.now();
    const toRemove: number[] = [];

    for (let i = 0; i < this.activeAuras.length; i++) {
      const aura = this.activeAuras[i];
      const elapsed = now - aura.startTime;

      if (elapsed >= aura.duration) {
        // Аура закончилась
        toRemove.push(i);
        // Убираем невидимость
        if (aura.stealthSelf) {
          const entity = entities.find((e) => e.id === aura.entityId);
          if (entity) {
            entity.tags.delete("stealthed");
          }
        }
        continue;
      }

      // Применяем замедление врагов в радиусе
      const caster = entities.find((e) => e.id === aura.entityId);
      if (!caster) continue;

      const cPhysics = caster.components.get("physics") as PhysicsComponent;
      if (!cPhysics) continue;

      for (const e of entities) {
        if (e.id === aura.entityId) continue;
        const ePhysics = e.components.get("physics") as
          | PhysicsComponent
          | undefined;
        const eCombat = e.components.get("combat") as
          | CombatComponent
          | undefined;
        if (!ePhysics || !eCombat) continue;
        if (eCombat.team === "player") continue; // не замедляем союзников

        const dist = vec2Dist(cPhysics.position, ePhysics.position);
        if (dist <= aura.radius) {
          e.tags.add("slowed");
          // Сохраняем множитель скорости в компоненте
          // (фактическое применение в MovementSystem)
          (e as any)._slowMultiplier = aura.slowEnemy;
        } else {
          e.tags.delete("slowed");
          delete (e as any)._slowMultiplier;
        }
      }
    }

    // Удаляем завершенные ауры
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const removed = this.activeAuras.splice(toRemove[i], 1)[0];
      // Чистим теги
      if (removed.stealthSelf) {
        const entity = entities.find((e) => e.id === removed.entityId);
        if (entity) entity.tags.delete("stealthed");
      }
    }
  }

  // ==========================================================
  // Обновление ловушек
  // ==========================================================

  private updateTraps(entities: Entity[], dt: number): void {
    for (const e of entities) {
      if (!e.tags.has("trap")) continue;
      const trap = e.components.get("thorn_trap") as
        | ThornTrapComponent
        | undefined;
      if (!trap) continue;

      trap.elapsed += dt;

      // Удаляем по таймауту
      if (trap.elapsed >= trap.lifetime) {
        e.tags.add("dead");
        continue;
      }

      // Проверяем триггер: враг в радиусе
      if (!trap.isTriggered) {
        const trapPhys = e.components.get("physics") as PhysicsComponent;
        if (!trapPhys) continue;

        for (const other of entities) {
          if (other.id === trap.ownerId) continue;
          const oPhys = other.components.get("physics") as
            | PhysicsComponent
            | undefined;
          const oCombat = other.components.get("combat") as
            | CombatComponent
            | undefined;
          if (!oPhys || !oCombat) continue;
          if (!oCombat.isAlive) continue;

          const dist = vec2Dist(trapPhys.position, oPhys.position);
          if (dist <= trap.radius) {
            // Триггер!
            trap.isTriggered = true;
            this.combatSystem.applyDamage(other, trap.damage, undefined, "magic");
            e.tags.add("dead"); // Одноразовая
            break;
          }
        }
      }
    }
  }

  // ==========================================================
  // Кулдауны
  // ==========================================================

  updateCooldowns(dt: number): void {
    for (const [, map] of this.cooldowns) {
      for (const [, entry] of map) {
        entry.remaining = Math.max(0, entry.remaining - dt);
      }
    }
  }

  getCooldownRemaining(entityId: string, skillId: string): number {
    const map = this.cooldowns.get(entityId);
    if (!map) return 0;
    const entry = map.get(skillId);
    return entry?.remaining ?? 0;
  }

  /** Получить все кулдауны сущности (для UI хотбара). */
  getAllCooldowns(entityId: string): Map<string, number> {
    const map = this.cooldowns.get(entityId);
    if (!map) return new Map();
    const result = new Map<string, number>();
    for (const [skillId, entry] of map) {
      result.set(skillId, entry.remaining);
    }
    return result;
  }

  private setCooldown(
    entityId: string,
    skillId: string,
    totalMs: number
  ): void {
    let map = this.cooldowns.get(entityId);
    if (!map) {
      map = new Map();
      this.cooldowns.set(entityId, map);
    }
    map.set(skillId, { skillId, remaining: totalMs, total: totalMs });
  }

  // ==========================================================
  // Регенерация маны
  // ==========================================================

  updateManaRegen(entities: Entity[], dt: number): void {
    const dtSec = dt / 1000;
    for (const e of entities) {
      const mana = e.components.get("mana") as ManaComponent | undefined;
      if (!mana) continue;
      mana.mana = Math.min(mana.maxMana, mana.mana + mana.manaRegen * dtSec);
    }
  }

  // ==========================================================
  // Рендеринг
  // ==========================================================

  /** Отрисовка активных аур (Canvas 2D). */
  renderAuras(ctx: CanvasRenderingContext2D, entities: Entity[]): void {
    const now = performance.now();

    for (const aura of this.activeAuras) {
      const entity = entities.find((e) => e.id === aura.entityId);
      if (!entity) continue;
      const phys = entity.components.get("physics") as PhysicsComponent;
      if (!phys) continue;

      const elapsed = now - aura.startTime;
      const progress = elapsed / aura.duration;
      const alpha = 1 - progress;

      // Вихрь песка
      ctx.save();
      ctx.translate(phys.position.x, phys.position.y);
      ctx.globalAlpha = alpha * 0.4;

      // Вращающиеся частицы песка
      const particleCount = 12;
      for (let i = 0; i < particleCount; i++) {
        const angle =
          (Math.PI * 2 * i) / particleCount + elapsed * 0.003;
        const r = aura.radius * (0.3 + 0.7 * Math.sin(progress * Math.PI));
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        ctx.fillStyle = `rgba(210, 180, 100, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, 3 + Math.sin(elapsed * 0.01 + i) * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Радиус ауры
      ctx.strokeStyle = `rgba(210, 180, 100, ${alpha * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, aura.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  /** Отрисовка ловушек (Canvas 2D). */
  renderTraps(ctx: CanvasRenderingContext2D, entities: Entity[]): void {
    for (const e of entities) {
      if (!e.tags.has("trap")) continue;
      const trap = e.components.get("thorn_trap") as
        | ThornTrapComponent
        | undefined;
      const phys = e.components.get("physics") as PhysicsComponent | undefined;
      if (!trap || !phys) continue;

      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);

      // Основание ловушки
      ctx.fillStyle = trap.isTriggered
        ? "rgba(200, 50, 50, 0.8)"
        : `rgba(50, 150, 50, ${0.5 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(phys.position.x, phys.position.y, TILE_PX * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Шипы
      const spikeCount = 6;
      ctx.strokeStyle = trap.isTriggered ? "#ff6666" : "#44ff44";
      ctx.lineWidth = 2;
      for (let i = 0; i < spikeCount; i++) {
        const angle = (Math.PI * 2 * i) / spikeCount;
        const innerR = TILE_PX * 0.2;
        const outerR = TILE_PX * 0.5 * (0.8 + pulse * 0.2);
        ctx.beginPath();
        ctx.moveTo(
          phys.position.x + Math.cos(angle) * innerR,
          phys.position.y + Math.sin(angle) * innerR
        );
        ctx.lineTo(
          phys.position.x + Math.cos(angle) * outerR,
          phys.position.y + Math.sin(angle) * outerR
        );
        ctx.stroke();
      }

      // Радиус триггера (для отладки, можно убрать)
      ctx.strokeStyle = "rgba(50, 150, 50, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(phys.position.x, phys.position.y, trap.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Отрисовка полосы кулдауна на иконке (Canvas 2D). */
  renderCooldownOverlay(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    remaining: number,
    total: number
  ): void {
    if (remaining <= 0) return;

    const progress = remaining / total;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(x, y, size, size * progress);

    // Текст таймера
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      Math.ceil(remaining / 1000).toString(),
      x + size / 2,
      y + size / 2
    );
  }
}
