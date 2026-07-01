"use client";

import { LEAGUES, MAX_PLAYERS_PER_ROOM, ELO_K } from "@/lib/token";
import { PlayLink } from "@/components/ui/PlayLink";

const POWERUPS: Array<{ icon: string; name: string; effect: string }> = [
  { icon: "/sprites/powerup_bomb.png",  name: "Bomb Up",   effect: "+1 simultaneous bomb" },
  { icon: "/sprites/powerup_fire.png",  name: "Fire Up",   effect: "+1 blast radius" },
  { icon: "/sprites/powerup_speed.png", name: "Speed Up",  effect: "Faster movement" },
  { icon: "/sprites/powerup_kick.png",  name: "Kick",      effect: "Punt bombs across the grid" },
  { icon: "/sprites/powerup_wall.png",  name: "Wall Pass", effect: "Phase through crates (temp)" },
  { icon: "/sprites/powerup_health.png",name: "Health",    effect: "Rare +1 HP · 2% drop" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.5rem", letterSpacing: "0.04em", color: "rgba(245,200,66,0.8)", marginBottom: "0.75rem" }}>{children}</div>;
}
function Title({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl, 1.6rem)", lineHeight: 1, color: "#fff", margin: "0 0 0.6rem" }}>{children}</h3>;
}
function Body({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", lineHeight: 1.6, color: "rgba(255,255,255,0.45)", margin: 0 }}>{children}</p>;
}

export function BentoScene() {
  return (
    <section className="relative w-full" style={{ background: "var(--color-bg-1, #0e0d13)", paddingInline: "var(--section-px, 1.5rem)", paddingBlock: "clamp(4rem, 8vw, 7rem)" }}>
      <div className="mx-auto max-w-[1200px]">
        <Eyebrow>WHAT MAKES IT DIFFERENT</Eyebrow>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-3xl, clamp(2.5rem,5vw,5rem))", lineHeight: 0.9, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 2.5rem", maxWidth: "16ch" }}>
          Not another bomber clone.
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          <div className="bento-card sm:col-span-2 p-6">
            <Eyebrow>POWER-UP SYSTEM</Eyebrow>
            <Title>Six ways to dominate</Title>
            <Body>Blow up crates to grab power-ups. Stack them or deny your enemy. Hover to inspect.</Body>
            <div className="mt-5 flex flex-wrap gap-3">
              {POWERUPS.map((p) => (
                <div key={p.name} className="powerup-chip group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.icon} alt={p.name} width={40} height={40} style={{ imageRendering: "pixelated", objectFit: "contain" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }} />
                  <span className="powerup-tip">
                    <b style={{ color: "#f5c842" }}>{p.name}</b><br />{p.effect}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card lg:row-span-2 p-6">
            <Eyebrow>RANKED LADDER</Eyebrow>
            <Title>Climb the MMR</Title>
            <Body>Every ranked match moves your Elo (K={ELO_K}). Beat stronger players to rise faster.</Body>
            <div className="mt-5 flex flex-col gap-2.5">
              {[...LEAGUES].reverse().map((l) => (
                <div key={l.name} className="flex items-center justify-between pixel-inset px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", fontSize: "0.85rem", color: "#fff" }}>{l.emoji} {l.name}</span>
                  <span className="tabular" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "rgba(255,255,255,0.35)" }}>{l.min}+ MMR</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card p-6">
            <Eyebrow>ZERO FRICTION</Eyebrow>
            <Title>Play anywhere</Title>
            <Body>Browser-native. No download. Runs right inside Telegram. {MAX_PLAYERS_PER_ROOM} players per match.</Body>
          </div>

          <div className="bento-card p-6">
            <Eyebrow>NO LUCK</Eyebrow>
            <Title>Provably fair</Title>
            <Body>SHA-256 commit / reveal. Server-authoritative. Verify every match yourself — no house edge on the RNG.</Body>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <PlayLink className="cta-yellow inline-flex items-center px-10" style={{ height: 48, fontSize: "0.88rem" }}>
            ▶ Jump into a match
          </PlayLink>
        </div>
      </div>
    </section>
  );
}
