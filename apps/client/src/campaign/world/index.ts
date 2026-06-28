// Barrel export for all BomberMeme World modules.
// Import from apps/client/src/campaign/world/ to get everything in one go.

// ─── Biome definitions ───
export {
  BiomeType,
  BIOMES,
  ALL_BIOMES,
  getBiome,
  isDarkBiome,
} from "./Biome";
export type { Biome } from "./Biome";

// ─── Tileset definitions ───
export {
  TILESET,
  BIOME_TILE_OVERRIDES,
  getTileDef,
  isTileSolid,
  isTileBreakable,
  getTileSprite,
  getFloorSprite,
} from "./Tileset";
export type { TileDef } from "./Tileset";

// ─── World definitions ───
export {
  WORLDS,
  WORLD_LIST,
  getWorld,
  isWorldUnlocked,
  getZoneAt,
  isPvpEnabled,
  isSafeZone,
} from "./worlds";
export type { WorldDef, Zone, Portal } from "./worlds";

// ─── World generator ───
export {
  WorldGenerator,
  chunkToJSON,
  chunkFromJSON,
} from "./WorldGenerator";

// ─── Map loader ───
export {
  MapLoader,
  TILE_SYMBOLS,
} from "./MapLoader";
export type { SerializedChunk, CustomMapFormat } from "./MapLoader";
