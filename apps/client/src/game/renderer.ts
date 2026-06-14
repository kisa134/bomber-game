import { GRID_W, GRID_H, TileType, BOMB_TIMER_MS } from "../net/protocol.js";
import type { RenderView } from "./state.js";
import type { Assets } from "./assets.js";

export const PLAYER_COLORS = ["#ff5555", "#4aa3ff", "#5fd96a", "#ffcc33"];
export const SKIN_EMOJI = ["🐕", "🐸", "🦊", "😐"];

const PU_ICON: Partial<Record<TileType, string>> = {
  [TileType.PU_BOMB]: "💣",
  [TileType.PU_FIRE]: "🔥",
  [TileType.PU_SPEED]: "👟",
  [TileType.PU_KICK]: "🦵",
};

const PU_SPRITE: Partial<Record<TileType, string>> = {
  [TileType.PU_BOMB]: "pu_bomb",
  [TileType.PU_FIRE]: "pu_fire",
  [TileType.PU_SPEED]: "pu_speed",
  [TileType.PU_KICK]: "pu_kick",
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private tile = 32;
  private dpr = 1;
  private assets: Assets | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  setAssets(assets: Assets): void {
    this.assets = assets;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;
    this.tile = Math.floor(Math.min(maxW / GRID_W, maxH / GRID_H));
    const logicalW = this.tile * GRID_W;
    const logicalH = this.tile * GRID_H;
    this.canvas.width = logicalW * this.dpr;
    this.canvas.height = logicalH * this.dpr;
    this.canvas.style.width = `${logicalW}px`;
    this.canvas.style.height = `${logicalH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false; // crisp pixel art
  }

  render(view: RenderView, myId: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (view.grid) {
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          this.drawTile(x, y, view.grid[y * GRID_W + x] as TileType);
        }
      }
    }

    // Bombs.
    for (const b of view.bombs) {
      const pulse = 1 - (b.fuseLeftMs / BOMB_TIMER_MS) * 0.25;
      const cx = (b.x + 0.5) * t;
      const cy = (b.y + 0.5) * t;
      const bombImg = this.assets?.img("bomb");
      if (bombImg) {
        const s = t * 0.9 * (0.95 + 0.05 * Math.sin(performance.now() / 80)) * pulse;
        ctx.drawImage(bombImg, cx - s / 2, cy - s / 2, s, s);
      } else {
        const r = t * 0.34 * (0.9 + 0.1 * Math.sin(performance.now() / 80)) * pulse;
        ctx.fillStyle = "#15151a";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff7043";
        ctx.fillRect(cx - 1.5, cy - r - t * 0.12, 3, t * 0.12);
      }
    }

    // Players.
    for (const p of view.players) {
      if (!p.alive) continue;
      const cx = p.x * t;
      const cy = p.y * t;
      const r = t * 0.36;
      const skin = this.assets?.img(`skin${p.id % PLAYER_COLORS.length}`);
      if (skin) {
        const s = t * 0.92;
        ctx.drawImage(skin, cx - s / 2, cy - s / 2, s, s);
      } else {
        ctx.fillStyle = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${Math.floor(t * 0.5)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(SKIN_EMOJI[p.id % SKIN_EMOJI.length], cx, cy + 1);
      }
      if (p.id === myId) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawTile(x: number, y: number, tile: TileType): void {
    const ctx = this.ctx;
    const t = this.tile;
    const px = x * t;
    const py = y * t;

    // Floor base: sprite if provided, else a subtle checker.
    const floor = this.assets?.img("floor");
    if (floor) {
      ctx.drawImage(floor, px, py, t, t);
    } else {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#1a2030" : "#161b29";
      ctx.fillRect(px, py, t, t);
    }

    switch (tile) {
      case TileType.HARD:
        this.drawTileSprite("hard", px, py) || this.drawHard(px, py);
        break;
      case TileType.SOFT:
        this.drawTileSprite("soft", px, py) || this.drawSoft(px, py);
        break;
      case TileType.EXPLOSION:
        this.drawTileSprite("explosion", px, py) || this.drawFire(px, py);
        break;
      default: {
        const spriteKey = PU_SPRITE[tile];
        if (spriteKey && this.drawTileSprite(spriteKey, px, py)) break;
        const icon = PU_ICON[tile];
        if (icon) {
          ctx.font = `${Math.floor(t * 0.6)}px system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(icon, px + t / 2, py + t / 2 + 1);
        }
      }
    }
  }

  /** Returns true if a sprite was drawn for this key. */
  private drawTileSprite(key: string, px: number, py: number): boolean {
    const img = this.assets?.img(key);
    if (!img) return false;
    this.ctx.drawImage(img, px, py, this.tile, this.tile);
    return true;
  }

  private drawHard(px: number, py: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    ctx.fillStyle = "#414a5e";
    ctx.fillRect(px + 1, py + 1, t - 2, t - 2);
    ctx.fillStyle = "#535e76";
    ctx.fillRect(px + 1, py + 1, t - 2, (t - 2) * 0.35);
  }

  private drawSoft(px: number, py: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(px + 2, py + 2, t - 4, t - 4);
    ctx.fillStyle = "#a06b48";
    ctx.fillRect(px + 2, py + 2, t - 4, (t - 4) * 0.4);
  }

  private drawFire(px: number, py: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    const flick = 0.6 + 0.4 * Math.random();
    ctx.fillStyle = `rgba(255, ${Math.floor(140 * flick)}, 40, 0.92)`;
    ctx.fillRect(px + 1, py + 1, t - 2, t - 2);
    ctx.fillStyle = "rgba(255,230,120,0.9)";
    ctx.fillRect(px + t * 0.3, py + t * 0.3, t * 0.4, t * 0.4);
  }
}
