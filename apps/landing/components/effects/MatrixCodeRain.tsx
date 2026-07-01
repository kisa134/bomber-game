"use client";

/* "Meme-matrix" code rain (SPEC §2). Smooth, slow, hypnotic: each cell is stamped ONCE
   as the head crosses it (no per-frame glyph strobe), then the fade-to-black leaves the
   trail. Cohesive green-teal palette with rare gold sparks; crypto-meme words drift through
   ($BMB, PUMP, LFG, REKT…). Edge-faded so it blends seamlessly into neighbouring black. */

import { useImperativeHandle, forwardRef, useEffect, useRef } from "react";

const KANA = "ｦｱｳｴｵｶｷｸｹｺｻｼｽｾﾀﾁﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ".split("");
const SYMS = "$¥%#＊01ﾊ7▲◆".split("");
const WORDS = ["PUMP", "LFG", "WAGMI", "$BMB", "REKT", "100x", "BOMB", "DEGEN", "GM", "MOON", "NGMI", "FOMO", "BASED", "BOOM", "WEN", "GG"];

// Cohesive green-teal core with a rare warm spark — calm, not busy.
function pickTint(): string {
  const r = Math.random();
  if (r < 0.08) return "#f5c842"; // gold spark
  if (r < 0.12) return "#3a9e9e"; // deeper teal
  return "#3ddcaf"; // matrix green-teal
}

export interface MatrixRainHandle {
  /** Trigger a shockwave that scatters + dims the rain (called on the blast). */
  shatter: () => void;
}

export const MatrixCodeRain = forwardRef<MatrixRainHandle, { className?: string; speed?: number; fontSize?: number }>(
  function MatrixCodeRain({ className = "", speed = 1, fontSize = 16 }, fwdRef) {
    const ref = useRef<HTMLCanvasElement>(null);
    const shatterT = useRef(0); // 0..1 decaying burst energy

    useImperativeHandle(fwdRef, () => ({ shatter: () => { shatterT.current = 1; } }), []);

    useEffect(() => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let w = 0, h = 0, cols = 0, rows = 0, raf = 0;
      type Col = { head: number; vy: number; tint: string; word: string | null; wc: number; last: number };
      let C: Col[] = [];

      const rand = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0];
      const newCol = (startTop = false): Col => ({
        head: startTop ? -Math.random() * 14 : Math.random() * rows,
        vy: (0.10 + Math.random() * 0.16) * speed, // SLOW + smooth (rows/frame)
        tint: pickTint(),
        word: Math.random() < 0.16 ? rand(WORDS) : null,
        wc: 0,
        last: -1,
      });

      const resize = (): void => {
        const r = canvas.getBoundingClientRect();
        w = Math.max(1, r.width); h = Math.max(1, r.height);
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(w / fontSize); rows = Math.ceil(h / fontSize) + 2;
        C = Array.from({ length: cols }, () => newCol());
      };
      resize();

      const draw = (): void => {
        const burst = shatterT.current;
        // Trail fade — stronger during a shatter so the rain dissolves fast.
        ctx.fillStyle = `rgba(3,4,8,${(0.085 + burst * 0.22).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.font = `700 ${fontSize}px ui-monospace, monospace`;
        ctx.textBaseline = "top";

        const cx = w / 2, cyR = (h / 2) / fontSize;
        for (let i = 0; i < cols; i++) {
          const col = C[i];
          col.head += col.vy + (burst > 0.01 ? burst * 1.6 : 0); // blast accelerates the fall
          const r = Math.floor(col.head);
          // Stamp a NEW glyph only when the head crosses into a fresh row → no strobe.
          if (r !== col.last && r >= 0 && r < rows) {
            col.last = r;
            const x = i * fontSize + (burst > 0.01 ? (Math.random() - 0.5) * burst * 16 : 0); // shockwave jitter
            const y = r * fontSize;
            const g = col.word ? col.word[col.wc++ % col.word.length] : rand(Math.random() < 0.2 ? SYMS : KANA);
            // bright head
            ctx.shadowColor = col.tint; ctx.shadowBlur = 10;
            ctx.fillStyle = "rgba(228,255,246,0.95)";
            ctx.fillText(g, x, y);
            ctx.shadowBlur = 0;
          }
          if (col.head > rows) C[i] = newCol(true);
          // recolor the just-stamped trail tip toward the column tint via a faint overlay
        }
        // Outward shockwave ring on shatter.
        if (burst > 0.01) {
          const rad = (1 - burst) * Math.max(w, h) * 0.75;
          ctx.strokeStyle = `rgba(245,200,66,${(burst * 0.5).toFixed(3)})`;
          ctx.lineWidth = 2 + burst * 6;
          ctx.beginPath();
          ctx.arc(cx, cyR * fontSize, rad, 0, Math.PI * 2);
          ctx.stroke();
          shatterT.current = Math.max(0, burst - 0.03);
        }
        raf = requestAnimationFrame(draw);
      };

      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting && !raf) raf = requestAnimationFrame(draw);
          else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
        },
        { threshold: 0 },
      );
      io.observe(canvas);
      raf = requestAnimationFrame(draw);
      window.addEventListener("resize", resize);
      return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", resize); };
    }, [speed, fontSize]);

    const fade = "linear-gradient(180deg, transparent 0%, #000 16%, #000 82%, transparent 100%)";
    return <canvas ref={ref} className={className} aria-hidden style={{ display: "block", maskImage: fade, WebkitMaskImage: fade }} />;
  },
);
