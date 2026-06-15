import {
  MatchPhase,
  GRID_SIZE,
  TICK_MS,
  type Snapshot,
  type PlayerSnapshot,
  type BombSnapshot,
  type RoomInfoMsg,
} from "../net/protocol.js";

interface TimedSnapshot {
  recvAt: number; // local arrival time (for the playback clock)
  serverTime: number; // authoritative game time = tick * TICK_MS
  snap: Snapshot;
}

/** Interpolated, render-ready view of the world at the display time. */
export interface RenderView {
  players: PlayerSnapshot[];
  bombs: BombSnapshot[];
  grid: Uint8Array | null;
}

const MAX_SNAPSHOTS = 64; // ~2s at 30Hz — headroom for high-latency clients
const INTERP_SNAP = 1.5; // cells: bigger per-entity jumps snap instead of sliding
const CLOCK_RESYNC = 400; // ms: snap the clock on a jump this big (match start/lag)
// Adaptive playback delay: we render this far behind the latest server time so
// two snapshots always bracket the display moment. It tracks the worst recent
// inter-arrival gap, so a steady connection stays crisp (~min) while a jittery
// one buffers more (smooth but more delayed) instead of stuttering.
const MIN_DELAY = 70;
const MAX_DELAY = 500;
const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(v, hi));

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
  // Playback clock: maps local time to server time. `clockOffset` is a smoothed
  // estimate of (localTime - serverTime); rendering at (now - offset - delay)
  // gives constant-velocity interpolation independent of packet-arrival jitter.
  private clockOffset = 0;
  private clockReady = false;
  private lastArrival = 0;
  private maxGap = TICK_MS; // slowly-decaying worst inter-arrival gap
  private interpDelay = MIN_DELAY;
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
    const recvAt = performance.now();
    const serverTime = snap.tick * TICK_MS;
    this.buffer.push({ recvAt, serverTime, snap });
    if (this.buffer.length > MAX_SNAPSHOTS) this.buffer.shift();

    // Track the worst recent inter-arrival gap and size the playback delay to it.
    if (this.lastArrival > 0) {
      const gap = recvAt - this.lastArrival;
      this.maxGap = Math.max(gap, this.maxGap * 0.995);
    }
    this.lastArrival = recvAt;
    this.interpDelay = clamp(MIN_DELAY, this.maxGap + TICK_MS, MAX_DELAY);

    // Update the playback clock. Hard-resync on a big jump (match start, tick
    // reset, lag spike); otherwise track slowly so per-packet jitter is ignored.
    const desired = recvAt - serverTime;
    if (!this.clockReady || Math.abs(desired - this.clockOffset) > CLOCK_RESYNC) {
      this.clockOffset = desired;
      this.clockReady = true;
    } else {
      this.clockOffset += (desired - this.clockOffset) * 0.05;
    }
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

  /** Whether the playback clock has locked onto the server time yet. */
  get clockSynced(): boolean {
    return this.clockReady;
  }

  /** Best estimate of the current server game-time (ms), for local prediction. */
  serverNow(): number {
    return performance.now() - this.clockOffset;
  }

  /** Render-ready view. We play the world back ~INTERP_DELAY behind the latest
   *  server time and linearly interpolate every entity (including the local
   *  player) between the two snapshots that bracket that game time — keyed on
   *  the server tick, not packet arrival, so motion is constant-velocity and
   *  immune to network/tick jitter. A large per-entity jump (respawn) snaps
   *  instead of sliding across the map. */
  view(): RenderView {
    const buf = this.buffer;
    if (buf.length === 0) return { players: [], bombs: [], grid: this.grid };

    const renderTime = performance.now() - this.clockOffset - this.interpDelay;
    const newest = buf[buf.length - 1];
    // Not enough history yet, or we've outrun the buffer (lag): hold newest.
    if (buf.length === 1 || !this.clockReady || renderTime >= newest.serverTime) {
      return { players: newest.snap.players, bombs: newest.snap.bombs, grid: this.grid };
    }
    if (renderTime <= buf[0].serverTime) {
      return { players: buf[0].snap.players, bombs: buf[0].snap.bombs, grid: this.grid };
    }

    // Find a,b with a.serverTime <= renderTime <= b.serverTime.
    let j = 0;
    for (let k = 0; k < buf.length - 1; k++) {
      if (buf[k].serverTime <= renderTime && renderTime <= buf[k + 1].serverTime) {
        j = k;
        break;
      }
    }
    const a = buf[j];
    const b = buf[j + 1];
    const span = b.serverTime - a.serverTime;
    const alpha = span > 0 ? (renderTime - a.serverTime) / span : 1;

    const players = b.snap.players.map((pb) => {
      const pa = a.snap.players.find((p) => p.id === pb.id);
      if (!pa || Math.hypot(pb.x - pa.x, pb.y - pa.y) > INTERP_SNAP) return pb;
      return { ...pb, x: pa.x + (pb.x - pa.x) * alpha, y: pa.y + (pb.y - pa.y) * alpha };
    });
    const bombs = b.snap.bombs.map((bb) => {
      const ba = a.snap.bombs.find((x) => x.id === bb.id);
      if (!ba || Math.hypot(bb.x - ba.x, bb.y - ba.y) > INTERP_SNAP) return bb;
      return { ...bb, x: ba.x + (bb.x - ba.x) * alpha, y: ba.y + (bb.y - ba.y) * alpha };
    });
    return { players, bombs, grid: this.grid };
  }

  reset(): void {
    this.buffer = [];
    this.clockReady = false;
    this.clockOffset = 0;
    this.lastArrival = 0;
    this.maxGap = TICK_MS;
    this.interpDelay = MIN_DELAY;
    this.grid.fill(0);
    this.winnerId = -1;
    this.phase = MatchPhase.LOBBY;
  }
}
