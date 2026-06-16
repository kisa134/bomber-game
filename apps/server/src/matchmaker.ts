import { randomUUID } from "node:crypto";
import { TICK_MS } from "@bomberpump/shared";
import { Room } from "./room.js";
import type { SendFn } from "./player.js";

interface Pending {
  roomId: string;
  name: string;
  skin: number;
  wallet: string | null;
  createdAt: number;
}

const TOKEN_TTL_MS = 60_000;
const MAX_ROOMS = 500; // hard cap to bound memory / room-creation DoS
const MAX_CATCHUP = 5; // fixed-timestep: max steps to run per loop iteration
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

  /** Join (or open) a public room at the given stake (0 = casual). */
  quickplay(name: string, skin: number, wallet: string | null, stake = 0): { code: string; token: string } {
    let room: Room | undefined;
    for (const r of this.rooms.values()) {
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
  ): { code: string; token: string } {
    const room = this.newRoom(true, false, stake);
    return this.reserve(room, name, skin, wallet);
  }

  /** Solo practice room: fills with bots and auto-starts. Never staked. */
  practice(name: string, skin: number, wallet: string | null): { code: string; token: string } {
    const room = this.newRoom(false, true, 0);
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
    return this.reserve(room, name, skin, wallet);
  }

  private reserve(
    room: Room,
    name: string,
    skin: number,
    wallet: string | null,
  ): { code: string; token: string } {
    const token = randomUUID();
    this.pending.set(token, { roomId: room.id, name, skin, wallet, createdAt: Date.now() });
    return { code: room.id, token };
  }

  private newRoom(isPublic: boolean, practice = false, stake = 0): Room {
    if (this.rooms.size >= MAX_ROOMS) throw new ServerFullError();
    let code = this.genCode();
    while (this.rooms.has(code)) code = this.genCode();
    const room = new Room(code, isPublic, practice, stake);
    this.rooms.set(code, room);
    return room;
  }

  /** Open public tables (lobby, joinable) for the lobby browser. */
  listTables(): Array<{ code: string; stake: number; players: number; max: number }> {
    const out: Array<{ code: string; stake: number; players: number; max: number }> = [];
    for (const r of this.rooms.values()) {
      if (r.isPublic && !r.practice && r.acceptsPlayers()) {
        out.push({ code: r.id, stake: r.stake, players: r.players.size, max: r.maxPlayers });
      }
    }
    return out.sort((a, b) => a.stake - b.stake || b.players - a.players);
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
    let room = this.rooms.get(p.roomId);
    if (!room || !room.acceptsPlayers()) {
      // Room filled/closed while connecting: drop into any open public room.
      room = undefined;
      for (const r of this.rooms.values()) {
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
    const now = Date.now();
    for (const [token, p] of this.pending) {
      if (now - p.createdAt > TOKEN_TTL_MS) this.pending.delete(token);
    }
    for (const [id, room] of this.rooms) {
      room.tick();
      if (room.dead) {
        room.cleanupReconnect(this.reconnects);
        this.rooms.delete(id);
      }
    }
  }

  get stats(): { rooms: number; players: number } {
    let players = 0;
    for (const r of this.rooms.values()) players += r.players.size;
    return { rooms: this.rooms.size, players };
  }
}
