// Binary protocol. Hand-rolled little-endian frames over WebSocket.
// JSON at 20 Hz x 4 players is wasteful; fixed binary frames keep snapshots ~200-300 B.
//
// Coordinate packing: positions are cell-space floats, sent as u16 = round(value * 100).
// Speed is sent as u8 = round(speed * 10).

import { GRID_SIZE } from "./constants.js";
import {
  ClientMsg,
  ServerMsg,
  Direction,
  MatchPhase,
  PowerUpType,
  type Snapshot,
  type PlayerSnapshot,
  type BombSnapshot,
  type ServerMessage,
  type WelcomeMsg,
  type RoomInfoMsg,
  type RoomPlayerInfo,
  type PhaseMsg,
  type ExplosionEvent,
  type DeathEvent,
  type KillEvent,
  type PickupEvent,
  type MatchEndMsg,
  type PongMsg,
} from "./types.js";

const POS_SCALE = 100;
const SPEED_SCALE = 10;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function asView(data: ArrayBuffer | Uint8Array): DataView {
  if (data instanceof Uint8Array) {
    return new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  return new DataView(data);
}

// ---------------------------------------------------------------------------
// Client -> Server encoders
// ---------------------------------------------------------------------------

export function encodeMove(dir: Direction, seq: number): Uint8Array {
  const buf = new Uint8Array(6);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ClientMsg.INPUT_MOVE);
  dv.setUint8(1, dir);
  dv.setUint32(2, seq >>> 0, true);
  return buf;
}

export function encodePlaceBomb(seq: number): Uint8Array {
  const buf = new Uint8Array(5);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ClientMsg.INPUT_PLACE_BOMB);
  dv.setUint32(1, seq >>> 0, true);
  return buf;
}

export function encodePing(timestamp: number): Uint8Array {
  const buf = new Uint8Array(9);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ClientMsg.PING);
  dv.setFloat64(1, timestamp, true);
  return buf;
}

export function encodeRequestStart(): Uint8Array {
  return new Uint8Array([ClientMsg.REQUEST_START]);
}

export type ClientMessage =
  | { type: ClientMsg.INPUT_MOVE; dir: Direction; seq: number }
  | { type: ClientMsg.INPUT_PLACE_BOMB; seq: number }
  | { type: ClientMsg.PING; timestamp: number }
  | { type: ClientMsg.REQUEST_START };

export function decodeClient(data: ArrayBuffer | Uint8Array): ClientMessage | null {
  const dv = asView(data);
  if (dv.byteLength < 1) return null;
  const type = dv.getUint8(0) as ClientMsg;
  switch (type) {
    case ClientMsg.INPUT_MOVE:
      if (dv.byteLength < 6) return null;
      return { type, dir: dv.getUint8(1) as Direction, seq: dv.getUint32(2, true) };
    case ClientMsg.INPUT_PLACE_BOMB:
      if (dv.byteLength < 5) return null;
      return { type, seq: dv.getUint32(1, true) };
    case ClientMsg.PING:
      if (dv.byteLength < 9) return null;
      return { type, timestamp: dv.getFloat64(1, true) };
    case ClientMsg.REQUEST_START:
      return { type };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Server -> Client encoders
// ---------------------------------------------------------------------------

// Player flag bits.
const FLAG_ALIVE = 1 << 0;
const FLAG_KICK = 1 << 1;
const FLAG_WALLPASS = 1 << 2;
const FLAG_INVULN = 1 << 3;

export function encodeWelcome(playerId: number, gridW: number, gridH: number): Uint8Array {
  const buf = new Uint8Array(4);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.WELCOME);
  dv.setUint8(1, playerId);
  dv.setUint8(2, gridW);
  dv.setUint8(3, gridH);
  return buf;
}

// Per-player record: id(1) x(2) y(2) bombsMax(1) power(1) speed(1) flags(1) lives(1) frags(1) = 11 bytes.
const PLAYER_RECORD_BYTES = 11;
const BOMB_RECORD_BYTES = 6;

export function encodeSnapshot(
  tick: number,
  players: PlayerSnapshot[],
  bombs: BombSnapshot[],
  grid: Uint8Array,
): Uint8Array {
  // header(1+4+1) + players + bombCount(1) + bombs + grid
  const size =
    6 + players.length * PLAYER_RECORD_BYTES + 1 + bombs.length * BOMB_RECORD_BYTES + GRID_SIZE;
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let o = 0;
  dv.setUint8(o, ServerMsg.STATE_SNAPSHOT); o += 1;
  dv.setUint32(o, tick >>> 0, true); o += 4;
  dv.setUint8(o, players.length); o += 1;
  for (const p of players) {
    dv.setUint8(o, p.id); o += 1;
    dv.setUint16(o, Math.round(p.x * POS_SCALE), true); o += 2;
    dv.setUint16(o, Math.round(p.y * POS_SCALE), true); o += 2;
    dv.setUint8(o, p.bombsMax); o += 1;
    dv.setUint8(o, p.power); o += 1;
    dv.setUint8(o, Math.round(p.speed * SPEED_SCALE)); o += 1; // speed*10 (0..60)
    let flags = 0;
    if (p.alive) flags |= FLAG_ALIVE;
    if (p.kick) flags |= FLAG_KICK;
    if (p.wallPass) flags |= FLAG_WALLPASS;
    if (p.invuln) flags |= FLAG_INVULN;
    dv.setUint8(o, flags); o += 1;
    dv.setUint8(o, p.lives & 0xff); o += 1;
    dv.setUint8(o, Math.min(255, Math.max(0, p.frags)) & 0xff); o += 1;
  }
  dv.setUint8(o, bombs.length); o += 1;
  for (const b of bombs) {
    dv.setUint8(o, b.id); o += 1;
    dv.setUint8(o, b.x); o += 1;
    dv.setUint8(o, b.y); o += 1;
    dv.setUint8(o, b.power); o += 1;
    dv.setUint16(o, Math.max(0, Math.min(65535, b.fuseLeftMs)), true); o += 2;
  }
  buf.set(grid, o);
  return buf;
}

export function encodePhase(phase: MatchPhase, timerMs: number): Uint8Array {
  const buf = new Uint8Array(6);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.MATCH_PHASE);
  dv.setUint8(1, phase);
  dv.setUint32(2, Math.max(0, Math.round(timerMs)) >>> 0, true);
  return buf;
}

export function encodeExplosion(cells: Array<{ x: number; y: number }>): Uint8Array {
  const buf = new Uint8Array(2 + cells.length * 2);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.EVENT_EXPLOSION);
  dv.setUint8(1, cells.length);
  let o = 2;
  for (const c of cells) {
    dv.setUint8(o, c.x); o += 1;
    dv.setUint8(o, c.y); o += 1;
  }
  return buf;
}

export function encodeDeath(playerId: number): Uint8Array {
  const buf = new Uint8Array(2);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.EVENT_PLAYER_DEATH);
  dv.setUint8(1, playerId);
  return buf;
}

export function encodeKill(killerId: number, victimId: number): Uint8Array {
  const buf = new Uint8Array(3);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.EVENT_KILL);
  dv.setUint8(1, killerId & 0xff);
  dv.setUint8(2, victimId & 0xff);
  return buf;
}

export function encodePickup(playerId: number, powerup: PowerUpType): Uint8Array {
  const buf = new Uint8Array(3);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.EVENT_PICKUP);
  dv.setUint8(1, playerId);
  dv.setUint8(2, powerup);
  return buf;
}

export function encodeMatchEnd(winnerId: number): Uint8Array {
  const buf = new Uint8Array(2);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.MATCH_END);
  dv.setUint8(1, winnerId);
  return buf;
}

export function encodePong(timestamp: number): Uint8Array {
  const buf = new Uint8Array(9);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.PONG);
  dv.setFloat64(1, timestamp, true);
  return buf;
}

export function encodeRoomInfo(
  code: string,
  hostId: number,
  isHost: boolean,
  lobbyCountdownMs: number,
  players: RoomPlayerInfo[],
): Uint8Array {
  const codeBytes = textEncoder.encode(code);
  const nameBytes = players.map((p) => textEncoder.encode(p.name.slice(0, 24)));
  let size = 1 + 1 + 1 + 2 + 1 + codeBytes.length + 1;
  for (const nb of nameBytes) size += 1 + 1 + 1 + nb.length; // id + skin + nameLen + name
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let o = 0;
  dv.setUint8(o, ServerMsg.ROOM_INFO); o += 1;
  dv.setUint8(o, hostId); o += 1;
  dv.setUint8(o, isHost ? 1 : 0); o += 1;
  dv.setUint16(o, Math.max(0, Math.min(65535, Math.round(lobbyCountdownMs))), true); o += 2;
  dv.setUint8(o, codeBytes.length); o += 1;
  buf.set(codeBytes, o); o += codeBytes.length;
  dv.setUint8(o, players.length); o += 1;
  for (let i = 0; i < players.length; i++) {
    dv.setUint8(o, players[i].id); o += 1;
    dv.setUint8(o, players[i].skin & 0xff); o += 1;
    dv.setUint8(o, nameBytes[i].length); o += 1;
    buf.set(nameBytes[i], o); o += nameBytes[i].length;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Server -> Client decoder (client side)
// ---------------------------------------------------------------------------

export function decodeServer(data: ArrayBuffer | Uint8Array): ServerMessage | null {
  const dv = asView(data);
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (dv.byteLength < 1) return null;
  const type = dv.getUint8(0) as ServerMsg;
  switch (type) {
    case ServerMsg.WELCOME: {
      const msg: WelcomeMsg = {
        type,
        playerId: dv.getUint8(1),
        gridW: dv.getUint8(2),
        gridH: dv.getUint8(3),
      };
      return msg;
    }
    case ServerMsg.STATE_SNAPSHOT: {
      let o = 1;
      const tick = dv.getUint32(o, true); o += 4;
      const playerCount = dv.getUint8(o); o += 1;
      const players: PlayerSnapshot[] = [];
      for (let i = 0; i < playerCount; i++) {
        const id = dv.getUint8(o); o += 1;
        const x = dv.getUint16(o, true) / POS_SCALE; o += 2;
        const y = dv.getUint16(o, true) / POS_SCALE; o += 2;
        const bombsMax = dv.getUint8(o); o += 1;
        const power = dv.getUint8(o); o += 1;
        const speed = dv.getUint8(o) / SPEED_SCALE; o += 1;
        const flags = dv.getUint8(o); o += 1;
        const lives = dv.getUint8(o); o += 1;
        const frags = dv.getUint8(o); o += 1;
        players.push({
          id, x, y, bombsMax, power, speed, lives, frags,
          alive: (flags & FLAG_ALIVE) !== 0,
          kick: (flags & FLAG_KICK) !== 0,
          wallPass: (flags & FLAG_WALLPASS) !== 0,
          invuln: (flags & FLAG_INVULN) !== 0,
        });
      }
      const bombCount = dv.getUint8(o); o += 1;
      const bombs: BombSnapshot[] = [];
      for (let i = 0; i < bombCount; i++) {
        const id = dv.getUint8(o); o += 1;
        const x = dv.getUint8(o); o += 1;
        const y = dv.getUint8(o); o += 1;
        const power = dv.getUint8(o); o += 1;
        const fuseLeftMs = dv.getUint16(o, true); o += 2;
        bombs.push({ id, x, y, power, fuseLeftMs });
      }
      const grid = bytes.slice(o, o + GRID_SIZE);
      const snap: Snapshot = { type, tick, players, bombs, grid };
      return snap;
    }
    case ServerMsg.MATCH_PHASE: {
      const msg: PhaseMsg = {
        type,
        phase: dv.getUint8(1) as MatchPhase,
        timerMs: dv.getUint32(2, true),
      };
      return msg;
    }
    case ServerMsg.EVENT_EXPLOSION: {
      const count = dv.getUint8(1);
      const cells: Array<{ x: number; y: number }> = [];
      let o = 2;
      for (let i = 0; i < count; i++) {
        cells.push({ x: dv.getUint8(o), y: dv.getUint8(o + 1) });
        o += 2;
      }
      const msg: ExplosionEvent = { type, cells };
      return msg;
    }
    case ServerMsg.EVENT_PLAYER_DEATH: {
      const msg: DeathEvent = { type, playerId: dv.getUint8(1) };
      return msg;
    }
    case ServerMsg.EVENT_KILL: {
      const msg: KillEvent = { type, killerId: dv.getUint8(1), victimId: dv.getUint8(2) };
      return msg;
    }
    case ServerMsg.EVENT_PICKUP: {
      const msg: PickupEvent = {
        type,
        playerId: dv.getUint8(1),
        powerup: dv.getUint8(2) as PowerUpType,
      };
      return msg;
    }
    case ServerMsg.MATCH_END: {
      const msg: MatchEndMsg = { type, winnerId: dv.getUint8(1) };
      return msg;
    }
    case ServerMsg.PONG: {
      const msg: PongMsg = { type, timestamp: dv.getFloat64(1, true) };
      return msg;
    }
    case ServerMsg.ROOM_INFO: {
      let o = 1;
      const hostId = dv.getUint8(o); o += 1;
      const isHost = dv.getUint8(o) !== 0; o += 1;
      const lobbyCountdownMs = dv.getUint16(o, true); o += 2;
      const codeLen = dv.getUint8(o); o += 1;
      const code = textDecoder.decode(bytes.subarray(o, o + codeLen)); o += codeLen;
      const count = dv.getUint8(o); o += 1;
      const players: RoomPlayerInfo[] = [];
      for (let i = 0; i < count; i++) {
        const id = dv.getUint8(o); o += 1;
        const skin = dv.getUint8(o); o += 1;
        const nameLen = dv.getUint8(o); o += 1;
        const name = textDecoder.decode(bytes.subarray(o, o + nameLen)); o += nameLen;
        players.push({ id, name, skin });
      }
      const msg: RoomInfoMsg = { type, code, hostId, isHost, lobbyCountdownMs, players };
      return msg;
    }
    default:
      return null;
  }
}
