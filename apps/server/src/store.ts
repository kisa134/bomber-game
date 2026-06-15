// Profile & progression persistence. Works in-memory out of the box; set
// DATABASE_URL (any Postgres) for durable storage — the schema is auto-created
// on boot. Stats are written ONLY here, server-side, on match end, so the
// client can never inflate them.

import pg from "pg";

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

// Direct Postgres (any provider). Auto-creates the schema on boot, so the only
// setup is a DATABASE_URL env var — no manual SQL, no service keys.
class PostgresStore implements ProfileStore {
  private pool: pg.Pool;
  private ready: Promise<void>;

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    this.ready = this.migrate();
  }

  private async migrate(): Promise<void> {
    await this.pool.query(`
      create table if not exists profiles (
        wallet text primary key,
        name text not null default '',
        skin int not null default 0,
        level int not null default 1,
        xp int not null default 0,
        matches int not null default 0,
        wins int not null default 0,
        frags int not null default 0,
        deaths int not null default 0,
        current_streak int not null default 0,
        best_streak int not null default 0,
        updated_at timestamptz not null default now()
      )`);
  }

  async recordMatch(results: MatchResult[]): Promise<void> {
    try {
      await this.ready;
      for (const r of results) {
        const xp = xpForMatch(r);
        await this.pool.query(
          `insert into profiles (wallet,name,skin,xp,matches,wins,frags,deaths,current_streak,best_streak,level,updated_at)
           values ($1,$2,$3,$4,1, case when $5 then 1 else 0 end, $6,$7, case when $5 then 1 else 0 end, case when $5 then 1 else 0 end, 1 + ($4/200), now())
           on conflict (wallet) do update set
             name=excluded.name, skin=excluded.skin,
             xp=profiles.xp+$4,
             matches=profiles.matches+1,
             wins=profiles.wins+case when $5 then 1 else 0 end,
             frags=profiles.frags+$6,
             deaths=profiles.deaths+$7,
             current_streak=case when $5 then profiles.current_streak+1 else 0 end,
             best_streak=greatest(profiles.best_streak, case when $5 then profiles.current_streak+1 else 0 end),
             level=1 + ((profiles.xp+$4)/200),
             updated_at=now()`,
          [r.wallet, r.name, r.skin, xp, r.won, r.frags, r.deaths],
        );
      }
    } catch (e) {
      console.error("[store] pg recordMatch failed", e);
    }
  }

  async getProfile(wallet: string): Promise<Profile | null> {
    try {
      await this.ready;
      const res = await this.pool.query("select * from profiles where wallet=$1", [wallet]);
      return (res.rows[0] as Profile) ?? null;
    } catch (e) {
      console.error("[store] pg getProfile failed", e);
      return null;
    }
  }

  async leaderboard(limit: number): Promise<Profile[]> {
    try {
      await this.ready;
      const res = await this.pool.query("select * from profiles order by xp desc limit $1", [limit]);
      return res.rows as Profile[];
    } catch (e) {
      console.error("[store] pg leaderboard failed", e);
      return [];
    }
  }
}

export function createStore(): ProfileStore {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    console.log("[store] using Postgres persistence (auto-migrating)");
    return new PostgresStore(dbUrl);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    console.log("[store] using Supabase REST persistence");
    return new SupabaseStore(url, key);
  }
  console.log("[store] in-memory persistence (set DATABASE_URL to persist across deploys)");
  return new InMemoryStore();
}

export const store: ProfileStore = createStore();
