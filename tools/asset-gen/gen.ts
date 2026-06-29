import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { runModel, download, removeBackground, toDataUri } from "./wavespeed.js";

/*
 * MemeArena landing asset generator (WaveSpeed). Style is held by (a) locked anchors,
 * (b) NEGATIVE anti-slop list, (c) REFERENCE IMAGES of our own assets (edit model copies
 * our look). PRESETS bundle the right refs + aspect + positive core per asset type so we
 * hit it first try — no re-crafting, no redo. See STYLE.md.
 *
 *   npx tsx gen.ts --preset env   --name arena1   --prompt "central blast, embers"
 *   npx tsx gen.ts --preset fx    --name smoke1   --prompt "thick rolling smoke"   --draft
 *   npx tsx gen.ts --preset fighter --name fg-doge --ref ../../apps/client/public/sprites/doge/...webp
 *   npx tsx gen.ts --name custom  --ar 16:9 --ref a.webp,b.webp --prompt "..."   # manual
 *
 * Cost discipline: --draft = 1k cheap (validate composition) → re-run keeper with --seed at 2k/4k.
 * Flags: --preset --name --prompt --ref(csv) --ar --res --seed --cutout --raw --draft
 */

const T2I = process.env.T2I_MODEL ?? "google/nano-banana-2/text-to-image";
const EDIT = process.env.EDIT_MODEL ?? "google/nano-banana-2/edit";
const S = "../../apps/client/public/sprites"; // our true-style reference assets

// ── POSITIVE anchors (always-on) + NEGATIVE anti-slop (always-on) ──
const STYLE =
  "premium 2D pixel-art-influenced meme game key-art, hand-crafted arcade aesthetic, " +
  "dark graphite stone-and-metal bomber arena world, subtle cyan tech seams, warm gold and ember-orange accents, " +
  "crisp readable pixel / vector hybrid linework, flat cinematic lighting, deep near-black background, " +
  "high taste, premium restraint, cohesive with the supplied reference characters and assets";
const NEGATIVE =
  "NOT a generic 3D render, NOT photorealistic, NOT octane/unreal/blender render, NOT anime, " +
  "NOT painterly oil brushwork, NOT blurry, NOT soft AI-slop, NO text, NO logos, NO watermark, NO UI overlay";

// ── PRESETS: type → tuned refs + aspect + positive core (hit it right first try) ──
const PRESETS: Record<string, { ar: string; refs: string[]; pos: string; cutout?: boolean }> = {
  // Blocks (hard + soft) carry our world mood; explosions must share the SAME 2.5D
  // isometric block structure — visible TOP face + FRONT face — not a generic blast.
  env:     { ar: "16:9", refs: [`${S}/hard.webp`, `${S}/soft.webp`, `${S}/explosion_0.webp`], pos: "wide bomber arena ENVIRONMENT plate, empty grid battlefield of destructible blocks, dark spectator stadium, spectator-3/4 angle; destructible soft crates and hard stone blocks in our 2.5D isometric pixel style with a visible TOP face and FRONT face; any explosion is built from that SAME isometric cube structure (top + front faces), pixel-cube debris" },
  field:   { ar: "16:9", refs: [`${S}/hard.webp`, `${S}/soft.webp`, `${S}/bomb.webp`], pos: "near-top-down bomber battlefield grid, destructible soft crates + hard blocks in 2.5D isometric pixel (top + front faces), spawn corners, clean readable tiles" },
  control: { ar: "16:9", refs: [`${S}/skin_2.webp`, `${S}/hard.webp`], pos: "broadcast control-room overlooking a bomber arena through a huge window, monitor wall, moody depth, calm dark lower area" },
  fighter: { ar: "3:4",  refs: [`${S}/skin_2.webp`], pos: "single meme bomber FIGHTER, full body, dramatic rim light, clean readable silhouette, on transparent", cutout: true },
  fx:      { ar: "1:1",  refs: [`${S}/explosion_0.webp`, `${S}/hard.webp`], pos: "explosion FX LAYER on pure black, built from the SAME 2.5D isometric cube structure as the arena blocks (visible TOP and FRONT faces), pixel-cube debris flying out, bright core with warm gold/ember edges, additive, crisp pixel VFX", cutout: true },
};

function arg(name: string, def = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? def : def;
}
const has = (n: string): boolean => process.argv.includes(`--${n}`);

const presetKey = arg("preset");
const preset = presetKey ? PRESETS[presetKey] : undefined;
if (presetKey && !preset) {
  console.error(`unknown preset '${presetKey}'. known: ${Object.keys(PRESETS).join(", ")}`);
  process.exit(1);
}

const name = arg("name");
const subject = arg("prompt");
if (!name || !subject) {
  console.error("usage: npx tsx gen.ts [--preset env|field|control|fighter|fx] --name <id> --prompt <text> [--ref a,b] [--ar] [--res] [--seed] [--cutout] [--draft] [--raw]");
  process.exit(1);
}

const ar = arg("ar") || preset?.ar || "16:9";
const res = has("draft") ? "1k" : arg("res") || "2k";
const refsArg = arg("ref");
const refs = refsArg ? refsArg.split(",").map((p) => p.trim()) : preset?.refs ?? [];
const cutout = has("cutout") || (!!preset?.cutout && !has("no-cutout"));
const core = preset ? `${preset.pos}. ${subject}` : subject;
const prompt = has("raw") ? subject : `${core}. Style: ${STYLE}. Constraints: ${NEGATIVE}.`;
const seed = arg("seed");

await mkdir("out", { recursive: true });
console.log(`name=${name} preset=${presetKey || "-"} ar=${ar} res=${res} refs=${refs.length}${cutout ? " +cutout" : ""}${seed ? ` seed=${seed}` : ""}`);
try {
  const body: Record<string, unknown> = { prompt, aspect_ratio: ar, resolution: res, output_format: "png" };
  if (seed) body.seed = Number(seed);
  let outs: string[];
  if (refs.length) {
    body.images = await Promise.all(refs.map((p) => toDataUri(p)));
    outs = await runModel(EDIT, body);
  } else {
    outs = await runModel(T2I, body);
  }
  if (!outs[0]) throw new Error("no output");
  let buf = await download(outs[0]);
  if (cutout) buf = await removeBackground(buf);
  const file = `out/${name}.webp`;
  await writeFile(file, await sharp(buf).webp({ quality: 92 }).toBuffer());
  console.log(`-> ${file}`);
} catch (e: unknown) {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
}
