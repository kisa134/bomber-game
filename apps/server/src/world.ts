import {
  GRID_W,
  GRID_H,
  GRID_SIZE,
  MAX_BOMBS,
  START_BOMBS,
  MAX_POWER,
  START_POWER,
  MAX_SPEED,
  START_SPEED,
  SPEED_UP_DELTA,
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
  [PowerUpType.HEALTH]: TileType.PU_HEALTH,
};

export function powerupOfTile(t: TileType): PowerUpType | null {
  switch (t) {
    case TileType.PU_BOMB: return PowerUpType.BOMB_UP;
    case TileType.PU_FIRE: return PowerUpType.FIRE_UP;
    case TileType.PU_SPEED: return PowerUpType.SPEED_UP;
    case TileType.PU_KICK: return PowerUpType.KICK;
    case TileType.PU_WALL: return PowerUpType.WALL_PASS;
    case TileType.PU_HEALTH: return PowerUpType.HEALTH;
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
  // Powerups pre-seeded inside soft blocks (cell index -> type), revealed on break.
  readonly hiddenPowerups = new Map<number, PowerUpType>();

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

    // Open plaza in the very center (no pillars/soft) — a free arena spot.
    const ccx = (GRID_W - 1) / 2;
    const ccy = (GRID_H - 1) / 2;
    const openCenter = (x: number, y: number) =>
      Math.abs(x - ccx) <= 1 && Math.abs(y - ccy) <= 1;

    // Indestructible pillars: a 4-fold-symmetric RANDOM subset of the odd/odd
    // lattice. Any subset keeps every even row/column open, so the field is
    // always fully connected — but the pattern (and density) is unique per match.
    // No border ring: the screen edge is the boundary (collision via inBounds).
    const pillarKeep = 0.5 + rng() * 0.45; // 0.5..0.95 of lattice cells, per match
    const setHardMirror = (x: number, y: number) => {
      for (const ax of x === GRID_W - 1 - x ? [x] : [x, GRID_W - 1 - x]) {
        for (const ay of y === GRID_H - 1 - y ? [y] : [y, GRID_H - 1 - y]) {
          this.set(ax, ay, TileType.HARD);
        }
      }
    };
    const midX = Math.floor(GRID_W / 2);
    const midY = Math.floor(GRID_H / 2);
    for (let y = 1; y <= midY; y += 2) {
      for (let x = 1; x <= midX; x += 2) {
        if (!openCenter(x, y) && rng() < pillarKeep) setHardMirror(x, y);
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
    // Floor kept high enough that even the densest-pillar map has enough soft
    // blocks to hold the full powerup supply (>= ~58).
    const density = 0.7 + rng() * 0.2; // 0.70 .. 0.90
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
        if (this.grid[i] !== TileType.EMPTY || safe.has(i) || openCenter(x, y)) continue;
        if (rng() < density) placeSoftMirrored(x, y);
      }
    }

    // Pre-seed powerups into soft blocks. GUARANTEE enough core upgrades for
    // two players to fully max bombs / fire / speed, plus a couple of utilities
    // and an occasional rare heal. Deterministic from the match seed.
    this.hiddenPowerups.clear();
    const softCells: number[] = [];
    for (let i = 0; i < GRID_SIZE; i++) if (this.grid[i] === TileType.SOFT) softCells.push(i);
    for (let i = softCells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [softCells[i], softCells[j]] = [softCells[j], softCells[i]];
    }
    const PLAYERS = 2;
    const speedLevels = Math.round((MAX_SPEED - START_SPEED) / SPEED_UP_DELTA);
    const want: PowerUpType[] = [];
    const add = (pu: PowerUpType, n: number) => {
      for (let k = 0; k < n; k++) want.push(pu);
    };
    add(PowerUpType.BOMB_UP, (MAX_BOMBS - START_BOMBS) * PLAYERS);
    add(PowerUpType.FIRE_UP, (MAX_POWER - START_POWER) * PLAYERS);
    add(PowerUpType.SPEED_UP, speedLevels * PLAYERS);
    add(PowerUpType.KICK, 2);
    add(PowerUpType.WALL_PASS, 2);
    if (rng() < 0.5) add(PowerUpType.HEALTH, 1); // sometimes, very rare
    const n = Math.min(want.length, softCells.length);
    for (let i = 0; i < n; i++) this.hiddenPowerups.set(softCells[i], want[i]);
  }

  /**
   * Destroy a soft block, possibly revealing a powerup on the ground.
   * Returns the dropped powerup type, or null.
   */
  destroySoft(x: number, y: number): PowerUpType | null {
    if (!this.isSoft(x, y)) return null;
    const i = this.idx(x, y);
    const pu = this.hiddenPowerups.get(i) ?? null;
    this.hiddenPowerups.delete(i);
    this.set(x, y, pu === null ? TileType.EMPTY : PU_TILE[pu]);
    return pu;
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
