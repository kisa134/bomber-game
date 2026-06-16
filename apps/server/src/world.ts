import {
  GRID_W,
  GRID_H,
  GRID_SIZE,
  POWERUP_DROP_CHANCE,
  POWERUP_COUNT,
  TileType,
  PowerUpType,
} from "@bomberpump/shared";

export interface Spawn {
  x: number;
  y: number;
}

/** The four corner spawns (cell centers handled by caller). No border ring,
 *  so spawns sit in the actual screen corners. */
export const SPAWNS: Spawn[] = [
  { x: 0, y: 0 },
  { x: GRID_W - 1, y: 0 },
  { x: 0, y: GRID_H - 1 },
  { x: GRID_W - 1, y: GRID_H - 1 },
];

const PU_TILE: Record<PowerUpType, TileType> = {
  [PowerUpType.BOMB_UP]: TileType.PU_BOMB,
  [PowerUpType.FIRE_UP]: TileType.PU_FIRE,
  [PowerUpType.SPEED_UP]: TileType.PU_SPEED,
  [PowerUpType.KICK]: TileType.PU_KICK,
  [PowerUpType.WALL_PASS]: TileType.PU_WALL,
};

export function powerupOfTile(t: TileType): PowerUpType | null {
  switch (t) {
    case TileType.PU_BOMB: return PowerUpType.BOMB_UP;
    case TileType.PU_FIRE: return PowerUpType.FIRE_UP;
    case TileType.PU_SPEED: return PowerUpType.SPEED_UP;
    case TileType.PU_KICK: return PowerUpType.KICK;
    case TileType.PU_WALL: return PowerUpType.WALL_PASS;
    default: return null;
  }
}

export class World {
  // Static layer: HARD / SOFT / EMPTY / PU_* (powerups on ground).
  readonly grid: Uint8Array = new Uint8Array(GRID_SIZE);
  // Transient explosion layer: ms remaining of fire on each cell (0 = none).
  readonly fire: Float32Array = new Float32Array(GRID_SIZE);
  // Owner (player id) of the fire on each cell, for kill attribution (-1 = none).
  readonly fireOwner: Int16Array = new Int16Array(GRID_SIZE).fill(-1);

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
    this.fireOwner.fill(-1);

    // Indestructible pillars on the classic odd/odd lattice. No border ring —
    // the screen edge is the boundary (collision handled by inBounds), so the
    // whole 17x11 field is playable and corners are open.
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (x % 2 === 1 && y % 2 === 1) this.set(x, y, TileType.HARD);
      }
    }

    // Carve safe zones (L-shape) around each corner spawn so players aren't boxed in.
    const safe = new Set<number>();
    for (const s of SPAWNS) {
      const cells = [
        [s.x, s.y],
        [s.x + (s.x === 0 ? 1 : -1), s.y],
        [s.x, s.y + (s.y === 0 ? 1 : -1)],
      ];
      for (const [cx, cy] of cells) safe.add(this.idx(cx, cy));
    }

    // Procedural soft-block layout: randomized each match but 4-fold symmetric,
    // so every corner is equally fair. Density varies per match for variety.
    const density = 0.55 + rng() * 0.3; // 0.55 .. 0.85
    const midX = Math.floor(GRID_W / 2);
    const midY = Math.floor(GRID_H / 2);
    const placeSoftMirrored = (x: number, y: number) => {
      const xs = x === GRID_W - 1 - x ? [x] : [x, GRID_W - 1 - x];
      const ys = y === GRID_H - 1 - y ? [y] : [y, GRID_H - 1 - y];
      for (const ax of xs) {
        for (const ay of ys) {
          const i = this.idx(ax, ay);
          if (this.grid[i] === TileType.EMPTY && !safe.has(i)) this.grid[i] = TileType.SOFT;
        }
      }
    };
    for (let y = 0; y <= midY; y++) {
      for (let x = 0; x <= midX; x++) {
        const i = this.idx(x, y);
        if (this.grid[i] !== TileType.EMPTY || safe.has(i)) continue;
        if (rng() < density) placeSoftMirrored(x, y);
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
      const pu = Math.floor(rng() * POWERUP_COUNT) as PowerUpType;
      this.set(x, y, PU_TILE[pu]);
      return pu;
    }
    this.set(x, y, TileType.EMPTY);
    return null;
  }

  // Reused each tick (single-threaded) to avoid per-tick allocations.
  private readonly snapBuf: Uint8Array = new Uint8Array(GRID_SIZE);

  /**
   * Render grid sent to clients: static tiles with fire overlaid as EXPLOSION.
   * Returns a reused buffer — copy it if you need to retain it past the tick.
   */
  snapshotGrid(): Uint8Array {
    const out = this.snapBuf;
    for (let i = 0; i < GRID_SIZE; i++) {
      out[i] = this.fire[i] > 0 ? TileType.EXPLOSION : this.grid[i];
    }
    return out;
  }
}
