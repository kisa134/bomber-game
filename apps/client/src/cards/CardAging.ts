/**
 * CardAging.ts — BomberMeme CCG v2
 * Visual evolution system for collectible cards.
 *
 * Cards visually "age" based on how many matches they've been used in,
 * progressing through 5 prestige stages: Mint → Seasoned → Veteran
 * → Legend → Immortal.
 *
 * Aging makes cards look MORE valuable and prestigious, not damaged.
 * Each stage adds subtle CSS-driven visual enhancements.
 */

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export interface AgingStage {
  /** Display name of the aging stage. */
  name: "Mint" | "Seasoned" | "Veteran" | "Legend" | "Immortal";
  /** Minimum match count required to reach this stage. */
  minMatches: number;
  /** CSS class applied to the card element. */
  cssClass: string;
  /** Human-readable description of the visual changes. */
  description: string;
}

/** The five aging stages, from pristine to immortal. */
export const AGING_STAGES: AgingStage[] = [
  {
    name: "Mint",
    minMatches: 0,
    cssClass: "card-mint",
    description: "Pristine condition. Crystal clear holo, untouched frame.",
  },
  {
    name: "Seasoned",
    minMatches: 10,
    cssClass: "card-seasoned",
    description: "Golden patina on frame corners. Subtle warmth emerges.",
  },
  {
    name: "Veteran",
    minMatches: 50,
    cssClass: "card-veteran",
    description: "Veteran emblem on frame. Faint battle scars on the holo surface.",
  },
  {
    name: "Legend",
    minMatches: 100,
    cssClass: "card-legend",
    description: "Soft gold aura emanates from the card. Name glows with prestige.",
  },
  {
    name: "Immortal",
    minMatches: 500,
    cssClass: "card-immortal",
    description: "Darker, richer tint. Unique gold border. The Immortal mark.",
  },
];

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/** Return the appropriate aging stage for a given match count.
 *  Always returns the highest stage whose minMatches threshold is met. */
export function getAgingStage(matchCount: number): AgingStage {
  let stage = AGING_STAGES[0]!; // Mint fallback
  for (const s of AGING_STAGES) {
    if (matchCount >= s.minMatches) stage = s;
    else break;
  }
  return stage;
}

/** Apply the aging CSS class to a card element.
 *  Removes any previously-applied aging classes first, then adds the
 *  correct one based on matchCount.  Returns the stage that was applied. */
export function applyAgingToCard(
  cardEl: HTMLElement,
  matchCount: number,
): AgingStage {
  // Strip existing aging classes
  for (const s of AGING_STAGES) {
    cardEl.classList.remove(s.cssClass);
  }

  const stage = getAgingStage(matchCount);
  cardEl.classList.add(stage.cssClass);

  // Store the match count for CSS custom property usage
  cardEl.style.setProperty("--match-count", String(matchCount));

  return stage;
}

/** Remove all aging classes from a card element (reset to neutral). */
export function clearAgingFromCard(cardEl: HTMLElement): void {
  for (const s of AGING_STAGES) {
    cardEl.classList.remove(s.cssClass);
  }
  cardEl.style.removeProperty("--match-count");
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

/** Return a CSS string that defines all aging-stage visual styles.
 *  Inject this into a <style> tag or append to your stylesheet.
 *
 *  The styles use CSS pseudo-elements and gradients so they work
 *  on any card without requiring extra DOM nodes.  They layer ON TOP
 *  of the existing 20+ card layers without breaking them. */
export function getAgingCSS(): string {
  return /* css */ `
/* ================================================================
   Card Aging Styles — BomberMeme CCG v2
   These classes are ADDED to the .fighter-card wrapper.
   They overlay subtle visual enhancements on top of the existing
   20+ card layers.  No existing styles are modified.
   ================================================================ */

/* ---- Base: Mint (default, no visual changes) ---- */
.card-mint {
  /* Pristine — nothing extra applied */
}

/* ---- Seasoned (10+ matches): golden patina on frame corners ---- */
.card-seasoned .fc-frame::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  pointer-events: none;
  background:
    conic-gradient(
      from 0deg   at 0%   0%,   rgba(201,160,108,0.55) 0deg 90deg,  transparent 90deg,
      from 90deg  at 100% 0%,   rgba(201,160,108,0.55) 0deg 90deg,  transparent 90deg,
      from 180deg at 100% 100%, rgba(201,160,108,0.55) 0deg 90deg,  transparent 90deg,
      from 270deg at 0%   100%, rgba(201,160,108,0.55) 0deg 90deg,  transparent 90deg
    );
  background-size: 40% 40%;
  background-position: top left, top right, bottom right, bottom left;
  background-repeat: no-repeat;
  mix-blend-mode: screen;
  opacity: 0.6;
}

/* ---- Veteran (50+ matches): emblem + faint scratches ---- */
.card-veteran .fc-frame::before {
  /* Inherit seasoned patina */
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  pointer-events: none;
  background:
    conic-gradient(
      from 0deg   at 0%   0%,   rgba(201,160,108,0.60) 0deg 90deg,  transparent 90deg,
      from 90deg  at 100% 0%,   rgba(201,160,108,0.60) 0deg 90deg,  transparent 90deg,
      from 180deg at 100% 100%, rgba(201,160,108,0.60) 0deg 90deg,  transparent 90deg,
      from 270deg at 0%   100%, rgba(201,160,108,0.60) 0deg 90deg,  transparent 90deg
    );
  background-size: 40% 40%;
  background-position: top left, top right, bottom right, bottom left;
  background-repeat: no-repeat;
  mix-blend-mode: screen;
  opacity: 0.75;
}

/* Veteran emblem overlay */
.card-veteran::after {
  content: "VETERAN";
  position: absolute;
  bottom: 18%;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono, monospace);
  font-size: 6px;
  font-weight: 700;
  letter-spacing: 2.5px;
  color: rgba(201,160,108,0.85);
  text-shadow: 0 0 6px rgba(201,160,108,0.4);
  pointer-events: none;
  z-index: 30;
  opacity: 0.85;
}

/* Faint scratch overlay on holo surface */
.card-veteran .fc-holo::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      75deg,
      transparent,
      transparent 3px,
      rgba(255,255,255,0.03) 3px,
      rgba(255,255,255,0.03) 3.5px
    );
  pointer-events: none;
  mix-blend-mode: overlay;
}

/* ---- Legend (100+ matches): gold aura on name + subtle glow ---- */
.card-legend .fc-frame::before {
  /* Richer patina */
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  pointer-events: none;
  background:
    conic-gradient(
      from 0deg   at 0%   0%,   rgba(224,180,100,0.70) 0deg 90deg,  transparent 90deg,
      from 90deg  at 100% 0%,   rgba(224,180,100,0.70) 0deg 90deg,  transparent 90deg,
      from 180deg at 100% 100%, rgba(224,180,100,0.70) 0deg 90deg,  transparent 90deg,
      from 270deg at 0%   100%, rgba(224,180,100,0.70) 0deg 90deg,  transparent 90deg
    );
  background-size: 45% 45%;
  background-position: top left, top right, bottom right, bottom left;
  background-repeat: no-repeat;
  mix-blend-mode: screen;
  opacity: 0.85;
}

/* Legend emblem */
.card-legend::after {
  content: "LEGEND";
  position: absolute;
  bottom: 18%;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono, monospace);
  font-size: 6px;
  font-weight: 700;
  letter-spacing: 2.5px;
  color: rgba(224,180,100,0.90);
  text-shadow: 0 0 10px rgba(224,180,100,0.5), 0 0 20px rgba(224,180,100,0.2);
  pointer-events: none;
  z-index: 30;
  opacity: 0.9;
}

/* Soft gold aura on character name */
.card-legend .fc-name {
  text-shadow:
    0 0 20px rgba(255,200,90,0.50),
    0 0 40px rgba(255,200,90,0.25),
    0 0 60px rgba(255,200,90,0.10);
  transition: text-shadow 0.4s ease;
}

/* Enhanced scratch texture */
.card-legend .fc-holo::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      75deg,
      transparent,
      transparent 2px,
      rgba(255,255,255,0.04) 2px,
      rgba(255,255,255,0.04) 2.5px
    ),
    repeating-linear-gradient(
      -15deg,
      transparent,
      transparent 5px,
      rgba(255,255,255,0.02) 5px,
      rgba(255,255,255,0.02) 5.5px
    );
  pointer-events: none;
  mix-blend-mode: overlay;
}

/* ---- Immortal (500+ matches): darkest tint, unique gold border ---- */
.card-immortal .fc-frame {
  /* Rich gold border treatment */
  border-image: linear-gradient(
    135deg,
    #d4af37 0%,
    #f0d878 25%,
    #b8942e 50%,
    #f0d878 75%,
    #d4af37 100%
  ) 1;
  box-shadow:
    inset 0 0 0 1px rgba(212,175,55,0.3),
    0 0 20px rgba(212,175,55,0.15);
}

.card-immortal .fc-frame::before {
  /* Deep gold patina */
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  pointer-events: none;
  background:
    conic-gradient(
      from 0deg   at 0%   0%,   rgba(212,175,55,0.80) 0deg 90deg,  transparent 90deg,
      from 90deg  at 100% 0%,   rgba(212,175,55,0.80) 0deg 90deg,  transparent 90deg,
      from 180deg at 100% 100%, rgba(212,175,55,0.80) 0deg 90deg,  transparent 90deg,
      from 270deg at 0%   100%, rgba(212,175,55,0.80) 0deg 90deg,  transparent 90deg
    );
  background-size: 50% 50%;
  background-position: top left, top right, bottom right, bottom left;
  background-repeat: no-repeat;
  mix-blend-mode: screen;
  opacity: 0.9;
}

/* Immortal mark */
.card-immortal::after {
  content: "IMMORTAL";
  position: absolute;
  bottom: 18%;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono, monospace);
  font-size: 5.5px;
  font-weight: 700;
  letter-spacing: 2.5px;
  color: rgba(212,175,55,0.95);
  text-shadow:
    0 0 12px rgba(212,175,55,0.6),
    0 0 24px rgba(212,175,55,0.3),
    0 0 48px rgba(212,175,55,0.1);
  pointer-events: none;
  z-index: 30;
  opacity: 0.95;
}

/* Richer name glow */
.card-immortal .fc-name {
  text-shadow:
    0 0 25px rgba(212,175,55,0.55),
    0 0 50px rgba(212,175,55,0.30),
    0 0 80px rgba(212,175,55,0.12);
  transition: text-shadow 0.4s ease;
}

/* Subtle overall tint */
.card-immortal .fc-art {
  filter: sepia(0.08) saturate(1.12) contrast(1.04);
}

/* ---- Inspect-view specific aging enhancements ---- */

/* In inspect view, Legend cards get an additional subtle glow emanation */
.inspect-view .card-legend .fighter-card {
  box-shadow:
    0 0 40px rgba(255,200,90,0.12),
    0 0 80px rgba(255,200,90,0.06);
}

/* In inspect view, Immortal cards get the strongest glow */
.inspect-view .card-immortal .fighter-card {
  box-shadow:
    0 0 50px rgba(212,175,55,0.18),
    0 0 100px rgba(212,175,55,0.08);
}
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a formatted "Age status" string for UI display.
 *  Example: "Veteran (47 matches)" or "Immortal (1,247 matches)" */
export function formatAgeStatus(matchCount: number): string {
  const stage = getAgingStage(matchCount);
  const formatted = matchCount.toLocaleString();
  return `${stage.name} · ${formatted} match${matchCount === 1 ? "" : "es"}`;
}

/** Return the progress percentage toward the NEXT aging stage.
 *  0% = just entered current stage, 100% = reached next stage.
 *  Returns 100 if already at Immortal (max stage). */
export function getAgingProgress(matchCount: number): number {
  const current = getAgingStage(matchCount);
  const idx = AGING_STAGES.indexOf(current);
  const next = AGING_STAGES[idx + 1];
  if (!next) return 100; // Already Immortal

  const range = next.minMatches - current.minMatches;
  const progress = matchCount - current.minMatches;
  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
}
