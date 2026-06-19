import { readFileSync, existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import uWS from "uWebSockets.js";
import { ClientMsg, decodeClient, encodePong, encodeReconnectToken, STARTING_CHIPS, STARTING_RATING, BET_SIZES, TOKEN_BET_SIZES, Currency, BotDifficulty, TOKEN_MINT, TOKEN_TICKER, MIN_WITHDRAW, MAX_WITHDRAW, DEFAULT_SKINS, SKIN_PRICES, SKIN_COUNT } from "@bomberpump/shared";
import { Matchmaker, ServerFullError } from "./matchmaker.js";
import { createNonce, verifySignature, createSession, verifySession, AUTH_SECRET_SET } from "./auth.js";
import { newRelayState, putRelayPayload, takeRelayPayload, reopenHtml } from "./tgrelay.js";
import { handleTgUpdate, tgWebhookSecretOk, setupTelegramBot } from "./tgbot.js";
import { analytics } from "./analytics.js";
import { REFERRAL_LEVEL_BPS } from "./referral.js";
import { logEvent, recentEvents, shortWallet } from "./events.js";
import { metrics } from "./metrics.js";
import { adminPageHtml } from "./admin.js";
import { store } from "./store.js";
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
process.on("unhandledRejection", (reason) => console.error("[fatal] unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("[fatal] uncaughtException:", err));
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

interface SocketData {
  token: string;
  reconnect: string;
  roomId: string;
  playerId: number;
  bound: boolean;
  msgTokens: number;
  msgTs: number;
}

// Per-IP HTTP rate limit (token bucket) for the mutating endpoints.
const HTTP_RATE = 8; // tokens/sec
const HTTP_BURST = 16;
const httpBuckets = new Map<string, { t: number; ts: number }>();

function clientIp(res: uWS.HttpResponse, req: uWS.HttpRequest): string {
  const xff = req.getHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
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

function readBody(res: uWS.HttpResponse): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    res.onData((chunk, isLast) => {
      buf += Buffer.from(chunk).toString();
      if (isLast) resolve(buf);
    });
    res.onAborted(() => resolve(""));
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
  if (rel === "/" || rel === "") rel = "/index.html";
  const full = normalize(join(CLIENT_DIST, rel));
  // SPA fallback + path-traversal guard.
  const safe = full.startsWith(CLIENT_DIST) && existsSync(full) && statSync(full).isFile()
    ? full
    : join(CLIENT_DIST, "index.html");
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
  const id = new URLSearchParams(req.getQuery()).get("id") ?? "";
  if (id) {
    presence.set(id, Date.now());
    metrics.presence(id);
  }
  res.cork(() => {
    res.writeHeader("Access-Control-Allow-Origin", "*");
    res.writeStatus("204 No Content").end();
  });
});

// Live JSON metrics for the dashboard. Polled by /admin.
app.get("/admin/stats", (res, req) => {
  res.onAborted(() => {});
  if (!adminAuthed(req)) return sendJson(res, { error: "unauthorized" }, "401 Unauthorized");
  void Promise.all([store.leaderboard(10, "all"), store.referralOverview(15, REFERRAL_ROOT)])
    .then(([top, ref]) => {
      sendJson(res, {
        online: onlineCount(),
        growth: metrics.snapshot(),
        growthTargets: GROWTH_TARGETS,
        events: recentEvents(30),
        config: {
          rakePct: (Number(process.env.HOUSE_RAKE_BP ?? 0) || 0) / 100,
          referralRoot: REFERRAL_ROOT ? shortWallet(REFERRAL_ROOT) : "",
          deposits: depositsEnabled,
          withdrawals: withdrawalsEnabled,
        },
        live: mm.adminStats,
        load: mm.load,
        totals: analytics.snapshot(),
        store: store.kind,
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

// The dashboard page itself (HTML asks for the token, then polls /admin/stats).
app.get("/admin", (res) => {
  res.onAborted(() => {});
  res.cork(() => {
    res.writeHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHeader("Cache-Control", "no-cache");
    res.end(adminPageHtml());
  });
});

app.get("/profile", (res, req) => {
  res.onAborted(() => {});
  const wallet = new URLSearchParams(req.getQuery()).get("wallet") ?? "";
  const blank = { wallet, level: 1, xp: 0, matches: 0, wins: 0, frags: 0, deaths: 0, best_streak: 0, name: "", skin: 0, skins: DEFAULT_SKINS, current_streak: 0, chips: STARTING_CHIPS, rating: STARTING_RATING, week_key: "", week_points: 0, token_balance: 0 };
  Promise.all([store.getProfile(wallet), tokenBalance(wallet)])
    .then(([p, tok]) => {
      const prof = p ?? blank;
      sendJson(res, {
        ...prof,
        walletTokens: tok, // on-chain balance in the player's wallet (ui amount)
        gameTokens: fromBaseUnits(prof.token_balance), // custodial in-game balance (whole)
      });
    })
    .catch(() => sendJson(res, { error: "profile_failed" }, "500 Internal Server Error"));
});

app.get("/leaderboard", (res, req) => {
  res.onAborted(() => {});
  const period = new URLSearchParams(req.getQuery()).get("period") === "week" ? "week" : "all";
  store
    .leaderboard(100, period)
    .then((rows) => sendJson(res, { rows }))
    .catch(() => sendJson(res, { rows: [] }));
});

// Live USD price of the token (for the in-game $ converter).
app.get("/price", (res) => {
  res.onAborted(() => {});
  tokenPriceUsd()
    .then((usd) => sendJson(res, { usd, ticker: TOKEN_TICKER }))
    .catch(() => sendJson(res, { usd: 0, ticker: TOKEN_TICKER }));
});

// Custodial bank: where to deposit + current balances + capabilities.
app.get("/bank", (res, req) => {
  res.onAborted(() => {});
  const wallet = new URLSearchParams(req.getQuery()).get("wallet") ?? "";
  rescanDepositsSoon(); // opening the Bank nudges a fresh deposit check
  Promise.all([store.getProfile(wallet), tokenBalance(wallet)])
    .then(([p, tok]) =>
      sendJson(res, {
        treasury: TREASURY_ADDRESS,
        ticker: TOKEN_TICKER,
        mint: TOKEN_MINT,
        depositsEnabled,
        withdrawalsEnabled,
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
    if (!depositsEnabled) return sendJson(res, { error: "deposits_disabled" }, "503 Service Unavailable");
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
    try {
      const j = JSON.parse(body || "{}");
      if (typeof j.signature === "string") sig = j.signature.trim();
    } catch {
      // ignore
    }
    if (sig.length < 32 || sig.length > 100) {
      return sendJson(res, { ok: false, reason: "bad_signature" }, "400 Bad Request");
    }
    const r = await claimBySignature(sig);
    sendJson(res, r);
  });
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
    if (!withdrawalsEnabled) return sendJson(res, { error: "withdrawals_disabled" }, "503 Service Unavailable");
    if (amount < MIN_WITHDRAW || amount > MAX_WITHDRAW) {
      return sendJson(res, { error: "bad_amount", min: MIN_WITHDRAW, max: MAX_WITHDRAW }, "400 Bad Request");
    }
    try {
      const signature = await withdraw(wallet, toBaseUnits(amount));
      const p = await store.getProfile(wallet);
      sendJson(res, { signature, gameTokens: fromBaseUnits(p?.token_balance ?? 0) });
    } catch (e) {
      const msg = (e as Error).message;
      const code = msg === "insufficient_balance" ? "402 Payment Required" : "500 Internal Server Error";
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
    const price = SKIN_PRICES[skin] ?? 0;
    const result = await store.buySkin(wallet, skin, price);
    if (!result) return sendJson(res, { error: "cant_buy" }, "402 Payment Required");
    // Buying also equips it.
    await store.selectSkin(wallet, skin);
    sendJson(res, { chips: result.chips, skins: result.skins, skin });
  });
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
  });
});

// --- referral ---
// Bind the inviter for a freshly-connected wallet (one-time, session-verified).
app.post("/referral/attribute", (res, req) => {
  if (!guard(res, req)) return;
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
    const set = await store.setReferrer(wallet, effectiveRef);
    if (set) {
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

async function parseBody(res: uWS.HttpResponse): Promise<Body> {
  const body = await readBody(res);
  let name = "Player";
  let code = "";
  let skin = 0;
  let wallet: string | null = null;
  let stake = 0;
  let currency = Currency.CHIPS;
  let difficulty = BotDifficulty.NORMAL;
  try {
    const parsed = JSON.parse(body || "{}");
    if (typeof parsed.name === "string" && parsed.name.trim()) name = parsed.name.trim().slice(0, 16);
    if (typeof parsed.code === "string") code = parsed.code.trim().toUpperCase().slice(0, 8);
    if (Number.isFinite(parsed.skin)) skin = Math.max(0, Math.min(3, Math.floor(parsed.skin)));
    if (typeof parsed.session === "string" && parsed.session) wallet = verifySession(parsed.session);
    if (parsed.currency === 1) currency = Currency.TOKEN;
    const tiers = currency === Currency.TOKEN ? TOKEN_BET_SIZES : BET_SIZES;
    if (Number.isFinite(parsed.stake) && (tiers as readonly number[]).includes(parsed.stake)) {
      stake = parsed.stake;
    }
    if (parsed.difficulty === 0 || parsed.difficulty === 1 || parsed.difficulty === 2) {
      difficulty = parsed.difficulty as BotDifficulty;
    }
  } catch {
    // ignore malformed body
  }
  return { name, code, skin, wallet, stake, currency, difficulty };
}

function sendJson(res: uWS.HttpResponse, obj: unknown, status?: string): void {
  const body = JSON.stringify(obj);
  // uWS wants all response writes inside a corked callback (one syscall).
  res.cork(() => {
    // writeStatus() must come before any writeHeader().
    if (status) res.writeStatus(status);
    writeCors(res);
    res.writeHeader("Content-Type", "application/json");
    res.end(body);
  });
}

/** Sets up a rate-limited handler. Returns false if the request was rejected. */
function guard(res: uWS.HttpResponse, req: uWS.HttpRequest): boolean {
  const ip = clientIp(res, req);
  res.onAborted(() => {});
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
    if (verifySignature(pubkey, nonce, signature)) {
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
  withMatchmaking(res, req, (b) => mm.createTable(b.name, b.skin, b.wallet, b.stake, b.currency)),
);
app.post("/practice", (res, req) =>
  withMatchmaking(res, req, (b) => mm.practice(b.name, b.skin, b.wallet, b.difficulty), () => ({ stake: 0, currency: Currency.CHIPS })),
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
    res.upgrade<SocketData>(
      {
        token: qs.get("token") ?? "",
        reconnect: qs.get("reconnect") ?? "",
        roomId: "",
        playerId: -1,
        bound: false,
        msgTokens: WS_BURST,
        msgTs: Date.now(),
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
    }
  },
  close: (ws) => {
    const ud = ws.getUserData();
    if (ud.bound) mm.getRoom(ud.roomId)?.handleDisconnect(ud.playerId);
  },
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
