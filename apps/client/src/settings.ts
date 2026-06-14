// Player-facing settings, persisted in localStorage.

export type ControlScheme = "joystick" | "dpad";

export interface Settings {
  music: boolean;
  sfx: boolean;
  controls: ControlScheme;
}

const KEY = "bp_settings";

const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const DEFAULTS: Settings = {
  music: true,
  sfx: true,
  controls: isTouch ? "joystick" : "dpad",
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
