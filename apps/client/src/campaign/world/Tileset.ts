// Tileset — maps tile IDs to sprite assets and gameplay properties.
// Tile IDs are stored as numbers in ChunkData.tiles[y][x].
// 0 = empty (floor only), 1 = hard (indestructible), 2 = soft (breakable).
// 3+ = decorations that overlay the floor but do not block movement.

import { BiomeType, getBiome } from "./Biome";

/** Gameplay and render properties of a single tile type. */
export interface TileDef {
  id: number;
  sprite: string; // sprite key passed to Assets.img()
  solid: boolean; // blocks movement and bomb explosions?
  breakable: boolean; // can be destroyed by bombs?
  hp: number; // hit points for breakable objects (0 = invulnerable)
  dropTable: string[]; // items that may drop when broken
  overlay: boolean; // true = rendered on top of the floor tile (non-blocking decoration)
}

/** Core tile definitions shared by all biomes. */
export const TILESET: Record<number, TileDef> = {
  // ─── Core terrain ───
  0: {
    id: 0,
    sprite: "floor_grass",
    solid: false,
    breakable: false,
    hp: 0,
    dropTable: [],
    overlay: false,
  },
  1: {
    id: 1,
    sprite: "hard_stone",
    solid: true,
    breakable: false,
    hp: 0,
    dropTable: [],
    overlay: false,
  },
  2: {
    id: 2,
    sprite: "soft",
    solid: true,
    breakable: true,
    hp: 30,
    dropTable: ["herb", "coin", "wood"],
    overlay: false,
  },

  // ─── Decorative overlays (non-blocking) ───
  10: {
    id: 10,
    sprite: "tree",
    solid: false,
    breakable: false,
    hp: 0,
    dropTable: [],
    overlay: true,
  },
  11: {
    id: 11,
    sprite: "bush",
    solid: false,
    breakable: true,
    hp: 10,
    dropTable: ["herb"],
    overlay: true,
  },
  12: {
    id: 12,
    sprite: "flower",
    solid: false,
    breakable: false,
    hp: 0,
    dropTable: [],
    overlay: true,
  },
  13: {
    id: 13,
    sprite: "rock",
    solid: false,
    breakable: false,
    hp: 0,
    dropTable: [],
    overlay: true,
  },

  // ─── Breakable containers (higher drops) ───
  20: {
    id: 20,
    sprite: "soft",
    solid: true,
    breakable: true,
    hp: 50,
    dropTable: ["bomb_pu", "fire_pu", "speed_pu", "coin"],
    overlay: false,
  },
  21: {
    id: 21,
    sprite: "soft_ammo",
    solid: true,
    breakable: true,
    hp: 40,
    dropTable: ["ammo", "coin", "scrap"],
    overlay: false,
  },
  22: {
    id: 22,
    sprite: "soft_cyberglass",
    solid: true,
    breakable: true,
    hp: 25,
    dropTable: ["chip", "coin"],
    overlay: false,
  },
};

/** Biome-specific tile overrides — applied on top of TILESET when generating. */
export const BIOME_TILE_OVERRIDES: Record<BiomeType, Partial<Record<number, Partial<TileDef>>>> = {
  [BiomeType.GRASS]: {
    0: { sprite: "floor_grass" },
    1: { sprite: "hard_stone" },
    2: { sprite: "soft", dropTable: ["herb", "coin", "wood"] },
  },
  [BiomeType.NEON]: {
    0: { sprite: "floor_neon" },
    1: { sprite: "hard_stone" },
    2: { sprite: "soft_cyberglass", dropTable: ["chip", "coin", "data_shard"] },
  },
  [BiomeType.CHAPPIE]: {
    0: { sprite: "floor_chappie" },
    1: { sprite: "hard_chappie" },
    2: { sprite: "soft_chappie", dropTable: ["scrap", "gear", "coin"] },
  },
  [BiomeType.GRATE]: {
    0: { sprite: "floor_grate" },
    1: { sprite: "hard_gold" },
    2: { sprite: "soft_ammo", dropTable: ["ammo", "coin", "key_fragment"] },
  },
  [BiomeType.INDUSTRIAL]: {
    0: { sprite: "floor_industrial" },
    1: { sprite: "hard_industrial" },
    2: { sprite: "soft_industrial", dropTable: ["scrap", "fuel", "coin"] },
  },
  [BiomeType.SAND]: {
    0: { sprite: "floor_sand" },
    1: { sprite: "hard_sand" },
    2: { sprite: "soft_sand", dropTable: ["sand_crystal", "coin", "bone"] },
  },
  [BiomeType.VOID]: {
    0: { sprite: "floor_void" },
    1: { sprite: "hard_obsidian" },
    2: { sprite: "soft_void2", dropTable: ["void_essence", "coin", "shadow_gem"] },
  },
};

/** Resolve a tile definition for a given ID and biome. */
export function getTileDef(tileId: number, biome: BiomeType): TileDef {
  const base = TILESET[tileId];
  if (!base) {
    // Unknown tile — fallback to empty floor
    return TILESET[0];
  }
  const override = BIOME_TILE_OVERRIDES[biome]?.[tileId];
  if (!override) return base;
  return { ...base, ...override } as TileDef;
}

/** Check whether a tile ID blocks movement. */
export function isTileSolid(tileId: number, biome: BiomeType): boolean {
  return getTileDef(tileId, biome).solid;
}

/** Check whether a tile ID can be destroyed by bombs. */
export function isTileBreakable(tileId: number, biome: BiomeType): boolean {
  return getTileDef(tileId, biome).breakable;
}

/** Get the sprite key for a tile, taking biome into account. */
export function getTileSprite(tileId: number, biome: BiomeType): string {
  return getTileDef(tileId, biome).sprite;
}

/** Get floor sprite key for a biome. */
export function getFloorSprite(biome: BiomeType): string {
  return getBiome(biome).floorTexture;
}
