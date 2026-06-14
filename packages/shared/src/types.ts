// Shared enums and structural types used by both client and server.

/** Tile codes stored in the grid (one byte each). */
export enum TileType {
  EMPTY = 0,
  HARD = 1,
  SOFT = 2,
  EXPLOSION = 5,
  // Powerups lying on the ground (revealed after a soft block is destroyed).
  PU_BOMB = 10,
  PU_FIRE = 11,
  PU_SPEED = 12,
  PU_KICK = 13,
}

export enum PowerUpType {
  BOMB_UP = 0,
  FIRE_UP = 1,
  SPEED_UP = 2,
  KICK = 3,
}

/** Direction sent by the client. 0 = no movement. */
export enum Direction {
  NONE = 0,
  UP = 1,
  DOWN = 2,
  LEFT = 3,
  RIGHT = 4,
}

/** Client -> Server message ids. */
export enum ClientMsg {
  INPUT_MOVE = 1,
  INPUT_PLACE_BOMB = 2,
  PING = 3,
}

/** Server -> Client message ids. */
export enum ServerMsg {
  WELCOME = 10,
  STATE_SNAPSHOT = 11,
  EVENT_EXPLOSION = 12,
  EVENT_PLAYER_DEATH = 13,
  EVENT_PICKUP = 14,
  MATCH_PHASE = 15,
  MATCH_END = 16,
  PONG = 17,
}

export enum MatchPhase {
  LOBBY = 0,
  COUNTDOWN = 1,
  PLAYING = 2,
  SUDDEN_DEATH = 3,
  END = 4,
}

export const DRAW_WINNER_ID = 255;

// ---- Decoded message shapes (client side) ----

export interface PlayerSnapshot {
  id: number;
  x: number; // cell coords (float)
  y: number;
  bombsMax: number;
  power: number;
  speed: number;
  alive: boolean;
  kick: boolean;
}

export interface BombSnapshot {
  id: number;
  x: number; // cell coords (int)
  y: number;
  power: number;
  fuseLeftMs: number;
}

export interface Snapshot {
  type: ServerMsg.STATE_SNAPSHOT;
  tick: number;
  players: PlayerSnapshot[];
  bombs: BombSnapshot[];
  grid: Uint8Array; // GRID_SIZE bytes
}

export interface WelcomeMsg {
  type: ServerMsg.WELCOME;
  playerId: number;
  gridW: number;
  gridH: number;
}

export interface PhaseMsg {
  type: ServerMsg.MATCH_PHASE;
  phase: MatchPhase;
  /** ms remaining in the current phase (e.g. countdown / match timer). */
  timerMs: number;
}

export interface ExplosionEvent {
  type: ServerMsg.EVENT_EXPLOSION;
  cells: Array<{ x: number; y: number }>;
}

export interface DeathEvent {
  type: ServerMsg.EVENT_PLAYER_DEATH;
  playerId: number;
}

export interface PickupEvent {
  type: ServerMsg.EVENT_PICKUP;
  playerId: number;
  powerup: PowerUpType;
}

export interface MatchEndMsg {
  type: ServerMsg.MATCH_END;
  winnerId: number; // DRAW_WINNER_ID for draw
}

export interface PongMsg {
  type: ServerMsg.PONG;
  timestamp: number;
}

export type ServerMessage =
  | WelcomeMsg
  | Snapshot
  | PhaseMsg
  | ExplosionEvent
  | DeathEvent
  | PickupEvent
  | MatchEndMsg
  | PongMsg;
