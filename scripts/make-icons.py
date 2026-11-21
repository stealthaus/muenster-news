"""Renders the app icons into public/icons/. macOS only: QuickLook rasterises the SVGs, Pillow scales them.
Run `node scripts/icon-svg.mjs` first to (re)write the SVGs."""
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"


def raster(svg: Path, tmp: Path) -> Image.Image:
    subprocess.run(["qlmanage", "-t", "-s", "1024", "-o", str(tmp), str(svg)], check=True, capture_output=True)
    return Image.open(tmp / f"{svg.name}.png").convert("RGB")


with tempfile.TemporaryDirectory() as d:
    tmp = Path(d)
    full = raster(OUT / "icon-full.svg", tmp)
    maskable = raster(OUT / "icon-maskable.svg", tmp)

for name, img, size in [
    ("apple-touch-icon.png", full, 180),
    ("icon-192.png", full, 192),
    ("icon-512.png", full, 512),
    ("favicon-32.png", full, 32),
    ("icon-maskable-512.png", maskable, 512),
]:
    img.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print("wrote", name)
