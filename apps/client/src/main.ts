import { ServerMsg, MatchPhase, TileType, DRAW_WINNER_ID } from "./net/protocol.js";
import { Net, quickplay, createRoom, joinRoom, type JoinResponse } from "./net/socket.js";
import { GameState } from "./game/state.js";
import { Renderer, PLAYER_COLORS } from "./game/renderer.js";
import { Input } from "./game/input.js";
import { Assets } from "./game/assets.js";
import { Predictor } from "./game/prediction.js";
import { loadSettings, saveSettings, type Settings } from "./settings.js";
import { setupMenu, setMenuStatus, showScreen, showResult, renderRoom } from "./ui/lobby.js";

const state = new GameState();
const net = new Net();
const input = new Input();
const assets = new Assets();
const predictor = new Predictor();
const settings = loadSettings();

let renderer: Renderer | null = null;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let lastFrame = performance.now();
let currentTrack: "lobby" | "battle" = "lobby";
let lastCountSec = -1;
let prevSoftCount = -1;
let prevPlayerCount = 0;

const timerEl = document.getElementById("timer")!;
const playersEl = document.getElementById("players")!;
const pingEl = document.getElementById("ping")!;

const inGame = (p: MatchPhase) =>
  p === MatchPhase.COUNTDOWN || p === MatchPhase.PLAYING || p === MatchPhase.SUDDEN_DEATH;
const isLive = (p: MatchPhase) => p === MatchPhase.PLAYING || p === MatchPhase.SUDDEN_DEATH;

function music(track: "lobby" | "battle"): void {
  currentTrack = track;
  assets.playMusic(track);
}

// --- networking -----------------------------------------------------------

function connect(getJoin: () => Promise<JoinResponse>): void {
  showScreen("loading");
  document.getElementById("loading-status")!.textContent = "connecting…";
  getJoin()
    .then(({ token }) => net.connect(token))
    .catch((err) => {
      showScreen("menu");
      setMenuStatus(`Failed: ${(err as Error).message}`);
    });
}

net.onClose = () => {
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = null;
  showScreen("menu");
  music("lobby");
  setMenuStatus("Disconnected");
};

net.onMessage = (msg) => {
  switch (msg.type) {
    case ServerMsg.WELCOME:
      state.myId = msg.playerId;
      break;
    case ServerMsg.ROOM_INFO: {
      const count = msg.players.length;
      if (count > prevPlayerCount && prevPlayerCount > 0) assets.play("join", 0.4);
      prevPlayerCount = count;
      state.setRoomInfo(msg);
      if (!inGame(state.phase)) {
        showScreen("room");
        renderRoom(state);
        music("lobby");
      }
      break;
    }
    case ServerMsg.STATE_SNAPSHOT: {
      state.addSnapshot(msg);
      const me = msg.players.find((p) => p.id === state.myId);
      if (me) predictor.reconcile(me.x, me.y, me.speed, me.alive, msg.grid);
      // Soft-block break sound (derived from the grid diff).
      let soft = 0;
      for (let i = 0; i < msg.grid.length; i++) if (msg.grid[i] === TileType.SOFT) soft++;
      if (prevSoftCount >= 0 && soft < prevSoftCount) assets.play("block_break", 0.35);
      prevSoftCount = soft;
      break;
    }
    case ServerMsg.MATCH_PHASE:
      state.setPhase(msg.phase, msg.timerMs);
      if (msg.phase === MatchPhase.COUNTDOWN) {
        enterGame();
        lastCountSec = -1;
      } else if (msg.phase === MatchPhase.PLAYING) {
        assets.play("go", 0.5);
      } else if (msg.phase === MatchPhase.SUDDEN_DEATH) {
        assets.play("sudden_death", 0.5);
      } else if (msg.phase === MatchPhase.LOBBY) {
        prevSoftCount = -1;
        showScreen("room");
        renderRoom(state);
        music("lobby");
      }
      break;
    case ServerMsg.MATCH_END:
      state.winnerId = msg.winnerId;
      announceResult(msg.winnerId);
      break;
    case ServerMsg.PONG:
      state.pingMs = Math.round(performance.now() - msg.timestamp);
      break;
    case ServerMsg.EVENT_EXPLOSION:
      assets.play("explode", 0.4);
      break;
    case ServerMsg.EVENT_PICKUP:
      assets.play("pickup");
      break;
    case ServerMsg.EVENT_PLAYER_DEATH:
      assets.play("death");
      break;
    default:
      break;
  }
};

// --- game lifecycle -------------------------------------------------------

function enterGame(): void {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (!renderer) {
    renderer = new Renderer(canvas);
    renderer.setAssets(assets);
  }
  renderer.resize();
  predictor.reset();
  prevSoftCount = -1;
  showScreen("game");
  music("battle");
  if (!keepAlive) keepAlive = setInterval(() => net.sendMove(input.dir), 150);
}

function announceResult(winnerId: number): void {
  let title: string;
  if (winnerId === DRAW_WINNER_ID) {
    title = "🤝 Draw!";
    assets.play("draw", 0.6);
  } else if (winnerId === state.myId) {
    title = "🏆 You win!";
    assets.play("victory", 0.6);
  } else {
    title = `${state.nameOf(winnerId)} wins`;
    assets.play("defeat", 0.6);
  }
  music("lobby");
  setTimeout(() => showResult(title), 1000);
}

input.onChange = (dir) => net.sendMove(dir);
input.onBomb = () => {
  net.sendBomb();
  assets.play("place");
};

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
      assets.play("countdown", 0.5);
      lastCountSec = n;
    }
  } else {
    timerEl.textContent = fmtTime(state.phaseTimeLeft());
  }
  timerEl.style.color = state.phase === MatchPhase.SUDDEN_DEATH ? "#ff6b6b" : "";
  pingEl.textContent = `${state.pingMs} ms`;

  const snap = state.latest();
  if (!snap) return;
  playersEl.innerHTML = "";
  for (const p of snap.players) {
    const card = document.createElement("div");
    card.className = "pcard" + (p.alive ? "" : " dead");
    const dot = document.createElement("span");
    dot.className = "pdot";
    dot.style.background = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
    card.appendChild(dot);
    const txt = document.createElement("span");
    txt.textContent = `${state.nameOf(p.id)} 💣${p.bombsMax} 🔥${p.power}${p.kick ? " 🦵" : ""}`;
    card.appendChild(txt);
    playersEl.appendChild(card);
  }
}

// --- main loop ------------------------------------------------------------

function frame(): void {
  const now = performance.now();
  const dt = now - lastFrame;
  lastFrame = now;

  if (renderer && inGame(state.phase)) {
    if (isLive(state.phase)) predictor.step(dt, input.dir);
    const view = state.view(now);
    if (predictor.ready) {
      const me = view.players.find((p) => p.id === state.myId);
      if (me && me.alive) {
        me.x = predictor.x;
        me.y = predictor.y;
      }
    }
    renderer.render(view, state.myId);
    updateHud();
  } else if (state.phase === MatchPhase.LOBBY && !document.getElementById("room")!.classList.contains("hidden")) {
    renderRoom(state);
  }
  requestAnimationFrame(frame);
}

// --- settings -------------------------------------------------------------

function applySettings(): void {
  assets.setMusicEnabled(settings.music);
  assets.setSfxEnabled(settings.sfx);
  input.setControlScheme(settings.controls);
  syncSettingsUI();
}

function syncSettingsUI(): void {
  const m = document.getElementById("set-music") as HTMLButtonElement;
  const s = document.getElementById("set-sfx") as HTMLButtonElement;
  m.dataset.on = String(settings.music);
  m.textContent = settings.music ? "On" : "Off";
  s.dataset.on = String(settings.sfx);
  s.textContent = settings.sfx ? "On" : "Off";
  document.getElementById("ctl-joystick")!.classList.toggle("active", settings.controls === "joystick");
  document.getElementById("ctl-dpad")!.classList.toggle("active", settings.controls === "dpad");
}

function update<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings[key] = value;
  saveSettings(settings);
  applySettings();
}

function wireSettings(): void {
  document.getElementById("open-settings")!.addEventListener("click", () => showScreen("settings"));
  document.getElementById("settings-back")!.addEventListener("click", () => {
    showScreen("menu");
    music("lobby");
  });
  document.getElementById("set-music")!.addEventListener("click", () => update("music", !settings.music));
  document.getElementById("set-sfx")!.addEventListener("click", () => update("sfx", !settings.sfx));
  document.getElementById("ctl-joystick")!.addEventListener("click", () => update("controls", "joystick"));
  document.getElementById("ctl-dpad")!.addEventListener("click", () => update("controls", "dpad"));
}

// --- background video -----------------------------------------------------

function setupBackground(): void {
  const v = document.getElementById("bg-video") as HTMLVideoElement;
  const sources = ["/bg/menu.webm", "/bg/menu.mp4"];
  let i = 0;
  const tryNext = () => {
    if (i >= sources.length) return; // no bg; gradient stays
    v.src = sources[i++];
  };
  v.addEventListener("canplay", () => v.classList.add("ready"));
  v.addEventListener("error", tryNext);
  tryNext();
}

// --- bootstrap ------------------------------------------------------------

input.attach();
void assets.preload();
applySettings();
wireSettings();
setupBackground();

setupMenu({
  quickplay: (c) => connect(() => quickplay(c.name)),
  create: (c) => connect(() => createRoom(c.name)),
  join: (c, code) => connect(() => joinRoom(c.name, code)),
});

document.getElementById("start-now")!.addEventListener("click", () => net.sendStart());

function leaveToMenu(): void {
  net.close();
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

// UI click sound + kick music off the first user gesture (autoplay policy).
document.addEventListener("pointerdown", (e) => {
  const el = e.target as HTMLElement;
  if (el.closest("button") && !el.closest("#touch-controls")) assets.play("ui", 0.3);
});
document.addEventListener("pointerdown", () => assets.playMusic(currentTrack), { once: true });

showScreen("menu");
music("lobby");
requestAnimationFrame(frame);
