import type { ChunkData, ChunkObject } from "@bomberpump/shared";

export const CHUNK_SIZE_TILES = 256;
export const CHUNK_LOAD_RADIUS = 2;
export const CHUNK_UNLOAD_RADIUS = 4;

export type ChunkLoader = (
  worldId: string,
  cx: number,
  cy: number,
) => Promise<ChunkData | null>;

export class ChunkManager {
  private chunks = new Map<string, ChunkData>();
  private loading = new Set<string>();
  onChunkLoaded: ((data: ChunkData) => void) | null = null;
  onChunkUnloaded: ((key: string) => void) | null = null;
  loader: ChunkLoader | null = null;
  private worldId = "default";
  private lastChunkX = Infinity;
  private lastChunkY = Infinity;

  setWorld(worldId: string): void {
    this.worldId = worldId;
  }

  static key(worldId: string, cx: number, cy: number): string {
    return `${worldId}_${cx}_${cy}`;
  }

  static worldToChunk(worldX: number, worldY: number): { cx: number; cy: number } {
    return {
      cx: Math.floor(worldX / (CHUNK_SIZE_TILES * 48)),
      cy: Math.floor(worldY / (CHUNK_SIZE_TILES * 48)),
    };
  }

  static worldToLocalTile(worldX: number, worldY: number): { lx: number; ly: number } {
    const chunkPx = CHUNK_SIZE_TILES * 48;
    return {
      lx: Math.floor((worldX % chunkPx + chunkPx) % chunkPx / 48),
      ly: Math.floor((worldY % chunkPx + chunkPx) % chunkPx / 48),
    };
  }

  getChunk(key: string): ChunkData | undefined {
    return this.chunks.get(key);
  }

  getChunkByCoord(worldId: string, cx: number, cy: number): ChunkData | undefined {
    return this.chunks.get(ChunkManager.key(worldId, cx, cy));
  }

  isSolidAt(worldX: number, worldY: number): boolean {
    const { cx, cy } = ChunkManager.worldToChunk(worldX, worldY);
    const chunk = this.getChunkByCoord(this.worldId, cx, cy);
    if (!chunk) return true;
    const { lx, ly } = ChunkManager.worldToLocalTile(worldX, worldY);
    if (ly < 0 || ly >= chunk.tiles.length) return true;
    if (lx < 0 || lx >= chunk.tiles[ly].length) return true;
    const tileId = chunk.tiles[ly][lx];
    return tileId === 1 || tileId === 2;
  }

  getTileAt(worldX: number, worldY: number): number {
    const { cx, cy } = ChunkManager.worldToChunk(worldX, worldY);
    const chunk = this.getChunkByCoord(this.worldId, cx, cy);
    if (!chunk) return -1;
    const { lx, ly } = ChunkManager.worldToLocalTile(worldX, worldY);
    if (ly < 0 || ly >= chunk.tiles.length) return -1;
    if (lx < 0 || lx >= chunk.tiles[ly].length) return -1;
    return chunk.tiles[ly][lx];
  }

  update(playerWorldX: number, playerWorldY: number): void {
    const { cx: pcx, cy: pcy } = ChunkManager.worldToChunk(playerWorldX, playerWorldY);
    if (pcx === this.lastChunkX && pcy === this.lastChunkY) return;
    this.lastChunkX = pcx;
    this.lastChunkY = pcy;

    for (let dy = -CHUNK_LOAD_RADIUS; dy <= CHUNK_LOAD_RADIUS; dy++) {
      for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
        const cx = pcx + dx;
        const cy = pcy + dy;
        const key = ChunkManager.key(this.worldId, cx, cy);
        if (!this.chunks.has(key) && !this.loading.has(key)) {
          this.loadChunk(key, this.worldId, cx, cy);
        }
        const chunk = this.chunks.get(key);
        if (chunk) chunk.lastAccessed = performance.now();
      }
    }

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

  preloadChunk(data: ChunkData): void {
    const key = ChunkManager.key(data.worldId, data.x, data.y);
    data.lastAccessed = performance.now();
    this.chunks.set(key, data);
  }

  getLoadedKeys(): string[] {
    return Array.from(this.chunks.keys());
  }

  getLoadedCount(): number {
    return this.chunks.size;
  }

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
