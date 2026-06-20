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

## Acquisition / UTM attribution

`captureAttribution()` (`apps/client/src/analytics.ts`) reads the **first-touch**
`utm_source/medium/campaign/term/content` + `referrer` + `landing` on the first
visit that has them, persists them (`localStorage bp_attr`), and reuses them
forever after. They are then:

- **registered as PostHog super-properties** → ride on *every* client event,
  including `play_start` and (via the same person) revenue — so you can break
  down matches/deposits/retention **by `utm_source`/`utm_campaign`**, not just
  the entry pageview;
- **stamped once onto the PostHog person** as `initial_utm_*` (first-touch);
- **set as GA4 user properties** (`gtag('set','user_properties',…)`).

So a campaign link like
`https://bombermeme.fun/?utm_source=twitter&utm_medium=social&utm_campaign=launch`
is attributed end-to-end: acquisition → activation (`play_start`) → revenue
(`deposit`). `?ref=` (the referral pyramid) is separate and unaffected.

Use a consistent UTM scheme for every shared link, e.g.:
`utm_source` = `twitter|telegram|youtube|influencer_<name>`,
`utm_medium` = `social|paid|dm|bio`, `utm_campaign` = `<launch|airdrop|…>`.

> GA4 note: a freshly-installed tag shows "data not received yet" on the GA
> **Home** card for up to ~24–48h even while it's firing. Verify immediately
> under **Reports → Realtime** (play the game, watch the active user appear).
> The tag itself is baked at build time from `VITE_GA_ID`.

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
