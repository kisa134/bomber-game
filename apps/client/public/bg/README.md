# Main-menu background

Optional animated background for the menu/lobby screens. If absent, a dark
gradient is used. A dark overlay (~62%) is drawn on top for text readability,
so the art can be colorful/bright.

Drop either or both (the client tries `.webm` first, then `.mp4`):

| File | Notes |
| --- | --- |
| `menu.webm` | preferred (smaller); VP9/AV1, looped, **no audio** |
| `menu.mp4` | fallback; H.264, looped, **no audio** |

Specs:
- **Looping**, seamless, **5–12 s**.
- **1920×1080** (16:9), it's `object-fit: cover` so safe to crop.
- Muted (autoplay requires it). Keep file **< 3–4 MB** for fast load.
- Slow, ambient motion (it sits behind UI) — e.g. a slowly drifting
  bomberman arena, floating memecoins, embers/particles, parallax grid.

### Prompt idea (for an AI video tool)
> Seamless looping background, top-down stylized bomberman arena at night,
> glowing grid floor, slow drifting embers and floating memecoin tokens,
> subtle parallax, dark moody palette with warm orange accents, no characters
> in focus, 1920x1080, 8 second loop, calm ambient motion.
