import { Component } from "../ECS.js";

export class HealthComponent extends Component {
  current: number;
  max: number;

  constructor(max: number, current?: number) {
    super("health");
    this.max = max;
    this.current = current ?? max;
  }

  takeDamage(amount: number): boolean {
    this.current = Math.max(0, this.current - amount);
    return this.current > 0;
  }

  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }

  setMax(newMax: number, clampCurrent = true): void {
    this.max = newMax;
    if (clampCurrent) this.current = Math.min(this.current, this.max);
  }

  getPercent(): number {
    return this.max > 0 ? this.current / this.max : 0;
  }

  isDead(): boolean {
    return this.current <= 0;
  }
}
