/**
 * ShareCard.ts — BomberMeme CCG v2
 *
 * Generates a 1080x1080 PNG image for social media sharing.
 * Uses Canvas 2D only — no WebGL, no external dependencies.
 *
 * Composition:
 *   1. Dark gradient background with radial center glow
 *   2. Card render (tilted ~8 degrees, scaled to ~70% of canvas)
 *   3. Character name (large Cinzel-style gold text)
 *   4. Tier badge (colored badge)
 *   5. Serial number (if present, mono font)
 *   6. "BOMBERMEME" branding (gold text + drop-shadow)
 *   7. QR code placeholder (rounded square)
 *   8. Vignette overlay
 *   9. Grain texture
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
// Constants
// ---------------------------------------------------------------------------

const SIZE = 1080;
const CARD_SCALE = 0.55;
const CARD_TILT = 8; // degrees

const TIER_COLORS: Record<string, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
};

// ---------------------------------------------------------------------------
// ShareCard class
// ---------------------------------------------------------------------------

export class ShareCard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext("2d")!;
  }

  /** Generate the 1080x1080 shareable image. */
  async generate(data: ShareCardData): Promise<HTMLCanvasElement> {
    this.ctx.clearRect(0, 0, SIZE, SIZE);

    this.drawBackground();
    await this.drawCardRender(data);
    this.drawBranding();
    this.drawCharacterInfo(data);
    this.drawQRCode();
    this.applyVignette();
    this.addGrainOverlay();

    return this.canvas;
  }

  /** Trigger a download of the generated image. */
  download(filename?: string): void {
    const link = document.createElement("a");
    link.download = filename || `bombermeme-card-${Date.now()}.png`;
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  }

  /** Get the canvas data URL for embedding. */
  getDataURL(): string {
    return this.canvas.toDataURL("image/png");
  }

  // -----------------------------------------------------------------
  // Drawing methods
  // -----------------------------------------------------------------

  private drawBackground(): void {
    // Dark gradient
    const grad = this.ctx.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0, "#0a0c14");
    grad.addColorStop(1, "#1a1424");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, SIZE, SIZE);

    // Subtle radial glow in center
    const radial = this.ctx.createRadialGradient(
      SIZE / 2, SIZE / 2, SIZE * 0.1,
      SIZE / 2, SIZE / 2, SIZE * 0.6,
    );
    radial.addColorStop(0, "rgba(255,215,0,0.04)");
    radial.addColorStop(1, "transparent");
    this.ctx.fillStyle = radial;
    this.ctx.fillRect(0, 0, SIZE, SIZE);
  }

  private async drawCardRender(data: ShareCardData): Promise<void> {
    const ctx = this.ctx;

    if (data.cardImageUrl) {
      // Use provided image
      try {
        const img = await this.loadImage(data.cardImageUrl);
        this.drawCardImage(ctx, img);
      } catch {
        this.drawStylizedCard(data);
      }
    } else {
      // Draw stylized card
      this.drawStylizedCard(data);
    }
  }

  private drawCardImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
    const cardW = SIZE * CARD_SCALE;
    const cardH = cardW * 1.35; // card aspect ratio
    const cx = SIZE / 2;
    const cy = SIZE / 2 - 40;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((CARD_TILT * Math.PI) / 180);

    // Card shadow
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 15;
    ctx.shadowOffsetY = 20;

    // Card frame
    this.roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 16);
    ctx.fillStyle = "#1a1424";
    ctx.fill();
    ctx.shadowColor = "transparent";

    // Draw image
    ctx.save();
    ctx.clip();
    ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
    ctx.restore();

    // Inner border
    ctx.strokeStyle = "rgba(255,215,0,0.2)";
    ctx.lineWidth = 2;
    this.roundRect(ctx, -cardW / 2 + 4, -cardH / 2 + 4, cardW - 8, cardH - 8, 12);
    ctx.stroke();

    ctx.restore();
  }

  private drawStylizedCard(data: ShareCardData): void {
    const ctx = this.ctx;
    const cardW = SIZE * CARD_SCALE;
    const cardH = cardW * 1.35;
    const cx = SIZE / 2;
    const cy = SIZE / 2 - 40;
    const tierColor = TIER_COLORS[data.tier.toLowerCase()] ?? "#9aa3b2";

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((CARD_TILT * Math.PI) / 180);

    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 15;
    ctx.shadowOffsetY = 20;

    // Card body
    this.roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 16);
    const cardGrad = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, cardH / 2);
    cardGrad.addColorStop(0, "#1e1a2e");
    cardGrad.addColorStop(1, "#141020");
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.shadowColor = "transparent";

    // Art area
    const artMargin = 12;
    const artH = cardH * 0.55;
    this.roundRect(ctx, -cardW / 2 + artMargin, -cardH / 2 + artMargin, cardW - artMargin * 2, artH, 10);
    const artGrad = ctx.createLinearGradient(0, -cardH / 2, 0, -cardH / 2 + artH);
    artGrad.addColorStop(0, tierColor + "33");
    artGrad.addColorStop(1, tierColor + "11");
    ctx.fillStyle = artGrad;
    ctx.fill();

    // Character silhouette (circle placeholder)
    ctx.beginPath();
    ctx.arc(0, -cardH / 2 + artMargin + artH / 2, cardW * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = tierColor + "22";
    ctx.fill();
    ctx.strokeStyle = tierColor + "44";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tier glow line
    ctx.strokeStyle = tierColor + "66";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-cardW / 2 + artMargin, -cardH / 2 + artMargin + artH + 10);
    ctx.lineTo(cardW / 2 - artMargin, -cardH / 2 + artMargin + artH + 10);
    ctx.stroke();

    // Character name
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.characterName, 0, -cardH / 2 + artMargin + artH + 45);

    // Tier
    ctx.fillStyle = tierColor;
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText(data.tier.toUpperCase(), 0, -cardH / 2 + artMargin + artH + 70);

    // Moment
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "italic 12px system-ui, sans-serif";
    ctx.fillText(data.momentName, 0, -cardH / 2 + artMargin + artH + 90);

    // Inner border
    ctx.strokeStyle = tierColor + "33";
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, -cardW / 2 + 4, -cardH / 2 + 4, cardW - 8, cardH - 8, 12);
    ctx.stroke();

    ctx.restore();
  }

  private drawBranding(): void {
    const ctx = this.ctx;

    // "BOMBERMEME" text
    ctx.save();
    ctx.fillStyle = "#c8a030";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;
    ctx.fillText("BOMBERMEME", SIZE / 2, 65);

    // Decorative line under branding
    ctx.strokeStyle = "rgba(200,160,48,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2 - 80, 78);
    ctx.lineTo(SIZE / 2 + 80, 78);
    ctx.stroke();

    ctx.restore();
  }

  private drawCharacterInfo(data: ShareCardData): void {
    const ctx = this.ctx;
    const tierColor = TIER_COLORS[data.tier.toLowerCase()] ?? "#9aa3b2";

    ctx.save();

    // Character name below card
    const nameY = SIZE * 0.78;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 44px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillText(data.characterName, SIZE / 2, nameY);

    // Tier badge
    const badgeY = nameY + 36;
    const badgeText = data.tier.toUpperCase();
    ctx.font = "bold 16px system-ui, sans-serif";
    const badgeW = ctx.measureText(badgeText).width + 28;
    const badgeH = 30;
    const badgeX = SIZE / 2 - badgeW / 2;

    this.roundRect(ctx, badgeX, badgeY - badgeH / 2, badgeW, badgeH, 8);
    ctx.fillStyle = tierColor + "22";
    ctx.fill();
    ctx.strokeStyle = tierColor + "55";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = tierColor;
    ctx.shadowColor = "transparent";
    ctx.fillText(badgeText, SIZE / 2, badgeY + 5);

    // Serial number
    if (data.serial) {
      const serialY = badgeY + 32;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillText(data.serial, SIZE / 2, serialY);
    }

    ctx.restore();
  }

  private drawQRCode(): void {
    const ctx = this.ctx;
    const size = 80;
    const x = SIZE - size - 40;
    const y = SIZE - size - 40;

    ctx.save();

    // Rounded square background
    this.roundRect(ctx, x, y, size, size, 12);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // QR pattern (3 corner squares + scattered dots)
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    const qrSize = 48;
    const qrX = x + (size - qrSize) / 2;
    const qrY = y + (size - qrSize) / 2;

    // Top-left corner
    ctx.fillRect(qrX, qrY, 12, 12);
    ctx.clearRect(qrX + 3, qrY + 3, 6, 6);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(qrX + 5, qrY + 5, 2, 2);

    // Top-right corner
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(qrX + qrSize - 12, qrY, 12, 12);
    ctx.clearRect(qrX + qrSize - 9, qrY + 3, 6, 6);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(qrX + qrSize - 7, qrY + 5, 2, 2);

    // Bottom-left corner
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(qrX, qrY + qrSize - 12, 12, 12);
    ctx.clearRect(qrX + 3, qrY + qrSize - 9, 6, 6);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(qrX + 5, qrY + qrSize - 7, 2, 2);

    // Scattered data dots
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 12; i++) {
      const dx = qrX + 16 + Math.floor(Math.random() * 24);
      const dy = qrY + 16 + Math.floor(Math.random() * 24);
      ctx.fillRect(dx, dy, 3, 3);
    }

    // "SCAN TO VIEW" text
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCAN", x + size / 2, y + size + 14);
    ctx.fillText("TO VIEW", x + size / 2, y + size + 24);

    ctx.restore();
  }

  private applyVignette(): void {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(
      SIZE / 2, SIZE / 2, SIZE * 0.3,
      SIZE / 2, SIZE / 2, SIZE * 0.75,
    );
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  private addGrainOverlay(): void {
    const ctx = this.ctx;
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    const data = imageData.data;

    // Subtle noise (every 4th pixel for performance)
    for (let i = 0; i < data.length; i += 16) {
      const noise = (Math.random() - 0.5) * 8;
      data[i] = Math.max(0, Math.min(255, data[i]! + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + noise));
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// ---------------------------------------------------------------------------
// ShareCard CSS (for any UI wrapper around the share button)
// ---------------------------------------------------------------------------

export function getShareCardCSS(): string {
  return /* css */ `
.share-card-btn{padding:8px 18px;border-radius:10px;background:rgba(74,163,255,.15);border:1px solid rgba(74,163,255,.3);color:#4aa3ff;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.share-card-btn:hover{background:rgba(74,163,255,.25)}
.share-card-modal{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.8);backdrop-filter:blur(10px)}
.share-card-modal img{max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.share-card-actions{display:flex;gap:10px;margin-top:16px;justify-content:center}
.share-download-btn{padding:10px 24px;border-radius:12px;background:rgba(95,217,106,.15);border:1px solid rgba(95,217,106,.3);color:#5fd96a;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
.share-download-btn:hover{background:rgba(95,217,106,.25)}
.share-close-btn{padding:10px 20px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.6);font-size:14px;cursor:pointer;transition:all .2s}
.share-close-btn:hover{background:rgba(255,255,255,.1)}
`;
}
