// Character-card composer for the admin marketing kit. Each card is a square
// canvas: a selectable background, the character playing a selectable animation,
// the name + rarity, and a QR/link. The same draw routine powers both the live
// preview and the GIF/PNG/ZIP export, so what you see is what you download.
import qrcode from "qrcode-generator";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { ASSET_VER } from "../game/assets.js";

export const SKIN_NAMES = [
  "Shiba", "Pepe", "Trump", "Musk", "Doge", "Pump", "Durov", "Vitalik", "Troll", "Bogdanoff", "Gigachad",
  "Nyan", "Grumpy", "Harambe", "Shrek", "Fine Dog", "Wojak", "NPC", "Chad",
  "Doomer", "Bloomer", "Stonks", "Satoshi", "SBF", "CZ", "Laser Eyes", "WAGMI",
  "Diamond", "Rich Pepe", "Bonk", "WIF", "Popcat", "Titan", "Salt Bae", "Harold",
  "Paper Hands", "Moonboy", "Brett", "Andy", "GOAT", "Pnut", "Moodeng", "MEW",
  "Ponke", "Sigma", "Boomer", "Zoomer", "Chemist", "Galaxy Brain", "Cry Jordan", "Disaster",
  "Leeroy", "MLG", "Keanu", "Rick", "Crewmate", "Grogu", "Voxel", "Skibidi",
];

/** Rarity tier by index — mirrors the shop, drives the card accent colour. */
const RARITY_TIERS = [
  { name: "Common", color: "#9aa3b2" },
  { name: "Rare", color: "#4aa3ff" },
  { name: "Epic", color: "#c879ff" },
  { name: "Legendary", color: "#ffcc33" },
  { name: "Mythic", color: "#ff5a5a" },
];
// Expanded roster (skins 11+) spread across EVERY tier so the shop isn't all-Mythic.
const EXT_RARITY = [3, 2, 3, 4, 1, 0, 0, 1, 2, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1, 1, 3, 2, 3, 0, 2, 1, 0, 3, 1, 2, 4, 1, 3, 2, 1, 1, 4, 2, 0, 3, 1, 2, 3, 0, 4, 1, 2, 3];
export function rarityOf(i: number): { name: string; color: string } {
  if (i < 4) return RARITY_TIERS[0];
  if (i < 6) return RARITY_TIERS[1];
  if (i < 8) return RARITY_TIERS[2];
  if (i < 10) return RARITY_TIERS[3];
  if (i === 10) return RARITY_TIERS[4];
  return RARITY_TIERS[EXT_RARITY[i - 11] ?? 4];
}

/** Selectable rarity presets — the admin can override the per-character rarity. */
export interface Rarity { name: string; color: string; }
export const RARITIES: Rarity[] = [
  { name: "Common", color: "#9aa3b2" },
  { name: "Rare", color: "#4aa3ff" },
  { name: "Epic", color: "#c879ff" },
  { name: "Legendary", color: "#ffcc33" },
  { name: "Mythic", color: "#ff5a5a" },
];

// ---- asset loading -------------------------------------------------------
export interface SpriteSet {
  walk: Record<string, HTMLImageElement>; // `${dir}_${f}`
  placeBomb?: HTMLImageElement;
  victory?: HTMLImageElement;
  idle?: HTMLImageElement;
}
export interface Props {
  bomb?: HTMLImageElement;
  floor?: HTMLImageElement;
  hard?: HTMLImageElement;
  explosion: HTMLImageElement[];
  powerups: HTMLImageElement[];
}

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}
const v = (p: string): string => `${p}?v=${ASSET_VER}`;

export async function loadSpriteSet(index: number): Promise<SpriteSet> {
  const walk: Record<string, HTMLImageElement> = {};
  const dirs = ["down", "up", "side"] as const;
  await Promise.all(
    dirs.flatMap((d) =>
      [0, 1, 2].map(async (f) => {
        const im = await loadImg(v(`/sprites/skin_${index}_${d}_${f}.webp`));
        if (im) walk[`${d}_${f}`] = im;
      }),
    ),
  );
  const [placeBomb, victory, idle] = await Promise.all([
    loadImg(v(`/sprites/skin_${index}_place_bomb.webp`)),
    loadImg(v(`/sprites/skin_${index}_victory.webp`)),
    loadImg(v(`/sprites/skin_${index}.webp`)),
  ]);
  return { walk, placeBomb: placeBomb ?? undefined, victory: victory ?? undefined, idle: idle ?? undefined };
}

let propsCache: Promise<Props> | null = null;
export function loadProps(): Promise<Props> {
  if (propsCache) return propsCache;
  propsCache = (async () => {
    const [bomb, floor, hard, ...explosion] = await Promise.all([
      loadImg(v("/sprites/bomb.webp")),
      loadImg(v("/sprites/floor.webp")),
      loadImg(v("/sprites/hard.webp")),
      ...[0, 1, 2, 3, 4].map((i) => loadImg(v(`/sprites/explosion_${i}.webp`))),
    ]);
    const powerups = (await Promise.all(
      ["bomb", "fire", "speed", "kick", "wall", "health"].map((p) => loadImg(v(`/sprites/powerup_${p}.webp`))),
    )).filter((e): e is HTMLImageElement => !!e);
    return {
      bomb: bomb ?? undefined,
      floor: floor ?? undefined,
      hard: hard ?? undefined,
      explosion: explosion.filter((e): e is HTMLImageElement => !!e),
      powerups,
    };
  })();
  return propsCache;
}

// Share key-art backgrounds (cached once loaded).
const shareCache = new Map<number, Promise<HTMLImageElement | null>>();
function loadShare(n: number): Promise<HTMLImageElement | null> {
  if (!shareCache.has(n)) shareCache.set(n, loadImg(v(`/share/bg_${n}.webp`)));
  return shareCache.get(n)!;
}

// AI-generated per-character backgrounds: drop art into /public/cardbg as
// skin_<i>.webp or .png and the "AI art — per character" option uses it.
const cardbgCache = new Map<number, Promise<HTMLImageElement | null>>();
function loadCardbg(i: number): Promise<HTMLImageElement | null> {
  if (!cardbgCache.has(i)) {
    cardbgCache.set(i, (async () => (await loadImg(v(`/cardbg/skin_${i}.webp`))) ?? (await loadImg(v(`/cardbg/skin_${i}.png`))))());
  }
  return cardbgCache.get(i)!;
}

// ---- colour + shape helpers ----------------------------------------------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const m = (c: number): number => Math.round(c + (t - c) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- backgrounds ---------------------------------------------------------
export const BG_KINDS: Array<{ id: string; label: string }> = [
  { id: "theme", label: "Per-character theme 🎭" },
  { id: "ai", label: "AI art — per character (cardbg)" },
  { id: "proc", label: "Procedural (rarity glow)" },
  { id: "rays", label: "Procedural (neon rays)" },
  { id: "burst", label: "Procedural (comic burst)" },
  { id: "assets", label: "Game assets (floor + blast)" },
  { id: "share0", label: "Key-art #1" },
  { id: "share1", label: "Key-art #2" },
  { id: "share2", label: "Key-art #3" },
  { id: "share3", label: "Key-art #4" },
  { id: "share4", label: "Key-art #5" },
];

function bgGradient(ctx: CanvasRenderingContext2D, S: number, accent: string): void {
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, shade(accent, -0.74));
  g.addColorStop(0.55, "#0b0d15");
  g.addColorStop(1, "#06070c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}
function bgGlow(ctx: CanvasRenderingContext2D, S: number, accent: string): void {
  const gr = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.04, S * 0.5, S * 0.5, S * 0.5);
  gr.addColorStop(0, rgba(accent, 0.28));
  gr.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, S, S);
}
function bgVignette(ctx: CanvasRenderingContext2D, S: number): void {
  const vg = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.3, S * 0.5, S * 0.5, S * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);
}

/** Cover-fit an image to the square, centered. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, S: number): void {
  const scale = Math.max(S / img.width, S / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
}
/** Legibility scrim over photographic/AI art (darker at top & bottom). */
function drawScrim(ctx: CanvasRenderingContext2D, S: number): void {
  const sc = ctx.createLinearGradient(0, 0, 0, S);
  sc.addColorStop(0, "rgba(6,7,12,0.72)");
  sc.addColorStop(0.4, "rgba(6,7,12,0.18)");
  sc.addColorStop(0.7, "rgba(6,7,12,0.35)");
  sc.addColorStop(1, "rgba(6,7,12,0.85)");
  ctx.fillStyle = sc;
  ctx.fillRect(0, 0, S, S);
}

// Per-character identity themes (palette + motif). These are about WHO the
// character is, independent of the (overridable) rarity accent.
interface Theme { g: [string, string]; glow: string; motif: string; }
const THEMES: Theme[] = [
  { g: ["#3a2a12", "#0a0805"], glow: "#ffae57", motif: "coins" },     // Shiba
  { g: ["#10301a", "#05100a"], glow: "#5ee06a", motif: "bubbles" },   // Pepe
  { g: ["#33240a", "#0a0703"], glow: "#ffd24a", motif: "bills" },     // Trump
  { g: ["#141038", "#05040c"], glow: "#5b9bff", motif: "stars" },     // Musk
  { g: ["#3a3008", "#0c0a03"], glow: "#ffe04a", motif: "coins" },     // Doge
  { g: ["#0c3320", "#04120b"], glow: "#39ff9b", motif: "candles" },   // Pump
  { g: ["#0e2740", "#050d16"], glow: "#4ea3ff", motif: "planes" },    // Durov
  { g: ["#24123a", "#0a0512"], glow: "#c879ff", motif: "crystals" },  // Vitalik
  { g: ["#1a1a1a", "#050505"], glow: "#ff5a5a", motif: "halftone" },  // Troll
  { g: ["#2a0a0e", "#0c0304"], glow: "#ff3b3b", motif: "smoke" },     // Bogdanoff
  { g: ["#20202a", "#070708"], glow: "#dfe6ff", motif: "rays" },      // Gigachad
];

/** Tiny seeded RNG so motif placement is stable across preview + export. */
function seeded(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function drawThemed(ctx: CanvasRenderingContext2D, index: number, S: number, props: Props): void {
  const t = THEMES[index % THEMES.length];
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, t.g[0]);
  g.addColorStop(0.6, t.g[1]);
  g.addColorStop(1, "#050609");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // faint game floor on the lower half (uses real assets)
  if (props.floor) {
    ctx.globalAlpha = 0.1;
    const ts = S * 0.1;
    for (let y = S * 0.5; y < S; y += ts) for (let x = 0; x < S; x += ts) ctx.drawImage(props.floor, x, y, ts, ts);
    ctx.globalAlpha = 1;
  }

  const rnd = seeded(index + 1);
  // ambient powerup pickups drifting in the back (real assets, low alpha)
  if (props.powerups.length) {
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 7; i++) {
      const img = props.powerups[Math.floor(rnd() * props.powerups.length)];
      const s = S * (0.05 + rnd() * 0.04);
      ctx.drawImage(img, rnd() * (S - s), rnd() * S * 0.55, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // per-character motif
  themedMotif(ctx, S, t, rnd);

  // identity glow + vignette
  const gr = ctx.createRadialGradient(S * 0.5, S * 0.48, S * 0.04, S * 0.5, S * 0.48, S * 0.55);
  gr.addColorStop(0, rgba(t.glow, 0.3));
  gr.addColorStop(1, rgba(t.glow, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, S, S);
  bgVignette(ctx, S);
}

function themedMotif(ctx: CanvasRenderingContext2D, S: number, t: Theme, rnd: () => number): void {
  const c = t.glow;
  switch (t.motif) {
    case "candles": // green/red trading candles climbing up
      for (let i = 0; i < 14; i++) {
        const x = S * 0.06 + i * S * 0.066, h = S * (0.08 + rnd() * 0.5), up = rnd() > 0.4;
        ctx.fillStyle = up ? rgba("#39ff9b", 0.2) : rgba("#ff5a5a", 0.16);
        ctx.fillRect(x, S - h - S * 0.16, S * 0.03, h);
      }
      break;
    case "coins":
      for (let i = 0; i < 22; i++) {
        const x = rnd() * S, y = rnd() * S, r = S * (0.012 + rnd() * 0.03);
        const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, rgba(c, 0.55)); gg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case "bubbles":
      ctx.lineWidth = Math.max(1, S * 0.003);
      for (let i = 0; i < 20; i++) {
        const x = rnd() * S, y = rnd() * S, r = S * (0.01 + rnd() * 0.04);
        ctx.strokeStyle = rgba(c, 0.25); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    case "bills":
      for (let i = 0; i < 16; i++) {
        const x = rnd() * S, y = rnd() * S, w = S * 0.07, h = S * 0.035;
        ctx.save(); ctx.translate(x, y); ctx.rotate((rnd() - 0.5) * 1.2);
        ctx.fillStyle = rgba(c, 0.16); rr(ctx, -w / 2, -h / 2, w, h, h * 0.2); ctx.fill(); ctx.restore();
      }
      break;
    case "stars":
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = rgba("#ffffff", 0.1 + rnd() * 0.35);
        ctx.fillRect(rnd() * S, rnd() * S, S * 0.004, S * 0.004);
      }
      break;
    case "planes": // telegram paper planes
      for (let i = 0; i < 14; i++) {
        const x = rnd() * S, y = rnd() * S, s = S * (0.02 + rnd() * 0.03);
        ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * Math.PI * 2);
        ctx.fillStyle = rgba(c, 0.18); ctx.beginPath();
        ctx.moveTo(s, 0); ctx.lineTo(-s, s * 0.7); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s, -s * 0.7);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      break;
    case "crystals":
      for (let i = 0; i < 16; i++) {
        const x = rnd() * S, y = rnd() * S, s = S * (0.015 + rnd() * 0.035);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = rgba(c, 0.16); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
      }
      break;
    case "halftone":
      for (let y = 0; y < S; y += S * 0.045) for (let x = 0; x < S; x += S * 0.045) {
        const r = (x / S) * S * 0.012 + S * 0.002;
        ctx.fillStyle = rgba("#ffffff", 0.06); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case "smoke":
      for (let i = 0; i < 10; i++) {
        const x = rnd() * S, y = S * 0.5 + rnd() * S * 0.5, r = S * (0.08 + rnd() * 0.14);
        const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, rgba(c, 0.14)); gg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case "rays":
    default:
      ctx.save(); ctx.translate(S * 0.5, -S * 0.1);
      for (let i = 0; i < 10; i++) {
        ctx.rotate((Math.PI * 2) / 10);
        ctx.fillStyle = rgba(c, 0.05);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-S * 0.05, S * 1.4); ctx.lineTo(S * 0.05, S * 1.4); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      break;
  }
}

async function drawBackground(
  ctx: CanvasRenderingContext2D, index: number, S: number, kind: string, props: Props, accent: string,
): Promise<void> {
  if (kind === "theme") { drawThemed(ctx, index, S, props); return; }

  if (kind === "ai") {
    const img = await loadCardbg(index);
    if (img) { drawCover(ctx, img, S); drawScrim(ctx, S); return; }
    // no AI art dropped yet -> fall through to the procedural default below
  }

  if (kind.startsWith("share")) {
    const n = parseInt(kind.slice(5), 10) || 0;
    const img = await loadShare(n);
    if (img) drawCover(ctx, img, S);
    else bgGradient(ctx, S, accent);
    drawScrim(ctx, S);
    return;
  }

  if (kind === "assets") {
    bgGradient(ctx, S, accent);
    if (props.floor) {
      ctx.globalAlpha = 0.16;
      const ts = S * 0.11;
      for (let y = 0; y < S; y += ts) for (let x = 0; x < S; x += ts) ctx.drawImage(props.floor, x, y, ts, ts);
      ctx.globalAlpha = 1;
    }
    const ex = props.explosion[2];
    if (ex) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.42;
      const s = S * 0.7;
      ctx.drawImage(ex, S / 2 - s / 2, S * 0.12, s, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    bgGlow(ctx, S, accent);
    bgVignette(ctx, S);
    return;
  }

  if (kind === "burst") {
    // comic radial "speed burst" wedges
    bgGradient(ctx, S, accent);
    ctx.save();
    ctx.translate(S * 0.5, S * 0.5);
    const wedges = 28;
    for (let i = 0; i < wedges; i++) {
      ctx.rotate((Math.PI * 2) / wedges);
      ctx.fillStyle = i % 2 ? rgba(accent, 0.1) : rgba("#000000", 0.18);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(S * 0.04, S);
      ctx.lineTo(-S * 0.04, S);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    bgGlow(ctx, S, accent);
    bgVignette(ctx, S);
    return;
  }

  if (kind === "rays") {
    bgGradient(ctx, S, accent);
    ctx.save();
    ctx.translate(S * 0.5, -S * 0.12);
    for (let i = 0; i < 9; i++) {
      ctx.rotate((Math.PI * 2) / 9);
      ctx.fillStyle = rgba(accent, 0.06);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-S * 0.05, S * 1.4);
      ctx.lineTo(S * 0.05, S * 1.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // floor grid
    ctx.strokeStyle = rgba(accent, 0.07);
    ctx.lineWidth = Math.max(1, S * 0.002);
    const gs = S / 12;
    for (let y = S * 0.5; y <= S; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
    for (let x = 0; x <= S; x += gs) { ctx.beginPath(); ctx.moveTo(x, S * 0.5); ctx.lineTo(x, S); ctx.stroke(); }
    bgGlow(ctx, S, accent);
    bgVignette(ctx, S);
    return;
  }

  // "proc" (default)
  bgGradient(ctx, S, accent);
  bgGlow(ctx, S, accent);
  ctx.strokeStyle = rgba(accent, 0.07);
  ctx.lineWidth = Math.max(1, S * 0.002);
  const gs = S / 12;
  for (let y = S * 0.5; y <= S; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
  bgVignette(ctx, S);
}

function drawRing(ctx: CanvasRenderingContext2D, S: number, accent: string): void {
  ctx.save();
  ctx.strokeStyle = rgba(accent, 0.5);
  ctx.lineWidth = Math.max(2, S * 0.005);
  ctx.setLineDash([S * 0.02, S * 0.02]);
  ctx.beginPath();
  ctx.ellipse(S * 0.5, S * 0.5 + S * 0.075, S * 0.135, S * 0.075, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawQR(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = "#ffffff";
  rr(ctx, x - size * 0.04, y - size * 0.04, size + size * 0.08, size + size * 0.08, size * 0.08);
  ctx.fill();
  ctx.fillStyle = "#0e1018";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(
          Math.round(x + (c + quiet) * cell), Math.round(y + (r + quiet) * cell),
          Math.ceil(cell), Math.ceil(cell),
        );
      }
    }
  }
}

function drawOverlay(
  ctx: CanvasRenderingContext2D, index: number, S: number, link: string, rarity: Rarity, showLabel: boolean,
): void {
  const accent = rarity.color, rarityName = rarity.name;
  const name = SKIN_NAMES[index];

  // accent frame
  ctx.strokeStyle = rgba(accent, 0.85);
  ctx.lineWidth = Math.max(2, S * 0.006);
  rr(ctx, S * 0.025, S * 0.025, S * 0.95, S * 0.95, S * 0.04);
  ctx.stroke();

  // header
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(S * 0.05)}px system-ui, sans-serif`;
  ctx.fillText("BomberMeme.fun", S * 0.5, S * 0.10);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 ${Math.round(S * 0.026)}px system-ui, sans-serif`;
  ctx.fillText("blow up your friends · pump.fun arena", S * 0.5, S * 0.14);

  // name
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(S * 0.085)}px system-ui, sans-serif`;
  ctx.shadowColor = rgba(accent, 0.7);
  ctx.shadowBlur = S * 0.03;
  ctx.fillText(name.toUpperCase(), S * 0.5, S * 0.785);
  ctx.shadowBlur = 0;

  // rarity chip (optional — the admin can hide it)
  if (showLabel) {
    const chipW = S * 0.26, chipH = S * 0.05, chipX = S * 0.5 - chipW / 2, chipY = S * 0.81;
    ctx.fillStyle = rgba(accent, 0.18);
    rr(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fill();
    ctx.strokeStyle = rgba(accent, 0.8);
    ctx.lineWidth = Math.max(1, S * 0.003);
    rr(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = `800 ${Math.round(S * 0.028)}px system-ui, sans-serif`;
    ctx.fillText(rarityName.toUpperCase(), S * 0.5, chipY + chipH * 0.68);
  }

  // QR + label
  const qrSize = S * 0.17;
  const qx = S - qrSize - S * 0.06, qy = S - qrSize - S * 0.085;
  drawQR(ctx, link, qx, qy, qrSize);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `700 ${Math.round(S * 0.022)}px system-ui, sans-serif`;
  ctx.fillText("SCAN TO PLAY 💣", qx + qrSize / 2, qy - S * 0.018);

  // link
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 ${Math.round(S * 0.026)}px system-ui, sans-serif`;
  const shown = link.replace(/^https?:\/\//, "");
  ctx.fillText(shown.length > 22 ? shown.slice(0, 21) + "…" : shown, S * 0.07, S * 0.94);
}

export interface BaseOpts {
  link: string; bgKind: string; ring: boolean; props: Props;
  rarity?: Rarity; // override; defaults to the character's own tier
  showLabel?: boolean; // show the rarity chip (default true)
}

export async function buildBase(index: number, size: number, opts: BaseOpts): Promise<HTMLCanvasElement> {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  const rar = opts.rarity ?? rarityOf(index);
  await drawBackground(ctx, index, size, opts.bgKind, opts.props, rar.color);
  if (opts.ring) drawRing(ctx, size, rar.color);
  drawOverlay(ctx, index, size, opts.link, rar, opts.showLabel !== false);
  return cv;
}

// ---- sprite drawing helper ----------------------------------------------
interface DrawOpts { flip?: boolean; }
function drawSprite(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, footX: number, footY: number, h: number, o: DrawOpts = {},
): void {
  const w = h * (img.width / img.height);
  // ground shadow
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(footX, footY, w * 0.34, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (o.flip) { ctx.translate(footX, 0); ctx.scale(-1, 1); ctx.translate(-footX, 0); }
  ctx.drawImage(img, footX - w / 2, footY - h, w, h);
  ctx.restore();
}

// ---- animation modes -----------------------------------------------------
export interface Mode {
  id: string;
  label: string;
  steps: number;
  frameMs: number;
  ring: boolean;
  draw(ctx: CanvasRenderingContext2D, set: SpriteSet, props: Props, i: number, S: number): void;
}

function walkFrame(set: SpriteSet, dir: string, f: number): HTMLImageElement | undefined {
  return set.walk[`${dir}_${f}`] ?? set.idle;
}

// position + facing around a ring, clockwise from the top
const CIRCLE = Array.from({ length: 12 }, (_, i) => {
  const angle = (-90 + i * 30) * (Math.PI / 180);
  let tan = (i * 30) % 360;
  if (tan < 0) tan += 360;
  let dir: string, flip = false;
  if (tan >= 45 && tan < 135) dir = "down";
  else if (tan >= 135 && tan < 225) { dir = "side"; flip = true; }
  else if (tan >= 225 && tan < 315) dir = "up";
  else dir = "side";
  return { angle, dir, flip, f: i % 3 };
});

const SPIN_SEQ: Array<[string, number, boolean]> = [
  ["down", 0, false], ["down", 1, false], ["down", 2, false],
  ["side", 0, false], ["side", 1, false], ["side", 2, false],
  ["up", 0, false], ["up", 1, false], ["up", 2, false],
  ["side", 0, true], ["side", 1, true], ["side", 2, true],
];

export const MODES: Mode[] = [
  {
    id: "circle", label: "Walk in a circle", steps: 12, frameMs: 130, ring: true,
    draw(ctx, set, _props, i, S) {
      const t = CIRCLE[i % 12];
      const img = walkFrame(set, t.dir, t.f);
      if (!img) return;
      const fx = S * 0.5 + Math.cos(t.angle) * S * 0.115;
      const fy = S * 0.5 + Math.sin(t.angle) * S * 0.115 + S * 0.075;
      drawSprite(ctx, img, fx, fy, S * 0.24, { flip: t.flip });
    },
  },
  {
    id: "spin", label: "Spin in place", steps: 12, frameMs: 120, ring: false,
    draw(ctx, set, _props, i, S) {
      const [dir, f, flip] = SPIN_SEQ[i % 12];
      const img = walkFrame(set, dir, f);
      if (img) drawSprite(ctx, img, S * 0.5, S * 0.6, S * 0.27, { flip });
    },
  },
  {
    id: "strut", label: "Run side to side", steps: 24, frameMs: 110, ring: false,
    draw(ctx, set, _props, i, S) {
      const half = 12;
      const right = i < half;
      const j = right ? i : i - half;
      const p = j / (half - 1);
      const xL = S * 0.22, xR = S * 0.78;
      const fx = right ? xL + (xR - xL) * p : xR - (xR - xL) * p;
      const img = walkFrame(set, "side", i % 3);
      if (img) drawSprite(ctx, img, fx, S * 0.6, S * 0.26, { flip: !right });
    },
  },
  {
    id: "forward", label: "Run toward you", steps: 12, frameMs: 110, ring: false,
    draw(ctx, set, _props, i, S) {
      const t = i / 12;
      const scale = 0.7 + 0.55 * t;
      const fy = S * 0.42 + S * 0.2 * t;
      const img = walkFrame(set, "down", i % 3);
      if (img) drawSprite(ctx, img, S * 0.5, fy, S * 0.24 * scale);
    },
  },
  {
    id: "bomb", label: "Plant a bomb & run", steps: 30, frameMs: 110, ring: false,
    draw(ctx, set, props, i, S) {
      const bombX = S * 0.5, groundY = S * 0.62, bombH = S * 0.1;
      const drawBomb = (pulse: number): void => {
        if (!props.bomb) return;
        const h = bombH * (1 + pulse * 0.12);
        const w = h * (props.bomb.width / props.bomb.height);
        ctx.drawImage(props.bomb, bombX - w / 2, groundY - h, w, h);
      };
      if (i < 7) {
        // walk in from the left
        const p = i / 6;
        const img = walkFrame(set, "side", i % 3);
        if (img) drawSprite(ctx, img, S * 0.14 + (S * 0.4 - S * 0.14) * p, groundY, S * 0.26, {});
      } else if (i < 10) {
        // plant the bomb
        drawBomb(0);
        const img = set.placeBomb ?? walkFrame(set, "down", 0);
        if (img) drawSprite(ctx, img, S * 0.4, groundY, S * 0.26, {});
      } else if (i < 19) {
        // run away to the right
        const p = (i - 10) / 8;
        drawBomb(Math.sin(p * Math.PI * 3) * 0.5 + 0.5);
        const img = walkFrame(set, "side", i % 3);
        if (img) drawSprite(ctx, img, S * 0.45 + (S * 0.9 - S * 0.45) * p, groundY, S * 0.26, {});
      } else if (i < 22) {
        // bomb ticks; hero peeks from the edge
        drawBomb(((i - 19) % 2) * 0.9);
        const img = walkFrame(set, "side", 0);
        if (img) drawSprite(ctx, img, S * 0.9, groundY, S * 0.26, {});
      } else if (i < 28) {
        // BOOM — cycle explosion frames
        const fi = Math.min(props.explosion.length - 1, i - 22);
        const ex = props.explosion[fi];
        if (ex) {
          const s = S * 0.46;
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(ex, bombX - s / 2, groundY - s * 0.78, s, s);
          ctx.globalCompositeOperation = "source-over";
        }
        const img = walkFrame(set, "side", 0);
        if (img) drawSprite(ctx, img, S * 0.9, groundY, S * 0.26, {});
      } else {
        // victory
        const img = set.victory ?? set.idle ?? walkFrame(set, "down", 0);
        if (img) drawSprite(ctx, img, S * 0.5, groundY, S * 0.28, {});
      }
    },
  },
];

export function modeById(id: string): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

/** Blit the static base, then the animated layer for this step. */
export function drawFrame(
  ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, set: SpriteSet, props: Props,
  mode: Mode, step: number, size: number,
): void {
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(base, 0, 0, size, size);
  const s = ((step % mode.steps) + mode.steps) % mode.steps;
  mode.draw(ctx, set, props, s, size);
}

// ---- exports -------------------------------------------------------------
const QUALITY_COLORS: Record<string, number> = { high: 256, medium: 128, low: 64 };

export async function exportGif(
  index: number, set: SpriteSet, props: Props, mode: Mode, size: number,
  opts: { link: string; bgKind: string; quality: string; rarity?: Rarity; showLabel?: boolean },
): Promise<Uint8Array> {
  const base = await buildBase(index, size, {
    link: opts.link, bgKind: opts.bgKind, ring: mode.ring, props, rarity: opts.rarity, showLabel: opts.showLabel,
  });
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  const enc = GIFEncoder();
  const colors = QUALITY_COLORS[opts.quality] ?? 256;
  for (let i = 0; i < mode.steps; i++) {
    drawFrame(ctx, base, set, props, mode, i, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const palette = quantize(data, colors);
    const indexed = applyPalette(data, palette);
    enc.writeFrame(indexed, size, size, { palette, delay: mode.frameMs, repeat: i === 0 ? 0 : undefined });
  }
  enc.finish();
  return enc.bytes();
}

export async function exportPng(
  index: number, set: SpriteSet, props: Props, mode: Mode, size: number,
  opts: { link: string; bgKind: string; rarity?: Rarity; showLabel?: boolean },
): Promise<Blob> {
  const base = await buildBase(index, size, {
    link: opts.link, bgKind: opts.bgKind, ring: mode.ring, props, rarity: opts.rarity, showLabel: opts.showLabel,
  });
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  drawFrame(ctx, base, set, props, mode, Math.floor(mode.steps / 4), size);
  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}
