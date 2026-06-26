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
};

export default nextConfig;
