import {
  MatchPhase,
  GRID_SIZE,
  type Snapshot,
  type PlayerSnapshot,
  type BombSnapshot,
  type RoomInfoMsg,
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

  // Room / lobby info
  roomCode = "";
  hostId = -1;
  isHost = false;
  roomPlayers: Array<{ id: number; name: string; skin: number }> = [];
  private lobbyCountdownMs = 0;
  private lobbySetAt = 0;

  private buffer: TimedSnapshot[] = [];
  /** Persistent grid reconstructed from delta snapshots. */
  readonly grid = new Uint8Array(GRID_SIZE);

  setRoomInfo(msg: RoomInfoMsg): void {
    this.roomCode = msg.code;
    this.hostId = msg.hostId;
    this.isHost = msg.isHost;
    this.roomPlayers = msg.players;
    this.lobbyCountdownMs = msg.lobbyCountdownMs;
    this.lobbySetAt = performance.now();
  }

  /** Seconds left in the lobby auto-start countdown, or 0 if not counting. */
  lobbyCountdownLeft(): number {
    if (this.lobbyCountdownMs <= 0) return 0;
    return Math.max(0, this.lobbyCountdownMs - (performance.now() - this.lobbySetAt));
  }

  nameOf(id: number): string {
    return this.roomPlayers.find((p) => p.id === id)?.name ?? `P${id}`;
  }

  skinOf(id: number): number {
    return this.roomPlayers.find((p) => p.id === id)?.skin ?? id % 4;
  }

  addSnapshot(snap: Snapshot): void {
    // Reconstruct the grid from the delta encoding.
    if (snap.gridMode === 2 && snap.gridFull) this.grid.set(snap.gridFull);
    else if (snap.gridMode === 1 && snap.gridChanges) {
      for (const c of snap.gridChanges) this.grid[c.i] = c.v;
    }
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
    if (!latest) return { players: [], bombs: [], grid: this.grid };

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

    // Bombs from newest snapshot; grid from the reconstructed persistent buffer.
    return { players, bombs: latest.bombs, grid: this.grid };
  }

  reset(): void {
    this.buffer = [];
    this.grid.fill(0);
    this.winnerId = -1;
    this.phase = MatchPhase.LOBBY;
  }
}
