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
  type ReconnectTokenMsg,
  type MatchSeedMsg,
  type PhaseMsg,
  type ExplosionEvent,
  type DeathEvent,
  type KillEvent,
  type PickupEvent,
  type MatchEndMsg,
  type KickedMsg,
  type PongMsg,
  type EmoteEventMsg,
  type CalloutEvent,
  type StakeVoteEvent,
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

// `tick` is the target server tick this input is meant for (client leads the
// server by a ping-based lead, enabling rollback prediction + reconciliation).
export function encodeMove(dir: Direction, tick: number): Uint8Array {
  const buf = new Uint8Array(6);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ClientMsg.INPUT_MOVE);
  dv.setUint8(1, dir);
  dv.setUint32(2, tick >>> 0, true);
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

export function encodeSetReady(ready: boolean): Uint8Array {
  return new Uint8Array([ClientMsg.SET_READY, ready ? 1 : 0]);
}

export function encodeEmote(emote: number): Uint8Array {
  return new Uint8Array([ClientMsg.EMOTE, emote & 0xff]);
}

export function encodeSetStake(stake: number): Uint8Array {
  const buf = new Uint8Array(5);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ClientMsg.SET_STAKE);
  dv.setUint32(1, stake >>> 0, true);
  return buf;
}

export function encodeProposeStake(stake: number): Uint8Array {
  const buf = new Uint8Array(5);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ClientMsg.PROPOSE_STAKE);
  dv.setUint32(1, stake >>> 0, true);
  return buf;
}

export function encodeVoteStake(accept: boolean): Uint8Array {
  return new Uint8Array([ClientMsg.VOTE_STAKE, accept ? 1 : 0]);
}

export function encodeKick(targetId: number): Uint8Array {
  return new Uint8Array([ClientMsg.KICK, targetId & 0xff]);
}

export function encodeSetSkin(skin: number): Uint8Array {
  return new Uint8Array([ClientMsg.SET_SKIN, skin & 0xff]);
}

export type ClientMessage =
  | { type: ClientMsg.INPUT_MOVE; dir: Direction; tick: number }
  | { type: ClientMsg.INPUT_PLACE_BOMB; seq: number }
  | { type: ClientMsg.PING; timestamp: number }
  | { type: ClientMsg.REQUEST_START }
  | { type: ClientMsg.SET_READY; ready: boolean }
  | { type: ClientMsg.EMOTE; emote: number }
  | { type: ClientMsg.SET_STAKE; stake: number }
  | { type: ClientMsg.PROPOSE_STAKE; stake: number }
  | { type: ClientMsg.VOTE_STAKE; accept: boolean }
  | { type: ClientMsg.KICK; targetId: number }
  | { type: ClientMsg.SET_SKIN; skin: number };

export function decodeClient(data: ArrayBuffer | Uint8Array): ClientMessage | null {
  const dv = asView(data);
  if (dv.byteLength < 1) return null;
  const type = dv.getUint8(0) as ClientMsg;
  switch (type) {
    case ClientMsg.INPUT_MOVE:
      if (dv.byteLength < 6) return null;
      return { type, dir: dv.getUint8(1) as Direction, tick: dv.getUint32(2, true) };
    case ClientMsg.INPUT_PLACE_BOMB:
      if (dv.byteLength < 5) return null;
      return { type, seq: dv.getUint32(1, true) };
    case ClientMsg.PING:
      if (dv.byteLength < 9) return null;
      return { type, timestamp: dv.getFloat64(1, true) };
    case ClientMsg.REQUEST_START:
      return { type };
    case ClientMsg.SET_READY:
      if (dv.byteLength < 2) return null;
      return { type, ready: dv.getUint8(1) !== 0 };
    case ClientMsg.EMOTE:
      if (dv.byteLength < 2) return null;
      return { type, emote: dv.getUint8(1) };
    case ClientMsg.SET_STAKE:
      if (dv.byteLength < 5) return null;
      return { type, stake: dv.getUint32(1, true) };
    case ClientMsg.PROPOSE_STAKE:
      if (dv.byteLength < 5) return null;
      return { type, stake: dv.getUint32(1, true) };
    case ClientMsg.VOTE_STAKE:
      if (dv.byteLength < 2) return null;
      return { type, accept: dv.getUint8(1) !== 0 };
    case ClientMsg.KICK:
      if (dv.byteLength < 2) return null;
      return { type, targetId: dv.getUint8(1) };
    case ClientMsg.SET_SKIN:
      if (dv.byteLength < 2) return null;
      return { type, skin: dv.getUint8(1) };
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

export function encodeWelcome(
  playerId: number,
  gridW: number,
  gridH: number,
  protocolVersion: number,
): Uint8Array {
  const buf = new Uint8Array(5);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.WELCOME);
  dv.setUint8(1, playerId);
  dv.setUint8(2, gridW);
  dv.setUint8(3, gridH);
  dv.setUint8(4, protocolVersion & 0xff);
  return buf;
}

// Per-player record: id(1) x(2) y(2) bombsMax(1) power(1) speed(1) flags(1) lives(1) frags(1) = 11 bytes.
const PLAYER_RECORD_BYTES = 11;
const BOMB_RECORD_BYTES = 7;

export function encodeSnapshot(
  tick: number,
  players: PlayerSnapshot[],
  bombs: BombSnapshot[],
  gridSection: Uint8Array, // pre-built [mode, ...payload]
): Uint8Array {
  // header(1+4+1) + players + bombCount(1) + bombs + gridSection
  const size =
    6 + players.length * PLAYER_RECORD_BYTES + 1 + bombs.length * BOMB_RECORD_BYTES + gridSection.length;
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
    dv.setUint8(o, b.ownerId & 0xff); o += 1;
    dv.setUint8(o, b.x); o += 1;
    dv.setUint8(o, b.y); o += 1;
    dv.setUint8(o, b.power); o += 1;
    dv.setUint16(o, Math.max(0, Math.min(65535, b.fuseLeftMs)), true); o += 2;
  }
  buf.set(gridSection, o);
  return buf;
}

/** Build the grid section: mode 0 (unchanged), 1 (changed cells), or 2 (full). */
export function gridSectionUnchanged(): Uint8Array {
  return new Uint8Array([0]);
}
export function gridSectionDelta(changes: Array<{ i: number; v: number }>): Uint8Array {
  const buf = new Uint8Array(2 + changes.length * 2);
  buf[0] = 1;
  buf[1] = changes.length;
  let o = 2;
  for (const c of changes) {
    buf[o++] = c.i;
    buf[o++] = c.v;
  }
  return buf;
}
export function gridSectionFull(grid: Uint8Array): Uint8Array {
  const buf = new Uint8Array(1 + GRID_SIZE);
  buf[0] = 2;
  buf.set(grid, 1);
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

export function encodeKicked(reason: number): Uint8Array {
  return new Uint8Array([ServerMsg.KICKED, reason & 0xff]);
}

export function encodePong(timestamp: number): Uint8Array {
  const buf = new Uint8Array(9);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.PONG);
  dv.setFloat64(1, timestamp, true);
  return buf;
}

export function encodeMatchSeed(commit: string, seed: string): Uint8Array {
  const c = textEncoder.encode(commit);
  const s = textEncoder.encode(seed);
  const buf = new Uint8Array(1 + 1 + c.length + 1 + s.length);
  let o = 0;
  buf[o++] = ServerMsg.MATCH_SEED;
  buf[o++] = c.length;
  buf.set(c, o); o += c.length;
  buf[o++] = s.length;
  buf.set(s, o);
  return buf;
}

export function encodeReconnectToken(token: string): Uint8Array {
  const tb = textEncoder.encode(token);
  const buf = new Uint8Array(2 + tb.length);
  buf[0] = ServerMsg.RECONNECT_TOKEN;
  buf[1] = tb.length;
  buf.set(tb, 2);
  return buf;
}

export function encodeRoomInfo(
  code: string,
  hostId: number,
  isHost: boolean,
  lobbyCountdownMs: number,
  stake: number,
  currency: number,
  players: RoomPlayerInfo[],
): Uint8Array {
  const codeBytes = textEncoder.encode(code);
  const nameBytes = players.map((p) => textEncoder.encode(p.name.slice(0, 24)));
  const walletBytes = players.map((p) => textEncoder.encode(p.wallet ?? ""));
  let size = 1 + 1 + 1 + 2 + 4 + 1 + 1 + codeBytes.length + 1;
  // per player: id + skin + ready + wins + nameLen + name + walletLen + wallet
  for (let i = 0; i < players.length; i++) size += 1 + 1 + 1 + 1 + 1 + nameBytes[i].length + 1 + walletBytes[i].length;
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let o = 0;
  dv.setUint8(o, ServerMsg.ROOM_INFO); o += 1;
  dv.setUint8(o, hostId); o += 1;
  dv.setUint8(o, isHost ? 1 : 0); o += 1;
  dv.setUint16(o, Math.max(0, Math.min(65535, Math.round(lobbyCountdownMs))), true); o += 2;
  dv.setUint32(o, Math.max(0, Math.min(0xffffffff, stake)), true); o += 4;
  dv.setUint8(o, currency & 0xff); o += 1;
  dv.setUint8(o, codeBytes.length); o += 1;
  buf.set(codeBytes, o); o += codeBytes.length;
  dv.setUint8(o, players.length); o += 1;
  for (let i = 0; i < players.length; i++) {
    dv.setUint8(o, players[i].id); o += 1;
    dv.setUint8(o, players[i].skin & 0xff); o += 1;
    dv.setUint8(o, players[i].ready ? 1 : 0); o += 1;
    dv.setUint8(o, Math.min(255, players[i].wins) & 0xff); o += 1;
    dv.setUint8(o, nameBytes[i].length); o += 1;
    buf.set(nameBytes[i], o); o += nameBytes[i].length;
    dv.setUint8(o, Math.min(255, walletBytes[i].length)); o += 1;
    buf.set(walletBytes[i], o); o += walletBytes[i].length;
  }
  return buf;
}

export function encodeEmoteEvent(playerId: number, emote: number): Uint8Array {
  return new Uint8Array([ServerMsg.EVENT_EMOTE, playerId & 0xff, emote & 0xff]);
}

export function encodeCallout(kind: number, playerId: number): Uint8Array {
  return new Uint8Array([ServerMsg.EVENT_CALLOUT, kind & 0xff, playerId & 0xff]);
}

export function encodeStakeVote(p: {
  stake: number;
  by: number;
  msLeft: number;
  yes: number;
  total: number;
  closed: boolean;
  accepted: boolean;
}): Uint8Array {
  const buf = new Uint8Array(11);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, ServerMsg.STAKE_VOTE);
  dv.setUint32(1, p.stake >>> 0, true);
  dv.setUint8(5, p.by & 0xff);
  dv.setUint16(6, Math.max(0, Math.min(65535, p.msLeft)), true);
  dv.setUint8(8, p.yes & 0xff);
  dv.setUint8(9, p.total & 0xff);
  dv.setUint8(10, (p.closed ? 1 : 0) | (p.accepted ? 2 : 0));
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
        protocolVersion: dv.byteLength > 4 ? dv.getUint8(4) : 0,
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
        const ownerId = dv.getUint8(o); o += 1;
        const x = dv.getUint8(o); o += 1;
        const y = dv.getUint8(o); o += 1;
        const power = dv.getUint8(o); o += 1;
        const fuseLeftMs = dv.getUint16(o, true); o += 2;
        bombs.push({ id, ownerId, x, y, power, fuseLeftMs });
      }
      const gridMode = dv.getUint8(o) as 0 | 1 | 2; o += 1;
      let gridChanges: Array<{ i: number; v: number }> | null = null;
      let gridFull: Uint8Array | null = null;
      if (gridMode === 1) {
        const count = dv.getUint8(o); o += 1;
        gridChanges = [];
        for (let k = 0; k < count; k++) {
          gridChanges.push({ i: dv.getUint8(o), v: dv.getUint8(o + 1) });
          o += 2;
        }
      } else if (gridMode === 2) {
        gridFull = bytes.slice(o, o + GRID_SIZE);
        o += GRID_SIZE;
      }
      const snap: Snapshot = { type, tick, players, bombs, gridMode, gridChanges, gridFull };
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
    case ServerMsg.KICKED: {
      const msg: KickedMsg = { type, reason: dv.getUint8(1) };
      return msg;
    }
    case ServerMsg.PONG: {
      const msg: PongMsg = { type, timestamp: dv.getFloat64(1, true) };
      return msg;
    }
    case ServerMsg.RECONNECT_TOKEN: {
      const len = dv.getUint8(1);
      const token = textDecoder.decode(bytes.subarray(2, 2 + len));
      const msg: ReconnectTokenMsg = { type, token };
      return msg;
    }
    case ServerMsg.MATCH_SEED: {
      let o = 1;
      const cl = dv.getUint8(o); o += 1;
      const commit = textDecoder.decode(bytes.subarray(o, o + cl)); o += cl;
      const sl = dv.getUint8(o); o += 1;
      const seed = textDecoder.decode(bytes.subarray(o, o + sl));
      const msg: MatchSeedMsg = { type, commit, seed };
      return msg;
    }
    case ServerMsg.ROOM_INFO: {
      let o = 1;
      const hostId = dv.getUint8(o); o += 1;
      const isHost = dv.getUint8(o) !== 0; o += 1;
      const lobbyCountdownMs = dv.getUint16(o, true); o += 2;
      const stake = dv.getUint32(o, true); o += 4;
      const currency = dv.getUint8(o); o += 1;
      const codeLen = dv.getUint8(o); o += 1;
      const code = textDecoder.decode(bytes.subarray(o, o + codeLen)); o += codeLen;
      const count = dv.getUint8(o); o += 1;
      const players: RoomPlayerInfo[] = [];
      for (let i = 0; i < count; i++) {
        const id = dv.getUint8(o); o += 1;
        const skin = dv.getUint8(o); o += 1;
        const ready = dv.getUint8(o) !== 0; o += 1;
        const wins = dv.getUint8(o); o += 1;
        const nameLen = dv.getUint8(o); o += 1;
        const name = textDecoder.decode(bytes.subarray(o, o + nameLen)); o += nameLen;
        const walletLen = dv.getUint8(o); o += 1;
        const wallet = textDecoder.decode(bytes.subarray(o, o + walletLen)); o += walletLen;
        players.push({ id, name, skin, ready, wins, wallet });
      }
      const msg: RoomInfoMsg = { type, code, hostId, isHost, lobbyCountdownMs, stake, currency, players };
      return msg;
    }
    case ServerMsg.EVENT_EMOTE: {
      if (dv.byteLength < 3) return null;
      const msg: EmoteEventMsg = { type, playerId: dv.getUint8(1), emote: dv.getUint8(2) };
      return msg;
    }
    case ServerMsg.EVENT_CALLOUT: {
      if (dv.byteLength < 3) return null;
      const msg: CalloutEvent = { type, kind: dv.getUint8(1), playerId: dv.getUint8(2) };
      return msg;
    }
    case ServerMsg.STAKE_VOTE: {
      if (dv.byteLength < 11) return null;
      const flags = dv.getUint8(10);
      const msg: StakeVoteEvent = {
        type,
        stake: dv.getUint32(1, true),
        by: dv.getUint8(5),
        msLeft: dv.getUint16(6, true),
        yes: dv.getUint8(8),
        total: dv.getUint8(9),
        closed: (flags & 1) !== 0,
        accepted: (flags & 2) !== 0,
      };
      return msg;
    }
    default:
      return null;
  }
}
