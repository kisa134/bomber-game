// Server endpoint. Override at build time with VITE_SERVER_URL.
const HTTP_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787";

export const SERVER_HTTP = HTTP_URL;
export const SERVER_WS = HTTP_URL.replace(/^http/, "ws") + "/ws";

// Render-time interpolation delay (ms). We render the world this far in the
// past so we always have two snapshots to lerp between.
export const INTERP_DELAY_MS = 100;
