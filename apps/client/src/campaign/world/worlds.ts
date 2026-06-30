// World definitions for BomberMeme World.
// Phase 1: only grasslands is fully unlocked and playable.
// The remaining 6 worlds are stubs (locked: true) and will be expanded in later phases.

import type { BiomeType } from "./Biome";

/** A zone inside a world with specific gameplay rules. */
export interface Zone {
  x: number; // chunk coords (top-left)
  y: number;
  w: number; // width in chunks
  h: number; // height in chunks
  type: "safe" | "pvp" | "dungeon";
  name: string;
}

/** A portal that transports the player to another world. */
export interface Portal {
  to: string; // target world id
  at: { x: number; y: number }; // chunk coords in the source world
  requiredLevel: number;
}

/** Static metadata for a world. */
export interface WorldDef {
  id: string;
  name: string;
  biome: BiomeType;
  size?: { x: number; y: number }; // in chunks (only for unlocked worlds)
  spawnChunk?: { x: number; y: number }; // starting chunk (only for unlocked worlds)
  portals?: Portal[];
  zones?: Zone[];
  locked: boolean; // true = not yet implemented / accessible
  description?: string;
}

/** Phase 1 worlds — grasslands is the only fully playable world. */
export const WORLDS: Record<string, WorldDef> = {
  // ═══ Phase 1 — fully playable ═══
  grasslands: {
    id: "grasslands",
    name: "Дикие Земли",
    biome: "grass" as BiomeType,
    size: { x: 10, y: 10 },
    spawnChunk: { x: 5, y: 5 },
    locked: false,
    description: "Зеленые луга и древние леса фракции Дикий Круг. Начни свой путь здесь.",
    portals: [
      { to: "neon_city", at: { x: 9, y: 5 }, requiredLevel: 5 },
      { to: "sand_desert", at: { x: 0, y: 5 }, requiredLevel: 3 },
    ],
    zones: [
      { x: 0, y: 0, w: 10, h: 3, type: "safe", name: "Зеленая Долина" },
      { x: 0, y: 3, w: 10, h: 4, type: "pvp", name: "Кровавые Луга" },
      { x: 0, y: 7, w: 10, h: 3, type: "dungeon", name: "Логово Древних" },
    ],
  },

  // ═══ Phase 2+ — stubs (locked) ═══
  neon_city: {
    id: "neon_city",
    name: "Неоновый Город",
    biome: "neon" as BiomeType,
    locked: true,
    description: "Бесконечный мегаполис Неонового Картеля. Требуется уровень 5.",
  },
  chappie_factory: {
    id: "chappie_factory",
    name: "Заводы Храма",
    biome: "chappie" as BiomeType,
    locked: true,
    description: "Промышленные комплексы Железной Церкви.",
  },
  grate_prison: {
    id: "grate_prison",
    name: "Решетка",
    biome: "grate" as BiomeType,
    locked: true,
    description: "Тюремный мир Синдиката Решетки.",
  },
  industrial_zone: {
    id: "industrial_zone",
    name: "Промзона",
    biome: "industrial" as BiomeType,
    locked: true,
    description: "Заброшенные фабрики Индустриального Клана.",
  },
  sand_desert: {
    id: "sand_desert",
    name: "Пески Вечности",
    biome: "sand" as BiomeType,
    locked: true,
    description: "Бескрайняя пустыня Песков Вечности. Требуется уровень 3.",
  },
  void_abyss: {
    id: "void_abyss",
    name: "Пропасть",
    biome: "void" as BiomeType,
    locked: true,
    description: "Проклятые земли Пустоты. Самый опасный мир.",
  },
};

/** Ordered list of all worlds for UI display. */
export const WORLD_LIST = Object.values(WORLDS);

/** Get a world definition by its id. */
export function getWorld(id: string): WorldDef | undefined {
  return WORLDS[id];
}

/** Check if a world is unlocked for a given player level. */
export function isWorldUnlocked(worldId: string, playerLevel: number): boolean {
  const world = WORLDS[worldId];
  if (!world) return false;
  if (world.locked) return false;
  // Check portal level requirements
  if (world.portals) {
    for (const portal of world.portals) {
      if (portal.to === worldId && portal.requiredLevel > playerLevel) {
        return false;
      }
    }
  }
  return true;
}

/** Get the zone type at a specific chunk coordinate. */
export function getZoneAt(worldId: string, chunkX: number, chunkY: number): Zone | null {
  const world = WORLDS[worldId];
  if (!world?.zones) return null;
  for (const zone of world.zones) {
    if (
      chunkX >= zone.x &&
      chunkX < zone.x + zone.w &&
      chunkY >= zone.y &&
      chunkY < zone.y + zone.h
    ) {
      return zone;
    }
  }
  return null;
}

/** Check if PvP is enabled at a chunk coordinate. */
export function isPvpEnabled(worldId: string, chunkX: number, chunkY: number): boolean {
  const zone = getZoneAt(worldId, chunkX, chunkY);
  return zone?.type === "pvp";
}

/** Check if a chunk is in a safe zone (no PvP, no mob aggro). */
export function isSafeZone(worldId: string, chunkX: number, chunkY: number): boolean {
  const zone = getZoneAt(worldId, chunkX, chunkY);
  return zone?.type === "safe";
}
