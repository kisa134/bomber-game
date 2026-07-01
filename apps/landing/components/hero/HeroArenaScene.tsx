"use client";

/* Hero broadcast HUD (composition B). The match itself is now a large section-level
   mass that bleeds off the bottom-right (in Hero.tsx) — this is only the diegetic
   broadcast readout that floats over the upper-right of that scene. */

import { useEffect, useState } from "react";
import { fetchStats } from "@/lib/gameApi";

export function HeroBroadcastHud() {
  const [watching, setWatching] = useState<number | null>(null);
  const [clock, setClock] = useState(167);

  useEffect(() => {
    let alive = true;
    void fetchStats().then((d) => { if (alive && d) setWatching(Math.round(d.online ?? 0)); });
    const tick = setInterval(() => setClock((c) => (c <= 0 ? 179 : c - 1)), 1000);
    return () => { alive = false; clearInterval(tick); };
  }, []);

  const mm = String(Math.floor(clock / 60)).padStart(2, "0");
  const ss = String(clock % 60).padStart(2, "0");

  return (
    <div
      className="pointer-events-none flex flex-col items-end gap-1.5 text-right"
      style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", letterSpacing: "0.18em", textTransform: "uppercase" }}
    >
      <span className="inline-flex items-center gap-2" style={{ color: "#5fe08a" }}>
        <span style={{ color: "rgba(255,255,255,0.55)" }}>● Arena Broadcast</span>
        <span className="hero-live-dot" style={{ width: 6, height: 6, background: "#5fe08a" }} />
        LIVE
      </span>
      <span className="inline-flex items-center gap-2" style={{ letterSpacing: "0.14em" }}>
        <span style={{ color: "rgba(255,255,255,0.55)" }}>
          {watching !== null ? `${watching.toLocaleString("en-US")} watching` : "live arena"}
        </span>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
        <span className="tabular-nums" style={{ color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.5)" }}>⏱ {mm}:{ss}</span>
      </span>
    </div>
  );
}
