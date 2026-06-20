# Telegram Mini App + PWA setup

The same single-origin build (server serves `apps/client/dist`) runs as a normal
web app, an installable PWA, and a Telegram Mini App. No separate deployment.

## 1. Deploy

Deploy the server (it serves the client) behind **HTTPS** — Telegram and PWAs
both require it. Set these env vars on the server:

| Var | Purpose | Example |
| --- | --- | --- |
| `TG_BOT` | Bot username (no `@`) | `BombermemeBot` |
| `TG_APP` | Mini App short name (from BotFather `/newapp`) | `play` |
| `SOLANA_RPC` | (already used) RPC endpoint for token | Helius/QuickNode URL |
| `TREASURY_ADDRESS` / `TREASURY_SECRET` | (already used) custodial treasury | … |

`TG_BOT` + `TG_APP` are used only by the wallet deeplink relay to bounce the
user back into the Mini App. Leave them unset for plain web/PWA — wallet-in-
Telegram simply won't be offered.

> ⚠️ **"After approving in the wallet it just opens the bot chat, not the game"**
> is almost always a `TG_BOT`/`TG_APP` config problem:
> - If you created a **named** Mini App with `/newapp`, set `TG_APP` to that exact
>   short name. The relay then returns to `tg://resolve?domain=<bot>&appname=<app>`.
> - If you use the **Main** Mini App (Bot Settings → Configure Mini App, no short
>   name), leave `TG_APP` empty — but the Main Mini App **must be enabled**, or
>   `t.me/<bot>` opens the chat instead of the app.
> The return page now auto-redirects via the `tg://` scheme (lands on the app)
> with a tappable `t.me` fallback, but it still needs these values to be correct.

## 2. BotFather

1. `/newbot` → create the bot, note its username → `TG_BOT`.
2. `/newapp` → pick the bot, give it a title/description/icon, and set the
   **Web App URL** to your deployed HTTPS origin (e.g. `https://bombermeme.fun`).
   The short name you choose here is `TG_APP`.
3. (Optional) `/setmenubutton` → set the menu button to open the Mini App so
   users can launch it from any chat with the bot.

Direct launch link: `https://t.me/<TG_BOT>/<TG_APP>`.

## 3. How the in-Telegram wallet works

Telegram's webview has no wallet extension, so we drive **encrypted wallet
deeplinks** with a server relay (`apps/server/src/tgrelay.ts`, client
`apps/client/src/net/telegram-wallet.ts`). Both **Phantom** and **Solflare**
implement the same universal-link protocol, so the connect modal offers both
(`TG_WALLETS`); the chosen wallet drives the whole connect→sign→deposit flow:

```
Mini App ──(open Phantom deeplink, redirect_link=/tg/cb?state=…)──▶ Phantom app
Phantom ──(redirect with encrypted blob)──▶ /tg/cb  (stores blob by state)
/tg/cb ──(t.me/<bot>/<app>?startapp=<state>)──▶ Mini App reopens
Mini App ──GET /tg/relay/<state>──▶ encrypted blob ──(nacl.box decrypt)──▶ done
```

Connect is two round-trips: **connect** (get pubkey + Phantom session) then
**signMessage** (sign the `/auth/nonce` challenge → `/auth/verify` → session).
Deposits reuse `buildDepositTx` and round-trip through Phantom
`signAndSendTransaction`. Custodial deposit/withdraw on the server are unchanged.

### Known limitation

`signMessage` over Phantom deeplinks inside some Telegram clients is documented
to fail (error 32603). We retry and surface a clear error. If it proves
unreliable in the wild, the drop-in fallback is an embedded wallet (Privy /
Dynamic) wrapped in the same adapter seam in `telegram-wallet.ts` — the rest of
the app (modal, reauth, bank) is unaffected.

## 4. PWA

`vite-plugin-pwa` generates `manifest.webmanifest` + `sw.js` into `dist/`. The
manifest requests `display: fullscreen` + `orientation: landscape`. Icons are
SVG (`public/icons/icon.svg`, `maskable.svg`) plus a PNG `icon-180.png` for the
iOS home screen. The server serves `.webmanifest` as `application/manifest+json`
and `sw.js`/`index.html` as `no-cache` so updates land immediately.

iOS ignores manifest `orientation`/`fullscreen`; there it relies on the
installed standalone PWA plus the in-game rotate hint.
