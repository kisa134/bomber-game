// Admin "character cards" page — a standalone marketing tool. Shows a live
// animated card for every character; each can be downloaded as an animated GIF
// or a still PNG. Not linked from the game; reachable directly at /admin.html.
import {
  SKIN_NAMES, rarityOf, STEPS, FRAME_MS,
  loadCharFrames, buildBase, drawFrame, exportGif, exportPng,
  type CharFrames,
} from "./cards.js";
import "./admin.css";

const PREVIEW = 360; // on-screen canvas size (CSS-scaled)
const EXPORT = 720; // GIF/PNG render size
const DEFAULT_LINK = "https://bombermeme.fun";

interface Card {
  index: number;
  frames: CharFrames;
  ctx: CanvasRenderingContext2D;
  base: HTMLCanvasElement;
}

const cards: Card[] = [];
let link = DEFAULT_LINK;

function download(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function slug(i: number): string {
  return SKIN_NAMES[i].toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function build(): Promise<void> {
  const grid = document.getElementById("grid")!;
  grid.textContent = "";

  for (let i = 0; i < SKIN_NAMES.length; i++) {
    const frames = await loadCharFrames(i);
    const { color } = rarityOf(i);

    const cell = document.createElement("div");
    cell.className = "adm-card";
    cell.style.setProperty("--accent", color);

    const cv = document.createElement("canvas");
    cv.width = cv.height = PREVIEW;
    cv.className = "adm-canvas";
    const ctx = cv.getContext("2d")!;

    const actions = document.createElement("div");
    actions.className = "adm-actions";
    const gifBtn = document.createElement("button");
    gifBtn.textContent = "⬇️ GIF";
    const pngBtn = document.createElement("button");
    pngBtn.textContent = "⬇️ PNG";
    actions.append(gifBtn, pngBtn);

    cell.append(cv, actions);
    grid.append(cell);

    const card: Card = { index: i, frames, ctx, base: buildBase(i, PREVIEW, link) };
    cards.push(card);

    gifBtn.onclick = () => {
      gifBtn.disabled = true;
      gifBtn.textContent = "…";
      // let the button repaint before the (sync) encode blocks the thread
      setTimeout(() => {
        try {
          const blob = exportGif(i, frames, EXPORT, link);
          download(blob, `bombermeme-${slug(i)}.gif`);
        } finally {
          gifBtn.disabled = false;
          gifBtn.textContent = "⬇️ GIF";
        }
      }, 30);
    };
    pngBtn.onclick = async () => {
      pngBtn.disabled = true;
      const blob = await exportPng(i, frames, EXPORT, link);
      download(blob, `bombermeme-${slug(i)}.png`);
      pngBtn.disabled = false;
    };
  }

  startLoop();
}

function rebuildBases(): void {
  for (const c of cards) c.base = buildBase(c.index, PREVIEW, link);
}

let step = 0;
let lastAt = 0;
function startLoop(): void {
  const tick = (now: number): void => {
    if (now - lastAt >= FRAME_MS) {
      lastAt = now;
      step = (step + 1) % STEPS;
      for (const c of cards) drawFrame(c.ctx, c.base, c.frames, step, PREVIEW);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function wireControls(): void {
  const input = document.getElementById("link") as HTMLInputElement;
  const apply = document.getElementById("apply")!;
  const dlAll = document.getElementById("dl-all")!;
  input.value = link;

  const applyLink = (): void => {
    const v = input.value.trim();
    if (!v) return;
    link = v;
    rebuildBases();
  };
  apply.onclick = applyLink;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") applyLink(); });

  dlAll.onclick = async () => {
    (dlAll as HTMLButtonElement).disabled = true;
    const orig = dlAll.textContent;
    for (let i = 0; i < cards.length; i++) {
      dlAll.textContent = `⬇️ ${i + 1}/${cards.length}…`;
      const blob = exportGif(i, cards[i].frames, EXPORT, link);
      download(blob, `bombermeme-${slug(i)}.gif`);
      await new Promise((r) => setTimeout(r, 350)); // stagger downloads
    }
    dlAll.textContent = orig;
    (dlAll as HTMLButtonElement).disabled = false;
  };
}

wireControls();
void build();
