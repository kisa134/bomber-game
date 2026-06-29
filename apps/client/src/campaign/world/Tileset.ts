import { BiomeType, BIOME_TILESET, type Tileset } from "./Biome.js";

export class TilesetManager {
  private cache = new Map<string, Tileset>();

  getTileset(worldId: string): Tileset {
    if (this.cache.has(worldId)) return this.cache.get(worldId)!;
    // Default to meme city tileset
    const ts = BIOME_TILESET[BiomeType.MEME_CITY];
    this.cache.set(worldId, ts);
    return ts;
  }
}
