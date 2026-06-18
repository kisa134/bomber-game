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
  PROTOCOL_VERSION,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  SKIN_COUNT,
  SPECTATOR_ID,
  KICK_SPEED,
  HIT_INVULN_MS,
  DRAW_WINNER_ID,
  Direction,
  MatchPhase,
  TileType,
  BET_SIZES,
  TOKEN_BET_SIZES,
  TOKEN_DECIMALS,
  HOUSE_RAKE_BP,
  Currency,
  BotDifficulty,
  CalloutType,
  PowerUpType,
  CHIPS_WIN_REWARD,
  CHIPS_PLAY_REWARD,
  encodeSnapshot,
  encodePhase,
  encodeExplosion,
  encodeDeath,
  encodeKill,
  encodePickup,
  encodeCallout,
  encodeMatchEnd,
  encodeWelcome,
  encodeRoomInfo,
  encodeEmoteEvent,
  gridSectionUnchanged,
  gridSectionDelta,
  gridSectionFull,
  type PlayerSnapshot,
  type BombSnapshot,
  type RoomPlayerInfo,
} from "@bomberpump/shared";
import { createHash, randomBytes } from "node:crypto";
import { makeRng, encodeMatchSeed, advance } from "@bomberpump/shared";
import { World, SPAWNS, powerupOfTile } from "./world.js";
import { analytics } from "./analytics.js";
import { distributeReferralRewards } from "./referral.js";
import { Player, type SendFn } from "./player.js";
import { Bomb, dirVector } from "./bomb.js";
import { BotController } from "./bot.js";
import { store, type MatchResult } from "./store.js";

const BOT_NAMES = ["Botzilla", "Fuse", "Boomer", "Sparky", "Dynamo", "Kral"];

const EMPTY_ROOM_TTL_MS = 30_000; // reap rooms with no human for this long
const RECONNECT_GRACE_MS = 60_000; // hold a dropped player's slot this long
// (generous: mobile browsers suspend a locked/backgrounded tab, so give it
// plenty of time to come back before freeing the slot and ending the round)

export class Room {
  readonly id: string; // also used as the shareable room code
  readonly isPublic: boolean;
  readonly practice: boolean; // fill with bots and auto-start
  readonly botDifficulty: BotDifficulty; // difficulty of bots in a practice room
  stake: number; // amount wagered per player (0 = casual); host can change in lobby
  readonly currency: Currency; // what the stake is denominated in
  private pot = 0; // escrowed amount for the current match (base units for tokens)
  private contributors: string[] = []; // wallets that paid into the pot (for refunds)
  readonly world = new World();
  readonly players = new Map<number, Player>();
  private readonly bots = new Map<number, BotController>();
  private readonly spectators = new Map<number, SendFn>(); // watch-only connections
  private nextSpectatorId = 200; // spectator ids live above player/bot ids
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
  private simTick = 0; // authoritative integer tick, drives input consumption
  hostId = -1;
  private lobbyCounting = false;
  private lobbyCountdownMs = 0;
  private winnerId = DRAW_WINNER_ID;
  private practiceStarted = false; // practice auto-starts once; then by button
  private firstBloodDone = false; // first-blood bonus awarded this match?
  private lastHumanAtMs = Date.now();
  private readonly lastSentGrid = new Uint8Array(GRID_SIZE);
  private readonly needKeyframe = new Set<number>(); // players owed a full grid
  private seed = "";
  private seedCommit = "";
  private rng: () => number = Math.random;

  dead = false;

  constructor(
    id: string,
    isPublic: boolean,
    practice = false,
    stake = 0,
    botDifficulty: BotDifficulty = BotDifficulty.NORMAL,
    currency: Currency = Currency.CHIPS,
  ) {
    this.id = id;
    this.isPublic = isPublic;
    this.practice = practice;
    this.stake = stake;
    this.currency = currency;
    this.botDifficulty = botDifficulty;
    this.spiral = buildSpiral();
  }

  get maxPlayers(): number {
    return MAX_PLAYERS_PER_ROOM;
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

  /** Distinct human wallets currently seated (for anti-abuse checks). */
  get walletCount(): number {
    const s = new Set<string>();
    for (const p of this.players.values()) if (!p.isBot && p.wallet) s.add(p.wallet);
    return s.size;
  }

  /** True if this wallet already holds a seat here (block self-stake / dual-seat). */
  hasWallet(wallet: string): boolean {
    for (const p of this.players.values()) if (!p.isBot && p.wallet === wallet) return true;
    return false;
  }

  private addBot(): void {
    const id = this.nextPlayerId++;
    const spawn = SPAWNS[this.players.size % SPAWNS.length];
    const name = BOT_NAMES[id % BOT_NAMES.length];
    const p = new Player(id, name, id % SKIN_COUNT, spawn.x, spawn.y, () => {}, true);
    p.ready = true; // bots are always ready
    this.players.set(id, p);
    this.bots.set(id, new BotController(this.botDifficulty));
    this.dedupeSkins();
  }

  addPlayer(name: string, skin: number, send: SendFn, wallet: string | null = null): Player {
    const id = this.nextPlayerId++;
    const spawn = SPAWNS[this.players.size % SPAWNS.length];
    const p = new Player(id, name, skin, spawn.x, spawn.y, send);
    p.wallet = wallet;
    this.players.set(id, p);
    this.needKeyframe.add(id);
    if (this.hostId < 0) this.hostId = id;
    this.dedupeSkins();
    send(encodeWelcome(id, GRID_W, GRID_H, PROTOCOL_VERSION));
    send(encodePhase(this.phase, this.phaseTimer()));
    this.broadcastRoomInfo();
    return p;
  }

  /** Give every seated player a distinct skin so no two look alike in a match.
   *  Earlier seats (by join order) keep their picked skin; later collisions get
   *  the lowest free index. SKIN_COUNT === MAX_PLAYERS_PER_ROOM, so the set is
   *  always fully unique. */
  private dedupeSkins(): void {
    const taken = new Set<number>();
    const ordered = [...this.players.values()].sort((a, b) => a.id - b.id);
    for (const p of ordered) {
      let s = p.preferredSkin;
      if (taken.has(s)) {
        s = 0;
        while (s < SKIN_COUNT && taken.has(s)) s++;
        if (s >= SKIN_COUNT) s = p.preferredSkin; // safety: more players than skins
      }
      p.skin = s;
      taken.add(s);
    }
  }

  /** A match is in progress and can be watched. */
  get watchable(): boolean {
    return this.phase === MatchPhase.PLAYING || this.phase === MatchPhase.SUDDEN_DEATH;
  }

  /** Attach a watch-only connection. Returns the internal spectator id. */
  addSpectator(send: SendFn): number {
    const id = this.nextSpectatorId++;
    this.spectators.set(id, send);
    this.needKeyframe.add(id); // owe them a full grid on the next snapshot
    send(encodeWelcome(SPECTATOR_ID, GRID_W, GRID_H, PROTOCOL_VERSION));
    send(encodePhase(this.phase, this.phaseTimer()));
    return id;
  }

  isSpectator(id: number): boolean {
    return this.spectators.has(id);
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
    // A seat freed up in the lobby — re-run dedupe so players can reclaim their
    // preferred skin. (Never during a live match: that would swap skins mid-game.)
    if (this.phase === MatchPhase.LOBBY) this.dedupeSkins();
    this.broadcastRoomInfo();
  }

  /** Socket dropped. During an active match, hold the slot for a grace window
   *  so the player can reconnect; otherwise remove immediately. */
  handleDisconnect(id: number): void {
    if (this.spectators.delete(id)) {
      this.needKeyframe.delete(id);
      return;
    }
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
      p.intent = Direction.NONE;
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

  setMove(id: number, dir: Direction, tick: number): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    // No moving before the match is actually live (lobby / countdown) — otherwise
    // buffered inputs make players twitch during the "3-2-1".
    if (this.phase !== MatchPhase.PLAYING && this.phase !== MatchPhase.SUDDEN_DEATH) {
      p.intent = Direction.NONE;
      p.inputs.clear();
      return;
    }
    if (tick <= this.simTick) {
      // Late (clock off / high lag): apply right now instead of dropping, so the
      // player can never freeze. Worst case = a little extra reconcile work.
      p.intent = dir;
    } else {
      p.inputs.set(tick, dir);
    }
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

  /** Host pressed "Start now" (or "Play again" in practice). */
  requestStart(id: number): void {
    if (id !== this.hostId) return;
    if (this.phase !== MatchPhase.LOBBY) return;
    // Practice: the player drives every (re)start; refill bots and go.
    if (this.practice) {
      this.startPractice();
      return;
    }
    if (!this.allReady()) return; // every player must be ready first
    this.start();
  }

  /** Top up bots and start a practice match. */
  private startPractice(): void {
    while (this.players.size < MAX_PLAYERS_PER_ROOM) this.addBot();
    this.practiceStarted = true;
    this.start();
  }

  /** Lobby ready-up toggle. */
  setReady(id: number, ready: boolean): void {
    const p = this.players.get(id);
    if (!p || this.phase !== MatchPhase.LOBBY) return;
    p.ready = ready;
    this.broadcastRoomInfo();
  }

  /** Broadcast a quick reaction to everyone in the room. */
  emote(id: number, emote: number): void {
    if (!this.players.has(id)) return;
    if (emote < 0 || emote > 31) return;
    this.broadcast(encodeEmoteEvent(id, emote));
  }

  /** True when every connected human is readied up (and we have enough). */
  private allReady(): boolean {
    let humans = 0;
    for (const p of this.players.values()) {
      if (p.isBot) continue;
      humans++;
      if (!p.ready) return false;
    }
    return humans >= MIN_PLAYERS_TO_START;
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
        this.tickLobby();
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

  private tickLobby(): void {
    // Practice room: fill with bots and auto-start the FIRST match as soon as a
    // human is present. After that the player starts each rematch with a button
    // (requestStart) — no more starting itself.
    if (this.practice && this.humanCount >= 1 && !this.practiceStarted) {
      this.startPractice();
      return;
    }
    // The match starts ONLY when every present player has readied up — no timed
    // auto-start, no "start because the room is full". This guarantees nobody is
    // dropped into a match (especially a staked one) without confirming.
    if (this.allReady()) this.start();
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
    this.firstBloodDone = false;
    // Randomize which corner each player gets (seeded shuffle -> still provably
    // fair / reproducible from the revealed seed), so positions aren't fixed by
    // join order.
    const corners = SPAWNS.slice();
    for (let k = corners.length - 1; k > 0; k--) {
      const j = Math.floor(this.rng() * (k + 1));
      [corners[k], corners[j]] = [corners[j], corners[k]];
    }
    let i = 0;
    for (const p of this.players.values()) {
      const s = corners[i % corners.length];
      p.resetForMatch(s.x, s.y);
      p.lastMoveAtMs = Date.now();
      if (!p.isBot) p.ready = false; // require re-ready for the next round
      i++;
    }
    this.dedupeSkins(); // guarantee no two players share a skin this match
    this.escrowStakes();
    this.bombs = [];
    this.matchElapsedMs = 0;
    this.simTick = 0;
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
    this.simTick += 1;

    // Refresh timed buffs (wall-pass) before movement reads them.
    const nowMs = Date.now();
    for (const p of this.players.values()) p.wallPass = nowMs < p.wallPassUntilMs;

    // Consume each player's tick-stamped input for this exact tick (rollback).
    // If it hasn't arrived (jitter), the last intent carries over.
    for (const p of this.players.values()) {
      const queued = p.inputs.get(this.simTick);
      if (queued !== undefined) p.intent = queued;
      // Drop inputs we've now passed to bound memory.
      for (const t of p.inputs.keys()) if (t <= this.simTick) p.inputs.delete(t);
    }

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
        p.applyPowerup(pu, nowMs);
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

    // No idle-kick: standing still must never cost HP or end the round. A truly
    // gone player is handled by the disconnect grace; a stalled round is forced
    // to a finish by sudden death (which fills the map and squeezes everyone).

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
    if (p.intent === Direction.NONE && p.dir === Direction.NONE) return;
    const dist = (p.speed * dt) / 1000;
    // `p` is the MoveState: advance mutates p.x/p.y/p.dir in place. The blocked
    // closure reads p.dir live (it's the current movement direction) for kicks.
    advance(p, p.intent, dist, (cx, cy) => this.blockedFor(cx, cy, p, p.dir));
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
    }
    // Anyone standing inside a closed-in wall dies (covers players who were
    // mid-cell when the wall landed, not just those on the exact cell).
    for (const p of this.players.values()) {
      if (p.alive && this.world.isHard(p.cellX, p.cellY)) this.hit(p, true);
    }
  }

  /** Take a hit: lose a life and respawn, or get eliminated. `eliminate`
   *  forces a full kill (idle-kick, sudden-death wall) ignoring lives/invuln.
   *  `killerId` is the bomb owner whose fire landed the hit (-1 = environment). */
  private hit(p: Player, eliminate = false, killerId = -1): void {
    if (!p.alive) return;
    const now = Date.now();
    if (!eliminate && now < p.invulnUntilMs) return; // i-frames after a hit

    p.lives = eliminate ? 0 : p.lives - 1;

    // Non-fatal hit: lose 1 HP, blink (i-frames), stay put — no respawn/teleport.
    if (p.lives > 0) {
      p.invulnUntilMs = now + HIT_INVULN_MS;
      // First blood = the first time one player WOUNDS another (not a full kill).
      if (killerId >= 0 && killerId !== p.id) {
        const killer = this.players.get(killerId);
        if (killer) this.awardFirstBlood(killer);
      }
      return;
    }

    // Fatal: eliminate. Credit the kill now (only real kills count as frags).
    if (killerId >= 0 && killerId !== p.id) {
      const killer = this.players.get(killerId);
      if (killer) {
        killer.frags += 1;
        this.awardFirstBlood(killer);
      }
    } else if (killerId === p.id) {
      p.frags = Math.max(0, p.frags - 1); // suicide penalty
    }
    this.broadcast(encodeKill(killerId >= 0 ? killerId : 255, p.id));
    p.deaths += 1;
    p.alive = false;
    p.dir = Direction.NONE;
    p.intent = Direction.NONE;
    this.broadcast(encodeDeath(p.id));
  }

  private checkWin(timeUp = false): void {
    if (this.phase !== MatchPhase.PLAYING && this.phase !== MatchPhase.SUDDEN_DEATH) return;
    const aliveIds: number[] = [];
    for (const p of this.players.values()) if (p.alive) aliveIds.push(p.id);
    if (aliveIds.length <= 1 || timeUp) {
      this.winnerId = aliveIds.length === 1 ? aliveIds[0] : DRAW_WINNER_ID;
      const winner = this.players.get(this.winnerId);
      if (winner) winner.wins += 1; // series score for the room
      this.setPhase(MatchPhase.END);
      this.broadcast(encodeMatchEnd(this.winnerId));
      this.broadcast(encodeMatchSeed(this.seedCommit, this.seed)); // reveal
      this.settlePot(winner ?? null);
      this.recordStats();
      this.awardPlayRewards();
      analytics.matchCompleted({
        winner: winner && !winner.isBot ? winner.wallet : null,
        players: this.humanCount,
        stake: this.stake,
        currency: this.currency,
        practice: this.practice,
        hasBots: this.hasBots,
      });
    }
  }

  /** Per-player stake in the currency's smallest unit (base units for tokens). */
  private stakeBase(): number {
    return this.currency === Currency.TOKEN
      ? Math.round(this.stake * 10 ** TOKEN_DECIMALS)
      : this.stake;
  }

  /** Move a wallet's balance in this room's currency. */
  private adjustBalance(wallet: string, delta: number): Promise<number | null> {
    return this.currency === Currency.TOKEN
      ? store.adjustToken(wallet, delta)
      : store.adjustChips(wallet, delta);
  }

  /** Host changes the table stake while in the lobby. Rejected unless every
   *  present wallet player can afford it (keeps the "everyone can pay" invariant
   *  so the escrow at start never short-changes the pot). */
  async setStake(id: number, stake: number): Promise<void> {
    if (this.phase !== MatchPhase.LOBBY || id !== this.hostId) return;
    const tiers = this.currency === Currency.TOKEN ? TOKEN_BET_SIZES : BET_SIZES;
    if (stake !== 0 && !(tiers as readonly number[]).includes(stake)) return;
    if (stake === this.stake) return;
    if (stake > 0) {
      const needBase =
        this.currency === Currency.TOKEN ? Math.round(stake * 10 ** TOKEN_DECIMALS) : stake;
      for (const p of this.players.values()) {
        if (p.isBot || !p.wallet) continue;
        const prof = await store.getProfile(p.wallet);
        const bal = this.currency === Currency.TOKEN ? (prof?.token_balance ?? 0) : (prof?.chips ?? 0);
        if (bal < needBase) return; // someone can't afford -> reject
      }
    }
    this.stake = stake;
    this.broadcastRoomInfo();
  }

  /** Deduct each wallet player's stake into the pot at match start. Overdraw-safe:
   *  only players who actually paid are counted into the pot and refund list. */
  private escrowStakes(): void {
    this.pot = 0;
    this.contributors = [];
    if (this.stake <= 0) return;
    const amount = this.stakeBase();
    for (const p of this.players.values()) {
      if (p.isBot || !p.wallet) continue;
      const wallet = p.wallet;
      void this.adjustBalance(wallet, -amount).then((bal) => {
        if (bal !== null) {
          this.pot += amount;
          this.contributors.push(wallet);
        }
      });
    }
  }

  /** Pay the pot to the winner (minus the house rake); refund contributors on a
   *  draw / no eligible winner. */
  private settlePot(winner: Player | null): void {
    if (this.pot <= 0) {
      this.pot = 0;
      this.contributors = [];
      return;
    }
    if (winner && !winner.isBot && winner.wallet) {
      const rakeBp = Number(process.env.HOUSE_RAKE_BP ?? HOUSE_RAKE_BP) || 0;
      const rake = Math.floor((this.pot * rakeBp) / 10000);
      void this.adjustBalance(winner.wallet, this.pot - rake);
      // Multi-level referral rewards come OUT of the house rake — token matches
      // only (rewards are paid in tokens). Each staker's chain gets a slice of
      // the rake their stake produced. Fully guarded inside the helper.
      if (this.currency === Currency.TOKEN && rakeBp > 0) {
        const perStakeRake = Math.floor((this.stakeBase() * rakeBp) / 10000);
        for (const wallet of this.contributors) void distributeReferralRewards(wallet, perStakeRake);
      }
    } else {
      const refund = this.stakeBase();
      for (const wallet of this.contributors) void this.adjustBalance(wallet, refund);
    }
    this.pot = 0;
    this.contributors = [];
  }

  /** First blood (first player-on-player wound of the match): big callout + an
   *  instant random power-up. Idempotent — only the first one counts. */
  private awardFirstBlood(killer: Player): void {
    if (this.firstBloodDone) return;
    this.firstBloodDone = true;
    const pool = [
      PowerUpType.BOMB_UP,
      PowerUpType.FIRE_UP,
      PowerUpType.SPEED_UP,
      PowerUpType.KICK,
    ];
    const pu = pool[Math.floor(this.rng() * pool.length)];
    killer.applyPowerup(pu);
    this.broadcast(encodeCallout(CalloutType.FIRST_BLOOD, killer.id));
    this.broadcast(encodePickup(killer.id, pu));
  }

  /** True if any bot is seated — such a match never affects rating. */
  private get hasBots(): boolean {
    for (const p of this.players.values()) if (p.isBot) return true;
    return false;
  }

  /** Persist ranked stats for wallet-authenticated humans. Skipped for practice
   *  and any match that contained bots — those never touch rating. */
  private recordStats(): void {
    if (this.practice || this.hasBots) return;
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

  /** Flat chip rewards for a non-staked match (practice/bots, free quickplay) so
   *  chips can be earned toward skins. Staked matches pay the pot instead. */
  private awardPlayRewards(): void {
    if (this.stake > 0) return;
    for (const p of this.players.values()) {
      if (p.isBot || !p.wallet) continue;
      const reward = p.id === this.winnerId ? CHIPS_WIN_REWARD : CHIPS_PLAY_REWARD;
      void store.adjustChips(p.wallet, reward);
    }
  }

  // -- networking -----------------------------------------------------------

  private broadcast(bytes: Uint8Array): void {
    for (const p of this.players.values()) p.send(bytes);
    for (const send of this.spectators.values()) send(bytes);
  }

  private broadcastRoomInfo(): void {
    const list: RoomPlayerInfo[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      ready: p.ready,
      wins: p.wins,
      wallet: p.wallet ?? "",
    }));
    const countdown = this.lobbyCounting ? this.lobbyCountdownMs : 0;
    for (const p of this.players.values()) {
      p.send(encodeRoomInfo(this.id, this.hostId, p.id === this.hostId, countdown, this.stake, this.currency, list));
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
        ownerId: b.ownerId,
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

    const tick = this.simTick;
    const deltaMsg = encodeSnapshot(tick, players, bombs, section);
    let fullMsg: Uint8Array | null = null;
    const fk = (): Uint8Array =>
      (fullMsg ??= encodeSnapshot(tick, players, bombs, gridSectionFull(cur)));
    for (const p of this.players.values()) {
      if (p.isBot) continue;
      p.send(this.needKeyframe.has(p.id) ? fk() : deltaMsg);
    }
    for (const [id, send] of this.spectators) {
      send(this.needKeyframe.has(id) ? fk() : deltaMsg);
    }
    this.needKeyframe.clear();
    this.lastSentGrid.set(cur);
  }
}

function buildSpiral(): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  // No border ring now, so the closing walls start from the very edge.
  let top = 0;
  let bottom = GRID_H - 1;
  let left = 0;
  let right = GRID_W - 1;
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
