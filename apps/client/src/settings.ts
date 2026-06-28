// Player-facing settings, persisted in localStorage.

export type ControlScheme = "joystick" | "dpad" | "tilt";
/** Which fiat/crypto unit token values are converted to for display. */
export type ValueUnit = "usd" | "sol";
/** How balances read: token amount with an ≈ conversion, or purely the money value. */
export type ValueMode = "token" | "fiat";
/** Arena block skin: the classic grass/blocks, or a themed material set. */
export type ArenaTheme = "classic" | "vault" | "cyber" | "void" | "desert";

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
}

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
