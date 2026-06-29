import type { WorldConfig } from "./WorldGenerator.js";

export interface WorldInfo {
  id: string;
  name: string;
  description: string;
  seed: string;
  size: number;
  requiredLevel: number;
}

export const WORLDS: WorldInfo[] = [
  {
    id: "default",
    name: "Meme City",
    description: "The starting world. A chaotic mix of all factions.",
    seed: "bombermeme_genesis",
    size: 64,
    requiredLevel: 1,
  },
  {
    id: "neon_wastes",
    name: "Neon Wastes",
    description: "High-level PvP zone. Neon Cartel territory.",
    seed: "neon_cartel_territory_v1",
    size: 32,
    requiredLevel: 10,
  },
];

export function getWorldConfig(worldId: string): WorldConfig {
  const world = WORLDS.find((w) => w.id === worldId);
  if (!world) throw new Error(`World ${worldId} not found`);
  return {
    seed: world.seed,
    size: world.size,
    worldId: world.id,
  };
}
