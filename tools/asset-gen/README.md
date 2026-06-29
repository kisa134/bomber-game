# asset-gen — MemeArena landing asset generator

Generates cinematic key-art / scene backgrounds / character cutouts for the landing in our
locked visual style, via **WaveSpeed AI** (`google/nano-banana-2/text-to-image` + the
`image-background-remover` model). Style prompt is kept in lockstep with `apps/landing/SPEC.md`.

## Setup
```bash
cd tools/asset-gen
npm install                 # sharp + tsx + dotenv (isolated, not part of the pnpm workspace)
# .env already holds WAVESPEED_API_KEY (gitignored). Otherwise: cp .env.example .env
```

## Use
```bash
# wide cinematic background (style prefix auto-prepended):
npx tsx gen.ts --name hero-arena --ar 16:9 --prompt "a vast bomber arena, jumbotron, central blast"

# character cutout (transparent-ready, background removed):
npx tsx gen.ts --name trump-gladiator --ar 3:4 --prompt "trump as a meme gladiator, full body" --cutout

# exact prompt, no style prefix:
npx tsx gen.ts --name thing --ar 1:1 --raw --prompt "literally this"
```
Flags: `--name` (out file) · `--prompt` · `--ar` (16:9/21:9/1:1/3:4…) · `--res` (1k/2k/4k) ·
`--raw` (skip style prefix) · `--cutout` (remove background).

Output → `out/<name>.webp`. Copy chosen assets into `apps/landing/public/bg/` (or `/sprites/`)
and wire into components. Cost ≈ a few cents per 2k image; generate purposefully.

> **Game character sprites** (full walk + action set): use sibling repo
> `../bomb-fun/tools/character-gen` — see its `WORKFLOW.md`. This tool is for landing key-art only.
