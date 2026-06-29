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
  fetchPnl,
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
  inviteFriend,
  clearInvite,
  claimDaily,
  fetchTournaments,
  fetchTournament,
  tournamentAction,
  fetchAnnouncement,
  fetchIdentity,
  linkTelegramStart,
  oauthUrl,
  type TournamentInfo,
  type FriendsData,
  type ProfileData,
  type JoinResponse,
} from "./net/socket.js";
import { SERVER_HTTP } from "./config.js";
import { GameState } from "./game/state.js";
import { Renderer, PLAYER_COLORS, skinAvatar } from "./game/renderer.js";
import { Input } from "./game/input.js";
import { Assets, ASSET_VER } from "./game/assets.js";
import { loadSettings, saveSettings, type Settings, type ArenaTheme, type GfxPreset } from "./settings.js";
import {
  listWallets,
  connectAndSignIn,
  loadWallet,
  disconnectWallet,
  shortAddr,
  reauth,
  signAndSendBase64,
} from "./net/wallet.js";
import { setupMenu, setMenuStatus, showScreen, syncChrome, showResult, renderRoom, renderTables, setTokenUsd, setProfileHandler, setKickHandler, setInviteSeatHandler, setSkinSelectHandler, setShopHandler, setLobbySkins, resetCharacterBrowse, setWalletState, setActiveRoom, type ScreenName } from "./ui/lobby.js";
import { renderShareCard, VARIANT_COUNT, type CardData } from "./ui/shareCard.js";
import { initAdminMode } from "./ui/adminOverlay.js";
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
// Reliable per-match frag tally from the EVENT_KILL stream (snapshots are throttled,
// so the killing-blow frag is often missing from the last snapshot before MATCH_END).
const matchFrags = new Map<number, number>();
let toastUntil = 0;
let hudSig = "";
let prevMyLives = -1; // track HP to flash on damage
const prevLives = new Map<number, number>(); // per-player HP, to sfx wounds
let prevBombIds = new Set<number>(); // bomb ids last seen, to detect placements
let iGotFirstBlood = false; // did the local player take first blood this match
let myPickupStep = 0; // count of bonuses I've collected this match -> rising pickup pitch
let hitStopUntil = 0; // brief full-view freeze for kill impact (game feel)
let lastMatch: { won: boolean; draw: boolean; frags: number; earnText: string; ratingDelta: number; firstBlood: boolean; streak: number; xpFrom: number; xpTo: number; level: number } | null = null;
/** Append a match money-swing to the local PnL history (capped). c: 0=chips, 1=token. */
function recordPnl(c: number, n: number): void {
  try {
    const arr = JSON.parse(localStorage.getItem("bp_pnl") || "[]") as { t: number; c: number; n: number }[];
    arr.push({ t: Date.now(), c, n });
    while (arr.length > 150) arr.shift();
    localStorage.setItem("bp_pnl", JSON.stringify(arr));
  } catch {
    /* storage full / disabled — PnL chart just stays empty */
  }
}
/** Build the profile PnL line chart from local history, or null if too little data. */
/** Profit chart. Prefers cross-device server rows; falls back to local history. Token mode
 *  draws TWO lines (games + referrals); chip mode draws one. */
function buildPnlChart(serverRows?: PnlPoint[]): HTMLElement | null {
  let data: { currency: number; net: number; kind: number }[] = [];
  if (serverRows && serverRows.length) {
    data = serverRows.map((r) => ({ currency: Number(r.currency), net: Number(r.net), kind: Number(r.kind) }));
  } else {
    try {
      const arr = JSON.parse(localStorage.getItem("bp_pnl") || "[]") as { c: number; n: number }[];
      data = arr.map((e) => ({ currency: e.c, net: e.n, kind: 0 }));
    } catch {
      return null;
    }
  }
  if (data.length < 2) return null;
  const tokenMode = data.some((d) => d.currency === 1); // real-token PnL takes priority
  const pts = data.filter((d) => (tokenMode ? d.currency === 1 : d.currency === 0 && d.kind === 0));
  if (pts.length < 2) return null;
  const scale = tokenMode ? 10 ** TOKEN_DECIMALS : 1;
  let g = 0, r = 0;
  const gs: number[] = [], rs: number[] = [];
  for (const d of pts) {
    if (d.kind === 1) r += d.net; else g += d.net;
    gs.push(g / scale); rs.push(r / scale);
  }
  const hasRef = tokenMode && rs[rs.length - 1] !== 0;
  const all = hasRef ? [...gs, ...rs, 0] : [...gs, 0];
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || 1;
  const W = 320, H = 110, pad = 7;
  const px = (i: number, n: number): number => pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
  const py = (v: number): number => pad + (1 - (v - lo) / span) * (H - pad * 2);
  const path = (ys: number[]): string => ys.map((v, i) => `${i ? "L" : "M"}${px(i, ys.length).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const last = gs[gs.length - 1];
  const up = last >= 0;
  const gcol = up ? "#5fe08a" : "#ff6b6b";
  const z = py(0).toFixed(1);
  const sym = tokenMode ? "💎" : "🪙";
  const fmt = (v: number): string => (Math.abs(v) >= 1 ? Math.round(v).toLocaleString() : v.toFixed(2));
  const area = `${path(gs)} L${px(gs.length - 1, gs.length).toFixed(1)} ${py(lo).toFixed(1)} L${px(0, gs.length).toFixed(1)} ${py(lo).toFixed(1)} Z`;
  const card = el("div", "prof-card pnl-card", "");
  card.appendChild(el("div", "prof-card-h", `📈 Profit · ${pts.length} matches`));
  card.insertAdjacentHTML(
    "beforeend",
    `<div class="pnl-net ${up ? "up" : "down"}">${up ? "+" : "−"}${sym}${fmt(Math.abs(last))}</div>` +
      `<svg class="pnl-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">` +
      `<defs><linearGradient id="pnlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gcol}" stop-opacity="0.3"/><stop offset="1" stop-color="${gcol}" stop-opacity="0"/></linearGradient></defs>` +
      `<line x1="0" y1="${z}" x2="${W}" y2="${z}" stroke="rgba(255,255,255,0.14)" stroke-dasharray="3 3"/>` +
      `<path d="${area}" fill="url(#pnlg)"/>` +
      `<path d="${path(gs)}" fill="none" stroke="${gcol}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
      (hasRef ? `<path d="${path(rs)}" fill="none" stroke="#a06eff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : "") +
      `</svg>` +
      `<div class="pnl-legend"><span class="pnl-k game">● games</span>${hasRef ? '<span class="pnl-k ref">● referrals</span>' : ""}</div>` +
      `<div class="pnl-note">` +
      `Server rows if any, else local.` +
      `</div>`,
  );
  return card;
}

// ── helpers ─────────────────────────────────────────────────────────────────
function el(tag: string, cls: string, html: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}
function $(id: string) { return document.getElementById(id)!; }
function fmt(n: number) { return n.toLocaleString(); }
function short(n: number, dec = 2) {
  if (n >= 1e9) return (n / 1e9).toFixed(dec) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(dec) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(dec) + "k";
  return n.toFixed(dec);
}

// ── music / sfx ─────────────────────────────────────────────────────────────
const AUDIO = new Map<string, HTMLAudioElement>();
function music(track: "lobby" | "battle") {
  if (currentTrack === track) return;
  currentTrack = track;
  // stub — real implementation would crossfade tracks
}

// ── splash helpers ──────────────────────────────────────────────────────────
function updateSplashButtons() {
  const tgReturn = $("tg-wallet-return");
  if (tgReturn) tgReturn.classList.toggle("hidden", !isTelegram());
}

// ── main entry ──────────────────────────────────────────────────────────────
async function main() {
  initErrorTracking();
  initTelegram();
  initAnalytics();
  initAdminMode();

  setupMenu({
    onQuickplay: () => net.quickplay(settings.region),
    onPractice: () => net.practice(settings.sandbox),
    onCreate: () => net.createRoom(),
    onLeaderboard: () => { showScreen("leaderboard"); fetchLeaderboard("week").then(renderLeaderboard).catch(() => {}); },
    onProfile: () => { showScreen("profile"); loadProfile(); },
    onShop: () => { showScreen("shop"); loadShop(); },
    onWallet: () => connectWallet(),
    onHow: () => onHowTo(),
    onSettings: () => showScreen("settings"),
    onTournaments: () => { showScreen("tournaments"); loadTournaments(); },
    onFriends: () => { showScreen("friends"); loadFriends(); },
    onCampaign: () => startCampaignFromHub(),
    setStatus: (t) => setMenuStatus(t),
  });

  // Platform detection for touch controls
  if ("ontouchstart" in window) {
    $("touch-controls").classList.remove("hidden");
    input.setTouchMode(true);
  }

  // Telegram specific setup
  if (isTelegram()) {
    const startParam = getStartParam();
    if (startParam) handleDeepLink(startParam);
  }

  // Asset loading
  try {
    await assets.load();
    $("loading").classList.add("hidden");
    showScreen("menu");
    music("lobby");
  } catch (e) {
    console.error("Asset load failed:", e);
    $("loading").querySelector(".status")!.textContent = "Failed to load assets. Please refresh.";
  }

  // Start game loop
  requestAnimationFrame(frame);
}

// ── game loop ───────────────────────────────────────────────────────────────
let lastTime = 0;
function frame(time: number) {
  const dt = lastTime ? (time - lastTime) / 1000 : 0.016;
  lastTime = time;

  if (currentScreen === "game" && renderer) {
    // Update game state
    state.update(dt);
    input.update();

    // Send input to server
    const dir = input.getDirection();
    const dropBomb = input.getBombRequest();
    if (dir.x !== 0 || dir.y !== 0 || dropBomb) {
      net.sendInput(dir.x, dir.y, dropBomb);
    }

    // Render
    renderer.render(state, assets);

    // Update HUD
    updateHUD();
  }

  // Campaign mode check
  if (isCampaignRunning()) {
    // Campaign has its own game loop, don't interfere
  }

  requestAnimationFrame(frame);
}

// ── HUD update ──────────────────────────────────────────────────────────────
function updateHUD() {
  const me = state.getMe();
  if (!me) return;

  timerEl.textContent = formatTime(state.matchTimeRemaining);
  playersEl.textContent = `${state.aliveCount} / ${state.totalCount}`;

  // Sync killfeed
  while (killLines.length && Date.now() > killLines[0].until) killLines.shift();
  killfeedEl.innerHTML = killLines.map((k) => {
    const ke = state.getPlayer(k.killerId);
    const ve = state.getPlayer(k.victimId);
    return `<div class="kf-line"><span class="kf-killer">${ke?.nickname ?? "?"}</span> 💥 <span class="kf-victim">${ve?.nickname ?? "?"}</span></div>`;
  }).join("");

  // Toast
  if (toastUntil && Date.now() > toastUntil) {
    toastEl.classList.add("hidden");
    toastUntil = 0;
  }

  // Hit-stop effect
  if (hitStopUntil && Date.now() > hitStopUntil) {
    hitStopUntil = 0;
    document.body.style.filter = "none";
  }
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── wallet ──────────────────────────────────────────────────────────────────
async function connectWallet() {
  try {
    const wallets = await listWallets();
    if (wallets.length === 1) {
      await doConnect(wallets[0].name);
    } else {
      showScreen("wallet");
      setupWalletButtons();
    }
  } catch (e) {
    toast("Wallet connection failed: " + (e as Error).message);
  }
}

async function doConnect(walletName: string) {
  setMenuStatus("Connecting wallet…");
  try {
    const { wallet, signed } = await connectAndSignIn(walletName);
    if (wallet && signed) {
      setWalletState(true, shortAddr(wallet));
      identifyWallet(wallet);
      await net.auth(wallet, signed);
      await loadProfile();
      toast("Wallet connected!");
    }
  } catch (e) {
    toast("Connection failed: " + (e as Error).message);
  } finally {
    setMenuStatus("");
  }
}

function setupWalletButtons() {
  $("wallet-phantom")?.addEventListener("click", () => doConnect("phantom"));
  $("wallet-solflare")?.addEventListener("click", () => doConnect("solflare"));
  $("wallet-telegram")?.addEventListener("click", () => doConnect("telegram"));
  $("wallet-cancel")?.addEventListener("click", () => showScreen("menu"));
}

// ── profile ─────────────────────────────────────────────────────────────────
async function loadProfile() {
  try {
    const profile = await fetchProfile();
    if (!profile) return;
    renderProfile({
      nickname: profile.nickname,
      wallet: profile.wallet,
      level: profile.level,
      xp: profile.xp,
      xpMax: profile.xpMax,
      rating: profile.rating,
      wins: profile.wins,
      matches: profile.matches,
      frags: profile.frags,
      favoriteSkin: profile.favoriteSkin,
      pnlChart: buildPnlChart(),
    });
    setLobbySkins(profile.ownedSkinMask, profile.level);
  } catch (e) {
    console.error("loadProfile failed:", e);
  }
}

// ── shop ────────────────────────────────────────────────────────────────────
async function loadShop() {
  try {
    const profile = await fetchProfile();
    if (!profile) return;
    $("shop-chips").textContent = fmt(profile.chips);
    $("shop-tokens").textContent = short(profile.tokens);
    renderShopGrid(profile.ownedSkinMask);
  } catch (e) {
    console.error("loadShop failed:", e);
  }
}

function renderShopGrid(ownedMask: number) {
  const grid = $("shop-grid");
  grid.innerHTML = "";
  for (let s = 0; s < SKIN_COUNT; s++) {
    const owned = (ownedMask & (1 << s)) !== 0;
    const card = el("div", "shop-card" + (owned ? " owned" : ""), "");
    const av = document.createElement("img");
    av.className = "shop-avatar";
    av.src = skinAvatar(s);
    av.alt = `Skin ${s}`;
    const price = el("div", "shop-price", owned ? "Owned" : `🪙 ${SKIN_PRICES[s] ?? "—"}`);
    card.appendChild(av);
    card.appendChild(el("div", "shop-name", `Skin #${s}`));
    card.appendChild(price);
    if (!owned) {
      card.addEventListener("click", () => buySkinItem(s));
    }
    grid.appendChild(card);
  }
}

async function buySkinItem(skinId: number) {
  try {
    await buySkin(skinId);
    toast(`Skin #${skinId} purchased!`);
    await loadShop();
    await loadProfile();
  } catch (e) {
    toast("Purchase failed: " + (e as Error).message);
  }
}

// ── leaderboard ─────────────────────────────────────────────────────────────
function renderLeaderboard(rows: { nickname: string; rating: number; wins: number; matches: number }[]) {
  const tbody = $("lb-body");
  tbody.innerHTML = "";
  for (let i = 0; i < Math.min(rows.length, 100); i++) {
    const r = rows[i];
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="lb-rank">${i + 1}</td><td>${escapeHtml(r.nickname)}</td><td>${r.rating}</td><td>${r.wins}</td><td>${r.matches}</td>`;
    tbody.appendChild(tr);
  }
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ── tournaments ─────────────────────────────────────────────────────────────
async function loadTournaments() {
  try {
    const list = await fetchTournaments();
    const host = $("tour-screen-list");
    host.innerHTML = "";
    if (!list.length) {
      host.innerHTML = '<p class="status fair">No active tournaments.</p>';
      return;
    }
    for (const t of list) {
      const card = el("div", "tour-card", "");
      card.innerHTML = `<h4>${escapeHtml(t.name)}</h4><p>${escapeHtml(t.description)}</p>`;
      card.addEventListener("click", () => showTournamentDetail(t.id));
      host.appendChild(card);
    }
  } catch (e) {
    console.error("loadTournaments failed:", e);
  }
}

async function showTournamentDetail(id: string) {
  try {
    const t = await fetchTournament(id);
    if (!t) return;
    const detail = $("tour-detail");
    detail.innerHTML = `<h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.description)}</p>` +
      `<p>Prize: ${t.prize}</p><p>Starts: ${new Date(t.startTime).toLocaleString()}</p>` +
      `<button id="tour-register" class="primary glass-btn">Register</button>`;
    detail.classList.remove("hidden");
    $("tour-register")?.addEventListener("click", async () => {
      try {
        await tournamentAction(id, "register");
        toast("Registered for tournament!");
      } catch (e) {
        toast("Registration failed: " + (e as Error).message);
      }
    });
  } catch (e) {
    console.error("showTournamentDetail failed:", e);
  }
}

// ── friends ─────────────────────────────────────────────────────────────────
async function loadFriends() {
  try {
    const data = await fetchFriends();
    renderFriends(data);
  } catch (e) {
    console.error("loadFriends failed:", e);
  }
}

function renderFriends(data: FriendsData) {
  $("friends-status").textContent = "";
  const list = $("friends-list");
  list.innerHTML = "";
  if (!data.friends?.length) {
    $("friends-empty")?.classList.remove("hidden");
  } else {
    $("friends-empty")?.classList.add("hidden");
    for (const f of data.friends) {
      const row = el("div", "friend-row", "");
      row.innerHTML = `<span class="friend-name">${escapeHtml(f.nickname)}</span>` +
        `<span class="friend-status ${f.online ? "online" : "offline"}">${f.online ? "🟢" : "⚪"}</span>`;
      list.appendChild(row);
    }
  }

  // Requests
  const reqEl = $("friends-requests");
  reqEl.innerHTML = "";
  if (data.requests?.length) {
    for (const r of data.requests) {
      const row = el("div", "friend-request", "");
      row.innerHTML = `<span>${escapeHtml(r.nickname)}</span>` +
        `<button class="primary sm accept">Accept</button>` +
        `<button class="ghost sm decline">Decline</button>`;
      row.querySelector(".accept")?.addEventListener("click", () => handleAccept(r.nickname));
      row.querySelector(".decline")?.addEventListener("click", () => handleDecline(r.nickname));
      reqEl.appendChild(row);
    }
  }

  // Add friend
  $("friend-add-btn")?.addEventListener("click", async () => {
    const name = ($("friend-add-name") as HTMLInputElement).value.trim();
    if (!name) return;
    try {
      await addFriend(name);
      toast(`Friend request sent to ${name}`);
      ($("friend-add-name") as HTMLInputElement).value = "";
    } catch (e) {
      toast("Failed: " + (e as Error).message);
    }
  });
}

async function handleAccept(name: string) {
  try { await acceptFriend(name); toast(`Accepted ${name}`); loadFriends(); }
  catch (e) { toast("Failed: " + (e as Error).message); }
}
async function handleDecline(name: string) {
  try { await removeFriend(name); toast(`Declined ${name}`); loadFriends(); }
  catch (e) { toast("Failed: " + (e as Error).message); }
}

// ── toast ───────────────────────────────────────────────────────────────────
function toast(msg: string, duration = 3000) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  toastUntil = Date.now() + duration;
}

// ── deep link handling ──────────────────────────────────────────────────────
function handleDeepLink(param: string) {
  if (param.startsWith("room_")) {
    const code = param.slice(5);
    net.joinRoom(code);
  } else if (param.startsWith("tournament_")) {
    const id = param.slice(11);
    showScreen("tournaments");
    showTournamentDetail(id);
  }
}

// ── campaign ────────────────────────────────────────────────────────────────
let campaignStarted = false;

/** Launches World / Campaign mode from the hub. */
async function startCampaignFromHub(): Promise<void> {
  if (campaignStarted) return;
  const container = document.getElementById("campaign-wrap");
  if (!container) {
    toast("Campaign container not found");
    return;
  }
  campaignStarted = true;
  try {
    showScreen("campaign");
    const { startCampaign: sc } = await import("./campaign/main.js");
    await sc(container);
  } catch (e) {
    console.error("Campaign start failed:", e);
    toast("Campaign failed to start. Check console.");
    campaignStarted = false;
  }
}

function isCampaignRunning(): boolean {
  return campaignStarted;
}

// ── settings handlers ───────────────────────────────────────────────────────
function applyGfxPreset(p: GfxPreset) {
  settings.gfxPreset = p;
  saveSettings(settings);
  // renderer applies preset on next frame
}
function applyToggle(key: string, on: boolean) {
  (settings as any)[key] = on;
  saveSettings(settings);
}
function applyArenaTheme(t: ArenaTheme) {
  settings.arenaTheme = t;
  saveSettings(settings);
}
function applyFloorMode(m: "animated" | "texture") {
  settings.floorMode = m;
  saveSettings(settings);
}
function applyMode(m: "token" | "fiat") {
  settings.currencyMode = m;
  saveSettings(settings);
}
function applyLiteMode(on: boolean) {
  settings.liteMode = on;
  saveSettings(settings);
}

// Build settings screen
buildSettingsScreen({
  onGfxChange: applyGfxPreset,
  onToggle: applyToggle,
  onRegionChange: (r) => { settings.region = r; saveSettings(settings); },
  onNicknameChange: async (nick) => {
    try { await setNickname(nick); toast("Nickname updated!"); }
    catch (e) { toast("Failed: " + (e as Error).message); }
  },
  onArenaThemeChange: applyArenaTheme,
  onFloorChange: applyFloorMode,
  onModeChange: applyMode,
  onToggleLite: applyLiteMode,
  currentGfx: settings.gfxPreset,
  toggles: {
    "set-shake": settings.screenShake,
    "set-fullscreen": settings.fullscreen,
    "set-ambient": settings.ambient,
    "set-lite": settings.liteMode,
  },
  currentRegion: settings.region,
  nickname: settings.nickname,
  currentArena: settings.arenaTheme,
  currentFloor: settings.floorMode,
  currentMode: settings.currencyMode,
});

// ── resize handler ──────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  if (renderer) renderer.resize(window.innerWidth, window.innerHeight);
});

// ── presence ────────────────────────────────────────────────────────────────
startPresence();

// ── service worker ──────────────────────────────────────────────────────────
try {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm("New version available. Reload?")) updateSW(true);
    },
  });
} catch {
  // SW registration failed (non-HTTPS or unsupported)
}

// ── kick off ────────────────────────────────────────────────────────────────
// If the URL contains a room code or the Telegram start_param auto-joins,
// go directly to the game. Otherwise show splash → menu flow.
let autoJoined = false;
main();

// If the player has already entered before, or a
// wallet already connected) go straight to the hub. (Like top games.)
updateSplashButtons();
const returningVisitor = !!localStorage.getItem("bp_entered") || !!loadWallet();
if (!autoJoined) showScreen(returningVisitor ? "menu" : "splash");
music("lobby");
requestAnimationFrame(frame);

// ── Game mode dropdown handler ──────────────────────────────────────────────
// World/Campaign mode is selected from the game-mode dropdown (alongside
// Ranked Arena and Sandbox). The dropdown toggle + option clicks are wired
// here so the lobby module stays agnostic of campaign internals.
(() => {
  const dropdownBtn = document.getElementById("hub-gamemode");
  const dropdown = document.getElementById("gamemode-dropdown");
  if (!dropdownBtn || !dropdown) return;

  // Toggle dropdown visibility
  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target as Node) && e.target !== dropdownBtn) {
      dropdown.classList.add("hidden");
    }
  });

  // Handle mode selection
  dropdown.querySelectorAll<HTMLElement>(".gm-opt").forEach((opt) => {
    opt.addEventListener("click", async () => {
      const mode = opt.dataset.mode;
      dropdown.classList.add("hidden");

      // Update button label to reflect selected mode
      const label = opt.textContent?.trim() ?? "";
      dropdownBtn.innerHTML = `${label} <span class="hb-caret">▾</span>`;

      if (mode === "world") {
        // Launch World / Campaign mode
        await startCampaignFromHub();
      }
      // arena / sandbox are handled by the existing PLAY button logic
    });
  });
})();
