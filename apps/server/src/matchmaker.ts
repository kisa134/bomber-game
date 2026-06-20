import { randomUUID } from "node:crypto";
import { TICK_MS, BotDifficulty, Currency, MatchPhase } from "@bomberpump/shared";
import { Room } from "./room.js";
import { alert } from "./alert.js";
import type { SendFn } from "./player.js";

interface Pending {
  roomId: string;
  name: string;
  skin: number;
  wallet: string | null;
  createdAt: number;
  spectator: boolean;
}

const TOKEN_TTL_MS = 60_000;
// Hard cap to bound memory / room-creation DoS. Tunable via env so capacity can
// be set from a load test without a code change.
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? 500) || 500;
const MAX_CATCHUP = 5; // fixed-timestep: max steps to run per loop iteration
// When one tick of all-rooms simulation costs more than this, we're saturating
// the single game-loop thread — stop opening NEW rooms (shed load) so existing
// matches keep their 60Hz instead of everyone degrading together.
const LOAD_BUSY_MS = (1000 / 60) * 0.7; // ~70% of the tick budget
// No ambiguous chars (0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class ServerFullError extends Error {
  constructor() {
    super("server_full");
  }
}

export class Matchmaker {
  private readonly rooms = new Map<string, Room>();
  private readonly pending = new Map<string, Pending>();
  private readonly reconnects = new Map<string, { roomId: string; playerId: number }>();
  private loop: ReturnType<typeof setInterval> | null = null;
  private lastTime = 0;
  private acc = 0;
  private tickEmaMs = 0; // EMA of one full-tick (all rooms) duration
  private tickPeakMs = 0; // slowly-decaying peak tick duration
  private reconnectSweep = 0; // ticks since the last stale-reconnect-token prune

  /** Join (or open) a public room at the given stake (0 = casual). */
  quickplay(name: string, skin: number, wallet: string | null, stake = 0): { code: string; token: string } {
    let room: Room | undefined;
    for (const r of this.rooms.values()) {
      // Skip rooms where this wallet already sits (no playing yourself).
      if (wallet && r.hasWallet(wallet)) continue;
      if (r.isPublic && r.stake === stake && r.acceptsPlayers()) {
        room = r;
        break;
      }
    }
    if (!room) room = this.newRoom(true, false, stake);
    return this.reserve(room, name, skin, wallet);
  }

  /** Open a fresh public table at the given stake. It shows up in the public
   *  tables browser AND has a shareable code so the host can invite friends. */
  createTable(
    name: string,
    skin: number,
    wallet: string | null,
    stake = 0,
    currency: Currency = Currency.CHIPS,
  ): { code: string; token: string } {
    const room = this.newRoom(true, false, stake, BotDifficulty.NORMAL, currency);
    return this.reserve(room, name, skin, wallet);
  }

  /** Solo practice room: fills with bots and auto-starts. Never staked. */
  practice(
    name: string,
    skin: number,
    wallet: string | null,
    difficulty: BotDifficulty = BotDifficulty.NORMAL,
    botCount = 3,
  ): { code: string; token: string } {
    const room = this.newRoom(false, true, 0, difficulty, Currency.CHIPS, botCount);
    return this.reserve(room, name, skin, wallet);
  }

  /** Join a specific room by its code. Returns null if missing/closed/full. */
  joinByCode(
    code: string,
    name: string,
    skin: number,
    wallet: string | null,
  ): { code: string; token: string } | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || !room.acceptsPlayers()) return null;
    if (wallet && room.hasWallet(wallet)) return null; // already seated here
    return this.reserve(room, name, skin, wallet);
  }

  private reserve(
    room: Room,
    name: string,
    skin: number,
    wallet: string | null,
    spectator = false,
  ): { code: string; token: string } {
    const token = randomUUID();
    this.pending.set(token, { roomId: room.id, name, skin, wallet, createdAt: Date.now(), spectator });
    return { code: room.id, token };
  }

  /** Reserve a watch-only seat in a specific live match. */
  spectate(code: string): { code: string; token: string } | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || !room.watchable) return null;
    return this.reserve(room, "spectator", 0, null, true);
  }

  /** Reserve a watch-only seat in any live public match (for a quick "watch"). */
  spectateAny(): { code: string; token: string } | null {
    for (const r of this.rooms.values()) {
      if (r.isPublic && !r.practice && r.watchable && r.humanCount > 0) {
        return this.reserve(r, "spectator", 0, null, true);
      }
    }
    return null;
  }

  private newRoom(
    isPublic: boolean,
    practice = false,
    stake = 0,
    botDifficulty: BotDifficulty = BotDifficulty.NORMAL,
    currency: Currency = Currency.CHIPS,
    botCount = 3,
  ): Room {
    // Refuse new rooms when at the hard cap OR when the sim thread is saturated
    // (load shedding) — existing matches keep running smoothly.
    if (this.rooms.size >= MAX_ROOMS || this.load.busy) throw new ServerFullError();
    let code = this.genCode();
    while (this.rooms.has(code)) code = this.genCode();
    const room = new Room(code, isPublic, practice, stake, botDifficulty, currency, botCount);
    this.rooms.set(code, room);
    return room;
  }

  /** Public tables for the browser: joinable (lobby) ones AND live ones to watch. */
  listTables(): Array<{ code: string; stake: number; currency: Currency; players: number; max: number; live: boolean }> {
    type Row = { code: string; stake: number; currency: Currency; players: number; max: number; live: boolean };
    const out: Row[] = [];
    for (const r of this.rooms.values()) {
      if (!r.isPublic || r.practice) continue;
      const base = { code: r.id, stake: r.stake, currency: r.currency, players: r.players.size, max: r.maxPlayers };
      if (r.acceptsPlayers()) out.push({ ...base, live: false });
      else if (r.watchable && r.humanCount > 0) out.push({ ...base, live: true });
    }
    // Joinable first, then live; within each, by stake then fullness.
    return out.sort((a, b) => Number(a.live) - Number(b.live) || a.stake - b.stake || b.players - a.players);
  }

  private genCode(): string {
    let s = "";
    for (let i = 0; i < 4; i++) s += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
    return s;
  }

  /** Attach a freshly opened socket to its reserved room. */
  bindSocket(
    token: string,
    send: SendFn,
  ): { roomId: string; playerId: number; reconnectToken: string } | null {
    const p = this.pending.get(token);
    if (!p) return null;
    this.pending.delete(token);
    // Spectators attach watch-only to their live room (no seat, no reconnect).
    if (p.spectator) {
      const room = this.rooms.get(p.roomId);
      if (!room || !room.watchable) return null;
      const playerId = room.addSpectator(send);
      return { roomId: room.id, playerId, reconnectToken: "" };
    }
    let room = this.rooms.get(p.roomId);
    if (!room || !room.acceptsPlayers()) {
      // Room filled/closed while connecting: drop into any open public room
      // this wallet isn't already seated in.
      room = undefined;
      for (const r of this.rooms.values()) {
        if (p.wallet && r.hasWallet(p.wallet)) continue;
        if (r.isPublic && r.acceptsPlayers()) {
          room = r;
          break;
        }
      }
      if (!room) room = this.newRoom(true);
    }
    const player = room.addPlayer(p.name, p.skin, send, p.wallet);
    const reconnectToken = randomUUID();
    this.reconnects.set(reconnectToken, { roomId: room.id, playerId: player.id });
    return { roomId: room.id, playerId: player.id, reconnectToken };
  }

  /** Re-attach a dropped socket to its existing player within the grace window. */
  reconnect(reconnectToken: string, send: SendFn): { roomId: string; playerId: number } | null {
    const e = this.reconnects.get(reconnectToken);
    if (!e) return null;
    const room = this.rooms.get(e.roomId);
    if (!room || !room.rebind(e.playerId, send)) {
      this.reconnects.delete(reconnectToken);
      return null;
    }
    return { roomId: e.roomId, playerId: e.playerId };
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  start(): void {
    if (this.loop) return;
    this.lastTime = Date.now();
    this.acc = 0;
    this.loop = setInterval(() => this.step(), TICK_MS);
  }

  stop(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  /** Graceful shutdown: stop the sim and refund every in-flight staked pot so a
   *  deploy/restart (SIGTERM) never strands money that was escrowed but not yet
   *  settled. Best-effort and awaited. */
  async shutdown(): Promise<void> {
    this.stop();
    for (const r of this.rooms.values()) {
      try {
        await r.refundActivePot();
      } catch (e) {
        console.error("[shutdown] refund failed for room", r.id, e);
      }
    }
  }

  /**
   * Fixed-timestep accumulator: run exactly as many TICK_MS steps as real time
   * has elapsed, so game time tracks the wall clock (no slow-motion under load,
   * and dt-based and Date.now-based timers stay aligned). Backlog beyond
   * MAX_CATCHUP steps is dropped to avoid a spiral of death.
   */
  private step(): void {
    const now = Date.now();
    this.acc += now - this.lastTime;
    this.lastTime = now;
    let steps = 0;
    while (this.acc >= TICK_MS && steps < MAX_CATCHUP) {
      this.runTick();
      this.acc -= TICK_MS;
      steps++;
    }
    if (this.acc > TICK_MS * MAX_CATCHUP) this.acc = 0;
  }

  private runTick(): void {
    const t0 = performance.now();
    const now = Date.now();
    for (const [token, p] of this.pending) {
      if (now - p.createdAt > TOKEN_TTL_MS) this.pending.delete(token);
    }
    for (const [id, room] of this.rooms) {
      try {
        room.tick();
      } catch (e) {
        // One room throwing must NEVER stall the shared 60Hz loop for everyone.
        // Quarantine it: best-effort refund of any escrowed pot, then drop it.
        console.error("[loop] room.tick threw — quarantining room", id, e);
        alert(`room ${id} crashed in tick() — quarantined (${(e as Error)?.message ?? e})`);
        try {
          void room.refundActivePot();
        } catch {
          /* best-effort */
        }
        room.cleanupReconnect(this.reconnects);
        this.rooms.delete(id);
        continue;
      }
      if (room.dead) {
        room.cleanupReconnect(this.reconnects);
        this.rooms.delete(id);
      }
    }
    // Periodically prune reconnect tokens whose room is gone or whose player has
    // left a still-living room — otherwise long-lived public rooms leak a token
    // for every player who ever passed through. (~every 10s at 60Hz.)
    if (++this.reconnectSweep >= 600) {
      this.reconnectSweep = 0;
      for (const [rt, e] of this.reconnects) {
        const room = this.rooms.get(e.roomId);
        if (!room || !room.hasPlayer(e.playerId)) this.reconnects.delete(rt);
      }
    }
    const dur = performance.now() - t0;
    this.tickEmaMs = this.tickEmaMs * 0.9 + dur * 0.1;
    this.tickPeakMs = Math.max(this.tickPeakMs * 0.995, dur); // slow decay
  }

  /** Game-loop load: average/peak tick cost and whether we're saturating the
   *  single simulation thread (used to shed new-room load and shown in /admin). */
  get load(): { tickMs: number; peakMs: number; budgetMs: number; busy: boolean } {
    return {
      tickMs: Math.round(this.tickEmaMs * 10) / 10,
      peakMs: Math.round(this.tickPeakMs * 10) / 10,
      budgetMs: Math.round((1000 / 60) * 10) / 10,
      busy: this.tickEmaMs > LOAD_BUSY_MS,
    };
  }

  get stats(): { rooms: number; players: number } {
    let players = 0;
    for (const r of this.rooms.values()) players += r.players.size;
    return { rooms: this.rooms.size, players };
  }

  /** Richer live snapshot for the admin panel. */
  get adminStats(): {
    rooms: number;
    humans: number;
    bots: number;
    playing: number;
    lobby: number;
  } {
    let humans = 0;
    let bots = 0;
    let playing = 0;
    let lobby = 0;
    for (const r of this.rooms.values()) {
      humans += r.humanCount;
      bots += r.players.size - r.humanCount;
      if (r.phase === MatchPhase.PLAYING || r.phase === MatchPhase.SUDDEN_DEATH) playing++;
      else lobby++;
    }
    return { rooms: this.rooms.size, humans, bots, playing, lobby };
  }
}
