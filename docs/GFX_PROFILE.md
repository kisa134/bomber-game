# BomberMeme Canvas Renderer — Per-Effect Performance Profile

Static analysis of the 2D canvas renderer. No code was run; every cost estimate is
derived from reading the source. Where a claim is uncertain it is flagged as such.

**Files analysed**

- `apps/client/src/game/renderer.ts` (3418 lines) — the hot render path.
- `apps/client/src/settings.ts` — the graphics-flag surface + defaults.
- `apps/client/src/main.ts` — render loop, `applyGfxPreset`, `goLite`, `weakDevice`, FPS watchdog.

**Board constants** (`packages/shared/src/constants.ts`)

- `GRID_W = 17`, `GRID_H = 11` → **187 tiles** per frame.
- `START_LIVES = 3`; up to **8 players** (1 human + 7 bots).
- Particle cap: `MAX_PARTICLES = 520` desktop, **240 on mobile** (`resize()`, renderer.ts:428).

---

## Two independent "lite" concepts — do not confuse them

There are **two** performance-shedding mechanisms, and only one of them touches the canvas:

1. **`renderer.lowFx`** (renderer.ts:272, set in `resize()` at line 425 from
   `pointer:coarse`/touch). This is the real canvas cost switch — it gates almost
   every heavy in-arena effect. It is **device-detected only**; it is *not* driven by
   the `liteGfx` setting or the FPS watchdog. On a mid PC it is always `false`.
2. **`liteMode` / `goLite()`** (main.ts:3162-3169). This only adds a CSS `.lite`
   class and removes DOM background fireflies/dust on the **menu**. It does **not**
   set `renderer.lowFx` and does **not** reduce any in-arena canvas cost.

**Consequence / most important finding:** The `liteGfx` setting and the FPS watchdog
(`main.ts:3462-3480`, which only runs while the menu is visible — it early-returns when
`menu` is hidden, i.e. during actual gameplay) do **nothing** to the in-match canvas
renderer on a desktop/laptop. There is no runtime path that trims arena rendering on a
struggling mid PC — `lowFx` is fixed at construction from the pointer type. See
"Recommended granular presets".

---

## Per-effect profile

Tile-count multiplier "×187" = worst case (all cells visited); real per-frame block
counts are lower (open cells, powerups, explosions are subsets), but the loops iterate
all 187.

### 1. Cached floor blit — always on
- `render()` renderer.ts:1959 — one `drawImage(this.floor, …)` per frame.
- Floor itself is baked once into an offscreen canvas in `buildFloor()` (renderer.ts:463)
  on resize/theme change (procedural grass or sprite, per tile ×187, **one-off**).
- Ops: single full-canvas `drawImage`. 🟢 cheap. Scales with resolution only.

### 2. Procedural swaying grass overlay — gated `!lowFx && classic && !grassTexture`
- `drawGrassOverlay()` renderer.ts:2021 → `drawGrassBlades()` renderer.ts:3322,
  **per open tile, per frame** (up to ~187 minus blocks/burned).
- Each blade tile issues **~12–37 `fillRect`s** (body 10–32 + front 2–7 + occasional
  flower), each preceded by a `fillStyle` string assignment. That is potentially
  **thousands of fillRect + string allocations per frame**.
- No gradients/blur, but the sheer draw-call + `fillStyle` string churn is real.
- 🔴 heavy — highest per-frame fixed cost on desktop classic. Scales with grid size
  (open-tile count). Note it is the reason the animated classic floor is desktop-only.

### 3. Ambient atmosphere motes — gated `ambientFx` (`atmoOn`) and `!lowFx`
- Drift/seed: `buildAtmosphere()` renderer.ts:503 (one-off). Draw: `drawAtmosphere()`
  renderer.ts:540, **per-frame**, called at renderer.ts:2128.
- ~14–22 motes × `fxScale`. Uses `globalCompositeOperation="lighter"` (one save/restore),
  a `fillStyle` string per mote, and an `arc`/`fillRect` per mote. Also **drives the
  per-arena theatrical accent lights** and the living-block glow (see #8, #14) which
  are additionally gated on `atmoOn`.
- 🟢–🟡 cheap-to-moderate for the motes themselves; the coupling to accent lights is
  what makes `ambientFx` matter. Scales with mote count (small).

### 4. Explosion volumetric lights — always on when `!lowFx` (spawned in `onExplosion`)
- Spawn: `onExplosion()` renderer.ts:987 pushes one light per blast cell (cap 80).
- Draw: `drawLights()` renderer.ts:2724, **per light per frame** while alive (~460ms).
  For **each** light it creates **3 `createRadialGradient` objects per frame** + 3
  `arc`+`fill`, all under `globalCompositeOperation="lighter"`.
- Additionally `lightCatch()` renderer.ts:2760 runs **per HARD/SOFT block per frame
  whenever any light is alive** (`drawTile` renderer.ts:3094 & 3115) — each catching
  block creates **another radial gradient per frame**.
- 🔴 heavy — radial gradients created per-light-per-frame *and* per-block-per-frame.
  Scales with **blast size × block count**. This is the single worst offender during a
  big fight: an 8-cell blast near a wall of blocks = 24 light gradients + up to ~dozens
  of `lightCatch` gradients every frame for ~half a second.

### 5. Bomb pulse glow — always on (per bomb)
- `render()` renderer.ts:2079 — **one `createRadialGradient` per bomb per frame** +
  `arc`+`fill`. Bombs are few (typically < ~10). 🟡 moderate. Scales with bomb count.

### 6. Contact shadows (blob ellipses) — gated `shadows` (`shadowsOn`) and `!lowFx`
- `drawShadow()` renderer.ts:2626, called per HARD tile (3061), per SOFT tile (3098),
  per bomb (2074), per player (2288). **Per-entity/per-block, per frame.**
- Each call loops a pixel-grid ellipse of `pu`-sized `fillRect`s (radius/`pu` squared ≈
  dozens of rects each). At ~187 blocks worst case that is a large `fillRect` count, but
  no gradients/blur; uses `globalAlpha` save/restore of a scalar (cheap).
- 🟡 moderate — many `fillRect`s but no expensive ops. Scales with block + entity count.

### 7. Block depth (directional face shading) — gated `blockDepth` and `!lowFx`
- `drawBlockDepth()` renderer.ts:3263, called per HARD (3076) & SOFT (3113) tile,
  **per block per frame**.
- **Creates one `createLinearGradient` per block per frame** + a full-tile `fillRect`.
  ~up to (hard+soft blocks) gradient objects/frame — commonly 60–120 in early game.
- 🔴 heavy — a fresh linear gradient per block every frame is the classic "gradient in a
  loop" anti-pattern. The gradient direction only changes when `dynLight` moves the key
  light; with static light it is identical every frame and every-block and could be
  cached. Scales with block count.

### 8. Living-block inner glow — gated `!lowFx && atmoOn`, only chappie/industrial/meme themes
- `drawTile` renderer.ts:3080-3092 — **one `createRadialGradient` per matching hard
  block per frame** + arc/fill under `lighter`, with a per-block save/restore.
- 🟡 moderate, theme-limited. Scales with matching-block count (only 3 themes).

### 9. Powerup glow + specular sheen — always on when `!lowFx` (per powerup)
- `drawPowerups()` renderer.ts:3138. **Per powerup per frame** it creates: one
  `createRadialGradient` (halo, 3177) + writes into an **offscreen `puBuf` canvas**
  with two more gradients (a `createRadialGradient` 3201 + a `createLinearGradient`
  3209), four `globalCompositeOperation` switches, and a `destination-in` mask, then
  blits. That is **3 gradients + 1 offscreen render + 5 composite-op changes per powerup
  per frame.**
- 🔴 heavy *per powerup* — but powerup count is low (a handful on the board), so total
  impact is moderate. Scales with live-powerup count. Good candidate to cache per icon.

### 10. Player sprite blood/burn tint — gated `gore && !lowFx && alive` (per stained player)
- `tintSkin()` renderer.ts:2548, called from `drawPlayers` renderer.ts:2375 **per stained
  living player per frame**.
- Reuses one offscreen `skinTint` canvas (good), but **per call** creates up to **2
  `createLinearGradient`s** (burn 2560, blood 2576) + several arcs/rects + `source-atop`
  compositing. Runs only when a player has blood/burn > 0.03 (accumulates through a match,
  so late-game most players qualify).
- 🟡 moderate. Scales with stained-player count (≤8).

### 11. Persistent blood ground — gated `gore` for content; cached
- Draw: `drawBloodGround()` renderer.ts:1145 — one `drawImage` of the cached
  `bloodCanvas` per frame (🟢). Rebuild: `buildBloodGround()` renderer.ts:1185, only
  when `bloodDirty` (a death/kick/blast/footprint). The rebuild is **very expensive**:
  per blood cell it runs a `pu`-grid double loop (t/`pu` ≈ 24² ≈ hundreds of `fillRect`s
  per cell) plus redraws **all** gore decal arrays (chips, feet, bile, organs, brains,
  limbs, meat, bones, skulls, eyes, teeth, coins — renderer.ts:1238-1249), each their
  own pixel loops.
- 🔴 heavy **on the rebuild frame** (a stutter spike), 🟢 on steady frames. Scales with
  blood-cell count (cap 110) + total gore-decal count (caps 360/kind). `bloodDirty` is
  set every footprint step and every blast, so during a busy fight it rebuilds often →
  repeated spikes. See optimizations.

### 12. Blood wet sheen — gated `gore && !lowFx`
- `drawBloodSheen()` renderer.ts:1157, **per fresh blood pool (lvl≥4) per frame**.
  Creates **one `createRadialGradient` per pool per frame** + a 2×tile `fillRect` under
  `lighter`. 🟡 moderate. Scales with fresh-pool count.

### 13. Warm key light + vignette + night wash — always on when `!lowFx`
- `drawAmbient()` renderer.ts:2839, **per frame, one-off (not per tile).** Creates
  **2–3 full-screen radial/linear gradients per frame** (warm key 2873, vignette 2889,
  optional tension swell 2900) + full-canvas fills under `lighter`.
- 🟡 moderate — fixed 2–3 big gradient objects/frame regardless of grid size. Does not
  scale with entities. These gradients are static unless `dynLight`/`tod`/`tension`
  change → cacheable.

### 14. Per-arena theatrical accent lights — gated `!lowFx && atmoOn`, theme-dependent
- `drawArenaLights()` renderer.ts:2911, **per scene light per frame** (1–2 per theme;
  classic has none). One `createRadialGradient` + full-canvas fill each. 🟡 moderate,
  theme-limited.

### 15. Bloom (threshold + blur) — gated `bloom` and `!lowFx`
- `drawBloom()` renderer.ts:3282, **per frame.** Reads back the whole canvas via
  `drawImage(src,…)` **three times** into an offscreen (`multiply` ×2 to cube for
  threshold), then draws it back with **`ctx.filter = "blur(7px)"`** under `lighter`.
- `ctx.filter` blur + multiple full-frame `drawImage`/composite passes are among the
  most expensive things possible on a 2D canvas.
- 🔴 heavy — full-frame blur every frame. Cost scales with **resolution**, not grid.
  Correctly off by default. Should never be a default-on / medium effect.

### 16. Color grade — always on (when |colorTemp|>0.02)
- `drawColorGrade()` renderer.ts:791. One full-canvas `fillRect` under `soft-light`
  composite. 🟢 cheap. No gradient. One-off per frame.

### 17. Danger vignette — always on (when danger>0.01)
- `drawDangerVignette()` renderer.ts:817. Creates **4 `createLinearGradient`s per frame**
  (four edges) + 4 thin `fillRect`s under `lighter`. Only active at low HP / sudden death.
- 🟡 moderate, transient. One-off per frame (not per tile).

### 18. Particles (flames/smoke/embers/gore/debris/dust/sparks) — spawn gated `!lowFx` mostly
- Update+draw: `updateParticles()` renderer.ts:2957 (draw code continues past 2988),
  **per live particle per frame** (cap 240 mobile / 520 desktop). Spawned heavily in
  `onExplosion` (renderer.ts:948-989, ~15 particles/blast cell × `fxScale`) and `onDeath`
  (renderer.ts:1071-1099, ~72+ gibs × `fxScale`).
- Mostly `fillRect`/`arc`/`fillStyle` per particle; gore/debris also do up to 2 grid
  collision lookups (`stepParticle` 2939). No gradients per particle.
- 🟡 moderate, but **the largest allocation source at spawn time** (dozens of object
  literals per blast/death). Scales with `particleDensity` and fight intensity. Capped,
  so steady-state is bounded.

### 19. Side scorch (battle scars) — gated `battleScars` (+ `!lowFx` via block path)
- `drawSideScorch()` renderer.ts:2521, per damaged HARD block per frame (called at 3073,
  only when not showing a themed damage sprite). Creates up to **4 `createLinearGradient`s
  per damaged block per frame**. 🟡 moderate. Scales with damaged-block count (grows late
  game). Note: only runs on the *fallback* path when a themed dmg sprite is absent.

### 20. Scorched ground — always on; cached like blood
- Draw: `render()` renderer.ts:1962 blits cached `scorch` canvas (🟢). Rebuild
  `buildScorch()` renderer.ts:2470 only when `scorchDirty` (a blast). Per burnt cell a
  `pu`-grid loop of `fillRect`s. 🔴 on the rebuild frame, 🟢 steady. Scales with burnt-cell
  count. `scorchDirty` set on every blast.

### 21. Dynamic light motion — gated `dynamicLight` (`dynLight`)
- `render()` renderer.ts:1938 + `drawAmbient` 2865. Only moves `lx/ly`. Cost itself is
  trivial (a few sin/cos), **but** it defeats the cacheability of #7 (blockDepth) and #13
  (ambient gradients) because their gradients then change every frame. 🟢 direct cost;
  🟡 indirect (kills caching opportunities).

### 22. Time-of-day — gated `timeOfDay` (`todMode`)
- `drawAmbient()` renderer.ts:2843-2885. Adjusts key-light colour + adds a night wash
  `fillRect`. `auto` mode animates `tod` continuously (defeats gradient caching like
  dynLight does). 🟢 direct; 🟡 indirect for `auto`.

### 23. Screen shake — always on when `!lowFx` (early-returns in `shake()` line 733)
- `render()` renderer.ts:1945-1953. One `translate` inside the frame's outer save/restore.
  🟢 cheap.

### 24. First-blood banner / floaters / emote pops / shatters / crown / decals
- `drawFirstBlood` 2800 (cached text `drawImage` + ~40 `fillRect`s, transient 🟢),
  `drawFloaters` 751 (per floater save/restore + strokeText/fillText 🟢),
  `drawEmotePops` 704 (per pop arc+text 🟢), `drawShatters` 2599 (4 `drawImage` per
  shatter, transient 🟢), `drawCrown` 2141 (1 radial gradient for the leader only 🟢),
  `drawDecals` 2647 (per decal pixel loops; scorch/blood decals are `fillRect` loops 🟡).

---

## Cost ranking table (most expensive → cheapest)

| # | Effect | Flag (gate) | Cost | Key expensive op | Scales with |
|---|--------|-------------|------|------------------|-------------|
| 15 | **Bloom** | `bloom` (+`!lowFx`) | 🔴 | `ctx.filter=blur` + 3× full-frame `drawImage`/composite per frame | resolution |
| 4 | **Explosion lights + lightCatch** | always (`!lowFx`) | 🔴 | 3 radial gradients / light / frame + 1 radial / block / frame | blast size × block count |
| 7 | **Block depth** | `blockDepth` (+`!lowFx`) | 🔴 | `createLinearGradient` per block per frame | block count |
| 2 | **Swaying grass** | classic+animated (+`!lowFx`) | 🔴 | thousands of `fillRect`+`fillStyle` per frame | open-tile count |
| 11 | **Blood-ground rebuild** | `gore` (rebuild only) | 🔴 (spike) | per-cell pixel loops + all gore decals on `bloodDirty` | blood/gore-decal count |
| 20 | **Scorch rebuild** | always (rebuild only) | 🔴 (spike) | per-cell pixel loops on `scorchDirty` | burnt-cell count |
| 9 | **Powerup glow+sheen** | always (`!lowFx`) | 🔴 per PU | 3 gradients + offscreen + 5 composite ops per PU | powerup count (low) |
| 6 | **Contact shadows** | `shadows` (+`!lowFx`) | 🟡 | many `fillRect` (pixel ellipse) per block+entity | block+entity count |
| 18 | **Particles** | mostly `!lowFx` | 🟡 | per-particle draw + spawn-time allocs | density × fight |
| 10 | **Player blood/burn tint** | `gore` (+`!lowFx`) | 🟡 | 2 linear gradients per stained player | stained players ≤8 |
| 13 | **Key light + vignette** | always (`!lowFx`) | 🟡 | 2–3 full-screen gradients per frame | resolution |
| 19 | **Side scorch** | `battleScars` | 🟡 | up to 4 linear gradients per damaged block | damaged-block count |
| 12 | **Blood sheen** | `gore` (+`!lowFx`) | 🟡 | radial gradient per fresh pool | fresh-pool count |
| 8 | **Living-block glow** | `ambientFx` (3 themes) | 🟡 | radial gradient per matching block | matching-block count |
| 14 | **Arena accent lights** | `ambientFx` (themes) | 🟡 | radial gradient per scene light (1–2) | fixed/theme |
| 17 | **Danger vignette** | always (transient) | 🟡 | 4 linear gradients per frame | resolution |
| 5 | **Bomb glow** | always (`!lowFx`) | 🟡 | radial gradient per bomb | bomb count |
| 24 | **Decals** | always | 🟡 | pixel-loop fills per decal | decal count |
| 3 | **Ambient motes** | `ambientFx` | 🟢 | per-mote fill | mote count (small) |
| 1 | **Cached floor blit** | always | 🟢 | 1 `drawImage` | resolution |
| 16 | **Color grade** | always | 🟢 | 1 full-canvas fill | resolution |
| 23 | **Screen shake** | always (`!lowFx`) | 🟢 | 1 translate | — |
| 21/22 | **Dynamic light / TOD** | flags | 🟢 direct / 🟡 indirect (breaks caching) | sin/cos | — |

---

## What each preset currently enables

From `applyGfxPreset()` map, **main.ts:1519-1523**. Only four flags are actually set by
the presets; **all other graphics flags keep their `DEFAULTS` and are never touched by
switching presets** (see the note below).

| Flag | low | medium | high |
|------|-----|--------|------|
| `liteGfx` | **true** | false | false |
| `ambientFx` | false | false | **true** |
| `blockDepth` | false | **true** | **true** |
| `shadows` | false | **true** | **true** |

`DEFAULTS` (settings.ts:42-64), applied regardless of preset unless hand-toggled:
`gfxPreset: "high"`, `bloom: false`, `dynamicLight: false`, `battleScars: true`,
`gore: true`, `grassTexture: false` (→ animated grass on), `particleDensity: 1`,
`timeOfDay: "day"`, `shadows: true`, `blockDepth: true`, `ambientFx: true`.

### Questionable things flagged

1. **Default preset is `high`** (settings.ts:56) with `ambientFx + blockDepth + shadows`
   all on, plus default `battleScars: true` and animated grass (`grassTexture:false`).
   On a desktop/laptop (`lowFx=false`) this turns on the three 🔴 per-block/per-frame
   effects (block depth gradients, swaying grass, shadows) with **no runtime fallback**
   — the FPS watchdog does not touch the renderer during gameplay (see below). A mid PC
   or a low-end laptop can't necessarily sustain this. **Recommend default `medium`.**
2. **`liteGfx` is misleading in presets.** `low` sets `liteGfx:true`, but `liteGfx`
   never sets `renderer.lowFx`; `applySettings()` (main.ts:1534-1552) never calls a
   `renderer.setLowFx`-style method from `liteGfx`. On desktop, choosing "low" still
   runs the full-fat arena path (grass/lights/etc.) — it only affects the DOM/menu via
   `goLite()`. This is a real gap: **the "low" preset does not actually make in-match
   rendering light on a PC.**
3. **`battleScars` (🟡, grows late-game) and animated grass (🔴) are default-on and not
   in any preset**, so they persist across low/medium/high. Grass especially is a heavy
   desktop cost that "low" cannot turn off.
4. **`medium` and `high` differ only by `ambientFx`.** The two most expensive
   arena effects (blockDepth, shadows) are *identical* in medium and high — so "medium"
   is barely cheaper than "high". There is no rung that drops blockDepth/shadows except
   "low", which (per #2) doesn't affect the canvas on desktop anyway.
5. The FPS watchdog (main.ts:3462-3480) is inside the **menu** rAF loop and returns
   early once the menu is hidden; and `goLite()` doesn't touch the renderer. So there is
   **no automatic in-game quality degradation** on sustained low FPS during a match.

---

## Recommended granular presets

Guiding principle: the presets must gate the effects whose cost is 🔴/🟡 and scales with
grid/entity/particle count, and the "low" tier must actually reduce the **canvas** path,
not just the menu.

### Effects that deserve their own toggle (already have one, keep it)
- `bloom` (🔴, full-frame blur) — keep as an explicit, off-by-default expert toggle.
- `dynamicLight` / `timeOfDay:auto` (breaks gradient caching) — keep explicit.
- `particleDensity` (slider) — keep; it's the right knob for fight intensity.
- `gore` (content + a real cost via blood-ground rebuilds & tint) — keep.

### Effects that should be bundled into the tiers
- `blockDepth` (🔴), `shadows` (🟡, many), `battleScars` (🟡), swaying grass
  (via `grassTexture`), `ambientFx` (motes + accent lights + living glow).

### Proposed tier map (what low/medium/high *should* enable)

| Flag / effect | low | medium | high | why |
|---|---|---|---|---|
| **in-arena lowFx path** | **on** | off | off | low must actually cut the canvas path (see fix #1 below) |
| `grassTexture` (static floor) | **true (static)** | true (static) | false (animated) | animated grass is 🔴 and only cosmetic |
| `blockDepth` | off | off | **on** | 🔴 gradient/block/frame — reserve for high |
| `shadows` | off | **on** | **on** | 🟡, gives depth cheaply enough for medium |
| `ambientFx` | off | off | **on** | 🟡 + couples to accent lights/glow |
| `battleScars` | off | **on** | **on** | 🟡, grows late-game; keep off on low |
| `bloom` | off | off | off (opt-in) | 🔴; never default even on high |
| `dynamicLight` | off | off | off (opt-in) | breaks caching |
| `particleDensity` | 0.5 | 1.0 | 1.5 | scale with tier |

Rationale: this makes **medium meaningfully cheaper than high** (drops the two heaviest
per-block gradient effects: blockDepth off, animated grass off), and makes **low** trim
the canvas, not just the menu.

### Safe default
Change the default preset from **`high`** to **`medium`** (settings.ts:56 and the
implicit default). Medium (shadows + battleScars + static floor, no blockDepth/grass/
ambient) is the widest safe target for mid PCs and phones. Power users can opt into high.
Additionally, wire an **in-game FPS fallback** that flips the renderer toward the low
path (or drops blockDepth/grass first) after sustained low FPS — the current watchdog
never fires during a match.

---

## Concrete optimization opportunities (actionable checklist)

Per-frame gradient allocations that should be cached/hoisted:

- [ ] **Block depth gradient** (renderer.ts:3270) — `createLinearGradient` per block
      every frame. When `dynLight` is off and `tod` is static, the gradient is identical
      for every block (only translated). Cache one gradient (or a small offscreen 1-tile
      "depth" sprite) and blit/translate it; rebuild only when `lx/ly` change.
- [ ] **Explosion light gradients** (renderer.ts:2746) — 3 radial gradients per light per
      frame. Pre-bake a single radial "light" sprite (white→transparent) once, then
      `drawImage` it scaled/tinted per light under `lighter`. Removes N×3 gradient allocs.
- [ ] **`lightCatch` gradient** (renderer.ts:2789) — radial gradient per block per frame
      whenever a light is alive. Same fix: reuse a baked radial sprite; or skip
      `lightCatch` entirely below a quality tier.
- [ ] **Key light + vignette** (renderer.ts:2873, 2889) — 2–3 full-screen gradients per
      frame that only change with `tod`/`dynLight`/`tension`. Cache to an offscreen and
      re-bake only when those inputs move (dirty-flag them).
- [ ] **Powerup halo + sheen** (renderer.ts:3177, 3201, 3209) — 3 gradients + offscreen
      render + 5 composite-op switches **per powerup per frame**. Bake a per-icon glow+
      base once; animate only the cheap sheen offset, or cache 2–3 pulse phases.
- [ ] **Bomb glow** (renderer.ts:2079) — radial gradient per bomb per frame. Cache a
      radial sprite tinted per player colour.
- [ ] **Danger vignette** (renderer.ts:827-838) — 4 linear gradients rebuilt per frame;
      cache the four edge gradients and only vary `globalAlpha` with the pulse.
- [ ] **Blood sheen** (renderer.ts:1175) — radial gradient per pool per frame; reuse one
      baked radial sprite scaled per pool.
- [ ] **Side scorch** (renderer.ts:2536-2539) — up to 4 linear gradients per damaged
      block per frame; bake a per-side scorch sprite set (4 masks) once.
- [ ] **`tintSkin` gradients** (renderer.ts:2560, 2576) — 2 linear gradients per stained
      player per frame; the tint only changes when blood/burn changes → cache the tinted
      sprite per (id, quantised blood, quantised burn) and reuse until it changes.

Redraws that could be dirty-flagged / throttled better:

- [ ] **Blood-ground rebuild** (`buildBloodGround` renderer.ts:1185) fires on every
      footprint step and every blast (`bloodDirty=true` at 2340, 908, 1066, 1984, etc.).
      Coalesce rebuilds to at most once per frame (already effectively once, since
      `drawBloodGround` checks the flag) — but also consider **incremental** drawing:
      only composite the newly-changed cells onto the cached canvas instead of clearing
      and redrawing every cell + every gore decal each time.
- [ ] **Scorch rebuild** (`buildScorch` renderer.ts:2470) — same pattern; draw only newly
      burnt/deepened cells incrementally rather than the whole burn map.
- [ ] **Swaying grass** (renderer.ts:3322) — the biggest desktop fixed cost. Options:
      (a) bake several wind-phase frames offscreen and cycle them; (b) reduce blade
      counts; (c) demote to the static floor sprite below "high".

Per-frame array/object allocations to hoist:

- [ ] `drawLights` builds a fresh `layers` array literal per light per frame
      (renderer.ts:2740) — hoist to a module constant of radii/colours.
- [ ] `blastGore`/`kickGibs`/`blastGibs` build a `new Set(cells.map(...))` per call
      (renderer.ts:1389, 1404) — fine (event-driven), not per-frame; left as-is.
- [ ] Many draw fns build `fillStyle` strings via template literals inside pixel loops
      (grass, blood, scorch, gore decals). These are baked/cached paths except grass,
      which is the live one to target.

---

## Quick wins vs deeper refactors

### Quick wins (cheap, do now)
- [ ] Change **default preset to `medium`** (settings.ts:56) — one-line safe default.
- [ ] Make **"low" actually set the renderer light path** — add a `renderer.setLowFx(on)`
      and call it from `applySettings()` when `liteGfx` is on (fixes the dead `liteGfx`).
- [ ] Add `grassTexture:true` (static floor) to the low/medium preset maps
      (main.ts:1519) so the 🔴 animated grass is off below high.
- [ ] Hoist the `layers` array in `drawLights` (renderer.ts:2740) to a constant.
- [ ] Cache the 4 **danger-vignette** edge gradients (renderer.ts:827) and the
      **key-light/vignette** gradients (renderer.ts:2873/2889), rebuilding only when
      `tod`/`dynLight`/`tension` change.
- [ ] Gate `lightCatch` (renderer.ts:3094/3115) behind `blockDepth`/quality tier so it's
      off in medium/low.

### Deeper refactors (bigger effort)
- [ ] Replace all per-frame **radial gradients** (explosion lights, lightCatch, bomb
      glow, powerup halo, blood sheen) with **one baked radial sprite** blitted under
      `lighter` — removes the dominant per-frame allocation class.
- [ ] Bake **block-depth** into a per-tile depth sprite (or cache the single gradient),
      keyed off the light direction; only rebuild when `lx/ly` change.
- [ ] Make **blood-ground and scorch** caches **incremental** (composite only changed
      cells) instead of full-canvas rebuilds, to kill the rebuild-frame stutter.
- [ ] Bake **swaying grass** to a small set of wind-phase frames (or a shader-like
      offscreen) and cycle, instead of thousands of live `fillRect`s.
- [ ] Add a **real in-game FPS governor** that steps quality down (grass → blockDepth →
      shadows → ambient) during a match; the current watchdog (main.ts:3462) only runs on
      the menu and only flips DOM `goLite`.
- [ ] Cache **`tintSkin`** output per player until blood/burn quantum changes.
