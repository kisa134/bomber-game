// Client-side prediction for the local player. We integrate the held input each
// frame (same model as the server), then correct toward a CONTINUOUSLY SMOOTHED
// version of the authoritative position. Correcting toward the raw server
// position (which arrives in 50ms steps) injects a ~20Hz velocity ripple that
// reads as "not smooth"; smoothing the target first removes it.

import {
  GRID_W,
  GRID_H,
  TileType,
  PLAYER_HITBOX_RADIUS,
  CORNER_ASSIST,
  Direction,
} from "../net/protocol.js";

const R = PLAYER_HITBOX_RADIUS;
const EPS = 1e-4;
const SNAP_DIST = 1.5; // beyond this, hard-snap (respawn/teleport/desync)
const DEAD_ZONE = 0.04; // ignore tiny residual error
const TARGET_TAU_MS = 70; // how fast the smoothed target tracks the server
const CORRECT_PER_SEC = 10; // how fast prediction eases toward the smoothed target

export class Predictor {
  x = 0;
  y = 0;
  private tx = 0; // raw authoritative target
  private ty = 0;
  private csx = 0; // continuously smoothed target
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
      const snap = dist * CORNER_ASSIST;
      if (dir === Direction.LEFT || dir === Direction.RIGHT) {
        const cy = Math.floor(this.y) + 0.5;
        this.y += clampToward(cy - this.y, snap);
        this.moveX(dir === Direction.RIGHT ? dist : -dist);
      } else {
        const cx = Math.floor(this.x) + 0.5;
        this.x += clampToward(cx - this.x, snap);
        this.moveY(dir === Direction.DOWN ? dist : -dist);
      }
    }

    // Smooth the authoritative target so corrections have no 20Hz ripple.
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
    // Correct ONLY along the movement axis. The perpendicular axis is governed
    // by the deterministic lane-snap (identical on client and server), so we
    // must not nudge it — that nudging was the "wobble in the corridor".
    const LANE_DESYNC = 0.6; // only fix the perpendicular axis on a real desync
    if (dir === Direction.LEFT || dir === Direction.RIGHT) {
      if (Math.abs(ex) > DEAD_ZONE) this.x += ex * k;
      if (Math.abs(ey) > LANE_DESYNC) this.y += ey * k;
    } else if (dir === Direction.UP || dir === Direction.DOWN) {
      if (Math.abs(ey) > DEAD_ZONE) this.y += ey * k;
      if (Math.abs(ex) > LANE_DESYNC) this.x += ex * k;
    } else if (d > DEAD_ZONE) {
      this.x += ex * k; // standing still: align both axes to the server
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

  private moveX(step: number): void {
    const newX = this.x + step;
    const edge = step > 0 ? newX + R : newX - R;
    const cellX = Math.floor(edge);
    const rowTop = Math.floor(this.y - R + EPS);
    const rowBot = Math.floor(this.y + R - EPS);
    for (let row = rowTop; row <= rowBot; row++) {
      if (this.solid(cellX, row)) {
        this.x = step > 0 ? cellX - R - EPS : cellX + 1 + R + EPS;
        return;
      }
    }
    this.x = newX;
  }

  private moveY(step: number): void {
    const newY = this.y + step;
    const edge = step > 0 ? newY + R : newY - R;
    const cellY = Math.floor(edge);
    const colL = Math.floor(this.x - R + EPS);
    const colR = Math.floor(this.x + R - EPS);
    for (let col = colL; col <= colR; col++) {
      if (this.solid(col, cellY)) {
        this.y = step > 0 ? cellY - R - EPS : cellY + 1 + R + EPS;
        return;
      }
    }
    this.y = newY;
  }
}

function clampToward(diff: number, max: number): number {
  if (Math.abs(diff) <= max) return diff;
  return Math.sign(diff) * max;
}
