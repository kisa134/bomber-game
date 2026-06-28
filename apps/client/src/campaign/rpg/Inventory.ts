/**
 * Inventory System for BomberMeme World.
 * 30 slots, stacking, bomb types, currency.
 */

import {
  type Item,
  type BombType,
  BombType,
  RARITY_COLORS,
} from "@bomberpump/shared";

export { type Item, type BombType, BombType, RARITY_COLORS };

/** Number of inventory slots */
export const INVENTORY_SLOTS = 30;

/** Default bomb type all heroes start with */
export const DEFAULT_BOMB = BombType.STANDARD;

/** Event payload for inventory changes */
export interface InventoryEvent {
  type: "add" | "remove" | "equip_bomb" | "spend_currency";
  slotIndex?: number;
  item?: Item;
  quantity?: number;
  success: boolean;
}

export class Inventory {
  slots: (Item | null)[];
  bombs: BombType[];
  equippedBomb: BombType;
  currency: number;
  private listeners: Set<(event: InventoryEvent) => void> = new Set();

  constructor() {
    this.slots = new Array(INVENTORY_SLOTS).fill(null);
    this.bombs = [DEFAULT_BOMB];
    this.equippedBomb = DEFAULT_BOMB;
    this.currency = 0;
  }

  onChange(listener: (event: InventoryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: InventoryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  getFirstEmptySlot(): number {
    return this.slots.findIndex((s) => s === null);
  }

  hasItem(itemId: string): boolean {
    return this.slots.some((s) => s !== null && s.id === itemId);
  }

  findStackableSlot(item: Item): number {
    if (!item.stackable) return -1;
    return this.slots.findIndex(
      (s) =>
        s !== null &&
        s.id === item.id &&
        s.quantity < s.maxStack &&
        s.quantity + item.quantity <= s.maxStack,
    );
  }

  addItem(item: Item): boolean {
    if (item.stackable) {
      const stackSlot = this.findStackableSlot(item);
      if (stackSlot >= 0) {
        const existing = this.slots[stackSlot]!;
        const canAdd = Math.min(
          item.quantity,
          existing.maxStack - existing.quantity,
        );
        existing.quantity += canAdd;
        this.emit({
          type: "add",
          slotIndex: stackSlot,
          item: existing,
          quantity: canAdd,
          success: true,
        });
        return true;
      }
    }

    const emptySlot = this.getFirstEmptySlot();
    if (emptySlot === -1) return false;

    const toPlace = {
      ...item,
      quantity: Math.min(item.quantity, item.maxStack),
    };
    this.slots[emptySlot] = toPlace;
    this.emit({
      type: "add",
      slotIndex: emptySlot,
      item: toPlace,
      success: true,
    });
    return true;
  }

  removeItem(slotIndex: number, quantity?: number): Item | null {
    if (slotIndex < 0 || slotIndex >= INVENTORY_SLOTS) return null;
    const item = this.slots[slotIndex];
    if (!item) return null;

    const removeQty = quantity ?? item.quantity;

    if (removeQty >= item.quantity) {
      this.slots[slotIndex] = null;
      this.emit({
        type: "remove",
        slotIndex,
        item,
        quantity: item.quantity,
        success: true,
      });
      return item;
    }

    item.quantity -= removeQty;
    const removed: Item = { ...item, quantity: removeQty };
    this.emit({
      type: "remove",
      slotIndex,
      item: removed,
      quantity: removeQty,
      success: true,
    });
    return removed;
  }

  getItem(slotIndex: number): Item | null {
    if (slotIndex < 0 || slotIndex >= INVENTORY_SLOTS) return null;
    return this.slots[slotIndex];
  }

  get usedSlots(): number {
    return this.slots.filter((s) => s !== null).length;
  }

  get freeSlots(): number {
    return INVENTORY_SLOTS - this.usedSlots;
  }

  get isFull(): boolean {
    return this.freeSlots === 0;
  }

  addCurrency(amount: number): void {
    this.currency += amount;
    this.emit({ type: "spend_currency", success: true });
  }

  spendCurrency(amount: number): boolean {
    if (this.currency < amount) return false;
    this.currency -= amount;
    this.emit({ type: "spend_currency", success: true });
    return true;
  }

  unlockBomb(bombType: BombType): boolean {
    if (this.bombs.includes(bombType)) return false;
    this.bombs.push(bombType);
    this.emit({ type: "equip_bomb", success: true });
    return true;
  }

  equipBomb(bombType: BombType): boolean {
    if (!this.bombs.includes(bombType)) return false;
    this.equippedBomb = bombType;
    this.emit({ type: "equip_bomb", success: true });
    return true;
  }

  hasBomb(bombType: BombType): boolean {
    return this.bombs.includes(bombType);
  }

  getItemsByType(type: Item["type"]): Item[] {
    return this.slots.filter(
      (s): s is Item => s !== null && s.type === type,
    );
  }

  serialize(): object {
    return {
      slots: this.slots,
      bombs: this.bombs,
      equippedBomb: this.equippedBomb,
      currency: this.currency,
    };
  }

  static deserialize(data: {
    slots: (Item | null)[];
    bombs: BombType[];
    equippedBomb: BombType;
    currency: number;
  }): Inventory {
    const inv = new Inventory();
    inv.slots = data.slots;
    inv.bombs = data.bombs;
    inv.equippedBomb = data.equippedBomb;
    inv.currency = data.currency;
    return inv;
  }
}
