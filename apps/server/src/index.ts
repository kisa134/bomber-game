import { readFileSync, existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import uWS from "uWebSockets.js";
import { ClientMsg, decodeClient, encodePong, encodeReconnectToken, STARTING_CHIPS, STARTING_RATING, BET_SIZES, TOKEN_BET_SIZES, Currency, BotDifficulty, TOKEN_MINT, TOKEN_TICKER, MIN_WITHDRAW, MAX_WITHDRAW, DEFAULT_SKINS, SKIN_PRICES, SKIN_UNLOCK_LEVEL, SKIN_TOKEN_PRICES, SKIN_COUNT, PRACTICE_MAX_BOTS, clampSandbox, SPIN_COST_CHIPS, SKIN_FALLBACK_CHIPS, WHEEL_PRIZES, rollWheel, RAKE_SPLIT_BPS, TOTAL_SUPPLY, GAME_BUYBACK_TOKENS, INITIAL_ALLOCATION_PCT, HOUSE_RAKE_BP_DEFAULT, type SandboxOpts } from "@bomberpump/shared";
import { Matchmaker, ServerFullError } from "./matchmaker.js";
import { createNonce, verifySignature, createSession, verifySession, AUTH_SECRET_SET } from "./auth.js";
import { newRelayState, putRelayPayload, takeRelayPayload, reopenHtml } from "./tgrelay.js";
import { handleTgUpdate, tgWebhookSecretOk, setupTelegramBot } from "./tgbot.js";
import { analytics } from "./analytics.js";
import { REFERRAL_LEVEL_BPS } from "./referral.js";
import { logEvent, recentEvents, shortWallet } from "./events.js";
import { alert, alertCount, recentAlerts } from "./alert.js";
import { aiAnalyze, aiInfo } from "./ai.js";
import { rakeAccrued, treasuryWallets, markBurned } from "./treasury.js";
import { burnFromTreasury } from "./token.js";
import { initSentry, captureError } from "./sentry.js";
import { metrics } from "./metrics.js";
import { adminPageHtml } from "./admin.js";
import { store } from "./store.js";
import { tournaments, sanitizeConfig, seedTournament, reportTournamentMatch, type TStatus } from "./tournament.js";
import { setTournamentMatchEnd } from "./room.js";
import { identity, makeLinkCode, takeLinkCode } from "./identity.js";
import { startReminders } from "./reminders.js";
import { randomBytes, createHash } from "node:crypto";
import {
  tokenBalance,
  withdraw,
  startDepositWatcher,
  rescanDepositsSoon,
  TREASURY_ADDRESS,
  depositsEnabled,
  withdrawalsEnabled,
  toBaseUnits,
  fromBaseUnits,
  claimBySignature,
  buildDepositTx,
  tokenPriceUsd,
  tokenPriceSol,
} from "./token.js";
import type { SendFn } from "./player.js";

const PORT = Number(process.env.PORT ?? 8787);
const PROD = process.env.NODE_ENV === "production";
// Optional: serve the built client from the same origin (single-box deploy).
const CLIENT_DIST = process.env.CLIENT_DIST ?? join(import.meta.dirname, "../../client/dist");
const SERVE_STATIC = existsSync(join(CLIENT_DIST, "index.html"));

// --- launch safety preflight -------------------------------------------------
// In production, refuse to boot with a money-unsafe config (the rest are warnings
// so a chips-only / dev run still works). Fail fast and loud beats silently
// losing real funds. Run dev without NODE_ENV=production to bypass the fatals.
(function preflight(): void {
  const fatal: string[] = [];
  const warn: string[] = [];
  if (store.kind !== "postgres") {
    (PROD ? fatal : warn).push(
      `store backend is "${store.kind}" — set DATABASE_URL (Postgres). InMemory loses ALL balances on restart; Supabase REST is non-atomic for money.`,
    );
  }
  if (!AUTH_SECRET_SET) {
    (PROD ? fatal : warn).push(
      "AUTH_SECRET not set (need >=16 chars) — sessions use an ephemeral key and reset on every restart / can't validate across instances.",
    );
  }
  if (!depositsEnabled || !withdrawalsEnabled)
    warn.push("treasury not fully configured (TREASURY_ADDRESS / TREASURY_SECRET) — deposits/withdrawals are DISABLED.");
  if (!process.env.SOLANA_RPC)
    warn.push("SOLANA_RPC unset — using the public, rate-limited endpoint (inadequate for real custody under load).");
  if (!(Number(process.env.HOUSE_RAKE_BP) > 0))
    warn.push("HOUSE_RAKE_BP is 0 — no house rake, and the referral economy pays nothing.");
  if (!process.env.REFERRAL_ROOT) warn.push("REFERRAL_ROOT unset — organic players attach to nobody.");
  if (!process.env.ADMIN_TOKEN) warn.push("ADMIN_TOKEN unset — /admin dashboard is disabled (launching blind).");
  for (const w of warn) console.warn("[preflight] WARN:", w);
  if (fatal.length) {
    for (const f of fatal) console.error("[preflight] FATAL:", f);
    console.error("[preflight] refusing to start in production with an unsafe money config — set the env vars above.");
    process.exit(1);
  }
})();

// --- crash & shutdown safety -------------------------------------------------
// One bad promise/exception must NOT take down the single instance (that strands
// every live match). Log loudly instead of letting Node exit on unhandled
// rejections; on SIGTERM (every Render deploy) refund in-flight staked pots first.
initSentry();
process.on("unhandledRejection", (reason) => {
  captureError(reason, { kind: "unhandledRejection" });
  alert(`unhandledRejection: ${String(reason)}`, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  captureError(err, { kind: "uncaughtException" });
  alert(`uncaughtException: ${err?.message ?? err}`, "uncaughtException");
});
let shuttingDown = false;
async function gracefulShutdown(sig: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${sig} — refunding active staked pots before exit…`);
  try {
    await mm.shutdown();
  } catch (e) {
    console.error("[shutdown] error", e);
  }
  console.log("[shutdown] done");
  process.exit(0);
}
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

const mm = new Matchmaker();
mm.start();

// Boot reconciliation: refund any stakes left escrowed by a previous run that
// died hard (SIGKILL/host crash) before it could settle. Atomic take per row.
void (async function reconcileOpenStakes(): Promise<void> {
  try {
    const stuck = await store.takeOpenStakes(process.env.REGION_ID ?? "");
    if (!stuck.length) return;
    let refunded = 0;
    for (const s of stuck) {
      const r =
        s.currency === Currency.TOKEN
          ? await store.adjustToken(s.wallet, s.amount)
          : await store.adjustChips(s.wallet, s.amount);
      if (r !== null) refunded++;
    }
    alert(`boot: refunded ${refunded}/${stuck.length} stranded stake(s) from a previous crash`);
  } catch (e) {
    console.error("[reconcile] open-stakes refund failed", e);
  }
})();

interface SocketData {
  token: string;
  reconnect: string;
  roomId: string;
  playerId: number;
  bound: boolean;
  msgTokens: number;
  msgTs: number;
  ip: string;
}

// Per-IP HTTP rate limit (token bucket) for the mutating endpoints.
const HTTP_RATE = 8; // tokens/sec
const HTTP_BURST = 16;
const httpBuckets = new Map<string, { t: number; ts: number }>();

function clientIp(res: uWS.HttpResponse, req: uWS.HttpRequest): string {
  // Trust the RIGHTMOST x-forwarded-for entry: proxies APPEND the connecting IP,
  // so the last hop is set by our trusted proxy (Render) and isn't client-spoofable
  // — taking the first entry lets an attacker forge a fresh IP per request and
  // bypass the rate limiter entirely.
  const xff = req.getHeader("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    return parts[parts.length - 1].trim();
  }
  try {
    return Buffer.from(res.getRemoteAddressAsText()).toString();
  } catch {
    return "?";
  }
}

function httpAllow(ip: string): boolean {
  const now = Date.now();
  const b = httpBuckets.get(ip) ?? { t: HTTP_BURST, ts: now };
  b.t = Math.min(HTTP_BURST, b.t + ((now - b.ts) / 1000) * HTTP_RATE);
  b.ts = now;
  httpBuckets.set(ip, b);
  if (b.t < 1) return false;
  b.t -= 1;
  return true;
}

// Per-connection WebSocket message rate limit. At 60Hz the client sends one
// input per tick (~60/s), so headroom is 2x that plus pings/bombs.
const WS_RATE = 130; // msgs/sec
const WS_BURST = 200;
// Per-IP WebSocket connection cap — stops a single host opening unlimited
// sockets to exhaust room slots / memory. A few tabs are fine; this just kills
// floods. Tunable via WS_MAX_PER_IP.
const WS_MAX_PER_IP = Number(process.env.WS_MAX_PER_IP) || 12;
const wsConnsByIp = new Map<string, number>();
function totalWsConns(): number {
  let n = 0;
  for (const c of wsConnsByIp.values()) n += c;
  return n;
}
/** Rake engine + tokenomics + treasury wallets for the admin control centre. */
function rakeEngineBlock(): Record<string, unknown> {
  const a = rakeAccrued();
  return {
    rakeBp: Number(process.env.HOUSE_RAKE_BP ?? HOUSE_RAKE_BP_DEFAULT) || 0,
    split: RAKE_SPLIT_BPS, // bps of rake per pipe
    accrued: {
      // display units (since restart)
      total: fromBaseUnits(a.total),
      burn: fromBaseUnits(a.burn),
      referral: fromBaseUnits(a.referral),
      devTreasury: fromBaseUnits(a.devTreasury),
      burnSwept: fromBaseUnits(a.burnSwept),
      burnSweepable: fromBaseUnits(a.burnSweepable),
      matches: a.matches,
    },
    supply: { total: TOTAL_SUPPLY, buyback: GAME_BUYBACK_TOKENS, allocation: INITIAL_ALLOCATION_PCT },
    wallets: treasuryWallets(),
  };
}
// Rolling load history for the admin live graph + AI (sampled every 3s).
const loadHist: Array<{ t: number; tick: number; peak: number; rooms: number; online: number }> = [];
setInterval(() => {
  try {
    const l = mm.load;
    loadHist.push({ t: Date.now(), tick: l.tickMs, peak: l.peakMs, rooms: mm.adminStats.rooms, online: onlineCount() });
    if (loadHist.length > 120) loadHist.shift();
  } catch {
    /* ignore */
  }
}, 3000).unref?.();
function loadHistory(): typeof loadHist {
  return loadHist.slice(-120);
}
let lastBenchmark: Record<string, unknown> | null = null;
const benchSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Technical health for the admin control centre (memory, uptime, errors, WS). */
function systemHealth(): Record<string, unknown> {
  const mem = process.memoryUsage();
  return {
    uptimeMs: Math.round(process.uptime() * 1000),
    rssMb: Math.round(mem.rss / 1048576),
    heapUsedMb: Math.round(mem.heapUsed / 1048576),
    errors: alertCount(),
    recentErrors: recentAlerts(8),
    wsConns: totalWsConns(),
    ipsConnected: wsConnsByIp.size,
    node: process.version,
    store: store.kind,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of httpBuckets) if (now - b.ts > 60_000) httpBuckets.delete(ip);
}, 60_000).unref?.();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function writeCors(res: uWS.HttpResponse): void {
  for (const [k, v] of Object.entries(CORS)) res.writeHeader(k, v);
}

// Conservative security headers — safe defaults that don't break the game, the
// PostHog/wallet integrations, or the same-origin admin iframe (CSP is left for
// a dedicated pass since it needs a per-source allowlist).
function writeSecurity(res: uWS.HttpResponse): void {
  res.writeHeader("X-Content-Type-Options", "nosniff");
  res.writeHeader("X-Frame-Options", "SAMEORIGIN");
  res.writeHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.writeHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
}

// Tracks whether the client aborted/closed the request, so we never write to a
// dead uWS response after an `await` (that's a hard native crash, not catchable).
type ResWithAbort = uWS.HttpResponse & { aborted?: boolean };

// Hard cap on request body size. Our largest JSON payload is a few hundred
// bytes; 16 KB is generous. Without this, a single large/slow POST buffers
// unbounded into heap and can OOM the whole process (one instance = all matches).
const MAX_BODY_BYTES = 16 * 1024;

function readBody(res: uWS.HttpResponse): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (v: string): void => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    res.onData((chunk, isLast) => {
      size += chunk.byteLength;
      if (size > MAX_BODY_BYTES) {
        (res as ResWithAbort).aborted = true; // make any later sendJson() a no-op
        try {
          res.close();
        } catch {
          /* already gone */
        }
        finish("");
        return;
      }
      chunks.push(Buffer.from(chunk));
      if (isLast) finish(Buffer.concat(chunks).toString());
    });
    res.onAborted(() => {
      (res as ResWithAbort).aborted = true;
      finish("");
    });
  });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function serveStatic(res: uWS.HttpResponse, urlPath: string): void {
  res.onAborted(() => {});
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  // The GAME owns the root (as it always has). The marketing landing is parked
  // at /landing.html until it's launched deliberately; /play also serves the
  // game so any links already pointing there keep working.
  if (rel === "/" || rel === "") rel = "/index.html";
  else if (rel === "/landing" || rel === "/landing/" || rel.startsWith("/landing/")) rel = "/landing.html";
  else if (rel === "/play" || rel === "/play/" || rel.startsWith("/play/")) rel = "/index.html";
  const full = normalize(join(CLIENT_DIST, rel));
  // SPA fallback + path-traversal guard. Unknown routes fall back to the game
  // shell; only explicit /landing paths fall back to the landing.
  const fallback = rel.startsWith("/landing") ? "/landing.html" : "/index.html";
  const safe = full.startsWith(CLIENT_DIST) && existsSync(full) && statSync(full).isFile()
    ? full
    : join(CLIENT_DIST, fallback);
  const dot = safe.lastIndexOf(".");
  const type = MIME[safe.slice(dot)] ?? "application/octet-stream";
  // Vite assets are content-hashed -> cache forever. Everything else
  // (index.html etc.) must NOT be cached, or players run stale JS after a deploy.
  const cacheHeader = safe.includes("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";
  const body = readFileSync(safe);
  res.cork(() => {
    res.writeHeader("Content-Type", type);
    res.writeHeader("Cache-Control", cacheHeader);
    writeSecurity(res);
    res.end(body);
  });
}

const app = uWS.App();

app.options("/*", (res) => {
  res.cork(() => {
    writeCors(res);
    res.endWithoutBody();
  });
});

app.get("/health", (res) => {
  res.onAborted(() => {});
  store
    .ping()
    .then((db) => {
      // Healthy only if the DB answers AND (in prod) we're on a durable backend.
      const healthy = db && (!PROD || store.kind === "postgres");
      sendJson(
        res,
        { ok: healthy, store: store.kind, db: db ? "ok" : "down", ...mm.stats },
        healthy ? undefined : "503 Service Unavailable",
      );
    })
    .catch(() =>
      sendJson(res, { ok: false, store: store.kind, db: "down", ...mm.stats }, "503 Service Unavailable"),
    );
});

// Prometheus-style metrics for external monitoring (Grafana/Prometheus/etc.).
// Guarded by METRICS_TOKEN if set (?token=…); open otherwise (it's only counts).
const METRICS_TOKEN = (process.env.METRICS_TOKEN ?? "").trim();
app.get("/metrics", (res, req) => {
  res.onAborted(() => {
    (res as ResWithAbort).aborted = true;
  });
  if (METRICS_TOKEN) {
    const token = new URLSearchParams(req.getQuery()).get("token") ?? "";
    if (token !== METRICS_TOKEN) {
      sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
      return;
    }
  }
  const load = mm.load;
  const live = mm.adminStats;
  const g = metrics.snapshot();
  const lines: string[] = [];
  const m = (name: string, help: string, value: number, type = "gauge"): void => {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, `${name} ${value}`);
  };
  // Game-loop health — the single most important scaling signal.
  m("bomber_tick_ms", "EMA of one full simulation tick across all rooms (ms)", load.tickMs);
  m("bomber_tick_peak_ms", "Recent peak tick duration (ms)", load.peakMs);
  m("bomber_tick_budget_ms", "Per-tick budget at 60Hz (ms)", load.budgetMs);
  m("bomber_loop_busy", "1 when the sim thread is saturated and shedding new rooms", load.busy ? 1 : 0);
  // Live state.
  m("bomber_online", "Connected clients (presence)", onlineCount());
  m("bomber_rooms", "Active rooms", live.rooms);
  m("bomber_humans", "Human players in rooms", live.humans);
  m("bomber_bots", "Bot players in rooms", live.bots);
  m("bomber_rooms_playing", "Rooms currently in a live match", live.playing);
  m("bomber_rooms_lobby", "Rooms in lobby/waiting", live.lobby);
  // Daily growth counters (reset at UTC midnight).
  m("bomber_dau", "Unique devices today", g.dau);
  m("bomber_players_today", "Wallets that played a match today", g.players);
  m("bomber_paying_players_today", "Wallets that played a token match today", g.payingPlayers);
  m("bomber_matches_today", "Matches finished today", g.matches, "counter");
  m("bomber_token_matches_today", "Token matches finished today", g.tokenMatches, "counter");
  m("bomber_deposits_today", "Deposits today", g.deposits, "counter");
  m("bomber_deposit_volume_today", "Whole tokens deposited today", g.depositVolume, "counter");
  if ((res as ResWithAbort).aborted) return;
  try {
    res.cork(() => {
      if ((res as ResWithAbort).aborted) return;
      writeCors(res);
      res.writeHeader("Content-Type", "text/plain; version=0.0.4");
      res.end(lines.join("\n") + "\n");
    });
  } catch {
    /* socket gone */
  }
});

// --- multi-region groundwork (inert until REGIONS holds 2+ entries) ----------
// REGION_ID  = this instance's region id (e.g. "eu"). REGIONS = JSON array of
// {id,label,url} for every deployed region. The client probes /ping on each and
// navigates to the nearest, after which all same-origin traffic stays regional.
const REGION_ID = process.env.REGION_ID ?? "";
let REGIONS: Array<{ id: string; label: string; url: string }> = [];
try {
  const parsed = JSON.parse(process.env.REGIONS ?? "[]");
  if (Array.isArray(parsed)) {
    REGIONS = parsed
      .filter((r) => r && r.id && r.url)
      .map((r) => ({ id: String(r.id), label: String(r.label ?? r.id), url: String(r.url).replace(/\/+$/, "") }));
  }
} catch {
  REGIONS = [];
}

// Ultra-light latency probe (no DB, tiny body) used by the client to pick the
// closest region. CORS-open so it can be measured cross-origin before redirect.
app.get("/ping", (res) => {
  res.onAborted(() => {});
  res.cork(() => {
    writeCors(res);
    res.writeHeader("Content-Type", "text/plain");
    res.writeHeader("Cache-Control", "no-store");
    res.end("ok");
  });
});

app.get("/regions", (res) => {
  res.onAborted(() => {});
  sendJson(res, { current: REGION_ID, regions: REGIONS });
});

// --- admin live panel (token-gated) ---
// ADMIN_TOKEN may hold several passwords separated by commas, so multiple people
// (e.g. you + a friend) can each have their own.
const ADMIN_TOKENS = new Set(
  (process.env.ADMIN_TOKEN ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
);
function adminAuthed(req: uWS.HttpRequest): boolean {
  if (ADMIN_TOKENS.size === 0) return false; // disabled until a token is configured
  const q = new URLSearchParams(req.getQuery());
  return ADMIN_TOKENS.has(q.get("token") ?? "");
}

// Lucky Spin tallies (since restart) for the admin cockpit: how many spins, how
// many chips were charged vs paid back, and how many skins dropped.
const spinStats = { spins: 0, cost: 0, paid: 0, skins: 0 };

// Wallet bans (in-memory; cleared on restart). A banned wallet can't get a
// session, so it's locked out of wallet features and staked play.
const bannedWallets = new Set<string>();

// Runtime overrides for the deposit/withdraw gates (toggled live from /admin).
// null = follow the env-configured default.
let depositsOverride: boolean | null = null;
let withdrawalsOverride: boolean | null = null;
const depositsOn = (): boolean => depositsOverride ?? depositsEnabled;
const withdrawalsOn = (): boolean => withdrawalsOverride ?? withdrawalsEnabled;

// Optional: a PostHog *shared/embedded* dashboard URL. Revealed only to authed
// admins (via /admin/stats), so the whole PostHog dashboard shows inside /admin
// — one place for analytics + live ops. Enable sharing on the dashboard in
// PostHog and paste the embed URL here.
const POSTHOG_EMBED_URL = process.env.POSTHOG_EMBED_URL ?? "";

// Quick-jump links to the other analytics tools. Google Analytics & Microsoft
// Clarity cannot be iframed (they block embedding + require login), so /admin
// shows one-click buttons instead. GA_EMBED_URL is optional: a Looker Studio
// report (GA4) CAN be iframed, so set it to embed GA inline too.
const GA_DASHBOARD_URL = process.env.GA_DASHBOARD_URL ?? "https://analytics.google.com/analytics/web/";
const GA_EMBED_URL = process.env.GA_EMBED_URL ?? "";
const CLARITY_DASHBOARD_URL = process.env.CLARITY_DASHBOARD_URL ?? "https://clarity.microsoft.com/projects/view/x8x8jqaz1b/";

// The top of the referral pyramid (the owner's wallet). Anyone who connects a
// wallet WITHOUT a referrer is attached under this root, so you earn from every
// un-invited player. Leave empty to attach un-invited players to nobody.
const REFERRAL_ROOT = (process.env.REFERRAL_ROOT ?? "").trim();

// Daily growth targets shown in the /admin cockpit (a tile lights green when
// met). Tunable via env without a code change; 0 = no target (info only).
const GROWTH_TARGETS = {
  paying: Number(process.env.GROWTH_TARGET_PAYING ?? 10) || 0,
  dau: Number(process.env.GROWTH_TARGET_DAU ?? 30) || 0,
  matches: Number(process.env.GROWTH_TARGET_MATCHES ?? 0) || 0,
  depositors: Number(process.env.GROWTH_TARGET_DEPOSITORS ?? 0) || 0,
};

// Presence: clients heartbeat here while the app is open (menu, lobby, or match),
// so "online" reflects everyone with the game open — not just players in a live
// room (a WS connection only exists once a match is joined).
const PRESENCE_TTL_MS = 45_000;
const presence = new Map<string, number>();
function onlineCount(): number {
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  let n = 0;
  for (const [id, ts] of presence) {
    if (ts < cutoff) presence.delete(id);
    else n++;
  }
  return n;
}
app.get("/presence", (res, req) => {
  res.onAborted(() => {});
  const id = (new URLSearchParams(req.getQuery()).get("id") ?? "").slice(0, 64);
  // Hard cap so spamming unique ids can't grow the map unbounded between sweeps.
  if (id && (presence.has(id) || presence.size < 50_000)) {
    presence.set(id, Date.now());
    metrics.presence(id);
  }
  res.cork(() => {
    res.writeHeader("Access-Control-Allow-Origin", "*");
    res.writeStatus("204 No Content").end();
  });
});

// Public live online count (read-only) — shown on the hub info panel.
app.get("/online", (res, req) => {
  res.onAborted(() => {});
  void req;
  sendJson(res, { online: onlineCount() });
});

// Public landing stats — safe aggregate numbers for the marketing site (no PII).
// Cached ~10s so the landing can poll cheaply. Everything here is REAL; numbers
// the backend doesn't track yet are simply omitted (the landing shows "Soon").
let statsCache: { at: number; body: Record<string, unknown> } | null = null;
app.get("/stats", (res, req) => {
  res.onAborted(() => {
    (res as ResWithAbort).aborted = true;
  });
  void req;
  const now = Date.now();
  if (statsCache && now - statsCache.at < 10_000) return sendJson(res, statsCache.body);
  void Promise.all([store.leaderboard(8, "rating"), store.leaderboard(8, "tokens"), store.economyStats(), tokenPriceUsd()])
    .then(([topRating, topTokens, econ, priceUsd]) => {
      const a = analytics.snapshot();
      const tokens = fromBaseUnits(econ.tokenBase); // custodial tokens in play
      const body = {
        online: onlineCount(),
        players: econ.players, // total registered wallets
        matches: a.matches, // matches completed since this server booted
        tokensInPlay: tokens, // custodial token balances held by the treasury
        tokensInPlayUsd: priceUsd ? tokens * priceUsd : 0,
        depositVolume: a.depositVolume, // tokens deposited since boot
        prizePaid: a.withdrawVolume, // tokens withdrawn (paid out) since boot
        topMmr: topRating[0]?.rating ?? 0,
        ticker: TOKEN_TICKER,
        mint: TOKEN_MINT,
        priceUsd: priceUsd || 0,
        uptimeMs: a.uptimeMs,
        // Public leaderboard preview (name + key stat only — no wallets).
        top: topRating.map((p) => ({ name: p.name, rating: p.rating, wins: p.wins, matches: p.matches })),
        champions: topTokens
          .filter((p) => (p.tokens_won ?? 0) > 0)
          .map((p) => ({ name: p.name, won: fromBaseUnits(p.tokens_won ?? 0) })),
      };
      statsCache = { at: now, body };
      sendJson(res, body);
    })
    .catch(() => sendJson(res, { online: onlineCount(), ticker: TOKEN_TICKER, mint: TOKEN_MINT }));
});

// Live JSON metrics for the dashboard. Polled by /admin.
app.get("/admin/stats", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  void Promise.all([store.leaderboard(10, "rating"), store.referralOverview(15, REFERRAL_ROOT), store.economyStats()])
    .then(([top, ref, econ]) => {
      sendJson(res, {
        online: onlineCount(),
        economy: { players: econ.players, chips: econ.chips, tokens: fromBaseUnits(econ.tokenBase) },
        spins: { ...spinStats, net: spinStats.cost - spinStats.paid },
        bans: bannedWallets.size,
        growth: metrics.snapshot(),
        growthTargets: GROWTH_TARGETS,
        events: recentEvents(30),
        config: {
          rakePct: (Number(process.env.HOUSE_RAKE_BP ?? 0) || 0) / 100,
          referralRoot: REFERRAL_ROOT ? shortWallet(REFERRAL_ROOT) : "",
          deposits: depositsOn(),
          withdrawals: withdrawalsOn(),
        },
        live: mm.adminStats,
        load: mm.load,
        totals: analytics.snapshot(),
        store: store.kind,
        system: systemHealth(),
        rakeEngine: rakeEngineBlock(),
        loadHistory: loadHistory(),
        benchmark: lastBenchmark,
        ai: aiInfo(),
        embedUrl: POSTHOG_EMBED_URL,
        gaUrl: GA_DASHBOARD_URL,
        gaEmbedUrl: GA_EMBED_URL,
        clarityUrl: CLARITY_DASHBOARD_URL,
        top: top.map((p) => ({
          name: p.name,
          wallet: p.wallet,
          rating: p.rating,
          matches: p.matches,
          wins: p.wins,
          chips: p.chips,
        })),
        social: { onlineWallets: onlineWalletCount() },
        referrals: {
          root: REFERRAL_ROOT,
          networkSize: ref.networkSize,
          totalEarned: fromBaseUnits(ref.totalEarned),
          unattached: ref.unattached,
          rootLevels: ref.rootLevels,
          top: ref.top.map((r) => ({
            name: r.name,
            wallet: r.wallet,
            direct: r.direct,
            earned: fromBaseUnits(r.earned),
          })),
        },
        now: Date.now(),
      });
    })
    .catch(() => sendJson(res, { error: "stats_failed" }, "500 Internal Server Error"));
});

// AI analyst — unified snapshot (business + game + technical) → LLM brief.
// One unified snapshot of EVERY data flow we have — fed to the in-house AI
// analyst AND exposed at /admin/snapshot as the integration point for the
// owner's future external AI (with memory). Read-only.
async function buildAdminSnapshot(): Promise<Record<string, unknown>> {
  const ledger = store as unknown as {
    recentDeposits?: (n: number) => Promise<Array<{ wallet: string; amount: number; at: string }>>;
    recentWithdrawals?: (n: number) => Promise<Array<{ wallet: string; amount: number; at: string }>>;
  };
  const [top, ref, econ, tlist, dep, wd] = await Promise.all([
    store.leaderboard(5, "rating"),
    store.referralOverview(10, REFERRAL_ROOT),
    store.economyStats(),
    tournaments.list().catch(() => []),
    ledger.recentDeposits?.(10) ?? Promise.resolve([]),
    ledger.recentWithdrawals?.(10) ?? Promise.resolve([]),
  ]);
  const sum = (a: Array<{ amount: number }>): number => a.reduce((s, x) => s + fromBaseUnits(x.amount), 0);
  return {
    now: new Date().toISOString(),
    online: onlineCount(),
    growth: metrics.snapshot(),
    growthTargets: GROWTH_TARGETS,
    economy: { players: econ.players, chips: econ.chips, tokens: fromBaseUnits(econ.tokenBase) },
    money: {
      depositCount: dep.length,
      withdrawalCount: wd.length,
      recentDepositVol: sum(dep),
      recentWithdrawalVol: sum(wd),
      recentDeposits: dep.slice(0, 5).map((d) => ({ wallet: d.wallet, amount: fromBaseUnits(d.amount), at: d.at })),
      recentWithdrawals: wd.slice(0, 5).map((d) => ({ wallet: d.wallet, amount: fromBaseUnits(d.amount), at: d.at })),
    },
    tournaments: tlist.map((t) => ({ id: t.id, name: t.name, status: t.status, format: t.format, registered: t.registered, prizeUsd: t.prizeUsd })),
    spins: { ...spinStats, net: spinStats.cost - spinStats.paid },
    totals: analytics.snapshot(),
    live: mm.adminStats,
    load: mm.load,
    system: systemHealth(),
    rakeEngine: rakeEngineBlock(),
    loadHistory: loadHistory().slice(-20),
    benchmark: lastBenchmark,
    config: {
      rakePct: (Number(process.env.HOUSE_RAKE_BP ?? 0) || 0) / 100,
      referralRoot: !!REFERRAL_ROOT,
      deposits: depositsOn(),
      withdrawals: withdrawalsOn(),
    },
    topPlayers: top.map((p) => ({ name: p.name, rating: p.rating, matches: p.matches, wins: p.wins })),
    social: { onlineWallets: onlineWalletCount() },
    referrals: { networkSize: ref.networkSize, totalEarned: fromBaseUnits(ref.totalEarned), unattached: ref.unattached },
    events: recentEvents(20),
    errors: recentAlerts(8),
  };
}

// Full machine-readable snapshot (for the owner's external AI / dashboards).
app.get("/admin/snapshot", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  void buildAdminSnapshot().then((s) => sendJson(res, s)).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

app.post("/admin/ai-analyze", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  void (async () => {
    try {
      sendJson(res, await aiAnalyze(await buildAdminSnapshot()));
    } catch (e) {
      sendJson(res, { ok: false, reason: `snapshot failed: ${String(e)}` }, "500 Internal Server Error");
    }
  })();
});

// In-server load benchmark — spawn N self-running bot rooms, sample the tick
// load, then tear them down. Loads the LIVE server (run off-peak). Hard-capped.
app.post("/admin/loadtest", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const n = Math.max(1, Math.min(Number(new URLSearchParams(req.getQuery()).get("n")) || 30, 80));
  void (async () => {
    try {
      const baseline = mm.adminStats.rooms;
      const codes = mm.spawnBenchmark(n);
      const samples: Array<{ t: number; tick: number; rooms: number }> = [];
      let peak = 0;
      for (let i = 0; i < 16; i++) {
        await benchSleep(500);
        const l = mm.load;
        peak = Math.max(peak, l.tickMs);
        samples.push({ t: Date.now(), tick: l.tickMs, rooms: mm.adminStats.rooms });
      }
      mm.closeBenchmark(codes);
      lastBenchmark = {
        at: Date.now(),
        requested: n,
        spawned: codes.length,
        baselineRooms: baseline,
        peakTickMs: Math.round(peak * 10) / 10,
        budgetMs: 16.7,
        busy: peak > 11.6,
        samples,
      };
      sendJson(res, { ok: true, ...lastBenchmark });
    } catch (e) {
      sendJson(res, { ok: false, reason: String(e) }, "500 Internal Server Error");
    }
  })();
});

// Manual burn sweep — burns the accrued-but-not-yet-burned rake (Burn pipe) from
// the treasury on-chain. Manual on purpose (full control, no auto-moving funds).
app.post("/admin/burn-sweep", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  void (async () => {
    try {
      const amountBase = rakeAccrued().burnSweepable; // base units
      if (!(amountBase > 0)) return sendJson(res, { ok: false, reason: "nothing to burn yet" });
      const sig = await burnFromTreasury(amountBase);
      markBurned(amountBase);
      sendJson(res, { ok: true, burned: fromBaseUnits(amountBase), sig });
    } catch (e) {
      sendJson(res, { ok: false, reason: String(e) }, "500 Internal Server Error");
    }
  })();
});

// Money control: live on-chain balances of system wallets + recent deposits +
// tournament prize ledger. Fetched on a slower cadence than /admin/stats (RPC).
app.get("/admin/treasury", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  void (async () => {
    const wallets = treasuryWallets();
    const balances: Record<string, { address: string; token: number }> = {};
    await Promise.all(
      Object.entries(wallets).map(async ([k, addr]) => {
        balances[k] = { address: addr, token: addr ? await tokenBalance(addr).catch(() => 0) : 0 };
      }),
    );
    const ledger = store as unknown as {
      recentDeposits?: (n: number) => Promise<Array<{ signature: string; wallet: string; amount: number; at: string }>>;
      recentWithdrawals?: (n: number) => Promise<Array<{ signature: string; wallet: string; amount: number; at: string }>>;
    };
    const raw = await (ledger.recentDeposits?.(25) ?? Promise.resolve([]));
    const deposits = raw.map((d) => ({ ...d, amount: fromBaseUnits(d.amount) }));
    const rawW = await (ledger.recentWithdrawals?.(25) ?? Promise.resolve([]));
    const withdrawals = rawW.map((d) => ({ ...d, amount: fromBaseUnits(d.amount) }));
    let prizeCommitted = 0;
    let prizePaid = 0;
    try {
      const ts = await tournaments.list();
      for (const t of ts) if (t.status !== "cancelled") prizeCommitted += t.prizeUsd;
      for (const t of ts.filter((x) => x.status === "done")) {
        const ps = await tournaments.players(t.id);
        for (const p of ps) prizePaid += p.prizePaid;
      }
    } catch {
      /* ignore */
    }
    sendJson(res, { balances, deposits, withdrawals, tournaments: { prizeCommitted, prizePaid } });
  })().catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// Bulk grant: credit a list of wallets with tokens/chips (tournament prizes,
// task airdrops). Admin-gated, custodial balance only. Reports per-wallet result.
app.post("/admin/bulk-grant", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  void readBody(res).then(async (body) => {
    let wallets: string[] = [];
    let amount = 0;
    let currency = 0;
    try {
      const j = JSON.parse(body || "{}");
      if (Array.isArray(j.wallets)) wallets = j.wallets.map((w: unknown) => String(w).trim()).filter(Boolean).slice(0, 1000);
      amount = Math.round(Number(j.amount) || 0);
      currency = Number(j.currency) === 1 ? 1 : 0;
    } catch {
      /* ignore */
    }
    if (!wallets.length || amount === 0) return sendJson(res, { error: "bad_request" }, "400 Bad Request");
    let ok = 0;
    for (const w of wallets) {
      const delta = currency === 1 ? toBaseUnits(amount) : amount;
      const r = currency === 1 ? await store.adjustToken(w, delta) : await store.adjustChips(w, delta);
      if (r !== null) ok++;
    }
    logEvent("🎁", `bulk grant ${currency === 1 ? "💎" : "🪙"}${amount} × ${ok}/${wallets.length} wallets`);
    sendJson(res, { ok: true, granted: ok, total: wallets.length });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// CSV export of the money ledgers (deposits / withdrawals) for off-line books.
app.get("/admin/export", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const kind = new URLSearchParams(req.getQuery()).get("kind") === "withdrawals" ? "withdrawals" : "deposits";
  const ledger = store as unknown as {
    recentDeposits?: (n: number) => Promise<Array<{ signature: string; wallet: string; amount: number; at: string }>>;
    recentWithdrawals?: (n: number) => Promise<Array<{ signature: string; wallet: string; amount: number; at: string }>>;
  };
  void ((kind === "withdrawals" ? ledger.recentWithdrawals?.(2000) : ledger.recentDeposits?.(2000)) ?? Promise.resolve([])).then((rows) => {
    const header = "at,wallet,amount,signature\n";
    const body = rows.map((r) => `${r.at},${r.wallet},${fromBaseUnits(r.amount)},${r.signature}`).join("\n");
    res.cork(() => {
      res.writeStatus("200 OK");
      res.writeHeader("Content-Type", "text/csv; charset=utf-8");
      res.writeHeader("Content-Disposition", `attachment; filename="${kind}.csv"`);
      res.end(header + body);
    });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// The dashboard page itself (HTML asks for the token, then polls /admin/stats).
app.get("/admin", (res) => {
  res.onAborted(() => {});
  res.cork(() => {
    res.writeHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHeader("Cache-Control", "no-cache");
    res.end(adminPageHtml());
  });
});

// Admin/dev wallets — every skin unlocked + effectively infinite balance, server-side.
const ADMIN_WALLETS = new Set(["2R2bPfdExGKXmmKA4gKhtfn2SQzM5kZo1y7sgv74HUrS"]);

app.get("/profile", (res, req) => {
  res.onAborted(() => {});
  const qs = new URLSearchParams(req.getQuery());
  const wallet = qs.get("wallet") ?? "";
  const session = qs.get("session") ?? "";
  // Balances (real-money custodial + on-chain) are private: only returned when a
  // valid session proves the requester owns this wallet. Public stats otherwise.
  const isOwner = !!session && verifySession(session) === wallet && !!wallet;
  const blank = { wallet, level: 1, xp: 0, matches: 0, wins: 0, frags: 0, deaths: 0, best_streak: 0, name: "", skin: 0, skins: DEFAULT_SKINS, current_streak: 0, chips: STARTING_CHIPS, rating: STARTING_RATING, week_key: "", week_points: 0, token_balance: 0, playtime_sec: 0, daily_day: 0, daily_streak: 0 };
  Promise.all([store.getProfile(wallet), isOwner ? tokenBalance(wallet) : Promise.resolve(0)])
    .then(([p, tok]) => {
      const prof = p ?? blank;
      if (ADMIN_WALLETS.has(wallet)) {
        prof.skins = 0x7fffffff;                          // every skin unlocked
        prof.chips = Math.max(prof.chips ?? 0, 999_999_999); // effectively infinite chips
        prof.level = Math.max(prof.level ?? 1, 99);
      }
      if (isOwner) {
        sendJson(res, { ...prof, walletTokens: tok, gameTokens: fromBaseUnits(prof.token_balance) });
      } else {
        // Strip every balance/financial field for non-owners.
        const { chips: _c, token_balance: _t, referral_earned: _r, ...pub } = prof as typeof prof & {
          referral_earned?: number;
        };
        sendJson(res, pub);
      }
    })
    .catch(() => sendJson(res, { error: "profile_failed" }, "500 Internal Server Error"));
});

// The leaderboard is the hottest public read. Cache each board briefly so a
// traffic spike hits the DB at most ~once per board per TTL, not per request.
const LB_TTL_MS = 8000;
type LbBoard = "rating" | "tokens" | "chips";
const lbCache = new Map<LbBoard, { at: number; rows: unknown[] }>();
function cachedLeaderboard(board: LbBoard): Promise<unknown[]> {
  const now = Date.now();
  const hit = lbCache.get(board);
  if (hit && now - hit.at < LB_TTL_MS) return Promise.resolve(hit.rows);
  return store
    .leaderboard(100, board)
    .then((rows) => {
      lbCache.set(board, { at: now, rows });
      return rows as unknown[];
    })
    .catch(() => hit?.rows ?? []); // serve stale on a DB blip if we have any
}

// Profile PnL history (per-match money swings) for the profit chart. Public by wallet,
// like /profile — only winnings-type data, no balances.
app.get("/pnl", (res, req) => {
  res.onAborted(() => {});
  const wallet = new URLSearchParams(req.getQuery()).get("wallet") ?? "";
  if (!wallet) return sendJson(res, []);
  store
    .getPnl(wallet)
    .then((rows) => sendJson(res, rows))
    .catch(() => sendJson(res, []));
});

app.get("/leaderboard", (res, req) => {
  res.onAborted(() => {
    (res as ResWithAbort).aborted = true;
  });
  const b = new URLSearchParams(req.getQuery()).get("board");
  const board: LbBoard = b === "tokens" || b === "chips" ? b : "rating";
  cachedLeaderboard(board)
    .then((rows) => sendJson(res, { rows }))
    .catch(() => sendJson(res, { rows: [] }));
});

// Live USD price of the token (for the in-game $ converter).
app.get("/price", (res) => {
  res.onAborted(() => {});
  Promise.all([tokenPriceUsd(), tokenPriceSol()])
    .then(([usd, sol]) => sendJson(res, { usd, sol, ticker: TOKEN_TICKER }))
    .catch(() => sendJson(res, { usd: 0, sol: 0, ticker: TOKEN_TICKER }));
});

// Custodial bank: where to deposit + current balances + capabilities.
app.get("/bank", (res, req) => {
  res.onAborted(() => {});
  const qs = new URLSearchParams(req.getQuery());
  const session = qs.get("session") ?? "";
  // The bank shows YOUR custodial balance — require a session and use its wallet.
  const wallet = session ? verifySession(session) : null;
  if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
  rescanDepositsSoon(); // opening the Bank nudges a fresh deposit check
  Promise.all([store.getProfile(wallet), tokenBalance(wallet)])
    .then(([p, tok]) =>
      sendJson(res, {
        treasury: TREASURY_ADDRESS,
        ticker: TOKEN_TICKER,
        mint: TOKEN_MINT,
        depositsEnabled: depositsOn(),
        withdrawalsEnabled: withdrawalsOn(),
        minWithdraw: MIN_WITHDRAW,
        maxWithdraw: MAX_WITHDRAW,
        gameTokens: fromBaseUnits(p?.token_balance ?? 0),
        walletTokens: tok,
      }),
    )
    .catch(() => sendJson(res, { error: "bank_failed" }, "500 Internal Server Error"));
});

// Build an unsigned deposit transaction for the player's wallet to sign & send.
app.post("/deposit/prepare", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    let wallet: string | null = null;
    let amount = 0;
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
      if (Number.isFinite(j.amount)) amount = Math.floor(j.amount);
    } catch {
      // ignore
    }
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    if (!depositsOn()) return sendJson(res, { error: "deposits_disabled" }, "503 Service Unavailable");
    if (amount <= 0) return sendJson(res, { error: "bad_amount" }, "400 Bad Request");
    try {
      const tx = await buildDepositTx(wallet, toBaseUnits(amount));
      sendJson(res, { tx });
    } catch (e) {
      sendJson(res, { error: (e as Error).message }, "500 Internal Server Error");
    }
  });
});

// Claim a deposit by its transaction signature (self-serve, when the watcher
// hasn't picked it up). Credits the SENDER wallet of that transfer.
app.post("/deposit/claim", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    let sig = "";
    let wallet: string | null = null;
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.signature === "string") sig = j.signature.trim();
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
    } catch {
      // ignore
    }
    // Require a session: only credit a deposit the authenticated wallet sent
    // (stops anonymous RPC-cost abuse and crediting arbitrary wallets).
    if (!wallet) return sendJson(res, { ok: false, reason: "wallet_required" }, "401 Unauthorized");
    if (sig.length < 32 || sig.length > 100) {
      return sendJson(res, { ok: false, reason: "bad_signature" }, "400 Bad Request");
    }
    const r = await claimBySignature(sig, wallet);
    sendJson(res, r);
  }).catch(() => sendJson(res, { ok: false, reason: "server_error" }, "500 Internal Server Error"));
});

// Cash out: sign tokens out of the treasury to the player's wallet.
app.post("/withdraw", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    let wallet: string | null = null;
    let amount = 0;
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
      if (Number.isFinite(j.amount)) amount = Math.floor(j.amount);
    } catch {
      // ignore
    }
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    if (!withdrawalsOn()) return sendJson(res, { error: "withdrawals_disabled" }, "503 Service Unavailable");
    if (amount < MIN_WITHDRAW || amount > MAX_WITHDRAW) {
      return sendJson(res, { error: "bad_amount", min: MIN_WITHDRAW, max: MAX_WITHDRAW }, "400 Bad Request");
    }
    try {
      const signature = await withdraw(wallet, toBaseUnits(amount));
      // Append to the audit ledger (best-effort; Postgres only).
      void (store as unknown as { recordWithdrawal?: (s: string, w: string, a: number) => Promise<void> }).recordWithdrawal?.(signature, wallet, toBaseUnits(amount));
      const p = await store.getProfile(wallet);
      sendJson(res, { signature, gameTokens: fromBaseUnits(p?.token_balance ?? 0) });
    } catch (e) {
      const msg = (e as Error).message;
      const code =
        msg === "insufficient_balance"
          ? "402 Payment Required"
          : msg === "withdraw_in_progress"
            ? "429 Too Many Requests"
            : msg === "withdraw_pending"
              ? "409 Conflict" // sent but unconfirmed — do NOT auto-retry; check wallet
              : "500 Internal Server Error";
      sendJson(res, { error: msg }, code);
    }
  });
});

// --- skin shop (chips) ---
function parseSkinReq(body: string): { wallet: string | null; skin: number } {
  let wallet: string | null = null;
  let skin = -1;
  try {
    const j = JSON.parse(body || "{}");
    if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
    if (Number.isInteger(j.skin)) skin = j.skin;
  } catch {
    // ignore
  }
  return { wallet, skin };
}

app.post("/shop/buy-skin", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    const { wallet, skin } = parseSkinReq(body);
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    if (skin < 0 || skin >= SKIN_COUNT) return sendJson(res, { error: "bad_skin" }, "400 Bad Request");
    // Chip purchase requires reaching the skin's unlock level.
    const needLevel = SKIN_UNLOCK_LEVEL[skin] ?? 0;
    if (needLevel > 0) {
      const prof = await store.getProfile(wallet);
      if ((prof?.level ?? 1) < needLevel) {
        return sendJson(res, { error: "level_locked", needLevel }, "403 Forbidden");
      }
    }
    const price = SKIN_PRICES[skin] ?? 0;
    const result = await store.buySkin(wallet, skin, price);
    if (!result) return sendJson(res, { error: "cant_buy" }, "402 Payment Required");
    await store.selectSkin(wallet, skin); // buying also equips it
    sendJson(res, { chips: result.chips, skins: result.skins, skin });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// Buy a skin INSTANTLY with the real token (no level gate). Price in whole tokens.
app.post("/shop/buy-skin-token", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    const { wallet, skin } = parseSkinReq(body);
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    if (skin < 0 || skin >= SKIN_COUNT) return sendJson(res, { error: "bad_skin" }, "400 Bad Request");
    const whole = SKIN_TOKEN_PRICES[skin] ?? 0;
    if (whole <= 0) return sendJson(res, { error: "free_skin" }, "400 Bad Request");
    const result = await store.buySkinToken(wallet, skin, toBaseUnits(whole));
    if (!result) return sendJson(res, { error: "cant_buy" }, "402 Payment Required");
    await store.selectSkin(wallet, skin); // buying also equips it
    sendJson(res, { gameTokens: fromBaseUnits(result.token_balance), skins: result.skins, skin });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

app.post("/shop/select-skin", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    const { wallet, skin } = parseSkinReq(body);
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    if (skin < 0 || skin >= SKIN_COUNT) return sendJson(res, { error: "bad_skin" }, "400 Bad Request");
    const sel = await store.selectSkin(wallet, skin);
    if (sel === null) return sendJson(res, { error: "not_owned" }, "403 Forbidden");
    sendJson(res, { skin: sel });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// Lucky Spin: spend chips, win something every time (server-authoritative roll).
app.post("/wheel/spin", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    const { wallet } = parseSkinReq(body);
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    // Charge the spin atomically; bail if they can't afford it.
    const afterCost = await store.adjustChips(wallet, -SPIN_COST_CHIPS);
    if (afterCost === null) return sendJson(res, { error: "cant_afford" }, "402 Payment Required");
    // Roll on the server (the client can't influence the outcome).
    let prizeId = rollWheel(Math.random());
    let prize = WHEEL_PRIZES[prizeId];
    let wonSkin = -1;
    spinStats.spins++;
    spinStats.cost += SPIN_COST_CHIPS;
    if (prize.kind === "skin") {
      const prof = await store.getProfile(wallet);
      const owned = prof?.skins ?? DEFAULT_SKINS;
      const unowned: number[] = [];
      for (let i = 0; i < SKIN_COUNT; i++) if (!((owned >> i) & 1)) unowned.push(i);
      if (unowned.length) {
        wonSkin = unowned[Math.floor(Math.random() * unowned.length)];
        await store.grantSkin(wallet, wonSkin);
        spinStats.skins++;
      } else {
        // Already owns every skin → pay the fallback chips instead.
        await store.adjustChips(wallet, SKIN_FALLBACK_CHIPS);
        spinStats.paid += SKIN_FALLBACK_CHIPS;
        prizeId = 5;
        prize = WHEEL_PRIZES[5];
      }
    } else {
      await store.adjustChips(wallet, prize.amount);
      spinStats.paid += prize.amount;
    }
    const prof = await store.getProfile(wallet);
    sendJson(res, {
      ok: true,
      prizeId,
      kind: wonSkin >= 0 ? "skin" : "chips",
      amount: prize.amount,
      skin: wonSkin,
      chips: prof?.chips ?? afterCost,
      skins: prof?.skins ?? DEFAULT_SKINS,
    });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// Claim a globally-unique nickname for the signed-in wallet.
app.post("/profile/name", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    let wallet: string | null = null;
    let name = "";
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
      if (typeof j.name === "string") name = j.name.trim().slice(0, 16);
    } catch {
      // ignore
    }
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    if (name.length < 2) return sendJson(res, { error: "too_short" }, "400 Bad Request");
    const ok = await store.setName(wallet, name);
    if (!ok) return sendJson(res, { error: "name_taken" }, "409 Conflict");
    sendJson(res, { ok: true, name });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// --- friends + presence ---
// Lightweight presence: the client polls GET /friends (which marks it online with
// its current room), so we know who's online and where without extra WS infra.
// TTL is generous (90s) vs the client's 15s poll so a single missed beat — e.g.
// a backgrounded browser tab whose setInterval is throttled to ~60s — does NOT
// flicker an online friend to offline.
const PRESENCE_WALLET_TTL_MS = 90_000;
const onlineWallets = new Map<string, { at: number; room: string; status: string }>();
/** How many wallets are currently online (for admin/analytics visibility). */
export function onlineWalletCount(): number {
  const cutoff = Date.now() - PRESENCE_WALLET_TTL_MS;
  let n = 0;
  for (const e of onlineWallets.values()) if (e.at >= cutoff) n++;
  return n;
}
function markOnline(wallet: string, room: string, status: string): void {
  onlineWallets.set(wallet, { at: Date.now(), room: room.slice(0, 8), status: status.slice(0, 8) });
}
function presenceOf(wallet: string): { online: boolean; room: string; status: string } {
  const e = onlineWallets.get(wallet);
  if (!e || Date.now() - e.at > PRESENCE_WALLET_TTL_MS) return { online: false, room: "", status: "" };
  return { online: true, room: e.room, status: e.status };
}
setInterval(() => {
  const now = Date.now();
  for (const [w, e] of onlineWallets) if (now - e.at > PRESENCE_WALLET_TTL_MS) onlineWallets.delete(w);
}, 60_000).unref?.();

// --- room invites ---------------------------------------------------------
// A → friend B: "join my room". Stored per-recipient and surfaced in B's next
// /friends poll (accept = join the code, decline = clear). TTL ~2min.
const INVITE_TTL_MS = 120_000;
const roomInvites = new Map<string, Map<string, { from: string; fromName: string; room: string; at: number }>>();
function addInvite(to: string, from: string, fromName: string, room: string): void {
  let m = roomInvites.get(to);
  if (!m) { m = new Map(); roomInvites.set(to, m); }
  m.set(from, { from, fromName, room, at: Date.now() });
}
function invitesFor(wallet: string): Array<{ from: string; name: string; room: string }> {
  const m = roomInvites.get(wallet);
  if (!m) return [];
  const cutoff = Date.now() - INVITE_TTL_MS;
  const out: Array<{ from: string; name: string; room: string }> = [];
  for (const [from, e] of m) {
    if (e.at < cutoff) { m.delete(from); continue; }
    // Drop invites whose room is gone or no longer joinable.
    const room = mm.getRoom(e.room);
    if (!room || !room.acceptsPlayers()) { m.delete(from); continue; }
    out.push({ from: e.from, name: e.fromName, room: e.room });
  }
  if (m.size === 0) roomInvites.delete(wallet);
  return out;
}
function clearInvite(wallet: string, room: string): void {
  const m = roomInvites.get(wallet);
  if (!m) return;
  for (const [from, e] of m) if (e.room === room) m.delete(from);
  if (m.size === 0) roomInvites.delete(wallet);
}
setInterval(() => {
  const cutoff = Date.now() - INVITE_TTL_MS;
  for (const [w, m] of roomInvites) {
    for (const [from, e] of m) if (e.at < cutoff) m.delete(from);
    if (m.size === 0) roomInvites.delete(w);
  }
}, 60_000).unref?.();

// Friends list + presence beat. Marks the caller online (with their current room)
// and returns their friends/requests enriched with online/room/joinable info.
app.get("/friends", (res, req) => {
  res.onAborted(() => {
    (res as ResWithAbort).aborted = true;
  });
  const q = new URLSearchParams(req.getQuery());
  const wallet = verifySession(q.get("session") ?? "");
  if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
  markOnline(wallet, q.get("room") ?? "", q.get("status") ?? "menu");
  void store
    .listFriends(wallet)
    .then((rows) => {
      const enrich = (r: { wallet: string; name: string; status: string }) => {
        const pr = presenceOf(r.wallet);
        const room = mm.getRoom(pr.room);
        const joinable = pr.online && pr.status === "lobby" && !!room && room.acceptsPlayers();
        return { wallet: r.wallet, name: r.name, status: r.status, online: pr.online, room: joinable ? pr.room : "", activity: pr.online ? pr.status : "" };
      };
      sendJson(res, {
        friends: rows.filter((r) => r.status === "friends").map(enrich),
        incoming: rows.filter((r) => r.status === "in").map((r) => ({ wallet: r.wallet, name: r.name })),
        outgoing: rows.filter((r) => r.status === "out").map((r) => ({ wallet: r.wallet, name: r.name })),
        invites: invitesFor(wallet),
      });
    })
    .catch(() => sendJson(res, { friends: [], incoming: [], outgoing: [], invites: [] }));
});

// Invite a friend (by wallet) into a room. Only between confirmed friends.
app.post("/friends/invite", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    let wallet: string | null = null;
    let friend = "";
    let room = "";
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
      if (typeof j.friend === "string") friend = j.friend.trim();
      if (typeof j.room === "string") room = j.room.trim().toUpperCase().slice(0, 8);
    } catch {
      /* ignore */
    }
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    if (!friend || !room) return sendJson(res, { error: "bad_request" }, "400 Bad Request");
    const r = mm.getRoom(room);
    if (!r || !r.acceptsPlayers()) return sendJson(res, { error: "room_closed" }, "409 Conflict");
    // Must actually be friends (both directions confirmed).
    const friends = await store.listFriends(wallet);
    if (!friends.some((f) => f.wallet === friend && f.status === "friends")) {
      return sendJson(res, { error: "not_friends" }, "403 Forbidden");
    }
    const me = await store.getProfile(wallet);
    addInvite(friend, wallet, me?.name || "A friend", room);
    sendJson(res, { ok: true });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// Dismiss a pending room invite (decline, or after accepting).
app.post("/friends/invite/clear", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    let wallet: string | null = null;
    let room = "";
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
      if (typeof j.room === "string") room = j.room.trim().toUpperCase().slice(0, 8);
    } catch {
      /* ignore */
    }
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    clearInvite(wallet, room);
    sendJson(res, { ok: true });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// Send a friend request by nickname.
app.post("/friends/add", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    let wallet: string | null = null;
    let name = "";
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
      if (typeof j.name === "string") name = j.name.trim().slice(0, 16);
    } catch {
      /* ignore */
    }
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    if (name.length < 2) return sendJson(res, { error: "bad_name" }, "400 Bad Request");
    const friend = await store.walletByName(name);
    if (!friend) return sendJson(res, { error: "not_found" }, "404 Not Found");
    const r = await store.addFriend(wallet, friend);
    if (r === "self") return sendJson(res, { error: "self" }, "400 Bad Request");
    sendJson(res, { ok: true, result: r });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// Accept / remove (decline / unfriend) by wallet.
function friendAction(path: string, fn: (wallet: string, friend: string) => Promise<unknown>): void {
  app.post(path, (res, req) => {
    if (!guard(res, req)) return;
    void readBody(res).then(async (body) => {
      let wallet: string | null = null;
      let friend = "";
      try {
        const j = JSON.parse(body || "{}");
        if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
        if (typeof j.wallet === "string") friend = j.wallet.trim();
      } catch {
        /* ignore */
      }
      if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
      if (!friend) return sendJson(res, { error: "bad_wallet" }, "400 Bad Request");
      await fn(wallet, friend);
      sendJson(res, { ok: true });
    }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
  });
}
friendAction("/friends/accept", (w, f) => store.acceptFriend(w, f));
friendAction("/friends/remove", (w, f) => store.removeFriend(w, f));

// Claim today's daily login reward (session-verified, idempotent per UTC day).
app.post("/daily/claim", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(async (body) => {
    let wallet: string | null = null;
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
    } catch {
      /* ignore */
    }
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    const r = await store.claimDaily(wallet);
    sendJson(res, r);
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// --- tournaments ---------------------------------------------------------
// Public: the Season menu lists visible tournaments + the active announcement.
app.get("/tournaments", (res) => {
  res.onAborted(() => {});
  void tournaments
    .list()
    .then((all) => {
      // Hide drafts/cancelled from players; admins see everything via /admin.
      const visible = all.filter((t) => t.status !== "draft" && t.status !== "cancelled");
      sendJson(res, { tournaments: visible });
    })
    .catch(() => sendJson(res, { tournaments: [] }));
});

app.get("/tournament", (res, req) => {
  res.onAborted(() => {});
  const q = new URLSearchParams(req.getQuery());
  const id = q.get("id") ?? "";
  const wallet = verifySession(q.get("session") ?? "");
  void Promise.all([tournaments.get(id), tournaments.players(id), wallet ? tournaments.isRegistered(id, wallet) : Promise.resolve(null), wallet ? tournaments.liveMatchFor(id, wallet) : Promise.resolve(null)])
    .then(([t, players, mine, liveMatch]) => {
      if (!t) return sendJson(res, { error: "not_found" }, "404 Not Found");
      sendJson(res, { tournament: t, players, you: mine, yourMatch: liveMatch });
    })
    .catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

app.get("/announcement", (res) => {
  res.onAborted(() => {});
  void tournaments.getAnnouncement(Date.now()).then((a) => sendJson(res, { announcement: a })).catch(() => sendJson(res, { announcement: null }));
});

// Player register / check-in / leave (session-verified).
function tourneyPlayerAction(path: string, fn: (id: string, wallet: string, name: string) => Promise<unknown>): void {
  app.post(path, (res, req) => {
    if (!guard(res, req)) return;
    void readBody(res).then(async (body) => {
      let wallet: string | null = null;
      let id = "";
      try {
        const j = JSON.parse(body || "{}");
        if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
        if (typeof j.id === "string") id = j.id;
      } catch {
        /* ignore */
      }
      if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
      if (!id) return sendJson(res, { error: "bad_request" }, "400 Bad Request");
      const prof = await store.getProfile(wallet);
      const r = await fn(id, wallet, prof?.name || shortWallet(wallet));
      sendJson(res, { ok: true, result: r });
    }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
  });
}
tourneyPlayerAction("/tournament/register", (id, wallet, name) => tournaments.register(id, wallet, name, Date.now()));
tourneyPlayerAction("/tournament/checkin", async (id, wallet) => {
  await tournaments.setPlayer(id, wallet, { status: "checked_in" });
  return "ok";
});
tourneyPlayerAction("/tournament/leave", async (id, wallet) => {
  await tournaments.unregister(id, wallet);
  return "ok";
});

// Admin: full control (token-gated, same ADMIN_TOKEN as the rest of /admin).
app.get("/admin/tournaments", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  void tournaments.list().then((all) => sendJson(res, { tournaments: all })).catch(() => sendJson(res, { tournaments: [] }));
});
app.get("/admin/tournament", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const id = new URLSearchParams(req.getQuery()).get("id") ?? "";
  void Promise.all([tournaments.get(id), tournaments.players(id), tournaments.matches(id)])
    .then(([t, players, matches]) => sendJson(res, t ? { tournament: t, players, matches } : { error: "not_found" }, t ? "200 OK" : "404 Not Found"))
    .catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});
function adminTourneyPost(path: string, fn: (body: Record<string, unknown>) => Promise<unknown>): void {
  app.post(path, (res, req) => {
    res.onAborted(() => {});
    if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
    void readBody(res).then(async (body) => {
      let j: Record<string, unknown> = {};
      try { j = JSON.parse(body || "{}"); } catch { /* ignore */ }
      const r = await fn(j);
      sendJson(res, { ok: true, result: r });
    }).catch((e) => sendJson(res, { error: String(e) }, "500 Internal Server Error"));
  });
}
adminTourneyPost("/admin/tournament/create", (j) => tournaments.create(sanitizeConfig(j), "admin", Date.now()));
adminTourneyPost("/admin/tournament/update", (j) => tournaments.update(String(j.id ?? ""), { ...sanitizeConfig(j), status: j.status as TStatus | undefined }));
adminTourneyPost("/admin/tournament/status", (j) => tournaments.update(String(j.id ?? ""), {
  status: j.status as TStatus,
  ...(j.status === "live" ? { startedAt: Date.now() } : {}),
  ...(j.status === "done" ? { endedAt: Date.now(), winners: Array.isArray(j.winners) ? (j.winners as string[]) : undefined } : {}),
}));
adminTourneyPost("/admin/tournament/player", (j) => tournaments.setPlayer(String(j.id ?? ""), String(j.wallet ?? ""), {
  status: j.status as never,
  points: j.points as number | undefined,
  placement: j.placement as number | undefined,
  prizePaid: j.prizePaid as number | undefined,
}));
adminTourneyPost("/admin/tournament/announce", (j) => tournaments.setAnnouncement({
  text: String(j.text ?? "").slice(0, 240),
  tournamentId: String(j.tournamentId ?? ""),
  cta: String(j.cta ?? "").slice(0, 40),
  until: Math.max(0, Number(j.until) || 0),
}, Date.now()));
adminTourneyPost("/admin/tournament/announce/clear", async () => { await tournaments.clearAnnouncement(); return "ok"; });
// Seed the next round: build pods, create pod rooms, mark players active. Returns
// the pods (room codes) so players can be pointed at their match.
adminTourneyPost("/admin/tournament/seed", (j) => seedTournament(String(j.id ?? ""), (tid, fill) => mm.createTournamentRoom(tid, fill), Date.now()));
// Wire pod match-end → tournament scoring/advance.
setTournamentMatchEnd((tid, code, order) => void reportTournamentMatch(tid, code, order, Date.now()));
// Tournament reminder DMs (T-24h / T-1h / starting now) via linked Telegram.
startReminders();

// --- referral ---
// Bind the inviter for a freshly-connected wallet (one-time, session-verified).
// Anti-sybil: cap how many NEW referral attachments one IP can create per day,
// so a single host can't farm a pyramid with throwaway wallets.
const REF_ATTR_MAX_PER_IP_DAY = Number(process.env.REF_ATTR_MAX_PER_IP_DAY) || 10;
const refAttrByIp = new Map<string, { day: number; n: number }>();
function refAttrAllowed(ip: string): boolean {
  const day = Math.floor(Date.now() / 86_400_000);
  const e = refAttrByIp.get(ip);
  return !e || e.day !== day || e.n < REF_ATTR_MAX_PER_IP_DAY;
}
function refAttrRecord(ip: string): void {
  const day = Math.floor(Date.now() / 86_400_000);
  const e = refAttrByIp.get(ip);
  if (!e || e.day !== day) refAttrByIp.set(ip, { day, n: 1 });
  else e.n += 1;
}

app.post("/referral/attribute", (res, req) => {
  if (!guard(res, req)) return;
  const ip = clientIp(res, req); // must read req before any await
  void readBody(res).then(async (body) => {
    let wallet: string | null = null;
    let ref = "";
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
      if (typeof j.ref === "string") ref = j.ref.trim();
    } catch {
      /* ignore */
    }
    if (!wallet) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
    // No explicit inviter → fall back to the root (you), so every un-invited
    // player joins under the top of the pyramid.
    const effectiveRef = ref || REFERRAL_ROOT;
    if (!effectiveRef || effectiveRef === wallet) return sendJson(res, { ok: false });
    if (!refAttrAllowed(ip)) {
      alert(`referral attribution rate-limited for IP ${ip} (sybil guard)`, "ref_sybil");
      return sendJson(res, { ok: false, error: "rate_limited" }, "429 Too Many Requests");
    }
    const set = await store.setReferrer(wallet, effectiveRef);
    if (set) {
      refAttrRecord(ip);
      const underRoot = effectiveRef === REFERRAL_ROOT;
      logEvent("🔗", `${shortWallet(wallet)} joined ${underRoot ? "under root (you)" : "via " + shortWallet(effectiveRef)}`);
    }
    sendJson(res, { ok: set });
  });
});

// Referral dashboard: direct count, lifetime earned (whole tokens), level table.
app.get("/referral/stats", (res, req) => {
  res.onAborted(() => {});
  const wallet = new URLSearchParams(req.getQuery()).get("wallet") ?? "";
  const pct = REFERRAL_LEVEL_BPS.map((b) => b / 100);
  const rakePct = (Number(process.env.HOUSE_RAKE_BP ?? 0) || 0) / 100; // for the earnings calculator
  const blank = { direct: 0, earned: 0, levels: pct, network: [0, 0, 0, 0, 0], rakePct };
  if (!wallet) return sendJson(res, blank);
  void store
    .referralStats(wallet)
    .then((s) =>
      sendJson(res, { direct: s.direct, earned: fromBaseUnits(s.earned), levels: pct, network: s.network, rakePct }),
    )
    .catch(() => sendJson(res, blank));
});

// Admin wallet lookup: see who a wallet is under, balances, referral earnings.
app.get("/admin/wallet", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const wallet = (new URLSearchParams(req.getQuery()).get("wallet") ?? "").trim();
  if (!wallet) return sendJson(res, { error: "no_wallet" }, "400 Bad Request");
  void Promise.all([store.getProfile(wallet), store.referralStats(wallet)])
    .then(([p, s]) =>
      sendJson(res, {
        found: !!p,
        wallet,
        isRoot: !!REFERRAL_ROOT && wallet === REFERRAL_ROOT,
        referredBy: p?.referred_by ?? "",
        rootMatches: !!REFERRAL_ROOT && p?.referred_by === REFERRAL_ROOT,
        chips: p?.chips ?? 0,
        gameTokens: fromBaseUnits(p?.token_balance ?? 0),
        referralEarned: fromBaseUnits(p?.referral_earned ?? 0),
        directRefs: s.direct,
        network: s.network,
      }),
    )
    .catch(() => sendJson(res, { error: "lookup_failed" }, "500 Internal Server Error"));
});

// Admin override: force a wallet's referrer (empty ref = attach under the root).
app.get("/admin/set-referrer", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const q = new URLSearchParams(req.getQuery());
  const wallet = (q.get("wallet") ?? "").trim();
  let ref = (q.get("ref") ?? "").trim();
  if (!ref) ref = REFERRAL_ROOT; // default: attach under the owner
  if (!wallet) return sendJson(res, { error: "no_wallet" }, "400 Bad Request");
  if (!ref || ref === wallet) return sendJson(res, { ok: false, error: "bad_ref" });
  void store
    .setReferrerAdmin(wallet, ref)
    .then((ok) => {
      if (ok) logEvent("🛠", `${shortWallet(wallet)} set under ${shortWallet(ref)} (admin)`);
      sendJson(res, { ok });
    })
    .catch(() => sendJson(res, { error: "failed" }, "500 Internal Server Error"));
});

// Admin: adjust a wallet's chips by ±amount (negative = take away).
app.get("/admin/grant-chips", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const q = new URLSearchParams(req.getQuery());
  const wallet = (q.get("wallet") ?? "").trim();
  const amount = Math.trunc(Number(q.get("amount")));
  if (!wallet) return sendJson(res, { error: "no_wallet" }, "400 Bad Request");
  if (!Number.isFinite(amount) || amount === 0) return sendJson(res, { error: "bad_amount" }, "400 Bad Request");
  void store
    .adjustChips(wallet, amount)
    .then((chips) => {
      if (chips === null) return sendJson(res, { ok: false, error: "would_overdraw" });
      logEvent("🛠", `${shortWallet(wallet)} ${amount > 0 ? "+" : ""}${amount} 🪙 (admin)`);
      sendJson(res, { ok: true, chips });
    })
    .catch(() => sendJson(res, { error: "failed" }, "500 Internal Server Error"));
});

// Admin: grant a skin for free.
app.get("/admin/grant-skin", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const q = new URLSearchParams(req.getQuery());
  const wallet = (q.get("wallet") ?? "").trim();
  const skin = Math.trunc(Number(q.get("skin")));
  if (!wallet) return sendJson(res, { error: "no_wallet" }, "400 Bad Request");
  if (!(skin >= 0 && skin < SKIN_COUNT)) return sendJson(res, { error: "bad_skin" }, "400 Bad Request");
  void store
    .grantSkin(wallet, skin)
    .then((r) => {
      if (r) logEvent("🛠", `${shortWallet(wallet)} granted skin #${skin} (admin)`);
      sendJson(res, { ok: !!r, skins: r?.skins, already: !r });
    })
    .catch(() => sendJson(res, { error: "failed" }, "500 Internal Server Error"));
});

// Admin: set a wallet's rating outright.
app.get("/admin/set-rating", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const q = new URLSearchParams(req.getQuery());
  const wallet = (q.get("wallet") ?? "").trim();
  const rating = Math.trunc(Number(q.get("rating")));
  if (!wallet) return sendJson(res, { error: "no_wallet" }, "400 Bad Request");
  if (!(rating >= 0 && rating <= 100000)) return sendJson(res, { error: "bad_rating" }, "400 Bad Request");
  void store
    .setRating(wallet, rating)
    .then((r) => {
      if (r !== null) logEvent("🛠", `${shortWallet(wallet)} rating set to ${r} (admin)`);
      sendJson(res, { ok: r !== null, rating: r });
    })
    .catch(() => sendJson(res, { error: "failed" }, "500 Internal Server Error"));
});

// Admin: ban/unban a wallet (in-memory; cleared on restart).
app.get("/admin/ban", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const q = new URLSearchParams(req.getQuery());
  const wallet = (q.get("wallet") ?? "").trim();
  const on = q.get("on") !== "0";
  if (!wallet) return sendJson(res, { error: "no_wallet" }, "400 Bad Request");
  if (on) bannedWallets.add(wallet);
  else bannedWallets.delete(wallet);
  logEvent("🛠", `${shortWallet(wallet)} ${on ? "BANNED" : "unbanned"} (admin)`);
  sendJson(res, { ok: true, banned: on });
});

// Admin: toggle the deposit/withdraw gates live.
app.get("/admin/toggle", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  const q = new URLSearchParams(req.getQuery());
  const key = q.get("key") ?? "";
  const on = q.get("on") !== "0";
  if (key === "deposits") depositsOverride = on;
  else if (key === "withdrawals") withdrawalsOverride = on;
  else return sendJson(res, { error: "bad_key" }, "400 Bad Request");
  logEvent("🛠", `${key} ${on ? "enabled" : "disabled"} (admin)`);
  sendJson(res, { ok: true, deposits: depositsOn(), withdrawals: withdrawalsOn() });
});

async function parseBody(res: uWS.HttpResponse): Promise<Body> {
  const body = await readBody(res);
  let name = "Player";
  let code = "";
  let skin = 0;
  let wallet: string | null = null;
  let stake = 0;
  let currency = Currency.CHIPS;
  let difficulty = BotDifficulty.NORMAL;
  let bots = 3;
  let competitive = false;
  let coop = false;
  let sandbox: SandboxOpts | null = null;
  let isPublic = true; // created lobbies are public unless explicitly private
  try {
    const parsed = JSON.parse(body || "{}");
    if (typeof parsed.name === "string" && parsed.name.trim()) name = parsed.name.trim().slice(0, 16);
    if (typeof parsed.code === "string") code = parsed.code.trim().toUpperCase().slice(0, 8);
    if (Number.isFinite(parsed.skin)) skin = Math.max(0, Math.min(SKIN_COUNT - 1, Math.floor(parsed.skin)));
    if (typeof parsed.session === "string" && parsed.session) wallet = verifySession(parsed.session);
    if (wallet && bannedWallets.has(wallet)) wallet = null; // banned → treat as anonymous
    if (parsed.currency === 1) currency = Currency.TOKEN;
    const tiers = currency === Currency.TOKEN ? TOKEN_BET_SIZES : BET_SIZES;
    if (Number.isFinite(parsed.stake) && (tiers as readonly number[]).includes(parsed.stake)) {
      stake = parsed.stake;
    }
    if (parsed.difficulty === 0 || parsed.difficulty === 1 || parsed.difficulty === 2) {
      difficulty = parsed.difficulty as BotDifficulty;
    }
    if (Number.isFinite(parsed.bots)) bots = Math.max(1, Math.min(PRACTICE_MAX_BOTS, Math.floor(parsed.bots)));
    if (parsed.competitive === true) competitive = true;
    if (parsed.coop === true) coop = true;
    // Sandbox tuning (only honoured by a non-competitive practice room).
    if (parsed.sandbox && typeof parsed.sandbox === "object") sandbox = clampSandbox(parsed.sandbox);
    if (parsed.public === false) isPublic = false; // private = code-only, unlisted
  } catch {
    // ignore malformed body
  }
  return { name, code, skin, wallet, stake, currency, difficulty, bots, competitive, sandbox, isPublic, coop };
}

function sendJson(res: uWS.HttpResponse, obj: unknown, status?: string): void {
  if ((res as ResWithAbort).aborted) return; // client already gone — don't touch the socket
  const body = JSON.stringify(obj);
  try {
    // uWS wants all response writes inside a corked callback (one syscall).
    res.cork(() => {
      if ((res as ResWithAbort).aborted) return;
      // writeStatus() must come before any writeHeader().
      if (status) res.writeStatus(status);
      writeCors(res);
      res.writeHeader("Content-Type", "application/json");
      res.end(body);
    });
  } catch {
    /* socket was torn down between the check and the write — nothing to do */
  }
}

/** Sets up a rate-limited handler. Returns false if the request was rejected. */
function guard(res: uWS.HttpResponse, req: uWS.HttpRequest): boolean {
  const ip = clientIp(res, req);
  res.onAborted(() => {
    (res as ResWithAbort).aborted = true;
  });
  if (!httpAllow(ip)) {
    sendJson(res, { error: "rate_limited" }, "429 Too Many Requests");
    return false;
  }
  return true;
}

// --- wallet sign-in ---
app.post("/auth/nonce", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(() => sendJson(res, { nonce: createNonce() }));
});

// --- external identity linking (Telegram / Google / Twitter) ----------------
// OAuth redirect base MUST exactly match what's registered with Google/Twitter
// (our public domain) — so we do NOT fall back to RENDER_EXTERNAL_URL (the
// *.onrender.com host), which would cause a redirect_uri mismatch.
const APP_BASE = (process.env.PUBLIC_URL || "https://bombermeme.fun").replace(/\/+$/, "");
// Allowed hosts we'll redirect a user BACK to after OAuth (open-redirect guard).
// Defaults cover the apex + any subdomain of bombermeme.fun; localhost for dev.
const OAUTH_RETURN_HOSTS = (process.env.OAUTH_RETURN_HOSTS || "bombermeme.fun").split(",").map((s) => s.trim()).filter(Boolean);
/** Resolve the safe origin to return the user to (the host they started on, so
 *  www↔apex never strands the session), falling back to APP_BASE. */
function returnBase(from: string): string {
  try {
    const u = new URL(from);
    const ok = u.hostname === "localhost" || OAUTH_RETURN_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
    if (ok && (u.protocol === "https:" || u.hostname === "localhost")) return `${u.protocol}//${u.host}`;
  } catch { /* bad input → fall back */ }
  return APP_BASE;
}
/** Pack the CSRF link-code + the return origin into one OAuth state string. */
function packState(code: string, from: string): string {
  return `${code}.${Buffer.from(from, "utf8").toString("base64url")}`;
}
function unpackState(state: string): { code: string; from: string } {
  const i = state.indexOf(".");
  if (i < 0) return { code: state, from: "" };
  try { return { code: state.slice(0, i), from: Buffer.from(state.slice(i + 1), "base64url").toString("utf8") }; }
  catch { return { code: state.slice(0, i), from: "" }; }
}
function redirect(res: uWS.HttpResponse, url: string): void {
  res.cork(() => { res.writeStatus("302 Found"); res.writeHeader("Location", url); res.end(); });
}

// Telegram: issue a deep-link code; the user opens the bot and /start link_<code>
// attaches their chat to this wallet (handled in tgbot.ts). Bot username = TG_BOT.
app.post("/link/telegram/start", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then((body) => {
    let wallet: string | null = null;
    try { const j = JSON.parse(body || "{}"); if (typeof j.session === "string") wallet = verifySession(j.session); } catch { /* ignore */ }
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
    const bot = process.env.TG_BOT ?? "";
    if (!bot) return sendJson(res, { error: "telegram_unconfigured" });
    sendJson(res, { url: `https://t.me/${bot}?start=link_${makeLinkCode(wallet)}` });
  }).catch(() => sendJson(res, { error: "server_error" }, "500 Internal Server Error"));
});

// Current external links for the connected wallet (the Connections screen).
app.get("/identity", (res, req) => {
  res.onAborted(() => {});
  const wallet = verifySession(new URLSearchParams(req.getQuery()).get("session") ?? "");
  if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
  void identity.get(wallet).then((i) => sendJson(res, { identity: i })).catch(() => sendJson(res, { identity: null }));
});

// Google OAuth (gated on GOOGLE_CLIENT_ID/SECRET) — links the wallet's email.
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
app.get("/auth/google", (res, req) => {
  res.onAborted(() => {});
  const qs = new URLSearchParams(req.getQuery());
  const wallet = verifySession(qs.get("session") ?? "");
  const from = qs.get("from") ?? "";
  const back = returnBase(from);
  if (!GOOGLE_ID || !GOOGLE_SECRET) return redirect(res, `${back}/?link=google_unconfigured`);
  if (!wallet) return redirect(res, `${back}/?link=need_wallet`);
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", GOOGLE_ID);
  u.searchParams.set("redirect_uri", `${APP_BASE}/auth/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email");
  u.searchParams.set("state", packState(makeLinkCode(wallet), from));
  redirect(res, u.toString());
});
app.get("/auth/google/callback", (res, req) => {
  res.onAborted(() => {});
  const q = new URLSearchParams(req.getQuery());
  const code = q.get("code") ?? "";
  const { code: linkCode, from } = unpackState(q.get("state") ?? "");
  const back = returnBase(from);
  const wallet = takeLinkCode(linkCode);
  if (!wallet || !code) return redirect(res, `${back}/?link=google_failed`);
  void (async () => {
    try {
      const tr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, redirect_uri: `${APP_BASE}/auth/google/callback`, grant_type: "authorization_code" }),
      });
      const tj = (await tr.json()) as { access_token?: string };
      if (!tj.access_token) return redirect(res, `${back}/?link=google_failed`);
      const ur = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tj.access_token}` } });
      const uj = (await ur.json()) as { email?: string };
      if (uj.email) await identity.link(wallet, { email: String(uj.email) });
      redirect(res, `${back}/?link=google_ok`);
    } catch {
      redirect(res, `${back}/?link=google_failed`);
    }
  })();
});

// Twitter/X OAuth2 + PKCE (gated on TWITTER_CLIENT_ID/SECRET) — links @handle.
const TW_ID = process.env.TWITTER_CLIENT_ID ?? "";
const TW_SECRET = process.env.TWITTER_CLIENT_SECRET ?? "";
const twPkce = new Map<string, { verifier: string; at: number }>();
app.get("/auth/twitter", (res, req) => {
  res.onAborted(() => {});
  const qs = new URLSearchParams(req.getQuery());
  const wallet = verifySession(qs.get("session") ?? "");
  const from = qs.get("from") ?? "";
  const back = returnBase(from);
  if (!TW_ID || !TW_SECRET) return redirect(res, `${back}/?link=twitter_unconfigured`);
  if (!wallet) return redirect(res, `${back}/?link=need_wallet`);
  const state = packState(makeLinkCode(wallet), from);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  twPkce.set(state, { verifier, at: Date.now() });
  const u = new URL("https://twitter.com/i/oauth2/authorize");
  u.searchParams.set("client_id", TW_ID);
  u.searchParams.set("redirect_uri", `${APP_BASE}/auth/twitter/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "users.read tweet.read");
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  redirect(res, u.toString());
});
app.get("/auth/twitter/callback", (res, req) => {
  res.onAborted(() => {});
  const q = new URLSearchParams(req.getQuery());
  const code = q.get("code") ?? "";
  const state = q.get("state") ?? "";
  const { code: linkCode, from } = unpackState(state);
  const back = returnBase(from);
  const wallet = takeLinkCode(linkCode);
  const pk = twPkce.get(state);
  twPkce.delete(state);
  if (!wallet || !code || !pk) return redirect(res, `${back}/?link=twitter_failed`);
  void (async () => {
    try {
      const tr = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${TW_ID}:${TW_SECRET}`).toString("base64")}` },
        body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: `${APP_BASE}/auth/twitter/callback`, code_verifier: pk.verifier }),
      });
      const tj = (await tr.json()) as { access_token?: string };
      if (!tj.access_token) return redirect(res, `${back}/?link=twitter_failed`);
      const ur = await fetch("https://api.twitter.com/2/users/me", { headers: { Authorization: `Bearer ${tj.access_token}` } });
      const uj = (await ur.json()) as { data?: { username?: string } };
      if (uj.data?.username) await identity.link(wallet, { twitter: String(uj.data.username) });
      redirect(res, `${back}/?link=twitter_ok`);
    } catch {
      redirect(res, `${back}/?link=twitter_failed`);
    }
  })();
});

app.post("/auth/verify", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then((body) => {
    let pubkey = "";
    let nonce = "";
    let signature = "";
    try {
      const j = JSON.parse(body || "{}");
      pubkey = String(j.pubkey ?? "");
      nonce = String(j.nonce ?? "");
      signature = String(j.signature ?? "");
    } catch {
      // ignore
    }
    if (bannedWallets.has(pubkey)) {
      sendJson(res, { error: "banned" }, "403 Forbidden");
    } else if (verifySignature(pubkey, nonce, signature)) {
      sendJson(res, { session: createSession(pubkey), pubkey });
    } else {
      sendJson(res, { error: "invalid_signature" }, "401 Unauthorized");
    }
  });
});

// --- Telegram Mini App <-> Phantom deeplink relay ---
app.post("/tg/relay/new", (res, req) => {
  if (!guard(res, req)) return;
  void readBody(res).then(() => sendJson(res, { state: newRelayState() }));
});

app.get("/tg/relay/:state", (res, req) => {
  if (!guard(res, req)) return;
  const state = req.getParameter(0) ?? "";
  const payload = takeRelayPayload(state);
  if (payload) sendJson(res, { payload });
  else sendJson(res, { error: "pending" }, "404 Not Found");
});

// Phantom redirects here after the user approves; stash the blob and bounce back
// into the Mini App. Served as HTML (not JSON) so the browser runs the redirect.
app.get("/tg/cb", (res, req) => {
  res.onAborted(() => {});
  const query = req.getQuery() ?? "";
  const state = new URLSearchParams(query).get("state") ?? "";
  if (state) putRelayPayload(state, query);
  const html = reopenHtml(state);
  res.cork(() => {
    res.writeHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHeader("Cache-Control", "no-cache");
    res.end(html);
  });
});

// Telegram bot webhook: replies to /start with the welcome post + Play button.
app.post("/tg/webhook", (res, req) => {
  const secret = req.getHeader("x-telegram-bot-api-secret-token") || "";
  res.onAborted(() => {});
  void readBody(res).then((body) => {
    res.cork(() => {
      res.writeStatus("200 OK");
      res.writeHeader("Content-Type", "text/plain");
      res.end("ok");
    });
    if (!tgWebhookSecretOk(secret)) return;
    try {
      void handleTgUpdate(JSON.parse(body || "{}"));
    } catch {
      // ignore malformed updates
    }
  });
});

type Body = {
  name: string;
  code: string;
  skin: number;
  wallet: string | null;
  stake: number;
  currency: Currency;
  difficulty: BotDifficulty;
  bots: number;
  competitive: boolean;
  sandbox: SandboxOpts | null;
  isPublic: boolean;
  coop: boolean;
};

function withMatchmaking(
  res: uWS.HttpResponse,
  req: uWS.HttpRequest,
  fn: (b: Body) => unknown,
  costOf: (b: Body) => { stake: number; currency: Currency } = (b) => ({ stake: b.stake, currency: b.currency }),
): void {
  if (!guard(res, req)) return;
  void parseBody(res).then(async (b) => {
    try {
      // Wallet players always display their stable, unique profile nickname
      // (ignore an arbitrary client-sent name so two accounts can't share one).
      if (b.wallet) {
        const prof = await store.ensureProfile(b.wallet, b.name, b.skin);
        b.name = prof.name;
      }
      // Staked table: require a wallet with enough of the right balance first.
      const { stake, currency } = costOf(b);
      if (stake > 0) {
        if (!b.wallet) {
          sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
          return;
        }
        const p = await store.ensureProfile(b.wallet, b.name, b.skin);
        if (currency === Currency.TOKEN) {
          const needBase = toBaseUnits(stake);
          if ((p.token_balance ?? 0) < needBase) {
            sendJson(res, { error: "insufficient_tokens", balance: fromBaseUnits(p.token_balance ?? 0), stake }, "402 Payment Required");
            return;
          }
        } else if (p.chips < stake) {
          sendJson(res, { error: "insufficient_chips", balance: p.chips, stake }, "402 Payment Required");
          return;
        }
      }
      const result = fn(b);
      if (!result) {
        sendJson(res, { error: "room_not_found" }, "404 Not Found");
        return;
      }
      let chips: number | undefined;
      let gameTokens: number | undefined;
      if (b.wallet) {
        const p = await store.ensureProfile(b.wallet, b.name, b.skin);
        chips = p.chips;
        gameTokens = fromBaseUnits(p.token_balance ?? 0);
      }
      sendJson(res, { ...result, wallet: b.wallet, chips, gameTokens, stake, currency });
    } catch (e) {
      if (e instanceof ServerFullError) sendJson(res, { error: "server_full" }, "503 Service Unavailable");
      else sendJson(res, { error: "internal" }, "500 Internal Server Error");
    }
  });
}

app.get("/tables", (res) => {
  res.onAborted(() => {});
  sendJson(res, { tables: mm.listTables() });
});

// Watch a live match (spectator). ?code=XXXX for a specific one, else any.
app.get("/watch", (res, req) => {
  if (!guard(res, req)) return;
  const code = new URLSearchParams(req.getQuery()).get("code") ?? "";
  const result = code ? mm.spectate(code) : mm.spectateAny();
  if (!result) sendJson(res, { error: "no_live_match" }, "404 Not Found");
  else sendJson(res, result);
});

app.post("/quickplay", (res, req) =>
  withMatchmaking(
    res,
    req,
    (b) => mm.quickplay(b.name, b.skin, b.wallet, b.stake),
    (b) => ({ stake: b.stake, currency: Currency.CHIPS }),
  ),
);
app.post("/create", (res, req) =>
  withMatchmaking(res, req, (b) => mm.createTable(b.name, b.skin, b.wallet, b.stake, b.currency, b.isPublic)),
);
app.post("/practice", (res, req) =>
  withMatchmaking(res, req, (b) => mm.practice(b.name, b.skin, b.wallet, b.difficulty, b.bots, b.competitive, b.competitive ? null : b.sandbox, b.competitive ? false : b.coop), () => ({ stake: 0, currency: Currency.CHIPS })),
);
app.post("/join", (res, req) =>
  withMatchmaking(
    res,
    req,
    (b) => mm.joinByCode(b.code, b.name, b.skin, b.wallet),
    (b) => {
      const r = mm.getRoom(b.code);
      return { stake: r?.stake ?? 0, currency: r?.currency ?? Currency.CHIPS };
    },
  ),
);

app.ws<SocketData>("/ws", {
  maxPayloadLength: 1024,
  idleTimeout: 60,
  maxBackpressure: 1024 * 1024,
  upgrade: (res, req, context) => {
    const qs = new URLSearchParams(req.getQuery());
    const ip = clientIp(res, req);
    if ((wsConnsByIp.get(ip) ?? 0) >= WS_MAX_PER_IP) {
      res.cork(() => res.writeStatus("429 Too Many Requests").end());
      return;
    }
    wsConnsByIp.set(ip, (wsConnsByIp.get(ip) ?? 0) + 1);
    res.upgrade<SocketData>(
      {
        token: qs.get("token") ?? "",
        reconnect: qs.get("reconnect") ?? "",
        roomId: "",
        playerId: -1,
        bound: false,
        msgTokens: WS_BURST,
        msgTs: Date.now(),
        ip,
      },
      req.getHeader("sec-websocket-key"),
      req.getHeader("sec-websocket-protocol"),
      req.getHeader("sec-websocket-extensions"),
      context,
    );
  },
  open: (ws) => {
    const ud = ws.getUserData();
    const send: SendFn = (bytes) => {
      try {
        ws.send(bytes, true);
      } catch {
        // socket closing; ignore
      }
    };
    if (ud.reconnect) {
      const r = mm.reconnect(ud.reconnect, send);
      if (!r) {
        ws.end(1008, "reconnect failed");
        return;
      }
      ud.roomId = r.roomId;
      ud.playerId = r.playerId;
      ud.bound = true;
      return;
    }
    const bound = mm.bindSocket(ud.token, send);
    if (!bound) {
      ws.end(1008, "invalid token");
      return;
    }
    ud.roomId = bound.roomId;
    ud.playerId = bound.playerId;
    ud.bound = true;
    send(encodeReconnectToken(bound.reconnectToken));
  },
  message: (ws, message) => {
    const ud = ws.getUserData();
    if (!ud.bound) return;
    // Per-connection rate limit (token bucket) — drop floods before decoding work.
    const now = Date.now();
    ud.msgTokens = Math.min(WS_BURST, ud.msgTokens + ((now - ud.msgTs) / 1000) * WS_RATE);
    ud.msgTs = now;
    if (ud.msgTokens < 1) return;
    ud.msgTokens -= 1;
    const msg = decodeClient(message);
    if (!msg) return;
    if (msg.type === ClientMsg.PING) {
      ws.send(encodePong(msg.timestamp), true);
      return;
    }
    const room = mm.getRoom(ud.roomId);
    if (!room) return;
    if (msg.type === ClientMsg.INPUT_MOVE) {
      room.setMove(ud.playerId, msg.dir, msg.tick);
    } else if (msg.type === ClientMsg.INPUT_PLACE_BOMB) {
      room.placeBomb(ud.playerId);
    } else if (msg.type === ClientMsg.REQUEST_START) {
      room.requestStart(ud.playerId);
    } else if (msg.type === ClientMsg.SET_READY) {
      room.setReady(ud.playerId, msg.ready);
    } else if (msg.type === ClientMsg.EMOTE) {
      room.emote(ud.playerId, msg.emote);
    } else if (msg.type === ClientMsg.SET_STAKE) {
      void room.setStake(ud.playerId, msg.stake);
    } else if (msg.type === ClientMsg.PROPOSE_STAKE) {
      room.proposeStake(ud.playerId, msg.stake);
    } else if (msg.type === ClientMsg.VOTE_STAKE) {
      room.voteStake(ud.playerId, msg.accept);
    } else if (msg.type === ClientMsg.KICK) {
      room.kick(ud.playerId, msg.targetId);
    } else if (msg.type === ClientMsg.SET_SKIN) {
      room.setSkin(ud.playerId, msg.skin);
    } else if (msg.type === ClientMsg.CHAT) {
      room.chat(ud.playerId, msg.text);
    } else if (msg.type === ClientMsg.SET_VISIBILITY) {
      room.setVisibility(ud.playerId, msg.isPublic);
    } else if (msg.type === ClientMsg.SET_DURATION) {
      room.setDuration(ud.playerId, msg.mins);
    }
  },
  close: (ws) => {
    const ud = ws.getUserData();
    if (ud.ip) {
      const n = (wsConnsByIp.get(ud.ip) ?? 1) - 1;
      if (n > 0) wsConnsByIp.set(ud.ip, n);
      else wsConnsByIp.delete(ud.ip);
    }
    if (ud.bound) mm.getRoom(ud.roomId)?.handleDisconnect(ud.playerId);
  },
});

// Runtime analytics config — the client reads window.__CFG__ first, then falls
// back to build-time VITE_* values. Lets us set GA/PostHog/Clarity keys in the
// deploy env with NO client rebuild (fixes "key baked empty at build time").
app.get("/runtime-config.js", (res) => {
  res.onAborted(() => {});
  const cfg = {
    POSTHOG_KEY: process.env.VITE_POSTHOG_KEY || process.env.POSTHOG_KEY || "",
    POSTHOG_HOST: process.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    GA_ID: process.env.VITE_GA_ID || process.env.GA_ID || "",
    CLARITY_ID: process.env.VITE_CLARITY_ID || process.env.CLARITY_ID || "",
  };
  const body = `window.__CFG__=${JSON.stringify(cfg)};`;
  res.cork(() => {
    res.writeHeader("Content-Type", "application/javascript; charset=utf-8");
    res.writeHeader("Cache-Control", "no-cache");
    writeSecurity(res);
    res.end(body);
  });
});

// Static client (only when a build is present alongside the server).
if (SERVE_STATIC) {
  app.get("/*", (res, req) => serveStatic(res, req.getUrl()));
}

app.listen(PORT, (listenSocket) => {
  if (listenSocket) {
    console.log(
      `[bomberpump] server listening on :${PORT}` +
        (SERVE_STATIC ? ` (serving client from ${CLIENT_DIST})` : " (api only)"),
    );
    startDepositWatcher(); // no-op unless TREASURY_ADDRESS is set
    void setupTelegramBot(); // no-op unless TG_BOT_TOKEN is set
  } else {
    console.error(`[bomberpump] failed to listen on :${PORT}`);
    process.exit(1);
  }
});
