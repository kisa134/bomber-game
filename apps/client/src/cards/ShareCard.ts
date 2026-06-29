/**
 * ShareCard.ts — Social media share image generator for BomberMeme CCG v2.
 *
 * Composes a 1080x1080 PNG on a Canvas 2D surface:
 *   1. Dark gradient background with radial center glow
 *   2. Card render (tilted ~8deg, scaled to ~0.7 of canvas)
 *   3. Character name with gold gradient
 *   4. Tier badge (coloured)
 *   5. Serial number (mono font) if provided
 *   6. "BOMBERMEME" branding (top center, gold drop-shadow)
 *   7. QR code placeholder (bottom-right: rounded square)
 *   8. Vignette edge darkening
 *   9. Grain noise overlay
 *
 * Technical: ESM, strict TypeScript, Canvas 2D only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareCardData {
  cardHTML: string;
  characterName: string;
  tier: string;
  momentName: string;
  serial?: string;
  cardImageUrl?: string;
}

// ---------------------------------------------------------------------------
// Tier colours (mirrors existing rarity system)
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
};

const TIER_ICONS: Record<string, string> = {
  common: "C", rare: "R", epic: "E", legendary: "L", mythic: "M",
};

// ---------------------------------------------------------------------------
// Utility: rounded rectangle
// ---------------------------------------------------------------------------

function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Grain texture (generated once, reused)
// ---------------------------------------------------------------------------

let grainCache: ImageData | null = null;

function buildGrain(size: number): ImageData {
  if (grainCache && grainCache.width === size) return grainCache;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = Math.random() * 40;
    imgData.data[i] = v;
    imgData.data[i + 1] = v;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = 18; // low alpha for subtlety
  }
  grainCache = imgData;
  return imgData;
}

// ---------------------------------------------------------------------------
// QR placeholder renderer
// ---------------------------------------------------------------------------

function drawQRPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
): void {
  // Rounded white backing plate
  ctx.fillStyle = "rgba(255,255,255,.92)";
  rr(ctx, x - 6, y - 6, size + 12, size + 12, 14);
  ctx.fill();

  // Dark QR-style pattern (simplified)
  ctx.fillStyle = "#0e1018";
  const cells = 21;
  const cellSize = size / cells;
  const quiet = 0;

  // Draw finder patterns (corners)
  const drawFinder = (fx: number, fy: number): void => {
    const fs = 7;
    ctx.fillRect(x + (fx + quiet) * cellSize, y + (fy + quiet) * cellSize, fs * cellSize, fs * cellSize);
    ctx.clearRect(x + (fx + quiet + 1) * cellSize, y + (fy + quiet + 1) * cellSize, (fs - 2) * cellSize, (fs - 2) * cellSize);
    ctx.fillRect(x + (fx + quiet + 2) * cellSize, y + (fy + quiet + 2) * cellSize, (fs - 4) * cellSize, (fs - 4) * cellSize);
  };

  drawFinder(0, 0);
  drawFinder(cells - 7, 0);
  drawFinder(0, cells - 7);

  // Random data modules
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      // Skip finder pattern zones
      if ((r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8)) continue;
      // Deterministic pseudo-random pattern
      const hash = Math.sin(r * 127.1 + c * 311.7 + 74.7) * 43758.5453;
      if ((hash - Math.floor(hash)) > 0.5) {
        ctx.fillRect(
          Math.round(x + (c + quiet) * cellSize),
          Math.round(y + (r + quiet) * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize),
        );
      }
    }
  }

  // Subtle "SCAN TO VIEW" label beneath
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.font = "600 11px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("SCAN TO VIEW", x + size / 2, y + size + 22);
}

// ---------------------------------------------------------------------------
// DOM-to-canvas card renderer (fallback when no cardImageUrl)
// ---------------------------------------------------------------------------

function renderCardToCanvas(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  cx: number, cy: number, cardW: number, cardH: number,
): void {
  // Draw a stylized card representation directly on canvas
  const tierColor = TIER_COLORS[data.tier] ?? "#9aa3b2";

  ctx.save();

  // Card background (rounded rect)
  ctx.translate(cx, cy);

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  rr(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 18);
  ctx.fillStyle = "#131824";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Inner border (tier-coloured)
  ctx.strokeStyle = tierColor + "66";
  ctx.lineWidth = 2;
  rr(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 18);
  ctx.stroke();

  // Art area gradient
  const artGrad = ctx.createRadialGradient(0, -cardH * 0.15, 20, 0, -cardH * 0.15, cardW * 0.6);
  artGrad.addColorStop(0, tierColor + "44");
  artGrad.addColorStop(1, "transparent");
  rr(ctx, -cardW / 2 + 8, -cardH / 2 + 8, cardW - 16, cardH * 0.55, 12);
  ctx.fillStyle = artGrad;
  ctx.fill();

  // Character initial (placeholder art)
  ctx.fillStyle = tierColor + "22";
  ctx.font = `900 ${Math.floor(cardH * 0.35)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.characterName.charAt(0).toUpperCase(), 0, -cardH * 0.05);

  // Character name
  ctx.fillStyle = "#e8ecf4";
  ctx.font = `800 ${Math.floor(cardH * 0.065)}px Arial, sans-serif`;
  ctx.fillText(data.characterName, 0, cardH * 0.32);

  // Moment name
  ctx.fillStyle = "#6a7390";
  ctx.font = `600 ${Math.floor(cardH * 0.04)}px Arial, sans-serif`;
  ctx.fillText(data.momentName, 0, cardH * 0.4);

  // Tier badge (bottom)
  const badgeW = 80;
  const badgeH = 26;
  const badgeY = cardH * 0.5 - badgeH / 2;
  ctx.fillStyle = tierColor + "22";
  rr(ctx, -badgeW / 2, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.strokeStyle = tierColor + "55";
  ctx.lineWidth = 1.5;
  rr(ctx, -badgeW / 2, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.stroke();
  ctx.fillStyle = tierColor;
  ctx.font = `800 ${Math.floor(cardH * 0.038)}px Arial, sans-serif`;
  ctx.fillText(data.tier.toUpperCase(), 0, badgeY + badgeH * 0.72);

  // Serial (if present)
  if (data.serial) {
    ctx.fillStyle = "#4a5070";
    ctx.font = `600 ${Math.floor(cardH * 0.032)}px 'Courier New', monospace`;
    ctx.fillText(data.serial, 0, cardH * 0.42);
  }

  // Decorative corner marks
  ctx.strokeStyle = tierColor + "33";
  ctx.lineWidth = 1.5;
  const m = 12;
  const cl = cardW / 2 - m;
  const ct = cardH / 2 - m;
  const cs = 14;
  // TL
  ctx.beginPath(); ctx.moveTo(-cl, -ct + cs); ctx.lineTo(-cl, -ct); ctx.lineTo(-cl + cs, -ct); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(cl - cs, -ct); ctx.lineTo(cl, -ct); ctx.lineTo(cl, -ct + cs); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(-cl, ct - cs); ctx.lineTo(-cl, ct); ctx.lineTo(-cl + cs, ct); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(cl - cs, ct); ctx.lineTo(cl, ct); ctx.lineTo(cl, ct - cs); ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main ShareCard class
// ---------------------------------------------------------------------------

export class ShareCard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size = 1080;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext("2d")!;
  }

  /** Generate the 1080x1080 share image. Returns the canvas element. */
  async generate(data: ShareCardData): Promise<HTMLCanvasElement> {
    const ctx = this.ctx;
    const S = this.size;

    // Clear
    ctx.clearRect(0, 0, S, S);

    // 1. Background
    this.drawBackground();

    // 2. Card render (center, tilted ~8deg)
    await this.drawCardRender(data);

    // 3. Branding (top center)
    this.drawBranding();

    // 4. Character name (below card, gold gradient)
    this.drawCharacterInfo(data);

    // 5. Tier badge
    this.drawTierBadge(data.tier);

    // 6. Serial number (if present)
    if (data.serial) {
      this.drawSerial(data.serial);
    }

    // 7. QR placeholder (bottom-right)
    this.drawQRCode();

    // 8. Vignette
    this.applyVignette();

    // 9. Grain overlay
    this.addGrainOverlay();

    return this.canvas;
  }

  /** Trigger a download of the generated image. */
  download(filename = "bombermeme-card.png"): void {
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, "image/png");
  }

  /** Get a data URL of the generated image. */
  toDataURL(type = "image/png", quality?: number): string {
    return this.canvas.toDataURL(type, quality);
  }

  // -------------------------------------------------------------------------
  // Drawing methods
  // -------------------------------------------------------------------------

  private drawBackground(): void {
    const ctx = this.ctx;
    const S = this.size;

    // Dark gradient: #0a0c14 -> #1a1424
    const grad = ctx.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, "#0a0c14");
    grad.addColorStop(0.5, "#101220");
    grad.addColorStop(1, "#1a1424");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);

    // Subtle radial glow at center
    const glow = ctx.createRadialGradient(S / 2, S / 2, 60, S / 2, S / 2, S * 0.55);
    glow.addColorStop(0, "rgba(255,200,80,.04)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, S, S);

    // Subtle grid pattern
    ctx.strokeStyle = "rgba(255,255,255,.012)";
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < S; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); }
    for (let y = 0; y < S; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
  }

  private async drawCardRender(data: ShareCardData): Promise<void> {
    const ctx = this.ctx;
    const S = this.size;

    ctx.save();

    // Position: center, tilted ~8deg
    const cx = S / 2;
    const cy = S * 0.46;
    const scale = 0.7;
    const cardW = 320 * scale;
    const cardH = 450 * scale;

    ctx.translate(cx, cy);
    ctx.rotate((8 * Math.PI) / 180); // ~8 degrees

    if (data.cardImageUrl) {
      // Load and draw pre-rendered card image
      const img = await this.loadImage(data.cardImageUrl);
      if (img) {
        ctx.shadowColor = "rgba(0,0,0,.5)";
        ctx.shadowBlur = 50;
        ctx.shadowOffsetY = 20;
        ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      } else {
        renderCardToCanvas(ctx, data, 0, 0, cardW, cardH);
      }
    } else {
      // Draw stylized card directly on canvas
      renderCardToCanvas(ctx, data, 0, 0, cardW, cardH);
    }

    ctx.restore();
  }

  private drawBranding(): void {
    const ctx = this.ctx;
    const S = this.size;

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Gold gradient for "BOMBERMEME"
    const grad = ctx.createLinearGradient(0, 52, 0, 96);
    grad.addColorStop(0, "#fff0a8");
    grad.addColorStop(0.5, "#ffd84d");
    grad.addColorStop(1, "#ff9a3d");
    ctx.fillStyle = grad;

    // Drop shadow
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    let fontSize = 72;
    const text = "BOMBERMEME";
    do {
      ctx.font = `900 ${fontSize}px Arial, sans-serif`;
      fontSize -= 3;
    } while (ctx.measureText(text).width > S - 160 && fontSize > 40);
    ctx.fillText(text, S / 2, 96);

    // Tagline
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(200,210,230,.55)";
    ctx.font = "600 22px Arial, sans-serif";
    ctx.fillText("Collectible Card Game", S / 2, 128);
  }

  private drawCharacterInfo(data: ShareCardData): void {
    const ctx = this.ctx;
    const S = this.size;

    const y = S * 0.78;

    // Character name with gold gradient
    const grad = ctx.createLinearGradient(S * 0.2, y, S * 0.8, y);
    grad.addColorStop(0, "#ffd84d");
    grad.addColorStop(0.5, "#fff0a8");
    grad.addColorStop(1, "#ff9a3d");
    ctx.fillStyle = grad;
    ctx.textAlign = "center";

    let nameSize = 52;
    do {
      ctx.font = `900 ${nameSize}px Arial, sans-serif`;
      nameSize -= 2;
    } while (ctx.measureText(data.characterName).width > S - 200 && nameSize > 28);

    // Drop shadow
    ctx.shadowColor = "rgba(0,0,0,.4)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillText(data.characterName, S / 2, y);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // Moment name
    ctx.fillStyle = "rgba(150,160,185,.7)";
    ctx.font = "600 22px Arial, sans-serif";
    ctx.fillText(data.momentName, S / 2, y + 36);
  }

  private drawTierBadge(tier: string): void {
    const ctx = this.ctx;
    const S = this.size;
    const color = TIER_COLORS[tier] ?? "#9aa3b2";

    const badgeW = 160;
    const badgeH = 42;
    const bx = S / 2 - badgeW / 2;
    const by = S * 0.82;

    // Background pill
    ctx.fillStyle = color + "18";
    rr(ctx, bx, by, badgeW, badgeH, badgeH / 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = color + "44";
    ctx.lineWidth = 2;
    rr(ctx, bx, by, badgeW, badgeH, badgeH / 2);
    ctx.stroke();

    // Tier text
    ctx.fillStyle = color;
    ctx.font = "800 18px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Glow
    ctx.shadowColor = color + "55";
    ctx.shadowBlur = 12;
    ctx.fillText(tier.toUpperCase(), S / 2, by + badgeH / 2 + 1);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  private drawSerial(serial: string): void {
    const ctx = this.ctx;
    const S = this.size;

    ctx.fillStyle = "rgba(120,130,160,.6)";
    ctx.font = "600 18px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(serial, S / 2, S * 0.87);
  }

  private drawQRCode(): void {
    const qrSize = 160;
    const qx = this.size - 64 - qrSize;
    const qy = this.size - 64 - qrSize;
    drawQRPlaceholder(this.ctx, qx, qy, qrSize);
  }

  private applyVignette(): void {
    const ctx = this.ctx;
    const S = this.size;

    const grad = ctx.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.72);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, "rgba(5,6,10,.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
  }

  private addGrainOverlay(): void {
    const ctx = this.ctx;
    const S = this.size;

    // Use a smaller grain tile and repeat it
    const grainSize = 256;
    const grain = buildGrain(grainSize);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = tempCanvas.height = grainSize;
    const tctx = tempCanvas.getContext("2d")!;
    tctx.putImageData(grain, 0, 0);

    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = "overlay";
    for (let y = 0; y < S; y += grainSize) {
      for (let x = 0; x < S; x += grainSize) {
        ctx.drawImage(tempCanvas, x, y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // -------------------------------------------------------------------------
  // Image loading helper
  // -------------------------------------------------------------------------

  private loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}
