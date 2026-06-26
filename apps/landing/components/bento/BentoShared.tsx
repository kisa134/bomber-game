import type { ReactNode } from "react";

/* ── Shared animation variants ──────────────────────────────────────────── */
export const iFade = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0 } };
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

/* ── GameplayMediaCard ───────────────────────────────────────────────────── */
export function GameplayMediaCard({
  mascot,
  children,
}: {
  mascot: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bento-card relative flex h-full flex-col overflow-visible rounded-3xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-xl transition-[border-color,box-shadow] duration-200 group-hover:border-accent/20 lg:p-4">
      {mascot}
      <div className="relative aspect-video overflow-hidden rounded-2xl">
        {children}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_48px_rgba(0,0,0,0.45)]" />
      </div>
    </div>
  );
}

/* ── MiniStat ───────────────────────────────────────────────────────────── */
export function MiniStat({
  value,
  label,
  mono,
  color = "#f5c842",
}: {
  value: string;
  label: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-center lg:px-3 lg:py-2"
      style={{
        background:   `${color}0d`,
        border:       `1px solid ${color}22`,
        transition:   "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <div
        className="text-xs font-bold tabular-nums lg:text-sm"
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-display)",
          color,
          textShadow: `0 0 10px ${color}80`,
        }}
      >
        {value}
      </div>
      <div
        className="text-[8px] uppercase tracking-[0.15em] lg:text-[9px]"
        style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.28)" }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── PowerupCard ────────────────────────────────────────────────────────── */
export function PowerupCard({ image, name, desc }: { image: string; name: string; desc: string }) {
  return (
    <div
      className="cyber-glass group flex h-full flex-col gap-1.5 p-3 transition-transform
                 hover:-translate-y-0.5 lg:p-3"
    >
      <div className="powerup-icon">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={name}
          className="h-11 w-11 rounded-lg object-cover shadow-lg
                     transition-transform duration-300 ease-out group-hover:scale-110 lg:h-12 lg:w-12"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <div
        className="text-[10px] font-bold uppercase tracking-wider lg:text-xs"
        style={{ fontFamily: "var(--font-display)", color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.6)" }}
      >
        {name}
      </div>
      <div
        className="text-[10px] leading-snug lg:text-[11px]"
        style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.38)" }}
      >
        {desc}
      </div>
    </div>
  );
}
