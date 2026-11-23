"""
Prepare the victory scenes (public/art/victory/<kind>.webp) from Joe's art.

Each scene is the picture behind its victory's band in the rulebooks' "Gallery of the Future"
(base p. 11, Legacy & Diplomacy p. 7), already washed in the band's color. Joe sent them as
"<Kind> Victory.jpg" (1204 x 658, 2026-11-22). This trims their thin black frame, enlarges them
for full-screen use, and saves them as WebP.

  python scripts/make-victory-art.py <folder with the "<Kind> Victory.jpg" files> [kind ...]
"""
import os
import sys

from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "art", "victory")
KINDS = ["civil", "political", "cultural", "diplomatic", "military", "popularity", "ideological"]
# The sent files have a ~3 px dark frame; trim a little more so no edge line shows when enlarged.
FRAME = 4
WIDTH = 1920


def prepare(folder: str, kind: str) -> None:
    source = os.path.join(folder, f"{kind.capitalize()} Victory.jpg")
    image = Image.open(source).convert("RGB")
    width, height = image.size
    image = image.crop((FRAME, FRAME, width - FRAME, height - FRAME))
    height = round(image.height * WIDTH / image.width)
    image = image.resize((WIDTH, height), Image.Resampling.LANCZOS)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.4, percent=45, threshold=2))
    os.makedirs(OUT, exist_ok=True)
    target = os.path.join(OUT, f"{kind}.webp")
    image.save(target, "WEBP", quality=82, method=6)
    print(f"{kind}: {image.size[0]}x{image.size[1]}, {os.path.getsize(target) // 1024} KB")


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    folder = sys.argv[1]
    for kind in sys.argv[2:] or KINDS:
        prepare(folder, kind)


if __name__ == "__main__":
    main()
