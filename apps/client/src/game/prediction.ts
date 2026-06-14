// Client-side prediction for the local player only. We integrate the held input
// locally every frame using the same movement model as the server (grid-only
// collision; bombs are ignored here and self-correct on reconciliation), so the
// player reacts to the keyboard instantly instead of waiting a network round-trip.

import { GRID_W, GRID_H, TileType, PLAYER_HITBOX_RADIUS, Direction } from "../net/protocol.js";

const R = PLAYER_HITBOX_RADIUS;
const EPS = 1e-4;
const SNAP_DIST = 1.2; // cells; beyond this, hard-snap to the server position
const RECONCILE = 0.25; // fraction pulled toward server position per snapshot

export class Predictor {
  x = 0;
  y = 0;
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

  /** Fold in an authoritative snapshot of the local player. */
  reconcile(x: number, y: number, speed: number, alive: boolean, grid: Uint8Array, wallPass = false): void {
    this.speed = speed;
    this.alive = alive;
    this.grid = grid;
    this.wallPass = wallPass;
    if (!this.has) {
      this.x = x;
      this.y = y;
      this.has = true;
      return;
    }
    const d = Math.hypot(x - this.x, y - this.y);
    if (d > SNAP_DIST) {
      this.x = x;
      this.y = y;
    } else {
      this.x += (x - this.x) * RECONCILE;
      this.y += (y - this.y) * RECONCILE;
    }
  }

  /** Advance the predicted position by dt(ms) given the held direction. */
  step(dt: number, dir: Direction): void {
    if (!this.has || !this.alive || !this.grid || dir === Direction.NONE) return;
    const dist = (this.speed * dt) / 1000;
    if (dir === Direction.LEFT || dir === Direction.RIGHT) {
      const cy = Math.floor(this.y) + 0.5;
      this.y += clampToward(cy - this.y, dist);
      this.moveX(dir === Direction.RIGHT ? dist : -dist);
    } else {
      const cx = Math.floor(this.x) + 0.5;
      this.x += clampToward(cx - this.x, dist);
      this.moveY(dir === Direction.DOWN ? dist : -dist);
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
