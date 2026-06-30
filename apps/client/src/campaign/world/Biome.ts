// Biome definitions for BomberMeme World.
// Each biome maps to existing floor / hard / soft textures from the asset pipeline.

export enum BiomeType {
  NEON = "neon",
  CHAPPIE = "chappie",
  GRASS = "grass",
  GRATE = "grate",
  INDUSTRIAL = "industrial",
  SAND = "sand",
  VOID = "void",
}

/** A biome describes the visual theme, block textures, and gameplay feel of a world. */
export interface Biome {
  type: BiomeType;
  name: string;
  floorTexture: string; // sprite key, e.g. "floor_grass"
  hardBlockTexture: string; // sprite key, e.g. "hard_stone"
  softBlockTexture: string; // sprite key, e.g. "soft"
  objects: string[]; // decorative object type ids (tree, bush, crystal, …)
  ambientColor: string; // hex tint applied to the background / lighting
  musicTheme: string; // music key passed to Assets.playMusic()
  description: string; // shown in the world-selection UI
}

export const BIOMES: Record<BiomeType, Biome> = {
  [BiomeType.GRASS]: {
    type: BiomeType.GRASS,
    name: "Дикие Земли",
    floorTexture: "floor_grass",
    hardBlockTexture: "hard_stone",
    softBlockTexture: "soft",
    objects: ["tree", "bush", "flower", "rock"],
    ambientColor: "#2d5016",
    musicTheme: "lobby",
    description: "Зеленые луга и древние леса фракции Дикий Круг",
  },
  [BiomeType.NEON]: {
    type: BiomeType.NEON,
    name: "Неоновый Город",
    floorTexture: "floor_neon",
    hardBlockTexture: "hard_stone",
    softBlockTexture: "soft_cyberglass",
    objects: ["neon_sign", "holo_ad", "cyber_barrel", "light_pole"],
    ambientColor: "#0a0a2e",
    musicTheme: "lobby2",
    description: "Бесконечный мегаполис Неонового Картеля",
  },
  [BiomeType.CHAPPIE]: {
    type: BiomeType.CHAPPIE,
    name: "Заводы Храма",
    floorTexture: "floor_chappie",
    hardBlockTexture: "hard_chappie",
    softBlockTexture: "soft_chappie",
    objects: ["conveyor", "robot_arm", "crate_pile", "steam_vent"],
    ambientColor: "#8B4513",
    musicTheme: "lobby3",
    description: "Промышленные комплексы Железной Церкви",
  },
  [BiomeType.GRATE]: {
    type: BiomeType.GRATE,
    name: "Решетка",
    floorTexture: "floor_grate",
    hardBlockTexture: "hard_gold",
    softBlockTexture: "soft_ammo",
    objects: ["bars", "chain", "cell_door", "grate_pile"],
    ambientColor: "#1a1a1a",
    musicTheme: "lobby4",
    description: "Тюремный мир Синдиката Решетки",
  },
  [BiomeType.INDUSTRIAL]: {
    type: BiomeType.INDUSTRIAL,
    name: "Промзона",
    floorTexture: "floor_industrial",
    hardBlockTexture: "hard_industrial",
    softBlockTexture: "soft_industrial",
    objects: ["barrel", "pipe", "tank", "scrap_pile"],
    ambientColor: "#3d3d3d",
    musicTheme: "lobby5",
    description: "Заброшенные фабрики Индустриального Клана",
  },
  [BiomeType.SAND]: {
    type: BiomeType.SAND,
    name: "Пески Вечности",
    floorTexture: "floor_sand",
    hardBlockTexture: "hard_sand",
    softBlockTexture: "soft_sand",
    objects: ["cactus", "skull", "dune_rock", "palm"],
    ambientColor: "#c2b280",
    musicTheme: "lobby",
    description: "Бескрайняя пустыня Песков Вечности",
  },
  [BiomeType.VOID]: {
    type: BiomeType.VOID,
    name: "Пропасть",
    floorTexture: "floor_void",
    hardBlockTexture: "hard_obsidian",
    softBlockTexture: "soft_void2",
    objects: ["crystal", "void_rift", "shadow_rock", "eye_statue"],
    ambientColor: "#1a001a",
    musicTheme: "battle",
    description: "Проклятые земли Пустоты",
  },
};

/** List of all biome types in display order. */
export const ALL_BIOMES = Object.values(BIOMES);

/** Get a biome by its type enum value. */
export function getBiome(type: BiomeType): Biome {
  return BIOMES[type];
}

/** Return true if the biome is dark (needs extra lighting / glow). */
export function isDarkBiome(type: BiomeType): boolean {
  return type === BiomeType.VOID || type === BiomeType.NEON || type === BiomeType.GRATE;
}
