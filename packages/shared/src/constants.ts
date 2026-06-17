// All gameplay-balancing numbers live here. No magic numbers in logic.

// Bump whenever the binary frame layout changes; client + server must match.
export const PROTOCOL_VERSION = 11;

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
export const SPECTATOR_ID = 255; // welcome id sent to a spectator (not a real seat)

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
export const BET_SIZES = [100, 250, 500, 1000, 2500] as const; // chip table stakes
// Token table stakes (whole tokens). Host picks; winner takes the pot.
export const TOKEN_BET_SIZES = [1000, 5000, 25000, 100000, 500000] as const;
export const HOUSE_RAKE_BP = 0; // house rake in basis points (server env can override)

// --- Token (real pump.fun SPL token; read-only hold-to-play for now) --------
// Public mint address — safe to ship to the client (used for display + links).
export const TOKEN_MINT = "2Lbnrt7iRx2RHGBXXXc3z8Do3bp3oZ9FtkAohLvxpump";
export const TOKEN_TICKER = "BMEME";
export const TOKEN_DECIMALS = 6; // pump.fun tokens use 6 decimals
export const HOLDER_MIN = 1; // min token balance (ui amount) to count as a holder
// Withdraw bounds (whole tokens) — guardrails on the custodial cash-out.
export const MIN_WITHDRAW = 1;
export const MAX_WITHDRAW = 10_000_000;
export const STARTING_RATING = 1000; // every new wallet starts here
export const ELO_K = 32; // max swing per match; beating a stronger player pays more

/** Leagues derived from rating (badge shown next to the name). */
export interface League {
  name: string;
  emoji: string;
  min: number;
}
export const LEAGUES: League[] = [
  { name: "Champion", emoji: "👑", min: 1600 },
  { name: "Pro", emoji: "💎", min: 1350 },
  { name: "Advanced", emoji: "🔥", min: 1150 },
  { name: "Beginner", emoji: "🌱", min: 0 },
];
export function leagueFor(rating: number): League {
  return LEAGUES.find((l) => rating >= l.min) ?? LEAGUES[LEAGUES.length - 1];
}

/**
 * Elo deltas for a finished match. The winner always gains, every loser always
 * loses (per design), and the size scales with the rating gap: beating a much
 * stronger field is worth a lot, losing to weaker players costs a lot. A draw
 * (no winner) moves nobody. Returns a delta per input index.
 */
export function eloDeltas(ratings: number[], winnerIdx: number): number[] {
  const n = ratings.length;
  const deltas = new Array<number>(n).fill(0);
  if (n < 2 || winnerIdx < 0 || winnerIdx >= n) return deltas;
  const expected = (a: number, b: number): number => 1 / (1 + Math.pow(10, (b - a) / 400));
  let winnerGain = 0;
  for (let i = 0; i < n; i++) {
    if (i === winnerIdx) continue;
    // The loser's expected score against the winner; lose => -K * (that chance
    // they "should" have won is small for a weak loser, large for a strong one).
    const eLoser = expected(ratings[i], ratings[winnerIdx]);
    const loss = Math.max(1, Math.round(ELO_K * eLoser));
    deltas[i] = -loss;
    winnerGain += loss;
  }
  deltas[winnerIdx] = Math.max(1, Math.round(winnerGain / (n - 1)));
  return deltas;
}
