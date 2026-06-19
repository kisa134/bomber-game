// Social share-card composer. Renders a 1080x1080 PNG on a canvas: an AI key-art
// background (variant), the player's hero, match/overall stats + earnings, and a
// QR to the referral link. All client-side; no server round-trip.
import qrcode from "qrcode-generator";
import { ASSET_VER } from "../game/assets.js";

export interface CardData {
  kind: "result" | "profile";
  nickname: string;
  skin: number;
  rating: number;
  league: { emoji: string; name: string };
  chips: number;
  refUrl: string; // encoded into the QR
  refCode?: string | null; // short human label under the QR (e.g. wallet short)
  // result-only:
  placeText?: string; // "🏆 1st place" / "💀 Knocked out" / "🤝 Draw"
  won?: boolean;
  frags?: number;
  earnText?: string; // "+🪙120" / "Won the pot 💎2.0" etc.
  ratingDelta?: number;
  firstBlood?: boolean;
}

const SIZE = 1080;
// Per-variant theme. `bg` = an AI key-art index in /share (or null -> a
// procedural background built from our own game sprites). g0/g1 = the
// procedural gradient pair.
const VARIANTS: Array<{ accent: string; bg: number | null; g0: string; g1: string }> = [
  { accent: "#ff7a30", bg: 0, g0: "#3a1a10", g1: "#0a0c12" },
  { accent: "#39d3ff", bg: 1, g0: "#10222e", g1: "#070b12" },
  { accent: "#ffcc33", bg: 2, g0: "#2e2410", g1: "#0a0a08" },
  { accent: "#c879ff", bg: 3, g0: "#241033", g1: "#0a0712" },
  { accent: "#7bd66a", bg: 4, g0: "#0f2a18", g1: "#070f0a" },
];
export const VARIANT_COUNT = VARIANTS.length;

/** Procedural background from our own assets: themed gradient + tiled floor +
 *  a central blast glow + accent. Used when there's no AI key-art for a variant. */
async function drawProceduralBg(ctx: CanvasRenderingContext2D, v: (typeof VARIANTS)[number]): Promise<void> {
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  g.addColorStop(0, v.g0);
  g.addColorStop(1, v.g1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const floor = await loadImg(`/sprites/floor.webp?v=${ASSET_VER}`);
  if (floor) {
    ctx.globalAlpha = 0.15;
    const ts = 120;
    for (let y = 0; y < SIZE; y += ts) for (let x = 0; x < SIZE; x += ts) ctx.drawImage(floor, x, y, ts, ts);
    ctx.globalAlpha = 1;
  }
  const ex = await loadImg(`/sprites/explosion_2.webp?v=${ASSET_VER}`);
  if (ex) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    const s = 760;
    ctx.drawImage(ex, SIZE / 2 - s / 2, 140, s, s);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  const gr = ctx.createRadialGradient(SIZE / 2, SIZE * 0.42, 40, SIZE / 2, SIZE * 0.42, SIZE * 0.62);
  gr.addColorStop(0, v.accent + "33");
  gr.addColorStop(1, v.accent + "00");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
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

function drawQR(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  // white rounded plate
  ctx.fillStyle = "#ffffff";
  rr(ctx, x - 8, y - 8, size + 16, size + 16, 16);
  ctx.fill();
  ctx.fillStyle = "#0e1018";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(Math.round(x + (c + quiet) * cell), Math.round(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}

/** Compose the card. Returns the canvas (caller turns it into a blob/dataURL). */
export async function renderShareCard(data: CardData, variant: number): Promise<HTMLCanvasElement> {
  const v = VARIANTS[((variant % VARIANTS.length) + VARIANTS.length) % VARIANTS.length];
  const cv = document.createElement("canvas");
  cv.width = SIZE;
  cv.height = SIZE;
  const ctx = cv.getContext("2d")!;

  // 1. Background: AI key-art (cover) when the variant has one, else a
  //    procedural background built from our own sprites.
  const bg = v.bg != null ? await loadImg(`/share/bg_${v.bg}.webp?v=${ASSET_VER}`) : null;
  if (bg) {
    const s = Math.max(SIZE / bg.width, SIZE / bg.height);
    const w = bg.width * s, h = bg.height * s;
    ctx.drawImage(bg, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  } else {
    await drawProceduralBg(ctx, v);
  }
  // Vertical scrim for legibility (darker top + bottom).
  const sc = ctx.createLinearGradient(0, 0, 0, SIZE);
  sc.addColorStop(0, "rgba(8,10,16,0.62)");
  sc.addColorStop(0.42, "rgba(8,10,16,0.12)");
  sc.addColorStop(0.7, "rgba(8,10,16,0.55)");
  sc.addColorStop(1, "rgba(8,10,16,0.92)");
  ctx.fillStyle = sc;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Accent edge frame.
  ctx.strokeStyle = v.accent;
  ctx.lineWidth = 10;
  ctx.globalAlpha = 0.9;
  rr(ctx, 18, 18, SIZE - 36, SIZE - 36, 36);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 2. Header: logo (auto-fit to width) + tagline.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const lg = ctx.createLinearGradient(0, 56, 0, 132);
  lg.addColorStop(0, "#fff0a8");
  lg.addColorStop(1, v.accent);
  ctx.fillStyle = lg;
  const LOGO = "BomberMeme.fun";
  let lfs = 100;
  do {
    lfs -= 4;
    ctx.font = `900 ${lfs}px 'Arial Black', Arial, sans-serif`;
  } while (ctx.measureText(LOGO).width > SIZE - 120 && lfs > 44);
  ctx.fillText(LOGO, SIZE / 2, 118);
  ctx.fillStyle = "rgba(231,233,238,0.85)";
  ctx.font = "600 30px Arial, sans-serif";
  ctx.fillText("blow up your friends · pump.fun arena", SIZE / 2, 162);

  // 3. Hero sprite (victory pose, fall back to front stand).
  const hero =
    (await loadImg(`/sprites/skin_${data.skin}_victory.webp?v=${ASSET_VER}`)) ??
    (await loadImg(`/sprites/skin_${data.skin}_down_0.webp?v=${ASSET_VER}`)) ??
    (await loadImg(`/sprites/skin_${data.skin}.webp?v=${ASSET_VER}`));
  const hy = 196;
  const hs = 396;
  if (hero) {
    const gr = ctx.createRadialGradient(SIZE / 2, hy + hs * 0.62, 20, SIZE / 2, hy + hs * 0.62, hs * 0.6);
    gr.addColorStop(0, v.accent + "66");
    gr.addColorStop(1, v.accent + "00");
    ctx.fillStyle = gr;
    ctx.fillRect(SIZE / 2 - hs, hy, hs * 2, hs);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(hero, SIZE / 2 - hs / 2, hy, hs, hs);
    ctx.imageSmoothingEnabled = true;
  }

  // 4. Placement / result badge over the hero.
  if (data.placeText) {
    ctx.font = "900 58px 'Arial Black', Arial, sans-serif";
    const pw = ctx.measureText(data.placeText).width + 60;
    ctx.fillStyle = "rgba(8,10,16,0.66)";
    rr(ctx, SIZE / 2 - pw / 2, 184, pw, 76, 38);
    ctx.fill();
    ctx.fillStyle = data.won ? "#ffd95a" : "#ff8a8a";
    ctx.fillText(data.placeText, SIZE / 2, 238);
  }
  if (data.firstBlood) {
    ctx.fillStyle = "#e60000";
    ctx.font = "900 34px 'Arial Black', Arial, sans-serif";
    ctx.fillText("🩸 FIRST BLOOD", SIZE / 2, 288);
  }

  // 5. Nickname.
  ctx.fillStyle = "#fff";
  ctx.font = "800 52px Arial, sans-serif";
  ctx.fillText(data.nickname, SIZE / 2, 648);

  // 6. Stat chips row.
  const chips: Array<[string, string]> =
    data.kind === "result"
      ? [
          ["⚔️ Frags", String(data.frags ?? 0)],
          ["💰 Match", data.earnText || "—"],
          ["📈 Rating", `${data.rating}${data.ratingDelta ? ` (${data.ratingDelta > 0 ? "+" : ""}${data.ratingDelta})` : ""}`],
        ]
      : [
          [`${data.league.emoji} League`, data.league.name],
          ["🪙 Chips", data.chips.toLocaleString()],
          ["📈 Rating", String(data.rating)],
        ];
  const cw = 320, ch = 90, gap = 18;
  const total = cw * 3 + gap * 2;
  let cx = (SIZE - total) / 2;
  const cy = 680;
  for (const [label, val] of chips) {
    ctx.fillStyle = "rgba(20,24,34,0.8)";
    rr(ctx, cx, cy, cw, ch, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    rr(ctx, cx, cy, cw, ch, 18);
    ctx.stroke();
    ctx.fillStyle = "rgba(231,233,238,0.7)";
    ctx.font = "600 26px Arial, sans-serif";
    ctx.fillText(label, cx + cw / 2, cy + 36);
    ctx.fillStyle = "#fff";
    ctx.font = "800 36px Arial, sans-serif";
    ctx.fillText(val, cx + cw / 2, cy + 76);
    cx += cw + gap;
  }

  // 7. Bottom panel: QR (right) + referral / CTA (left). Kept clear of the chips.
  const qrSize = 180;
  const qx = SIZE - 58 - qrSize;
  const qy = SIZE - 58 - qrSize;
  drawQR(ctx, data.refUrl, qx, qy, qrSize);
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "800 44px Arial, sans-serif";
  ctx.fillText("Scan to play 💣", 64, qy + 38);
  ctx.fillStyle = "rgba(231,233,238,0.8)";
  ctx.font = "600 27px Arial, sans-serif";
  ctx.fillText("BomberMeme.fun · free in Telegram", 64, qy + 82);
  if (data.refCode) {
    ctx.fillStyle = v.accent;
    ctx.font = "800 30px Arial, sans-serif";
    ctx.fillText(`Ref: ${data.refCode}`, 64, qy + 140);
    ctx.fillStyle = "rgba(231,233,238,0.6)";
    ctx.font = "600 24px Arial, sans-serif";
    ctx.fillText("scan = you get credited", 64, qy + 174);
  }
  ctx.textAlign = "center";
  return cv;
}
