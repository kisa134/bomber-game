"use client";

const ROWS = [
  { y: "78%", speed: 28, scale: 1, opacity: 0.55 },
  { y: "86%", speed: -22, scale: 0.85, opacity: 0.4 },
  { y: "93%", speed: 35, scale: 0.7, opacity: 0.3 },
] as const;

function BlockStrip({
  variant,
  speed,
  scale,
  opacity,
  top,
}: {
  variant: "hard" | "soft";
  speed: number;
  scale: number;
  opacity: number;
  top: string;
}) {
  const blocks = Array.from({ length: 24 }, (_, i) => i);
  const src = variant === "hard" ? "/sprites/hard.webp" : "/sprites/soft.webp";

  return (
    <div
      className="block-scroller-strip absolute left-0 flex gap-1"
      style={{
        top,
        animation: `blockScroll ${Math.abs(40 / speed)}s linear infinite`,
        animationDirection: speed < 0 ? "reverse" : "normal",
        transform: `scale(${scale})`,
        opacity,
        imageRendering: "pixelated",
      }}
      aria-hidden
    >
      {blocks.map((i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt=""
          className={variant === "soft" ? "block-soft-tint" : "block-hard-tint"}
          style={{ width: 32, height: 32, imageRendering: "pixelated" }}
        />
      ))}
      {blocks.map((i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`dup-${i}`}
          src={src}
          alt=""
          className={variant === "soft" ? "block-soft-tint" : "block-hard-tint"}
          style={{ width: 32, height: 32, imageRendering: "pixelated" }}
        />
      ))}
    </div>
  );
}

export function BlockScroller({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[28%] overflow-hidden ${className}`} aria-hidden>
      {ROWS.map((row, i) => (
        <BlockStrip
          key={i}
          variant={i % 2 === 0 ? "hard" : "soft"}
          speed={row.speed}
          scale={row.scale}
          opacity={row.opacity}
          top={row.y}
        />
      ))}
      <div
        className="absolute inset-x-0 bottom-0 h-16"
        style={{ background: "linear-gradient(to top, var(--color-bg-1, #0a0a10), transparent)" }}
      />
    </div>
  );
}
