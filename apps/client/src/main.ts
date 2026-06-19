import {
  ServerMsg,
  MatchPhase,
  Direction,
  TileType,
  PowerUpType,
  DRAW_WINNER_ID,
  PLAYER_BASE_SPEED,
  SPEED_UP_DELTA,
  MATCH_LENGTH_MS,
  SUDDEN_DEATH_AT_MS,
  PROTOCOL_VERSION,
  EMOTES,
  leagueFor,
  STARTING_RATING,
  SPECTATOR_ID,
  TOKEN_MINT,
  TOKEN_TICKER,
  TOKEN_DECIMALS,
  CalloutType,
  SKIN_COUNT,
  SKIN_PRICES,
  DEFAULT_SKINS,
  BET_SIZES,
  TOKEN_BET_SIZES,
} from "./net/protocol.js";
import {
  Net,
  quickplay,
  createRoom,
  joinRoom,
  practiceRoom,
  fetchProfile,
  setNickname,
  fetchLeaderboard,
  fetchTables,
  fetchBank,
  fetchPrice,
  withdrawTokens,
  claimDeposit,
  prepareDeposit,
  watchMatch,
  buySkin,
  selectSkin,
  attributeReferral,
  fetchReferralStats,
  type JoinResponse,
} from "./net/socket.js";
import { GameState } from "./game/state.js";
import { Renderer, PLAYER_COLORS, skinAvatar } from "./game/renderer.js";
import { Input } from "./game/input.js";
import { Assets, ASSET_VER } from "./game/assets.js";
import { loadSettings, saveSettings, type Settings } from "./settings.js";
import {
  listWallets,
  connectAndSignIn,
  loadWallet,
  disconnectWallet,
  shortAddr,
  reauth,
  signAndSendBase64,
} from "./net/wallet.js";
import { setupMenu, setMenuStatus, showScreen, showResult, renderRoom, renderTables, setTokenUsd, setProfileHandler, setWalletState } from "./ui/lobby.js";
import { renderShareCard, VARIANT_COUNT, type CardData } from "./ui/shareCard.js";
import { initAnalytics, track, identifyWallet, initErrorTracking } from "./analytics.js";
import { Predictor } from "./game/prediction.js";
import { initTelegram, isTelegram, getStartParam } from "./platform/telegram.js";
import { selectRegion } from "./net/region.js";
import { startPresence } from "./platform/presence.js";
import { enterImmersive } from "./platform/fullscreen.js";
import {
  startTelegramConnect,
  resumeTelegramWallet,
  disconnectTelegramWallet,
} from "./net/telegram-wallet.js";
import { registerSW } from "virtual:pwa-register";

const state = new GameState();
const net = new Net();
const input = new Input();
const assets = new Assets();
const predictor = new Predictor();
const settings = loadSettings();

let renderer: Renderer | null = null;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let currentTrack: "lobby" | "battle" = "lobby";
let lastGoodNick = ""; // last accepted unique nickname (to revert on a clash)
let lastCountSec = -1;
let practiceMode = false; // current room is practice vs bots (drives "Play again")
let goUntil = 0;
let prevSoftCount = -1;
let prevPlayerCount = 0;

const timerEl = document.getElementById("timer")!;
const playersEl = document.getElementById("players")!;
const pingEl = document.getElementById("ping")!;
const killfeedEl = document.getElementById("killfeed")!;
const toastEl = document.getElementById("toast")!;
const bottomEl = document.getElementById("hud-bottom")!;

// Unified powerup visuals — same sprite file on the field and in the UI,
// with a consistent emoji fallback when a sprite is missing.
interface PuMeta {
  sprite: string;
  emoji: string;
  label: string;
}
const POWERUP_META: Record<PowerUpType, PuMeta> = {
  [PowerUpType.BOMB_UP]: { sprite: "powerup_bomb", emoji: "💣", label: "Bomb +1" },
  [PowerUpType.FIRE_UP]: { sprite: "powerup_fire", emoji: "🔥", label: "Fire +1" },
  [PowerUpType.SPEED_UP]: { sprite: "powerup_speed", emoji: "👟", label: "Speed +" },
  [PowerUpType.KICK]: { sprite: "powerup_kick", emoji: "🦵", label: "Kick!" },
  [PowerUpType.WALL_PASS]: { sprite: "powerup_wall", emoji: "👻", label: "Wall Pass!" },
  [PowerUpType.HEALTH]: { sprite: "powerup_health", emoji: "❤️", label: "+1 Health!" },
};

/** Small icon element using the shared sprite (.webp or .png), emoji fallback. */
function puIcon(meta: PuMeta): HTMLElement {
  const img = document.createElement("img");
  img.className = "pu-ic";
  img.alt = meta.emoji;
  const exts = [".webp", ".png"];
  let i = 0;
  const next = () => {
    if (i >= exts.length) {
      const span = document.createElement("span");
      span.textContent = meta.emoji;
      img.replaceWith(span);
      return;
    }
    img.src = `/sprites/${meta.sprite}${exts[i++]}`;
  };
  img.onerror = () => next();
  next();
  return img;
}

interface KillLine {
  killerId: number;
  victimId: number;
  until: number;
}
const killLines: KillLine[] = [];
let toastUntil = 0;
let hudSig = "";
let prevMyLives = -1; // track HP to flash on damage
const prevLives = new Map<number, number>(); // per-player HP, to sfx wounds
let prevBombIds = new Set<number>(); // bomb ids last seen, to detect placements
let iGotFirstBlood = false; // did the local player take first blood this match
let lastMatch: { won: boolean; draw: boolean; frags: number; earnText: string; ratingDelta: number; firstBlood: boolean } | null = null;

const inGame = (p: MatchPhase) =>
  p === MatchPhase.COUNTDOWN || p === MatchPhase.PLAYING || p === MatchPhase.SUDDEN_DEATH;

// --- debug overlay (open with ?debug=1; turn off with ?debug=0) -----------
const BUILD = "rbk-fix3";
const dbgParam = new URLSearchParams(location.search).get("debug");
if (dbgParam === "1") localStorage.setItem("bp_debug", "1");
else if (dbgParam === "0") localStorage.removeItem("bp_debug");
const DEBUG = localStorage.getItem("bp_debug") === "1";
let dbgEl: HTMLElement | null = null;
let dbgLastTs = performance.now();
let dbgFps = 0;
if (DEBUG) {
  dbgEl = document.createElement("div");
  dbgEl.style.cssText =
    "position:fixed;top:4px;left:4px;z-index:9999;background:rgba(0,0,0,.75);color:#0f0;" +
    "font:11px/1.35 monospace;padding:6px 8px;border-radius:6px;white-space:pre;pointer-events:none";
  document.body.appendChild(dbgEl);
}
function updateDebug(): void {
  if (!dbgEl) return;
  const now = performance.now();
  dbgFps = dbgFps * 0.9 + (1000 / Math.max(1, now - dbgLastTs)) * 0.1;
  dbgLastTs = now;
  const snapTick = state.latest()?.tick ?? -1;
  const d = predictor.debug;
  const sn = state.clockSynced ? Math.floor(state.serverNow() / (1000 / 30)) : -1;
  dbgEl.textContent =
    `build ${BUILD}  proto v${PROTOCOL_VERSION}\n` +
    `ping ${state.pingMs}ms  fps ${dbgFps.toFixed(0)}\n` +
    `clockSynced ${state.clockSynced}\n` +
    `snapTick ${snapTick}  serverNowTick ${sn}\n` +
    `headTick ${d.headTick}  lead ${d.headTick - sn}\n` +
    `predicting ${d.predicting}  errEma ${d.errEma.toFixed(3)}\n` +
    `phase ${MatchPhase[state.phase]}`;
}

function music(track: "lobby" | "battle"): void {
  currentTrack = track;
  assets.playMusic(track);
}

// --- networking -----------------------------------------------------------

let connectWatchdog: ReturnType<typeof setTimeout> | null = null;
function clearConnectWatchdog(): void {
  if (connectWatchdog) clearTimeout(connectWatchdog);
  connectWatchdog = null;
}

async function connect(getJoin: () => Promise<JoinResponse>): Promise<void> {
  // Match start is a user gesture — a good moment to go fullscreen + landscape
  // on mobile web (no-op in Telegram / on desktop / if already fullscreen).
  // Wrapped defensively: it must never block or abort the actual join.
  try {
    void enterImmersive();
  } catch {
    /* ignore */
  }
  showScreen("loading");
  const setLoad = (t: string) => {
    const el = document.getElementById("loading-status");
    if (el) el.textContent = t;
  };
  setLoad("connecting…");
  try {
    let res = await getJoin();
    // If we have a connected wallet but the server didn't accept the session
    // (e.g. it restarted), re-sign once so stats are credited to the wallet.
    if (loadWallet() && !res.wallet) {
      setLoad("verifying wallet…");
      if (await reauth()) res = await getJoin();
    }
    if (typeof res.chips === "number") setBalance(res.chips);
    if (typeof res.gameTokens === "number") setTokenBadge(res.gameTokens);
    setLoad("opening connection…");
    net.connect(res.token);
    // Watchdog: if the socket never delivers WELCOME/ROOM_INFO, don't leave the
    // player stuck on a spinner — bounce back with a clear message.
    clearConnectWatchdog();
    connectWatchdog = setTimeout(() => {
      net.close();
      showScreen("menu");
      const msg = "Couldn't reach the game server. Check your connection and try again.";
      setMenuStatus(msg);
      showBanner(msg);
    }, 10000);
  } catch (err) {
    showScreen("menu");
    const msg = `Couldn't join: ${(err as Error)?.message ?? String(err)}`;
    setMenuStatus(msg);
    showBanner(msg);
  }
}

net.onClose = () => {
  clearConnectWatchdog();
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = null;
  showScreen("menu");
  music("lobby");
  setMenuStatus("Disconnected");
};

net.onReconnecting = (n) => {
  toastEl.innerHTML = "";
  const s = document.createElement("span");
  s.textContent = `Reconnecting… (${n})`;
  toastEl.appendChild(s);
  toastEl.classList.remove("hidden");
  toastUntil = 0; // keep it pinned until we reconnect
};

net.onOpen = () => {
  toastEl.classList.add("hidden"); // clear any "reconnecting…" banner
};

let spectating = false;

/** Enter watch-only view: show the board, hide controls, show a banner. */
function enterSpectator(): void {
  enterGame();
  document.getElementById("touch-controls")?.classList.add("hidden");
  const banner = document.getElementById("spectator")!;
  banner.textContent = "👁 SPECTATING — live match";
  banner.classList.remove("hidden");
}

net.onMessage = (msg) => {
  switch (msg.type) {
    case ServerMsg.WELCOME:
      clearConnectWatchdog(); // we reached the server — cancel the timeout
      if (msg.protocolVersion !== PROTOCOL_VERSION) {
        net.close();
        showScreen("menu");
        setMenuStatus("Game was updated — please refresh the page (Ctrl/Cmd+R).");
        return;
      }
      state.myId = msg.playerId;
      spectating = msg.playerId === SPECTATOR_ID;
      if (spectating) enterSpectator();
      break;
    case ServerMsg.ROOM_INFO: {
      const count = msg.players.length;
      if (count > prevPlayerCount && prevPlayerCount > 0) assets.play("join");
      prevPlayerCount = count;
      state.setRoomInfo(msg);
      updateBalanceBars(); // reflect this table's stake in the balance bars
      // Don't yank the player off the result screen — they leave it via a button.
      if (!inGame(state.phase) && !onResultScreen() && !spectating) {
        showScreen("room");
        renderRoom(state);
        // Stake raising only makes sense in real (non-practice) rooms.
        document.getElementById("propose-stake")?.classList.toggle("hidden", practiceMode);
        music("lobby");
      }
      break;
    }
    case ServerMsg.STATE_SNAPSHOT: {
      state.addSnapshot(msg);
      const me = msg.players.find((p) => p.id === state.myId);
      if (me) {
        predictor.onServerState(msg.tick, me.x, me.y, me.speed, me.alive, state.grid, me.wallPass);
        // Took damage but survived -> hurt flash (elimination handled by death event).
        if (me.alive && prevMyLives >= 0 && me.lives < prevMyLives) flashHit();
        prevMyLives = me.lives;
      }
      // Wound cue + hurt pose for ANY player that lost a life but survived
      // (death is its own event). Two interchangeable hurt sounds for variety.
      for (const p of msg.players) {
        const prev = prevLives.get(p.id);
        if (prev !== undefined && p.alive && p.lives > 0 && p.lives < prev) {
          assets.play(Math.random() < 0.5 ? "wound" : "wound2");
          renderer?.setHurt(p.id);
        }
        prevLives.set(p.id, p.lives);
      }
      // Place-bomb pose: trigger for the owner of any newly-appeared bomb.
      for (const b of msg.bombs) {
        if (!prevBombIds.has(b.id)) renderer?.setPlaceBomb(b.ownerId);
      }
      prevBombIds = new Set(msg.bombs.map((b) => b.id));
      // Soft-block break sound (derived from the reconstructed grid).
      let soft = 0;
      for (let i = 0; i < state.grid.length; i++) if (state.grid[i] === TileType.SOFT) soft++;
      if (prevSoftCount >= 0 && soft < prevSoftCount) assets.play("block_break", 0.35);
      prevSoftCount = soft;
      break;
    }
    case ServerMsg.MATCH_PHASE:
      state.setPhase(msg.phase, msg.timerMs);
      if (msg.phase === MatchPhase.COUNTDOWN) {
        enterGame();
        lastCountSec = -1;
        renderer?.setCountdown(true); // highlight your corner while 3-2-1 runs
      } else if (msg.phase === MatchPhase.PLAYING) {
        assets.play("go");
        goUntil = performance.now() + 800;
        renderer?.setCountdown(false);
        renderer?.onMatchStart(); // start the 30s "find yourself" glow
        track("match_started", { players: state.roomPlayers.length });
      } else if (msg.phase === MatchPhase.SUDDEN_DEATH) {
        assets.stopMusic(); // stop the battle loop so it doesn't overlap the last-minute track
        assets.play("sudden_death");
      } else if (msg.phase === MatchPhase.LOBBY) {
        prevSoftCount = -1;
        renderer?.setCountdown(false);
        if (!onResultScreen() && !spectating) {
          showScreen("room");
          renderRoom(state);
          music("lobby");
        }
      }
      break;
    case ServerMsg.MATCH_END:
      state.winnerId = msg.winnerId;
      assets.stop("sudden_death"); // kill the last-minute track
      if (spectating) {
        const banner = document.getElementById("spectator")!;
        banner.textContent =
          msg.winnerId === DRAW_WINNER_ID ? "🤝 Draw — match over" : `🏆 ${state.nameOf(msg.winnerId)} wins`;
        banner.classList.remove("hidden");
        setTimeout(leaveToMenu, 4000);
      } else {
        announceResult(msg.winnerId);
      }
      break;
    case ServerMsg.PONG:
      state.pingMs = Math.round(performance.now() - msg.timestamp);
      break;
    case ServerMsg.MATCH_SEED:
      state.seedCommit = msg.commit;
      if (msg.seed) state.seed = msg.seed;
      break;
    case ServerMsg.EVENT_EXPLOSION:
      assets.play("explode");
      renderer?.onExplosion(msg.cells);
      break;
    case ServerMsg.EVENT_PICKUP: {
      assets.play("pickup");
      const snap = state.latest();
      const pp = snap?.players.find((p) => p.id === msg.playerId);
      if (pp) renderer?.burst(Math.floor(pp.x), Math.floor(pp.y), "#7CFC00", 10, 3);
      if (msg.playerId === state.myId) showPickupToast(msg.powerup);
      break;
    }
    case ServerMsg.EVENT_KILL:
      killLines.push({ killerId: msg.killerId, victimId: msg.victimId, until: performance.now() + 4500 });
      if (killLines.length > 5) killLines.shift();
      if (msg.killerId === state.myId && msg.victimId !== state.myId) registerMyKill();
      break;
    case ServerMsg.EVENT_PLAYER_DEATH: {
      assets.play("die");
      assets.playGore(); // wet splat layered over the death cue
      const snap = state.latest();
      const dp = snap?.players.find((p) => p.id === msg.playerId);
      if (dp) renderer?.onDeath(Math.floor(dp.x), Math.floor(dp.y), PLAYER_COLORS[dp.id % PLAYER_COLORS.length]);
      if (msg.playerId === state.myId) flashHit();
      break;
    }
    case ServerMsg.EVENT_EMOTE:
      showEmote(msg.playerId, msg.emote);
      break;
    case ServerMsg.EVENT_CALLOUT:
      if (msg.kind === CalloutType.FIRST_BLOOD) {
        renderer?.firstBlood(); // pixel "FIRST BLOOD" text + blood drips
        void assets.playReverb("first_blood"); // echo + reverb
        if (msg.playerId === state.myId) iGotFirstBlood = true; // for the share card
      }
      break;
    case ServerMsg.STAKE_VOTE:
      onStakeVote(msg);
      break;
    default:
      break;
  }
};

// --- game lifecycle -------------------------------------------------------

function enterGame(): void {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (!renderer) {
    renderer = new Renderer(canvas);
    renderer.setAssets(assets);
    renderer.skinOf = (id) => state.skinOf(id);
  }
  renderer.resize();
  renderer.remeasure(); // re-fit after the game screen has actually laid out
  assets.stop("sudden_death");
  prevSoftCount = -1;
  killLines.length = 0;
  killfeedEl.innerHTML = "";
  hudSig = "";
  bottomSig = "";
  bottomEl.innerHTML = "";
  sdWarned = false;
  prevMyLives = -1;
  prevLives.clear();
  prevBombIds.clear();
  iGotFirstBlood = false;
  myKillTimes = [];
  calloutEl.classList.add("hidden");
  spectatorEl.classList.add("hidden");
  toastUntil = 0;
  toastEl.classList.add("hidden");
  showScreen("game");
  updateBalanceBars(); // show the balance bar in the in-game HUD
  music("battle");
  predictor.reset();
}

function announceResult(winnerId: number): void {
  const meFrags = state.latest()?.players.find((p) => p.id === state.myId)?.frags ?? 0;
  track("match_ended", { won: winnerId === state.myId, draw: winnerId === DRAW_WINNER_ID, frags: meFrags });
  // Winner strikes the victory pose on the battlefield during the end linger.
  if (winnerId !== DRAW_WINNER_ID) renderer?.setVictory(winnerId);
  let title: string;
  if (winnerId === DRAW_WINNER_ID) {
    title = "🤝 Draw!";
    assets.play("draw");
  } else if (winnerId === state.myId) {
    title = "🏆 You win!";
    assets.play("victory");
  } else {
    title = `${state.nameOf(winnerId)} wins`;
    assets.play("defeat");
  }
  music("lobby");
  // Settlement (chips) + rating update happened server-side. Refresh the wallet
  // and show the chip swing AND the rating change on the result screen.
  const stake = state.roomStake;
  const won = winnerId === state.myId;
  const draw = winnerId === DRAW_WINNER_ID;
  const sym = state.roomCurrency === 1 ? "💎" : "🪙";
  let chipNote = "";
  if (stake > 0) {
    chipNote = draw ? "Stake refunded" : won ? `Won the pot ${sym}` : `Lost ${sym}${stake.toLocaleString()}`;
  }
  const note = document.getElementById("result-chips");
  if (note) note.textContent = chipNote;
  // Snapshot this match for the share card. Net = pot won (stake × others) or
  // the stake lost; for token tables show the amount AND its USD value.
  const players = state.latest()?.players.length || state.roomPlayers?.length || 2;
  const net = draw ? 0 : won ? stake * (players - 1) : -stake;
  let earnText: string;
  if (stake > 0) {
    if (draw) {
      earnText = `Stake refunded ${sym}`;
    } else if (state.roomCurrency === 1) {
      const amt = Math.abs(net).toLocaleString(undefined, { maximumFractionDigits: 2 });
      earnText = `${net > 0 ? "+" : "−"}💎${amt}${usdOf(Math.abs(net))}`;
    } else {
      earnText = `${net > 0 ? "+" : "−"}🪙${Math.abs(net).toLocaleString()}`;
    }
  } else {
    earnText = won ? "+🪙100" : "+🪙20";
  }
  lastMatch = { won, draw, frags: meFrags, earnText, ratingDelta: 0, firstBlood: iGotFirstBlood };
  const w = loadWallet();
  const prevRating = lastRating;
  if (w) {
    void fetchProfile(w.address)
      .then((p) => {
        setStats(p.chips, p.rating);
        setTokenBadge(p.gameTokens);
        const d = p.rating - prevRating;
        if (lastMatch) lastMatch.ratingDelta = d;
        const ratingNote =
          d !== 0 ? `${leagueFor(p.rating).emoji} ${p.rating} (${d > 0 ? "+" : ""}${d})` : "";
        if (note) note.textContent = [chipNote, ratingNote].filter(Boolean).join("  ·  ");
      })
      .catch(() => {});
  }
  setTimeout(() => {
    showResult(title);
    const lobbyBtn = document.getElementById("result-lobby")!;
    lobbyBtn.textContent = practiceMode ? "🔁 Play again" : "↩ Back to lobby";
    // Render the board here (not earlier): by now the final snapshot — the one
    // carrying the killing blow's frag — has arrived, so kill counts are right.
    renderResultBoard(winnerId);
    const fair = document.getElementById("result-fair")!;
    fair.textContent =
      state.seed && state.seedCommit
        ? `🔒 provably fair · seed ${state.seed.slice(0, 10)}… · commit ${state.seedCommit.slice(0, 8)}…`
        : "";
  }, 3000); // linger on the battlefield (corpses + blood) before the scoreboard
}

/** Final scoreboard on the result screen: placement, frags, your row marked. */
function renderResultBoard(winnerId: number): void {
  const board = document.getElementById("result-board");
  if (!board) return;
  const players = state.latest()?.players ?? [];
  // Winner first, then by frags, then survivors above the fallen.
  const ranked = [...players].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    return Number(b.alive) - Number(a.alive) || b.frags - a.frags;
  });
  // Per-player stake swing (who won/lost how much in this room's currency).
  const stake = state.roomStake;
  const draw = winnerId === DRAW_WINNER_ID;
  const sym = state.roomCurrency === 1 ? "💎" : "🪙";
  const n = ranked.length;
  const walletOf = new Map(state.roomPlayers.map((rp) => [rp.id, rp.wallet]));
  board.innerHTML = "";
  ranked.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "rb-row" + (p.id === state.myId ? " me" : "") + (p.id === winnerId ? " win" : "");
    const place = p.id === winnerId ? "👑" : `${i + 1}`;
    li.append(
      el("span", "rb-rank", place),
      el("span", "rb-name", state.nameOf(p.id) + (p.id === state.myId ? " (you)" : "")),
      el("span", "rb-frags", `💀 ${p.frags}`),
    );
    const pw = walletOf.get(p.id);
    if (pw) {
      li.style.cursor = "pointer";
      li.title = "View profile";
      li.addEventListener("click", () => void openPublicProfile(pw));
    }
    if (stake > 0 && !draw) {
      const net = p.id === winnerId ? stake * (n - 1) : -stake;
      const usd = state.roomCurrency === 1 ? usdOf(Math.abs(net)) : "";
      const win = el(
        "span",
        "rb-win " + (net > 0 ? "up" : "down"),
        `${net > 0 ? "+" : "−"}${sym}${Math.abs(net).toLocaleString()}${usd}`,
      );
      li.append(win);
    }
    board.appendChild(li);
  });
}

input.onBomb = () => {
  net.sendBomb();
  assets.play("place");
  renderer?.setPlaceBomb(state.myId); // instant local feedback (snapshot covers remotes)
};

// --- juice / feedback -----------------------------------------------------

const hitFlashEl = document.getElementById("hit-flash")!;
const calloutEl = document.getElementById("callout")!;
const spectatorEl = document.getElementById("spectator")!;
let calloutUntil = 0;
let myKillTimes: number[] = [];

/** Red damage vignette + a kick of screen shake when the local player is hit. */
function flashHit(): void {
  hitFlashEl.classList.remove("show");
  void hitFlashEl.offsetWidth; // restart the animation
  hitFlashEl.classList.add("show");
  renderer?.shake(9, 260);
}

/** Flash a big mid-screen callout. `who` (optional) tags the player it's about. */
function showCallout(word: string, who = -1): void {
  const text = who >= 0 && who !== state.myId ? `${word} ${state.nameOf(who)}` : word;
  calloutEl.textContent = text;
  calloutEl.classList.remove("hidden", "show");
  void calloutEl.offsetWidth;
  calloutEl.classList.add("show");
  calloutUntil = performance.now() + 1400;
}

const STREAK_WORDS = ["", "", "DOUBLE KILL!", "TRIPLE KILL!", "MULTI KILL!", "RAMPAGE!"];
function registerMyKill(): void {
  const now = performance.now();
  myKillTimes = myKillTimes.filter((t) => now - t < 3500);
  myKillTimes.push(now);
  const n = myKillTimes.length;
  if (n >= 2) {
    showCallout(STREAK_WORDS[Math.min(n, STREAK_WORDS.length - 1)]);
    assets.play("go");
  }
}

let sdWarned = false;
/** Spectator banner when eliminated + a one-shot sudden-death warning. */
function updateFeedback(): void {
  if (calloutUntil && performance.now() > calloutUntil) {
    calloutEl.classList.add("hidden");
    calloutUntil = 0;
  }
  const me = state.latest()?.players.find((p) => p.id === state.myId);
  const live = state.phase === MatchPhase.PLAYING || state.phase === MatchPhase.SUDDEN_DEATH;
  if (live && me && !me.alive) {
    const alive = state.latest()!.players.filter((p) => p.alive).length;
    spectatorEl.textContent = `☠️ You're out — spectating · ${alive} left`;
    spectatorEl.classList.remove("hidden");
  } else {
    spectatorEl.classList.add("hidden");
  }

  // Telegraph sudden death ~3s before the walls start closing in.
  if (state.phase === MatchPhase.PLAYING && !sdWarned) {
    const left = state.phaseTimeLeft();
    const sdAtLeft = MATCH_LENGTH_MS - SUDDEN_DEATH_AT_MS; // ms-left when SD begins
    if (left <= sdAtLeft + 3500 && left > sdAtLeft) {
      sdWarned = true;
      toastEl.innerHTML = "";
      const s = document.createElement("span");
      s.textContent = "⚠️ Sudden death incoming!";
      toastEl.appendChild(s);
      toastEl.classList.remove("hidden");
      toastUntil = performance.now() + 2500;
    }
  }
}

// --- HUD ------------------------------------------------------------------

function fmtTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function updateHud(): void {
  if (state.phase === MatchPhase.COUNTDOWN) {
    const n = Math.ceil(state.phaseTimeLeft() / 1000);
    timerEl.textContent = n > 0 ? String(n) : "GO";
    if (n !== lastCountSec && n > 0 && n <= 3) {
      assets.play("countdown");
      lastCountSec = n;
    }
  } else {
    timerEl.textContent = fmtTime(state.phaseTimeLeft());
  }
  timerEl.style.color = state.phase === MatchPhase.SUDDEN_DEATH ? "#ff6b6b" : "";
  pingEl.textContent = `${state.pingMs} ms`;

  const snap = state.latest();
  if (!snap) return;

  // Sort by frags (scoreboard order); rebuild only when something changed.
  const ordered = [...snap.players].sort((a, b) => b.frags - a.frags || a.id - b.id);
  const sig = ordered
    .map(
      (p) =>
        `${p.id}.${p.alive ? 1 : 0}.${p.lives}.${p.frags}.${p.bombsMax}.${p.power}.${p.speed.toFixed(1)}.${p.kick ? 1 : 0}.${p.wallPass ? 1 : 0}`,
    )
    .join("|");
  if (sig === hudSig) return;
  hudSig = sig;

  playersEl.innerHTML = "";
  for (const p of ordered) {
    const card = document.createElement("div");
    card.className = "pcard" + (p.alive ? "" : " dead");

    const dot = document.createElement("span");
    dot.className = "pdot";
    dot.style.background = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
    card.appendChild(dot);

    const name = document.createElement("span");
    name.textContent = `${state.nameOf(p.id)}${p.id === state.myId ? " (you)" : ""}`;
    card.appendChild(name);

    const score = document.createElement("span");
    score.textContent = `☠️${p.frags}`;
    card.appendChild(score);

    const lives = document.createElement("span");
    lives.textContent = p.lives > 0 ? "❤️".repeat(p.lives) : "💀";
    card.appendChild(lives);

    playersEl.appendChild(card);
  }
}

let bottomSig = "";
/** The local player's own kit (lives + powerups with level counters), shown in
 *  a bar at the bottom of the screen using the same sprites as the field. */
function updateBottomHud(): void {
  const snap = state.latest();
  const me = snap?.players.find((p) => p.id === state.myId);
  if (!me) {
    if (bottomSig !== "") {
      bottomEl.innerHTML = "";
      bottomSig = "";
    }
    return;
  }
  const speedLvl = Math.max(0, Math.round((me.speed - PLAYER_BASE_SPEED) / SPEED_UP_DELTA));
  const sig = `${me.alive ? 1 : 0}.${me.lives}.${me.bombsMax}.${me.power}.${speedLvl}.${me.kick ? 1 : 0}.${me.wallPass ? 1 : 0}`;
  if (sig === bottomSig) return;
  bottomSig = sig;

  bottomEl.innerHTML = "";

  const livesEl = document.createElement("div");
  livesEl.className = "kit lives";
  livesEl.textContent = me.lives > 0 ? "❤️".repeat(me.lives) : "💀";
  bottomEl.appendChild(livesEl);

  bottomEl.appendChild(kitStat(POWERUP_META[PowerUpType.BOMB_UP], me.bombsMax, true));
  bottomEl.appendChild(kitStat(POWERUP_META[PowerUpType.FIRE_UP], me.power, true));
  bottomEl.appendChild(kitStat(POWERUP_META[PowerUpType.SPEED_UP], speedLvl + 1, true));
  bottomEl.appendChild(kitStat(POWERUP_META[PowerUpType.KICK], 0, me.kick));
  bottomEl.appendChild(kitStat(POWERUP_META[PowerUpType.WALL_PASS], 0, me.wallPass));
}

/** Bottom-bar entry: field sprite + level number (or on/off for toggles). */
function kitStat(meta: PuMeta, level: number, active: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "kit" + (active ? "" : " off");
  wrap.appendChild(puIcon(meta));
  const n = document.createElement("span");
  n.className = "lvl";
  n.textContent = level > 0 ? `×${level}` : active ? "✓" : "—";
  wrap.appendChild(n);
  return wrap;
}

function showPickupToast(pu: PowerUpType): void {
  const meta = POWERUP_META[pu];
  toastEl.innerHTML = "";
  toastEl.appendChild(puIcon(meta));
  const t = document.createElement("span");
  t.textContent = meta.label;
  toastEl.appendChild(t);
  toastEl.classList.remove("hidden");
  toastUntil = performance.now() + 1400;
}

function renderKillfeed(now: number): void {
  while (killLines.length && killLines[0].until < now) killLines.shift();
  // Only rebuild when set changes is overkill; few entries, cheap.
  killfeedEl.innerHTML = "";
  for (const k of killLines) {
    const e = document.createElement("div");
    e.className = "kill-entry";
    const killer = document.createElement("span");
    killer.className = "nm";
    killer.style.color = k.killerId < 255 ? PLAYER_COLORS[k.killerId % PLAYER_COLORS.length] : "#aaa";
    killer.textContent = k.killerId < 255 ? state.nameOf(k.killerId) : "☠️";
    const mid = document.createElement("span");
    mid.textContent = "💥";
    const victim = document.createElement("span");
    victim.className = "nm";
    victim.style.color = PLAYER_COLORS[k.victimId % PLAYER_COLORS.length];
    victim.textContent = state.nameOf(k.victimId);
    e.append(killer, mid, victim);
    killfeedEl.appendChild(e);
  }
}

const cdEl = document.getElementById("countdown-overlay")!;
let lastCdText = "";
function updateCountdown(): void {
  let text = "";
  let go = false;
  if (state.phase === MatchPhase.COUNTDOWN) {
    const n = Math.ceil(state.phaseTimeLeft() / 1000);
    text = n > 0 ? String(n) : "GO!";
  } else if (performance.now() < goUntil) {
    text = "GO!";
    go = true;
  }
  if (text !== lastCdText) {
    lastCdText = text;
    cdEl.textContent = text;
    cdEl.classList.toggle("hidden", text === "");
    cdEl.classList.toggle("go", go);
    if (text) {
      // restart the pop animation
      cdEl.style.animation = "none";
      void cdEl.offsetWidth;
      cdEl.style.animation = "";
    }
  }
}

// --- main loop ------------------------------------------------------------

function frame(): void {
  const now = performance.now();
  updateDebug();

  if (renderer && (inGame(state.phase) || state.phase === MatchPhase.END)) {
    // Rollback prediction for the local player: advance + send tick-stamped
    // inputs, then render the predicted head over the interpolated view.
    if (state.clockSynced) {
      // Freeze movement until the match is actually live — no moving during the
      // 3-2-1 countdown (feed NONE so prediction stays put, and don't send).
      const live = state.phase === MatchPhase.PLAYING || state.phase === MatchPhase.SUDDEN_DEATH;
      const sends = predictor.step(state.serverNow(), state.pingMs, live ? input.dir : Direction.NONE);
      if (live) for (const s of sends) net.sendMove(s.dir, s.tick);
    }
    const view = state.view();
    // Use the predicted position only while prediction is healthy; otherwise
    // (bad clock / very high jitter) fall back to the smooth interpolated view.
    if (predictor.ready && predictor.healthy) {
      const me = view.players.find((p) => p.id === state.myId);
      if (me && me.alive) {
        me.x = predictor.rx;
        me.y = predictor.ry;
      }
    }
    renderer.render(view, state.myId);
    updateHud();
    updateBottomHud();
    updateFeedback();
    updateCountdown();
    renderKillfeed(now);
    if (toastUntil && now > toastUntil) {
      toastEl.classList.add("hidden");
      toastUntil = 0;
    }
  } else if (state.phase === MatchPhase.LOBBY && !document.getElementById("room")!.classList.contains("hidden")) {
    renderRoom(state);
  }
  requestAnimationFrame(frame);
}

// --- settings -------------------------------------------------------------

function applySettings(): void {
  assets.setMusicEnabled(settings.music);
  assets.setSfxEnabled(settings.sfx);
  input.setControlScheme(settings.controls);
  syncSettingsUI();
}

function syncSettingsUI(): void {
  const m = document.getElementById("set-music") as HTMLButtonElement;
  const s = document.getElementById("set-sfx") as HTMLButtonElement;
  m.dataset.on = String(settings.music);
  m.textContent = settings.music ? "On" : "Off";
  s.dataset.on = String(settings.sfx);
  s.textContent = settings.sfx ? "On" : "Off";
  document.getElementById("ctl-joystick")!.classList.toggle("active", settings.controls === "joystick");
  document.getElementById("ctl-dpad")!.classList.toggle("active", settings.controls === "dpad");
}

function update<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings[key] = value;
  saveSettings(settings);
  applySettings();
}

// Claim a globally-unique nickname when a signed-in wallet edits the field.
function wireNickname(): void {
  const nick = document.getElementById("nickname") as HTMLInputElement | null;
  if (!nick) return;
  nick.addEventListener("change", async () => {
    const name = nick.value.trim();
    localStorage.setItem("bp_name", name);
    if (!loadWallet()?.session || name.length < 2) return; // anonymous: nothing to claim
    const r = await setNickname(name).catch(() => ({ error: "net" }) as { error: string });
    if (r.error === "name_taken") {
      setMenuStatus("Этот ник уже занят — выбери другой");
      nick.value = lastGoodNick;
    } else if ("ok" in r && r.ok) {
      lastGoodNick = r.name ?? name;
      setMenuStatus("");
    }
  });
}

function wireSettings(): void {
  document.getElementById("open-settings")!.addEventListener("click", () => showScreen("settings"));
  document.getElementById("settings-back")!.addEventListener("click", () => {
    showScreen("menu");
    music("lobby");
  });
  document.getElementById("set-music")!.addEventListener("click", () => update("music", !settings.music));
  document.getElementById("set-sfx")!.addEventListener("click", () => update("sfx", !settings.sfx));
  document.getElementById("ctl-joystick")!.addEventListener("click", () => update("controls", "joystick"));
  document.getElementById("ctl-dpad")!.addEventListener("click", () => update("controls", "dpad"));
}

// --- wallet ---------------------------------------------------------------

function refreshWalletBtn(): void {
  const btn = document.getElementById("wallet-btn")!;
  const w = loadWallet();
  setWalletState(!!w); // drives the 🔒 on staked tables in the browser
  btn.textContent = w ? `🟢 ${shortAddr(w.address)}` : "🔗 Connect Wallet";
  // Show rating + chips + token balance whenever a wallet is connected.
  if (w) {
    attributeReferralOnce(); // bind a pending inviter once we have a wallet
    void fetchProfile(w.address)
      .then((p) => {
        setStats(p.chips, p.rating);
        setTokenBadge(p.gameTokens);
        // Show the wallet's claimed (unique) nickname in the field.
        const nick = document.getElementById("nickname") as HTMLInputElement | null;
        if (nick && p.name) {
          nick.value = p.name;
          lastGoodNick = p.name;
        }
      })
      .catch(() => {});
  } else {
    document.getElementById("player-stats")?.classList.add("hidden");
    setTokenBadge(undefined);
  }
}

function openWalletModal(): void {
  const modal = document.getElementById("wallet-modal")!;
  const list = document.getElementById("wallet-list")!;
  const empty = document.getElementById("wallet-empty")!;
  const status = document.getElementById("wallet-modal-status")!;
  status.textContent = "";
  list.innerHTML = "";

  // Inside Telegram there is no in-page wallet: connect via Phantom deeplink
  // (leaves the app and resumes on return). Hide the QR / open-in-browser block.
  if (isTelegram) {
    empty.classList.add("hidden");
    document.querySelector(".wc-section")?.classList.add("hidden");
    const row = document.createElement("button");
    row.className = "wallet-row";
    row.textContent = "👻 Connect with Phantom";
    row.addEventListener("click", () => {
      status.textContent = "Opening Phantom…";
      track("wallet_connect_start", { provider: "telegram-phantom" });
      void startTelegramConnect();
    });
    list.appendChild(row);
    modal.classList.remove("hidden");
    return;
  }

  const wallets = listWallets();
  empty.classList.toggle("hidden", wallets.length > 0);
  for (const w of wallets) {
    const row = document.createElement("button");
    row.className = "wallet-row";
    if (w.icon) {
      const img = document.createElement("img");
      img.src = w.icon;
      row.appendChild(img);
    }
    const nm = document.createElement("span");
    nm.textContent = w.name;
    row.appendChild(nm);
    row.addEventListener("click", async () => {
      status.textContent = `Connecting to ${w.name}…`;
      try {
        await connectAndSignIn(w);
        const wal = loadWallet();
        if (wal) identifyWallet(wal.address);
        track("wallet_connected", { provider: w.name });
        refreshWalletBtn();
        modal.classList.add("hidden");
      } catch (e) {
        status.textContent = `Failed: ${(e as Error).message}`;
      }
    });
    list.appendChild(row);
  }

  // Phone connect (no WalletConnect SDK): deeplink into the wallet's in-app
  // browser (where Wallet Standard works) + a QR of the game URL to scan.
  const url = window.location.href.split("#")[0];
  const enc = encodeURIComponent(url);
  const ref = encodeURIComponent(window.location.origin);
  (document.getElementById("wc-qr") as HTMLImageElement).src =
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${enc}`;
  document.getElementById("wc-phantom")!.onclick = () => {
    window.location.href = `https://phantom.app/ul/browse/${enc}?ref=${ref}`;
  };
  document.getElementById("wc-solflare")!.onclick = () => {
    window.location.href = `https://solflare.com/ul/v1/browse/${enc}?ref=${ref}`;
  };
  document.getElementById("wc-backpack")!.onclick = () => {
    window.location.href = `https://backpack.app/ul/v1/browse/${enc}?ref=${ref}`;
  };
  document.getElementById("wc-okx")!.onclick = () => {
    const deeplink = `okx://wallet/dapp/url?dappUrl=${enc}`;
    window.location.href = `https://web3.okx.com/download?deeplink=${encodeURIComponent(deeplink)}`;
  };
  document.getElementById("wc-coinbase")!.onclick = () => {
    window.location.href = `https://go.cb-w.com/dapp?cb_url=${enc}`;
  };

  modal.classList.remove("hidden");
}

function wireWallet(): void {
  const btn = document.getElementById("wallet-btn")!;
  btn.addEventListener("click", () => {
    if (loadWallet()) {
      disconnectWallet();
      disconnectTelegramWallet();
      refreshWalletBtn();
    } else {
      openWalletModal();
    }
  });
  document
    .getElementById("wallet-modal-close")!
    .addEventListener("click", () => document.getElementById("wallet-modal")!.classList.add("hidden"));
  refreshWalletBtn();
}

// --- profile & leaderboard ------------------------------------------------

function el(tag: string, cls: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
}

function profCell(label: string, value: string | number): HTMLElement {
  const c = document.createElement("div");
  c.className = "prof-cell";
  c.append(el("span", "", label), el("b", "", String(value)));
  return c;
}

/** Last rating we've seen for the local wallet (to show the post-match swing). */
let lastRating = STARTING_RATING;

/** Update + reveal the rating + chips shown in the menu header. */
function setStats(chips: number, rating: number): void {
  const amt = document.getElementById("chip-amount");
  if (amt) amt.textContent = chips.toLocaleString();
  const badge = document.getElementById("rating-badge");
  if (badge) {
    const lg = leagueFor(rating);
    badge.textContent = `${lg.emoji} ${rating}`;
    badge.title = `${lg.name} · rating ${rating}`;
  }
  lastRating = rating;
  lastChips = chips;
  document.getElementById("player-stats")?.classList.remove("hidden");
  updateBalanceBars();
}
/** Chips-only update when we don't have a fresh rating (keeps the last one). */
function setBalance(chips: number): void {
  setStats(chips, lastRating);
}

let lastChips: number | undefined;
let lastTokens: number | undefined;

/** Render the always-on balance bars (waiting room + in-game HUD) so a player
 *  always sees their chips/tokens, with a warning when they can't cover the
 *  table's stake. */
function updateBalanceBars(): void {
  const parts: string[] = [];
  if (lastChips !== undefined)
    parts.push(`<span class="bal-chip">🪙 ${lastChips.toLocaleString()}</span>`);
  if (lastTokens !== undefined)
    parts.push(
      `<span class="bal-chip token">💎 ${lastTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${TOKEN_TICKER}</span>`,
    );
  let warn = "";
  const stake = state.roomStake;
  if (stake > 0) {
    const isToken = state.roomCurrency === 1;
    const have = (isToken ? lastTokens : lastChips) ?? 0;
    if (have < stake)
      warn = `<span class="bal-warn">⚠ Not enough — need ${isToken ? "💎" : "🪙"}${stake.toLocaleString()}, top up in Bank</span>`;
  }
  const html = parts.join("") + warn;
  for (const id of ["bal-room", "bal-hud"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.innerHTML = html;
    el.classList.toggle("hidden", parts.length === 0);
    el.classList.toggle("low", warn !== "");
  }
}

/** Live USD price of one token (0 = unknown). Refreshed periodically. */
let tokenUsd = 0;
/** "≈$1.23" for a token amount, or "" when the price is unknown. */
function usdOf(tokens: number): string {
  if (!tokenUsd || tokens <= 0) return "";
  const v = tokens * tokenUsd;
  const s = v >= 1 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v.toPrecision(2);
  return ` ≈$${s}`;
}

/** Show the in-game (custodial) token balance badge; tap to open the Bank. */
function setTokenBadge(balance: number | undefined): void {
  const badge = document.getElementById("token-badge") as HTMLAnchorElement | null;
  lastTokens = balance;
  updateBalanceBars();
  if (!badge) return;
  if (balance === undefined) {
    badge.classList.add("hidden");
    return;
  }
  const amt = document.getElementById("token-amount");
  const tick = document.getElementById("token-ticker");
  if (amt) amt.textContent = balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (tick) tick.textContent = `$${TOKEN_TICKER}`;
  badge.classList.remove("hidden");
}

/** Open the Bank modal: deposit address + balances + withdraw. */
async function openBank(): Promise<void> {
  const w = loadWallet();
  const modal = document.getElementById("bank-modal")!;
  const status = document.getElementById("bank-status")!;
  if (!w) {
    setMenuStatus("Connect a wallet first");
    return;
  }
  status.textContent = "";
  modal.classList.remove("hidden");
  (document.getElementById("bank-ticker") as HTMLElement).textContent = `$${TOKEN_TICKER}`;
  (document.getElementById("bank-pump") as HTMLAnchorElement).href = `https://pump.fun/coin/${TOKEN_MINT}`;
  try {
    const b = await fetchBank(w.address);
    (document.getElementById("bank-game") as HTMLElement).textContent = b.gameTokens.toLocaleString() + usdOf(b.gameTokens);
    (document.getElementById("bank-wallet") as HTMLElement).textContent = b.walletTokens.toLocaleString(undefined, { maximumFractionDigits: 2 }) + usdOf(b.walletTokens);
    (document.getElementById("bank-treasury") as HTMLElement).textContent = b.depositsEnabled ? b.treasury : "deposits not enabled yet";
    const wbtn = document.getElementById("bank-withdraw") as HTMLButtonElement;
    wbtn.disabled = !b.withdrawalsEnabled;
    if (!b.withdrawalsEnabled) status.textContent = "Withdrawals open once the treasury is live.";
  } catch {
    status.textContent = "Couldn't load bank info.";
  }
}

function wireBank(): void {
  document.getElementById("token-badge")!.addEventListener("click", (e) => {
    e.preventDefault();
    void openBank();
  });
  document.getElementById("bank-close")!.addEventListener("click", () =>
    document.getElementById("bank-modal")!.classList.add("hidden"),
  );
  document.getElementById("bank-copy")!.addEventListener("click", () => {
    const addr = document.getElementById("bank-treasury")!.textContent ?? "";
    const btn = document.getElementById("bank-copy") as HTMLButtonElement;
    if (navigator.clipboard?.writeText && addr.length > 20) {
      void navigator.clipboard.writeText(addr).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      });
    }
  });
  document.getElementById("bank-deposit")!.addEventListener("click", async () => {
    const input = document.getElementById("bank-dep-amount") as HTMLInputElement;
    const status = document.getElementById("bank-dep-status")!;
    const amount = Math.floor(Number(input.value));
    if (!amount || amount <= 0) {
      status.textContent = "Enter an amount.";
      return;
    }
    status.textContent = "Building transaction…";
    try {
      const prep = await prepareDeposit(amount);
      if (prep.error || !prep.tx) {
        status.textContent = prep.error === "deposits_disabled" ? "Deposits not enabled yet." : `Failed: ${prep.error ?? "error"}`;
        return;
      }
      status.textContent = "Approve in your wallet…";
      await signAndSendBase64(prep.tx);
      status.textContent = "Sent! Crediting your in-game balance…";
      input.value = "";
      // The deposit watcher credits within ~15s; poll the Bank to reflect it.
      let tries = 0;
      const w = loadWallet();
      const poll = async (): Promise<void> => {
        if (!w || tries++ > 10) return;
        const b = await fetchBank(w.address).catch(() => null);
        if (b && b.gameTokens > 0) {
          (document.getElementById("bank-game") as HTMLElement).textContent = b.gameTokens.toLocaleString();
          (document.getElementById("bank-wallet") as HTMLElement).textContent = b.walletTokens.toLocaleString(undefined, { maximumFractionDigits: 2 });
          setTokenBadge(b.gameTokens);
          status.textContent = `✅ In game: ${b.gameTokens.toLocaleString()} $${TOKEN_TICKER}`;
          return;
        }
        setTimeout(() => void poll(), 3000);
      };
      void poll();
    } catch (e) {
      status.textContent = `Failed: ${(e as Error).message}`;
    }
  });
  document.getElementById("bank-claim")!.addEventListener("click", async () => {
    const input = document.getElementById("bank-claim-sig") as HTMLInputElement;
    const status = document.getElementById("bank-claim-status")!;
    const sig = input.value.trim();
    if (sig.length < 32) {
      status.textContent = "Paste a transaction signature.";
      return;
    }
    status.textContent = "Checking…";
    try {
      const r = await claimDeposit(sig);
      if (r.ok && r.wallet) {
        const me = loadWallet()?.address;
        const short = `${r.wallet.slice(0, 4)}…${r.wallet.slice(-4)}`;
        if (me && r.wallet === me) {
          status.textContent = r.already
            ? `Already credited: ${r.amount} $${TOKEN_TICKER}. Reopen the Bank.`
            : `✅ Credited ${r.amount} $${TOKEN_TICKER}!`;
          void openBank();
        } else {
          status.textContent = `This deposit belongs to wallet ${short}. Connect THAT wallet to use it.`;
        }
      } else {
        if (r.reason === "matched_but_unparsed") {
          status.textContent = `Matched but couldn't read it: ${r.debug ?? ""}`;
        } else if (r.reason === "no_token_transfer_to_treasury") {
          const exp = r.expected ? `${r.expected.slice(0, 6)}…${r.expected.slice(-6)}` : "?";
          const seen = (r.seen ?? []).map((s) => `${s.slice(0, 6)}…${s.slice(-6)}`).join(", ") || "none";
          status.textContent = `No match. Treasury expects ${exp}; this tx sent to: ${seen}.`;
        } else {
          status.textContent =
            r.reason === "tx_not_found"
              ? "Transaction not found yet — wait a few seconds and retry."
              : `Couldn't claim (${r.reason ?? "error"}).`;
        }
      }
    } catch {
      status.textContent = "Network error — try again.";
    }
  });
  document.getElementById("bank-withdraw")!.addEventListener("click", async () => {
    const input = document.getElementById("bank-amount") as HTMLInputElement;
    const status = document.getElementById("bank-status")!;
    const amount = Math.floor(Number(input.value));
    if (!amount || amount <= 0) {
      status.textContent = "Enter an amount.";
      return;
    }
    status.textContent = "Sending…";
    try {
      const r = await withdrawTokens(amount);
      if (r.error) {
        status.textContent = `Failed: ${r.error}`;
      } else {
        status.textContent = `Sent! ${amount} $${TOKEN_TICKER} on the way.`;
        if (typeof r.gameTokens === "number") {
          (document.getElementById("bank-game") as HTMLElement).textContent = r.gameTokens.toLocaleString();
          setTokenBadge(r.gameTokens);
        }
        input.value = "";
      }
    } catch {
      status.textContent = "Failed: network error.";
    }
  });
}

async function openProfile(): Promise<void> {
  showScreen("profile");
  const body = document.getElementById("profile-body")!;
  const w = loadWallet();
  if (!w) {
    body.innerHTML = '<p class="status">Connect a wallet to track your stats.</p>';
    return;
  }
  body.innerHTML = '<p class="status">Loading…</p>';
  try {
    const p = await fetchProfile(w.address);
    setStats(p.chips, p.rating);
    setTokenBadge(p.gameTokens);
    const wr = p.matches ? Math.round((p.wins / p.matches) * 100) : 0;
    const tokWon = (p.tokens_won ?? 0) / 10 ** TOKEN_DECIMALS;
    body.innerHTML = "";
    const lg = leagueFor(p.rating);
    body.append(
      el("div", "prof-addr", shortAddr(w.address)),
      // League + rating is the rank/progression (no more cosmetic levels).
      el("div", "prof-level", `${lg.emoji} ${lg.name} · ${p.rating}`),
      el("div", "prof-chips", `🪙 ${p.chips.toLocaleString()} chips`),
      el("div", "prof-chips", `💎 ${(p.gameTokens ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} $${TOKEN_TICKER} in game`),
    );
    const grid = document.createElement("div");
    grid.className = "prof-grid";
    grid.append(
      profCell("Rating", p.rating),
      profCell("League", `${lg.emoji} ${lg.name}`),
      profCell("Matches", p.matches),
      profCell("Wins", p.wins),
      profCell("Win rate", `${wr}%`),
      profCell("Frags", p.frags),
      profCell(`Won 💎`, tokWon.toLocaleString(undefined, { maximumFractionDigits: 2 })),
      profCell("Won 🪙", (p.chips_won ?? 0).toLocaleString()),
    );
    body.append(grid);

    // Editable display name (applies everywhere from the next match).
    const nameRow = document.createElement("div");
    nameRow.className = "setting-row";
    nameRow.append(el("span", "", "Name"));
    const nameInput = document.createElement("input");
    nameInput.maxLength = 16;
    nameInput.value = localStorage.getItem("bp_nick") ?? "";
    nameInput.style.width = "150px";
    const save = () => {
      const v = nameInput.value.trim().slice(0, 16);
      if (!v) return;
      localStorage.setItem("bp_nick", v);
      const menuNick = document.getElementById("nickname") as HTMLInputElement | null;
      if (menuNick) menuNick.value = v;
    };
    nameInput.addEventListener("change", save);
    nameInput.addEventListener("blur", save);
    nameRow.append(nameInput);
    body.append(nameRow);
    body.append(el("div", "status fair", "Name updates in the lobby, HUD and leaderboard from your next match."));
  } catch {
    body.innerHTML = '<p class="status">Failed to load.</p>';
  }
}

let lbBoard: "rating" | "tokens" | "chips" = "rating";

async function openLeaderboard(): Promise<void> {
  showScreen("leaderboard");
  const body = document.getElementById("leaderboard-body")!;
  body.innerHTML = '<li class="status">Loading…</li>';
  document.getElementById("lb-rating")?.classList.toggle("active", lbBoard === "rating");
  document.getElementById("lb-tokens")?.classList.toggle("active", lbBoard === "tokens");
  document.getElementById("lb-chips")?.classList.toggle("active", lbBoard === "chips");
  try {
    const rows = await fetchLeaderboard(lbBoard);
    const myWallet = loadWallet()?.address ?? "";
    body.innerHTML = "";
    if (!rows.length) {
      const empty =
        lbBoard === "tokens"
          ? "No token winners yet — win a staked match!"
          : lbBoard === "chips"
            ? "No chips won yet — play a free match!"
            : "No players yet — be the first!";
      body.innerHTML = `<li class="status">${empty}</li>`;
      return;
    }
    const tokWhole = (base: number): number => base / 10 ** TOKEN_DECIMALS;
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      const isMe = r.wallet === myWallet;
      li.className = "lb-row" + (isMe ? " me" : "");
      const lg = leagueFor(r.rating);
      const medal = ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
      // Always show the league badge + name; the score column depends on the board.
      const score =
        lbBoard === "tokens"
          ? `💎 ${tokWhole(r.tokens_won ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : lbBoard === "chips"
            ? `🪙 ${(r.chips_won ?? 0).toLocaleString()}`
            : `${r.rating}`;
      li.append(
        el("span", "lb-rank", medal),
        el("span", "lb-name", `${lg.emoji} ${r.name || shortAddr(r.wallet)}${isMe ? " (you)" : ""}`),
        el("span", "lb-xp", score),
      );
      li.style.cursor = "pointer";
      li.addEventListener("click", () => void openPublicProfile(r.wallet));
      body.appendChild(li);
    });
  } catch {
    body.innerHTML = '<li class="status">Failed to load.</li>';
  }
}

/** Public player card (stats by wallet), opened from the leaderboard etc. */
async function openPublicProfile(wallet: string): Promise<void> {
  if (!wallet) return;
  const modal = document.getElementById("pubprofile-modal")!;
  const body = document.getElementById("pubprofile-body")!;
  body.innerHTML = '<p class="status">Loading…</p>';
  modal.classList.remove("hidden");
  try {
    const p = await fetchProfile(wallet);
    const lg = leagueFor(p.rating);
    const wr = p.matches ? Math.round((p.wins / p.matches) * 100) : 0;
    body.innerHTML = "";
    body.append(
      el("div", "prof-addr", p.name || shortAddr(wallet)),
      el("div", "prof-level", `${lg.emoji} ${lg.name} · ${p.rating}`),
    );
    const grid = document.createElement("div");
    grid.className = "prof-grid";
    grid.append(
      profCell("Rating", p.rating),
      profCell("Matches", p.matches),
      profCell("Wins", p.wins),
      profCell("Win rate", `${wr}%`),
      profCell("Frags", p.frags),
      profCell("Best streak", p.best_streak),
    );
    body.append(grid);
    body.append(el("div", "status fair", shortAddr(wallet)));
  } catch {
    body.innerHTML = '<p class="status">Failed to load.</p>';
  }
}

/** Card for a lobby player. Wallet players show full stats; bots/guests show a
 *  minimal local card (no stats to fetch). */
function openPlayerCard(p: { wallet?: string | null; name: string; skin: number }): void {
  if (p.wallet) {
    void openPublicProfile(p.wallet);
    return;
  }
  const modal = document.getElementById("pubprofile-modal")!;
  const body = document.getElementById("pubprofile-body")!;
  body.innerHTML = "";
  body.append(skinAvatar(p.skin), el("div", "prof-addr", p.name));
  body.append(el("div", "status fair", "No wallet connected — no ranked stats yet"));
  modal.classList.remove("hidden");
}

// --- skin shop ------------------------------------------------------------

const SKIN_NAMES = ["Doge", "Pepe", "Fox", "Wojak"];

async function refreshSkinShop(): Promise<void> {
  const grid = document.getElementById("skin-grid")!;
  const bal = document.getElementById("skin-balance")!;
  const w = loadWallet();
  let owned = DEFAULT_SKINS;
  let equipped = Number(localStorage.getItem("bp_skin")) || 0;
  if (w) {
    try {
      const p = await fetchProfile(w.address);
      owned = p.skins ?? DEFAULT_SKINS;
      equipped = p.skin ?? 0;
      localStorage.setItem("bp_skin", String(equipped));
      bal.textContent = `🪙 ${(p.chips ?? 0).toLocaleString()} chips`;
    } catch {
      bal.textContent = "";
    }
  } else {
    bal.textContent = "Connect a wallet to buy & save skins.";
  }
  grid.innerHTML = "";
  for (let i = 0; i < SKIN_COUNT; i++) {
    const card = document.createElement("div");
    card.className = "skin-card" + (i === equipped ? " equipped" : "");
    card.appendChild(skinAvatar(i, PLAYER_COLORS[i % PLAYER_COLORS.length]));
    card.appendChild(el("div", "skin-name", SKIN_NAMES[i] ?? `Skin ${i}`));
    const owns = (owned & (1 << i)) !== 0;
    const btn = document.createElement("button");
    if (i === equipped) {
      btn.textContent = "✔ Equipped";
      btn.disabled = true;
      btn.className = "ghost";
    } else if (owns) {
      btn.textContent = "Equip";
      btn.className = "primary";
      btn.addEventListener("click", () => void doSelectSkin(i));
    } else {
      btn.textContent = `Buy 🪙${SKIN_PRICES[i]}`;
      btn.className = "primary";
      btn.addEventListener("click", () => void doBuySkin(i));
    }
    card.appendChild(btn);
    grid.appendChild(card);
  }
}

async function doSelectSkin(skin: number): Promise<void> {
  const status = document.getElementById("skin-status")!;
  if (!loadWallet()) {
    localStorage.setItem("bp_skin", String(skin)); // local-only without a wallet
    void refreshSkinShop();
    return;
  }
  const r = await selectSkin(skin);
  if (r.error) {
    status.textContent = r.error === "not_owned" ? "You don't own that skin." : `Failed: ${r.error}`;
    return;
  }
  localStorage.setItem("bp_skin", String(r.skin ?? skin));
  status.textContent = "";
  void refreshSkinShop();
}

async function doBuySkin(skin: number): Promise<void> {
  const status = document.getElementById("skin-status")!;
  if (!loadWallet()) {
    status.textContent = "Connect a wallet first.";
    return;
  }
  status.textContent = "Buying…";
  const r = await buySkin(skin);
  if (r.error) {
    status.textContent = r.error === "cant_buy" ? "Not enough chips." : `Failed: ${r.error}`;
    return;
  }
  localStorage.setItem("bp_skin", String(r.skin ?? skin));
  status.textContent = "Unlocked! 🎉";
  track("skin_bought", { skin });
  void refreshSkinShop();
}

function openSkinShop(): void {
  document.getElementById("skin-status")!.textContent = "";
  document.getElementById("skin-modal")!.classList.remove("hidden");
  void refreshSkinShop();
}

// --- first-launch onboarding -----------------------------------------------

const ONBOARD_KEY = "bp_onboarded_v1";
const ONBOARD_TOUCH =
  typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
const ONBOARD: Array<{ icon: string; title: string; text: string; ru: string; pu?: string[] }> = [
  {
    icon: "🎯",
    title: "Last one standing",
    text: "Blow up your rivals and survive. 2–4 players, 3-minute match.",
    ru: "Взорви соперников и останься последним. 2–4 игрока, 3 минуты.",
  },
  {
    icon: "🎮",
    title: "Controls",
    text: ONBOARD_TOUCH
      ? "Joystick / d-pad to move, the bomb button to drop bombs."
      : "Arrows or WASD to move, Space to drop a bomb.",
    ru: ONBOARD_TOUCH
      ? "Джойстик/крестовина — движение, кнопка — бомба."
      : "Стрелки/WASD — движение, Пробел — бомба.",
  },
  {
    icon: "💣",
    title: "Bombs & HP",
    text: "Break crates, catch rivals in the blast. You have 3 ❤️ — a hit costs one.",
    ru: "Ломай ящики, лови соперников взрывом. 3 ❤️, попадание −1.",
  },
  {
    icon: "⚡",
    title: "Power-ups",
    pu: ["💣 +bomb", "🔥 +range", "👟 speed", "🦵 kick", "👻 ghost", "❤️ +life"],
    text: "Grab them from destroyed crates.",
    ru: "Выпадают из разрушенных ящиков.",
  },
  {
    icon: "🩸",
    title: "Ready?",
    text: "Hit PLAY NOW for an instant match. First to hit a rival = First Blood!",
    ru: "Жми PLAY NOW — быстрый матч. Первый, кто заденет — First Blood!",
  },
];
let onboardIdx = 0;

function renderOnboard(): void {
  const c = ONBOARD[onboardIdx];
  const pu = c.pu ? `<div class="onboard-pu">${c.pu.map((p) => `<span>${p}</span>`).join("")}</div>` : "";
  document.getElementById("onboard-body")!.innerHTML =
    `<div class="onboard-icon">${c.icon}</div><div class="onboard-title">${c.title}</div>${pu}` +
    `<div class="onboard-text">${c.text}</div><div class="onboard-text ru">${c.ru}</div>`;
  document.getElementById("onboard-dots")!.innerHTML = ONBOARD.map(
    (_, i) => `<i class="${i === onboardIdx ? "on" : ""}"></i>`,
  ).join("");
  document.getElementById("onboard-next")!.textContent =
    onboardIdx >= ONBOARD.length - 1 ? "Let's go ⚡" : "Next →";
}

function showOnboarding(): void {
  onboardIdx = 0;
  renderOnboard();
  document.getElementById("onboard")!.classList.remove("hidden");
}

function closeOnboarding(): void {
  document.getElementById("onboard")!.classList.add("hidden");
  try {
    localStorage.setItem(ONBOARD_KEY, "1");
  } catch {
    // ignore (private mode)
  }
}

function setupOnboarding(): void {
  document.getElementById("onboard-next")!.addEventListener("click", () => {
    if (onboardIdx >= ONBOARD.length - 1) closeOnboarding();
    else {
      onboardIdx++;
      renderOnboard();
    }
  });
  document.getElementById("onboard-skip")!.addEventListener("click", closeOnboarding);
  document.getElementById("open-help")!.addEventListener("click", showOnboarding);
  let seen = false;
  try {
    seen = !!localStorage.getItem(ONBOARD_KEY);
  } catch {
    // ignore
  }
  if (!seen) showOnboarding();
}

function wireMenuLinks(): void {
  setupOnboarding();
  document.getElementById("open-profile")!.addEventListener("click", () => void openProfile());
  document.getElementById("open-leaderboard")!.addEventListener("click", () => { lbBoard = "rating"; void openLeaderboard(); });
  document.getElementById("open-skins")?.addEventListener("click", openSkinShop); // skins shop disabled for now
  document.getElementById("skin-close")!.addEventListener("click", () =>
    document.getElementById("skin-modal")!.classList.add("hidden"),
  );
  document.getElementById("profile-back")!.addEventListener("click", () => showScreen("menu"));
  document.getElementById("leaderboard-back")!.addEventListener("click", () => showScreen("menu"));
  document.getElementById("lb-rating")!.addEventListener("click", () => { lbBoard = "rating"; void openLeaderboard(); });
  document.getElementById("lb-tokens")!.addEventListener("click", () => { lbBoard = "tokens"; void openLeaderboard(); });
  document.getElementById("lb-chips")!.addEventListener("click", () => { lbBoard = "chips"; void openLeaderboard(); });
}

// --- background video -----------------------------------------------------

function setupBackground(): void {
  const v = document.getElementById("bg-video") as HTMLVideoElement;
  // First-frame poster shows instantly while the video downloads (no empty gap).
  v.poster = `/bg/menu-poster.webp?v=${ASSET_VER}`;
  // ?v= busts the cache when the file is replaced under the same name. The
  // boomerang mp4 loops seamlessly via the element's `loop` attr; webm dropped
  // (mp4 is universal and tried first).
  const sources = [`/bg/menu.mp4?v=${ASSET_VER}`];
  let i = 0;
  const tryNext = () => {
    if (i >= sources.length) return; // no bg; gradient stays
    v.src = sources[i++];
  };
  v.addEventListener("canplay", () => v.classList.add("ready"));
  v.addEventListener("error", tryNext);
  tryNext();
}

// --- bootstrap ------------------------------------------------------------

// Multi-region: probe and hop to the nearest server (no-op with <2 regions).
// Skipped inside Telegram — the Mini App is bound to one URL; redirecting away
// would break it.
if (!isTelegram) void selectRegion();
initTelegram();
// Register the service worker (PWA). On a new deploy a fresh SW installs and
// waits; we surface an in-app "Update" banner instead of auto-reloading (a
// forced reload was interrupting taps on mobile). Tapping Update activates the
// new SW and reloads with the fresh build + assets — the clean way to clear the
// stale cache on phones where you can't hard-refresh.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showUpdateBanner();
  },
});

function showUpdateBanner(): void {
  if (document.getElementById("update-banner")) return;
  const b = document.createElement("div");
  b.id = "update-banner";
  b.style.cssText =
    "position:fixed;left:0;right:0;top:0;z-index:10000;background:#ffcc33;color:#1a1300;" +
    "padding:10px 14px;font:700 14px system-ui;text-align:center;display:flex;gap:12px;" +
    "align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.4)";
  const span = document.createElement("span");
  span.textContent = "🔄 New version available";
  const btn = document.createElement("button");
  btn.textContent = "Update";
  btn.style.cssText =
    "background:#1a1300;color:#ffcc33;border:0;border-radius:8px;padding:6px 14px;font-weight:800;cursor:pointer";
  btn.onclick = () => {
    btn.textContent = "Updating…";
    void updateSW(true); // skipWaiting + reload with the fresh build
  };
  b.append(span, btn);
  document.body.appendChild(b);
}

// Surface otherwise-invisible failures (esp. on mobile, where there's no
// console) as a dismissable banner, so "nothing happens" becomes a real message.
function showBanner(msg: string): void {
  let b = document.getElementById("err-banner");
  if (!b) {
    b = document.createElement("div");
    b.id = "err-banner";
    b.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:9999;background:#c0392b;color:#fff;" +
      "padding:10px 14px;font:600 13px system-ui;text-align:center;cursor:pointer";
    b.addEventListener("click", () => b!.remove());
    document.body.appendChild(b);
  }
  b.textContent = "⚠ " + msg + "  (tap to dismiss)";
}

/** Staked tables need a wallet. If the player has none, explain it and open the
 *  connect flow instead of letting them hit a silent server rejection. Returns
 *  false when the action should be blocked. */
function walletGate(stake: number, currency = 0): boolean {
  if (stake > 0 && !loadWallet()) {
    const msg = `Connect a wallet to play for ${currency === 1 ? "tokens 💎" : "chips 🪙"}`;
    setMenuStatus(msg);
    showBanner(msg);
    document.getElementById("wallet-btn")?.click(); // open the connect flow
    return false;
  }
  return true;
}
// --- referral capture + attribution ----------------------------------------
// Grab an inviter from ?ref=<wallet> (web) or a Telegram startapp "ref_<wallet>"
// and remember it until a wallet connects, then bind it once on the server.
(function captureRef() {
  const fromUrl = new URLSearchParams(location.search).get("ref") ?? "";
  const sp = getStartParam() ?? "";
  const fromTg = sp.startsWith("ref_") ? sp.slice(4) : "";
  const ref = (fromUrl || fromTg).trim();
  if (ref && !localStorage.getItem("bp_ref_done")) localStorage.setItem("bp_ref", ref);
})();

/** Bind the inviter once a wallet+session exist. Runs even without a stored ref
 *  so the server attaches un-invited players under the root (owner). Retries on
 *  every wallet refresh / 20s poll until it succeeds, then persists done — so a
 *  late session, a connect after load, or a root configured later all still
 *  attach automatically. */
function attributeReferralOnce(): void {
  if (localStorage.getItem("bp_ref_done") || !loadWallet()?.session) return;
  const ref = localStorage.getItem("bp_ref") ?? "";
  void attributeReferral(ref).then((ok) => {
    if (ok) localStorage.setItem("bp_ref_done", "1");
  });
}

/** Partner program modal: your link, referrals, lifetime earnings, share. */
async function openReferral(): Promise<void> {
  const w = loadWallet();
  const modal = document.getElementById("referral-modal")!;
  if (!w) {
    setMenuStatus("Connect a wallet to get your invite link");
    return;
  }
  const link = `${location.origin}/?ref=${w.address}`;
  (document.getElementById("ref-link") as HTMLElement).textContent = link;
  (document.getElementById("ref-ticker") as HTMLElement).textContent = `$${TOKEN_TICKER}`;
  modal.classList.remove("hidden");
  const s = await fetchReferralStats(w.address);
  const net = (s.network ?? []).reduce((a, b) => a + b, 0);
  (document.getElementById("ref-stats") as HTMLElement).innerHTML =
    `<div class="stat-badge"><span>Direct</span><b>${s.direct.toLocaleString()}</b></div>` +
    `<div class="stat-badge"><span>Network</span><b>${net.toLocaleString()}</b></div>` +
    `<div class="stat-badge token"><span>Earned</span><b>${s.earned.toLocaleString()} ${TOKEN_TICKER}</b></div>`;
  // Per-level tree: count of your downline at each level + its payout %.
  const levels = s.levels ?? [];
  const network = s.network ?? [];
  (document.getElementById("ref-levels") as HTMLElement).innerHTML =
    "<b>Your referral tree</b>" +
    levels
      .map((pct, i) => `<div class="ref-lvl"><span>Level ${i + 1} · ${pct}% of rake</span><b>${(network[i] ?? 0).toLocaleString()}</b></div>`)
      .join("");
  calcRakePct = s.rakePct ?? 0;
  calcL1Pct = levels[0] ?? 10;
  updateCalc();
}

// Earnings calculator: estimate your cut from direct (L1) referrals.
let calcRakePct = 0;
let calcL1Pct = 10;
function updateCalc(): void {
  const out = document.getElementById("calc-out");
  if (!out) return;
  const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement)?.value) || 0;
  const refs = num("calc-refs");
  const matches = num("calc-matches");
  const stake = num("calc-stake");
  if (calcRakePct <= 0) {
    out.innerHTML = '<span class="bal-warn">⚠ Rake is 0 — set HOUSE_RAKE_BP to enable earnings</span>';
    return;
  }
  const perDay = refs * matches * stake * (calcRakePct / 100) * (calcL1Pct / 100);
  out.innerHTML =
    `≈ <b>${Math.round(perDay).toLocaleString()} ${TOKEN_TICKER}/day</b> · ${Math.round(perDay * 30).toLocaleString()}/month<br>` +
    `<span class="muted">from direct (L1) referrals · ${calcL1Pct}% of the ${calcRakePct}% rake · deeper levels add more</span>`;
}

function referralLink(): string {
  const w = loadWallet();
  return w ? `${location.origin}/?ref=${w.address}` : location.origin;
}
function shareText(): string {
  return `💣 Play BomberMeme.fun — blow up your friends & win $${TOKEN_TICKER}! Join me:`;
}

initAnalytics({ platform: isTelegram ? "telegram" : "web" });
startPresence();
initErrorTracking();
track("app_loaded", { platform: isTelegram ? "telegram" : "web" });
input.attach();
void assets.preload();
applySettings();
wireSettings();
wireNickname();
wireWallet();
wireMenuLinks();
wireBank();
setProfileHandler((p) => openPlayerCard(p));
// Finish a Phantom deeplink flow if we just returned from one (Telegram only).
if (isTelegram) {
  void resumeTelegramWallet({
    onConnected: (address) => {
      identifyWallet(address);
      refreshWalletBtn();
      track("wallet_connected", { provider: "telegram-phantom" });
      setMenuStatus("Wallet connected ✅");
    },
    onDeposit: () => {
      refreshWalletBtn();
      setMenuStatus("Deposit sent — crediting your balance shortly…");
    },
    onError: (m) => setMenuStatus(`Wallet: ${m}`),
  });
}
document.getElementById("pubprofile-close")!.addEventListener("click", () =>
  document.getElementById("pubprofile-modal")!.classList.add("hidden"),
);
// Referral / partner program wiring.
document.getElementById("open-referral")?.addEventListener("click", () => void openReferral());
document.getElementById("referral-close")?.addEventListener("click", () =>
  document.getElementById("referral-modal")!.classList.add("hidden"),
);
document.getElementById("ref-copy")?.addEventListener("click", () => {
  void navigator.clipboard?.writeText(referralLink());
  setMenuStatus("Invite link copied ✅");
});
document.getElementById("ref-share")?.addEventListener("click", () => {
  const url = referralLink();
  if (navigator.share) void navigator.share({ title: "BomberMeme.fun", text: shareText(), url });
  else {
    void navigator.clipboard?.writeText(`${shareText()} ${url}`);
    setMenuStatus("Invite copied ✅");
  }
});
document.getElementById("ref-share-x")?.addEventListener("click", () => {
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(referralLink())}`;
  window.open(intent, "_blank");
});
for (const id of ["calc-refs", "calc-matches", "calc-stake"]) {
  document.getElementById(id)?.addEventListener("input", updateCalc);
}
setupBackground();

// Live token→USD price for the in-game $ converter (refresh every 60s).
function refreshPrice(): void {
  void fetchPrice().then((usd) => {
    tokenUsd = usd;
    setTokenUsd(usd);
  });
}
refreshPrice();
setInterval(refreshPrice, 60_000);
// Keep chips + token balance fresh on the menu (e.g. after a deposit credits a
// few seconds later, or token winnings settle) — not just on connect.
setInterval(() => {
  if (loadWallet() && !inGame(state.phase)) refreshWalletBtn();
}, 20_000);

setupMenu({
  create: (c) => {
    if (!walletGate(c.stake, c.currency)) return;
    closeModals();
    practiceMode = false;
    track("play_start", { mode: "create", stake: c.stake, currency: c.currency });
    connect(() => createRoom(c.name, c.skin, c.stake, c.currency));
  },
  practice: (c, difficulty, bots) => {
    closeModals();
    practiceMode = true;
    track("play_start", { mode: "practice", difficulty, bots });
    connect(() => practiceRoom(c.name, c.skin, difficulty, bots));
  },
});

// --- Main-menu entry points -------------------------------------------------
const createModal = document.getElementById("create-modal")!;
const practiceModal = document.getElementById("practice-modal")!;
function closeModals(): void {
  createModal.classList.add("hidden");
  practiceModal.classList.add("hidden");
}
/** Open the full-screen lobby browser and load the room list. */
function openLobby(): void {
  showScreen("lobby");
  void loadTables();
}
// PLAY ONLINE lands straight on the full-screen lobby browser.
document.getElementById("open-play")!.addEventListener("click", openLobby);
// Practice vs bots opens its own setup modal (difficulty + bot count).
document.getElementById("open-practice")!.addEventListener("click", () => {
  practiceModal.classList.remove("hidden");
});
document.getElementById("lobby-back")!.addEventListener("click", () => showScreen("menu"));

// Create Lobby → the create-only settings modal (chips or token).
document.getElementById("tables-new")!.addEventListener("click", () => {
  createModal.classList.remove("hidden");
});

// --- Bento cards: Casual (chip stakes) + The Arena (real-token stakes) -------
const lobbyName = (): string =>
  (document.getElementById("nickname") as HTMLInputElement | null)?.value.trim() || "pumper";
const randSkin = (): number => Math.floor(Math.random() * SKIN_COUNT);

// Casual: "Quick Match" reveals chip-stake chips; pick one to matchmake (chips).
const casualStakes = document.getElementById("casual-stakes")!;
for (const s of [{ v: 0, label: "🆓 Free" }, ...BET_SIZES.map((v) => ({ v, label: `🪙${v}` }))]) {
  const b = document.createElement("button");
  b.className = "bento-chip";
  b.textContent = s.label;
  b.addEventListener("click", () => {
    if (!walletGate(s.v)) return;
    practiceMode = false;
    track("play_start", { mode: "quickplay", stake: s.v });
    void connect(() => quickplay(lobbyName(), randSkin(), s.v));
  });
  casualStakes.appendChild(b);
}
document.getElementById("casual-quick")!.addEventListener("click", () => {
  casualStakes.classList.toggle("hidden");
});

// The Arena: real-token stakes only — pick a tier to host a token table.
const arenaStakes = document.getElementById("arena-stakes")!;
for (const v of TOKEN_BET_SIZES) {
  const b = document.createElement("button");
  b.className = "bento-chip";
  b.textContent = `💎${v.toLocaleString()}`;
  b.addEventListener("click", () => {
    if (!walletGate(v, 1)) return;
    practiceMode = false;
    track("play_start", { mode: "create", stake: v, currency: 1 });
    void connect(() => createRoom(lobbyName(), randSkin(), v, 1));
  });
  arenaStakes.appendChild(b);
}
// Join by code from the lobby header.
document.getElementById("lobby-code-join")!.addEventListener("click", () => {
  const inp = document.getElementById("lobby-code-input") as HTMLInputElement | null;
  const code = (inp?.value || "").trim().toUpperCase();
  if (code.length < 3) return;
  const name = (document.getElementById("nickname") as HTMLInputElement | null)?.value.trim() || "pumper";
  track("play_start", { mode: "join" });
  void connect(() => joinRoom(name, code, Math.floor(Math.random() * 4)));
});

// Modal dismissal: Cancel buttons + tap-the-backdrop.
document.getElementById("create-cancel")!.addEventListener("click", closeModals);
document.getElementById("practice-cancel")!.addEventListener("click", closeModals);
for (const m of [createModal, practiceModal]) {
  m.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModals();
  });
}

/** Fetch + render the public rooms into the lobby browser. */
function loadTables(): Promise<void> {
  return fetchTables().then((tables) =>
    renderTables(
      tables,
      (code) => {
        const t = tables.find((x) => x.code === code);
        if (t && !walletGate(t.stake, t.currency)) return; // staked → needs wallet
        const name = (localStorage.getItem("bp_nick") || "pumper").trim();
        track("play_start", { mode: "table_join" });
        void connect(() => joinRoom(name, code, Math.floor(Math.random() * 4)));
      },
      (code) => {
        track("spectate", { code });
        void connect(() => watchMatch(code));
      },
    ),
  );
}

document.getElementById("tables-refresh")!.addEventListener("click", () => {
  void loadTables();
});

document.getElementById("start-now")!.addEventListener("click", () => net.sendStart());

// Ready-up toggle (reads the authoritative state from the latest room info).
document.getElementById("ready-btn")!.addEventListener("click", () => {
  const me = state.roomPlayers.find((p) => p.id === state.myId);
  net.sendReady(!(me?.ready ?? false));
});

// --- stake-raise vote (anyone proposes; everyone votes within 30s) ----------
const stakeSym = (): string => (state.roomCurrency === 1 ? "💎" : "🪙");
let stakeVoteTimer: ReturnType<typeof setInterval> | null = null;

function onStakeVote(msg: {
  stake: number; by: number; msLeft: number; yes: number; total: number; closed: boolean; accepted: boolean;
}): void {
  const banner = document.getElementById("stake-vote")!;
  if (stakeVoteTimer) { clearInterval(stakeVoteTimer); stakeVoteTimer = null; }
  if (msg.closed) {
    banner.classList.add("hidden");
    document.getElementById("propose-picker")!.classList.add("hidden");
    showBanner(msg.accepted ? `Stake raised to ${stakeSym()}${msg.stake.toLocaleString()}` : "Stake raise declined");
    return;
  }
  const deadline = Date.now() + msg.msLeft;
  const mine = msg.by === state.myId;
  const who = mine ? "You propose" : `${state.nameOf(msg.by)} proposes`;
  const render = (): void => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    banner.innerHTML =
      `<div class="sv-text">${who} raising to <b>${stakeSym()}${msg.stake.toLocaleString()}</b> · ${left}s · ${msg.yes}/${msg.total} ✅</div>` +
      (mine ? "" : `<div class="sv-actions"><button id="sv-yes" class="primary">✅ Accept</button><button id="sv-no" class="ghost">❌ Decline</button></div>`);
    document.getElementById("sv-yes")?.addEventListener("click", () => { net.sendVoteStake(true); banner.classList.add("hidden"); });
    document.getElementById("sv-no")?.addEventListener("click", () => { net.sendVoteStake(false); banner.classList.add("hidden"); });
  };
  banner.classList.remove("hidden");
  render();
  stakeVoteTimer = setInterval(() => {
    if (Date.now() >= deadline) { clearInterval(stakeVoteTimer!); stakeVoteTimer = null; banner.classList.add("hidden"); return; }
    render();
  }, 1000);
}

// Propose a higher stake: reveal the tiers above the current one.
document.getElementById("propose-stake")?.addEventListener("click", () => {
  if (practiceMode) return;
  const picker = document.getElementById("propose-picker")!;
  if (!picker.classList.contains("hidden")) { picker.classList.add("hidden"); return; }
  const tiers = (state.roomCurrency === 1 ? TOKEN_BET_SIZES : BET_SIZES).filter((v) => v > state.roomStake);
  if (!tiers.length) { showBanner("Already at the top stake"); return; }
  picker.innerHTML = "";
  for (const v of tiers) {
    const b = document.createElement("button");
    b.className = "stake-btn";
    b.textContent = `${stakeSym()}${v.toLocaleString()}`;
    b.addEventListener("click", () => { net.sendProposeStake(v); picker.classList.add("hidden"); });
    picker.appendChild(b);
  }
  picker.classList.remove("hidden");
});

// Build both emote bars (lobby + in-game) from the shared EMOTES list.
let emoteReadyAt = 0; // client-side cooldown (matches the server's 1.5s anti-spam)
function buildEmoteBar(id: string): void {
  const bar = document.getElementById(id);
  if (!bar) return;
  bar.innerHTML = "";
  EMOTES.forEach((e, i) => {
    const b = document.createElement("button");
    b.className = "emote-btn";
    b.textContent = e;
    b.addEventListener("click", () => {
      if (performance.now() < emoteReadyAt) return; // on cooldown
      emoteReadyAt = performance.now() + 1500;
      net.sendEmote(i);
      // Brief disabled state on all emote buttons for feedback.
      document.querySelectorAll<HTMLButtonElement>(".emote-btn").forEach((btn) => {
        btn.classList.add("cooling");
      });
      setTimeout(
        () => document.querySelectorAll(".emote-btn").forEach((btn) => btn.classList.remove("cooling")),
        1500,
      );
    });
    bar.appendChild(b);
  });
}
buildEmoteBar("room-emotes");
buildEmoteBar("game-emotes");

/** Show a reaction: a bubble over the player in-game, plus a lobby pop. */
function showEmote(playerId: number, emote: number): void {
  const e = EMOTES[emote] ?? "❓";
  renderer?.showEmote(playerId, e);
  if (!inGame(state.phase)) {
    const pop = document.createElement("div");
    pop.className = "emote-pop";
    pop.textContent = `${state.nameOf(playerId)} ${e}`;
    document.getElementById("room")?.appendChild(pop);
    setTimeout(() => pop.remove(), 1800);
  }
}

/** True while the post-match result screen is showing (so we don't auto-leave it). */
function onResultScreen(): boolean {
  return document.getElementById("result")?.classList.contains("hidden") === false;
}

function leaveToMenu(): void {
  spectating = false;
  net.close();
  assets.stop("sudden_death");
  state.reset();
  input.reset();
  predictor.reset();
  prevPlayerCount = 0;
  showScreen("menu");
  music("lobby");
  setMenuStatus("");
}
document.getElementById("leave-room")!.addEventListener("click", leaveToMenu);
document.getElementById("result-leave")!.addEventListener("click", leaveToMenu);
// In-game leave: forfeits the round. Confirm only when chips are on the line.
document.getElementById("game-leave")!.addEventListener("click", () => {
  if (state.roomStake > 0 && !confirm("Leave the match? You forfeit your stake.")) return;
  leaveToMenu();
});
// Primary result button. In practice it's "Play again" → start the next match
// immediately (the server no longer auto-restarts). Otherwise "Back to lobby":
// stay connected and show the waiting room so the same players regroup.
document.getElementById("result-lobby")!.addEventListener("click", () => {
  if (practiceMode) {
    net.sendStart(); // server refills bots and starts; phase msg shows the game
    return;
  }
  showScreen("room");
  renderRoom(state);
  music("lobby");
});

// --- viral: invite links + result sharing ---------------------------------

function inviteUrl(code: string): string {
  return `${location.origin}${location.pathname}?room=${code}`;
}

document.getElementById("copy-invite")?.addEventListener("click", () => {
  const btn = document.getElementById("copy-invite") as HTMLButtonElement;
  const url = inviteUrl(state.roomCode);
  const done = () => {
    const old = btn.textContent;
    btn.textContent = "✅ Copied!";
    setTimeout(() => (btn.textContent = old), 1500);
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(done);
  else done();
});

// Invite from the result screen: share the room link, or copy it as a fallback.
document.getElementById("result-invite")?.addEventListener("click", () => {
  const btn = document.getElementById("result-invite") as HTMLButtonElement;
  const url = state.roomCode ? inviteUrl(state.roomCode) : `${location.origin}${location.pathname}`;
  if (navigator.share) {
    void navigator.share({ title: "BomberMeme.fun", text: "Come play BomberMeme.fun with me 💣", url }).catch(() => {});
  } else if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(url).then(() => {
      btn.textContent = "✅ Link copied!";
      setTimeout(() => (btn.textContent = "👥 Invite friends"), 1500);
    });
  }
});

// --- share card (result + profile) ----------------------------------------
let scVariant = 0;
let scKind: "result" | "profile" = "result";
let scBlob: Blob | null = null;

function walletShort(): string | null {
  const w = loadWallet();
  return w ? `${w.address.slice(0, 4)}…${w.address.slice(-4)}` : null;
}

function buildCardData(kind: "result" | "profile"): CardData {
  const nick = (localStorage.getItem("bp_nick") || "pumper").trim();
  const lg = leagueFor(lastRating);
  const data: CardData = {
    kind, nickname: nick, skin: state.skinOf(state.myId), rating: lastRating,
    league: { emoji: lg.emoji, name: lg.name }, chips: lastChips ?? 0,
    refUrl: referralLink(), refCode: walletShort(),
  };
  if (kind === "result" && lastMatch) {
    data.placeText = lastMatch.draw ? "🤝 Draw" : lastMatch.won ? "🏆 1st place" : "💀 Knocked out";
    data.won = lastMatch.won;
    data.frags = lastMatch.frags;
    data.earnText = lastMatch.earnText;
    data.ratingDelta = lastMatch.ratingDelta;
    data.firstBlood = lastMatch.firstBlood;
  }
  return data;
}

async function renderCurrentCard(): Promise<void> {
  const img = document.getElementById("sharecard-img") as HTMLImageElement;
  const cv = await renderShareCard(buildCardData(scKind), scVariant);
  img.src = cv.toDataURL("image/png");
  await new Promise<void>((res) => cv.toBlob((b) => { scBlob = b; res(); }, "image/png"));
}

async function openShareCard(kind: "result" | "profile"): Promise<void> {
  scKind = kind;
  document.getElementById("sharecard-modal")!.classList.remove("hidden");
  await renderCurrentCard();
}

document.getElementById("sharecard-close")?.addEventListener("click", () =>
  document.getElementById("sharecard-modal")!.classList.add("hidden"));
document.getElementById("sc-variant")?.addEventListener("click", () => {
  scVariant = (scVariant + 1) % VARIANT_COUNT;
  void renderCurrentCard();
});
document.getElementById("sc-download")?.addEventListener("click", () => {
  if (!scBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(scBlob);
  a.download = "bombermeme.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
document.getElementById("sc-share")?.addEventListener("click", () => {
  const url = referralLink();
  const file = scBlob ? new File([scBlob], "bombermeme.png", { type: "image/png" }) : null;
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (file && nav.canShare?.({ files: [file] })) {
    void navigator.share({ files: [file], title: "BomberMeme.fun", text: shareText(), url }).catch(() => {});
  } else if (navigator.share) {
    void navigator.share({ title: "BomberMeme.fun", text: shareText(), url }).catch(() => {});
  } else {
    void navigator.clipboard?.writeText(url);
  }
  track("share_card", { kind: scKind, variant: scVariant });
});
document.getElementById("sc-x")?.addEventListener("click", () => {
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(referralLink())}`;
  window.open(intent, "_blank", "noopener");
});
document.getElementById("sc-tg")?.addEventListener("click", () => {
  const u = `https://t.me/share/url?url=${encodeURIComponent(referralLink())}&text=${encodeURIComponent(shareText())}`;
  window.open(u, "_blank", "noopener");
});
document.getElementById("sc-copy")?.addEventListener("click", () => {
  void navigator.clipboard?.writeText(referralLink());
  setMenuStatus("Link copied");
});

document.getElementById("result-share")?.addEventListener("click", () => void openShareCard("result"));
document.getElementById("profile-share")?.addEventListener("click", () => void openShareCard("profile"));

// Deep link: ?room=CODE auto-joins with the saved nick/skin.
(function autoJoinFromUrl(): void {
  const code = new URLSearchParams(location.search).get("room");
  if (!code) return;
  history.replaceState(null, "", location.pathname); // clean the URL
  const name = (localStorage.getItem("bp_nick") || `pumper${(Math.random() * 1000) | 0}`).trim();
  const skin = Number(localStorage.getItem("bp_skin") ?? 0);
  setMenuStatus(`Joining room ${code.toUpperCase()}…`);
  void connect(() => joinRoom(name, code.toUpperCase(), skin));
})();

// UI click sound + kick music off the first user gesture (autoplay policy).
document.addEventListener("pointerdown", (e) => {
  const el = e.target as HTMLElement;
  if (el.closest("button") && !el.closest("#touch-controls")) assets.play("ui");
});
document.addEventListener("pointerdown", () => assets.playMusic(currentTrack), { once: true });

showScreen("menu");
music("lobby");
requestAnimationFrame(frame);
