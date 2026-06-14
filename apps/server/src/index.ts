import { readFileSync, existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import uWS from "uWebSockets.js";
import { ClientMsg, decodeClient, encodePong } from "@bomberpump/shared";
import { Matchmaker } from "./matchmaker.js";
import type { SendFn } from "./player.js";

const PORT = Number(process.env.PORT ?? 8787);
// Optional: serve the built client from the same origin (single-box deploy).
const CLIENT_DIST = process.env.CLIENT_DIST ?? join(import.meta.dirname, "../../client/dist");
const SERVE_STATIC = existsSync(join(CLIENT_DIST, "index.html"));
const mm = new Matchmaker();
mm.start();

interface SocketData {
  token: string;
  roomId: string;
  playerId: number;
  bound: boolean;
}

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
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
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
  const body = readFileSync(safe);
  res.cork(() => {
    res.writeHeader("Content-Type", type);
    res.end(body);
  });
}

const app = uWS.App();

app.options("/*", (res) => {
  writeCors(res);
  res.endWithoutBody();
});

app.get("/health", (res) => {
  writeCors(res);
  res.writeHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, ...mm.stats }));
});

async function parseBody(res: uWS.HttpResponse): Promise<{ name: string; code: string }> {
  const body = await readBody(res);
  let name = "Player";
  let code = "";
  try {
    const parsed = JSON.parse(body || "{}");
    if (typeof parsed.name === "string" && parsed.name.trim()) name = parsed.name.trim().slice(0, 16);
    if (typeof parsed.code === "string") code = parsed.code.trim().toUpperCase().slice(0, 8);
  } catch {
    // ignore malformed body
  }
  return { name, code };
}

function sendJson(res: uWS.HttpResponse, obj: unknown, status?: string): void {
  // uWS requires writeStatus() before any writeHeader().
  if (status) res.writeStatus(status);
  writeCors(res);
  res.writeHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

app.post("/quickplay", async (res) => {
  res.onAborted(() => {});
  const { name } = await parseBody(res);
  sendJson(res, mm.quickplay(name));
});

app.post("/create", async (res) => {
  res.onAborted(() => {});
  const { name } = await parseBody(res);
  sendJson(res, mm.createPrivate(name));
});

app.post("/join", async (res) => {
  res.onAborted(() => {});
  const { name, code } = await parseBody(res);
  const result = mm.joinByCode(code, name);
  if (!result) {
    sendJson(res, { error: "room_not_found" }, "404 Not Found");
    return;
  }
  sendJson(res, result);
});

app.ws<SocketData>("/ws", {
  maxPayloadLength: 1024,
  idleTimeout: 60,
  maxBackpressure: 1024 * 1024,
  upgrade: (res, req, context) => {
    const token = new URLSearchParams(req.getQuery()).get("token") ?? "";
    res.upgrade<SocketData>(
      { token, roomId: "", playerId: -1, bound: false },
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
    const bound = mm.bindSocket(ud.token, send);
    if (!bound) {
      ws.end(1008, "invalid token");
      return;
    }
    ud.roomId = bound.roomId;
    ud.playerId = bound.playerId;
    ud.bound = true;
  },
  message: (ws, message) => {
    const ud = ws.getUserData();
    if (!ud.bound) return;
    const msg = decodeClient(message);
    if (!msg) return;
    if (msg.type === ClientMsg.PING) {
      ws.send(encodePong(msg.timestamp), true);
      return;
    }
    const room = mm.getRoom(ud.roomId);
    if (!room) return;
    if (msg.type === ClientMsg.INPUT_MOVE) {
      room.setMove(ud.playerId, msg.dir, msg.seq);
    } else if (msg.type === ClientMsg.INPUT_PLACE_BOMB) {
      room.placeBomb(ud.playerId);
    } else if (msg.type === ClientMsg.REQUEST_START) {
      room.requestStart(ud.playerId);
    }
  },
  close: (ws) => {
    const ud = ws.getUserData();
    if (ud.bound) mm.getRoom(ud.roomId)?.removePlayer(ud.playerId);
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
