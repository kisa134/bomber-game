// Telegram Mini App <-> Phantom deeplink relay.
//
// Phantom returns its encrypted response (connect / signMessage / signAndSend)
// to an https `redirect_link`. We can't pass that >512B blob back into the Mini
// App through Telegram's `startapp` parameter, so Phantom redirects to /tg/cb,
// which stashes the blob here keyed by a short opaque `state`, then bounces the
// user back into the Mini App via t.me/<bot>/<app>?startapp=<state>. The client
// reads the state, fetches the blob from /tg/relay/:state, and decrypts it.

import { randomBytes } from "node:crypto";

interface RelayEntry {
  payload: string; // raw query string from Phantom's redirect
  ts: number;
}

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 1000;
const store = new Map<string, RelayEntry>();

const BOT = process.env.TG_BOT ?? "";
const APP = process.env.TG_APP ?? "";

function sweep(): void {
  const now = Date.now();
  for (const [k, v] of store) if (now - v.ts > TTL_MS) store.delete(k);
}

/** Reserve a fresh state id (no payload yet). */
export function newRelayState(): string {
  sweep();
  if (store.size >= MAX_ENTRIES) {
    let oldestK: string | null = null;
    let oldestT = Infinity;
    for (const [k, v] of store) if (v.ts < oldestT) ((oldestT = v.ts), (oldestK = k));
    if (oldestK) store.delete(oldestK);
  }
  const state = randomBytes(9).toString("base64url");
  store.set(state, { payload: "", ts: Date.now() });
  return state;
}

/** Store Phantom's response for a state (creates the entry if it expired). */
export function putRelayPayload(state: string, payload: string): void {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(state)) return;
  store.set(state, { payload, ts: Date.now() });
}

/** Read and consume a stored payload. Returns null if missing/empty. */
export function takeRelayPayload(state: string): string | null {
  sweep();
  const e = store.get(state);
  if (!e || !e.payload) return null;
  store.delete(state);
  return e.payload;
}

/** Tiny HTML page that bounces the user back into the Mini App.
 *  We auto-redirect via the tg:// scheme (resolves straight to the Mini App and
 *  avoids the t.me web page that can land on the bot CHAT instead of the app),
 *  and show the https t.me link as a tappable fallback.
 *
 *  CONFIG: `TG_BOT` = the bot username (no @). `TG_APP` = the BotFather Mini App
 *  short name (from /newapp). If you use the Main Mini App (Bot Settings → enable,
 *  no short name) leave `TG_APP` empty — but the Main Mini App MUST be enabled,
 *  otherwise the link opens the bot chat (the "it just opens the bot" bug). */
export function reopenHtml(state: string): string {
  const s = encodeURIComponent(state);
  const tg = BOT
    ? APP
      ? `tg://resolve?domain=${BOT}&appname=${APP}&startapp=${s}`
      : `tg://resolve?domain=${BOT}&startapp=${s}`
    : "";
  const https = BOT
    ? APP
      ? `https://t.me/${BOT}/${APP}?startapp=${s}`
      : `https://t.me/${BOT}?startapp=${s}`
    : "";
  const tgJson = JSON.stringify(tg);
  const httpsJson = JSON.stringify(https);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Returning…</title>
<style>html,body{height:100%}body{margin:0;background:#0e1018;color:#e7e9ee;
font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;
justify-content:center;text-align:center;padding:24px}a{color:#ffcc33;font-weight:700;
text-decoration:none;font-size:1.1rem}</style></head><body><div>
<p>Returning to Bombermeme…</p>
${https ? `<p><a id="open" href="${https}">Tap to reopen the game ▸</a></p>` : `<p>Reopen the game from your Telegram chat.</p>`}
</div><script>
${tg || https ? `(function(){var tg=${tgJson},h=${httpsJson};
  // Prefer the tg:// scheme (lands on the Mini App), fall back to https t.me.
  try{ if(tg) location.href=tg; }catch(e){}
  setTimeout(function(){ try{ if(h) location.replace(h); }catch(e){} }, 600);
})();` : ""}
</script>
</body></html>`;
}
