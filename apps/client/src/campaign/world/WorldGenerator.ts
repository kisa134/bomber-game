import { BiomeType, BIOME_TILESET, type Tileset } from "./Biome.js";
import { TilesetManager } from "./Tileset.js";
import type { ChunkData, ChunkObject } from "@bomberpump/shared";

export interface WorldConfig {
  seed: string;
  size: number; // chunks per side
  worldId: string;
}

export class WorldGenerator {
  private seed: string;
  private tilesetManager: TilesetManager;
  private rng: () => number;

  constructor(config: WorldConfig) {
    this.seed = config.seed;
    this.tilesetManager = new TilesetManager();
    this.rng = this.createRNG(config.seed);
  }

  private createRNG(seed: string): () => number {
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
      state = (state * 31 + seed.charCodeAt(i)) | 0;
    }
    return () => {
      state = (state * 1664525 + 1013904223) | 0;
      return (state >>> 0) / 0xffffffff;
    };
  }

  generateChunk(worldId: string, cx: number, cy: number): ChunkData {
    const tileset = this.tilesetManager.getTileset(worldId);
    const tiles = this.generateTiles(cx, cy, tileset);
    const objects = this.generateObjects(cx, cy);
    return {
      worldId,
      x: cx,
      y: cy,
      tiles,
      objects,
      lastAccessed: performance.now(),
    };
  }

  private generateTiles(cx: number, cy: number, tileset: Tileset): number[][] {
    const tiles: number[][] = [];
    const CHUNK_SIZE = 256;
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const row: number[] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldY = cy * CHUNK_SIZE + y;
        const noise = this.noise2D(worldX * 0.01, worldY * 0.01);
        if (noise < -0.2) {
          row.push(tileset.hardWall); // dense walls
        } else if (noise < 0.1) {
          row.push(tileset.softBlock); // breakable
        } else {
          row.push(tileset.floor); // empty
        }
      }
      tiles.push(row);
    }
    return tiles;
  }

  private generateObjects(cx: number, cy: number): ChunkObject[] {
    const objects: ChunkObject[] = [];
    const count = Math.floor(this.rng() * 5);
    const CHUNK_SIZE = 256;
    const TILE_PX = 48;
    for (let i = 0; i < count; i++) {
      const x = cx * CHUNK_SIZE * TILE_PX + Math.floor(this.rng() * CHUNK_SIZE) * TILE_PX + TILE_PX / 2;
      const y = cy * CHUNK_SIZE * TILE_PX + Math.floor(this.rng() * CHUNK_SIZE) * TILE_PX + TILE_PX / 2;
      objects.push({ type: "deco", x, y, width: TILE_PX, height: TILE_PX });
    }
    return objects;
  }

  private noise2D(x: number, y: number): number {
    // Simple value noise
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const a = this.smoothHash(ix, iy);
    const b = this.smoothHash(ix + 1, iy);
    const c = this.smoothHash(ix, iy + 1);
    const d = this.smoothHash(ix + 1, iy + 1);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  private smoothHash(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }
}
