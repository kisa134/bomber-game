"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/* ── Flame CSS keyframes injected once ───────────────────────────────────── */
const FLAME_STYLES = `
@keyframes furnaceGlow {
  0%, 100% {
    box-shadow:
      0 0 40px rgba(255,45,0,0.50),
      0 0 80px rgba(255,100,0,0.20),
      0 24px 64px rgba(0,0,0,0.90);
  }
  33% {
    box-shadow:
      0 0 64px rgba(255,70,0,0.65),
      0 0 110px rgba(255,130,0,0.25),
      0 24px 64px rgba(0,0,0,0.90);
  }
  66% {
    box-shadow:
      0 0 28px rgba(255,20,0,0.40),
      0 0 60px rgba(255,80,0,0.14),
      0 24px 64px rgba(0,0,0,0.90);
  }
}
@keyframes flameRise {
  0%   { transform: scaleX(1.00) translateY(0px); opacity: 0.55; }
  40%  { transform: scaleX(1.04) translateY(-6px); opacity: 0.80; }
  70%  { transform: scaleX(0.97) translateY(-2px); opacity: 0.65; }
  100% { transform: scaleX(1.00) translateY(0px); opacity: 0.55; }
}
@keyframes flameRise2 {
  0%   { transform: scaleX(0.96) translateY(-3px); opacity: 0.40; }
  50%  { transform: scaleX(1.05) translateY(-8px); opacity: 0.70; }
  100% { transform: scaleX(0.96) translateY(-3px); opacity: 0.40; }
}
@keyframes embers {
  0%   { transform: translateY(0px) scale(1); opacity: 0.9; }
  100% { transform: translateY(-60px) scale(0.4); opacity: 0; }
}
`;

/* ── Ember particle ───────────────────────────────────────────────────────── */
function Ember({ left, delay, duration }: { left: string; delay: string; duration: string }) {
  return (
    <div
      aria-hidden
      style={{
        position:  "absolute",
        bottom:    "30%",
        left,
        width:     "3px",
        height:    "3px",
        borderRadius: "50%",
        background: "#f0a92a",
        boxShadow: "0 0 4px #f0a92a, 0 0 8px rgba(255,122,48,0.7)",
        animation: `embers ${duration} ${delay} ease-out infinite`,
        pointerEvents: "none",
      }}
    />
  );
}

/* ── Animated burn counter ───────────────────────────────────────────────── */
const BASE_BURNED = 42_187_293;

function useBurnCounter() {
  const [burned, setBurned] = useState(BASE_BURNED);

  useEffect(() => {
    const TOTAL_SUPPLY = 1_000_000_000;

    let timeout: ReturnType<typeof setTimeout>;
    function tick() {
      const increment = Math.floor(Math.random() * 120 + 20);
      setBurned((b) => Math.min(b + increment, TOTAL_SUPPLY));
      timeout = setTimeout(tick, Math.random() * 1800 + 800);
    }
    timeout = setTimeout(tick, 1200);
    return () => clearTimeout(timeout);
  }, []);

  return burned;
}

/* ── Main component ───────────────────────────────────────────────────────── */
export function TheFurnace() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const burned = useBurnCounter();
  const TOTAL_SUPPLY = 1_000_000_000;
  const burnedPct = ((burned / TOTAL_SUPPLY) * 100).toFixed(3);

  return (
    <>
      <style suppressHydrationWarning>{FLAME_STYLES}</style>

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 40 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "relative",
          maxWidth: "820px",
          margin: "0 auto",
          borderRadius: "24px",
          overflow: "hidden",
          background: "rgba(7,4,2,0.96)",
          border: "1px solid rgba(255,60,0,0.35)",
          animation: inView ? "furnaceGlow 3s ease-in-out infinite" : "none",
        }}
      >
        {/* Flame layers at the bottom */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "55%",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          {/* Core flame */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "15%",
              right: "15%",
              height: "100%",
              background:
                "radial-gradient(ellipse at 50% 110%, rgba(255,60,0,0.70) 0%, rgba(255,100,20,0.40) 30%, rgba(255,90,77,0.15) 55%, transparent 70%)",
              animation: "flameRise 1.8s ease-in-out infinite",
              transformOrigin: "bottom center",
            }}
          />
          {/* Left tongue */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "5%",
              right: "40%",
              height: "70%",
              background:
                "radial-gradient(ellipse at 40% 110%, rgba(255,80,0,0.55) 0%, rgba(255,50,0,0.20) 40%, transparent 65%)",
              animation: "flameRise2 2.2s ease-in-out infinite",
              transformOrigin: "bottom left",
            }}
          />
          {/* Right tongue */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "40%",
              right: "5%",
              height: "70%",
              background:
                "radial-gradient(ellipse at 60% 110%, rgba(255,100,0,0.50) 0%, rgba(255,60,0,0.18) 40%, transparent 65%)",
              animation: "flameRise 2.6s ease-in-out infinite 0.4s",
              transformOrigin: "bottom right",
            }}
          />
          {/* Heat haze at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "30%",
              background:
                "linear-gradient(to top, rgba(255,30,0,0.25) 0%, transparent 100%)",
            }}
          />
        </div>

        {/* Ember particles */}
        {[
          { left: "22%", delay: "0s",    duration: "2.4s" },
          { left: "38%", delay: "0.7s",  duration: "2.0s" },
          { left: "55%", delay: "1.3s",  duration: "2.8s" },
          { left: "68%", delay: "0.3s",  duration: "2.2s" },
          { left: "45%", delay: "1.9s",  duration: "1.9s" },
        ].map((e, i) => (
          <Ember key={i} {...e} />
        ))}

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "clamp(24px, 5vw, 44px)",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontSize: "1.6rem",
                  filter: "drop-shadow(0 0 12px rgba(255,100,0,0.9)) drop-shadow(0 0 24px rgba(255,60,0,0.5))",
                }}
              >
                🔥
              </span>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    letterSpacing: "0.22em",
                    color: "rgba(255,100,0,0.60)",
                    textTransform: "uppercase",
                    marginBottom: "2px",
                  }}
                >
                  Deflationary Burn Engine
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 900,
                    fontStyle: "italic",
                    fontSize: "clamp(1.1rem, 3vw, 1.6rem)",
                    textTransform: "uppercase",
                    letterSpacing: "-0.03em",
                    color: "#fff",
                  }}
                >
                  THE{" "}
                  <span
                    style={{
                      color: "#ff5a00",
                      textShadow: "0 0 20px rgba(255,90,0,0.8), 0 0 40px rgba(255,60,0,0.4)",
                    }}
                  >
                    FURNACE
                  </span>
                </div>
              </div>
            </div>

            {/* Live badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.58rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#ff5a00",
                background: "rgba(255,90,0,0.10)",
                border: "1px solid rgba(255,90,0,0.30)",
                borderRadius: "999px",
                padding: "5px 12px",
                textShadow: "0 0 8px rgba(255,90,0,0.7)",
              }}
            >
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#ff5a00",
                  boxShadow: "0 0 6px rgba(255,90,0,0.9)",
                  display: "inline-block",
                  animation: "neon-pulse 2s ease-in-out infinite",
                }}
              />
              BURNING
            </div>
          </div>

          {/* Burn counter */}
          <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.55rem",
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(255,100,0,0.55)",
                marginBottom: "10px",
              }}
            >
              Total $BMB Permanently Destroyed
            </div>
            <div
              key={burned}
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: "clamp(2rem, 8vw, 4rem)",
                letterSpacing: "-0.05em",
                lineHeight: 0.9,
                color: "#ff7a00",
                textShadow:
                  "0 0 30px rgba(255,122,0,0.80), 0 0 60px rgba(255,90,0,0.45), 0 0 120px rgba(255,60,0,0.20)",
              }}
            >
              {burned.toLocaleString("en-US")}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.30)",
                marginTop: "8px",
              }}
            >
              $BMB
            </div>
          </div>

          {/* Supply burned progress */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.30)", textTransform: "uppercase" }}>
                % of Total Supply Burned
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700, color: "#ff7a00", textShadow: "0 0 8px rgba(255,122,0,0.7)" }}>
                {burnedPct}%
              </span>
            </div>
            <div style={{ height: "5px", borderRadius: "999px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={inView ? { width: `${(parseFloat(burnedPct) / 5) * 100}%` } : {}}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                style={{
                  height: "100%",
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, #ff2d00, #f0a92a, #ff5a00)",
                  boxShadow: "0 0 10px rgba(255,90,0,0.7)",
                }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
            {[
              { label: "Burn Rate",      value: "25% of Rake",    icon: "🔥" },
              { label: "Per Match Est.", value: "~$1.20 $BMB",   icon: "⚡" },
              { label: "Burn Address",   value: "Dead Wallet",    icon: "🔒" },
              { label: "Mechanism",      value: "On-Chain Auto",  icon: "⚙" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "rgba(255,60,0,0.06)",
                  border: "1px solid rgba(255,60,0,0.18)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.50rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                  {s.label}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.80rem", fontWeight: 700, color: "#f0a92a", textShadow: "0 0 8px rgba(255,122,48,0.7)" }}>
                  {s.icon} {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}
