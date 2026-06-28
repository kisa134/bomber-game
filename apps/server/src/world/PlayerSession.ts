// PlayerSession.ts — per-connection state for the WorldServer (Issue #6)

import type { WebSocket } from "uWebSockets.js";

export interface PlayerSession {
  /** Unique session ID (UUID v4). */
  id: string;

  /** The raw uWebSockets connection. */
  ws: WebSocket<unknown>;

  /** Authenticated character ID (from world_characters table). */
  characterId: string;

  /** Player display name. */
  name: string;

  /** Current party ID, if any. */
  partyId: string | undefined;

  /** The last tick for which we received an input (for reconciliation). */
  lastInputTick: number;

  /** Smoothed RTT in ms. */
  pingMs: number;

  /** Position in world pixels (server authoritative). */
  x: number;
  y: number;

  /** Velocity (pixels/sec). */
  vx: number;
  vy: number;

  /** Current HP. */
  hp: number;
  maxHp: number;

  /** Facing direction. */
  direction: "up" | "down" | "left" | "right";

  /** Animation state. */
  animation: string;

  /** Hero type ID. */
  heroId: string;

  /** Level (for difficulty scaling). */
  level: number;

  /** Token-bucket rate limit for incoming messages. */
  msgTokens: number;
  msgTs: number;

  /** Connected at. */
  connectedAt: number;
}

/** Per-IP connection tracking for connection caps. */
export const sessionsByIp = new Map<string, number>();

export function incrIpConns(ip: string): void {
  sessionsByIp.set(ip, (sessionsByIp.get(ip) ?? 0) + 1);
}

export function decrIpConns(ip: string): void {
  const n = (sessionsByIp.get(ip) ?? 1) - 1;
  if (n > 0) sessionsByIp.set(ip, n);
  else sessionsByIp.delete(ip);
}
