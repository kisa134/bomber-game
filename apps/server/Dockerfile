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

# Client analytics keys are baked into the bundle at build time. Render passes a
# matching service env var as a build arg when an ARG of the same name exists.
# All optional — analytics stays inert when a key is empty.
ARG VITE_POSTHOG_KEY=""
ARG VITE_POSTHOG_HOST="https://us.i.posthog.com"
ARG VITE_GA_ID=""
ARG VITE_CLARITY_ID=""
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST \
    VITE_GA_ID=$VITE_GA_ID \
    VITE_CLARITY_ID=$VITE_CLARITY_ID
RUN pnpm --filter @bomberpump/client build

ENV PORT=8080
ENV CLIENT_DIST=/app/apps/client/dist
EXPOSE 8080
CMD ["pnpm", "--filter", "@bomberpump/server", "start"]
