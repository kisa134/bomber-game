// Immersive mode for mobile web: request fullscreen + lock landscape. Must be
// called from a user gesture (e.g. a Play/Ready tap). Everything is best-effort
// and wrapped in try/catch — iOS Safari ignores both APIs (it relies on the
// installed-PWA standalone mode and the #rotate-hint fallback instead).

import { isTelegram } from "./telegram.js";

interface OrientationLock extends ScreenOrientation {
  lock?(orientation: "landscape" | "portrait" | string): Promise<void>;
}

let attempted = false;

export async function enterImmersive(): Promise<void> {
  // Telegram drives its own fullscreen/orientation; don't fight it.
  if (isTelegram) return;
  // Only on touch devices, and don't spam the API once we've tried.
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  if (attempted) return;
  attempted = true;
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    }
  } catch {
    /* not allowed / unsupported — fine */
  }
  try {
    await (screen.orientation as OrientationLock | undefined)?.lock?.("landscape");
  } catch {
    /* iOS Safari and desktop reject this — rotate-hint covers it */
  }
}
