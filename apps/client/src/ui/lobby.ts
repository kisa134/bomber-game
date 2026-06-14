import { SKIN_EMOJI } from "../game/renderer.js";

export type ScreenName = "lobby" | "game" | "result";

export function showScreen(name: ScreenName): void {
  for (const id of ["lobby", "game", "result"] as ScreenName[]) {
    document.getElementById(id)?.classList.toggle("hidden", id !== name);
  }
}

export interface LobbyChoice {
  name: string;
  skin: number;
}

/** Wire up the lobby screen. Calls onPlay with the chosen nickname + skin. */
export function setupLobby(onPlay: (choice: LobbyChoice) => void): void {
  const nickInput = document.getElementById("nickname") as HTMLInputElement;
  const skinsEl = document.getElementById("skins")!;
  const playBtn = document.getElementById("quickplay") as HTMLButtonElement;
  const status = document.getElementById("lobby-status")!;

  nickInput.value = localStorage.getItem("bp_nick") ?? `pumper${(Math.random() * 1000) | 0}`;

  let selectedSkin = Number(localStorage.getItem("bp_skin") ?? 0);
  skinsEl.innerHTML = "";
  SKIN_EMOJI.forEach((emoji, i) => {
    const el = document.createElement("div");
    el.className = "skin" + (i === selectedSkin ? " selected" : "");
    el.textContent = emoji;
    el.addEventListener("click", () => {
      selectedSkin = i;
      skinsEl.querySelectorAll(".skin").forEach((s, j) => s.classList.toggle("selected", j === i));
    });
    skinsEl.appendChild(el);
  });

  playBtn.addEventListener("click", () => {
    const name = nickInput.value.trim() || "pumper";
    localStorage.setItem("bp_nick", name);
    localStorage.setItem("bp_skin", String(selectedSkin));
    status.textContent = "Connecting…";
    playBtn.disabled = true;
    onPlay({ name, skin: selectedSkin });
  });
}

export function setLobbyStatus(text: string): void {
  const status = document.getElementById("lobby-status");
  if (status) status.textContent = text;
  const playBtn = document.getElementById("quickplay") as HTMLButtonElement | null;
  if (playBtn) playBtn.disabled = false;
}

export function showResult(title: string): void {
  const el = document.getElementById("result-title");
  if (el) el.textContent = title;
  showScreen("result");
}
