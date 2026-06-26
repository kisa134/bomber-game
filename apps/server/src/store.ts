// Profile & progression persistence. Works in-memory out of the box; set
// DATABASE_URL (any Postgres) for durable storage — the schema is auto-created
// on boot. Stats are written ONLY here, server-side, on match end, so the
// client can never inflate them.

import pg from "pg";
import {
  STARTING_CHIPS,
  STARTING_RATING,
  DEFAULT_SKINS,
  eloDeltas,
  DAILY_BASE_CHIPS,
  DAILY_STREAK_CAP,
  DAILY_LEVEL_BONUS_CHIPS,
  DAILY_WEEK_BONUS_CHIPS,
  DAILY_XP_PER_DAY,
} from "@bomberpump/shared";
import { alert } from "./alert.js";

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
  tokens_won: number; // lifetime real-token winnings (base units) — paid leaderboard
  chips_won: number; // lifetime chips winnings — free leaderboard
  referred_by: string; // wallet of the referrer who invited this player ("" if none)
  referral_earned: number; // lifetime referral rewards, in token base units
  playtime_sec: number; // lifetime time spent in real matches, seconds
  daily_day: number; // UTC day-index of the last claimed daily reward (0 = never)
  daily_streak: number; // consecutive-day login streak
}

/** UTC day index (days since epoch) — the unit a daily reward is keyed on. */
export function utcDayIndex(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

/** Result of claiming the daily login reward. */
export interface DailyClaim {
  already: boolean; // already claimed today (nothing granted)
  streak: number; // login streak after this claim
  chips: number; // chips granted
  xp: number; // xp granted
  bonus: boolean; // hit a 7-day milestone (extra chips included)
}

/** Daily reward for a given streak + level: scales with the (capped) streak and
 *  a small per-level bonus, with a chunky milestone every 7th day. */
export function dailyReward(streak: number, level: number): { chips: number; xp: number; bonus: boolean } {
  const capped = Math.min(Math.max(1, streak), DAILY_STREAK_CAP);
  const bonus = streak > 0 && streak % 7 === 0;
  const chips =
    DAILY_BASE_CHIPS * capped + DAILY_LEVEL_BONUS_CHIPS * Math.max(0, level - 1) + (bonus ? DAILY_WEEK_BONUS_CHIPS : 0);
  const xp = DAILY_XP_PER_DAY * capped;
  return { chips, xp, bonus };
}

/** Advance a streak given the last-claimed day and today: +1 if yesterday,
 *  reset to 1 if a day (or more) was missed, unchanged if already today. */
function nextDailyStreak(lastDay: number, today: number, prevStreak: number): number {
  if (lastDay === today) return prevStreak; // already claimed
  if (lastDay === today - 1) return prevStreak + 1; // consecutive day
  return 1; // missed a day (or first ever)
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
  /** Top players: global skill (rating), paid winnings (tokens_won) or free
   *  winnings (chips_won). */
  leaderboard(limit: number, board?: "rating" | "tokens" | "chips"): Promise<Profile[]>;
  /** Add a finished match's winnings to lifetime totals (drives earnings boards).
   *  currency: 0 = chips, 1 = token (amount in base units for tokens). */
  recordWinnings(wallet: string, currency: number, amount: number): Promise<void>;
  /** Append a per-match money swing for the profile PnL chart. Best-effort, MUST never
   *  throw into a settlement path. net is signed; kind: 0 = game, 1 = referral. */
  recordPnl(wallet: string, currency: number, net: number, kind: number): Promise<void>;
  /** Recent PnL points for a wallet (oldest→newest) for the profile chart. */
  getPnl(wallet: string): Promise<{ ts: string; currency: number; net: number; kind: number }[]>;
  /** Ensure a profile exists (granting starting chips), return it. */
  ensureProfile(wallet: string, name: string, skin: number): Promise<Profile>;
  /** Atomically add `delta` chips. Returns the new balance, or null if a
   *  negative delta would overdraw (balance unchanged). */
  adjustChips(wallet: string, delta: number): Promise<number | null>;
  /** Atomically add `delta` token base units. Returns the new balance, or null
   *  if a negative delta would overdraw (balance unchanged). */
  adjustToken(wallet: string, delta: number): Promise<number | null>;
  /** Admin override: set a wallet's rating outright. Returns the new value, or
   *  null if the profile doesn't exist. */
  setRating(wallet: string, rating: number): Promise<number | null>;
  /** Aggregate economy snapshot for the admin cockpit. */
  economyStats(): Promise<{ players: number; chips: number; tokenBase: number }>;
  /** Credit a deposit exactly once (deduped by tx signature). Returns true if
   *  this signature was newly applied, false if already processed. */
  creditDeposit(signature: string, wallet: string, amount: number): Promise<boolean>;
  /** Buy a skin: atomically deduct `price` chips and set its ownership bit.
   *  Returns the new {chips, skins} or null if already owned / can't afford. */
  buySkin(wallet: string, skin: number, price: number): Promise<{ chips: number; skins: number } | null>;
  /** Buy a skin INSTANTLY with the custodial token balance (atomic): deduct
   *  `amountBase` token base units and set ownership. Returns new
   *  {token_balance, skins} or null if already owned / can't afford. */
  buySkinToken(wallet: string, skin: number, amountBase: number): Promise<{ token_balance: number; skins: number } | null>;
  /** Grant a skin for free (e.g. a Lucky Spin drop). Returns new skins, or null
   *  if already owned. */
  grantSkin(wallet: string, skin: number): Promise<{ skins: number } | null>;
  /** Select an owned skin as the active one. Returns the new skin, or null if
   *  the wallet doesn't own it. */
  selectSkin(wallet: string, skin: number): Promise<number | null>;
  /** Claim a globally-unique nickname (case-insensitive). Returns true if it was
   *  set, false if another wallet already uses it. */
  setName(wallet: string, name: string): Promise<boolean>;
  /** Bind a referrer to this wallet — only if it has none yet and isn't self.
   *  Returns true if newly set. (Both profiles are ensured to exist.) */
  setReferrer(wallet: string, referrer: string): Promise<boolean>;
  /** Admin override: force this wallet's referrer (overwrites any existing one).
   *  Returns true on success. */
  setReferrerAdmin(wallet: string, referrer: string): Promise<boolean>;
  /** Credit a referral reward: add `amount` token base units to both the live
   *  balance and the lifetime `referral_earned` counter. */
  creditReferral(wallet: string, amount: number): Promise<void>;
  /** Add XP (and recompute level) WITHOUT touching rating — used for the tiny
   *  Competitive Bots Match reward. 200 XP per level. */
  addXp(wallet: string, amount: number): Promise<void>;
  /** Add to lifetime time-in-match (seconds). Best-effort, never throws. */
  addPlaytime(wallet: string, seconds: number): Promise<void>;
  /** Claim today's daily login reward (idempotent per UTC day). Advances the
   *  streak (resets if a day was missed) and grants chips + XP. */
  claimDaily(wallet: string): Promise<DailyClaim>;
  /** Persist the stakes escrowed for a live staked match, so a hard crash
   *  (SIGKILL/host failure) can refund them on the next boot. Returns false if
   *  the escrow could NOT be durably recorded — the caller must abort the match
   *  and refund, never run a staked match whose escrow isn't persisted. */
  recordOpenStakes(
    matchId: string,
    region: string,
    currency: number,
    entries: Array<{ wallet: string; amount: number }>,
  ): Promise<boolean>;
  /** Clear a match's open stakes once it has settled or been refunded. */
  clearOpenStakes(matchId: string): Promise<void>;
  /** Boot reconciliation: atomically take (delete + return) all open stakes for
   *  this region — the caller refunds each. Returns [] if none. */
  takeOpenStakes(region: string): Promise<Array<{ wallet: string; amount: number; currency: number }>>;
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
  // --- friends ---
  /** Resolve a (case-insensitive) nickname to its wallet, or null. */
  walletByName(name: string): Promise<string | null>;
  /** Send a friend request (creates the out/in edges). */
  addFriend(wallet: string, friend: string): Promise<"ok" | "already" | "self">;
  /** Accept a pending INCOMING request — both sides become friends. */
  acceptFriend(wallet: string, friend: string): Promise<boolean>;
  /** Remove a friend, or decline/cancel a request (clears both directions). */
  removeFriend(wallet: string, friend: string): Promise<void>;
  /** This wallet's friends + pending requests (with display names). */
  listFriends(wallet: string): Promise<Array<{ wallet: string; name: string; status: FriendStatus }>>;
}

/** A friend edge from the caller's point of view. */
export type FriendStatus = "friends" | "in" | "out";

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
    tokens_won: 0,
    chips_won: 0,
    referred_by: "",
    referral_earned: 0,
    playtime_sec: 0,
    daily_day: 0,
    daily_streak: 0,
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
  // Name is NOT updated here — it's a stable, unique identity set on profile
  // creation and changed only via setName (the claim endpoint).
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

  async leaderboard(limit: number, board: "rating" | "tokens" | "chips" = "rating"): Promise<Profile[]> {
    const all = [...this.map.values()];
    if (board === "tokens") {
      return all.filter((p) => p.tokens_won > 0).sort((a, b) => b.tokens_won - a.tokens_won).slice(0, limit);
    }
    if (board === "chips") {
      return all.filter((p) => p.chips_won > 0).sort((a, b) => b.chips_won - a.chips_won).slice(0, limit);
    }
    return all.sort((a, b) => b.rating - a.rating).slice(0, limit);
  }

  async recordWinnings(wallet: string, currency: number, amount: number): Promise<void> {
    if (amount <= 0) return;
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    if (currency === 1) p.tokens_won += amount;
    else p.chips_won += amount;
  }

  private pnl = new Map<string, { ts: number; currency: number; net: number; kind: number }[]>();
  async recordPnl(wallet: string, currency: number, net: number, kind: number): Promise<void> {
    const arr = this.pnl.get(wallet) ?? [];
    arr.push({ ts: Date.now(), currency, net, kind });
    while (arr.length > 250) arr.shift();
    this.pnl.set(wallet, arr);
  }
  async getPnl(wallet: string): Promise<{ ts: string; currency: number; net: number; kind: number }[]> {
    return (this.pnl.get(wallet) ?? []).map((e) => ({ ts: new Date(e.ts).toISOString(), currency: e.currency, net: e.net, kind: e.kind }));
  }

  private nameTakenBy(name: string, exceptWallet: string): boolean {
    const lower = name.toLowerCase();
    for (const q of this.map.values()) if (q.wallet !== exceptWallet && q.name.toLowerCase() === lower) return true;
    return false;
  }

  async ensureProfile(wallet: string, name: string, skin: number): Promise<Profile> {
    let p = this.map.get(wallet);
    if (!p) {
      // Make the starting name unique (suffix with a wallet fragment if taken).
      let n = name || `Player`;
      if (this.nameTakenBy(n, wallet)) n = `${n.slice(0, 11)}#${wallet.slice(0, 4)}`;
      p = blankProfile(wallet, n, skin);
      this.map.set(wallet, p);
    }
    return p;
  }

  async setName(wallet: string, name: string): Promise<boolean> {
    if (this.nameTakenBy(name, wallet)) return false;
    const p = this.map.get(wallet) ?? blankProfile(wallet, name, 0);
    this.map.set(wallet, p);
    p.name = name;
    return true;
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

  async setRating(wallet: string, rating: number): Promise<number | null> {
    const p = this.map.get(wallet);
    if (!p) return null;
    p.rating = Math.max(0, Math.floor(rating));
    return p.rating;
  }

  async economyStats(): Promise<{ players: number; chips: number; tokenBase: number }> {
    let chips = 0;
    let tokenBase = 0;
    for (const p of this.map.values()) {
      chips += p.chips ?? 0;
      tokenBase += p.token_balance ?? 0;
    }
    return { players: this.map.size, chips, tokenBase };
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

  async buySkinToken(
    wallet: string,
    skin: number,
    amountBase: number,
  ): Promise<{ token_balance: number; skins: number } | null> {
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    const bit = 1 << skin;
    if (p.skins & bit) return null; // already owned
    if (p.token_balance < amountBase) return null; // can't afford
    p.token_balance -= amountBase;
    p.skins |= bit;
    return { token_balance: p.token_balance, skins: p.skins };
  }

  async grantSkin(wallet: string, skin: number): Promise<{ skins: number } | null> {
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    const bit = 1 << skin;
    if (p.skins & bit) return null; // already owned
    p.skins |= bit;
    return { skins: p.skins };
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

  async addXp(wallet: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    p.xp += amount;
    p.level = 1 + Math.floor(p.xp / 200);
  }

  async addPlaytime(wallet: string, seconds: number): Promise<void> {
    if (seconds <= 0) return;
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    p.playtime_sec += Math.round(seconds);
  }

  async claimDaily(wallet: string): Promise<DailyClaim> {
    const p = this.map.get(wallet) ?? blankProfile(wallet, "", 0);
    this.map.set(wallet, p);
    const today = utcDayIndex();
    if (p.daily_day === today) {
      return { already: true, streak: p.daily_streak, chips: 0, xp: 0, bonus: false };
    }
    const streak = nextDailyStreak(p.daily_day, today, p.daily_streak);
    const r = dailyReward(streak, p.level);
    p.daily_day = today;
    p.daily_streak = streak;
    p.chips += r.chips;
    p.xp += r.xp;
    p.level = 1 + Math.floor(p.xp / 200);
    return { already: false, streak, chips: r.chips, xp: r.xp, bonus: r.bonus };
  }

  private openStakes = new Map<string, Array<{ wallet: string; amount: number; currency: number }>>();
  async recordOpenStakes(
    matchId: string,
    _region: string,
    currency: number,
    entries: Array<{ wallet: string; amount: number }>,
  ): Promise<boolean> {
    if (entries.length) this.openStakes.set(matchId, entries.map((e) => ({ ...e, currency })));
    return true;
  }
  async clearOpenStakes(matchId: string): Promise<void> {
    this.openStakes.delete(matchId);
  }
  async takeOpenStakes(_region: string): Promise<Array<{ wallet: string; amount: number; currency: number }>> {
    const all = [...this.openStakes.values()].flat();
    this.openStakes.clear();
    return all;
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

  // --- friends (in-memory) ---
  private edges = new Map<string, Map<string, FriendStatus>>();
  private edge(owner: string): Map<string, FriendStatus> {
    let m = this.edges.get(owner);
    if (!m) this.edges.set(owner, (m = new Map()));
    return m;
  }
  async walletByName(name: string): Promise<string | null> {
    const lower = name.trim().toLowerCase();
    for (const p of this.map.values()) if (p.name.toLowerCase() === lower) return p.wallet;
    return null;
  }
  async addFriend(wallet: string, friend: string): Promise<"ok" | "already" | "self"> {
    if (wallet === friend) return "self";
    const cur = this.edge(wallet).get(friend);
    if (cur) return "already";
    this.edge(wallet).set(friend, "out");
    this.edge(friend).set(wallet, "in");
    return "ok";
  }
  async acceptFriend(wallet: string, friend: string): Promise<boolean> {
    if (this.edge(wallet).get(friend) !== "in") return false;
    this.edge(wallet).set(friend, "friends");
    this.edge(friend).set(wallet, "friends");
    return true;
  }
  async removeFriend(wallet: string, friend: string): Promise<void> {
    this.edge(wallet).delete(friend);
    this.edge(friend).delete(wallet);
  }
  async listFriends(wallet: string): Promise<Array<{ wallet: string; name: string; status: FriendStatus }>> {
    const out: Array<{ wallet: string; name: string; status: FriendStatus }> = [];
    for (const [w, status] of this.edge(wallet)) {
      out.push({ wallet: w, name: this.map.get(w)?.name ?? "anon", status });
    }
    return out;
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

  async leaderboard(limit: number, board: "rating" | "tokens" | "chips" = "rating"): Promise<Profile[]> {
    try {
      const query =
        board === "tokens"
          ? `tokens_won=gt.0&order=tokens_won.desc`
          : board === "chips"
            ? `chips_won=gt.0&order=chips_won.desc`
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

  async recordWinnings(wallet: string, currency: number, amount: number): Promise<void> {
    if (amount <= 0) return;
    const p = await this.getProfile(wallet);
    const col = currency === 1 ? "tokens_won" : "chips_won";
    const next = ((p?.[col as "tokens_won" | "chips_won"] as number) ?? 0) + amount;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ [col]: next }),
      });
    } catch {
      /* best-effort */
    }
  }

  async recordPnl(wallet: string, currency: number, net: number, kind: number): Promise<void> {
    // Best-effort append. If the match_pnl table doesn't exist yet, this just 404s and is
    // swallowed — it can NEVER affect the settlement that called it.
    try {
      await fetch(`${this.url}/rest/v1/match_pnl`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ wallet, currency, net, kind }),
      });
    } catch {
      /* best-effort */
    }
  }

  async getPnl(wallet: string): Promise<{ ts: string; currency: number; net: number; kind: number }[]> {
    try {
      const res = await fetch(
        `${this.url}/rest/v1/match_pnl?wallet=eq.${encodeURIComponent(wallet)}&select=ts,currency,net,kind&order=ts.asc&limit=300`,
        { headers: this.headers() },
      );
      if (!res.ok) return [];
      return (await res.json()) as { ts: string; currency: number; net: number; kind: number }[];
    } catch {
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

  async setRating(wallet: string, rating: number): Promise<number | null> {
    const p = await this.getProfile(wallet);
    if (!p) return null;
    const r = Math.max(0, Math.floor(rating));
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ rating: r }),
      });
    } catch (e) {
      console.error("[store] setRating failed", e);
      return null;
    }
    return r;
  }

  async economyStats(): Promise<{ players: number; chips: number; tokenBase: number }> {
    // Best-effort: the Postgres path does a real aggregate. Supabase is a
    // fallback store, so report zeros rather than scanning every row.
    return { players: 0, chips: 0, tokenBase: 0 };
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

  async buySkinToken(
    wallet: string,
    skin: number,
    amountBase: number,
  ): Promise<{ token_balance: number; skins: number } | null> {
    // Best-effort read-modify-write (Postgres is the atomic, production path).
    const p = await this.getProfile(wallet);
    if (!p) return null;
    const bit = 1 << skin;
    if ((p.skins ?? DEFAULT_SKINS) & bit) return null;
    if ((p.token_balance ?? 0) < amountBase) return null;
    const token_balance = p.token_balance - amountBase;
    const skins = (p.skins ?? DEFAULT_SKINS) | bit;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ token_balance, skins }),
      });
    } catch (e) {
      console.error("[store] buySkinToken failed", e);
      return null;
    }
    return { token_balance, skins };
  }

  async grantSkin(wallet: string, skin: number): Promise<{ skins: number } | null> {
    const p = await this.getProfile(wallet);
    const owned = p?.skins ?? DEFAULT_SKINS;
    const bit = 1 << skin;
    if (owned & bit) return null;
    const skins = owned | bit;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ skins }),
      });
    } catch (e) {
      console.error("[store] grantSkin failed", e);
      return null;
    }
    return { skins };
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

  async addXp(wallet: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    const p = await this.getProfile(wallet);
    const xp = (p?.xp ?? 0) + amount;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ xp, level: 1 + Math.floor(xp / 200) }),
      });
    } catch {
      /* best-effort */
    }
  }

  async addPlaytime(wallet: string, seconds: number): Promise<void> {
    if (seconds <= 0) return;
    const p = await this.getProfile(wallet);
    const playtime_sec = (p?.playtime_sec ?? 0) + Math.round(seconds);
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ playtime_sec }),
      });
    } catch {
      /* best-effort */
    }
  }

  async claimDaily(wallet: string): Promise<DailyClaim> {
    const p = await this.getProfile(wallet);
    const today = utcDayIndex();
    const lastDay = p?.daily_day ?? 0;
    if (lastDay === today) return { already: true, streak: p?.daily_streak ?? 0, chips: 0, xp: 0, bonus: false };
    const streak = nextDailyStreak(lastDay, today, p?.daily_streak ?? 0);
    const level = p?.level ?? 1;
    const r = dailyReward(streak, level);
    const xp = (p?.xp ?? 0) + r.xp;
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({
          daily_day: today,
          daily_streak: streak,
          chips: (p?.chips ?? STARTING_CHIPS) + r.chips,
          xp,
          level: 1 + Math.floor(xp / 200),
        }),
      });
    } catch {
      /* best-effort */
    }
    return { already: false, streak, chips: r.chips, xp: r.xp, bonus: r.bonus };
  }

  // Open-stakes persistence is a Postgres-only feature; production requires
  // Postgres (preflight), so these are no-ops here.
  async recordOpenStakes(): Promise<boolean> {
    return true;
  }
  async clearOpenStakes(): Promise<void> {}
  async takeOpenStakes(): Promise<Array<{ wallet: string; amount: number; currency: number }>> {
    return [];
  }

  async setName(wallet: string, name: string): Promise<boolean> {
    // Best-effort (no strict uniqueness on REST); production uses Postgres.
    try {
      await fetch(`${this.url}/rest/v1/profiles?wallet=eq.${encodeURIComponent(wallet)}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ name }),
      });
    } catch {
      /* best-effort */
    }
    return true;
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

  // --- friends: not implemented on the REST store (production uses Postgres) ---
  async walletByName(): Promise<string | null> {
    return null;
  }
  async addFriend(): Promise<"ok" | "already" | "self"> {
    return "already";
  }
  async acceptFriend(): Promise<boolean> {
    return false;
  }
  async removeFriend(): Promise<void> {}
  async listFriends(): Promise<Array<{ wallet: string; name: string; status: FriendStatus }>> {
    return [];
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
    // Lifetime winnings for the earnings leaderboards.
    await this.pool.query(`alter table profiles add column if not exists tokens_won bigint not null default 0`);
    await this.pool.query(`alter table profiles add column if not exists chips_won bigint not null default 0`);
    // Lifetime time-in-match (seconds), shown on the player card.
    await this.pool.query(`alter table profiles add column if not exists playtime_sec bigint not null default 0`);
    // Daily login reward: UTC day-index of the last claim + the login streak.
    await this.pool.query(`alter table profiles add column if not exists daily_day bigint not null default 0`);
    await this.pool.query(`alter table profiles add column if not exists daily_streak int not null default 0`);
    await this.pool.query(`create index if not exists profiles_referred_by on profiles (referred_by)`);
    await this.pool.query(`
      create table if not exists processed_deposits (
        signature text primary key,
        wallet text not null,
        amount bigint not null,
        at timestamptz not null default now()
      )`);
    // Append-only withdrawals ledger (recorded after a successful payout tx) so
    // every cash-out is auditable in the admin money panel.
    await this.pool.query(`
      create table if not exists withdrawals (
        signature text primary key,
        wallet text not null,
        amount bigint not null,
        at timestamptz not null default now()
      )`);
    // In-flight escrow: stakes collected for a live match but not yet settled.
    // Refunded on boot if a hard crash left them behind (see takeOpenStakes).
    await this.pool.query(`
      create table if not exists open_stakes (
        match_id text not null,
        wallet text not null,
        amount bigint not null,
        currency int not null default 0,
        region text not null default '',
        at timestamptz not null default now()
      )`);
    await this.pool.query(`create index if not exists open_stakes_region on open_stakes (region)`);
    await this.pool.query(`create index if not exists open_stakes_match on open_stakes (match_id)`);
    // Per-match money swings for the profile PnL chart (additive; never touches profiles).
    await this.pool.query(`
      create table if not exists match_pnl (
        id bigint generated by default as identity primary key,
        wallet text not null,
        ts timestamptz not null default now(),
        currency smallint not null,
        net bigint not null,
        kind smallint not null default 0
      )`);
    await this.pool.query(`create index if not exists match_pnl_wallet_ts on match_pnl (wallet, ts desc)`);
    // Hot leaderboard reads — avoid full-scan+sort as the table grows at launch.
    await this.pool.query(`create index if not exists profiles_rating on profiles (rating desc)`);
    await this.pool.query(
      `create index if not exists profiles_tokens_won on profiles (tokens_won desc) where tokens_won > 0`,
    );
    await this.pool.query(
      `create index if not exists profiles_chips_won on profiles (chips_won desc) where chips_won > 0`,
    );
    // Speeds the case-insensitive nickname lookup used by the uniqueness check.
    // NOTE: not UNIQUE yet — enforcing it needs a one-time de-dup of any existing
    // collisions first, or the index build would fail and break boot. Tracked as
    // a follow-up; setName/ensureProfile already guard with a NOT EXISTS check.
    await this.pool.query(`create index if not exists profiles_name_lower on profiles (lower(name)) where name <> ''`);
    // Friends: directed edges. status: 'out' (request sent), 'in' (received),
    // 'friends' (accepted). Both directions are kept in sync by the methods.
    await this.pool.query(`
      create table if not exists friend_edges (
        owner text not null,
        friend text not null,
        status text not null,
        created_at timestamptz not null default now(),
        primary key (owner, friend)
      )`);
    await this.pool.query(`create index if not exists friend_edges_owner on friend_edges (owner)`);
  }

  async recordMatch(results: MatchResult[]): Promise<void> {
    if (!results.length) return;
    const client = await this.pool.connect();
    try {
      await this.ready;
      // Read current ratings so the Elo swing uses pre-match values for everyone.
      const wallets = results.map((r) => r.wallet);
      const cur = await client.query(
        `select wallet, rating from profiles where wallet = any($1)`,
        [wallets],
      );
      const ratingMap = new Map<string, number>(cur.rows.map((row) => [row.wallet, row.rating]));
      const deltas = ratingDeltas(results, (w) => ratingMap.get(w) ?? STARTING_RATING);
      const week = isoWeekKey();
      // Elo is zero-sum across the match — apply every player's row atomically so
      // a mid-loop failure can never leave ratings half-applied/corrupted.
      await client.query("begin");
      for (const r of results) {
        const xp = xpForMatch(r);
        const dRating = deltas.get(r.wallet) ?? 0;
        const wkPts = weekPointsFor(r);
        await client.query(
          `insert into profiles (wallet,name,skin,xp,matches,wins,frags,deaths,current_streak,best_streak,level,rating,week_key,week_points,updated_at)
           values ($1,$2,$3,$4,1, case when $5 then 1 else 0 end, $6,$7, case when $5 then 1 else 0 end, case when $5 then 1 else 0 end, 1 + ($4/200), greatest(0, ${STARTING_RATING} + $8), $9, $10, now())
           on conflict (wallet) do update set
             skin=excluded.skin,
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
      await client.query("commit");
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error("[store] pg recordMatch failed", e);
      alert(`recordMatch failed — match stats/rating not saved (${(e as Error)?.message ?? e})`);
    } finally {
      client.release();
    }
  }

  // pg returns bigint columns as strings — coerce them back to numbers.
  private norm(row: Record<string, unknown> | undefined): Profile | null {
    if (!row) return null;
    return {
      ...(row as unknown as Profile),
      token_balance: Number(row.token_balance ?? 0),
      referral_earned: Number(row.referral_earned ?? 0),
      tokens_won: Number(row.tokens_won ?? 0),
      chips_won: Number(row.chips_won ?? 0),
      playtime_sec: Number(row.playtime_sec ?? 0),
      daily_day: Number(row.daily_day ?? 0),
      daily_streak: Number(row.daily_streak ?? 0),
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

  async leaderboard(limit: number, board: "rating" | "tokens" | "chips" = "rating"): Promise<Profile[]> {
    try {
      await this.ready;
      const res =
        board === "tokens"
          ? await this.pool.query("select * from profiles where tokens_won>0 order by tokens_won desc limit $1", [limit])
          : board === "chips"
            ? await this.pool.query("select * from profiles where chips_won>0 order by chips_won desc limit $1", [limit])
            : await this.pool.query("select * from profiles order by rating desc limit $1", [limit]);
      return res.rows.map((r) => this.norm(r)!) as Profile[];
    } catch (e) {
      console.error("[store] pg leaderboard failed", e);
      return [];
    }
  }

  async recordWinnings(wallet: string, currency: number, amount: number): Promise<void> {
    if (amount <= 0) return;
    const col = currency === 1 ? "tokens_won" : "chips_won";
    try {
      await this.ready;
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      await this.pool.query(`update profiles set ${col} = ${col} + $2, updated_at=now() where wallet=$1`, [
        wallet,
        amount,
      ]);
    } catch (e) {
      console.error("[store] pg recordWinnings failed", e);
    }
  }

  async recordPnl(wallet: string, currency: number, net: number, kind: number): Promise<void> {
    try {
      await this.ready;
      await this.pool.query(
        `insert into match_pnl (wallet, currency, net, kind) values ($1,$2,$3,$4)`,
        [wallet, currency, net, kind],
      );
    } catch (e) {
      console.error("[store] pg recordPnl failed", e); // best-effort; never rethrow
    }
  }

  async getPnl(wallet: string): Promise<{ ts: string; currency: number; net: number; kind: number }[]> {
    try {
      await this.ready;
      const r = await this.pool.query(
        `select ts, currency, net, kind from match_pnl where wallet=$1 order by ts asc limit 300`,
        [wallet],
      );
      return r.rows.map((row) => ({
        ts: new Date(row.ts).toISOString(),
        currency: Number(row.currency),
        net: Number(row.net),
        kind: Number(row.kind),
      }));
    } catch (e) {
      console.error("[store] pg getPnl failed", e);
      return [];
    }
  }

  async ensureProfile(wallet: string, name: string, skin: number): Promise<Profile> {
    await this.ready;
    // Make the starting name unique (case-insensitive). If taken by ANOTHER
    // wallet, suffix with a short wallet fragment so creation never collides.
    let n = (name || "Player").slice(0, 16);
    try {
      const taken = await this.pool.query(
        `select 1 from profiles where lower(name)=lower($1) and wallet<>$2 limit 1`,
        [n, wallet],
      );
      if (taken.rowCount) n = `${n.slice(0, 11)}#${wallet.slice(0, 4)}`;
    } catch {
      /* on error just use the name as-is */
    }
    await this.pool.query(
      `insert into profiles (wallet,name,skin) values ($1,$2,$3) on conflict (wallet) do nothing`,
      [wallet, n, skin],
    );
    const res = await this.pool.query("select * from profiles where wallet=$1", [wallet]);
    return this.norm(res.rows[0])!;
  }

  async setName(wallet: string, name: string): Promise<boolean> {
    try {
      await this.ready;
      // Claim only if no OTHER wallet holds this name (case-insensitive).
      const r = await this.pool.query(
        `update profiles p set name=$2, updated_at=now()
           where p.wallet=$1
             and not exists (select 1 from profiles q where lower(q.name)=lower($2) and q.wallet<>$1)`,
        [wallet, name],
      );
      if (r.rowCount && r.rowCount > 0) return true;
      // No row updated: either the wallet has no profile yet, or the name is taken.
      const owner = await this.pool.query(`select wallet from profiles where lower(name)=lower($1) limit 1`, [name]);
      if (owner.rowCount && owner.rows[0].wallet !== wallet) return false; // taken by someone else
      // Profile didn't exist — create it with this (free) name.
      await this.pool.query(
        `insert into profiles (wallet,name) values ($1,$2) on conflict (wallet) do update set name=$2, updated_at=now()`,
        [wallet, name],
      );
      return true;
    } catch (e) {
      console.error("[store] pg setName failed", e);
      return false;
    }
  }

  async adjustChips(wallet: string, delta: number): Promise<number | null> {
    try {
      await this.ready;
      // Ensure the row exists first (a credit/refund to a never-seen wallet must
      // not silently no-op), then atomically move the balance (overdraw-safe).
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
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

  async setRating(wallet: string, rating: number): Promise<number | null> {
    try {
      await this.ready;
      const r = Math.max(0, Math.floor(rating));
      const res = await this.pool.query(
        `update profiles set rating=$2, updated_at=now() where wallet=$1 returning rating`,
        [wallet, r],
      );
      return res.rows[0] ? Number(res.rows[0].rating) : null;
    } catch (e) {
      console.error("[store] pg setRating failed", e);
      return null;
    }
  }

  async economyStats(): Promise<{ players: number; chips: number; tokenBase: number }> {
    try {
      await this.ready;
      const res = await this.pool.query(
        `select count(*)::bigint as players,
                coalesce(sum(chips),0)::bigint as chips,
                coalesce(sum(token_balance),0)::bigint as token_base
         from profiles`,
      );
      const row = res.rows[0] ?? {};
      return {
        players: Number(row.players ?? 0),
        chips: Number(row.chips ?? 0),
        tokenBase: Number(row.token_base ?? 0),
      };
    } catch (e) {
      console.error("[store] pg economyStats failed", e);
      return { players: 0, chips: 0, tokenBase: 0 };
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

  async buySkinToken(
    wallet: string,
    skin: number,
    amountBase: number,
  ): Promise<{ token_balance: number; skins: number } | null> {
    try {
      await this.ready;
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      // Atomic: only buy if the token balance covers it and not already owned.
      const res = await this.pool.query(
        `update profiles set token_balance = token_balance - $3, skins = skins | (1 << $2), updated_at=now()
         where wallet=$1 and token_balance >= $3 and (skins & (1 << $2)) = 0
         returning token_balance, skins`,
        [wallet, skin, amountBase],
      );
      return res.rows[0]
        ? { token_balance: Number(res.rows[0].token_balance), skins: res.rows[0].skins as number }
        : null;
    } catch (e) {
      console.error("[store] pg buySkinToken failed", e);
      return null;
    }
  }

  async grantSkin(wallet: string, skin: number): Promise<{ skins: number } | null> {
    try {
      await this.ready;
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      const res = await this.pool.query(
        `update profiles set skins = skins | (1 << $2), updated_at=now()
         where wallet=$1 and (skins & (1 << $2)) = 0
         returning skins`,
        [wallet, skin],
      );
      return res.rows[0] ? { skins: res.rows[0].skins as number } : null;
    } catch (e) {
      console.error("[store] pg grantSkin failed", e);
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

  /** Recent deposits for the admin money ledger (newest first). Postgres-only. */
  async recentDeposits(limit = 25): Promise<Array<{ signature: string; wallet: string; amount: number; at: string }>> {
    try {
      await this.ready;
      const r = await this.pool.query("select signature, wallet, amount, at from processed_deposits order by at desc limit $1", [Math.min(2000, limit)]);
      return r.rows.map((x: Record<string, unknown>) => ({ signature: String(x.signature), wallet: String(x.wallet), amount: Number(x.amount ?? 0), at: String(x.at ?? "") }));
    } catch {
      return [];
    }
  }

  /** Record a successful withdrawal (append-only audit log). Best-effort. */
  async recordWithdrawal(signature: string, wallet: string, amount: number): Promise<void> {
    try {
      await this.ready;
      await this.pool.query("insert into withdrawals (signature, wallet, amount) values ($1,$2,$3) on conflict (signature) do nothing", [signature, wallet, amount]);
    } catch (e) {
      console.error("[store] pg recordWithdrawal failed", e);
    }
  }

  async recentWithdrawals(limit = 25): Promise<Array<{ signature: string; wallet: string; amount: number; at: string }>> {
    try {
      await this.ready;
      const r = await this.pool.query("select signature, wallet, amount, at from withdrawals order by at desc limit $1", [Math.min(2000, limit)]);
      return r.rows.map((x: Record<string, unknown>) => ({ signature: String(x.signature), wallet: String(x.wallet), amount: Number(x.amount ?? 0), at: String(x.at ?? "") }));
    } catch {
      return [];
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

  async addXp(wallet: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    try {
      await this.ready;
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      await this.pool.query(
        `update profiles set xp = xp + $2, level = 1 + ((xp + $2) / 200), updated_at=now() where wallet=$1`,
        [wallet, amount],
      );
    } catch (e) {
      console.error("[store] pg addXp failed", e);
    }
  }

  async addPlaytime(wallet: string, seconds: number): Promise<void> {
    if (seconds <= 0) return;
    try {
      await this.ready;
      await this.pool.query(
        `insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`,
        [wallet],
      );
      await this.pool.query(
        `update profiles set playtime_sec = playtime_sec + $2, updated_at=now() where wallet=$1`,
        [wallet, Math.round(seconds)],
      );
    } catch (e) {
      console.error("[store] pg addPlaytime failed", e);
    }
  }

  async claimDaily(wallet: string): Promise<DailyClaim> {
    const today = utcDayIndex();
    const client = await this.pool.connect();
    try {
      await this.ready;
      await client.query(`insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`, [wallet]);
      await client.query("begin");
      const r = await client.query(
        `select daily_day, daily_streak, level from profiles where wallet=$1 for update`,
        [wallet],
      );
      const lastDay = Number(r.rows[0]?.daily_day ?? 0);
      const prevStreak = Number(r.rows[0]?.daily_streak ?? 0);
      const level = Number(r.rows[0]?.level ?? 1);
      if (lastDay === today) {
        await client.query("commit");
        return { already: true, streak: prevStreak, chips: 0, xp: 0, bonus: false };
      }
      const streak = nextDailyStreak(lastDay, today, prevStreak);
      const reward = dailyReward(streak, level);
      await client.query(
        `update profiles set daily_day=$2, daily_streak=$3, chips=chips+$4,
           xp=xp+$5, level=1+((xp+$5)/200), updated_at=now() where wallet=$1`,
        [wallet, today, streak, reward.chips, reward.xp],
      );
      await client.query("commit");
      return { already: false, streak, chips: reward.chips, xp: reward.xp, bonus: reward.bonus };
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error("[store] pg claimDaily failed", e);
      return { already: true, streak: 0, chips: 0, xp: 0, bonus: false };
    } finally {
      client.release();
    }
  }

  async recordOpenStakes(
    matchId: string,
    region: string,
    currency: number,
    entries: Array<{ wallet: string; amount: number }>,
  ): Promise<boolean> {
    if (!entries.length) return true;
    try {
      await this.ready;
      // One multi-row insert.
      const vals: string[] = [];
      const args: unknown[] = [];
      let i = 1;
      for (const e of entries) {
        vals.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
        args.push(matchId, e.wallet, e.amount, currency, region);
      }
      await this.pool.query(
        `insert into open_stakes (match_id, wallet, amount, currency, region) values ${vals.join(",")}`,
        args,
      );
      return true;
    } catch (e) {
      console.error("[store] pg recordOpenStakes failed", e);
      return false; // caller must abort the match — escrow not durably recorded
    }
  }

  async clearOpenStakes(matchId: string): Promise<void> {
    try {
      await this.ready;
      await this.pool.query(`delete from open_stakes where match_id = $1`, [matchId]);
    } catch (e) {
      console.error("[store] pg clearOpenStakes failed", e);
    }
  }

  async takeOpenStakes(region: string): Promise<Array<{ wallet: string; amount: number; currency: number }>> {
    try {
      await this.ready;
      // Atomic delete+return so two boots can't double-refund the same row.
      const r = await this.pool.query(
        `delete from open_stakes where region = $1 returning wallet, amount, currency`,
        [region],
      );
      return r.rows.map((row) => ({ wallet: row.wallet, amount: Number(row.amount), currency: Number(row.currency) }));
    } catch (e) {
      console.error("[store] pg takeOpenStakes failed", e);
      return [];
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

  // --- friends (Postgres) ---
  async walletByName(name: string): Promise<string | null> {
    try {
      await this.ready;
      const r = await this.pool.query(
        `select wallet from profiles where lower(name)=lower($1) limit 1`,
        [name.trim()],
      );
      return r.rows[0]?.wallet ?? null;
    } catch (e) {
      console.error("[store] pg walletByName failed", e);
      return null;
    }
  }
  async addFriend(wallet: string, friend: string): Promise<"ok" | "already" | "self"> {
    if (wallet === friend) return "self";
    const client = await this.pool.connect();
    try {
      await this.ready;
      const exists = await client.query(
        `select 1 from friend_edges where owner=$1 and friend=$2`,
        [wallet, friend],
      );
      if (exists.rowCount) return "already";
      await client.query("begin");
      await client.query(
        `insert into friend_edges (owner,friend,status) values ($1,$2,'out')
         on conflict (owner,friend) do nothing`,
        [wallet, friend],
      );
      await client.query(
        `insert into friend_edges (owner,friend,status) values ($1,$2,'in')
         on conflict (owner,friend) do nothing`,
        [friend, wallet],
      );
      await client.query("commit");
      return "ok";
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error("[store] pg addFriend failed", e);
      return "already";
    } finally {
      client.release();
    }
  }
  async acceptFriend(wallet: string, friend: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await this.ready;
      const r = await client.query(
        `select status from friend_edges where owner=$1 and friend=$2`,
        [wallet, friend],
      );
      if (r.rows[0]?.status !== "in") return false; // only accept a real incoming request
      await client.query("begin");
      await client.query(`update friend_edges set status='friends' where owner=$1 and friend=$2`, [wallet, friend]);
      await client.query(
        `insert into friend_edges (owner,friend,status) values ($1,$2,'friends')
         on conflict (owner,friend) do update set status='friends'`,
        [friend, wallet],
      );
      await client.query("commit");
      return true;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error("[store] pg acceptFriend failed", e);
      return false;
    } finally {
      client.release();
    }
  }
  async removeFriend(wallet: string, friend: string): Promise<void> {
    try {
      await this.ready;
      await this.pool.query(
        `delete from friend_edges where (owner=$1 and friend=$2) or (owner=$2 and friend=$1)`,
        [wallet, friend],
      );
    } catch (e) {
      console.error("[store] pg removeFriend failed", e);
    }
  }
  async listFriends(wallet: string): Promise<Array<{ wallet: string; name: string; status: FriendStatus }>> {
    try {
      await this.ready;
      const r = await this.pool.query(
        `select e.friend as wallet, coalesce(p.name,'anon') as name, e.status
         from friend_edges e left join profiles p on p.wallet = e.friend
         where e.owner = $1
         order by case e.status when 'in' then 0 when 'friends' then 1 else 2 end, name`,
        [wallet],
      );
      return r.rows.map((row) => ({ wallet: row.wallet, name: row.name, status: row.status as FriendStatus }));
    } catch (e) {
      console.error("[store] pg listFriends failed", e);
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
