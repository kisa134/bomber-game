import { PLAYER_COLORS, skinAvatar } from "../game/renderer.js";
import { MIN_PLAYERS_TO_START, MAX_PLAYERS_PER_ROOM, BET_SIZES, TOKEN_BET_SIZES } from "../net/protocol.js";

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

/** How the room screen opens a public profile (wired from main). */
let onOpenProfile: (wallet: string) => void = () => {};
export function setProfileHandler(fn: (wallet: string) => void): void {
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
  | "room"
  | "game"
  | "result";
const SCREENS: ScreenName[] = [
  "loading",
  "menu",
  "settings",
  "profile",
  "leaderboard",
  "room",
  "game",
  "result",
];

export function showScreen(name: ScreenName): void {
  for (const id of SCREENS) {
    document.getElementById(id)?.classList.toggle("hidden", id !== name);
  }
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
  quickplay: (c: Choice) => void;
  practice: (c: Choice, difficulty: number) => void;
  create: (c: Choice) => void;
  join: (c: Choice, code: string) => void;
  tables: () => void; // open/refresh the public tables list
}

export function setupMenu(h: MenuHandlers): void {
  const nick = document.getElementById("nickname") as HTMLInputElement;
  const joinCode = document.getElementById("join-code") as HTMLInputElement;
  const stakeEl = document.getElementById("stake-picker")!;
  const stakeGroup = document.getElementById("stake-group")!;

  nick.value = localStorage.getItem("bp_nick") ?? `pumper${(Math.random() * 1000) | 0}`;

  const choice = (stake: number, currency = 0): Choice => {
    const name = nick.value.trim() || "pumper";
    localStorage.setItem("bp_nick", name);
    return { name, skin: Math.floor(Math.random() * 4), stake, currency };
  };

  // Create flow: pick a currency (chips/token) then a stake = create at that stake.
  let createCurrency = 0;
  const renderStakes = (): void => {
    const tiers =
      createCurrency === 1
        ? TOKEN_BET_SIZES.map((v) => ({ v, label: `💎${v.toLocaleString()}` }))
        : [{ v: 0, label: "Casual" }, ...BET_SIZES.map((v) => ({ v, label: `🪙${v}` }))];
    stakeEl.innerHTML = "";
    for (const s of tiers) {
      const b = document.createElement("button");
      b.className = "stake-btn";
      b.textContent = s.label;
      b.addEventListener("click", () => h.create(choice(s.v, createCurrency)));
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

  // "Create a table" reveals the stake choices (pick one = create at that stake).
  document.getElementById("create-room")!.addEventListener("click", () => {
    stakeGroup.classList.toggle("hidden");
  });
  document.getElementById("quickplay")!.addEventListener("click", () => h.quickplay(choice(0)));
  document.getElementById("practice-easy")!.addEventListener("click", () => h.practice(choice(0), 0));
  document.getElementById("practice-normal")!.addEventListener("click", () => h.practice(choice(0), 1));
  document.getElementById("practice-hard")!.addEventListener("click", () => h.practice(choice(0), 2));
  document.getElementById("open-tables")!.addEventListener("click", () => h.tables());
  document.getElementById("join-room")!.addEventListener("click", () => {
    const code = joinCode.value.trim().toUpperCase();
    if (code.length < 3) {
      setMenuStatus("Enter a room code");
      return;
    }
    h.join(choice(0), code);
  });
}

/** Stake filter for the public tables browser (-1 = show all). */
let tableFilter = -1;
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
  if (!list || !filter) return;

  // Filter chips: All + each stake currently present among open tables.
  const stakes = Array.from(new Set(lastTables.map((t) => t.stake))).sort((a, b) => a - b);
  const chips: Array<{ v: number; label: string }> = [
    { v: -1, label: "All" },
    ...stakes.map((s) => ({ v: s, label: s > 0 ? `🪙${s}` : "Casual" })),
  ];
  filter.classList.toggle("hidden", lastTables.length === 0);
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

  const shown = tableFilter === -1 ? lastTables : lastTables.filter((t) => t.stake === tableFilter);
  list.innerHTML = "";
  if (shown.length === 0) {
    list.innerHTML = '<div class="status">No open tables here — start one!</div>';
    return;
  }
  for (const t of shown) {
    const row = document.createElement("button");
    row.className = "table-row" + (t.live ? " live" : "");
    const sym = t.currency === 1 ? "💎" : "🪙";
    const pot = t.stake > 0 ? ` · pot ${sym}${(t.stake * t.players).toLocaleString()}` : "";
    const action = t.live ? "👁 Watch" : "Join";
    const label = t.live ? "🔴 LIVE" : stakeLabel(t.stake, t.currency);
    row.innerHTML = `<span>${label}${pot}</span><span>${t.players}/${t.max}</span><span>${action}</span>`;
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
    if (p.wallet) {
      li.style.cursor = "pointer";
      li.title = "View profile";
      li.addEventListener("click", () => onOpenProfile(p.wallet));
    }
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
