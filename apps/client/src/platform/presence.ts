// Lightweight presence heartbeat. A WebSocket only exists once you're in a
// match, so to know who simply has the game open (menu/lobby/match) we ping a
// cheap endpoint every 20s with a stable anonymous id. Powers the /admin panel.

import { SERVER_HTTP } from "../config.js";

const ID_KEY = "bp_pid";
let id = localStorage.getItem(ID_KEY) ?? "";
if (!id) {
  id =
    (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  localStorage.setItem(ID_KEY, id);
}

function beat(): void {
  if (document.visibilityState === "hidden") return; // don't count backgrounded tabs
  try {
    void fetch(`${SERVER_HTTP}/presence?id=${encodeURIComponent(id)}`, {
      method: "GET",
      keepalive: true,
      cache: "no-store",
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function startPresence(): void {
  beat();
  setInterval(beat, 20_000);
  // Beat immediately when the tab comes back to the foreground.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") beat();
  });
}
