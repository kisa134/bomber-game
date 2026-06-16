// All gameplay-balancing numbers live here. No magic numbers in logic.

// Bump whenever the binary frame layout changes; client + server must match.
export const PROTOCOL_VERSION = 8;

export const TICK_RATE = 60; // Hz — finest/most responsive base motion (2x server cost)
export const TICK_MS = 1000 / TICK_RATE; // ~16.7

export const GRID_W = 17;
export const GRID_H = 11;
export const GRID_SIZE = GRID_W * GRID_H; // 187 tiles
export const TILE_PX = 48; // visual only, never used for logic

export const BOMB_TIMER_MS = 2500;
export const EXPLOSION_LIFETIME_MS = 400;

export const PLAYER_BASE_SPEED = 3.2; // cells per second
export const SPEED_UP_DELTA = 0.42;
export const PLAYER_HITBOX_RADIUS = 0.35; // ~0.7 cell wide
// How much faster than walking a player slides onto the lane center when turning
// (forgiving corner navigation). Same value on server + client prediction.
export const CORNER_ASSIST = 2.2;

export const MAX_PLAYERS_PER_ROOM = 4;
export const MIN_PLAYERS_TO_START = 2;

export const MATCH_LENGTH_MS = 180_000; // 3 minutes
export const SUDDEN_DEATH_AT_MS = 120_000; // last minute (after 2:00): walls close in
export const SUDDEN_DEATH_STEP_MS = 500; // a new ring tile every 0.5s (closes the 17x11 in the final minute)

export const COUNTDOWN_MS = 3_000;
export const END_SCREEN_MS = 5_000;
export const ROOM_LINGER_MS = 3_000;

export const SOFT_BLOCK_DENSITY = 0.7; // share of free cells filled with soft blocks
export const POWERUP_DROP_CHANCE = 0.3;
export const HEALTH_DROP_CHANCE = 0.02; // very rare: a destroyed soft block drops +1 HP

// Health: each player has 3 HP. A bomb hit removes one and gives a brief mercy
// window (blink) instead of a respawn; at 0 HP the player is eliminated.
export const START_LIVES = 3;
export const HIT_INVULN_MS = 1200; // i-frames after taking damage (> fire lifetime)
export const WALL_PASS_MS = 5000; // wall-pass powerup is temporary

// Lobby / matchmaking (no bots — matches need real players)
export const LOBBY_COUNTDOWN_MS = 15_000; // auto-start once >= MIN players present
export const IDLE_KICK_MS = 60_000; // generous; nobody to fill in, don't punish

// Hard caps
export const MAX_BOMBS = 10;
export const MAX_POWER = 10;
export const MAX_SPEED = 6.98; // base 3.2 + 9 * 0.42 -> 10 levels in the HUD

// Starting stats
export const START_BOMBS = 1;
export const START_POWER = 1;
export const START_SPEED = PLAYER_BASE_SPEED;

// Bomb kick travel speed (cells per second)
export const KICK_SPEED = 6.0;

// --- Economy (simulated currency; real token wired later) ------------------
export const STARTING_CHIPS = 1000; // granted to a new wallet
export const BET_SIZES = [100, 250, 500, 1000, 2500] as const; // table stakes
