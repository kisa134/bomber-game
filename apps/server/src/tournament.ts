// Tournaments — admin-run competitions (two formats: points-race & bracket).
//
// Self-contained persistence: uses its own small Postgres pool when DATABASE_URL
// is set (production), otherwise an in-memory store (dev). Kept out of the main
// ProfileStore so we don't have to fan a 3-table schema across 3 backends.
//
// Everything about a tournament is admin-configurable (format, free/buy-in,
// prize, size, pod size, start time, points table) so we can spin up any
// contest from the admin panel and have it appear to every player in-game.

import pg from "pg";

export type TFormat = "points" | "bracket";
export type TStatus = "draft" | "reg_open" | "checkin" | "live" | "done" | "cancelled";
export type TPlayerStatus = "registered" | "checked_in" | "active" | "eliminated" | "winner";

/** Everything an organizer sets when creating/editing a tournament. */
export interface TournamentConfig {
  name: string;
  format: TFormat;
  description: string;
  prizeUsd: number; // headline prize pool in USD (display + payout tracking)
  entryType: "free" | "buyin"; // free = we fund it; buyin = players pay in
  entryAmount: number; // buy-in per player (token/chips base units; 0 if free)
  currency: number; // 0 = chips, 1 = token (for buy-in)
  maxPlayers: number; // registration cap
  podSize: number; // players per match (4 for our game)
  podsAdvance: number; // bracket: how many top finishers of a pod advance (usually 1)
  pointsTable: number[]; // points-race: points by placement [1st,2nd,3rd,4th]
  matchesPerPlayer: number; // points-race: how many games each player gets (0 = until window ends)
  startAt: number; // unix ms when the contest begins (0 = TBD)
  regOpen: boolean; // open registration immediately on create
}

export interface Tournament extends Omit<TournamentConfig, "regOpen"> {
  id: string;
  status: TStatus;
  createdBy: string; // organizer wallet (or "admin")
  createdAt: number;
  startedAt: number;
  endedAt: number;
  winners: string[]; // wallets of the final placement (top first), set on finish
  registered: number; // live count (derived)
}

export interface TournamentPlayer {
  tournamentId: string;
  wallet: string;
  name: string;
  status: TPlayerStatus;
  points: number;
  placement: number; // final placement (1 = winner; 0 = unset)
  prizePaid: number; // USD recorded as paid out to this player
  joinedAt: number;
}

/** A single pod/match within a tournament (one room of `podSize` players). */
export interface TournamentMatch {
  tournamentId: string;
  round: number;
  pod: number;
  roomCode: string;
  players: string[]; // wallets seated
  result: string[]; // wallets in finish order (winner first), set on report
  status: "pending" | "live" | "done";
}

/** A push announcement shown to all players in-game (banner/popup). */
export interface Announcement {
  id: string;
  text: string;
  tournamentId: string; // optional deep-link target ("" = none)
  cta: string; // button label ("" = info only)
  until: number; // unix ms to stop showing (0 = until cleared)
  createdAt: number;
}

const DEFAULTS: Omit<TournamentConfig, "name"> = {
  format: "points",
  description: "",
  prizeUsd: 0,
  entryType: "free",
  entryAmount: 0,
  currency: 0,
  maxPlayers: 64,
  podSize: 4,
  podsAdvance: 1,
  pointsTable: [10, 6, 3, 1],
  matchesPerPlayer: 5,
  startAt: 0,
  regOpen: true,
};

function rid(): string {
  // Short, URL-safe id (no ambiguous chars). Time is injected, not Date.now()
  // (kept deterministic-friendly): caller stamps via the `now` arg.
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

// ---------------------------------------------------------------------------
// Store: Postgres when DATABASE_URL is set, else in-memory.
// ---------------------------------------------------------------------------

class TournamentStore {
  private pool: pg.Pool | null = null;
  private ready: Promise<void> = Promise.resolve();
  // In-memory fallback.
  private mem = {
    tours: new Map<string, Tournament>(),
    players: new Map<string, TournamentPlayer>(), // key `${tid}:${wallet}`
    matches: [] as TournamentMatch[],
    announcement: null as Announcement | null,
  };

  constructor() {
    const url = process.env.DATABASE_URL;
    if (url) {
      this.pool = new pg.Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        max: Number(process.env.PG_TOURNEY_POOL_MAX ?? 4),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
      this.pool.on("error", (e) => console.error("[tournament] pg pool error", e));
      this.ready = this.migrate();
    }
  }

  private async migrate(): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        create table if not exists tournaments (
          id text primary key,
          name text not null,
          format text not null default 'points',
          status text not null default 'draft',
          description text not null default '',
          prize_usd double precision not null default 0,
          entry_type text not null default 'free',
          entry_amount bigint not null default 0,
          currency int not null default 0,
          max_players int not null default 64,
          pod_size int not null default 4,
          pods_advance int not null default 1,
          points_table text not null default '[10,6,3,1]',
          matches_per_player int not null default 5,
          start_at bigint not null default 0,
          started_at bigint not null default 0,
          ended_at bigint not null default 0,
          winners text not null default '[]',
          created_by text not null default 'admin',
          created_at bigint not null default 0
        )`);
      await this.pool.query(`
        create table if not exists tournament_players (
          tournament_id text not null,
          wallet text not null,
          name text not null default '',
          status text not null default 'registered',
          points int not null default 0,
          placement int not null default 0,
          prize_paid double precision not null default 0,
          joined_at bigint not null default 0,
          primary key (tournament_id, wallet)
        )`);
      await this.pool.query(`create index if not exists tplayers_tid on tournament_players (tournament_id)`);
      await this.pool.query(`
        create table if not exists tournament_matches (
          tournament_id text not null,
          round int not null,
          pod int not null,
          room_code text not null default '',
          players text not null default '[]',
          result text not null default '[]',
          status text not null default 'pending',
          primary key (tournament_id, round, pod)
        )`);
      await this.pool.query(`
        create table if not exists announcements (
          id text primary key,
          text text not null,
          tournament_id text not null default '',
          cta text not null default '',
          until bigint not null default 0,
          created_at bigint not null default 0
        )`);
    } catch (e) {
      console.error("[tournament] migrate failed", e);
    }
  }

  private rowToTournament(r: Record<string, unknown>, registered: number): Tournament {
    return {
      id: String(r.id),
      name: String(r.name),
      format: r.format as TFormat,
      status: r.status as TStatus,
      description: String(r.description ?? ""),
      prizeUsd: Number(r.prize_usd ?? 0),
      entryType: (r.entry_type as "free" | "buyin") ?? "free",
      entryAmount: Number(r.entry_amount ?? 0),
      currency: Number(r.currency ?? 0),
      maxPlayers: Number(r.max_players ?? 64),
      podSize: Number(r.pod_size ?? 4),
      podsAdvance: Number(r.pods_advance ?? 1),
      pointsTable: safeArr<number>(r.points_table, [10, 6, 3, 1]),
      matchesPerPlayer: Number(r.matches_per_player ?? 5),
      startAt: Number(r.start_at ?? 0),
      startedAt: Number(r.started_at ?? 0),
      endedAt: Number(r.ended_at ?? 0),
      winners: safeArr<string>(r.winners, []),
      createdBy: String(r.created_by ?? "admin"),
      createdAt: Number(r.created_at ?? 0),
      registered,
    };
  }

  async create(cfg: TournamentConfig, createdBy: string, now: number): Promise<Tournament> {
    const id = rid();
    const t: Tournament = {
      ...cfg,
      id,
      status: cfg.regOpen ? "reg_open" : "draft",
      createdBy,
      createdAt: now,
      startedAt: 0,
      endedAt: 0,
      winners: [],
      registered: 0,
    };
    if (this.pool) {
      await this.ready;
      await this.pool.query(
        `insert into tournaments (id,name,format,status,description,prize_usd,entry_type,entry_amount,currency,max_players,pod_size,pods_advance,points_table,matches_per_player,start_at,created_by,created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [id, t.name, t.format, t.status, t.description, t.prizeUsd, t.entryType, t.entryAmount, t.currency, t.maxPlayers, t.podSize, t.podsAdvance, JSON.stringify(t.pointsTable), t.matchesPerPlayer, t.startAt, t.createdBy, t.createdAt],
      );
    } else {
      this.mem.tours.set(id, t);
    }
    return t;
  }

  async update(id: string, patch: Partial<TournamentConfig> & { status?: TStatus; startedAt?: number; endedAt?: number; winners?: string[] }): Promise<Tournament | null> {
    const cur = await this.get(id);
    if (!cur) return null;
    const next: Tournament = { ...cur, ...patch } as Tournament;
    if (this.pool) {
      await this.pool.query(
        `update tournaments set name=$2,format=$3,status=$4,description=$5,prize_usd=$6,entry_type=$7,entry_amount=$8,currency=$9,max_players=$10,pod_size=$11,pods_advance=$12,points_table=$13,matches_per_player=$14,start_at=$15,started_at=$16,ended_at=$17,winners=$18 where id=$1`,
        [id, next.name, next.format, next.status, next.description, next.prizeUsd, next.entryType, next.entryAmount, next.currency, next.maxPlayers, next.podSize, next.podsAdvance, JSON.stringify(next.pointsTable), next.matchesPerPlayer, next.startAt, next.startedAt, next.endedAt, JSON.stringify(next.winners)],
      );
    } else {
      this.mem.tours.set(id, next);
    }
    return next;
  }

  async get(id: string): Promise<Tournament | null> {
    if (this.pool) {
      await this.ready;
      const r = await this.pool.query("select * from tournaments where id=$1", [id]);
      if (!r.rows[0]) return null;
      const c = await this.pool.query("select count(*)::int n from tournament_players where tournament_id=$1", [id]);
      return this.rowToTournament(r.rows[0], Number(c.rows[0]?.n ?? 0));
    }
    const t = this.mem.tours.get(id);
    if (!t) return null;
    return { ...t, registered: [...this.mem.players.values()].filter((p) => p.tournamentId === id).length };
  }

  async list(): Promise<Tournament[]> {
    if (this.pool) {
      await this.ready;
      const r = await this.pool.query("select * from tournaments order by created_at desc limit 100");
      const counts = await this.pool.query("select tournament_id, count(*)::int n from tournament_players group by tournament_id");
      const cmap = new Map<string, number>(counts.rows.map((x: Record<string, unknown>) => [String(x.tournament_id), Number(x.n)]));
      return r.rows.map((row: Record<string, unknown>) => this.rowToTournament(row, cmap.get(String(row.id)) ?? 0));
    }
    return [...this.mem.tours.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({ ...t, registered: [...this.mem.players.values()].filter((p) => p.tournamentId === t.id).length }));
  }

  async players(id: string): Promise<TournamentPlayer[]> {
    if (this.pool) {
      await this.ready;
      const r = await this.pool.query("select * from tournament_players where tournament_id=$1 order by points desc, joined_at asc", [id]);
      return r.rows.map(rowToPlayer);
    }
    return [...this.mem.players.values()]
      .filter((p) => p.tournamentId === id)
      .sort((a, b) => b.points - a.points || a.joinedAt - b.joinedAt);
  }

  async register(id: string, wallet: string, name: string, now: number): Promise<"ok" | "full" | "closed" | "exists"> {
    const t = await this.get(id);
    if (!t) return "closed";
    if (t.status !== "reg_open" && t.status !== "checkin") return "closed";
    if (t.registered >= t.maxPlayers) return "full";
    const key = `${id}:${wallet}`;
    if (this.pool) {
      const exists = await this.pool.query("select 1 from tournament_players where tournament_id=$1 and wallet=$2", [id, wallet]);
      if (exists.rows[0]) return "exists";
      await this.pool.query(
        `insert into tournament_players (tournament_id,wallet,name,status,joined_at) values ($1,$2,$3,'registered',$4) on conflict do nothing`,
        [id, wallet, name, now],
      );
    } else {
      if (this.mem.players.has(key)) return "exists";
      this.mem.players.set(key, { tournamentId: id, wallet, name, status: "registered", points: 0, placement: 0, prizePaid: 0, joinedAt: now });
    }
    return "ok";
  }

  async setPlayer(id: string, wallet: string, patch: Partial<TournamentPlayer>): Promise<void> {
    const key = `${id}:${wallet}`;
    if (this.pool) {
      // Build a dynamic update only for provided fields we allow.
      const cols: string[] = [];
      const vals: unknown[] = [id, wallet];
      const add = (col: string, v: unknown) => { vals.push(v); cols.push(`${col}=$${vals.length}`); };
      if (patch.status !== undefined) add("status", patch.status);
      if (patch.points !== undefined) add("points", patch.points);
      if (patch.placement !== undefined) add("placement", patch.placement);
      if (patch.prizePaid !== undefined) add("prize_paid", patch.prizePaid);
      if (!cols.length) return;
      await this.pool.query(`update tournament_players set ${cols.join(",")} where tournament_id=$1 and wallet=$2`, vals);
    } else {
      const p = this.mem.players.get(key);
      if (p) this.mem.players.set(key, { ...p, ...patch });
    }
  }

  async unregister(id: string, wallet: string): Promise<void> {
    if (this.pool) {
      await this.pool.query("delete from tournament_players where tournament_id=$1 and wallet=$2", [id, wallet]);
    } else {
      this.mem.players.delete(`${id}:${wallet}`);
    }
  }

  async isRegistered(id: string, wallet: string): Promise<TournamentPlayer | null> {
    if (this.pool) {
      const r = await this.pool.query("select * from tournament_players where tournament_id=$1 and wallet=$2", [id, wallet]);
      return r.rows[0] ? rowToPlayer(r.rows[0]) : null;
    }
    return this.mem.players.get(`${id}:${wallet}`) ?? null;
  }

  // --- announcements (single active push shown in-game) --------------------
  async setAnnouncement(a: Omit<Announcement, "id" | "createdAt">, now: number): Promise<Announcement> {
    const ann: Announcement = { ...a, id: rid(), createdAt: now };
    if (this.pool) {
      await this.pool.query("delete from announcements"); // single active at a time
      await this.pool.query(
        `insert into announcements (id,text,tournament_id,cta,until,created_at) values ($1,$2,$3,$4,$5,$6)`,
        [ann.id, ann.text, ann.tournamentId, ann.cta, ann.until, ann.createdAt],
      );
    } else {
      this.mem.announcement = ann;
    }
    return ann;
  }

  async clearAnnouncement(): Promise<void> {
    if (this.pool) await this.pool.query("delete from announcements");
    else this.mem.announcement = null;
  }

  async getAnnouncement(now: number): Promise<Announcement | null> {
    let a: Announcement | null;
    if (this.pool) {
      const r = await this.pool.query("select * from announcements order by created_at desc limit 1");
      const row = r.rows[0];
      a = row ? { id: String(row.id), text: String(row.text), tournamentId: String(row.tournament_id ?? ""), cta: String(row.cta ?? ""), until: Number(row.until ?? 0), createdAt: Number(row.created_at ?? 0) } : null;
    } else {
      a = this.mem.announcement;
    }
    if (a && a.until > 0 && now > a.until) { await this.clearAnnouncement(); return null; }
    return a;
  }
}

function rowToPlayer(r: Record<string, unknown>): TournamentPlayer {
  return {
    tournamentId: String(r.tournament_id),
    wallet: String(r.wallet),
    name: String(r.name ?? ""),
    status: (r.status as TPlayerStatus) ?? "registered",
    points: Number(r.points ?? 0),
    placement: Number(r.placement ?? 0),
    prizePaid: Number(r.prize_paid ?? 0),
    joinedAt: Number(r.joined_at ?? 0),
  };
}

function safeArr<T>(v: unknown, fallback: T[]): T[] {
  try {
    if (typeof v === "string") return JSON.parse(v) as T[];
    if (Array.isArray(v)) return v as T[];
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Normalize + clamp an admin-supplied tournament config (flexible but safe). */
export function sanitizeConfig(input: Partial<TournamentConfig>): TournamentConfig {
  const c = { ...DEFAULTS, name: "Tournament", ...input } as TournamentConfig;
  c.name = String(c.name || "Tournament").slice(0, 60);
  c.format = c.format === "bracket" ? "bracket" : "points";
  c.description = String(c.description || "").slice(0, 600);
  c.prizeUsd = Math.max(0, Number(c.prizeUsd) || 0);
  c.entryType = c.entryType === "buyin" ? "buyin" : "free";
  c.entryAmount = c.entryType === "buyin" ? Math.max(0, Math.round(Number(c.entryAmount) || 0)) : 0;
  c.currency = Number(c.currency) === 1 ? 1 : 0;
  c.maxPlayers = Math.max(4, Math.min(4096, Math.round(Number(c.maxPlayers) || 64)));
  c.podSize = Math.max(2, Math.min(4, Math.round(Number(c.podSize) || 4)));
  c.podsAdvance = Math.max(1, Math.min(c.podSize - 1, Math.round(Number(c.podsAdvance) || 1)));
  c.pointsTable = Array.isArray(c.pointsTable) && c.pointsTable.length ? c.pointsTable.map((n) => Math.max(0, Math.round(Number(n) || 0))).slice(0, 8) : [10, 6, 3, 1];
  c.matchesPerPlayer = Math.max(0, Math.min(50, Math.round(Number(c.matchesPerPlayer) || 5)));
  c.startAt = Math.max(0, Math.round(Number(c.startAt) || 0));
  c.regOpen = c.regOpen !== false;
  return c;
}

export const tournaments = new TournamentStore();
