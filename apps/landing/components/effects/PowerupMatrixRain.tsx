"use client";

import { useEffect, useRef } from "react";
import { registerRaf, unregisterRaf } from "@/lib/rafManager";
import { getLiteLevel } from "@/lib/liteMode";

const POWERUPS = [
  { src: "/sprites/powerup_bomb.png", tint: "#ff5a4d" },
  { src: "/sprites/powerup_fire.png", tint: "#f0a92a" },
  { src: "/sprites/powerup_speed.png", tint: "#3a9e9e" },
  { src: "/sprites/powerup_kick.png", tint: "#c4ff3d" },
  { src: "/sprites/powerup_health.png", tint: "#ff5a8a" },
  { src: "/sprites/powerup_wall.png", tint: "#a88cff" },
] as const;

interface Drop {
  x: number;
  y: number;
  speed: number;
  layer: number;
  src: string;
  tint: string;
  size: number;
  phase: number;
}

export function PowerupMatrixRain({ className = "", intensity = 1 }: { className?: string; intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<Drop[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || getLiteLevel() === "minimal") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.floor((w * h) / 14000) * intensity;
      dropsRef.current = Array.from({ length: Math.min(count, 120) }, (_, i) => {
        const p = POWERUPS[i % POWERUPS.length]!;
        const layer = (i % 3) + 1;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          speed: (0.35 + layer * 0.22) * (0.7 + Math.random() * 0.6),
          layer,
          src: p.src,
          tint: p.tint,
          size: 10 + layer * 4 + Math.random() * 6,
          phase: Math.random() * Math.PI * 2,
        };
      });
    };

    const images = POWERUPS.map((p) => {
      const img = new Image();
      img.src = p.src;
      return img;
    });

    const tick = (dt: number) => {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(245,200,66,0.04)");
      grad.addColorStop(0.45, "rgba(127,216,255,0.02)");
      grad.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (const d of dropsRef.current) {
        d.y += d.speed * dt * 0.06;
        d.phase += dt * 0.002;
        if (d.y > h + 40) {
          d.y = -30 - Math.random() * h * 0.3;
          d.x = Math.random() * w;
        }

        const alpha = (0.12 + d.layer * 0.1) * intensity;
        const wobble = Math.sin(d.phase) * 3;

        ctx.globalAlpha = alpha;
        ctx.shadowColor = d.tint;
        ctx.shadowBlur = 8 + d.layer * 3;

        const img = images[POWERUPS.findIndex((p) => p.src === d.src)]!;
        if (img.complete && img.naturalWidth) {
          ctx.drawImage(img, d.x + wobble, d.y, d.size, d.size);
        } else {
          ctx.fillStyle = d.tint;
          ctx.fillRect(d.x + wobble, d.y, 4, d.size);
        }
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    registerRaf("powerup-matrix-rain", tick);

    return () => {
      ro.disconnect();
      unregisterRaf("powerup-matrix-rain");
    };
  }, [intensity]);

  if (getLiteLevel() === "minimal") return null;

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden
    />
  );
}
