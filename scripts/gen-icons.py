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

# Theme-dark fill for any transparent area (the icon's own bezel is dark, so the
# rounded corners blend in — and iOS never shows white behind transparency).
BG = (14, 16, 24, 255)  # #0e1018

raw = Image.open(SRC).convert("RGBA")
# The art is a rounded app-icon on a transparent field — crop to just the icon
# (the tight bounding box of all non-transparent pixels).
bbox = raw.split()[3].getbbox()
icon = raw.crop(bbox) if bbox else raw
# Pad to a perfect square (centered) so nothing is distorted when we resize.
w, h = icon.size
s = max(w, h)
square = Image.new("RGBA", (s, s), (0, 0, 0, 0))
square.paste(icon, ((s - w) // 2, (s - h) // 2), icon)
# Flatten onto the dark theme color so the final icons are fully opaque,
# full-bleed, and free of the white halo iOS paints behind transparency.
flat = Image.new("RGBA", (s, s), BG)
flat.alpha_composite(square)
src = flat


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
