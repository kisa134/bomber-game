import { PLAYER_COLORS, skinAvatar } from "../game/renderer.js";
import { MIN_PLAYERS_TO_START, MAX_PLAYERS_PER_ROOM, BET_SIZES, TOKEN_BET_SIZES, SKIN_COUNT } from "../net/protocol.js";

/** Format a stake with its currency symbol (💎 token / 🪙 chips). */
function stakeLabel(stake: number, currency: number): string {
  if (stake <= 0) return "Casual";
  return `${currency === 1 ? "💎" : "🪙"}${stake.toLocaleString()}`;
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
  const codeBox = document.getElementById("room-code-box")!;
  const codeEl = document.getElementById("room-code")!;
  codeEl.textContent = state.roomCode;
  codeBox.classList.toggle("hidden", !state.roomCode);

  const title = document.getElementById("room-title");
  if (title) {
    const n = state.roomPlayers.length || 1;
    const sym = state.roomCurrency === 1 ? "💎" : "🪙";
    const pot = state.roomStake * n;
    const potUsd = state.roomCurrency === 1 ? usdSuffix(pot) : "";
    title.textContent =
      state.roomStake > 0
        ? `${stakeLabel(state.roomStake, state.roomCurrency)} table · pot ${sym}${pot.toLocaleString()}${potUsd}`
        : "Waiting room";
  }

  const seriesOn = state.roomPlayers.some((p) => p.wins > 0);
  const list = document.getElementById("room-players")!;
  list.innerHTML = "";
  for (const p of state.roomPlayers) {
    const li = document.createElement("li");
    li.appendChild(skinAvatar(p.skin, PLAYER_COLORS[p.id % PLAYER_COLORS.length]));
    const name = document.createElement("span");
    name.textContent = p.name + (p.id === state.myId ? " (you)" : "");
    li.appendChild(name);
    li.style.cursor = "pointer";
    li.title = "View card";
    li.addEventListener("click", () => onOpenProfile(p));
    if (seriesOn) {
      const wins = document.createElement("span");
      wins.className = "win-tag";
      wins.textContent = `🏆 ${p.wins}`;
      li.appendChild(wins);
    }
    if (p.id === state.hostId) {
      const tag = document.createElement("span");
      tag.className = "host-tag";
      tag.textContent = "HOST";
      li.appendChild(tag);
    }
    const ready = document.createElement("span");
    ready.className = "ready-tag" + (p.ready ? " on" : "");
    ready.textContent = p.ready ? "✅ READY" : "…";
    ready.style.marginLeft = state.hostId === p.id ? "8px" : "auto";
    li.appendChild(ready);
    list.appendChild(li);
  }

  // The stake is fixed when the table is created — shown read-only in the title.
  document.getElementById("room-stake")?.classList.add("hidden");

  const count = state.roomPlayers.length;
  const readyCount = state.roomPlayers.filter((p) => p.ready).length;
  const status = document.getElementById("room-status")!;
  const allReady = count >= MIN_PLAYERS_TO_START && readyCount === count;
  if (count < MIN_PLAYERS_TO_START) {
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
