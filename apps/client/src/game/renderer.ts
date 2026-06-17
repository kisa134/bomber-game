import { GRID_W, GRID_H, TileType, BOMB_TIMER_MS, EXPLOSION_LIFETIME_MS, START_LIVES } from "../net/protocol.js";
import type { RenderView } from "./state.js";
import type { Assets } from "./assets.js";

export const PLAYER_COLORS = ["#ff5555", "#4aa3ff", "#5fd96a", "#ffcc33"];
export const SKIN_EMOJI = ["🐸", "🐕", "🧑‍🚀", "🧑"]; // pepe, doge, elon, trump

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
  [TileType.PU_HEALTH]: "❤️",
};

const PU_SPRITE: Partial<Record<TileType, string>> = {
  [TileType.PU_BOMB]: "pu_bomb",
  [TileType.PU_FIRE]: "pu_fire",
  [TileType.PU_SPEED]: "pu_speed",
  [TileType.PU_KICK]: "pu_kick",
  [TileType.PU_WALL]: "pu_wall",
  [TileType.PU_HEALTH]: "pu_health",
};

const DEATH_MS = 650;
const MAX_PARTICLES = 520;
const MAX_DECALS = 90;

interface Particle {
  x: number; // cell coords
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds remaining
  max: number;
  size: number; // px
  color: string;
  gravity?: number; // cells/s^2 added to vy
  drag?: number; // per-frame velocity multiplier (default 0.92)
  grow?: number; // px/s size growth (smoke)
  rot?: number; // current rotation (rad)
  spin?: number; // rad/s
  shape?: "circle" | "rect" | "glyph" | "flash";
  glyph?: string;
}

interface Decal {
  x: number; // cell coords (top-left)
  y: number;
  born: number;
  life: number; // ms
  kind: "scorch" | "trample";
  rot: number;
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
  private emotes = new Map<number, { e: string; until: number }>();
  private particles: Particle[] = [];
  private decals: Decal[] = [];
  private prevGrid: Uint8Array | null = null;
  private lastDust = new Map<number, number>();
  private lastTrample = new Map<number, number>();
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
    // Fit the canvas into the play area (above the HUD panel), not the whole
    // window. Leave a margin so the framed board floats off the screen edges.
    const margin = 22;
    const host = this.canvas.parentElement;
    const availW = (host?.clientWidth || window.innerWidth) - margin * 2;
    const availH = (host?.clientHeight || window.innerHeight) - margin * 2;
    this.tile = Math.floor(Math.min(availW / GRID_W, availH / GRID_H));
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

  /** Show a reaction bubble above a player for a short time. */
  showEmote(playerId: number, e: string): void {
    this.emotes.set(playerId, { e, until: performance.now() + 1800 });
  }

  shake(mag: number, ms = 220): void {
    this.shakeUntil = Math.max(this.shakeUntil, performance.now() + ms);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  private push(p: Particle): void {
    this.particles.push(p);
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }

  burst(cx: number, cy: number, color: string, count: number, speed = 3): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.push({
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

  /** Explosion FX per blast cell: colored flames, rising smoke, and a couple of
   *  flying burned-dollar $ icons. Plus a scorch decal + a light shake. No white
   *  flashes (those were seizure-y). */
  onExplosion(cells: Array<{ x: number; y: number }>): void {
    for (const c of cells) {
      const cx = c.x + 0.5;
      const cy = c.y + 0.5;
      // Flames.
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 1.6 + Math.random() * 2.6;
        this.push({
          x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6,
          life: 0.28 + Math.random() * 0.32, max: 0.6, drag: 0.9,
          size: this.tile * (0.1 + Math.random() * 0.1),
          color: Math.random() < 0.5 ? "#ffd24a" : "#ff7a30",
        });
      }
      // Rising smoke.
      for (let i = 0; i < 3; i++) {
        this.push({
          x: cx + (Math.random() - 0.5) * 0.4, y: cy, vx: (Math.random() - 0.5) * 0.6, vy: -0.8 - Math.random(),
          life: 0.7 + Math.random() * 0.5, max: 1.2, drag: 0.95, grow: this.tile * 0.25,
          size: this.tile * 0.18, color: "rgba(70,66,60,0.5)",
        });
      }
      // Flying burned dollars.
      if (Math.random() < 0.7) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const s = 2.2 + Math.random() * 2;
        this.push({
          x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.8 + Math.random() * 0.4, max: 1.2, gravity: 9, drag: 0.99,
          size: this.tile * 0.34, color: "#7bd66a", shape: "glyph", glyph: "$",
          rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 10,
        });
      }
      this.addDecal(c.x, c.y, "scorch");
    }
    this.shake(Math.min(8, 3 + cells.length * 0.5), 120);
  }

  onDeath(cx: number, cy: number, color: string): void {
    this.burst(cx, cy, color, 22, 5);
    this.burst(cx, cy, "#ffffff", 8, 3);
    this.shake(8, 260);
  }

  private addDecal(x: number, y: number, kind: Decal["kind"]): void {
    this.decals.push({ x, y, born: this.lastTime, life: kind === "scorch" ? 6000 : 2600, kind, rot: Math.random() * Math.PI });
    if (this.decals.length > MAX_DECALS) this.decals.shift();
  }

  // -- main draw -------------------------------------------------------------

  render(view: RenderView, myId: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const W = t * GRID_W;
    const H = t * GRID_H;

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
      // Detect soft-block breaks (SOFT -> not SOFT) to spray debris.
      if (this.prevGrid && this.prevGrid.length === view.grid.length) {
        for (let i = 0; i < view.grid.length; i++) {
          if (this.prevGrid[i] === TileType.SOFT && view.grid[i] !== TileType.SOFT) {
            this.emitDebris(i % GRID_W, (i / GRID_W) | 0);
          }
        }
      }
      this.prevGrid = (this.prevGrid && this.prevGrid.length === view.grid.length ? this.prevGrid : new Uint8Array(view.grid.length));
      this.prevGrid.set(view.grid);

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

    this.drawDecals(now);
    this.drawWind(now, W, H);

    for (const b of view.bombs) {
      const pulse = 1 - (b.fuseLeftMs / BOMB_TIMER_MS) * 0.25;
      const cx = (b.x + 0.5) * t;
      const cy = (b.y + 0.5) * t;
      const color = PLAYER_COLORS[b.ownerId % PLAYER_COLORS.length];
      this.drawShadow(cx, cy + t * 0.3, t * 0.34, t * 0.14, 0.28);
      // Owner-colored glow under the bomb, pulsing faster as the fuse burns down.
      const urgency = 1 - b.fuseLeftMs / BOMB_TIMER_MS; // 0 -> 1
      const beat = Math.sin(now / (90 - urgency * 55));
      const glow = t * (0.5 + urgency * 0.25) * (0.8 + 0.2 * beat);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glow);
      grad.addColorStop(0, color + (urgency > 0.7 ? "ee" : "cc"));
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glow, 0, Math.PI * 2);
      ctx.fill();
      const img = this.assets?.img("bomb");
      if (img) {
        const s = t * 0.9 * (0.95 + 0.05 * beat) * pulse;
        ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
      } else {
        const r = t * 0.34 * (0.9 + 0.1 * beat) * pulse;
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
      // Fuse sparks above the bomb.
      if (Math.random() < 0.5) {
        this.push({
          x: b.x + 0.5 + (Math.random() - 0.5) * 0.18, y: b.y + 0.18, vx: (Math.random() - 0.5) * 0.8, vy: -1 - Math.random(),
          life: 0.22 + Math.random() * 0.2, max: 0.42, drag: 0.9, size: t * 0.04,
          color: Math.random() < 0.5 ? "#fff2a8" : "#ffae3a",
        });
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

      // Shadow grounding the player (under the feet).
      if (p.alive) this.drawShadow(cx, cy + t * 0.34, t * 0.3 * scale, t * 0.12 * scale, 0.26);

      // Kick up dust / trample grass while moving.
      if (moving && p.alive) {
        if (now - (this.lastDust.get(p.id) ?? 0) > 90) {
          this.lastDust.set(p.id, now);
          this.push({
            x: rp.x + 0.5 + (Math.random() - 0.5) * 0.3, y: rp.y + 0.85, vx: (Math.random() - 0.5) * 1.2, vy: -0.5 - Math.random() * 0.5,
            life: 0.3 + Math.random() * 0.2, max: 0.5, drag: 0.9, size: t * (0.04 + Math.random() * 0.04),
            color: Math.random() < 0.5 ? "rgba(150,170,90,0.7)" : "rgba(120,100,70,0.7)",
          });
        }
        if (now - (this.lastTrample.get(p.id) ?? 0) > 160) {
          this.lastTrample.set(p.id, now);
          this.addDecal(Math.floor(rp.x), Math.floor(rp.y), "trample");
        }
      }

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

      // HP bar above the player: START_LIVES segments, filled = current HP.
      if (p.alive) {
        ctx.globalAlpha = 1;
        const segs = START_LIVES;
        const bw = t * 0.62;
        const gap = t * 0.04;
        const sw = (bw - gap * (segs - 1)) / segs;
        const sh = t * 0.1;
        const bx = cx - bw / 2;
        const byy = cy - r - t * 0.22;
        for (let s = 0; s < segs; s++) {
          ctx.fillStyle = s < p.lives ? "#5fd96a" : "rgba(0,0,0,0.55)";
          ctx.fillRect(bx + s * (sw + gap), byy, sw, sh);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, byy, bw, sh);
      }

      // Reaction bubble above the player.
      const em = this.emotes.get(p.id);
      if (em && now < em.until) {
        ctx.globalAlpha = 1;
        const by = cy - r - t * 0.55;
        const bs = t * 0.42;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        ctx.arc(cx, by, bs, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${Math.floor(t * 0.5)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(em.e, cx, by + 1);
      } else if (em) {
        this.emotes.delete(p.id);
      }
      ctx.globalAlpha = 1;
    }

    for (const id of [...this.lastPos.keys()]) {
      if (!seen.has(id)) {
        this.lastPos.delete(id);
        this.facing.delete(id);
        this.lastDust.delete(id);
        this.lastTrample.delete(id);
      }
    }
  }

  /** Brown/orange chunks flung out when a soft block is destroyed. */
  private emitDebris(gx: number, gy: number): void {
    const t = this.tile;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 3;
      this.push({
        x: gx + 0.5, y: gy + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5,
        life: 0.4 + Math.random() * 0.35, max: 0.75, gravity: 16, drag: 0.99,
        size: t * (0.06 + Math.random() * 0.07), shape: "rect",
        rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 14,
        color: ["#8a5a3c", "#a06b48", "#6e4a30", "#b5743f"][i % 4],
      });
    }
  }

  private drawShadow(cx: number, cy: number, rx: number, ry: number, alpha: number): void {
    const ctx = this.ctx;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = prev;
  }

  private drawDecals(now: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      const k = (now - d.born) / d.life;
      if (k >= 1) {
        this.decals.splice(i, 1);
        continue;
      }
      const cx = (d.x + 0.5) * t;
      const cy = (d.y + 0.5) * t;
      if (d.kind === "scorch") {
        const a = (1 - k) * 0.5;
        const rad = t * 0.46;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `rgba(20,16,14,${a})`);
        g.addColorStop(0.7, `rgba(30,24,20,${a * 0.7})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const a = (1 - k) * 0.22;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(d.rot);
        ctx.fillStyle = `rgba(60,80,40,${a})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, t * 0.3, t * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Subtle wind: a soft light band drifting diagonally across the field. */
  private drawWind(now: number, W: number, H: number): void {
    const ctx = this.ctx;
    const span = W + H;
    const pos = ((now / 5200) % 1) * span * 1.4 - H * 0.2;
    const band = W * 0.5;
    const g = ctx.createLinearGradient(pos - band, 0, pos + band, H);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(230,255,210,0.05)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
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
      if (p.gravity) p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = p.drag ?? 0.92;
      p.vx *= drag;
      p.vy *= drag;
      if (p.grow) p.size += p.grow * dt;
      if (p.spin) p.rot = (p.rot ?? 0) + p.spin * dt;

      const a = Math.max(0, p.life / p.max);
      const px = p.x * t;
      const py = p.y * t;
      if (p.shape === "flash") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(px, py, 0, px, py, p.size);
        g.addColorStop(0, p.color);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else if (p.shape === "glyph") {
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color;
        ctx.font = `bold ${Math.floor(p.size)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.glyph ?? "$", 0, 0);
        ctx.restore();
      } else if (p.shape === "rect") {
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
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
        this.drawShadow(px + t / 2, py + t * 0.95, t * 0.42, t * 0.1, 0.3);
        this.drawTileSprite("hard", px, py) || this.drawHard(px, py);
        break;
      case TileType.SOFT:
        this.drawShadow(px + t / 2, py + t * 0.95, t * 0.4, t * 0.1, 0.26);
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
        if (key || PU_ICON[tile]) this.drawShadow(px + t / 2, py + t * 0.82, t * 0.26, t * 0.09, 0.24);
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
