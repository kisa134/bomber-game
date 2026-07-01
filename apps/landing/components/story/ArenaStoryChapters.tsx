"use client";

/* SPEC §3 — Storytelling, rebuilt as ONE continuous cinematic scene (not a stack of cards).
   Three planes create real depth:
     • BACKGROUND  (z-0, sticky)  — persistent atmosphere: square arena grid + glow + scanlines,
                                    slow parallax. ASSET SLOT: `arena environment plate`.
     • MIDGROUND   (z-10)         — the beat: restrained type + a recessed broadcast PLATE.
                                    ASSET SLOT per beat: clip / art / sprite.
     • FOREGROUND  (z-30)         — a bomber silhouette / debris that breaks OUT of the plate and
                                    parallaxes faster, overlapping planes. ASSET SLOT: `fg insert`.
   Desktop = scroll-parallax staging (GSAP). Mobile / reduced-motion = vertical narrative, no
   parallax, atmosphere preserved. */

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PlayLink } from "@/components/ui/PlayLink";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Plate = { type: "image" | "video" | "sprites"; src: string; sprites?: string[] };
interface Beat {
  id: string;
  tag: string;
  title: string;
  body: string;
  accent: string;
  side: "left" | "right";
  plate: Plate;
  /** Foreground breakout insert (asset-gen slot). null = none. */
  fg: { src: string; h: number; pixel?: boolean } | null;
}

// ── ASSET SLOTS ───────────────────────────────────────────────────────────────
// Background atmosphere plate (swap for a generated environment when ready).
const BG_PLATE = "/bg/hero-grid-blast.webp";
const BEATS: Beat[] = [
  {
    id: "arena", tag: "THE ARENA", title: "Broadcast\nfrom the chain",
    body: "Every match runs on Solana. Entry in, winner out — no excuses, no refunds.",
    accent: "#f5c842", side: "left",
    plate: { type: "image", src: "/bg/hero-control-room.webp" },
    fg: { src: "/sprites/skin_2.webp", h: 150, pixel: true },
  },
  {
    id: "field", tag: "THE FIELD", title: "Crates,\ncorners, chaos",
    body: "Classic bomber grid — break blocks, dodge blasts, trap three suckers at once.",
    accent: "#3a9e9e", side: "right",
    plate: { type: "image", src: "/bg/hero-arena-a.webp" },
    fg: { src: "/sprites/skin_3.webp", h: 140, pixel: true },
  },
  {
    id: "match", tag: "MATCH FLOW", title: "4 players\n~3 minutes",
    body: "Free-for-all from spawn to sudden death. Every meme for themselves. No hand-holding.",
    accent: "#f5c842", side: "left",
    plate: { type: "video", src: "/sprites/demo2.mp4" },
    fg: { src: "/sprites/powerup_bomb.png", h: 66 },
  },
  {
    id: "powerups", tag: "POWER-UPS", title: "Bomb · fire\nspeed · kick",
    body: "Stack upgrades from crate drops. Kick bombs through walls. Out-range everyone.",
    accent: "#d44030", side: "right",
    plate: { type: "sprites", src: "", sprites: ["/sprites/powerup_bomb.png", "/sprites/powerup_fire.png", "/sprites/powerup_speed.png", "/sprites/powerup_kick.png"] },
    fg: null,
  },
  {
    id: "sudden", tag: "SUDDEN DEATH", title: "Last minute\nmap wipes",
    body: "The arena shrinks. Nowhere to hide. One blast decides who gets paid and who gets buried.",
    accent: "#d44030", side: "left",
    plate: { type: "image", src: "/bg/hero-grid-blast.webp" },
    fg: { src: "/sprites/powerup_fire.png", h: 64 },
  },
];

function PlateMedia({ plate }: { plate: Plate }) {
  if (plate.type === "video") {
    return (
      <video className="h-full w-full object-cover" muted loop playsInline autoPlay preload="metadata" poster={BG_PLATE}>
        <source src={plate.src} type="video/mp4" />
      </video>
    );
  }
  if (plate.type === "sprites") {
    return (
      <div className="flex h-full w-full items-center justify-center gap-5 p-8" style={{ background: "rgba(4,5,9,0.5)" }}>
        {(plate.sprites ?? []).map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={s} src={s} alt="" style={{ width: 54, imageRendering: "pixelated", filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.7))" }} />
        ))}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={plate.src} alt="" className="h-full w-full object-cover" style={{ filter: "saturate(0.95) brightness(0.82)" }} />;
}

export function ArenaStoryChapters() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 768) return; // mobile: plain vertical narrative, no parallax
    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      // Background plate drifts slowly the whole way down (deep parallax).
      gsap.to(".story-bg-plate", {
        yPercent: 14,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
      // Foreground inserts parallax FASTER than their plate → planes separate in depth.
      gsap.utils.toArray<HTMLElement>(".story-fg").forEach((node) => {
        gsap.fromTo(
          node,
          { yPercent: 24 },
          { yPercent: -24, ease: "none", scrollTrigger: { trigger: node, start: "top bottom", end: "bottom top", scrub: 0.6 } },
        );
      });
      // Plates lift a touch slower than the copy → subtle mid-plane separation.
      gsap.utils.toArray<HTMLElement>(".story-plate").forEach((node) => {
        gsap.fromTo(
          node,
          { yPercent: 8 },
          { yPercent: -8, ease: "none", scrollTrigger: { trigger: node, start: "top bottom", end: "bottom top", scrub: 0.8 } },
        );
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="arena-story relative overflow-clip" style={{ background: "#050509" }}>
      {/* ── BACKGROUND PLANE (sticky, persists across every beat = one canvas) ── */}
      <div className="pointer-events-none sticky top-0 z-0 h-screen w-full overflow-hidden" aria-hidden>
        {/* asset slot: generated environment plate */}
        <div
          className="story-bg-plate absolute inset-[-8%]"
          style={{
            backgroundImage: `url(${BG_PLATE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.16,
            filter: "blur(3px) saturate(0.7) brightness(0.55)",
          }}
        />
        {/* structured square arena grid (disciplined, grid-aware depth) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(245,200,66,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(58,158,158,0.04) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 90% 75% at 50% 45%, #000 35%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 75% at 50% 45%, #000 35%, transparent 80%)",
          }}
        />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 42%, rgba(245,200,66,0.05), transparent 65%)" }} />
        <div className="absolute inset-0 bm-scanlines opacity-[0.25]" />
      </div>

      {/* pull the flow up over the sticky bg */}
      <div className="relative z-10 -mt-[100vh]">
        {/* intro */}
        <div className="mx-auto max-w-[1200px] px-[var(--section-px,1.5rem)] pb-6 pt-28">
          <p style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", letterSpacing: "0.06em", color: "rgba(245,200,66,0.7)" }}>THE BREAKDOWN</p>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "clamp(1.9rem,4.4vw,3rem)", color: "#fff", marginTop: 8, lineHeight: 0.95 }}>
            One match,<br />beat by beat
          </h2>
        </div>

        {/* ── BEATS (midground content + foreground breakout) ── */}
        {BEATS.map((beat) => {
          const right = beat.side === "right";
          return (
            <div key={beat.id} className="story-beat relative flex min-h-[86svh] items-center">
              <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-x-10 gap-y-8 px-[var(--section-px,1.5rem)] py-14 lg:grid-cols-12">
                {/* MID — copy */}
                <motion.div
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{ duration: 0.7, ease }}
                  className={`lg:col-span-5 ${right ? "lg:order-2 lg:col-start-8" : ""}`}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.24em", color: beat.accent }}>{beat.tag}</span>
                  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "clamp(1.9rem,4.2vw,3.1rem)", lineHeight: 0.92, color: "#fff", margin: "0.8rem 0", whiteSpace: "pre-line" }}>
                    {beat.title}
                  </h3>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", lineHeight: 1.65, color: "rgba(255,255,255,0.5)", maxWidth: "40ch" }}>{beat.body}</p>
                </motion.div>

                {/* MID — broadcast plate + FOREGROUND breakout insert */}
                <div className={`relative lg:col-span-7 ${right ? "lg:order-1" : ""}`}>
                  <motion.div
                    initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
                    whileInView={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
                    viewport={{ once: true, margin: "-12% 0px" }}
                    transition={{ duration: 0.85, ease }}
                    className="story-plate relative overflow-hidden"
                    style={{ aspectRatio: "16/10", border: `1px solid ${beat.accent}2e`, boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.03)" }}
                  >
                    <PlateMedia plate={beat.plate} />
                    <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,6,12,0.5), transparent 30%, transparent 65%, rgba(5,6,12,0.75))" }} />
                    <div className="bm-scanlines pointer-events-none absolute inset-0 opacity-25" aria-hidden />
                    {/* corner brackets */}
                    <span className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 border-l-2 border-t-2" style={{ borderColor: `${beat.accent}cc` }} />
                    <span className="pointer-events-none absolute bottom-2 right-2 h-3.5 w-3.5 border-b-2 border-r-2" style={{ borderColor: `${beat.accent}cc` }} />
                  </motion.div>

                  {beat.fg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={beat.fg.src}
                      alt=""
                      aria-hidden
                      className={`story-fg pointer-events-none absolute z-30 ${right ? "-right-4 lg:-right-10" : "-left-4 lg:-left-10"} -bottom-8 hidden sm:block`}
                      style={{ height: beat.fg.h, width: "auto", imageRendering: beat.fg.pixel ? "pixelated" : "auto", filter: "drop-shadow(0 18px 34px rgba(0,0,0,0.85))" }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* outro CTA */}
        <div className="px-[var(--section-px,1.5rem)] pb-24 pt-10 text-center">
          <PlayLink className="cta-yellow inline-flex items-center px-8" style={{ height: 52, fontSize: "0.95rem" }}>
            ▶ Enter the pit
          </PlayLink>
        </div>
      </div>
    </section>
  );
}
