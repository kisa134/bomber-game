import {
  ServerMsg,
  MatchPhase,
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
  type JoinResponse,
} from "./net/socket.js";
import { GameState } from "./game/state.js";
import { Renderer, PLAYER_COLORS } from "./game/renderer.js";
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
} from "./net/wallet.js";
import { setupMenu, setMenuStatus, showScreen, showResult, renderRoom, renderTables, setStakeHandler } from "./ui/lobby.js";
import { track, identifyWallet, initErrorTracking } from "./analytics.js";
import { Predictor } from "./game/prediction.js";

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

async function connect(getJoin: () => Promise<JoinResponse>): Promise<void> {
  showScreen("loading");
  document.getElementById("loading-status")!.textContent = "connecting…";
  try {
    let res = await getJoin();
    // If we have a connected wallet but the server didn't accept the session
    // (e.g. it restarted), re-sign once so stats are credited to the wallet.
    if (loadWallet() && !res.wallet) {
      document.getElementById("loading-status")!.textContent = "verifying wallet…";
      if (await reauth()) res = await getJoin();
    }
    if (typeof res.chips === "number") setBalance(res.chips);
    net.connect(res.token);
  } catch (err) {
    showScreen("menu");
    setMenuStatus(`Failed: ${(err as Error).message}`);
  }
}

net.onClose = () => {
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

net.onMessage = (msg) => {
  switch (msg.type) {
    case ServerMsg.WELCOME:
      if (msg.protocolVersion !== PROTOCOL_VERSION) {
        net.close();
        showScreen("menu");
        setMenuStatus("Game was updated — please refresh the page (Ctrl/Cmd+R).");
        return;
      }
      state.myId = msg.playerId;
      break;
    case ServerMsg.ROOM_INFO: {
      const count = msg.players.length;
      if (count > prevPlayerCount && prevPlayerCount > 0) assets.play("join");
      prevPlayerCount = count;
      state.setRoomInfo(msg);
      // Don't yank the player off the result screen — they leave it via a button.
      if (!inGame(state.phase) && !onResultScreen()) {
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
        if (!onResultScreen()) {
          showScreen("room");
          renderRoom(state);
          music("lobby");
        }
      }
      break;
    case ServerMsg.MATCH_END:
      state.winnerId = msg.winnerId;
      assets.stop("sudden_death"); // kill the last-minute track
      announceResult(msg.winnerId);
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
  let chipNote = "";
  if (stake > 0) {
    chipNote = draw ? "Stake refunded" : won ? `Won the pot 🪙` : `Lost 🪙${stake}`;
  }
  const note = document.getElementById("result-chips");
  if (note) note.textContent = chipNote;
  const w = loadWallet();
  const prevRating = lastRating;
  if (w) {
    void fetchProfile(w.address)
      .then((p) => {
        setStats(p.chips, p.rating);
        const d = p.rating - prevRating;
        const ratingNote =
          d !== 0 ? `${leagueFor(p.rating).emoji} ${p.rating} (${d > 0 ? "+" : ""}${d})` : "";
        if (note) note.textContent = [chipNote, ratingNote].filter(Boolean).join("  ·  ");
      })
      .catch(() => {});
  }
  setTimeout(() => {
    showResult(title);
    const fair = document.getElementById("result-fair")!;
    fair.textContent =
      state.seed && state.seedCommit
        ? `🔒 provably fair · seed ${state.seed.slice(0, 10)}… · commit ${state.seedCommit.slice(0, 8)}…`
        : "";
  }, 1000);
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

const STREAK_WORDS = ["", "", "DOUBLE KILL!", "TRIPLE KILL!", "MULTI KILL!", "RAMPAGE!"];
function registerMyKill(): void {
  const now = performance.now();
  myKillTimes = myKillTimes.filter((t) => now - t < 3500);
  myKillTimes.push(now);
  const n = myKillTimes.length;
  if (n >= 2) {
    const word = STREAK_WORDS[Math.min(n, STREAK_WORDS.length - 1)];
    calloutEl.textContent = word;
    calloutEl.classList.remove("hidden", "show");
    void calloutEl.offsetWidth;
    calloutEl.classList.add("show");
    calloutUntil = now + 1400;
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
      const sends = predictor.step(state.serverNow(), state.pingMs, input.dir);
      for (const s of sends) net.sendMove(s.dir, s.tick);
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
  btn.textContent = w ? `🟢 ${shortAddr(w.address)}` : "🔗 Connect Wallet";
  // Show rating + chips in the menu whenever a wallet is connected.
  if (w) void fetchProfile(w.address).then((p) => setStats(p.chips, p.rating)).catch(() => {});
  else document.getElementById("player-stats")?.classList.add("hidden");
}

function openWalletModal(): void {
  const modal = document.getElementById("wallet-modal")!;
  const list = document.getElementById("wallet-list")!;
  const empty = document.getElementById("wallet-empty")!;
  const status = document.getElementById("wallet-modal-status")!;
  status.textContent = "";
  list.innerHTML = "";
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
  document.getElementById("player-stats")?.classList.remove("hidden");
}
/** Chips-only update when we don't have a fresh rating (keeps the last one). */
function setBalance(chips: number): void {
  setStats(chips, lastRating);
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
    const into = p.xp % 200;
    const wr = p.matches ? Math.round((p.wins / p.matches) * 100) : 0;
    body.innerHTML = "";
    const lg = leagueFor(p.rating);
    body.append(
      el("div", "prof-addr", shortAddr(w.address)),
      el("div", "prof-level", `${lg.emoji} ${lg.name} · ${p.rating}`),
      el("div", "prof-chips", `🪙 ${p.chips.toLocaleString()} chips`),
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

async function openLeaderboard(): Promise<void> {
  showScreen("leaderboard");
  const body = document.getElementById("leaderboard-body")!;
  body.innerHTML = '<li class="status">Loading…</li>';
  try {
    const rows = await fetchLeaderboard();
    body.innerHTML = "";
    if (!rows.length) {
      body.innerHTML = '<li class="status">No players yet — be the first!</li>';
      return;
    }
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "lb-row";
      const lg = leagueFor(r.rating);
      li.append(
        el("span", "lb-rank", `${i + 1}`),
        el("span", "lb-name", `${lg.emoji} ${r.name || shortAddr(r.wallet)}`),
        el("span", "lb-xp", `${r.rating}`),
      );
      body.appendChild(li);
    });
  } catch {
    body.innerHTML = '<li class="status">Failed to load.</li>';
  }
}

function wireMenuLinks(): void {
  document.getElementById("open-profile")!.addEventListener("click", () => void openProfile());
  document.getElementById("open-leaderboard")!.addEventListener("click", () => void openLeaderboard());
  document.getElementById("profile-back")!.addEventListener("click", () => showScreen("menu"));
  document.getElementById("leaderboard-back")!.addEventListener("click", () => showScreen("menu"));
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

initErrorTracking();
track("app_loaded");
input.attach();
void assets.preload();
applySettings();
wireSettings();
wireWallet();
wireMenuLinks();
setupBackground();

setupMenu({
  quickplay: (c) => { track("play_start", { mode: "quickplay", stake: c.stake }); connect(() => quickplay(c.name, c.skin, c.stake)); },
  practice: (c) => { track("play_start", { mode: "practice" }); connect(() => practiceRoom(c.name, c.skin)); },
  create: (c) => { track("play_start", { mode: "create", stake: c.stake }); connect(() => createRoom(c.name, c.skin, c.stake)); },
  join: (c, code) => { track("play_start", { mode: "join" }); connect(() => joinRoom(c.name, code, c.skin)); },
  tables: () => {
    void fetchTables().then((tables) =>
      renderTables(tables, (code) => {
        const name = (localStorage.getItem("bp_nick") || "pumper").trim();
        track("play_start", { mode: "table_join" });
        void connect(() => joinRoom(name, code, Math.floor(Math.random() * 4)));
      }),
    );
  },
});

// Host can change the table stake from the waiting room (server re-broadcasts).
setStakeHandler((stake) => net.sendSetStake(stake));

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
// Back to lobby: stay connected, just show the waiting room. The server keeps
// the room alive after a match, so the same players regroup for a rematch.
document.getElementById("result-lobby")!.addEventListener("click", () => {
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
