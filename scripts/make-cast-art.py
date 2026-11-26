"""
Prepare the computer opponents' portraits (public/art/cast/<id>.webp).

Each is a picture Ian made with Gemini (2026-11-26), saved under the names below in one folder
(the names are the ones they were downloaded with, not who they show):

  mildred  medium-computer-opponent.jpg   Mayor Mildred (Easy), in her armchair
  crane    easy-computer-opponent.jpg     Chancellor Crane (Normal), at the desk
  vex      the-ninth-portrait.jpg         Grand Vizier Vex (Hard), with the scroll
  ty       hard-computer-opponent.jpg     Time Traveller Ty (the hardest level)

This crops each to the head and shoulders, square (shown in a circle down to 24 px, so the face
has to fill it), and saves it as WebP.

  python scripts/make-cast-art.py <folder> [id ...]
"""
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "art", "cast")
SIZE = 256

SOURCES = {
    "mildred": "medium-computer-opponent.jpg",
    "crane": "easy-computer-opponent.jpg",
    "vex": "the-ninth-portrait.jpg",
    "ty": "hard-computer-opponent.jpg",
}

# Centre of the crop (fractions of width and height), its side (fraction of width), and a
# midtone lift (gamma below 1 lightens).
CROPS = {
    "mildred": (0.600, 0.235, 0.235, 1.0),
    "crane": (0.410, 0.275, 0.215, 1.0),
    "vex": (0.515, 0.290, 0.250, 1.0),
    "ty": (0.620, 0.170, 0.160, 1.0),
}


def prepare(folder: str, cast_id: str) -> None:
    cx, cy, side, gamma = CROPS[cast_id]
    image = Image.open(os.path.join(folder, SOURCES[cast_id])).convert("RGB")
    width, height = image.size
    span = side * width
    left, top = cx * width - span / 2, cy * height - span / 2
    image = image.crop((round(left), round(top), round(left + span), round(top + span)))
    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    if gamma != 1.0:
        table = [round(255 * (value / 255) ** gamma) for value in range(256)]
        image = image.point(table * 3)
    os.makedirs(OUT, exist_ok=True)
    target = os.path.join(OUT, f"{cast_id}.webp")
    image.save(target, "WEBP", quality=84, method=6)
    print(f"{target}: {os.path.getsize(target) // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for cast_id in sys.argv[2:] or list(CROPS):
        prepare(sys.argv[1], cast_id)
