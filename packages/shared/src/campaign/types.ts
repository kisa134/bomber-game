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

/** RPG attributes for player / mob progression. */
export interface Attributes {
  str: number; // strength — melee damage, carry weight
  dex: number; // dexterity — movement speed, dodge
  int: number; // intelligence — skill damage, bomb range
  vit: number; // vitality — HP pool
  luck: number; // luck — drop chance, crits
}

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
