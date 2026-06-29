import { PLAYER_COLORS, COLOR_NAMES, skinAvatar } from "../game/renderer.js";
import { ASSET_VER } from "../game/assets.js";
import { MIN_PLAYERS_TO_START, MAX_PLAYERS_PER_ROOM, BET_SIZES, TOKEN_BET_SIZES, SKIN_COUNT, DEFAULT_SKINS, PRACTICE_MAX_BOTS, DEFAULT_SANDBOX, type SandboxOpts } from "../net/protocol.js";

/** Which skins the local player owns (bitmask) + their level — for the lobby
 * character-browser, shop, and passport cards. */
export function setLobbySkins(ownedMask: number, level: number) {
  browseSkin = -1;
  lobbyOwnedMask = ownedMask;
  lobbyLevel = level;
  ownedSet = new Set<number>();
  let m = ownedMask;
  let i = 0;
  while (m) {
    if (m & 1) ownedSet.add(i);
    m >>= 1;
    i++;
  }
}

let lobbyOwnedMask = 0;
let lobbyLevel = 1;
let ownedSet = new Set<number>();

// ── Emoji per skin ──────────────────────────────────────────────────────────
// You can freely add more rows.
// import { SKIN_DEFS } from "../game/assets.js";   // if you ever move this table there
const _SKIN_EMOJI: Record<number, string> = {
  0: "🐕",
  1: "🐸",
  2: "🟠",
  3: "🚀",
  4: "🐕",
  5: "🎰",
  6: "🦧",
  7: "💎",
  8: "📺",
  9: "💀",
  10: "🎭",
  11: "🐸",
  12: "🍀",
  13: "🤖",
  14: "🐸",
  15: "🐱",
  16: "🐸",
  17: "🌲",
  18: "🐸",
  19: "🎤",
  20: "🐸",
  21: "🐂",
  22: "🌲",
  23: "🐸",
  24: "🦍",
  25: "🤖",
  26: "🐸",
  27: "🍀",
  28: "🐕",
  29: "🎰",
  30: "🐸",
  31: "🦧",
  32: "🌲",
  33: "🐸",
  34: "🚀",
  35: "🐸",
  36: "🐕",
  37: "🎰",
  38: "🐸",
  39: "🦧",
  40: "📺",
  41: "🤖",
  42: "🐕",
  43: "🎰",
  44: "🐸",
  45: "🚀",
  46: "🦧",
  47: "🐕",
  48: "🎤",
  49: "🐸",
  50: "🍀",
  51: "🐕",
  52: "🎰",
  53: "🐸",
  54: "🤖",
  55: "🐕",
  56: "🦧",
  57: "🐸",
  58: "🌲",
  59: "🐕",
  60: "🐸",
  61: "🐂",
  62: "🍀",
  63: "🐸",
  64: "🐕",
  65: "📺",
  66: "🎰",
  67: "🐸",
  68: "🤖",
  69: "🐕",
  70: "🦧",
  71: "🐸",
  72: "🎰",
  73: "🐕",
  74: "🐸",
  75: "🍀",
  76: "🚀",
  77: "🐸",
  78: "🐕",
  79: "🐱",
  80: "🎰",
  81: "🐸",
  82: "🐕",
  83: "🌲",
  84: "🐸",
  85: "🍀",
  86: "🐕",
  87: "🐸",
  88: "🤖",
  89: "🐕",
  90: "🐸",
  91: "🎰",
  92: "🐕",
  93: "🐸",
  94: "🌲",
  95: "🐸",
  96: "🚀",
  97: "🐸",
  98: "🎰",
  99: "🐕",
};

export const SKIN_EMOJI = _SKIN_EMOJI;

// ── DOM helpers ─────────────────────────────────────────────────────────────
function el(tag: string, cls: string, html: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

// ── screen system ───────────────────────────────────────────────────────────
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
  if (activeRoomCode && currentScreen !== "room" && currentScreen !== "game") {
    el.classList.remove("hidden");
    (el.querySelector("span") as HTMLElement).textContent = activeRoomCode;
  } else {
    el.classList.add("hidden");
  }
}

/** The public function called from main.ts when the server says we've joined. */
export function setActiveRoom(code: string) {
  activeRoomCode = code;
  refreshReturnRoom();
}

export function showScreen(name: ScreenName): void {
  currentScreen = name;
  for (const s of SCREENS) {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("hidden", s !== name);
  }
  refreshReturnRoom();
  // Sync the top-nav highlight to the screen: HOME on the hub, ARENA in the
  // lobby/room (room search + waiting room), SHOP in the shop.
  const navFor: Partial<Record<ScreenName, string>> = { menu: "nav-home", lobby: "nav-arena", room: "nav-arena", shop: "nav-shop", friends: "nav-home", campaign: "nav-home" };
  const navId = navFor[name];
  document.querySelectorAll(".hub-nav-link").forEach((a) => a.classList.toggle("active", a.id === navId));
  // Persistent top chrome (alpha notice + global status bar + XP): shown on every
  // screen except loading and the game itself.
  const topChrome = document.getElementById("top-chrome");
  if (topChrome) topChrome.classList.toggle("hidden", name === "loading" || name === "game");
}

// ── splash / loading ────────────────────────────────────────────────────────
export function splashComplete() {
  document.getElementById("splash")?.classList.add("hidden");
  document.getElementById("loading")?.classList.remove("hidden");
}

let setMenuStatusImpl: (text: string) => void = () => {};
export function setMenuStatus(text: string) {
  setMenuStatusImpl(text);
}

export function setProfileHandler(
  openPassport: () => void,
  openLeaderboard: () => void,
  openSettings: () => void,
  openWallet: () => void,
) {
  document.getElementById("passport-btn")?.addEventListener("click", openPassport);
  document.getElementById("profile-leaderboard-btn")?.addEventListener("click", openLeaderboard);
  document.getElementById("profile-settings-btn")?.addEventListener("click", openSettings);
  document.getElementById("profile-wallet-btn")?.addEventListener("click", openWallet);
}

export function setKickHandler(kick: (id: number) => void) {
  kickHandler = kick;
}
let kickHandler: ((id: number) => void) | null = null;

export function setInviteSeatHandler(invite: (seat: number) => void) {
  inviteSeatHandler = invite;
}
let inviteSeatHandler: ((seat: number) => void) | null = null;

export function setSkinSelectHandler(handler: () => void) {
  skinSelectHandler = handler;
}
let skinSelectHandler: (() => void) | null = null;

export function setShopHandler(handler: () => void) {
  shopHandler = handler;
}
let shopHandler: (() => void) | null = null;

export function setWalletState(connected: boolean, short = "") {
  document.querySelectorAll(".wallet-status").forEach((el) => {
    el.textContent = connected ? short || "Wallet" : "Connect Wallet";
    el.classList.toggle("connected", connected);
  });
}

export function setupMenu(opts: {
  onQuickplay: () => void;
  onPractice: () => void;
  onCreate: () => void;
  onLeaderboard: () => void;
  onProfile: () => void;
  onShop: () => void;
  onWallet: () => void;
  onHow: () => void;
  onSettings: () => void;
  onTournaments: () => void;
  onCampaign?: () => void;
  onFriends: () => void;
  setStatus: (text: string) => void;
}) {
  setMenuStatusImpl = opts.setStatus;

  document.getElementById("open-play")?.addEventListener("click", opts.onQuickplay);
  document.getElementById("open-practice")?.addEventListener("click", opts.onPractice);
  document.getElementById("open-create")?.addEventListener("click", opts.onCreate);
  document.getElementById("open-leaderboard")?.addEventListener("click", opts.onLeaderboard);
  document.getElementById("open-profile")?.addEventListener("click", opts.onProfile);
  document.getElementById("open-shop")?.addEventListener("click", opts.onShop);
  document.getElementById("open-wallet")?.addEventListener("click", opts.onWallet);
  document.getElementById("open-how")?.addEventListener("click", opts.onHow);
  document.getElementById("open-settings")?.addEventListener("click", opts.onSettings);
  document.getElementById("open-tournaments")?.addEventListener("click", opts.onTournaments);
  document.getElementById("open-friends")?.addEventListener("click", opts.onFriends);
  document.getElementById("nav-home")?.addEventListener("click", () => showScreen("menu"));
  document.getElementById("nav-arena")?.addEventListener("click", () => showScreen("lobby"));
  document.getElementById("nav-shop")?.addEventListener("click", () => showScreen("shop"));

  // Campaign button (if present in DOM)
  document.getElementById("open-campaign")?.addEventListener("click", () => opts.onCampaign?.());

  // "Return to room" floater
  document.getElementById("return-room-btn")?.addEventListener("click", () => showScreen("room"));
  document.getElementById("return-room-leave")?.addEventListener("click", () => {
    // handled in main.ts
  });
}

// ── how-to-play (simple reveal) ─────────────────────────────────────────────
export function onHowTo() {
  const el = document.getElementById("how-panel");
  if (el) el.classList.remove("hidden");
}

// ── lobby ───────────────────────────────────────────────────────────────────
let lobbyResolve: ((roomCode: string) => void) | null = null;

export function enterLobby(): Promise<string> {
  showScreen("lobby");
  return new Promise((resolve) => {
    lobbyResolve = resolve;
  });
}

export function renderTables(codes: string[], onJoin: (code: string) => void) {
  const list = document.getElementById("room-list")!;
  list.innerHTML = "";
  if (codes.length === 0) {
    list.innerHTML = '<p class="status fair">No open tables right now.</p>';
    return;
  }
  for (const code of codes) {
    const row = el("div", "room-row", `<span class="rm-code">${code}</span>`);
    const btn = el("button", "primary glass-btn", "Join");
    btn.addEventListener("click", () => onJoin(code));
    row.appendChild(btn);
    list.appendChild(row);
  }
}

// ── room ────────────────────────────────────────────────────────────────────
let selSeat = 0;
let seatResolve: ((seat: number) => void) | null = null;
let browseSkin = -1;
let pendingMsg = "";
let readySlots = new Set<number>();
let isHostCache = false;

/** Call when local state changes so the room UI can refresh. */
export function renderRoom(state: { myId: number; roomPlayers: { id: number; seat: number; skin: number; nickname: string; ready: boolean }[]; roomHost: number }) {
  const { myId, roomPlayers, roomHost } = state;
  isHostCache = myId === roomHost;

  // Player count
  const n = roomPlayers.length;
  const max = MAX_PLAYERS_PER_ROOM;
  const playersEl = document.getElementById("room-players")!;
  playersEl.textContent = `${n} / ${max}`;

  // Seat grid (0..3)
  const seatGrid = document.getElementById("seat-grid")!;
  seatGrid.innerHTML = "";
  for (let s = 0; s < max; s++) {
    const p = roomPlayers.find((x) => x.seat === s);
    const taken = !!p;
    const isMe = p?.id === myId;
    const isHost = p?.id === roomHost;

    const card = document.createElement("div");
    card.className = "seat-card" + (taken ? " taken" : "") + (isMe ? " me" : "");

    if (taken) {
      const av = document.createElement("img");
      av.className = "seat-avatar";
      av.src = skinAvatar(p!.skin);
      av.alt = String(p!.skin);
      const col = PLAYER_COLORS[(p!.id ?? 0) % PLAYER_COLORS.length];
      card.style.borderColor = col;
      const nm = el("div", "seat-name", p!.nickname || `Player ${p!.id}`);
      const badges = el("div", "seat-badges", (isHost ? "👑 " : "") + (p!.ready ? "✅" : "⏳"));
      card.appendChild(av);
      card.appendChild(nm);
      card.appendChild(badges);

      // Host controls: kick others
      if (isHostCache && !isMe && kickHandler) {
        const kickBtn = el("button", "ghost kick-btn", "🥾");
        kickBtn.title = "Kick";
        kickBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          kickHandler!(p!.id);
        });
        card.appendChild(kickBtn);
      }
    } else {
      // Empty seat
      const plus = el("div", "seat-plus", "+");
      plus.addEventListener("click", () => {
        if (seatResolve) seatResolve(s);
      });
      // Invite button for host
      if (isHostCache && inviteSeatHandler) {
        const inv = el("button", "ghost invite-btn", "📩 Invite");
        inv.addEventListener("click", (e) => {
          e.stopPropagation();
          inviteSeatHandler!(s);
        });
        card.appendChild(plus);
        card.appendChild(inv);
      } else {
        card.appendChild(plus);
      }
    }

    card.addEventListener("click", () => {
      if (!taken && seatResolve) seatResolve(s);
    });

    seatGrid.appendChild(card);
  }

  // Host-only: start button enabled when >= MIN and all ready
  const startBtn = document.getElementById("room-start") as HTMLButtonElement;
  if (startBtn) {
    const canStart = isHostCache && n >= MIN_PLAYERS_TO_START && roomPlayers.every((p) => p.ready || p.id === roomHost);
    startBtn.disabled = !canStart;
  }

  // Chat log
  if (pendingMsg) {
    const log = document.getElementById("room-chat-log")!;
    const line = el("div", "chat-line", pendingMsg);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    pendingMsg = "";
  }

  // Character-browser sidebar (inside room)
  // ─────────────────────────────────────────────────────────────────────────
  //   Renders the small vertical roster on the right side of the room. The
  //   host can lock seats; everyone can browse skins with left/right
  //   arrows; owned = selected, locked = dimmed + 🔒 with Unlock in SHOP. ----
  const me0 = roomPlayers.find((p) => p.id === myId);
  if (me0) {
    if (browseSkin < 0) browseSkin = me0.skin; // start on your current
    renderCharacter();
  }

  // Message input
  const inp = document.getElementById("room-chat-input") as HTMLInputElement;
  const send = () => {
    const text = inp.value.trim();
    if (!text) return;
    // TODO: send via socket
    inp.value = "";
  };
  document.getElementById("room-chat-send")?.addEventListener("click", send);
  inp?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
}

/** Append a chat line from the server (called by main.ts on CHAT message). */
export function roomChat(text: string) {
  pendingMsg = text;
  // If we're currently on the room screen, force a re-render so the message appears immediately
  if (currentScreen === "room") {
    // Re-render with a synthetic state snapshot; the public renderRoom signature only
    // accepts state, so callers (main.ts) should ideally call renderRoom again after
    // pushing the message to their local chat buffer. For now we just set pendingMsg
    // and rely on the next renderRoom call from main.ts.
  }
}

function renderCharacter() {
  const rosterEl = document.getElementById("char-roster");
  if (!rosterEl) return;
  rosterEl.innerHTML = "";

  // Show 5 skins at a time: prev | [a] [b] SELECTED [d] [e] | next
  const pageSize = 5;
  const page = Math.floor(browseSkin / pageSize);
  const start = page * pageSize;
  const end = Math.min(start + pageSize, SKIN_COUNT);

  const wrap = el("div", "char-roster-row", "");

  // Prev button
  const prev = el("button", "ghost roster-nav", "◀");
  prev.disabled = browseSkin <= 0;
  prev.addEventListener("click", () => {
    browseSkin = Math.max(0, browseSkin - 1);
    renderCharacter();
  });
  wrap.appendChild(prev);

  for (let s = start; s < end; s++) {
    const owned = ownedSet.has(s);
    const isCurrent = s === browseSkin;
    const card = el("div", "roster-card" + (isCurrent ? " current" : "") + (owned ? " owned" : " locked"), "");
    const emoji = document.createElement("span");
    emoji.className = "roster-emoji";
    emoji.textContent = _SKIN_EMOJI[s] ?? "❓";
    const lbl = el("span", "roster-lbl", `#${s}`);
    card.appendChild(emoji);
    card.appendChild(lbl);

    if (!owned) {
      const lock = el("span", "roster-lock", "🔒");
      card.appendChild(lock);
    }

    card.addEventListener("click", () => {
      browseSkin = s;
      renderCharacter();
    });
    wrap.appendChild(card);
  }

  // Next button
  const next = el("button", "ghost roster-nav", "▶");
  next.disabled = browseSkin >= SKIN_COUNT - 1;
  next.addEventListener("click", () => {
    browseSkin = Math.min(SKIN_COUNT - 1, browseSkin + 1);
    renderCharacter();
  });
  wrap.appendChild(next);

  // Confirm / buy row
  const actionRow = el("div", "roster-actions", "");
  const owned = ownedSet.has(browseSkin);
  if (owned) {
    const selectBtn = el("button", "primary glass-btn", "Select");
    selectBtn.addEventListener("click", () => {
      if (skinSelectHandler) skinSelectHandler();
    });
    actionRow.appendChild(selectBtn);
  } else {
    const price = SKIN_PRICES[browseSkin] ?? 0;
    const tokenPrice = SKIN_TOKEN_PRICES[browseSkin] ?? 0;
    const buyBtn = el("button", "primary glass-btn", price ? `🪙 ${price} Buy` : tokenPrice ? `💎 ${tokenPrice} Buy` : "Unlock");
    buyBtn.addEventListener("click", () => {
      if (shopHandler) shopHandler();
    });
    actionRow.appendChild(buyBtn);
  }

  rosterEl.appendChild(wrap);
  rosterEl.appendChild(actionRow);
}

/** Call this when the local player's skin changes (e.g. after buying). */
export function resetCharacterBrowse() {
  browseSkin = -1;
}

// ── match result ────────────────────────────────────────────────────────────
export function showResult(opts: {
  won: boolean;
  draw: boolean;
  frags: number;
  ratingDelta: number;
  firstBlood: boolean;
  streak: number;
  xpFrom: number;
  xpTo: number;
  level: number;
}) {
  showScreen("result");
  const r = document.getElementById("result-body")!;
  const title = opts.won ? "🏆 Victory!" : opts.draw ? "🤝 Draw" : "💀 Defeat";
  const subtitle = opts.firstBlood ? "First Blood! " : "";
  const streakText = opts.streak > 2 ? ` ${opts.streak}x streak!` : "";
  r.innerHTML = `
    <h1 class="result-title">${title}</h1>
    <p class="result-sub">${subtitle}${opts.frags} frag${opts.frags !== 1 ? "s" : ""}${streakText}</p>
    <p class="result-rating">${opts.ratingDelta >= 0 ? "+" : ""}${opts.ratingDelta} rating</p>
    <p class="result-xp">Level ${opts.level} · XP ${opts.xpFrom} → ${opts.xpTo}</p>
    <button id="result-play" class="primary glass-btn">Play Again</button>
    <button id="result-menu" class="ghost">Main Menu</button>
  `;
  document.getElementById("result-play")?.addEventListener("click", () => {
    // handled in main.ts
  });
  document.getElementById("result-menu")?.addEventListener("click", () => {
    showScreen("menu");
  });
}

// ── leaderboard ─────────────────────────────────────────────────────────────
export function renderLeaderboard(rows: { nickname: string; rating: number; wins: number; matches: number }[], period: string) {
  const tbody = document.getElementById("lb-body")!;
  tbody.innerHTML = "";
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${r.nickname}</td><td>${r.rating}</td><td>${r.wins}</td><td>${r.matches}</td>`;
    tbody.appendChild(tr);
  }
  const title = document.getElementById("lb-title");
  if (title) title.textContent = `Leaderboard — ${period}`;
}

// ── profile / passport ──────────────────────────────────────────────────────
export function renderProfile(opts: { nickname: string; wallet: string; level: number; xp: number; xpMax: number; rating: number; wins: number; matches: number; frags: number; favoriteSkin: number; pnlChart: HTMLElement | null }) {
  document.getElementById("pp-nick")!.textContent = opts.nickname;
  document.getElementById("pp-wallet")!.textContent = opts.wallet;
  document.getElementById("pp-level")!.textContent = String(opts.level);
  const xpPct = Math.round((opts.xp / opts.xpMax) * 100);
  const xpFill = document.getElementById("pp-xp-fill") as HTMLElement;
  if (xpFill) xpFill.style.width = `${xpPct}%`;
  document.getElementById("pp-rating")!.textContent = String(opts.rating);
  document.getElementById("pp-wins")!.textContent = String(opts.wins);
  document.getElementById("pp-matches")!.textContent = String(opts.matches);
  document.getElementById("pp-frags")!.textContent = String(opts.frags);
  (document.getElementById("pp-avatar") as HTMLImageElement).src = skinAvatar(opts.favoriteSkin);
  const host = document.getElementById("pp-pnl-host");
  if (host) {
    host.innerHTML = "";
    if (opts.pnlChart) host.appendChild(opts.pnlChart);
  }
}

// ── share card ──────────────────────────────────────────────────────────────
export function renderShareCard(canvas: HTMLCanvasElement) {
  const host = document.getElementById("share-host");
  if (!host) return;
  host.innerHTML = "";
  canvas.className = "share-canvas";
  host.appendChild(canvas);
  showScreen("share");
}

// ── wallet overlay ──────────────────────────────────────────────────────────
export function setTokenUsd(price: string) {
  document.querySelectorAll(".token-usd").forEach((el) => (el.textContent = price));
}

// ── settings ────────────────────────────────────────────────────────────────
export function buildSettingsScreen(opts: {
  onGfxChange: (preset: string) => void;
  onToggle: (key: string, on: boolean) => void;
  onRegionChange: (region: string) => void;
  onNicknameChange: (nick: string) => void;
  onArenaThemeChange: (theme: string) => void;
  onFloorChange: (mode: string) => void;
  onModeChange: (mode: string) => void;
  onToggleLite: (on: boolean) => void;
  currentGfx: string;
  toggles: Record<string, boolean>;
  currentRegion: string;
  nickname: string;
  currentArena: string;
  currentFloor: string;
  currentMode: string;
}) {
  // Graphics preset
  const gfxLow = document.getElementById("gfx-low");
  const gfxMed = document.getElementById("gfx-med");
  const gfxHigh = document.getElementById("gfx-high");
  const setGfxActive = (p: string) => {
    gfxLow?.classList.toggle("active", p === "low");
    gfxMed?.classList.toggle("active", p === "medium");
    gfxHigh?.classList.toggle("active", p === "high");
  };
  setGfxActive(opts.currentGfx);
  gfxLow?.addEventListener("click", () => { setGfxActive("low"); opts.onGfxChange("low"); });
  gfxMed?.addEventListener("click", () => { setGfxActive("medium"); opts.onGfxChange("medium"); });
  gfxHigh?.addEventListener("click", () => { setGfxActive("high"); opts.onGfxChange("high"); });

  // Toggles
  for (const [key, on] of Object.entries(opts.toggles)) {
    const btn = document.getElementById(key);
    if (btn) {
      btn.classList.toggle("active", on);
      btn.addEventListener("click", () => {
        const isOn = btn.classList.toggle("active");
        opts.onToggle(key, isOn);
      });
    }
  }

  // Region
  const regionSel = document.getElementById("region-select") as HTMLSelectElement;
  if (regionSel) {
    regionSel.value = opts.currentRegion;
    regionSel.addEventListener("change", () => opts.onRegionChange(regionSel.value));
  }

  // Nickname
  const nickInput = document.getElementById("settings-nickname") as HTMLInputElement;
  if (nickInput) {
    nickInput.value = opts.nickname;
    nickInput.addEventListener("change", () => opts.onNicknameChange(nickInput.value));
  }

  // Arena theme
  const arenaMap: Record<string, string> = {
    "arena-shiba": "shiba",
    "arena-chappie": "chappie",
    "arena-meme": "meme",
    "arena-degen": "degen",
    "arena-pepe": "pepe",
  };
  for (const [id, theme] of Object.entries(arenaMap)) {
    const btn = document.getElementById(id);
    btn?.addEventListener("click", () => {
      Object.keys(arenaMap).forEach((k) => document.getElementById(k)?.classList.remove("active"));
      btn.classList.add("active");
      opts.onArenaThemeChange(theme);
    });
    if (theme === opts.currentArena) btn?.classList.add("active");
  }

  // Floor
  const floorAnim = document.getElementById("floor-anim");
  const floorTex = document.getElementById("floor-tex");
  floorAnim?.classList.toggle("active", opts.currentFloor === "animated");
  floorTex?.classList.toggle("active", opts.currentFloor === "texture");
  floorAnim?.addEventListener("click", () => { floorAnim.classList.add("active"); floorTex?.classList.remove("active"); opts.onFloorChange("animated"); });
  floorTex?.addEventListener("click", () => { floorTex.classList.add("active"); floorAnim?.classList.remove("active"); opts.onFloorChange("texture"); });

  // Mode
  const modeToken = document.getElementById("mode-token");
  const modeFiat = document.getElementById("mode-fiat");
  modeToken?.classList.toggle("active", opts.currentMode === "token");
  modeFiat?.classList.toggle("active", opts.currentMode === "fiat");
  modeToken?.addEventListener("click", () => { modeToken.classList.add("active"); modeFiat?.classList.remove("active"); opts.onModeChange("token"); });
  modeFiat?.addEventListener("click", () => { modeFiat.classList.add("active"); modeToken?.classList.remove("active"); opts.onModeChange("fiat"); });

  // Performance mode
  const liteToggle = document.getElementById("set-lite");
  if (liteToggle) {
    liteToggle.addEventListener("click", () => {
      const isOn = liteToggle.classList.toggle("active");
      opts.onToggleLite(isOn);
    });
  }
}

// ── admin overlay helpers ───────────────────────────────────────────────────
export function syncChrome(opts: { online: number; playing: number; version: string }) {
  const onlineEl = document.getElementById("chrome-online");
  const playingEl = document.getElementById("chrome-playing");
  const verEl = document.getElementById("chrome-version");
  if (onlineEl) onlineEl.textContent = String(opts.online);
  if (playingEl) playingEl.textContent = String(opts.playing);
  if (verEl) verEl.textContent = opts.version;
}
