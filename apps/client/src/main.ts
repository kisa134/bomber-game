import {
  ServerMsg,
  MatchPhase,
  Direction,
  PowerUpType,
  DRAW_WINNER_ID,
  PLAYER_BASE_SPEED,
  SPEED_UP_DELTA,
  MATCH_LENGTH_MS,
  SUDDEN_DEATH_AT_MS,
  PROTOCOL_VERSION,
  EMOTES,
  leagueFor,
  LEAGUES,
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
  SKIN_UNLOCK_LEVEL,
  SKIN_TOKEN_PRICES,
  WHEEL_PRIZES,
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
  spinWheel,
  buySkinToken,
  selectSkin,
  attributeReferral,
  fetchReferralStats,
  fetchFriends,
  addFriend,
  acceptFriend,
  removeFriend,
  type FriendsData,
  type ProfileData,
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
import { setupMenu, setMenuStatus, showScreen, syncChrome, showResult, renderRoom, renderTables, setTokenUsd, setProfileHandler, setKickHandler, setSkinSelectHandler, setShopHandler, setLobbySkins, resetCharacterBrowse, setWalletState, type ScreenName } from "./ui/lobby.js";
import { renderShareCard, VARIANT_COUNT, type CardData } from "./ui/shareCard.js";
import { initAnalytics, captureAttribution, track, identifyWallet, initErrorTracking } from "./analytics.js";
import { Predictor } from "./game/prediction.js";
import { initTelegram, isTelegram, getStartParam } from "./platform/telegram.js";
import { selectRegion } from "./net/region.js";
import { startPresence } from "./platform/presence.js";
import { enterImmersive } from "./platform/fullscreen.js";
import {
  startTelegramConnect,
  resumeTelegramWallet,
  disconnectTelegramWallet,
  TG_WALLETS,
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
let practiceCompetitive = false; // practice sub-mode: competitive bots (tiny rewards) vs sandbox (none)
let goUntil = 0;
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
let myPickupStep = 0; // count of bonuses I've collected this match -> rising pickup pitch
let hitStopUntil = 0; // brief full-view freeze for kill impact (game feel)
let lastMatch: { won: boolean; draw: boolean; frags: number; earnText: string; ratingDelta: number; firstBlood: boolean } | null = null;
// Handle for the 3s "result screen" timer, so a new match starting within that
// window can cancel the previous match's deferred result (no overlay/stale data).
let announceTimer: ReturnType<typeof setTimeout> | null = null;

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
        // Threat vignette: strongest on the last life, milder in sudden death.
        const sd = state.phase === MatchPhase.SUDDEN_DEATH;
        renderer?.setDanger(!me.alive ? 0 : me.lives <= 1 ? 1 : sd ? 0.5 : 0);
      } else {
        renderer?.setDanger(0);
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
      // (Soft-block break sound is now the positioned, juicy crate-smash triggered
      // in the renderer's break detection — see renderer.crateBreak.)
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
    case ServerMsg.KICKED:
      leaveToMenu();
      setMenuStatus(
        msg.reason === 1
          ? "⏱ Match started without you — you weren't ready in time"
          : "👢 The host removed you from the lobby",
      );
      break;
    case ServerMsg.PONG:
      state.pingMs = Math.round(performance.now() - msg.timestamp);
      break;
    case ServerMsg.MATCH_SEED:
      state.seedCommit = msg.commit;
      if (msg.seed) state.seed = msg.seed;
      break;
    case ServerMsg.EVENT_EXPLOSION: {
      // Spatial + power-scaled explosion: louder/punchier the bigger the blast and
      // the closer it is to you; panned by its horizontal offset. Shake matches it.
      const power = Math.min(1, msg.cells.length / 13);
      let vol = 0.6, pan = 0;
      const meX = state.latest()?.players.find((p) => p.id === state.myId);
      if (meX?.alive && msg.cells.length) {
        let dmin = Infinity, nx = meX.x;
        for (const c of msg.cells) {
          const dx = c.x - meX.x, dy = c.y - meX.y, dd = dx * dx + dy * dy;
          if (dd < dmin) { dmin = dd; nx = c.x; }
        }
        vol = (0.65 + 0.35 * power) * Math.max(0.3, 1 / (1 + dmin / 26)); // loud up close, gentler falloff
        pan = Math.max(-1, Math.min(1, (nx - meX.x) / 8.5));
      } else {
        vol = 0.55 + 0.4 * power;
      }
      assets.explosion(power, vol, pan);
      assets.duck(0.72, 150); // sidechain "vacuum": music drops ~-12dB / 150ms then snaps back
      renderer?.onExplosion(msg.cells);
      break;
    }
    case ServerMsg.EVENT_PICKUP: {
      const snap = state.latest();
      const pp = snap?.players.find((p) => p.id === msg.playerId);
      if (pp) renderer?.burst(Math.floor(pp.x), Math.floor(pp.y), "#7CFC00", 10, 3);
      // Only YOU get the reward cue — other players'/bots' pickups are silent.
      if (pp && msg.playerId === state.myId) {
        // Rising reward ladder: each bonus you collect this match plays a semitone
        // higher (up to an octave) — accumulating dopamine cue.
        myPickupStep++;
        assets.play("pickup", undefined, Math.pow(2, Math.min(myPickupStep, 12) / 12));
        showPickupToast(msg.powerup);
        renderer?.popText(pp.x, pp.y, POWERUP_META[msg.powerup].label, "#ffe14a"); // springy pickup popup
      }
      break;
    }
    case ServerMsg.EVENT_KILL:
      killLines.push({ killerId: msg.killerId, victimId: msg.victimId, until: performance.now() + 4500 });
      if (killLines.length > 5) killLines.shift();
      if (msg.killerId === state.myId && msg.victimId !== state.myId) {
        registerMyKill();
        assets.rewardDing(); // bright casino-style reward chime on your kill
        const v = state.latest()?.players.find((p) => p.id === msg.victimId);
        if (v) renderer?.popText(v.x, v.y, "FRAG!", "#ff5a4a", true); // elastic kill reward popup
      }
      break;
    case ServerMsg.EVENT_PLAYER_DEATH: {
      assets.play("die");
      if (settings.gore) assets.playGore(); else assets.rewardDing(); // wet splat, or a coin chime when gore is off
      assets.duck(0.6, 260); // sidechain: deeper duck on a kill (-~8dB)
      hitStopUntil = performance.now() + 85; // hit-stop: weighty kill freeze
      const snap = state.latest();
      const dp = snap?.players.find((p) => p.id === msg.playerId);
      if (dp) renderer?.onDeath(Math.floor(dp.x), Math.floor(dp.y), PLAYER_COLORS[dp.id % PLAYER_COLORS.length]);
      if (msg.playerId === state.myId) { flashHit(); myKillTimes = []; } // your death breaks your streak
      break;
    }
    case ServerMsg.EVENT_EMOTE:
      showEmote(msg.playerId, msg.emote);
      break;
    case ServerMsg.CHAT_MSG:
      addChatMessage(msg.playerId, msg.text);
      break;
    case ServerMsg.EVENT_CALLOUT:
      if (msg.kind === CalloutType.FIRST_BLOOD) {
        renderer?.firstBlood(); // pixel "FIRST BLOOD" text + blood drips
        assets.play("first_blood"); // direct hit so EVERY player clearly hears it
        void assets.playReverb("first_blood"); // + echo/reverb tail for impact
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
  // A new match is starting in this room — drop any pending result screen and
  // wipe the previous match's playback state so it can't bleed into this one.
  if (announceTimer) {
    clearTimeout(announceTimer);
    announceTimer = null;
  }
  state.newMatch();
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (!renderer) {
    renderer = new Renderer(canvas);
    renderer.setAssets(assets);
    renderer.skinOf = (id) => state.skinOf(id);
    renderer.setGore(settings.gore);
  }
  renderer.resize();
  renderer.remeasure(); // re-fit after the game screen has actually laid out
  // Reset the renderer's board caches NOW (at countdown), before the new map's
  // first snapshot arrives — otherwise the new grid is diffed against the old
  // match's grid and sprays debris/scorch all over ("remnants of last round").
  renderer.onMatchStart();
  assets.stop("sudden_death");
  assets.shepard(0); // clear any lingering round-end Shepard tone
  assets.subBass(0); // clear any lingering bomb sub-bass
  myPickupStep = 0;
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
  // Guard against a never-assigned id (-1) matching some sentinel; you only won
  // if you have a real seat AND you're the winner.
  const won = state.myId >= 0 && winnerId === state.myId;
  const draw = winnerId === DRAW_WINNER_ID;
  // Snapshot the FINAL players of THIS match now — the 3s result timer below must
  // not read state.latest() later (a new match may have overwritten the buffer).
  const finalPlayers = [...(state.latest()?.players ?? [])];
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
  announceTimer = setTimeout(() => {
    announceTimer = null;
    renderResultScreen(winnerId, finalPlayers, title);
  }, 3000); // linger on the battlefield (corpses + blood) before the scoreboard
}

/** Count a number up to its final value (a little dopamine on the reward). */
function animateCount(elx: HTMLElement, to: number, from = 0, ms = 700): void {
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    elx.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Compose the full post-match screen: hero · rewards · progression · standings,
 *  with mode-specific actions (bots vs PvP). */
function renderResultScreen(winnerId: number, finalPlayers: { id: number; alive: boolean; frags: number }[], title: string): void {
  showResult(title);
  const won = !!lastMatch?.won;
  const draw = !!lastMatch?.draw;
  const frags = lastMatch?.frags ?? 0;

  // Hero mood (drives the celebratory glow).
  const hero = document.getElementById("result-hero");
  hero?.classList.toggle("win", won);
  hero?.classList.toggle("lose", !won && !draw);
  hero?.classList.toggle("draw", draw);

  // Placement (1st / Nth / Draw) from the final ranking.
  const ranked = [...finalPlayers].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    return Number(b.alive) - Number(a.alive) || b.frags - a.frags;
  });
  const myPlace = ranked.findIndex((p) => p.id === state.myId) + 1;
  const placeEl = document.getElementById("result-place");
  if (placeEl) {
    placeEl.textContent = draw
      ? "Match drawn"
      : won
        ? "🥇 1st place"
        : myPlace > 0
          ? `#${myPlace} of ${ranked.length}`
          : "";
  }

  // Reward strip. Bots: honest "practice" / "tiny" note; PvP: winnings + rating.
  const rew = document.getElementById("result-rewards");
  if (rew) {
    rew.innerHTML = "";
    const chip = (label: string, val: string, cls = ""): HTMLElement => {
      const c = el("div", `result-rew ${cls}`, "");
      c.append(el("span", "result-rew-v", val), el("span", "result-rew-l", label));
      return c;
    };
    rew.append(chip("Frags", `⚔️ ${frags}`));
    if (practiceMode) {
      rew.append(
        practiceCompetitive
          ? chip("Reward", "🟢 tiny XP + 🪙", "tiny")
          : chip("Reward", "⚪ practice", "none"),
      );
    } else {
      rew.append(chip("Match", lastMatch?.earnText || "—", "earn"));
      const delta = lastMatch?.ratingDelta ?? 0;
      const ratingChip = chip("Rating", "", delta > 0 ? "up" : delta < 0 ? "down" : "");
      const v = ratingChip.querySelector(".result-rew-v") as HTMLElement;
      const deltaTag = delta ? ` (${delta > 0 ? "+" : ""}${delta})` : "";
      v.innerHTML = `📈 <span class="rt-num"></span><span class="rt-delta">${deltaTag}</span>`;
      rew.append(ratingChip);
      animateCount(v.querySelector(".rt-num") as HTMLElement, lastRating, lastRating - delta, 800);
    }
  }

  // Progression toward the next league (PvP only — bots don't move rating).
  const progWrap = document.getElementById("result-prog");
  if (progWrap) {
    if (!practiceMode) {
      const pr = leagueProgress(lastRating);
      progWrap.classList.remove("hidden");
      progWrap.innerHTML =
        `<div class="result-prog"><div class="result-progfill" style="width:${pr.pct}%"></div></div>` +
        `<div class="prof-sub">${pr.label}</div>`;
    } else {
      progWrap.classList.add("hidden");
    }
  }

  renderResultBoard(winnerId, finalPlayers);

  // Mode-specific actions: bots = replay/setup; PvP = lobby/invite/share.
  const lobbyBtn = document.getElementById("result-lobby")!;
  lobbyBtn.textContent = practiceMode ? "🔁 Play again" : "↩ Back to lobby";
  document.getElementById("result-setup")?.classList.toggle("hidden", !practiceMode);
  document.getElementById("result-invite")?.classList.toggle("hidden", practiceMode);
  const leave = document.getElementById("result-leave");
  if (leave) leave.textContent = practiceMode ? "Leave to menu" : "Leave to menu";

  const fair = document.getElementById("result-fair")!;
  fair.textContent =
    state.seed && state.seedCommit
      ? `🔒 provably fair · seed ${state.seed.slice(0, 10)}… · commit ${state.seedCommit.slice(0, 8)}…`
      : "";
}

/** Final scoreboard on the result screen: placement, frags, your row marked.
 *  `players` is captured at MATCH_END so it reflects the match that just ended. */
function renderResultBoard(winnerId: number, players: { id: number; alive: boolean; frags: number }[]): void {
  const board = document.getElementById("result-board");
  if (!board) return;
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

const STREAK_WORDS = ["", "", "DOUBLE KILL!", "TRIPLE KILL!", "MULTI KILL!", "RAMPAGE!", "UNSTOPPABLE!", "GODLIKE!", "LEGENDARY!"];
function registerMyKill(): void {
  const now = performance.now();
  myKillTimes = myKillTimes.filter((t) => now - t < 3500);
  myKillTimes.push(now);
  const n = myKillTimes.length;
  if (n >= 2) {
    showCallout(STREAK_WORDS[Math.min(n, STREAK_WORDS.length - 1)]);
    const lvl = Math.min(n, 9);
    assets.play("go", undefined, Math.pow(2, (lvl - 2) / 7)); // pitch climbs with the streak
    assets.rewardDing(); // extra casino sparkle on top
    if (n >= 4) { assets.duck(0.55, 240); hitStopUntil = performance.now() + 60; } // a weighty punch on big streaks
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

  // Shepard tone: ever-rising tension over the final ~18s of the round (sudden death).
  let shep = 0;
  if (state.phase === MatchPhase.SUDDEN_DEATH) {
    const left = state.phaseTimeLeft();
    if (left <= 18000) shep = Math.min(1, (18000 - left) / 18000);
  }
  assets.shepard(shep);
  assets.setMusicScale(1 - shep * 0.8); // fade music under the Shepard tone so they don't clash

  // Colour temperature over the match: cozy-warm early (safety), draining to a
  // mortuary cold through sudden death (cortisol).
  let warmth = 1;
  if (state.phase === MatchPhase.PLAYING) {
    const el = Math.max(0, Math.min(1, (120000 - state.phaseTimeLeft()) / 120000));
    warmth = 1 - el * 0.5; // 1.0 cozy -> ~0.5 by 2:00
  } else if (state.phase === MatchPhase.SUDDEN_DEATH) {
    const el = Math.max(0, Math.min(1, (60000 - state.phaseTimeLeft()) / 60000));
    warmth = 0.4 - el * 1.3; // 0.4 -> cold (clamped to -1)
  }
  renderer?.setColorTemp(warmth);

  const snap = state.latest();
  if (!snap) return;

  // Sub-bass threat hum: rises as a live bomb gets close to you (felt fear).
  let sub = 0;
  const meHud = snap.players.find((p) => p.id === state.myId);
  if (meHud?.alive && snap.bombs.length) {
    let dmin = Infinity;
    for (const b of snap.bombs) { const dd = Math.hypot(b.x - meHud.x, b.y - meHud.y); if (dd < dmin) dmin = dd; }
    sub = Math.max(0, Math.min(1, 1 - dmin / 5)); // within ~5 cells it ramps up
  }
  assets.subBass(sub);

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

let frameErrLogged = false;
function frame(): void {
  try {
  const now = performance.now();
  // Hit-stop: freeze the whole view briefly on an elimination so the kill lands
  // with weight (the canvas holds its last frame, then snaps back).
  if (now < hitStopUntil) {
    return;
  }
  updateDebug();

  // Outside a live match (menu/lobby), kill the bomb sub-bass + round-end Shepard
  // so they never hum into the menu (updateHud, which drives them, isn't called there).
  if (!(inGame(state.phase) || state.phase === MatchPhase.END)) {
    assets.subBass(0);
    assets.shepard(0);
  }

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
  } catch (err) {
    // A single bad frame must NEVER kill the render loop. Log once, keep going.
    if (!frameErrLogged) {
      frameErrLogged = true;
      console.error("[frame] render error (loop kept alive):", err);
    }
  } finally {
    requestAnimationFrame(frame);
  }
}

// --- settings -------------------------------------------------------------

function applySettings(): void {
  assets.setMusicEnabled(settings.music);
  assets.setSfxEnabled(settings.sfx);
  input.setControlScheme(settings.controls);
  renderer?.setGore(settings.gore);
  syncSettingsUI();
}

function syncSettingsUI(): void {
  const m = document.getElementById("set-music") as HTMLButtonElement;
  const s = document.getElementById("set-sfx") as HTMLButtonElement;
  const gr = document.getElementById("set-gore") as HTMLButtonElement | null;
  m.dataset.on = String(settings.music);
  m.textContent = settings.music ? "On" : "Off";
  s.dataset.on = String(settings.sfx);
  s.textContent = settings.sfx ? "On" : "Off";
  if (gr) { gr.dataset.on = String(settings.gore); gr.textContent = settings.gore ? "On" : "Off"; }
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
  document.getElementById("set-gore")?.addEventListener("click", () => update("gore", !settings.gore));
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
        myProfile = p; // for the "you" row in the hub leaderboard
        setStats(p.chips, p.rating);
        setTokenBadge(p.gameTokens);
        setProgress(p.level ?? 1, p.xp ?? 0);
        setLobbySkins(p.skins ?? DEFAULT_SKINS, p.level ?? 1); // owned skins for the lobby strip
        loadHubTop(); // re-render now that we know who "you" are (show your own row right away)
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
  updateSplashButtons(); // hide "Connect wallet" on the splash once connected
}

/** Landing site for the splash "About" button. */
const LANDING_URL = "https://bombermeme.fun";
/** The splash "Connect wallet" button only shows when no wallet is connected. */
function updateSplashButtons(): void {
  document.getElementById("splash-connect")?.classList.toggle("hidden", !!loadWallet());
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
    // One row per deeplink wallet (Phantom / Solflare). The chosen wallet drives
    // the whole connect→sign→deposit deeplink flow.
    for (const w of TG_WALLETS) {
      const row = document.createElement("button");
      row.className = "wallet-row";
      row.textContent = `${w.emoji} Connect with ${w.name}`;
      row.addEventListener("click", () => {
        status.textContent = `Opening ${w.name}…`;
        track("wallet_connect_start", { provider: `telegram-${w.name.toLowerCase()}` });
        void startTelegramConnect({ name: w.name, base: w.base });
      });
      list.appendChild(row);
    }
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

/** Human-readable lifetime playtime: "5m", "2h 14m", "3d 4h". */
function formatPlaytime(sec: number | undefined): string {
  const s = Math.max(0, Math.floor(sec ?? 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
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
  setRatingRail(rating);
  updateBalanceBars();
  syncChrome();
  refreshHub(); // equipped character may have synced from the profile
}
/** Update the PRIMARY rating rail in the HUD (rank + progress toward next league). */
function setRatingRail(rating: number): void {
  const lg = leagueFor(rating);
  const rk = document.getElementById("hub-rank");
  if (rk) {
    rk.textContent = `${lg.emoji} ${lg.name} · ${rating.toLocaleString()}`;
    rk.style.setProperty("--c", LEAGUE_COLORS[lg.name] ?? "#9aa3b2");
  }
  const pr = leagueProgress(rating);
  const fill = document.getElementById("hub-ratefill") as HTMLElement | null;
  if (fill) {
    fill.style.width = `${pr.pct}%`;
    fill.style.setProperty("--c", LEAGUE_COLORS[lg.name] ?? "#9aa3b2");
  }
  const txt = document.getElementById("hub-ratetext");
  if (txt) txt.textContent = pr.label;
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
  // Show the live USD value of the balance next to it (blank if no price yet).
  const usd = document.getElementById("token-usd");
  if (usd) usd.textContent = usdOf(balance);
  badge.classList.remove("hidden");
  syncChrome();
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

/** Progress from the current rating toward the next league up. */
function leagueProgress(rating: number): { pct: number; label: string } {
  const cur = leagueFor(rating);
  const higher = LEAGUES.filter((l) => l.min > cur.min).sort((a, b) => a.min - b.min)[0];
  if (!higher) return { pct: 100, label: "👑 Top league reached" };
  const span = higher.min - cur.min;
  const pct = Math.max(4, Math.min(100, ((rating - cur.min) / span) * 100));
  return { pct, label: `${(higher.min - rating).toLocaleString()} rating to ${higher.emoji} ${higher.name}` };
}

/** Tier colours: green (early) → orange → red → gold (top), part of the rank
 *  hierarchy (not just decoration). */
const LEAGUE_COLORS: Record<string, string> = {
  Beginner: "#5fd96a",
  Advanced: "#ff9a3d",
  Pro: "#ff5a5a",
  Champion: "#ffcc33",
};
/** Build the rating ladder: every tier visible ahead, current one highlighted +
 *  filling, past ones full, future ones dimmed. */
function buildRankLadder(rating: number): HTMLElement {
  const tiers = [...LEAGUES].sort((a, b) => a.min - b.min); // ascending
  const ladder = el("div", "rank-ladder", "");
  tiers.forEach((t, i) => {
    const next = tiers[i + 1];
    const cap = next ? next.min : t.min + 400; // top tier spans ~400 for the fill
    let state: "past" | "current" | "future";
    let fillPct = 0;
    if (next && rating >= next.min) {
      state = "past";
      fillPct = 100;
    } else if (rating >= t.min) {
      state = "current";
      fillPct = Math.max(6, Math.min(100, ((rating - t.min) / (cap - t.min)) * 100));
    } else {
      state = "future";
      fillPct = 0;
    }
    const color = LEAGUE_COLORS[t.name] ?? "#9aa3b2";
    const seg = el("div", `ladder-seg ${state}`, "");
    seg.style.setProperty("--c", color);
    const bar = el("div", "ladder-bar", "");
    const fill = el("div", "ladder-fill", "");
    fill.style.width = `${fillPct}%`;
    bar.appendChild(fill);
    seg.appendChild(bar);
    seg.appendChild(el("div", "ladder-label", `${t.emoji} ${t.name}`));
    ladder.appendChild(seg);
  });
  return ladder;
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
    const lg = leagueFor(p.rating);
    const skin = p.skin ?? Number(localStorage.getItem("bp_skin")) ?? 0;
    body.innerHTML = "";

    // --- Hero: character + name (editable) + rank --------------------------
    const hero = el("div", "prof-hero", "");
    const av = el("div", "prof-hero-av", "");
    av.appendChild(skinAvatar(skin, PLAYER_COLORS[skin % PLAYER_COLORS.length]));
    const info = el("div", "prof-hero-info", "");
    const nameInput = document.createElement("input");
    nameInput.className = "prof-name-input";
    nameInput.maxLength = 16;
    nameInput.value = p.name || localStorage.getItem("bp_nick") || "";
    const save = (): void => {
      const v = nameInput.value.trim().slice(0, 16);
      if (!v) return;
      localStorage.setItem("bp_nick", v);
      const menuNick = document.getElementById("nickname") as HTMLInputElement | null;
      if (menuNick) menuNick.value = v;
    };
    nameInput.addEventListener("change", save);
    nameInput.addEventListener("blur", save);
    const rank = el("div", "prof-rankrow", "");
    rank.innerHTML = `<span class="prof-league">${lg.emoji} ${lg.name}</span><span class="prof-rating">${p.rating}</span>`;
    info.append(nameInput, el("div", "prof-id", shortAddr(w.address)), rank);
    info.append(el("div", "prof-sub", "✎ Name applies from your next match"));
    hero.append(av, info);
    body.append(hero);

    // --- Zone grid: progression · stats · account --------------------------
    const card = (title: string): HTMLElement => {
      const c = el("div", "prof-card", "");
      c.appendChild(el("div", "prof-card-h", title));
      return c;
    };
    const row = (label: string, val: string): HTMLElement => {
      const r = el("div", "prof-row", "");
      r.append(el("span", "prof-row-l", label), el("b", "prof-row-v", val));
      return r;
    };
    // Rank ladder (competitive progression) — full width, primary.
    const rankCard = card("🏆 Rank");
    const pr = leagueProgress(p.rating);
    const head = el("div", "rank-head", "");
    head.append(
      el("div", "rank-rating", `${lg.emoji} ${p.rating.toLocaleString()}`),
      el("div", "rank-name", lg.name),
    );
    rankCard.appendChild(head);
    rankCard.appendChild(buildRankLadder(p.rating));
    rankCard.appendChild(el("div", "prof-sub", pr.label));
    body.append(rankCard); // full width on its own row

    // Account level / XP (separate, calmer progression).
    const lvlCard = card("📊 Account level");
    lvlCard.appendChild(row(`Level ${p.level ?? 1}`, `${(p.xp ?? 0) % 200} / 200 XP`));
    const xpbar = el("div", "lvl-bar", "");
    const xpfill = el("div", "lvl-fill", "");
    xpfill.style.width = `${Math.max(3, Math.min(100, (((p.xp ?? 0) % 200) / 200) * 100))}%`;
    xpbar.appendChild(xpfill);
    lvlCard.appendChild(xpbar);

    // Career stats
    const stats = card("⚔️ Career stats");
    const sgrid = el("div", "prof-statgrid", "");
    sgrid.append(
      profCell("Matches", p.matches),
      profCell("Wins", p.wins),
      profCell("Win rate", `${wr}%`),
      profCell("Frags", p.frags),
      profCell("Deaths", p.deaths),
      profCell("Best streak", p.best_streak ?? 0),
      profCell("⏱ Time", formatPlaytime(p.playtime_sec)),
    );
    stats.appendChild(sgrid);

    // Account / economy
    const acct = card("💰 Account");
    acct.append(
      row("🪙 Chips", p.chips.toLocaleString()),
      row(`💎 In game`, `${(p.gameTokens ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${usdOf(p.gameTokens ?? 0)}`),
      row("🏆 Won 💎", tokWon.toLocaleString(undefined, { maximumFractionDigits: 2 })),
      row("🏆 Won 🪙", (p.chips_won ?? 0).toLocaleString()),
    );

    // Two packed columns (no ragged gaps): left = stats, right = level + account.
    const cols = el("div", "prof-cols", "");
    const leftCol = el("div", "prof-col", "");
    const rightCol = el("div", "prof-col", "");
    leftCol.append(stats);
    rightCol.append(lvlCard, acct);
    cols.append(leftCol, rightCol);
    body.append(cols);
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
      profCell("Level", p.level ?? 1),
      profCell("Rating", p.rating),
      profCell("Matches", p.matches),
      profCell("Wins", p.wins),
      profCell("Win rate", `${wr}%`),
      profCell("Frags", p.frags),
      profCell("Deaths", p.deaths),
      profCell("Best streak", p.best_streak),
      profCell("⏱ Time", formatPlaytime(p.playtime_sec)),
      profCell("💎 Won", Math.round((p.tokens_won ?? 0) / 10 ** TOKEN_DECIMALS).toLocaleString()),
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

const SKIN_NAMES = ["Shiba", "Pepe", "Trump", "Musk", "Doge", "Pump", "Durov", "Vitalik", "Troll", "Bogdanoff", "Gigachad"];

/** Rarity by index (price tier) — drives the card/border colour + label. */
function rarityOf(i: number): { name: string; color: string } {
  if (i < 4) return { name: "Common", color: "#9aa3b2" };
  if (i < 6) return { name: "Rare", color: "#4aa3ff" };
  if (i < 8) return { name: "Epic", color: "#c879ff" };
  if (i < 10) return { name: "Legendary", color: "#ffcc33" };
  return { name: "Mythic", color: "#ff5a5a" };
}

// Shop state (a real screen: filters → grid → focused detail panel).
type ShopFilter = "all" | "owned" | "available" | "locked";
let shopFilter: ShopFilter = "all";
let shopSelected = -1; // skin focused in the detail panel
let shopReturn: ScreenName = "menu"; // where ← goes back to
const shop = { owned: DEFAULT_SKINS, equipped: 0, level: 1, chips: 0, tokens: 0, wallet: false };

const skinOwned = (i: number): boolean => (shop.owned & (1 << i)) !== 0;
const skinBuyableChips = (i: number): boolean =>
  !skinOwned(i) && shop.level >= (SKIN_UNLOCK_LEVEL[i] ?? 0) && shop.chips >= SKIN_PRICES[i];

/** Pull the player's wallet/economy snapshot for the shop. */
async function loadShopData(): Promise<void> {
  const w = loadWallet();
  shop.wallet = !!w;
  if (w) {
    try {
      const p = await fetchProfile(w.address);
      shop.owned = p.skins ?? DEFAULT_SKINS;
      shop.equipped = p.skin ?? 0;
      shop.level = p.level ?? 1;
      shop.chips = p.chips ?? 0;
      shop.tokens = p.gameTokens ?? 0;
      localStorage.setItem("bp_skin", String(shop.equipped));
    } catch {
      /* keep last known */
    }
  } else {
    shop.owned = DEFAULT_SKINS;
    shop.equipped = Number(localStorage.getItem("bp_skin")) || 0;
    shop.level = 1;
    shop.chips = 0;
    shop.tokens = 0;
  }
}

async function refreshSkinShop(): Promise<void> {
  await loadShopData();
  if (shopSelected < 0) shopSelected = shop.equipped;
  const econ = document.getElementById("shop-econ");
  if (econ) {
    econ.innerHTML = shop.wallet
      ? `<span>🪙 ${shop.chips.toLocaleString()}</span><span>💎 ${shop.tokens.toLocaleString()}</span><span>LV ${shop.level}</span>`
      : `<span class="shop-econ-warn">Connect a wallet to buy &amp; save skins</span>`;
  }
  renderShopGrid();
  renderShopDetail();
}

/** True if skin `i` matches the active filter. */
function passesFilter(i: number): boolean {
  switch (shopFilter) {
    case "owned": return skinOwned(i);
    case "available": return skinBuyableChips(i); // can unlock with chips right now
    case "locked": return !skinOwned(i) && shop.level < (SKIN_UNLOCK_LEVEL[i] ?? 0);
    default: return true;
  }
}

function renderShopGrid(): void {
  const grid = document.getElementById("shop-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let shown = 0;
  for (let i = 0; i < SKIN_COUNT; i++) {
    if (!passesFilter(i)) continue;
    shown++;
    const owns = skinOwned(i);
    const r = rarityOf(i);
    const card = document.createElement("button");
    card.className =
      "shop-card" +
      (i === shopSelected ? " selected" : "") +
      (i === shop.equipped ? " equipped" : "") +
      (owns ? " owned" : " unowned");
    card.style.setProperty("--rarity", r.color);
    card.appendChild(skinAvatar(i, PLAYER_COLORS[i % PLAYER_COLORS.length]));
    card.appendChild(el("div", "shop-card-name", SKIN_NAMES[i] ?? `Skin ${i}`));
    // Status line: equipped / owned / price / locked-by-level.
    let tag: HTMLElement;
    if (i === shop.equipped) tag = el("div", "shop-card-tag equipped", "✔ Equipped");
    else if (owns) tag = el("div", "shop-card-tag owned", "Owned");
    else if (shop.level < (SKIN_UNLOCK_LEVEL[i] ?? 0)) tag = el("div", "shop-card-tag locked", `🔒 LV ${SKIN_UNLOCK_LEVEL[i]}`);
    else tag = el("div", "shop-card-tag price", `🪙 ${SKIN_PRICES[i].toLocaleString()}`);
    card.appendChild(tag);
    if (!owns) card.appendChild(el("div", "shop-card-rarity", r.name));
    card.addEventListener("click", () => {
      shopSelected = i;
      renderShopGrid();
      renderShopDetail();
    });
    grid.appendChild(card);
  }
  if (!shown) grid.appendChild(el("div", "shop-empty", "Nothing here — try another filter."));
}

const SHOP_TURN: Array<[string, number, boolean]> = [
  ["down", 0, false], ["down", 1, false], ["down", 2, false],
  ["side", 0, false], ["side", 1, false], ["side", 2, false],
  ["up", 0, false], ["up", 1, false], ["up", 2, false],
  ["side", 0, true], ["side", 1, true], ["side", 2, true],
];
let shopAnimTimer: ReturnType<typeof setInterval> | null = null;
function animateShopPreview(skin: number): void {
  const img = document.getElementById("shop-pic") as HTMLImageElement | null;
  if (!img) return;
  if (shopAnimTimer) clearInterval(shopAnimTimer);
  let i = 0;
  const step = (): void => {
    if (document.getElementById("shop")?.classList.contains("hidden")) return; // paused off-screen
    const [dir, f, flip] = SHOP_TURN[i % SHOP_TURN.length];
    i++;
    img.src = `/sprites/skin_${skin}_${dir}_${f}.webp?v=${ASSET_VER}`;
    img.style.transform = flip ? "scaleX(-1)" : "none";
  };
  step();
  shopAnimTimer = setInterval(step, 150);
}

function renderShopDetail(): void {
  const panel = document.getElementById("shop-detail");
  if (!panel) return;
  const i = shopSelected;
  const owns = skinOwned(i);
  const r = rarityOf(i);
  const needLevel = SKIN_UNLOCK_LEVEL[i] ?? 0;
  const chipPrice = SKIN_PRICES[i];
  const tokPrice = SKIN_TOKEN_PRICES[i];
  panel.innerHTML = "";
  panel.style.setProperty("--rarity", r.color);

  const stage = el("div", "shop-stage", "");
  const img = document.createElement("img");
  img.id = "shop-pic";
  img.className = "shop-pic";
  stage.appendChild(img);
  panel.appendChild(stage);

  panel.appendChild(el("div", "shop-rarity-badge", r.name));
  panel.appendChild(el("div", "shop-detail-name", SKIN_NAMES[i] ?? `Skin ${i}`));

  const statusText =
    i === shop.equipped ? "✔ Equipped" : owns ? "Owned" : needLevel && shop.level < needLevel ? `🔒 Unlocks at level ${needLevel}` : "Not owned";
  panel.appendChild(el("div", "shop-detail-status", statusText));

  const actions = el("div", "shop-actions", "");
  if (i === shop.equipped) {
    const b = document.createElement("button");
    b.className = "primary big"; b.textContent = "✔ Equipped"; b.disabled = true;
    actions.appendChild(b);
  } else if (owns) {
    const b = document.createElement("button");
    b.className = "primary big"; b.textContent = "Equip";
    b.addEventListener("click", () => void doSelectSkin(i));
    actions.appendChild(b);
  } else {
    // Chips path (gated by level + balance), then token path.
    const chip = document.createElement("button");
    chip.className = "primary big";
    if (shop.level < needLevel) {
      chip.textContent = `🔒 Reach LV ${needLevel}`; chip.disabled = true;
    } else if (shop.chips < chipPrice) {
      chip.textContent = `🪙 ${chipPrice.toLocaleString()} — not enough`; chip.disabled = true;
    } else {
      chip.textContent = `Buy · 🪙 ${chipPrice.toLocaleString()}`;
      chip.addEventListener("click", () => void doBuySkin(i));
    }
    actions.appendChild(chip);

    const tok = document.createElement("button");
    tok.className = "big shop-token-btn";
    if (shop.tokens < tokPrice) {
      tok.textContent = `💎 ${tokPrice.toLocaleString()} — not enough`; tok.disabled = true;
    } else {
      tok.textContent = `Buy instantly · 💎 ${tokPrice.toLocaleString()}`;
      tok.addEventListener("click", () => void doBuySkinToken(i));
    }
    actions.appendChild(tok);
    panel.appendChild(el("div", "shop-detail-hint", `Unlock with chips at LV ${needLevel || 1}, or skip the wait with 💎.`));
  }
  panel.appendChild(actions);
  animateShopPreview(i);
}

async function doSelectSkin(skin: number): Promise<void> {
  const status = document.getElementById("shop-status")!;
  if (!loadWallet()) {
    localStorage.setItem("bp_skin", String(skin)); // local-only without a wallet
    shop.equipped = skin;
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
  const status = document.getElementById("shop-status")!;
  if (!loadWallet()) {
    status.textContent = "Connect a wallet first.";
    return;
  }
  status.textContent = "Buying…";
  const r = await buySkin(skin);
  if (r.error) {
    status.textContent =
      r.error === "cant_buy"
        ? "Not enough chips."
        : r.error === "level_locked"
          ? `Reach level ${r.needLevel} to unlock with chips (or buy with 💎).`
          : `Failed: ${r.error}`;
    return;
  }
  localStorage.setItem("bp_skin", String(r.skin ?? skin));
  status.textContent = "Unlocked! 🎉";
  track("skin_bought", { skin, with: "chips" });
  void refreshSkinShop();
}

async function doBuySkinToken(skin: number): Promise<void> {
  const status = document.getElementById("shop-status")!;
  if (!loadWallet()) {
    status.textContent = "Connect a wallet first.";
    return;
  }
  status.textContent = "Buying with token…";
  const r = await buySkinToken(skin);
  if (r.error) {
    status.textContent = r.error === "cant_buy" ? "Not enough tokens — deposit in the Bank." : `Failed: ${r.error}`;
    return;
  }
  localStorage.setItem("bp_skin", String(r.skin ?? skin));
  if (r.gameTokens !== undefined) setTokenBadge(r.gameTokens);
  status.textContent = "Unlocked with 💎! 🎉";
  track("skin_bought", { skin, with: "token" });
  void refreshSkinShop();
}

/** Open the SHOP screen. `from` is the screen ← returns to (hub or the lobby room). */
function openSkinShop(from: ScreenName = "menu"): void {
  shopReturn = from;
  shopSelected = -1; // re-focus the equipped skin on open
  document.getElementById("shop-status")!.textContent = "";
  showScreen("shop");
  void refreshSkinShop();
}

// --- Lucky Spin (free chips wheel) ----------------------------------------
const WHEEL_CELL_W = 96; // px per reel cell (must match .wheel-cell in CSS)
let wheelSpinning = false;
function wheelCell(prizeId: number, skinName?: string): HTMLElement {
  const p = WHEEL_PRIZES[prizeId];
  const c = el("div", "wheel-cell", "");
  c.style.setProperty("--c", p.color);
  c.textContent = p.kind === "skin" ? (skinName ? `🎁 ${skinName}` : "🎁") : p.label;
  return c;
}
function buildIdleStrip(): void {
  const strip = document.getElementById("wheel-strip");
  if (!strip) return;
  strip.style.transition = "none";
  strip.style.transform = "translateX(0)";
  strip.innerHTML = "";
  for (let i = 0; i < 24; i++) strip.appendChild(wheelCell(Math.floor(Math.random() * WHEEL_PRIZES.length)));
}
function openWheel(): void {
  if (!loadWallet()) {
    setMenuStatus("Connect a wallet to spin");
    return;
  }
  const r = document.getElementById("wheel-result");
  if (r) { r.textContent = ""; r.className = "wheel-result"; }
  document.getElementById("wheel-modal")!.classList.remove("hidden");
  buildIdleStrip();
}
async function doSpin(): Promise<void> {
  if (wheelSpinning || !loadWallet()) return;
  const strip = document.getElementById("wheel-strip")!;
  const result = document.getElementById("wheel-result")!;
  const btn = document.getElementById("wheel-spin") as HTMLButtonElement;
  result.textContent = "";
  result.className = "wheel-result";
  let res;
  try {
    res = await spinWheel();
  } catch {
    result.textContent = "Spin failed — try again.";
    return;
  }
  if (res.error) {
    result.textContent = res.error === "cant_afford" ? "Not enough chips (need 200 🪙)." : `Failed: ${res.error}`;
    return;
  }
  wheelSpinning = true;
  btn.disabled = true;
  const TARGET = 40;
  const wonName = res.kind === "skin" && res.skin >= 0 ? (SKIN_NAMES[res.skin] ?? "skin") : undefined;
  strip.style.transition = "none";
  strip.style.transform = "translateX(0)";
  strip.innerHTML = "";
  for (let i = 0; i < TARGET + 10; i++) {
    strip.appendChild(i === TARGET ? wheelCell(res.prizeId, wonName) : wheelCell(Math.floor(Math.random() * WHEEL_PRIZES.length)));
  }
  const vp = document.querySelector(".wheel-viewport") as HTMLElement;
  const center = vp.clientWidth / 2 - WHEEL_CELL_W / 2;
  const dest = -(TARGET * WHEEL_CELL_W - center);
  void strip.offsetWidth; // reflow so the transition applies
  strip.style.transition = "transform 4s cubic-bezier(0.12, 0.84, 0.2, 1)";
  strip.style.transform = `translateX(${dest}px)`;
  window.setTimeout(() => {
    wheelSpinning = false;
    btn.disabled = false;
    result.className = "wheel-result win";
    result.textContent = res!.kind === "skin" ? `🎉 Rare skin won: ${wonName}!` : `🎉 +${res!.amount.toLocaleString()} 🪙!`;
    assets.play("victory");
    setStats(res!.chips, lastRating); // refresh chip badge
    if (res!.kind === "skin") setLobbySkins(res!.skins, myProfile?.level ?? 1); // new owned skin
  }, 4150);
}
document.getElementById("open-wheel")?.addEventListener("click", openWheel);
document.getElementById("wheel-spin")?.addEventListener("click", () => void doSpin());
document.getElementById("wheel-close")?.addEventListener("click", () =>
  document.getElementById("wheel-modal")!.classList.add("hidden"));

// --- main hub: CHOOSE YOUR FIGHTER 3D fan carousel ------------------------
// The active card's hero walks FORWARD toward the viewer (down-facing cycle).
const HUB_TURN: Array<[string, number]> = [["down", 0], ["down", 1], ["down", 2], ["down", 1]];
let hubAnimTimer: ReturnType<typeof setInterval> | null = null;
let hubAnimSkin = -1;
/** Animate the ACTIVE card's hero sprite. */
function animateActiveHero(skin: number): void {
  if (hubAnimTimer && skin === hubAnimSkin) return;
  hubAnimSkin = skin;
  if (hubAnimTimer) clearInterval(hubAnimTimer);
  let i = 0;
  const step = (): void => {
    const img = document.querySelector("#fighter-carousel .fighter-card.active .fc-hero") as HTMLImageElement | null;
    if (!img || document.getElementById("menu")?.classList.contains("hidden")) return; // paused off the hub
    const [dir, f] = HUB_TURN[i % HUB_TURN.length];
    i++;
    img.src = `/sprites/skin_${skin}_${dir}_${f}.webp?v=${ASSET_VER}`;
  };
  step();
  hubAnimTimer = setInterval(step, 150);
}

let hubBrowseSkin = -1; // skin centred in the carousel (lazy-init to equipped)
let carouselBuilt = false;
const hubEquipped = (): number => Number(localStorage.getItem("bp_skin")) || 0;
const GEM_COUNT = (i: number): number => (i < 4 ? 2 : i < 6 ? 3 : i < 8 ? 4 : i < 10 ? 5 : 6);
const padNo = (n: number): string => String(n).padStart(3, "0");

/** Inner HTML for one collectible card (static pose; active card animates). */
function fighterCardHTML(skin: number): string {
  const r = rarityOf(skin);
  return (
    '<div class="fc-art"></div><div class="fc-ray"></div>' +
    `<img class="fc-hero" src="/sprites/skin_${skin}_down_1.webp?v=${ASSET_VER}" alt="" />` +
    '<div class="fc-holo"></div><div class="fc-scan"></div><div class="fc-gloss"></div><span class="fc-sheen"></span>' +
    '<div class="fc-frame"></div>' +
    '<span class="fc-corner tl"></span><span class="fc-corner tr"></span><span class="fc-corner bl"></span><span class="fc-corner br"></span>' +
    `<div class="fc-toprow"><span class="fc-rarity">${r.name.toUpperCase()}</span><span class="fc-no">${padNo(skin + 1)} / ${padNo(SKIN_COUNT)}</span></div>` +
    `<div class="fc-namerow"><div class="fc-name">${SKIN_NAMES[skin] ?? `Skin ${skin}`}</div><div class="fc-gems">${"◆".repeat(GEM_COUNT(skin))}</div></div>` +
    '<div class="fc-badge">◆</div>' +
    `<div class="fc-lock${skinOwned(skin) ? " hidden" : ""}">🔒</div>`
  );
}

function buildCarousel(): void {
  const wrap = document.getElementById("fighter-carousel");
  if (!wrap || carouselBuilt) return;
  for (let i = 0; i < SKIN_COUNT; i++) {
    const card = document.createElement("div");
    card.className = "fighter-card";
    card.dataset.skin = String(i);
    const r = rarityOf(i);
    card.style.setProperty("--tier", r.color);
    card.style.setProperty("--holo", String(i >= 8 ? 0.28 : i >= 6 ? 0.22 : 0.16));
    card.innerHTML = fighterCardHTML(i);
    card.addEventListener("click", () => { if (i !== hubBrowseSkin) showFighter(i, true); });
    wrap.appendChild(card);
  }
  carouselBuilt = true;
}

// 3D fan offsets by |distance from centre|.
const FAN = [
  { x: 0, z: 0, ry: 0, s: 1, op: 1 },
  { x: 250, z: -150, ry: 26, s: 0.84, op: 0.92 },
  { x: 432, z: -340, ry: 34, s: 0.66, op: 0.5 },
];
function layoutCarousel(active: number): void {
  const cards = document.querySelectorAll<HTMLElement>("#fighter-carousel .fighter-card");
  const n = SKIN_COUNT;
  const mobile = window.innerWidth < 760; // phones show only the active card
  cards.forEach((card) => {
    const i = Number(card.dataset.skin);
    let off = i - active;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    const a = Math.abs(off);
    card.classList.toggle("active", off === 0);
    if (a > 2 || (mobile && a > 0)) {
      card.style.opacity = "0";
      card.style.visibility = "hidden";
      card.style.pointerEvents = "none";
      return;
    }
    const sign = off < 0 ? -1 : 1;
    const f = FAN[a];
    card.style.visibility = "visible";
    card.style.transform =
      `translate(-50%, -50%) translateX(${sign * f.x}px) translateZ(${f.z}px) rotateY(${-sign * f.ry}deg) scale(${f.s})`;
    card.style.opacity = String(f.op);
    card.style.zIndex = String(10 - a);
    card.style.pointerEvents = off === 0 ? "none" : "auto";
  });
}

function renderFighterDots(active: number): void {
  const box = document.getElementById("fighter-dots");
  if (!box) return;
  box.innerHTML = "";
  for (let i = 0; i < SKIN_COUNT; i++) {
    const d = document.createElement("span");
    d.className = "fdot" + (i === active ? " on" : "");
    box.appendChild(d);
  }
}

/** Centre a fighter: fan, title, animate; optionally equip (owned only). */
function showFighter(skin: number, equip = false): void {
  hubBrowseSkin = skin;
  buildCarousel();
  layoutCarousel(skin);
  animateActiveHero(skin);
  renderFighterDots(skin);
  const r = rarityOf(skin);
  const nm = document.getElementById("fighter-bigname");
  if (nm) nm.textContent = SKIN_NAMES[skin] ?? `Skin ${skin}`;
  const ra = document.getElementById("fighter-bigrarity");
  if (ra) {
    ra.textContent = `${r.name.toUpperCase()} · ${padNo(skin + 1)} / ${padNo(SKIN_COUNT)}`;
    ra.style.color = r.color;
  }
  const av = document.getElementById("hub-passport-av") as HTMLImageElement | null;
  if (av) av.src = `/sprites/skin_${hubEquipped()}.webp?v=${ASSET_VER}`;
  if (equip && skinOwned(skin)) void doSelectSkin(skin);
}

function cycleFighter(delta: number): void {
  if (hubBrowseSkin < 0) hubBrowseSkin = hubEquipped();
  showFighter((hubBrowseSkin + delta + SKIN_COUNT) % SKIN_COUNT, true);
}
document.getElementById("fighter-prev")?.addEventListener("click", () => cycleFighter(-1));
document.getElementById("fighter-next")?.addEventListener("click", () => cycleFighter(1));
window.addEventListener("resize", () => { if (hubBrowseSkin >= 0) layoutCarousel(hubBrowseSkin); });

/** Refresh the hub fighter carousel (equipped character). */
function refreshHub(): void {
  buildCarousel();
  document.querySelectorAll<HTMLElement>("#fighter-carousel .fighter-card").forEach((card) => {
    card.querySelector(".fc-lock")?.classList.toggle("hidden", skinOwned(Number(card.dataset.skin)));
  });
  showFighter(hubEquipped(), false);
}
/** Update the level / XP progress bar from a profile (200 XP per level). */
function setProgress(level: number, xp: number): void {
  const box = document.getElementById("hub-progress");
  if (!box) return;
  box.classList.remove("hidden");
  const lv = document.getElementById("hub-level");
  if (lv) lv.textContent = String(level);
  const heroLv = document.getElementById("hub-hero-lvl");
  if (heroLv) heroLv.textContent = `LVL ${level}`;
  const fill = document.getElementById("hub-xpfill") as HTMLElement | null;
  if (fill) fill.style.width = `${Math.max(4, Math.min(100, ((xp % 200) / 200) * 100))}%`;
  const txt = document.getElementById("hub-xptext");
  if (txt) txt.textContent = `${xp % 200} / 200 XP`;
  syncChrome();
}
// --- friends ----------------------------------------------------------------
let lastFriends: FriendsData = { friends: [], incoming: [], outgoing: [] };
const friendsModal = () => document.getElementById("friends-modal");
const friendsModalOpen = (): boolean => !friendsModal()?.classList.contains("hidden");

/** Where am I right now (for presence shown to friends). */
function currentPresence(): { room: string; status: string } {
  if (!document.getElementById("game")?.classList.contains("hidden")) return { room: state.roomCode, status: "game" };
  if (!document.getElementById("room")?.classList.contains("hidden")) return { room: state.roomCode, status: "lobby" };
  return { room: "", status: "menu" };
}

/** Poll friends + beat presence; refresh the hub module and the modal if open. */
function friendsBeat(): void {
  if (!loadWallet()) {
    renderFriendsModule();
    return;
  }
  const { room, status } = currentPresence();
  void fetchFriends(room, status).then((d) => {
    lastFriends = d;
    renderFriendsModule();
    if (friendsModalOpen()) renderFriendsModal();
  });
}

function renderFriendsModule(): void {
  const count = document.getElementById("hub-friends-count");
  const sub = document.getElementById("hub-friends-sub");
  if (!count || !sub) return;
  if (!loadWallet()) {
    count.textContent = "";
    sub.textContent = "Connect a wallet to add friends";
    return;
  }
  const online = lastFriends.friends.filter((f) => f.online).length;
  const reqs = lastFriends.incoming.length;
  count.textContent = online > 0 ? `· ${online} online` : "";
  sub.textContent = reqs
    ? `${reqs} friend request${reqs > 1 ? "s" : ""} ▸`
    : lastFriends.friends.length
      ? `${lastFriends.friends.length} friends ▸`
      : "Add friends & play together ▸";
}

function renderFriendsModal(): void {
  const reqBox = document.getElementById("friends-requests")!;
  const listBox = document.getElementById("friends-list")!;
  const empty = document.getElementById("friends-empty")!;
  reqBox.innerHTML = "";
  listBox.innerHTML = "";
  // Incoming requests first.
  for (const r of lastFriends.incoming) {
    const row = el("div", "friend-row", "");
    row.append(el("span", "friend-name", r.name));
    const accept = document.createElement("button");
    accept.className = "primary friend-mini";
    accept.textContent = "✓ Accept";
    accept.addEventListener("click", () => void acceptFriend(r.wallet).then(friendsBeat));
    const decline = document.createElement("button");
    decline.className = "ghost friend-mini";
    decline.textContent = "✕";
    decline.title = "Decline";
    decline.addEventListener("click", () => void removeFriend(r.wallet).then(friendsBeat));
    row.append(accept, decline);
    reqBox.appendChild(row);
  }
  // Accepted friends — online first.
  const friends = [...lastFriends.friends].sort((a, b) => Number(b.online) - Number(a.online));
  for (const f of friends) {
    const row = el("div", "friend-row", "");
    const dot = el("span", "friend-dot" + (f.online ? " on" : ""), "");
    row.append(dot, el("span", "friend-name", f.name));
    if (f.room) {
      const join = document.createElement("button");
      join.className = "primary friend-mini";
      join.textContent = "Join";
      join.addEventListener("click", () => {
        friendsModal()?.classList.add("hidden");
        const name = (localStorage.getItem("bp_nick") || "pumper").trim();
        practiceMode = false;
        track("play_start", { mode: "friend_join" });
        void connect(() => joinRoom(name, f.room, randSkin()));
      });
      row.append(join);
    } else {
      row.append(el("span", "friend-state", f.online ? "online" : "offline"));
    }
    const rm = document.createElement("button");
    rm.className = "ghost friend-mini";
    rm.textContent = "✕";
    rm.title = "Remove friend";
    rm.addEventListener("click", () => void removeFriend(f.wallet).then(friendsBeat));
    row.append(rm);
    listBox.appendChild(row);
  }
  empty.classList.toggle("hidden", lastFriends.friends.length > 0 || lastFriends.incoming.length > 0);
}

/** The hub leaderboard board currently shown (switched in-place via the tabs). */
let hubBoard: "rating" | "tokens" | "chips" = "rating";
/** The local player's latest profile (for the "you" row + own stats). */
let myProfile: ProfileData | null = null;
/** Populate the hub's inline leaderboard from the live board (no screen change). */
function loadHubTop(): void {
  const board = hubBoard;
  void fetchLeaderboard(board)
    .then((rows) => {
      if (board !== hubBoard) return; // a newer tab click superseded this fetch
      const ol = document.getElementById("hub-top");
      if (!ol) return;
      ol.innerHTML = "";
      if (!rows.length) {
        ol.innerHTML = '<li class="hub-mod-sub">No ranked players yet</li>';
        return;
      }
      const val = (p: ProfileData): string => {
        if (board === "tokens") return `💎 ${Math.round((p.tokens_won ?? 0) / 10 ** TOKEN_DECIMALS).toLocaleString()}`;
        if (board === "chips") return `🪙 ${(p.chips_won ?? 0).toLocaleString()}`;
        return (p.rating ?? 0).toLocaleString();
      };
      const myWallet = loadWallet()?.address ?? "";
      const row = (p: ProfileData, rank: number, isMe: boolean): HTMLLIElement => {
        const li = document.createElement("li");
        if (isMe) li.className = "me";
        li.innerHTML =
          `<span class="rk">${rank}</span>` +
          `<span class="nm"></span><span class="lv">LV ${p.level ?? 1}</span><span class="rt"></span>`;
        (li.querySelector(".nm") as HTMLElement).textContent = (p.name || "anon") + (isMe ? " (you)" : "");
        (li.querySelector(".rt") as HTMLElement).textContent = val(p);
        if (p.wallet) {
          li.style.cursor = "pointer";
          li.title = "View profile";
          li.addEventListener("click", () => void openPublicProfile(p.wallet));
        }
        return li;
      };
      const top = rows.slice(0, 5);
      top.forEach((p, i) => ol.appendChild(row(p, i + 1, p.wallet === myWallet)));
      // If you're signed in but not in the top, append your own row so you always
      // see yourself + your standing.
      if (myWallet && myProfile && !top.some((p) => p.wallet === myWallet)) {
        const idx = rows.findIndex((p) => p.wallet === myWallet);
        ol.appendChild(row(myProfile, idx >= 0 ? idx + 1 : rows.length + 1, true));
      }
    })
    .catch(() => {});
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
  // Top-nav (desktop) + brand logo — reuse the existing screen handlers.
  const click = (id: string): void => document.getElementById(id)?.click();
  document.getElementById("brand-logo")?.addEventListener("click", () => showScreen("menu"));
  document.getElementById("nav-home")?.addEventListener("click", () => showScreen("menu"));
  document.getElementById("nav-arena")?.addEventListener("click", () => click("open-play"));
  document.getElementById("nav-shop")?.addEventListener("click", () => click("open-shop"));
  document.getElementById("nav-ranks")?.addEventListener("click", () => click("open-leaderboard"));
  document.getElementById("open-profile")!.addEventListener("click", () => void openProfile());
  document.getElementById("open-leaderboard")?.addEventListener("click", () => { lbBoard = "rating"; void openLeaderboard(); });
  // Hub inline leaderboard tabs: switch board, refresh the list in place.
  document.getElementById("hub-lb-tabs")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-board]");
    if (!btn) return;
    hubBoard = (btn.dataset.board as "rating" | "tokens" | "chips") ?? "rating";
    for (const b of document.querySelectorAll("#hub-lb-tabs .seg-btn")) b.classList.remove("active");
    btn.classList.add("active");
    loadHubTop();
  });
  document.getElementById("open-skins")?.addEventListener("click", () => openSkinShop("menu"));
  // Rail SHOP button opens the character shop (full screen).
  document.getElementById("open-shop")?.addEventListener("click", () => openSkinShop("menu"));
  // Shop filter chips switch which skins the grid shows.
  document.querySelectorAll<HTMLElement>(".shop-filter").forEach((b) =>
    b.addEventListener("click", () => {
      shopFilter = (b.dataset.filter as ShopFilter) || "all";
      document.querySelectorAll(".shop-filter").forEach((x) => x.classList.toggle("active", x === b));
      renderShopGrid();
    }),
  );
  document.getElementById("shop-back")!.addEventListener("click", () => {
    showScreen(shopReturn); // back to the hub or the lobby room we came from
    refreshHub(); // reflect a newly equipped character on the hub
    // Owned skins may have changed — refresh the lobby strip if we're in a room.
    const w = loadWallet();
    if (w) {
      void fetchProfile(w.address).then((p) => {
        setLobbySkins(p.skins ?? DEFAULT_SKINS, p.level ?? 1);
        if (!document.getElementById("room")?.classList.contains("hidden")) renderRoom(state);
      });
    }
  });
  document.getElementById("profile-back")!.addEventListener("click", () => showScreen("menu"));
  document.getElementById("leaderboard-back")!.addEventListener("click", () => showScreen("menu"));
  document.getElementById("lb-rating")!.addEventListener("click", () => { lbBoard = "rating"; void openLeaderboard(); });
  document.getElementById("lb-tokens")!.addEventListener("click", () => { lbBoard = "tokens"; void openLeaderboard(); });
  document.getElementById("lb-chips")!.addEventListener("click", () => { lbBoard = "chips"; void openLeaderboard(); });

  // Friends module → modal.
  document.getElementById("hub-friends")?.addEventListener("click", () => {
    if (!loadWallet()) {
      setMenuStatus("Connect a wallet to add friends");
      return;
    }
    document.getElementById("friends-status")!.textContent = "";
    friendsModal()!.classList.remove("hidden");
    friendsBeat();
  });
  document.getElementById("friends-close")?.addEventListener("click", () =>
    friendsModal()!.classList.add("hidden"),
  );
  const doAddFriend = (): void => {
    const inp = document.getElementById("friend-add-name") as HTMLInputElement;
    const name = inp.value.trim();
    const status = document.getElementById("friends-status")!;
    if (name.length < 2) return;
    status.textContent = "Sending…";
    void addFriend(name).then((r) => {
      if (r.error === "not_found") status.textContent = "No player with that nickname.";
      else if (r.error === "self") status.textContent = "You can't add yourself 🙂";
      else if (r.result === "already") status.textContent = "Already added / request pending.";
      else status.textContent = `Request sent to ${name} ✅`;
      inp.value = "";
      friendsBeat();
    });
  };
  document.getElementById("friend-add-btn")?.addEventListener("click", doAddFriend);
  document.getElementById("friend-add-name")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") doAddFriend();
  });
}

// --- background video -----------------------------------------------------

// TEMP: plain black background across the in-app screens (no video). Flip back
// to true to restore the gamebg boomerang loop everywhere.
const BG_VIDEO_ENABLED = false;

function setupBackground(): void {
  const v = document.getElementById("bg-video") as HTMLVideoElement;
  const bg = document.getElementById("bg");
  if (!BG_VIDEO_ENABLED) {
    // Static blurred splash-art across the in-app screens (the SHARP version of
    // the same art is the backdrop of the #splash entry screen).
    v.removeAttribute("src");
    v.style.display = "none";
    bg?.classList.add("art");
  } else {
    // Global app background = gamebg.mp4. The file is baked as a boomerang
    // (forward + reversed), so the element's native `loop` gives a smooth
    // ping-pong (no laggy JS reverse-seek). ?v= busts the cache when the file is
    // replaced under the same name; a gradient shows until the first frame is ready.
    const sources = [`/bg/gamebg.mp4?v=${ASSET_VER}`];
    let i = 0;
    const tryNext = () => {
      if (i >= sources.length) return; // no bg; gradient stays
      v.src = sources[i++];
    };
    v.addEventListener("canplay", () => v.classList.add("ready"));
    v.addEventListener("error", tryNext);
    tryNext();
  }

  // The OLD menu video is the backdrop for the splash entry screen only.
  const sv = document.getElementById("splash-video") as HTMLVideoElement | null;
  if (sv) {
    sv.src = `/bg/menu.mp4?v=${ASSET_VER}`;
    sv.poster = `/bg/menu-poster.webp?v=${ASSET_VER}`;
    sv.addEventListener("canplay", () => sv.classList.add("ready"));
  }
}

// --- bootstrap ------------------------------------------------------------

// Multi-region: probe and hop to the nearest server (no-op with <2 regions).
// Skipped inside Telegram — the Mini App is bound to one URL; redirecting away
// would break it.
if (!isTelegram) void selectRegion();
initTelegram();
// Register the service worker (PWA) with SMART auto-update: a fresh deploy is
// picked up automatically (polled + on focus) and applied SILENTLY — but only
// while on a menu/lobby, NEVER mid-match (a forced reload interrupts taps in a
// fight). So you always get the latest build without ever clearing cache, and
// without a reload yanking you out of a game.
let swUpdateReady = false;
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, reg) {
    if (!reg) return;
    // Proactively check for a new deploy so updates land without an app restart.
    setInterval(() => void reg.update().catch(() => {}), 60_000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void reg.update().catch(() => {});
        maybeApplySWUpdate();
      }
    });
  },
  onNeedRefresh() {
    swUpdateReady = true;
    maybeApplySWUpdate();
  },
});

// Apply a pending update at a safe moment (not in a match / result screen).
function maybeApplySWUpdate(): void {
  if (!swUpdateReady) return;
  if (inGame(state.phase) || onResultScreen()) return; // wait until back on a menu
  void updateSW(true); // skipWaiting + reload with the fresh build
}
setInterval(maybeApplySWUpdate, 15_000); // catch the case where the update arrived mid-match

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

/** Fallback level payout % (our fixed design) when the server hasn't replied. */
const REF_LEVEL_PCT = [10, 5, 3, 2, 1];

/** Full-screen Invite & Earn hub: KPIs · share · how-it-works · tree · estimate. */
async function openReferral(): Promise<void> {
  const w = loadWallet();
  showScreen("referral");
  const linkEl = document.getElementById("ref-link") as HTMLElement;
  linkEl.textContent = w ? referralLink() : "Connect a wallet to get your link";
  const kpis = document.getElementById("ref-kpis")!;
  const tree = document.getElementById("ref-tree")!;
  const levelsEl = document.getElementById("ref-levels")!;
  const empty = document.getElementById("ref-empty")!;
  const kpi = (label: string, val: string, cls = ""): string =>
    `<div class="ref-kpi ${cls}"><span class="ref-kpi-v">${val}</span><span class="ref-kpi-l">${label}</span></div>`;

  // How-it-works level breakdown renders immediately (even without a wallet).
  const renderLevels = (pcts: number[], counts: number[]): void => {
    levelsEl.innerHTML = pcts
      .map(
        (pct, i) =>
          `<div class="ref-level"><span class="ref-level-n">L${i + 1}</span>` +
          `<span class="ref-level-pct">${pct}% of rake</span>` +
          `<span class="ref-level-cnt">${counts.length ? `${(counts[i] ?? 0).toLocaleString()} 👤` : ""}</span></div>`,
      )
      .join("");
  };

  if (!w) {
    kpis.innerHTML = kpi("Earned", "—", "token") + kpi("Direct refs", "—") + kpi("Network", "—");
    tree.innerHTML = '<p class="ref-empty">Connect a wallet to get your invite link and start earning.</p>';
    empty.classList.add("hidden");
    renderLevels(REF_LEVEL_PCT, []);
    calcRakePct = 0;
    updateCalc();
    return;
  }

  // Optimistic render, then fill from the server.
  kpis.innerHTML = kpi("Earned", "…", "token") + kpi("Direct refs", "…") + kpi("Network", "…");
  renderLevels(REF_LEVEL_PCT, []);
  const s = await fetchReferralStats(w.address);
  if (document.getElementById("referral")?.classList.contains("hidden")) return; // left already
  const pcts = (s.levels ?? []).length ? s.levels : REF_LEVEL_PCT;
  const network = s.network ?? [];
  const net = network.reduce((a, b) => a + b, 0);
  kpis.innerHTML =
    kpi("Earned", `💎 ${s.earned.toLocaleString()}`, "token") +
    kpi("Direct refs", s.direct.toLocaleString()) +
    kpi("Network", net.toLocaleString());
  renderLevels(pcts, network);
  // Network panel: per-level bars (your downline). Empty state when nobody yet.
  if (net === 0 && s.direct === 0) {
    tree.innerHTML = "";
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    const max = Math.max(1, ...network);
    tree.innerHTML = pcts
      .map((_pct, i) => {
        const c = network[i] ?? 0;
        return (
          `<div class="ref-treerow"><span class="ref-treelvl">L${i + 1}</span>` +
          `<div class="ref-treebar"><div class="ref-treefill" style="width:${(c / max) * 100}%"></div></div>` +
          `<span class="ref-treecnt">${c.toLocaleString()}</span></div>`
        );
      })
      .join("");
  }
  calcRakePct = s.rakePct ?? 0;
  calcL1Pct = pcts[0] ?? 10;
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

const attribution = captureAttribution(); // first-touch utm/referrer/landing
initAnalytics({ platform: isTelegram ? "telegram" : "web", ...attribution });
startPresence();
initErrorTracking();
refreshHub(); // hero art + Loadout label
loadHubTop(); // "Top this week" module
setInterval(loadHubTop, 60_000);
friendsBeat(); // friends list + presence beat
setInterval(friendsBeat, 15_000);
track("app_loaded", { platform: isTelegram ? "telegram" : "web", ...attribution });
input.attach();
void assets.preload();
applySettings();
wireSettings();
wireNickname();
wireWallet();
wireMenuLinks();
wireBank();
setProfileHandler((p) => openPlayerCard(p));
setKickHandler((playerId) => net.sendKick(playerId));
// Lobby character strip: pick an OWNED skin (applies this match + becomes your
// default); tapping a LOCKED skin opens the SHOP to unlock it.
setSkinSelectHandler((skin) => {
  net.sendSkin(skin); // applies this match (server dedupes)
  localStorage.setItem("bp_skin", String(skin)); // also your default everywhere
  refreshHub();
});
setShopHandler(() => openSkinShop("room"));

// --- Lobby chat -------------------------------------------------------------
let chatReadyAt = 0;
const chatInput = document.getElementById("chat-input") as HTMLInputElement | null;
function addChatMessage(playerId: number, text: string): void {
  const log = document.getElementById("chat-log");
  if (!log) return;
  log.querySelector(".chat-empty")?.remove();
  const row = document.createElement("div");
  row.className = "chat-msg" + (playerId === state.myId ? " me" : "");
  const who = document.createElement("b");
  who.textContent = state.nameOf(playerId) + ":";
  row.appendChild(who);
  // textContent (not innerHTML) — never render player text as HTML.
  row.appendChild(document.createTextNode(" " + text));
  log.appendChild(row);
  while (log.childElementCount > 60) log.firstElementChild?.remove();
  log.scrollTop = log.scrollHeight;
}
chatInput?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = chatInput.value.trim();
  if (!text) return;
  if (performance.now() < chatReadyAt) return; // client-side anti-spam
  chatReadyAt = performance.now() + 800;
  net.sendChat(text);
  chatInput.value = "";
});
// While the lobby ready-countdown is running, refresh the waiting room once a
// second so the "Starting in Ns" ticks down (the server broadcasts it once).
setInterval(() => {
  if (state.lobbyCountdownLeft() > 0 && !document.getElementById("room")?.classList.contains("hidden")) {
    renderRoom(state);
  }
}, 1000);
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
document.getElementById("referral-back")?.addEventListener("click", () => showScreen("menu"));
document.getElementById("ref-copy")?.addEventListener("click", () => {
  if (!loadWallet()) return setMenuStatus("Connect a wallet to get your link");
  void navigator.clipboard?.writeText(referralLink());
  setMenuStatus("Invite link copied ✅");
});
document.getElementById("ref-share")?.addEventListener("click", () => {
  if (!loadWallet()) return setMenuStatus("Connect a wallet to get your link");
  const url = referralLink();
  if (navigator.share) void navigator.share({ title: "BomberMeme.fun", text: shareText(), url });
  else {
    void navigator.clipboard?.writeText(`${shareText()} ${url}`);
    setMenuStatus("Invite copied ✅");
  }
});
document.getElementById("ref-share-x")?.addEventListener("click", () => {
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(referralLink())}`;
  window.open(intent, "_blank", "noopener");
});
document.getElementById("ref-share-tg")?.addEventListener("click", () => {
  const u = `https://t.me/share/url?url=${encodeURIComponent(referralLink())}&text=${encodeURIComponent(shareText())}`;
  window.open(u, "_blank", "noopener");
});
for (const id of ["calc-refs", "calc-matches", "calc-stake"]) {
  document.getElementById(id)?.addEventListener("input", updateCalc);
}
setupBackground();

// Live token→USD price for the in-game $ converter (refresh every 60s).
function refreshPrice(): void {
  void fetchPrice().then((usd) => {
    tokenUsd = usd;
    setTokenUsd(usd); // re-renders the lobby browser
    // These were likely rendered BEFORE the price loaded, leaving $ blank — redraw
    // them now that we have a rate: the token-balance badge ≈$ and the room prize.
    setTokenBadge(lastTokens);
    if (!document.getElementById("room")?.classList.contains("hidden")) renderRoom(state);
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
    track("play_start", { mode: "create", stake: c.stake, currency: c.currency, public: c.isPublic });
    connect(() => createRoom(c.name, c.skin, c.stake, c.currency, c.isPublic));
  },
  practice: (c, difficulty, bots, competitive, sandbox, coop) => {
    practiceMode = true;
    practiceCompetitive = competitive;
    track("play_start", { mode: competitive ? "competitive_bots" : coop ? "sandbox_coop" : "sandbox", difficulty, bots });
    // Solo auto-starts (COUNTDOWN → game screen). Co-op waits in the room lobby
    // so you can invite a friend, then the host presses Start.
    connect(() => practiceRoom(c.name, c.skin, difficulty, bots, competitive, competitive ? null : sandbox, competitive ? false : coop));
  },
});

// --- Main-menu entry points -------------------------------------------------
const createModal = document.getElementById("create-modal")!;
function closeModals(): void {
  createModal.classList.add("hidden");
}
/** Open the full-screen lobby browser and load the room list. */
function openLobby(): void {
  showScreen("lobby");
  void loadTables();
}
// PLAY ONLINE lands straight on the full-screen lobby browser.
document.getElementById("open-play")!.addEventListener("click", openLobby);
// Train vs bots opens the full-screen Training Setup screen.
document.getElementById("open-practice")!.addEventListener("click", () => showScreen("training"));
document.getElementById("train-back")!.addEventListener("click", () => showScreen("menu"));
document.getElementById("lobby-back")!.addEventListener("click", () => showScreen("menu"));

// Create Lobby → the create-only settings modal (chips or token).
document.getElementById("tables-new")!.addEventListener("click", () => {
  createModal.classList.remove("hidden");
});

// --- Bento cards: Casual (chip stakes) + The Arena (real-token stakes) -------
const lobbyName = (): string =>
  (document.getElementById("nickname") as HTMLInputElement | null)?.value.trim() || "pumper";
// Use the player's equipped character (Loadout) for every match; random only if
// none chosen yet. (The lobby room still lets you override per-match via SET_SKIN.)
const randSkin = (): number => {
  const s = Number(localStorage.getItem("bp_skin"));
  return Number.isInteger(s) && s >= 0 && s < SKIN_COUNT ? s : Math.floor(Math.random() * SKIN_COUNT);
};

// Casual: pick a chip stake to instantly matchmake (join any open table at that
// stake, else open one). The chips are always visible — no extra click.
const casualStakes = document.getElementById("casual-stakes")!;
const casualJoin = (stake: number): void => {
  if (!walletGate(stake)) return;
  practiceMode = false;
  track("play_start", { mode: "quickplay", stake });
  void connect(() => quickplay(lobbyName(), randSkin(), stake));
};
for (const s of BET_SIZES.map((v) => ({ v, label: `🪙${v}` }))) {
  const b = document.createElement("button");
  b.className = "bento-chip";
  b.textContent = s.label;
  b.addEventListener("click", () => casualJoin(s.v));
  casualStakes.appendChild(b);
}
// "Quick Match" instantly drops you into ANY open free match (or opens one).
document.getElementById("casual-quick")!.addEventListener("click", () => casualJoin(0));

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
  practiceMode = false; // joining a real room — "Back to lobby", not "Play again"
  track("play_start", { mode: "join" });
  void connect(() => joinRoom(name, code, randSkin()));
});

// Modal dismissal: Cancel button + tap-the-backdrop (create modal).
document.getElementById("create-cancel")!.addEventListener("click", closeModals);
createModal.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModals();
});

/** Fetch + render the public rooms into the lobby browser. */
function loadTables(): Promise<void> {
  return fetchTables().then((tables) =>
    renderTables(
      tables,
      (code) => {
        const t = tables.find((x) => x.code === code);
        if (t && !walletGate(t.stake, t.currency)) return; // staked → needs wallet
        const name = (localStorage.getItem("bp_nick") || "pumper").trim();
        practiceMode = false; // real room → "Back to lobby", not "Play again"
        track("play_start", { mode: "table_join" });
        void connect(() => joinRoom(name, code, randSkin()));
      },
      (code) => {
        practiceMode = false;
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
// The proposal the local player has already voted on (so the Accept/Decline
// buttons don't reappear on the next tally update). Keyed by proposer:stake.
let votedProposalKey: string | null = null;

function onStakeVote(msg: {
  stake: number; by: number; msLeft: number; yes: number; total: number; closed: boolean; accepted: boolean;
}): void {
  const banner = document.getElementById("stake-vote")!;
  if (stakeVoteTimer) { clearInterval(stakeVoteTimer); stakeVoteTimer = null; }
  const key = `${msg.by}:${msg.stake}`;
  if (msg.closed) {
    banner.classList.add("hidden");
    document.getElementById("propose-picker")!.classList.add("hidden");
    votedProposalKey = null; // ready for the next proposal
    showBanner(msg.accepted ? `Stake raised to ${stakeSym()}${msg.stake.toLocaleString()}` : "Stake raise declined");
    return;
  }
  const deadline = Date.now() + msg.msLeft;
  const mine = msg.by === state.myId;
  const who = mine ? "You propose" : `${state.nameOf(msg.by)} proposes`;
  const render = (): void => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    // Show Accept/Decline only to non-proposers who haven't voted yet; once you
    // vote the buttons vanish and you just see the live tally.
    const canVote = !mine && votedProposalKey !== key;
    const voted = !mine && votedProposalKey === key;
    banner.innerHTML =
      `<div class="sv-text">${who} raising to <b>${stakeSym()}${msg.stake.toLocaleString()}</b> · ${left}s · ${msg.yes}/${msg.total} ✅${voted ? " · you voted ✓" : ""}</div>` +
      (canVote ? `<div class="sv-actions"><button id="sv-yes" class="primary">✅ Accept</button><button id="sv-no" class="ghost">❌ Decline</button></div>` : "");
    const vote = (accept: boolean): void => {
      net.sendVoteStake(accept);
      votedProposalKey = key; // remember so buttons don't return on the next update
      render(); // immediately drop the buttons, keep the tally visible
    };
    document.getElementById("sv-yes")?.addEventListener("click", () => vote(true));
    document.getElementById("sv-no")?.addEventListener("click", () => vote(false));
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

// Build both emote bars (lobby + in-game) from the shared EMOTES list. No
// client cooldown — spam away; reactions scatter so it looks fun.
function buildEmoteBar(id: string): void {
  const bar = document.getElementById(id);
  if (!bar) return;
  bar.innerHTML = "";
  EMOTES.forEach((e, i) => {
    const b = document.createElement("button");
    b.className = "emote-btn";
    b.textContent = e;
    b.addEventListener("click", () => {
      net.sendEmote(i);
      b.classList.remove("pop");
      void b.offsetWidth; // restart the press animation
      b.classList.add("pop");
    });
    bar.appendChild(b);
  });
}
buildEmoteBar("room-emotes");
buildEmoteBar("game-emotes");

/** Show a reaction: a bubble over the player in-game, plus a floating lobby pop.
 *  Lobby pops spawn at a random x with a little drift and rise up, so multiple
 *  reactions scatter across the screen instead of stacking in one place. */
function showEmote(playerId: number, emote: number): void {
  const e = EMOTES[emote] ?? "❓";
  renderer?.showEmote(playerId, e);
  if (!inGame(state.phase)) {
    const pop = document.createElement("div");
    pop.className = "emote-pop";
    pop.textContent = `${state.nameOf(playerId)} ${e}`;
    pop.style.left = `${12 + Math.random() * 70}%`; // scatter horizontally
    pop.style.setProperty("--drift", `${(Math.random() * 2 - 1) * 44}px`);
    document.getElementById("room")?.appendChild(pop);
    setTimeout(() => pop.remove(), 2200);
  }
}

/** True while the post-match result screen is showing (so we don't auto-leave it). */
function onResultScreen(): boolean {
  return document.getElementById("result")?.classList.contains("hidden") === false;
}

function leaveToMenu(): void {
  spectating = false;
  practiceMode = false; // don't carry "Play again" into the next game
  resetCharacterBrowse(); // next room starts on your current character
  document.getElementById("chat-log")?.replaceChildren(); // fresh chat next room
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
// "Change setup" (bots only): leave the practice room and reopen Training Setup.
document.getElementById("result-setup")?.addEventListener("click", () => {
  leaveToMenu();
  showScreen("training");
});
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

// Host toggles the lobby between public (listed/quick-matchable) and private.
document.getElementById("room-visibility")?.addEventListener("click", () => {
  if (!state.isHost) return;
  net.sendSetVisibility(!state.roomIsPublic);
});

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
  // Result card uses the in-match (deduped) skin; the profile card isn't in a
  // match, so use the equipped skin from the loadout.
  const equipped = Number(localStorage.getItem("bp_skin"));
  const skin =
    kind === "result"
      ? state.skinOf(state.myId)
      : Number.isInteger(equipped) && equipped >= 0
        ? equipped
        : state.skinOf(state.myId);
  const data: CardData = {
    kind, nickname: nick, skin, rating: lastRating,
    league: { emoji: lg.emoji, name: lg.name }, chips: lastChips ?? 0,
    refUrl: referralLink(), refCode: walletShort(),
  };
  if (kind === "result" && lastMatch) {
    data.placeText = lastMatch.draw ? "🤝 Draw" : lastMatch.won ? "🏆 1st place" : "💀 Knocked out";
    data.won = lastMatch.won;
    data.draw = lastMatch.draw;
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

// Splash entry screen: Enter game · Connect wallet (if none) · About → landing.
document.getElementById("splash-enter")?.addEventListener("click", () => {
  showScreen("menu");
  music("lobby");
});
document.getElementById("splash-connect")?.addEventListener("click", () => {
  document.getElementById("wallet-btn")?.click(); // reuse the connect flow
});
document.getElementById("splash-about")?.addEventListener("click", () => {
  window.open(LANDING_URL, "_blank", "noopener");
});

// Deep link: ?room=CODE auto-joins with the saved nick/skin.
const autoJoined = (function autoJoinFromUrl(): boolean {
  const code = new URLSearchParams(location.search).get("room");
  if (!code) return false;
  history.replaceState(null, "", location.pathname); // clean the URL
  const name = (localStorage.getItem("bp_nick") || `pumper${(Math.random() * 1000) | 0}`).trim();
  const skin = Number(localStorage.getItem("bp_skin") ?? 0);
  setMenuStatus(`Joining room ${code.toUpperCase()}…`);
  void connect(() => joinRoom(name, code.toUpperCase(), skin));
  return true;
})();

// UI click sound + kick music off the first user gesture (autoplay policy).
document.addEventListener("pointerdown", (e) => {
  const el = e.target as HTMLElement;
  if (el.closest("button") && !el.closest("#touch-controls")) assets.play("ui");
});
document.addEventListener("pointerdown", () => assets.playMusic(currentTrack), { once: true });

// Deep links jump straight in (connect() drives the screen); otherwise we open
// the main hub directly (the splash entry screen is disabled for now).
updateSplashButtons();
if (!autoJoined) showScreen("menu");
music("lobby");
requestAnimationFrame(frame);
