# WebGL renderer migration — Canvas 2D → PixiJS (GPU)

**Goal:** move the arena's per-frame drawing from hand-written **Canvas 2D (CPU)** to **PixiJS (WebGL2, GPU)**, keeping EVERYTHING else — game logic, netcode (`net/protocol.ts`), state interpolation (`state.ts`), the whole app shell (`main.ts`), settings, UI, Solana wallet, PWA. This lifts the perf ceiling (the CPU-bound gradients/blood/bloom we keep fighting become nearly free on the GPU) and unlocks shader-grade visuals (real fluid blood, lighting, heat-haze) impossible on Canvas 2D.

**Why Pixi (not Three / not Unity):** Pixi is 2D-first, WebGL2 batched sprite renderer with built-in filters (blur/bloom/displacement) + custom fragment shaders — a perfect fit for our top-down 2.5D. Three.js is a 3D engine (overkill). Unity WebGL = 10–40MB download + slow load + full multi-month rewrite → kills instant web-play/virality for a crypto casual game. Pixi keeps instant web play.

**Non-negotiables:** stays web/PWA, instant load, reuses the SAME webp sprites (no re-gen), keeps Colyseus-style netcode + `RenderView`, and the Canvas 2D renderer REMAINS as the default + fallback until Pixi wins on every device (WebGL context-loss / old devices auto-fall-back).

---

## Architecture: a drop-in renderer behind an interface

Extract the renderer's public surface into `IArenaRenderer` and have BOTH implement it:
- `render(view: RenderView, myId: number)`
- lifecycle: `resize()`, `reset()`, `setAssets()`
- events: `onDeath(cx,cy,color)`, `onExplosion(cells)`, `setPlaceBomb/setHurt/setVictory/setCountdown`
- toggles: `setArenaTheme, setTimeOfDay, setBattleScars, setBlockDepth, setShadows, setBloom, setDynamicLight, setAtmosphere, setGrassTexture, setParticleDensity, setLowFx, setGore, setColorTemp, setDanger, setTension`

`main.ts` picks the impl: `const renderer: IArenaRenderer = USE_WEBGL && webglSupported() ? new PixiRenderer(canvas) : new Renderer(canvas)`. Clean, reversible, A/B-testable.

**Pixi scene graph (layers = Containers, back→front):**
1. floor (TilingSprite or baked RenderTexture per theme)
2. **ground RenderTexture** (blood + gore + scorch baked on GPU — replaces bloodCanvas/goreCanvas/scorch)
3. ground sheen/liquid (shader Sprite over the ground RT)
4. blocks (batched Sprites; depth/scars via shader or overlay)
5. explosion lights + arena light (additive Sprites / lighting shader)
6. players (Sprites; blood/char = masked tint shader)
7. particles (`ParticleContainer` — GPU-batched: gibs/sparks/smoke/droplets)
8. FX / bloom filter on the arena container
9. UI stays DOM (unchanged)

---

## How each system maps (and what GPU gives us)

| System (now, CPU) | Pixi/GPU |
|---|---|
| Floor bake | TilingSprite / RenderTexture — trivial |
| Blocks fillRect/sprites | batched Sprites; block-depth + battle-scars as a fragment shader (free per-frame) |
| Blood/gore ground (bloodCanvas + goreCanvas, per-cell pixel loops) | one persistent **RenderTexture**; droplets/gore stamped once (incremental, like goreCanvas but GPU). Blood amount grid → a small data texture |
| Liquid blood + wet sheen (our blob + sheen sprites) | a **fragment shader** on the ground: real specular/fresnel wet look, light-reactive — the "жидкость" done properly, ~free |
| Blood drying/spread (throttled CPU rebuilds) | update the data texture; shader colors by dry+surface. Spread = a cheap compute-ish ping-pong shader OR keep the 12Hz CPU grid feeding the texture |
| Explosion lights (3 gradients/light/frame) | additive light Sprites or a lighting pass — GPU eats these for breakfast |
| Bloom (full-frame CPU blur → we avoid it) | `AdvancedBloomFilter` — real bloom, cheap |
| Day/night + color grade + tension | a color-grade fragment shader on the arena container |
| Particles (CPU loop, cap 520) | `ParticleContainer` — thousands of GPU-batched sprites, no CPU cost |
| Player blood/char (offscreen source-atop) | per-sprite tint/mask shader — trivial |
| Scorch bake | same ground RenderTexture |

Net: the exact effects that cause the kill-freeze + medium-vs-high cost become GPU work → smooth on weak devices AND far richer on strong ones.

---

## Phased migration (branch `webgl-pixi-renderer`, each phase A/B-tested in the 🧪 Test Arena vs Canvas2D FPS)

- **Phase 0 — scaffold.** Add `pixi.js` dep. Extract `IArenaRenderer`. `PixiRenderer` stub renders floor + blocks + players at parity (reads the same `RenderView`). Build flag + `webglSupported()` fallback to Canvas2D. Verify netcode/interp/camera unchanged.
- **Phase 1 — particles.** Port the particle system to `ParticleContainer` (gibs, sparks, smoke, blood droplets). Biggest early win + removes the CPU particle loop.
- **Phase 2 — ground RenderTexture + liquid shader.** Blood/gore/scorch onto a GPU RenderTexture (incremental stamp). Wet/liquid blood + sheen as a fragment shader (light-reactive). Surface material + drying feed the shader. This is the "по круче по физике" blood, GPU-native.
- **Phase 3 — lighting + bloom + grade.** Explosion/arena lights, bloom filter, day/night + tension color-grade shader. Battle-scars/block-depth shader.
- **Phase 4 — polish + LOD + wiring.** Map all Settings toggles → Pixi filters; mobile GL tuning; WebGL context-loss handling; A/B FPS via Test Arena on real devices + PostHog `perf_fps`.
- **Phase 5 — flip default.** When Pixi ≥ Canvas2D everywhere, make it default; keep Canvas2D as the no-WebGL fallback. Delete nothing until proven.

**Effort:** weeks, phased; each phase independently shippable + testable. It's a RENDERER rewrite (~one subsystem), NOT a game rewrite. Assets, netcode, UI, wallet, PWA untouched.

**Risks & mitigations:** WebGL unsupported / context loss → keep Canvas2D fallback (auto). Visual drift from Canvas2D → A/B in Test Arena per phase. Bundle size → Pixi is ~pulled tree-shaken; still far under Unity. Keep it all on this branch until Phase 5.
