"use client";

import { useEffect, useRef, useCallback } from "react";

const TEXT_FULL  = "BOMBERMEME";
const TEXT_TOP   = "BOMBER";
const TEXT_BOT   = "MEME";
const FONT_FAMILY = '"Clash Display", "Space Grotesk", system-ui, sans-serif';

// Line-height multiplier used BOTH on the mobile spacer span AND in the canvas
// — must stay in sync so the invisible spacer gives the canvas the right height.
const MOBILE_LINE_H = 1.1;
const MOBILE_BP     = 768; // px — matches Tailwind's `md:` breakpoint

const GRADIENT_STOPS: [number, string][] = [
  [0,    "#fff8c0"],
  [0.28, "#ffdf50"],
  [0.52, "#ffcc33"],
  [0.78, "#ff9a3d"],
  [1,    "#ff6020"],
];

// RPG walk cycle: idle → step-fwd → idle → step-back → repeat
const WALK_CYCLE = [0, 1, 0, 2] as const;
const FRAME_MS   = 150;

// Small per-character Y offsets so sprites ride slightly different lanes
const Y_NUDGES = [0.03, -0.04, 0.02, -0.03, 0.05, -0.06, 0.01, -0.02, 0.04, -0.05];

type MascotDef = { src: string[]; vx: number };

const MASCOTS: MascotDef[] = [
  // ── Original 5 ──────────────────────────────────────────────────────────
  {
    src: [
      "/sprites/trump/new/skin_2_side_0.webp",
      "/sprites/trump/new/skin_2_side_1.webp",
      "/sprites/trump/new/skin_2_side_2.webp",
    ],
    vx: 1.8,   // medium-right
  },
  {
    src: [
      "/sprites/elon/new/skin_3_side_0.webp",
      "/sprites/elon/new/skin_3_side_1.webp",
      "/sprites/elon/new/skin_3_side_2.webp",
    ],
    vx: -2.3,  // medium-left
  },
  {
    src: [
      "/sprites/pepe/new/skin_1_side_0.webp",
      "/sprites/pepe/new/skin_1_side_1.webp",
      "/sprites/pepe/new/skin_1_side_2.webp",
    ],
    vx: 2.6,   // fast-right
  },
  {
    src: [
      "/sprites/shiba/new/skin_0_side_0.webp",
      "/sprites/shiba/new/skin_0_side_1.webp",
      "/sprites/shiba/new/skin_0_side_2.webp",
    ],
    vx: -3.1,  // fast-left
  },
  {
    src: [
      "/sprites/doge/skin_4_side_0.webp",
      "/sprites/doge/skin_4_side_1.webp",
      "/sprites/doge/skin_4_side_2.webp",
    ],
    vx: 2.0,   // medium-right
  },
  // ── New 3 ────────────────────────────────────────────────────────────────
  {
    src: [
      "/sprites/pumpfun/skin_5_side_0.webp",
      "/sprites/pumpfun/skin_5_side_1.webp",
      "/sprites/pumpfun/skin_5_side_2.webp",
    ],
    vx: -1.5,  // slow-left
  },
  {
    src: [
      "/sprites/vitalik/skin_7_side_0.webp",
      "/sprites/vitalik/skin_7_side_1.webp",
      "/sprites/vitalik/skin_7_side_2.webp",
    ],
    vx: 3.4,   // fast-right
  },
  {
    src: [
      "/sprites/mem/skin_8_side_0.webp",
      "/sprites/mem/skin_8_side_1.webp",
      "/sprites/mem/skin_8_side_2.webp",
    ],
    vx: -2.7,  // medium-left
  },
  // ── New 2 ────────────────────────────────────────────────────────────────
  {
    src: [
      "/sprites/skin2/skin_10_side_0.webp",
      "/sprites/skin2/skin_10_side_1.webp",
      "/sprites/skin2/skin_10_side_2.webp",
    ],
    vx: 1.8,   // medium-right — Chad
  },
  {
    src: [
      "/sprites/bogdanoff/skin_9_side_0.webp",
      "/sprites/bogdanoff/skin_9_side_1.webp",
      "/sprites/bogdanoff/skin_9_side_2.webp",
    ],
    vx: -1.3,  // slow-left — Bogdanoff
  },
];

const CANVAS_FILTER = [
  "drop-shadow(0  1px 0 rgba(255,230,100,0.9))",
  "drop-shadow(0  2px 0 rgba(200,130,0,0.7))",
  "drop-shadow(0  4px 0 rgba(140,80,0,0.5))",
  "drop-shadow(0  8px 0 rgba(80,40,0,0.3))",
  "drop-shadow(0 16px 32px rgba(255,180,0,0.25))",
  "drop-shadow(0  0  60px rgba(255,204,51,0.18))",
].join(" ");

interface MascotState {
  x:             number;
  vx:            number;
  floor:         number; // 0 = top text line, 1 = bottom text line (mobile only)
  walkCyclePos:  number;
  lastFrameTime: number;
}

interface Dims {
  w:      number;
  h:      number;
  fs:     number;
  mobile: boolean;
  textY1: number; // canvas Y: top of glyph for floor 0 (and desktop single line)
  textY2: number; // canvas Y: top of glyph for floor 1 (= textY1 on desktop)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

/** Y-center of a sprite on a given floor */
function spriteY(dims: Dims, floor: number, nudge: number): number {
  const base = floor === 1 && dims.mobile ? dims.textY2 : dims.textY1;
  return base + dims.fs * (0.48 + nudge);
}

export function AnimatedTitle({ className }: { className?: string }) {
  const wrapperRef      = useRef<HTMLDivElement>(null);
  const spanDesktopRef  = useRef<HTMLSpanElement>(null); // single-line spacer (md+)
  const spanMobileRef   = useRef<HTMLSpanElement>(null); // two-line spacer (<md)
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const mascotsRef      = useRef<MascotState[]>([]);
  const rafRef          = useRef<number>(0);
  const dimsRef         = useRef<Dims>({
    w: 0, h: 0, fs: 96, mobile: false, textY1: 0, textY2: 0,
  });
  const spritesRef = useRef<(HTMLImageElement[] | null)[]>(
    MASCOTS.map(() => null)
  );

  // ── draw loop ──────────────────────────────────────────────────────────────
  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dims = dimsRef.current;
    const { w: W, h: H, fs, mobile, textY1, textY2 } = dims;
    if (W === 0 || H === 0) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // ── 1. Gold gradient text — establishes the mask pixels ─────────────────
    ctx.font         = `700 ${fs}px ${FONT_FAMILY}`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";

    // Gradient spans from top of first line to bottom of last line
    const gradBot = (mobile ? textY2 : textY1) + fs;
    const grad    = ctx.createLinearGradient(0, textY1, 0, gradBot);
    for (const [stop, color] of GRADIENT_STOPS) grad.addColorStop(stop, color);
    ctx.fillStyle = grad;

    if (mobile) {
      ctx.fillText(TEXT_TOP, W / 2, textY1);
      ctx.fillText(TEXT_BOT, W / 2, textY2);
    } else {
      ctx.fillText(TEXT_FULL, W / 2, textY1);
    }

    // ── 2. source-atop clips sprites to text pixels ──────────────────────────
    ctx.globalCompositeOperation = "source-atop";

    // ── 3. Mascots ───────────────────────────────────────────────────────────
    const spriteH = fs * 0.70;
    const halfC   = spriteH * 0.5;

    const mascots = mascotsRef.current;

    for (let i = 0; i < mascots.length; i++) {
      const s      = mascots[i];
      const frames = spritesRef.current[i];

      // X physics — floor switches at the walls on mobile (platformer bounce)
      s.x += s.vx;
      if (s.x > W - halfC) {
        s.x  = W - halfC;
        s.vx = -Math.abs(s.vx);
        if (mobile) s.floor = s.floor === 0 ? 1 : 0;
      }
      if (s.x < halfC) {
        s.x  = halfC;
        s.vx =  Math.abs(s.vx);
        if (mobile) s.floor = s.floor === 0 ? 1 : 0;
      }

      if (!frames || frames.length === 0) continue;

      // Walk cycle
      if (s.lastFrameTime === 0) s.lastFrameTime = timestamp;
      if (timestamp - s.lastFrameTime >= FRAME_MS) {
        s.walkCyclePos  = (s.walkCyclePos + 1) % WALK_CYCLE.length;
        s.lastFrameTime = timestamp;
      }

      const img = frames[WALK_CYCLE[s.walkCyclePos]];
      if (!img) continue;

      const aspect = img.naturalWidth > 0 ? img.naturalWidth / img.naturalHeight : 1;
      const dstH   = spriteH;
      const dstW   = dstH * aspect;

      // Y derived live from current floor so teleport is instant
      const sy = spriteY(dims, s.floor, Y_NUDGES[i] ?? 0);

      ctx.save();
      ctx.translate(s.x, sy);
      ctx.scale(s.vx < 0 ? -1 : 1, 1);
      ctx.drawImage(img, -dstW / 2, -dstH / 2, dstW, dstH);
      ctx.restore();
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  // ── dimension sync ─────────────────────────────────────────────────────────
  const syncDims = useCallback(() => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const mobile = window.innerWidth < MOBILE_BP;
    const span   = (mobile ? spanMobileRef : spanDesktopRef).current;
    if (!span) return;

    const dpr = window.devicePixelRatio || 1;
    const fs  = parseFloat(getComputedStyle(span).fontSize) || 96;
    const w   = wrapper.clientWidth;

    // Derive canvas height from the active spacer span; add a safety minimum
    const minH = mobile ? fs * 2.35 : fs * 1.12;
    const h    = Math.max(span.clientHeight, Math.round(minH));
    if (w === 0) return;

    // Text glyph Y offsets — must mirror what the mobile spacer actually renders
    const pad    = h * 0.04;
    const textY1 = pad;
    const textY2 = mobile ? textY1 + fs * MOBILE_LINE_H : textY1;

    dimsRef.current = { w, h, fs, mobile, textY1, textY2 };

    canvas.width        = Math.round(w * dpr);
    canvas.height       = Math.round(h * dpr);
    canvas.style.width  = `${w}px`;
    canvas.style.height = `${h}px`;
  }, []);

  // ── initial mascot placement ────────────────────────────────────────────────
  const initMascots = useCallback(() => {
    const dims = dimsRef.current;
    if (dims.w === 0) return;
    mascotsRef.current = MASCOTS.map((m, i) => {
      // Alternate floors: 0 → top, 1 → bottom
      const floor = i % 2;
      return {
        x:             (dims.w / (MASCOTS.length + 1)) * (i + 1),
        vx:            m.vx,
        floor,
        walkCyclePos:  0,
        lastFrameTime: 0,
      };
    });
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const startRAF = () => {
      syncDims();
      initMascots();
      rafRef.current = requestAnimationFrame(draw);
    };

    // Preload all sprite frames — non-blocking, RAF starts immediately
    MASCOTS.forEach((def, i) => {
      Promise.all(def.src.map(loadImage))
        .then((imgs) => { spritesRef.current[i] = imgs; })
        .catch(() => { spritesRef.current[i] = null; });
    });

    // Re-sync + re-init on every resize (handles mobile ↔ desktop switch)
    const ro = new ResizeObserver(() => {
      syncDims();
      initMascots();
    });
    ro.observe(wrapper);

    // Start immediately after fonts are ready; fallback if fonts never fire
    const fallback = setTimeout(startRAF, 400);
    document.fonts.ready.then(() => {
      clearTimeout(fallback);
      startRAF();
    });

    return () => {
      clearTimeout(fallback);
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw, syncDims, initMascots]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ position: "relative", width: "100%", textAlign: "center" }}
    >
      {/*
        Desktop spacer — single line, gives the wrapper its height on md+.
        `hidden md:block` = display:none on mobile, display:block on desktop.
      */}
      <span
        ref={spanDesktopRef}
        aria-hidden
        className="hero-title hidden md:block"
        style={{ visibility: "hidden", whiteSpace: "nowrap", userSelect: "none" }}
      >
        {TEXT_FULL}
      </span>

      {/*
        Mobile spacer — two lines, gives the wrapper double height below md.
        lineHeight must match MOBILE_LINE_H so the canvas Y positions sync.
        `md:hidden` = display:none on desktop.
      */}
      <span
        ref={spanMobileRef}
        aria-hidden
        className="hero-title md:hidden"
        style={{
          visibility: "hidden",
          display:    "block",
          whiteSpace: "nowrap",
          userSelect: "none",
          lineHeight: MOBILE_LINE_H,
        }}
      >
        {TEXT_TOP}
        <br />
        {TEXT_BOT}
      </span>

      <canvas
        ref={canvasRef}
        aria-label="BOMBERMEME animated title"
        role="img"
        style={{
          position:      "absolute",
          top:           0,
          left:          0,
          pointerEvents: "none",
          filter:        CANVAS_FILTER,
        }}
      />

    </div>
  );
}
