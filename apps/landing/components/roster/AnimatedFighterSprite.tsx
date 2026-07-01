"use client";

import { useEffect, useState } from "react";

/** Side-profile walk cycle — fast frame swap for "alive" broadcast feel. */
export function AnimatedFighterSprite({
  src,
  alt,
  className,
  style,
  fps = 14,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fps?: number;
}) {
  const base = src.replace(/_side_\d+\.webp$/, "_side_");
  const frames = [0, 1, 2].map((f) => `${base}${f}.webp`);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % frames.length), 1000 / fps);
    return () => clearInterval(id);
  }, [frames.length, fps]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={frames[frame]}
      alt={alt ?? ""}
      className={className}
      style={{ imageRendering: "pixelated", ...style }}
      draggable={false}
      onError={(e) => {
        (e.target as HTMLImageElement).src = src;
      }}
    />
  );
}
