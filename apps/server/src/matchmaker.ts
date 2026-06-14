import { randomUUID } from "node:crypto";
import { TICK_MS } from "@bomberpump/shared";
import { Room } from "./room.js";
import type { SendFn } from "./player.js";

interface Pending {
  roomId: string;
  name: string;
  createdAt: number;
}

const TOKEN_TTL_MS = 30_000;

export class Matchmaker {
  private readonly rooms = new Map<string, Room>();
  private readonly pending = new Map<string, Pending>();
  private loop: ReturnType<typeof setInterval> | null = null;

  /** Reserve a slot in an open room (creating one if needed). */
  quickplay(name: string): { roomId: string; token: string } {
    const room = this.findOpenRoom();
    const token = randomUUID();
    this.pending.set(token, { roomId: room.id, name, createdAt: Date.now() });
    return { roomId: room.id, token };
  }

  private findOpenRoom(): Room {
    for (const room of this.rooms.values()) {
      if (room.acceptsPlayers()) return room;
    }
    const room = new Room(randomUUID().slice(0, 8));
    this.rooms.set(room.id, room);
    return room;
  }

  /** Attach a freshly opened socket to its reserved room. Returns ids or null. */
  bindSocket(token: string, send: SendFn): { roomId: string; playerId: number } | null {
    const p = this.pending.get(token);
    if (!p) return null;
    this.pending.delete(token);
    const room = this.rooms.get(p.roomId);
    if (!room || !room.acceptsPlayers()) {
      // Room filled/closed while connecting: drop into any open room instead.
      const fallback = this.findOpenRoom();
      const player = fallback.addPlayer(p.name, send);
      return { roomId: fallback.id, playerId: player.id };
    }
    const player = room.addPlayer(p.name, send);
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
