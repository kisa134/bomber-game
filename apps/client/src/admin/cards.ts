// Character-card composer for the admin marketing page. Each card is a square
// canvas: a procedural per-character background, the character walking in a
// circle (same sprite frames as the in-game shop), the name + rarity, and a QR
// to a configurable link. The same draw routine powers both the live preview
// and the animated-GIF export, so what you see is what you download.
import qrcode from "qrcode-generator";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { ASSET_VER } from "../game/assets.js";

export const SKIN_NAMES = [
  "Shiba", "Pepe", "Trump", "Musk", "Doge", "Pump", "Durov", "Vitalik", "Troll", "Bogdanoff", "Gigachad",
];

/** Rarity tier by index — mirrors the shop, drives the card accent colour. */
export function rarityOf(i: number): { name: string; color: string } {
  if (i < 4) return { name: "Common", color: "#9aa3b2" };
  if (i < 6) return { name: "Rare", color: "#4aa3ff" };
  if (i < 8) return { name: "Epic", color: "#c879ff" };
  if (i < 10) return { name: "Legendary", color: "#ffcc33" };
  return { name: "Mythic", color: "#ff5a5a" };
}

export const STEPS = 12; // frames around the circle (3 per cardinal direction)
export const FRAME_MS = 140; // per-frame delay (live + GIF)

type Dir = "down" | "up" | "side";
export interface CharFrames {
  [key: string]: HTMLImageElement; // `${dir}_${f}` -> image
}

/** One precomputed turn step: which sprite + where on the circle it stands. */
interface Turn {
  dir: Dir;
  f: number;
  flip: boolean;
  angle: number; // radians, position around the circle
}

// Walk clockwise from the top. The facing matches the movement tangent so the
// character genuinely strolls around the ring rather than moonwalking.
const TURNS: Turn[] = Array.from({ length: STEPS }, (_, i) => {
  const angle = (-90 + i * (360 / STEPS)) * (Math.PI / 180); // position
  let tangent = (i * (360 / STEPS)) % 360; // clockwise tangent, starts east
  if (tangent < 0) tangent += 360;
  let dir: Dir;
  let flip = false;
  if (tangent >= 45 && tangent < 135) dir = "down";
  else if (tangent >= 135 && tangent < 225) { dir = "side"; flip = true; }
  else if (tangent >= 225 && tangent < 315) dir = "up";
  else dir = "side";
  return { dir, f: i % 3, flip, angle };
});

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

/** Load the 9 walk frames (down/up/side × 0..2) for one character. */
export async function loadCharFrames(index: number): Promise<CharFrames> {
  const dirs: Dir[] = ["down", "up", "side"];
  const out: CharFrames = {};
  await Promise.all(
    dirs.flatMap((d) =>
      [0, 1, 2].map(async (f) => {
        const im = await loadImg(`/sprites/skin_${index}_${d}_${f}.webp?v=${ASSET_VER}`);
        if (im) out[`${d}_${f}`] = im;
      }),
    ),
  );
  return out;
}

// ---- colour helpers ------------------------------------------------------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** Mix toward black (amt<0) or white (amt>0). amt in [-1,1]. */
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const m = (c: number) => Math.round(c + (t - c) * k);
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

// Geometry of the walking circle, as fractions of the card size.
const CY = 0.5, R = 0.115, SPRITE_H = 0.24;

/** Build the static layer (background + text + QR) once; the sprite is drawn
 *  on top per frame. Returns a ready-to-blit canvas. */
export function buildBase(index: number, size: number, link: string): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  const S = size;
  const { color: accent, name: rarityName } = rarityOf(index);
  const name = SKIN_NAMES[index];

  // base diagonal gradient (dark, tinted by the accent)
  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, shade(accent, -0.74));
  bg.addColorStop(0.55, "#0b0d15");
  bg.addColorStop(1, "#06070c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // light rays from the top
  ctx.save();
  ctx.translate(S * 0.5, -S * 0.12);
  for (let i = 0; i < 9; i++) {
    ctx.rotate((Math.PI * 2) / 9);
    ctx.fillStyle = rgba(accent, 0.05);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-S * 0.05, S * 1.4);
    ctx.lineTo(S * 0.05, S * 1.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // accent glow behind the circle
  const cx = S * 0.5, cy = S * CY;
  const glow = ctx.createRadialGradient(cx, cy, S * 0.04, cx, cy, S * 0.5);
  glow.addColorStop(0, rgba(accent, 0.28));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  // faint floor grid (lower half)
  ctx.strokeStyle = rgba(accent, 0.07);
  ctx.lineWidth = Math.max(1, S * 0.002);
  const gs = S / 12;
  for (let y = S * 0.5; y <= S; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
  for (let x = 0; x <= S; x += gs) { ctx.beginPath(); ctx.moveTo(x, S * 0.5); ctx.lineTo(x, S); ctx.stroke(); }

  // dashed ring track the character walks along
  ctx.save();
  ctx.strokeStyle = rgba(accent, 0.5);
  ctx.lineWidth = Math.max(2, S * 0.005);
  ctx.setLineDash([S * 0.02, S * 0.02]);
  ctx.beginPath();
  ctx.ellipse(cx, cy + S * SPRITE_H * 0.32, S * R * 1.15, S * R * 0.62, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // vignette
  const vg = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.3, S * 0.5, S * 0.5, S * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);

  // accent frame
  ctx.strokeStyle = rgba(accent, 0.85);
  ctx.lineWidth = Math.max(2, S * 0.006);
  rr(ctx, S * 0.025, S * 0.025, S * 0.95, S * 0.95, S * 0.04);
  ctx.stroke();

  // header: logo + tagline
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
  ctx.fillText(name.toUpperCase(), S * 0.5, S * 0.78);
  ctx.shadowBlur = 0;

  // rarity chip
  const chipW = S * 0.26, chipH = S * 0.05, chipX = S * 0.5 - chipW / 2, chipY = S * 0.805;
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

  // QR bottom-right + label
  const qrSize = S * 0.17;
  const qx = S - qrSize - S * 0.06, qy = S - qrSize - S * 0.085;
  drawQR(ctx, link, qx, qy, qrSize);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `700 ${Math.round(S * 0.022)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("SCAN TO PLAY 💣", qx + qrSize / 2, qy - S * 0.018);

  // link bottom-left
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 ${Math.round(S * 0.026)}px system-ui, sans-serif`;
  const shown = link.replace(/^https?:\/\//, "");
  ctx.fillText(shown.length > 22 ? shown.slice(0, 21) + "…" : shown, S * 0.07, S * 0.94);

  return cv;
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
          Math.round(x + (c + quiet) * cell),
          Math.round(y + (r + quiet) * cell),
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }
  }
}

/** Draw one animation frame: blit the static base, then the walking sprite. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  frames: CharFrames,
  step: number,
  size: number,
): void {
  const S = size;
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(base, 0, 0, S, S);

  const turn = TURNS[((step % STEPS) + STEPS) % STEPS];
  const img = frames[`${turn.dir}_${turn.f}`];
  if (!img) return;

  const cx = S * 0.5, cy = S * CY;
  const footX = cx + Math.cos(turn.angle) * S * R;
  const footY = cy + Math.sin(turn.angle) * S * R + S * SPRITE_H * 0.32;
  const h = S * SPRITE_H;
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
  if (turn.flip) {
    ctx.translate(footX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-footX, 0);
  }
  ctx.drawImage(img, footX - w / 2, footY - h, w, h);
  ctx.restore();
}

/** Render all STEPS frames and encode an animated GIF. Returns a Blob. */
export function exportGif(index: number, frames: CharFrames, size: number, link: string): Blob {
  const base = buildBase(index, size, link);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  const enc = GIFEncoder();
  for (let i = 0; i < STEPS; i++) {
    drawFrame(ctx, base, frames, i, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const palette = quantize(data, 256);
    const indexed = applyPalette(data, palette);
    enc.writeFrame(indexed, size, size, { palette, delay: FRAME_MS, repeat: i === 0 ? 0 : undefined });
  }
  enc.finish();
  // Copy into a fresh ArrayBuffer so the Blob owns standalone bytes.
  const bytes = enc.bytes();
  return new Blob([bytes.slice()], { type: "image/gif" });
}

/** Render a single still frame as a PNG Blob. */
export function exportPng(index: number, frames: CharFrames, size: number, link: string): Promise<Blob> {
  const base = buildBase(index, size, link);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  // a flattering 3/4 turn frame for the still
  drawFrame(ctx, base, frames, 1, size);
  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}
