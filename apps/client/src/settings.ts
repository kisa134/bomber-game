// Player-facing settings, persisted in localStorage.

export type ControlScheme = "joystick" | "dpad";
/** Which fiat/crypto unit token values are converted to for display. */
export type ValueUnit = "usd" | "sol";

export interface Settings {
  music: boolean;
  sfx: boolean;
  controls: ControlScheme;
  gore: boolean; // false -> deaths spill gold coins instead of blood/guts
  valueUnit: ValueUnit; // show token worth in USD ($) or SOL (◎)
}

const KEY = "bp_settings";

const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const DEFAULTS: Settings = {
  music: true,
  sfx: true,
  controls: isTouch ? "joystick" : "dpad",
  gore: true,
  valueUnit: "usd",
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
