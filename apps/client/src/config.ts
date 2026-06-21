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

// Analytics keys can come from TWO places, in priority order:
//   1. window.__CFG__  — injected at RUNTIME by the server (/runtime-config.js)
//      from its env vars. This is robust: set the key in the deploy dashboard
//      and it works WITHOUT a client rebuild (fixes the "GA baked empty at build
//      time" trap).
//   2. import.meta.env.VITE_* — baked at build time (still works for dev/.env).
// All optional — each integration stays a no-op until its key is non-empty.
interface RuntimeCfg {
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
  GA_ID?: string;
  CLARITY_ID?: string;
}
const RT: RuntimeCfg = (typeof window !== "undefined" && (window as unknown as { __CFG__?: RuntimeCfg }).__CFG__) || {};

export const POSTHOG_KEY = RT.POSTHOG_KEY || import.meta.env.VITE_POSTHOG_KEY || "";
export const POSTHOG_HOST = RT.POSTHOG_HOST || import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
// Google Analytics 4 measurement id (G-XXXXXXX). Optional; no-op when unset.
export const GA_ID = RT.GA_ID || import.meta.env.VITE_GA_ID || "";
// Microsoft Clarity project id. Optional; no-op when unset.
export const CLARITY_ID = RT.CLARITY_ID || import.meta.env.VITE_CLARITY_ID || "";
