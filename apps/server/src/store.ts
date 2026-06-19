// Profile & progression persistence. Works in-memory out of the box; set
// DATABASE_URL (any Postgres) for durable storage — the schema is auto-created
// on boot. Stats are written ONLY here, server-side, on match end, so the
// client can never inflate them.

import pg from "pg";
import { STARTING_CHIPS, STARTING_RATING, DEFAULT_SKINS, eloDeltas } from "@bomberpump/shared";

export interface Profile {
  wallet: string;
  name: string;
  skin: number;
  skins: number; // bitmask of owned skins (skin i owned if bit i set)
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
  week_key: string; // ISO week this player's weekly score belongs to
  week_points: number; // resets each ISO week
  token_balance: number; // real token, in base units (custodial off-chain balance)
  referred_by: string; // wallet of the referrer who invited this player ("" if none)
  referral_earned: number; // lifetime referral rewards, in token base units
}

/** ISO-8601 week key like "2026-W25" (UTC). Weekly tops reset on the boundary. */
export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Weekly score for one match: a win is worth more, frags add a little. */
export function weekPointsFor(r: MatchResult): number {
  return (r.won ? 3 : 1) + r.frags;
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
  /** Top players, all-time (by rating) or this week (by weekly points). */
  leaderboard(limit: number, period?: "all" | "week"): Promise<Profile[]>;
  /** Ensure a profile exists (granting starting chips), return it. */
  ensureProfile(wallet: string, name: string, skin: number): Promise<Profile>;
  /** Atomically add `delta` chips. Returns the new balance, or null if a
   *  negative delta would overdraw (balance unchanged). */
  adjustChips(wallet: string, delta: number): Promise<number | null>;
  /** Atomically add `delta` token base units. Returns the new balance, or null
   *  if a negative delta would overdraw (balance unchanged). */
  adjustToken(wallet: string, delta: number): Promise<number | null>;
  /** Credit a deposit exactly once (deduped by tx signature). Returns true if
   *  this signature was newly applied, false if already processed. */
  creditDeposit(signature: string, wallet: string, amount: number): Promise<boolean>;
  /** Buy a skin: atomically deduct `price` chips and set its ownership bit.
   *  Returns the new {chips, skins} or null if already owned / can't afford. */
  buySkin(wallet: string, skin: number, price: number): Promise<{ chips: number; skins: number } | null>;
  /** Select an owned skin as the active one. Returns the new skin, or null if
   *  the wallet doesn't own it. */
  selectSkin(wallet: string, skin: number): Promise<number | null>;
  /** Bind a referrer to this wallet — only if it has none yet and isn't self.
   *  Returns true if newly set. (Both profiles are ensured to exist.) */
  setReferrer(wallet: string, referrer: string): Promise<boolean>;
  /** Admin override: force this wallet's referrer (overwrites any existing one).
   *  Returns true on success. */
  setReferrerAdmin(wallet: string, referrer: string): Promise<boolean>;
  /** Credit a referral reward: add `amount` token base units to both the live
   *  balance and the lifetime `referral_earned` counter. */
  creditReferral(wallet: string, amount: number): Promise<void>;
  /** Referral dashboard data for one wallet: direct referrals, lifetime earned,
   *  and how many sit at each of the 5 levels below this wallet. */
  referralStats(wallet: string): Promise<{ direct: number; earned: number; network: number[] }>;
  /** Admin overview of the whole referral pyramid: total attributed players,
   *  total rewards paid, top partners, and the level breakdown under `root`. */
  referralOverview(limit: number, root: string): Promise<{
    networkSize: number;
    totalEarned: number; // base units
    unattached: number; // wallets with no referrer (excluding the root)
    rootLevels: number[]; // count at depth 1..5 below the root wallet
    top: Array<{ wallet: string; name: string; direct: number; earned: number }>;
  }>;
}

function blankProfile(wallet: string, name: string, skin: number): Profile {
  return {
    wallet,
    name,
    skin,
    skins: DEFAULT_SKINS,
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
    week_key: "",
    week_points: 0,
    token_balance: 0,
    referred_by: "",
    referral_earned: 0,
  };
}

/** Apply this match's weekly points, resetting the tally on a new ISO week. */
function applyWeekly(p: Profile, r: MatchResult, week: string): void {
  if (p.week_key !== week) {
    p.week_key = week;
    p.week_points = 0;
  }
  p.week_points += weekPointsFor(r);
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
    const week = isoWeekKey();
    for (const r of results) {
      const p = this.map.get(r.wallet) ?? blankProfile(r.wallet, r.name, r.skin);
      applyResult(p, r);
      p.rating = Math.max(0, p.rating + (deltas.get(r.wallet) ?? 0));
      applyWeekly(p, r, week);
      this.map.set(r.wallet, p);
    }
  }

  async getProfile(wallet: string): Promise<Profile | null> {
    return this.map.get(wallet) ?? null;
  }

  async leaderboard(limit: number, period: "all" | "week" = "all"): Promise<Profile[]> {
    const all = [...this.map.values()];
    if (period === "week") {
      const week = isoWeekKey();
      return all
        .filter((p) => p.week_key === week && p.week_points > 0)
        .sort((a, b) => b.week_points - a.week_points)
        .slice(0, limit);
    }
    return all.sort((a, b) => b.rating - a.rating).slice(0, limit);
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

  async adjustToken(wallet: string, delta: number): Promise<number | null> {
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    if (delta < 0 && p.token_balance + delta < 0) return null;
    p.token_balance += delta;
    return p.token_balance;
  }

  async buySkin(
    wallet: string,
    skin: number,
    price: number,
  ): Promise<{ chips: number; skins: number } | null> {
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    const bit = 1 << skin;
    if (p.skins & bit) return null; // already owned
    if (p.chips < price) return null; // can't afford
    p.chips -= price;
    p.skins |= bit;
    return { chips: p.chips, skins: p.skins };
  }

  async selectSkin(wallet: string, skin: number): Promise<number | null> {
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    if (!(p.skins & (1 << skin))) return null; // not owned
    p.skin = skin;
    return p.skin;
  }

  private deposits = new Set<string>();
  async creditDeposit(signature: string, wallet: string, amount: number): Promise<boolean> {
    if (this.deposits.has(signature)) return false;
    this.deposits.add(signature);
    await this.adjustToken(wallet, amount);
    return true;
  }

  async setReferrer(wallet: string, referrer: string): Promise<boolean> {
    if (!wallet || !referrer || wallet === referrer) return false;
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    if (p.referred_by) return false; // already attributed
    p.referred_by = referrer;
    return true;
  }

  async setReferrerAdmin(wallet: string, referrer: string): Promise<boolean> {
    if (!wallet) return false;
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    p.referred_by = referrer; // force
    return true;
  }

  async creditReferral(wallet: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    p.token_balance += amount;
    p.referral_earned += amount;
  }

  async referralStats(wallet: string): Promise<{ direct: number; earned: number; network: number[] }> {
    const children = new Map<string, string[]>();
    for (const p of this.map.values()) {
      if (p.referred_by) (children.get(p.referred_by) ?? children.set(p.referred_by, []).get(p.referred_by)!).push(p.wallet);
    }
    const network = [0, 0, 0, 0, 0];
    let frontier = children.get(wallet) ?? [];
    for (let d = 0; d < 5 && frontier.length; d++) {
      network[d] = frontier.length;
      const next: string[] = [];
      for (const w of frontier) for (const c of children.get(w) ?? []) next.push(c);
      frontier = next;
    }
    return { direct: network[0], earned: this.map.get(wallet)?.referral_earned ?? 0, network };
  }

  async referralOverview(limit: number, root: string): Promise<{
    networkSize: number;
    totalEarned: number;
    unattached: number;
    rootLevels: number[];
    top: Array<{ wallet: string; name: string; direct: number; earned: number }>;
  }> {
    const children = new Map<string, string[]>();
    let networkSize = 0;
    let totalEarned = 0;
    let unattached = 0;
    for (const p of this.map.values()) {
      if (p.referred_by) {
        networkSize++;
        (children.get(p.referred_by) ?? children.set(p.referred_by, []).get(p.referred_by)!).push(p.wallet);
      } else if (p.wallet !== root) {
        unattached++;
      }
      totalEarned += p.referral_earned;
    }
    // BFS down the tree from root, counting how many sit at each of 5 levels.
    const rootLevels = [0, 0, 0, 0, 0];
    let frontier = root ? children.get(root) ?? [] : [];
    for (let d = 0; d < 5 && frontier.length; d++) {
      rootLevels[d] = frontier.length;
      const next: string[] = [];
      for (const w of frontier) for (const c of children.get(w) ?? []) next.push(c);
      frontier = next;
    }
    const top = [...this.map.values()]
      .map((p) => ({ wallet: p.wallet, name: p.name, direct: (children.get(p.wallet) ?? []).length, earned: p.referral_earned }))
      .filter((r) => r.earned > 0 || r.direct > 0)
      .sort((a, b) => b.earned - a.earned || b.direct - a.direct)
      .slice(0, limit);
    return { networkSize, totalEarned, unattached, rootLevels, top };
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

  async leaderboard(limit: number, period: "all" | "week" = "all"): Promise<Profile[]> {
    try {
      const query =
        period === "week"
          ? `week_key=eq.${isoWeekKey()}&order=week_points.desc`
          : `order=rating.desc`;
      const res = await fetch(`${this.url}/rest/v1/profiles?select=*&${query}&limit=${limit}`, {
        headers: this.headers(),
      });
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

  async adjustToken(wallet: string, delta: number): Promise<number | null> {
    const p = await this.getProfile(wallet);
    if (!p) return null;
    const next = (p.token_balance ?? 0) + delta;
    if (next < 0) return null;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ token_balance: next }),
      });
    } catch (e) {
      console.error("[store] adjustToken failed", e);
      return null;
    }
    return next;
  }

  async buySkin(
    wallet: string,
    skin: number,
    price: number,
  ): Promise<{ chips: number; skins: number } | null> {
    // Best-effort read-modify-write (the Postgres path is the atomic one).
    const p = await this.getProfile(wallet);
    if (!p) return null;
    const bit = 1 << skin;
    const owned = (p.skins ?? DEFAULT_SKINS) & bit;
    if (owned || (p.chips ?? 0) < price) return null;
    const chips = p.chips - price;
    const skins = (p.skins ?? DEFAULT_SKINS) | bit;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ chips, skins }),
      });
    } catch (e) {
      console.error("[store] buySkin failed", e);
      return null;
    }
    return { chips, skins };
  }

  async selectSkin(wallet: string, skin: number): Promise<number | null> {
    const p = await this.getProfile(wallet);
    if (!p) return null;
    if (!((p.skins ?? DEFAULT_SKINS) & (1 << skin))) return null;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ skin }),
      });
    } catch (e) {
      console.error("[store] selectSkin failed", e);
      return null;
    }
    return skin;
  }

  async creditDeposit(signature: string, wallet: string, amount: number): Promise<boolean> {
    // Best-effort dedupe via a processed_deposits table (Postgres path is atomic).
    try {
      const ins = await fetch(`${this.url}/rest/v1/processed_deposits`, {
        method: "POST",
        headers: { ...this.headers(), Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ signature, wallet, amount }),
      });
      const rows = (await ins.json()) as unknown[];
      if (!Array.isArray(rows) || rows.length === 0) return false; // already processed
      await this.adjustToken(wallet, amount);
      return true;
    } catch (e) {
      console.error("[store] creditDeposit failed", e);
      return false;
    }
  }

  async setReferrer(wallet: string, referrer: string): Promise<boolean> {
    if (!wallet || !referrer || wallet === referrer) return false;
    const p = await this.getProfile(wallet);
    if (p?.referred_by) return false;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ referred_by: referrer }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async setReferrerAdmin(wallet: string, referrer: string): Promise<boolean> {
    if (!wallet) return false;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ referred_by: referrer }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async creditReferral(wallet: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    await this.adjustToken(wallet, amount);
    const p = await this.getProfile(wallet);
    const earned = (p?.referral_earned ?? 0) + amount;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ referral_earned: earned }),
      });
    } catch {
      /* best-effort */
    }
  }

  async referralStats(wallet: string): Promise<{ direct: number; earned: number; network: number[] }> {
    const network = [0, 0, 0, 0, 0];
    let earned = 0;
    try {
      const r = await fetch(
        `${this.url}/rest/v1/profiles?select=wallet,referred_by,referral_earned`,
        { headers: this.headers() },
      );
      const rows = (await r.json()) as Array<{ wallet: string; referred_by: string; referral_earned: number }>;
      if (Array.isArray(rows)) {
        const children = new Map<string, string[]>();
        for (const p of rows) {
          if (p.referred_by) (children.get(p.referred_by) ?? children.set(p.referred_by, []).get(p.referred_by)!).push(p.wallet);
          if (p.wallet === wallet) earned = Number(p.referral_earned ?? 0);
        }
        let frontier = children.get(wallet) ?? [];
        for (let d = 0; d < 5 && frontier.length; d++) {
          network[d] = frontier.length;
          const next: string[] = [];
          for (const w of frontier) for (const c of children.get(w) ?? []) next.push(c);
          frontier = next;
        }
      }
    } catch {
      /* ignore */
    }
    return { direct: network[0], earned, network };
  }

  async referralOverview(limit: number, root: string): Promise<{
    networkSize: number;
    totalEarned: number;
    unattached: number;
    rootLevels: number[];
    top: Array<{ wallet: string; name: string; direct: number; earned: number }>;
  }> {
    const empty = { networkSize: 0, totalEarned: 0, unattached: 0, rootLevels: [0, 0, 0, 0, 0], top: [] };
    try {
      const r = await fetch(
        `${this.url}/rest/v1/profiles?select=wallet,name,referred_by,referral_earned`,
        { headers: this.headers() },
      );
      const rows = (await r.json()) as Array<{ wallet: string; name: string; referred_by: string; referral_earned: number }>;
      if (!Array.isArray(rows)) return empty;
      const children = new Map<string, string[]>();
      let networkSize = 0;
      let totalEarned = 0;
      let unattached = 0;
      for (const p of rows) {
        if (p.referred_by) {
          networkSize++;
          (children.get(p.referred_by) ?? children.set(p.referred_by, []).get(p.referred_by)!).push(p.wallet);
        } else if (p.wallet !== root) {
          unattached++;
        }
        totalEarned += Number(p.referral_earned ?? 0);
      }
      const rootLevels = [0, 0, 0, 0, 0];
      let frontier = root ? children.get(root) ?? [] : [];
      for (let d = 0; d < 5 && frontier.length; d++) {
        rootLevels[d] = frontier.length;
        const next: string[] = [];
        for (const w of frontier) for (const c of children.get(w) ?? []) next.push(c);
        frontier = next;
      }
      const top = rows
        .map((p) => ({ wallet: p.wallet, name: p.name, direct: (children.get(p.wallet) ?? []).length, earned: Number(p.referral_earned ?? 0) }))
        .filter((x) => x.earned > 0 || x.direct > 0)
        .sort((a, b) => b.earned - a.earned || b.direct - a.direct)
        .slice(0, limit);
      return { networkSize, totalEarned, unattached, rootLevels, top };
    } catch {
      return empty;
    }
  }
}

// Direct Postgres (any provider). Auto-creates the schema on boot, so the only
// setup is a DATABASE_URL env var — no manual SQL, no service keys.
class PostgresStore implements ProfileStore {
  readonly kind = "postgres";
  private pool: pg.Pool;
  private ready: Promise<void>;

  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // A pool error (dropped backend conn) must not crash the process.
    this.pool.on("error", (e) => console.error("[store] pg pool error", e));
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
    await this.pool.query(`alter table profiles add column if not exists week_key text not null default ''`);
    await this.pool.query(`alter table profiles add column if not exists week_points int not null default 0`);
    // Custodial real-token balance (base units) + deposit dedupe ledger.
    await this.pool.query(`alter table profiles add column if not exists token_balance bigint not null default 0`);
    // Owned-skins bitmask (skin 0 free by default).
    await this.pool.query(
      `alter table profiles add column if not exists skins int not null default ${DEFAULT_SKINS}`,
    );
    // Referral system: who invited this wallet, and lifetime referral earnings.
    await this.pool.query(`alter table profiles add column if not exists referred_by text not null default ''`);
    await this.pool.query(`alter table profiles add column if not exists referral_earned bigint not null default 0`);
    await this.pool.query(`create index if not exists profiles_referred_by on profiles (referred_by)`);
    await this.pool.query(`
      create table if not exists processed_deposits (
        signature text primary key,
        wallet text not null,
        amount bigint not null,
        at timestamptz not null default now()
      )`);
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
      const week = isoWeekKey();
      for (const r of results) {
        const xp = xpForMatch(r);
        const dRating = deltas.get(r.wallet) ?? 0;
        const wkPts = weekPointsFor(r);
        await this.pool.query(
          `insert into profiles (wallet,name,skin,xp,matches,wins,frags,deaths,current_streak,best_streak,level,rating,week_key,week_points,updated_at)
           values ($1,$2,$3,$4,1, case when $5 then 1 else 0 end, $6,$7, case when $5 then 1 else 0 end, case when $5 then 1 else 0 end, 1 + ($4/200), greatest(0, ${STARTING_RATING} + $8), $9, $10, now())
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
             week_points=case when profiles.week_key = $9 then profiles.week_points + $10 else $10 end,
             week_key=$9,
             updated_at=now()`,
          [r.wallet, r.name, r.skin, xp, r.won, r.frags, r.deaths, dRating, week, wkPts],
        );
      }
    } catch (e) {
      console.error("[store] pg recordMatch failed", e);
    }
  }

  // pg returns bigint columns as strings — coerce them back to numbers.
  private norm(row: Record<string, unknown> | undefined): Profile | null {
    if (!row) return null;
    return {
      ...(row as unknown as Profile),
      token_balance: Number(row.token_balance ?? 0),
      referral_earned: Number(row.referral_earned ?? 0),
    };
  }

  async getProfile(wallet: string): Promise<Profile | null> {
    try {
      await this.ready;
      const res = await this.pool.query("select * from profiles where wallet=$1", [wallet]);
      return this.norm(res.rows[0]);
    } catch (e) {
      console.error("[store] pg getProfile failed", e);
      return null;
    }
  }

  async leaderboard(limit: number, period: "all" | "week" = "all"): Promise<Profile[]> {
    try {
      await this.ready;
      const res =
        period === "week"
          ? await this.pool.query(
              "select * from profiles where week_key=$2 and week_points>0 order by week_points desc limit $1",
              [limit, isoWeekKey()],
            )
          : await this.pool.query("select * from profiles order by rating desc limit $1", [limit]);
      return res.rows.map((r) => this.norm(r)!) as Profile[];
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
    return this.norm(res.rows[0])!;
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

  async adjustToken(wallet: string, delta: number): Promise<number | null> {
    try {
      await this.ready;
      // Ensure the row exists, then atomically move the balance (overdraw-safe).
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      const res = await this.pool.query(
        `update profiles set token_balance = token_balance + $2, updated_at=now()
         where wallet=$1 and token_balance + $2 >= 0 returning token_balance`,
        [wallet, delta],
      );
      return res.rows[0] ? Number(res.rows[0].token_balance) : null;
    } catch (e) {
      console.error("[store] pg adjustToken failed", e);
      return null;
    }
  }

  async buySkin(
    wallet: string,
    skin: number,
    price: number,
  ): Promise<{ chips: number; skins: number } | null> {
    try {
      await this.ready;
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      // Atomic: only buy if affordable and not already owned.
      const res = await this.pool.query(
        `update profiles set chips = chips - $3, skins = skins | (1 << $2), updated_at=now()
         where wallet=$1 and chips >= $3 and (skins & (1 << $2)) = 0
         returning chips, skins`,
        [wallet, skin, price],
      );
      return res.rows[0]
        ? { chips: res.rows[0].chips as number, skins: res.rows[0].skins as number }
        : null;
    } catch (e) {
      console.error("[store] pg buySkin failed", e);
      return null;
    }
  }

  async selectSkin(wallet: string, skin: number): Promise<number | null> {
    try {
      await this.ready;
      const res = await this.pool.query(
        `update profiles set skin = $2, updated_at=now()
         where wallet=$1 and (skins & (1 << $2)) <> 0 returning skin`,
        [wallet, skin],
      );
      return res.rows[0] ? (res.rows[0].skin as number) : null;
    } catch (e) {
      console.error("[store] pg selectSkin failed", e);
      return null;
    }
  }

  async creditDeposit(signature: string, wallet: string, amount: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await this.ready;
      await client.query("begin");
      const ins = await client.query(
        `insert into processed_deposits (signature, wallet, amount) values ($1,$2,$3)
         on conflict (signature) do nothing`,
        [signature, wallet, amount],
      );
      if (ins.rowCount === 0) {
        await client.query("rollback");
        return false; // already processed
      }
      await client.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      await client.query(
        `update profiles set token_balance = token_balance + $2, updated_at=now() where wallet=$1`,
        [wallet, amount],
      );
      await client.query("commit");
      return true;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error("[store] pg creditDeposit failed", e);
      return false;
    } finally {
      client.release();
    }
  }

  async setReferrer(wallet: string, referrer: string): Promise<boolean> {
    if (!wallet || !referrer || wallet === referrer) return false;
    try {
      await this.ready;
      // Make sure both rows exist, then bind only if not already attributed.
      await this.pool.query(
        `insert into profiles (wallet) values ($1), ($2) on conflict (wallet) do nothing`,
        [wallet, referrer],
      );
      const res = await this.pool.query(
        `update profiles set referred_by=$2, updated_at=now()
         where wallet=$1 and (referred_by is null or referred_by='') returning wallet`,
        [wallet, referrer],
      );
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      console.error("[store] pg setReferrer failed", e);
      return false;
    }
  }

  async setReferrerAdmin(wallet: string, referrer: string): Promise<boolean> {
    if (!wallet) return false;
    try {
      await this.ready;
      await this.pool.query(
        `insert into profiles (wallet) values ($1), ($2) on conflict (wallet) do nothing`,
        [wallet, referrer],
      );
      await this.pool.query(`update profiles set referred_by=$2, updated_at=now() where wallet=$1`, [
        wallet,
        referrer,
      ]);
      return true;
    } catch (e) {
      console.error("[store] pg setReferrerAdmin failed", e);
      return false;
    }
  }

  async creditReferral(wallet: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    try {
      await this.ready;
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      await this.pool.query(
        `update profiles set token_balance = token_balance + $2,
           referral_earned = referral_earned + $2, updated_at=now() where wallet=$1`,
        [wallet, amount],
      );
    } catch (e) {
      console.error("[store] pg creditReferral failed", e);
    }
  }

  async referralStats(wallet: string): Promise<{ direct: number; earned: number; network: number[] }> {
    try {
      await this.ready;
      const [levels, p] = await Promise.all([
        this.pool.query(
          `with recursive tree as (
             select wallet, 0 as depth from profiles where wallet = $1
             union all
             select c.wallet, t.depth + 1 from profiles c
               join tree t on c.referred_by = t.wallet where t.depth < 5
           )
           select depth, count(*)::int as n from tree where depth between 1 and 5 group by depth`,
          [wallet],
        ),
        this.pool.query(`select referral_earned from profiles where wallet=$1`, [wallet]),
      ]);
      const network = [0, 0, 0, 0, 0];
      for (const r of levels.rows) {
        const d = Number(r.depth);
        if (d >= 1 && d <= 5) network[d - 1] = Number(r.n);
      }
      return { direct: network[0], earned: Number(p.rows[0]?.referral_earned ?? 0), network };
    } catch (e) {
      console.error("[store] pg referralStats failed", e);
      return { direct: 0, earned: 0, network: [0, 0, 0, 0, 0] };
    }
  }

  async referralOverview(limit: number, root: string): Promise<{
    networkSize: number;
    totalEarned: number;
    unattached: number;
    rootLevels: number[];
    top: Array<{ wallet: string; name: string; direct: number; earned: number }>;
  }> {
    const empty = { networkSize: 0, totalEarned: 0, unattached: 0, rootLevels: [0, 0, 0, 0, 0], top: [] };
    try {
      await this.ready;
      const [agg, top, levels] = await Promise.all([
        this.pool.query(
          `select count(*) filter (where referred_by <> '')::int as net,
                  coalesce(sum(referral_earned),0) as paid,
                  count(*) filter (where coalesce(referred_by,'')='' and wallet <> $1)::int as unattached
           from profiles`,
          [root],
        ),
        this.pool.query(
          `select p.wallet, p.name, p.referral_earned as earned,
                  (select count(*) from profiles c where c.referred_by = p.wallet)::int as direct
           from profiles p
           where p.referral_earned > 0
              or exists (select 1 from profiles c where c.referred_by = p.wallet)
           order by p.referral_earned desc, direct desc
           limit $1`,
          [limit],
        ),
        this.pool.query(
          `with recursive tree as (
             select wallet, 0 as depth from profiles where wallet = $1
             union all
             select c.wallet, t.depth + 1 from profiles c
               join tree t on c.referred_by = t.wallet where t.depth < 5
           )
           select depth, count(*)::int as n from tree where depth between 1 and 5 group by depth`,
          [root],
        ),
      ]);
      const rootLevels = [0, 0, 0, 0, 0];
      for (const r of levels.rows) {
        const d = Number(r.depth);
        if (d >= 1 && d <= 5) rootLevels[d - 1] = Number(r.n);
      }
      return {
        networkSize: (agg.rows[0]?.net as number) ?? 0,
        totalEarned: Number(agg.rows[0]?.paid ?? 0),
        unattached: (agg.rows[0]?.unattached as number) ?? 0,
        rootLevels,
        top: top.rows.map((r) => ({
          wallet: r.wallet as string,
          name: (r.name as string) ?? "",
          direct: (r.direct as number) ?? 0,
          earned: Number(r.earned ?? 0),
        })),
      };
    } catch (e) {
      console.error("[store] pg referralOverview failed", e);
      return empty;
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
