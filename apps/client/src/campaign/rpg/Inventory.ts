export interface InventoryItem {
  id: string;
  name: string;
  type: "consumable" | "material" | "quest";
  quantity: number;
  icon: string;
}

export class Inventory {
  private items = new Map<string, InventoryItem>();
  currency = 0;

  addItem(item: InventoryItem): void {
    const existing = this.items.get(item.id);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      this.items.set(item.id, { ...item });
    }
  }

  removeItem(id: string, qty = 1): boolean {
    const item = this.items.get(id);
    if (!item || item.quantity < qty) return false;
    item.quantity -= qty;
    if (item.quantity <= 0) this.items.delete(id);
    return true;
  }

  getItem(id: string): InventoryItem | undefined {
    return this.items.get(id);
  }

  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values());
  }

  addCurrency(amount: number): void {
    this.currency += amount;
  }

  spendCurrency(amount: number): boolean {
    if (this.currency < amount) return false;
    this.currency -= amount;
    return true;
  }

  serialize(): { items: InventoryItem[]; currency: number } {
    return { items: this.getAllItems(), currency: this.currency };
  }

  load(data: { items: InventoryItem[]; currency: number }): void {
    this.items.clear();
    for (const item of data.items) this.items.set(item.id, item);
    this.currency = data.currency;
  }
}
