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
