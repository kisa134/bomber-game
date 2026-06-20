import {
  TICK_MS,
  SNAPSHOT_DIV,
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
  HOUSE_RAKE_BP,
  Currency,
  BotDifficulty,
  CalloutType,
  PowerUpType,
  CHIPS_WIN_REWARD,
  CHIPS_PLAY_REWARD,
  BOT_WIN_CHIPS,
  BOT_PLAY_CHIPS,
  BOT_WIN_XP,
  BOT_PLAY_XP,
  MAX_BOMBS,
  MAX_POWER,
  MAX_SPEED,
  PLAYER_BASE_SPEED,
  SPEED_UP_DELTA,
  MAX_SPEED_LEVELS,
  PRACTICE_MAX_BOTS,
  BOT_RESPAWN_MS,
  CRATE_RESPAWN_MS,
  type SandboxOpts,
  encodeSnapshot,
  encodePhase,
  encodeExplosion,
  encodeDeath,
  encodeKill,
  encodePickup,
  encodeCallout,
  encodeStakeVote,
  encodeMatchEnd,
  encodeKicked,
  encodeChatMsg,
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
import { World, SPAWNS, PRACTICE_SPAWNS, powerupOfTile, type Spawn } from "./world.js";
import { analytics } from "./analytics.js";
import { distributeReferralRewards } from "./referral.js";
import { getTokenDecimals } from "./token.js";
import { logEvent, shortWallet } from "./events.js";
import { alert } from "./alert.js";
import { metrics } from "./metrics.js";
import { Player, type SendFn } from "./player.js";
import { Bomb, dirVector } from "./bomb.js";
import { BotController } from "./bot.js";
import { store, type MatchResult } from "./store.js";

const BOT_NAMES = ["Botzilla", "Fuse", "Boomer", "Sparky", "Dynamo", "Kral"];

const EMPTY_ROOM_TTL_MS = 30_000; // reap rooms with no human for this long
const RECONNECT_GRACE_MS = 60_000; // hold a dropped player's slot this long
const REGION = process.env.REGION_ID ?? ""; // scopes crash-refund reconciliation
// Spam is welcome (reactions scatter), but keep a tiny floor so one client
// can't flood the broadcast with thousands of emote packets a second.
const EMOTE_COOLDOWN_MS = 120;
const CHAT_COOLDOWN_MS = 800; // per-player anti-spam for chat
// Once enough players are ready but someone is still stalling, give the
// straggler(s) this long, then drop them and start so nobody is held hostage.
const READY_COUNTDOWN_MS = 10_000;
// (generous: mobile browsers suspend a locked/backgrounded tab, so give it
// plenty of time to come back before freeing the slot and ending the round)

export class Room {
  readonly id: string; // also used as the shareable room code
  isPublic: boolean; // listed/quick-matchable; host can toggle private (code-only)
  readonly practice: boolean; // fill with bots and auto-start
  readonly competitive: boolean = false; // bot match that grants tiny rewards (vs sandbox)
  readonly botDifficulty: BotDifficulty; // difficulty of bots in a practice room
  readonly botCount: number; // how many bots a practice match fills with
  // Practice Sandbox tuning (god mode, starting loadout, respawns). Null unless
  // this is a non-competitive practice room.
  private readonly sandbox: SandboxOpts | null = null;
  private crateTimerMs = 0; // sandbox crate-respawn accumulator
  stake: number; // amount wagered per player (0 = casual); host can change in lobby
  readonly currency: Currency; // what the stake is denominated in
  private pot = 0; // escrowed amount for the current match (base units for tokens)
  private contributors: string[] = []; // wallets that paid into the pot (for refunds)
  private matchId = ""; // id of the current escrowed match (for crash-refund persistence)
  private lastContributors: string[] = []; // contributors of the just-settled match (for metrics)
  // Active stake-raise proposal: anyone can propose a higher stake; all humans
  // must accept within the window or it's cancelled.
  private stakeProposal: { stake: number; by: number; votes: Map<number, boolean>; deadlineMs: number } | null = null;
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
  private lobbyCountdownEndMs = 0; // wall-clock deadline for the ready countdown
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
    botCount = MAX_PLAYERS_PER_ROOM - 1,
    competitive = false,
    sandbox: SandboxOpts | null = null,
  ) {
    this.id = id;
    this.isPublic = isPublic;
    this.practice = practice;
    this.competitive = competitive;
    // Sandbox tuning only applies to a non-competitive practice room.
    this.sandbox = practice && !competitive ? sandbox : null;
    this.stake = stake;
    this.currency = currency;
    this.botDifficulty = botDifficulty;
    // Sandbox can crowd the arena (PRACTICE_SPAWNS); every other room caps at 4.
    const botCap = this.sandbox ? PRACTICE_MAX_BOTS : MAX_PLAYERS_PER_ROOM - 1;
    this.botCount = Math.max(1, Math.min(botCap, botCount));
    this.spiral = buildSpiral();
  }

  /** Active spawn set for the current match (extended for a crowded sandbox). */
  private matchSpawns(): Spawn[] {
    if (this.sandbox && this.players.size > SPAWNS.length) {
      return PRACTICE_SPAWNS.slice(0, Math.min(this.players.size, PRACTICE_SPAWNS.length));
    }
    return SPAWNS.slice();
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
    const pool = this.sandbox ? PRACTICE_SPAWNS : SPAWNS;
    const spawn = pool[this.players.size % pool.length];
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
    // The voter roster changed — cancel any in-flight stake vote.
    if (this.stakeProposal) this.closeProposal(false);
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

  /** Whether a player id is still seated (used to prune stale reconnect tokens). */
  hasPlayer(id: number): boolean {
    return this.players.has(id);
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
    // Practice: the player drives every (re)start; refill bots and go. Allow an
    // INSTANT rematch during the end-screen linger (END) — don't make them wait
    // for the room to drift back to LOBBY before "Play again" takes effect.
    if (this.practice) {
      if (this.phase === MatchPhase.END) this.resetToLobby();
      if (this.phase !== MatchPhase.LOBBY) return;
      this.startPractice();
      return;
    }
    if (this.phase !== MatchPhase.LOBBY) return;
    if (!this.allReady()) return; // every player must be ready first
    void this.start();
  }

  /** Top up bots and start a practice match. */
  private startPractice(): void {
    const cap = this.sandbox ? PRACTICE_SPAWNS.length : MAX_PLAYERS_PER_ROOM;
    const target = Math.min(cap, 1 + this.botCount); // 1 human + N bots
    while (this.players.size < target) this.addBot();
    this.practiceStarted = true;
    void this.start();
  }

  /** Apply the player's chosen Sandbox starting loadout (after resetForMatch). */
  private applySandboxLoadout(p: Player): void {
    const o = this.sandbox;
    if (!o) return;
    p.bombsMax = Math.max(1, Math.min(MAX_BOMBS, o.startBombs));
    p.power = Math.max(1, Math.min(MAX_POWER, o.startPower));
    const lvl = Math.max(0, Math.min(MAX_SPEED_LEVELS, o.startSpeed));
    p.speed = Math.min(MAX_SPEED, PLAYER_BASE_SPEED + lvl * SPEED_UP_DELTA);
    p.kick = o.startKick;
    // Wall-pass is normally temporary; in the sandbox keep it for the whole match.
    if (o.startWallPass) p.wallPassUntilMs = Date.now() + 365 * 24 * 3600 * 1000;
  }

  /** Per-tick sandbox upkeep: respawn downed bots and repopulate crates. */
  private sandboxTick(dt: number): void {
    const o = this.sandbox;
    if (!o) return;
    const now = Date.now();
    if (o.botRespawn) {
      for (const p of this.players.values()) {
        if (p.isBot && !p.alive && p.respawnAtMs > 0 && now >= p.respawnAtMs) this.respawnBot(p);
      }
    }
    if (o.crateRespawn) {
      this.crateTimerMs += dt;
      if (this.crateTimerMs >= CRATE_RESPAWN_MS) {
        this.crateTimerMs = 0;
        this.addRandomCrate();
      }
    }
  }

  /** Revive a downed bot at a free spawn so practice never runs dry. */
  private respawnBot(p: Player): void {
    const spot = this.freeCell(true);
    if (!spot) {
      p.respawnAtMs = Date.now() + 500; // arena momentarily full; retry shortly
      return;
    }
    p.respawnAtMs = 0;
    p.resetForMatch(spot.x, spot.y);
    p.invulnUntilMs = Date.now() + HIT_INVULN_MS; // brief mercy on re-entry
    this.needKeyframe.add(p.id);
  }

  /** A random empty, fire-free, unoccupied cell. `preferSpawns` tries the spawn
   *  points first (good re-entry spots), else scans the grid. */
  private freeCell(preferSpawns = false): { x: number; y: number } | null {
    const occupied = new Set<number>();
    for (const q of this.players.values()) if (q.alive) occupied.add(this.world.idx(q.cellX, q.cellY));
    const ok = (x: number, y: number): boolean => {
      const i = this.world.idx(x, y);
      return this.world.tile(x, y) === TileType.EMPTY && this.world.fire[i] <= 0 && !occupied.has(i);
    };
    if (preferSpawns) {
      for (const s of this.matchSpawns()) if (ok(s.x, s.y)) return { x: s.x, y: s.y };
    }
    for (let tries = 0; tries < 80; tries++) {
      const x = Math.floor(this.rng() * GRID_W);
      const y = Math.floor(this.rng() * GRID_H);
      if (ok(x, y)) return { x, y };
    }
    return null;
  }

  /** Drop one fresh destructible crate somewhere safe (not next to a fighter). */
  private addRandomCrate(): void {
    for (let tries = 0; tries < 40; tries++) {
      const x = Math.floor(this.rng() * GRID_W);
      const y = Math.floor(this.rng() * GRID_H);
      const i = this.world.idx(x, y);
      if (this.world.tile(x, y) !== TileType.EMPTY || this.world.fire[i] > 0) continue;
      let nearFighter = false;
      for (const q of this.players.values()) {
        if (q.alive && Math.abs(q.cellX - x) + Math.abs(q.cellY - y) <= 1) {
          nearFighter = true;
          break;
        }
      }
      if (nearFighter) continue;
      this.world.set(x, y, TileType.SOFT); // snapshot grid-diff carries it to clients
      return;
    }
  }

  /** Lobby ready-up toggle. */
  setReady(id: number, ready: boolean): void {
    const p = this.players.get(id);
    if (!p || this.phase !== MatchPhase.LOBBY) return;
    p.ready = ready;
    this.broadcastRoomInfo();
  }

  /** Lobby skin pick. Sets the player's preferred character; the final per-match
   *  dedupe still guarantees everyone looks distinct (earlier seats keep theirs). */
  setSkin(id: number, skin: number): void {
    const p = this.players.get(id);
    if (!p || this.phase !== MatchPhase.LOBBY) return;
    if (!Number.isInteger(skin) || skin < 0 || skin >= SKIN_COUNT) return;
    p.preferredSkin = skin;
    p.skin = skin;
    this.broadcastRoomInfo();
  }

  /** Host removes a player from the lobby. */
  kick(hostId: number, targetId: number): void {
    if (this.phase !== MatchPhase.LOBBY) return;
    if (hostId !== this.hostId || targetId === this.hostId) return;
    const p = this.players.get(targetId);
    if (!p || p.isBot) return;
    this.removeWithNotice(targetId, 0); // reason 0 = removed by host
  }

  /** Notify a human they were removed (so their client returns to menu), then
   *  drop them from the room. reason: 0 = by host, 1 = AFK / not ready in time. */
  private removeWithNotice(id: number, reason: number): void {
    const p = this.players.get(id);
    if (!p || p.isBot) return;
    try {
      p.send(encodeKicked(reason));
    } catch {
      /* socket already gone */
    }
    this.removePlayer(id);
  }

  /** Human players who have readied up. */
  private readyHumanCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (!p.isBot && p.ready) n++;
    return n;
  }

  /** Broadcast a chat message to the room (rate-limited + sanitized). */
  chat(id: number, raw: string): void {
    const p = this.players.get(id);
    if (!p || p.isBot) return;
    const now = Date.now();
    if (now - p.lastChatAtMs < CHAT_COOLDOWN_MS) return; // anti-spam
    // Sanitize: strip control chars / newlines, collapse spaces, cap length.
    const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!text) return;
    p.lastChatAtMs = now;
    this.broadcast(encodeChatMsg(id, text));
  }

  /** Broadcast a quick reaction to everyone in the room (rate-limited). */
  emote(id: number, emote: number): void {
    const p = this.players.get(id);
    if (!p) return;
    if (emote < 0 || emote > 31) return;
    const now = Date.now();
    if (now - p.lastEmoteAtMs < EMOTE_COOLDOWN_MS) return; // anti-spam
    p.lastEmoteAtMs = now;
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
        // Advance game-time during the countdown too (players are stationary), so
        // the snapshot tick is monotonic from the start. Otherwise serverTime sits
        // at 0 through the countdown then jumps when PLAYING begins, desyncing the
        // client playback clock and jittering everyone for the first ~second.
        this.simTick += 1;
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

    // Broadcast world snapshots at SNAPSHOT_RATE (every Nth sim tick), not every
    // tick — the client interpolates between them. Events were already sent live.
    if (this.phase !== MatchPhase.LOBBY) {
      this.netTick++;
      if (this.netTick % SNAPSHOT_DIV === 0) this.broadcastSnapshot();
    }
  }
  private netTick = 0;

  private tickLobby(): void {
    // Expire a stake proposal that nobody fully accepted in time.
    if (this.stakeProposal && Date.now() > this.stakeProposal.deadlineMs) this.closeProposal(false);
    // Practice room: fill with bots and auto-start the FIRST match as soon as a
    // human is present. After that the player starts each rematch with a button
    // (requestStart) — no more starting itself.
    if (this.practice && this.humanCount >= 1 && !this.practiceStarted) {
      this.startPractice();
      return;
    }
    // All present players ready → start immediately.
    if (this.allReady()) {
      this.lobbyCounting = false;
      void this.start();
      return;
    }
    // Otherwise, once enough players are ready but someone is stalling, run a
    // short countdown; when it expires we drop the not-ready players and start
    // with the rest — so one AFK player can't hold everyone hostage. Nobody is
    // ever dropped INTO a match without readying (the opposite: the unready are
    // removed before start, so staked players are never charged unexpectedly).
    const ready = this.readyHumanCount();
    // Only the HOST's stragglers (non-host humans) can be auto-dropped — the host
    // is in control and is never kicked from their own room.
    const nonHostStraggler = [...this.players.values()].some(
      (p) => !p.isBot && !p.ready && p.id !== this.hostId,
    );
    const eligible = ready >= MIN_PLAYERS_TO_START && nonHostStraggler;
    if (eligible) {
      if (!this.lobbyCounting) {
        this.lobbyCounting = true;
        this.lobbyCountdownEndMs = Date.now() + READY_COUNTDOWN_MS;
        this.broadcastRoomInfo(); // client renders the countdown locally
      } else if (Date.now() >= this.lobbyCountdownEndMs) {
        for (const p of [...this.players.values()]) {
          if (!p.isBot && !p.ready && p.id !== this.hostId) this.removeWithNotice(p.id, 1);
        }
        this.lobbyCounting = false;
        if (this.allReady()) void this.start();
        else this.broadcastRoomInfo();
      }
    } else if (this.lobbyCounting) {
      // Conditions broke (someone left or un-readied) → cancel the countdown.
      this.lobbyCounting = false;
      this.lobbyCountdownEndMs = 0;
      this.broadcastRoomInfo();
    }
  }

  private setPhase(phase: MatchPhase): void {
    this.phase = phase;
    // Any pending stake vote is moot once we leave the lobby.
    if (phase !== MatchPhase.LOBBY && this.stakeProposal) this.closeProposal(false);
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

  private starting = false; // re-entrancy guard: the 60Hz tick must not double-start

  private async start(): Promise<void> {
    // The lobby tick calls this every frame while allReady(); the awaited escrow
    // below yields, so without this guard several ticks could start in parallel
    // (double-debit). Bail unless we're cleanly in the lobby and not already starting.
    if (this.starting || this.phase !== MatchPhase.LOBBY) return;
    this.starting = true;
    try {
      // Collect EVERY wallet player's stake up-front (awaited). If even one can't
      // pay, refund the rest and abort the start — never run a staked match whose
      // pot wasn't fully funded (that would mint value / let someone play free).
      const escrowed = await this.escrowStakes();
      if (this.dead) {
        // Room died during the await — give back anything we collected.
        await this.refundContributors();
        return;
      }
      if (!escrowed) {
        for (const p of this.players.values()) if (!p.isBot) p.ready = false;
        this.broadcastRoomInfo();
        return;
      }
      // Persist the escrow so a hard crash (SIGKILL/host) can refund it on boot.
      // If it can't be durably recorded, abort & refund — never run a staked
      // match whose escrow isn't recoverable.
      if (this.pot > 0) {
        this.matchId = `${this.id}:${Date.now()}`;
        const amount = this.stakeBase();
        const persisted = await store.recordOpenStakes(
          this.matchId,
          REGION,
          this.currency,
          this.contributors.map((wallet) => ({ wallet, amount })),
        );
        if (!persisted) {
          alert(`ESCROW PERSIST FAILED (room ${this.id}) — refunding & aborting match start`);
          await this.refundContributors();
          for (const p of this.players.values()) if (!p.isBot) p.ready = false;
          this.broadcastRoomInfo();
          return;
        }
      }
      this.startNow();
    } finally {
      this.starting = false;
    }
  }

  /** Build and broadcast the live match (stakes already collected by start()). */
  private startNow(): void {
    this.lobbyCounting = false;
    this.lobbyCountdownEndMs = 0;
    // Provably-fair: seed the map RNG, commit to its hash now, reveal at the end.
    this.seed = randomBytes(8).toString("hex");
    this.seedCommit = createHash("sha256").update(this.seed).digest("hex");
    this.rng = makeRng(this.seed);
    const spawnList = this.matchSpawns();
    this.world.generate(this.rng, spawnList);
    this.firstBloodDone = false;
    this.crateTimerMs = 0;
    // Randomize which spawn each player gets (seeded shuffle -> still provably
    // fair / reproducible from the revealed seed), so positions aren't fixed by
    // join order.
    const corners = spawnList.slice();
    for (let k = corners.length - 1; k > 0; k--) {
      const j = Math.floor(this.rng() * (k + 1));
      [corners[k], corners[j]] = [corners[j], corners[k]];
    }
    let i = 0;
    for (const p of this.players.values()) {
      const s = corners[i % corners.length];
      p.resetForMatch(s.x, s.y);
      if (this.sandbox && !p.isBot) this.applySandboxLoadout(p); // human's custom training loadout
      p.lastMoveAtMs = Date.now();
      if (!p.isBot) p.ready = false; // require re-ready for the next round
      i++;
    }
    this.dedupeSkins(); // guarantee no two players share a skin this match
    // Push the final roster (incl. bots) + deduped skins so the client maps every
    // player id to a distinct character (snapshots don't carry skins).
    this.broadcastRoomInfo();
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
    this.lobbyCountdownEndMs = 0;
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

    // Bots decide their inputs first (unless frozen as static sandbox targets).
    const frozen = this.sandbox?.freezeBots === true;
    for (const [id, ctrl] of this.bots) {
      const bot = this.players.get(id);
      if (!bot || !bot.alive) continue;
      if (frozen) {
        bot.intent = Direction.NONE; // stand perfectly still
      } else {
        ctrl.update(this, bot, dt);
      }
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

    // Sandbox is endless: no sudden death, no time limit — respawn bots/crates
    // and only end when the human falls (and only if god mode is off).
    if (this.sandbox) {
      this.sandboxTick(dt);
      this.checkWin();
      return;
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
    // Sandbox god mode: the human simply can't be hurt (endless practice).
    if (this.sandbox?.godMode && !p.isBot) return;
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
    // Sandbox: downed bots come back so there's always something to practice on.
    if (this.sandbox?.botRespawn && p.isBot) p.respawnAtMs = Date.now() + BOT_RESPAWN_MS;
  }

  private checkWin(timeUp = false): void {
    if (this.phase !== MatchPhase.PLAYING && this.phase !== MatchPhase.SUDDEN_DEATH) return;
    // Sandbox: ignore bot counts (they respawn). Ends only when the human dies.
    if (this.sandbox) {
      for (const p of this.players.values()) if (!p.isBot && p.alive) return; // human still in -> keep going
      this.winnerId = DRAW_WINNER_ID;
      this.setPhase(MatchPhase.END);
      this.broadcast(encodeMatchEnd(this.winnerId));
      this.broadcast(encodeMatchSeed(this.seedCommit, this.seed));
      return; // no pot, stats, or rewards for the sandbox
    }
    const aliveIds: number[] = [];
    for (const p of this.players.values()) if (p.alive) aliveIds.push(p.id);
    if (aliveIds.length <= 1 || timeUp) {
      this.winnerId = aliveIds.length === 1 ? aliveIds[0] : DRAW_WINNER_ID;
      const winner = this.players.get(this.winnerId);
      if (winner) winner.wins += 1; // series score for the room
      this.setPhase(MatchPhase.END);
      this.broadcast(encodeMatchEnd(this.winnerId));
      this.broadcast(encodeMatchSeed(this.seedCommit, this.seed)); // reveal
      void this.settlePot(winner ?? null);
      this.recordStats();
      this.recordPlaytime();
      this.awardPlayRewards();
      analytics.matchCompleted({
        winner: winner && !winner.isBot ? winner.wallet : null,
        players: this.humanCount,
        stake: this.stake,
        currency: this.currency,
        practice: this.practice,
        hasBots: this.hasBots,
      });
      if (!this.practice && this.humanCount > 0) {
        const cur = this.currency === Currency.TOKEN ? "💎" : "🪙";
        logEvent("🎮", `match done · ${this.humanCount}p${this.stake > 0 ? ` · ${cur}${this.stake}` : " · casual"}`);
        const humans = this.humanPlayers().map((p) => p.wallet ?? "").filter(Boolean);
        const tokenStakers = this.currency === Currency.TOKEN && this.stake > 0 ? this.lastContributors : [];
        metrics.match(humans, tokenStakers);
      }
    }
  }

  /** Per-player stake in the currency's smallest unit (base units for tokens). */
  private stakeBase(): number {
    return this.currency === Currency.TOKEN
      ? Math.round(this.stake * 10 ** getTokenDecimals())
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
        this.currency === Currency.TOKEN ? Math.round(stake * 10 ** getTokenDecimals()) : stake;
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

  /** Host toggles the room between public (listed + quick-matchable) and private
   *  (joinable by code/invite only). Lobby only. */
  setVisibility(id: number, isPublic: boolean): void {
    if (id !== this.hostId) return;
    if (this.phase !== MatchPhase.LOBBY) return;
    if (this.isPublic === isPublic) return;
    this.isPublic = isPublic;
    this.broadcastRoomInfo();
  }

  // -- stake-raise proposals (any player; everyone votes within the window) ---

  private humanPlayers(): Player[] {
    return [...this.players.values()].filter((p) => !p.isBot);
  }

  /** A player proposes raising the stake. Opens a vote (proposer auto-accepts). */
  proposeStake(id: number, stake: number): void {
    if (this.phase !== MatchPhase.LOBBY || this.stakeProposal) return;
    const p = this.players.get(id);
    if (!p || p.isBot) return;
    const tiers = this.currency === Currency.TOKEN ? TOKEN_BET_SIZES : BET_SIZES;
    if (!(tiers as readonly number[]).includes(stake)) return;
    if (stake <= this.stake) return; // proposals are raises only
    this.stakeProposal = { stake, by: id, votes: new Map([[id, true]]), deadlineMs: Date.now() + 30_000 };
    this.broadcastStakeVote(false, false);
    void this.maybeResolveProposal();
  }

  /** Accept or decline the active proposal. A single decline cancels it. */
  voteStake(id: number, accept: boolean): void {
    const pr = this.stakeProposal;
    if (!pr) return;
    const p = this.players.get(id);
    if (!p || p.isBot) return;
    if (!accept) {
      this.closeProposal(false);
      return;
    }
    pr.votes.set(id, true);
    this.broadcastStakeVote(false, false);
    void this.maybeResolveProposal();
  }

  private async maybeResolveProposal(): Promise<void> {
    const pr = this.stakeProposal;
    if (!pr) return;
    const humans = this.humanPlayers();
    if (!humans.every((p) => pr.votes.get(p.id) === true)) return; // still waiting
    // Everyone agreed — verify affordability, then apply.
    const stake = pr.stake;
    const needBase =
      this.currency === Currency.TOKEN ? Math.round(stake * 10 ** getTokenDecimals()) : stake;
    for (const p of humans) {
      if (!p.wallet) continue;
      const prof = await store.getProfile(p.wallet);
      const bal = this.currency === Currency.TOKEN ? (prof?.token_balance ?? 0) : (prof?.chips ?? 0);
      if (bal < needBase) {
        this.closeProposal(false); // someone can't afford the raise
        return;
      }
    }
    if (this.phase !== MatchPhase.LOBBY || this.stakeProposal !== pr) return; // changed mid-await
    this.stake = stake;
    this.closeProposal(true);
    this.broadcastRoomInfo();
  }

  private closeProposal(accepted: boolean): void {
    if (this.stakeProposal) this.broadcastStakeVote(true, accepted);
    this.stakeProposal = null;
  }

  private broadcastStakeVote(closed: boolean, accepted: boolean): void {
    const pr = this.stakeProposal;
    if (!pr) return;
    let yes = 0;
    for (const v of pr.votes.values()) if (v) yes++;
    this.broadcast(
      encodeStakeVote({
        stake: pr.stake,
        by: pr.by,
        msLeft: Math.max(0, pr.deadlineMs - Date.now()),
        yes,
        total: this.humanPlayers().length,
        closed,
        accepted,
      }),
    );
  }

  /** Collect every wallet player's stake into the pot BEFORE the match starts.
   *  All-or-nothing and awaited: returns true only if every seated wallet paid in
   *  full. If anyone can't pay, the ones who did are refunded and it returns false
   *  so the caller aborts — the pot is therefore always exactly the sum collected
   *  (no value minted, no free-riders, no settle-before-debit race). */
  private async escrowStakes(): Promise<boolean> {
    this.pot = 0;
    this.contributors = [];
    if (this.stake <= 0) return true; // free / practice match
    const amount = this.stakeBase();
    const wallets = [...this.players.values()].filter((p) => !p.isBot && p.wallet).map((p) => p.wallet as string);
    const paid: string[] = [];
    for (const wallet of wallets) {
      const bal = await this.adjustBalance(wallet, -amount);
      if (bal !== null) paid.push(wallet);
      else break; // first failure aborts the whole collection
    }
    if (paid.length !== wallets.length) {
      for (const wallet of paid) await this.adjustBalance(wallet, amount); // refund
      this.pot = 0;
      this.contributors = [];
      return false;
    }
    this.pot = amount * paid.length;
    this.contributors = paid;
    return true;
  }

  /** Public refund hook for graceful shutdown: if a staked match is mid-flight
   *  (escrowed but not settled), give everyone their stake back before exit. */
  async refundActivePot(): Promise<void> {
    if (this.pot <= 0) return;
    if (this.phase === MatchPhase.LOBBY || this.phase === MatchPhase.END) return;
    await this.refundContributors();
  }

  /** Refund the current contributors their stake and clear the pot (used when a
   *  started match is aborted / the room dies before it can settle). */
  private async refundContributors(): Promise<void> {
    if (this.pot <= 0) return;
    const refund = this.stakeBase();
    const owed = this.contributors;
    this.contributors = [];
    this.pot = 0;
    for (const wallet of owed) await this.adjustBalance(wallet, refund);
    if (this.matchId) {
      void store.clearOpenStakes(this.matchId);
      this.matchId = "";
    }
  }

  /** Pay the pot to the winner (minus the house rake); refund contributors on a
   *  draw / no eligible winner. Async + awaited internally so the durable
   *  open-stakes safety net is only cleared AFTER the money is confirmed moved —
   *  a failed payout/refund keeps the net so a reboot can recover the funds. */
  private async settlePot(winner: Player | null): Promise<void> {
    if (this.pot <= 0) {
      this.lastContributors = [];
      this.pot = 0;
      this.contributors = [];
      return;
    }
    // Snapshot, then reset the in-memory pot up-front (before any await) so a
    // subsequent lobby tick / new match can never double-settle this pot.
    const contributors = [...this.contributors];
    const matchId = this.matchId;
    this.pot = 0;
    this.contributors = [];

    if (winner && !winner.isBot && winner.wallet) {
      this.lastContributors = contributors; // paid volume counted only on a real win
      const rakeBp = Number(process.env.HOUSE_RAKE_BP ?? HOUSE_RAKE_BP) || 0;
      const rake = Math.floor((this.potSnapshot(contributors) * rakeBp) / 10000);
      const payout = this.potSnapshot(contributors) - rake;
      const w = winner.wallet;
      const credited = await this.adjustBalance(w, payout);
      if (credited === null) {
        // Owed money — DON'T clear the safety net; a reboot will refund stakers.
        alert(`PAYOUT FAILED: ${payout} to ${shortWallet(w)} (room ${this.id}) — open-stakes kept for recovery`);
        return;
      }
      // Lifetime winnings for the earnings leaderboards (token or chips pot).
      await store.recordWinnings(w, this.currency, payout);
      // Multi-level referral rewards come OUT of the house rake — token matches
      // only. Each staker's chain gets a slice of the rake their stake produced.
      if (this.currency === Currency.TOKEN && rakeBp > 0) {
        const perStakeRake = Math.floor((this.stakeBase() * rakeBp) / 10000);
        for (const wallet of contributors) void distributeReferralRewards(wallet, perStakeRake);
      }
    } else {
      this.lastContributors = [];
      const refund = this.stakeBase();
      let allRefunded = true;
      for (const wallet of contributors) {
        const r = await this.adjustBalance(wallet, refund);
        if (r === null) {
          allRefunded = false;
          alert(`REFUND FAILED: ${refund} to ${shortWallet(wallet)} (room ${this.id}) — settle manually`);
        }
      }
      if (!allRefunded) return; // keep the net; failed refunds get manual/reboot recovery
    }
    // Money settled — now it's safe to drop the durable open-stakes record.
    if (matchId) {
      await store.clearOpenStakes(matchId);
      if (this.matchId === matchId) this.matchId = "";
    }
  }

  /** Pot value reconstructed from the snapshotted contributors (pot is already
   *  zeroed in settlePot before the first await). */
  private potSnapshot(contributors: string[]): number {
    return this.stakeBase() * contributors.length;
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

  /** Credit lifetime time-in-match for every seated human. Counts all real
   *  matches (free PvP, staked, competitive bots) — the endless sandbox returns
   *  before this is ever reached. */
  private recordPlaytime(): void {
    const sec = Math.round(this.matchElapsedMs / 1000);
    if (sec <= 0) return;
    for (const p of this.players.values()) {
      if (!p.isBot && p.wallet) void store.addPlaytime(p.wallet, sec);
    }
  }

  /** Flat chip rewards for a non-staked match. Staked matches pay the pot instead.
   *  Bot rooms: Practice Sandbox gives NOTHING; Competitive Bots Match gives a
   *  tiny chips + XP reward (no rating, not counted on the leaderboards) so it
   *  can't be farmed in place of real play. */
  private awardPlayRewards(): void {
    if (this.stake > 0) return;
    // Bot rooms (practice): sandbox = no rewards; competitive = tiny rewards.
    if (this.practice) {
      if (!this.competitive) return; // Practice Sandbox — no rewards
      for (const p of this.players.values()) {
        if (p.isBot || !p.wallet) continue;
        const won = p.id === this.winnerId;
        void store.adjustChips(p.wallet, won ? BOT_WIN_CHIPS : BOT_PLAY_CHIPS);
        void store.addXp(p.wallet, won ? BOT_WIN_XP : BOT_PLAY_XP);
      }
      return;
    }
    // Free PvP / quickplay: full flat chip rewards (+ leaderboard winnings).
    for (const p of this.players.values()) {
      if (p.isBot || !p.wallet) continue;
      const won = p.id === this.winnerId;
      void store.adjustChips(p.wallet, won ? CHIPS_WIN_REWARD : CHIPS_PLAY_REWARD);
      if (won) void store.recordWinnings(p.wallet, Currency.CHIPS, CHIPS_WIN_REWARD);
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
    const countdown = this.lobbyCounting ? Math.max(0, this.lobbyCountdownEndMs - Date.now()) : 0;
    for (const p of this.players.values()) {
      p.send(encodeRoomInfo(this.id, this.hostId, p.id === this.hostId, countdown, this.stake, this.currency, this.isPublic, list));
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
