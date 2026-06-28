// CombatComponent — HP, damage, armor, team, alive state.

import { Component } from "../ECS.js";

export class CombatComponent extends Component {
  hp: number;
  maxHp: number;
  armor: number; // flat damage reduction
  damage: number; // base attack damage
  team: number; // 0 = player-friendly, 1+ = hostile teams
  isAlive: boolean;

  /** Invulnerability timer in ms (counts down). */
  invulnTimer: number;

  /** Knockback multiplier (0 = no knockback). */
  knockback: number;

  /** Critical hit chance 0..1. */
  critChance: number;

  /** Critical damage multiplier (2.0 = double damage). */
  critMultiplier: number;

  constructor(
    maxHp = 100,
    armor = 0,
    damage = 10,
    team = 0,
    knockback = 1,
    critChance = 0.05,
    critMultiplier = 2.0,
  ) {
    super("combat");
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.armor = armor;
    this.damage = damage;
    this.team = team;
    this.isAlive = true;
    this.invulnTimer = 0;
    this.knockback = knockback;
    this.critChance = critChance;
    this.critMultiplier = critMultiplier;
  }

  /** Apply damage, accounting for armor. Returns actual damage dealt. */
  takeDamage(amount: number): number {
    if (!this.isAlive || this.invulnTimer > 0) return 0;
    const actual = Math.max(1, amount - this.armor);
    this.hp -= actual;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
    }
    return actual;
  }

  /** Heal up to maxHp. Returns actual healing done. */
  heal(amount: number): number {
    if (!this.isAlive) return 0;
    const prev = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - prev;
  }

  /** Set invulnerability for a duration in ms. */
  setInvuln(ms: number): void {
    this.invulnTimer = ms;
  }

  /** Update timers (call each tick). */
  update(dt: number): void {
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      if (this.invulnTimer < 0) this.invulnTimer = 0;
    }
  }

  /** Get HP as a fraction 0..1. */
  getHpFraction(): number {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  /** Check if this team can damage another team. */
  canDamage(otherTeam: number): boolean {
    return this.team !== otherTeam;
  }
}
