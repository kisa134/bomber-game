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

export interface Tournament {
  name?: string;
  status?: string;
  format?: string;
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

/** Whole-token amount from base units (token uses 6 decimals). */
export const toTokens = (base: number | undefined): number => (base ?? 0) / 1_000_000;
