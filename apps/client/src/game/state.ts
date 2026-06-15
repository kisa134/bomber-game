import {
  MatchPhase,
  GRID_SIZE,
  type Snapshot,
  type PlayerSnapshot,
  type BombSnapshot,
  type RoomInfoMsg,
} from "../net/protocol.js";

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
  seedCommit = "";
  seed = "";

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

  /** Render-ready view. Player positions are the latest authoritative values;
   *  the renderer eases remote players and the local player uses prediction, so
   *  no per-snapshot interpolation is needed here. */
  view(): RenderView {
    const latest = this.latest();
    if (!latest) return { players: [], bombs: [], grid: this.grid };
    return { players: latest.players, bombs: latest.bombs, grid: this.grid };
  }

  reset(): void {
    this.buffer = [];
    this.grid.fill(0);
    this.winnerId = -1;
    this.phase = MatchPhase.LOBBY;
  }
}
