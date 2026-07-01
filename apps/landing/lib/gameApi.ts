// Real data from the game server. No mocks.
//
// The landing deploys on a different origin than the game, so we hit the game's
// public, CORS-enabled endpoints (Access-Control-Allow-Origin: * — see
// apps/server/src/index.ts). Override the base via NEXT_PUBLIC_GAME_API.
const BASE = (process.env.NEXT_PUBLIC_GAME_API ?? "https://bombermeme.fun").replace(/\/$/, "");

/** Game host (used for /play CTAs + API fetches). */
export const GAME_URL = BASE;

export interface GameStats {
  online?: number;
  matches?: number;
  tokensInPlay?: number;
  prizePaid?: number;
  topMmr?: number;
  priceUsd?: number;
  champions?: Array<{ name?: string; won?: number }>;
}

export interface LeaderRow {
  name?: string;
  rating?: number;
  wins?: number;
  matches?: number;
  tokens_won?: number; // base units (token decimals); divide by 1e6 for whole tokens
  chips_won?: number;
}

/** Mirrors the game server's public Tournament shape (apps/server/src/tournament.ts). */
export interface Tournament {
  id: string;
  name: string;
  format: "points" | "bracket";
  status: "reg_open" | "checkin" | "live" | "done"; // drafts/cancelled hidden by server
  description?: string;
  prizeUsd?: number;
  entryType?: "free" | "buyin";
  entryAmount?: number;
  currency?: number; // 0 = chips, 1 = token
  maxPlayers?: number;
  podSize?: number;
  registered?: number;
  startAt?: number; // unix ms (0 = TBD)
  startedAt?: number;
  endedAt?: number;
  winners?: string[];
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null; // offline / unreachable — callers render empty/placeholder, never fake
  }
}

export const fetchStats = () => getJson<GameStats>("/stats");
export const fetchOnline = () => getJson<{ online?: number }>("/online");

/** Real leaderboard rows from /leaderboard?board=… (server returns { rows }). */
export async function fetchLeaderboard(board: "rating" | "tokens" | "chips"): Promise<LeaderRow[]> {
  const d = await getJson<{ rows?: LeaderRow[] }>(`/leaderboard?board=${board}`);
  return d?.rows ?? [];
}

/** Real tournaments from /tournaments (shape tolerant: array or { tournaments }). */
export async function fetchTournaments(): Promise<Tournament[]> {
  const d = await getJson<{ tournaments?: Tournament[] } | Tournament[]>("/tournaments");
  if (Array.isArray(d)) return d;
  return d?.tournaments ?? [];
}

export interface ReferralStats {
  direct: number; // direct (tier-1) recruits
  earned: number; // total referral earnings, whole tokens
  levels: number[]; // payout % per tier, e.g. [10,5,3,2,1]
  network: number[]; // headcount per tier (length 5)
  rakePct: number; // house rake % (0 if not configured publicly)
}

/** Real referral stats for a wallet from /referral/stats?wallet=… (public). */
export async function fetchReferralStats(wallet: string): Promise<ReferralStats | null> {
  const w = wallet.trim();
  if (!w) return null;
  return getJson<ReferralStats>(`/referral/stats?wallet=${encodeURIComponent(w)}`);
}

/** Whole-token amount from base units (token uses 6 decimals). */
export const toTokens = (base: number | undefined): number => (base ?? 0) / 1_000_000;
