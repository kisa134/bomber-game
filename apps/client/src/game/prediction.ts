// Local-player prediction with history-based reconciliation.
//
// We run the SAME deterministic arcade engine the server runs (shared
// `advance`) so the local player responds instantly to input. The server stays
// authoritative: each snapshot we compare its position to where WE predicted we
// were AT THAT SAME SERVER TIME (from a small history ring), not to where we are
// right now. That distinction is what removes the old "jump to another cell" at
// turns — during a turn our past position was also pre-turn, so the error is
// tiny. Any residual error is eased out smoothly (no snapping except on a real
// teleport). The perpendicular axis is rail-locked by `advance`, so there is no
// in-cell wobble.

import {
  GRID_W,
  GRID_H,
  TileType,
  Direction,
  advance,
  type MoveState,
} from "../net/protocol.js";

const HARD_SNAP = 2.0; // cells: a genuine teleport (respawn) snaps instantly
const CORRECT_GAIN = 0.15; // fraction of positional error absorbed per server update
const HISTORY_MS = 1500; // how much predicted history we keep for reconciliation

interface Sample {
  t: number; // server-time estimate when this position was produced
  x: number;
  y: number;
}

export class Predictor implements MoveState {
  x = 0;
  y = 0;
  dir: Direction = Direction.NONE;
  alive = true;

  private speed = 3.2;
  private wallPass = false;
  private grid: Uint8Array | null = null;
  private has = false;
  private history: Sample[] = [];

  get ready(): boolean {
    return this.has;
  }

  reset(): void {
    this.has = false;
    this.grid = null;
    this.dir = Direction.NONE;
    this.history = [];
  }

  /** Integrate local input for this frame and record the result in history. */
  step(dt: number, intent: Direction, serverTimeNow: number): void {
    if (!this.has || !this.grid) return;
    if (this.alive) {
      const dist = (this.speed * dt) / 1000;
      advance(this, intent, dist, (cx, cy) => this.solid(cx, cy));
    }
    this.history.push({ t: serverTimeNow, x: this.x, y: this.y });
    const cutoff = serverTimeNow - HISTORY_MS;
    while (this.history.length > 2 && this.history[0].t < cutoff) this.history.shift();
  }

  /** Reconcile against an authoritative snapshot tagged with its server time. */
  onServerState(
    serverTime: number,
    x: number,
    y: number,
    speed: number,
    alive: boolean,
    grid: Uint8Array,
    wallPass: boolean,
  ): void {
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
    if (!alive) {
      this.x = x;
      this.y = y;
      return;
    }
    // Where did we predict we were at this server time?
    const s = this.sampleAt(serverTime);
    const hx = s ? s.x : this.x;
    const hy = s ? s.y : this.y;
    const ex = x - hx;
    const ey = y - hy;
    if (Math.hypot(ex, ey) > HARD_SNAP) {
      this.x = x;
      this.y = y;
      return;
    }
    // That same error is still baked into our current position — ease it out.
    this.x += ex * CORRECT_GAIN;
    this.y += ey * CORRECT_GAIN;
  }

  private sampleAt(t: number): Sample | null {
    const h = this.history;
    if (!h.length) return null;
    let best = h[0];
    let bestd = Math.abs(h[0].t - t);
    for (let i = 1; i < h.length; i++) {
      const d = Math.abs(h[i].t - t);
      if (d < bestd) {
        bestd = d;
        best = h[i];
      }
    }
    return best;
  }

  private solid(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return true;
    const t = this.grid![cy * GRID_W + cx] as TileType;
    if (t === TileType.HARD) return true;
    if (t === TileType.SOFT) return !this.wallPass;
    return false;
  }
}
