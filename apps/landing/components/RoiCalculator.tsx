"use client";

import { useState, useRef, useEffect } from "react";
import { animate } from "framer-motion";

const BET_PRESETS = [1, 10, 50, 100, 500, 1000];
const MIN_BET = 1;
const MAX_BET = 1000;

/* Animated number that springs between values */
function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  className,
  style,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const from = prev.current;
    prev.current = value;
    const ctrl = animate(from, value, {
      duration: 0.38,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = `${prefix}${Math.round(v)}${suffix}`;
      },
    });
    return () => ctrl.stop();
  }, [value, prefix, suffix]);

  return (
    <span ref={nodeRef} className={className} style={style}>
      {prefix}{value}{suffix}
    </span>
  );
}

export function RoiCalculator() {
  const [players, setPlayers] = useState(4);
  const [bet, setBet] = useState(10);

  const totalPot    = bet * players;
  const netProfit   = totalPot - bet;
  const roiPct      = Math.round((netProfit / bet) * 100);

  return (
    <div className="calc-detonate flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-10">

      {/* ── Left: controls ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 lg:max-w-3xl">

        <span
          className="block text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-mono)", color: "#ff8a3c" }}
        >
          LONG POSITION · PROFIT CALCULATOR
        </span>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          {/* Players segmented control */}
          <div>
            <p
              className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/35"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Players
            </p>
            <div className="calc-seg-group">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setPlayers(n)}
                  className={`calc-seg-btn${players === n ? " calc-seg-active" : ""}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Bet range slider + presets */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p
                className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/35"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Your Bet
              </p>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ fontFamily: "var(--font-mono)", color: "#ff8a3c" }}
              >
                ${bet}
              </span>
            </div>

            <div className="calc-slider-track">
              <div
                className="calc-slider-fill"
                style={{ width: `${((bet - MIN_BET) / (MAX_BET - MIN_BET)) * 100}%` }}
              />
              <input
                type="range"
                min={MIN_BET}
                max={MAX_BET}
                step={1}
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
                className="calc-slider"
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-6">
              {BET_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setBet(p)}
                  className={`calc-chip${bet === p ? " calc-chip-active" : ""}`}
                >
                  ${p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#b8ff35" }} />
          <span
            className="text-[11px] font-bold"
            style={{ fontFamily: "var(--font-mono)", color: "#b8ff35" }}
          >
            WINNER TAKES THE POT
          </span>
        </div>
      </div>

      {/* ── Right: outputs ──────────────────────────────────────────── */}
      <div className="calc-output-row md:shrink-0 md:min-w-[300px] lg:min-w-[380px]">
        <div className="calc-output-cell">
          <span className="calc-output-label">POT</span>
          <AnimatedNumber
            value={totalPot}
            prefix="$"
            className="calc-output-value calc-output-value-hero calc-value-volt"
          />
        </div>
        <div className="calc-output-divider" />
        <div className="calc-output-cell">
          <span className="calc-output-label">PROFIT</span>
          <AnimatedNumber
            value={roiPct}
            suffix="%"
            prefix="+"
            className="calc-output-value calc-output-value-hero calc-value-detonate"
          />
        </div>
      </div>
    </div>
  );
}
