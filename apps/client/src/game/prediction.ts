// Local-player movement: the SAME deterministic arcade engine the server runs
// (shared `advance`). We hold our own `dir` state and drive it with the held
// `intent`; the result matches the server tick-for-tick, so there's no in-cell
// jitter. The server stays authoritative: we hard-snap only on a real desync,
// and when fully stopped we gently settle onto the (stable) server position.

import {
  GRID_W,
  GRID_H,
  TileType,
  Direction,
  advance,
  type MoveState,
} from "../net/protocol.js";

const SNAP_DIST = 0.9; // only resync if we diverge this much from the server
const SETTLE_PER_SEC = 10; // how fast we ease onto the server while standing still

export class Predictor implements MoveState {
  x = 0;
  y = 0;
  dir: Direction = Direction.NONE; // current movement direction (managed by advance)
  private tx = 0; // authoritative target
  private ty = 0;
  private has = false;
  private grid: Uint8Array | null = null;
  private speed = 3.2;
  private wallPass = false;
  alive = true;

  get ready(): boolean {
    return this.has;
  }

  reset(): void {
    this.has = false;
    this.grid = null;
    this.dir = Direction.NONE;
  }

  reconcile(x: number, y: number, speed: number, alive: boolean, grid: Uint8Array, wallPass = false): void {
    this.tx = x;
    this.ty = y;
    this.speed = speed;
    this.alive = alive;
    this.grid = grid;
    this.wallPass = wallPass;
    if (!this.has) {
      this.x = x;
      this.y = y;
      this.has = true;
    }
  }

  step(dt: number, intent: Direction): void {
    if (!this.has || !this.grid) return;

    if (!this.alive) {
      this.x = this.tx;
      this.y = this.ty;
      this.dir = Direction.NONE;
      return;
    }

    const dist = (this.speed * dt) / 1000;
    advance(this, intent, dist, (cx, cy) => this.solid(cx, cy));

    const d = Math.hypot(this.tx - this.x, this.ty - this.y);
    if (d > SNAP_DIST) {
      // Real divergence (mispredicted collision / lag spike): resync.
      this.x = this.tx;
      this.y = this.ty;
      this.dir = Direction.NONE;
    } else if (intent === Direction.NONE && this.dir === Direction.NONE) {
      // Fully stopped: ease onto the (stable) server position. No jitter.
      const k = Math.min(1, (SETTLE_PER_SEC * dt) / 1000);
      this.x += (this.tx - this.x) * k;
      this.y += (this.ty - this.y) * k;
    }
    // Moving with a small offset: trust the local sim -> perfectly smooth.
  }

  private solid(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return true;
    const t = this.grid![cy * GRID_W + cx] as TileType;
    if (t === TileType.HARD) return true;
    if (t === TileType.SOFT) return !this.wallPass;
    return false;
  }
}
