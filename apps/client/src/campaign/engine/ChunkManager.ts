// ChunkManager — loads, caches, and unloads world chunks around the player.
// A chunk is 256x256 tiles. Loads in a 5x5 radius (2 chunks outward).

import type { ChunkData, ChunkObject } from "@bomberpump/shared";

export const CHUNK_SIZE_TILES = 256;
export const CHUNK_LOAD_RADIUS = 2; // 5x5 grid centered on player
export const CHUNK_UNLOAD_RADIUS = 4; // unload when farther than this

/** Async chunk loader function — provided by the game layer (fetches from server or generates locally). */
export type ChunkLoader = (
  worldId: string,
  cx: number,
  cy: number,
) => Promise<ChunkData | null>;

export class ChunkManager {
  /** Map of loaded chunks keyed as "worldId_chunkX_chunkY". */
  private chunks = new Map<string, ChunkData>();

  /** Chunks currently being loaded (dedupes concurrent requests). */
  private loading = new Set<string>();

  /** Callback invoked when a chunk finishes loading. */
  onChunkLoaded: ((data: ChunkData) => void) | null = null;

  /** Callback invoked when a chunk is unloaded. */
  onChunkUnloaded: ((key: string) => void) | null = null;

  /** The async loader — must be set before calling update(). */
  loader: ChunkLoader | null = null;

  private worldId = "default";

  /** Track player position in chunk coords for dirty-checking. */
  private lastChunkX = Infinity;
  private lastChunkY = Infinity;

  setWorld(worldId: string): void {
    this.worldId = worldId;
  }

  /** Get the chunk key string for a given world + chunk coord. */
  static key(worldId: string, cx: number, cy: number): string {
    return `${worldId}_${cx}_${cy}`;
  }

  /** Convert world pixel coords to chunk coords. */
  static worldToChunk(worldX: number, worldY: number): { cx: number; cy: number } {
    return {
      cx: Math.floor(worldX / (CHUNK_SIZE_TILES * 48)), // 48 = TILE_PX
      cy: Math.floor(worldY / (CHUNK_SIZE_TILES * 48)),
    };
  }

  /** Convert world pixel coords to local tile coords within a chunk. */
  static worldToLocalTile(worldX: number, worldY: number): { lx: number; ly: number } {
    const chunkPx = CHUNK_SIZE_TILES * 48;
    return {
      lx: Math.floor((worldX % chunkPx + chunkPx) % chunkPx / 48),
      ly: Math.floor((worldY % chunkPx + chunkPx) % chunkPx / 48),
    };
  }

  /** Get a loaded chunk by key, or undefined. */
  getChunk(key: string): ChunkData | undefined {
    return this.chunks.get(key);
  }

  /** Get a chunk by world + chunk coords. */
  getChunkByCoord(worldId: string, cx: number, cy: number): ChunkData | undefined {
    return this.chunks.get(ChunkManager.key(worldId, cx, cy));
  }

  /** Check if a tile is solid at the given world pixel position. */
  isSolidAt(worldX: number, worldY: number): boolean {
    const { cx, cy } = ChunkManager.worldToChunk(worldX, worldY);
    const chunk = this.getChunkByCoord(this.worldId, cx, cy);
    if (!chunk) return true; // unloaded = solid (safe default)
    const { lx, ly } = ChunkManager.worldToLocalTile(worldX, worldY);
    if (ly < 0 || ly >= chunk.tiles.length) return true;
    if (lx < 0 || lx >= chunk.tiles[ly].length) return true;
    const tileId = chunk.tiles[ly][lx];
    // Tile type 0 = empty/ground, 1 = hard wall, 2 = soft block
    return tileId === 1 || tileId === 2;
  }

  /** Get tile ID at world position. Returns -1 if chunk not loaded. */
  getTileAt(worldX: number, worldY: number): number {
    const { cx, cy } = ChunkManager.worldToChunk(worldX, worldY);
    const chunk = this.getChunkByCoord(this.worldId, cx, cy);
    if (!chunk) return -1;
    const { lx, ly } = ChunkManager.worldToLocalTile(worldX, worldY);
    if (ly < 0 || ly >= chunk.tiles.length) return -1;
    if (lx < 0 || lx >= chunk.tiles[ly].length) return -1;
    return chunk.tiles[ly][lx];
  }

  /** Main update: called each frame with the player's world position. */
  update(playerWorldX: number, playerWorldY: number): void {
    const { cx: pcx, cy: pcy } = ChunkManager.worldToChunk(playerWorldX, playerWorldY);

    // Skip if player hasn't changed chunks
    if (pcx === this.lastChunkX && pcy === this.lastChunkY) return;
    this.lastChunkX = pcx;
    this.lastChunkY = pcy;

    // Load chunks in radius
    for (let dy = -CHUNK_LOAD_RADIUS; dy <= CHUNK_LOAD_RADIUS; dy++) {
      for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
        const cx = pcx + dx;
        const cy = pcy + dy;
        const key = ChunkManager.key(this.worldId, cx, cy);
        if (!this.chunks.has(key) && !this.loading.has(key)) {
          this.loadChunk(key, this.worldId, cx, cy);
        }
        // Update access time
        const chunk = this.chunks.get(key);
        if (chunk) chunk.lastAccessed = performance.now();
      }
    }

    // Unload distant chunks
    const unloadKeys: string[] = [];
    for (const [key, chunk] of this.chunks) {
      const dx = Math.abs(chunk.x - pcx);
      const dy = Math.abs(chunk.y - pcy);
      if (dx > CHUNK_UNLOAD_RADIUS || dy > CHUNK_UNLOAD_RADIUS) {
        unloadKeys.push(key);
      }
    }
    for (const key of unloadKeys) {
      this.chunks.delete(key);
      this.onChunkUnloaded?.(key);
    }
  }

  private loadChunk(key: string, worldId: string, cx: number, cy: number): void {
    if (!this.loader) return;
    this.loading.add(key);
    this.loader(worldId, cx, cy)
      .then((data) => {
        this.loading.delete(key);
        if (!data) return;
        data.lastAccessed = performance.now();
        this.chunks.set(key, data);
        this.onChunkLoaded?.(data);
      })
      .catch(() => {
        this.loading.delete(key);
      });
  }

  /** Preload a specific chunk synchronously if available (for spawn). */
  preloadChunk(data: ChunkData): void {
    const key = ChunkManager.key(data.worldId, data.x, data.y);
    data.lastAccessed = performance.now();
    this.chunks.set(key, data);
  }

  /** Get all currently loaded chunk keys. */
  getLoadedKeys(): string[] {
    return Array.from(this.chunks.keys());
  }

  /** Get count of loaded chunks. */
  getLoadedCount(): number {
    return this.chunks.size;
  }

  /** Remove all chunks. */
  clear(): void {
    for (const key of this.chunks.keys()) {
      this.onChunkUnloaded?.(key);
    }
    this.chunks.clear();
    this.loading.clear();
    this.lastChunkX = Infinity;
    this.lastChunkY = Infinity;
  }
}
