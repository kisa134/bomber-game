export interface DropEntry {
  itemId: string;
  weight: number;
  minQty: number;
  maxQty: number;
}

export const BASIC_DROPS: DropEntry[] = [
  { itemId: "coins", weight: 50, minQty: 10, maxQty: 50 },
  { itemId: "health_potion", weight: 20, minQty: 1, maxQty: 2 },
  { itemId: "mana_potion", weight: 15, minQty: 1, maxQty: 2 },
  { itemId: "bomb_boost", weight: 10, minQty: 1, maxQty: 1 },
  { itemId: "xp_boost", weight: 5, minQty: 1, maxQty: 1 },
];

export class DropTable {
  private entries: DropEntry[];

  constructor(entries: DropEntry[] = BASIC_DROPS) {
    this.entries = entries;
  }

  roll(): Array<{ itemId: string; quantity: number }> | null {
    const totalWeight = this.entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of this.entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        const qty = entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1));
        return [{ itemId: entry.itemId, quantity: qty }];
      }
    }
    return null;
  }

  rollMultiple(count: number): Array<{ itemId: string; quantity: number }> {
    const drops: Array<{ itemId: string; quantity: number }> = [];
    for (let i = 0; i < count; i++) {
      const result = this.roll();
      if (result) drops.push(...result);
    }
    return drops;
  }
}
