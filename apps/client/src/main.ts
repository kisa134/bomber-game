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
  CalloutType,
  SKIN_COUNT,
  SKIN_PRICES,
  DEFAULT_SKINS,
} from "./net/protocol.js";
import {
  Net,
  quickplay,
  createRoom,
  joinRoom,
  practiceRoom,
  fetchProfile,
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
  type JoinResponse,
} from "./net/socket.js";
import { GameState } from "./game/state.js";
import { Renderer, PLAYER_COLORS, skinAvatar } from "./game/renderer.js";
import { Input } from "./game/input.js";
import { Assets } from "./game/assets.js";
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
import { initAnalytics, track, identifyWallet, initErrorTracking } from "./analytics.js";
import { Predictor } from "./game/prediction.js";
import { initTelegram, isTelegram } from "./platform/telegram.js";
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
  const exts = [".png", ".webp"];
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
      } else if (msg.phase === MatchPhase.PLAYING) {
        assets.play("go");
        goUntil = performance.now() + 800;
        track("match_started", { players: state.roomPlayers.length });
      } else if (msg.phase === MatchPhase.SUDDEN_DEATH) {
        assets.play("sudden_death");
      } else if (msg.phase === MatchPhase.LOBBY) {
        prevSoftCount = -1;
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
      assets.play("death");
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
      }
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
  assets.stop("sudden_death");
  prevSoftCount = -1;
  killLines.length = 0;
  killfeedEl.innerHTML = "";
  hudSig = "";
  bottomSig = "";
  bottomEl.innerHTML = "";
  sdWarned = false;
  prevMyLives = -1;
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
  const w = loadWallet();
  const prevRating = lastRating;
  if (w) {
    void fetchProfile(w.address)
      .then((p) => {
        setStats(p.chips, p.rating);
        setTokenBadge(p.gameTokens);
        const d = p.rating - prevRating;
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
  }, 1000);
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

  if (renderer && inGame(state.phase)) {
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
    void fetchProfile(w.address)
      .then((p) => {
        setStats(p.chips, p.rating);
        setTokenBadge(p.gameTokens);
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
    const into = p.xp % 200;
    const wr = p.matches ? Math.round((p.wins / p.matches) * 100) : 0;
    body.innerHTML = "";
    const lg = leagueFor(p.rating);
    body.append(
      el("div", "prof-addr", shortAddr(w.address)),
      el("div", "prof-level", `${lg.emoji} ${lg.name} · ${p.rating}`),
      el("div", "prof-chips", `🪙 ${p.chips.toLocaleString()} chips`),
      el("div", "prof-chips", `💎 ${(p.gameTokens ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} $${TOKEN_TICKER} in game`),
    );
    const bar = document.createElement("div");
    bar.className = "xp-bar";
    const fill = document.createElement("div");
    fill.className = "xp-fill";
    fill.style.width = `${(into / 200) * 100}%`;
    bar.appendChild(fill);
    body.append(bar, el("div", "status", `${into} / 200 XP`));
    const grid = document.createElement("div");
    grid.className = "prof-grid";
    grid.append(
      profCell("Rating", p.rating),
      profCell("Level", p.level),
      profCell("Matches", p.matches),
      profCell("Wins", p.wins),
      profCell("Win rate", `${wr}%`),
      profCell("Frags", p.frags),
      profCell("Deaths", p.deaths),
      profCell("Best streak", p.best_streak),
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

let lbPeriod: "all" | "week" = "all";

async function openLeaderboard(): Promise<void> {
  showScreen("leaderboard");
  const body = document.getElementById("leaderboard-body")!;
  body.innerHTML = '<li class="status">Loading…</li>';
  document.getElementById("lb-alltime")?.classList.toggle("active", lbPeriod === "all");
  document.getElementById("lb-week")?.classList.toggle("active", lbPeriod === "week");
  try {
    const rows = await fetchLeaderboard(lbPeriod);
    const myWallet = loadWallet()?.address ?? "";
    body.innerHTML = "";
    if (!rows.length) {
      body.innerHTML =
        lbPeriod === "week"
          ? '<li class="status">No games this week yet — play to climb!</li>'
          : '<li class="status">No players yet — be the first!</li>';
      return;
    }
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      const isMe = r.wallet === myWallet;
      li.className = "lb-row" + (isMe ? " me" : "");
      const lg = leagueFor(r.rating);
      const medal = ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
      const score = lbPeriod === "week" ? `${r.week_points} pts` : `${r.rating}`;
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

function wireMenuLinks(): void {
  document.getElementById("open-profile")!.addEventListener("click", () => void openProfile());
  document.getElementById("open-leaderboard")!.addEventListener("click", () => { lbPeriod = "all"; void openLeaderboard(); });
  document.getElementById("open-skins")!.addEventListener("click", openSkinShop);
  document.getElementById("skin-close")!.addEventListener("click", () =>
    document.getElementById("skin-modal")!.classList.add("hidden"),
  );
  document.getElementById("profile-back")!.addEventListener("click", () => showScreen("menu"));
  document.getElementById("leaderboard-back")!.addEventListener("click", () => showScreen("menu"));
  document.getElementById("lb-alltime")!.addEventListener("click", () => { lbPeriod = "all"; void openLeaderboard(); });
  document.getElementById("lb-week")!.addEventListener("click", () => { lbPeriod = "week"; void openLeaderboard(); });
}

// --- background video -----------------------------------------------------

function setupBackground(): void {
  const v = document.getElementById("bg-video") as HTMLVideoElement;
  const sources = ["/bg/menu.mp4", "/bg/menu.webm"];
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

initTelegram();
// Register the service worker (PWA). Auto-applies updates on next navigation.
// Register the service worker. autoUpdate applies a new build on the next
// natural navigation — we deliberately do NOT force a reload here: a forced
// reload on `controllerchange` was reloading the page mid-tap on mobile and
// making it impossible to join a room.
registerSW({ immediate: true });

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
initAnalytics({ platform: isTelegram ? "telegram" : "web" });
startPresence();
initErrorTracking();
track("app_loaded", { platform: isTelegram ? "telegram" : "web" });
input.attach();
void assets.preload();
applySettings();
wireSettings();
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
  quickplay: (c) => { if (!walletGate(c.stake)) return; practiceMode = false; track("play_start", { mode: "quickplay", stake: c.stake }); connect(() => quickplay(c.name, c.skin, c.stake)); },
  practice: (c, difficulty) => { practiceMode = true; track("play_start", { mode: "practice", difficulty }); connect(() => practiceRoom(c.name, c.skin, difficulty)); },
  create: (c) => { if (!walletGate(c.stake, c.currency)) return; practiceMode = false; track("play_start", { mode: "create", stake: c.stake, currency: c.currency }); connect(() => createRoom(c.name, c.skin, c.stake, c.currency)); },
  join: (c, code) => { practiceMode = false; track("play_start", { mode: "join" }); connect(() => joinRoom(c.name, code, c.skin)); },
  tables: () => {
    document.getElementById("tables-modal")!.classList.remove("hidden");
    void loadTables();
  },
});

/** Fetch + render the public tables into the browser modal. */
function loadTables(): Promise<void> {
  return fetchTables().then((tables) =>
    renderTables(
      tables,
      (code) => {
        const t = tables.find((x) => x.code === code);
        if (t && !walletGate(t.stake, t.currency)) return; // staked → needs wallet
        document.getElementById("tables-modal")!.classList.add("hidden");
        const name = (localStorage.getItem("bp_nick") || "pumper").trim();
        track("play_start", { mode: "table_join" });
        void connect(() => joinRoom(name, code, Math.floor(Math.random() * 4)));
      },
      (code) => {
        document.getElementById("tables-modal")!.classList.add("hidden");
        track("spectate", { code });
        void connect(() => watchMatch(code));
      },
    ),
  );
}

document.getElementById("tables-close")!.addEventListener("click", () => {
  document.getElementById("tables-modal")!.classList.add("hidden");
});
document.getElementById("tables-refresh")!.addEventListener("click", () => {
  void loadTables();
});

document.getElementById("start-now")!.addEventListener("click", () => net.sendStart());

// Ready-up toggle (reads the authoritative state from the latest room info).
document.getElementById("ready-btn")!.addEventListener("click", () => {
  const me = state.roomPlayers.find((p) => p.id === state.myId);
  net.sendReady(!(me?.ready ?? false));
});

// Build both emote bars (lobby + in-game) from the shared EMOTES list.
function buildEmoteBar(id: string): void {
  const bar = document.getElementById(id);
  if (!bar) return;
  bar.innerHTML = "";
  EMOTES.forEach((e, i) => {
    const b = document.createElement("button");
    b.className = "emote-btn";
    b.textContent = e;
    b.addEventListener("click", () => net.sendEmote(i));
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
    void navigator.share({ title: "Bombermeme", text: "Come play Bombermeme with me 💣", url }).catch(() => {});
  } else if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(url).then(() => {
      btn.textContent = "✅ Link copied!";
      setTimeout(() => (btn.textContent = "👥 Invite friends"), 1500);
    });
  }
});

document.getElementById("result-share")?.addEventListener("click", () => {
  const me = state.latest()?.players.find((p) => p.id === state.myId);
  const won = state.winnerId === state.myId;
  const frags = me?.frags ?? 0;
  const text = won
    ? `I just won a round of Bombermeme 💣🏆 with ${frags} frags. Come get blown up:`
    : `Just dropped ${frags} frags in Bombermeme 💣 Think you can do better?`;
  const url = `${location.origin}${location.pathname}`;
  if (navigator.share) {
    void navigator.share({ title: "Bombermeme", text, url }).catch(() => {});
  } else {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener");
  }
});

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
