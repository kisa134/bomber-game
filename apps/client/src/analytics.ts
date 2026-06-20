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

/** Initialize all enabled analytics. Call once at startup. `extra` becomes
 *  super-properties (PostHog) + user properties (GA) so they ride on EVERY
 *  event — pass acquisition (utm) here to attribute behaviour AND revenue. */
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
    if (Object.keys(extra).length) {
      posthog.register(extra); // every event
      // Also stamp first-touch acquisition onto the PERSON, once, so you can
      // segment users (and their lifetime revenue) by where they came from.
      posthog.register_once(
        Object.fromEntries(Object.entries(extra).map(([k, v]) => [`initial_${k}`, v])),
      );
    }
    phReady = true;
  }
  initGa(extra);
  initClarity();
}

function initGa(userProps: Record<string, unknown> = {}): void {
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
  // Attach acquisition as GA user properties so they show in GA reports too.
  if (Object.keys(userProps).length) window.gtag("set", "user_properties", userProps);
  window.gtag("config", GA_ID);
}

/** First-touch acquisition: read utm_* + referrer + landing on the first visit
 *  that has them, persist, and reuse forever after. Returns non-empty values to
 *  register as super-properties. Keys are prefixed so they don't collide with
 *  PostHog's own per-event $utm_* / GA's built-in traffic source. */
export function captureAttribution(): Record<string, string> {
  const KEY = "bp_attr";
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Record<string, string>;
  } catch {
    /* ignore */
  }
  const p = new URLSearchParams(location.search);
  const attr: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "term", "content"]) {
    const v = p.get(`utm_${k}`);
    if (v) attr[`utm_${k}`] = v.slice(0, 100);
  }
  if (document.referrer) attr.referrer = document.referrer.slice(0, 200);
  attr.landing = location.pathname.slice(0, 100);
  // Only lock in a first-touch when there's a real source/referrer — a plain
  // direct visit must not block a later campaign visit from being recorded.
  try {
    if (attr.utm_source || attr.referrer) localStorage.setItem(KEY, JSON.stringify(attr));
  } catch {
    /* ignore */
  }
  return attr;
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
