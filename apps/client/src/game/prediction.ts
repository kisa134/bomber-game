// Rollback netcode for the local player (validated in the offline simulator:
// zero render jumps and ~zero reconcile error at 20-500ms one-way latency).
//
// Model:
//  - The client runs its own fixed-tick simulation that LEADS the server by a
//    ping-based number of ticks, so its tick-stamped inputs arrive just before
//    the server needs them. Input is applied instantly -> zero input lag.
//  - Each tick we record the input and the resulting state, and send
//    INPUT_MOVE(dir, tick) to the server.
//  - On every authoritative snapshot (which carries its server tick + our
//    position) we set our recorded state for that tick to the authoritative
//    value and REPLAY all later inputs forward -> mispredictions self-correct
//    with no rubber-banding, because we compare like-for-like by tick.
//  - The render position interpolates between the last two ticks for smoothness.

import {
  GRID_W,
  GRID_H,
  TileType,
  TICK_MS,
  Direction,
  advance,
  type MoveState,
} from "../net/protocol.js";

const HISTORY = 120; // ticks of input/state history to keep (~4s at 30Hz)
const MIN_LEAD = 3;
const MAX_LEAD = 40;
const UNHEALTHY = 0.5; // cells: above this avg error, prediction is disabled
const HEALTHY = 0.2; // cells: below this it re-enables (hysteresis)

export interface PendingInput {
  tick: number;
  dir: Direction;
}

export class Predictor {
  alive = true;

  private head: MoveState = { x: 0, y: 0, dir: Direction.NONE };
  private prev: { x: number; y: number } = { x: 0, y: 0 };
  private headTick = -1;
  private frac = 0;
  private has = false;
  private speed = 3.2;
  private wallPass = false;
  private grid: Uint8Array | null = null;
  private inputHist = new Map<number, Direction>();
  private stateHist = new Map<number, { x: number; y: number; dir: Direction }>();
  private errEma = 0; // smoothed reconcile error (cells)
  private predicting = true; // false -> fall back to plain interpolation

  get ready(): boolean {
    return this.has;
  }
  /** Whether prediction is currently trustworthy (else caller interpolates). */
  get healthy(): boolean {
    return this.predicting;
  }
  get rx(): number {
    return this.prev.x + (this.head.x - this.prev.x) * this.frac;
  }
  get ry(): number {
    return this.prev.y + (this.head.y - this.prev.y) * this.frac;
  }

  reset(): void {
    this.has = false;
    this.grid = null;
    this.headTick = -1;
    this.head = { x: 0, y: 0, dir: Direction.NONE };
    this.inputHist.clear();
    this.stateHist.clear();
    this.errEma = 0;
    this.predicting = true;
  }

  private dist(): number {
    return (this.speed * TICK_MS) / 1000;
  }

  private solid = (cx: number, cy: number): boolean => {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return true;
    const t = this.grid![cy * GRID_W + cx] as TileType;
    if (t === TileType.HARD) return true;
    if (t === TileType.SOFT) return !this.wallPass;
    return false;
  };

  /** Advance the leading simulation to match the server clock + lead, applying
   *  the held input to each new tick. Returns the inputs to send this frame. */
  step(serverTimeNow: number, pingMs: number, intent: Direction): PendingInput[] {
    const out: PendingInput[] = [];
    if (!this.has || !this.grid) return out;

    const serverTickF = serverTimeNow / TICK_MS;
    this.frac = Math.max(0, Math.min(1, serverTickF - Math.floor(serverTickF)));
    // Lead must cover the FULL round trip: the clock estimate trails true server
    // time by ~one-way latency, so a half-ping lead lands our inputs in the
    // server's past and they get dropped. Full ping + margin keeps them on time.
    const lead = Math.max(MIN_LEAD, Math.min(MAX_LEAD, Math.ceil(pingMs / TICK_MS) + 3));
    const target = Math.floor(serverTickF) + lead;

    // Don't let a long stall make us spin forever.
    let budget = 8;
    while (this.headTick < target && budget-- > 0) {
      this.headTick += 1;
      this.prev = { x: this.head.x, y: this.head.y };
      if (this.alive) advance(this.head, intent, this.dist(), this.solid);
      this.inputHist.set(this.headTick, intent);
      this.stateHist.set(this.headTick, { x: this.head.x, y: this.head.y, dir: this.head.dir });
      out.push({ tick: this.headTick, dir: intent });
    }
    // Trim old history.
    const cutoff = this.headTick - HISTORY;
    for (const k of this.inputHist.keys()) if (k < cutoff) this.inputHist.delete(k);
    for (const k of this.stateHist.keys()) if (k < cutoff) this.stateHist.delete(k);
    return out;
  }

  /** Reconcile against an authoritative snapshot for `serverTick`. */
  onServerState(
    serverTick: number,
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
      this.head = { x, y, dir: Direction.NONE };
      this.prev = { x, y };
      this.headTick = serverTick;
      this.stateHist.set(serverTick, { x, y, dir: Direction.NONE });
      this.has = true;
      return;
    }

    if (!alive) {
      this.head = { x, y, dir: Direction.NONE };
      this.prev = { x, y };
      return;
    }

    const predicted = this.stateHist.get(serverTick);
    if (!predicted) {
      // We have no record this far back (huge lag / fresh): trust the server.
      this.head = { x, y, dir: Direction.NONE };
      this.prev = { x, y };
      if (this.headTick < serverTick) this.headTick = serverTick;
      this.stateHist.set(serverTick, { x, y, dir: Direction.NONE });
      return;
    }

    // Track prediction health: if our recorded position for this tick is far
    // from the authoritative one, prediction isn't working (bad clock / very
    // high jitter) -> fall back to interpolation until it recovers (hysteresis).
    const err = Math.hypot(x - predicted.x, y - predicted.y);
    this.errEma = this.errEma * 0.8 + err * 0.2;
    if (this.predicting && this.errEma > UNHEALTHY) this.predicting = false;
    else if (!this.predicting && this.errEma < HEALTHY) this.predicting = true;

    // Rollback: pin the authoritative state at serverTick, replay inputs forward.
    const base: MoveState = { x, y, dir: predicted.dir };
    this.stateHist.set(serverTick, { x, y, dir: base.dir });
    for (let t = serverTick + 1; t <= this.headTick; t++) {
      const d = this.inputHist.get(t) ?? Direction.NONE;
      advance(base, d, this.dist(), this.solid);
      this.stateHist.set(t, { x: base.x, y: base.y, dir: base.dir });
    }
    this.head = { x: base.x, y: base.y, dir: base.dir };
    const p = this.stateHist.get(this.headTick - 1);
    if (p) this.prev = { x: p.x, y: p.y };
  }
}
