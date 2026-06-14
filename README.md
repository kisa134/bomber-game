# 💣 Bomberpump

Fast browser multiplayer bomberman built for pump.fun audiences. Authoritative
Node server (uWebSockets.js, 20 Hz), Canvas 2D client, hand-rolled binary
protocol over WebSocket. No 3D, no physics engine — just a grid, sprites and
cell math.

- 13×11 grid, chain explosions, 4 powerups (BOMB / FIRE / SPEED / KICK)
- Quickplay matchmaking, 2–4 players, bots fill empty slots after 15s
- Sudden death at 60s (walls spiral inward)
- Desktop (WASD/arrows + space) and mobile (d-pad + bomb) controls

## Quick start

```bash
pnpm install

# terminal 1 — server on :8787
pnpm dev:server

# terminal 2 — client on :5173
pnpm dev:client
```

Open http://localhost:5173, pick a skin, hit **Quickplay**. Open a second tab
to play against yourself; bots fill the rest after 15s (or instantly if you wait
out the timer with one human).

## Typecheck

```bash
pnpm typecheck
```

## Layout

See [`STRUCTURE.md`](./STRUCTURE.md) and [`docs/match-state.md`](./docs/match-state.md).

## Deployment

- **Client** → Vercel (`apps/client`). Set `VITE_SERVER_URL` to the server's
  public https URL at build time.
- **Server** → Fly.io / Railway. Container listens on `$PORT` (default 8787).
  See [`apps/server/Dockerfile`](./apps/server/Dockerfile) and `fly.toml`.

## Roadmap (post-MVP)

Wallet/token-gated skins, pot mode with $TOKEN buy-ins, leaderboard cNFTs,
spectator betting. These live as separate modules and never touch the game loop.
