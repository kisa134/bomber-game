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
  | "tournaments";
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
  const browsing = !["room", "game", "result", "splash", "loading"].includes(currentScreen);
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
  document.getElementById("chrome")?.classList.toggle("hidden", name === "game" || name === "splash");
  syncChrome();
  // Global background video runs everywhere except in-game (CPU/battery) and the
  // splash screen (which has its own video backdrop covering it).
  const bg = document.getElementById("bg");
  const video = document.getElementById("bg-video") as HTMLVideoElement | null;
  // The splash now uses the standard blurred background too (no separate video).
  const showBg = name !== "game";
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

/** Measure the persistent chrome and expose its height so screens can pad below
 *  it. 0 when hidden (in-game) so the board uses the full viewport. */
export function syncChrome(): void {
  const chrome = document.getElementById("chrome");
  const h = chrome && !chrome.classList.contains("hidden") ? chrome.offsetHeight : 0;
  document.documentElement.style.setProperty("--chrome-h", h + "px");
}
if (typeof window !== "undefined") {
  window.addEventListener("resize", syncChrome);
}

export interface Choice {
  name: string;
  skin: number;
  stake: number;
  currency: number; // 0 = chips, 1 = token
  isPublic: boolean; // listed in the browser + quick-matchable (false = code-only)
}

export interface MenuHandlers {
  /** Create & open a new lobby at the chosen currency + stake. */
  create: (c: Choice) => void;
  /** Start a solo practice match vs N bots at a difficulty. `sandbox` carries the
   *  tuning for the Sandbox mode (ignored by Competitive). */
  practice: (
    c: Choice,
    difficulty: number,
    bots: number,
    competitive: boolean,
    sandbox: SandboxOpts,
    coop: boolean,
  ) => void;
}

/** Build a Choice from the current nickname + the equipped character (Loadout).
 *  Falls back to a random skin if none is chosen yet; the server still dedupes. */
function makeChoice(stake: number, currency = 0, isPublic = true): Choice {
  const nick = document.getElementById("nickname") as HTMLInputElement | null;
  const name = (nick?.value.trim() || "pumper").slice(0, 16);
  localStorage.setItem("bp_nick", name);
  const stored = Number(localStorage.getItem("bp_skin"));
  const skin =
    Number.isInteger(stored) && stored >= 0 && stored < SKIN_COUNT
      ? stored
      : Math.floor(Math.random() * SKIN_COUNT);
  return { name, skin, stake, currency, isPublic };
}

export function setupMenu(h: MenuHandlers): void {
  const nick = document.getElementById("nickname") as HTMLInputElement;
  nick.value = localStorage.getItem("bp_nick") ?? `pumper${(Math.random() * 1000) | 0}`;

  // --- Create-lobby modal: currency + visibility + stake picker --------------
  const stakeEl = document.getElementById("stake-picker")!;
  let createCurrency = 0;
  let createPublic = true; // 🌐 public (listed/quick-matchable) vs 🔒 private (code-only)
  const renderStakes = (): void => {
    const tiers =
      createCurrency === 1
        ? TOKEN_BET_SIZES.map((v) => ({ v, label: `💎${v.toLocaleString()}` }))
        : [{ v: 0, label: "🆓 Casual" }, ...BET_SIZES.map((v) => ({ v, label: `🪙${v}` }))];
    stakeEl.innerHTML = "";
    for (const s of tiers) {
      const b = document.createElement("button");
      b.className = "stake-btn";
      b.textContent = s.label;
      b.addEventListener("click", () => h.create(makeChoice(s.v, createCurrency, createPublic)));
      stakeEl.appendChild(b);
    }
  };
  renderStakes();

  const curChips = document.getElementById("cur-chips")!;
  const curToken = document.getElementById("cur-token")!;
  const setCurrency = (c: number): void => {
    createCurrency = c;
    curChips.classList.toggle("active", c === 0);
    curToken.classList.toggle("active", c === 1);
    renderStakes();
  };
  curChips.addEventListener("click", () => setCurrency(0));
  curToken.addEventListener("click", () => setCurrency(1));

  const visPublic = document.getElementById("vis-public");
  const visPrivate = document.getElementById("vis-private");
  const setVisibility = (pub: boolean): void => {
    createPublic = pub;
    visPublic?.classList.toggle("active", pub);
    visPrivate?.classList.toggle("active", !pub);
  };
  visPublic?.addEventListener("click", () => setVisibility(true));
  visPrivate?.addEventListener("click", () => setVisibility(false));

  // --- Training Setup: mode + difficulty + bot-count + sandbox tuning --------
  let diff = 1;
  let bots = 3;
  let competitive = false; // false = Practice Sandbox, true = Competitive Bots
  let coop = false; // sandbox co-op: team up with a friend vs the bots
  const sandbox: SandboxOpts = { ...DEFAULT_SANDBOX };
  const coopBtn = document.getElementById("coop-toggle");
  coopBtn?.addEventListener("click", () => {
    coop = !coop;
    coopBtn.classList.toggle("on", coop);
    refreshTrainMode(); // start button becomes "Create co-op lobby"
  });
  const segPick = (group: HTMLElement, btn: HTMLElement): void => {
    for (const el of group.querySelectorAll(".seg-btn")) el.classList.remove("active");
    btn.classList.add("active");
  };
  const rewardEl = document.getElementById("train-reward");
  const startBtn = document.getElementById("practice-play");

  // Stepper widget: clamps to [min,max], updates the value label + fill bar, and
  // writes back into `sandbox` (or the bot count) via an onSet callback.
  // min/max are read LIVE from the dataset (the bot cap changes with the mode).
  const paintStep = (id: string): void => {
    const root = document.getElementById(`${id}-step`);
    if (!root) return;
    const min = Number(root.dataset.min ?? 0);
    const max = Number(root.dataset.max ?? 10);
    const v = Number(document.getElementById(`${id}-val`)?.textContent ?? min);
    const fill = document.getElementById(`${id}-fill`);
    if (fill) fill.style.width = `${max > min ? ((v - min) / (max - min)) * 100 : 0}%`;
  };
  const wireStep = (id: string, get: () => number, set: (v: number) => void): void => {
    const root = document.getElementById(`${id}-step`);
    if (!root) return;
    const valEl = document.getElementById(`${id}-val`);
    const paint = (): void => {
      if (valEl) valEl.textContent = String(get());
      paintStep(id);
    };
    root.querySelectorAll<HTMLElement>(".step-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const min = Number(root.dataset.min ?? 0);
        const max = Number(root.dataset.max ?? 10);
        set(Math.max(min, Math.min(max, get() + Number(b.dataset.d))));
        paint();
      }),
    );
    // Drag (or click) anywhere on the track to set the value directly.
    const track = root.querySelector<HTMLElement>(".step-track");
    if (track) {
      track.style.cursor = "pointer";
      track.style.touchAction = "none";
      const setFromX = (clientX: number): void => {
        const min = Number(root.dataset.min ?? 0);
        const max = Number(root.dataset.max ?? 10);
        const r = track.getBoundingClientRect();
        const frac = r.width > 0 ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
        set(Math.round(min + frac * (max - min)));
        paint();
      };
      let dragging = false;
      track.addEventListener("pointerdown", (e) => {
        dragging = true;
        try { track.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        setFromX(e.clientX);
      });
      track.addEventListener("pointermove", (e) => { if (dragging) setFromX(e.clientX); });
      const stop = (): void => { dragging = false; };
      track.addEventListener("pointerup", stop);
      track.addEventListener("pointercancel", stop);
    }
    paint();
  };

  const refreshTrainMode = (): void => {
    if (rewardEl) {
      rewardEl.textContent = competitive
        ? "🟢 Tiny rewards ON · small XP + chips (no rating)"
        : "⚪ Rewards OFF · pure practice, nothing saved";
      rewardEl.className = "train-reward " + (competitive ? "on" : "off");
    }
    if (startBtn) {
      startBtn.textContent = competitive
        ? "▶ Start Competitive Match"
        : coop
          ? "👥 Create co-op lobby"
          : "▶ Start Sandbox";
    }
    // Sandbox-only panels (cheats + loadout) hide in Competitive.
    for (const el of document.querySelectorAll<HTMLElement>(".train-sandbox-only")) {
      el.classList.toggle("hidden", competitive);
    }
    // Competitive plays by fair rules: cap bots at 3 like a real 4-player match.
    const botStep = document.getElementById("bots-step");
    if (botStep) {
      const max = competitive ? 3 : PRACTICE_MAX_BOTS;
      botStep.dataset.max = String(max);
      if (bots > max) {
        bots = max;
        const v = document.getElementById("bots-val");
        if (v) v.textContent = String(bots);
      }
      paintStep("bots");
    }
  };
  const setMode = (m: string): void => {
    competitive = m === "competitive";
    document.getElementById("mode-sandbox")?.classList.toggle("active", !competitive);
    document.getElementById("mode-competitive")?.classList.toggle("active", competitive);
    refreshTrainMode();
  };
  document.getElementById("mode-sandbox")?.addEventListener("click", () => setMode("sandbox"));
  document.getElementById("mode-competitive")?.addEventListener("click", () => setMode("competitive"));

  const diffSeg = document.getElementById("diff-seg")!;
  diffSeg.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-diff]");
    if (!btn) return;
    diff = Number(btn.dataset.diff);
    segPick(diffSeg, btn);
  });

  // Steppers: bot count + starting loadout.
  wireStep("bots", () => bots, (v) => (bots = v));
  wireStep("startBombs", () => sandbox.startBombs, (v) => (sandbox.startBombs = v));
  wireStep("startPower", () => sandbox.startPower, (v) => (sandbox.startPower = v));
  wireStep("startSpeed", () => sandbox.startSpeed, (v) => (sandbox.startSpeed = v));

  // Toggles (rules) + chips (loadout utilities): flip a boolean on `sandbox`.
  const wireToggle = (sel: string): void => {
    for (const btn of document.querySelectorAll<HTMLElement>(sel)) {
      const opt = btn.dataset.opt as keyof SandboxOpts | undefined;
      if (!opt) continue;
      btn.classList.toggle("on", Boolean(sandbox[opt]));
      btn.addEventListener("click", () => {
        (sandbox[opt] as boolean) = !sandbox[opt];
        btn.classList.toggle("on", Boolean(sandbox[opt]));
      });
    }
  };
  wireToggle(".train-toggle");
  wireToggle(".train-chip");

  refreshTrainMode();
  document.getElementById("practice-play")!.addEventListener("click", () => {
    h.practice(makeChoice(0), diff, bots, competitive, sandbox, coop);
  });

  // Lobby character arrows + "unlock in SHOP" (wired once).
  document.getElementById("skin-prev")?.addEventListener("click", () => cycleBrowse(-1));
  document.getElementById("skin-next")?.addEventListener("click", () => cycleBrowse(1));
  document.getElementById("skin-buy")?.addEventListener("click", () => onOpenShop());
}

/** Currency-category filter for the public tables browser. */
type TableFilter = "all" | "casual" | "arena" | "open";
let tableFilter: TableFilter = "all";
/** Sort order for the browser (dropdown). */
type TableSort = "pot" | "stake" | "players" | "open";
let tableSort: TableSort = "pot";
let sortMenuOpen = false;
const SORT_LABELS: Record<TableSort, string> = {
  pot: "Biggest pot",
  stake: "Highest buy-in",
  players: "Most players",
  open: "Open seats first",
};
// Close the sort menu on any outside click.
document.addEventListener("click", () => {
  if (sortMenuOpen) { sortMenuOpen = false; drawTables(); }
});
let lastTables: TableInfo[] = [];
let lastOnJoin: (code: string) => void = () => {};

let lastOnWatch: (code: string) => void = () => {};

/** Render the public tables list with a stake filter; rows join/watch by code. */
export function renderTables(
  tables: TableInfo[],
  onJoin: (code: string) => void,
  onWatch: (code: string) => void = () => {},
): void {
  lastTables = tables;
  lastOnJoin = onJoin;
  lastOnWatch = onWatch;
  drawTables();
}

function drawTables(): void {
  const filter = document.getElementById("tables-filter");
  const list = document.getElementById("tables-list");
  const head = document.getElementById("tables-sort");
  if (!list || !filter) return;
  const roomsEl = document.getElementById("lobby-rooms"); // top-bar plaque count
  if (roomsEl) roomsEl.textContent = String(lastTables.length);

  // Filter chips by currency category — only show categories actually present,
  // each with the CORRECT symbol (🆓 free / 🪙 chips / 💎 token).
  const hasCasual = lastTables.some((t) => t.currency === 0); // chips/free
  const hasArena = lastTables.some((t) => t.currency === 1); // real tokens
  const hasOpen = lastTables.some((t) => !t.live && t.players < t.max);
  const chips: Array<{ v: TableFilter; label: string }> = [{ v: "all", label: "All" }];
  if (hasCasual) chips.push({ v: "casual", label: "🪙 Casual" });
  if (hasArena) chips.push({ v: "arena", label: "💎 Arena" });
  if (hasOpen) chips.push({ v: "open", label: "👤 Open seats" });
  // Only one real category present → the chips add nothing; hide them.
  filter.classList.toggle("hidden", lastTables.length === 0 || chips.length <= 2);
  filter.innerHTML = "";
  for (const c of chips) {
    const b = document.createElement("button");
    b.className = "stake-btn" + (c.v === tableFilter ? " selected" : "");
    b.textContent = c.label;
    b.addEventListener("click", () => {
      tableFilter = c.v;
      drawTables();
    });
    filter.appendChild(b);
  }

  // Sort dropdown: a single "Sort: <label> ▾" pill that opens a small menu.
  if (head) {
    head.className = "tables-sort";
    head.classList.toggle("hidden", lastTables.length === 0);
    head.innerHTML = "";
    const btn = document.createElement("button");
    btn.className = "sort-btn";
    btn.innerHTML = `<span class="sort-ico">↕</span> Sort: <b>${SORT_LABELS[tableSort]}</b> <span class="sort-caret">▾</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      sortMenuOpen = !sortMenuOpen;
      drawTables();
    });
    const menu = document.createElement("div");
    menu.className = "sort-menu" + (sortMenuOpen ? "" : " hidden");
    (Object.keys(SORT_LABELS) as TableSort[]).forEach((k) => {
      const opt = document.createElement("button");
      opt.className = "sort-opt" + (k === tableSort ? " selected" : "");
      opt.textContent = SORT_LABELS[k];
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        tableSort = k;
        sortMenuOpen = false;
        drawTables();
      });
      menu.appendChild(opt);
    });
    head.append(btn, menu);
  }

  const matchesFilter = (t: TableInfo): boolean => {
    switch (tableFilter) {
      case "casual": return t.currency === 0;
      case "arena": return t.currency === 1;
      case "open": return !t.live && t.players < t.max;
      default: return true; // "all"
    }
  };
  const shown = lastTables.filter(matchesFilter).slice();
  const potOf = (t: TableInfo): number => t.stake * t.players;
  const openOf = (t: TableInfo): number => (!t.live && t.players < t.max ? 1 : 0);
  shown.sort((a, b) => {
    switch (tableSort) {
      case "stake": return b.stake - a.stake || b.players - a.players;
      case "players": return b.players - a.players || b.stake - a.stake;
      case "open": return openOf(b) - openOf(a) || potOf(b) - potOf(a);
      default: return potOf(b) - potOf(a) || b.players - a.players; // "pot"
    }
  });
  // Show the live exchange rate in the hint so players can read token stakes.
  const hint = document.querySelector(".lobby-hint");
  if (hint) {
    const r = rateLine();
    hint.textContent =
      "Tap a room to join · 🪙 free · 💎 paid · winner takes the pot" + (r ? ` · ${r}` : "");
  }
  list.innerHTML = "";
  if (shown.length === 0) {
    list.innerHTML = '<div class="status">No open tables here — start one!</div>';
    return;
  }
  for (const t of shown) {
    const row = document.createElement("button");
    row.className = "table-row" + (t.live ? " live" : "") + (t.bots ? " bots" : "");
    // Always-open casual bot room: distinct label, always "Play", chips-only.
    if (t.bots) {
      row.innerHTML =
        `<span class="td-stake">🤖 vs Bots<small>casual · chips · no rating</small></span>` +
        `<span class="td-players">${t.players}/${t.max}<small>${t.players > 0 ? "in play" : "open now"}</small></span>` +
        `<span class="td-action">Play</span>`;
      row.addEventListener("click", () => lastOnJoin(t.code));
      list.appendChild(row);
      continue;
    }
    const sym = t.currency === 1 ? "💎" : "🪙";
    const isToken = t.currency === 1;
    const potVal = t.stake * t.players; // total on the line right now
    const usd = isToken ? usdSuffix(potVal) : "";
    // Buy-in (the stake one player puts up) — the headline figure, shown with its
    // ≈$/◎ conversion (player's chosen unit) right next to it for token rooms.
    const conv = isToken && t.stake > 0 ? ` <span class="td-conv">${usdSuffix(t.stake).trim()}</span>` : "";
    const stakeTag = t.stake > 0 ? `${sym}${t.stake.toLocaleString()}${conv}` : "🆓 FREE";
    // What's actually at stake: the whole pot (winner takes it), + USD for token.
    const potTag = t.stake > 0 ? `🏆 pot ${sym}${potVal.toLocaleString()}${usd}` : "casual · for fun";
    const action = t.live ? "👁 Watch" : "Join";
    // Staked tables need a connected wallet — flag them with a lock.
    const lock = !t.live && t.stake > 0 && !hasWallet ? "🔒 " : "";
    const status = t.live ? "in progress" : t.players >= t.max ? "full" : t.players >= 2 ? "filling…" : "open";
    const label = t.live ? "🔴 LIVE" : lock + stakeTag;
    row.innerHTML =
      `<span class="td-stake">${label}<small>${potTag}</small></span>` +
      `<span class="td-players">${t.players}/${t.max}<small>${status}</small></span>` +
      `<span class="td-action">${action}</span>`;
    row.addEventListener("click", () => (t.live ? lastOnWatch(t.code) : lastOnJoin(t.code)));
    list.appendChild(row);
  }
}

export function setMenuStatus(text: string): void {
  const el = document.getElementById("menu-status");
  if (el) el.textContent = text;
}

/** Refresh the waiting-room screen from current state. */
export function renderRoom(state: GameState): void {
  if (activeRoomCode !== state.roomCode) setActiveRoom(state.roomCode); // track active room
  // CRITICAL: this is called EVERY animation frame while in the lobby. Rebuilding
  // the whole seat list (+ kick button, chat input, …) 60×/sec made interactive
  // elements impossible to use — a fresh element each frame means :hover never
  // sticks and a click is destroyed before it fires (that's why kick "didn't
  // work"). Only rebuild when something actually changed.
  const sig = JSON.stringify({
    p: state.roomPlayers.map((p) => [p.id, p.name, p.ready, p.skin, p.color, p.wins, p.wallet]),
    h: state.hostId,
    me: state.myId,
    host: state.isHost,
    c: state.roomCode,
    st: state.roomStake,
    cur: state.roomCurrency,
    pub: state.roomIsPublic,
    cd: Math.ceil(state.lobbyCountdownLeft() / 1000),
    k: armedKickId,
  });
  if (sig === lastRoomSig) return;
  lastRoomSig = sig;
  const count = state.roomPlayers.length;
  const sym = state.roomCurrency === 1 ? "💎" : "🪙";
  const isToken = state.roomCurrency === 1;

  // --- Top bar: room type + code -------------------------------------------
  const codeBox = document.getElementById("room-code-box")!;
  const codeEl = document.getElementById("room-code")!;
  codeEl.textContent = state.roomCode;
  codeBox.classList.toggle("hidden", !state.roomCode);
  const typeEl = document.getElementById("room-type");
  if (typeEl) {
    // Big plain title by match type (no emoji) — set in the top bar.
    typeEl.textContent =
      state.roomStake > 0 ? (isToken ? "TOKEN ARENA" : "CHIPS TABLE") : "CASUAL";
  }
  // (Server label + live ping is updated on a timer in main.ts.)
  // Match parameters list (under the players).
  const infoEl = document.getElementById("room-match-info");
  if (infoEl) {
    const mode = state.roomStake > 0 ? (isToken ? "Token Arena" : "Chips Table") : "Casual";
    const buyin = state.roomStake > 0 ? `${sym} ${state.roomStake.toLocaleString()}` : "Free";
    const rows: Array<[string, string]> = [
      ["Mode", mode],
      ["Buy-in", buyin],
      ["Players", `up to ${MAX_PLAYERS_PER_ROOM}`],
      ["Round", "3 min"],
    ];
    infoEl.innerHTML = rows
      .map(([k, v]) => `<div class="mi-row"><span>${k}</span><b>${v}</b></div>`)
      .join("");
  }
  // Public/private control (now a clear button under the players). Host taps to
  // toggle; everyone else sees the current state (disabled).
  const visEl = document.getElementById("room-visibility") as HTMLButtonElement | null;
  if (visEl) {
    visEl.textContent = state.roomIsPublic ? "🌐 Public · anyone can join" : "🔒 Private · code only";
    visEl.classList.remove("hidden");
    visEl.classList.toggle("vis-private", !state.roomIsPublic);
    visEl.disabled = !state.isHost;
    visEl.title = state.isHost
      ? "Tap to switch between public (listed) and private (code only)"
      : state.roomIsPublic
        ? "Public — anyone can join"
        : "Private — joinable by code/invite only";
  }

  // --- Center: player seats (2×2 grid, empty slots shown) -------------------
  const seatCount = document.getElementById("room-seatcount");
  if (seatCount) seatCount.textContent = `${count}/${MAX_PLAYERS_PER_ROOM}`;
  const seriesOn = state.roomPlayers.some((p) => p.wins > 0);
  const list = document.getElementById("room-players")!;
  list.innerHTML = "";
  for (const p of state.roomPlayers) {
    const li = document.createElement("li");
    li.className =
      "seat" + (p.ready ? " ready" : "") + (p.id === state.myId ? " you" : "") + (p.id === state.hostId ? " host" : "");
    const col = PLAYER_COLORS[p.color % PLAYER_COLORS.length];
    const colName = COLOR_NAMES[p.color % COLOR_NAMES.length];
    // The seat is tinted in the player's UNIQUE in-match colour (assigned in the
    // lobby, independent of skin) so everyone knows their colour before the match.
    li.style.setProperty("--seat-color", col);
    const av = skinAvatar(p.skin, col);
    av.classList.add("seat-av");
    li.appendChild(av);
    const name = document.createElement("div");
    name.className = "seat-name";
    name.textContent = p.name + (p.id === state.myId ? " (you)" : "");
    li.appendChild(name);
    const badges = document.createElement("div");
    badges.className = "seat-badges";
    // Colour chip — for the local player it reads "YOU: Red" so they can't miss it.
    badges.innerHTML += `<span class="color-tag" style="--c:${col}">${
      p.id === state.myId ? `YOU: ${colName}` : colName
    }</span>`;
    if (p.id === state.hostId) badges.innerHTML += `<span class="host-tag">👑 HOST</span>`;
    if (seriesOn) badges.innerHTML += `<span class="win-tag">🏆 ${p.wins}</span>`;
    li.appendChild(badges);
    const ready = document.createElement("div");
    ready.className = "seat-ready" + (p.ready ? " on" : "");
    ready.textContent = p.ready ? "✅ READY" : "▢ not ready";
    li.appendChild(ready);
    li.title = "View card";
    li.addEventListener("click", () => onOpenProfile(p));
    // Host can remove anyone but themselves.
    if (state.isHost && p.id !== state.hostId) {
      const kick = document.createElement("button");
      kick.className = "kick-btn" + (armedKickId === p.id ? " armed" : "");
      kick.textContent = armedKickId === p.id ? "Kick?" : "✕";
      kick.title = "Kick player";
      // Two-tap confirm (mobile-reliable, no native dialog). armedKickId is module-
      // level so the first tap's armed state survives a room re-render → the second
      // tap actually kicks.
      kick.addEventListener("click", (e) => {
        e.stopPropagation();
        if (armedKickId === p.id) {
          window.clearTimeout(armedKickTimer);
          armedKickId = -1;
          onKick(p.id);
          return;
        }
        armedKickId = p.id;
        kick.textContent = "Kick?";
        kick.classList.add("armed");
        window.clearTimeout(armedKickTimer);
        armedKickTimer = window.setTimeout(() => {
          armedKickId = -1;
          if (kick.isConnected) { kick.textContent = "✕"; kick.classList.remove("armed"); }
        }, 2600);
      });
      li.appendChild(kick);
    }
    list.appendChild(li);
  }
  // Empty seats — EVERY open seat is a clickable "invite a friend" slot (a tap
  // anywhere on a free chair fires the room's invite/copy-link action).
  for (let i = count; i < MAX_PLAYERS_PER_ROOM; i++) {
    const li = document.createElement("li");
    li.className = "seat empty invite";
    li.innerHTML = `<div class="seat-empty">＋ Invite a friend</div>`;
    li.title = "Invite a friend to this seat";
    li.addEventListener("click", () => onInviteSeat());
    list.appendChild(li);
  }

  // Match-settings strip is disabled for now — rounds are a fixed 3 minutes.
  // (The host-editable timer is kept in the protocol but hidden until it's
  // redesigned to fit the lobby.)

  // --- Prize / what's on the line ------------------------------------------
  const prize = document.getElementById("room-prize");
  if (prize) {
    if (state.roomStake > 0) {
      const pot = state.roomStake * Math.max(count, 1);
      const usd = isToken ? usdSuffix(pot).trim().replace("≈", "≈ ") : "";
      prize.className = "room-prize " + (isToken ? "prize-token" : "prize-chips");
      const rate = isToken ? rateLine() : "";
      prize.innerHTML =
        `<div class="prize-label">PRIZE POOL</div>` +
        `<div class="prize-pot">${sym}${pot.toLocaleString()}</div>` +
        (usd ? `<div class="prize-usd">${usd}</div>` : "") +
        `<div class="prize-meta">Buy-in ${sym}${state.roomStake.toLocaleString()} / player</div>` +
        `<div class="prize-rule">🏆 Winner takes the pot</div>` +
        (rate ? `<div class="prize-rate">${rate}</div>` : "");
    } else {
      prize.className = "room-prize prize-free";
      prize.innerHTML =
        `<div class="prize-label">CASUAL</div>` +
        `<div class="prize-pot">🆓</div>` +
        `<div class="prize-meta">Play for fun — no stakes</div>`;
    }
  }

  // --- Left rail: your character (animated, turns in a circle) — cycle with the
  //     arrows; owned = selected, locked = dimmed + 🔒 with Unlock in SHOP. ----
  const me0 = state.roomPlayers.find((p) => p.id === state.myId);
  if (me0) {
    if (browseSkin < 0) browseSkin = me0.skin; // start on your current character
    renderCharacter();
  }

  document.getElementById("room-stake")?.classList.add("hidden");

  const readyCount = state.roomPlayers.filter((p) => p.ready).length;
  const status = document.getElementById("room-status");
  const allReady = count >= MIN_PLAYERS_TO_START && readyCount === count;
  const cdLeft = Math.ceil(state.lobbyCountdownLeft() / 1000);
  // The action button now carries the ready state — keep the separate status line
  // ONLY for the urgent countdown warning, otherwise hide it (no duplication).
  if (status) {
    if (cdLeft > 0 && !allReady) {
      status.textContent = `Starting in ${cdLeft}s — ready up or you'll be dropped`;
      status.classList.remove("hidden");
    } else {
      status.textContent = "";
      status.classList.add("hidden");
    }
  }

  // ── ONE smart action button (merged Ready/Start), role-aware — like top lobby
  // games. Players get a Ready toggle; the host gets "Start match" (which readies
  // them and triggers the server's auto-start / straggler-drop countdown), or a
  // disabled "Waiting for players…" when there aren't enough yet.
  const me = state.roomPlayers.find((p) => p.id === state.myId);
  const readyBtn = document.getElementById("ready-btn") as HTMLButtonElement;
  const startBtn = document.getElementById("start-now") as HTMLButtonElement | null;
  startBtn?.classList.add("hidden"); // merged into the one button
  const enough = count >= MIN_PLAYERS_TO_START;
  const readyLabel = `${readyCount}/${count} ready · tap to cancel`;
  if (readyBtn && me) {
    if (state.isHost) {
      if (!enough) {
        readyBtn.textContent = `Waiting for players… ${count}/${MIN_PLAYERS_TO_START}`;
        readyBtn.disabled = true;
      } else if (!me.ready) {
        readyBtn.textContent = "Start match";
        readyBtn.disabled = false;
      } else {
        readyBtn.textContent = allReady ? "Starting…" : readyLabel;
        readyBtn.disabled = false;
      }
    } else {
      readyBtn.textContent = me.ready ? readyLabel : "Ready up";
      readyBtn.disabled = false;
    }
    readyBtn.dataset.on = String(me.ready);
  }
}

export function showResult(title: string): void {
  const el = document.getElementById("result-title");
  if (el) el.textContent = title;
  showScreen("result");
}
