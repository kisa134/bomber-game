export interface Character {
  id: string;
  name: string;
  title: string;
  factionId: string;
  description: string;
  skinId: number;
}

export const CHARACTERS: Character[] = [
  {
    id: "hero_0",
    name: "Zero",
    title: "Reality Hacker",
    factionId: "neon_cartel",
    description: "Former corporate hacker who turned against the system. Bombs chain-link to each other in devastating combos.",
    skinId: 0,
  },
  {
    id: "hero_28",
    name: "Wild",
    title: "Circle Keeper",
    factionId: "wild_circle",
    description: "The last keeper of the Wild Circle. Can summon thorn traps that snare enemies.",
    skinId: 28,
  },
  {
    id: "hero_70",
    name: "Scorp",
    title: "Ghost of Sands",
    factionId: "sands_eternal",
    description: "A mercenary from the Sands of Eternity. Creates sand storms that slow enemies.",
    skinId: 70,
  },
];

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
