import { Component } from "../ECS.js";

export class XPComponent extends Component {
  current: number;
  max: number;
  level: number;

  constructor(current = 0, max = 100, level = 1) {
    super("xp");
    this.current = current;
    this.max = max;
    this.level = level;
  }

  addXp(amount: number): number {
    if (amount <= 0) return 0;
    this.current += amount;
    let levels = 0;
    while (this.current >= this.max) {
      this.current -= this.max;
      this.level++;
      levels++;
      this.max = this.calcXpToNext(this.level);
    }
    return levels;
  }

  private calcXpToNext(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  getPercent(): number {
    return this.max > 0 ? this.current / this.max : 0;
  }
}
