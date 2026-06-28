/**
 * Hero Entity for BomberMeme World.
 * Extends ECS Entity with Sprite, Physics, Combat, RPG, and Inventory components.
 *
 * Issue #3: Character RPG System
 */

import { Entity, Component } from "../engine/ECS";
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

// ─── Components (extend ECS Component base class) ───

/** Sprite component — visual representation */
export class SpriteComponent extends Component {
  skinId: number;
  spritePath: string;
  frameWidth: number;
  frameHeight: number;
  animFrame: number;

  constructor(skinId: number) {
    super("sprite");
    this.skinId = skinId;
    this.spritePath = `skin_${skinId}.webp`;
    this.frameWidth = 32;
    this.frameHeight = 32;
    this.animFrame = 0;
  }
}

/** Physics component — movement and collision */
export class PhysicsComponent extends Component {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  width: number;
  height: number;
  solid: boolean;

  constructor(x = 0, y = 0, speed = 200) {
    super("physics");
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.speed = speed;
    this.width = 24;
    this.height = 24;
    this.solid = true;
  }
}

/** Combat component — HP, damage, status */
export class CombatComponent extends Component {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  damage: number;
  critChance: number;
  armor: number;
  isAlive: boolean;
  invulnTimer: number;

  constructor(hp = 100, mana = 50) {
    super("combat");
    this.hp = hp;
    this.maxHp = hp;
    this.mana = mana;
    this.maxMana = mana;
    this.damage = 20;
    this.critChance = 5;
    this.armor = 0;
    this.isAlive = true;
    this.invulnTimer = 0;
  }
}

/** RPG component — progression, attributes, talents */
export class RPGComponent extends Component {
  progression: ProgressionState;
  attributes: Attributes;
  attributePoints: number;
  talentPoints: number;
  talents: Map<string, Talent>;
  learnedTalentIds: Set<string>;
  heroDef: HeroDefinition;

  constructor(heroDef: HeroDefinition) {
    super("rpg");
    this.progression = createProgressionState();
    this.attributes = { ...heroDef.baseAttributes };
    this.attributePoints = 0;
    this.talentPoints = 0;
    this.talents = createTalentMap();
    this.learnedTalentIds = new Set();
    this.heroDef = heroDef;
  }
}

/** Inventory component — items and bombs */
export class InventoryComponent extends Component {
  inventory: Inventory;

  constructor(inventory: Inventory) {
    super("inventory");
    this.inventory = inventory;
  }
}

// ─── Hero Entity ───

export class Hero extends Entity {
  public readonly heroId: string;
  public readonly skinId: number;

  private _rpg: RPGComponent;
  private _combat: CombatComponent;
  private _physics: PhysicsComponent;

  constructor(heroId: string, skinId: number, heroDef: HeroDefinition) {
    super("hero", heroId);
    this.heroId = heroId;
    this.skinId = skinId;

    const stats = computeEffectiveStats(heroDef.baseAttributes, 1);

    this._rpg = new RPGComponent(heroDef);
    this._combat = new CombatComponent(stats.maxHp, stats.maxMana);
    this._physics = new PhysicsComponent(0, 0, stats.speed);

    this.addComponent(new SpriteComponent(skinId));
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

  get inventory(): Inventory | undefined {
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

  /** Force level-up check (useful after direct XP changes) */
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

  /** Attach inventory component (call after construction) */
  attachInventory(inventory: Inventory): void {
    this.addComponent(new InventoryComponent(inventory));
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
