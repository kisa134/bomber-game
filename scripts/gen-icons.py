"""Generate the full favicon / app-icon set from a single source image.

Source: apps/client/public/icons/app-icon-source.png (square, >=1024px)
Outputs (into apps/client/public/icons and public root):
  - favicon.ico            (16/32/48 multi-size, at public root)
  - favicon-16.png, favicon-32.png, favicon-48.png
  - icon-180.png           (apple-touch-icon)
  - icon-192.png, icon-512.png   (PWA, purpose "any")
  - maskable-512.png       (PWA, purpose "maskable", full-bleed)
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "apps" / "client" / "public"
ICONS = PUB / "icons"
SRC = ICONS / "app-icon-source.png"

src = Image.open(SRC).convert("RGBA")
# Square it (center-crop) just in case the source isn't perfectly square.
w, h = src.size
if w != h:
    s = min(w, h)
    src = src.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))


def resize(size: int) -> Image.Image:
    return src.resize((size, size), Image.LANCZOS)


# PNG favicons
for s in (16, 32, 48):
    resize(s).save(ICONS / f"favicon-{s}.png")

# Multi-resolution .ico at the web root (classic /favicon.ico fallback)
resize(256).save(
    PUB / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
)

# Apple touch icon (home-screen on iOS)
resize(180).save(ICONS / "icon-180.png")

# PWA icons (Android install / manifest)
resize(192).save(ICONS / "icon-192.png")
resize(512).save(ICONS / "icon-512.png")

# Maskable: full-bleed 512 (art is already centered with a grass/frame border)
resize(512).save(ICONS / "maskable-512.png")

print("done — generated:")
for p in sorted(ICONS.glob("*.png")) + [PUB / "favicon.ico"]:
    print(f"  {p.relative_to(ROOT)}  ({p.stat().st_size} bytes)")
