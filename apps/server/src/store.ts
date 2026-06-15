// Profile & progression persistence. Works in-memory out of the box; if the
// Supabase env vars are present it persists to Postgres via the REST/RPC API
// (no extra driver). Stats are written ONLY here, server-side, on match end —
// the client can never inflate them.

export interface Profile {
  wallet: string;
  name: string;
  skin: number;
  level: number;
  xp: number;
  matches: number;
  wins: number;
  frags: number;
  deaths: number;
  current_streak: number;
  best_streak: number;
}

export interface MatchResult {
  wallet: string;
  name: string;
  skin: number;
  won: boolean;
  frags: number;
  deaths: number;
}

export function xpForMatch(r: MatchResult): number {
  return 10 + r.frags * 5 + (r.won ? 30 : 0);
}

export function levelForXp(xp: number): number {
  return 1 + Math.floor(xp / 200);
}

export interface ProfileStore {
  recordMatch(results: MatchResult[]): Promise<void>;
  getProfile(wallet: string): Promise<Profile | null>;
  leaderboard(limit: number): Promise<Profile[]>;
}

function blankProfile(r: MatchResult): Profile {
  return {
    wallet: r.wallet,
    name: r.name,
    skin: r.skin,
    level: 1,
    xp: 0,
    matches: 0,
    wins: 0,
    frags: 0,
    deaths: 0,
    current_streak: 0,
    best_streak: 0,
  };
}

function applyResult(p: Profile, r: MatchResult): void {
  p.name = r.name;
  p.skin = r.skin;
  p.xp += xpForMatch(r);
  p.matches += 1;
  p.wins += r.won ? 1 : 0;
  p.frags += r.frags;
  p.deaths += r.deaths;
  p.current_streak = r.won ? p.current_streak + 1 : 0;
  p.best_streak = Math.max(p.best_streak, p.current_streak);
  p.level = levelForXp(p.xp);
}

class InMemoryStore implements ProfileStore {
  private map = new Map<string, Profile>();

  async recordMatch(results: MatchResult[]): Promise<void> {
    for (const r of results) {
      const p = this.map.get(r.wallet) ?? blankProfile(r);
      applyResult(p, r);
      this.map.set(r.wallet, p);
    }
  }

  async getProfile(wallet: string): Promise<Profile | null> {
    return this.map.get(wallet) ?? null;
  }

  async leaderboard(limit: number): Promise<Profile[]> {
    return [...this.map.values()].sort((a, b) => b.xp - a.xp).slice(0, limit);
  }
}

class SupabaseStore implements ProfileStore {
  constructor(
    private url: string,
    private key: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
    };
  }

  async recordMatch(results: MatchResult[]): Promise<void> {
    await Promise.all(
      results.map((r) =>
        fetch(`${this.url}/rest/v1/rpc/record_match`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({
            p_wallet: r.wallet,
            p_name: r.name,
            p_skin: r.skin,
            p_won: r.won,
            p_frags: r.frags,
            p_deaths: r.deaths,
            p_xp: xpForMatch(r),
          }),
        }).catch((e) => console.error("[store] recordMatch failed", e)),
      ),
    );
  }

  async getProfile(wallet: string): Promise<Profile | null> {
    try {
      const res = await fetch(
        `${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}&select=*`,
        { headers: this.headers() },
      );
      const rows = (await res.json()) as Profile[];
      return rows[0] ?? null;
    } catch (e) {
      console.error("[store] getProfile failed", e);
      return null;
    }
  }

  async leaderboard(limit: number): Promise<Profile[]> {
    try {
      const res = await fetch(
        `${this.url}/rest/v1/profiles?select=*&order=xp.desc&limit=${limit}`,
        { headers: this.headers() },
      );
      return (await res.json()) as Profile[];
    } catch (e) {
      console.error("[store] leaderboard failed", e);
      return [];
    }
  }
}

export function createStore(): ProfileStore {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    console.log("[store] using Supabase persistence");
    return new SupabaseStore(url, key);
  }
  console.log("[store] using in-memory persistence (set SUPABASE_URL + SUPABASE_SERVICE_KEY to persist)");
  return new InMemoryStore();
}

export const store: ProfileStore = createStore();
