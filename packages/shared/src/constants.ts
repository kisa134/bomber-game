// All gameplay-balancing numbers live here. No magic numbers in logic.

export const TICK_RATE = 20; // Hz
export const TICK_MS = 1000 / TICK_RATE; // 50

export const GRID_W = 13;
export const GRID_H = 11;
export const GRID_SIZE = GRID_W * GRID_H; // 143 tiles
export const TILE_PX = 48; // visual only, never used for logic

export const BOMB_TIMER_MS = 2500;
export const EXPLOSION_LIFETIME_MS = 400;

export const PLAYER_BASE_SPEED = 3.2; // cells per second
export const SPEED_UP_DELTA = 0.6;
export const PLAYER_HITBOX_RADIUS = 0.35; // ~0.7 cell wide

export const MAX_PLAYERS_PER_ROOM = 4;
export const MIN_PLAYERS_TO_START = 2;

export const MATCH_LENGTH_MS = 90_000;
export const SUDDEN_DEATH_AT_MS = 60_000; // walls start closing in
export const SUDDEN_DEATH_STEP_MS = 2_000; // a new ring tile every 2s

export const COUNTDOWN_MS = 3_000;
export const END_SCREEN_MS = 5_000;
export const ROOM_LINGER_MS = 10_000;

export const SOFT_BLOCK_DENSITY = 0.7; // share of free cells filled with soft blocks
export const POWERUP_DROP_CHANCE = 0.35;

// Matchmaking
export const FILL_WITH_BOTS_AFTER_MS = 15_000; // first player waited this long
export const IDLE_KICK_MS = 10_000;

// Hard caps
export const MAX_BOMBS = 8;
export const MAX_POWER = 8;
export const MAX_SPEED = 6.0;

// Starting stats
export const START_BOMBS = 1;
export const START_POWER = 1;
export const START_SPEED = PLAYER_BASE_SPEED;

// Bomb kick travel speed (cells per second)
export const KICK_SPEED = 6.0;
