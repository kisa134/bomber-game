# Gore Surface Spec v3.1 (APPROVED — basis for implementation)

One **surface material** that stores the battle's history and evolves through state.
Blood / scorch / char are **phases of one material**, not independent layers. Anti-carpet
is in the material's physics (transfer + darkening/drying), NOT in deletion/limits.

Frozen (do NOT touch): 8 First Blood, 7 bones/meat/chips, 6 gibs/spray, 5 block blood,
2 footprint VISUAL. Only §B's transfer MECHANIC is in scope for layer 2.

## Per-tile continuous values (0..1)
- `gore` — blood material amount. Persists as a **stain** (history), never deleted.
- `wet` — freshness. Falls almost to 0 visually, but the `gore` stain remains.
- `burn` — **depth** of ground scorching (not a blast counter).
- `char` — **degree** of blood baking (partial → full), not a binary flag.

## Visible phases (reading the values — material evolution, not just darkening)
1. CLEAN — grass.
2. FRESH GORE (gore↑ wet↑) — wet, glossy, dark-red.
3. DRYING/SMEARED (wet↓, gore stain) — materially drier: gloss→matte→crust→trampled dirty patina.
4. CHARRED (char by degree) — dry, crusty, burnt-in matter (NOT flat black overlay).
5. SCORCHED EARTH (burn>0, gore=0) — burnt brown-black earth.

## Events
- **A. Death(T):** fresh gore budget + wet=max at epicenter, compact falloff ring. Over a
  charred tile → fresh lays ON TOP of the char base (base remains underneath; not wiped).
- **B. Movement (transfer by FEEL, not bookkeeping):** stepping through wet gore picks up a
  carry; deposits thinning SMEARED on following tiles; source epicenter depletes; trail
  outlives the central mush. Transfer of EXISTING blood, never new. Layer-2 visual form unchanged.
- **C. Blast:** see Blast Falloff below.
- **D. Time:** wet → ~0, gore stain stays; surface dries/wears. No deletion.
- **E. Death over CHARRED:** fresh red ON TOP of old char base; surrounding char remains.

## ★ Blast falloff / char intensity
Not a uniform black stamp — a **gradient of state depth** from the blast epicenter out:
- center = deepest burn / strongest char / darkest & most burnt-through;
- mid = medium bake/darkening;
- edges = light scorch / partial char / scorched transition — **organic, ragged edges** (noise, not a clean circle).
Strength scales with distance-to-center AND blast power: a stronger blast → deeper center
char + WIDER noticeable radius + stronger blood→baked conversion. Same falloff applies to
clean earth (scorch gradient) and to blood under the blast (center→deep char, edge→partial).

## Visual priority rules
1. **Fresh gore = highest visual priority.** A new death on old scorch/char reads instantly
   and clearly; old history stays underneath but never drowns the new event.
2. **Charred = dry burnt-in matter**, not a flat black overlay (texture: dry, crusty, scorched, embedded).
3. **Blast edges organic/ragged**, never a perfect stamp.
4. **Repeated blasts in one area DEEPEN the same state** (deeper burn/bake/char at center), not repaint.

## Acceptance
1. Bright fresh mush only at recent deaths, compact; everything else = dark dried/worn patina, not bright red.
2. Run through mush → dragged outward in thinning trails; epicenter depletes; trails outlive it.
3. Blood never pops out; wet→0 but stain-history remains; old is materially drier/dirtier, not just darker.
4. Blast = gradient crater (black burnt center → mid bake → light scorch edge). No uniform stamp.
5. Stronger blast → deeper center + wider radius.
6. Blood under blast bakes with the SAME falloff (center deep char, edges partial).
7. New death on charred → fresh red on top of the old burnt base; history preserved.
