import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the trace root to this directory so Next.js doesn't walk up to
// a stray ~/package-lock.json and emit a noisy workspace-root warning.
const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // "export" disabled — server-side API routes are required for the token data proxy.
  // Deploy with `next start` or on Vercel/Node hosts (not static CDN-only).
  outputFileTracingRoot: here,
  images: { unoptimized: true },
  reactStrictMode: true,
  // @bomberpump/shared ships raw TS (no prebuilt JS), so Next must transpile it.
  // This is how the landing stays in lockstep with the game's source of truth.
  transpilePackages: ["@bomberpump/shared"],
  // The shared package's barrel re-exports siblings with ESM ".js" specifiers
  // (e.g. ./movement.js). Map ".js" -> ".ts" so webpack resolves the TS source;
  // unused exports (movement/protocol) are tree-shaken out of the bundle.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
