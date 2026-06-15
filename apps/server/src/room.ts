import {
  TICK_MS,
  GRID_W,
  GRID_H,
  GRID_SIZE,
  BOMB_TIMER_MS,
  EXPLOSION_LIFETIME_MS,
  COUNTDOWN_MS,
  MATCH_LENGTH_MS,
  SUDDEN_DEATH_AT_MS,
  SUDDEN_DEATH_STEP_MS,
  END_SCREEN_MS,
  ROOM_LINGER_MS,
  LOBBY_COUNTDOWN_MS,
  PROTOCOL_VERSION,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  IDLE_KICK_MS,
  KICK_SPEED,
  PLAYER_HITBOX_RADIUS,
  RESPAWN_INVULN_MS,
  DRAW_WINNER_ID,
  Direction,
  MatchPhase,
  TileType,
  encodeSnapshot,
  encodePhase,
  encodeExplosion,
  encodeDeath,
  encodeKill,
  encodePickup,
  encodeMatchEnd,
  encodeWelcome,
  encodeRoomInfo,
  gridSectionUnchanged,
  gridSectionDelta,
  gridSectionFull,
  type PlayerSnapshot,
  type BombSnapshot,
  type RoomPlayerInfo,
} from "@bomberpump/shared";
import { createHash, randomBytes } from "node:crypto";
import { makeRng, encodeMatchSeed, stepMove } from "@bomberpump/shared";
import { World, SPAWNS, powerupOfTile } from "./world.js";
import { Player, type SendFn } from "./player.js";
import { Bomb, dirVector } from "./bomb.js";
import { BotController } from "./bot.js";
import { store, type MatchResult } from "./store.js";

const BOT_NAMES = ["Botzilla", "Fuse", "Boomer", "Sparky", "Dynamo", "Kral"];

const R = PLAYER_HITBOX_RADIUS;
const EMPTY_ROOM_TTL_MS = 30_000; // reap rooms with no human for this long
const RECONNECT_GRACE_MS = 25_000; // hold a dropped player's slot this long

export class Room {
  readonly id: string; // also used as the shareable room code
  readonly isPublic: boolean;
  readonly practice: boolean; // fill with bots and auto-start
  readonly world = new World();
  readonly players = new Map<number, Player>();
  private readonly bots = new Map<number, BotController>();
  bombs: Bomb[] = [];

  phase: MatchPhase = MatchPhase.LOBBY;
  private phaseTimerMs = 0; // counts down for COUNTDOWN
  private matchElapsedMs = 0;
  private endElapsedMs = 0;
  private suddenDeathTimerMs = 0;
  private suddenDeathIdx = 0;
  private spiral: Array<{ x: number; y: number }> = [];

  private nextPlayerId = 0;
  private nextBombId = 0;
  hostId = -1;
  private lobbyCounting = false;
  private lobbyCountdownMs = 0;
  private winnerId = DRAW_WINNER_ID;
  private lastHumanAtMs = Date.now();
  private readonly lastSentGrid = new Uint8Array(GRID_SIZE);
  private readonly needKeyframe = new Set<number>(); // players owed a full grid
  private seed = "";
  private seedCommit = "";
  private rng: () => number = Math.random;

  dead = false;

  constructor(id: string, isPublic: boolean, practice = false) {
    this.id = id;
    this.isPublic = isPublic;
    this.practice = practice;
    this.spiral = buildSpiral();
  }

  // -- membership -----------------------------------------------------------

  acceptsPlayers(): boolean {
    return this.phase === MatchPhase.LOBBY && this.players.size < MAX_PLAYERS_PER_ROOM;
  }

  get humanCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (!p.isBot) n++;
    return n;
  }

  private addBot(): void {
    const id = this.nextPlayerId++;
    const spawn = SPAWNS[this.players.size % SPAWNS.length];
    const name = BOT_NAMES[id % BOT_NAMES.length];
    const p = new Player(id, name, id % 4, spawn.x, spawn.y, () => {}, true);
    this.players.set(id, p);
    this.bots.set(id, new BotController());
  }

  addPlayer(name: string, skin: number, send: SendFn, wallet: string | null = null): Player {
    const id = this.nextPlayerId++;
    const spawn = SPAWNS[this.players.size % SPAWNS.length];
    const p = new Player(id, name, skin, spawn.x, spawn.y, send);
    p.wallet = wallet;
    this.players.set(id, p);
    this.needKeyframe.add(id);
    if (this.hostId < 0) this.hostId = id;
    send(encodeWelcome(id, GRID_W, GRID_H, PROTOCOL_VERSION));
    send(encodePhase(this.phase, this.phaseTimer()));
    this.broadcastRoomInfo();
    return p;
  }

  removePlayer(id: number): void {
    const existed = this.players.delete(id);
    if (!existed) return;
    this.bots.delete(id);
    if (this.hostId === id) {
      let next = -1;
      for (const p of this.players.values()) if (!p.isBot) { next = p.id; break; }
      this.hostId = next;
    }
    // Empty, or a practice room whose only human left -> close it.
    if (this.players.size === 0 || this.humanCount === 0) {
      this.dead = true;
      return;
    }
    if (this.phase === MatchPhase.PLAYING || this.phase === MatchPhase.SUDDEN_DEATH) {
      this.checkWin();
    }
    this.broadcastRoomInfo();
  }

  /** Socket dropped. During an active match, hold the slot for a grace window
   *  so the player can reconnect; otherwise remove immediately. */
  handleDisconnect(id: number): void {
    const p = this.players.get(id);
    if (!p) return;
    const active =
      this.phase === MatchPhase.PLAYING ||
      this.phase === MatchPhase.SUDDEN_DEATH ||
      this.phase === MatchPhase.COUNTDOWN;
    if (active && p.alive) {
      p.connected = false;
      p.disconnectedAtMs = Date.now();
      p.dir = Direction.NONE;
      p.send = () => {};
      this.broadcastRoomInfo();
    } else {
      this.removePlayer(id);
    }
  }

  /** Re-attach a reconnecting socket to its player and resync it. */
  rebind(id: number, send: SendFn): boolean {
    const p = this.players.get(id);
    if (!p) return false;
    p.send = send;
    p.connected = true;
    p.disconnectedAtMs = 0;
    this.needKeyframe.add(id);
    send(encodeWelcome(id, GRID_W, GRID_H, PROTOCOL_VERSION));
    send(encodePhase(this.phase, this.phaseTimer()));
    this.broadcastRoomInfo();
    return true;
  }

  /** Drop this room's reconnect-token entries (called when the room dies). */
  cleanupReconnect(map: Map<string, { roomId: string; playerId: number }>): void {
    for (const [rt, e] of map) if (e.roomId === this.id) map.delete(rt);
  }

  // -- input ----------------------------------------------------------------

  setMove(id: number, dir: Direction, seq: number): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (seq <= p.lastInputSeq) return;
    p.lastInputSeq = seq;
    p.dir = dir;
    if (dir !== Direction.NONE) p.lastMoveAtMs = Date.now();
  }

  placeBomb(id: number): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (this.phase !== MatchPhase.PLAYING && this.phase !== MatchPhase.SUDDEN_DEATH) return;
    if (p.bombsActive >= p.bombsMax) return;
    const cx = p.cellX;
    const cy = p.cellY;
    if (this.world.isSolid(cx, cy)) return; // e.g. standing inside a soft block with wall-pass
    if (this.bombs.some((b) => !b.exploded && b.x === cx && b.y === cy)) return;
    this.bombs.push({
      id: this.nextBombId++ & 0xff,
      ownerId: p.id,
      x: cx,
      y: cy,
      power: p.power,
      fuseLeftMs: BOMB_TIMER_MS,
      exploded: false,
      passThrough: new Set([p.id]),
      kickDir: Direction.NONE,
      kickProgressMs: 0,
    });
    p.bombsActive++;
  }

  /** Host pressed "Start now". */
  requestStart(id: number): void {
    if (id !== this.hostId) return;
    if (this.phase !== MatchPhase.LOBBY) return;
    if (this.players.size < MIN_PLAYERS_TO_START) return;
    this.start();
  }

  // -- main loop ------------------------------------------------------------

  tick(): void {
    const dt = TICK_MS;

    // Reaper: drop rooms that have had no human for too long (covers reserved
    // rooms whose socket never connected, and abandoned lobbies).
    // Expire players who dropped and didn't reconnect within the grace window.
    const now = Date.now();
    for (const p of [...this.players.values()]) {
      if (!p.connected && now - p.disconnectedAtMs > RECONNECT_GRACE_MS) this.removePlayer(p.id);
    }
    if (this.dead) return;

    if (this.humanCount > 0) this.lastHumanAtMs = Date.now();
    else if (Date.now() - this.lastHumanAtMs > EMPTY_ROOM_TTL_MS) {
      this.dead = true;
      return;
    }

    switch (this.phase) {
      case MatchPhase.LOBBY:
        this.tickLobby(dt);
        break;
      case MatchPhase.COUNTDOWN:
        this.phaseTimerMs -= dt;
        if (this.phaseTimerMs <= 0) this.setPhase(MatchPhase.PLAYING);
        break;
      case MatchPhase.PLAYING:
      case MatchPhase.SUDDEN_DEATH:
        this.simulate(dt);
        break;
      case MatchPhase.END:
        this.endElapsedMs += dt;
        if (this.endElapsedMs >= END_SCREEN_MS + ROOM_LINGER_MS) {
          if (this.players.size > 0) this.resetToLobby();
          else this.dead = true;
        }
        break;
    }

    if (this.phase !== MatchPhase.LOBBY) this.broadcastSnapshot();
  }

  private tickLobby(dt: number): void {
    // Practice room: fill with bots and start as soon as a human is present.
    if (this.practice && this.humanCount >= 1) {
      while (this.players.size < MAX_PLAYERS_PER_ROOM) this.addBot();
      this.start();
      return;
    }
    if (this.players.size >= MAX_PLAYERS_PER_ROOM) {
      this.start();
      return;
    }
    if (this.players.size >= MIN_PLAYERS_TO_START) {
      if (!this.lobbyCounting) {
        this.lobbyCounting = true;
        this.lobbyCountdownMs = LOBBY_COUNTDOWN_MS;
        this.broadcastRoomInfo();
      }
      this.lobbyCountdownMs -= dt;
      if (this.lobbyCountdownMs <= 0) this.start();
    } else if (this.lobbyCounting) {
      this.lobbyCounting = false;
      this.lobbyCountdownMs = 0;
      this.broadcastRoomInfo();
    }
  }

  private setPhase(phase: MatchPhase): void {
    this.phase = phase;
    if (phase === MatchPhase.COUNTDOWN) this.phaseTimerMs = COUNTDOWN_MS;
    if (phase === MatchPhase.END) this.endElapsedMs = 0;
    this.broadcast(encodePhase(phase, this.phaseTimer()));
  }

  private phaseTimer(): number {
    switch (this.phase) {
      case MatchPhase.COUNTDOWN:
        return Math.max(0, this.phaseTimerMs);
      case MatchPhase.PLAYING:
      case MatchPhase.SUDDEN_DEATH:
        return Math.max(0, MATCH_LENGTH_MS - this.matchElapsedMs);
      case MatchPhase.END:
        return Math.max(0, END_SCREEN_MS - this.endElapsedMs);
      default:
        return 0;
    }
  }

  private start(): void {
    this.lobbyCounting = false;
    this.lobbyCountdownMs = 0;
    // Provably-fair: seed the map RNG, commit to its hash now, reveal at the end.
    this.seed = randomBytes(8).toString("hex");
    this.seedCommit = createHash("sha256").update(this.seed).digest("hex");
    this.rng = makeRng(this.seed);
    this.world.generate(this.rng);
    let i = 0;
    for (const p of this.players.values()) {
      const s = SPAWNS[i % SPAWNS.length];
      p.resetForMatch(s.x, s.y);
      p.lastMoveAtMs = Date.now();
      i++;
    }
    this.bombs = [];
    this.matchElapsedMs = 0;
    this.suddenDeathTimerMs = 0;
    this.suddenDeathIdx = 0;
    // New map -> everyone needs a full keyframe on the first snapshot.
    this.needKeyframe.clear();
    for (const id of this.players.keys()) this.needKeyframe.add(id);
    this.broadcast(encodeMatchSeed(this.seedCommit, "")); // commit only
    this.setPhase(MatchPhase.COUNTDOWN);
  }

  private resetToLobby(): void {
    this.phase = MatchPhase.LOBBY;
    this.bombs = [];
    this.world.fire.fill(0);
    this.world.fireOwner.fill(-1);
    this.lobbyCounting = false;
    this.lobbyCountdownMs = 0;
    this.winnerId = DRAW_WINNER_ID;
    this.broadcast(encodePhase(MatchPhase.LOBBY, 0));
    this.broadcastRoomInfo();
  }

  private simulate(dt: number): void {
    this.matchElapsedMs += dt;

    // Bots decide their inputs first.
    for (const [id, ctrl] of this.bots) {
      const bot = this.players.get(id);
      if (bot && bot.alive) ctrl.update(this, bot, dt);
    }

    for (const p of this.players.values()) {
      if (p.alive) this.movePlayer(p, dt);
    }
    for (const b of this.bombs) this.slideBomb(b, dt);

    for (const b of this.bombs) {
      if (b.exploded) continue;
      b.fuseLeftMs -= dt;
      if (b.fuseLeftMs <= 0) this.detonate(b);
    }
    this.bombs = this.bombs.filter((b) => !b.exploded);

    const fire = this.world.fire;
    for (let i = 0; i < fire.length; i++) {
      if (fire[i] > 0) {
        fire[i] -= dt;
        if (fire[i] <= 0) {
          fire[i] = 0;
          this.world.fireOwner[i] = -1;
        }
      }
    }

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const i = this.world.idx(p.cellX, p.cellY);
      if (fire[i] > 0) {
        this.hit(p, false, this.world.fireOwner[i]);
        continue;
      }
      const pu = powerupOfTile(this.world.tile(p.cellX, p.cellY));
      if (pu !== null) {
        p.applyPowerup(pu);
        this.world.set(p.cellX, p.cellY, TileType.EMPTY);
        this.broadcast(encodePickup(p.id, pu));
      }
    }

    for (const b of this.bombs) {
      for (const pid of [...b.passThrough]) {
        const pl = this.players.get(pid);
        if (!pl || pl.cellX !== b.x || pl.cellY !== b.y) b.passThrough.delete(pid);
      }
    }

    const now = Date.now();
    for (const p of this.players.values()) {
      if (p.alive && now - p.lastMoveAtMs > IDLE_KICK_MS) this.hit(p, true);
    }

    if (this.matchElapsedMs >= SUDDEN_DEATH_AT_MS) {
      if (this.phase !== MatchPhase.SUDDEN_DEATH) this.setPhase(MatchPhase.SUDDEN_DEATH);
      this.suddenDeath(dt);
    }

    if (this.matchElapsedMs >= MATCH_LENGTH_MS) {
      this.checkWin(true);
      return;
    }
    this.checkWin();
  }

  // -- movement -------------------------------------------------------------

  private movePlayer(p: Player, dt: number): void {
    if (p.dir === Direction.NONE) return;
    const dist = (p.speed * dt) / 1000;
    const res = stepMove(p.x, p.y, p.dir, dist, R, (cx, cy) => this.blockedFor(cx, cy, p, p.dir));
    p.x = res.x;
    p.y = res.y;
  }

  private blockedFor(cx: number, cy: number, p: Player, dir: Direction): boolean {
    if (!this.world.inBounds(cx, cy)) return true;
    if (this.world.isHard(cx, cy)) return true;
    if (this.world.isSoft(cx, cy)) return !p.wallPass; // wall-pass walks through soft
    const bomb = this.bombs.find((b) => !b.exploded && b.x === cx && b.y === cy);
    if (!bomb) return false;
    if (bomb.passThrough.has(p.id)) return false;
    if (p.kick && bomb.kickDir === Direction.NONE) {
      bomb.kickDir = dir;
      bomb.kickProgressMs = 0;
    }
    return true;
  }

  private slideBomb(b: Bomb, dt: number): void {
    if (b.exploded || b.kickDir === Direction.NONE) return;
    const cellTime = 1000 / KICK_SPEED;
    b.kickProgressMs += dt;
    while (b.kickProgressMs >= cellTime) {
      b.kickProgressMs -= cellTime;
      const { dx, dy } = dirVector(b.kickDir);
      const nx = b.x + dx;
      const ny = b.y + dy;
      const blocked =
        this.world.isSolid(nx, ny) ||
        this.bombs.some((o) => o !== b && !o.exploded && o.x === nx && o.y === ny) ||
        [...this.players.values()].some((pl) => pl.alive && pl.cellX === nx && pl.cellY === ny);
      if (blocked) {
        b.kickDir = Direction.NONE;
        return;
      }
      b.x = nx;
      b.y = ny;
    }
  }

  // -- explosions -----------------------------------------------------------

  private detonate(b: Bomb): void {
    if (b.exploded) return;
    b.exploded = true;
    const owner = this.players.get(b.ownerId);
    if (owner) owner.bombsActive = Math.max(0, owner.bombsActive - 1);

    const cells: Array<{ x: number; y: number }> = [];
    const ignite = (x: number, y: number) => {
      const i = this.world.idx(x, y);
      this.world.fire[i] = EXPLOSION_LIFETIME_MS;
      this.world.fireOwner[i] = b.ownerId;
      cells.push({ x, y });
    };

    ignite(b.x, b.y);

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      for (let r = 1; r <= b.power; r++) {
        const nx = b.x + dx * r;
        const ny = b.y + dy * r;
        if (!this.world.inBounds(nx, ny)) break;
        if (this.world.isHard(nx, ny)) break;
        if (this.world.isSoft(nx, ny)) {
          this.world.destroySoft(nx, ny, this.rng);
          ignite(nx, ny);
          break;
        }
        ignite(nx, ny);
        if (powerupOfTile(this.world.tile(nx, ny)) !== null) {
          this.world.set(nx, ny, TileType.EMPTY);
        }
        const other = this.bombs.find((o) => !o.exploded && o.x === nx && o.y === ny);
        if (other) this.detonate(other);
      }
    }

    this.broadcast(encodeExplosion(cells));
  }

  private suddenDeath(dt: number): void {
    this.suddenDeathTimerMs += dt;
    while (
      this.suddenDeathTimerMs >= SUDDEN_DEATH_STEP_MS &&
      this.suddenDeathIdx < this.spiral.length
    ) {
      this.suddenDeathTimerMs -= SUDDEN_DEATH_STEP_MS;
      const cell = this.spiral[this.suddenDeathIdx++];
      this.world.set(cell.x, cell.y, TileType.HARD);
      this.bombs = this.bombs.filter((b) => !(b.x === cell.x && b.y === cell.y));
      for (const p of this.players.values()) {
        if (p.alive && p.cellX === cell.x && p.cellY === cell.y) this.hit(p, true);
      }
    }
  }

  /** Take a hit: lose a life and respawn, or get eliminated. `eliminate`
   *  forces a full kill (idle-kick, sudden-death wall) ignoring lives/invuln.
   *  `killerId` is the bomb owner whose fire landed the hit (-1 = environment). */
  private hit(p: Player, eliminate = false, killerId = -1): void {
    if (!p.alive) return;
    const now = Date.now();
    if (!eliminate && now < p.invulnUntilMs) return; // protected after respawn

    // Frag accounting.
    if (killerId >= 0 && killerId !== p.id) {
      const killer = this.players.get(killerId);
      if (killer) killer.frags += 1;
    } else if (killerId === p.id) {
      p.frags = Math.max(0, p.frags - 1); // suicide penalty
    }
    this.broadcast(encodeKill(killerId >= 0 ? killerId : 255, p.id));

    p.deaths += 1;
    p.lives = eliminate ? 0 : p.lives - 1;
    this.broadcast(encodeDeath(p.id)); // VFX/sound on every hit
    if (p.lives <= 0) {
      p.alive = false;
      p.dir = Direction.NONE;
    } else {
      this.respawn(p, now);
    }
  }

  private respawn(p: Player, now: number): void {
    const cell = this.findSafeCell();
    p.x = cell.x + 0.5;
    p.y = cell.y + 0.5;
    p.dir = Direction.NONE;
    p.invulnUntilMs = now + RESPAWN_INVULN_MS;
    p.lastMoveAtMs = now;
  }

  private findSafeCell(): { x: number; y: number } {
    const ok = (x: number, y: number) =>
      this.world.tile(x, y) === TileType.EMPTY &&
      this.world.fire[this.world.idx(x, y)] === 0 &&
      !this.bombs.some((b) => !b.exploded && b.x === x && b.y === y);
    for (const s of SPAWNS) if (ok(s.x, s.y)) return s;
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) {
        if (ok(x, y)) return { x, y };
      }
    }
    return SPAWNS[0];
  }

  private checkWin(timeUp = false): void {
    if (this.phase !== MatchPhase.PLAYING && this.phase !== MatchPhase.SUDDEN_DEATH) return;
    const aliveIds: number[] = [];
    for (const p of this.players.values()) if (p.alive) aliveIds.push(p.id);
    if (aliveIds.length <= 1 || timeUp) {
      this.winnerId = aliveIds.length === 1 ? aliveIds[0] : DRAW_WINNER_ID;
      this.setPhase(MatchPhase.END);
      this.broadcast(encodeMatchEnd(this.winnerId));
      this.broadcast(encodeMatchSeed(this.seedCommit, this.seed)); // reveal
      this.recordStats();
    }
  }

  /** Persist ranked stats for wallet-authenticated humans (not practice/bots). */
  private recordStats(): void {
    if (this.practice) return;
    const results: MatchResult[] = [];
    for (const p of this.players.values()) {
      if (p.isBot || !p.wallet) continue;
      results.push({
        wallet: p.wallet,
        name: p.name,
        skin: p.skin,
        won: p.id === this.winnerId,
        frags: p.frags,
        deaths: p.deaths,
      });
    }
    if (results.length) void store.recordMatch(results);
  }

  // -- networking -----------------------------------------------------------

  private broadcast(bytes: Uint8Array): void {
    for (const p of this.players.values()) p.send(bytes);
  }

  private broadcastRoomInfo(): void {
    const list: RoomPlayerInfo[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
    }));
    const countdown = this.lobbyCounting ? this.lobbyCountdownMs : 0;
    for (const p of this.players.values()) {
      p.send(encodeRoomInfo(this.id, this.hostId, p.id === this.hostId, countdown, list));
    }
  }

  private broadcastSnapshot(): void {
    const now = Date.now();
    const players: PlayerSnapshot[] = [];
    for (const p of this.players.values()) {
      players.push({
        id: p.id,
        x: p.x,
        y: p.y,
        bombsMax: p.bombsMax,
        power: p.power,
        speed: p.speed,
        alive: p.alive,
        kick: p.kick,
        wallPass: p.wallPass,
        lives: p.lives,
        invuln: now < p.invulnUntilMs,
        frags: p.frags,
      });
    }
    const bombs: BombSnapshot[] = this.bombs
      .filter((b) => !b.exploded)
      .map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        power: b.power,
        fuseLeftMs: Math.max(0, Math.round(b.fuseLeftMs)),
      }));

    // Delta-encode the grid vs what was last broadcast.
    const cur = this.world.snapshotGrid(); // reused buffer
    const changes: Array<{ i: number; v: number }> = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      if (cur[i] !== this.lastSentGrid[i]) changes.push({ i, v: cur[i] });
    }
    let section: Uint8Array;
    if (changes.length === 0) section = gridSectionUnchanged();
    else if (changes.length * 2 + 2 < GRID_SIZE + 1) section = gridSectionDelta(changes);
    else section = gridSectionFull(cur);

    const tick = Math.floor(this.matchElapsedMs / TICK_MS);
    const deltaMsg = encodeSnapshot(tick, players, bombs, section);
    let fullMsg: Uint8Array | null = null;
    for (const p of this.players.values()) {
      if (p.isBot) continue;
      if (this.needKeyframe.has(p.id)) {
        if (!fullMsg) fullMsg = encodeSnapshot(tick, players, bombs, gridSectionFull(cur));
        p.send(fullMsg);
      } else {
        p.send(deltaMsg);
      }
    }
    this.needKeyframe.clear();
    this.lastSentGrid.set(cur);
  }
}

function buildSpiral(): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  let top = 1;
  let bottom = GRID_H - 2;
  let left = 1;
  let right = GRID_W - 2;
  while (top <= bottom && left <= right) {
    for (let x = left; x <= right; x++) cells.push({ x, y: top });
    for (let y = top + 1; y <= bottom; y++) cells.push({ x: right, y });
    if (top < bottom) for (let x = right - 1; x >= left; x--) cells.push({ x, y: bottom });
    if (left < right) for (let y = bottom - 1; y > top; y--) cells.push({ x: left, y });
    top++;
    bottom--;
    left++;
    right--;
  }
  return cells;
}
