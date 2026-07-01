"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TokenData } from "@/app/api/token/route";
import { TOKEN_MINT, TOKEN_TICKER, PUMP_URL } from "@/lib/token";

const CA = TOKEN_MINT; // single source of truth (shared)
const POLL_MS_BASE = 15_000;
const POLL_MS_MAX  = 60_000;

/* ── Sparkline geometry (premium static visual) ─────────────────────────── */
const PTS: [number, number][] = [
  [0, 72], [18, 68], [36, 62], [54, 70], [72, 58],
  [90, 52], [108, 56], [126, 44], [144, 38], [162, 42],
  [180, 30], [198, 22], [216, 26], [234, 14], [252, 6],
];

function buildCubic(pts: [number, number][]) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

const linePath = buildCubic(PTS);
const areaPath = `${linePath} L ${PTS[PTS.length - 1][0]} 80 L 0 80 Z`;

/* ── Number formatters ───────────────────────────────────────────────────── */
function fmtPrice(n: number): string {
  if (n <= 0) return "$0";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 0.01)     return `$${n.toPrecision(4)}`;
  if (n < 1)        return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtCap(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtSupply(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  return n.toLocaleString("en-US");
}

/* ── Skeleton shimmer cell ───────────────────────────────────────────────── */
function SkeletonVal() {
  return (
    <span
      className="inline-block h-4 w-14 animate-pulse rounded"
      style={{ background: "rgba(255,255,255,0.08)" }}
    />
  );
}

/* ── Main widget ─────────────────────────────────────────────────────────── */
export function TokenWidget() {
  const [data, setData]     = useState<TokenData | null>(null);
  const [error, setError]   = useState(false);
  const [copied, setCopied] = useState(false);

  // Backoff state: errorCount drives doubling delay, reset to 0 on success.
  const errorCount  = useRef(0);
  const timerId     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback((isError: boolean) => {
    if (timerId.current) clearTimeout(timerId.current);
    if (isError) {
      errorCount.current = Math.min(errorCount.current + 1, 4); // cap: 15→30→60→60→60s
    } else {
      errorCount.current = 0;
    }
    const delay = isError
      ? Math.min(POLL_MS_BASE * Math.pow(2, errorCount.current - 1), POLL_MS_MAX)
      : POLL_MS_BASE;
    timerId.current = setTimeout(() => poll(), delay); // eslint-disable-line @typescript-eslint/no-use-before-define
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const poll = useCallback(async () => {
    // Skip fetch when tab is backgrounded — resume handled by visibilitychange.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      const res = await fetch("/api/token", { cache: "no-store" });
      if (!res.ok) throw new Error(`/api/token returned ${res.status}`);
      const json: TokenData = await res.json();
      if (typeof json.price !== "number") throw new Error("malformed response");
      setData(json);
      setError(false);
      scheduleNext(false);
    } catch (err) {
      console.warn("[TokenWidget] fetch error:", err);
      setError(true);
      scheduleNext(true);
    }
  }, [scheduleNext]);

  useEffect(() => {
    poll();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Tab came back into focus — fetch immediately and reset backoff.
        if (timerId.current) clearTimeout(timerId.current);
        errorCount.current = 0;
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerId.current) clearTimeout(timerId.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  const handleCopy = () => {
    navigator.clipboard.writeText(CA).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isUp = (data?.priceChange24h ?? 0) >= 0;

  const stats: { label: string; value: React.ReactNode; color: string }[] = [
    {
      label: "PRICE",
      value: data ? (
        <span>
          {fmtPrice(data.price)}{" "}
          <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>{isUp ? "↑" : "↓"}</span>
        </span>
      ) : <SkeletonVal />,
      color: isUp ? "#f5c842" : "#ff5a5f",
    },
    {
      label: "SUPPLY",
      value: data ? fmtSupply(data.supply) : <SkeletonVal />,
      color: "rgba(255,255,255,0.70)",
    },
    {
      label: "BURNED 🔥",
      value: data ? `${data.burnedPct.toFixed(1)}%` : <SkeletonVal />,
      color: data && data.burnedPct > 0 ? "#ff5a5f" : "#f5c842",
    },
    {
      label: "MARKET CAP",
      value: data ? fmtCap(data.marketCap) : <SkeletonVal />,
      color: "#ffcc33",
    },
  ];

  return (
    <div
      className="relative flex w-72 flex-col gap-4 pixel-panel p-5"
    >
      <div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-80"
              style={{ background: error ? "#ff5a5f" : "#f5c842" }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{
                background: error ? "#ff5a5f" : "#f5c842",
                boxShadow: `0 0 6px ${error ? "#ff5a5f" : "#f5c842"}`,
              }}
            />
          </span>
          <span
            className="text-base font-bold tracking-wide text-white"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            {data?.symbol ? `$${data.symbol.toUpperCase()}` : `$${TOKEN_TICKER}`}
          </span>
        </div>
        <span
          className="pixel-inset px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
          style={{
            fontFamily: "var(--font-mono)",
            color:      error ? "#ff5a5f" : "#f5c842",
            background: error ? "rgba(255,90,95,0.10)" : "rgba(245,200,66,0.10)",
            border:     `1px solid ${error ? "rgba(255,90,95,0.25)" : "rgba(245,200,66,0.25)"}`,
            textShadow: `0 0 8px ${error ? "rgba(255,90,95,0.6)" : "rgba(245,200,66,0.6)"}`,
          }}
        >
          {error ? "RETRYING..." : "live on pump.fun"}
        </span>
      </div>

      {/* ── SVG Sparkline ───────────────────────────────────────────── */}
      <div
        className="overflow-hidden pixel-inset"
        style={{
          background: "rgba(245,200,66,0.03)",
          border: "1px solid rgba(245,200,66,0.08)",
        }}
      >
        <svg
          viewBox="0 0 252 80"
          className="w-full"
          style={{ height: 72, filter: "drop-shadow(0 0 6px rgba(245,200,66,0.5))" }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#e0b633" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f5c842" stopOpacity="1"   />
            </linearGradient>
            <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#f5c842" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f5c842" stopOpacity="0"    />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="url(#sparkGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={PTS[PTS.length - 1][0]}
            cy={PTS[PTS.length - 1][1]}
            r="3"
            fill="#f5c842"
            style={{ filter: "drop-shadow(0 0 4px #f5c842)" }}
          />
        </svg>
      </div>

      {/* ── Tokenomics 2-col grid ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        {stats.map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-2.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p
              className="mb-1 uppercase"
              style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "0.58rem",
                letterSpacing: "0.18em",
                color:         "rgba(255,255,255,0.35)",
              }}
            >
              {label}
            </p>
            <p
              className="font-bold tabular-nums leading-none"
              style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Contract Address ──────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          className="truncate text-[11px] text-white/40"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {CA.slice(0, 6)}...{CA.slice(-4)}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy contract address"
          className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/10"
          style={{ color: copied ? "#f5c842" : "rgba(255,255,255,0.4)" }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>

      {/* ── CTA Button ────────────────────────────────────────────────── */}
      <a
        href={PUMP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl px-4 py-3 text-sm font-bold text-black transition-transform duration-200 hover:scale-105 active:scale-95"
        style={{
          fontFamily: "var(--font-display)",
          background: "linear-gradient(135deg, #e0b633 0%, #f5c842 100%)",
          boxShadow:  "0 0 20px rgba(245,200,66,0.35)",
        }}
      >
        <span className="absolute inset-0 -translate-x-full skew-x-12 bg-white/20 transition-transform duration-500 group-hover:translate-x-[130%]" />
        <span className="relative z-10">Trade on Pump.fun ↗</span>
      </a>

      </div>
    </div>
  );
}
