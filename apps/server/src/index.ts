import { readFileSync, existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import uWS from "uWebSockets.js";
import { ClientMsg, decodeClient, encodePong, encodeReconnectToken, STARTING_CHIPS } from "@bomberpump/shared";
import { Matchmaker, ServerFullError } from "./matchmaker.js";
import { createNonce, verifySignature, createSession, verifySession } from "./auth.js";
import { store } from "./store.js";
import type { SendFn } from "./player.js";

const PORT = Number(process.env.PORT ?? 8787);
// Optional: serve the built client from the same origin (single-box deploy).
const CLIENT_DIST = process.env.CLIENT_DIST ?? join(import.meta.dirname, "../../client/dist");
const SERVE_STATIC = existsSync(join(CLIENT_DIST, "index.html"));
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
  writeCors(res);
  res.endWithoutBody();
});

app.get("/health", (res) => {
  res.onAborted(() => {});
  store
    .ping()
    .then((db) => sendJson(res, { ok: true, store: store.kind, db: db ? "ok" : "down", ...mm.stats }))
    .catch(() => sendJson(res, { ok: true, store: store.kind, db: "down", ...mm.stats }));
});

app.get("/profile", (res, req) => {
  res.onAborted(() => {});
  const wallet = new URLSearchParams(req.getQuery()).get("wallet") ?? "";
  store
    .getProfile(wallet)
    .then((p) => sendJson(res, p ?? { wallet, level: 1, xp: 0, matches: 0, wins: 0, frags: 0, deaths: 0, best_streak: 0, name: "", skin: 0, current_streak: 0, chips: STARTING_CHIPS }))
    .catch(() => sendJson(res, { error: "profile_failed" }, "500 Internal Server Error"));
});

app.get("/leaderboard", (res) => {
  res.onAborted(() => {});
  store
    .leaderboard(100)
    .then((rows) => sendJson(res, { rows }))
    .catch(() => sendJson(res, { rows: [] }));
});

async function parseBody(
  res: uWS.HttpResponse,
): Promise<{ name: string; code: string; skin: number; wallet: string | null }> {
  const body = await readBody(res);
  let name = "Player";
  let code = "";
  let skin = 0;
  let wallet: string | null = null;
  try {
    const parsed = JSON.parse(body || "{}");
    if (typeof parsed.name === "string" && parsed.name.trim()) name = parsed.name.trim().slice(0, 16);
    if (typeof parsed.code === "string") code = parsed.code.trim().toUpperCase().slice(0, 8);
    if (Number.isFinite(parsed.skin)) skin = Math.max(0, Math.min(3, Math.floor(parsed.skin)));
    if (typeof parsed.session === "string" && parsed.session) wallet = verifySession(parsed.session);
  } catch {
    // ignore malformed body
  }
  return { name, code, skin, wallet };
}

function sendJson(res: uWS.HttpResponse, obj: unknown, status?: string): void {
  // uWS requires writeStatus() before any writeHeader().
  if (status) res.writeStatus(status);
  writeCors(res);
  res.writeHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
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

function withMatchmaking(
  res: uWS.HttpResponse,
  req: uWS.HttpRequest,
  fn: (b: { name: string; code: string; skin: number; wallet: string | null }) => unknown,
): void {
  if (!guard(res, req)) return;
  void parseBody(res).then(async (b) => {
    try {
      const result = fn(b);
      if (!result) {
        sendJson(res, { error: "room_not_found" }, "404 Not Found");
        return;
      }
      // Grant/return the wallet's chip balance (simulated currency).
      let chips: number | undefined;
      if (b.wallet) chips = (await store.ensureProfile(b.wallet, b.name, b.skin)).chips;
      // Echo the wallet the server resolved from the session, so the client
      // can detect a stale session and re-sign before playing.
      sendJson(res, { ...result, wallet: b.wallet, chips });
    } catch (e) {
      if (e instanceof ServerFullError) sendJson(res, { error: "server_full" }, "503 Service Unavailable");
      else sendJson(res, { error: "internal" }, "500 Internal Server Error");
    }
  });
}

app.post("/quickplay", (res, req) =>
  withMatchmaking(res, req, (b) => mm.quickplay(b.name, b.skin, b.wallet)),
);
app.post("/create", (res, req) =>
  withMatchmaking(res, req, (b) => mm.createPrivate(b.name, b.skin, b.wallet)),
);
app.post("/practice", (res, req) =>
  withMatchmaking(res, req, (b) => mm.practice(b.name, b.skin, b.wallet)),
);
app.post("/join", (res, req) =>
  withMatchmaking(res, req, (b) => mm.joinByCode(b.code, b.name, b.skin, b.wallet)),
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
  } else {
    console.error(`[bomberpump] failed to listen on :${PORT}`);
    process.exit(1);
  }
});
