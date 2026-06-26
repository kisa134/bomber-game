# AUDIT_PLAN_2026.md — BomberMeme Landing Modernization Master Plan

> **Prepared:** 2026-06-21  
> **Standard:** AAA Web3 GameFi 2026–2027  
> **Aesthetic:** Liquid Glass · Framer Motion · Clash Display · Space Mono

---

## Codebase Findings (Cross-Reference with Audit)

### Current Page Composition (`app/page.tsx`)
```
Hero → BentoSection → CharactersAndCreators → RoadmapSection → Footer
```

### Confirmed Issues from Audit

| # | Audit Item | Finding in Code |
|---|-----------|-----------------|
| 2.1 | Hero lacks visual gameplay | `/sprites/demo2_boomerang.mp4` IS present but needs a "LIVE GAMEPLAY PREVIEW" label overlay and more cinematic treatment |
| 2.2 | Characters section visually weak | `skin_0–3.webp` are 112×112px pixel sprites floating in a card — no full-art character cards |
| 2.3 | TokenWidget in wrong place | `Hero.tsx` line 89: `hidden xl:flex absolute left-4` — buried as a desktop-only float |
| 2.4 | CTA `#wallet` is broken | `Hero.tsx` line 205: `href="#wallet"` — no `id="wallet"` exists anywhere in the DOM |
| 2.5 | Mobile responsiveness untested | Hero CTA row is `flex-col sm:flex-row` but buttons have `px-8/px-9` fixed — not `w-full` on mobile |
| 3.1 | No social proof / Live Stats | Not present anywhere on home page |
| 3.2 | No Video Trailer section | Not present |
| 3.3 | No FAQ on homepage | FAQ is a separate page at `/faq` only |
| 3.4 | No Compact Tokenomics block | Tokenomics is a separate page at `/tokenomics` only |
| 3.5 | Missing scroll reveal | BentoSection uses a single `useInView` ref for the whole section — only triggers once, not per-card |
| 3.6 | No sticky bottom CTA | Not present |
| Tech | Bento not split | `BentoSection.tsx` is 301 lines with `GameplayMediaCard`, `MiniStat`, `PowerupCard` all inline |
| Tech | RoiCalculator not lazy-loaded | Imported directly in `BentoSection.tsx` — blocks initial bundle |
| Tech | TopNav has no scroll listener | `fixed top-6 right-6` pill — no background darkening on scroll |

---

## Phase 1: Critical Architecture & Layout Shifts

**Goal:** Fix broken UX, reposition TokenWidget, elevate Hero visuals, repair CTAs, mobile polish.

### 1.1 — Fix Broken `#wallet` CTA (Hero.tsx)
- Change secondary CTA from `href="#wallet"` label "Connect Wallet" → `href="https://pump.fun/coin/2Lbnrt7iRx2RHGBXXXc3z8Do3bp3oZ9FtkAohLvxpump"` label "💎 Buy $BMB"
- Update button style to keep glassmorphism aesthetic but add a subtle purple Solana glow

### 1.2 — Relocate TokenWidget (`Hero.tsx` → `app/page.tsx`)
- **Remove** from `Hero.tsx` line 88–91 (the `hidden xl:flex absolute left-4...` wrapper)
- **Add** to `app/page.tsx` between `<RoadmapSection />` and `<Footer />` with `id="token"` wrapper div
- Wrap in a centered, constrained container (`max-w-sm mx-auto py-16`)

### 1.3 — Enhance Hero Video Treatment (`Hero.tsx`)
- Add a glassmorphic top-left badge overlay on the video container: `LIVE GAMEPLAY · 3–8s LOOP`
- Add a subtle gold gradient border `border-accent/20` to the `rounded-3xl` video wrapper
- Optionally: try `demo2.mp4` as the primary source with `demo2_boomerang.mp4` as a fallback `<source>` for a longer loop

### 1.4 — Upgrade Character Art Cards (`CharactersAndCreators.tsx`)
- Replace the row of 4 floating 112×112 sprites with 4 premium "character art cards" (bento-card glass style)
- Each card: placeholder art image `https://placehold.co/220x320/111827/ffcc33?text=TRUMP` (swap when real art arrives), character name in Clash Display, a "EQUIPPED" / "LOCKED" glass badge, a 3-stat row (Win Rate, K/D, Rarity)
- Reuse existing `skin_*.webp` as a pixel-art inset in the top-left of each card

### 1.5 — Mobile CTA Fix (`Hero.tsx`)
- Hero CTA `<a>` buttons: add `w-full sm:w-auto` so they stretch full-width on ≤375px
- BentoSection Row 1: `grid-cols-1 lg:grid-cols-4` is correct; verify Row 2 `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` doesn't collapse weirdly — add `min-w-0` to PowerupCard items

### 1.6 — Fix `#play` anchor in Footer
- Audit footer for `href="#play"` → change to `href="http://bombermeme.fun/play"` (external link)

---

## Phase 2: Component Refactoring & Performance

**Goal:** Split BentoSection, lazy-load heavy components, strengthen Framer Motion animations.

### 2.1 — Split `BentoSection.tsx` (301 lines → 4 files)

```
components/bento/
  BentoSection.tsx       ← orchestrator only (imports rows, ~80 lines)
  BentoRow1Arena.tsx     ← GameplayMediaCard + LiveArena card
  BentoRow2Powerups.tsx  ← 6 PowerupCard items
  BentoRow3Skills.tsx    ← 3 skill cards
  BentoRow4Roi.tsx       ← RoiCalculator wrapper (lazy)
  BentoShared.tsx        ← GameplayMediaCard, MiniStat, PowerupCard sub-components
```

### 2.2 — Lazy-load `RoiCalculator` with `next/dynamic`
- In `BentoRow4Roi.tsx`: replace direct import with:
  ```ts
  const RoiCalculator = dynamic(() => import("@/components/RoiCalculator"), {
    ssr: false,
    loading: () => <div className="bento-card roi-card h-48 animate-pulse" />,
  });
  ```

### 2.3 — Per-Card Scroll Reveals (`BentoSection`)
- Replace single top-level `useInView` with individual `whileInView` + `viewport={{ once: true }}` on each `motion.div` row — same `iFade`/`stagger` variants, zero extra deps
- This ensures each row reveals as it scrolls into view rather than all triggering from the section top

### 2.4 — TopNav Scroll-Based Background (`TopNav.tsx`)
- Add `useEffect` + `scroll` listener: at `scrollY > 40`, transition background from `rgba(255,255,255,0.02)` → `rgba(14,16,24,0.85)` with added blur
- Animate with `framer-motion` `motion.nav` + `animate` prop keyed on scroll state

### 2.5 — Lazy-load `CreatorCalculator` on `/partners`
- `app/partners/page.tsx` line ~570: wrap with `next/dynamic` + `ssr: false` (same pattern as 2.2)

---

## Phase 3: New Feature Injection

**Goal:** Add social proof, video trailer, FAQ, compact tokenomics, sticky CTA.

### 3.1 — `LiveStatsBar` Component
- **Position:** Between `<Hero />` and `<BentoSection />` in `app/page.tsx`
- **File:** `components/LiveStatsBar.tsx`
- **Content:** 3 animated counters (Framer Motion `useMotionValue` + `animate`) for:
  - `GAMES PLAYED` — count up from 0 to `12,847+`
  - `TOTAL POT VALUE` — `$284,193`
  - `ACTIVE PLAYERS` — `341` with green pulse dot
- **Design:** Full-width dark glassmorphic strip, Space Mono font, gold/green neon values
- **Data:** Static seed values (live API hookup later)

### 3.2 — `VideoTrailerSection` Component
- **Position:** Between `<BentoSection />` and `<CharactersAndCreators />` in `app/page.tsx`
- **File:** `components/VideoTrailerSection.tsx`
- **Content:** 16:9 placeholder `<iframe>` or `<video>` with placeholder thumbnail `https://placehold.co/1280x720/0e1018/ffcc33?text=GAMEPLAY+TRAILER+COMING+SOON`, play button overlay (gold pulsing circle), section label "WATCH THE CHAOS"
- **Animation:** `whileInView` scale reveal `0.95 → 1.0` with blur dissolve

### 3.3 — `HomeFaqAccordion` Component
- **Position:** Between `<CharactersAndCreators />` and `<RoadmapSection />` in `app/page.tsx`
- **File:** `components/HomeFaqAccordion.tsx`
- **5 Questions:**
  1. "What is BomberMeme?" 
  2. "How does the prize pot work?"
  3. "Do I need a crypto wallet to play?"
  4. "What is $BMB token used for?"
  5. "How is the game provably fair?"
- **Design:** Accordion with `AnimatePresence` height animation, `+/−` gold icon, mono body text, bento-card border style

### 3.4 — `CompactTokenomics` Component
- **Position:** Injected into `app/page.tsx` alongside TokenWidget (pre-Footer zone, `id="token"`)
- **File:** `components/CompactTokenomics.tsx`
- **Content:** Simple 3-column pill grid: Total Supply · Distribution · Utility + a minimal donut chart (pure SVG, no external chart lib)
- **Data:** Pulled from `/tokenomics` page or hardcoded from audit specs

### 3.5 — `StickyCtaBanner` Component
- **Position:** Fixed bottom, `z-50`, rendered in `app/layout.tsx` (or `app/page.tsx` with portal)
- **File:** `components/StickyCtaBanner.tsx`
- **Behavior:**
  - Hidden on desktop (`hidden md:hidden`)
  - Appears on mobile after scrolling past `100vh` (via `useScroll` from framer-motion)
  - Content: `💣 PLAY NOW — Free Entry · Win SOL` + gold CTA button
  - Dismiss button (X icon) stores state in `sessionStorage`
- **Design:** Full-width glass dark pill, safe-area bottom padding for iOS

---

## Target Page Composition (Post-Execution)

```
TopNav (fixed, scroll-aware background)
├── Hero (video prominent, Buy $BMB CTA, no TokenWidget)
├── LiveStatsBar (FOMO ticker)
├── BentoSection (split, lazy RoiCalc, per-card reveals)
├── VideoTrailerSection (placeholder → real trailer)
├── CharactersAndCreators (premium art cards)
├── HomeFaqAccordion (5 questions)
├── RoadmapSection
├── CompactTokenomics + TokenWidget (id="token")
└── Footer
StickyCtaBanner (mobile fixed bottom, scroll-triggered)
```

---

## File Change Summary

| File | Action |
|------|--------|
| `app/page.tsx` | Add 4 new section imports, reorder layout |
| `components/hero/Hero.tsx` | Fix CTA anchor, remove TokenWidget, enhance video, mobile fix |
| `components/BentoSection.tsx` | Split into `components/bento/` directory |
| `components/CharactersAndCreators.tsx` | Rebuild character display as art cards |
| `components/TopNav.tsx` | Add scroll-aware background animation |
| `components/TokenWidget.tsx` | No changes (just moved) |
| `app/layout.tsx` | Add `StickyCtaBanner` |
| **NEW** `components/LiveStatsBar.tsx` | Create |
| **NEW** `components/VideoTrailerSection.tsx` | Create |
| **NEW** `components/HomeFaqAccordion.tsx` | Create |
| **NEW** `components/CompactTokenomics.tsx` | Create |
| **NEW** `components/StickyCtaBanner.tsx` | Create |
| **NEW** `components/bento/` (6 files) | Split from BentoSection |
| `app/partners/page.tsx` | Lazy-load `CreatorCalculator` |

---

## Dependencies Required

No new npm dependencies needed. All features use:
- `framer-motion@^12` (already installed — `useScroll`, `useMotionValue`, `animate`, `AnimatePresence`)
- `next/dynamic` (built into Next.js 15)
- Pure SVG for donut chart
- `sessionStorage` API for sticky CTA dismiss

---

*End of AUDIT_PLAN_2026.md*
