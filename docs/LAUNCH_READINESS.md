# Launch readiness & runbook

Status of the public-launch hardening pass and the env you MUST set in the
deploy dashboard. Code is safe-by-default (features stay inert when a key is
unset) — the risk is a *misconfigured* deploy, so use this as the checklist.

## Required env for a real-money production deploy

The server runs a startup **preflight**. In production (`NODE_ENV=production`) it
**refuses to boot** (FATAL) if the money config is unsafe; everything else is a
loud WARN. Set all of these:

| Var | Required | Preflight | Why |
| --- | --- | --- | --- |
| `NODE_ENV=production` | **yes** | enables the fatals | without it the fatals below are skipped and the server can silently run on the in-memory store → **all balances lost on restart** |
| `DATABASE_URL` (Postgres) | **yes** | FATAL if missing | durable balances; the only money-safe store (Supabase REST dedupe is non-atomic) |
| `AUTH_SECRET` (≥16 chars) | **yes** | FATAL if missing | signs sessions; random-per-process otherwise (breaks across restarts/instances) |
| `SOLANA_RPC` | yes (money) | WARN | public RPC is rate-limited and inadequate for custody under load — use a paid provider |
| `TREASURY_ADDRESS` + `TREASURY_SECRET` | yes (money) | WARN | deposits/withdrawals are DISABLED without them |
| `HOUSE_RAKE_BP` | yes (economy) | WARN if 0 | 0 ⇒ no house rake AND the referral economy pays nothing |
| `REFERRAL_ROOT` | recommended | WARN | organic (non-invited) players attach to nobody otherwise |
| `ADMIN_TOKEN` | recommended | WARN | `/admin` dashboard is disabled (you launch blind) without it |
| `WS_MAX_PER_IP` | optional | — | per-IP WebSocket connection cap (default 12) |

> The WARN→FATAL promotion for `HOUSE_RAKE_BP`/`REFERRAL_ROOT`/treasury is
> intentionally **not** enabled yet — flipping it would crash a running deploy
> that hasn't set them. Set the vars first, then we can promote.

## Analytics (GA / PostHog / Clarity)

Analytics keys now load at **runtime** from the server (`/runtime-config.js`),
read by the client via `window.__CFG__` with a fallback to build-time `VITE_*`.
**You can set these in the deploy dashboard with NO client rebuild** — just set
the env and restart the service:

| Var | Value |
| --- | --- |
| `VITE_GA_ID` (or `GA_ID`) | GA4 Measurement ID `G-XXXXXXXX` |
| `VITE_POSTHOG_KEY` (or `POSTHOG_KEY`) | PostHog publishable key `phc_…` |
| `VITE_CLARITY_ID` (or `CLARITY_ID`) | Microsoft Clarity project id |

### If Google Analytics receives nothing
1. Confirm `GA_ID` is set on the **server** env and the service was restarted.
2. Open the live site, view source / network: `/runtime-config.js` must contain
   your `G-…` id, and `googletagmanager.com/gtag/js?id=G-…` must load.
3. In GA4: the **Data Stream** must be a *Web* stream whose URL matches the
   deployed domain; check **Realtime** while you click around.
4. Ad blockers / Brave block gtag — test in a clean browser.
(Previously the id was only baked at *build* time; if the build didn't receive
the build-arg the bundle shipped an empty id and GA stayed silent. The runtime
config removes that trap.)

## Admin control centre (`/admin`)

One token-gated dashboard unifying **business + game + technical** state:
- Growth today (DAU, paying, matches, depositors vs targets), Economy (chips/
  tokens circulating, deposits/withdrawals), Lucky Spin net sink, Referral
  pyramid, Top players, live Activity feed, wallet lookup + support actions.
- **🩺 System health:** uptime, memory (RSS/heap), error count + recent error
  feed, live WebSocket sockets/IPs, store durability, server tick load.
- **🤖 AI Analyst:** "Analyze now" builds a unified snapshot and sends it to an
  LLM for a prioritized, data-driven brief (verdict, signals, risks, next
  actions). Enable with env:

| Var | Value |
| --- | --- |
| `AI_API_KEY` | LLM key (Anthropic or OpenAI). Empty = button returns a "not configured" notice. |
| `AI_PROVIDER` | `anthropic` (default) or `openai` |
| `AI_MODEL` | optional model id override |

Endpoints: `GET /admin/stats` (full snapshot incl. `system`), `POST /admin/ai-analyze`, `GET /metrics` (Prometheus). All token-gated except `/metrics` (optional `METRICS_TOKEN`).

## Token swap at launch (IMPORTANT)

The token is **hard-coded**, not env: `packages/shared/src/constants.ts` —
`TOKEN_MINT`, `TOKEN_TICKER` (`BGDF`), `TOKEN_DECIMALS` (6). Swapping the token =
edit that file + **rebuild & redeploy both client and server**. Also at swap:
**reset test-token balances** (`token_balance` + any open stakes) so test-token
amounts can't be withdrawn against the real token. (Optionally we can move these
to env/runtime config so the swap is a config change — pending decision.)

## Hardening progress

- **Phase 1 (done):** Direction decoder clamp; payout>0 guard; referral payout
  error surfacing; per-IP WS connection cap; security headers; rAF loop
  try/finally; idempotent visibilitychange; no public sourcemaps; fixed root
  build; GitHub Actions CI (typecheck + build).
- **Phase 2 (in progress):** runtime analytics config (this) + runbook; error
  tracking (Sentry) and preflight promotions pending key/decision.
- **Phase 3:** withdrawal ledger/idempotency, early token-decimals validation,
  referral sybil limits, admin GET→POST + token out of the URL.
- **Phase 4:** PWA cache invalidation on protocol mismatch, connect-retry UI,
  detailed error/loading states.
- **Phase 5:** reconnect-token sweep cadence, presence/pending map caps, load test.

## Scale ceiling
Single-process game loop, `MAX_ROOMS=500`, load-sheds new rooms at ~70% tick
budget. Comfortable to ~1–2k concurrent on one strong instance; 10k+ needs
sharding (see `SCALING.md`, not yet built). Withdrawal lock and `AUTH_SECRET`
currently assume a single instance.
