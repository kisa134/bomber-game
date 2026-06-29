export enum BiomeType {
  MEME_CITY = "meme_city",
  NEON_WASTES = "neon_wastes",
  WILD_FOREST = "wild_forest",
  SAND_DUNES = "sand_dunes",
  ICE_PEAKS = "ice_peaks",
  VOID_REALM = "void_realm",
}

export interface Tileset {
  floor: number;
  hardWall: number;
  softBlock: number;
  special: number;
}

export const BIOME_TILESET: Record<BiomeType, Tileset> = {
  [BiomeType.MEME_CITY]: { floor: 0, hardWall: 1, softBlock: 2, special: 3 },
  [BiomeType.NEON_WASTES]: { floor: 10, hardWall: 11, softBlock: 12, special: 13 },
  [BiomeType.WILD_FOREST]: { floor: 20, hardWall: 21, softBlock: 22, special: 23 },
  [BiomeType.SAND_DUNES]: { floor: 30, hardWall: 31, softBlock: 32, special: 33 },
  [BiomeType.ICE_PEAKS]: { floor: 40, hardWall: 41, softBlock: 42, special: 43 },
  [BiomeType.VOID_REALM]: { floor: 50, hardWall: 51, softBlock: 52, special: 53 },
};

export function biomeForChunk(cx: number, cy: number): BiomeType {
  // Simple biome assignment based on chunk coords
  const hash = Math.abs((cx * 374761393 + cy * 668265263) % 100);
  if (hash < 40) return BiomeType.MEME_CITY;
  if (hash < 60) return BiomeType.WILD_FOREST;
  if (hash < 75) return BiomeType.SAND_DUNES;
  if (hash < 85) return BiomeType.NEON_WASTES;
  if (hash < 95) return BiomeType.ICE_PEAKS;
  return BiomeType.VOID_REALM;
}
