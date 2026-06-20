import { PLAYER_COLORS, skinAvatar } from "../game/renderer.js";
import { ASSET_VER } from "../game/assets.js";
import { MIN_PLAYERS_TO_START, MAX_PLAYERS_PER_ROOM, BET_SIZES, TOKEN_BET_SIZES, SKIN_COUNT, MATCH_LENGTH_MS } from "../net/protocol.js";

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

/** Live token→USD price, set from main; 0 = unknown. */
let tokenUsd = 0;
export function setTokenUsd(v: number): void {
  tokenUsd = v;
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
function usdSuffix(tokens: number): string {
  if (!tokenUsd || tokens <= 0) return "";
  const v = tokens * tokenUsd;
  return ` ≈$${v >= 1 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v.toPrecision(2)}`;
}
import type { GameState } from "../game/state.js";
import type { TableInfo } from "../net/socket.js";

export type ScreenName =
  | "loading"
  | "menu"
  | "settings"
  | "profile"
  | "leaderboard"
  | "lobby"
  | "room"
  | "game"
  | "result";
const SCREENS: ScreenName[] = [
  "loading",
  "menu",
  "settings",
  "profile",
  "leaderboard",
  "lobby",
  "room",
  "game",
  "result",
];

export function showScreen(name: ScreenName): void {
  for (const id of SCREENS) {
    document.getElementById(id)?.classList.toggle("hidden", id !== name);
  }
  // Pre-launch alpha banner: on every menu screen, hidden during a match.
  document.getElementById("alpha-banner")?.classList.toggle("hidden", name === "game");
  // Background video runs everywhere except in-game (saves CPU/battery).
  const bg = document.getElementById("bg");
  const video = document.getElementById("bg-video") as HTMLVideoElement | null;
  const showBg = name !== "game";
  if (bg) bg.style.display = showBg ? "" : "none";
  if (video) {
    if (showBg) void video.play().catch(() => {});
    else video.pause();
  }
}

export interface Choice {
  name: string;
  skin: number;
  stake: number;
  currency: number; // 0 = chips, 1 = token
}

export interface MenuHandlers {
  /** Create & open a new lobby at the chosen currency + stake. */
  create: (c: Choice) => void;
  /** Start a solo practice match vs N bots at a difficulty. */
  practice: (c: Choice, difficulty: number, bots: number) => void;
}

/** Build a Choice from the current nickname (+ a random, server-deduped skin). */
function makeChoice(stake: number, currency = 0): Choice {
  const nick = document.getElementById("nickname") as HTMLInputElement | null;
  const name = (nick?.value.trim() || "pumper").slice(0, 16);
  localStorage.setItem("bp_nick", name);
  const skin = Math.floor(Math.random() * SKIN_COUNT);
  return { name, skin, stake, currency };
}

export function setupMenu(h: MenuHandlers): void {
  const nick = document.getElementById("nickname") as HTMLInputElement;
  nick.value = localStorage.getItem("bp_nick") ?? `pumper${(Math.random() * 1000) | 0}`;

  // --- Create-lobby modal: currency segment + stake picker -------------------
  const stakeEl = document.getElementById("stake-picker")!;
  let createCurrency = 0;
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
      b.addEventListener("click", () => h.create(makeChoice(s.v, createCurrency)));
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

  // --- Practice modal: difficulty + bot-count segments -----------------------
  let diff = 1;
  let bots = 3;
  const segPick = (group: HTMLElement, btn: HTMLElement): void => {
    for (const el of group.querySelectorAll(".seg-btn")) el.classList.remove("active");
    btn.classList.add("active");
  };
  const diffSeg = document.getElementById("diff-seg")!;
  diffSeg.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-diff]");
    if (!btn) return;
    diff = Number(btn.dataset.diff);
    segPick(diffSeg, btn);
  });
  const botsSeg = document.getElementById("bots-seg")!;
  botsSeg.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-bots]");
    if (!btn) return;
    bots = Number(btn.dataset.bots);
    segPick(botsSeg, btn);
  });
  document.getElementById("practice-play")!.addEventListener("click", () => {
    h.practice(makeChoice(0), diff, bots);
  });
}

/** Currency-category filter for the public tables browser. */
type TableFilter = "all" | "free" | "chips" | "token";
let tableFilter: TableFilter = "all";
/** Sort order for the browser. */
type TableSort = "stake-desc" | "stake-asc" | "players-desc" | "players-asc";
let tableSort: TableSort = "players-desc";
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

  // Filter chips by currency category — only show categories actually present,
  // each with the CORRECT symbol (🆓 free / 🪙 chips / 💎 token).
  const hasFree = lastTables.some((t) => t.stake === 0);
  const hasChips = lastTables.some((t) => t.currency === 0 && t.stake > 0);
  const hasToken = lastTables.some((t) => t.currency === 1);
  const chips: Array<{ v: TableFilter; label: string }> = [{ v: "all", label: "All" }];
  if (hasFree) chips.push({ v: "free", label: "🆓 Free" });
  if (hasChips) chips.push({ v: "chips", label: "🪙 Chips" });
  if (hasToken) chips.push({ v: "token", label: "💎 Token" });
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

  // Clickable column headers (CS-style): tap a column to sort, tap again to flip.
  if (head) {
    head.className = "table-head";
    head.classList.toggle("hidden", lastTables.length === 0);
    head.innerHTML = "";
    const arrow = (asc: TableSort, desc: TableSort) =>
      tableSort === desc ? " ↓" : tableSort === asc ? " ↑" : "";
    const th = (text: string, toggle?: () => void) => {
      const s = document.createElement("span");
      s.textContent = text;
      if (toggle) {
        s.className = "th sortable";
        s.addEventListener("click", () => {
          toggle();
          drawTables();
        });
      } else s.className = "th";
      return s;
    };
    head.append(
      th("Stake" + arrow("stake-asc", "stake-desc"), () => {
        tableSort = tableSort === "stake-desc" ? "stake-asc" : "stake-desc";
      }),
      th("Players" + arrow("players-asc", "players-desc"), () => {
        tableSort = tableSort === "players-desc" ? "players-asc" : "players-desc";
      }),
      th(""),
    );
  }

  const matchesFilter = (t: TableInfo): boolean => {
    switch (tableFilter) {
      case "free": return t.stake === 0;
      case "chips": return t.currency === 0 && t.stake > 0;
      case "token": return t.currency === 1;
      default: return true; // "all"
    }
  };
  const shown = lastTables.filter(matchesFilter).slice();
  shown.sort((a, b) => {
    switch (tableSort) {
      case "stake-desc": return b.stake - a.stake || b.players - a.players;
      case "stake-asc": return a.stake - b.stake || b.players - a.players;
      case "players-asc": return a.players - b.players || b.stake - a.stake;
      default: return b.players - a.players || b.stake - a.stake; // players-desc
    }
  });
  list.innerHTML = "";
  if (shown.length === 0) {
    list.innerHTML = '<div class="status">No open tables here — start one!</div>';
    return;
  }
  for (const t of shown) {
    const row = document.createElement("button");
    row.className = "table-row" + (t.live ? " live" : "");
    const sym = t.currency === 1 ? "💎" : "🪙";
    const isToken = t.currency === 1;
    const potVal = t.stake * t.players; // total on the line right now
    const usd = isToken ? usdSuffix(potVal) : "";
    // Buy-in (the stake one player puts up) — the headline figure.
    const stakeTag = t.stake > 0 ? `${sym}${t.stake.toLocaleString()}` : "🆓 FREE";
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
    typeEl.textContent =
      state.roomStake > 0
        ? isToken
          ? "💎 Token Arena"
          : "🪙 Chips Table"
        : "🆓 Casual Match";
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
    const av = skinAvatar(p.skin, PLAYER_COLORS[p.id % PLAYER_COLORS.length]);
    av.classList.add("seat-av");
    li.appendChild(av);
    const name = document.createElement("div");
    name.className = "seat-name";
    name.textContent = p.name + (p.id === state.myId ? " (you)" : "");
    li.appendChild(name);
    const badges = document.createElement("div");
    badges.className = "seat-badges";
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
      kick.className = "kick-btn";
      kick.textContent = "✕";
      kick.title = "Kick player";
      kick.addEventListener("click", (e) => {
        e.stopPropagation();
        onKick(p.id);
      });
      li.appendChild(kick);
    }
    list.appendChild(li);
  }
  // Empty seats — first one invites, the rest say "waiting".
  for (let i = count; i < MAX_PLAYERS_PER_ROOM; i++) {
    const li = document.createElement("li");
    li.className = "seat empty";
    const first = i === count;
    li.innerHTML = `<div class="seat-empty">${first ? "＋ Invite a friend" : "Waiting…"}</div>`;
    if (first) li.addEventListener("click", () => document.getElementById("copy-invite")?.click());
    list.appendChild(li);
  }

  // --- Match settings (read-only for now; host-editable in a later step) ----
  const settings = document.getElementById("room-settings");
  if (settings) {
    const mins = Math.round(MATCH_LENGTH_MS / 60000);
    settings.innerHTML =
      `<span class="setting-chip">⏱ ${mins}:00</span>` +
      `<span class="setting-chip">🗺 Mode: Last Man Standing</span>` +
      `<span class="setting-hint">${state.isHost ? "you can change these soon" : "host decides"}</span>`;
  }

  // --- Prize / what's on the line ------------------------------------------
  const prize = document.getElementById("room-prize");
  if (prize) {
    if (state.roomStake > 0) {
      const pot = state.roomStake * Math.max(count, 1);
      const usd = isToken ? usdSuffix(pot).trim().replace("≈", "≈ ") : "";
      prize.className = "room-prize " + (isToken ? "prize-token" : "prize-chips");
      prize.innerHTML =
        `<div class="prize-label">PRIZE POOL</div>` +
        `<div class="prize-pot">${sym}${pot.toLocaleString()}</div>` +
        (usd ? `<div class="prize-usd">${usd}</div>` : "") +
        `<div class="prize-meta">Buy-in ${sym}${state.roomStake.toLocaleString()} / player</div>` +
        `<div class="prize-rule">🏆 Winner takes the pot</div>`;
    } else {
      prize.className = "room-prize prize-free";
      prize.innerHTML =
        `<div class="prize-label">CASUAL</div>` +
        `<div class="prize-pot">🆓</div>` +
        `<div class="prize-meta">Play for fun — no stakes</div>`;
    }
  }

  // --- Left rail: your character (animated — runs on the spot, turning) -----
  const me0 = state.roomPlayers.find((p) => p.id === state.myId);
  if (me0) {
    animateSkin(me0.skin);
    const skinNm = document.getElementById("skin-name");
    if (skinNm) skinNm.textContent = skinName(me0.skin);
  }

  document.getElementById("room-stake")?.classList.add("hidden");

  const readyCount = state.roomPlayers.filter((p) => p.ready).length;
  const status = document.getElementById("room-status")!;
  const allReady = count >= MIN_PLAYERS_TO_START && readyCount === count;
  const cdLeft = Math.ceil(state.lobbyCountdownLeft() / 1000);
  if (cdLeft > 0 && !allReady) {
    // Enough players are ready — counting down; stragglers get dropped at zero.
    status.textContent = `⏱ Starting in ${cdLeft}s — ready up or you'll be dropped!`;
  } else if (count < MIN_PLAYERS_TO_START) {
    status.textContent = `Waiting for players… ${count}/${MAX_PLAYERS_PER_ROOM}`;
  } else if (allReady) {
    status.textContent = `All ready — starting!`;
  } else {
    status.textContent = `${readyCount}/${count} ready — waiting for everyone to ready up`;
  }

  // Ready button reflects the local player's state.
  const me = state.roomPlayers.find((p) => p.id === state.myId);
  const readyBtn = document.getElementById("ready-btn") as HTMLButtonElement;
  if (readyBtn && me) {
    readyBtn.textContent = me.ready ? "✅ Ready — waiting…" : "Ready up";
    readyBtn.dataset.on = String(me.ready);
  }

  const startBtn = document.getElementById("start-now") as HTMLButtonElement;
  startBtn.classList.toggle("hidden", !state.isHost);
  startBtn.disabled = !allReady; // start only once everyone has readied up
}

export function showResult(title: string): void {
  const el = document.getElementById("result-title");
  if (el) el.textContent = title;
  showScreen("result");
}
