// Client-side prediction for the local player. Integrates the held input each
// frame with the SAME shared movement (corner-cutting) the server uses, then
// corrects toward a smoothed copy of the authoritative position — only along the
// movement axis, so the player never wobbles in a corridor.

import {
  GRID_W,
  GRID_H,
  TileType,
  PLAYER_HITBOX_RADIUS,
  Direction,
  stepMove,
} from "../net/protocol.js";

const R = PLAYER_HITBOX_RADIUS;
const SNAP_DIST = 1.5; // beyond this, hard-snap (respawn/teleport/desync)
// Movement is deterministic and identical on client & server, so prediction
// barely diverges. Keep a wide dead zone: don't fight the local sim with
// constant micro-corrections (that caused the in-cell jitter); only correct on
// a real divergence.
const DEAD_ZONE = 0.34;
const LANE_DESYNC = 0.6; // only fix the perpendicular axis on a real desync
const TARGET_TAU_MS = 70; // smoothing of the authoritative target
const CORRECT_PER_SEC = 8;

export class Predictor {
  x = 0;
  y = 0;
  private tx = 0;
  private ty = 0;
  private csx = 0;
  private csy = 0;
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
      this.x = this.csx = x;
      this.y = this.csy = y;
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

    // Smooth the authoritative target (removes the 20Hz correction ripple).
    const kt = 1 - Math.exp(-dt / TARGET_TAU_MS);
    this.csx += (this.tx - this.csx) * kt;
    this.csy += (this.ty - this.csy) * kt;

    const ex = this.csx - this.x;
    const ey = this.csy - this.y;
    const d = Math.hypot(ex, ey);
    if (!this.alive || d > SNAP_DIST) {
      this.x = this.tx;
      this.y = this.ty;
      this.csx = this.tx;
      this.csy = this.ty;
      return;
    }
    const k = Math.min(1, (CORRECT_PER_SEC * dt) / 1000);
    // Correct only along the movement axis; the perpendicular axis is governed
    // by the deterministic corner-cut (identical to the server).
    if (dir === Direction.LEFT || dir === Direction.RIGHT) {
      if (Math.abs(ex) > DEAD_ZONE) this.x += ex * k;
      if (Math.abs(ey) > LANE_DESYNC) this.y += ey * k;
    } else if (dir === Direction.UP || dir === Direction.DOWN) {
      if (Math.abs(ey) > DEAD_ZONE) this.y += ey * k;
      if (Math.abs(ex) > LANE_DESYNC) this.x += ex * k;
    } else if (d > DEAD_ZONE) {
      this.x += ex * k;
      this.y += ey * k;
    }
  }

  private solid(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return true;
    const t = this.grid![cy * GRID_W + cx] as TileType;
    if (t === TileType.HARD) return true;
    if (t === TileType.SOFT) return !this.wallPass;
    return false;
  }
}
