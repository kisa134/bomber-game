import { GRID_W, GRID_H, TileType, BOMB_TIMER_MS, EXPLOSION_LIFETIME_MS, START_LIVES } from "../net/protocol.js";
import type { RenderView } from "./state.js";
import type { Assets } from "./assets.js";
import { ASSET_VER } from "./assets.js";

export const PLAYER_COLORS = ["#ff5555", "#4aa3ff", "#5fd96a", "#ffcc33"];
export const SKIN_EMOJI = ["🐕", "🐸", "🦊", "😐", "🐶", "🥚", "🕶", "🦄", "🧌", "📞", "💪"];

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
const BLOOD_DECAY_MS = 12000; // slow self-clean only (blood now comes from deaths/bombs, not running) -> pools persist, gentle fade
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
  // Optional pseudo-3D height physics (gore/debris): arc up via vz, bounce on the
  // ground (z=0) with restitution, friction-stick on landing. Screen Y is raised by z.
  z?: number; // height above ground (cells)
  vz?: number; // vertical velocity (cells/s) — presence enables the height physics
  gz?: number; // z-gravity (cells/s^2)
  rest?: number; // restitution on bounce (gore ~0.15, debris ~0.6)
  fric?: number; // horizontal friction multiplier applied on each ground contact
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
  // Reaction emojis burst out of the player's cell and scatter (spammable).
  private emotePops: Array<{ x0: number; y0: number; vx: number; vy: number; e: string; born: number }> = [];
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
  // Persistent blood on the ground (death-cell mush + smeared footprints). cell -> intensity.
  private bloodGround = new Map<number, number>();
  private puBuf: HTMLCanvasElement | null = null; // scratch buffer for powerup sheen masked to the icon
  private bloodCanvas: HTMLCanvasElement | null = null; // cached dense blood-ground overlay
  private bloodDirty = false;
  private bakedBlood = new Map<number, number>(); // blood cell -> bake level (1 crust .. 3 charcoal)
  private bloodDecayAt = 0; // last time fresh ground blood thinned a step (see decayBlood)
  private chips: Array<{ x: number; y: number; seed: number }> = []; // wood splinters from broken crates (x,y in cells)
  private bloodyFeet = new Map<number, number>(); // player id -> bloody steps left (tracks blood around)
  private lastCell = new Map<number, number>(); // player id -> last grid cell (footprint stepping)
  // Foot-shaped blood prints left while walking with bloody feet (x,y in cells; dx,dy = facing).
  private footprints: Array<{ x: number; y: number; dx: number; dy: number; a: number; seed: number }> = [];
  private bones: Array<{ x: number; y: number; seed: number }> = []; // scattered bone-shard decals (x,y in cells)
  private meat: Array<{ x: number; y: number; seed: number }> = []; // scattered flesh-chunk decals (x,y in cells)
  // Floating reward/event popups that pop in with ease-out-back/elastic, rise, fade.
  private floaters: Array<{ x: number; y: number; text: string; color: string; born: number; big: boolean }> = [];
  private shatters: Array<{ x: number; y: number; born: number }> = []; // soft-break shatter fx
  private scorch: HTMLCanvasElement | null = null; // cached burnt-ground overlay
  private scorchDirty = false;
  private lastDust = new Map<number, number>();
  private lastTrample = new Map<number, number>();
  // Screen shake as a damped sine (physical recoil), not linear jitter.
  private shakeStart = -1e9;
  private shakeDur = 0;
  private shakeMag = 0;
  private shakePh = 0;
  private danger = 0; // 0..1 threat level -> pulsing red edge vignette (low HP / sudden death)
  private selfX = 0; private selfY = 0; private selfKnown = false; // local player pos (for distance shake)
  private lastClatter = 0; // throttle for bone/chip clatter sfx
  private colorTemp = 1; // +1 cozy warm (match start) .. -1 mortuary cold (end / sudden death)
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
    this.bloodGround.clear();
    this.bakedBlood.clear();
    this.bloodCanvas = null;
    this.bloodDirty = false;
    this.bloodyFeet.clear();
    this.lastCell.clear();
    this.footprints = [];
    this.bones = [];
    this.meat = [];
    this.chips = [];
    this.floaters = [];
    this.danger = 0;
    this.colorTemp = 1; // start each match cozy-warm
    this.selfKnown = false;
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
    this.emotePops.length = 0;
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

  /** Burst a reaction emoji out of the player's cell. Each call spawns a fresh
   *  particle that flies outward (biased upward) and fades — spam = confetti. */
  showEmote(playerId: number, e: string): void {
    const p = this.lastPos.get(playerId);
    const x0 = (p ? p.x : (GRID_W - 1) / 2) + 0.5;
    const y0 = (p ? p.y : (GRID_H - 1) / 2) + 0.2;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // upper half, spread
    const spd = 1.5 + Math.random() * 1.7; // cells/sec
    this.emotePops.push({ x0, y0, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, e, born: performance.now() });
    if (this.emotePops.length > 80) this.emotePops.shift(); // bound for a spammer
  }

  /** Update + draw the scattering reaction emojis (world space, on top). */
  private drawEmotePops(ctx: CanvasRenderingContext2D, t: number, now: number): void {
    const LIFE = 1500;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = this.emotePops.length - 1; i >= 0; i--) {
      const p = this.emotePops[i];
      const age = (now - p.born) / 1000;
      const k = (age * 1000) / LIFE;
      if (k >= 1) {
        this.emotePops.splice(i, 1);
        continue;
      }
      const px = (p.x0 + p.vx * age) * t;
      const py = (p.y0 + p.vy * age) * t;
      const grow = Math.min(1, age * 7);
      const sz = t * 0.46 * (0.55 + 0.45 * grow); // quick pop-in then steady
      ctx.globalAlpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35; // fade out at the end
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.arc(px, py, sz * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${Math.floor(sz)}px system-ui`;
      ctx.fillText(p.e, px, py + 1);
    }
    ctx.globalAlpha = 1;
  }

  shake(mag: number, ms = 250): void {
    if (this.lowFx) return;
    const now = performance.now();
    // Restart the impulse when the current one has expired or the new hit is
    // stronger; otherwise let the existing recoil ring out.
    if (now >= this.shakeStart + this.shakeDur || mag >= this.shakeMag) {
      this.shakeStart = now;
      this.shakeDur = ms;
      this.shakeMag = mag;
      this.shakePh = Math.random() * Math.PI * 2;
    }
  }

  /** Spawn a floating popup at a world cell (x,y in cells) that pops in with an
   *  ease-out-back overshoot (or elastic when `big`), rises, and fades. */
  popText(x: number, y: number, text: string, color: string, big = false): void {
    this.floaters.push({ x: x + 0.5, y, text, color, born: performance.now(), big });
    if (this.floaters.length > 24) this.floaters.shift();
  }

  private drawFloaters(now: number): void {
    if (!this.floaters.length) return;
    const ctx = this.ctx, t = this.tile;
    const life = 1050;
    const c1 = 1.70158, c3 = c1 + 1;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      const age = now - f.born;
      if (age >= life) { this.floaters.splice(i, 1); continue; }
      const k = age / life;
      const pin = Math.min(1, age / (f.big ? 460 : 240));
      // ease-out-back (overshoot) for normal, ease-out-elastic for big rewards.
      const s = f.big
        ? (pin >= 1 ? 1 : Math.pow(2, -10 * pin) * Math.sin((pin * 10 - 0.75) * (2 * Math.PI / 3)) + 1)
        : 1 + c3 * Math.pow(pin - 1, 3) + c1 * Math.pow(pin - 1, 2);
      const rise = (f.big ? 0.5 : 0.85) * k;
      const alpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      const px = f.x * t, py = (f.y - 0.4 - rise) * t;
      const fs = Math.max(1, Math.round(t * (f.big ? 0.5 : 0.34) * Math.max(0.04, s)));
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.font = `900 ${fs}px "Arial Black", "Arial", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, fs * 0.2);
      ctx.strokeStyle = "#180008";
      ctx.strokeText(f.text, px, py);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, px, py);
      ctx.restore();
    }
  }

  /** Match-time colour temperature: +1 = cozy warm (safe, early), 0 = neutral,
   *  −1 = mortuary cold (sudden death / round end). Drives a screen-space grade. */
  setColorTemp(w: number): void {
    this.colorTemp = Math.max(-1, Math.min(1, w));
  }

  private drawColorGrade(W: number, H: number): void {
    const w = this.colorTemp;
    if (Math.abs(w) < 0.02) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "soft-light"; // gentle tint, not a slapped-on filter
    if (w > 0) { // a barely-there warmth (mood, not a colour film)
      ctx.globalAlpha = w * 0.12;
      ctx.fillStyle = "#ffb657";
    } else { // cold steel-blue creeps in toward the end
      ctx.globalAlpha = -w * 0.28;
      ctx.fillStyle = "#4a78bd";
    }
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** Threat level 0..1 (set from the local player's HP / sudden death) that drives
   *  the pulsing red edge vignette. */
  setDanger(level: number): void {
    this.danger = Math.max(0, Math.min(1, level));
  }

  /** Danger cue (dopamine doc 1.2 — foveal flow vs peripheral panic): a thin, bright
   *  red glow hugging only the OUTER edges of the arena, slowly pulsing. The centre
   *  stays clean (foveal focus) while the periphery flashes (bottom-up alarm). */
  private drawDangerVignette(W: number, H: number, now: number): void {
    if (this.danger <= 0.01) return;
    const ctx = this.ctx;
    const freq = 1.1 + this.danger * 0.7; // slow ~1.1–1.8 Hz breathing pulse
    const pulse = 0.5 + 0.5 * Math.sin((now / 1000) * freq * Math.PI * 2);
    const a = this.danger * (0.2 + 0.5 * pulse); // peak alpha (brighter, mostly on the pulse)
    const band = Math.min(W, H) * 0.018; // ultra-thin glow right at the extreme edge
    const col = (alpha: number): string => `rgba(255,30,24,${Math.max(0, alpha).toFixed(3)})`;
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // additive -> vivid edge glow, center untouched
    let g = ctx.createLinearGradient(0, 0, 0, band); // top
    g.addColorStop(0, col(a)); g.addColorStop(1, col(0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, band);
    g = ctx.createLinearGradient(0, H, 0, H - band); // bottom
    g.addColorStop(0, col(a)); g.addColorStop(1, col(0));
    ctx.fillStyle = g; ctx.fillRect(0, H - band, W, band);
    g = ctx.createLinearGradient(0, 0, band, 0); // left
    g.addColorStop(0, col(a)); g.addColorStop(1, col(0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, band, H);
    g = ctx.createLinearGradient(W, 0, W - band, 0); // right
    g.addColorStop(0, col(a)); g.addColorStop(1, col(0));
    ctx.fillStyle = g; ctx.fillRect(W - band, 0, band, H);
    ctx.restore();
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
      this.burn.set(idx, Math.min(10, (this.burn.get(idx) ?? 0) + 1)); // +1 per blast -> gradual darkening (epicenter darkest)
      this.scorchDirty = true;
      // A blast BURNS blood to charcoal. If there's blood on the blast cell or any
      // of its 8 neighbours (the spread bleeds past the source cells), drop a dense
      // charred-black patch on the blast cell.
      {
        let nearBlood = false;
        for (let dy = -1; dy <= 1 && !nearBlood; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = c.x + dx, ny = c.y + dy;
            if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
            if (this.bloodGround.has(ny * GRID_W + nx)) { nearBlood = true; break; }
          }
        }
        if (nearBlood) {
          this.bloodGround.set(idx, Math.max(this.bloodGround.get(idx) ?? 0, 6)); // a solid patch to char
          this.bakedBlood.set(idx, 3); // blood -> charcoal-black
          this.burn.set(idx, Math.min(10, Math.max(this.burn.get(idx) ?? 0, 5))); // ground under it scorches deep too -> ONE unified charcoal patch
          this.bloodDirty = true;
        }
      }
      if (this.prevGrid) {
        for (const [dx, dy] of NB) {
          const nx = c.x + dx, ny = c.y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
          const ni = ny * GRID_W + nx;
          if (this.prevGrid[ni] === TileType.HARD) {
            const cur = this.hardDmg.get(ni) ?? 0;
            // Per-block toughness: each block plateaus at a seeded max stage (3..6),
            // so the field stays visually VARIED late game instead of every block
            // maxing out identically. Advance probabilistically so blocks crack at
            // different moments (staggered "damage animation" over time).
            const maxStage = 3 + ((((ni * 2654435761) >>> 0) >> 9) % 4);
            if (cur < maxStage && Math.random() < 0.55) {
              this.hardDmg.set(ni, cur + 1);
              if (!this.lowFx) { // a stone-chip puff so the crack visibly "happens"
                for (let d = 0; d < 4; d++) {
                  const aa = Math.random() * Math.PI * 2, ss = 1 + Math.random() * 2.2;
                  this.push({
                    x: nx + 0.5, y: ny + 0.5, vx: Math.cos(aa) * ss, vy: Math.sin(aa) * ss - 1.2,
                    life: 0.4 + Math.random() * 0.35, max: 0.75, size: this.tile * (0.04 + Math.random() * 0.05),
                    color: Math.random() < 0.5 ? "#8a8276" : "#5e564c", gravity: 16, drag: 0.95,
                    shape: "rect", rot: Math.random() * 3, spin: (Math.random() - 0.5) * 12,
                  });
                }
              }
            }
          }
        }
      }
    }
    this.blastGibs(cells, Math.min(1, cells.length / 13)); // fling gibs outward, farther for a bigger blast
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
      // Hot core bloom: a brief WARM additive glow at the blast core (localized,
      // not a full-screen flash) — gives the explosion an extra punch.
      this.push({
        x: cx, y: cy, vx: 0, vy: 0, life: 0.14, max: 0.14, drag: 1,
        size: this.tile * (0.85 + Math.random() * 0.2), color: "rgba(255,196,96,0.7)", shape: "flash",
      });
      this.addDecal(c.x, c.y, "scorch");
      // Volumetric light source for this blast cell.
      this.lights.push({ x: cx, y: cy, born: now });
      if (this.lights.length > 80) this.lights.shift();
    }
    // Shake amplitude falls off with distance² from the blast to YOU (doc 1.3) —
    // a blast at your feet rocks the screen; one across the map barely registers.
    const blast = Math.min(18, 4 + cells.length * 0.5);
    let amp = blast * 0.5; // fallback (spectating / self unknown): muted global shake
    if (this.selfKnown) {
      let d2 = Infinity;
      for (const c of cells) {
        const dx = c.x + 0.5 - this.selfX, dy = c.y + 0.5 - this.selfY;
        const dd = dx * dx + dy * dy;
        if (dd < d2) d2 = dd;
      }
      const prox = 1 / (1 + d2 / 9); // inverse-square-ish falloff (~3-cell scale)
      amp = blast * (0.16 + 0.84 * prox);
    }
    this.shake(amp, 240);
  }

  onDeath(cx: number, cy: number, color: string): void {
    // Persistent blood marks first (cheap, runs on phones too): a thick gory mush
    // that STAYS on the death cell, blood on the floor neighbours, and face-aware
    // blood on adjacent blocks (top splatter + front drips toward the kill).
    this.bakedBlood.delete(cy * GRID_W + cx); // fresh kill: wipe any old char here so new RED mush shows on top
    this.markGround(cy * GRID_W + cx, 9); // death cell -> the whole tile in thick mush
    const grid = this.prevGrid;
    // Spread gore over a 5x5 area: 8 direct neighbours fully bloodied (cells AND
    // blocks), then an outer ring of spray. The kill site is drenched.
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        const ni = ny * GRID_W + nx;
        const ring = Math.max(Math.abs(dx), Math.abs(dy)); // 1 = adjacent, 2 = outer
        const isBlock = grid && (grid[ni] === TileType.HARD || grid[ni] === TileType.SOFT);
        if (ring === 1) {
          if (isBlock) {
            this.markBlockBlood(ni, -dx, -dy);
            this.markBlockBlood(ni, -dx, -dy); // doubled -> heavy splatter on the face
          } else {
            this.bakedBlood.delete(ni); // fresh mush over any old char on the inner ring too
            this.markGround(ni, dx === 0 || dy === 0 ? 4 : 3); // thick mush at the epicentre, falls off fast
          }
        } else { // outer ring: only the odd satellite speck (keep the pool concentrated)
          if (isBlock) {
            if (Math.random() < 0.3) this.markBlockBlood(ni, -dx, -dy);
          } else if (Math.random() < 0.3) {
            this.markGround(ni, 1);
          }
        }
      }
    }
    // Scatter persistent bone shards + flesh chunks through the gore (random spread).
    const nBones = 6 + ((Math.random() * 6) | 0); // a real bone explosion
    for (let i = 0; i < nBones; i++) {
      const bx = cx + 0.5 + (Math.random() - 0.5) * 3.2;
      const by = cy + 0.5 + (Math.random() - 0.5) * 3.2;
      if (bx < 0.2 || by < 0.2 || bx > GRID_W - 0.2 || by > GRID_H - 0.2) continue;
      this.bones.push({ x: bx, y: by, seed: (Math.random() * 0xffffffff) >>> 0 });
    }
    const nMeat = 5 + ((Math.random() * 5) | 0); // more flesh chunks
    for (let i = 0; i < nMeat; i++) {
      const mx = cx + 0.5 + (Math.random() - 0.5) * 2.8;
      const my = cy + 0.5 + (Math.random() - 0.5) * 2.8;
      if (mx < 0.2 || my < 0.2 || mx > GRID_W - 0.2 || my > GRID_H - 0.2) continue;
      this.meat.push({ x: mx, y: my, seed: (Math.random() * 0xffffffff) >>> 0 });
    }
    if (this.bones.length > 170) this.bones.splice(0, this.bones.length - 170);
    if (this.meat.length > 150) this.meat.splice(0, this.meat.length - 150);
    this.bloodDirty = true; // bones + meat live in the cached blood overlay
    if (this.lowFx) return; // phones: keep the blood, skip the heavy gib particles
    // Gory blow-up: red gibs fly out and arc down into a mush, plus a fine
    // blood spray, a hint of the player's color, and a few bone-white bits.
    const reds = ["#8a0000", "#a30000", "#c81e1e", "#6a0000"];
    for (let i = 0; i < Math.round(72 * this.fxScale); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 4.5; // ground-plane spray speed
      this.push({
        x: cx + 0.5, y: cy + 0.5,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        vz: 4.5 + Math.random() * 5.5, // launched upward, then falls fast
        gz: 34, rest: 0.18, fric: 0.84, // gore: heavy wet shlap, low bounce, sticks
        life: 0.7 + Math.random() * 0.7, max: 1.4,
        size: this.tile * (0.06 + Math.random() * 0.13),
        color: reds[(Math.random() * reds.length) | 0],
        shape: "rect", rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 16,
      });
    }
    this.burst(cx, cy, "#d61e1e", 36, 6); // fine blood spray
    this.burst(cx, cy, "#7a0000", 24, 4.6); // darker gore spray
    this.burst(cx, cy, color, 10, 3); // a hint of the player's color
    this.burst(cx, cy, "#efe6cf", 9, 3.4); // bone / teeth bits
    this.shake(22, 320);
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

  /** Add blood to a floor cell (death-cell mush = big amount; footprints = 1).
   *  Persists for the match and accumulates. */
  private markGround(index: number, amount: number): void {
    if (index < 0 || index >= GRID_W * GRID_H) return;
    // No eviction — pools never vanish on you. The slow decay tick (decayBlood) is what
    // keeps the map from carpeting: fresh mush thins out over time; charred blood stays.
    this.bloodGround.set(index, Math.min(9, (this.bloodGround.get(index) ?? 0) + amount));
    this.bloodDirty = true;
  }

  /** Fresh blood slowly thins/dries so the board self-cleans (the smeared mush
   *  disperses over time). Charred (baked) blood persists — it stays as scorched
   *  charcoal until a fresh kill lays new mush over it. */
  private decayBlood(now: number): void {
    if (now - this.bloodDecayAt < BLOOD_DECAY_MS) return;
    this.bloodDecayAt = now;
    let changed = false;
    for (const [idx, lvl] of this.bloodGround) {
      if ((this.bakedBlood.get(idx) ?? 0) > 0) continue; // char stays
      if (lvl <= 1) this.bloodGround.delete(idx);
      else this.bloodGround.set(idx, lvl - 1);
      changed = true;
    }
    if (changed) this.bloodDirty = true;
  }

  /** Persistent ground blood: thick gory mush where players died (fills the whole
   *  cell), pooled splatter around, faint smears where bloody feet tracked it.
   *  Dense grid-fill at grass-fine pixels, cached to a canvas and blitted. */
  private drawBloodGround(W: number, H: number): void {
    if (!this.bloodGround.size) return;
    if (this.bloodDirty || !this.bloodCanvas || this.bloodCanvas.width !== W || this.bloodCanvas.height !== H) {
      this.buildBloodGround(W, H);
    }
    if (this.bloodCanvas) this.ctx.drawImage(this.bloodCanvas, 0, 0, W, H);
  }

  private buildBloodGround(W: number, H: number): void {
    this.bloodDirty = false;
    const cv = this.bloodCanvas && this.bloodCanvas.width === W && this.bloodCanvas.height === H
      ? this.bloodCanvas : document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, W, H);
    const t = this.tile;
    const pu = Math.max(1, Math.round(t / 22));

    // CONTINUOUS field: bilinearly interpolate per-cell intensities so blood reads as
    // ONE smooth organic spread falling off from each epicentre (no per-tile squares).
    // The hard cell-COUNT cap in markGround() is what stops it covering the whole map.
    let minX = GRID_W, minY = GRID_H, maxX = -1, maxY = -1;
    for (const idx of this.bloodGround.keys()) {
      const cx = idx % GRID_W, cy = (idx / GRID_W) | 0;
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    }
    if (maxX >= 0) {
      minX = Math.max(0, minX - 1); minY = Math.max(0, minY - 1);
      maxX = Math.min(GRID_W - 1, maxX + 1); maxY = Math.min(GRID_H - 1, maxY + 1);
      const cellI = (cx: number, cy: number): number => (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) ? 0 : (this.bloodGround.get(cy * GRID_W + cx) ?? 0);
      const bakeI = (cx: number, cy: number): number => (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) ? 0 : (this.bakedBlood.get(cy * GRID_W + cx) ?? 0);
      const x1 = (maxX + 1) * t, y1 = (maxY + 1) * t;
      for (let gy = minY * t; gy < y1; gy += pu) {
        const fy = gy / t - 0.5, cy0 = Math.floor(fy), ty = fy - cy0;
        for (let gx = minX * t; gx < x1; gx += pu) {
          const fx = gx / t - 0.5, cx0 = Math.floor(fx), tx = fx - cx0;
          const i00 = cellI(cx0, cy0), i10 = cellI(cx0 + 1, cy0), i01 = cellI(cx0, cy0 + 1), i11 = cellI(cx0 + 1, cy0 + 1);
          const inten = (i00 * (1 - tx) + i10 * tx) * (1 - ty) + (i01 * (1 - tx) + i11 * tx) * ty;
          if (inten < 0.5) continue; // thin ragged edge fades out; the cap stops a carpet
          const norm = Math.min(1, inten / 6); // 0..1 (1 = epicentre)
          let cn = (((gx / (pu * 3)) | 0) * 374761393 ^ ((gy / (pu * 3)) | 0) * 668265263) >>> 0; cn = ((cn ^ (cn >>> 13)) * 1274126177) >>> 0; const coarse = (cn & 1023) / 1023;
          let fn = (gx * 73856093 ^ gy * 19349663) >>> 0; fn = ((fn ^ (fn >>> 13)) * 1274126177) >>> 0; const fine = (fn & 1023) / 1023;
          const bk = Math.max(bakeI(cx0, cy0), bakeI(cx0 + 1, cy0), bakeI(cx0, cy0 + 1), bakeI(cx0 + 1, cy0 + 1));
          // coverage: fresh blood falls off with intensity; CHARRED blood is dense
          // (the burn fills the cell), so it reads as a solid scorched-black patch.
          const cov = bk > 0 ? Math.min(1, 0.5 + 0.45 * coarse) : norm * (0.42 + 0.95 * coarse);
          if (fine > cov) continue;
          if (bk > 0) { // baked: dark crust -> charcoal/black with the odd ember
            const darken = 1 - (bk - 1) * 0.46; // 1.0 / 0.54 / 0.08
            g.globalAlpha = Math.min(0.96, 0.55 + norm * 0.4);
            if (bk >= 3 && (fn & 13) === 0) g.fillStyle = `rgb(${80 + (fn % 70)},${16 + (fn % 18)},5)`; // ember
            else { const br = Math.max(3, ((14 + (fn % 32)) * darken) | 0); g.fillStyle = `rgb(${br},${(br * (0.38 - (bk - 1) * 0.13)) | 0},${(br * 0.2) | 0})`; }
          } else { // fresh: a deep MEATY dark-red pool at the epicentre, thinning outward
            g.globalAlpha = Math.min(0.95, 0.35 + norm * 0.6);
            const tone = (fn >> 7) & 7;
            if (tone === 7 && norm > 0.6 && (fn & 15) < 2) {
              g.fillStyle = `rgb(${150 + (fn % 45)},${52 + (fn % 30)},50)`; // rare wet glint at the core
            } else {
              let base: number;
              if (tone <= 1) base = 14 + (fn % 16);        // near-black clot
              else if (tone <= 4) base = 28 + (fn % 26);   // dark maroon (most of it)
              else if (tone === 7) base = 80 + (fn % 50);  // occasional brighter fleck
              else base = 44 + (fn % 44);                  // mid dark red
              const rr = Math.max(7, (base * (0.42 + 0.58 * (1 - norm * 0.8))) | 0); // meatiest at the centre
              const gtone = 0.07 + ((fn >> 4) & 3) * 0.025;
              g.fillStyle = `rgb(${rr},${(rr * gtone) | 0},${(rr * 0.06) | 0})`;
            }
          }
          g.fillRect(gx, gy, pu, pu);
        }
      }
    }
    for (const ch of this.chips) this.drawChip(g, ch, pu); // wood splinters (under gore)
    for (const fp of this.footprints) this.drawFoot(g, fp, pu); // smears on top
    for (const mt of this.meat) this.drawMeat(g, mt, pu); // flesh chunks
    for (const b of this.bones) this.drawBone(g, b, pu); // bone shards on top
    g.globalAlpha = 1;
    this.bloodCanvas = cv;
  }

  /** A small wood splinter from a broken crate: a short brown shard with a lighter
   *  top edge and a soft shadow, randomly oriented. Lives in the cached overlay. */
  private drawChip(g: CanvasRenderingContext2D, c: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const px = c.x * t, py = c.y * t;
    let s = c.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const ang = rnd() * Math.PI;
    const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
    const len = t * (0.05 + rnd() * 0.05);
    const woods = ["#8a5a3c", "#a06b48", "#6e4a30", "#b5743f"];
    const col = woods[(rnd() * woods.length) | 0];
    g.globalAlpha = 0.25; // shadow
    g.fillStyle = "#000000";
    for (let aa = -len; aa <= len; aa += pu) {
      const wx = px + ux * aa + vx * pu, wy = py + uy * aa + vy * pu + pu;
      g.fillRect(Math.round(wx / pu) * pu, Math.round(wy / pu) * pu, pu, pu);
    }
    g.globalAlpha = 1;
    for (let aa = -len; aa <= len; aa += pu) { // 2px shard with a lighter top edge
      for (let bb = -pu; bb <= 0; bb += pu) {
        const wx = px + ux * aa + vx * bb, wy = py + uy * aa + vy * bb;
        g.fillStyle = bb < 0 ? "#c9925e" : col;
        g.fillRect(Math.round(wx / pu) * pu, Math.round(wy / pu) * pu, pu, pu);
      }
    }
  }

  /** Boot bones/meat lying on `cell` aside when a player runs over them — they
   *  scatter away from the player (like an accidental kick) + a little chip flies. */
  private kickGibs(cell: number, fromX: number, fromY: number): void {
    const t2 = this.tile;
    const px = fromX + 0.5, py = fromY + 0.5;
    let kicked = false;
    const boot = (arr: Array<{ x: number; y: number; seed: number }>, chip: string): void => {
      for (const o of arr) {
        if (((o.y | 0) * GRID_W + (o.x | 0)) !== cell) continue;
        let dx = o.x - px, dy = o.y - py;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
        const dist = 0.35 + Math.random() * 0.7;
        o.x = Math.max(0.2, Math.min(GRID_W - 0.2, o.x + dx * dist + (Math.random() - 0.5) * 0.3));
        o.y = Math.max(0.2, Math.min(GRID_H - 0.2, o.y + dy * dist + (Math.random() - 0.5) * 0.3));
        kicked = true;
        if (!this.lowFx) {
          this.push({
            x: o.x, y: o.y, vx: dx * (2 + Math.random() * 2), vy: dy * (1.5 + Math.random() * 1.5) - 1.5,
            life: 0.35 + Math.random() * 0.25, max: 0.6, gravity: 16, drag: 0.95,
            size: t2 * (0.04 + Math.random() * 0.04), color: chip, shape: "rect",
            rot: Math.random() * 3, spin: (Math.random() - 0.5) * 14,
          });
        }
      }
    };
    boot(this.bones, "#ece4cf");
    boot(this.meat, "#9c1414");
    boot(this.chips, "#a06b48");
    if (kicked) {
      this.bloodDirty = true;
      const now = performance.now();
      if (this.assets && now - this.lastClatter > 110) { // throttle so it doesn't buzz
        this.lastClatter = now;
        const sd = this.soundAt(fromX + 0.5, fromY + 0.5);
        this.assets.clatter(sd.vol * 0.7, sd.pan, Math.random() < 0.5);
      }
    }
  }

  /** Distance-based volume + stereo pan for a sound at a world cell-centre (cx,cy). */
  private soundAt(cx: number, cy: number): { vol: number; pan: number } {
    if (!this.selfKnown) return { vol: 0.6, pan: 0 };
    const dx = cx - (this.selfX + 0.5), dy = cy - (this.selfY + 0.5);
    const d2 = dx * dx + dy * dy;
    return { vol: Math.max(0.25, 1 / (1 + d2 / 22)), pan: Math.max(-1, Math.min(1, dx / 8.5)) };
  }

  /** Blow bones/meat/chips lying on the blast cells outward from the epicentre,
   *  flinging a flying piece (our z-physics) and relocating the persistent decal. */
  private blastGibs(cells: Array<{ x: number; y: number }>, power = 0.5): void {
    if ((!this.bones.length && !this.meat.length && !this.chips.length) || !cells.length) return;
    const set = new Set(cells.map((c) => c.y * GRID_W + c.x));
    let cxs = 0, cys = 0;
    for (const c of cells) { cxs += c.x + 0.5; cys += c.y + 0.5; }
    cxs /= cells.length; cys /= cells.length;
    const force = 0.6 + power * 1.1; // stronger blast -> flung farther/faster
    let moved = false;
    const blast = (arr: Array<{ x: number; y: number; seed: number }>, color: string, rest: number): void => {
      for (const o of arr) {
        if (!set.has((o.y | 0) * GRID_W + (o.x | 0))) continue;
        let dx = o.x - cxs, dy = o.y - cys;
        let d = Math.hypot(dx, dy);
        if (d < 0.05) { const aa = Math.random() * Math.PI * 2; dx = Math.cos(aa); dy = Math.sin(aa); d = 1; }
        dx /= d; dy /= d;
        const startX = o.x, startY = o.y;
        const dist = (0.8 + Math.random() * 1.6) * force; // distance scales with blast power
        o.x = Math.max(0.2, Math.min(GRID_W - 0.2, o.x + dx * dist + (Math.random() - 0.5) * 0.5));
        o.y = Math.max(0.2, Math.min(GRID_H - 0.2, o.y + dy * dist + (Math.random() - 0.5) * 0.5));
        moved = true;
        if (!this.lowFx) {
          this.push({
            x: startX, y: startY, vx: dx * (4 + Math.random() * 4) * force, vy: dy * (4 + Math.random() * 4) * force,
            vz: (5 + Math.random() * 5) * (0.7 + power * 0.6), gz: 32, rest, fric: 0.86,
            life: 0.5 + Math.random() * 0.45, max: 0.95, size: this.tile * (0.05 + Math.random() * 0.06),
            color, shape: "rect", rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 18,
          });
        }
      }
    };
    blast(this.bones, "#ece4cf", 0.4);
    blast(this.meat, "#9c1414", 0.18);
    blast(this.chips, "#a06b48", 0.6);
    if (moved) {
      this.bloodDirty = true;
      if (this.assets) {
        const sd = this.soundAt(cxs, cys);
        this.assets.clatter(sd.vol, sd.pan, true); // gibs scattered by the blast
      }
    }
  }

  /** A small scattered flesh chunk: a dark-red irregular blob with a pink highlight
   *  and a soft shadow. Lives in the cached blood overlay. */
  private drawMeat(g: CanvasRenderingContext2D, m: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const cx = m.x * t, cy = m.y * t;
    let s = m.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const rx = t * (0.1 + rnd() * 0.06), ry = t * (0.08 + rnd() * 0.05); // chunky, clearly visible
    const wob = () => 1 + (rnd() - 0.5) * 0.5; // per-pixel wobble for an irregular lump
    g.globalAlpha = 0.28; // soft drop shadow
    g.fillStyle = "#000000";
    for (let yy = -ry; yy <= ry; yy += pu) for (let xx = -rx; xx <= rx; xx += pu) {
      if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 1) continue;
      g.fillRect(Math.round((cx + xx + pu) / pu) * pu, Math.round((cy + yy + pu * 1.5) / pu) * pu, pu, pu);
    }
    g.globalAlpha = 1;
    const ox = (rx + pu) * 1.0, oy = (ry + pu) * 1.0;
    g.fillStyle = "#2a0000"; // dark outline ring
    for (let yy = -oy; yy <= oy; yy += pu) for (let xx = -ox; xx <= ox; xx += pu) {
      if ((xx * xx) / (ox * ox) + (yy * yy) / (oy * oy) > 1) continue;
      g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + yy) / pu) * pu, pu, pu);
    }
    const base = 120 + (s % 45);
    for (let yy = -ry; yy <= ry; yy += pu) for (let xx = -rx; xx <= rx; xx += pu) {
      if (((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry)) * wob() > 1) continue;
      const top = yy < -ry * 0.15; // glossy pink upper face, dark meat below
      g.fillStyle = top ? `rgb(${Math.min(255, base + 95)},${(base * 0.55) | 0},${(base * 0.52) | 0})` : `rgb(${base},${(base * 0.18) | 0},${(base * 0.16) | 0})`;
      g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + yy) / pu) * pu, pu, pu);
    }
    g.fillStyle = "#ffd0cc"; // tiny specular wet glint
    g.fillRect(Math.round((cx - rx * 0.3) / pu) * pu, Math.round((cy - ry * 0.5) / pu) * pu, pu, pu);
  }

  /** A small scattered bone shard: a bone-white shaft with knobby ends and a soft
   *  shadow, randomly oriented. Lives in the cached blood overlay. */
  private drawBone(g: CanvasRenderingContext2D, b: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const px = b.x * t, py = b.y * t;
    let s = b.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const ang = rnd() * Math.PI;
    const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
    const len = t * (0.05 + rnd() * 0.06);
    g.globalAlpha = 0.25; // soft drop shadow
    g.fillStyle = "#000000";
    for (let aa = -len; aa <= len; aa += pu) {
      const wx = px + ux * aa + vx * pu, wy = py + uy * aa + vy * pu + pu;
      g.fillRect(Math.round(wx / pu) * pu, Math.round(wy / pu) * pu, pu, pu);
    }
    g.globalAlpha = 1;
    for (let aa = -len; aa <= len; aa += pu) { // thin 1px shaft
      const wx = px + ux * aa, wy = py + uy * aa;
      g.fillStyle = "#ece4cf";
      g.fillRect(Math.round(wx / pu) * pu, Math.round(wy / pu) * pu, pu, pu);
    }
    g.fillStyle = "#f2ecda"; // small knobby bone ends
    for (const e of [-1, 1]) {
      const wx = px + ux * len * e * 1.08, wy = py + uy * len * e * 1.08;
      g.fillRect(Math.round(wx / pu) * pu, Math.round(wy / pu) * pu - pu, pu, pu * 2);
    }
  }

  /** Draw a realistic blood SMEAR: a rounded WIDE contact head that tapers to a
   *  thin tail along the travel direction (wide→narrow), with irregular edges and
   *  fading alpha — reads as dragged/skidded blood, not a cartoon footprint. */
  private drawFoot(g: CanvasRenderingContext2D, fp: { x: number; y: number; dx: number; dy: number; a: number; seed: number }, pu: number): void {
    const t = this.tile;
    const px = fp.x * t, py = fp.y * t;
    let ux = fp.dx, uy = fp.dy;
    const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m;
    const vx = -uy, vy = ux;
    let s = fp.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const r = 70 + (fp.seed % 56);
    const L = t * (0.16 + fp.a * 0.36); // total smear length (stronger -> longer)
    const W0 = t * (0.055 + fp.a * 0.05); // wide-end half width
    // The wide contact head sits slightly behind the step, tapering forward to a tip.
    const bx = px - ux * L * 0.15, by = py - uy * L * 0.15; // keep the smear centred on the step
    // Rounded wide head (the heavy contact blob).
    g.globalAlpha = fp.a;
    for (let yy = -W0; yy <= W0; yy += pu) {
      for (let xx = -W0; xx <= W0; xx += pu) {
        if (xx * xx + yy * yy > W0 * W0) continue;
        g.fillStyle = `rgb(${(r * 0.8) | 0},${(r * 0.08) | 0},${(r * 0.06) | 0})`; // darker = more blood
        g.fillRect(Math.round((bx + xx) / pu) * pu, Math.round((by + yy) / pu) * pu, pu, pu);
      }
    }
    // Tapering tail forward: half-width shrinks wide→narrow, alpha fades out, with
    // longitudinal STREAKS (light/dark ridges) so it reads as wet dragged blood.
    const steps = Math.max(4, Math.round(L / pu));
    const phase = (fp.seed % 100) / 100 * Math.PI * 2;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps; // 0 wide -> 1 narrow tip
      const hw = W0 * Math.pow(1 - f, 1.5);
      g.globalAlpha = fp.a * (1 - f * 0.55);
      const shade = r * (1 - f * 0.25);
      const jit = (rnd() - 0.5) * pu * 1.4; // ragged edge
      const cxp = bx + ux * (f * L), cyp = by + uy * (f * L);
      for (let b = -hw; b <= hw; b += pu) {
        // streak ridges along the drag direction (some bands darker, some lighter)
        const streak = 0.65 + 0.35 * Math.sin((b / Math.max(pu, W0)) * 6 + phase);
        const sh = Math.max(0, (shade * streak) | 0);
        g.fillStyle = `rgb(${sh},${(sh * 0.1) | 0},${(sh * 0.08) | 0})`;
        const wx = cxp + vx * (b + jit), wy = cyp + vy * (b + jit);
        g.fillRect(Math.round(wx / pu) * pu, Math.round(wy / pu) * pu, pu, pu);
      }
    }
  }

  /** Draw blood on a block: a squashed splatter on the TOP face + drips running
   *  down the FRONT face, biased toward the side the kill came from. */
  private drawBlockBlood(px: number, py: number, index: number): void {
    const m = this.bloodBlocks.get(index);
    if (!m) return;
    const ctx = this.ctx, t = this.tile;
    const pu = Math.max(1, Math.round(t / 28)); // very fine blood pixels
    let h = m.seed;
    const rnd = (): number => {
      h = (h ^ (h << 13)) >>> 0; h = (h ^ (h >>> 17)) >>> 0; h = (h ^ (h << 5)) >>> 0;
      return (h & 0xffff) / 0xffff;
    };
    const reds = ["#3a0000", "#5a0000", "#7a0000", "#9c0000", "#c81e1e"];
    const n = Math.min(4, m.n);
    const bias = ((m.dirs & BF_E ? 0.22 : 0) + (m.dirs & BF_W ? -0.22 : 0)); // gentle lean only
    const cxp = px + t * 0.5 + bias * t * 0.18; // splatter emanates roughly from the block CENTER

    if (this.lowFx) {
      // Phones: cheap static splat only (this method runs every frame, uncached) —
      // no spines / animated drips, so it never costs more than a handful of rects.
      const R = t * (0.17 + n * 0.05);
      for (let i = 0; i < 8 + n * 3; i++) {
        const ang = rnd() * Math.PI * 2;
        const dist = Math.sqrt(rnd()) * R;
        const sz = pu * (1 + ((rnd() * 2) | 0));
        ctx.fillStyle = reds[1 + ((rnd() * 4) | 0)];
        ctx.fillRect(Math.round((cxp + Math.cos(ang) * dist - sz / 2) / pu) * pu, Math.round((py + t * 0.25 + Math.sin(ang) * dist * 0.5 - sz / 2) / pu) * pu, sz, sz);
      }
      return;
    }

    // Per-block variation so each bloodied block looks DIFFERENT (no uniform pool).
    const sv = ((m.seed >>> 8) & 1023) / 1023;

    // This draws ON TOP of the baked blood sprite, so it's deliberately SUBTLE — a few
    // fresh specks up top + thin runs down the front. It must read as "fresh spatter
    // that just landed", never as opaque pools.

    // TOP-face spatter — a handful of small fresh specks near the top face.
    const topStrong = m.dirs & BF_N ? 1 : 0.6;
    const topBlobs = Math.round((3 + n * 2) * topStrong * (0.5 + sv * 0.8));
    const topR = t * (0.22 + n * 0.05 + sv * 0.1);
    for (let i = 0; i < topBlobs; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = Math.sqrt(rnd()) * topR;
      const bx = cxp + Math.cos(ang) * dist;
      const by = py + t * 0.18 + Math.sin(ang) * dist * 0.5;
      const sz = pu * (1 + Math.floor(rnd() * 1.8));
      ctx.globalAlpha = 0.55 + rnd() * 0.35;
      ctx.fillStyle = reds[1 + ((rnd() * 4) | 0)];
      ctx.fillRect(Math.round((bx - sz / 2) / pu) * pu, Math.round((by - sz / 2) / pu) * pu, sz, sz);
    }
    // Cast-off spines — only on some blocks, thin flick marks off the top.
    if (sv > 0.5) {
      const spines = 1 + Math.round(sv * 3);
      for (let i = 0; i < spines; i++) {
        const ang = rnd() * Math.PI * 2;
        const reach = topR * (0.6 + rnd() * 0.6);
        const wob = (rnd() - 0.5) * 0.25;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = reds[2 + ((rnd() * 3) | 0)];
        for (let sdist = topR * 0.25; sdist < reach; sdist += pu) {
          const aa = ang + wob * (sdist / reach);
          const sx = cxp + Math.cos(aa) * sdist, sy = py + t * 0.18 + Math.sin(aa) * sdist * 0.5;
          ctx.fillRect(Math.round(sx / pu) * pu, Math.round(sy / pu) * pu, pu, pu);
        }
      }
    }
    // FRONT-face drips: THIN runs that ooze down and TAPER to nothing — no bottom bead,
    // semi-transparent so they sit as streaks over the baked blood, never as a pool.
    const frontStrong = m.dirs & BF_S ? 1 : 0.55;
    const wantDrips = (m.dirs & BF_S) !== 0 || sv > 0.55;
    const drips = wantDrips ? Math.max(1, Math.round((0.6 + n * 0.7) * (0.5 + frontStrong))) : 0;
    const now = performance.now();
    for (let d = 0; d < drips; d++) {
      const dx = cxp + (rnd() - 0.5) * t * 0.6;
      const top = py + t * 0.4; // start below the top/front-face boundary
      const maxLen = t * (0.12 + rnd() * 0.3 * frontStrong); // stays within the front face
      const delay = rnd() * 700, grow = 1500 + rnd() * 1500;
      const prog = Math.max(0, Math.min(1, (now - m.born - delay) / grow));
      const len = maxLen * (1 - (1 - prog) * (1 - prog)); // ease-out grow
      const shade = reds[1 + ((rnd() * 2) | 0)];
      for (let y = 0; y < len; y += pu) {
        const frac = y / Math.max(pu, len);
        const ww = frac < 0.45 ? pu * 2 : pu; // a touch wider near the top, 1px lower down
        ctx.globalAlpha = 0.5 * (1 - frac * 0.85); // fades toward the tip -> dissolves, no bead
        ctx.fillStyle = shade;
        ctx.fillRect(Math.round((dx - ww / 2) / pu) * pu, Math.round((top + y) / pu) * pu, ww, pu);
      }
    }
    ctx.globalAlpha = 1;
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
    // Thick DARK-RED blood outline (edges), so the whole thing reads as written
    // in blood rather than black-outlined.
    g.fillStyle = "#2a0000";
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        if (dx || dy) g.fillText(text, mx + dx, my + dy);
      }
    }
    // Blood-red fill, brighter at the top -> darker, congealed lower half.
    g.fillStyle = "#6e0000";
    g.fillText(text, mx, my + 2);
    g.fillStyle = "#a80000";
    g.fillText(text, mx, my + 1);
    g.fillStyle = "#e01414";
    g.fillText(text, mx, my);
    this.fbCanvas = c;
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

    // Screen shake — damped sine A·e^(−λt)·osc with independent X/Y axes, so it
    // reads as physical recoil/impact rather than machine jitter.
    ctx.save();
    const st = now - this.shakeStart;
    if (st >= 0 && st < this.shakeDur && this.shakeMag > 0) {
      const ts = st / 1000;
      const env = Math.exp(-9 * ts) * (1 - st / this.shakeDur); // decay + clean cut to 0
      const A = this.shakeMag;
      const ox = A * env * Math.sin(ts * 283 + this.shakePh); // ~45Hz
      const oy = A * env * Math.cos(ts * 311 + this.shakePh * 1.4); // slightly detuned
      ctx.translate(ox, oy);
    }

    // Blit the cached floor under everything. On phones, rebuild the cache once
    // the floor sprite has finished loading (preload is async).
    if (this.lowFx && !this.floorSpriteBaked && this.assets?.img("floor")) this.buildFloor();
    if (this.floor) ctx.drawImage(this.floor, 0, 0, W, H);
    // Scorched ground: burnt patches that build up where blasts happened.
    if (this.scorchDirty || (this.burn.size && !this.scorch)) this.buildScorch(W, H);
    if (this.scorch) ctx.drawImage(this.scorch, 0, 0, W, H);
    this.decayBlood(performance.now()); // fresh mush slowly thins (self-cleaning); char persists
    this.drawBloodGround(W, H); // persistent blood mush + smeared footprints (over the floor)

    if (view.grid) {
      // Detect soft-block breaks (SOFT -> not SOFT) to spray debris.
      if (this.prevGrid && this.prevGrid.length === view.grid.length) {
        for (let i = 0; i < view.grid.length; i++) {
          if (this.prevGrid[i] === TileType.SOFT && view.grid[i] !== TileType.SOFT) {
            const bx = i % GRID_W, by = (i / GRID_W) | 0;
            this.emitDebris(bx, by);
            this.shatters.push({ x: bx, y: by, born: now });
            // (crate-smash sfx disabled for now — felt out of place)
            // Persistent wood splinters scattered around the broken crate.
            const nChips = 2 + ((Math.random() * 3) | 0);
            for (let d = 0; d < nChips; d++) {
              const sx = bx + 0.5 + (Math.random() - 0.5) * 1.8;
              const sy = by + 0.5 + (Math.random() - 0.5) * 1.8;
              if (sx < 0.2 || sy < 0.2 || sx > GRID_W - 0.2 || sy > GRID_H - 0.2) continue;
              this.chips.push({ x: sx, y: sy, seed: (Math.random() * 0xffffffff) >>> 0 });
            }
            if (this.chips.length > 140) this.chips.splice(0, this.chips.length - 140);
            this.bloodDirty = true; // chips live in the cached ground overlay
            // Burned cash bursts out when a soft block (the "loot crate") is destroyed.
            if (!this.lowFx) {
              for (let d = 0; d < 1 + (Math.random() < 0.5 ? 1 : 0); d++) {
                const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
                const sp = 2.2 + Math.random() * 2;
                this.push({
                  x: bx + 0.5, y: by + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                  life: 0.8 + Math.random() * 0.4, max: 1.2, gravity: 9, drag: 0.99,
                  size: this.tile * 0.34, color: "#7bd66a", shape: "glyph", glyph: "$",
                  rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 10,
                });
              }
            }
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
    this.drawFloaters(now); // upbeat reward/event popups (ease-out-back / elastic)
    ctx.restore();

    if (!this.lowFx) this.drawAmbient(W, H); // warm key light + vignette for depth
    this.drawColorGrade(W, H); // cozy-warm early -> mortuary-cold by sudden death
    this.drawDangerVignette(W, H, now); // pulsing red threat vignette at low HP / sudden death
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
      if (p.id === myId) { this.selfX = rp.x; this.selfY = rp.y; this.selfKnown = p.alive; }

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

      // (Player shadow is drawn just after the colour glow below, so the glow
      // doesn't wash it out.)

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
        // Smaller, MORE SATURATED color pool (tighter falloff -> denser core).
        const glow = t * (isMe ? 0.5 : 0.42) * beat;
        const gy = cy + t * 0.22;
        const a = Math.min(1, (isMe ? 0.88 : 0.7) + boost * (isMe ? 0.12 : 0.1));
        const ah = Math.round(a * 255).toString(16).padStart(2, "0");
        const mh = Math.round(a * 0.6 * 255).toString(16).padStart(2, "0");
        const grad = ctx.createRadialGradient(cx, gy, 0, cx, gy, glow);
        grad.addColorStop(0, col + ah);
        grad.addColorStop(0.38, col + mh);
        grad.addColorStop(1, col + "00");
        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, gy, glow, 0, Math.PI * 2);
        ctx.fill();
        // Shadow on TOP of the glow so it reads as a real grounded shadow (the
        // colour pool no longer washes it out).
        this.drawShadow(cx, cy + t * 0.36, t * 0.3 * scale, t * 0.12 * scale, 0.36);
        ctx.globalAlpha = alpha;
      }

      // Kick up a little dust while moving (no more trampled-grass oval decals).
      if (!this.lowFx && moving && p.alive) {
        if (now - (this.lastDust.get(p.id) ?? 0) > 90) {
          this.lastDust.set(p.id, now);
          this.push({
            x: rp.x + 0.5 + (Math.random() - 0.5) * 0.3, y: rp.y + 0.85, vx: (Math.random() - 0.5) * 1.2, vy: -0.5 - Math.random() * 0.5,
            life: 0.3 + Math.random() * 0.2, max: 0.5, drag: 0.9, size: t * (0.04 + Math.random() * 0.04),
            color: Math.random() < 0.5 ? "rgba(150,170,90,0.7)" : "rgba(120,100,70,0.7)",
          });
        }
      }

      // Bloody footprints: step in a blood pool -> bloody feet, then smear a faint
      // footprint onto the next several cells you walk (tracks gore around).
      if (p.alive) {
        const ci = Math.floor(rp.y) * GRID_W + Math.floor(rp.x);
        const prevCi = this.lastCell.get(p.id);
        if (ci !== prevCi) {
          this.lastCell.set(p.id, ci);
          this.kickGibs(ci, rp.x, rp.y); // boot any bones/meat on this cell aside
          let mdx = 0, mdy = 0; // travel direction (from the previous cell)
          if (prevCi !== undefined) { mdx = (ci % GRID_W) - (prevCi % GRID_W); mdy = ((ci / GRID_W) | 0) - ((prevCi / GRID_W) | 0); }
          if ((this.bloodGround.get(ci) ?? 0) >= 3) this.bloodyFeet.set(p.id, 12); // stepped in a pool -> long bloody trail
          const feet = this.bloodyFeet.get(p.id) ?? 0;
          if (feet > 0 && (mdx || mdy)) {
            this.bloodyFeet.set(p.id, feet - 1);
            // First ~2 cells smear strongly, then fade over the trail.
            const a = feet >= 10 ? 0.85 : feet >= 7 ? 0.55 : feet >= 4 ? 0.34 : 0.2;
            let ux = mdx, uy = mdy; const mm = Math.hypot(ux, uy) || 1; ux /= mm; uy /= mm;
            // Anchor to the CENTRE of the cell just entered (path centerline), not the
            // player's continuous position (which sits on tile seams mid-step). Only a
            // small jitter inside the central zone + a tiny left/right foot alternation.
            const ccx = (ci % GRID_W) + 0.5, ccy = ((ci / GRID_W) | 0) + 0.5;
            const horiz = Math.abs(mdx) > Math.abs(mdy);
            const off = horiz ? ((feet & 1) === 0 ? -1 : 1) * 0.08 : 0;
            const jx = (Math.random() - 0.5) * 0.16, jy = (Math.random() - 0.5) * 0.16;
            this.footprints.push({ x: ccx + jx - uy * off, y: ccy + jy + ux * off, dx: ux, dy: uy, a, seed: (this.footprints.length * 2654435761) >>> 0 });
            if (this.footprints.length > 160) this.footprints.shift();
            // The smear IS the footprint streak above (its own layer) — it does NOT add
            // blood to the ground field. Tracking real blood onto every tile a player
            // crossed is exactly what carpeted the whole map; never do that again.
            this.bloodDirty = true;
          }
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

      ctx.globalAlpha = 1;
    }

    // Reaction emojis: a scattering burst over the board (drawn above players).
    this.drawEmotePops(ctx, t, now);

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
      const s = 1.2 + Math.random() * 2.4;
      this.push({
        x: gx + 0.5, y: gy + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        vz: 4 + Math.random() * 5, gz: 30, rest: 0.6, fric: 0.9, // crate debris: crunchy bouncy
        life: 0.5 + Math.random() * 0.4, max: 0.9,
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
      // One blast already leaves a clearly dark scorch; repeated blasts deepen it to
      // near-black charcoal (the epicentre, hit most, ends up darkest).
      const p = Math.min(1, 0.45 + lvl * 0.11); // 1 blast ~0.56, ~5 blasts -> 1.0
      const cover = 0.55 + p * 0.42; // fuller patch
      const a = 0.32 + p * 0.5; // clearly opaque
      const base = Math.round(16 - p * 11); // 16 (dark) -> 5 (near black)
      let h = (idx * 2654435761) >>> 0;
      for (let gy = 0; gy < t; gy += pu) {
        for (let gx = 0; gx < t; gx += pu) {
          h = (h ^ (h << 13)) >>> 0; h = (h ^ (h >>> 17)) >>> 0; h = (h ^ (h << 5)) >>> 0;
          if ((h & 1023) / 1023 > cover) continue;
          const d = base + (h & 7); // scorch shade for this stage + grain
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
        const pu = Math.max(1, Math.round(t / 20)); // finer blood pixels
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

  /** Center-screen FIRST BLOOD: chunky blood-written text + streaming pixel blood
   *  drips. Sits high, pops in, and clears quickly. */
  private drawFirstBlood(now: number): void {
    if (!this.fbCanvas || this.firstBloodAt === 0) return;
    const dur = 1800; // clears fast
    const k = (now - this.firstBloodAt) / dur;
    if (k >= 1) {
      this.firstBloodAt = 0;
      return;
    }
    const ctx = this.ctx;
    const W = this.tile * GRID_W;
    const H = this.tile * GRID_H;
    const cx = W / 2;
    const cy = H * 0.15; // up near the top, out of the play area
    const pop = Math.min(1, (now - this.firstBloodAt) / 60); // snappy pop-in (was feeling late)
    const fade = k > 0.72 ? (1 - k) / 0.28 : 1;
    const dw = W * 0.52 * (0.82 + 0.18 * pop); // smaller, so it doesn't block play
    const dh = (dw * this.fbCanvas.height) / this.fbCanvas.width;
    ctx.save();
    ctx.globalAlpha = fade;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false; // crisp pixel scaling
    ctx.drawImage(this.fbCanvas, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.imageSmoothingEnabled = smooth;
    // Blood streaming down from under the text (starts immediately, runs long).
    const pu = Math.max(3, Math.round(this.tile / 8));
    for (let i = 0; i < 40; i++) {
      const fx = cx + (((i * 37) % 100) / 100 - 0.5) * dw * 0.98;
      const delay = (i % 12) * 0.02;
      const dk = Math.max(0, k - delay);
      const dy = cy + dh * 0.4 + dk * dk * H * 0.85; // accelerating fall
      const h = pu * (2 + (i % 5)); // varied streak length
      ctx.fillStyle = i % 4 === 0 ? "#7a0000" : i % 4 === 1 ? "#b00000" : "#d40d0d";
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
      if (p.vz !== undefined) {
        // Pseudo-3D gore/debris: arc up, fall fast, bounce + stick on the ground.
        p.vz -= (p.gz ?? 26) * dt;
        p.z = (p.z ?? 0) + p.vz * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.z <= 0) {
          p.z = 0;
          if (Math.abs(p.vz) < 1.1) {
            p.vz = 0; p.vx *= 0.45; p.vy *= 0.45; // settle / friction-stick
          } else {
            p.vz = -p.vz * (p.rest ?? 0.4); // bounce
            p.vx *= (p.fric ?? 0.9); p.vy *= (p.fric ?? 0.9);
          }
        }
        const damp = Math.max(0, 1 - 3 * dt); // air resistance "chokes" the flight
        p.vx *= damp; p.vy *= damp;
      } else {
        if (p.gravity) p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const drag = p.drag ?? 0.92;
        p.vx *= drag;
        p.vy *= drag;
      }
      if (p.grow) p.size += p.grow * dt;
      if (p.spin) p.rot = (p.rot ?? 0) + p.spin * dt;

      const a = Math.max(0, p.life / p.max);
      const px = p.x * t;
      const py = (p.y - (p.z ?? 0)) * t; // height raises it on screen
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
        const hseed = (index * 2654435761) >>> 0;
        const variant = (hseed % 2) + 1;
        const flip = ((hseed >> 3) & 1) === 1; // mirror half the blocks -> 2x more looks
        const bm = this.bloodBlocks.get(index);
        // Bloodied: a BAKED blood-on-block sprite (blood sits in the block's
        // perspective). Else damage-stage sprite, else pristine + procedural cracks.
        const bloodDrawn = !!bm && !this.lowFx && this.drawTileSprite(`hard_blood${bm.n >= 2 ? 2 : 1}_v${variant}`, px, py, flip);
        if (!bloodDrawn) {
          if (!(dmg > 0 && this.drawTileSprite(`hard_dmg${dmg}_v${variant}`, px, py, flip))) {
            this.drawTileSprite("hard", px, py) || this.drawHard(px, py);
            if (dmg > 0) this.drawCracks(px, py, index);
          }
        }
        if (bm) this.drawBlockBlood(px, py, index); // refined dynamic gore ON TOP of the block
        if (!this.lowFx && this.lights.length) this.lightCatch(px, py, now);
        break;
      }
      case TileType.SOFT: {
        this.drawShadow(px + t / 2, py + t * 0.95, t * 0.4, t * 0.1, 0.26);
        const sseed = (index * 2654435761) >>> 0;
        const svar = (sseed % 2) + 1;
        const sm = this.bloodBlocks.get(index);
        const sBloodDrawn = !!sm && !this.lowFx && this.drawTileSprite(`soft_blood${sm.n >= 2 ? 2 : 1}_v${svar}`, px, py);
        if (!sBloodDrawn) {
          ((this.lowFx && this.drawTileSprite("soft_mobile", px, py)) ||
            this.drawTileSprite("soft", px, py) ||
            this.drawSoft(px, py));
        }
        if (sm) this.drawBlockBlood(px, py, index); // refined dynamic gore ON TOP of the block
        if (!this.lowFx && this.lights.length) this.lightCatch(px, py, now);
        break;
      }
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
      const rad = t * (0.6 + 0.12 * pulse);
      const g = ctx.createRadialGradient(cx, cy + bob, 0, cx, cy + bob, rad);
      g.addColorStop(0, `rgba(${gr},${gg},${gb},${0.62 * pulse})`); // a tidy halo, not a square wash
      g.addColorStop(0.5, `rgba(${gr},${gg},${gb},${0.22 * pulse})`);
      g.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const img = key ? this.sprite(key) : null;
      if (img) {
        // Render icon + specular + diagonal metallic sheen into a buffer, then mask
        // it all to the icon's alpha (destination-in) so the shine sits STRICTLY on
        // the icon shape — never washing over the empty tile.
        const buf = this.puBuf ?? (this.puBuf = document.createElement("canvas"));
        if (buf.width !== t || buf.height !== t) { buf.width = t; buf.height = t; }
        const bg = buf.getContext("2d");
        if (bg) {
          bg.globalCompositeOperation = "source-over";
          bg.clearRect(0, 0, t, t);
          bg.drawImage(img, 0, 0, t, t);
          bg.globalCompositeOperation = "lighter"; // additive shine over the icon
          // glossy specular
          const hg = bg.createRadialGradient(t * 0.35, t * 0.3, 0, t * 0.35, t * 0.3, t * 0.2);
          hg.addColorStop(0, `rgba(255,255,255,${0.16 * pulse})`); // gentle wet glint, not a blowout
          hg.addColorStop(1, "rgba(255,255,255,0)");
          bg.fillStyle = hg; bg.fillRect(0, 0, t, t);
          // diagonal metallic sheen — fast back-and-forth (ping-pong), a soft glint, NARROW.
          const sweep = 0.5 + 0.5 * Math.sin(now / 600 + (x * 0.27 + y * 0.19) * 6);
          const sxc = -t * 0.4 + sweep * (t * 1.8); // tighter travel range
          const bw = t * 0.11; // narrow band
          const sg = bg.createLinearGradient(sxc - bw, 0, sxc + bw, t);
          sg.addColorStop(0, "rgba(255,255,255,0)");
          sg.addColorStop(0.5, "rgba(255,255,255,0.3)"); // dimmer -> shine, doesn't wash the icon white
          sg.addColorStop(1, "rgba(255,255,255,0)");
          bg.fillStyle = sg; bg.fillRect(0, 0, t, t);
          bg.globalCompositeOperation = "destination-in"; // clip the shine to the icon shape
          bg.drawImage(img, 0, 0, t, t);
          bg.globalCompositeOperation = "source-over";
          ctx.drawImage(buf, px, py + bob);
        } else {
          ctx.drawImage(img, px, py + bob, t, t);
        }
      } else if (icon) {
        ctx.font = `${Math.floor(t * 0.6)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(icon, cx, cy + bob + 1);
      }
    }
  }

  private drawTileSprite(key: string, px: number, py: number, flip = false): boolean {
    const img = this.sprite(key); // pre-scaled to tile size -> 1:1 blit
    if (!img) return false;
    const t = this.tile;
    if (flip) { // mirror horizontally (cheap per-block variety)
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(px + t, py);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, t, t);
      ctx.restore();
    } else {
      this.ctx.drawImage(img, px, py, t, t);
    }
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
    // Natural palette, picked PER BLADE for subtle variety. Dropped the bright
    // shades, added a couple of DARKER greens so it reads calm/earthy.
    const greens = ["#4b8a30", "#427a2b", "#43802c", "#356626", "#5a9c3a", "#3a6f24", "#2e5a1d", "#4d8731"];
    const wind = Math.sin(now / 620 + x * 0.55 + y * 0.3);
    // Density in PATCHES: a coarse field (shared across ~2x2 tile blocks) makes lush
    // and sparse CLUSTERS rather than per-tile salt-and-pepper. + a little jitter.
    let pn = (((x >> 1) * 73856093) ^ ((y >> 1) * 19349663)) >>> 0;
    pn = ((pn ^ (pn >>> 13)) * 1274126177) >>> 0;
    const patch = (pn & 1023) / 1023;
    const dens = Math.max(0.12, Math.min(1, patch * 0.85 + rnd() * 0.3 - 0.08));
    const body = Math.round(10 + dens * 22); // ~10 (sparse) .. 32 (lush)
    for (let i = 0; i < body; i++) {
      const bx = px + Math.floor(rnd() * (t - pu));
      const by = py + Math.floor(rnd() * (t - pu * 3));
      const hgt = pu * (2 + Math.floor(rnd() * 4)); // varied height 2..5
      const sway = Math.round(wind * pu * (0.6 + rnd() * 0.8));
      ctx.fillStyle = greens[(rnd() * greens.length) | 0];
      ctx.fillRect(bx, by, pu, hgt); // stalk
      ctx.fillRect(bx + sway, by - pu, pu, pu); // swaying tip
    }
    // A few tall front blades whose tips poke ABOVE the tile (drawn after blocks,
    // so they overlap onto the block above → depth/3D).
    const front = Math.round(2 + dens * 5);
    for (let i = 0; i < front; i++) {
      const bx = px + Math.floor(rnd() * (t - pu));
      const top = py - pu * (1 + Math.floor(rnd() * 3));
      const sway = Math.round(wind * pu * 1.3);
      ctx.fillStyle = greens[(rnd() * greens.length) | 0];
      ctx.fillRect(bx + sway, top, pu, pu * 3);
    }
    // Rare wildflower — a tiny 4-petal splash of colour on the odd tile.
    if (rnd() < 0.06) {
      const fcols = ["#f2f2f2", "#ffe14a", "#ff7ab0", "#b58cff", "#ff6a6a"];
      const fc = fcols[(rnd() * fcols.length) | 0];
      const fx = px + pu + Math.floor(rnd() * (t - pu * 3));
      const fy = py + pu + Math.floor(rnd() * (t - pu * 3));
      ctx.fillStyle = fc;
      ctx.fillRect(fx - pu, fy, pu, pu); ctx.fillRect(fx + pu, fy, pu, pu);
      ctx.fillRect(fx, fy - pu, pu, pu); ctx.fillRect(fx, fy + pu, pu, pu);
      ctx.fillStyle = "#ffd24a"; // sunny centre
      ctx.fillRect(fx, fy, pu, pu);
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
