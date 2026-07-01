# ARENA_PHYSICS — Unified Tuning Config (audit + build plan)

Goal: one typed source-of-truth for every physical/feel param in `renderer.ts`, per-theme overridable, hot-tunable (dev panel). ~140 tunables across 9 systems, currently inline. Land in 9 verified steps.

## Config shape (new file `apps/client/src/game/arenaPhysics.ts`)
`export const ARENA_PHYSICS: ArenaPhysics` — frozen defaults pulled VERBATIM from today (first refactor = no-op). Namespaces:
- **integration**: dtClamp .05, particleDrag .92, arcGravity 26, restitution .4, friction .9, settleVz 1.1, settleDamp .45, goreStopThresh .45, airChoke 3
- **particles**: maxDesktop 520, maxMobile 240, maxDecals 90, lightLife 460, lightCap 80, flameCount 7, smokeCount 3, emberCount 5, emberRise -2.5, coreFlashSize .85, coreFlashLife .14, chipCount 4, chipGravity 16
- **bomb**: dropMs 300, landMs 64, bounceFreq 2.5, contactThresh .18, squash .5, stretchCap .18, lift .78, landPuff 8, landFlashMs 160, fuseSparkChance .5
- **shake**: blastBase 4, blastPerCell .5, blastCap 18, fallbackMul .5, proxScale 9, proxMin .16, blastMs 240, deathMag 20/deathMs 300, coinMag 11/coinMs 200, decay 9, freqX 283/freqY 311
- **blood**: coverCap 110, deathMush 9, poolOrtho 3/poolDiag 2, outerSpeck 1, outerChance .3, cellClamp 9, gibCount 72, gibGz 34/gibRest .18/gibFric .84, spray [36,24,10,6], meatGobCount 9, meatGz 33/meatRest .22/meatFric .82, wetSplatChance .7, dripDelayBase 700/dripDelayRand 1800
- **scorch**: burnClamp 8, burnBase 1.4/burnPower 1.4, craterBase 1.2/craterPower 2.6, darkScale 6, baseAlpha .12/alphaPower .66, grainBase .3/grainPower .65, bakeClamp 12, bakeBase 3/bakePower 2.5, burnedBloodFloor 6
- **hardDmg**: minStage 3/stageSpread 4, crackChance .55, roofBand .26, alphaBase .22/alphaPerLvl .15/alphaCap .66, reach .58, overheadFactor .55
- **light**: todEase .04, tensionEase .012, nightTarget .16, duskTarget .48, autoBase .18/autoAmp .82/autoPeriod 28000, moonlight [120,150,210], keyReach .62/keyReachDyn .52, keyAlphaBase .05/keyAlphaTod .12, nightWash .24, vigBase .20/vigDusk .30, dangerFreq/dangerBand, gradeWarm .12/gradeCold .28
- **gore**: flingCounts per-kind, coinCount [10,8], bileChance .5, landCap 360, bileCap 120, splatThrottle 85, kickSpread .9, blastStrength 1.6/blastPower 1.6
- **global**: fxBaseMobile .5/fxBaseDesktop 1, dprMobile 1.5/dprDesktop 2, boardMargin 22, floaterCap 24

Per-theme overridable via existing `ARENA_LIGHT`/`ARENA_SCENE`/`FLOOR_PHYSICS`/`ATMOSPHERE` + optional `themeOverrides: Partial<Record<ArenaTheme, DeepPartial<ArenaPhysics>>>` resolved on `setArenaTheme` (void=floatier, industrial=heavier).

## Threading
`const PHYS = ARENA_PHYSICS` (device/global statics) + instance `this.phys = resolvePhysics(theme)` (theme-sensitive, set in setArenaTheme like FLOOR_PHYSICS is). `resolvePhysics(t) = deepMerge(clone(ARENA_PHYSICS), themeOverrides[t])`. Dev hook: `setPhysicsOverride(patch)` + `if(import.meta.env.DEV) window.__phys = ...`. settings.ts stays user-facing; main.ts presets translate settings→`setPhysicsOverride`.

## Migration order (tsc=0 + build each)
0 scaffold arenaPhysics.ts (pure add) → 1 shake → 2 bomb drop (keep BOMB_TIMER_MS server-side!) → 3 integration defaults (broad, test gore/chip landing) → 4 particles+global LOD → 5 scorch+hardDmg → 6 blood → 7 gore amounts+GORE_PHYS → 8 lighting/time (screenshot per theme) → 9 dev hook + preset overrides.

## KEEP OUT (server-authoritative, protocol import): BOMB_TIMER_MS, EXPLOSION_LIFETIME_MS, START_LIVES, GRID_W/H, and the server cell-count (only the /13 normalizer is a safe knob).

## Coherence fixes: (1) two gravity scales — flat `drag` frame-dependent vs arc `gz` frame-independent; document + long-term migrate flat to per-sec. (2) restitution/friction defined 4+ places — centralize fallbacks, keep per-kind intentional. (3) blast `power=cells/13` duplicated 3× → one helper. (4) scorch burn vs baked-blood parallel falloff hand-tuned 2 spots → co-locate. (5) blood cap 110/187 = the blood-carpet root cause, surface as tunable. (6) light pos computed twice (render 0.36/0.16 vs drawAmbient 0.34/0.2) → drift under dyn light, unify. (7) fxScale overloaded — some spawns ignore it (land-puff 8, chip 4).
