import { ServerMsg, MatchPhase, DRAW_WINNER_ID } from "./net/protocol.js";
import { Net, quickplay, createRoom, joinRoom, type JoinResponse } from "./net/socket.js";
import { GameState } from "./game/state.js";
import { Renderer, PLAYER_COLORS } from "./game/renderer.js";
import { Input } from "./game/input.js";
import { Assets } from "./game/assets.js";
import { Predictor } from "./game/prediction.js";
import {
  setupMenu,
  setMenuStatus,
  showScreen,
  showResult,
  renderRoom,
} from "./ui/lobby.js";

const state = new GameState();
const net = new Net();
const input = new Input();
const assets = new Assets();
const predictor = new Predictor();
let renderer: Renderer | null = null;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let lastFrame = performance.now();

const timerEl = document.getElementById("timer")!;
const playersEl = document.getElementById("players")!;
const pingEl = document.getElementById("ping")!;

const inGame = (p: MatchPhase) =>
  p === MatchPhase.COUNTDOWN || p === MatchPhase.PLAYING || p === MatchPhase.SUDDEN_DEATH;
const isLive = (p: MatchPhase) => p === MatchPhase.PLAYING || p === MatchPhase.SUDDEN_DEATH;

// --- networking -----------------------------------------------------------

function connect(getJoin: () => Promise<JoinResponse>): void {
  showScreen("loading");
  document.getElementById("loading-status")!.textContent = "connecting…";
  getJoin()
    .then(({ token }) => {
      net.connect(token);
    })
    .catch((err) => {
      showScreen("menu");
      setMenuStatus(`Failed: ${(err as Error).message}`);
    });
}

net.onClose = () => {
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = null;
  showScreen("menu");
  setMenuStatus("Disconnected");
};

net.onMessage = (msg) => {
  switch (msg.type) {
    case ServerMsg.WELCOME:
      state.myId = msg.playerId;
      break;
    case ServerMsg.ROOM_INFO:
      state.setRoomInfo(msg);
      if (!inGame(state.phase)) {
        showScreen("room");
        renderRoom(state);
      }
      break;
    case ServerMsg.STATE_SNAPSHOT: {
      state.addSnapshot(msg);
      const me = msg.players.find((p) => p.id === state.myId);
      if (me) predictor.reconcile(me.x, me.y, me.speed, me.alive, msg.grid);
      break;
    }
    case ServerMsg.MATCH_PHASE:
      state.setPhase(msg.phase, msg.timerMs);
      if (msg.phase === MatchPhase.COUNTDOWN) enterGame();
      else if (msg.phase === MatchPhase.LOBBY) {
        showScreen("room");
        renderRoom(state);
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
  showScreen("game");
  if (!keepAlive) keepAlive = setInterval(() => net.sendMove(input.dir), 150);
}

function announceResult(winnerId: number): void {
  let title: string;
  if (winnerId === DRAW_WINNER_ID) title = "🤝 Draw!";
  else if (winnerId === state.myId) title = "🏆 You win!";
  else title = `${state.nameOf(winnerId)} wins`;
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
  } else if (state.phase === MatchPhase.LOBBY) {
    renderRoom(state); // live-update countdown text
  }
  requestAnimationFrame(frame);
}

// --- bootstrap ------------------------------------------------------------

input.attach();
void assets.preload();

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
  showScreen("menu");
  setMenuStatus("");
}
document.getElementById("leave-room")!.addEventListener("click", leaveToMenu);
document.getElementById("result-leave")!.addEventListener("click", leaveToMenu);

showScreen("menu");
requestAnimationFrame(frame);
