// Player-facing settings, persisted in localStorage.

export type ControlScheme = "joystick" | "dpad" | "tilt";
/** Which fiat/crypto unit token values are converted to for display. */
export type ValueUnit = "usd" | "sol";
/** How balances read: token amount with an ≈ conversion, or purely the money value. */
export type ValueMode = "token" | "fiat";
/** Arena block skin: the classic grass/blocks, or a themed material set. */
export type ArenaTheme = "classic" | "vault" | "cyber" | "void" | "desert" | "industrial" | "chappie" | "meme" | "degen" | "pepe";

export interface Settings {
  music: boolean;
  sfx: boolean;
  controls: ControlScheme;
  gore: boolean; // false -> deaths spill gold coins instead of blood/guts
  valueUnit: ValueUnit; // show token worth in USD ($) or SOL (◎)
  valueMode: ValueMode; // "token" = 💎1,000 ≈$x · "fiat" = show the $/◎ value as primary
  repeatOne: boolean; // BOMBERMEME FM: loop the current lobby track instead of shuffling on
  liteGfx: boolean; // force the lighter render (no blur/fireflies/dust) for weak devices
  arenaTheme: ArenaTheme; // which block/floor material set the arena renders with
  musicVolume: number; // 0..1 music volume
  sfxVolume: number; // 0..1 sound-effects volume
  ambientFx: boolean; // per-arena ambient atmosphere motes
  grassTexture: boolean; // Classic floor: false = animated grass, true = static texture
  gfxPreset: GfxPreset; // graphics quality preset; "custom" once any graphics toggle is changed by hand
  blockDepth: boolean; // light-directional face shading on blocks (carved volume)
  dynamicLight: boolean; // single slow-moving arena key light
  bloom: boolean; // soft bloom / glow on bright areas
  shadows: boolean; // directional cast shadows from the key light
  particleDensity: number; // 0.5..2.5 — physics-particle count multiplier (crank up on strong PCs)
  timeOfDay: TimeOfDay; // arena time-of-day mood: fixed day/dusk/night or a slow auto cycle
  battleScars: boolean; // hard blocks char from the blast-hit sides as they take damage
}

export type GfxPreset = "low" | "medium" | "high" | "custom";
export type TimeOfDay = "day" | "dusk" | "night" | "auto";

const KEY = "bp_settings";

const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const DEFAULTS: Settings = {
  music: true,
  sfx: true,
  controls: isTouch ? "joystick" : "dpad",
  gore: true,
  valueUnit: "usd",
  valueMode: "token",
  repeatOne: false,
  liteGfx: false,
  arenaTheme: "classic",
  musicVolume: 0.7,
  sfxVolume: 1,
  // Default to MEDIUM — a safe mid-tier that runs on phones and mid PCs. Only
  // block-depth shading is on; the heavy effects (cast shadows, bloom, ambient
  // motes, moving key light) are HIGH-only and opt-in. This is the biggest lever
  // against the lag reports; strong PCs can bump to High in Settings → Graphics.
  ambientFx: false,
  grassTexture: false,
  gfxPreset: "medium",
  blockDepth: true,
  dynamicLight: false,
  bloom: false,
  shadows: false,
  particleDensity: 1,
  timeOfDay: "day",
  battleScars: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}
