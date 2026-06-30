// Campaign / BomberMeme World shared types.
// These are separate from the arena types and only used by the open-world mode.

/** 2D vector used throughout the campaign engine. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Cardinal directions used by campaign entities. */
export type CampaignDirection = "up" | "down" | "left" | "right";

/** Playable factions in BomberMeme World. */
export type FactionId =
  | "neon_cartel"
  | "iron_church"
  | "wild_circle"
  | "grate_syndicate"
  | "industrial_clan"
  | "sands_eternal"
  | "void";

/** Entity type tags for the campaign world. */
export type EntityType =
  | "player"
  | "mob"
  | "bomb"
  | "item"
  | "projectile"
  | "resource";

// NOTE: RPG `Attributes` is defined in ../rpg.ts (re-exported from the shared
// barrel). The campaign engine consumes that single definition to avoid a
// duplicate-identifier ambiguity at the barrel level.

/** A single tile in a chunk's tilemap. */
export interface TileData {
  type: number; // tile type id
  solid: boolean;
  variant: number; // visual variant for variety
}

/** An object placed in a chunk (tree, rock, building, etc). */
export interface ChunkObject {
  id: string;
  type: string;
  x: number; // world pixel coords
  y: number;
  solid: boolean;
  width: number;
  height: number;
}

/** Data for a single chunk of the world. */
export interface ChunkData {
  x: number; // chunk coord (not pixel)
  y: number;
  worldId: string;
  tiles: number[][]; // 2D array of tile type ids
  objects: ChunkObject[];
  entities: string[]; // entity IDs present in this chunk
  lastAccessed: number; // timestamp for LRU eviction
}

/** Serialized entity data for network transfer / saving. */
export interface EntityData {
  id: string;
  type: EntityType;
  position: Vec2;
  components: Record<string, unknown>;
}

/** Input state sent from client to server each tick. */
export interface PlayerInput {
  moveDir: Vec2; // normalized
  aimWorldPos: Vec2;
  isAttacking: boolean;
  isCharging: boolean;
  chargeTime: number; // ms
  isUsingSkill: boolean;
  interact: boolean;
  isRunning: boolean;
  isDodging: boolean;
}

// ─── World Server Sync Types (Issue #6) ────────────────────────────────────

/** A snapshot of an entity's state for delta sync. */
export interface EntitySnapshot {
  id: string;
  type: string;
  position: Vec2;
  velocity: Vec2;
  hp?: number;
  maxHp?: number;
  animation?: string;
  frame?: number;
  direction?: CampaignDirection;
}

/** Delta world state sent from server to clients each tick. */
export interface WorldStateDelta {
  tick: number;
  updated: EntitySnapshot[];
  removed: string[];
  added: EntitySnapshot[];
}

/** Input state for the world server — client sends this every tick. */
export interface WorldInputState {
  tick: number;
  moveX: number; // -1..1
  moveY: number; // -1..1
  attack: boolean;
  useSkill: boolean;
  interact: boolean;
  dodge: boolean;
  facing: CampaignDirection;
}

/** Client -> World Server message types. */
export enum WorldClientMsg {
  INPUT = 1,
  PING = 2,
  PARTY_CREATE = 10,
  PARTY_JOIN = 11,
  PARTY_LEAVE = 12,
  PARTY_KICK = 13,
  PARTY_TRANSFER = 14,
  PARTY_SET_LOOT = 15,
}

/** World Server -> Client message types. */
export enum WorldServerMsg {
  DELTA_STATE = 1,
  PONG = 2,
  WELCOME = 3,
  ENTITY_REMOVED = 4,
  PARTY_UPDATE = 10,
  PARTY_ERROR = 11,
  CHAT_MSG = 20,
}

// ─── Party / Co-op Types (Issue #6) ────────────────────────────────────────

export type LootMode = "free" | "round_robin" | "leader";

export interface PartyMember {
  characterId: string;
  name: string;
  level: number;
  heroId: string;
  online: boolean;
}

export interface SharedProgress {
  zonesDiscovered: string[];
  questsCompleted: string[];
  bossesKilled: string[];
  chestsOpened: string[];
  totalKills: number;
}

export interface Party {
  id: string;
  code: string; // 6-digit
  leaderId: string;
  members: PartyMember[]; // max 4
  worldId: string;
  sharedProgress: SharedProgress;
  lootMode: LootMode;
  difficultyScale: number; // 1.0 base, scales with member count + levels
}

export interface PartyUpdateMsg {
  type: WorldServerMsg.PARTY_UPDATE;
  party: Party;
}

export interface PartyErrorMsg {
  type: WorldServerMsg.PARTY_ERROR;
  code: string;
  message: string;
}

/** Reusable message interfaces for WebSocket. */
export interface WorldWelcomeMsg {
  type: WorldServerMsg.WELCOME;
  playerId: string;
  tick: number;
  worldId: string;
  spawnPos: Vec2;
}

export interface WorldPongMsg {
  type: WorldServerMsg.PONG;
  clientTimestamp: number;
  serverTimestamp: number;
}

export type WorldServerMessage =
  | { type: WorldServerMsg.DELTA_STATE; delta: WorldStateDelta }
  | WorldPongMsg
  | WorldWelcomeMsg
  | { type: WorldServerMsg.ENTITY_REMOVED; ids: string[] }
  | PartyUpdateMsg
  | PartyErrorMsg
  | { type: WorldServerMsg.CHAT_MSG; from: string; text: string };
