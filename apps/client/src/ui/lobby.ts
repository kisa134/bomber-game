import { PLAYER_COLORS, COLOR_NAMES, skinAvatar } from "../game/renderer.js";
import { ASSET_VER } from "../game/assets.js";
import { MIN_PLAYERS_TO_START, MAX_PLAYERS_PER_ROOM, BET_SIZES, TOKEN_BET_SIZES, SKIN_COUNT, DEFAULT_SKINS, PRACTICE_MAX_BOTS, DEFAULT_SANDBOX, type SandboxOpts } from "../net/protocol.js";

/** Which skins the local player owns (bitmask) + their level — for the lobby
 *  character strip (set from main after the profile loads). */
let ownedSkins = DEFAULT_SKINS;
export function setLobbySkins(owned: number, _level: number): void {
  ownedSkins = owned;
}
/** Select an owned skin (wired to net.sendSkin in main). */
let onSelectSkin: (skin: number) => void = () => {};
export function setSkinSelectHandler(fn: (skin: number) => void): void {
  onSelectSkin = fn;
}
/** Open the SHOP to buy a locked skin (wired in main). */
let onOpenShop: () => void = () => {};
export function setShopHandler(fn: () => void): void {
  onOpenShop = fn;
}

/** Character names by skin index — verified against the actual sprites. */
const SKIN_NAMES = ["Shiba", "Pepe", "Trump", "Musk", "Doge", "Pump", "Durov", "Vitalik", "Troll", "Bogdanoff", "Gigachad"];
const skinName = (skin: number): string => SKIN_NAMES[skin] ?? `Fighter ${skin + 1}`;

// Character stage: cycle the walk frames so the picked skin "runs on the spot"
// and turns down → right → up → left (a full circle) while you choose.
const TURN_FRAMES: Array<[dir: string, frame: number, flip: boolean]> = [
  ["down", 0, false], ["down", 1, false], ["down", 2, false],
  ["side", 0, false], ["side", 1, false], ["side", 2, false],
  ["up", 0, false], ["up", 1, false], ["up", 2, false],
  ["side", 0, true], ["side", 1, true], ["side", 2, true],
];
let skinAnimTimer: ReturnType<typeof setInterval> | null = null;
let skinAnimSkin = -1;
function animateSkin(skin: number): void {
  const hero = document.getElementById("skin-hero");
  if (!hero) return;
  let img = hero.querySelector("img") as HTMLImageElement | null;
  if (!img) {
    img = document.createElement("img");
    img.className = "skin-big";
    hero.innerHTML = "";
    hero.appendChild(img);
  }
  if (skin === skinAnimSkin && skinAnimTimer) return; // already running this skin
  skinAnimSkin = skin;
  if (skinAnimTimer) clearInterval(skinAnimTimer);
  let i = 0;
  const step = (): void => {
    if (!img || document.getElementById("room")?.classList.contains("hidden")) return; // paused off-screen
    const [dir, f, flip] = TURN_FRAMES[i % TURN_FRAMES.length];
    i++;
    img.src = `/sprites/skin_${skin}_${dir}_${f}.webp?v=${ASSET_VER}`;
    img.style.transform = flip ? "scaleX(-1)" : "none";
  };
  step();
  skinAnimTimer = setInterval(step, 150);
}

// --- Lobby character browser (arrows cycle ALL skins; owned = selected, locked
//     = dimmed + 🔒 with "Unlock in SHOP"). ----------------------------------
let browseSkin = -1; // currently-previewed skin (lazy-init to your current)
/** Reset the previewed character (e.g. when leaving a room). */
export function resetCharacterBrowse(): void {
  browseSkin = -1;
}
function renderCharacter(): void {
  if (browseSkin < 0) return;
  animateSkin(browseSkin);
  const owned = (ownedSkins & (1 << browseSkin)) !== 0;
  document.getElementById("skin-hero")?.classList.toggle("locked", !owned);
  document.getElementById("skin-lock")?.classList.toggle("hidden", owned);
  document.getElementById("skin-buy")?.classList.toggle("hidden", owned);
  const nm = document.getElementById("skin-name");
  if (nm) nm.textContent = skinName(browseSkin) + (owned ? "" : " 🔒");
}
function cycleBrowse(delta: number): void {
  if (browseSkin < 0) return;
  browseSkin = (browseSkin + delta + SKIN_COUNT) % SKIN_COUNT;
  if ((ownedSkins & (1 << browseSkin)) !== 0) onSelectSkin(browseSkin); // apply owned pick
  renderCharacter();
}

/** Live token price in USD / SOL + the chosen display unit, set from main. */
let tokenUsd = 0;
let tokenSol = 0;
let valueUnit: "usd" | "sol" = "usd";
export function setTokenUsd(usd: number, sol = 0, unit: "usd" | "sol" = "usd"): void {
  tokenUsd = usd;
  tokenSol = sol;
  valueUnit = unit;
  if (lastTables.length) drawTables(); // refresh ≈ values in the open browser
}
/** Current exchange rate as "1 $ ≈ N 💎" / "1 ◎ ≈ N 💎", or "" if unknown. */
function rateLine(): string {
  const sol = valueUnit === "sol";
  const rate = sol ? tokenSol : tokenUsd;
  if (!rate || rate <= 0) return "";
  const per = Math.round(1 / rate);
  return `1 ${sol ? "◎" : "$"} ≈ ${per.toLocaleString()} 💎`;
}

/** Whether a wallet is connected (set from main). Drives the 🔒 on staked tables. */
let hasWallet = false;
export function setWalletState(v: boolean): void {
  hasWallet = v;
  if (lastTables.length) drawTables(); // re-render locks if the browser is open
}

/** A player whose card can be opened from a lobby/result row. */
export interface CardPlayer {
  wallet?: string | null;
  name: string;
  skin: number;
}
/** How the room screen opens a player card (wired from main). */
let onOpenProfile: (p: CardPlayer) => void = () => {};
export function setProfileHandler(fn: (p: CardPlayer) => void): void {
  onOpenProfile = fn;
}
/** Host-only "kick this player" action (wired from main → net.sendKick). */
let onKick: (playerId: number) => void = () => {};
export function setKickHandler(fn: (playerId: number) => void): void {
  onKick = fn;
}
// Which player's kick ✕ is currently armed. Module-level so it SURVIVES the room
// re-rendering between the two taps (the old per-button dataset was wiped on every
// re-render, so the kick never completed).
let armedKickId = -1;
let armedKickTimer = 0;
// Signature of the last room render — skip rebuilding the DOM when nothing changed.
let lastRoomSig = "";
/* Match-length editing is disabled for now (fixed 3-min rounds); the protocol
   hook stays server-side until the in-lobby control is redesigned. */
/** Tapping an empty seat opens the friends list to invite someone (wired from main). */
let onInviteSeat: () => void = () => {};
export function setInviteSeatHandler(fn: () => void): void {
  onInviteSeat = fn;
}
function usdSuffix(tokens: number): string {
  if (tokens < 0) return "";
  const sol = valueUnit === "sol";
  const rate = sol ? tokenSol : tokenUsd;
  if (!rate) return "";
  const v = tokens * rate;
  const s = v >= 1 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v > 0 ? v.toPrecision(2) : "0.00";
  return sol ? ` ≈◎${s}` : ` ≈$${s}`;
}
import type { GameState } from "../game/state.js";
import type { TableInfo } from "../net/socket.js";

export type ScreenName =
  | "splash"
  | "loading"
  | "menu"
  | "settings"
  | "profile"
  | "leaderboard"
  | "shop"
  | "referral"
  | "lobby"
  | "training"
  | "room"
  | "game"
  | "result"
  | "tournaments"
  | "friends"
  | "campaign";
const SCREENS: ScreenName[] = [
  "splash",
  "loading",
  "menu",
  "settings",
  "profile",
  "leaderboard",
  "shop",
  "referral",
  "lobby",
  "training",
  "room",
  "game",
  "result",
  "tournaments",
  "friends",
  "campaign",
];

// ── "You're still in a room" affordance ─────────────────────────────────────
// In an ideal networked game you stay seated until you explicitly leave or get
// kicked — navigating the app must NOT drop your room. We keep the socket open
// (nav never closes it) and show a floating "Return to room" chip whenever you
// have an active room but are looking at another screen.
let activeRoomCode = ""; // "" = not in any room
let currentScreen: ScreenName = "splash";
function refreshReturnRoom(): void {
  const el = document.getElementById("return-room");
  if (!el) return;
  // Hide while actually in the room / mid-match / on the entry screens.
  const browsing = !["room", "game", "result", "splash", "loading", "campaign"].includes(currentScreen);
  const show = activeRoomCode !== "" && browsing;
  el.classList.toggle("hidden", !show);
  if (show) {
    const codeEl = el.querySelector(".rr-code");
    if (codeEl) codeEl.textContent = activeRoomCode;
  }
}
/** Called from main when you join/leave a room (sets or clears the active code). */
export function setActiveRoom(code: string): void {
  activeRoomCode = code;
  refreshReturnRoom();
}

export function showScreen(name: ScreenName): void {
  currentScreen = name;
  if (name === "room") lastRoomSig = ""; // force a fresh room render on (re)entry
  for (const id of SCREENS) {
    document.getElementById(id)?.classList.toggle("hidden", id !== name);
  }
  refreshReturnRoom();
  // Sync the top-nav highlight to the screen: HOME on the hub, ARENA in the
  // lobby/room (room search + waiting room), SHOP in the shop.
  const navFor: Partial<Record<ScreenName, string>> = { menu: "nav-home", lobby: "nav-arena", room: "nav-arena", shop: "nav-shop" };
  const navId = navFor[name];
  document.querySelectorAll(".hub-nav-link").forEach((a) => a.classList.toggle("active", a.id === navId));
  // Persistent top chrome (alpha notice + global status bar + XP): shown on every
  // screen — including the waiting room — except the in-game canvas (own HUD) and
  // the splash entry screen. (#room reserves --chrome-h top padding for it.)
  document.getElementById("chrome")?.classList.toggle("hidden", name === "game" || name === "splash" || name === "campaign");
  syncChrome();
  // Global background video runs everywhere except in-game (CPU/battery) and the
  // splash screen (which has its own video backdrop covering it).
  const bg = document.getElementById("bg");
  const video = document.getElementById("bg-video") as HTMLVideoElement | null;
  // The splash now uses the standard blurred background too (no separate video).
  const showBg = name !== "game" && name !== "campaign";
  if (bg) bg.style.display = showBg ? "" : "none";
  if (video) {
    if (showBg) void video.play().catch(() => {});
    else video.pause();
  }
  // The splash's own video plays only while the splash is up.
  const sv = document.getElementById("splash-video") as HTMLVideoElement | null;
  if (sv) {
    if (name === "splash") void sv.play().catch(() => {});
    else sv.pause();
  }
}
