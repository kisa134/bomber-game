// Error tracking. No-op unless SENTRY_DSN is set, so it never affects the game.
// Money-path alerts and unhandled crashes are forwarded here for visibility.
import * as Sentry from "@sentry/node";

const DSN = process.env.SENTRY_DSN ?? "";

export function initSentry(): void {
  if (!DSN) return;
  try {
    Sentry.init({
      dsn: DSN,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0, // errors only; no perf tracing overhead
    });
    console.log("[sentry] error tracking enabled");
  } catch (e) {
    console.error("[sentry] init failed", e);
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!DSN) return;
  try {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), context ? { extra: context } : undefined);
  } catch {
    /* never let telemetry throw into the game */
  }
}

export function captureMessage(msg: string): void {
  if (!DSN) return;
  try {
    Sentry.captureMessage(msg, "error");
  } catch {
    /* ignore */
  }
}
