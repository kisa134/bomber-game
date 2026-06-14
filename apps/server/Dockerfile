# Single-box image: builds the client and serves it from the game server.
# Build from the repo root:
#   docker build -f apps/server/Dockerfile -t bomberpump .
FROM node:22-slim

RUN corepack enable
WORKDIR /app

# Workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/client ./apps/client

RUN pnpm install --prod=false
RUN pnpm --filter @bomberpump/client build

ENV PORT=8080
ENV CLIENT_DIST=/app/apps/client/dist
EXPOSE 8080
CMD ["pnpm", "--filter", "@bomberpump/server", "start"]
