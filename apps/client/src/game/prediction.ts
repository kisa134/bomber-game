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

const HARD_SNAP_DIST = 2.5; // only a real teleport (respawn) snaps instantly
const CORRECT_TAU = 0.12; // seconds: how gently we ease onto the server position

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

    // Predict locally with the SAME engine the server runs (instant, responsive).
    const dist = (this.speed * dt) / 1000;
    advance(this, intent, dist, (cx, cy) => this.solid(cx, cy));

    const ex = this.tx - this.x;
    const ey = this.ty - this.y;
    if (Math.hypot(ex, ey) > HARD_SNAP_DIST) {
      // A genuine teleport (respawn / huge lag spike): snap, keep moving.
      this.x = this.tx;
      this.y = this.ty;
      return;
    }
    // Otherwise gently close the gap to the authoritative server position.
    // Input latency means a reversal briefly puts us ahead of the server; this
    // resolves the offset smoothly instead of yanking us back. The perpendicular
    // axis is rail-locked on both sides, so this never adds sideways wobble.
    const k = 1 - Math.exp(-(dt / 1000) / CORRECT_TAU);
    this.x += ex * k;
    this.y += ey * k;
  }

  private solid(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return true;
    const t = this.grid![cy * GRID_W + cx] as TileType;
    if (t === TileType.HARD) return true;
    if (t === TileType.SOFT) return !this.wallPass;
    return false;
  }
}
