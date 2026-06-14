# 💣 Bomberpump

Fast browser multiplayer bomberman built for pump.fun audiences. Authoritative
Node server (uWebSockets.js, 20 Hz), Canvas 2D client, hand-rolled binary
protocol over WebSocket. No 3D, no physics engine — just a grid, sprites and
cell math.

- 13×11 grid, chain explosions, 4 powerups (BOMB / FIRE / SPEED / KICK)
- Rooms: Quickplay (public) · create a private room with a share code · join by code
- 2–4 real players (no bots). Host can start, or it auto-starts ~15s after 2+ join
- 5-minute rounds; sudden death in the final minute (walls spiral inward)
- Client-side prediction for instant local movement
- Desktop (WASD/arrows + space) and mobile (d-pad + bomb) controls

## Quick start

```bash
pnpm install

# terminal 1 — server on :8787
pnpm dev:server

# terminal 2 — client on :5173
pnpm dev:client
```

Open http://localhost:5173, pick a skin, hit **Quickplay** (or create/join a
room by code). Open a second tab as a second player — the match auto-starts ~15s
after the second player joins, or the host can press **Start now**.

## Typecheck

```bash
pnpm typecheck
```

## Layout

See [`STRUCTURE.md`](./STRUCTURE.md) and [`docs/match-state.md`](./docs/match-state.md).

## Deployment

The simplest setup is **one box**: the server builds and serves the client from
the same origin (WebSocket + static files), so there's nothing else to host and
no CORS/URL wiring. The Docker image does this automatically.

### Render (blueprint — zero dashboard config)

The repo ships a `render.yaml`, so Render reads all build settings itself:

1. render.yaml is committed at the repo root.
2. Render dashboard → **New +** → **Blueprint** → connect this repo, branch **main**.
3. Render detects the `bomberpump` web service (Docker, `/health` check) → **Apply**.
4. First build runs `pnpm install` + `vite build` (~1–2 min), then a public URL
   appears. Open it, both players hit Quickplay.

> Free plan spins the service down when idle (cold start ~50s on the first hit).
> Switch `plan: free` to `plan: starter` in `render.yaml` for always-on.

### Railway (alternative — git push, no CLI)

1. railway.app → New Project → Deploy from GitHub repo → pick this repo/branch.
2. It detects `apps/server/Dockerfile`. Set the build/Dockerfile path to
   `apps/server/Dockerfile` if asked, with build context = repo root.
3. Deploy. Railway gives you a public URL — open it and both of you hit Quickplay.

### Fly.io (CLI)

```bash
fly launch --no-deploy   # uses fly.toml (Dockerfile = apps/server/Dockerfile)
fly deploy
```

### Split hosting (optional)

You can still host the client on Vercel and the API on Fly/Railway separately:
build the client with `VITE_SERVER_URL=https://your-server` and deploy `apps/client`
(`vercel.json` included). Note Vercel cannot host the WebSocket server itself.

## Roadmap (post-MVP)

Wallet/token-gated skins, pot mode with $TOKEN buy-ins, leaderboard cNFTs,
spectator betting. These live as separate modules and never touch the game loop.
