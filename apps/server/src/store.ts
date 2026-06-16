// Profile & progression persistence. Works in-memory out of the box; set
// DATABASE_URL (any Postgres) for durable storage — the schema is auto-created
// on boot. Stats are written ONLY here, server-side, on match end, so the
// client can never inflate them.

import pg from "pg";
import { STARTING_CHIPS, STARTING_RATING, eloDeltas } from "@bomberpump/shared";

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
  chips: number; // simulated currency balance
  rating: number; // chess-style Elo
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
  readonly kind: string;
  ping(): Promise<boolean>;
  recordMatch(results: MatchResult[]): Promise<void>;
  getProfile(wallet: string): Promise<Profile | null>;
  leaderboard(limit: number): Promise<Profile[]>;
  /** Ensure a profile exists (granting starting chips), return it. */
  ensureProfile(wallet: string, name: string, skin: number): Promise<Profile>;
  /** Atomically add `delta` chips. Returns the new balance, or null if a
   *  negative delta would overdraw (balance unchanged). */
  adjustChips(wallet: string, delta: number): Promise<number | null>;
}

function blankProfile(wallet: string, name: string, skin: number): Profile {
  return {
    wallet,
    name,
    skin,
    level: 1,
    xp: 0,
    matches: 0,
    wins: 0,
    frags: 0,
    deaths: 0,
    current_streak: 0,
    best_streak: 0,
    chips: STARTING_CHIPS,
    rating: STARTING_RATING,
  };
}

/** Map a finished match's results to a per-wallet Elo delta, keyed by wallet. */
function ratingDeltas(results: MatchResult[], ratingOf: (w: string) => number): Map<string, number> {
  const ratings = results.map((r) => ratingOf(r.wallet));
  const winnerIdx = results.findIndex((r) => r.won);
  const deltas = eloDeltas(ratings, winnerIdx);
  const map = new Map<string, number>();
  results.forEach((r, i) => map.set(r.wallet, deltas[i]));
  return map;
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
  readonly kind = "memory";
  private map = new Map<string, Profile>();

  async ping(): Promise<boolean> {
    return true;
  }

  async recordMatch(results: MatchResult[]): Promise<void> {
    const deltas = ratingDeltas(results, (w) => this.map.get(w)?.rating ?? STARTING_RATING);
    for (const r of results) {
      const p = this.map.get(r.wallet) ?? blankProfile(r.wallet, r.name, r.skin);
      applyResult(p, r);
      p.rating = Math.max(0, p.rating + (deltas.get(r.wallet) ?? 0));
      this.map.set(r.wallet, p);
    }
  }

  async getProfile(wallet: string): Promise<Profile | null> {
    return this.map.get(wallet) ?? null;
  }

  async leaderboard(limit: number): Promise<Profile[]> {
    return [...this.map.values()].sort((a, b) => b.rating - a.rating).slice(0, limit);
  }

  async ensureProfile(wallet: string, name: string, skin: number): Promise<Profile> {
    let p = this.map.get(wallet);
    if (!p) {
      p = blankProfile(wallet, name, skin);
      this.map.set(wallet, p);
    }
    return p;
  }

  async adjustChips(wallet: string, delta: number): Promise<number | null> {
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    if (delta < 0 && p.chips + delta < 0) return null;
    p.chips += delta;
    return p.chips;
  }
}

class SupabaseStore implements ProfileStore {
  readonly kind = "supabase-rest";
  constructor(
    private url: string,
    private key: string,
  ) {}

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/rest/v1/profiles?select=wallet&limit=1`, {
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

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
        `${this.url}/rest/v1/profiles?select=*&order=rating.desc&limit=${limit}`,
        { headers: this.headers() },
      );
      return (await res.json()) as Profile[];
    } catch (e) {
      console.error("[store] leaderboard failed", e);
      return [];
    }
  }

  async ensureProfile(wallet: string, name: string, skin: number): Promise<Profile> {
    const existing = await this.getProfile(wallet);
    if (existing) return existing;
    const p = blankProfile(wallet, name, skin);
    try {
      await fetch(`${this.url}/rest/v1/profiles`, {
        method: "POST",
        headers: { ...this.headers(), Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify(p),
      });
    } catch (e) {
      console.error("[store] ensureProfile failed", e);
    }
    return p;
  }

  async adjustChips(wallet: string, delta: number): Promise<number | null> {
    // Best-effort read-modify-write (the Postgres path is the atomic one).
    const p = await this.getProfile(wallet);
    if (!p) return null;
    const next = p.chips + delta;
    if (next < 0) return null;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ chips: next }),
      });
    } catch (e) {
      console.error("[store] adjustChips failed", e);
      return null;
    }
    return next;
  }
}

// Direct Postgres (any provider). Auto-creates the schema on boot, so the only
// setup is a DATABASE_URL env var — no manual SQL, no service keys.
class PostgresStore implements ProfileStore {
  readonly kind = "postgres";
  private pool: pg.Pool;
  private ready: Promise<void>;

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    this.ready = this.migrate();
  }

  async ping(): Promise<boolean> {
    try {
      await this.ready;
      await this.pool.query("select 1");
      return true;
    } catch {
      return false;
    }
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
    // Additive migrations for existing tables.
    await this.pool.query(
      `alter table profiles add column if not exists chips int not null default ${STARTING_CHIPS}`,
    );
    await this.pool.query(
      `alter table profiles add column if not exists rating int not null default ${STARTING_RATING}`,
    );
  }

  async recordMatch(results: MatchResult[]): Promise<void> {
    try {
      await this.ready;
      // Read current ratings so the Elo swing uses pre-match values for everyone.
      const wallets = results.map((r) => r.wallet);
      const cur = await this.pool.query(
        `select wallet, rating from profiles where wallet = any($1)`,
        [wallets],
      );
      const ratingMap = new Map<string, number>(cur.rows.map((row) => [row.wallet, row.rating]));
      const deltas = ratingDeltas(results, (w) => ratingMap.get(w) ?? STARTING_RATING);
      for (const r of results) {
        const xp = xpForMatch(r);
        const dRating = deltas.get(r.wallet) ?? 0;
        await this.pool.query(
          `insert into profiles (wallet,name,skin,xp,matches,wins,frags,deaths,current_streak,best_streak,level,rating,updated_at)
           values ($1,$2,$3,$4,1, case when $5 then 1 else 0 end, $6,$7, case when $5 then 1 else 0 end, case when $5 then 1 else 0 end, 1 + ($4/200), greatest(0, ${STARTING_RATING} + $8), now())
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
             rating=greatest(0, profiles.rating + $8),
             updated_at=now()`,
          [r.wallet, r.name, r.skin, xp, r.won, r.frags, r.deaths, dRating],
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
      const res = await this.pool.query("select * from profiles order by rating desc limit $1", [
        limit,
      ]);
      return res.rows as Profile[];
    } catch (e) {
      console.error("[store] pg leaderboard failed", e);
      return [];
    }
  }

  async ensureProfile(wallet: string, name: string, skin: number): Promise<Profile> {
    await this.ready;
    await this.pool.query(
      `insert into profiles (wallet,name,skin) values ($1,$2,$3) on conflict (wallet) do nothing`,
      [wallet, name, skin],
    );
    const res = await this.pool.query("select * from profiles where wallet=$1", [wallet]);
    return res.rows[0] as Profile;
  }

  async adjustChips(wallet: string, delta: number): Promise<number | null> {
    try {
      await this.ready;
      // Atomic + overdraw-safe: the row only updates if the result stays >= 0.
      const res = await this.pool.query(
        `update profiles set chips = chips + $2, updated_at=now()
         where wallet=$1 and chips + $2 >= 0 returning chips`,
        [wallet, delta],
      );
      return res.rows[0] ? (res.rows[0].chips as number) : null;
    } catch (e) {
      console.error("[store] pg adjustChips failed", e);
      return null;
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
