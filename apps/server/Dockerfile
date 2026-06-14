# Build from the repo root:  docker build -f apps/server/Dockerfile -t bomberpump-server .
FROM node:22-slim

RUN corepack enable
WORKDIR /app

# Workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/server ./apps/server

RUN pnpm install --prod=false

ENV PORT=8080
EXPOSE 8080
CMD ["pnpm", "--filter", "@bomberpump/server", "start"]
