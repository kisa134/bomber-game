import { GRID_W, GRID_H, TileType, BOMB_TIMER_MS, EXPLOSION_LIFETIME_MS, START_LIVES } from "../net/protocol.js";
import type { RenderView } from "./state.js";
import type { Assets } from "./assets.js";
import { ASSET_VER } from "./assets.js";
import type { ArenaTheme } from "../settings.js";

// Arena block skins: each themed set maps the base hard/soft/floor sprite to a
// themed material variant. "classic" is absent here (it uses the base sprites).
const ARENA_THEMES: Record<Exclude<ArenaTheme, "classic">, { hard: string; soft: string; floor: string }> = {
  vault: { hard: "hard_gold", soft: "soft_ammo", floor: "floor_grate" },
  cyber: { hard: "hard_stone", soft: "soft_cyberglass", floor: "floor_neon" }, // soft = flat glass (coherent dark-blue)
  void: { hard: "hard_obsidian", soft: "soft_void2", floor: "floor_void" }, // pink crystal only (scatter disabled)
  desert: { hard: "hard_sand", soft: "soft_sand", floor: "floor_sand" },
  industrial: { hard: "hard_industrial", soft: "soft_industrial", floor: "floor_industrial" }, // yellow-black factory
  chappie: { hard: "hard_chappie", soft: "soft_chappie2", floor: "floor_chappie" }, // white-orange near-future
  meme: { hard: "hard_meme", soft: "soft_meme2", floor: "floor_meme" }, // broadcast studio (crypto crate freed for a new theme)
  degen: { hard: "hard_degen", soft: "soft_degen", floor: "floor_degen" }, // graffiti street (crypto crate freed for a new theme)
  pepe: { hard: "hard_pepe", soft: "soft_pepe", floor: "floor_pepe" }, // cosy swamp Pepe world
};

// Light per-arena AMBIENT atmosphere — slow drifting motes for cozy immersion.
// color = "r,g,b"; vx/vy = px/sec drift; sq = square (data-bit) vs soft dot; n = density.
const ATMOSPHERE: Record<ArenaTheme, { color: string; vx: number; vy: number; n: number; sq: boolean; size: number }> = {
  classic: { color: "255,236,140", vx: 6, vy: -10, n: 16, sq: false, size: 2.2 }, // warm pollen / fireflies
  vault: { color: "255,210,90", vx: 4, vy: -8, n: 18, sq: false, size: 2.0 }, // floating gold dust
  cyber: { color: "90,230,255", vx: 0, vy: -16, n: 22, sq: true, size: 2.0 }, // rising neon data-bits
  void: { color: "176,124,255", vx: 3, vy: -9, n: 18, sq: false, size: 2.4 }, // purple embers
  desert: { color: "228,198,138", vx: 26, vy: 3, n: 22, sq: false, size: 1.8 }, // sand drifting on the wind
  industrial: { color: "255,168,60", vx: 5, vy: -12, n: 16, sq: true, size: 1.8 }, // warm orange sparks
  chappie: { color: "255,210,150", vx: 4, vy: -7, n: 14, sq: false, size: 2.0 }, // soft warm motes
  meme: { color: "100,255,150", vx: 0, vy: -13, n: 20, sq: true, size: 1.8 }, // green candle-ticks rising
  degen: { color: "210,200,180", vx: 14, vy: -4, n: 14, sq: false, size: 1.8 }, // street dust drifting
  pepe: { color: "150,235,120", vx: 7, vy: -6, n: 16, sq: false, size: 2.0 }, // drifting swamp spores
};

// "Living" hard blocks — themes whose hard block has a glowing window that BREATHES
// (a pulsing inner light rendered over the asset). theme -> "r,g,b".
const ARENA_GLOW: Partial<Record<ArenaTheme, string>> = {
  chappie: "255,150,40",
  industrial: "255,140,30",
  meme: "120,230,255", // the LED broadcast screen breathes
};

// Per-arena KEY-LIGHT mood: the colour of the single overhead light + the colour the
// vignette tints the edges toward. Gives every arena a distinct atmosphere instead of
// the same warm sun everywhere. "r,g,b". (Day/night cycle modulates these at runtime.)
const ARENA_LIGHT: Record<ArenaTheme, { key: string; vig: string }> = {
  classic: { key: "255,196,120", vig: "18,10,4" }, // warm afternoon sun
  vault: { key: "255,206,110", vig: "20,14,2" }, // gold vault glow
  cyber: { key: "120,210,255", vig: "4,8,22" }, // cold neon city
  void: { key: "182,132,255", vig: "10,4,22" }, // purple void
  desert: { key: "255,224,150", vig: "26,18,6" }, // harsh white-gold sun
  industrial: { key: "255,168,80", vig: "16,8,2" }, // furnace orange
  chappie: { key: "255,200,150", vig: "14,10,6" }, // warm interior
  meme: { key: "120,235,170", vig: "4,16,8" }, // green broadcast room
  degen: { key: "232,212,170", vig: "14,12,8" }, // sodium streetlight
  pepe: { key: "150,230,130", vig: "6,14,6" }, // swamp green
};

// Per-arena THEATRICAL light scenario: a few accent light sources that compose with the
// day/night cycle. Each gives the arena a signature mood and most INTENSIFY at night
// (`night` boost) — e.g. industrial furnace lamps glow up after dark like a real plant.
// x,y = fraction of the viewport; r = reach (fraction of the diagonal); a = base alpha;
// night = extra-multiplier at full dark; flick = 0..1 flicker depth; spd = flicker period ms.
type SceneLight = { x: number; y: number; r: number; col: string; a: number; night: number; flick: number; spd: number };
const ARENA_SCENE: Partial<Record<ArenaTheme, SceneLight[]>> = {
  industrial: [
    { x: 0.1, y: 0.18, r: 0.5, col: "255,140,40", a: 0.10, night: 1.9, flick: 0.28, spd: 140 }, // furnace lamp L
    { x: 0.9, y: 0.24, r: 0.5, col: "255,116,28", a: 0.10, night: 1.9, flick: 0.34, spd: 175 }, // furnace lamp R
  ],
  cyber: [
    { x: 0.5, y: -0.02, r: 0.9, col: "80,200,255", a: 0.07, night: 1.5, flick: 0.1, spd: 95 }, // top neon wash
    { x: 0.18, y: 0.92, r: 0.46, col: "255,60,200", a: 0.06, night: 1.7, flick: 0.16, spd: 125 }, // pink underglow
  ],
  void: [
    { x: 0.5, y: 0.5, r: 0.82, col: "150,80,255", a: 0.06, night: 1.6, flick: 0.22, spd: 210 }, // central rift pulse
  ],
  vault: [
    { x: 0.5, y: 0.08, r: 0.72, col: "255,200,90", a: 0.08, night: 1.3, flick: 0.06, spd: 300 }, // gold chandelier
  ],
  meme: [
    { x: 0.5, y: 0.06, r: 0.82, col: "120,230,255", a: 0.08, night: 1.7, flick: 0.05, spd: 80 }, // studio LED ring
  ],
  desert: [
    { x: 0.86, y: 0.86, r: 0.3, col: "255,150,60", a: 0.05, night: 2.4, flick: 0.42, spd: 95 }, // distant fire (shows at night)
  ],
  chappie: [
    { x: 0.14, y: 0.14, r: 0.42, col: "255,150,40", a: 0.08, night: 1.7, flick: 0.22, spd: 130 }, // warm work lamp
  ],
  degen: [
    { x: 0.5, y: 0.04, r: 0.6, col: "255,200,120", a: 0.06, night: 1.6, flick: 0.12, spd: 110 }, // sodium streetlight
  ],
  pepe: [
    { x: 0.32, y: 0.7, r: 0.5, col: "120,220,90", a: 0.06, night: 1.5, flick: 0.2, spd: 165 }, // swamp glow
  ],
};

// Per-arena FLOOR physics: how each surface chars under blasts. `char` = the deep-burn
// RGB (its hue — grass burns warm brown, metal soots cool grey, sand fuses tan, void goes
// purple-black); `max` = how fully it can blacken (sand/swamp never go pure black).
const FLOOR_PHYSICS: Record<ArenaTheme, { char: [number, number, number]; max: number }> = {
  classic: { char: [26, 18, 9], max: 1.0 }, // grass -> charred warm brown-black
  vault: { char: [22, 20, 18], max: 0.92 }, // marble soot grey
  cyber: { char: [16, 18, 24], max: 0.95 }, // metal grate scorches cool grey-blue
  void: { char: [16, 8, 24], max: 1.0 }, // void purple-black
  desert: { char: [46, 33, 18], max: 0.66 }, // sand fuses + darkens, never fully black
  industrial: { char: [17, 15, 15], max: 1.0 }, // sooty metal black
  chappie: { char: [24, 18, 12], max: 0.9 }, // warm interior floor
  meme: { char: [20, 15, 18], max: 0.95 }, // studio floor
  degen: { char: [16, 16, 17], max: 1.0 }, // asphalt char
  pepe: { char: [12, 20, 12], max: 0.84 }, // swamp green-black
};

// Themes whose SOFT block is scattered RANDOMLY from a set of variants (per block seed)
// — e.g. Void's glowing crystals in different colours for a beautiful random field.
const ARENA_SOFT_VARIANTS: Partial<Record<ArenaTheme, string[]>> = {
  // void scatter disabled for now — single pink crystal (soft_void2). Re-add the
  // ["soft_void1".."soft_void4"] list here to restore the random combo field.
};

// Per-theme SHATTER debris — what flies out when a soft block breaks / a hard block
// cracks, so a crate sprays wood, a crystal sprays glowing shards, a bush sprays
// leaves, gold sprays metal, etc. colors = chunk palette; emissive = bright/additive
// (glowing crystal shards that catch the bloom).
const THEME_DEBRIS: Record<ArenaTheme, { colors: string[]; emissive?: boolean }> = {
  classic: { colors: ["#8a5a3c", "#a06b48", "#6e4a30", "#b5743f"] }, // wood crate
  vault: { colors: ["#ffd24a", "#c8941e", "#a0701a", "#e6b53c"] }, // gold/brass
  cyber: { colors: ["#5bd6ff", "#3a8acc", "#2a5a8a", "#7ae0ff"], emissive: true }, // glass shard
  void: { colors: ["#ff5bd0", "#b86bff", "#5be0ff", "#c060ff"], emissive: true }, // crystal shard
  desert: { colors: ["#d8b878", "#b89858", "#8a6e40", "#e6ca90"] }, // sandstone
  industrial: { colors: ["#9aa0a8", "#5e6068", "#ff8a30", "#c0c4cc"] }, // metal + spark
  chappie: { colors: ["#ff8a30", "#e6e6e6", "#c8741e", "#ffb060"] }, // orange-white plastic/metal
  meme: { colors: ["#64ff96", "#3a3a44", "#50e0c0", "#a0a0aa"] }, // screen/electronics
  degen: { colors: ["#4a8a3a", "#2e5e24", "#6e4a30", "#5e9a44"] }, // leaves + twig
  pepe: { colors: ["#4a7a3a", "#6e9a4a", "#3a5a2a", "#5e8a3a"] }, // green wood
};

// One unique colour per player slot — supports a full 8-player arena (1 human +
// up to 7 bots) with no duplicates. Index is assigned in the lobby, independent
// of the chosen skin. Ordered for max contrast between the first few entries.
export const PLAYER_COLORS = [
  "#ff5555", // red
  "#4aa3ff", // blue
  "#5fd96a", // green
  "#ffcc33", // yellow
  "#c879ff", // purple
  "#ff8a3d", // orange
  "#33e0d6", // cyan
  "#ff6fae", // pink
];
// Human-readable names for each colour slot (same order as PLAYER_COLORS), so a
// player can be told "you're the Red bomber" in the lobby before the match.
export const COLOR_NAMES = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Cyan", "Pink"];
export const SKIN_EMOJI = ["🐕", "🐸", "🦊", "😐", "🐶", "🥚", "🕶", "🦄", "🧌", "📞", "💪"];

/** DOM avatar showing the character sprite (emoji fallback), with an optional
 *  colored ring. Shared by the skin picker, room list and HUD. */
export function skinAvatar(skin: number, color?: string): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "avatar";
  if (color) wrap.style.boxShadow = `inset 0 0 0 2px ${color}`;
  const img = document.createElement("img");
  // Use the current frontal animation frame (skin_N.webp portraits were stale for
  // some skins) so avatars always match the live character.
  img.src = `/sprites/skin_${skin}_down_1.webp?v=${ASSET_VER}`;
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
  // Optional pseudo-3D height physics (gore/debris): arc up via vz, bounce on the
  // ground (z=0) with restitution, friction-stick on landing. Screen Y is raised by z.
  z?: number; // height above ground (cells)
  vz?: number; // vertical velocity (cells/s) — presence enables the height physics
  gz?: number; // z-gravity (cells/s^2)
  rest?: number; // restitution on bounce (gore ~0.15, debris ~0.6)
  fric?: number; // horizontal friction multiplier applied on each ground contact
  solid?: boolean; // gore/debris: bounce off the sides of hard/unbroken-soft blocks (near the ground)
  gore?: { kind: GoreKind; seed: number }; // a FLYING gore piece -> renders via its draw fn, becomes a decal on landing
}

type GoreKind = "bone" | "meat" | "organ" | "skull" | "brain" | "limb" | "eye" | "tooth" | "coin";
// Per-kind flight feel: soft/liquid (organ/brain) barely fly + stick; hard/light (bone/tooth/
// eye) fly far + bounce. vz=launch height, sp=ground speed, gz=fall, rest=bounce, fric=slide.
const GORE_PHYS: Record<GoreKind, { vz: number; vzv: number; sp: number; spv: number; gz: number; rest: number; fric: number }> = {
  bone: { vz: 6, vzv: 4, sp: 2.5, spv: 2.6, gz: 30, rest: 0.5, fric: 0.86 },
  tooth: { vz: 6.5, vzv: 5, sp: 3, spv: 3.2, gz: 28, rest: 0.55, fric: 0.88 },
  meat: { vz: 4, vzv: 4, sp: 2, spv: 2.4, gz: 34, rest: 0.2, fric: 0.82 },
  skull: { vz: 4, vzv: 2.5, sp: 1.6, spv: 1.8, gz: 32, rest: 0.3, fric: 0.8 },
  limb: { vz: 3.6, vzv: 3, sp: 2, spv: 2.2, gz: 33, rest: 0.24, fric: 0.82 },
  organ: { vz: 2.6, vzv: 2, sp: 1, spv: 1.4, gz: 37, rest: 0.1, fric: 0.68 },
  brain: { vz: 2.6, vzv: 2, sp: 1, spv: 1.3, gz: 37, rest: 0.1, fric: 0.68 },
  eye: { vz: 4.5, vzv: 4, sp: 2.5, spv: 3, gz: 30, rest: 0.45, fric: 0.9 },
  coin: { vz: 6, vzv: 4, sp: 2.5, spv: 2.8, gz: 26, rest: 0.62, fric: 0.92 }, // light, bouncy, rolls (gore OFF mode)
};

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
  private arenaTheme: ArenaTheme = "classic"; // block/floor material set (Settings → Arena)
  private atmo: Array<{ x: number; y: number; vx: number; vy: number; s: number }> = []; // ambient motes
  private atmoOn = true; // Settings → Graphics: ambient atmosphere on/off
  private grassTexture = false; // Classic floor: false = animated procedural grass, true = static texture
  private blockDepth = true; // Settings → Graphics: 3D edge shading on blocks
  private dynLight = false; // Settings → Graphics: single slow-moving arena key light
  private battleScars = true; // Settings → Graphics: blast-side charring on hard blocks
  private todMode: "day" | "dusk" | "night" | "auto" = "day"; // Settings → Graphics: time-of-day mood
  private tod = 1; // smoothed brightness factor 1=day .. 0=deep night (eased toward target)
  private tension = 0; // 0..1 end-of-match "light pressure" swell (sudden death), eased
  private tensionTarget = 0;
  private bloomOn = false; // Settings → Graphics: soft bloom on bright areas
  private bloomCv: HTMLCanvasElement | null = null; // offscreen for the bloom blur pass
  private shadowsOn = true; // Settings → Graphics: directional cast shadows from the key light
  private lx = 0; // key-light screen position this frame (drives face shading + shadow direction)
  private ly = 0;
  private fxScale = 1; // effective particle-count multiplier = device base × user density
  private fxBase = 1; // device base (0.5 on phones, 1 on desktop)
  private fxUser = 1; // Settings → Graphics: user particle-density slider (0.5..2.5)
  private maxParticles = MAX_PARTICLES;
  // The grass floor is static, so render it once into an offscreen canvas and
  // blit it each frame instead of redrawing ~10k blades per frame.
  private floor: HTMLCanvasElement | null = null;
  private floorSpriteBaked = false; // true once the floor cache used the sprite

  /** Maps a player id to a skin index. Overridden by main. */
  skinOf: (id: number) => number = (id) => id % PLAYER_COLORS.length;
  /** Maps a player id to its unique in-match colour index (assigned in the
   *  lobby, not skin-tied). Overridden by main; falls back to id-derived. */
  colorOf: (id: number) => number = (id) => id % PLAYER_COLORS.length;

  private fireStart = new Map<number, number>();
  private lastPos = new Map<number, { x: number; y: number }>();
  private facing = new Map<number, "down" | "up" | "left" | "right">();
  private deadAt = new Map<number, number>();
  // Reaction emojis burst out of the player's cell and scatter (spammable).
  private emotePops: Array<{ x0: number; y0: number; vx: number; vy: number; e: string; born: number }> = [];
  private placeBombUntil = new Map<number, number>(); // transient place-bomb pose
  private bombSeen = new Map<string, number>(); // bomb cell key -> first-seen time (drop-anim t0)
  private bombLanded = new Set<string>(); // bomb cells whose landing puff already fired
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
  private hardDmgSide = new Map<number, number>(); // cell index -> blast-hit side bitmask (1=L 2=R 4=up 8=down)
  // Blood splattered on a block: which faces were hit (N/S/E/W bitmask), a stable
  // seed for the pattern, and an intensity count. Top face = splatter, front = drips.
  private bloodBlocks = new Map<number, { dirs: number; seed: number; n: number; born: number; nextDrip: number }>();
  // Persistent blood on the ground (death-cell mush + smeared footprints). cell -> intensity.
  private bloodGround = new Map<number, number>();
  private puBuf: HTMLCanvasElement | null = null; // scratch buffer for powerup sheen masked to the icon
  private bloodCanvas: HTMLCanvasElement | null = null; // cached dense blood-ground overlay
  private bloodDirty = false;
  private bakedBlood = new Map<number, number>(); // blood cell -> bake level (1 crust .. 3 charcoal)
  private chips: Array<{ x: number; y: number; seed: number }> = []; // wood splinters from broken crates (x,y in cells)
  private bloodyFeet = new Map<number, number>(); // player id -> bloody steps left (tracks blood around)
  private playerGore = new Map<number, { blood: number; burn: number }>(); // per player: persistent 0..1 leg-blood + body-char
  private skinTint: HTMLCanvasElement | null = null; // reused offscreen for masking blood/burn to the sprite silhouette
  private lastSmoke = new Map<number, number>(); // player id -> last char-smoke emit time
  private lastCell = new Map<number, number>(); // player id -> last grid cell (footprint stepping)
  // Foot-shaped blood prints left while walking with bloody feet (x,y in cells; dx,dy = facing).
  private footprints: Array<{ x: number; y: number; dx: number; dy: number; a: number; seed: number }> = [];
  private bones: Array<{ x: number; y: number; seed: number }> = []; // scattered bone-shard decals (x,y in cells)
  private meat: Array<{ x: number; y: number; seed: number }> = []; // scattered flesh-chunk decals (x,y in cells)
  private organs: Array<{ x: number; y: number; seed: number }> = []; // intestine coils / organ decals (x,y in cells)
  private skulls: Array<{ x: number; y: number; seed: number }> = []; // skull decals (x,y in cells)
  private brains: Array<{ x: number; y: number; seed: number }> = []; // brain decals (x,y in cells)
  private limbs: Array<{ x: number; y: number; seed: number }> = []; // torn arm/leg decals
  private eyes: Array<{ x: number; y: number; seed: number }> = []; // eyeball decals
  private teeth: Array<{ x: number; y: number; seed: number }> = []; // knocked-out teeth
  private bile: Array<{ x: number; y: number; seed: number }> = []; // bile / slime puddles
  private coins: Array<{ x: number; y: number; seed: number }> = []; // GORE-OFF mode: gold coins instead of gore
  private goreEnabled = true; // false -> deaths spill kickable coins instead of blood/guts
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
  private hitStopStart = -1e9; // micro-slowmo on kills: scales dt toward hitStopFloor for hitStopDur
  private hitStopDur = 0;
  private hitStopFloor = 1;
  private danger = 0; // 0..1 threat level -> pulsing red edge vignette (low HP / sudden death)
  private selfX = 0; private selfY = 0; private selfKnown = false; // local player pos (for distance shake)
  private lastClatter = 0; // throttle for bone/chip clatter sfx
  private smolderAt = 0; // last smoldering-skull smoke wisp tick
  private lastSplat = 0; // last wet organ-splat sound (throttle)
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
    this.fxBase = mobile ? 0.5 : 1;
    this.fxScale = this.fxBase * this.fxUser;
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
    // desktop keep the richer procedural grass. A non-classic arena theme forces
    // its themed floor sprite everywhere (so the theme reads on desktop too).
    const themed = this.arenaTheme !== "classic";
    // Classic floor: animated procedural grass (default) OR a static grass texture
    // (Settings → Classic floor). Themed arenas always use their own floor sprite.
    const floorImg = themed
      ? this.assets?.img(this.blockKey("floor"))
      : this.grassTexture
        ? this.assets?.img("floor_grass")
        : this.lowFx
          ? this.assets?.img("floor")
          : null;
    this.floorSpriteBaked = !!floorImg;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (floorImg) g.drawImage(floorImg, x * t, y * t, t, t);
        // Grass is CLASSIC-only. On a theme whose floor sprite failed to load, fall
        // back to a flat dark tile (never grass) so the theme never leaks blades.
        else if (themed) { g.fillStyle = "#14121a"; g.fillRect(x * t, y * t, t, t); }
        else this.drawBaseGround(g, x * t, y * t, x, y); // classic desktop: blades drawn live
      }
    }
    this.prescale();
    this.buildAtmosphere(W, H);
  }

  /** Seed the per-arena ambient motes across the board (rebuilt on resize/theme). */
  private buildAtmosphere(W: number, H: number): void {
    this.atmo.length = 0;
    if (W <= 0 || H <= 0) return;
    const cfg = ATMOSPHERE[this.arenaTheme];
    const n = Math.round(cfg.n * this.fxScale);
    for (let i = 0; i < n; i++) {
      this.atmo.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: cfg.vx * (0.6 + Math.random() * 0.8),
        vy: cfg.vy * (0.6 + Math.random() * 0.8),
        s: cfg.size * (0.7 + Math.random() * 0.8),
      });
    }
  }

  /** Toggle ambient atmosphere (Settings → Graphics). */
  setAtmosphere(on: boolean): void { this.atmoOn = on; }
  setBlockDepth(on: boolean): void { this.blockDepth = on; }
  setDynamicLight(on: boolean): void { this.dynLight = on; }
  setTimeOfDay(mode: "day" | "dusk" | "night" | "auto"): void { this.todMode = mode; }
  /** End-game "light pressure": 0..1, swells in softly (Nolan-style build, never a bang). */
  setTension(v: number): void { this.tensionTarget = Math.max(0, Math.min(1, v)); }
  setBattleScars(on: boolean): void { this.battleScars = on; }
  setBloom(on: boolean): void { this.bloomOn = on; }
  setShadows(on: boolean): void { this.shadowsOn = on; }
  /** Particle density multiplier (Settings → Graphics). Powerful PCs can crank it up. */
  setParticleDensity(mult: number): void { this.fxUser = mult; this.fxScale = this.fxBase * mult; }

  /** Classic floor style: false = animated procedural grass, true = static texture. */
  setGrassTexture(on: boolean): void {
    if (on === this.grassTexture) return;
    this.grassTexture = on;
    this.buildFloor();
  }

  /** Draw + drift the ambient motes (cozy immersion). Wraps at the board edges. */
  private drawAtmosphere(W: number, H: number, now: number, dt: number): void {
    if (!this.atmoOn || !this.atmo.length) return;
    const cfg = ATMOSPHERE[this.arenaTheme];
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of this.atmo) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x < -4) m.x = W + 4; else if (m.x > W + 4) m.x = -4;
      if (m.y < -4) m.y = H + 4; else if (m.y > H + 4) m.y = -4;
      const a = 0.18 + 0.12 * Math.sin(now / 600 + m.x + m.y); // gentle twinkle
      ctx.fillStyle = `rgba(${cfg.color},${a})`;
      if (cfg.sq) ctx.fillRect(m.x, m.y, m.s * 1.6, m.s * 1.6);
      else { ctx.beginPath(); ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
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
    // arena-theme block variants (prescaled so a theme switch is instant)
    "hard_gold", "hard_stone", "hard_obsidian", "hard_sand", "soft_ammo", "soft_tech", "soft_meme", "soft_sand",
    "soft_cyberglass", "soft_void1", "soft_void2", "soft_void3", "soft_void4", "hard_industrial", "soft_industrial", "hard_chappie", "soft_chappie2", "hard_meme", "soft_meme2", "hard_degen", "soft_degen",
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

  /** Map a base block key to the active arena theme's variant (or itself). */
  private blockKey(base: "hard" | "soft" | "floor"): string {
    const set = ARENA_THEMES[this.arenaTheme as Exclude<ArenaTheme, "classic">];
    return set ? set[base] : base;
  }

  /** Pre-scaled tile sprite for `key` (1:1 blit), or the raw image, or null.
   *  hard/soft resolve through the active arena theme (falls back to the base
   *  sprite if a themed variant is missing). */
  private sprite(key: string): CanvasImageSource | null {
    const k = key === "hard" || key === "soft" ? this.blockKey(key) : key;
    return this.scaled.get(k) ?? this.assets?.img(k) ?? this.scaled.get(key) ?? this.assets?.img(key) ?? null;
  }

  /** Switch the arena block/floor material set and rebake (instant once loaded). */
  setArenaTheme(t: ArenaTheme): void {
    if (t === this.arenaTheme) return;
    this.arenaTheme = t;
    this.buildFloor(); // re-bakes the floor + re-prescales themed blocks (no-op pre-resize)
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
    this.bombSeen.clear();
    this.bombLanded.clear();
    this.hurtUntil.clear();
    this.victorId = -1;
    this.burn.clear();
    this.hardDmg.clear();
    this.hardDmgSide.clear();
    this.bloodBlocks.clear();
    this.bloodGround.clear();
    this.bakedBlood.clear();
    this.bloodCanvas = null;
    this.bloodDirty = false;
    this.bloodyFeet.clear();
    this.playerGore.clear();
    this.lastCell.clear();
    this.footprints = [];
    this.bones = [];
    this.meat = [];
    this.organs = [];
    this.skulls = [];
    this.brains = [];
    this.limbs = [];
    this.eyes = [];
    this.teeth = [];
    this.bile = [];
    this.coins = [];
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
    // Taking a blast chars the body (and adds a little blood) — accumulates, persists.
    const g = this.playerGore.get(playerId) ?? { blood: 0, burn: 0 };
    g.burn = Math.min(1, g.burn + 0.28);
    g.blood = Math.min(1, g.blood + 0.1);
    this.playerGore.set(playerId, g);
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

  /** Micro-slowmo on impact: dt is scaled toward `floor` (0 = full freeze-frame) for
   *  `durMs`, held for 60% then a k² snap back to 1. Restarts on a stronger (lower floor)
   *  or expired hit. Camera shake / decal timers read performance.now() directly, so they
   *  ring out in REAL time over the frozen gibs — that contrast is the "тук" of the kill. */
  hitStop(durMs: number, floor: number): void {
    const now = performance.now();
    if (now >= this.hitStopStart + this.hitStopDur || floor <= this.hitStopFloor) {
      this.hitStopStart = now;
      this.hitStopDur = durMs;
      this.hitStopFloor = floor;
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
    // GRADIENT CRATER: burn/char deepen from the blast epicentre (centroid) out, scaled by
    // power. Centre = darkest/most charred, edges = light scorch. Repeated blasts deepen.
    let ecx = 0, ecy = 0;
    for (const c of cells) { ecx += c.x; ecy += c.y; }
    ecx /= cells.length; ecy /= cells.length;
    const power = Math.min(1, cells.length / 13);
    const reach = 1.2 + power * 2.6;
    for (const c of cells) {
      const idx = c.y * GRID_W + c.x;
      const d = Math.hypot(c.x - ecx, c.y - ecy);
      const prox = Math.max(0, 1 - d / reach); // 1 at centre .. 0 at the rim
      const proxC = prox * prox; // SQUARED -> dramatic centre-dark / edge-faint gradient
      // GRADUAL scorch: one blast only lightly darkens; the centre builds far faster than the
      // rim, so repeated blasts on one spot deepen it to black (centre first).
      const add = (1.4 + 1.4 * power) * proxC; // ~3 blasts on one spot -> full-black scorch at the centre
      this.burn.set(idx, Math.min(8, (this.burn.get(idx) ?? 0) + add));
      this.scorchDirty = true;
      // A blast BURNS blood to charcoal — by the SAME falloff (centre = full char, edge partial).
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
          this.bloodGround.set(idx, Math.max(this.bloodGround.get(idx) ?? 0, 6)); // solid patch to char
          // SLOW GRADUAL bake over 6 stages: each blast ADVANCES the char (it doesn't jump to
          // full). Centre advances ~2.5x faster than the rim -> a smooth gradient from the
          // epicentre, and ~3 blasts to reach full charcoal at the centre.
          const adv = (3 + 2.5 * power) * proxC; // ~3 blasts -> full blood charcoal at the centre (matches the scorch), same gradient
          this.bakedBlood.set(idx, Math.min(12, (this.bakedBlood.get(idx) ?? 0) + adv));
          this.bloodDirty = true;
        }
      }
      if (this.prevGrid) {
        for (const [dx, dy] of NB) {
          const nx = c.x + dx, ny = c.y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
          const ni = ny * GRID_W + nx;
          if (this.prevGrid[ni] === TileType.HARD) {
            // Remember which SIDE the blast struck (block faces the blast at -[dx,dy]),
            // so the char creeps in from the hit edges, never the roof.
            const sideBit = dx === 1 ? 1 : dx === -1 ? 2 : dy === 1 ? 4 : 8;
            this.hardDmgSide.set(ni, (this.hardDmgSide.get(ni) ?? 0) | sideBit);
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
    if (!this.lowFx) this.blastGore(cells, ecx, ecy, power); // re-fling any LANDED gore caught in the blast
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
      // Glowing EMBER sparks: tiny additive flecks that fling out, float up and wink out.
      for (let i = 0; i < Math.round(5 * this.fxScale); i++) {
        const ea = Math.random() * Math.PI * 2, es = 1 + Math.random() * 3;
        this.push({
          x: cx, y: cy, vx: Math.cos(ea) * es, vy: Math.sin(ea) * es - 1.2, gravity: -2.5, drag: 0.93,
          life: 0.5 + Math.random() * 0.9, max: 1.4, size: this.tile * (0.018 + Math.random() * 0.022),
          color: Math.random() < 0.5 ? "#ffc040" : "#ff6418", shape: "flash",
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
    if (!this.goreEnabled) { // GORE OFF: a shower of kickable gold coins, no blood/guts at all
      for (let i = 0; i < 10 + ((Math.random() * 8) | 0); i++) this.spawnGore("coin", cx + 0.5, cy + 0.5);
      this.shake(11, 200);
      this.hitStop(55, 0.18); // lighter punch stutter (time-juice stays on in coin mode)
      return;
    }
    // Persistent blood marks first (cheap, runs on phones too): a thick gory mush
    // that STAYS on the death cell, blood on the floor neighbours, and face-aware
    // blood on adjacent blocks (top splatter + front drips toward the kill).
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
            this.markGround(ni, dx === 0 || dy === 0 ? 3 : 2); // tight pool that falls off fast
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
    // FLING all the gore OUT from the kill — each piece flies with weight-based physics
    // (soft guts barely move + stick, hard bone/teeth fly far + bounce), bounces off blocks,
    // then settles as a persistent decal (see spawnGore / landGore).
    const C = cx + 0.5, Cy = cy + 0.5;
    const fling = (kind: GoreKind, n: number): void => { for (let i = 0; i < n; i++) this.spawnGore(kind, C, Cy); };
    fling("bone", 6 + ((Math.random() * 6) | 0));
    fling("meat", 5 + ((Math.random() * 5) | 0));
    fling("organ", 2 + ((Math.random() * 3) | 0));
    fling("skull", 1 + (Math.random() < 0.4 ? 1 : 0));
    fling("brain", 1 + ((Math.random() * 2) | 0));
    fling("limb", 1 + ((Math.random() * 2) | 0));
    fling("eye", 1 + ((Math.random() * 2) | 0));
    fling("tooth", 4 + ((Math.random() * 6) | 0));
    // Bile is liquid -> it just pools where the body fell (doesn't fly).
    if (Math.random() < 0.5) {
      const bx = cx + 0.5 + (Math.random() - 0.5) * 1.6, by = cy + 0.5 + (Math.random() - 0.5) * 1.6;
      const g = this.prevGrid, tt = g ? g[(by | 0) * GRID_W + (bx | 0)] : 0;
      if (bx >= 0.2 && by >= 0.2 && bx <= GRID_W - 0.2 && by <= GRID_H - 0.2 && tt !== TileType.HARD && tt !== TileType.SOFT) {
        this.bile.push({ x: bx, y: by, seed: (Math.random() * 0xffffffff) >>> 0 });
        if (this.bile.length > 120) this.bile.splice(0, this.bile.length - 120);
      }
    }
    this.bloodDirty = true; // bones + meat + organs live in the cached blood overlay
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
        gz: 34, rest: 0.18, fric: 0.84, solid: true, // gore: heavy wet shlap, bounces off block sides
        life: 0.7 + Math.random() * 0.7, max: 1.4,
        size: this.tile * (0.035 + Math.random() * 0.08), // smaller, finer gibs (#3)
        color: reds[(Math.random() * reds.length) | 0],
        shape: "rect", rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 16,
      });
    }
    this.burst(cx, cy, "#d61e1e", 36, 6); // fine blood spray
    this.burst(cx, cy, "#7a0000", 24, 4.6); // darker gore spray
    this.burst(cx, cy, color, 10, 3); // a hint of the player's color
    this.burst(cx, cy, "#efe6cf", 6, 3.2); // bone / teeth bits
    // DISMEMBERMENT: a few big chunky meat gobs blown out, tumbling, with a wet arc.
    const meaty = ["#8a0000", "#a31414", "#6a0000", "#7a1010"];
    for (let i = 0; i < Math.round(9 * this.fxScale); i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 4;
      this.push({
        x: cx + 0.5, y: cy + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        vz: 5 + Math.random() * 5, gz: 33, rest: 0.22, fric: 0.82, solid: true,
        life: 0.9 + Math.random() * 0.6, max: 1.5, size: this.tile * (0.06 + Math.random() * 0.06), // smaller meat gobs (#3)
        color: meaty[(Math.random() * meaty.length) | 0], shape: "rect", rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 20,
      });
    }
    this.shake(20, 300);
    this.hitStop(85, 0.05); // near-freeze slow-mo on the gib — the money beat (tunable)
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
    // Cap blood coverage so a long respawn match can't speckle the whole map ("blood rain").
    // At the cap, drop the FAINTEST existing speck (never a fresh pool, never charred) — only
    // stuff that's already nearly invisible — so a handful of recent pools stay, no rain.
    if (!this.bloodGround.has(index) && this.bloodGround.size >= 110) { // raised way up -> blood piles up freely (still short of the whole 187-tile map)
      let minIdx = -1, minLvl = 99;
      for (const [k, v] of this.bloodGround) {
        if ((this.bakedBlood.get(k) ?? 0) > 0) continue; // keep charred patches
        if (v < minLvl) { minLvl = v; minIdx = k; }
      }
      if (minIdx >= 0) { this.bloodGround.delete(minIdx); this.bakedBlood.delete(minIdx); }
      else return;
    }
    this.bloodGround.set(index, Math.min(9, (this.bloodGround.get(index) ?? 0) + amount));
    this.bloodDirty = true;
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

  /** Wet sheen on FRESH blood: a warm specular glint that sits on the side of each pool
   *  facing the arena key light (this.lx/ly) and fades as the pool dries/chars. Additive,
   *  drawn under blocks/players. This is what ties the blood into the lighting system —
   *  fresh blood looks wet and reflective, old blood goes matte. (Gore-gated, skipped on lowFx.) */
  private drawBloodSheen(now: number): void {
    if (!this.goreEnabled || this.lowFx || !this.bloodGround.size) return;
    const ctx = this.ctx, t = this.tile;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [idx, lvl] of this.bloodGround) {
      if (lvl < 4) continue; // only real pools glint, not faint smears
      const bake = this.bakedBlood.get(idx) ?? 0;
      if (bake > 3) continue; // dried / charred -> matte, no wet glint
      const wet = Math.min(1, (lvl - 4) / 5) * (1 - bake / 4); // 0..1 freshness
      if (wet < 0.06) continue;
      const ccx = ((idx % GRID_W) + 0.5) * t, ccy = (((idx / GRID_W) | 0) + 0.5) * t;
      const dx = this.lx - ccx, dy = this.ly - ccy, L = Math.hypot(dx, dy) || 1;
      const gx = ccx + (dx / L) * t * 0.18, gy = ccy + (dy / L) * t * 0.18; // glint toward the light
      const pulse = 0.85 + 0.15 * Math.sin(now / 600 + idx); // faint living-wetness shimmer
      const prox = 1 / (1 + L / (t * 8)); // closer light -> harder glint
      const a = wet * pulse * 0.3 * (0.6 + 0.4 * prox);
      const r = t * 0.42;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      grad.addColorStop(0, `rgba(255,180,170,${a.toFixed(3)})`); // warm wet highlight (not white)
      grad.addColorStop(0.5, `rgba(120,40,40,${(a * 0.33).toFixed(3)})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(ccx - t * 0.5, ccy - t * 0.5, t * 2, t * 2);
    }
    ctx.restore();
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
    const pu = Math.max(1, Math.round(t / 24)); // grass-fine pixels
    // PER-CELL render (reverted from the continuous field): each blood cell is drawn
    // on its own, so empty cells stay clean — distinct pools, no map-wide red carpet.
    for (const [idx, lvl] of this.bloodGround) {
      const ox = (idx % GRID_W) * t, oy = ((idx / GRID_W) | 0) * t;
      let s = (idx * 2654435761) >>> 0;
      s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0;
      const bakeLvl = this.bakedBlood.get(idx) ?? 0; // 0 fresh .. 12 charcoal (12 smooth stages)
      const baked = bakeLvl > 0;
      const bp = Math.min(1, bakeLvl / 12); // 0..1 char progress
      const cover = lvl >= 5 ? 0.6 + ((s & 1023) / 1023) * 0.4 : Math.min(0.72, 0.16 + lvl * 0.14);
      g.globalAlpha = Math.min(0.95, (baked ? 0.52 + bp * 0.38 : 0.5) + lvl * 0.07);
      const NB = pu * 4; // coarse noise block -> irregular outline/holes
      for (let gy = 0; gy < t; gy += pu) {
        for (let gx = 0; gx < t; gx += pu) {
          const qx = (gx / NB) | 0, qy = (gy / NB) | 0;
          let n = (idx * 374761 + qx * 2654435761 + qy * 40503) >>> 0;
          n = (n ^ (n << 13)) >>> 0; n = (n ^ (n >>> 17)) >>> 0; n = (n ^ (n << 5)) >>> 0;
          const cn = (n & 1023) / 1023;
          let f = (idx * 374761393 ^ gx * 73856093 ^ gy * 19349663) >>> 0; // XOR of big primes -> no diagonal bands
          f = (f ^ (f << 13)) >>> 0; f = (f ^ (f >>> 17)) >>> 0; f = (f ^ (f << 5)) >>> 0;
          const localCover = cover * ((baked ? 0.6 : 0.45) + cn * 1.15);
          if ((f & 1023) / 1023 > Math.min(1, localCover)) continue;
          if (baked) {
            // 6 smooth stages: light brown crust (bp~0.15) -> dark -> charcoal (bp~1) + ember.
            const darken = 1 - bp * 0.9; // 1.0 (crust) -> 0.1 (charcoal)
            if (bakeLvl >= 10 && (f & 15) === 0) g.fillStyle = `rgb(${90 + (f % 60)},${18 + (f % 18)},6)`; // ember only at deep char
            else { const br = Math.max(3, ((26 + (f % 40)) * darken) | 0); g.fillStyle = `rgb(${br},${(br * (0.42 - bp * 0.34)) | 0},${(br * 0.22) | 0})`; }
          } else {
            const ndx = (gx + pu / 2 - t / 2) / (t / 2), ndy = (gy + pu / 2 - t / 2) / (t / 2);
            const dc = Math.min(1, Math.sqrt(ndx * ndx + ndy * ndy));
            const tone = (f >> 7) & 7;
            if (tone >= 6 && (f & 7) < 2 && dc < 0.6 && lvl >= 4) {
              g.fillStyle = `rgb(${190 + (f % 60)},${70 + (f % 40)},${68 + (f % 40)})`;
            } else {
              let r = tone === 0 ? 26 + (f % 26) : tone >= 6 ? 130 + (f % 70) : 60 + (f % 70);
              r = (r * (0.5 + 0.5 * dc)) | 0;
              g.fillStyle = `rgb(${r},${(r * 0.1) | 0},${(r * 0.08) | 0})`;
            }
          }
          g.fillRect(ox + gx, oy + gy, pu, pu);
        }
      }
    }
    for (const ch of this.chips) this.drawChip(g, ch, pu); // wood splinters (under gore)
    for (const fp of this.footprints) this.drawFoot(g, fp, pu); // smears on top
    for (const bl of this.bile) this.drawBile(g, bl, pu); // bile/slime puddles (under the gore)
    for (const o of this.organs) this.drawOrgan(g, o, pu); // intestine coils / organs (under the chunks)
    for (const br of this.brains) this.drawBrain(g, br, pu); // brains (soft tissue)
    for (const lm of this.limbs) this.drawLimb(g, lm, pu); // torn arms/legs
    for (const mt of this.meat) this.drawMeat(g, mt, pu); // flesh chunks
    for (const b of this.bones) this.drawBone(g, b, pu); // bone shards on top
    for (const sk of this.skulls) this.drawSkull(g, sk, pu); // skulls on top
    for (const ey of this.eyes) this.drawEye(g, ey, pu); // eyeballs
    for (const th of this.teeth) this.drawTooth(g, th, pu); // teeth
    for (const co of this.coins) this.drawCoin(g, co, pu); // gold coins (gore-off mode)
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
  private static readonly GORE_KINDS: GoreKind[] = ["bone", "meat", "organ", "skull", "brain", "limb", "eye", "tooth", "coin"];

  /** Toggle the gore mode. OFF -> deaths spill kickable gold coins instead of blood/guts. */
  setGore(on: boolean): void { this.goreEnabled = on; }

  private goreArr(kind: GoreKind): Array<{ x: number; y: number; seed: number }> {
    switch (kind) {
      case "bone": return this.bones; case "meat": return this.meat; case "organ": return this.organs;
      case "skull": return this.skulls; case "brain": return this.brains; case "limb": return this.limbs;
      case "eye": return this.eyes; case "coin": return this.coins; default: return this.teeth;
    }
  }

  private goreDraw(kind: GoreKind, g: CanvasRenderingContext2D, m: { x: number; y: number; seed: number }, pu: number): void {
    switch (kind) {
      case "bone": this.drawBone(g, m, pu); break; case "meat": this.drawMeat(g, m, pu); break;
      case "organ": this.drawOrgan(g, m, pu); break; case "skull": this.drawSkull(g, m, pu); break;
      case "brain": this.drawBrain(g, m, pu); break; case "limb": this.drawLimb(g, m, pu); break;
      case "eye": this.drawEye(g, m, pu); break; case "coin": this.drawCoin(g, m, pu); break;
      default: this.drawTooth(g, m, pu); break;
    }
  }

  /** Fling a flying gore piece of `kind` from (cx,cy). With an aim (ax,ay) it's a directional
   *  KICK (softer); otherwise a random death-burst. Soft kinds barely fly (GORE_PHYS). */
  private spawnGore(kind: GoreKind, cx: number, cy: number, ax = 0, ay = 0, strength = 1): void {
    if (this.lowFx) { this.goreArr(kind).push({ x: cx, y: cy, seed: (Math.random() * 0xffffffff) >>> 0 }); this.bloodDirty = true; return; }
    const w = GORE_PHYS[kind];
    const aimed = ax !== 0 || ay !== 0;
    const a = aimed ? Math.atan2(ay, ax) + (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2;
    const sp = (aimed ? w.sp * 0.45 + Math.random() * w.spv * 0.6 : w.sp + Math.random() * w.spv) * strength;
    this.push({
      x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      vz: (w.vz + Math.random() * w.vzv) * (aimed ? 0.6 : 1) * strength, gz: w.gz, rest: w.rest, fric: w.fric, solid: true,
      life: 100, max: 100, size: this.tile * 0.08, color: "#000",
      gore: { kind, seed: (Math.random() * 0xffffffff) >>> 0 },
    });
  }

  /** A flying gore piece has settled -> drop it as a persistent decal (high perf cap). */
  private landGore(p: Particle): void {
    if (!p.gore) return;
    const k = p.gore.kind;
    const arr = this.goreArr(k);
    arr.push({ x: p.x, y: p.y, seed: p.gore.seed });
    if (arr.length > 360) arr.splice(0, arr.length - 360);
    this.bloodDirty = true;
    // Soft, wet kinds make a little SPLAT when they hit the ground (throttled so it never buzzes).
    if (!this.lowFx && this.assets && (k === "organ" || k === "brain" || k === "meat" || k === "limb")) {
      const now = performance.now();
      if (now - this.lastSplat > 85) { this.lastSplat = now; this.assets.playGore(this.soundAt(p.x, p.y).vol * 0.32); }
    }
  }

  /** Smoldering skulls puff faint, slow smoke wisps every so often — a quietly grim battlefield. */
  private emitSmolder(now: number): void {
    if (this.lowFx || !this.skulls.length || now - this.smolderAt < 430) return;
    this.smolderAt = now;
    for (let n = 0; n < 3; n++) {
      if (Math.random() > 0.5) continue;
      const sk = this.skulls[(Math.random() * this.skulls.length) | 0];
      this.push({
        x: sk.x + (Math.random() - 0.5) * 0.2, y: sk.y - 0.08, vx: (Math.random() - 0.5) * 0.3, vy: -0.45 - Math.random() * 0.4,
        life: 0.9 + Math.random() * 0.7, max: 1.6, drag: 0.96, grow: this.tile * 0.16,
        size: this.tile * 0.07, color: "rgba(58,54,50,0.32)",
      });
    }
  }

  /** Boot any LANDED gore on `cell` back into flight, away from (fromX,fromY) — a foot kick. */
  private kickGibs(cell: number, fromX: number, fromY: number): void {
    const px = fromX + 0.5, py = fromY + 0.5;
    let kicked = false;
    for (const kind of Renderer.GORE_KINDS) {
      const arr = this.goreArr(kind);
      for (let j = arr.length - 1; j >= 0; j--) {
        const o = arr[j];
        if (((o.y | 0) * GRID_W + (o.x | 0)) !== cell) continue;
        arr.splice(j, 1);
        this.spawnGore(kind, o.x, o.y, o.x - px, o.y - py, 1); // kick it flying away from the foot
        kicked = true;
      }
    }
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

  /** Re-fling any LANDED gore caught in the blast back into flight, outward from the
   *  epicentre (strength scales with blast power; soft kinds still don't go far). */
  private blastGore(cells: Array<{ x: number; y: number }>, ecx: number, ecy: number, power: number): void {
    const set = new Set(cells.map((c) => c.y * GRID_W + c.x));
    for (const kind of Renderer.GORE_KINDS) {
      const arr = this.goreArr(kind);
      for (let j = arr.length - 1; j >= 0; j--) {
        const o = arr[j];
        if (!set.has((o.y | 0) * GRID_W + (o.x | 0))) continue;
        arr.splice(j, 1);
        this.spawnGore(kind, o.x, o.y, o.x - ecx + 0.001, o.y - ecy + 0.001, 1.6 + power * 1.6);
      }
    }
  }

  /** Blow chips lying on the blast cells outward from the epicentre (z-physics + relocate). */
  private blastGibs(cells: Array<{ x: number; y: number }>, power = 0.5): void {
    if (!this.chips.length || !cells.length) return; // bones/meat/gore now go through blastGore
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
            vz: (5 + Math.random() * 5) * (0.7 + power * 0.6), gz: 32, rest, fric: 0.86, solid: true,
            life: 0.5 + Math.random() * 0.45, max: 0.95, size: this.tile * (0.05 + Math.random() * 0.06),
            color, shape: "rect", rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 18,
          });
        }
      }
    };
    blast(this.chips, "#a06b48", 0.6); // wood splinters only (gore kinds go through blastGore)
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

  /** A spilled intestine coil / organ: a wiggly fleshy tube (glossy pink-purple top, dark
   *  bruised underside) with a soft shadow and wet glints. Lives in the cached overlay. */
  private drawOrgan(g: CanvasRenderingContext2D, o: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    let s = o.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const rad = t * (0.045 + rnd() * 0.022); // tube radius
    const segs = 5 + ((rnd() * 4) | 0);
    let ang = rnd() * Math.PI * 2, px = o.x * t, py = o.y * t;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < segs; i++) { pts.push([px, py]); ang += (rnd() - 0.5) * 1.7; px += Math.cos(ang) * rad * 1.5; py += Math.sin(ang) * rad * 1.5; }
    // soft shadow under the coil
    g.globalAlpha = 0.26; g.fillStyle = "#000000";
    for (const [bx, by] of pts) for (let yy = -rad; yy <= rad; yy += pu) for (let xx = -rad; xx <= rad; xx += pu) {
      if (xx * xx + yy * yy > rad * rad) continue;
      g.fillRect(Math.round((bx + xx + pu) / pu) * pu, Math.round((by + yy + pu * 1.4) / pu) * pu, pu, pu);
    }
    g.globalAlpha = 1;
    const baseR = 150 + (s % 40); // pinkish flesh
    const orad = rad + pu;
    for (const [bx, by] of pts) {
      g.fillStyle = "#3a0012"; // dark bruised outline ring
      for (let yy = -orad; yy <= orad; yy += pu) for (let xx = -orad; xx <= orad; xx += pu) {
        if (xx * xx + yy * yy > orad * orad) continue;
        g.fillRect(Math.round((bx + xx) / pu) * pu, Math.round((by + yy) / pu) * pu, pu, pu);
      }
      for (let yy = -rad; yy <= rad; yy += pu) for (let xx = -rad; xx <= rad; xx += pu) {
        if (xx * xx + yy * yy > rad * rad) continue;
        const top = yy < -rad * 0.25; // glossy pink-purple top, dark underside
        g.fillStyle = top
          ? `rgb(${Math.min(255, baseR + 70)},${(baseR * 0.5) | 0},${(baseR * 0.6) | 0})`
          : `rgb(${(baseR * 0.6) | 0},${(baseR * 0.14) | 0},${(baseR * 0.24) | 0})`;
        g.fillRect(Math.round((bx + xx) / pu) * pu, Math.round((by + yy) / pu) * pu, pu, pu);
      }
    }
    g.fillStyle = "#ffd6e2"; // wet glints along the coil
    for (let i = 0; i < pts.length; i += 2) { const [bx, by] = pts[i]; g.fillRect(Math.round((bx - rad * 0.3) / pu) * pu, Math.round((by - rad * 0.45) / pu) * pu, pu, pu); }
  }

  /** A severed head / skull: a bone-white cranium with two dark eye sockets, a nasal hole
   *  and a little tooth row. Soft shadow under it. */
  private drawSkull(g: CanvasRenderingContext2D, k: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const cx = k.x * t, cy = k.y * t;
    let s = k.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const rx = t * (0.07 + rnd() * 0.015), ry = rx * 1.12; // a touch taller than wide
    g.globalAlpha = 0.3; g.fillStyle = "#000000"; // shadow
    for (let yy = -ry; yy <= ry; yy += pu) for (let xx = -rx; xx <= rx; xx += pu) {
      if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 1) continue;
      g.fillRect(Math.round((cx + xx + pu) / pu) * pu, Math.round((cy + yy + pu * 1.6) / pu) * pu, pu, pu);
    }
    g.globalAlpha = 1;
    const bw = 214 + (s % 26); // bone white
    for (let yy = -ry; yy <= ry; yy += pu) for (let xx = -rx; xx <= rx; xx += pu) {
      if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 1) continue;
      const lit = yy < -ry * 0.15 ? 0 : 18; // slight shading on the lower half
      g.fillStyle = `rgb(${bw - lit},${bw - 10 - lit},${bw - 34 - lit})`;
      g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + yy) / pu) * pu, pu, pu);
    }
    // eye sockets (two dark hollows) + nasal hole
    g.fillStyle = "#15100c";
    const ew = rx * 0.34, eh = ry * 0.3, eox = rx * 0.42, eoy = -ry * 0.08;
    for (const sgn of [-1, 1]) for (let yy = -eh; yy <= eh; yy += pu) for (let xx = -ew; xx <= ew; xx += pu) {
      if ((xx * xx) / (ew * ew) + (yy * yy) / (eh * eh) > 1) continue;
      g.fillRect(Math.round((cx + sgn * eox + xx) / pu) * pu, Math.round((cy + eoy + yy) / pu) * pu, pu, pu);
    }
    g.fillRect(Math.round((cx - pu / 2) / pu) * pu, Math.round((cy + ry * 0.28) / pu) * pu, pu, Math.max(pu, Math.round(ry * 0.22))); // nasal
    // tooth row
    g.fillStyle = `rgb(${bw},${bw - 6},${bw - 24})`;
    for (let xx = -rx * 0.5; xx <= rx * 0.5; xx += pu * 2) g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + ry * 0.62) / pu) * pu, pu, pu);
  }

  /** A spilled brain: a pinkish-grey blob with two hemispheres, a central groove and a few
   *  wrinkle folds, glossy on top. */
  private drawBrain(g: CanvasRenderingContext2D, b: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const cx = b.x * t, cy = b.y * t;
    let s = b.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const rx = t * (0.07 + rnd() * 0.018), ry = t * (0.058 + rnd() * 0.014);
    g.globalAlpha = 0.26; g.fillStyle = "#000000"; // shadow
    for (let yy = -ry; yy <= ry; yy += pu) for (let xx = -rx; xx <= rx; xx += pu) {
      if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 1) continue;
      g.fillRect(Math.round((cx + xx + pu) / pu) * pu, Math.round((cy + yy + pu * 1.4) / pu) * pu, pu, pu);
    }
    g.globalAlpha = 1;
    const base = 196 + (s % 28); // pinkish grey
    for (let yy = -ry; yy <= ry; yy += pu) for (let xx = -rx; xx <= rx; xx += pu) {
      if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 1) continue;
      const top = yy < -ry * 0.2;
      g.fillStyle = top ? `rgb(${base},${(base * 0.72) | 0},${(base * 0.74) | 0})` : `rgb(${(base * 0.72) | 0},${(base * 0.42) | 0},${(base * 0.44) | 0})`;
      g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + yy) / pu) * pu, pu, pu);
    }
    g.fillStyle = `rgb(${(base * 0.5) | 0},${(base * 0.28) | 0},${(base * 0.3) | 0})`; // central groove + wrinkle folds
    for (let yy = -ry * 0.9; yy <= ry * 0.9; yy += pu) g.fillRect(Math.round((cx + Math.sin(yy * 0.4) * rx * 0.12) / pu) * pu, Math.round((cy + yy) / pu) * pu, pu, pu);
    for (let k2 = 0; k2 < 3; k2++) { const wy = (rnd() - 0.5) * ry * 1.2; for (let xx = -rx * 0.7; xx <= rx * 0.7; xx += pu) g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + wy + Math.sin(xx * 0.5) * pu) / pu) * pu, pu, pu); }
    g.fillStyle = "#ffe0e6"; g.fillRect(Math.round((cx - rx * 0.3) / pu) * pu, Math.round((cy - ry * 0.4) / pu) * pu, pu, pu); // glint
  }

  /** A torn-off arm/leg: a fleshy limb capsule with a white bone stump and a ragged bloody
   *  end, randomly oriented. */
  private drawLimb(g: CanvasRenderingContext2D, l: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const cx = l.x * t, cy = l.y * t;
    let s = l.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const len = t * (0.16 + rnd() * 0.08), rad = t * (0.038 + rnd() * 0.012);
    const ang = rnd() * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
    const skin = 184 + (s % 44); // flesh tone (varies)
    const seg = (dist: number, r: number, col: string): void => {
      const bx = cx + ca * dist, by = cy + sa * dist;
      for (let yy = -r; yy <= r; yy += pu) for (let xx = -r; xx <= r; xx += pu) {
        if (xx * xx + yy * yy > r * r) continue;
        g.fillStyle = col;
        g.fillRect(Math.round((bx + xx) / pu) * pu, Math.round((by + yy) / pu) * pu, pu, pu);
      }
    };
    g.globalAlpha = 0.28; for (let d = -len; d <= len; d += pu) seg(d + pu, rad + pu, "#000000"); g.globalAlpha = 1; // shadow
    for (let d = -len; d <= len; d += pu) { // skin tube (lighter top, darker bottom)
      const top = sa < 0;
      seg(d, rad, top ? `rgb(${Math.min(255, skin + 24)},${(skin * 0.78) | 0},${(skin * 0.68) | 0})` : `rgb(${(skin * 0.8) | 0},${(skin * 0.56) | 0},${(skin * 0.5) | 0})`);
    }
    seg(-len, rad * 1.15, "#e8e0cf"); seg(-len + pu * 1.2, rad * 0.7, "#c8c0ae"); // bone stump at one end
    seg(len, rad * 1.1, "#5a0000"); seg(len - pu, rad * 0.8, "#9c0000"); // ragged bloody torn end
  }

  /** A popped eyeball: white sclera, coloured iris, black pupil, bloodshot + a trailing
   *  optic nerve / blood streak. */
  private drawEye(g: CanvasRenderingContext2D, e: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const cx = e.x * t, cy = e.y * t;
    let s = e.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const r = t * (0.04 + rnd() * 0.012);
    const disc = (ox: number, oy: number, rr: number, col: string): void => {
      for (let yy = -rr; yy <= rr; yy += pu) for (let xx = -rr; xx <= rr; xx += pu) {
        if (xx * xx + yy * yy > rr * rr) continue;
        g.fillStyle = col;
        g.fillRect(Math.round((cx + ox + xx) / pu) * pu, Math.round((cy + oy + yy) / pu) * pu, pu, pu);
      }
    };
    // optic-nerve / blood streak trailing out one side
    const na = rnd() * Math.PI * 2;
    g.fillStyle = "#7a0000";
    for (let d = 0; d < r * 2.2; d += pu) g.fillRect(Math.round((cx + Math.cos(na) * (r + d)) / pu) * pu, Math.round((cy + Math.sin(na) * (r + d)) / pu) * pu, pu, pu);
    g.globalAlpha = 0.26; disc(pu, pu * 1.3, r + pu, "#000000"); g.globalAlpha = 1; // shadow
    disc(0, 0, r, "#f2efe6"); // white
    // bloodshot veins
    g.fillStyle = "#c0201a";
    for (let i = 0; i < 4; i++) { const a = rnd() * 6.28; for (let d = r * 0.4; d < r; d += pu) if (rnd() < 0.6) g.fillRect(Math.round((cx + Math.cos(a) * d) / pu) * pu, Math.round((cy + Math.sin(a) * d) / pu) * pu, pu, pu); }
    const iris = ["#3a6a8a", "#5a3a1a", "#2a6a3a", "#444"][((s >>> 5) & 3)];
    disc(0, 0, r * 0.5, iris); // iris
    disc(0, 0, r * 0.24, "#000000"); // pupil
    g.fillStyle = "#ffffff"; g.fillRect(Math.round((cx - r * 0.2) / pu) * pu, Math.round((cy - r * 0.2) / pu) * pu, pu, pu); // glint
  }

  /** A gold coin (gore-OFF mode): a shiny disc with a darker rim, a bright sheen and a $ mark. */
  private drawCoin(g: CanvasRenderingContext2D, c: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const cx = c.x * t, cy = c.y * t;
    const r = t * 0.07;
    g.globalAlpha = 0.3; g.fillStyle = "#000000"; // shadow
    for (let yy = -r; yy <= r; yy += pu) for (let xx = -r; xx <= r; xx += pu) {
      if (xx * xx + yy * yy > r * r) continue;
      g.fillRect(Math.round((cx + xx + pu) / pu) * pu, Math.round((cy + yy + pu * 1.4) / pu) * pu, pu, pu);
    }
    g.globalAlpha = 1;
    const orad = r + pu;
    g.fillStyle = "#8a5a08"; // dark gold rim
    for (let yy = -orad; yy <= orad; yy += pu) for (let xx = -orad; xx <= orad; xx += pu) {
      if (xx * xx + yy * yy > orad * orad) continue;
      g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + yy) / pu) * pu, pu, pu);
    }
    for (let yy = -r; yy <= r; yy += pu) for (let xx = -r; xx <= r; xx += pu) {
      if (xx * xx + yy * yy > r * r) continue;
      const lit = (xx + yy) < -r * 0.3; // bright upper-left, deeper lower-right
      g.fillStyle = lit ? "#ffe88a" : "#f0b021";
      g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + yy) / pu) * pu, pu, pu);
    }
    g.fillStyle = "#b9790c"; // engraved $
    g.fillRect(Math.round((cx - pu / 2) / pu) * pu, Math.round((cy - r * 0.55) / pu) * pu, pu, Math.max(pu, Math.round(r * 1.1)));
    g.fillRect(Math.round((cx - r * 0.4) / pu) * pu, Math.round((cy - r * 0.3) / pu) * pu, Math.max(pu, Math.round(r * 0.8)), pu);
    g.fillRect(Math.round((cx - r * 0.4) / pu) * pu, Math.round((cy + r * 0.2) / pu) * pu, Math.max(pu, Math.round(r * 0.8)), pu);
    g.fillStyle = "#fffbe0"; g.fillRect(Math.round((cx - r * 0.4) / pu) * pu, Math.round((cy - r * 0.5) / pu) * pu, pu, pu); // sheen glint
  }

  /** A knocked-out tooth: a tiny off-white nub with a faint root. */
  private drawTooth(g: CanvasRenderingContext2D, th: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const cx = th.x * t, cy = th.y * t;
    const s = th.seed >>> 0;
    const w = Math.max(pu, Math.round(t * 0.018)), h = Math.max(pu, Math.round(t * 0.026));
    g.globalAlpha = 0.25; g.fillStyle = "#000000";
    g.fillRect(Math.round((cx - w / 2 + pu) / pu) * pu, Math.round((cy + pu) / pu) * pu, w, h); // shadow
    g.globalAlpha = 1;
    g.fillStyle = `rgb(${236 - (s % 16)},${232 - (s % 16)},${214 - (s % 20)})`; // enamel
    g.fillRect(Math.round((cx - w / 2) / pu) * pu, Math.round((cy - h / 2) / pu) * pu, w, h);
    g.fillStyle = "#cfc7ad"; // root shading at the base
    g.fillRect(Math.round((cx - w / 2) / pu) * pu, Math.round((cy + h / 2 - pu) / pu) * pu, w, pu);
  }

  /** A bile / slime puddle: a translucent greenish-yellow splat with a glossy sheen. */
  private drawBile(g: CanvasRenderingContext2D, b: { x: number; y: number; seed: number }, pu: number): void {
    const t = this.tile;
    const cx = b.x * t, cy = b.y * t;
    let s = b.seed >>> 0;
    const rnd = (): number => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return (s & 1023) / 1023; };
    const rx = t * (0.12 + rnd() * 0.06), ry = t * (0.09 + rnd() * 0.05);
    const wob = (): number => 1 + (rnd() - 0.5) * 0.6;
    for (let yy = -ry; yy <= ry; yy += pu) for (let xx = -rx; xx <= rx; xx += pu) {
      if (((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry)) * wob() > 1) continue;
      const gg = 120 + (((xx * 7 + yy * 13) & 31)); // murky yellow-green
      g.globalAlpha = 0.55;
      g.fillStyle = `rgb(${(gg * 0.8) | 0},${gg},${(gg * 0.3) | 0})`;
      g.fillRect(Math.round((cx + xx) / pu) * pu, Math.round((cy + yy) / pu) * pu, pu, pu);
    }
    g.globalAlpha = 0.5; g.fillStyle = "#e8ffb0"; // glossy sheen
    g.fillRect(Math.round((cx - rx * 0.25) / pu) * pu, Math.round((cy - ry * 0.35) / pu) * pu, pu * 2, pu);
    g.globalAlpha = 1;
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
    // #2 WET SHEEN: fresh blood is glossy — a faint specular highlight offset TOWARD
    // the key light, fading as the blood dries (~12s). Makes wet blood catch the sun
    // and shift as the dynamic light moves.
    const fresh = Math.max(0, 1 - (now - m.born) / 12000);
    if (fresh > 0.02) {
      const cy0 = py + t * 0.32;
      let ux = this.lx - cxp, uy = this.ly - cy0;
      const mm = Math.hypot(ux, uy) || 1; ux /= mm; uy /= mm;
      const hx = cxp + ux * t * 0.13, hy = cy0 + uy * t * 0.13;
      ctx.globalCompositeOperation = "lighter";
      const sheen = ctx.createRadialGradient(hx, hy, 0, hx, hy, t * 0.24);
      sheen.addColorStop(0, `rgba(255,140,140,${0.18 * fresh})`);
      sheen.addColorStop(1, "rgba(255,80,80,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(px, py, t, t);
      ctx.globalCompositeOperation = "source-over";
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
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Hit-stop: scale the simulation dt toward hitStopFloor (0 = freeze) then k²-snap back.
    // Only dt is scaled — `now`/performance.now keeps running so shake + timed decals ring
    // out in real time over the frozen gibs.
    let tScale = 1;
    const hs = now - this.hitStopStart;
    if (hs >= 0 && hs < this.hitStopDur) {
      const k = hs / this.hitStopDur;
      const e = k < 0.6 ? 0 : ((k - 0.6) / 0.4) ** 2;
      tScale = this.hitStopFloor + (1 - this.hitStopFloor) * e;
    }
    const dt = Math.min(0.05, rawDt * tScale);
    const W = t * GRID_W;
    const H = t * GRID_H;
    // Single key-light screen position this frame: high above the arena (light from
    // the top), slowly orbiting when Dynamic light is on. Drives block face-shading
    // and the direction/length of cast shadows.
    this.lx = this.dynLight ? W * (0.5 + 0.36 * Math.sin(now / 4300)) : W * 0.5;
    this.ly = this.dynLight ? H * (0.04 + 0.16 * (0.5 + 0.5 * Math.cos(now / 5600))) : H * 0.04;

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
    this.drawBloodGround(W, H); // persistent blood mush + smeared footprints (over the floor)
    this.drawBloodSheen(now); // wet specular glint on fresh pools, biased toward the arena key light

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

    // Desktop: live swaying grass over the open ground, after blocks so the front
    // tips overlap them for a layered 3D look. CLASSIC-ONLY (and only the animated
    // floor mode) — themed arenas + the static grass texture must NOT grow blades.
    if (!this.lowFx && this.arenaTheme === "classic" && !this.grassTexture) this.drawGrassOverlay(view, now);

    this.drawShatters(now); // crate pieces flying apart from just-broken soft blocks
    this.drawDecals(now);
    this.drawPowerups(view, now); // after blocks so their shadows never cover relics

    const bombKeys = new Set<string>();
    const DROP_MS = 300, LAND_MS = 64;
    for (const b of view.bombs) {
      const key = b.x + "_" + b.y;
      bombKeys.add(key);
      // First-seen time = drop-anim start. A bomb already ticking when first seen (late
      // join / spectate) skips the toss so it doesn't replay mid-fuse.
      let t0 = this.bombSeen.get(key);
      if (t0 === undefined) {
        const fresh = b.fuseLeftMs > BOMB_TIMER_MS - 260;
        t0 = fresh ? now : now - DROP_MS - 1;
        this.bombSeen.set(key, t0);
        if (!fresh) this.bombLanded.add(key);
      }
      const age = now - t0;

      // Drop juice: the bomb is tossed to the floor with a decaying bounce + squash/stretch.
      // h = height 0..1 (1 = peak), modelled as |cos| under a (1-u)^2 decay so it bounces a
      // couple of times and settles. Squash spikes at ground contact, stretch when airborne.
      let h = 0, squash = 0, stretch = 0;
      if (age < DROP_MS) {
        const u = age / DROP_MS;
        h = Math.abs(Math.cos(u * Math.PI * 2.5)) * (1 - u) * (1 - u);
        const contact = Math.pow(Math.max(0, 1 - h / 0.18), 2); // ~1 near ground, 0 airborne
        squash = contact * (1 - u) * 0.5;
        stretch = Math.min(0.18, Math.max(0, h - 0.15) * 0.3);
      }
      // One-shot landing puff + a brief glow flash (the satisfying "thunk").
      if (!this.bombLanded.has(key) && age >= LAND_MS) {
        this.bombLanded.add(key);
        if (!this.lowFx) for (let d = 0; d < 8; d++) {
          const aa = Math.random() * Math.PI * 2, ss = 1.2 + Math.random() * 1.8;
          this.push({
            x: b.x + 0.5, y: b.y + 0.8, vx: Math.cos(aa) * ss, vy: -0.25 - Math.random() * 0.5,
            life: 0.3 + Math.random() * 0.25, max: 0.55, drag: 0.9, size: t * (0.05 + Math.random() * 0.05),
            color: "rgba(150,140,120,0.55)",
          });
        }
      }
      const landFlash = age >= LAND_MS && age < LAND_MS + 160 ? 1 - (age - LAND_MS) / 160 : 0;

      const pulse = 1 - (b.fuseLeftMs / BOMB_TIMER_MS) * 0.25;
      const cx = (b.x + 0.5) * t;
      const cyGround = (b.y + 0.5) * t;
      const lift = h * t * 0.78;
      const color = PLAYER_COLORS[this.colorOf(b.ownerId) % PLAYER_COLORS.length];
      // Contact shadow shrinks + fades while the bomb is in the air.
      this.drawShadow(cx, cyGround + t * 0.3, t * 0.34 * (1 - h * 0.5), t * 0.14 * (1 - h * 0.4), 0.28 * (1 - h * 0.35));
      const urgency = 1 - b.fuseLeftMs / BOMB_TIMER_MS; // 0 -> 1
      const beat = Math.sin(now / (90 - urgency * 55));
      {
        const glow = t * (0.5 + urgency * 0.25) * (0.8 + 0.2 * beat) * (1 + landFlash * 0.5);
        const grad = ctx.createRadialGradient(cx, cyGround, 0, cx, cyGround, glow);
        grad.addColorStop(0, color + (urgency > 0.7 || landFlash > 0.3 ? "ee" : "cc"));
        grad.addColorStop(1, color + "00");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cyGround, glow, 0, Math.PI * 2);
        ctx.fill();
      }
      const baseS = t * 0.9 * (0.95 + 0.05 * beat) * pulse;
      const sx = baseS * (1 + squash - stretch);
      const sy = baseS * (1 - squash + stretch);
      const bottom = cyGround + baseS * 0.42 - lift; // anchor the bomb's BASE so squash plants it
      const img = this.sprite("bomb");
      if (img) {
        ctx.drawImage(img, cx - sx / 2, bottom - sy, sx, sy);
      } else {
        ctx.save();
        ctx.translate(cx, bottom - sy / 2);
        ctx.scale(sx / baseS, sy / baseS);
        const r = baseS * 0.38;
        ctx.fillStyle = "#15151a";
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ff7043";
        ctx.fillRect(-1.5, -r - t * 0.12, 3, t * 0.12);
        ctx.restore();
      }
      // Fuse sparks above the bomb (only once it has landed).
      if (!this.lowFx && age >= LAND_MS && Math.random() < 0.5) {
        this.push({
          x: b.x + 0.5 + (Math.random() - 0.5) * 0.18, y: b.y + 0.18 - h * 0.78, vx: (Math.random() - 0.5) * 0.8, vy: -1 - Math.random(),
          life: 0.22 + Math.random() * 0.2, max: 0.42, drag: 0.9, size: t * 0.04,
          color: Math.random() < 0.5 ? "#fff2a8" : "#ffae3a",
        });
      }
    }
    // Prune drop-anim state for bombs that have exploded/vanished.
    if (this.bombSeen.size > bombKeys.size) {
      for (const k of this.bombSeen.keys()) if (!bombKeys.has(k)) { this.bombSeen.delete(k); this.bombLanded.delete(k); }
    }

    this.drawPlayers(view, myId, now);
    this.drawLights(now);
    this.emitSmolder(now); // smoldering skulls puff faint smoke
    this.updateParticles(dt);
    if (!this.lowFx) this.drawAtmosphere(W, H, now, dt); // per-arena ambient motes (cozy immersion)
    this.drawFloaters(now); // upbeat reward/event popups (ease-out-back / elastic)
    ctx.restore();

    if (!this.lowFx) this.drawAmbient(W, H, now); // warm key light (slowly orbits if dynamic light on) + vignette
    if (!this.lowFx) this.drawArenaLights(W, H, now); // per-arena theatrical accent lights (night-boosted)
    if (this.bloomOn && !this.lowFx) this.drawBloom(W, H); // soft glow bleed on bright areas
    this.drawColorGrade(W, H); // cozy-warm early -> mortuary-cold by sudden death
    this.drawDangerVignette(W, H, now); // pulsing red threat vignette at low HP / sudden death
    this.drawFirstBlood(now); // screen-space announcement, above the world
  }

  /** A floating pixel gold crown (frag leader): glowing band + 5 points with gems. */
  private drawCrown(cx: number, cy: number, now: number): void {
    const ctx = this.ctx, t = this.tile;
    const w = t * 0.44, h = t * 0.26, pu = Math.max(1, Math.round(t / 22));
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // warm glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w);
    glow.addColorStop(0, `rgba(255,210,90,${0.3 + 0.12 * Math.sin(now / 240)})`);
    glow.addColorStop(1, "rgba(255,210,90,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, w, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const left = cx - w / 2, base = cy + h / 2, pts = 5, mid = (pts - 1) / 2;
    ctx.fillStyle = "#caa017"; // band
    ctx.fillRect(Math.round(left / pu) * pu, Math.round((base - pu * 1.5) / pu) * pu, Math.round(w / pu) * pu, pu * 1.5);
    for (let i = 0; i < pts; i++) { // tapered points, centre tallest
      const px = left + (w * (i + 0.5)) / pts, ph = (i === mid ? h : h * 0.62);
      ctx.fillStyle = "#f2c63a";
      for (let y = 0; y < ph; y += pu) {
        const ww = pu * (1 + Math.round((1 - y / ph) * 1.5));
        ctx.fillRect(Math.round((px - ww / 2) / pu) * pu, Math.round((base - pu * 1.5 - y) / pu) * pu, ww, pu);
      }
      ctx.fillStyle = "#fff3b0"; // bright tip
      ctx.fillRect(Math.round((px - pu / 2) / pu) * pu, Math.round((base - pu * 1.5 - ph) / pu) * pu, pu, pu);
      ctx.fillStyle = i % 2 === 0 ? "#ff4a5a" : "#4ad0ff"; // gem on the band
      ctx.fillRect(Math.round((px - pu / 2) / pu) * pu, Math.round((base - pu) / pu) * pu, pu, pu);
    }
  }

  private drawPlayers(view: RenderView, myId: number, now: number): void {
    const ctx = this.ctx;
    const t = this.tile;
    const seen = new Set<number>();
    const WALK_SEQ = [0, 1, 2, 1]; // ping-pong walk cycle

    // Leader = the (alive) player with the most frags — gets a floating gold crown.
    let leaderId = -1, topFrags = 0;
    for (const p of view.players) { if (p.alive && p.frags > topFrags) { topFrags = p.frags; leaderId = p.id; } }

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
        const col = PLAYER_COLORS[this.colorOf(p.id) % PLAYER_COLORS.length];
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
        const col = PLAYER_COLORS[this.colorOf(p.id) % PLAYER_COLORS.length];
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
          if ((this.bloodGround.get(ci) ?? 0) >= 6) { // stepped in the GORE pile -> drag it out ~5 tiles
            this.bloodyFeet.set(p.id, 6);
            const g = this.playerGore.get(p.id) ?? { blood: 0, burn: 0 };
            g.blood = Math.min(1, g.blood + 0.5); // wades through gore -> legs stain, and STAY bloodied
            this.playerGore.set(p.id, g);
          }
          const feet = this.bloodyFeet.get(p.id) ?? 0;
          if (feet > 0 && (mdx || mdy)) {
            this.bloodyFeet.set(p.id, feet - 1);
            // First cells smear strongly, then fade over the trail.
            const a = feet >= 5 ? 0.85 : feet >= 4 ? 0.6 : feet >= 3 ? 0.42 : feet >= 2 ? 0.3 : 0.2;
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
            // DRAG the gore out: deposit REAL blood onto the trail, thinning each step (the
            // pile smears ~5 tiles with a gradual fade). The 44-cell cap stops any carpet,
            // and only the heavy pile (>=6) re-arms the feet, so it can't run away.
            const drag = feet >= 5 ? 4 : feet >= 4 ? 3 : feet >= 3 ? 2 : 1;
            this.markGround(ci, drag);
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
        // Blood on legs + blast char on the body. Masked to the sprite silhouette by
        // tinting in an OFFSCREEN buffer (source-atop there is isolated to the sprite's
        // own alpha), then blitting — so it never bleeds onto the floor/scene.
        let drawSrc: CanvasImageSource = img;
        if (this.goreEnabled && !this.lowFx && p.alive) {
          const g = this.playerGore.get(p.id) ?? { blood: 0, burn: 0 };
          const feet = (this.bloodyFeet.get(p.id) ?? 0) / 6;
          const blood = Math.min(1, Math.max(g.blood, feet * 0.75));
          const burn = g.burn;
          if (blood > 0.03 || burn > 0.03) drawSrc = this.tintSkin(img, blood, burn, p.id, now);
          if (burn > 0.5 && now - (this.lastSmoke.get(p.id) ?? 0) > 150) { // charred body wisps smoke
            this.lastSmoke.set(p.id, now);
            this.push({
              x: rp.x + 0.5 + (Math.random() - 0.5) * 0.3, y: rp.y + 0.25, vx: (Math.random() - 0.5) * 0.5, vy: -1.2 - Math.random(),
              life: 0.7 + Math.random() * 0.4, max: 1.1, drag: 0.95, gravity: -1.4,
              size: t * (0.06 + Math.random() * 0.05), color: "rgba(58,52,48,0.45)",
            });
          }
        }
        ctx.save();
        ctx.translate(cx, cy);
        if (!p.alive) ctx.rotate((1 - scale) * 1.2);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(drawSrc, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.fillStyle = PLAYER_COLORS[this.colorOf(p.id) % PLAYER_COLORS.length];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${Math.floor(t * 0.5 * scale)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(SKIN_EMOJI[sk % SKIN_EMOJI.length], cx, cy + 1);
      }

      // Floating gold crown over the current frag leader.
      if (p.alive && p.id === leaderId) this.drawCrown(cx, cy - t * (0.52 + 0.04 * Math.sin(now / 320)), now);

      // (The old white ring under the local player is replaced by the
      //  start-of-match colored glow above.)

      // HP bar above the player: START_LIVES segments, filled = current HP.
      if (p.alive) {
        ctx.globalAlpha = 1;
        const segs = START_LIVES;
        const bw = t * 0.62;
        const gap = t * 0.04;
        const sw = (bw - gap * (segs - 1)) / segs;
        const sh = t * 0.05; // half as thick -> clears the leader crown
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

  /** Theme-aware chunks flung out when a soft block is destroyed: wood for crates,
   *  glowing shards for crystals, leaves for the bush, metal for gold, etc. Finer
   *  pixels (#3). */
  private emitDebris(gx: number, gy: number): void {
    if (this.lowFx) return;
    const t = this.tile;
    const d = THEME_DEBRIS[this.arenaTheme] ?? THEME_DEBRIS.classic;
    const n = Math.round(13 * this.fxScale); // a few more, but smaller
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.2 + Math.random() * 2.4;
      const emissive = d.emissive && Math.random() < 0.6;
      this.push({
        x: gx + 0.5, y: gy + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        vz: 4 + Math.random() * 5, gz: 30, rest: 0.6, fric: 0.9, solid: true, // debris: crunchy bouncy, bounces off blocks
        life: 0.5 + Math.random() * 0.4, max: 0.9,
        size: t * (0.035 + Math.random() * 0.045), // SMALLER than before (was .06-.13)
        shape: emissive ? "flash" : "rect",
        rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 14,
        color: d.colors[i % d.colors.length],
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
    // Per-arena floor reaction: char hue + how fully it blackens (sand fuses tan, metal
    // soots cool grey, grass chars warm brown, void goes purple-black, etc.).
    const fp = FLOOR_PHYSICS[this.arenaTheme] ?? FLOOR_PHYSICS.classic;
    const [cr, cg, cb] = fp.char;
    for (const [idx, lvl] of this.burn) {
      const ox = (idx % GRID_W) * t, oy = ((idx / GRID_W) | 0) * t;
      // One blast already leaves a clearly dark scorch; repeated blasts deepen it to
      // near-black charcoal (the epicentre, hit most, ends up darkest).
      const p = Math.min(1, lvl / 6); // NO base offset -> a single light blast is faint; ~6 blasts -> black
      // WHOLE-TILE base burn in the floor's char hue; a faint burn lifts brighter.
      const lift = Math.round((1 - p) * 18);
      g.globalAlpha = Math.min(0.85, 0.12 + p * 0.66) * fp.max; // faint -> opaque when black, capped per surface
      g.fillStyle = `rgb(${cr + lift},${cg + lift},${cb + lift})`;
      g.fillRect(ox, oy, t, t);
      const cover = 0.3 + p * 0.65; // sparse when faint -> full when black
      const a = (0.2 + p * 0.6) * fp.max;
      const dlift = Math.round((1 - p) * 14);
      let h = (idx * 2654435761) >>> 0;
      for (let gy = 0; gy < t; gy += pu) {
        for (let gx = 0; gx < t; gx += pu) {
          h = (h ^ (h << 13)) >>> 0; h = (h ^ (h >>> 17)) >>> 0; h = (h ^ (h << 5)) >>> 0;
          if ((h & 1023) / 1023 > cover) continue;
          const grain = (h & 7) + dlift; // scorch grain for this stage in the floor's hue
          g.globalAlpha = a;
          g.fillStyle = `rgb(${cr + grain},${cg + grain},${cb + grain})`;
          g.fillRect(ox + gx, oy + gy, pu, pu);
        }
      }
    }
    g.globalAlpha = 1;
    this.scorch = cv;
  }

  /** Procedural crack overlay for a damaged hard block (level 1..3): jagged dark
   *  pixel cracks plus a few knocked-off chips at higher damage. */
  /** Battle scars: blast damage chars the hard block GRADUALLY (like shadow) creeping
   *  IN from the SIDES the blast actually struck. The roof (top face) is never blackened
   *  — a blast hits the walls, not the ceiling — so only a thin band just under the roof
   *  darkens from an overhead hit. Replaces the old pixel cracks for a premium look. */
  private drawSideScorch(px: number, py: number, index: number): void {
    const lvl = this.hardDmg.get(index);
    if (!lvl) return;
    const ctx = this.ctx, t = this.tile;
    const sides = this.hardDmgSide.get(index) ?? 15; // default: all sides if unknown
    const roof = t * 0.26; // top band = block roof, stays clean
    const fy = py + roof, fh = t - roof; // front-face region
    const a = Math.min(0.66, 0.22 + 0.15 * lvl); // deeper char as damage stacks
    const reach = t * 0.58; // how far the char creeps inward
    const char = (a2: number): string => `rgba(9,7,6,${a2.toFixed(3)})`;
    ctx.save();
    const band = (g: CanvasGradient, x: number, y: number, w: number, hh: number, a2: number): void => {
      g.addColorStop(0, char(a2)); g.addColorStop(1, "rgba(9,7,6,0)");
      ctx.fillStyle = g; ctx.fillRect(x, y, w, hh);
    };
    if (sides & 1) band(ctx.createLinearGradient(px, 0, px + reach, 0), px, fy, reach, fh, a); // left wall
    if (sides & 2) band(ctx.createLinearGradient(px + t, 0, px + t - reach, 0), px + t - reach, fy, reach, fh, a); // right wall
    if (sides & 8) band(ctx.createLinearGradient(0, py + t, 0, py + t - reach), px, py + t - reach, t, reach, a); // front (below) wall
    if (sides & 4) band(ctx.createLinearGradient(0, fy, 0, fy + roof * 1.3), px, fy, t, roof * 1.3, a * 0.55); // overhead hit: only a thin band under the roof
    ctx.restore();
  }

  /** Return the player sprite tinted with leg-blood + blast-char, masked to the sprite's
   *  own silhouette. We tint in a REUSED offscreen buffer where `source-atop` is isolated
   *  to the sprite alpha (the previous in-place version bled onto the whole scene). Layers:
   *  char darkens the body (heaviest up top) + stable soot blotches; blood pools on the
   *  lower body with drip streaks + a wet sheen biased toward the arena key light. */
  private tintSkin(img: HTMLImageElement, blood: number, burn: number, id: number, now: number): CanvasImageSource {
    const iw = img.width || 64, ih = img.height || 64;
    const c = (this.skinTint ??= document.createElement("canvas"));
    if (c.width !== iw || c.height !== ih) { c.width = iw; c.height = ih; }
    const g = c.getContext("2d");
    if (!g) return img;
    g.clearRect(0, 0, iw, ih);
    g.drawImage(img, 0, 0, iw, ih);
    g.save();
    g.globalCompositeOperation = "source-atop"; // everything below tints ONLY the sprite pixels
    if (burn > 0.03) {
      const bA = Math.min(0.9, 0.32 + burn * 0.66);
      const bg = g.createLinearGradient(0, 0, 0, ih);
      bg.addColorStop(0, `rgba(14,10,9,${bA.toFixed(3)})`);
      bg.addColorStop(0.5, `rgba(20,14,11,${(bA * 0.72).toFixed(3)})`);
      bg.addColorStop(1, `rgba(28,17,12,${(bA * 0.5).toFixed(3)})`);
      g.fillStyle = bg; g.fillRect(0, 0, iw, ih);
      let h = ((id + 1) * 2654435761) >>> 0;
      const rnd = (): number => { h = (h ^ (h << 13)) >>> 0; h = (h ^ (h >>> 17)) >>> 0; h = (h ^ (h << 5)) >>> 0; return (h & 0xffff) / 0xffff; };
      const blots = Math.round(burn * 6);
      g.fillStyle = `rgba(7,5,4,${Math.min(0.85, 0.42 + burn * 0.45).toFixed(3)})`;
      for (let i = 0; i < blots; i++) {
        g.beginPath(); g.arc(rnd() * iw, rnd() * ih * 0.72, ih * (0.05 + rnd() * 0.07), 0, Math.PI * 2); g.fill();
      }
    }
    if (blood > 0.03) {
      const a = Math.min(0.92, 0.46 + blood * 0.5);
      const top = ih * 0.45;
      const lg = g.createLinearGradient(0, ih, 0, top);
      lg.addColorStop(0, `rgba(90,3,3,${a.toFixed(3)})`);
      lg.addColorStop(0.45, `rgba(120,8,8,${(a * 0.6).toFixed(3)})`);
      lg.addColorStop(1, "rgba(120,8,8,0)");
      g.fillStyle = lg; g.fillRect(0, top, iw, ih - top);
      let h2 = ((id + 7) * 2246822519) >>> 0;
      const rnd2 = (): number => { h2 = (h2 ^ (h2 << 13)) >>> 0; h2 = (h2 ^ (h2 >>> 17)) >>> 0; h2 = (h2 ^ (h2 << 5)) >>> 0; return (h2 & 0xffff) / 0xffff; };
      const drips = 2 + Math.round(blood * 3);
      g.fillStyle = `rgba(78,2,2,${(a * 0.8).toFixed(3)})`;
      for (let i = 0; i < drips; i++) {
        g.fillRect(rnd2() * iw, top + rnd2() * ih * 0.2, iw * (0.035 + rnd2() * 0.05), ih * (0.12 + rnd2() * 0.24));
      }
      // wet sheen: a soft highlight on the side that faces the arena key light
      const lightLeft = this.lx < (GRID_W * this.tile) * 0.5;
      g.fillStyle = `rgba(255,140,140,${(blood * 0.26).toFixed(3)})`;
      g.beginPath(); g.ellipse(lightLeft ? iw * 0.34 : iw * 0.66, ih * 0.82, iw * 0.13, ih * 0.05, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    return c;
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
    if (this.lowFx || !this.shadowsOn) return; // phones / Shadows toggle off: no shadows
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
  private drawAmbient(W: number, H: number, now: number): void {
    const ctx = this.ctx;

    // Time-of-day target brightness (1 = day .. 0 = deep night), eased for smooth switches.
    let target: number;
    switch (this.todMode) {
      case "night": target = 0.16; break;
      case "dusk": target = 0.48; break;
      case "auto": target = 0.18 + 0.82 * (0.5 + 0.5 * Math.sin(now / 28000)); break;
      default: target = 1; // day
    }
    this.tod += (target - this.tod) * 0.04;
    this.tension += (this.tensionTarget - this.tension) * 0.012; // slow swell — builds, never bangs
    const tod = this.tod;
    const dusk = 1 - tod;

    // Per-arena key-light colour, blended toward cool moonlight as night falls.
    const L = ARENA_LIGHT[this.arenaTheme] ?? ARENA_LIGHT.classic;
    const day = L.key.split(",").map(Number);
    const kr = Math.round(120 + (day[0] - 120) * tod);
    const kg = Math.round(150 + (day[1] - 150) * tod);
    const kb = Math.round(210 + (day[2] - 210) * tod);

    // Key-light position: static near top-centre, or slowly orbiting when the
    // dynamic-light option is on (a single moving "sun" over the arena).
    let lx = W * 0.5, ly = H * 0.32;
    if (this.dynLight) {
      lx = W * (0.5 + 0.34 * Math.sin(now / 4300));
      ly = H * (0.34 + 0.2 * Math.cos(now / 5600));
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const reach = Math.hypot(W, H) * (this.dynLight ? 0.52 : 0.62);
    const keyA = (0.05 + 0.12 * tod) * (this.dynLight ? 1.25 : 1);
    const warm = ctx.createRadialGradient(lx, ly, 0, lx, ly, reach);
    warm.addColorStop(0, `rgba(${kr},${kg},${kb},${keyA.toFixed(3)})`);
    warm.addColorStop(0.6, `rgba(${kr},${kg},${kb},${(keyA * 0.4).toFixed(3)})`);
    warm.addColorStop(1, `rgba(${kr},${kg},${kb},0)`);
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Night cool wash over the whole field (darkens + cools toward dusk/night).
    if (dusk > 0.01) {
      ctx.fillStyle = `rgba(28,40,78,${(0.24 * dusk).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Arena-tinted vignette, heavier at night.
    const vigA = 0.20 + 0.30 * dusk;
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.38, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, `rgba(${L.vig},${vigA.toFixed(3)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // End-game "light pressure": the edges close in with a soft warm-dark swell + a faint
    // breathing pulse — dread that builds, never a jump-scare flash.
    if (this.tension > 0.01) {
      const T = this.tension;
      const breathe = 0.85 + 0.15 * Math.sin(now / 900);
      const sw = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * (0.34 - 0.12 * T), W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
      sw.addColorStop(0, "rgba(0,0,0,0)");
      sw.addColorStop(0.7, `rgba(40,2,2,${(0.18 * T * breathe).toFixed(3)})`);
      sw.addColorStop(1, `rgba(8,0,0,${(0.5 * T * breathe).toFixed(3)})`);
      ctx.fillStyle = sw;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Per-arena theatrical accent lights (additive), composed with the day/night cycle —
   *  most sources glow UP at night (factory lamps, neon, swamp glow). Cheap radial fills. */
  private drawArenaLights(W: number, H: number, now: number): void {
    const scene = ARENA_SCENE[this.arenaTheme];
    if (!scene || this.lowFx || !this.atmoOn) return;
    const night = 1 - this.tod;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const diag = Math.hypot(W, H);
    for (let i = 0; i < scene.length; i++) {
      const s = scene[i];
      const flick = 1 - s.flick + s.flick * (0.5 + 0.5 * Math.sin(now / s.spd + i * 1.7));
      const inten = s.a * (1 + s.night * night) * flick;
      if (inten < 0.003) continue;
      const lx = W * s.x, ly = H * s.y, r = diag * s.r * 0.5;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, `rgba(${s.col},${inten.toFixed(3)})`);
      g.addColorStop(1, `rgba(${s.col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /** Subtle wind: a soft light band drifting diagonally across the field. */

  /** Advance a particle by dt with optional BLOCK collision. Gore/debris (`solid`) bounces
   *  off the sides of hard + unbroken-soft blocks — but only near the ground (`z<0.5`), so a
   *  high arc sails OVER a block instead of bouncing in mid-air. Cheap: ≤2 grid lookups. */
  private stepParticle(p: Particle, dt: number): void {
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (!p.solid || (p.z ?? 0) > 0.5) { p.x = nx; p.y = ny; return; }
    const grid = this.prevGrid;
    const blocked = (cx: number, cy: number): boolean => {
      if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return true; // arena edge
      const tt = grid ? grid[cy * GRID_W + cx] : undefined;
      return tt === TileType.HARD || tt === TileType.SOFT;
    };
    const r = p.rest ?? 0.4;
    // Bloody soft gore (meat/organ/brain/limb) SPLATS blood onto the block face it hits.
    const wet = p.gore && (p.gore.kind === "meat" || p.gore.kind === "organ" || p.gore.kind === "brain" || p.gore.kind === "limb");
    const hitX = blocked(Math.floor(nx), Math.floor(p.y));
    if (hitX) { p.vx = -p.vx * r; if (wet && Math.random() < 0.7) this.markBlockBlood(Math.floor(nx) + Math.floor(p.y) * GRID_W, Math.sign(p.vx) || 1, 0); } else p.x = nx;
    const hitY = blocked(Math.floor(p.x), Math.floor(ny));
    if (hitY) { p.vy = -p.vy * r; if (wet && Math.random() < 0.7) this.markBlockBlood(Math.floor(p.x) + Math.floor(ny) * GRID_W, 0, Math.sign(p.vy) || 1); } else p.y = ny;
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
      if (p.vz !== undefined) {
        // Pseudo-3D gore/debris: arc up, fall fast, bounce + stick on the ground.
        p.vz -= (p.gz ?? 26) * dt;
        p.z = (p.z ?? 0) + p.vz * dt;
        this.stepParticle(p, dt);
        if (p.z <= 0) {
          p.z = 0;
          if (Math.abs(p.vz) < 1.1) {
            p.vz = 0; p.vx *= 0.45; p.vy *= 0.45; // settle / friction-stick
            // A flying GORE piece that's basically stopped -> drop it as a persistent decal.
            if (p.gore && Math.abs(p.vx) + Math.abs(p.vy) < 0.45) { this.landGore(p); this.particles.splice(i, 1); continue; }
          } else {
            p.vz = -p.vz * (p.rest ?? 0.4); // bounce
            p.vx *= (p.fric ?? 0.9); p.vy *= (p.fric ?? 0.9);
          }
        }
        const damp = Math.max(0, 1 - 3 * dt); // air resistance "chokes" the flight
        p.vx *= damp; p.vy *= damp;
      } else {
        if (p.gravity) p.vy += p.gravity * dt;
        this.stepParticle(p, dt);
        const drag = p.drag ?? 0.92;
        p.vx *= drag;
        p.vy *= drag;
      }
      if (p.grow) p.size += p.grow * dt;
      if (p.spin) p.rot = (p.rot ?? 0) + p.spin * dt;

      const a = Math.max(0, p.life / p.max);
      const px = p.x * t;
      const py = (p.y - (p.z ?? 0)) * t; // height raises it on screen
      if (p.gore) { // a flying gore piece -> draw it via its own decal renderer, raised by height
        ctx.globalAlpha = 1;
        this.goreDraw(p.gore.kind, ctx, { x: p.x, y: p.y - (p.z ?? 0), seed: p.gore.seed }, Math.max(1, Math.round(t / 24)));
        continue;
      }
      if (p.shape === "flash") {
        ctx.globalCompositeOperation = "lighter";
        // Tiny flashes (ember sparks) twinkle so their bloom PULSES; big flashes
        // (the hot blast core) stay steady.
        const flick = p.size < t * 0.12 ? 0.6 + 0.4 * Math.sin(this.lastTime * 0.045 + p.x * 7.3 + p.y * 5.1) : 1;
        ctx.globalAlpha = a * flick;
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
        const bloodDrawn = !!bm && !this.lowFx && this.drawThemedTile(`hard_blood${bm.n >= 2 ? 2 : 1}_v${variant}`, px, py, flip);
        if (!bloodDrawn) {
          if (!(dmg > 0 && this.drawThemedTile(`hard_dmg${dmg}_v${variant}`, px, py, flip))) {
            this.drawTileSprite("hard", px, py) || this.drawHard(px, py);
            if (dmg > 0 && this.battleScars) this.drawSideScorch(px, py, index);
          }
        }
        if (this.blockDepth && !this.lowFx) this.drawBlockDepth(px, py);
        // Living inner-glow: a soft orange light breathes through the block's window
        // (Chappie / Industrial). Per-block phase offset so they don't pulse in sync.
        const glow = !this.lowFx && this.atmoOn ? ARENA_GLOW[this.arenaTheme] : undefined;
        if (glow && !bloodDrawn && dmg === 0) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 700 + index * 0.7);
          const cx = px + t / 2, cy = py + t * 0.56, r = t * 0.44;
          const nightUp = 1 + 0.9 * (1 - this.tod); // windows glow brighter after dark (night-shift plant)
          const g2 = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g2.addColorStop(0, `rgba(${glow},${((0.10 + 0.22 * pulse) * nightUp).toFixed(3)})`);
          g2.addColorStop(1, `rgba(${glow},0)`);
          this.ctx.save();
          this.ctx.globalCompositeOperation = "lighter";
          this.ctx.fillStyle = g2;
          this.ctx.beginPath(); this.ctx.arc(cx, cy, r, 0, Math.PI * 2); this.ctx.fill();
          this.ctx.restore();
        }
        if (bm) this.drawBlockBlood(px, py, index); // dynamic splatter + drips ON TOP of the block
        if (!this.lowFx && this.lights.length) this.lightCatch(px, py, now);
        break;
      }
      case TileType.SOFT: {
        this.drawShadow(px + t / 2, py + t * 0.95, t * 0.4, t * 0.1, 0.26);
        const sseed = (index * 2654435761) >>> 0;
        const svar = (sseed % 2) + 1;
        const sm = this.bloodBlocks.get(index);
        const sBloodDrawn = !!sm && !this.lowFx && this.drawThemedTile(`soft_blood${sm.n >= 2 ? 2 : 1}_v${svar}`, px, py);
        if (!sBloodDrawn) {
          const sv = ARENA_SOFT_VARIANTS[this.arenaTheme];
          if (sv) {
            this.drawTileSprite(sv[sseed % sv.length], px, py) || this.drawSoft(px, py); // random crystal
          } else {
            ((this.lowFx && this.drawTileSprite("soft_mobile", px, py)) ||
              this.drawTileSprite("soft", px, py) ||
              this.drawSoft(px, py));
          }
        }
        if (this.blockDepth && !this.lowFx) this.drawBlockDepth(px, py);
        if (sm) this.drawBlockBlood(px, py, index); // dynamic splatter + drips ON TOP of the block
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

  /** Draw a theme-specific damaged/bloodied block sprite (key_<theme>). Classic uses
   *  the base classic sprites (our reference standard). For any OTHER theme we draw
   *  its own art ONLY — if it doesn't exist yet we return false so the caller falls
   *  through to the pristine themed block (+ neutral procedural cracks/blood), rather
   *  than slapping the classic sci-fi sprite onto a different-material block. */
  private drawThemedTile(key: string, px: number, py: number, flip = false): boolean {
    if (this.arenaTheme === "classic") return this.drawTileSprite(key, px, py, flip);
    return this.drawTileSprite(`${key}_${this.arenaTheme}`, px, py, flip);
  }

  /** Light-directional face shading: the block face TOWARD the key light gets a faint
   *  warm highlight, the face AWAY falls into shadow — across a gradient aimed at the
   *  light. As the dynamic light orbits, the lit/dark sides rotate, so blocks read as
   *  real lit volumes instead of flat tiles. Cheap (one gradient rect per block).
   *  (Settings → Graphics → Block depth.) */
  private drawBlockDepth(px: number, py: number): void {
    const ctx = this.ctx, t = this.tile;
    const cx = px + t / 2, cy = py + t / 2;
    let ux = this.lx - cx, uy = this.ly - cy;
    const m = Math.hypot(ux, uy) || 1;
    ux /= m; uy /= m; // unit vector toward the light
    const r = t * 0.62;
    const g = ctx.createLinearGradient(cx + ux * r, cy + uy * r, cx - ux * r, cy - uy * r);
    g.addColorStop(0, "rgba(255,248,228,0.12)"); // lit edge (toward light) — warm catch
    g.addColorStop(0.45, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.36)"); // far edge — in shadow
    ctx.fillStyle = g;
    ctx.fillRect(px, py, t, t);
  }

  /** THRESHOLD bloom: isolate only the brightest pixels (explosions, glints, glowing
   *  blocks), blur those, and add them back — so highlights bleed but the scene,
   *  blocks and the hero stay sharp and aren't washed out. Off by default (perf).
   *  (Settings → Graphics → Bloom.) */
  private drawBloom(W: number, H: number): void {
    const ctx = this.ctx;
    const src = ctx.canvas;
    if (!this.bloomCv) this.bloomCv = document.createElement("canvas");
    const bc = this.bloomCv;
    if (bc.width !== W || bc.height !== H) { bc.width = W; bc.height = H; }
    const bctx = bc.getContext("2d");
    if (!bctx) return;
    // Threshold: bc = src^3. Multiplying the frame by itself crushes dark + mid
    // tones (0.5³≈0.13) while highlights (≈1) survive — only truly bright areas remain.
    bctx.globalCompositeOperation = "source-over";
    bctx.clearRect(0, 0, W, H);
    bctx.drawImage(src, 0, 0, W, H);
    bctx.globalCompositeOperation = "multiply";
    bctx.drawImage(src, 0, 0, W, H);
    bctx.drawImage(src, 0, 0, W, H);
    bctx.globalCompositeOperation = "source-over";
    // Add the blurred highlights back over the scene.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
    ctx.filter = "blur(7px)";
    ctx.drawImage(bc, 0, 0, W, H);
    ctx.restore();
    ctx.filter = "none";
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
