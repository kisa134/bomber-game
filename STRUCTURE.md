# Bomberpump — repository structure

pnpm monorepo. Shared gameplay constants/types/protocol live in `packages/shared`
and are imported by both the authoritative server and the canvas client.

```
bomberpump/
├── apps/
│   ├── client/                 # Vite + TS, Canvas 2D renderer
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.ts         # entry, game loop, glue
│   │       ├── config.ts       # server URL + interpolation delay
│   │       ├── net/
│   │       │   ├── socket.ts   # ws client + quickplay fetch
│   │       │   └── protocol.ts # re-export shared protocol
│   │       ├── game/
│   │       │   ├── state.ts    # snapshot buffer + interpolation
│   │       │   ├── renderer.ts # dpi-aware canvas draw
│   │       │   └── input.ts    # keyboard + touch
│   │       └── ui/lobby.ts     # DOM lobby/result screens
│   └── server/                 # Node + uWebSockets.js, authoritative 20 Hz
│       └── src/
│           ├── index.ts        # uWS http (/quickplay, /health) + /ws
│           ├── matchmaker.ts   # quickplay pool, global tick loop
│           ├── room.ts         # one match: tick, movement, explosions, SD
│           ├── world.ts        # grid generation + tile ops
│           ├── player.ts       # player state + powerups
│           ├── bomb.ts         # bomb struct + direction helpers
│           └── bot.ts          # Easy bot (random walker + flee)
└── packages/
    └── shared/
        └── src/
            ├── constants.ts    # all gameplay numbers
            ├── types.ts        # enums + decoded message shapes
            └── protocol.ts     # binary encode/decode
```

See `docs/match-state.md` for the match flow diagram.
