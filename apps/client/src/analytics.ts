// Tiny, dependency-free PostHog client. Fires product events and JS errors to
// the capture endpoint. Completely inert unless VITE_POSTHOG_KEY is set, so the
// game never depends on it and no key is hard-coded.

import { POSTHOG_KEY, POSTHOG_HOST } from "./config.js";

const ENABLED = POSTHOG_KEY.length > 0;

function distinctId(): string {
  let id = localStorage.getItem("bp_aid");
  if (!id) {
    id = "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("bp_aid", id);
  }
  return id;
}

/** Send one event (fire-and-forget). No-op when analytics is disabled. */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (!ENABLED) return;
  try {
    const body = JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId(),
      properties: { ...properties, $lib: "bomberpump-web" },
      timestamp: new Date().toISOString(),
    });
    void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the game */
  }
}

/** Identify the player by wallet once they connect (still anonymous-friendly). */
export function identifyWallet(wallet: string): void {
  track("$identify", { $set: { wallet } });
}

/** Capture uncaught errors so we can see crashes in the wild. */
export function initErrorTracking(): void {
  if (!ENABLED) return;
  window.addEventListener("error", (e) => {
    track("client_error", { message: e.message, source: e.filename, line: e.lineno });
  });
  window.addEventListener("unhandledrejection", (e) => {
    track("client_error", { message: String((e as PromiseRejectionEvent).reason) });
  });
}
