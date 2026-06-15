import { PLAYER_COLORS, SKIN_EMOJI, skinAvatar } from "../game/renderer.js";
import { MIN_PLAYERS_TO_START, MAX_PLAYERS_PER_ROOM } from "../net/protocol.js";
import type { GameState } from "../game/state.js";

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
}

export interface MenuHandlers {
  quickplay: (c: Choice) => void;
  practice: (c: Choice) => void;
  create: (c: Choice) => void;
  join: (c: Choice, code: string) => void;
}

export function setupMenu(h: MenuHandlers): void {
  const nick = document.getElementById("nickname") as HTMLInputElement;
  const skinsEl = document.getElementById("skins")!;
  const joinCode = document.getElementById("join-code") as HTMLInputElement;

  nick.value = localStorage.getItem("bp_nick") ?? `pumper${(Math.random() * 1000) | 0}`;
  let skin = Number(localStorage.getItem("bp_skin") ?? 0);

  skinsEl.innerHTML = "";
  SKIN_EMOJI.forEach((_emoji, i) => {
    const el = document.createElement("div");
    el.className = "skin" + (i === skin ? " selected" : "");
    el.appendChild(skinAvatar(i, PLAYER_COLORS[i % PLAYER_COLORS.length]));
    el.addEventListener("click", () => {
      skin = i;
      skinsEl.querySelectorAll(".skin").forEach((s, j) => s.classList.toggle("selected", j === i));
    });
    skinsEl.appendChild(el);
  });

  const choice = (): Choice => {
    const name = nick.value.trim() || "pumper";
    localStorage.setItem("bp_nick", name);
    localStorage.setItem("bp_skin", String(skin));
    return { name, skin };
  };

  document.getElementById("quickplay")!.addEventListener("click", () => h.quickplay(choice()));
  document.getElementById("practice")!.addEventListener("click", () => h.practice(choice()));
  document.getElementById("create-room")!.addEventListener("click", () => h.create(choice()));
  document.getElementById("join-room")!.addEventListener("click", () => {
    const code = joinCode.value.trim().toUpperCase();
    if (code.length < 3) {
      setMenuStatus("Enter a room code");
      return;
    }
    h.join(choice(), code);
  });
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

  const seriesOn = state.roomPlayers.some((p) => p.wins > 0);
  const list = document.getElementById("room-players")!;
  list.innerHTML = "";
  for (const p of state.roomPlayers) {
    const li = document.createElement("li");
    li.appendChild(skinAvatar(p.skin, PLAYER_COLORS[p.id % PLAYER_COLORS.length]));
    const name = document.createElement("span");
    name.textContent = p.name + (p.id === state.myId ? " (you)" : "");
    li.appendChild(name);
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

  const count = state.roomPlayers.length;
  const readyCount = state.roomPlayers.filter((p) => p.ready).length;
  const status = document.getElementById("room-status")!;
  const countdown = Math.ceil(state.lobbyCountdownLeft() / 1000);
  if (count < MIN_PLAYERS_TO_START) {
    status.textContent = `Waiting for players… ${count}/${MAX_PLAYERS_PER_ROOM}`;
  } else if (countdown > 0) {
    status.textContent = `Starting in ${countdown}… (${readyCount}/${count} ready)`;
  } else {
    status.textContent = `${readyCount}/${count} ready — all ready to start`;
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
  startBtn.disabled = count < MIN_PLAYERS_TO_START;
}

export function showResult(title: string): void {
  const el = document.getElementById("result-title");
  if (el) el.textContent = title;
  showScreen("result");
}
