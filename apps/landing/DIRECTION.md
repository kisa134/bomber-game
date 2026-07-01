# BomberMeme — Art Direction & Asset Framework

The single source of truth for building landing scenes "like a director": what our
world looks like, where every asset lives, what tools assemble them, and the exact
recipe for each landing block. Pairs with SPEC.md (structure) and PLAN.md (status).

---

## 1. VISUAL DNA (extracted from refs + our own assets)

The world is a **dark neon meme-arena**: a degen coliseum where crypto-meme fighters
blow each other up for the pot. Never polite, never generic, never sci-fi-sterile.

- **Base:** deep warm-black void (`#0b0a0e`), not cold blue-black.
- **Energy:** explosive neon pops over the dark — gold, fire-orange, money-green, plasma-cyan.
- **Texture:** chunky pixel-art, hard edges, clean shading. CRT/scanline grain.
- **Cast:** meme archetypes with attitude — doge, pepe, trump, elon, vitalik, wojak, chad, troll, bateman.
- **Stage motifs (from `Pictures/bmb`):** packed spectator stands, casino/pump-party energy,
  green matrix code, server-tech panels, money raining.
- **Volume rule:** world objects are **2.5D blocks** — a TOP face (upper ~1/3) + a FRONT face
  (lower ~2/3), seen slightly from above, NOT isometric. Blocks, the explosion, props all obey this.

## 2. PALETTE (hex, pulled from the real sprites)

| token | hex | use |
|---|---|---|
| void | `#0b0a0e` | primary background |
| void-2 | `#12101a` | raised surface |
| gold | `#f5c842` | primary CTA, money, power-button, key stat |
| fire | `#f0a92a` → `#ff8a3c` | explosion, fire powerup, danger heat |
| money-green | `#3ddcaf` / `#5fe08a` | pepe, $, matrix, "online/skill" |
| plasma-cyan | `#7fd8ff` | LEDs, ghost powerup, prize/spectator |
| kill-red | `#ff5a4d` / `#d44030` | kill, hazard, ranked |
| wood | `#8a5a2b` | soft block, warmth |

## 3. ASSET LIBRARY (where everything lives)

Root: `apps/client/public/sprites/` (mirrored into `apps/landing/public/sprites/`).

- **Characters (11):** `skin_0..10.webp` (idle portraits) + 138 frames `skin_N_{dir}_{f}` /
  `_place_bomb` / `_hurt` / `_victory` (walk + states, used for animation).
  Roster: 0 doge · 1 pepe · 2 trump · 3 elon · 4 aviator-doge · 5 wojak · 6 tough-guy ·
  7 vitalik · 8 troll-suit · 9 bateman · 10 gigachad. Each has a signature colour aura.
- **Terrain/blocks:** `floor.webp` (grass tile) · `hard.webp` (sci-fi server crate) +
  `hard_dmg1-6`, `hard_blood*` · `soft.webp` (hazard wooden crate) + `soft_blood*`, `soft_mobile`.
- **Bomb/FX:** `bomb.webp` · `explosion_0..4.webp` (box-volume blast, top+front, matches blocks).
- **Powerups (6):** `powerup_{bomb,fire,health,kick,speed,wall}.webp` (glossy icon in metal frame).
- **References / inspiration:** `C:/Users/HYPERPC/Pictures/bmb/` (17 imgs — meme-arena moodboard).

## 4. TOOLS (the "director" kit — in `bomb-fun/tools/character-gen/scripts`)

- **`contact.ts`** — contact-sheet / moodboard builder. Any folder or asset list → labelled
  grid on dark bg. Built: `mood-refs`, `mood-chars`, `mood-assets`.
- **`compose_scene.ts`** — scene composer. Tiles floor + scatters 2.5D blocks + stands fighters
  + bomb/explosion + cinematic vignette → an arena diorama. For previewing compositions.
- **`build_boom.ts`** — matte an approved art (white-bg → transparent, keeps white-hot core)
  then derive an N-frame pulse by scale/brightness/alpha. (Built the explosion.)
- **`gen_explosion_v2.ts`** — text-to-image sprite gen (no reference image when a ref would
  leak the wrong object into the result).
- **asset-gen `gen.ts`** (`tools/asset-gen`) — reference-conditioned generation: feed our OWN
  sprites as `--ref` so the edit model copies our pixel-meme style (anti-AI-slop). Presets.
- **`LayeredScene.tsx`** (landing) — multi-plane parallax + idle-motion scene from layer images.

### Hard-won rules
- **Reference image = identity transfer.** Feeding the *block* made "an exploding block." Feed a
  ref ONLY when you want its content propagated; for a pure effect, describe in T2I instead.
- **2.5D, not isometric, not top-down.** TOP ~1/3 + FRONT ~2/3, slight-above camera. Always.
- **Matte, don't key.** White-hot cores die under a luminance key; use the matting model.
- **Eyeball before ship.** Generate the peak frame, view it, THEN commit the set.

## 4b. VIBE JOURNEY (one dominant mood per section, one world)

All 4 inspiration vibes are used — each landing section leans into ONE, so scrolling is a
journey through moods. Unified by the dark pixel-meme base, gold/fire/cyan palette and
chunky-pixel rule. The vibes:

- **STADIUM-BROADCAST** — crowd, stands, LIVE plates, scoreboards, cameras. Scale + hype.
- **CASINO / PUMP-PARTY** — neon, money in the air, jackpot energy. Loud, bright, degen.
- **BRUTAL COLISEUM** — dark, tense, 1v1, minimal clutter, max pressure. Premium + hard.
- **MATRIX-DEGEN** — green code, glitch, hacker/terminal over black. Techno-meme.

| section | vibe | why |
|---|---|---|
| **Hero** | STADIUM-BROADCAST ✅ | grab attention — the arena is live, packed, on air |
| **§2 How-to-play (SD-1)** | BRUTAL COLISEUM | shutters slam, blast, rules revealed under pressure |
| **Story / descent (§3)** | BRUTAL COLISEUM | the drop into the pit |
| **Live Arena + Leaderboard** | STADIUM-BROADCAST | live competition, standings, spectators |
| **Roster (the fighters)** | CASINO / PUMP-PARTY | the meme stars, neon, hype, auras |
| **Trailer** | STADIUM-BROADCAST | the broadcast cut |
| **Provably-Fair + Economy/Token** | MATRIX-DEGEN | code terminal, green, on-chain proof, money flow |
| **Roadmap** | MATRIX-DEGEN | the plan as a glitch timeline |
| **Final CTA** | CASINO / PUMP-PARTY | jackpot — "last meme standing takes the pot" |

## 5a. HERO STATUS — ❄️ FROZEN (temporary working version)

Hero is FROZEN at the current clean version. Do NOT micro-iterate it in code — small
decorative passes drift it in circles back to "text-left + image-right". When we return to
Hero it's a FULL RESET, not patches: (1) visual brief → (2) 2-3 rough composition directions
→ (3) approve one → (4) asset brief → (5) generate assets → (6) rebuild hero from scratch.
Until then: hands off the hero. Work proceeds on S2/S3 → S4 → weaker sections below.

## 5b. HERO COMPOSITION LOCK — «B · asymmetric scene» (LOCKED)

The hero is ONE cinematic meme-arena world built as a single composition. Not text+image,
not poster+overlay, not a mascot, not a glow card. Build composition → light → assets →
placement → motion, IN THAT ORDER. Add nothing that doesn't serve the one scene.

**Layout**
- LEFT ~45% — clean headline column (badge → H1 → subline → CTA → prize readout). Stays
  powerful + readable. NO scene objects dumped here.
- RIGHT ~58% (overlaps toward centre) — large-scale layered arena scene, NO box/frame.

**3 planes (one world, one light)**
1. BG — far arena ENVIRONMENT: deep, dark, atmospheric stadium/pit space, haze, one key
   light. Empty-ish (environment, not a busy scene). Bleeds behind toward centre.
2. MID — the MATCH: the focal arena (block grid · bomb · blast · 2 fighters) as the single
   strong focal mass, cleanly lit, soft-edged (dissolves into bg, no rectangle).
3. FG — framing ONLY: HUD/scanline glass, minimal embers, ONE directional light streak,
   at most a single partial silhouette EDGE for framing. All in one style + one light.

**Light logic** — one directional key from the arena (right) washing LEFT. The visual mass
influences the headline area through LIGHT + atmosphere ONLY — never by placing objects on text.

**Banned:** centred mascot character · random outline crowd · second style · glow-for-glow ·
hard rectangle/card edges · more layers for the sake of layers. Fewer + stronger always wins.

**Build checklist (gate every change against this):**
- [ ] right scene has NO poster-frame logic (no card/rectangle)
- [ ] NO separate mascot on the foreground
- [ ] FG exists ONLY if subordinated to the scene's single light logic
- [ ] light/atmosphere layers may softly enter the text zone (objects may NOT)
- [ ] headline stays the main typographic punch — never drowned in art

## 5c. HERO ASSET BRIEF (by plane, for B)

| plane | asset | spec | source |
|---|---|---|---|
| BG | `hero/bg-arena.webp` | wide 16:9, dark atmospheric arena environment, far stands in shadow, haze, single key light, mostly empty | GENERATE (cleaner/emptier than coliseum.webp) |
| MID | `hero/mid-match.webp` | the focal bomber match — block grid + bomb + blast + 2 fighters, cleanly lit, on plain bg for soft-mask/cutout | GENERATE or re-cut from arena-broadcast |
| FG | light streak · scanline glass · embers | CSS only (no image) | code |
| FG | (optional) `hero/fg-edge.webp` | a single partial fighter silhouette EDGE for corner framing — NOT a centred figure | GENERATE only if needed after placement |

## 5. PER-BLOCK RECIPE (how each landing section gets built)

| block | mood / statement | assets used | generated / composed layers | ref inspiration |
|---|---|---|---|---|
| **Hero** | "FIGHT. EXPLODE. GET PAID." — alive arena broadcast | floor, blocks, 2-3 fighters, bomb, explosion | LayeredScene: arena backdrop (composed) + 1 hero fighter cut-out floating + HUD | bmb stadium-crowd shots |
| **SD-1 reveal** | black shutters slam → blast → rules | explosion, blocks | explosion-wipe transition, matrix edge-fade | matrix-code ref |
| **Story (§3)** | the descent into the arena | blocks, fighters | layered parallax plates, broadcast clip-reveal | crowd + casino refs |
| **Live Arena** | "watch it happen now" | floor, blocks, fighters, bomb, explosion | composed live diorama (compose_scene) | stadium ref |
| **Roster** | meet the degens | all 11 portraits + auras | per-card holo glow, aura bg per skin | character auras |
| **Economy/Token** | money machine | $, powerups, money-green | matrix-money rain, gold flow | pump/casino refs |
| **Final CTA** | "last meme standing takes the pot" | hero fighter, explosion | big explosion + single fighter silhouette | troll/chad portrait |

Every block: dark base → our pixel assets → one neon focal pop → attitude copy. One continuous
cinematic world, depth via 3 planes, motion via parallax/idle.
