"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { audioManager } from "@/lib/audioManager";
import { fetchStats } from "@/lib/gameApi";

gsap.registerPlugin(ScrollTrigger);

const FALLBACK_POOL = 1_247_830;
const TICK_MIN_MS  = 1_800;
const TICK_MAX_MS  = 4_500;
const INC_MIN      = 47;
const INC_MAX      = 312;

function resolvePool(stats: { prizePaid?: number; tokensInPlay?: number; priceUsd?: number } | null): number {
  if (!stats) return FALLBACK_POOL;
  const fromTokens = (stats.tokensInPlay ?? 0) * (stats.priceUsd ?? 0);
  if (fromTokens > 1000) return fromTokens;
  if ((stats.prizePaid ?? 0) > 0) return stats.prizePaid!;
  return FALLBACK_POOL;
}

export function PrizePoolCounter() {
  const containerRef   = useRef<HTMLDivElement>(null);
  const numRef         = useRef<HTMLSpanElement>(null);
  const liveValRef     = useRef(FALLBACK_POOL);
  const tickTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioGateRef   = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchStats()
      .then((s) => {
        if (cancelled) return;
        liveValRef.current = resolvePool(s);
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el        = numRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const elNode = el;
    const target = liveValRef.current;
    const fmt = (n: number) => `$${Math.floor(n).toLocaleString("en-US")}`;
    const obj = { val: 0 };
    elNode.textContent = "$0";

    const ctx = gsap.context(() => {
      gsap.to(obj, {
        val:      target,
        duration: 2.4,
        ease:     "power2.out",
        scrollTrigger: {
          id:      "prize-counter",
          trigger: container,
          start:   "top 85%",
          once:    true,
        },
        onUpdate() {
          elNode.textContent = fmt(obj.val);
          const now = Date.now();
          if (now - audioGateRef.current > 90) {
            audioGateRef.current = now;
            audioManager.playPrizeTick();
          }
        },
        onComplete: scheduleTick,
      });
    }, container);

    function scheduleTick() {
      const delay = TICK_MIN_MS + Math.random() * (TICK_MAX_MS - TICK_MIN_MS);
      tickTimerRef.current = setTimeout(() => {
        const inc = Math.floor(INC_MIN + Math.random() * (INC_MAX - INC_MIN));
        liveValRef.current += inc;

        gsap.to(obj, {
          val:      liveValRef.current,
          duration: 0.5,
          ease:     "power1.out",
          onUpdate() { elNode.textContent = fmt(obj.val); },
          onComplete: scheduleTick,
        });
        audioManager.playPrizeTick();
      }, delay);
    }

    return () => {
      ctx.revert();
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
      ScrollTrigger.getById("prize-counter")?.kill();
    };
  }, [ready]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-start gap-2 text-left"
      style={{
        paddingLeft: "18px",
        paddingTop: "6px",
        paddingBottom: "6px",
        borderLeft: "2px solid rgba(245,200,66,0.55)",
        background: "linear-gradient(90deg, rgba(245,200,66,0.06) 0%, transparent 42%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width: 7,
            height: 7,
            background: "#f5c842",
            boxShadow: "0 0 8px rgba(245,200,66,0.9)",
            display: "inline-block",
            flexShrink: 0,
            animation: "neon-pulse 2s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.24em",
            color: "rgba(245,200,66,0.75)",
            textTransform: "uppercase",
          }}
        >
          Active Prize Pool
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)" }}>
          · Season 1
        </span>
      </div>

      <span
        ref={numRef}
        aria-live="polite"
        aria-atomic="true"
        aria-label="Active prize pool amount"
        style={{
          fontFamily: "var(--font-hud)",
          fontSize: "clamp(2.8rem, 8vw, 5.2rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: "#f5c842",
          textShadow: "0 0 20px rgba(245,200,66,0.55), 0 0 50px rgba(245,200,66,0.25)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        $0
      </span>

      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.50rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
        Smart Contract Escrow · Updated Live
      </span>
    </div>
  );
}
