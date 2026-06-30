// InputComponent — buffered player input state for one entity.

import { Component } from "../ECS.js";
import type { Vec2 } from "@bomberpump/shared";

export class InputComponent extends Component {
  /** Normalized movement direction vector (-1..1 on each axis). */
  moveDir: Vec2;

  /** World-space position the player is aiming at (mouse cursor). */
  aimWorldPos: Vec2;

  /** Whether the attack button is held. */
  isAttacking: boolean;

  /** Whether the attack is being charged (held long enough). */
  isCharging: boolean;

  /** How long the attack button has been held in ms. */
  chargeTime: number;

  /** Whether the skill button is active this tick. */
  isUsingSkill: boolean;

  /** Interact button pressed this tick (one-shot). */
  interact: boolean;

  /** Whether sprint/run modifier is held. */
  isRunning: boolean;

  /** Dodge/roll triggered this tick (one-shot). */
  isDodging: boolean;

  /** Facing direction derived from aim or movement. */
  facing: Vec2;

  constructor() {
    super("input");
    this.moveDir = { x: 0, y: 0 };
    this.aimWorldPos = { x: 0, y: 0 };
    this.isAttacking = false;
    this.isCharging = false;
    this.chargeTime = 0;
    this.isUsingSkill = false;
    this.interact = false;
    this.isRunning = false;
    this.isDodging = false;
    this.facing = { x: 0, y: 1 };
  }

  /** Reset one-shot inputs after processing. Call at end of tick. */
  resetOneShots(): void {
    this.interact = false;
    this.isDodging = false;
  }

  /** Update charge timer. Call while isAttacking is true. */
  updateCharge(dt: number, chargeThreshold = 500): void {
    if (this.isAttacking) {
      this.chargeTime += dt;
      this.isCharging = this.chargeTime >= chargeThreshold;
    } else {
      this.chargeTime = 0;
      this.isCharging = false;
    }
  }

  /** Get facing as a cardinal direction string. */
  getFacingDirection(): "up" | "down" | "left" | "right" {
    const ax = Math.abs(this.facing.x);
    const ay = Math.abs(this.facing.y);
    if (ax > ay) {
      return this.facing.x >= 0 ? "right" : "left";
    }
    return this.facing.y >= 0 ? "down" : "up";
  }
}
