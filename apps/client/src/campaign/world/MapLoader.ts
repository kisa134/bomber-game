// MapLoader — serialize, save, and load ChunkData to/from JSON.
// Also supports conversion from a simple custom JSON map format (useful for hand-edited areas).

import type { ChunkData, ChunkObject } from "@bomberpump/shared";
import { CHUNK_SIZE_TILES } from "../engine/ChunkManager";

/** Serialized representation of a chunk (no runtime timestamps). */
export interface SerializedChunk {
  x: number;
  y: number;
  worldId: string;
  tiles: number[][];
  objects: ChunkObject[];
  entities: string[];
  version?: number; // format version for future migrations
}

/** Simple custom map format for hand-editing. */
export interface CustomMapFormat {
  version: number;
  worldId: string;
  biome: string;
  chunks: Array<{
    x: number;
    y: number;
    /** 2D array of tile IDs or strings that map to tile IDs. */
    tileMap: (number | string)[][];
    objects?: Array<{
      type: string;
      tileX: number;
      tileY: number;
      solid?: boolean;
    }>;
  }>;
}

/** Tile ID mapping for string symbols in the custom map format. */
export const TILE_SYMBOLS: Record<string, number> = {
  ".": 0, // empty / floor
  "#": 1, // hard block
  "@": 2, // soft block
  "T": 10, // tree
  "B": 11, // bush
  "*": 12, // flower
  "R": 13, // rock
  "C": 20, // container (high-drop soft block)
  "A": 21, // ammo crate
  "G": 22, // cyber-glass block
};

/** Default chunk storage key prefix for localStorage. */
const STORAGE_KEY_PREFIX = "bombermeme_chunk_";

/** Load, save, and convert ChunkData. */
export class MapLoader {
  private storage = new Map<string, SerializedChunk>();
  private version = 1;

  /** Convert a ChunkData to a plain JSON-serializable object. */
  serialize(chunk: ChunkData): SerializedChunk {
    return {
      x: chunk.x,
      y: chunk.y,
      worldId: chunk.worldId,
      tiles: chunk.tiles,
      objects: chunk.objects,
      entities: chunk.entities,
      version: this.version,
    };
  }

  /** Convert a SerializedChunk back to ChunkData (adds runtime timestamp). */
  deserialize(data: SerializedChunk): ChunkData {
    return {
      x: data.x,
      y: data.y,
      worldId: data.worldId,
      tiles: data.tiles,
      objects: data.objects ?? [],
      entities: data.entities ?? [],
      lastAccessed: performance.now(),
    };
  }

  /** Serialize a chunk to a JSON string. */
  toJSON(chunk: ChunkData): string {
    return JSON.stringify(this.serialize(chunk));
  }

  /** Parse a chunk from a JSON string. */
  fromJSON(json: string): ChunkData {
    const parsed = JSON.parse(json) as SerializedChunk;
    return this.deserialize(parsed);
  }

  /**
   * Save a chunk to an in-memory cache and optionally to localStorage.
   * The key format is "worldId_chunkX_chunkY".
   */
  saveChunk(chunk: ChunkData, persist = false): void {
    const key = `${chunk.worldId}_${chunk.x}_${chunk.y}`;
    const serialized = this.serialize(chunk);
    this.storage.set(key, serialized);

    if (persist && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(
          `${STORAGE_KEY_PREFIX}${key}`,
          JSON.stringify(serialized),
        );
      } catch {
        // localStorage full — silently skip persistence
      }
    }
  }

  /** Load a chunk from in-memory cache, localStorage, or return null. */
  loadChunk(worldId: string, chunkX: number, chunkY: number): ChunkData | null {
    const key = `${worldId}_${chunkX}_${chunkY}`;

    // 1. Check in-memory cache
    const cached = this.storage.get(key);
    if (cached) {
      return this.deserialize(cached);
    }

    // 2. Check localStorage
    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
        if (raw) {
          const parsed = JSON.parse(raw) as SerializedChunk;
          this.storage.set(key, parsed); // promote to memory cache
          return this.deserialize(parsed);
        }
      } catch {
        // Corrupted localStorage entry — ignore
      }
    }

    return null;
  }

  /** Check if a chunk exists in storage. */
  hasChunk(worldId: string, chunkX: number, chunkY: number): boolean {
    const key = `${worldId}_${chunkX}_${chunkY}`;
    if (this.storage.has(key)) return true;
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`) !== null;
    }
    return false;
  }

  /** Remove a chunk from memory and localStorage. */
  deleteChunk(worldId: string, chunkX: number, chunkY: number): void {
    const key = `${worldId}_${chunkX}_${chunkY}`;
    this.storage.delete(key);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Load a full world (all chunks) from storage.
   * Returns only the chunks that were found.
   */
  loadWorld(worldId: string): ChunkData[] {
    const chunks: ChunkData[] = [];

    // Scan in-memory cache for matching world
    for (const [key, serialized] of this.storage) {
      if (key.startsWith(`${worldId}_`)) {
        chunks.push(this.deserialize(serialized));
      }
    }

    // Scan localStorage for any additional chunks
    if (typeof localStorage !== "undefined") {
      const prefix = `${STORAGE_KEY_PREFIX}${worldId}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey?.startsWith(prefix)) {
          const chunkKey = storageKey.slice(STORAGE_KEY_PREFIX.length);
          if (!this.storage.has(chunkKey)) {
            try {
              const raw = localStorage.getItem(storageKey);
              if (raw) {
                const parsed = JSON.parse(raw) as SerializedChunk;
                chunks.push(this.deserialize(parsed));
              }
            } catch {
              // skip corrupted entries
            }
          }
        }
      }
    }

    return chunks;
  }

  /**
   * Convert from a custom hand-edited JSON map format to ChunkData array.
   * String symbols in tileMap are resolved via TILE_SYMBOLS.
   */
  loadFromCustomFormat(data: CustomMapFormat): ChunkData[] {
    const chunks: ChunkData[] = [];

    for (const chunkDef of data.chunks) {
      const tiles: number[][] = [];

      for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
        tiles[y] = new Array<number>(CHUNK_SIZE_TILES).fill(0);
      }

      // Parse the tileMap (may be smaller than CHUNK_SIZE_TILES)
      const mapHeight = Math.min(chunkDef.tileMap.length, CHUNK_SIZE_TILES);
      for (let y = 0; y < mapHeight; y++) {
        const row = chunkDef.tileMap[y];
        const mapWidth = Math.min(row.length, CHUNK_SIZE_TILES);
        for (let x = 0; x < mapWidth; x++) {
          const cell = row[x];
          if (typeof cell === "string") {
            tiles[y][x] = TILE_SYMBOLS[cell] ?? 0;
          } else {
            tiles[y][x] = cell;
          }
        }
      }

      // Convert objects
      const objects: ChunkObject[] = (chunkDef.objects ?? []).map((obj) => ({
        id: `obj_${chunkDef.x}_${chunkDef.y}_${obj.tileX}_${obj.tileY}`,
        type: obj.type,
        x: (chunkDef.x * CHUNK_SIZE_TILES + obj.tileX) * 48,
        y: (chunkDef.y * CHUNK_SIZE_TILES + obj.tileY) * 48,
        solid: obj.solid ?? false,
        width: 48,
        height: 48,
      }));

      chunks.push({
        x: chunkDef.x,
        y: chunkDef.y,
        worldId: data.worldId,
        tiles,
        objects,
        entities: [],
        lastAccessed: performance.now(),
      });
    }

    return chunks;
  }

  /** Convert a chunk to the custom map format (for hand-editing / export). */
  toCustomFormat(chunk: ChunkData, biome: string): CustomMapFormat["chunks"][number] {
    const tileMap: number[][] = [];
    for (let y = 0; y < chunk.tiles.length; y++) {
      tileMap[y] = [...chunk.tiles[y]];
    }

    return {
      x: chunk.x,
      y: chunk.y,
      tileMap,
      objects: chunk.objects.map((obj) => ({
        type: obj.type,
        tileX: Math.floor(obj.x / 48) % CHUNK_SIZE_TILES,
        tileY: Math.floor(obj.y / 48) % CHUNK_SIZE_TILES,
        solid: obj.solid,
      })),
    };
  }

  /** Export an entire world to a single JSON string. */
  exportWorld(worldId: string, biome: string): string {
    const chunks = this.loadWorld(worldId);
    const customFormat: CustomMapFormat = {
      version: this.version,
      worldId,
      biome,
      chunks: chunks.map((c) => this.toCustomFormat(c, biome)),
    };
    return JSON.stringify(customFormat, null, 2);
  }

  /** Import a world from a JSON string (custom format). */
  importWorld(json: string): ChunkData[] {
    const data = JSON.parse(json) as CustomMapFormat;
    return this.loadFromCustomFormat(data);
  }

  /** Clear all in-memory cached chunks. */
  clearMemory(): void {
    this.storage.clear();
  }

  /** Clear all localStorage chunks for a world (or all worlds if no worldId given). */
  clearPersistent(worldId?: string): void {
    if (typeof localStorage === "undefined") return;

    const prefix = worldId
      ? `${STORAGE_KEY_PREFIX}${worldId}_`
      : STORAGE_KEY_PREFIX;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }
}
