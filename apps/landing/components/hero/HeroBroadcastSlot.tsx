"use client";

/* Hero broadcast scene (SPEC §1, right column) — a diegetic "window into the arena":
   z-0 arena world backdrop · z-10 the broadcast monitor (demo2 live feed + HUD frame:
   ARENA BROADCAST / LIVE / WATCHING / match timer + sci-fi corners + scanlines) ·
   z-30 a foreground fighter breaking out of the frame. WATCHING is the real /stats online
   count (real API only); the match clock is broadcast ambiance. */

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PixelGlassGlitch } from "@/components/effects/PixelGlassGlitch";
import { LayeredScene } from "@/components/scene/LayeredScene";
import { fetchStats } from "@/lib/gameApi";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const v = pos[0] === "t" ? "top" : "bottom";
  const h = pos[1] === "l" ? "left" : "right";
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        [v]: -2, [h]: -2,
        width: 16, height: 16, zIndex: 22,
        [`border${v[0].toUpperCase()}${v.slice(1)}`]: "2px solid rgba(245,200,66,0.85)",
        [`border${h[0].toUpperCase()}${h.slice(1)}`]: "2px solid rgba(245,200,66,0.85)",
      } as React.CSSProperties}
    />
  );
}

export function HeroBroadcastSlot() {
  const [watching, setWatching] = useState<number | null>(null);
  const [clock, setClock] = useState(167); // ~2:47, broadcast ambiance

  useEffect(() => {
    let alive = true;
    void fetchStats().then((d) => { if (alive && d) setWatching(Math.round(d.online ?? 0)); });
    const tick = setInterval(() => setClock((c) => (c <= 0 ? 179 : c - 1)), 1000);
    return () => { alive = false; clearInterval(tick); };
  }, []);

  const mm = String(Math.floor(clock / 60)).padStart(2, "0");
  const ss = String(clock % 60).padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 1, ease, delay: 0.2 }}
      className="hero-broadcast relative w-full max-w-[460px]"
    >
      {/* controlled directional light pooling UNDER the monitor (not a blurry halo) */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          inset: "-8% -6% -16% -6%",
          zIndex: 0,
          background:
            "radial-gradient(78% 58% at 50% 94%, rgba(245,200,66,0.22) 0%, rgba(212,64,48,0.10) 38%, transparent 70%)",
          filter: "blur(5px)",
          animation: "neon-pulse 4s ease-in-out infinite",
        }}
      />
      {/* frame-break embers — sparks drifting OUT past the broadcast frame edges */}
      <div aria-hidden className="hero-embers pointer-events-none absolute" style={{ inset: "-12% -9%", zIndex: 25 }}>
        <span style={{ left: "-2%", top: "20%" }} />
        <span style={{ left: "103%", top: "34%" }} />
        <span style={{ left: "-4%", top: "72%" }} />
        <span style={{ left: "101%", top: "80%" }} />
        <span style={{ left: "14%", top: "-3%" }} />
        <span style={{ left: "84%", top: "-5%" }} />
      </div>

      {/* z-10 — the broadcast monitor */}
      <PixelGlassGlitch variant="gold" mode="idle" intensity={0.85} className="relative w-full" >
        <div className="relative z-10 aspect-[4/5] w-full overflow-hidden sm:aspect-video lg:aspect-[5/6]">
          {/* Stadium-broadcast scene: meme crowd in the stands + a live bomber arena
              (block grid · bomb · explosion) + LED scoreboards. Generated on-brand. */}
          <LayeredScene
            className="absolute inset-0 h-full w-full"
            layers={[
              { src: "/bg/arena-broadcast.webp", z: 0, depth: -0.18, motion: "drift", pixel: true,
                style: { objectFit: "cover" } },
            ]}
          />

          {/* vignette */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(4,5,9,0.66) 0%, transparent 24%, transparent 64%, rgba(4,5,9,0.82) 100%)" }} />
          {/* scanlines */}
          <div className="bm-scanlines pointer-events-none absolute inset-0 opacity-40" aria-hidden />

          {/* diegetic HUD — top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-2.5 py-2"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            <span style={{ color: "rgba(255,255,255,0.7)" }}>● Arena Broadcast</span>
            <span className="inline-flex items-center gap-1.5" style={{ color: "#5fe08a" }}>
              <span className="hero-live-dot" style={{ width: 6, height: 6, background: "#5fe08a" }} />
              LIVE
            </span>
          </div>

          {/* diegetic HUD — bottom bar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-2.5 py-2"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <span style={{ color: "rgba(255,255,255,0.78)" }}>
              {watching !== null ? `${watching.toLocaleString("en-US")} watching` : "live arena"}
            </span>
            <span className="tabular-nums" style={{ color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.5)" }}>
              ⏱ {mm}:{ss} left
            </span>
          </div>
        </div>

        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      </PixelGlassGlitch>
    </motion.div>
  );
}
