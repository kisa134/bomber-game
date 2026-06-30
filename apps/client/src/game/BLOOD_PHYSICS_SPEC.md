# Realistic Blood/Gore Visual-Physics — Build Spec

Canvas 2D, top-down 2.5D, 48px tiles, 13×13 grid. Budget: < 2ms/frame for blood.
Source: design pass (2026 session). Implement incrementally against `renderer.ts`.

## 0. Data model & conventions
- `TILE=48`, `GRID=13`, `N=169`. Screen-Y down = "gravity" bias (+Y).
- Reuse existing persistent bake offscreen + per-cell intensity (`sat` 0..9 = existing `bloodGround`).
- NEW typed arrays(N): `dry`(0..1), `age`(s), `charcoal`(=existing bake darken), `blocked`, `dirtyBake`.
- Fluid tick `dtF=1/12 s` drives spread+drying (decoupled from frame dt). Particles run on frame dt.

## 1. Droplet phase (ballistic spray)
Droplet {x,y,z,vx,vy,vz,r,life}. Emit 18..40×power per gib, capped to MAX_DROPLETS.
- launch: speed=rand(120,420)×power; vz=rand(140,320); z=2; r=rand(1.5,4.5).
- integrate (semi-implicit Euler/frame): G=900 (vz-=G·dt; z+=vz·dt); plane DRAG=2.2, GRAV_PLANE=60 downscreen.
- land when z≤0 & vz<0. vImpact=hypot(vx,vy,-vz).
- splatR=clamp(r·(0.8+vImpact/300),1.5,9); elong=clamp(vImpact/260,1,2.6) along atan2(vy,vx); 0..3 satellite droplets ahead. Stamp oriented ellipse into bake (fresh-red), addBlood(cell, splatR²·0.012).
- in-air: dark-red circle r·(1-z/200·0.3) + faint ground shadow ellipse (height cue). No trails on lowFx.

## 2. Pooling & spread (12Hz, active set only)
For active cell (sat>0.05, dry≤0.6): fluid=sat-SETTLE(2.5). 8-neigh weights up=0.5 down=1.6 L/R=1.0 (diag×0.5).
- irregular edge via value-noise gate: sample 64² tileable noise at (cx·0.7, cy·0.7, tickPhase+=0.13/tick); if nz<0.42 → w×=0.15 (front fingers, not circles).
- flow only downhill (head=sat[i]-sat[n]>0.2); normalize outflow ≤ fluid·RATE(0.25). Recv cells → dirtyBake, age reset.
- edge stamp: when sat[n] crosses 0.5, stamp noise-masked wedge i→n (not clean rect).
- block-base seep: blocked neighbor → thin 4-6px dark arc against block base on bake, weight 0.7.

## 3. Drying & color
age+=dtF; local=DRY_TIME(45s)·(0.4+0.6·clamp(sat/6)); dry=clamp(age/local).
Ramp (lerp by dry): 0→(150,10,12) bright; .15→(122,8,14); .45→(86,12,18) maroon; .75→(54,16,18); 1→(34,18,16) brown-black.
Quantize dry into 5 bands; restamp cell only on band change (drying ≈ free).
Charcoal: finalRGB=mix(ramp,(12,8,8),min(charcoal·0.12,0.7)); each blast age+=charcoal·4 (scorched blood dries instantly).

## 4. Wet sheen / light tie-in
Separate `sheenCanvas`, composite `lighter`, UNDER blocks/players. Only dry<0.5 cells.
s=(1-dry/0.5)·clamp(sat/4); glint offset toward light (lx,ly): ox=dx/L·TILE·0.18.
radial gradient at (cx+ox,cy+oy) r=TILE·0.42: 0→rgba(255,180,170,0.30·s); .5→rgba(120,40,40,0.10·s); 1→0. Warm, not white. Scale ×1/(1+L/300). Decays as dry→0.5 (no timer). Optional pulse 0.9+0.1·sin.

## 5. Occlusion & draw order
floor → bake blit → sheen(lighter) → in-air droplets+shadows → blocks back-to-front (fronts cover base blood) → players(feet-Y sort)+leg blood → FX/UI.
- blocked cells never accumulate sat; block top-face never gets blood (bake blitted before blocks).
- destroyed block clears blocked → neighbors bleed in over ~1s.

## 6. Perf & LOD
Caps: MAX_DROPLETS 120/40(phone); MAX_ACTIVE_CELLS 64 (oldest-evict, ties to existing blood cap); emit hard-capped.
Bake persistent (never clear), restamp dirty only. Mem ~3.4KB arrays + 2 offscreens.
lowFx/phone: fewer droplets, no satellites/trails, centered/no sheen, 8/6Hz 4-neigh tick, 3 color bands.

## 7. Player body blood (legs)
LegBlood {wet 0..1, age s, side -1..1}. Pickup: feet cell sat>1 & dry<0.6 → wet+=0.6·dt·clamp(sat/4); age=0; side=sign(vx). Direct hit → wet=1.
Dry ~8s: d=clamp(age/8); shown w=wet·(1-d). Render on lower 40%: ramp(d) alpha 0.55·w, 2-4 soft blobs biased to side, sheen dab when w>0.6.
Footprint tie-in: while w>0.3 & moving, every STRIDE=14px stamp alternating L/R smear ramp(d), shrinking with w → prints fade over distance.

## Integration map
sat=existing bloodGround; bake=existing baked-blood offscreen (+dirtyBake/5-band); charcoal=existing (now also accelerates drying); footprints=existing API (now fed legBlood w + ramp color); 46-cap → MAX_ACTIVE_CELLS oldest-evict (evicted → dry=1, frozen baked).
