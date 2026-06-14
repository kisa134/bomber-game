import {
  GRID_W,
  GRID_H,
  GRID_SIZE,
  SOFT_BLOCK_DENSITY,
  POWERUP_DROP_CHANCE,
  TileType,
  PowerUpType,
} from "@bomberpump/shared";

export interface Spawn {
  x: number;
  y: number;
}

/** The four corner spawns (cell centers handled by caller). */
export const SPAWNS: Spawn[] = [
  { x: 1, y: 1 },
  { x: GRID_W - 2, y: 1 },
  { x: 1, y: GRID_H - 2 },
  { x: GRID_W - 2, y: GRID_H - 2 },
];

const PU_TILE: Record<PowerUpType, TileType> = {
  [PowerUpType.BOMB_UP]: TileType.PU_BOMB,
  [PowerUpType.FIRE_UP]: TileType.PU_FIRE,
  [PowerUpType.SPEED_UP]: TileType.PU_SPEED,
  [PowerUpType.KICK]: TileType.PU_KICK,
};

export function powerupOfTile(t: TileType): PowerUpType | null {
  switch (t) {
    case TileType.PU_BOMB: return PowerUpType.BOMB_UP;
    case TileType.PU_FIRE: return PowerUpType.FIRE_UP;
    case TileType.PU_SPEED: return PowerUpType.SPEED_UP;
    case TileType.PU_KICK: return PowerUpType.KICK;
    default: return null;
  }
}

export class World {
  // Static layer: HARD / SOFT / EMPTY / PU_* (powerups on ground).
  readonly grid: Uint8Array = new Uint8Array(GRID_SIZE);
  // Transient explosion layer: ms remaining of fire on each cell (0 = none).
  readonly fire: Float32Array = new Float32Array(GRID_SIZE);

  idx(x: number, y: number): number {
    return y * GRID_W + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
  }

  tile(x: number, y: number): TileType {
    return this.grid[this.idx(x, y)] as TileType;
  }

  set(x: number, y: number, t: TileType): void {
    this.grid[this.idx(x, y)] = t;
  }

  /** Hard or soft block stops both movement and explosion rays. */
  isSolid(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    const t = this.tile(x, y);
    return t === TileType.HARD || t === TileType.SOFT;
  }

  isHard(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.tile(x, y) === TileType.HARD;
  }

  isSoft(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.tile(x, y) === TileType.SOFT;
  }

  generate(rng: () => number = Math.random): void {
    this.grid.fill(TileType.EMPTY);
    this.fire.fill(0);

    // Border + interior pillars on even/even cells = HARD.
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const border = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
        const pillar = x % 2 === 0 && y % 2 === 0;
        if (border || pillar) this.set(x, y, TileType.HARD);
      }
    }

    // Carve safe zones (L-shape) around each spawn so players aren't boxed in.
    const safe = new Set<number>();
    for (const s of SPAWNS) {
      const cells = [
        [s.x, s.y],
        [s.x + (s.x === 1 ? 1 : -1), s.y],
        [s.x, s.y + (s.y === 1 ? 1 : -1)],
      ];
      for (const [cx, cy] of cells) safe.add(this.idx(cx, cy));
    }

    // Fill soft blocks on remaining empty, non-safe cells.
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = this.idx(x, y);
        if (this.grid[i] !== TileType.EMPTY) continue;
        if (safe.has(i)) continue;
        if (rng() < SOFT_BLOCK_DENSITY) this.grid[i] = TileType.SOFT;
      }
    }
  }

  /**
   * Destroy a soft block, possibly revealing a powerup on the ground.
   * Returns the dropped powerup type, or null.
   */
  destroySoft(x: number, y: number, rng: () => number = Math.random): PowerUpType | null {
    if (!this.isSoft(x, y)) return null;
    if (rng() < POWERUP_DROP_CHANCE) {
      const pu = Math.floor(rng() * 4) as PowerUpType;
      this.set(x, y, PU_TILE[pu]);
      return pu;
    }
    this.set(x, y, TileType.EMPTY);
    return null;
  }

  /**
   * Build the grid byte array sent to clients: static tiles, with fire overlaid
   * as EXPLOSION wherever it is currently burning.
   */
  snapshotGrid(): Uint8Array {
    const out = new Uint8Array(GRID_SIZE);
    for (let i = 0; i < GRID_SIZE; i++) {
      out[i] = this.fire[i] > 0 ? TileType.EXPLOSION : this.grid[i];
    }
    return out;
  }
}
