import {
  TICK_MS,
  GRID_W,
  GRID_H,
  BOMB_TIMER_MS,
  EXPLOSION_LIFETIME_MS,
  COUNTDOWN_MS,
  MATCH_LENGTH_MS,
  SUDDEN_DEATH_AT_MS,
  SUDDEN_DEATH_STEP_MS,
  END_SCREEN_MS,
  ROOM_LINGER_MS,
  LOBBY_COUNTDOWN_MS,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  IDLE_KICK_MS,
  KICK_SPEED,
  PLAYER_HITBOX_RADIUS,
  DRAW_WINNER_ID,
  Direction,
  MatchPhase,
  TileType,
  encodeSnapshot,
  encodePhase,
  encodeExplosion,
  encodeDeath,
  encodePickup,
  encodeMatchEnd,
  encodeWelcome,
  encodeRoomInfo,
  type PlayerSnapshot,
  type BombSnapshot,
  type RoomPlayerInfo,
} from "@bomberpump/shared";
import { World, SPAWNS, powerupOfTile } from "./world.js";
import { Player, type SendFn } from "./player.js";
import { Bomb, dirVector } from "./bomb.js";

const R = PLAYER_HITBOX_RADIUS;
const EPS = 1e-4;

export class Room {
  readonly id: string; // also used as the shareable room code
  readonly isPublic: boolean;
  readonly world = new World();
  readonly players = new Map<number, Player>();
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

  dead = false;

  constructor(id: string, isPublic: boolean) {
    this.id = id;
    this.isPublic = isPublic;
    this.spiral = buildSpiral();
  }

  // -- membership -----------------------------------------------------------

  acceptsPlayers(): boolean {
    return this.phase === MatchPhase.LOBBY && this.players.size < MAX_PLAYERS_PER_ROOM;
  }

  addPlayer(name: string, send: SendFn): Player {
    const id = this.nextPlayerId++;
    const spawn = SPAWNS[this.players.size % SPAWNS.length];
    const p = new Player(id, name, spawn.x, spawn.y, send);
    this.players.set(id, p);
    if (this.hostId < 0) this.hostId = id;
    send(encodeWelcome(id, GRID_W, GRID_H));
    send(encodePhase(this.phase, this.phaseTimer()));
    this.broadcastRoomInfo();
    return p;
  }

  removePlayer(id: number): void {
    const existed = this.players.delete(id);
    if (!existed) return;
    if (this.hostId === id) {
      const next = this.players.keys().next();
      this.hostId = next.done ? -1 : next.value;
    }
    if (this.players.size === 0) {
      this.dead = true;
      return;
    }
    if (this.phase === MatchPhase.PLAYING || this.phase === MatchPhase.SUDDEN_DEATH) {
      this.checkWin();
    }
    this.broadcastRoomInfo();
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
    this.world.generate();
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
    this.setPhase(MatchPhase.COUNTDOWN);
  }

  private resetToLobby(): void {
    this.phase = MatchPhase.LOBBY;
    this.bombs = [];
    this.world.fire.fill(0);
    this.lobbyCounting = false;
    this.lobbyCountdownMs = 0;
    this.winnerId = DRAW_WINNER_ID;
    this.broadcast(encodePhase(MatchPhase.LOBBY, 0));
    this.broadcastRoomInfo();
  }

  private simulate(dt: number): void {
    this.matchElapsedMs += dt;

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
        if (fire[i] < 0) fire[i] = 0;
      }
    }

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const i = this.world.idx(p.cellX, p.cellY);
      if (fire[i] > 0) {
        this.killPlayer(p);
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
      if (p.alive && now - p.lastMoveAtMs > IDLE_KICK_MS) this.killPlayer(p);
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
    const { dx, dy } = dirVector(p.dir);
    if (dx !== 0) {
      const cy = Math.floor(p.y) + 0.5;
      p.y += clampToward(cy - p.y, dist);
      this.moveX(p, dx * dist);
    } else if (dy !== 0) {
      const cx = Math.floor(p.x) + 0.5;
      p.x += clampToward(cx - p.x, dist);
      this.moveY(p, dy * dist);
    }
  }

  private moveX(p: Player, step: number): void {
    const newX = p.x + step;
    const edge = step > 0 ? newX + R : newX - R;
    const cellX = Math.floor(edge);
    const rowTop = Math.floor(p.y - R + EPS);
    const rowBot = Math.floor(p.y + R - EPS);
    for (let row = rowTop; row <= rowBot; row++) {
      if (this.blockedFor(cellX, row, p, step > 0 ? Direction.RIGHT : Direction.LEFT)) {
        p.x = step > 0 ? cellX - R - EPS : cellX + 1 + R + EPS;
        return;
      }
    }
    p.x = newX;
  }

  private moveY(p: Player, step: number): void {
    const newY = p.y + step;
    const edge = step > 0 ? newY + R : newY - R;
    const cellY = Math.floor(edge);
    const colL = Math.floor(p.x - R + EPS);
    const colR = Math.floor(p.x + R - EPS);
    for (let col = colL; col <= colR; col++) {
      if (this.blockedFor(col, cellY, p, step > 0 ? Direction.DOWN : Direction.UP)) {
        p.y = step > 0 ? cellY - R - EPS : cellY + 1 + R + EPS;
        return;
      }
    }
    p.y = newY;
  }

  private blockedFor(cx: number, cy: number, p: Player, dir: Direction): boolean {
    if (this.world.isSolid(cx, cy)) return true;
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
      this.world.fire[this.world.idx(x, y)] = EXPLOSION_LIFETIME_MS;
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
          this.world.destroySoft(nx, ny);
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
        if (p.alive && p.cellX === cell.x && p.cellY === cell.y) this.killPlayer(p);
      }
    }
  }

  private killPlayer(p: Player): void {
    if (!p.alive) return;
    p.alive = false;
    p.dir = Direction.NONE;
    this.broadcast(encodeDeath(p.id));
  }

  private checkWin(timeUp = false): void {
    if (this.phase !== MatchPhase.PLAYING && this.phase !== MatchPhase.SUDDEN_DEATH) return;
    const aliveIds: number[] = [];
    for (const p of this.players.values()) if (p.alive) aliveIds.push(p.id);
    if (aliveIds.length <= 1 || timeUp) {
      this.winnerId = aliveIds.length === 1 ? aliveIds[0] : DRAW_WINNER_ID;
      this.setPhase(MatchPhase.END);
      this.broadcast(encodeMatchEnd(this.winnerId));
    }
  }

  // -- networking -----------------------------------------------------------

  private broadcast(bytes: Uint8Array): void {
    for (const p of this.players.values()) p.send(bytes);
  }

  private broadcastRoomInfo(): void {
    const list: RoomPlayerInfo[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
    }));
    const countdown = this.lobbyCounting ? this.lobbyCountdownMs : 0;
    for (const p of this.players.values()) {
      p.send(encodeRoomInfo(this.id, this.hostId, p.id === this.hostId, countdown, list));
    }
  }

  private broadcastSnapshot(): void {
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
    this.broadcast(encodeSnapshot(Math.floor(this.matchElapsedMs / TICK_MS), players, bombs, this.world.snapshotGrid()));
  }
}

function clampToward(diff: number, max: number): number {
  if (Math.abs(diff) <= max) return diff;
  return Math.sign(diff) * max;
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
