"use client";

import { motion } from "framer-motion";
import { TOKEN_TICKER } from "@/lib/token";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ── Token distribution data ─────────────────────────────────────────────── */
const SLICES = [
  { label: "Fair Launch (Public)",       pct: 88, color: "#f5c842" },
  { label: "Liquidity Pool",             pct:  5, color: "#7fd8ff" },
  { label: "Team & Dev (2yr vesting)",   pct:  4, color: "#f0a92a" },
  { label: "DAO Reserve",                pct:  3, color: "#ff5a4d" },
];

const PILLS = [
  { label: "Total Supply", value: "1,000,000,000", sub: `$${TOKEN_TICKER}` },
  { label: "Chain",        value: "Solana",        sub: "SOL native" },
  { label: "Launch",       value: "pump.fun",      sub: "Fair launch" },
  { label: "Utility",      value: "In-game + Gov", sub: "Dual use" },
];

/* ── Pure-SVG donut chart ────────────────────────────────────────────────── */
function DonutChart() {
  const SIZE = 160;
  const R = 58;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const STROKE = 18;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  let cumulative = 0;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={STROKE}
      />

      {SLICES.map((slice) => {
        const dashLength = (slice.pct / 100) * CIRCUMFERENCE;
        const gapLength  = CIRCUMFERENCE - dashLength;
        const rotation   = (cumulative / 100) * 360 - 90;
        cumulative += slice.pct;

        return (
          <circle
            key={slice.label}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={slice.color}
            strokeWidth={STROKE}
            strokeDasharray={`${dashLength} ${gapLength}`}
            strokeLinecap="butt"
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${CX}px ${CY}px`,
              filter: `drop-shadow(0 0 6px ${slice.color}80)`,
              transition: "stroke-dasharray 0.8s ease",
            }}
          />
        );
      })}

      {/* Centre label */}
      <text
        x={CX} y={CY - 8}
        textAnchor="middle"
        fill="rgba(255,255,255,0.9)"
        fontSize="11"
        fontWeight="700"
        fontFamily="var(--font-display)"
        letterSpacing="-0.5"
      >
        1B
      </text>
      <text
        x={CX} y={CY + 8}
        textAnchor="middle"
        fill="rgba(255,255,255,0.32)"
        fontSize="7.5"
        fontFamily="var(--font-mono)"
        letterSpacing="1"
      >
        {`$${TOKEN_TICKER}`}
      </text>
    </svg>
  );
}

export function CompactTokenomics() {
  return (
    <section className="relative w-full px-5 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
          className="overflow-hidden rounded-3xl"
          style={{
            background: "rgba(10,12,20,0.72)",
            border: "1px solid rgba(245,200,66,0.12)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 0 60px rgba(245,200,66,0.04), 0 24px 80px rgba(0,0,0,0.65)",
          }}
        >
          {/* Glow accent */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              background:
                "radial-gradient(ellipse 55% 40% at 50% 0%, rgba(245,200,66,0.05) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10 p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#f5c842",
                  textShadow: "0 0 10px rgba(245,200,66,0.55)",
                }}
              >
                ◎ Tokenomics
              </span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background:
                    "linear-gradient(to right, rgba(245,200,66,0.25), transparent)",
                }}
              />
              <a
                href="/tokenomics"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.58rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(245,200,66,0.50)",
                  textDecoration: "none",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "#f5c842")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "rgba(245,200,66,0.50)")
                }
              >
                Full Details →
              </a>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
              {/* Donut chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.65, ease, delay: 0.15 }}
                className="flex shrink-0 justify-center"
              >
                <DonutChart />
              </motion.div>

              {/* Legend + pills */}
              <div className="flex flex-1 flex-col gap-5">
                {/* Distribution legend */}
                <div className="flex flex-col gap-2">
                  {SLICES.map((slice) => (
                    <div key={slice.label} className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: slice.color,
                          boxShadow: `0 0 6px ${slice.color}80`,
                        }}
                      />
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.68rem",
                            color: "rgba(255,255,255,0.5)",
                            lineHeight: 1,
                          }}
                        >
                          {slice.label}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: slice.color,
                            lineHeight: 1,
                          }}
                        >
                          {slice.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom pill stats */}
            <div
              className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {PILLS.map((pill) => (
                <div
                  key={pill.label}
                  className="flex flex-col items-center gap-0.5 rounded-xl py-3 px-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "#fff",
                      lineHeight: 1,
                      textAlign: "center",
                    }}
                  >
                    {pill.value}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.52rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.28)",
                    }}
                  >
                    {pill.sub}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.46rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.16)",
                      marginTop: "2px",
                    }}
                  >
                    {pill.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
