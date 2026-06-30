// WorldGenerator — procedural chunk generation for BomberMeme World.
// Uses a lightweight pseudo-random noise function (no external dependencies).
// Generates 256x256 tile chunks with terrain, blocks, and decorative objects.

import type { ChunkData, ChunkObject } from "@bomberpump/shared";
import { CHUNK_SIZE_TILES } from "../engine/ChunkManager";
import { BiomeType, getBiome } from "./Biome";
import { getTileDef } from "./Tileset";

const TILE_PX = 48; // pixels per tile (matches ChunkManager)

/** Lightweight seeded PRNG (xorshift). */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed === 0 ? 123456789 : seed >>> 0;
  }

  /** Next pseudo-random float in [0, 1). */
  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return (this.state >>> 0) / 4294967296;
  }

  /** Integer in [min, max). */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  /** Boolean with given probability (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Simple 2D value noise (fast, no external deps). */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const hash = (px: number, py: number): number => {
    let h = ((px * 374761393 + py * 668265263 + seed * 1013904223) | 0) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    h = (h * 524287) % 1000003;
    return (h >>> 0) / 1000003;
  };

  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);

  // Smoothstep interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const top = a + sx * (b - a);
  const bot = c + sx * (d - c);
  return top + sy * (bot - top);
}

/** Multi-octave fractal noise (fbm). */
function fractalNoise(x: number, y: number, seed: number, octaves = 4, persistence = 0.5): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x * frequency, y * frequency, seed + i * 131) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}

/** Serialize chunk to JSON (for saving / debugging). */
export function chunkToJSON(chunk: ChunkData): string {
  return JSON.stringify({
    x: chunk.x,
    y: chunk.y,
    worldId: chunk.worldId,
    tiles: chunk.tiles,
    objects: chunk.objects,
    entities: chunk.entities,
  });
}

/** Parse chunk from JSON. */
export function chunkFromJSON(json: string): ChunkData {
  const parsed = JSON.parse(json);
  return {
    x: parsed.x,
    y: parsed.y,
    worldId: parsed.worldId,
    tiles: parsed.tiles,
    objects: parsed.objects,
    entities: parsed.entities ?? [],
    lastAccessed: performance.now(),
  };
}

/** Procedural world generator. Creates terrain, places blocks and decorations. */
export class WorldGenerator {
  /** Base seed for deterministic generation. */
  private baseSeed: number;

  constructor(baseSeed = 1337) {
    this.baseSeed = baseSeed;
  }

  /** Compute a deterministic seed for a specific chunk. */
  private chunkSeed(worldId: string, chunkX: number, chunkY: number): number {
    let hash = 0;
    const str = `${worldId}_${chunkX}_${chunkY}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) + this.baseSeed) >>> 0;
  }

  /**
   * Generate a single chunk for the given world and biome.
   * @param worldId — unique world identifier
   * @param chunkX — chunk coordinate (world space)
   * @param chunkY — chunk coordinate (world space)
   * @param biome — biome type for terrain styling
   */
  generateChunk(worldId: string, chunkX: number, chunkY: number, biome: BiomeType): ChunkData {
    const rng = new SeededRandom(this.chunkSeed(worldId, chunkX, chunkY));
    const biomeData = getBiome(biome);

    // Create empty tile grid
    const tiles: number[][] = [];
    for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
      tiles[y] = new Array<number>(CHUNK_SIZE_TILES).fill(0);
    }

    const objects: ChunkObject[] = [];

    // Phase 1: terrain (hard blocks + soft blocks)
    this.generateTerrain(tiles, chunkX, chunkY, biome, rng);

    // Phase 2: decorations (trees, bushes, etc.)
    this.placeDecorations(tiles, objects, chunkX, chunkY, biome, rng);

    // Phase 3: special features (clearings, paths)
    this.carveFeatures(tiles, chunkX, chunkY, biome, rng);

    return {
      x: chunkX,
      y: chunkY,
      worldId,
      tiles,
      objects,
      entities: [],
      lastAccessed: performance.now(),
    };
  }

  /**
   * Generate an entire world as a collection of chunks.
   * @param worldId — world identifier
   * @param sizeX — width in chunks
   * @param sizeY — height in chunks
   * @param biome — biome type
   * @returns flat array of generated chunks
   */
  generateWorld(worldId: string, sizeX: number, sizeY: number, biome: BiomeType): ChunkData[] {
    const chunks: ChunkData[] = [];
    for (let cy = 0; cy < sizeY; cy++) {
      for (let cx = 0; cx < sizeX; cx++) {
        chunks.push(this.generateChunk(worldId, cx, cy, biome));
      }
    }
    return chunks;
  }

  /** ─── Terrain generation ─── */
  private generateTerrain(
    tiles: number[][],
    chunkX: number,
    chunkY: number,
    biome: BiomeType,
    rng: SeededRandom,
  ): void {
    const worldOffX = chunkX * CHUNK_SIZE_TILES;
    const worldOffY = chunkY * CHUNK_SIZE_TILES;

    for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
      for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
        const wx = worldOffX + x;
        const wy = worldOffY + y;

        // Border — always hard blocks (world boundary)
        if (chunkX === 0 && x < 2) { tiles[y][x] = 1; continue; }
        if (chunkY === 0 && y < 2) { tiles[y][x] = 1; continue; }

        // Base noise for terrain variation
        const noise = fractalNoise(wx * 0.05, wy * 0.05, this.baseSeed, 3, 0.5);
        const detailNoise = fractalNoise(wx * 0.15, wy * 0.15, this.baseSeed + 7, 2, 0.4);

        // Biome-specific terrain rules
        tiles[y][x] = this.computeTerrainTile(wx, wy, noise, detailNoise, biome, rng);
      }
    }
  }

  private computeTerrainTile(
    _wx: number,
    _wy: number,
    noise: number,
    detailNoise: number,
    biome: BiomeType,
    rng: SeededRandom,
  ): number {
    switch (biome) {
      case BiomeType.GRASS:
        if (noise > 0.72) return 1; // hard stone clusters
        if (noise > 0.45 && detailNoise > 0.5 && rng.chance(0.35)) return 2; // soft blocks
        return 0;

      case BiomeType.NEON:
        if (noise > 0.68) return 1; // hard walls
        if (noise > 0.4 && detailNoise > 0.55 && rng.chance(0.3)) return 2; // glass buildings
        return 0;

      case BiomeType.CHAPPIE:
        if (noise > 0.7) return 1; // factory walls
        if (noise > 0.42 && detailNoise > 0.48 && rng.chance(0.4)) return 2; // crates
        return 0;

      case BiomeType.GRATE:
        if (noise > 0.65) return 1; // metal walls
        if (noise > 0.38 && detailNoise > 0.5 && rng.chance(0.45)) return 2; // ammo crates
        return 0;

      case BiomeType.INDUSTRIAL:
        if (noise > 0.7) return 1; // concrete
        if (noise > 0.44 && detailNoise > 0.5 && rng.chance(0.35)) return 2; // scrap piles
        return 0;

      case BiomeType.SAND:
        if (noise > 0.75) return 1; // sandstone cliffs
        if (noise > 0.48 && detailNoise > 0.55 && rng.chance(0.25)) return 2; // sand mounds
        return 0;

      case BiomeType.VOID:
        if (noise > 0.6) return 1; // obsidian pillars
        if (noise > 0.35 && detailNoise > 0.5 && rng.chance(0.3)) return 2; // shadow crystals
        return 0;

      default:
        return 0;
    }
  }

  /** ─── Decoration placement (non-blocking overlays) ─── */
  private placeDecorations(
    tiles: number[][],
    objects: ChunkObject[],
    chunkX: number,
    chunkY: number,
    biome: BiomeType,
    rng: SeededRandom,
  ): void {
    const biomeData = getBiome(biome);
    const worldOffX = chunkX * CHUNK_SIZE_TILES;
    const worldOffY = chunkY * CHUNK_SIZE_TILES;

    for (let y = 2; y < CHUNK_SIZE_TILES - 2; y++) {
      for (let x = 2; x < CHUNK_SIZE_TILES - 2; x++) {
        // Only place on empty tiles
        if (tiles[y][x] !== 0) continue;

        const wx = worldOffX + x;
        const wy = worldOffY + y;
        const noise = fractalNoise(wx * 0.08, wy * 0.08, this.baseSeed + 100, 2, 0.5);

        if (noise > 0.65 && rng.chance(0.12)) {
          const objType = biomeData.objects[rng.nextInt(0, biomeData.objects.length)];
          objects.push({
            id: `obj_${chunkX}_${chunkY}_${x}_${y}`,
            type: objType,
            x: wx * TILE_PX,
            y: wy * TILE_PX,
            solid: false,
            width: TILE_PX,
            height: TILE_PX,
          });

          // Mark overlay tile for rendering hints
          tiles[y][x] = this.objectToTileId(objType);
        }
      }
    }
  }

  /** Map an object type to a tile ID for the overlay layer. */
  private objectToTileId(objType: string): number {
    switch (objType) {
      case "tree": return 10;
      case "bush": return 11;
      case "flower": return 12;
      case "rock":
      case "dune_rock":
      case "shadow_rock": return 13;
      default: return 12; // flower as generic fallback
    }
  }

  /** ─── Feature carving (clearings, paths) ─── */
  private carveFeatures(
    tiles: number[][],
    chunkX: number,
    chunkY: number,
    biome: BiomeType,
    rng: SeededRandom,
  ): void {
    // Carve a few small clearings (remove all blocks in a radius)
    const clearingCount = rng.nextInt(1, 4);
    for (let i = 0; i < clearingCount; i++) {
      const cx = rng.nextInt(30, CHUNK_SIZE_TILES - 30);
      const cy = rng.nextInt(30, CHUNK_SIZE_TILES - 30);
      const radius = rng.nextInt(5, 12);

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < CHUNK_SIZE_TILES && ny >= 0 && ny < CHUNK_SIZE_TILES) {
            if (dx * dx + dy * dy <= radius * radius) {
              // Remove hard and soft blocks but leave overlays
              if (tiles[ny][nx] === 1 || tiles[ny][nx] === 2) {
                tiles[ny][nx] = 0;
              }
            }
          }
        }
      }
    }

    // Carve winding paths (for grasslands mainly)
    if (biome === BiomeType.GRASS || biome === BiomeType.SAND) {
      const pathCount = rng.nextInt(1, 3);
      for (let p = 0; p < pathCount; p++) {
        let px = rng.nextInt(10, CHUNK_SIZE_TILES - 10);
        let py = rng.nextInt(10, CHUNK_SIZE_TILES - 10);
        const steps = rng.nextInt(40, 100);

        for (let s = 0; s < steps; s++) {
          // Carve 2-tile wide path
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = px + dx;
              const ny = py + dy;
              if (nx >= 0 && nx < CHUNK_SIZE_TILES && ny >= 0 && ny < CHUNK_SIZE_TILES) {
                if (tiles[ny][nx] === 1 || tiles[ny][nx] === 2) {
                  tiles[ny][nx] = 0;
                }
              }
            }
          }

          // Random walk
          px += rng.nextInt(-1, 2);
          py += rng.nextInt(-1, 2);
          px = Math.max(2, Math.min(CHUNK_SIZE_TILES - 3, px));
          py = Math.max(2, Math.min(CHUNK_SIZE_TILES - 3, py));
        }
      }
    }
  }

  /**
   * Destroy a breakable tile at the given local chunk coordinates.
   * Returns the drop items (if any) or null if the tile was not breakable.
   */
  static destroyTile(chunk: ChunkData, localX: number, localY: number, biome: BiomeType): string[] | null {
    if (localY < 0 || localY >= chunk.tiles.length) return null;
    if (localX < 0 || localX >= chunk.tiles[localY].length) return null;

    const tileId = chunk.tiles[localY][localX];
    const def = getTileDef(tileId, biome);

    if (!def.breakable) return null;

    // Remove the block
    chunk.tiles[localY][localX] = 0;

    // Roll drops
    const drops: string[] = [];
    for (const item of def.dropTable) {
      if (Math.random() < 0.25) {
        drops.push(item);
      }
    }

    return drops;
  }

  /** Get the noise value at a world position (for external systems like mob spawning). */
  getNoise(worldX: number, worldY: number): number {
    return fractalNoise(worldX * 0.05, worldY * 0.05, this.baseSeed, 4, 0.5);
  }
}
