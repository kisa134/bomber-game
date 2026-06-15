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
// No ambiguous chars (0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class Matchmaker {
  private readonly rooms = new Map<string, Room>();
  private readonly pending = new Map<string, Pending>();
  private loop: ReturnType<typeof setInterval> | null = null;

  /** Join (or open) a public room. */
  quickplay(name: string, skin: number, wallet: string | null): { code: string; token: string } {
    let room: Room | undefined;
    for (const r of this.rooms.values()) {
      if (r.isPublic && r.acceptsPlayers()) {
        room = r;
        break;
      }
    }
    if (!room) room = this.newRoom(true);
    return this.reserve(room, name, skin, wallet);
  }

  /** Open a fresh private room with a shareable code. */
  createPrivate(name: string, skin: number, wallet: string | null): { code: string; token: string } {
    const room = this.newRoom(false);
    return this.reserve(room, name, skin, wallet);
  }

  /** Solo practice room: fills with bots and auto-starts. */
  practice(name: string, skin: number, wallet: string | null): { code: string; token: string } {
    const room = this.newRoom(false, true);
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

  private newRoom(isPublic: boolean, practice = false): Room {
    let code = this.genCode();
    while (this.rooms.has(code)) code = this.genCode();
    const room = new Room(code, isPublic, practice);
    this.rooms.set(code, room);
    return room;
  }

  private genCode(): string {
    let s = "";
    for (let i = 0; i < 4; i++) s += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
    return s;
  }

  /** Attach a freshly opened socket to its reserved room. */
  bindSocket(token: string, send: SendFn): { roomId: string; playerId: number } | null {
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
    return { roomId: room.id, playerId: player.id };
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  start(): void {
    if (this.loop) return;
    this.loop = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  private tick(): void {
    const now = Date.now();
    for (const [token, p] of this.pending) {
      if (now - p.createdAt > TOKEN_TTL_MS) this.pending.delete(token);
    }
    for (const [id, room] of this.rooms) {
      room.tick();
      if (room.dead) this.rooms.delete(id);
    }
  }

  get stats(): { rooms: number; players: number } {
    let players = 0;
    for (const r of this.rooms.values()) players += r.players.size;
    return { rooms: this.rooms.size, players };
  }
}
