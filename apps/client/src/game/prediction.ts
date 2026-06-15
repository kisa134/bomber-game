// Local-player movement: PURE deterministic rail simulation while moving (no
// per-frame server correction — that fighting caused the in-cell jitter). The
// server is authoritative but only hard-snaps us on a real desync; when idle we
// gently settle onto the server position (its target is stable, so no jitter).

import {
  GRID_W,
  GRID_H,
  TileType,
  PLAYER_HITBOX_RADIUS,
  Direction,
  stepMove,
} from "../net/protocol.js";

const R = PLAYER_HITBOX_RADIUS;
const SNAP_DIST = 0.9; // only resync if we diverge this much from the server
const SETTLE_PER_SEC = 10; // how fast we ease onto the server while standing still

export class Predictor {
  x = 0;
  y = 0;
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

  step(dt: number, dir: Direction): void {
    if (!this.has || !this.grid) return;

    if (this.alive && dir !== Direction.NONE) {
      const dist = (this.speed * dt) / 1000;
      const res = stepMove(this.x, this.y, dir, dist, R, (cx, cy) => this.solid(cx, cy));
      this.x = res.x;
      this.y = res.y;
    }

    if (!this.alive) {
      this.x = this.tx;
      this.y = this.ty;
      return;
    }
    const d = Math.hypot(this.tx - this.x, this.ty - this.y);
    if (d > SNAP_DIST) {
      // Real divergence (mispredicted collision / lag spike): resync.
      this.x = this.tx;
      this.y = this.ty;
    } else if (dir === Direction.NONE) {
      // Standing still: ease onto the (stable) server position. No jitter.
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
