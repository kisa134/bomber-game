import {
  ServerMsg,
  MatchPhase,
  DRAW_WINNER_ID,
  TICK_MS,
} from "./net/protocol.js";
import { Net, quickplay } from "./net/socket.js";
import { GameState } from "./game/state.js";
import { Renderer, PLAYER_COLORS, SKIN_EMOJI } from "./game/renderer.js";
import { Input } from "./game/input.js";
import { Assets } from "./game/assets.js";
import { setupLobby, setLobbyStatus, showScreen, showResult } from "./ui/lobby.js";

const state = new GameState();
const net = new Net();
const input = new Input();
const assets = new Assets();
let renderer: Renderer | null = null;
let inputTimer: ReturnType<typeof setInterval> | null = null;

const timerEl = document.getElementById("timer")!;
const playersEl = document.getElementById("players")!;
const pingEl = document.getElementById("ping")!;

function startGame(): void {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (!renderer) {
    renderer = new Renderer(canvas);
    renderer.setAssets(assets);
  }
  renderer.resize();
  showScreen("game");

  inputTimer = setInterval(() => net.sendMove(input.dir), TICK_MS);
}

input.onBomb = () => {
  net.sendBomb();
  assets.play("place");
};

net.onMessage = (msg) => {
  switch (msg.type) {
    case ServerMsg.WELCOME:
      state.myId = msg.playerId;
      state.gridW = msg.gridW;
      state.gridH = msg.gridH;
      break;
    case ServerMsg.STATE_SNAPSHOT:
      state.addSnapshot(msg);
      break;
    case ServerMsg.MATCH_PHASE:
      state.setPhase(msg.phase, msg.timerMs);
      break;
    case ServerMsg.MATCH_END:
      state.winnerId = msg.winnerId;
      announceResult(msg.winnerId);
      break;
    case ServerMsg.PONG:
      state.pingMs = Math.round(performance.now() - msg.timestamp);
      break;
    // Visual state comes from the grid snapshot; events drive sound effects.
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

net.onClose = () => {
  if (inputTimer) clearInterval(inputTimer);
  inputTimer = null;
};

function announceResult(winnerId: number): void {
  let title: string;
  if (winnerId === DRAW_WINNER_ID) title = "Draw!";
  else if (winnerId === state.myId) title = "🏆 You win!";
  else title = `${SKIN_EMOJI[winnerId % SKIN_EMOJI.length]} Player ${winnerId} wins`;
  setTimeout(() => showResult(title), 1200);
}

// --- HUD ------------------------------------------------------------------

function updateHud(): void {
  const left = Math.ceil(state.phaseTimeLeft() / 1000);
  if (state.phase === MatchPhase.COUNTDOWN) {
    timerEl.textContent = left > 0 ? String(left) : "GO";
  } else {
    timerEl.textContent = String(left);
  }
  timerEl.style.color = state.phase === MatchPhase.SUDDEN_DEATH ? "#ff6b6b" : "";

  pingEl.textContent = `${state.pingMs} ms`;

  const snap = state.latest();
  if (snap) {
    playersEl.innerHTML = "";
    for (const p of snap.players) {
      const card = document.createElement("div");
      card.className = "pcard" + (p.alive ? "" : " dead");
      const dot = document.createElement("span");
      dot.className = "pdot";
      dot.style.background = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
      card.appendChild(dot);
      const txt = document.createElement("span");
      txt.textContent = `💣${p.bombsMax} 🔥${p.power}${p.kick ? " 🦵" : ""}`;
      card.appendChild(txt);
      playersEl.appendChild(card);
    }
  }
}

// --- Main loop ------------------------------------------------------------

function frame(): void {
  const now = performance.now();
  if (renderer && (state.phase !== MatchPhase.LOBBY)) {
    renderer.render(state.view(now), state.myId);
    updateHud();
  }
  requestAnimationFrame(frame);
}

// --- Bootstrap ------------------------------------------------------------

input.attach();
void assets.preload();
setupLobby(async (choice) => {
  try {
    const { token } = await quickplay(choice.name);
    net.onOpen = () => {
      setLobbyStatus("");
      startGame();
    };
    net.connect(token);
  } catch (err) {
    setLobbyStatus(`Failed to connect: ${(err as Error).message}`);
  }
});

document.getElementById("play-again")?.addEventListener("click", () => {
  net.close();
  state.reset();
  input.reset();
  showScreen("lobby");
  setLobbyStatus("");
});

showScreen("lobby");
requestAnimationFrame(frame);
