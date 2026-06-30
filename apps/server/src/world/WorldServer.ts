// WorldServer.ts — Co-op WebSocket server for BomberMeme World (Issue #6)
// Port 9001 (arena lives on 9000). 20Hz tick, delta sync, client prediction,
// server reconciliation, anti-cheat, party system, Neon persistence.

import uWS from "uWebSockets.js";
import pg from "pg";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WorldClientMsg,
  WorldServerMsg,
  type WorldInputState,
  type EntitySnapshot,
  type WorldWelcomeMsg,
  type PartyUpdateMsg,
  type PartyErrorMsg,
} from "@bomberpump/shared";
import { EntitySync } from "./EntitySync.js";
import { CoopManager } from "./CoopManager.js";
import { type PlayerSession, incrIpConns, decrIpConns, sessionsByIp } from "./PlayerSession.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WORLD_PORT = Number(process.env.WORLD_PORT ?? 9001);
const TICK_RATE_HZ = 20;
const TICK_MS = 1000 / TICK_RATE_HZ;
const WS_MAX_PER_IP = Number(process.env.WS_MAX_PER_IP_WORLD) || 8;
const WS_RATE = 130; // msgs/sec token bucket
const WS_BURST = 200;
const PLAYER_SPEED = 160; // pixels/sec
const WORLD_BOUNDS = { minX: 0, minY: 0, maxX: 2560, maxY: 2560 };

/** DB helper using the same pg pattern as store.ts */
function createPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[world] no DATABASE_URL — running without persistence");
    return null;
  }
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (e) => console.error("[world] pg pool error", e));
  return pool;
}

async function migrate(pool: pg.Pool): Promise<void> {
  const sqlPath = join(__dirname, "schema.sql");
  try {
    const sql = readFileSync(sqlPath, "utf-8");
    await pool.query(sql);
    console.log("[world] schema migrated");
  } catch (e) {
    console.error("[world] schema migration failed:", (e as Error).message);
  }
}

interface WSUserData {
  sessionId: string;
  characterId: string;
  ip: string;
}

export class WorldServer {
  private app = uWS.App();
  private pool: pg.Pool | null = createPool();
  private entitySync = new EntitySync();
  private coop = new CoopManager();
  private sessions = new Map<string, PlayerSession>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /** Boot: migrate schema and start the WS + game loop. */
  async start(): Promise<void> {
    if (this.pool) await migrate(this.pool);
    this.setupRoutes();
    this.app.listen(WORLD_PORT, (token) => {
      if (token) {
        console.log(`[world] WorldServer listening on :${WORLD_PORT}`);
        this.running = true;
        this.tickTimer = setInterval(() => this.gameLoop(), TICK_MS);
      } else {
        console.error(`[world] FAILED to listen on :${WORLD_PORT}`);
        process.exit(1);
      }
    });
  }

  stop(): void {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    for (const s of this.sessions.values()) {
      try { s.ws.close(); } catch { /* ignore */ }
    }
    this.sessions.clear();
    this.pool?.end();
  }

  // ─── HTTP + WebSocket routes ─────────────────────────────────────────────

  private setupRoutes(): void {
    // Health check
    this.app.get("/world/health", (res) => {
      res.onAborted(() => {});
      res.cork(() => {
        res.writeHeader("Content-Type", "application/json");
        res.writeHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({ ok: this.running, port: WORLD_PORT, tickRate: TICK_RATE_HZ, players: this.sessions.size }));
      });
    });

    // WebSocket endpoint
    this.app.ws<WSUserData>("/world", {
      maxPayloadLength: 4096,
      idleTimeout: 120,
      maxBackpressure: 1024 * 1024,

      upgrade: (res, req, context) => {
        const ip = this.clientIp(res, req);
        if ((sessionsByIp.get(ip) ?? 0) >= WS_MAX_PER_IP) {
          res.cork(() => res.writeStatus("429 Too Many Requests").end());
          return;
        }

        const qs = new URLSearchParams(req.getQuery());
        const token = qs.get("token") ?? "";
        const characterId = qs.get("characterId") ?? "";
        if (!token || !characterId) {
          res.cork(() => res.writeStatus("401 Unauthorized").end());
          return;
        }

        incrIpConns(ip);
        res.upgrade<WSUserData>(
          { sessionId: crypto.randomUUID(), characterId, ip },
          req.getHeader("sec-websocket-key"),
          req.getHeader("sec-websocket-protocol"),
          req.getHeader("sec-websocket-extensions"),
          context,
        );
      },

      open: (ws) => {
        const ud = ws.getUserData();
        const session = this.onPlayerConnect(ws, ud.sessionId, ud.characterId);
        if (!session) {
          ws.end(1008, "auth_failed");
          return;
        }
        (ws as unknown as Record<string, unknown>).__sessionId = ud.sessionId;
      },

      message: (ws, message) => {
        const ud = ws.getUserData();
        const session = this.sessions.get(ud.sessionId);
        if (!session) return;

        // Rate limit
        const now = Date.now();
        session.msgTokens = Math.min(WS_BURST, session.msgTokens + ((now - session.msgTs) / 1000) * WS_RATE);
        session.msgTs = now;
        if (session.msgTokens < 1) return;
        session.msgTokens -= 1;

        this.handleMessage(session, message);
      },

      close: (ws) => {
        const ud = ws.getUserData();
        decrIpConns(ud.ip);
        const session = this.sessions.get(ud.sessionId);
        if (session) this.onPlayerDisconnect(session);
      },
    });
  }

  // ─── Connection lifecycle ────────────────────────────────────────────────

  private onPlayerConnect(
    ws: uWS.WebSocket<WSUserData>,
    sessionId: string,
    characterId: string,
  ): PlayerSession | null {
    // TODO: validate token against auth system; for now accept all
    const name = `Player_${characterId.slice(0, 6)}`;
    const heroId = "hero_1";
    const level = 1;

    const session: PlayerSession = {
      id: sessionId,
      ws: ws as unknown as PlayerSession["ws"],
      characterId,
      name,
      partyId: undefined,
      lastInputTick: 0,
      pingMs: 0,
      x: 1280,
      y: 1280,
      vx: 0,
      vy: 0,
      hp: 100,
      maxHp: 100,
      direction: "down",
      animation: "idle",
      heroId,
      level,
      msgTokens: WS_BURST,
      msgTs: Date.now(),
      connectedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.entitySync.purgeSession(sessionId);

    // Send welcome
    const welcome: WorldWelcomeMsg = {
      type: WorldServerMsg.WELCOME,
      playerId: characterId,
      tick: this.entitySync.getTick(),
      worldId: "grasslands",
      spawnPos: { x: session.x, y: session.y },
    };
    this.sendJson(ws, welcome);

    // Add to entity sync
    this.entitySync.currentEntities.set(characterId, this.sessionToSnapshot(session));

    return session;
  }

  private onPlayerDisconnect(session: PlayerSession): void {
    this.coop.setOnline(session.characterId, false);
    this.coop.leaveParty(session.characterId);
    this.entitySync.currentEntities.delete(session.characterId);
    this.entitySync.purgeSession(session.id);
    this.sessions.delete(session.id);
  }

  // ─── Message handling ────────────────────────────────────────────────────

  private handleMessage(session: PlayerSession, message: ArrayBuffer): void {
    try {
      const data = JSON.parse(Buffer.from(message).toString());
      const msgType = data?.type as number;

      switch (msgType) {
        case WorldClientMsg.INPUT:
          this.onPlayerInput(session, data.payload as WorldInputState);
          break;
        case WorldClientMsg.PING:
          this.sendJson(session.ws, {
            type: WorldServerMsg.PONG,
            clientTimestamp: data.timestamp as number,
            serverTimestamp: Date.now(),
          });
          break;
        case WorldClientMsg.PARTY_CREATE: {
          const party = this.coop.createParty(session.characterId, session.name, session.level, session.heroId);
          session.partyId = party.id;
          const update: PartyUpdateMsg = { type: WorldServerMsg.PARTY_UPDATE, party };
          this.broadcastToParty(party.id, update);
          break;
        }
        case WorldClientMsg.PARTY_JOIN: {
          const code = String(data.code ?? "");
          const result = this.coop.joinParty(code, session.characterId, session.name, session.level, session.heroId);
          if (result.success && result.party) {
            session.partyId = result.party.id;
            const update: PartyUpdateMsg = { type: WorldServerMsg.PARTY_UPDATE, party: result.party };
            this.broadcastToParty(result.party.id, update);
          } else {
            const err: PartyErrorMsg = { type: WorldServerMsg.PARTY_ERROR, code: result.error ?? "unknown", message: result.error ?? "unknown" };
            this.sendJson(session.ws, err);
          }
          break;
        }
        case WorldClientMsg.PARTY_LEAVE: {
          const pid = session.partyId;
          if (pid) {
            this.coop.leaveParty(session.characterId);
            session.partyId = undefined;
            const remaining = this.coop.getParty(pid);
            if (remaining) {
              const update: PartyUpdateMsg = { type: WorldServerMsg.PARTY_UPDATE, party: remaining };
              this.broadcastToParty(pid, update);
            }
          }
          break;
        }
        case WorldClientMsg.PARTY_KICK: {
          const pid = session.partyId;
          if (pid) {
            this.coop.kickMember(session.characterId, String(data.targetId ?? ""));
            const remaining = this.coop.getParty(pid);
            if (remaining) {
              const update: PartyUpdateMsg = { type: WorldServerMsg.PARTY_UPDATE, party: remaining };
              this.broadcastToParty(pid, update);
            }
          }
          break;
        }
        case WorldClientMsg.PARTY_TRANSFER: {
          const pid = session.partyId;
          if (pid) {
            this.coop.transferLeadership(session.characterId, String(data.newLeaderId ?? ""));
            const party = this.coop.getParty(pid);
            if (party) {
              const update: PartyUpdateMsg = { type: WorldServerMsg.PARTY_UPDATE, party };
              this.broadcastToParty(pid, update);
            }
          }
          break;
        }
        case WorldClientMsg.PARTY_SET_LOOT: {
          const pid = session.partyId;
          if (pid) {
            this.coop.setLootMode(session.characterId, String(data.mode ?? "free") as "free" | "round_robin" | "leader");
            const party = this.coop.getParty(pid);
            if (party) {
              const update: PartyUpdateMsg = { type: WorldServerMsg.PARTY_UPDATE, party };
              this.broadcastToParty(pid, update);
            }
          }
          break;
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }

  private onPlayerInput(session: PlayerSession, input: WorldInputState): void {
    // Anti-cheat: clamp movement vector
    const moveX = Math.max(-1, Math.min(1, input.moveX ?? 0));
    const moveY = Math.max(-1, Math.min(1, input.moveY ?? 0));

    // Compute proposed new position
    const speedPerTick = PLAYER_SPEED / TICK_RATE_HZ;
    let nx = session.x + moveX * speedPerTick;
    let ny = session.y + moveY * speedPerTick;

    // World bounds clamp
    nx = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, nx));
    ny = Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, ny));

    // TODO: collision with obstacles, other entities

    // Validate speed (anti-cheat)
    const dx = nx - session.x;
    const dy = ny - session.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= speedPerTick * 1.5) {
      session.x = nx;
      session.y = ny;
      session.vx = moveX * PLAYER_SPEED;
      session.vy = moveY * PLAYER_SPEED;
      session.direction = this.vecToDir(moveX, moveY) ?? session.direction;
      session.animation = dist > 0.1 ? "run" : "idle";
    }

    session.lastInputTick = input.tick ?? this.entitySync.getTick();

    // Update entity snapshot
    this.entitySync.currentEntities.set(session.characterId, this.sessionToSnapshot(session));
  }

  // ─── Game Loop (20Hz) ────────────────────────────────────────────────────

  private gameLoop(): void {
    this.entitySync.incrementTick();

    // 1. Build per-session deltas and broadcast
    for (const session of this.sessions.values()) {
      const delta = this.entitySync.buildDelta(session);
      if (delta.updated.length || delta.removed.length || delta.added.length) {
        this.sendJson(session.ws, { type: WorldServerMsg.DELTA_STATE, delta });
      }
    }

    // 2. Persist positions every ~5 seconds (every 100 ticks at 20Hz)
    const tick = this.entitySync.getTick();
    if (tick % 100 === 0) {
      this.flushPositions();
    }

    // 3. Party GC every 30 seconds (every 600 ticks)
    if (tick % 600 === 0) {
      this.coop.gc();
    }
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private async flushPositions(): Promise<void> {
    if (!this.pool) return;
    const positions: Array<{ characterId: string; x: number; y: number }> = [];
    for (const s of this.sessions.values()) {
      positions.push({ characterId: s.characterId, x: s.x, y: s.y });
    }
    if (!positions.length) return;

    try {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        for (const p of positions) {
          await client.query(
            `UPDATE world_characters SET position_x = $1, position_y = $2, updated_at = NOW() WHERE id = $3`,
            [p.x, p.y, p.characterId],
          );
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("[world] flushPositions failed:", (e as Error).message);
      } finally {
        client.release();
      }
    } catch (e) {
      console.error("[world] flushPositions pool error:", (e as Error).message);
    }
  }

  /** Load a character from the DB. Returns null if not found / no DB. */
  async loadCharacter(characterId: string): Promise<{ x: number; y: number; level: number; heroId: string; name: string; hp: number; maxHp: number } | null> {
    if (!this.pool) return null;
    try {
      const res = await this.pool.query(
        `SELECT position_x, position_y, level, hero_id, name, attributes FROM world_characters WHERE id = $1`,
        [characterId],
      );
      const row = res.rows[0];
      if (!row) return null;
      const attrs = row.attributes ?? { vit: 5 };
      const maxHp = 100 + (attrs.vit ?? 5) * 10;
      return { x: row.position_x, y: row.position_y, level: row.level, heroId: row.hero_id, name: row.name, hp: maxHp, maxHp };
    } catch (e) {
      console.error("[world] loadCharacter failed:", (e as Error).message);
      return null;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private sessionToSnapshot(session: PlayerSession): EntitySnapshot {
    return {
      id: session.characterId,
      type: "player",
      position: { x: session.x, y: session.y },
      velocity: { x: session.vx, y: session.vy },
      hp: session.hp,
      maxHp: session.maxHp,
      animation: session.animation,
      direction: session.direction,
    };
  }

  private vecToDir(x: number, y: number): "up" | "down" | "left" | "right" | null {
    if (Math.abs(x) > Math.abs(y)) {
      return x > 0 ? "right" : "left";
    } else if (Math.abs(y) > 0.1) {
      return y > 0 ? "down" : "up";
    }
    return null;
  }

  private sendJson(ws: PlayerSession["ws"], obj: unknown): void {
    try {
      (ws as unknown as { send: (data: string, compress: boolean) => void }).send(JSON.stringify(obj), true);
    } catch {
      // socket closing
    }
  }

  private broadcastToParty(partyId: string, msg: unknown): void {
    const party = this.coop.getParty(partyId);
    if (!party) return;
    for (const member of party.members) {
      for (const session of this.sessions.values()) {
        if (session.characterId === member.characterId) {
          this.sendJson(session.ws, msg);
          break;
        }
      }
    }
  }

  private clientIp(res: uWS.HttpResponse, req: uWS.HttpRequest): string {
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
}

// ─── Direct execution (for standalone boot) ──────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new WorldServer();
  server.start().catch((e) => {
    console.error("[world] boot failed:", e);
    process.exit(1);
  });
}
