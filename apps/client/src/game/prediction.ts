// Local-player prediction: a DETERMINISTIC fixed-timestep simulation that runs
// the exact same engine and step size as the server (shared `advance` at
// TICK_MS), so given the same input it produces the same path — there is
// nothing to continuously "correct", which is what removes the micro-jerk.
//
// - We integrate in fixed TICK_MS steps and render the position interpolated
//   between the last two ticks, so motion is smooth at any display refresh rate.
// - Reconciliation is history-based with a dead-zone: each snapshot we compare
//   the authoritative position to where we predicted we were AT THAT SERVER
//   TIME. While the prediction is right (the normal case) the error is below
//   the dead-zone and we leave the position untouched -> perfectly smooth. Only
//   a genuine misprediction is eased out, and a real teleport (respawn) snaps.

import {
  GRID_W,
  GRID_H,
  TileType,
  TICK_MS,
  Direction,
  advance,
  type MoveState,
} from "../net/protocol.js";

const TICK_S = TICK_MS / 1000;
const HARD_SNAP = 2.0; // cells: a real teleport (respawn) snaps instantly
const DEADZONE = 0.35; // cells: ignore prediction error smaller than this
const BLEND = 0.2; // fraction of a beyond-dead-zone error absorbed per snapshot
const HISTORY_MS = 1500;
const MAX_ACC = 250; // ms: clamp the step accumulator (tab unfocus / hitch)

interface Sample {
  t: number;
  x: number;
  y: number;
}

export class Predictor implements MoveState {
  x = 0; // simulation position at the latest tick
  y = 0;
  dir: Direction = Direction.NONE;
  alive = true;

  private prevX = 0; // position one tick earlier (for render interpolation)
  private prevY = 0;
  private acc = 0; // ms accumulated toward the next fixed step
  private speed = 3.2;
  private wallPass = false;
  private grid: Uint8Array | null = null;
  private has = false;
  private history: Sample[] = [];

  get ready(): boolean {
    return this.has;
  }

  /** Smoothly interpolated render position between the last two ticks. */
  get rx(): number {
    const f = this.acc / TICK_MS;
    return this.prevX + (this.x - this.prevX) * f;
  }
  get ry(): number {
    const f = this.acc / TICK_MS;
    return this.prevY + (this.y - this.prevY) * f;
  }

  reset(): void {
    this.has = false;
    this.grid = null;
    this.dir = Direction.NONE;
    this.acc = 0;
    this.history = [];
  }

  /** Advance the fixed-timestep simulation by the elapsed wall-clock time. */
  step(dtMs: number, intent: Direction, serverTimeNow: number): void {
    if (!this.has || !this.grid) return;
    this.acc = Math.min(this.acc + dtMs, MAX_ACC);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.prevX = this.x;
      this.prevY = this.y;
      if (this.alive) advance(this, intent, this.speed * TICK_S, (cx, cy) => this.solid(cx, cy));
      this.history.push({ t: serverTimeNow, x: this.x, y: this.y });
    }
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
      this.x = this.prevX = x;
      this.y = this.prevY = y;
      this.has = true;
      return;
    }
    if (!alive) {
      this.x = this.prevX = x;
      this.y = this.prevY = y;
      return;
    }
    const s = this.sampleAt(serverTime);
    const ex = x - (s ? s.x : this.x);
    const ey = y - (s ? s.y : this.y);
    const e = Math.hypot(ex, ey);
    if (e > HARD_SNAP) {
      this.x = this.prevX = x;
      this.y = this.prevY = y;
      return;
    }
    if (e > DEADZONE) {
      // Genuine misprediction: ease the error out of both endpoints so the
      // render interpolation stays continuous.
      this.x += ex * BLEND;
      this.y += ey * BLEND;
      this.prevX += ex * BLEND;
      this.prevY += ey * BLEND;
    }
    // Within the dead-zone: prediction is correct, leave it alone (smooth).
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
