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
  MAX_PLAYERS_PER_ROOM,
  FILL_WITH_BOTS_AFTER_MS,
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
  type PlayerSnapshot,
  type BombSnapshot,
} from "@bomberpump/shared";
import { World, SPAWNS, powerupOfTile } from "./world.js";
import { Player, type SendFn } from "./player.js";
import { Bomb, dirVector } from "./bomb.js";
import { BotController } from "./bot.js";

const R = PLAYER_HITBOX_RADIUS;
const EPS = 1e-4;

export class Room {
  readonly id: string;
  readonly world = new World();
  readonly players = new Map<number, Player>();
  bombs: Bomb[] = [];

  phase: MatchPhase = MatchPhase.LOBBY;
  private phaseTimerMs = 0; // counts down for COUNTDOWN / END
  private matchElapsedMs = 0;
  private suddenDeathTimerMs = 0;
  private suddenDeathIdx = 0;
  private spiral: Array<{ x: number; y: number }> = [];

  private nextPlayerId = 0;
  private nextBombId = 0;
  private nextBotN = 1;
  private firstHumanAtMs = 0;
  private tickCount = 0;
  private winnerId = DRAW_WINNER_ID;
  private readonly bots = new Map<number, BotController>();

  dead = false;

  constructor(id: string) {
    this.id = id;
    this.spiral = buildSpiral();
  }

  // -- membership -----------------------------------------------------------

  get humanCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (!p.isBot) n++;
    return n;
  }

  /** Can a new human still be slotted into this room? */
  acceptsPlayers(): boolean {
    return this.phase === MatchPhase.LOBBY && this.players.size < MAX_PLAYERS_PER_ROOM;
  }

  addPlayer(name: string, send: SendFn, isBot = false): Player {
    const id = this.nextPlayerId++;
    const spawn = SPAWNS[this.players.size % SPAWNS.length];
    const p = new Player(id, name, isBot, spawn.x, spawn.y, send);
    this.players.set(id, p);
    if (!isBot) {
      if (this.firstHumanAtMs === 0) this.firstHumanAtMs = Date.now();
      // Welcome + current phase so a late joiner renders the lobby correctly.
      send(encodeWelcome(id, GRID_W, GRID_H));
      send(encodePhase(this.phase, this.phaseTimerMs));
    } else {
      this.bots.set(id, new BotController());
    }
    return p;
  }

  removePlayer(id: number): void {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.bots.delete(id);
    // Their live bombs keep ticking; just drop the active counter ownership.
    if (this.phase === MatchPhase.PLAYING || this.phase === MatchPhase.SUDDEN_DEATH) {
      this.checkWin();
    }
    if (this.players.size === 0) this.dead = true;
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

  placeBomb(id: number, seq: number): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (seq <= p.lastInputSeq) {
      // bombs share the seq space loosely; accept if not strictly older
    }
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

  // -- main loop ------------------------------------------------------------

  tick(): void {
    const dt = TICK_MS;
    this.tickCount++;

    switch (this.phase) {
      case MatchPhase.LOBBY:
        this.maybeStart();
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
        this.phaseTimerMs -= dt;
        if (this.phaseTimerMs <= -ROOM_LINGER_MS) this.dead = true;
        break;
    }

    this.broadcastSnapshot();
  }

  private setPhase(phase: MatchPhase, timerMs = 0): void {
    this.phase = phase;
    this.phaseTimerMs = timerMs;
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
        return Math.max(0, END_SCREEN_MS + this.phaseTimerMs);
      default:
        return 0;
    }
  }

  private maybeStart(): void {
    const humans = this.humanCount;
    if (humans === 0) {
      this.firstHumanAtMs = 0;
      return;
    }
    const full = this.players.size >= MAX_PLAYERS_PER_ROOM;
    const timedOut = Date.now() - this.firstHumanAtMs >= FILL_WITH_BOTS_AFTER_MS;
    if (full || timedOut) {
      this.start();
    }
  }

  private start(): void {
    // Fill remaining slots with bots so quickplay always produces a match.
    while (this.players.size < MAX_PLAYERS_PER_ROOM) {
      this.addPlayer(`Bot-${this.nextBotN++}`, () => {}, true);
    }
    this.world.generate();
    // Assign spawn corners deterministically.
    let i = 0;
    for (const p of this.players.values()) {
      const s = SPAWNS[i % SPAWNS.length];
      p.x = s.x + 0.5;
      p.y = s.y + 0.5;
      p.alive = true;
      p.dir = Direction.NONE;
      p.lastMoveAtMs = Date.now();
      i++;
    }
    this.bombs = [];
    this.matchElapsedMs = 0;
    this.suddenDeathTimerMs = 0;
    this.suddenDeathIdx = 0;
    this.setPhase(MatchPhase.COUNTDOWN, COUNTDOWN_MS);
  }

  private simulate(dt: number): void {
    this.matchElapsedMs += dt;

    // 1. Bots decide their inputs.
    for (const [id, ctrl] of this.bots) {
      const bot = this.players.get(id);
      if (bot && bot.alive) ctrl.update(this, bot, dt);
    }

    // 2. Movement.
    for (const p of this.players.values()) {
      if (p.alive) this.movePlayer(p, dt);
    }

    // 3. Slide kicked bombs.
    for (const b of this.bombs) this.slideBomb(b, dt);

    // 4. Fuses + detonations.
    for (const b of this.bombs) {
      if (b.exploded) continue;
      b.fuseLeftMs -= dt;
      if (b.fuseLeftMs <= 0) this.detonate(b);
    }
    this.bombs = this.bombs.filter((b) => !b.exploded);

    // 5. Decay fire.
    const fire = this.world.fire;
    for (let i = 0; i < fire.length; i++) {
      if (fire[i] > 0) {
        fire[i] -= dt;
        if (fire[i] < 0) fire[i] = 0;
      }
    }

    // 6. Deaths (standing in fire) + pickups.
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

    // 7. Pass-through bookkeeping: a player loses bomb pass-through once off it.
    for (const b of this.bombs) {
      for (const pid of [...b.passThrough]) {
        const pl = this.players.get(pid);
        if (!pl || pl.cellX !== b.x || pl.cellY !== b.y) b.passThrough.delete(pid);
      }
    }

    // 8. Idle kick.
    const now = Date.now();
    for (const p of this.players.values()) {
      if (!p.isBot && p.alive && now - p.lastMoveAtMs > IDLE_KICK_MS) {
        this.killPlayer(p);
      }
    }

    // 9. Sudden death.
    if (this.matchElapsedMs >= SUDDEN_DEATH_AT_MS) {
      if (this.phase !== MatchPhase.SUDDEN_DEATH) this.setPhase(MatchPhase.SUDDEN_DEATH);
      this.suddenDeath(dt);
    }

    // 10. Win check.
    this.checkWin();
  }

  // -- movement -------------------------------------------------------------

  private movePlayer(p: Player, dt: number): void {
    if (p.dir === Direction.NONE) return;
    const dist = (p.speed * dt) / 1000;
    const { dx, dy } = dirVector(p.dir);

    if (dx !== 0) {
      // Snap toward the row lane so cornering feels right.
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
      const block = this.blockedFor(cellX, row, p, step > 0 ? Direction.RIGHT : Direction.LEFT);
      if (block) {
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
      const block = this.blockedFor(col, cellY, p, step > 0 ? Direction.DOWN : Direction.UP);
      if (block) {
        p.y = step > 0 ? cellY - R - EPS : cellY + 1 + R + EPS;
        return;
      }
    }
    p.y = newY;
  }

  /** Is (cx,cy) blocking for this player, considering bomb pass-through and kick. */
  private blockedFor(cx: number, cy: number, p: Player, dir: Direction): boolean {
    if (this.world.isSolid(cx, cy)) return true;
    const bomb = this.bombs.find((b) => !b.exploded && b.x === cx && b.y === cy);
    if (!bomb) return false;
    if (bomb.passThrough.has(p.id)) return false;
    // Hitting a bomb you can't pass: kick it if able.
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
          break; // ray stops at the soft block it destroys
        }
        // empty or powerup-on-ground
        ignite(nx, ny);
        // explosion destroys uncollected powerups
        if (powerupOfTile(this.world.tile(nx, ny)) !== null) {
          this.world.set(nx, ny, TileType.EMPTY);
        }
        // chain reaction
        const other = this.bombs.find((o) => !o.exploded && o.x === nx && o.y === ny);
        if (other) this.detonate(other);
      }
    }

    this.broadcast(encodeExplosion(cells));
  }

  private suddenDeath(dt: number): void {
    this.suddenDeathTimerMs += dt;
    while (this.suddenDeathTimerMs >= SUDDEN_DEATH_STEP_MS && this.suddenDeathIdx < this.spiral.length) {
      this.suddenDeathTimerMs -= SUDDEN_DEATH_STEP_MS;
      const cell = this.spiral[this.suddenDeathIdx++];
      this.world.set(cell.x, cell.y, TileType.HARD);
      // Crush bombs and players caught under the wall.
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

  private checkWin(): void {
    if (this.phase !== MatchPhase.PLAYING && this.phase !== MatchPhase.SUDDEN_DEATH) return;
    const aliveIds: number[] = [];
    for (const p of this.players.values()) if (p.alive) aliveIds.push(p.id);
    if (aliveIds.length <= 1) {
      this.winnerId = aliveIds.length === 1 ? aliveIds[0] : DRAW_WINNER_ID;
      this.setPhase(MatchPhase.END, 0);
      this.broadcast(encodeMatchEnd(this.winnerId));
    }
  }

  // -- networking -----------------------------------------------------------

  private broadcast(bytes: Uint8Array): void {
    for (const p of this.players.values()) {
      if (!p.isBot) p.send(bytes);
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
    this.broadcast(encodeSnapshot(this.tickCount, players, bombs, this.world.snapshotGrid()));
  }
}

function clampToward(diff: number, max: number): number {
  if (Math.abs(diff) <= max) return diff;
  return Math.sign(diff) * max;
}

/** Inward clockwise spiral over the interior play area (excludes the hard border). */
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
