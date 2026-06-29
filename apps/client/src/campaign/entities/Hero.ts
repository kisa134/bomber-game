import { Component } from "../engine/ECS.js";
import type { Attributes } from "@bomberpump/shared";

export interface HeroData {
  id: string;
  name: string;
  title: string;
  faction: string;
  description: string;
  skinId: number;
  baseAttributes: Attributes;
  skill: { id: string; name: string };
}

export const HEROES: HeroData[] = [
  {
    id: "hero_0",
    name: "Zero",
    title: "Reality Hacker",
    faction: "neon_cartel",
    description: "Former corporate hacker. Bombs chain-link to each other.",
    skinId: 0,
    baseAttributes: { str: 12, dex: 14, vit: 10, int: 14 },
    skill: { id: "chain_reaction", name: "Chain Reaction" },
  },
  {
    id: "hero_28",
    name: "Wild",
    title: "Circle Keeper",
    faction: "wild_circle",
    description: "Last keeper of the Wild Circle. Summons thorn traps.",
    skinId: 28,
    baseAttributes: { str: 10, dex: 12, vit: 14, int: 12 },
    skill: { id: "natures_wrath", name: "Nature's Wrath" },
  },
  {
    id: "hero_70",
    name: "Scorp",
    title: "Ghost of Sands",
    faction: "sands_eternal",
    description: "Mercenary from the Sands of Eternity. Creates a slowing storm.",
    skinId: 70,
    baseAttributes: { str: 14, dex: 10, vit: 12, int: 10 },
    skill: { id: "sand_storm", name: "Sand Storm" },
  },
];

export function getHero(id: string): HeroData | undefined {
  return HEROES.find((h) => h.id === id);
}
