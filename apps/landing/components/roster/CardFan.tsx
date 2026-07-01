"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FAN_FIGHTERS, type FighterAsset } from "@/lib/rosterData";
import { CollectibleCard } from "./CollectibleCard";
import { usePlayUrl } from "@/lib/playUrl";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function CardFan({
  fighters = FAN_FIGHTERS,
  scrubContainerRef,
}: {
  fighters?: FighterAsset[];
  scrubContainerRef?: React.RefObject<HTMLElement | null>;
}) {
  const [activeIndex, setActiveIndex] = useState(Math.floor(fighters.length / 2));
  const [glitching, setGlitching] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const glitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = fighters[activeIndex]!;

  const playUrl = usePlayUrl();

  const selectIndex = useCallback((i: number) => {
    if (i === activeIndex) return;
    setActiveIndex(i);
    setGlitching(true);
    if (glitchTimer.current) clearTimeout(glitchTimer.current);
    glitchTimer.current = setTimeout(() => setGlitching(false), 420);
  }, [activeIndex]);

  useEffect(() => () => {
    if (glitchTimer.current) clearTimeout(glitchTimer.current);
  }, []);

  useEffect(() => {
    const root = scrubContainerRef?.current;
    if (!root) return;
    const onScrub = (e: Event) => {
      const idx = (e as CustomEvent<{ index: number }>).detail.index;
      if (typeof idx === "number") setActiveIndex(idx);
    };
    root.addEventListener("roster-scrub", onScrub);
    return () => root.removeEventListener("roster-scrub", onScrub);
  }, [scrubContainerRef]);

  const goPrev = useCallback(() => {
    selectIndex(Math.max(0, activeIndex - 1));
  }, [activeIndex, selectIndex]);

  const goNext = useCallback(() => {
    selectIndex(Math.min(fighters.length - 1, activeIndex + 1));
  }, [activeIndex, fighters.length, selectIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "Home") selectIndex(0);
    if (e.key === "End") selectIndex(fighters.length - 1);
  };

  return (
    <div className="roster-scene w-full">
      <div
        ref={wrapperRef}
        role="listbox"
        aria-label="Fighter roster"
        aria-activedescendant={`card-${active.id}`}
        tabIndex={0}
        className={`card-fan-wrapper outline-none ${glitching ? "is-glitching" : ""}`}
        onKeyDown={onKeyDown}
        onTouchStart={(e) => {
          touchStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0]!.clientX - touchStart.current.x;
          const dy = e.changedTouches[0]!.clientY - touchStart.current.y;
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
            if (dx > 0) goPrev();
            else goNext();
          }
        }}
      >
        {glitching && <div className="card-glitch-overlay pxglass-burst-flash" aria-hidden />}
        {fighters.map((f, i) => (
          <CollectibleCard
            key={f.id}
            fighter={f}
            index={i}
            total={fighters.length}
            activeIndex={activeIndex}
            onActivate={() => selectIndex(i)}
          />
        ))}
      </div>

      <div className="card-controls mt-6 flex items-center justify-center gap-4">
        <button type="button" className="card-nav-btn" onClick={goPrev} aria-label="Previous fighter">
          ←
        </button>
        <div className="flex gap-2" role="presentation">
          {fighters.map((f, i) => (
            <button
              key={f.id}
              type="button"
              className={`card-pip ${i === activeIndex ? "is-on" : ""}`}
              aria-label={`Select ${f.name}`}
              onClick={() => selectIndex(i)}
            />
          ))}
        </div>
        <button type="button" className="card-nav-btn" onClick={goNext} aria-label="Next fighter">
          →
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, x: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -8, filter: "blur(3px)" }}
          transition={{ duration: 0.28, ease }}
          className={`card-info-panel mx-auto mt-8 max-w-lg text-left ${glitching ? "is-glitching" : ""}`}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: active.roleColor,
            }}
          >
            {active.role} · {active.serialNumber}
          </span>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              textTransform: "uppercase",
              color: "#fff",
              margin: "0.35rem 0 0.5rem",
            }}
          >
            {active.name}
          </h3>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", lineHeight: 1.6, color: "rgba(255,255,255,0.55)" }}>
            {active.lore}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 tabular-nums" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>
            <span>WIN {active.winRate}%</span>
            <span>MMR {active.avgMMR.toLocaleString("en-US")}</span>
            <span>PICK {active.pickRate}%</span>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex justify-center">
        <a
          href={playUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-yellow inline-flex items-center justify-center px-8"
          style={{ height: "52px", fontSize: "0.95rem" }}
        >
          Select your fighter
        </a>
      </div>
    </div>
  );
}
