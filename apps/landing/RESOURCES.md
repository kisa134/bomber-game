# Landing — asset & resource sources

Where to pull/generate visuals from. All decorative graphics get **recolored to our palette**
(gold `#f5c842` · teal `#3a9e9e` · red `#d44030`, deep void black) and used per `SPEC.md`.

## SVG shapes / organic depth
- **shapes.gallery** — https://www.shapes.gallery/ — 70+ free SVG shapes (copy-paste or bulk
  ZIP), by Monika Michalczyk. Use for: organic anti-grid blobs, foreground/depth layers,
  section dividers, glass-panel backings, sci-fi corner accents.
  - Workflow: copy the SVG → drop inline in a component (or `public/shapes/<name>.svg`),
    recolor `fill`/`stroke` to our tokens, layer with z-index + parallax for depth.
  - ⚠️ License not stated on the page — verify "free for commercial use" before shipping a
    shape in production; recoloring/derivative is the typical use but confirm.

## Generated art (ours, on demand)
- **`tools/asset-gen/`** — WaveSpeed generator (`google/nano-banana-2/text-to-image` +
  background-remover). Backgrounds, scenes, character cutouts in our locked style.
  `npx tsx gen.ts --name X --ar 16:9 --prompt "…"` → `out/X.webp` → copy to `public/bg|sprites`.
- **`../../bomb-fun/tools/character-gen/`** — sibling tool for game character sprite SETS
  (one image → directional walk + action poses). For landing key-art use asset-gen above.

## Existing assets in repo
- `public/bg/` — generated key-art (hero-arena-a, hero-control-room, hero-grid-blast), splash.
- `public/sprites/` — fighters (skin_*, trump/elon/doge/pepe …), powerups, demo2.mp4 loop.
- Owner art: `C:\Users\HYPERPC\Pictures\bmb\` (bog/giga/troll + concepts) — copy into `public/`.

## Stack references (techniques, not assets)
- GSAP ScrollTrigger pinned-scrub scenes · Lenis smooth-scroll · CSS `animation-timeline: view()`
  for light reveals · Rive for character state-machines · D3 for the guild graph. (See SPEC.md.)
