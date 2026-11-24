"""
Prepare the computer opponents' portraits (public/art/cast/<id>.webp).

Each is an old-master painting in the public domain, from the Art Institute of Chicago, which
releases its images of public-domain works under CC0 (no permission or credit needed; the
credit is kept in lib/game/ai.ts anyway). Download the three images at 843 px wide into one
folder, named <id>.jpg:

  mildred  Portrait of a Lady, French or Swiss, 1725-50 (AIC 1935.299)
           https://www.artic.edu/iiif/2/6b2e856f-01c4-1f23-4ded-79c2398c2c6b/full/843,/0/default.jpg
  crane    Portrait of a Man, attributed to Nicolaes Maes, c. 1655 (AIC 1925.716)
           https://www.artic.edu/iiif/2/b18d4b7b-4545-5a75-e956-ed93d1372f35/full/843,/0/default.jpg
  vex      An Old Man in a Fur Cap, Karel van der Pluym, c. 1655 (AIC 1988.265)
           https://www.artic.edu/iiif/2/b7a594db-5c71-253b-aedc-4226d8661f11/full/843,/0/default.jpg

This crops each to the head and shoulders, square (shown in a circle), and saves it as WebP.

  python scripts/make-cast-art.py <folder with mildred.jpg, crane.jpg, vex.jpg> [id ...]
"""
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "art", "cast")
SIZE = 256

# Centre of the crop (fractions of width and height), its side (fraction of width), and a
# midtone lift (gamma below 1 lightens): Vex's face sits in shadow, so it reads at 28 px.
CROPS = {
    "mildred": (0.60, 0.29, 0.50, 1.0),
    "crane": (0.48, 0.29, 0.46, 1.0),
    "vex": (0.52, 0.35, 0.56, 0.85),
}


def prepare(folder: str, cast_id: str) -> None:
    cx, cy, side, gamma = CROPS[cast_id]
    image = Image.open(os.path.join(folder, f"{cast_id}.jpg")).convert("RGB")
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
