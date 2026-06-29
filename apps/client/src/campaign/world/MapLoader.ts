import type { ChunkData } from "@bomberpump/shared";
import { WorldGenerator, type WorldConfig } from "./WorldGenerator.js";

export class MapLoader {
  private generators = new Map<string, WorldGenerator>();

  async loadChunk(worldId: string, cx: number, cy: number): Promise<ChunkData | null> {
    let gen = this.generators.get(worldId);
    if (!gen) {
      const config: WorldConfig = {
        seed: worldId + "_seed",
        size: 64,
        worldId,
      };
      gen = new WorldGenerator(config);
      this.generators.set(worldId, gen);
    }
    return gen.generateChunk(worldId, cx, cy);
  }
}
