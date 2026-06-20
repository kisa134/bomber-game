import { GRID_W, GRID_H, TileType, BOMB_TIMER_MS, EXPLOSION_LIFETIME_MS, START_LIVES } from "../net/protocol.js";
import type { RenderView } from "./state.js";
import type { Assets } from "./assets.js";
import { ASSET_VER } from "./assets.js";

export const PLAYER_COLORS = ["#ff5555", "#4aa3ff", "#5fd96a", "#ffcc33"];
export const SKIN_EMOJI = ["🐕", "🐸", "🦊", "😐", "🐶", "🥚"];

/** DOM avatar showing the character sprite (emoji fallback), with an optional
 *  colored ring. Shared by the skin picker, room list and HUD. */
export function skinAvatar(skin: number, color?: string): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "avatar";
  if (color) wrap.style.boxShadow = `inset 0 0 0 2px ${color}`;
  const img = document.createElement("img");
  img.src = `/sprites/skin_${skin}.webp?v=${ASSET_VER}`;
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

// Per-powerup glow tint (rgb) for the pulsing pad + glossy shine.
const PU_GLOW: Partial<Record<TileType, [number, number, number]>> = {
  [TileType.PU_BOMB]: [255, 170, 70],
  [TileType.PU_FIRE]: [255, 110, 60],
  [TileType.PU_SPEED]: [90, 200, 255],
  [TileType.PU_KICK]: [120, 230, 130],
  [TileType.PU_WALL]: [190, 150, 255],
  [TileType.PU_HEALTH]: [255, 110, 150],
};

const DEATH_MS = 650;
// Block-blood face bits (which side of a block the blood hit).
const BF_N = 1, BF_S = 2, BF_E = 4, BF_W = 8;
const MAX_PARTICLES = 520;
const MAX_DECALS = 90;
const LIGHT_LIFE = 460; // ms an explosion light source blooms + fades

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
  kind: "scorch" | "trample" | "blood";
  rot: number;
  scale?: number; // blood splatter radius factor (1 = full cell, <1 = a spatter)
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private tile = 32;
  private dpr = 1;
  private assets: Assets | null = null;

  // Low-effects mode for phones / touch devices: caps DPR, swaps the heavy
  // procedural shadows for cheap ellipses, skips ambient/wind/light-bounce and
  // thins out particles. Keeps the board smooth and the phone cool.
  private lowFx = false;
  private fxScale = 1; // particle-count multiplier (0.5 in lowFx)
  private maxParticles = MAX_PARTICLES;
  // The grass floor is static, so render it once into an offscreen canvas and
  // blit it each frame instead of redrawing ~10k blades per frame.
  private floor: HTMLCanvasElement | null = null;
  private floorSpriteBaked = false; // true once the floor cache used the sprite

  /** Maps a player id to a skin index. Overridden by main. */
  skinOf: (id: number) => number = (id) => id % PLAYER_COLORS.length;

  private fireStart = new Map<number, number>();
  private lastPos = new Map<number, { x: number; y: number }>();
  private facing = new Map<number, "down" | "up" | "left" | "right">();
  private deadAt = new Map<number, number>();
  private emotes = new Map<number, { e: string; until: number }>();
  private placeBombUntil = new Map<number, number>(); // transient place-bomb pose
  private hurtUntil = new Map<number, number>(); // transient hurt pose
  private victorId = -1; // winner shows the victory pose after a match ends
  private matchStartMs = 0; // when PLAYING began — drives the start-of-match glow
  private countdownActive = false; // 3-2-1 phase — highlight the local player's corner
  private particles: Particle[] = [];
  private decals: Decal[] = [];
  private lights: Array<{ x: number; y: number; born: number }> = []; // explosion light sources
  private firstBloodAt = 0;
  private fbCanvas: HTMLCanvasElement | null = null; // cached pixel "FIRST BLOOD" text
  private prevGrid: Uint8Array | null = null;
  private burn = new Map<number, number>(); // cell index -> scorch intensity (accumulates with blasts)
  private hardDmg = new Map<number, number>(); // hard-block cell index -> crack level 0..3
  // Blood splattered on a block: which faces were hit (N/S/E/W bitmask), a stable
  // seed for the pattern, and an intensity count. Top face = splatter, front = drips.
  private bloodBlocks = new Map<number, { dirs: number; seed: number; n: number; born: number; nextDrip: number }>();
  private shatters: Array<{ x: number; y: number; born: number }> = []; // soft-break shatter fx
  private scorch: HTMLCanvasElement | null = null; // cached burnt-ground overlay
  private scorchDirty = false;
  private lastDust = new Map<number, number>();
  private lastTrample = new Map<number, number>();
  private shakeUntil = 0;
  private shakeMag = 0;
  private lastTime = performance.now();

  private lastW = -1;
  private lastH = -1;
  private lastDpr = -1;
  private resizeRaf = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.resize();
    // Mobile webviews (esp. Telegram) fire resize/visualViewport CONSTANTLY (URL
    // bar, scroll, keyboard). Coalesce them into one resize per frame; resize()
    // itself also no-ops when the board size hasn't actually changed.
    const onResize = () => {
      if (this.resizeRaf) return;
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = 0;
        this.resize();
      });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    // Re-measure whenever the play area's box actually changes (layout settling,
    // HUD/ banner reflow, fullscreen). window.resize alone misses these, which
    // left the board occasionally sized too tall and stuck to the top until you
    // nudged the window. ResizeObserver catches every box change.
    if (this.canvas.parentElement && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(onResize).observe(this.canvas.parentElement);
    }
  }

  /** Force a re-measure on the next frames (after a screen is shown and laid out). */
  remeasure(): void {
    requestAnimationFrame(() => this.resize());
    setTimeout(() => this.resize(), 60);
  }

  setAssets(assets: Assets): void {
    this.assets = assets;
    this.buildFloor(); // rebuild now that the floor sprite may be available
  }

  resize(): void {
    // Treat any touch device as "mobile" (lowFx) — relying on pointer:coarse alone
    // can miss in some webviews, leaving the heavy desktop path on (= terrible lag).
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const mobile = coarse || touch;
    // Cap DPR lower on phones: fewer pixels to fill = far less GPU/CPU and heat.
    this.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    this.lowFx = mobile;
    this.fxScale = mobile ? 0.5 : 1;
    this.maxParticles = mobile ? 240 : MAX_PARTICLES;
    const margin = mobile ? 0 : 22;
    const host = this.canvas.parentElement;
    const cs = host ? getComputedStyle(host) : null;
    const padX = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 0;
    const padY = cs ? parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) : 0;
    const availW = (host?.clientWidth || window.innerWidth) - padX - margin * 2;
    const availH = (host?.clientHeight || window.innerHeight) - padY - margin * 2;
    this.tile = Math.floor(Math.min(availW / GRID_W, availH / GRID_H));
    const w = this.tile * GRID_W;
    const h = this.tile * GRID_H;

    // Always refresh the side-margin var (cheap), but skip the EXPENSIVE work
    // (canvas realloc + floor rebake) when the board size is unchanged. Mobile
    // fires resize constantly with the same dimensions — this kills the churn.
    const padL = cs ? parseFloat(cs.paddingLeft) : 0;
    const side = Math.max(0, padL + ((host?.clientWidth || window.innerWidth) - padX - w) / 2);
    document.documentElement.style.setProperty("--board-side", `${Math.round(side)}px`);
    if (w === this.lastW && h === this.lastH && this.dpr === this.lastDpr) return;
    this.lastW = w;
    this.lastH = h;
    this.lastDpr = this.dpr;

    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = !this.lowFx; // crisp+cheaper on mobile
    this.buildFloor();
  }

  /** Pre-render the (static) procedural grass floor into an offscreen canvas so
   *  the main loop just blits one image instead of drawing thousands of blades
   *  every frame. Rebuilt on resize (when the tile size changes). */
  private buildFloor(): void {
    const t = this.tile;
    const W = t * GRID_W;
    const H = t * GRID_H;
    if (W <= 0 || H <= 0) return;
    const c = this.floor ?? (this.floor = document.createElement("canvas"));
    c.width = Math.max(1, Math.round(W * this.dpr));
    c.height = Math.max(1, Math.round(H * this.dpr));
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // On phones use the flat floor sprite (cheap, no procedural blades); on
    // desktop keep the richer procedural grass. Both are baked once, here.
    const floorImg = this.lowFx ? this.assets?.img("floor") : null;
    this.floorSpriteBaked = !!floorImg;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (floorImg) g.drawImage(floorImg, x * t, y * t, t, t);
        else this.drawBaseGround(g, x * t, y * t, x, y); // desktop: blades drawn live
      }
    }
    this.prescale();
  }

  // Per-tile sprites pre-scaled to the exact tile size ONCE (on resize), so the
  // main loop blits them 1:1 every frame instead of re-downscaling a big source
  // image per block per frame — the key mobile/iOS perf win.
  private scaled = new Map<string, HTMLCanvasElement>();
  private static readonly TILE_SPRITES = [
    "hard",
    "hard_dmg1_v1", "hard_dmg1_v2", "hard_dmg2_v1", "hard_dmg2_v2", "hard_dmg3_v1", "hard_dmg3_v2",
    "hard_dmg4_v1", "hard_dmg4_v2", "hard_dmg5_v1", "hard_dmg5_v2", "hard_dmg6_v1", "hard_dmg6_v2",
    "soft", "soft_mobile", "bomb",
    "explosion0", "explosion1", "explosion2", "explosion3", "explosion4", "explosion",
    "pu_bomb", "pu_fire", "pu_speed", "pu_kick", "pu_wall", "pu_health",
  ];
  private prescale(): void {
    if (!this.assets) return;
    const t = this.tile;
    if (t <= 0) return;
    const W = Math.max(1, Math.round(t * this.dpr));
    this.scaled.clear();
    for (const k of Renderer.TILE_SPRITES) {
      const img = this.assets.img(k);
      if (!img) continue;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = W;
      const g = c.getContext("2d");
      if (!g) continue;
      g.imageSmoothingEnabled = true; // smooth ONCE here; per-frame blit is then 1:1
      g.drawImage(img, 0, 0, W, W);
      this.scaled.set(k, c);
    }
  }

  /** Pre-scaled tile sprite for `key` (1:1 blit), or the raw image, or null. */
  private sprite(key: string): CanvasImageSource | null {
    return this.scaled.get(key) ?? this.assets?.img(key) ?? null;
  }

  // -- VFX API ---------------------------------------------------------------

  /** Mark the moment the match went live, so we glow each player in their color
   *  for a short window — long enough to find yourself, then it fades. */
  /** Toggle the countdown "you are here" corner highlight. */
  setCountdown(on: boolean): void {
    this.countdownActive = on;
  }

  onMatchStart(): void {
    this.matchStartMs = performance.now();
    this.placeBombUntil.clear();
    this.hurtUntil.clear();
    this.victorId = -1;
    this.burn.clear();
    this.hardDmg.clear();
    this.bloodBlocks.clear();
    this.shatters.length = 0;
    this.scorch = null;
    this.scorchDirty = false;
    // Per-match caches that must NOT bleed across a rematch in the same room:
    // otherwise the first new grid diffs against the old one (spurious debris),
    // and stale positions/emotes/particles flash on top of the new match.
    this.prevGrid = null;
    this.fireStart.clear();
    this.lastPos.clear();
    this.facing.clear();
    this.deadAt.clear();
    this.emotes.clear();
    this.particles.length = 0;
    this.decals.length = 0;
    this.lights.length = 0;
  }

  /** Transient action poses (fall back to the walk frame if the skin has no
   *  state sprite). place-bomb + hurt auto-expire; victory holds until reset. */
  setPlaceBomb(playerId: number): void {
    this.placeBombUntil.set(playerId, performance.now() + 120); // quick flash, not a held pose
  }
  setHurt(playerId: number): void {
    this.hurtUntil.set(playerId, performance.now() + 450);
  }
  setVictory(playerId: number): void {
    this.victorId = playerId;
  }

  /** Show a reaction bubble above a player for a short time. */
  showEmote(playerId: number, e: string): void {
    this.emotes.set(playerId, { e, until: performance.now() + 1800 });
  }

  shake(mag: number, ms = 220): void {
    if (this.lowFx) return;
    this.shakeUntil = Math.max(this.shakeUntil, performance.now() + ms);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  private push(p: Particle): void {
    this.particles.push(p);
    if (this.particles.length > this.maxParticles)
      this.particles.splice(0, this.particles.length - this.maxParticles);
  }

  burst(cx: number, cy: number, color: string, count: number, speed = 3): void {
    if (this.lowFx) return;
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
    const now = performance.now();
    // Accumulate scorched ground (per cell) + crack damage on adjacent hard
    // blocks. Cheap and useful on phones too, so do it before the lowFx bail-out.
    const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const c of cells) {
      const idx = c.y * GRID_W + c.x;
      this.burn.set(idx, Math.min(6, (this.burn.get(idx) ?? 0) + 1));
      this.scorchDirty = true;
      if (this.prevGrid) {
        for (const [dx, dy] of NB) {
          const nx = c.x + dx, ny = c.y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
          const ni = ny * GRID_W + nx;
          if (this.prevGrid[ni] === TileType.HARD) {
            this.hardDmg.set(ni, Math.min(6, (this.hardDmg.get(ni) ?? 0) + 1));
          }
        }
      }
    }
    if (this.lowFx) return; // phones: explosion tiles still render; skip the heavy VFX
    for (const c of cells) {
      const cx = c.x + 0.5;
      const cy = c.y + 0.5;
      // Flames.
      for (let i = 0; i < Math.round(7 * this.fxScale); i++) {
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
      for (let i = 0; i < Math.round(3 * this.fxScale); i++) {
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
      // Volumetric light source for this blast cell.
      this.lights.push({ x: cx, y: cy, born: now });
      if (this.lights.length > 80) this.lights.shift();
    }
    this.shake(Math.min(8, 3 + cells.length * 0.5), 120);
  }

  onDeath(cx: number, cy: number, color: string): void {
    // Persistent blood marks first (cheap, runs on phones too): a ground splat on
    // the death cell + floor neighbours, and face-aware blood on adjacent blocks
    // (top-face splatter + front-face drips, biased toward where the kill happened).
    this.addBlood(cx, cy, 1);
    const grid = this.prevGrid;
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [dx, dy] of around) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const ni = ny * GRID_W + nx;
      const isBlock = grid && (grid[ni] === TileType.HARD || grid[ni] === TileType.SOFT);
      if (isBlock) {
        this.markBlockBlood(ni, -dx, -dy); // the face of the block pointing at the death
      } else if (Math.random() < 0.55) {
        this.addBlood(nx, ny, 0.4 + Math.random() * 0.35);
      }
    }
    if (this.lowFx) return; // phones: keep the blood, skip the heavy gib particles
    // Gory blow-up: red gibs fly out and arc down into a mush, plus a fine
    // blood spray, a hint of the player's color, and a few bone-white bits.
    const reds = ["#8a0000", "#a30000", "#c81e1e", "#6a0000"];
    for (let i = 0; i < Math.round(34 * this.fxScale); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 5.5;
      this.push({
        x: cx + 0.5, y: cy + 0.5,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.6,
        life: 0.55 + Math.random() * 0.65, max: 1.2,
        size: this.tile * (0.06 + Math.random() * 0.13),
        color: reds[(Math.random() * reds.length) | 0],
        gravity: 17, drag: 0.96, shape: "rect",
        rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 16,
      });
    }
    this.burst(cx, cy, "#d61e1e", 18, 4.5); // fine blood spray
    this.burst(cx, cy, "#7a0000", 10, 3.5); // darker gore spray
    this.burst(cx, cy, color, 7, 3); // a hint of the player's color
    this.burst(cx, cy, "#efe6cf", 5, 3); // bone / teeth bits
    this.shake(10, 320);
  }

  /** Record blood on a block's face(s). (ddx,ddy) points from the block toward
   *  the kill, so we know which face got hit. Accumulates across kills. */
  private markBlockBlood(index: number, ddx: number, ddy: number): void {
    const prev = this.bloodBlocks.get(index);
    let dirs = prev?.dirs ?? 0;
    if (ddy < 0) dirs |= BF_N;
    if (ddy > 0) dirs |= BF_S;
    if (ddx > 0) dirs |= BF_E;
    if (ddx < 0) dirs |= BF_W;
    const now = performance.now();
    this.bloodBlocks.set(index, {
      dirs,
      seed: prev?.seed ?? ((index * 2654435761) >>> 0),
      n: (prev?.n ?? 0) + 1,
      born: prev?.born ?? now,
      nextDrip: now + 700 + Math.random() * 1800,
    });
  }

  /** Draw blood on a block: a squashed splatter on the TOP face + drips running
   *  down the FRONT face, biased toward the side the kill came from. */
  private drawBlockBlood(px: number, py: number, index: number, now: number): void {
    const m = this.bloodBlocks.get(index);
    if (!m) return;
    const ctx = this.ctx, t = this.tile;
    const pu = Math.max(2, Math.round(t / 12));
    let h = m.seed;
    const rnd = (): number => {
      h = (h ^ (h << 13)) >>> 0; h = (h ^ (h >>> 17)) >>> 0; h = (h ^ (h << 5)) >>> 0;
      return (h & 0xffff) / 0xffff;
    };
    const reds = ["#3a0000", "#5a0000", "#7a0000", "#9c0000", "#c81e1e"];
    const n = Math.min(4, m.n);
    const bias = ((m.dirs & BF_E ? 0.62 : 0) + (m.dirs & BF_W ? -0.62 : 0)); // horizontal lean
    const cxp = px + t * 0.5 + bias * t * 0.3;

    // A dark central pool on the top face for a grislier base.
    ctx.fillStyle = "#2a0000";
    const poolR = t * (0.16 + n * 0.04);
    for (let i = 0; i < 6 + n * 2; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = Math.pow(rnd(), 0.5) * poolR;
      const sz = pu * (1 + Math.floor(rnd() * 2));
      ctx.fillRect(Math.round((cxp + Math.cos(ang) * dist - sz / 2) / pu) * pu, Math.round((py + t * 0.22 + Math.sin(ang) * dist * 0.5 - sz / 2) / pu) * pu, sz, sz);
    }
    // TOP-face splatter (stronger when the kill was above the block), squashed in Y.
    const topStrong = m.dirs & BF_N ? 1 : 0.62;
    const topBlobs = Math.round((14 + n * 7) * topStrong);
    const topR = t * (0.3 + n * 0.06);
    for (let i = 0; i < topBlobs; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = Math.pow(rnd(), 0.6) * topR;
      const bx = cxp + Math.cos(ang) * dist;
      const by = py + t * 0.2 + Math.sin(ang) * dist * 0.55;
      const sz = pu * (1 + Math.floor(rnd() * 2.4));
      ctx.fillStyle = reds[(rnd() * reds.length) | 0];
      ctx.fillRect(Math.round((bx - sz / 2) / pu) * pu, Math.round((by - sz / 2) / pu) * pu, sz, sz);
    }
    // FRONT-face drips that slowly ooze down over time (staggered per drip).
    const frontStrong = m.dirs & BF_S ? 1 : 0.6;
    const drips = Math.max(2, Math.round((2 + n * 1.4) * (0.7 + frontStrong)));
    for (let d = 0; d < drips; d++) {
      const dx = cxp + (rnd() - 0.5) * t * 0.8;
      const top = py + t * 0.4;
      const maxLen = t * (0.2 + rnd() * 0.52 * frontStrong);
      const delay = rnd() * 700;
      const grow = 1400 + rnd() * 1500;
      const prog = Math.max(0, Math.min(1, (now - m.born - delay) / grow));
      const len = maxLen * (1 - (1 - prog) * (1 - prog)); // ease-out
      const w = pu * (1 + Math.floor(rnd() * 1.6));
      ctx.fillStyle = reds[1 + ((rnd() * 3) | 0)];
      for (let y = 0; y < len; y += pu) ctx.fillRect(Math.round((dx - w / 2) / pu) * pu, Math.round((top + y) / pu) * pu, w, pu);
      if (len > pu) {
        ctx.fillStyle = reds[0]; // darker rounded drip tip
        ctx.fillRect(Math.round((dx - (w + pu) / 2) / pu) * pu, Math.round((top + len) / pu) * pu, w + pu, pu * 2);
      }
    }
    // Occasionally a droplet pinches off a drip and falls (the slow "drip").
    if (!this.lowFx && now > m.nextDrip) {
      m.nextDrip = now + 1600 + Math.random() * 3400;
      const dx = cxp + (Math.random() - 0.5) * t * 0.6;
      this.push({
        x: dx / t, y: (py + t * 0.74) / t, vx: 0, vy: 0.35,
        life: 0.7 + Math.random() * 0.4, max: 1.1, gravity: 9, drag: 0.99,
        size: pu * 1.5, shape: "rect", color: reds[1],
      });
    }
  }

  /** FIRST BLOOD announcement (first kill of the match). Builds the chunky pixel
   *  text once (rendered low-res, blitted up with smoothing off). */
  firstBlood(): void {
    this.firstBloodAt = performance.now();
    const lowH = 30;
    const text = "FIRST BLOOD";
    const font = `900 ${lowH}px "Arial Black", "Arial", sans-serif`;
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = font;
    const pad = 6;
    const c = document.createElement("canvas");
    c.width = Math.ceil(measure.measureText(text).width) + pad * 2;
    c.height = lowH + pad * 2;
    const g = c.getContext("2d")!;
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const mx = c.width / 2;
    const my = c.height / 2;
    // Thick black pixel outline so the red reads on ANY background.
    g.fillStyle = "#140000";
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx || dy) g.fillText(text, mx + dx, my + dy);
      }
    }
    // Blood-red fill with a darker lower half for depth.
    g.fillStyle = "#7a0000";
    g.fillText(text, mx, my + 1);
    g.fillStyle = "#e60000";
    g.fillText(text, mx, my);
    this.fbCanvas = c;
  }

  private addDecal(x: number, y: number, kind: Decal["kind"]): void {
    this.decals.push({ x, y, born: this.lastTime, life: kind === "scorch" ? 6000 : 2600, kind, rot: Math.random() * Math.PI });
    if (this.decals.length > MAX_DECALS) this.decals.shift();
  }

  /** A long-lived blood splatter on a cell (scale<1 = smaller spatter). */
  private addBlood(x: number, y: number, scale: number): void {
    this.decals.push({ x, y, born: this.lastTime, life: 7000, kind: "blood", rot: Math.random() * Math.PI, scale });
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

    // Blit the cached floor under everything. On phones, rebuild the cache once
    // the floor sprite has finished loading (preload is async).
    if (this.lowFx && !this.floorSpriteBaked && this.assets?.img("floor")) this.buildFloor();
    if (this.floor) ctx.drawImage(this.floor, 0, 0, W, H);
    // Scorched ground: burnt patches that build up where blasts happened.
    if (this.scorchDirty || (this.burn.size && !this.scorch)) this.buildScorch(W, H);
    if (this.scorch) ctx.drawImage(this.scorch, 0, 0, W, H);

    if (view.grid) {
      // Detect soft-block breaks (SOFT -> not SOFT) to spray debris.
      if (this.prevGrid && this.prevGrid.length === view.grid.length) {
        for (let i = 0; i < view.grid.length; i++) {
          if (this.prevGrid[i] === TileType.SOFT && view.grid[i] !== TileType.SOFT) {
            this.emitDebris(i % GRID_W, (i / GRID_W) | 0);
            this.shatters.push({ x: i % GRID_W, y: (i / GRID_W) | 0, born: now });
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

    // Desktop: live swaying grass over the open ground, after blocks so the
    // front tips overlap them for a layered 3D look. (Phones use the flat sprite.)
    if (!this.lowFx) this.drawGrassOverlay(view, now);

    this.drawShatters(now); // crate pieces flying apart from just-broken soft blocks
    this.drawDecals(now);
    if (!this.lowFx) this.drawWind(now, W, H);
    this.drawPowerups(view, now); // after blocks so their shadows never cover relics

    for (const b of view.bombs) {
      const pulse = 1 - (b.fuseLeftMs / BOMB_TIMER_MS) * 0.25;
      const cx = (b.x + 0.5) * t;
      const cy = (b.y + 0.5) * t;
      const color = PLAYER_COLORS[b.ownerId % PLAYER_COLORS.length];
      this.drawShadow(cx, cy + t * 0.3, t * 0.34, t * 0.14, 0.28);
      // Owner-colored glow under the bomb (kept even on phones so you can tell
      // whose bombs are whose), pulsing faster as the fuse burns down.
      const urgency = 1 - b.fuseLeftMs / BOMB_TIMER_MS; // 0 -> 1
      const beat = Math.sin(now / (90 - urgency * 55));
      {
        const glow = t * (0.5 + urgency * 0.25) * (0.8 + 0.2 * beat);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glow);
        grad.addColorStop(0, color + (urgency > 0.7 ? "ee" : "cc"));
        grad.addColorStop(1, color + "00");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, glow, 0, Math.PI * 2);
        ctx.fill();
      }
      const img = this.sprite("bomb");
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
      if (!this.lowFx && Math.random() < 0.5) {
        this.push({
          x: b.x + 0.5 + (Math.random() - 0.5) * 0.18, y: b.y + 0.18, vx: (Math.random() - 0.5) * 0.8, vy: -1 - Math.random(),
          life: 0.22 + Math.random() * 0.2, max: 0.42, drag: 0.9, size: t * 0.04,
          color: Math.random() < 0.5 ? "#fff2a8" : "#ffae3a",
        });
      }
    }

    this.drawPlayers(view, myId, now);
    this.drawLights(now);
    this.updateParticles(dt);
    ctx.restore();

    if (!this.lowFx) this.drawAmbient(W, H); // warm key light + vignette for depth
    this.drawFirstBlood(now); // screen-space announcement, above the world
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

      // Countdown: brightly mark YOUR corner in your color ("you are here").
      if (this.countdownActive && p.id === myId && p.alive) {
        const col = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
        const pulse = 0.5 + 0.5 * Math.sin(now / 170);
        const tx = Math.floor(rp.x) * t;
        const ty = Math.floor(rp.y) * t;
        ctx.save();
        // Bright color wash filling the cell.
        ctx.globalCompositeOperation = "lighter";
        const rad = t * (0.75 + 0.15 * pulse);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, col + "dd");
        g.addColorStop(0.55, col + "55");
        g.addColorStop(1, col + "00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Pulsing outline around the tile.
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * pulse;
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(2, t * 0.07);
        ctx.strokeRect(tx + 2, ty + 2, t - 4, t - 4);
        ctx.restore();
        // "YOU" tag bobbing above.
        ctx.globalAlpha = 1;
        ctx.fillStyle = col;
        ctx.font = `900 ${Math.floor(t * 0.34)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("YOU", cx, ty - t * 0.12 - pulse * t * 0.08);
        ctx.globalAlpha = alpha;
      }

      // Start-of-match highlight: a soft, owner-colored glow under each player
      // for 30s so you can find yourself (replaces the old static ring). Fades
      // out over the last 4s. The local player glows a bit brighter.
      // Start-of-match highlight: owner-colored glow under each player so you can
      // find yourself / tell players apart (kept on phones too — it's gameplay).
      // Owner-colored glow under each player (same palette as their bombs), ALWAYS
      // on so you can find yourself / tell players apart, with an extra boost in
      // the first 30s. Brighter than before for clear readability.
      const HL_MS = 30_000;
      const sinceStart = this.matchStartMs ? now - this.matchStartMs : Infinity;
      if (p.alive) {
        const isMe = p.id === myId;
        const col = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
        const beat = 0.88 + 0.12 * Math.sin(now / 240);
        const boost = sinceStart < HL_MS ? (sinceStart > HL_MS - 4000 ? (HL_MS - sinceStart) / 4000 : 1) : 0;
        const glow = t * (isMe ? 0.82 : 0.66) * beat;
        const gy = cy + t * 0.2;
        const a = Math.min(1, (isMe ? 0.62 : 0.48) + boost * (isMe ? 0.22 : 0.16));
        const ah = Math.round(a * 255).toString(16).padStart(2, "0");
        const mh = Math.round(a * 0.5 * 255).toString(16).padStart(2, "0");
        const grad = ctx.createRadialGradient(cx, gy, 0, cx, gy, glow);
        grad.addColorStop(0, col + ah);
        grad.addColorStop(0.55, col + mh);
        grad.addColorStop(1, col + "00");
        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, gy, glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
      }

      // Kick up dust / trample grass while moving.
      if (!this.lowFx && moving && p.alive) {
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
      const frame = moving && p.alive ? WALK_SEQ[Math.floor(now / 95) % WALK_SEQ.length] : 0;
      const dirName = face === "up" ? "up" : face === "down" ? "down" : "side";
      let flip = face === "left";
      // Action-state pose overrides the walk frame when the skin has that sprite
      // (front-facing, so no mirror). Priority: victory > place-bomb > hurt.
      let stateImg: HTMLImageElement | null = null;
      if (p.alive) {
        const stateKey =
          this.victorId === p.id ? "victory"
          : (this.placeBombUntil.get(p.id) ?? 0) > now ? "place_bomb"
          : (this.hurtUntil.get(p.id) ?? 0) > now ? "hurt"
          : null;
        if (stateKey) stateImg = this.assets?.img(`skin${sk}_${stateKey}`) ?? null;
      }
      if (stateImg) flip = false;
      // State pose -> directional walk frame -> static skin -> emoji.
      const img = stateImg ?? this.assets?.img(`skin${sk}_${dirName}_${frame}`) ?? this.assets?.img(`skin${sk}`);

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

      // (The old white ring under the local player is replaced by the
      //  start-of-match colored glow above.)

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
    if (this.lowFx) return;
    const t = this.tile;
    for (let i = 0; i < Math.round(10 * this.fxScale); i++) {
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

  /** Rebuild the burnt-ground overlay: dark pixel scorch per cell, denser and
   *  darker the more blasts that cell has seen. Cached (rebuilt only when the
   *  burn map changes), so each frame is just one blit. */
  private buildScorch(W: number, H: number): void {
    this.scorchDirty = false;
    if (!this.burn.size) { this.scorch = null; return; }
    const t = this.tile;
    const cv = this.scorch && this.scorch.width === W && this.scorch.height === H ? this.scorch : document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, W, H);
    // Denser, finer pixels + higher coverage + calmer brightness so the burn
    // reads as a smooth scorched patch instead of grainy salt-and-pepper noise.
    const pu = Math.max(1, Math.round(t / 16));
    for (const [idx, lvl] of this.burn) {
      const ox = (idx % GRID_W) * t, oy = ((idx / GRID_W) | 0) * t;
      const cover = Math.min(0.97, 0.62 + lvl * 0.09); // more blasts -> fuller burn
      const a = Math.min(0.6, 0.18 + lvl * 0.085); // and a touch darker
      let h = (idx * 2654435761) >>> 0;
      for (let gy = 0; gy < t; gy += pu) {
        for (let gx = 0; gx < t; gx += pu) {
          h = (h ^ (h << 13)) >>> 0; h = (h ^ (h >>> 17)) >>> 0; h = (h ^ (h << 5)) >>> 0;
          if ((h & 1023) / 1023 > cover) continue;
          const d = 11 + (h & 7); // 11..18 — low contrast, no flicker
          g.globalAlpha = a;
          g.fillStyle = `rgb(${d},${Math.max(0, d - 2)},${Math.max(0, d - 4)})`;
          g.fillRect(ox + gx, oy + gy, pu, pu);
        }
      }
    }
    g.globalAlpha = 1;
    this.scorch = cv;
  }

  /** Procedural crack overlay for a damaged hard block (level 1..3): jagged dark
   *  pixel cracks plus a few knocked-off chips at higher damage. */
  private drawCracks(px: number, py: number, index: number): void {
    const lvl = this.hardDmg.get(index);
    if (!lvl) return;
    const ctx = this.ctx, t = this.tile;
    const pu = Math.max(2, Math.round(t / 12));
    let h = (index * 2654435761) >>> 0;
    const rnd = (): number => {
      h = (h ^ (h << 13)) >>> 0; h = (h ^ (h >>> 17)) >>> 0; h = (h ^ (h << 5)) >>> 0;
      return (h & 0xffff) / 0xffff;
    };
    ctx.fillStyle = "rgba(14,11,9,0.85)";
    for (let c = 0; c < lvl + 1; c++) {
      let x = px + rnd() * t, y = py + rnd() * t;
      const steps = 3 + Math.floor(rnd() * 3);
      for (let s = 0; s < steps; s++) {
        ctx.fillRect(Math.round(x / pu) * pu, Math.round(y / pu) * pu, pu, pu);
        x = Math.max(px, Math.min(px + t - pu, x + (rnd() - 0.5) * t * 0.45));
        y = Math.max(py, Math.min(py + t - pu, y + (rnd() - 0.5) * t * 0.45));
      }
    }
    if (lvl >= 2) {
      ctx.fillStyle = "rgba(190,180,168,0.45)"; // chipped highlights
      for (let k = 0; k < lvl; k++) ctx.fillRect(px + rnd() * (t - pu), py + rnd() * (t - pu), pu, pu);
    }
  }

  /** Fast crate-shatter: the soft sprite splits into four quarters that fly to
   *  the corners and fade over ~200ms when a soft block is destroyed. */
  private drawShatters(now: number): void {
    if (!this.shatters.length) return;
    const ctx = this.ctx, t = this.tile;
    const img = this.assets?.img(this.lowFx ? "soft_mobile" : "soft") ?? this.assets?.img("soft");
    const quads = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (let i = this.shatters.length - 1; i >= 0; i--) {
      const sh = this.shatters[i];
      const k = (now - sh.born) / 200;
      if (k >= 1) { this.shatters.splice(i, 1); continue; }
      if (!img) continue;
      const iw = img.width, ih = img.height;
      const off = k * t * 0.55;
      const px = sh.x * t, py = sh.y * t;
      ctx.globalAlpha = 1 - k;
      for (let q = 0; q < 4; q++) {
        const sx = q % 2 === 0 ? 0 : iw / 2;
        const sy = q < 2 ? 0 : ih / 2;
        const dx = px + (q % 2 === 0 ? 0 : t / 2) + quads[q][0] * off;
        const dy = py + (q < 2 ? 0 : t / 2) + quads[q][1] * off;
        ctx.drawImage(img, sx, sy, iw / 2, ih / 2, dx, dy, t / 2, t / 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Pixelated blob shadow — a blocky ellipse made of squares on a pixel grid,
   *  gently swaying/breathing over time. */
  private drawShadow(cx: number, cy: number, rx: number, ry: number, alpha: number): void {
    if (this.lowFx) return; // phones: no shadows at all (max speed)
    const ctx = this.ctx;
    const t = this.tile;
    const pu = Math.max(2, Math.round(t / 12));
    const sw = Math.sin(this.lastTime / 900 + cx * 0.05 + cy * 0.03);
    const ox = cx + sw * pu * 0.7; // drift sideways a touch
    const rxe = rx * (1 + sw * 0.07); // breathe width
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    ctx.fillStyle = "#000";
    for (let gy = -ry; gy <= ry; gy += pu) {
      for (let gx = -rxe; gx <= rxe; gx += pu) {
        if ((gx * gx) / (rxe * rxe) + (gy * gy) / (ry * ry) <= 1) {
          ctx.fillRect(Math.round((ox + gx) / pu) * pu, Math.round((cy + gy) / pu) * pu, pu, pu);
        }
      }
    }
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
        // Pixel crater: dark squares on a grid, thinning toward the edge.
        const a = (1 - k) * 0.55;
        const pu = Math.max(3, Math.round(t / 7));
        const R = t * 0.44;
        const seed = (d.x * 374761393 + d.y * 668265263) >>> 0;
        for (let gy = -R; gy <= R; gy += pu) {
          for (let gx = -R; gx <= R; gx += pu) {
            const edge = Math.hypot(gx, gy) / R;
            if (edge > 1) continue;
            let h = (seed ^ (((gx / pu) & 255) * 73856093) ^ (((gy / pu) & 255) * 19349663)) >>> 0;
            h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
            const n = (h & 1023) / 1023;
            if (n < edge * 0.85) continue; // crater frays at the rim
            const sh = 16 + Math.floor(n * 16);
            ctx.globalAlpha = a * (1 - edge * 0.35);
            ctx.fillStyle = `rgb(${sh},${sh - 3},${Math.max(0, sh - 6)})`;
            ctx.fillRect(Math.round((cx + gx) / pu) * pu, Math.round((cy + gy) / pu) * pu, pu, pu);
          }
        }
        ctx.globalAlpha = 1;
      } else if (d.kind === "blood") {
        // Pixel blood splatter: irregular red squares, denser toward the
        // center, holding most of the cell then fading over the decal's life.
        const a = Math.min(1, (1 - k) * 1.4) * 0.72;
        const pu = Math.max(2, Math.round(t / 9));
        const scale = d.scale ?? 1;
        const R = t * 0.5 * scale;
        let seed = (d.x * 374761393 + d.y * 668265263 + (d.born | 0)) >>> 0;
        const rnd = (): number => {
          seed = (seed ^ (seed << 13)) >>> 0;
          seed = (seed ^ (seed >>> 17)) >>> 0;
          seed = (seed ^ (seed << 5)) >>> 0;
          return (seed & 0xffff) / 0xffff;
        };
        ctx.globalAlpha = a;
        const blobs = 10 + Math.floor(scale * 16);
        for (let b = 0; b < blobs; b++) {
          const ang = rnd() * Math.PI * 2 + d.rot;
          const dist = Math.pow(rnd(), 0.6) * R; // bias toward the center
          const bx = cx + Math.cos(ang) * dist;
          const by = cy + Math.sin(ang) * dist;
          const sz = pu * (1 + Math.floor(rnd() * 2.4));
          const r = 96 + Math.floor(rnd() * 96);
          ctx.fillStyle = `rgb(${r},${Math.floor(r * 0.12)},${Math.floor(r * 0.1)})`;
          ctx.fillRect(Math.round((bx - sz / 2) / pu) * pu, Math.round((by - sz / 2) / pu) * pu, sz, sz);
        }
        ctx.globalAlpha = 1;
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

  /** Volumetric explosion light: per blast cell, stack 3 additive radial layers
   *  (hot core -> amber -> red) that fade and bloom over ~320ms. Additive blend
   *  makes overlapping cells build up brightness, giving a sense of volume. */
  private drawLights(now: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const L = this.lights[i];
      const k = (now - L.born) / LIGHT_LIFE;
      if (k >= 1) {
        this.lights.splice(i, 1);
        continue;
      }
      const fade = 1 - k;
      const grow = 0.7 + k * 0.7; // expands outward as it fades
      const cx = L.x * t;
      const cy = L.y * t;
      const layers: Array<[number, string]> = [
        [t * 1.9 * grow, `rgba(255,110,35,${0.34 * fade})`], // outer red-orange
        [t * 1.15 * grow, `rgba(255,180,70,${0.5 * fade})`], // mid amber
        [t * 0.6 * grow, `rgba(255,248,220,${0.78 * fade})`], // hot core
      ];
      for (const [rad, col] of layers) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Additive rim-light a block catches from nearby explosion lights — the
   *  highlight sits on the block face toward the blast, so flat tiles read as 3D. */
  private lightCatch(px: number, py: number, now: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    const bx = px + t / 2;
    const by = py + t / 2;
    const reach = t * 3.2;
    let ix = 0;
    let iy = 0;
    let inten = 0;
    for (const L of this.lights) {
      const k = (now - L.born) / LIGHT_LIFE;
      if (k >= 1) continue;
      const dx = bx - L.x * t;
      const dy = by - L.y * t;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) continue;
      const w = (1 - dist / reach) * (1 - k);
      inten += w * 1.6;
      if (dist > 1) {
        ix += (-dx / dist) * w; // point the highlight toward the light
        iy += (-dy / dist) * w;
      }
    }
    if (inten <= 0.02) return;
    inten = Math.min(1, inten);
    const ox = bx + ix * t * 0.45;
    const oy = by + iy * t * 0.45;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, t * 1.05);
    g.addColorStop(0, `rgba(255,210,150,${0.95 * inten})`);
    g.addColorStop(0.5, `rgba(255,160,70,${0.4 * inten})`);
    g.addColorStop(1, "rgba(255,140,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(px, py, t, t); // clip the bounce to the block's own cell
    ctx.restore();
  }

  /** Center-screen FIRST BLOOD: chunky pixel text + falling pixel blood drips. */
  private drawFirstBlood(now: number): void {
    if (!this.fbCanvas || this.firstBloodAt === 0) return;
    const dur = 3000;
    const k = (now - this.firstBloodAt) / dur;
    if (k >= 1) {
      this.firstBloodAt = 0;
      return;
    }
    const ctx = this.ctx;
    const W = this.tile * GRID_W;
    const H = this.tile * GRID_H;
    const cx = W / 2;
    const cy = H * 0.38;
    const pop = Math.min(1, (now - this.firstBloodAt) / 160);
    const fade = k > 0.82 ? (1 - k) / 0.18 : 1;
    const dw = W * 0.78 * (0.85 + 0.15 * pop);
    const dh = (dw * this.fbCanvas.height) / this.fbCanvas.width;
    ctx.save();
    ctx.globalAlpha = fade;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false; // crisp pixel scaling
    ctx.drawImage(this.fbCanvas, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.imageSmoothingEnabled = smooth;
    // Falling pixel blood drips from under the text.
    const pu = Math.max(4, Math.round(this.tile / 6));
    for (let i = 0; i < 22; i++) {
      const fx = cx + (((i * 53) % 100) / 100 - 0.5) * dw * 0.95;
      const delay = (i % 9) * 0.04;
      const dk = Math.max(0, k - delay);
      const dy = cy + dh * 0.42 + dk * dk * H * 0.6;
      const h = pu * (2 + (i % 4));
      ctx.fillStyle = i % 3 === 0 ? "#9e0000" : "#d40d0d";
      ctx.fillRect(Math.round(fx / pu) * pu, Math.round(dy / pu) * pu, pu, h);
    }
    ctx.restore();
  }

  /** Warm ambient lighting (screen-space): a soft warm key light from above plus
   *  a gentle vignette — gives the flat top-down board a sense of depth / 3D. */
  private drawAmbient(W: number, H: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const warm = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, Math.hypot(W, H) * 0.62);
    warm.addColorStop(0, "rgba(255,196,120,0.11)");
    warm.addColorStop(0.6, "rgba(255,170,90,0.045)");
    warm.addColorStop(1, "rgba(255,150,70,0)");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.38, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(18,10,4,0.30)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
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
        // Chunky pixel square (snapped to a pixel grid) instead of a circle.
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        const pu = Math.max(2, Math.round(t / 16)); // pixel unit
        const s = Math.max(pu, Math.round((p.size * 1.6) / pu) * pu);
        const qx = Math.round((px - s / 2) / pu) * pu;
        const qy = Math.round((py - s / 2) / pu) * pu;
        ctx.fillRect(qx, qy, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  // -- tiles -----------------------------------------------------------------

  private drawTile(x: number, y: number, tile: TileType, index: number, now: number): void {
    const t = this.tile;
    const px = x * t;
    const py = y * t;

    // (Floor grass is blitted from the offscreen cache in render(), not here.)

    switch (tile) {
      case TileType.HARD: {
        this.drawShadow(px + t / 2, py + t * 0.95, t * 0.42, t * 0.1, 0.3);
        const dmg = this.hardDmg.get(index) ?? 0;
        // Swap to the damage-stage sprite (1..6), picking one of two variants per
        // cell so neighbouring blocks crack differently. Fall back to the pristine
        // block + procedural cracks if a frame isn't loaded.
        const variant = (((index * 2654435761) >>> 0) % 2) + 1;
        if (!(dmg > 0 && this.drawTileSprite(`hard_dmg${dmg}_v${variant}`, px, py))) {
          this.drawTileSprite("hard", px, py) || this.drawHard(px, py);
          if (dmg > 0) this.drawCracks(px, py, index);
        }
        if (this.bloodBlocks.size) this.drawBlockBlood(px, py, index, now);
        if (!this.lowFx && this.lights.length) this.lightCatch(px, py, now);
        break;
      }
      case TileType.SOFT:
        this.drawShadow(px + t / 2, py + t * 0.95, t * 0.4, t * 0.1, 0.26);
        // Phones get the meme crate; desktop the detailed one. Fall back across
        // soft_mobile -> soft -> procedural.
        ((this.lowFx && this.drawTileSprite("soft_mobile", px, py)) ||
          this.drawTileSprite("soft", px, py) ||
          this.drawSoft(px, py));
        if (this.bloodBlocks.size) this.drawBlockBlood(px, py, index, now);
        if (!this.lowFx && this.lights.length) this.lightCatch(px, py, now);
        break;
      case TileType.EXPLOSION: {
        const start = this.fireStart.get(index) ?? now;
        // Past its lifetime, don't draw it — otherwise a stuck EXPLOSION tile
        // (e.g. the grid freezes when the match ends) leaves the last blast frame
        // frozen on the board. Just show the floor underneath.
        if (now - start >= EXPLOSION_LIFETIME_MS) break;
        const frame = Math.min(4, Math.floor((now - start) / (EXPLOSION_LIFETIME_MS / 5)));
        const drawn =
          this.drawTileSprite(`explosion${frame}`, px, py) || this.drawTileSprite("explosion", px, py);
        if (!drawn) this.drawFire(px, py);
        break;
      }
      default:
        break; // powerups are drawn in a later pass (drawPowerups) so block
      // shadows never fall over them
    }
  }

  /** Powerup pass — runs AFTER the grid so block shadows never darken a relic.
   *  Bright pulsing colored glow + glossy shine + gentle bob. */
  private drawPowerups(view: RenderView, now: number): void {
    if (!view.grid) return;
    const ctx = this.ctx;
    const t = this.tile;
    for (let i = 0; i < view.grid.length; i++) {
      const tile = view.grid[i] as TileType;
      const key = PU_SPRITE[tile];
      const icon = PU_ICON[tile];
      if (!key && !icon) continue;
      const x = i % GRID_W;
      const y = (i / GRID_W) | 0;
      const px = x * t;
      const py = y * t;
      const cx = px + t / 2;
      const cy = py + t / 2;
      const [gr, gg, gb] = PU_GLOW[tile] ?? [255, 200, 110];
      const phase = now / 320 + (x * 0.9 + y * 1.3);
      const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(phase));
      const bob = this.lowFx ? 0 : Math.sin(phase * 0.8) * t * 0.06;

      // Phones: just draw the flat relic sprite — no glow, specular or bob.
      if (this.lowFx) {
        const img = key ? this.sprite(key) : null;
        if (img) {
          ctx.drawImage(img, px, py, t, t);
        } else if (icon) {
          ctx.font = `${Math.floor(t * 0.6)}px system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#fff";
          ctx.fillText(icon, cx, cy + 1);
        }
        continue;
      }

      // Bright pulsing colored glow (two additive rings for a brighter halo).
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const rad = t * (0.62 + 0.12 * pulse);
      const g = ctx.createRadialGradient(cx, cy + bob, 0, cx, cy + bob, rad);
      g.addColorStop(0, `rgba(${gr},${gg},${gb},${0.7 * pulse})`);
      g.addColorStop(0.5, `rgba(${gr},${gg},${gb},${0.28 * pulse})`);
      g.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // The relic itself, bobbing.
      const img = key ? this.sprite(key) : null;
      if (img) {
        ctx.drawImage(img, px, py + bob, t, t);
      } else if (icon) {
        ctx.font = `${Math.floor(t * 0.6)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(icon, cx, cy + bob + 1);
      }

      // Glossy specular highlight + a small sweeping sparkle.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const hx = cx - t * 0.15;
      const hy = cy - t * 0.2 + bob;
      const hr = t * 0.2;
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      hg.addColorStop(0, `rgba(255,255,255,${0.75 * pulse})`);
      hg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawTileSprite(key: string, px: number, py: number): boolean {
    const img = this.sprite(key); // pre-scaled to tile size -> 1:1 blit
    if (!img) return false;
    this.ctx.drawImage(img, px, py, this.tile, this.tile);
    return true;
  }

  /** Baked base ground (two-tone checker) — static, blitted from the floor cache.
   *  On desktop the swaying blades are drawn live on top (drawGrassBlades); on
   *  phones the floor sprite replaces this entirely. */
  private drawBaseGround(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number): void {
    const t = this.tile;
    ctx.fillStyle = (x + y) % 2 === 0 ? "#345628" : "#2e4a24";
    ctx.fillRect(px, py, t, t);
  }

  /** Live, wind-swayed pixel grass for ONE open-ground tile (desktop only). Tips
   *  sway with a per-tile-phased sine; a few tall blades reach ABOVE the tile so
   *  they overlap whatever is in the row above — when that's a block, the grass
   *  reads as growing in front of it (the layered 3D look). */
  private drawGrassBlades(px: number, py: number, x: number, y: number, now: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    const pu = Math.max(1, Math.round(t / 24));
    let seed = (x * 374761393 + y * 668265263) >>> 0;
    const rnd = (): number => {
      seed = ((seed ^ (seed >>> 13)) * 1274126177) >>> 0;
      return (seed & 1023) / 1023;
    };
    const greens = ["#4b8a30", "#5aa53c", "#43802c", "#67bb46"];
    const wind = Math.sin(now / 620 + x * 0.55 + y * 0.3);
    // Body blades across the tile.
    for (let i = 0; i < 22; i++) {
      const bx = px + Math.floor(rnd() * (t - pu));
      const by = py + Math.floor(rnd() * (t - pu * 3));
      const hgt = pu * (2 + Math.floor(rnd() * 2));
      const sway = Math.round(wind * pu * (0.6 + rnd() * 0.8));
      ctx.fillStyle = greens[(seed >> 3) & 3];
      ctx.fillRect(bx, by, pu, hgt); // stalk
      ctx.fillRect(bx + sway, by - pu, pu, pu); // swaying tip
    }
    // A few tall front blades whose tips poke ABOVE the tile (drawn after blocks,
    // so they overlap onto the block above → depth/3D).
    for (let i = 0; i < 5; i++) {
      const bx = px + Math.floor(rnd() * (t - pu));
      const top = py - pu * (1 + Math.floor(rnd() * 2));
      const sway = Math.round(wind * pu * 1.3);
      ctx.fillStyle = greens[(seed >> 5) & 3];
      ctx.fillRect(bx + sway, top, pu, pu * 3);
    }
  }

  /** Desktop grass pass: animated blades over every OPEN tile (not under blocks —
   *  that's the optimization), drawn AFTER blocks so front tips overlap them. */
  private drawGrassOverlay(view: RenderView, now: number): void {
    if (!view.grid) return;
    const t = this.tile;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = y * GRID_W + x;
        const tile = view.grid[i] as TileType;
        if (tile === TileType.HARD || tile === TileType.SOFT || tile === TileType.EXPLOSION) continue;
        if (this.burn.has(i)) continue; // blasted ground: grass is burnt away
        this.drawGrassBlades(x * t, y * t, x, y, now);
      }
    }
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
