// SINGLE SOURCE OF TRUTH per arena — one entry = a map's full physical + visual identity
// (block/floor sprites, ambient motes, key light, accent light scenario, floor material).
// Add a NEW map by adding ONE entry here; the renderer derives everything from it. This is
// the per-map config the arena engine (Canvas2D today, PixiJS next) reads.
import type { ArenaTheme } from "../settings.js";

export type SceneLight = { x: number; y: number; r: number; col: string; a: number; night: number; flick: number; spd: number };

export interface ArenaConfig {
  /** Themed hard/soft/floor sprite set. Absent for "classic" (uses the base sprites). */
  sprites?: { hard: string; soft: string; floor: string };
  /** Ambient drifting motes. color "r,g,b"; vx/vy px/s; sq = square data-bit vs soft dot; n = density. */
  atmosphere: { color: string; vx: number; vy: number; n: number; sq: boolean; size: number };
  /** Breathing hard-block window glow "r,g,b" (only "living" blocks). */
  glow?: string;
  /** Key-light mood: overhead light colour + vignette tint. "r,g,b". Day/night modulates it. */
  light: { key: string; vig: string };
  /** Theatrical accent lights (intensify at night). x,y fraction of viewport; r reach; a base alpha. */
  scene?: SceneLight[];
  /** Surface material — drives floor charring AND blood behaviour on it (char hue/max, absorb, gloss, dry). */
  floor: { char: [number, number, number]; max: number; absorb: number; gloss: number; dry: number };
}

export const ARENA_CONFIG: Record<ArenaTheme, ArenaConfig> = {
  classic: {
    atmosphere: { color: "255,236,140", vx: 6, vy: -10, n: 16, sq: false, size: 2.2 },
    light: { key: "255,196,120", vig: "18,10,4" },
    floor: { char: [26, 18, 9], max: 1.0, absorb: 0.5, gloss: 0.6, dry: 1.0 },
  },
  vault: {
    sprites: { hard: "hard_gold", soft: "soft_ammo", floor: "floor_grate" },
    atmosphere: { color: "255,210,90", vx: 4, vy: -8, n: 18, sq: false, size: 2.0 },
    light: { key: "255,206,110", vig: "20,14,2" },
    scene: [{ x: 0.5, y: 0.08, r: 0.72, col: "255,200,90", a: 0.08, night: 1.3, flick: 0.06, spd: 300 }],
    floor: { char: [22, 20, 18], max: 0.92, absorb: 0.3, gloss: 0.9, dry: 1.3 },
  },
  cyber: {
    sprites: { hard: "hard_stone", soft: "soft_cyberglass", floor: "floor_neon" },
    atmosphere: { color: "90,230,255", vx: 0, vy: -16, n: 22, sq: true, size: 2.0 },
    light: { key: "120,210,255", vig: "4,8,22" },
    scene: [
      { x: 0.5, y: -0.02, r: 0.9, col: "80,200,255", a: 0.07, night: 1.5, flick: 0.1, spd: 95 },
      { x: 0.18, y: 0.92, r: 0.46, col: "255,60,200", a: 0.06, night: 1.7, flick: 0.16, spd: 125 },
    ],
    floor: { char: [16, 18, 24], max: 0.95, absorb: 0.1, gloss: 1.3, dry: 2.0 },
  },
  void: {
    sprites: { hard: "hard_obsidian", soft: "soft_void2", floor: "floor_void" },
    atmosphere: { color: "176,124,255", vx: 3, vy: -9, n: 18, sq: false, size: 2.4 },
    light: { key: "182,132,255", vig: "10,4,22" },
    scene: [{ x: 0.5, y: 0.5, r: 0.82, col: "150,80,255", a: 0.06, night: 1.6, flick: 0.22, spd: 210 }],
    floor: { char: [16, 8, 24], max: 1.0, absorb: 0.2, gloss: 1.1, dry: 1.4 },
  },
  desert: {
    sprites: { hard: "hard_sand", soft: "soft_sand", floor: "floor_sand" },
    atmosphere: { color: "228,198,138", vx: 26, vy: 3, n: 22, sq: false, size: 1.8 },
    light: { key: "255,224,150", vig: "26,18,6" },
    scene: [{ x: 0.86, y: 0.86, r: 0.3, col: "255,150,60", a: 0.05, night: 2.4, flick: 0.42, spd: 95 }],
    floor: { char: [46, 33, 18], max: 0.66, absorb: 0.95, gloss: 0.05, dry: 0.5 },
  },
  industrial: {
    sprites: { hard: "hard_industrial", soft: "soft_industrial", floor: "floor_industrial" },
    atmosphere: { color: "255,168,60", vx: 5, vy: -12, n: 16, sq: true, size: 1.8 },
    glow: "255,140,30",
    light: { key: "255,168,80", vig: "16,8,2" },
    scene: [
      { x: 0.1, y: 0.18, r: 0.5, col: "255,140,40", a: 0.10, night: 1.9, flick: 0.28, spd: 140 },
      { x: 0.9, y: 0.24, r: 0.5, col: "255,116,28", a: 0.10, night: 1.9, flick: 0.34, spd: 175 },
    ],
    floor: { char: [17, 15, 15], max: 1.0, absorb: 0.1, gloss: 1.2, dry: 1.8 },
  },
  chappie: {
    sprites: { hard: "hard_chappie", soft: "soft_chappie2", floor: "floor_chappie" },
    atmosphere: { color: "255,210,150", vx: 4, vy: -7, n: 14, sq: false, size: 2.0 },
    glow: "255,150,40",
    light: { key: "255,200,150", vig: "14,10,6" },
    scene: [{ x: 0.14, y: 0.14, r: 0.42, col: "255,150,40", a: 0.08, night: 1.7, flick: 0.22, spd: 130 }],
    floor: { char: [24, 18, 12], max: 0.9, absorb: 0.4, gloss: 0.7, dry: 1.1 },
  },
  meme: {
    sprites: { hard: "hard_meme", soft: "soft_meme2", floor: "floor_meme" },
    atmosphere: { color: "100,255,150", vx: 0, vy: -13, n: 20, sq: true, size: 1.8 },
    glow: "120,230,255",
    light: { key: "120,235,170", vig: "4,16,8" },
    scene: [{ x: 0.5, y: 0.06, r: 0.82, col: "120,230,255", a: 0.08, night: 1.7, flick: 0.05, spd: 80 }],
    floor: { char: [20, 15, 18], max: 0.95, absorb: 0.2, gloss: 1.0, dry: 1.3 },
  },
  degen: {
    sprites: { hard: "hard_degen", soft: "soft_degen", floor: "floor_degen" },
    atmosphere: { color: "210,200,180", vx: 14, vy: -4, n: 14, sq: false, size: 1.8 },
    light: { key: "232,212,170", vig: "14,12,8" },
    scene: [{ x: 0.5, y: 0.04, r: 0.6, col: "255,200,120", a: 0.06, night: 1.6, flick: 0.12, spd: 110 }],
    floor: { char: [16, 16, 17], max: 1.0, absorb: 0.35, gloss: 0.7, dry: 1.0 },
  },
  pepe: {
    sprites: { hard: "hard_pepe", soft: "soft_pepe", floor: "floor_pepe" },
    atmosphere: { color: "150,235,120", vx: 7, vy: -6, n: 16, sq: false, size: 2.0 },
    light: { key: "150,230,130", vig: "6,14,6" },
    scene: [{ x: 0.32, y: 0.7, r: 0.5, col: "120,220,90", a: 0.06, night: 1.5, flick: 0.2, spd: 165 }],
    floor: { char: [12, 20, 12], max: 0.84, absorb: 0.6, gloss: 0.5, dry: 1.6 },
  },
};

// ── Derived views (so existing renderer reads ARENA_LIGHT[t] / FLOOR_PHYSICS[t] etc. are unchanged) ──
const THEMES = Object.keys(ARENA_CONFIG) as ArenaTheme[];
export const ARENA_LIGHT = Object.fromEntries(THEMES.map((t) => [t, ARENA_CONFIG[t].light])) as Record<ArenaTheme, ArenaConfig["light"]>;
export const FLOOR_PHYSICS = Object.fromEntries(THEMES.map((t) => [t, ARENA_CONFIG[t].floor])) as Record<ArenaTheme, ArenaConfig["floor"]>;
export const ATMOSPHERE = Object.fromEntries(THEMES.map((t) => [t, ARENA_CONFIG[t].atmosphere])) as Record<ArenaTheme, ArenaConfig["atmosphere"]>;
export const ARENA_GLOW: Partial<Record<ArenaTheme, string>> = Object.fromEntries(THEMES.filter((t) => ARENA_CONFIG[t].glow).map((t) => [t, ARENA_CONFIG[t].glow as string]));
export const ARENA_SCENE: Partial<Record<ArenaTheme, SceneLight[]>> = Object.fromEntries(THEMES.filter((t) => ARENA_CONFIG[t].scene).map((t) => [t, ARENA_CONFIG[t].scene as SceneLight[]]));
export const ARENA_THEMES = Object.fromEntries(THEMES.filter((t) => ARENA_CONFIG[t].sprites).map((t) => [t, ARENA_CONFIG[t].sprites as { hard: string; soft: string; floor: string }])) as Record<Exclude<ArenaTheme, "classic">, { hard: string; soft: string; floor: string }>;
