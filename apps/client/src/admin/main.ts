// Admin "character cards" marketing tool, embedded in the /admin dashboard via
// iframe (/cards.html). Pick an animation + background, preview every character
// live, then export each as an animated GIF / still PNG — or all of them as one
// ZIP.
import {
  SKIN_NAMES, rarityOf, RARITIES, MODES, BG_KINDS, modeById,
  loadSpriteSet, loadProps, buildBase, drawFrame, exportGif, exportPng,
  type SpriteSet, type Props, type Mode, type Rarity,
} from "./cards.js";
import { zipSync } from "fflate";
import "./admin.css";

const PREVIEW = 360;
const DEFAULT_LINK = "https://bombermeme.fun";

interface Card {
  index: number;
  set: SpriteSet;
  ctx: CanvasRenderingContext2D;
  base: HTMLCanvasElement;
}

const cards: Card[] = [];
let props: Props;
let link = DEFAULT_LINK;
let bgKind = BG_KINDS[0].id;
let mode: Mode = MODES[0];
let gifSize = 720;
let quality = "high";
let raritySel = "auto"; // "auto" = each character's own tier
let showLabel = true;

/** Resolve the rarity override (undefined = use each character's own tier). */
function rarityOverride(): Rarity | undefined {
  return raritySel === "auto" ? undefined : RARITIES.find((r) => r.name === raritySel);
}

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
function gifName(i: number): string {
  return `bombermeme-${slug(i)}-${mode.id}.gif`;
}

async function rebuildBases(): Promise<void> {
  await Promise.all(
    cards.map(async (c) => {
      c.base = await buildBase(c.index, PREVIEW, { link, bgKind, ring: mode.ring, props, rarity: rarityOverride(), showLabel });
    }),
  );
}

async function build(): Promise<void> {
  props = await loadProps();
  const grid = document.getElementById("grid")!;
  grid.textContent = "";

  for (let i = 0; i < SKIN_NAMES.length; i++) {
    const set = await loadSpriteSet(i);
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

    const base = await buildBase(i, PREVIEW, { link, bgKind, ring: mode.ring, props, rarity: rarityOverride(), showLabel });
    const card: Card = { index: i, set, ctx, base };
    cards.push(card);

    gifBtn.onclick = () => {
      gifBtn.disabled = true;
      gifBtn.textContent = "…";
      setTimeout(async () => {
        try {
          const bytes = await exportGif(i, set, props, mode, gifSize, { link, bgKind, quality, rarity: rarityOverride(), showLabel });
          download(new Blob([bytes.slice()], { type: "image/gif" }), gifName(i));
        } finally {
          gifBtn.disabled = false;
          gifBtn.textContent = "⬇️ GIF";
        }
      }, 30);
    };
    pngBtn.onclick = async () => {
      pngBtn.disabled = true;
      const blob = await exportPng(i, set, props, mode, gifSize, { link, bgKind, rarity: rarityOverride(), showLabel });
      download(blob, `bombermeme-${slug(i)}.png`);
      pngBtn.disabled = false;
    };
  }

  startLoop();
}

let step = 0;
let lastAt = 0;
function startLoop(): void {
  const tick = (now: number): void => {
    if (now - lastAt >= mode.frameMs) {
      lastAt = now;
      step++;
      for (const c of cards) drawFrame(c.ctx, c.base, c.set, props, mode, step, PREVIEW);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function makeSelect(id: string, options: Array<{ value: string; label: string }>, value: string): HTMLSelectElement {
  const sel = document.getElementById(id) as HTMLSelectElement;
  sel.innerHTML = options.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  sel.value = value;
  return sel;
}

function wireControls(): void {
  const input = document.getElementById("link") as HTMLInputElement;
  input.value = link;

  const animSel = makeSelect("anim", MODES.map((m) => ({ value: m.id, label: m.label })), mode.id);
  const bgSel = makeSelect("bg", BG_KINDS.map((b) => ({ value: b.id, label: b.label })), bgKind);
  const sizeSel = makeSelect("size", [
    { value: "480", label: "480 px" }, { value: "720", label: "720 px" }, { value: "1080", label: "1080 px" },
  ], String(gifSize));
  const qualSel = makeSelect("qual", [
    { value: "high", label: "High (256 colours)" },
    { value: "medium", label: "Medium (128)" },
    { value: "low", label: "Low (64 · smallest)" },
  ], quality);
  const raritySelEl = makeSelect("rarity", [
    { value: "auto", label: "Rarity: auto (per character)" },
    ...RARITIES.map((r) => ({ value: r.name, label: `Rarity: ${r.name}` })),
  ], raritySel);
  const labelChk = document.getElementById("showlabel") as HTMLInputElement;
  labelChk.checked = showLabel;

  raritySelEl.onchange = async () => { raritySel = raritySelEl.value; await rebuildBases(); };
  labelChk.onchange = async () => { showLabel = labelChk.checked; await rebuildBases(); };

  animSel.onchange = async () => {
    mode = modeById(animSel.value);
    step = 0;
    await rebuildBases(); // ring visibility depends on the mode
  };
  bgSel.onchange = async () => { bgKind = bgSel.value; await rebuildBases(); };
  sizeSel.onchange = () => { gifSize = parseInt(sizeSel.value, 10); };
  qualSel.onchange = () => { quality = qualSel.value; };

  const applyLink = async (): Promise<void> => {
    const val = input.value.trim();
    if (!val) return;
    link = val;
    await rebuildBases();
  };
  (document.getElementById("apply") as HTMLButtonElement).onclick = () => void applyLink();
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") void applyLink(); });

  const zipBtn = document.getElementById("dl-zip") as HTMLButtonElement;
  zipBtn.onclick = async () => {
    zipBtn.disabled = true;
    const orig = zipBtn.textContent;
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < cards.length; i++) {
      zipBtn.textContent = `📦 ${i + 1}/${cards.length}…`;
      files[gifName(i)] = await exportGif(i, cards[i].set, props, mode, gifSize, { link, bgKind, quality, rarity: rarityOverride(), showLabel });
      await new Promise((r) => setTimeout(r, 0)); // let the UI breathe
    }
    zipBtn.textContent = "📦 zipping…";
    const zipped = zipSync(files, { level: 0 }); // GIFs are already compressed
    download(new Blob([zipped.slice()], { type: "application/zip" }), `bombermeme-cards-${mode.id}.zip`);
    zipBtn.textContent = orig;
    zipBtn.disabled = false;
  };
}

wireControls();
void build();
