import {
  MatchPhase,
  type Snapshot,
  type PlayerSnapshot,
  type BombSnapshot,
} from "../net/protocol.js";
import { INTERP_DELAY_MS } from "../config.js";

interface TimedSnapshot {
  recvAt: number;
  snap: Snapshot;
}

/** Interpolated, render-ready view of the world at the display time. */
export interface RenderView {
  players: PlayerSnapshot[];
  bombs: BombSnapshot[];
  grid: Uint8Array | null;
}

const MAX_SNAPSHOTS = 16;

export class GameState {
  myId = -1;
  gridW = 13;
  gridH = 11;

  phase: MatchPhase = MatchPhase.LOBBY;
  phaseTimerMs = 0;
  private phaseSetAt = 0;

  winnerId = -1;
  pingMs = 0;

  private buffer: TimedSnapshot[] = [];

  addSnapshot(snap: Snapshot): void {
    this.buffer.push({ recvAt: performance.now(), snap });
    if (this.buffer.length > MAX_SNAPSHOTS) this.buffer.shift();
  }

  setPhase(phase: MatchPhase, timerMs: number): void {
    this.phase = phase;
    this.phaseTimerMs = timerMs;
    this.phaseSetAt = performance.now();
  }

  /** Remaining time in the current phase, counted down locally. */
  phaseTimeLeft(): number {
    return Math.max(0, this.phaseTimerMs - (performance.now() - this.phaseSetAt));
  }

  latest(): Snapshot | null {
    return this.buffer.length ? this.buffer[this.buffer.length - 1].snap : null;
  }

  /** Two-snapshot linear interpolation of player positions. */
  view(now: number): RenderView {
    const renderTime = now - INTERP_DELAY_MS;
    const latest = this.latest();
    if (!latest) return { players: [], bombs: [], grid: null };

    // Find the pair straddling renderTime.
    let older: TimedSnapshot | null = null;
    let newer: TimedSnapshot | null = null;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].recvAt <= renderTime) {
        older = this.buffer[i];
        newer = this.buffer[i + 1] ?? this.buffer[i];
        break;
      }
    }

    let players: PlayerSnapshot[];
    if (!older || !newer || older === newer) {
      players = latest.players;
    } else {
      const span = newer.recvAt - older.recvAt;
      const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - older.recvAt) / span)) : 0;
      players = older.snap.players.map((p0) => {
        const p1 = newer!.snap.players.find((p) => p.id === p0.id) ?? p0;
        return {
          ...p0,
          x: p0.x + (p1.x - p0.x) * t,
          y: p0.y + (p1.y - p0.y) * t,
          alive: p1.alive,
        };
      });
    }

    // Bombs and grid come straight from the newest snapshot (no lerp needed).
    return { players, bombs: latest.bombs, grid: latest.grid };
  }

  reset(): void {
    this.buffer = [];
    this.winnerId = -1;
    this.phase = MatchPhase.LOBBY;
  }
}
