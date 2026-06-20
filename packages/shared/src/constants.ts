// All gameplay-balancing numbers live here. No magic numbers in logic.

// Bump whenever the binary frame layout changes; client + server must match.
export const PROTOCOL_VERSION = 17;

export const TICK_RATE = 60; // Hz — finest/most responsive base motion (2x server cost)
export const TICK_MS = 1000 / TICK_RATE; // ~16.7

// Network snapshot rate: the server SIMULATES at TICK_RATE but only BROADCASTS
// world snapshots this often. The client interpolates between them, so 30Hz is
// visually smooth while halving bandwidth, packet rate (battery/jitter on
// mobile) and broadcast CPU (≈2x more rooms per box). Events (bombs, kills,
// explosions) are still sent immediately, not on this cadence.
export const SNAPSHOT_RATE = 30; // Hz
export const SNAPSHOT_DIV = Math.max(1, Math.round(TICK_RATE / SNAPSHOT_RATE));

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

// Chips earned from non-staked matches (practice/bots and free quickplay), so
// chips are a soft currency you grind toward skins. Staked matches pay the pot
// instead, so these flat rewards apply only when stake === 0.
export const CHIPS_WIN_REWARD = 100; // winner of a free match
export const CHIPS_PLAY_REWARD = 20; // everyone else who finished
// Competitive Bots Match: tiny rewards (well below real PvP); Sandbox gives none.
export const BOT_WIN_CHIPS = 20;
export const BOT_PLAY_CHIPS = 5;
export const BOT_WIN_XP = 15;
export const BOT_PLAY_XP = 5;

// --- Skins (cosmetic; unlock by leveling up + chips, OR buy with token) -----
// Index: 0 Shiba, 1 Pepe, 2 Trump, 3 Musk, 4 Doge, 5 Pump, 6 Durov, 7 Vitalik,
//        8 Troll, 9 Bogdanoff, 10 Gigachad. The cooler/rarer it is, the dearer.
export const SKIN_COUNT = 11;
// The first 4 are free & owned from the start.
export const DEFAULT_SKINS = 0b0000_1111;
// Chip price to UNLOCK a skin (also requires reaching SKIN_UNLOCK_LEVEL). 0 = free.
export const SKIN_PRICES = [0, 0, 0, 0, 2000, 3500, 5000, 7000, 9000, 12000, 20000] as const;
// Player level required before a skin can be bought with chips. 0 = no gate.
export const SKIN_UNLOCK_LEVEL = [0, 0, 0, 0, 3, 5, 8, 12, 16, 20, 25] as const;
// Whole-token price to buy a skin INSTANTLY (bypasses the level gate). 0 = free.
export const SKIN_TOKEN_PRICES = [0, 0, 0, 0, 5000, 10000, 20000, 35000, 50000, 80000, 150000] as const;

// --- Practice Sandbox (solo vs bots; pure training, no rewards/stats) -------
// Sandbox can crowd the arena with more bots than a real 4-player room.
export const PRACTICE_MAX_BOTS = 7;
// Speed is granted in discrete levels; this is how many (base -> MAX_SPEED).
export const MAX_SPEED_LEVELS = Math.round((MAX_SPEED - PLAYER_BASE_SPEED) / SPEED_UP_DELTA);
export const BOT_RESPAWN_MS = 2500; // a downed bot reappears after this (sandbox)
export const CRATE_RESPAWN_MS = 3500; // a fresh destructible crate drops this often (sandbox)
/** Tunable practice loadout. ONLY the Sandbox mode reads these; the Competitive
 *  Bots Match always uses fair defaults (identical to a real PvP match). */
export interface SandboxOpts {
  botRespawn: boolean; // downed bots come back so you always have targets
  crateRespawn: boolean; // destructible crates slowly repopulate
  godMode: boolean; // you can't be hurt (endless practice)
  startBombs: number; // starting bomb capacity (1..MAX_BOMBS)
  startPower: number; // starting fire range (1..MAX_POWER)
  startSpeed: number; // starting EXTRA speed levels (0..MAX_SPEED_LEVELS)
  startKick: boolean; // start with the kick ability
  startWallPass: boolean; // start able to walk through crates (whole session)
}
export const DEFAULT_SANDBOX: SandboxOpts = {
  botRespawn: true,
  crateRespawn: true,
  godMode: false,
  startBombs: START_BOMBS,
  startPower: START_POWER,
  startSpeed: 0,
  startKick: false,
  startWallPass: false,
};
/** Clamp an untrusted sandbox config from the client into safe bounds. */
export function clampSandbox(o: Partial<SandboxOpts> | null | undefined): SandboxOpts {
  const d = DEFAULT_SANDBOX;
  if (!o || typeof o !== "object") return { ...d };
  const num = (v: unknown, lo: number, hi: number, def: number): number =>
    Number.isFinite(v as number) ? Math.max(lo, Math.min(hi, Math.floor(v as number))) : def;
  const bool = (v: unknown, def: boolean): boolean => (typeof v === "boolean" ? v : def);
  return {
    botRespawn: bool(o.botRespawn, d.botRespawn),
    crateRespawn: bool(o.crateRespawn, d.crateRespawn),
    godMode: bool(o.godMode, d.godMode),
    startBombs: num(o.startBombs, 1, MAX_BOMBS, d.startBombs),
    startPower: num(o.startPower, 1, MAX_POWER, d.startPower),
    startSpeed: num(o.startSpeed, 0, MAX_SPEED_LEVELS, d.startSpeed),
    startKick: bool(o.startKick, d.startKick),
    startWallPass: bool(o.startWallPass, d.startWallPass),
  };
}

// --- Token (real pump.fun SPL token; read-only hold-to-play for now) --------
// Public mint address — safe to ship to the client (used for display + links).
export const TOKEN_MINT = "2Lbnrt7iRx2RHGBXXXc3z8Do3bp3oZ9FtkAohLvxpump";
export const TOKEN_TICKER = "BGDF";
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
