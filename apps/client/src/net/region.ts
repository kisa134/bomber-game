// Optional multi-region selection. Completely inert until the server's REGIONS
// env lists 2+ regions — until then /regions returns an empty list and this is a
// no-op. When configured, on boot the client measures latency to every region's
// /ping and (once) navigates to the nearest region's origin. After that, all the
// existing same-origin code (WebSocket, auth, REST) just runs on that region, so
// nothing else needs to change.
//
// Loop-safety: a redirect carries an `?r=<id>` marker across origins; the next
// load sees it, pins that region, cleans the URL and stops — so at most one hop.
// Manual override: `?server=<id>` forces a region, `?server=auto` re-probes.

import { SERVER_HTTP } from "../config.js";

interface Region {
  id: string;
  label: string;
  url: string;
}
interface RegionsResp {
  current: string;
  regions: Region[];
}

const PIN_KEY = "bp_region"; // remembered region id (per-origin localStorage)
const MIN_GAIN_MS = 25; // only switch if a region is at least this much closer

const stripSlash = (u: string): string => u.replace(/\/+$/, "");

/** Best-of-N round-trip time to a region's /ping (ms; Infinity if unreachable). */
async function probe(url: string, tries = 3): Promise<number> {
  let best = Infinity;
  for (let i = 0; i < tries; i++) {
    const t = performance.now();
    try {
      const signal = "timeout" in AbortSignal ? AbortSignal.timeout(2000) : undefined;
      const res = await fetch(`${stripSlash(url)}/ping`, { cache: "no-store", mode: "cors", signal });
      if (!res.ok) continue;
      await res.text();
      best = Math.min(best, performance.now() - t);
    } catch {
      // region unreachable / timed out — leave as Infinity
    }
  }
  return best;
}

export async function selectRegion(): Promise<void> {
  let data: RegionsResp;
  try {
    const res = await fetch(`${SERVER_HTTP}/regions`, { cache: "no-store" });
    data = (await res.json()) as RegionsResp;
  } catch {
    return; // /regions not available — behave as single-region
  }
  const regions = data?.regions ?? [];
  if (regions.length < 2) return; // single region: nothing to choose

  const qp = new URLSearchParams(location.search);

  // We just arrived from a region redirect: pin here, clean the URL, and stop.
  if (qp.get("r")) {
    if (data.current) localStorage.setItem(PIN_KEY, data.current);
    qp.delete("r");
    const q = qp.toString();
    history.replaceState(null, "", `${location.pathname}${q ? "?" + q : ""}${location.hash}`);
    return;
  }

  // Manual override.
  const ov = qp.get("server");
  if (ov === "auto") localStorage.removeItem(PIN_KEY);
  else if (ov) localStorage.setItem(PIN_KEY, ov);

  // Pick a region: a valid pinned choice, else probe and take the lowest RTT
  // (only if it beats staying put by a clear margin).
  let chosen = localStorage.getItem(PIN_KEY);
  if (!chosen || !regions.some((r) => r.id === chosen)) {
    const timed = await Promise.all(regions.map(async (r) => ({ r, ms: await probe(r.url) })));
    timed.sort((a, b) => a.ms - b.ms);
    if (timed[0].ms === Infinity) return; // none reachable — stay
    const here = timed.find((t) => t.r.id === data.current);
    const best = timed[0];
    if (here && best.ms > here.ms - MIN_GAIN_MS) chosen = data.current; // not worth switching
    else chosen = best.r.id;
    localStorage.setItem(PIN_KEY, chosen);
  }

  if (chosen === data.current) return; // already on the right region

  const target = regions.find((r) => r.id === chosen);
  if (!target) return;

  // Hop to the chosen region, carrying the path/query (+ loop marker).
  qp.delete("server");
  qp.set("r", chosen);
  location.replace(`${stripSlash(target.url)}${location.pathname}?${qp.toString()}${location.hash}`);
}
