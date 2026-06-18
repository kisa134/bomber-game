# Analytics & admin dashboard

PostHog is the hub: client events (autocapture, pageviews, **session replay**,
web analytics) come from the browser via `posthog-js`, and authoritative events
(match results, deposits, withdrawals) come from the server. Google Analytics 4
and Microsoft Clarity run alongside for their native strengths. A self-hosted
live `/admin` panel gives an at-a-glance pulse for streaming.

Everything is optional — each integration stays inert until its key is set.

## Environment variables

| Var | Where | Set in | Purpose |
| --- | --- | --- | --- |
| `VITE_POSTHOG_KEY` | client (build) | Render env (build arg) | PostHog publishable key `phc_…` |
| `VITE_POSTHOG_HOST` | client (build) | optional | defaults to `https://us.i.posthog.com` |
| `VITE_GA_ID` | client (build) | Render env (build arg) | GA4 measurement id `G-…` |
| `VITE_CLARITY_ID` | client (build) | Render env (build arg) | Microsoft Clarity project id |
| `POSTHOG_KEY` | server (runtime) | Render env | server-side PostHog key (same project) |
| `POSTHOG_HOST` | server (runtime) | optional | defaults to `https://us.i.posthog.com` |
| `ADMIN_TOKEN` | server (runtime) | Render env | password(s) for `/admin` — comma-separate for several people, e.g. `me123,friend456` |
| `POSTHOG_EMBED_URL` | server (runtime) | Render env | PostHog shared dashboard embed URL — embeds the whole PostHog dashboard inside `/admin` |
| `GA_DASHBOARD_URL` | server (runtime) | Render env | Google Analytics link (a button in `/admin`; GA can't be iframed) |
| `GA_EMBED_URL` | server (runtime) | Render env | optional Looker Studio (GA4) report URL — this *can* be iframed inside `/admin` |
| `CLARITY_DASHBOARD_URL` | server (runtime) | Render env | Microsoft Clarity link (a button in `/admin`; Clarity can't be iframed) |

> `VITE_*` are **build-time**: the Dockerfile declares matching `ARG`s, and
> Render passes a service env var of the same name as a Docker build arg, so the
> values are baked into the bundle. Change one → trigger a redeploy.

Where to find the PostHog keys: PostHog → Project settings. Use the **same**
project key for `VITE_POSTHOG_KEY` and `POSTHOG_KEY` so client + server events
land together.

## Events

- **Client** (`apps/client/src/analytics.ts`): `$pageview` + autocapture
  automatically, plus `app_loaded`, `play_start`, `wallet_connected`,
  `match_started`, `match_ended`, `skin_bought`, `client_error`, …
- **Server** (`apps/server/src/analytics.ts`): `match_completed`
  (winner/players/stake/ranked), `deposit_credited`, `withdrawal`.

## Live admin dashboard

Open `https://<your-domain>/admin`, enter `ADMIN_TOKEN`. It polls `/admin/stats`
every 5s and shows: players online (+bots), rooms (playing/lobby), matches since
restart, deposit/withdraw volume, and the top players. Token is stored in the
browser's localStorage. Counters labelled "since restart" reset on redeploy;
all-time depth lives in PostHog.

### Embedding PostHog inside /admin (single control center)

To see the PostHog charts inside our own `/admin` (no second login): open the
dashboard in PostHog → **Share** → enable sharing → copy the **embed URL** (looks
like `https://us.posthog.com/embedded/<token>`) → set it as `POSTHOG_EMBED_URL`
in Render. The iframe is only revealed to authed admins (the URL is served via
the token-gated `/admin/stats`, not the public page).

## PostHog dashboard

A "Bombermeme — Overview" dashboard is set up in PostHog with tiles for
visitors, traffic sources, the land→connect→play→deposit funnel, retention,
matches, and the economy. Session replays are under **Session Replay**; web
analytics under **Web Analytics**.
