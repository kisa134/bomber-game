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
  tokens_won?: number;
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
export const fetchLeaderboard = (board: "rating" | "tokens" | "chips") =>
  getJson<{ leaderboard?: LeaderRow[] } | LeaderRow[]>(`/leaderboard?board=${board}`);
export const fetchTournaments = () =>
  getJson<{ tournaments?: Tournament[] } | Tournament[]>("/tournaments");
