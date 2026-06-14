# Sprites

Drop PNG files here with the **exact names** below. Anything missing falls back
to the built-in canvas drawing, so you can add them one at a time.

- Format: **PNG** (transparent background where noted).
- Size: **64×64 px** (square). They're scaled to the tile size at runtime;
  64 px stays crisp up to retina. Pixel-art is rendered without smoothing.
- Keep each file small (a few KB). Total art budget ~150 KB is plenty.

## Tiles (opaque, fill the whole 64×64)

| File | What it is |
| --- | --- |
| `floor.png` | Ground tile (optional — without it you get a checker pattern) |
| `hard.png` | Indestructible wall block |
| `soft.png` | Destructible block (breaks on explosion) |
| `explosion_0.png` | Blast frame 1 — small flash |
| `explosion_1.png` | Blast frame 2 — expanding core |
| `explosion_2.png` | Blast frame 3 — max size |
| `explosion.png` | Optional single-frame fallback if no frames present |

## Objects (transparent background, art centered)

| File | What it is |
| --- | --- |
| `bomb.png` | Bomb |
| `powerup_bomb.png` | +1 bomb pickup |
| `powerup_fire.png` | +1 blast range pickup — **still missing**, falls back to 🔥 emoji |
| `powerup_speed.png` | +speed pickup |
| `powerup_kick.png` | kick ability pickup |

## Player skins (transparent background, top-down token)

Assigned by player slot (0–3), matching the lobby colors red/blue/green/yellow.

| File | Slot |
| --- | --- |
| `skin_0.png` | Player 1 (red) |
| `skin_1.png` | Player 2 (blue) |
| `skin_2.png` | Player 3 (green) |
| `skin_3.png` | Player 4 (yellow) |

> Note: skins are currently shown per player slot, not per lobby pick (the
> chosen skin isn't networked yet). Drawing them in slot order keeps colors
> consistent with the HUD.
