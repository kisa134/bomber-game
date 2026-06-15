// Server endpoint.
// - In dev (vite on :5173) we talk to the local server on :8787.
// - In a production build the client is served BY the server, so we default to
//   the same origin. Override either with VITE_SERVER_URL at build time.
const explicit = import.meta.env.VITE_SERVER_URL;
const fallback = import.meta.env.DEV ? "http://localhost:8787" : window.location.origin;
const HTTP_URL = explicit ?? fallback;

export const SERVER_HTTP = HTTP_URL;
export const SERVER_WS = HTTP_URL.replace(/^http/, "ws") + "/ws";

// Render-time interpolation delay (ms). We render the world this far in the
// past so we always have two snapshots to lerp between.
export const INTERP_DELAY_MS = 100;

// Product analytics (PostHog). Both are optional — analytics is a no-op until
// VITE_POSTHOG_KEY is provided at build time. The key is a publishable client
// ingest key (phc_...), safe to ship in the bundle.
export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? "";
export const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";
