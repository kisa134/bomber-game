// Telegram Mini App integration. All calls are no-ops outside Telegram, so the
// same build runs as a normal web app / PWA and as a Mini App. The SDK is loaded
// from telegram.org in index.html and exposes window.Telegram.WebApp.

interface TgWebApp {
  initData: string;
  platform?: string;
  version?: string;
  initDataUnsafe?: { start_param?: string };
  themeParams?: Record<string, string>;
  contentSafeAreaInset?: { top: number; right: number; bottom: number; left: number };
  ready(): void;
  expand(): void;
  isVersionAtLeast?(v: string): boolean;
  requestFullscreen?(): void;
  lockOrientation?(o: string): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  setBottomBarColor?(c: string): void;
  openLink?(url: string, opts?: { try_instant_view?: boolean }): void;
}

export const tg: TgWebApp | null =
  (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null;

/** True only when actually launched inside Telegram (initData is populated). */
export const isTelegram = !!tg && typeof tg.initData === "string" && tg.initData.length > 0;

const BG = "#0e1018";

/** Initialize the Mini App: expand to full height, go fullscreen, lock landscape
 *  and stop vertical swipes from closing the app mid-game. Guarded for old
 *  clients. Safe to call unconditionally — returns early outside Telegram. */
export function initTelegram(): void {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    if (tg.isVersionAtLeast?.("8.0")) {
      tg.requestFullscreen?.();
      tg.lockOrientation?.("landscape");
    }
    // Critical for a game: otherwise dragging the joystick swipes the app closed.
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.(BG);
    tg.setBackgroundColor?.(BG);
    tg.setBottomBarColor?.(BG);
    applyContentSafeArea();
  } catch {
    /* old Telegram client — ignore unsupported methods */
  }
}

/** Telegram's fullscreen overlaps its own header buttons; mirror the reported
 *  content inset into the same CSS vars the layout uses so the HUD clears them. */
function applyContentSafeArea(): void {
  const i = tg?.contentSafeAreaInset;
  if (!i) return;
  const root = document.documentElement.style;
  root.setProperty("--sai-top", `${i.top}px`);
  root.setProperty("--sai-right", `${i.right}px`);
  root.setProperty("--sai-bottom", `${i.bottom}px`);
  root.setProperty("--sai-left", `${i.left}px`);
}

/** The startapp deep-link parameter (used by the Telegram wallet relay). */
export function getStartParam(): string | null {
  return (
    tg?.initDataUnsafe?.start_param ??
    new URLSearchParams(location.search).get("tgWebAppStartParam") ??
    null
  );
}

/** Open a URL outside the webview (e.g. a Phantom deeplink). */
export function openExternal(url: string): void {
  if (tg?.openLink) tg.openLink(url, { try_instant_view: false });
  else window.open(url, "_blank");
}
