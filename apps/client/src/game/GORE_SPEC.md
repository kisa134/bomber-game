# Juicy Violence System — Build Spec (BomberMeme, Canvas2D)

Grounding: `apps/client/src/game/renderer.ts` + `BLOOD_PHYSICS_SPEC.md`. Rules: never less juice than now; gore-OFF (coins) mirrors everything; 60fps mid-PC + phones (`lowFx`); tsc=0 + vite build per step.

## 0. Central `GORE` config (spine — but land AFTER the cheap juice per plan)
```ts
const GORE = {
  intensity: 1,            // 0..1.5 Settings slider; multiplies counts/shake/spray
  hitStop:   { gibMs: 90, killMs: 55, chainMs: 130, curve: "hold" },
  flash:     { ms: 70, alpha: 0.55 },
  shake:     { kill: 20, gib: 26, multi: 34 },
  spray:     { dropletsPerKill: 30, maxDroplets: 120, maxDropletsLow: 40, arcG: 900 },
  spurt:     { pulses: 3, pulseMs: 140, reach: 2.4 },
  combo:     { window: 1400, tiers: ["DOUBLE","TRIPLE","MULTI","RAMPAGE","CARNAGE"] },
  cap:       { activeCells: 64 },
} as const;
```
`effIntensity()` scales the same for gore + coin path. lowFx clamps counts, keeps timing.

## 1. Moment-of-kill juice (biggest win)
- **1a Hit-stop** in `render()` (~:1931): scale dt by a time-gate. `hitStop(durMs,floor)` setter like `shake()`. Single gib kill floor=0 for 90ms (freeze-frame on gib); regular kill floor=0.15/55ms; chain floor=0/130ms. Curve "hold": stay at floor 60%, then k² ease-out. CRUCIAL: scale dt only — `now`/perf.now keeps running so shake/flash ring out in real time over frozen gibs (frozen meat + live shake = the sell). Keep on phones.
- **1b Impact flash**: `"flash"` particle (exists), red `rgba(255,40,30,.55)` 70ms hard fade on kill cell. Coin mode: gold.
- **1c Directional shake**: `shake(mag,ms,ax,ay)` store aim; transform biases push away from blast vector (from onExplosion ecx/ecy). Thread vector into onDeath.
- **1d Zoom punch**: first 80ms `ctx.scale(1+0.025*env)` around center. Chromatic = 2 faint offset red/cyan flash copies on kill cell only, skip lowFx.

## 2. Dismemberment & gibs (already strong: 8 kinds, z-arc, block bounce, GORE_PHYS)
- **2a Directional dismemberment**: feed blast vector into onDeath's fling → existing aimed `spawnGore` path (±0.45rad cone + forward speed). ~3 lines, huge.
- **2b Skull-pop**: ~35% kills, skull vz×1.6, on first land trigger bone-splinter burst + clatter. New `pop` flag checked in landGore.
- **2c Bone shards**: small fast ivory splinters, pure particles (no decal), 4–8/kill.
- **2d Wet vs dry**: wet (meat/organ/brain/limb) low rest + splat blood + small markGround on land; dry (bone/tooth/skull/eye) high rest + clatter. Flung guts seed mini-pools where they land.
- **2e** z-squash on bounce (1-frame y×0.7 splat-flatten).

## 3. Arterial spray & blood arcs (implement BLOOD_PHYSICS_SPEC §1)
- **3a Ballistic droplets**: Droplet array cap 120/40. Emit dropletsPerKill×intensity. In-air dark-red circle + ground-shadow ellipse. On land stamp oriented ellipse into existing bake + markGround (or markBlockBlood if landing cell blocked). Runs on frame dt → hit-stop slows the spray (guts hang mid-air = cinematic).
- **3b Arterial pump**: ~40% kills, scheduled emitter `{cell,dir,pulsesLeft,nextAt}`, 3 pulses 140ms apart, forward cone, decreasing power (1, .7, .45) = dying heartbeat. Signature moment, ~30 lines.
- **3c Pooling/dry**: phase later (spec §2-3); don't block juice on full fluid sim.

## 4. Persistent aftermath (keep all existing)
- **4a Cap→64 oldest-evict-FREEZE** (replace :1129 `>=110`): evicted cell → dry=1, baked charcoal, off active set but bake stays. Carnage = accumulating DARK DRIED stains, not bright-red carpet. (See [[blood-carpet-rootcause]].)
- **4b Drag-smears**: walking wet cell raises playerGore.blood + elongates next footprint into a skid, fades over 14px.
- **4c Block-base seep**: thin dark arc against block bases by pools.
- **4d Charred escalation**: already wired (onExplosion bakes nearby blood). Late-game red→maroon→black naturally.

## 5. Escalation / combo (retention multiplier — nothing exists yet)
- comboCount/comboAt, window 1400ms. Tier table escalates hitStop/shake/spray + kicker text + sound:
  - single 55/.15, 20, 1× ; DOUBLE 90/0,26,1.3×,"DOUBLE KILL" ; TRIPLE 110/0,30,1.6× ; MULTI/RAMPAGE 130/0,34,2×.
- Kicker via existing `popText(big)` center-screen + extra zoom. SFX placeholder via assets.playGore(rate rising).
- Chain-reaction: single onExplosion kills ≥2 → instant tier-3+ freeze over whole multi-gib. Gated by 1.4s window + skill → not cheap.

## 6. "Even cooler" variants
1. **Final-blow slow-mo cam** (match-winning kill only): hitStop(450,0.08)+zoom 1.06 held+setColorTemp(-1). Highlight-reel feel. ~15 lines.
2. **Gore reacts to light/time**: tie drawBloodSheen intensity to `tod` (glistens by day key light, matte-black at night, dusk grade → near-neon spray).
3. **Gib roll + wet-streak**: round kinds (skull/eye/coin) trundle a tile after bounce; block-face drip length scales with impact speed.
4. Bonus: kicked-skull "GOAL!" popText if travels >3 cells.

## 7. Ethics + toggle
Stylized cartoon-splatter NOT torture-porn: saturated comic-red→maroon, chunky shapes (no anatomy/faces-in-pain), juice is in motion/rhythm/combos not suffering. Gore-OFF coin mirror per effect (droplets→gold sparks, spurt→coin fountain, flash→gold, pools→settled coins). Hit-stop/shake/zoom/combo/kicker are gore-AGNOSTIC → stay ON in coin mode. Intensity slider 0..1.5 (Settings→Graphics by the density slider), independent of gore on/off.

## 8. Build order (dopamine-per-effort; tsc=0+build each)
1 Hit-stop (XS,★★★★★) → 2 Flash+zoom (XS,★★★★) → 3 Directional kill+gibs (S,★★★★) → 4 Combo+kicker (S,★★★★★) → 5 GORE config+intensity slider (S) → 6 Cap→64 evict-freeze (S) → 7 Ballistic droplets (M,★★★★) → 8 Arterial spurt (M,★★★★★) → 9 Skull-pop+shards+wet-pools (M) → 10 Final-blow slow-mo (S,★★★★) → 11 Full fluid pooling/dry (L) → 12 Polish roll/streak/sheen-by-tod/drag-smears.
Steps 1–4 deliver ~80% of felt juice before any new particle system.

### Key file refs (as of audit)
onDeath ~:1007 ; onExplosion ~:869 (shake falloff ~:990) ; stepParticle ~:2939 ; updateParticles ~:2957 ; shake ~:731 (transform ~:1943) ; GORE_PHYS ~:241 ; gore arrays ~:343–351 ; spawnGore ~:1309 ; landGore ~:1324 ; blood cap ~:1129 ; buildBloodGround ~:1185 ; drawBloodSheen ~:1157 ; setGore ~:1287 ; dt gate render() ~:1931 ; popText ~:746 ; setColorTemp ~:787.
