// External identity links (Telegram / email / Twitter) attached to a wallet, so
// we can DM tournament reminders and offer Web2 login. Self-contained store
// (own Postgres pool when DATABASE_URL is set, else in-memory) — same pattern as
// tournament.ts, to avoid fanning a new table across the 3 ProfileStore backends.

import pg from "pg";

export interface Identity {
  wallet: string;
  telegramId: number; // Telegram chat id for proactive DMs (0 = not linked)
  email: string;
  twitter: string;
}

class IdentityStore {
  private pool: pg.Pool | null = null;
  private ready: Promise<void> = Promise.resolve();
  private mem = new Map<string, Identity>();

  constructor() {
    const url = process.env.DATABASE_URL;
    if (url) {
      this.pool = new pg.Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        max: Number(process.env.PG_IDENTITY_POOL_MAX ?? 3),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
      this.pool.on("error", (e) => console.error("[identity] pg pool error", e));
      this.ready = this.migrate();
    }
  }

  private async migrate(): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        create table if not exists identities (
          wallet text primary key,
          telegram_id bigint not null default 0,
          email text not null default '',
          twitter text not null default ''
        )`);
      await this.pool.query(`create index if not exists identities_tg on identities (telegram_id) where telegram_id <> 0`);
      await this.pool.query(`create index if not exists identities_email on identities (lower(email)) where email <> ''`);
    } catch (e) {
      console.error("[identity] migrate failed", e);
    }
  }

  async get(wallet: string): Promise<Identity | null> {
    if (this.pool) {
      await this.ready;
      const r = await this.pool.query("select * from identities where wallet=$1", [wallet]);
      const row = r.rows[0];
      return row ? { wallet, telegramId: Number(row.telegram_id ?? 0), email: String(row.email ?? ""), twitter: String(row.twitter ?? "") } : null;
    }
    return this.mem.get(wallet) ?? null;
  }

  async link(wallet: string, patch: Partial<Omit<Identity, "wallet">>): Promise<Identity> {
    const cur = (await this.get(wallet)) ?? { wallet, telegramId: 0, email: "", twitter: "" };
    const next: Identity = { ...cur, ...patch, wallet };
    if (this.pool) {
      await this.pool.query(
        `insert into identities (wallet,telegram_id,email,twitter) values ($1,$2,$3,$4)
         on conflict (wallet) do update set telegram_id=$2, email=$3, twitter=$4`,
        [wallet, next.telegramId, next.email, next.twitter],
      );
    } else {
      this.mem.set(wallet, next);
    }
    return next;
  }

  async byTelegram(telegramId: number): Promise<string | null> {
    if (!telegramId) return null;
    if (this.pool) {
      const r = await this.pool.query("select wallet from identities where telegram_id=$1 limit 1", [telegramId]);
      return r.rows[0]?.wallet ?? null;
    }
    for (const [w, i] of this.mem) if (i.telegramId === telegramId) return w;
    return null;
  }

  async byEmail(email: string): Promise<string | null> {
    const e = email.trim().toLowerCase();
    if (!e) return null;
    if (this.pool) {
      const r = await this.pool.query("select wallet from identities where lower(email)=$1 limit 1", [e]);
      return r.rows[0]?.wallet ?? null;
    }
    for (const [w, i] of this.mem) if (i.email.toLowerCase() === e) return w;
    return null;
  }
}

export const identity = new IdentityStore();

// --- short-lived link codes (Telegram deep-link + OAuth state → wallet) ------
// Maps an opaque code to the wallet that initiated the link, so the bot /start
// or the OAuth callback can attach the external account to the right profile.
const linkCodes = new Map<string, { wallet: string; at: number }>();
const LINK_TTL_MS = 10 * 60_000;

export function makeLinkCode(wallet: string): string {
  const code = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  linkCodes.set(code, { wallet, at: Date.now() });
  return code;
}
export function takeLinkCode(code: string): string | null {
  const e = linkCodes.get(code);
  if (!e) return null;
  linkCodes.delete(code);
  if (Date.now() - e.at > LINK_TTL_MS) return null;
  return e.wallet;
}
/** Peek (don't consume) — OAuth state is read in the callback once. */
export function peekLinkCode(code: string): string | null {
  const e = linkCodes.get(code);
  if (!e || Date.now() - e.at > LINK_TTL_MS) return null;
  return e.wallet;
}
setInterval(() => {
  const cutoff = Date.now() - LINK_TTL_MS;
  for (const [c, e] of linkCodes) if (e.at < cutoff) linkCodes.delete(c);
}, 60_000).unref?.();
