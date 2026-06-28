/**
 * Hero Entity for BomberMeme World.
 * Extends ECS Entity with Sprite, Physics, Combat, RPG, and Inventory components.
 *
 * Issue #3: Character RPG System
 */

import { Entity } from "../engine/ECS";
import {
  type Attributes,
  type AttributeKey,
  type EffectiveStats,
  type HeroDefinition,
  type Talent,
  type BombType,
  type Item,
  computeEffectiveStats,
  allocateAttribute as allocateAttr,
} from "@bomberpump/shared";
import { computeExtendedStats } from "../rpg/Attributes";
import {
  type ProgressionState,
  createProgressionState,
  awardXp,
} from "../rpg/Progression";
import { type Inventory, createTalentMap, learnTalent } from "../rpg";

/** Sprite component — visual representation */
export interface SpriteComponent {
  readonly type: "sprite";
  skinId: number;
  spritePath: string;
  frameWidth: number;
  frameHeight: number;
  animFrame: number;
}

/** Physics component — movement and collision */
export interface PhysicsComponent {
  readonly type: "physics";
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  width: number;
  height: number;
  solid: boolean;
}

/** Combat component — HP, damage, status */
export interface CombatComponent {
  readonly type: "combat";
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  damage: number;
  critChance: number;
  armor: number;
  isAlive: boolean;
  invulnTimer: number;
}

/** RPG component — progression, attributes, talents */
export interface RPGComponent {
  readonly type: "rpg";
  progression: ProgressionState;
  attributes: Attributes;
  attributePoints: number;
  talentPoints: number;
  talents: Map<string, Talent>;
  learnedTalentIds: Set<string>;
  heroDef: HeroDefinition;
}

/** Inventory component — items and bombs */
export interface InventoryComponent {
  readonly type: "inventory";
  inventory: Inventory;
}

export function createSpriteComponent(skinId: number): SpriteComponent {
  return {
    type: "sprite",
    skinId,
    spritePath: `skin_${skinId}.webp`,
    frameWidth: 32,
    frameHeight: 32,
    animFrame: 0,
  };
}

export function createPhysicsComponent(x = 0, y = 0): PhysicsComponent {
  return {
    type: "physics",
    x,
    y,
    vx: 0,
    vy: 0,
    speed: 200,
    width: 24,
    height: 24,
    solid: true,
  };
}

export function createCombatComponent(hp = 100, mana = 50): CombatComponent {
  return {
    type: "combat",
    hp,
    maxHp: hp,
    mana,
    maxMana: mana,
    damage: 20,
    critChance: 5,
    armor: 0,
    isAlive: true,
    invulnTimer: 0,
  };
}

export function createRPGComponent(heroDef: HeroDefinition): RPGComponent {
  return {
    type: "rpg",
    progression: createProgressionState(),
    attributes: { ...heroDef.baseAttributes },
    attributePoints: 0,
    talentPoints: 0,
    talents: createTalentMap(),
    learnedTalentIds: new Set(),
    heroDef,
  };
}

export class Hero extends Entity {
  public readonly heroId: string;
  public readonly skinId: number;

  private _rpg: RPGComponent;
  private _combat: CombatComponent;
  private _physics: PhysicsComponent;

  constructor(heroId: string, skinId: number, heroDef: HeroDefinition) {
    super(heroId);
    this.heroId = heroId;
    this.skinId = skinId;

    this._rpg = createRPGComponent(heroDef);
    this._combat = createCombatComponent(
      computeEffectiveStats(heroDef.baseAttributes, 1).maxHp,
      computeEffectiveStats(heroDef.baseAttributes, 1).maxMana,
    );
    this._physics = createPhysicsComponent(
      computeEffectiveStats(heroDef.baseAttributes, 1).speed,
    );

    this.addComponent(createSpriteComponent(skinId));
    this.addComponent(this._physics);
    this.addComponent(this._combat);
    this.addComponent(this._rpg);
  }

  // ─── Component Access ───

  get rpg(): RPGComponent {
    return this._rpg;
  }

  get combat(): CombatComponent {
    return this._combat;
  }

  get physics(): PhysicsComponent {
    return this._physics;
  }

  get inventory(): InventoryComponent["inventory"] | undefined {
    const inv = this.getComponent<InventoryComponent>("inventory");
    return inv?.inventory;
  }

  // ─── Attributes ───

  /** Allocate an attribute point */
  allocateAttribute(attr: AttributeKey): boolean {
    if (this._rpg.attributePoints <= 0) return false;
    const result = allocateAttr(this._rpg.attributes, attr, 1);
    if (result.remaining < 1) {
      this._rpg.attributes = result.newAttrs;
      this._rpg.attributePoints--;
      this.syncCombatStats();
      return true;
    }
    return false;
  }

  /** Get current attributes */
  getAttributes(): Attributes {
    return { ...this._rpg.attributes };
  }

  // ─── Leveling ───

  /** Award XP and auto-level up */
  gainXp(amount: number): {
    levelsGained: number;
    attributePointsGained: number;
    talentPointsGained: number;
  } {
    const result = awardXp(this._rpg.progression, amount);
    this._rpg.progression = result.newState;
    this._rpg.attributePoints = result.newState.attributePoints;
    this._rpg.talentPoints = result.newState.talentPoints;
    this.syncCombatStats();
    return {
      levelsGained: result.levelsGained,
      attributePointsGained: result.attributePointsGained,
      talentPointsGained: result.talentPointsGained,
    };
  }

  levelUp(): boolean {
    return this.gainXp(0).levelsGained > 0;
  }

  /** Get current level */
  getLevel(): number {
    return this._rpg.progression.level;
  }

  /** Get current XP */
  getXp(): number {
    return this._rpg.progression.xp;
  }

  // ─── Talents ───

  /** Learn a talent (increase its rank) */
  learnTalent(talentId: string): boolean {
    if (this._rpg.talentPoints <= 0) return false;
    const success = learnTalent(
      this._rpg.talents,
      talentId,
      this._rpg.learnedTalentIds,
    );
    if (success) {
      this._rpg.talentPoints--;
      this.syncCombatStats();
    }
    return success;
  }

  /** Get all talents */
  getTalents(): Map<string, Talent> {
    return this._rpg.talents;
  }

  /** Get talents by branch */
  getTalentsByBranch(branch: string): Talent[] {
    return Array.from(this._rpg.talents.values()).filter(
      (t) => t.branch === branch,
    );
  }

  // ─── Bombs ───

  /** Equip a bomb type */
  equipBomb(bombType: BombType): boolean {
    const invComp = this.getComponent<InventoryComponent>("inventory");
    if (!invComp) return false;
    return invComp.inventory.equipBomb(bombType);
  }

  /** Unlock a bomb type */
  unlockBomb(bombType: BombType): boolean {
    const invComp = this.getComponent<InventoryComponent>("inventory");
    if (!invComp) return false;
    return invComp.inventory.unlockBomb(bombType);
  }

  // ─── Inventory ───

  /** Add inventory component (called after construction) */
  attachInventory(inventory: Inventory): void {
    this.addComponent({ type: "inventory", inventory });
  }

  /** Add item to inventory */
  addItem(item: Item): boolean {
    const invComp = this.getComponent<InventoryComponent>("inventory");
    if (!invComp) return false;
    return invComp.inventory.addItem(item);
  }

  /** Remove item from inventory */
  removeItem(slotIndex: number, quantity?: number): Item | null {
    const invComp = this.getComponent<InventoryComponent>("inventory");
    if (!invComp) return null;
    return invComp.inventory.removeItem(slotIndex, quantity);
  }

  // ─── Effective Stats ───

  /** Get effective combat stats derived from attributes + level */
  getEffectiveStats(): EffectiveStats {
    return computeEffectiveStats(
      this._rpg.attributes,
      this._rpg.progression.level,
    );
  }

  /** Get extended stats with all derived values */
  getExtendedStats() {
    return computeExtendedStats(
      this._rpg.attributes,
      this._rpg.progression.level,
    );
  }

  /** Sync combat component with current attributes and level */
  private syncCombatStats(): void {
    const stats = this.getExtendedStats();
    this._combat.maxHp = stats.maxHp;
    this._combat.maxMana = stats.maxMana;
    this._combat.damage = stats.damage;
    this._combat.critChance = stats.critChance;
    this._physics.speed = stats.speed;
    // Clamp current HP/Mana to new max
    this._combat.hp = Math.min(this._combat.hp, this._combat.maxHp);
    this._combat.mana = Math.min(this._combat.mana, this._combat.maxMana);
  }

  // ─── Skill ───

  /** Get the hero's unique skill */
  getSkill() {
    return this._rpg.heroDef.skill;
  }

  /** Get hero lore/flavor text */
  getLore(): string {
    return this._rpg.heroDef.lore;
  }

  /** Get hero definition */
  getHeroDef(): HeroDefinition {
    return this._rpg.heroDef;
  }

  /** Serialize hero state */
  serialize(): object {
    return {
      heroId: this.heroId,
      skinId: this.skinId,
      rpg: {
        progression: this._rpg.progression,
        attributes: this._rpg.attributes,
        attributePoints: this._rpg.attributePoints,
        talentPoints: this._rpg.talentPoints,
        learnedTalentIds: Array.from(this._rpg.learnedTalentIds),
      },
      combat: {
        hp: this._combat.hp,
        mana: this._combat.mana,
      },
      inventory: this.inventory?.serialize(),
    };
  }
}
