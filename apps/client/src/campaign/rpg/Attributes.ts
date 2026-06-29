export interface Attributes {
  str: number; // strength — bomb damage
  dex: number; // dexterity — movement speed
  vit: number; // vitality — health
  int: number; // intelligence — mana + skill power
}

export const DEFAULT_ATTRIBUTES: Attributes = { str: 10, dex: 10, vit: 10, int: 10 };

export function applyAttributeBonus(base: Attributes, bonus: Partial<Attributes>): Attributes {
  return {
    str: base.str + (bonus.str ?? 0),
    dex: base.dex + (bonus.dex ?? 0),
    vit: base.vit + (bonus.vit ?? 0),
    int: base.int + (bonus.int ?? 0),
  };
}
