// RPGComponent — progression, faction, and attributes for campaign entities.

import { Component } from "../ECS.js";
import type { FactionId, Attributes } from "@bomberpump/shared";

export class RPGComponent extends Component {
  level: number;
  xp: number;
  xpToNext: number;
  attributes: Attributes;
  faction: FactionId;

  /** Available skill points to spend on attributes. */
  skillPoints: number;

  /** Derived stats — recalculated when attributes change. */
  maxStamina = 0;
  stamina = 0;
  staminaRegen = 0; // per second

  constructor(
    faction: FactionId = "void",
    level = 1,
    attributes?: Partial<Attributes>,
  ) {
    super("rpg");
    this.level = level;
    this.xp = 0;
    this.xpToNext = this.calcXpToNext(level);
    this.attributes = {
      str: 10,
      dex: 10,
      int: 10,
      vit: 10,
      luck: 10,
      ...attributes,
    };
    this.faction = faction;
    this.skillPoints = 0;
    this.recalcStats();
  }

  /** Award XP. Returns number of level-ups that occurred. */
  addXp(amount: number): number {
    if (amount <= 0) return 0;
    this.xp += amount;
    let levels = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.skillPoints += 3;
      levels++;
      this.xpToNext = this.calcXpToNext(this.level);
    }
    if (levels > 0) this.recalcStats();
    return levels;
  }

  /** Spend a skill point to increase an attribute. */
  spendPoint(attr: keyof Attributes): boolean {
    if (this.skillPoints <= 0) return false;
    this.attributes[attr]++;
    this.skillPoints--;
    this.recalcStats();
    return true;
  }

  /** Recalculate derived stats from attributes. */
  recalcStats(): void {
    const a = this.attributes;
    // VIT -> max HP bonus (handled by CombatComponent sync)
    // DEX -> stamina pool and regen
    this.maxStamina = 50 + a.dex * 5 + this.level * 2;
    this.staminaRegen = 10 + a.dex * 0.8;
    if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
  }

  /** Regenerate stamina. Call each tick. */
  regenStamina(dtSec: number): void {
    this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * dtSec);
  }

  /** Consume stamina for an action. Returns true if enough stamina. */
  useStamina(cost: number): boolean {
    if (this.stamina < cost) return false;
    this.stamina -= cost;
    return true;
  }

  private calcXpToNext(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  /** Get total attribute score (for quick comparison). */
  getTotalAttributes(): number {
    const a = this.attributes;
    return a.str + a.dex + a.int + a.vit + a.luck;
  }
}
