"use client";

/* S2 — first immersion. When the SD-1 shutters blow open, you don't read a feature
   list — you ARRIVE in the pit. Coliseum backdrop + bold attitude copy + a diegetic
   broadcast spec-strip (not marketing cards). Continuity with S1's broadcast HUD. */

const SPECS = [
  { k: "ARENA", v: "13×13" },
  { k: "FIGHTERS", v: "4 · FFA" },
  { k: "MATCH", v: "~3 MIN" },
  { k: "STAKES", v: "WINNER TAKES ALL" },
] as const;

export function ArenaStoryReveal() {
  return (
    <div className="arena-story-reveal relative flex h-full min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden px-5 py-16">
      {/* BRUTAL COLISEUM backdrop — dark arena pit, spotlight, fighters facing off */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "url(/bg/coliseum.webp)", backgroundSize: "cover", backgroundPosition: "center", imageRendering: "pixelated" }}
      />
      {/* dark gradient so the headline (centre, under the spotlight) and strip (bottom) read */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,5,9,0.84) 0%, rgba(6,5,9,0.32) 30%, rgba(6,5,9,0.5) 60%, rgba(6,5,9,0.95) 100%)",
        }}
      />
      {/* foreground crowd — front row of the pit, bleeds along the bottom (depth + continuity) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: "30%",
          backgroundImage: "url(/fx/fg-crowd.webp)",
          backgroundSize: "cover",
          backgroundPosition: "bottom center",
          imageRendering: "pixelated",
          opacity: 0.45,
          maskImage: "linear-gradient(180deg, transparent 0%, #000 70%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 70%)",
        }}
      />
      <div className="bm-scanlines pointer-events-none absolute inset-0 opacity-20" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 50% 40% at 50% 30%, rgba(245,200,66,0.11) 0%, transparent 65%)" }}
      />
      {/* foreground embers drifting up from the pit */}
      <div aria-hidden className="hero-embers pointer-events-none absolute inset-x-0 bottom-0" style={{ height: "60%", zIndex: 9 }}>
        <span style={{ left: "22%", top: "70%" }} />
        <span style={{ left: "68%", top: "60%" }} />
        <span style={{ left: "44%", top: "82%" }} />
        <span style={{ left: "80%", top: "74%" }} />
        <span style={{ left: "12%", top: "64%" }} />
        <span style={{ left: "56%", top: "88%" }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[920px] text-center">
        <p
          className="mb-5 inline-flex items-center gap-2"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.22em", color: "rgba(245,200,66,0.85)", textTransform: "uppercase" }}
        >
          <span className="hero-live-dot" style={{ width: 6, height: 6, background: "#5fe08a" }} />
          Live Arena · Season 01
        </p>
        <h2
          className="arena-story-reveal-title"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            textTransform: "uppercase",
            fontSize: "clamp(2.3rem, 6vw, 4.6rem)",
            lineHeight: 0.9,
            color: "#fff",
            margin: 0,
          }}
        >
          Four memes enter.
          <br />
          <span style={{ color: "#f5c842" }}>One walks out rich.</span>
        </h2>
        <p
          className="arena-story-reveal-sub mx-auto mt-5 max-w-[48ch]"
          style={{ fontFamily: "var(--font-body)", fontSize: "1rem", lineHeight: 1.65, color: "rgba(255,255,255,0.55)" }}
        >
          No teams. No luck. Just you, three rivals, and a shrinking pit of bombs —{" "}
          <span style={{ color: "#d44030" }}>last one standing takes the whole pot.</span>
        </p>

        {/* diegetic broadcast spec-strip — reads like an arena lower-third, not feature cards */}
        <div
          className="mx-auto mt-9 flex w-full max-w-[680px] flex-wrap items-stretch justify-center"
          style={{ border: "1px solid rgba(245,200,66,0.18)", background: "rgba(8,7,12,0.55)", backdropFilter: "blur(6px)" }}
        >
          {SPECS.map((s, i) => (
            <div
              key={s.k}
              className="flex flex-1 flex-col items-center gap-1 px-4 py-3"
              style={{ minWidth: 120, borderLeft: i === 0 ? "none" : "1px solid rgba(245,200,66,0.12)" }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.46rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                {s.k}
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.02em", color: "#f5c842", textTransform: "uppercase", textShadow: "0 0 12px rgba(245,200,66,0.35)" }}>
                {s.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
