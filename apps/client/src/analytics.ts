// Unified web analytics. PostHog is the hub (autocapture, pageviews, session
// replay, web analytics, person profiles); Google Analytics 4 and Microsoft
// Clarity are loaded alongside when their ids are set. Everything is optional —
// each integration is inert unless its key/id is provided at build time, so the
// game never depends on analytics and nothing is hard-coded.

import posthog from "posthog-js";
import { POSTHOG_KEY, POSTHOG_HOST, GA_ID, CLARITY_ID } from "./config.js";

const PH_ENABLED = POSTHOG_KEY.length > 0;
let phReady = false;

// gtag shim — declared loosely so we don't need @types/gtag.
type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    clarity?: (...args: unknown[]) => void;
  }
}

/** Initialize all enabled analytics. Call once at startup. */
export function initAnalytics(extra: Record<string, unknown> = {}): void {
  if (PH_ENABLED) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only", // anonymous visitors stay cheap
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      session_recording: { maskAllInputs: true },
      // Persist the same anon id we used before so history lines up.
      bootstrap: { distinctID: localStorage.getItem("bp_aid") ?? undefined },
    });
    if (Object.keys(extra).length) posthog.register(extra);
    phReady = true;
  }
  initGa();
  initClarity();
}

function initGa(): void {
  if (!GA_ID) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

function initClarity(): void {
  if (!CLARITY_ID) return;
  (function (c: Window, l: Document, a: string, r: string) {
    (c as unknown as Record<string, unknown>).clarity =
      (c as unknown as Record<string, (...a: unknown[]) => void>).clarity ||
      function (...args: unknown[]) {
        ((((c as unknown as Record<string, unknown>).clarity as unknown as { q?: unknown[] }).q ??=
          [])).push(args);
      };
    const t = l.createElement("script") as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + a;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode!.insertBefore(t, y);
  })(window, document, CLARITY_ID, "script");
}

/** Send one product event to every enabled backend. No-op when all disabled. */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  try {
    if (phReady) posthog.capture(event, properties);
    if (window.gtag) window.gtag("event", event, properties);
  } catch {
    /* analytics must never break the game */
  }
}

/** Identify the player by wallet once they connect. */
export function identifyWallet(wallet: string): void {
  try {
    if (phReady) posthog.identify(wallet, { wallet });
    if (window.gtag && GA_ID) window.gtag("set", { user_id: wallet });
    if (window.clarity) window.clarity("identify", wallet);
  } catch {
    /* ignore */
  }
}

/** PostHog autocaptures pageviews/clicks and records sessions; uncaught JS
 *  errors are captured via its exception autocapture. We still forward errors
 *  explicitly so they show up as a clean `client_error` event in GA too. */
export function initErrorTracking(): void {
  window.addEventListener("error", (e) => {
    track("client_error", { message: e.message, source: e.filename, line: e.lineno });
  });
  window.addEventListener("unhandledrejection", (e) => {
    track("client_error", { message: String((e as PromiseRejectionEvent).reason) });
  });
}
