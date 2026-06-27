// All gameplay-balancing numbers live here. No magic numbers in logic.

// Bump whenever the binary frame layout changes; client + server must match.
export const PROTOCOL_VERSION = 20;

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
// Distinct in-match player colours (assigned in the lobby, independent of skin).
// Must cover the largest possible arena (1 human + 7 bots in practice = 8).
export const PLAYER_COLOR_COUNT = 8;
export const SPECTATOR_ID = 255; // welcome id sent to a spectator (not a real seat)

export const MATCH_LENGTH_MS = 180_000; // 3 minutes (default; host can change in-lobby)
export const SUDDEN_DEATH_AT_MS = 120_000; // last minute (after 2:00): walls close in
/** Match-length options (minutes) a host can pick in the waiting room. */
export const DURATION_OPTIONS_MIN = [2, 3, 5] as const;
export const DEFAULT_DURATION_MIN = 3;
/** How long before the match end the walls start closing in (the "last minute"). */
export const SUDDEN_DEATH_LEAD_MS = MATCH_LENGTH_MS - SUDDEN_DEATH_AT_MS; // 60s
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
export const STARTING_CHIPS = 2500; // granted to a new wallet (small welcome bundle)
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

// --- Daily login reward (chips + XP; scales with streak & level) -------------
export const DAILY_BASE_CHIPS = 50; // day-1 reward; grows with the login streak
export const DAILY_STREAK_CAP = 7; // reward stops scaling past a 7-day streak
export const DAILY_LEVEL_BONUS_CHIPS = 10; // extra chips per player level
export const DAILY_WEEK_BONUS_CHIPS = 500; // milestone bonus on every 7th day
export const DAILY_XP_PER_DAY = 15; // XP per streak day (capped like chips)

// --- Skins (cosmetic; unlock by leveling up + chips, OR buy with token) -----
// Index: 0 Shiba, 1 Pepe, 2 Trump, 3 Musk, 4 Doge, 5 Pump, 6 Durov, 7 Vitalik,
//        8 Troll, 9 Bogdanoff, 10 Gigachad. The cooler/rarer it is, the dearer.
export const SKIN_COUNT = 43;
// The first 4 are free & owned from the start, plus a free starter rare (Doge, #4).
export const DEFAULT_SKINS = 0b0001_1111;
// Chip price to UNLOCK a skin (also requires reaching SKIN_UNLOCK_LEVEL). 0 = free.
// Tuned so the full set is grindable in ~a week of casual play (#4 free starter).
// 11-18: expanded meme roster (nyan, grumpy, harambe, shrek, fine-dog, wojak, npc, chad).
export const SKIN_PRICES = [0, 0, 0, 0, 0, 2500, 4000, 6000, 8000, 11000, 16000, 18000, 20000, 22000, 24000, 27000, 30000, 34000, 38000, 40000, 42000, 45000, 48000, 51000, 54000, 58000, 62000, 65000, 68000, 72000, 76000, 80000, 85000, 90000, 96000, 100000, 105000, 110000, 115000, 120000, 126000, 132000, 140000] as const;
// Player level required before a skin can be bought with chips. 0 = no gate.
export const SKIN_UNLOCK_LEVEL = [0, 0, 0, 0, 0, 4, 7, 10, 14, 18, 22, 24, 26, 28, 30, 33, 36, 39, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90] as const;
// Whole-token price to buy a skin INSTANTLY (bypasses the level gate). 0 = free.
export const SKIN_TOKEN_PRICES = [0, 0, 0, 0, 0, 10000, 20000, 35000, 50000, 80000, 150000, 170000, 185000, 200000, 220000, 245000, 270000, 300000, 330000, 350000, 370000, 390000, 410000, 440000, 470000, 500000, 540000, 580000, 620000, 660000, 700000, 750000, 800000, 860000, 920000, 980000, 1040000, 1100000, 1160000, 1220000, 1290000, 1360000, 1440000] as const;

// --- Lucky Spin (free chips wheel; "always something", pure fun) ------------
export const SPIN_COST_CHIPS = 200; // cost per spin
export const SKIN_FALLBACK_CHIPS = 3000; // if you already own every skin, the skin prize pays this instead
export interface WheelPrize {
  id: number;
  label: string;
  kind: "chips" | "skin";
  amount: number; // chips amount (0 for skin)
  weight: number; // relative odds
  color: string; // segment colour (rarity)
}
/** Every spin wins something. Expected chip value is below the spin cost, so it
 *  is a gentle chips sink, with a rare big win and a 1.5% rare-skin drop.
 *  Shared so the client renders the reel and the server rolls from the SAME odds. */
export const WHEEL_PRIZES: WheelPrize[] = [
  { id: 0, label: "50 🪙", kind: "chips", amount: 50, weight: 42, color: "#9aa3b2" },
  { id: 1, label: "100 🪙", kind: "chips", amount: 100, weight: 30, color: "#9aa3b2" },
  { id: 2, label: "150 🪙", kind: "chips", amount: 150, weight: 14, color: "#4aa3ff" },
  { id: 3, label: "300 🪙", kind: "chips", amount: 300, weight: 8, color: "#4aa3ff" },
  { id: 4, label: "800 🪙", kind: "chips", amount: 800, weight: 3.5, color: "#c879ff" },
  { id: 5, label: "3000 🪙", kind: "chips", amount: 3000, weight: 1, color: "#ffcc33" },
  { id: 6, label: "Rare skin", kind: "skin", amount: 0, weight: 1.5, color: "#ff5a5a" },
];
/** Pick a prize index by weight using a [0,1) roll (server passes Math.random()). */
export function rollWheel(r: number): number {
  const total = WHEEL_PRIZES.reduce((a, p) => a + p.weight, 0);
  let x = r * total;
  for (let i = 0; i < WHEEL_PRIZES.length; i++) {
    x -= WHEEL_PRIZES[i].weight;
    if (x < 0) return i;
  }
  return WHEEL_PRIZES.length - 1;
}

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
  freezeBots: boolean; // bots stand still — static targets for aim/combo practice
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
  freezeBots: false,
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
    freezeBots: bool(o.freezeBots, d.freezeBots),
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
/** Last-resort price (USD / SOL per whole token) used ONLY when there's no live
 *  DEX price AND no TOKEN_PRICE_* env override — so the in-game value conversion
 *  never blanks (a pre-graduation pump.fun token isn't always on DexScreener).
 *  A real DEX price (or the env override) always takes precedence. Tune freely. */
export const TOKEN_PRICE_USD_FALLBACK = 0.00000403; // ≈ last seen DEX rate (~248k/$)
export const TOKEN_PRICE_SOL_FALLBACK = 0.000000027;

// --- Tokenomics (single source of truth; mirrors the public tokenomics page) -
// $BMB · Solana · 1,000,000,000 cap. Keep these in lockstep with the website.
export const TOTAL_SUPPLY = 1_000_000_000;
// We seed the in-game economy with a buyback of ~120M (not the whole supply).
export const GAME_BUYBACK_TOKENS = 120_000_000;
// Initial supply allocation (% of cap). Sum = 100.
export const INITIAL_ALLOCATION_PCT = {
  freeMarket: 88, // Fair-launch liquidity
  gameTreasury: 5, // Ecosystem rewards (Arena pools, leaderboards, tournaments)
  marketingCex: 4, // Global expansion / CEX
  devTeam: 3, // Long-term commitment (locked, 3-month vesting)
} as const;
// Default house rake = 5% (overridable via HOUSE_RAKE_BP env).
export const HOUSE_RAKE_BP_DEFAULT = 500;
// How each house rake splits, in basis points of the rake (sum = 10000).
// MODEL B (launch): Burn 25 · 5-Tier Referral 21 · Dev Treasury 54.
// Real Yield + DAO are deferred to Phase 2 (not in code — marketing roadmap only).
// NOTE: `referral` MUST equal the sum of REFERRAL_LEVEL_BPS (10/5/3/2/1 = 21%).
export const RAKE_SPLIT_BPS = {
  burn: 2500,
  referral: 2100,
  devTreasury: 5400,
} as const;
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
