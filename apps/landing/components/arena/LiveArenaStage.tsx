"use client";

import { LiveArena } from "@/components/arena/LiveArena";

/** Perspective “viewer room” wrapper — swap bg art at `/bg/arena-viewer.webp` when ready. */
export function LiveArenaStage() {
  return (
    <section className="live-arena-stage relative overflow-hidden" style={{ background: "var(--color-bg-2)" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 100%, rgba(58,158,158,0.12) 0%, transparent 55%), linear-gradient(180deg, var(--color-bg-2) 0%, #050508 100%)",
        }}
      />

      <div className="live-arena-stage-room relative mx-auto max-w-[1280px] px-[var(--section-px,1.5rem)] py-16 lg:py-24">
        <div
          className="live-arena-stage-monitor relative mx-auto"
          style={{
            perspective: "1200px",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            style={{
              transform: "rotateX(6deg) scale(0.98)",
              transformOrigin: "center bottom",
              filter: "drop-shadow(0 48px 80px rgba(0,0,0,0.75))",
            }}
          >
            <LiveArena embedded />
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-32 w-[min(90%,720px)] -translate-x-1/2"
          style={{
            background: "radial-gradient(ellipse 100% 100% at 50% 100%, rgba(245,200,66,0.08) 0%, transparent 70%)",
          }}
        />
      </div>
    </section>
  );
}
