import { GRID_W, GRID_H, TileType, BOMB_TIMER_MS, EXPLOSION_LIFETIME_MS } from "../net/protocol.js";
import type { RenderView } from "./state.js";
import type { Assets } from "./assets.js";

export const PLAYER_COLORS = ["#ff5555", "#4aa3ff", "#5fd96a", "#ffcc33"];
export const SKIN_EMOJI = ["🐕", "🐸", "🦊", "😐"];

/** DOM avatar showing the character sprite (emoji fallback), with an optional
 *  colored ring. Shared by the skin picker, room list and HUD. */
export function skinAvatar(skin: number, color?: string): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "avatar";
  if (color) wrap.style.boxShadow = `inset 0 0 0 2px ${color}`;
  const img = document.createElement("img");
  img.src = `/sprites/skin_${skin}.webp`;
  img.alt = SKIN_EMOJI[skin % SKIN_EMOJI.length];
  img.onerror = () => {
    const s = document.createElement("span");
    s.textContent = SKIN_EMOJI[skin % SKIN_EMOJI.length];
    img.replaceWith(s);
  };
  wrap.appendChild(img);
  return wrap;
}

const PU_ICON: Partial<Record<TileType, string>> = {
  [TileType.PU_BOMB]: "💣",
  [TileType.PU_FIRE]: "🔥",
  [TileType.PU_SPEED]: "👟",
  [TileType.PU_KICK]: "🦵",
  [TileType.PU_WALL]: "👻",
};

const PU_SPRITE: Partial<Record<TileType, string>> = {
  [TileType.PU_BOMB]: "pu_bomb",
  [TileType.PU_FIRE]: "pu_fire",
  [TileType.PU_SPEED]: "pu_speed",
  [TileType.PU_KICK]: "pu_kick",
  [TileType.PU_WALL]: "pu_wall",
};

const DEATH_MS = 650;

interface Particle {
  x: number; // cell coords
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds remaining
  max: number;
  size: number; // px
  color: string;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private tile = 32;
  private dpr = 1;
  private assets: Assets | null = null;

  /** Maps a player id to a skin index. Overridden by main. */
  skinOf: (id: number) => number = (id) => id % PLAYER_COLORS.length;

  private fireStart = new Map<number, number>();
  private lastPos = new Map<number, { x: number; y: number }>();
  private facing = new Map<number, "down" | "up" | "left" | "right">();
  private deadAt = new Map<number, number>();
  private particles: Particle[] = [];
  private shakeUntil = 0;
  private shakeMag = 0;
  private lastTime = performance.now();

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
    this.tile = Math.floor(Math.min(window.innerWidth / GRID_W, window.innerHeight / GRID_H));
    const w = this.tile * GRID_W;
    const h = this.tile * GRID_H;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  }

  // -- VFX API ---------------------------------------------------------------

  shake(mag: number, ms = 220): void {
    this.shakeUntil = Math.max(this.shakeUntil, performance.now() + ms);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  burst(cx: number, cy: number, color: string, count: number, speed = 3): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x: cx + 0.5,
        y: cy + 0.5,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        size: this.tile * (0.06 + Math.random() * 0.08),
        color,
      });
    }
  }

  onExplosion(cells: Array<{ x: number; y: number }>): void {
    for (const c of cells) {
      this.burst(c.x, c.y, Math.random() < 0.5 ? "#ffce54" : "#ff7043", 5, 4);
    }
    this.shake(Math.min(10, 3 + cells.length * 0.6));
  }

  onDeath(cx: number, cy: number, color: string): void {
    this.burst(cx, cy, color, 22, 5);
    this.burst(cx, cy, "#ffffff", 8, 3);
    this.shake(8, 260);
  }

  // -- main draw -------------------------------------------------------------

  render(view: RenderView, myId: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Screen shake.
    ctx.save();
    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / 220;
      const m = this.shakeMag * Math.min(1, k);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    } else {
      this.shakeMag = 0;
    }

    if (view.grid) {
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const i = y * GRID_W + x;
          const tile = view.grid[i] as TileType;
          if (tile === TileType.EXPLOSION) {
            if (!this.fireStart.has(i)) this.fireStart.set(i, now);
          } else if (this.fireStart.has(i)) {
            this.fireStart.delete(i);
          }
          this.drawTile(x, y, tile, i, now);
        }
      }
    }

    for (const b of view.bombs) {
      const pulse = 1 - (b.fuseLeftMs / BOMB_TIMER_MS) * 0.25;
      const cx = (b.x + 0.5) * t;
      const cy = (b.y + 0.5) * t;
      const color = PLAYER_COLORS[b.ownerId % PLAYER_COLORS.length];
      // Owner-colored glow under the bomb (pulses with the fuse).
      const glow = t * 0.5 * (0.85 + 0.15 * Math.sin(now / 80));
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glow);
      grad.addColorStop(0, color + "cc");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glow, 0, Math.PI * 2);
      ctx.fill();
      const img = this.assets?.img("bomb");
      if (img) {
        const s = t * 0.9 * (0.95 + 0.05 * Math.sin(now / 80)) * pulse;
        ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
      } else {
        const r = t * 0.34 * (0.9 + 0.1 * Math.sin(now / 80)) * pulse;
        ctx.fillStyle = "#15151a";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ff7043";
        ctx.fillRect(cx - 1.5, cy - r - t * 0.12, 3, t * 0.12);
      }
    }

    this.drawPlayers(view, myId, now);
    this.updateParticles(dt);
    ctx.restore();
  }

  private drawPlayers(view: RenderView, myId: number, now: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    const seen = new Set<number>();
    const WALK_SEQ = [0, 1, 2, 1]; // ping-pong walk cycle

    for (const p of view.players) {
      seen.add(p.id);
      if (p.alive) this.deadAt.delete(p.id);
      else if (!this.deadAt.has(p.id)) this.deadAt.set(p.id, now);

      let scale = 1;
      let alpha = 1;
      if (!p.alive) {
        const age = now - (this.deadAt.get(p.id) ?? now);
        if (age > DEATH_MS) continue;
        const k = age / DEATH_MS;
        scale = 1 - k;
        alpha = 1 - k;
      } else if (p.invuln) {
        alpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(now / 70));
      }

      // Positions are already smoothly interpolated upstream (state.view), so
      // we render them directly — same path for self and remote players.
      const rp = { x: p.x, y: p.y };

      // Facing inferred from movement; remembered while standing still.
      const last = this.lastPos.get(p.id);
      const dx = last ? rp.x - last.x : 0;
      const dy = last ? rp.y - last.y : 0;
      const moving = Math.hypot(dx, dy) > 0.006;
      let face = this.facing.get(p.id) ?? "down";
      if (moving) {
        face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        this.facing.set(p.id, face);
      }
      this.lastPos.set(p.id, { x: rp.x, y: rp.y });

      const cx = rp.x * t;
      const cy = rp.y * t;
      const r = t * 0.36 * scale;
      ctx.globalAlpha = alpha;

      const sk = this.skinOf(p.id);
      const frame = moving && p.alive ? WALK_SEQ[Math.floor(now / 130) % WALK_SEQ.length] : 0;
      const dirName = face === "up" ? "up" : face === "down" ? "down" : "side";
      const flip = face === "left";
      // Directional walk frame -> static skin -> emoji.
      const img = this.assets?.img(`skin${sk}_${dirName}_${frame}`) ?? this.assets?.img(`skin${sk}`);

      if (img) {
        const s = t * 0.92 * scale;
        ctx.save();
        ctx.translate(cx, cy);
        if (!p.alive) ctx.rotate((1 - scale) * 1.2);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.fillStyle = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${Math.floor(t * 0.5 * scale)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(SKIN_EMOJI[sk % SKIN_EMOJI.length], cx, cy + 1);
      }

      if (p.id === myId && p.alive) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (const id of [...this.lastPos.keys()]) {
      if (!seen.has(id)) {
        this.lastPos.delete(id);
        this.facing.delete(id);
      }
    }
  }

  private updateParticles(dt: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * t, p.y * t, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // -- tiles -----------------------------------------------------------------

  private drawTile(x: number, y: number, tile: TileType, index: number, now: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    const px = x * t;
    const py = y * t;

    const floor = this.assets?.img("floor");
    if (floor) ctx.drawImage(floor, px, py, t, t);
    else {
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
      case TileType.EXPLOSION: {
        const start = this.fireStart.get(index) ?? now;
        const frame = Math.min(2, Math.floor((now - start) / (EXPLOSION_LIFETIME_MS / 3)));
        const drawn =
          this.drawTileSprite(`explosion${frame}`, px, py) || this.drawTileSprite("explosion", px, py);
        if (!drawn) this.drawFire(px, py);
        break;
      }
      default: {
        const key = PU_SPRITE[tile];
        if (key && this.drawTileSprite(key, px, py)) break;
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
