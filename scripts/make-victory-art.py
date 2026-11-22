"""
Prepare the victory scenes (public/art/victory/<kind>.webp).

Like the rulebooks' "Gallery of the Future" (base p. 11, Legacy & Diplomacy p. 7), each victory's
future is a photograph washed in its band's color. The game applies the color
(components/game/VictoryStory.tsx); this script only picks the frame and evens out the tone, so
photographs from different sources sit together.

Every source is public domain or CC0 (no attribution required); the credits are kept below and in
docs/agents/development-plan.md anyway.

  python scripts/make-victory-art.py [kind ...]

Originals are downloaded once into the system temp folder.
"""
import os
import sys
import tempfile
import urllib.request

from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "art", "victory")
CACHE = os.path.join(tempfile.gettempdir(), "pax-victory-art")
WIDTH, HEIGHT = 2560, 1440
USER_AGENT = "PaxCorruptionArt/1.0 (https://pax-corruption-game.vercel.app)"

# crop: the part of the original to frame, as fractions (left, top, right, bottom); it is trimmed
# to 16:9 around its center. The game pulls back from `focus` (VictoryStory FUTURES).
COMMONS = "https://upload.wikimedia.org/wikipedia/commons"
SCENES: dict[str, dict] = {
    # A Democratic Future: the crowd before a civic hall on Peace Day, 1919.
    "civil": {
        "title": "Peace Day Celebrations, Victoria Square, Adelaide (1919)",
        "credit": "State Government Photographer, South Australia",
        "license": "CC0",
        "page": "https://commons.wikimedia.org/w/index.php?curid=87033451",
        "url": f"{COMMONS}/5/53/Peace_Day_Celebrations%2C_Prime_Minister_Hughes_arrival_in_Adelaide_at_Victoria_Square%28GN02590%29.jpg",
        "crop": (0.0, 0.08, 1.0, 0.95),
    },
    # An Autocratic Future: Parliament House, Helsinki, at night.
    "political": {
        "title": "Eduskuntatalo Helsinki at night 2022-09-18 09",
        "credit": "Leonhard Lenz",
        "license": "CC0",
        "page": "https://commons.wikimedia.org/w/index.php?curid=146679758",
        "url": f"{COMMONS}/3/3e/Eduskuntatalo_Helsinki_at_night_2022-09-18_09.jpg",
        "crop": (0.0, 0.04, 1.0, 0.96),
    },
    # A Dynastic Future: the entrance hall of a palace, under its crystal chandelier.
    "military": {
        "title": "Chandelier of the Entrance Hall of Dolmabahçe Palace, Istanbul",
        "credit": "Julian Lupyan",
        "license": "CC0",
        "page": "https://commons.wikimedia.org/w/index.php?curid=176677231",
        "url": f"{COMMONS}/0/07/Chandelier_of_the_Entrance_Hall_of_Dolmabah%C3%A7e_Palace%2C_Istanbul.jpg",
        "crop": (0.0, 0.0, 1.0, 1.0),
    },
    # A Disintegrated Future: ships at the quay, as in the rulebook's band.
    "popularity": {
        "title": "View of Bordeaux, from the Quai des Chartrons (Eugène Boudin, 1874)",
        "credit": "Cleveland Museum of Art",
        "license": "Public domain (CC0 image)",
        "page": "https://commons.wikimedia.org/w/index.php?curid=76010027",
        "url": f"{COMMONS}/b/b4/Clevelandart_1986.73.jpg",
        "crop": (0.0, 0.0, 1.0, 1.0),
    },
    # A Police State Future: a wall of cameras over two passers-by.
    "ideological": {
        "title": "Persons Under CCTV Cameras",
        "credit": "Matthew Henry",
        "license": "CC0",
        "page": "https://commons.wikimedia.org/w/index.php?curid=83602925",
        "url": f"{COMMONS}/3/32/Persons_Under_CCTV_Cameras_374103.jpg",
        "crop": (0.0, 0.0, 1.0, 1.0),
    },
    # An Enlightened Future: a gilded ballroom and its stage.
    "cultural": {
        "title": "Blackpool Tower Ballroom",
        "credit": "Michael D Beckwith",
        "license": "CC0",
        "page": "https://commons.wikimedia.org/w/index.php?curid=71673120",
        "url": f"{COMMONS}/a/ac/Blackpool_Tower_Ballroom_%2863797383%29.jpeg",
        "crop": (0.0, 0.0, 1.0, 1.0),
    },
    # A Cosmopolitan Future: the flags of many nations outside a parliament.
    "diplomatic": {
        "title": "Flags in front of the Louise Weiss building, Strasbourg (2007)",
        "credit": "Syced",
        "license": "CC0",
        "page": "https://commons.wikimedia.org/w/index.php?curid=149512489",
        "url": f"{COMMONS}/d/db/December_2007%2C_flags_in_front_of_Louise_Weiss_building_2.jpg",
        "crop": (0.0, 0.14, 1.0, 0.92),
    },
}


def original(kind: str, scene: dict) -> Image.Image:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{kind}-{os.path.basename(scene['url']).split('?')[0]}")
    if not os.path.exists(path):
        request = urllib.request.Request(scene["url"], headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=120) as response, open(path, "wb") as file:
            file.write(response.read())
    Image.MAX_IMAGE_PIXELS = None
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def frame(image: Image.Image, crop: tuple[float, float, float, float]) -> Image.Image:
    left, top, right, bottom = crop
    box = [left * image.width, top * image.height, right * image.width, bottom * image.height]
    width, height = box[2] - box[0], box[3] - box[1]
    # Trim to 16:9 around the middle of the chosen part.
    if width / height > 16 / 9:
        trim = (width - height * 16 / 9) / 2
        box[0] += trim
        box[2] -= trim
    else:
        trim = (height - width * 9 / 16) / 2
        box[1] += trim
        box[3] -= trim
    return image.crop(tuple(round(v) for v in box))


def grade(image: Image.Image) -> Image.Image:
    """One tone for every source: full range, a little extra contrast, darker edges."""
    image = image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS) if image.width > WIDTH else image.resize(
        (WIDTH, round(WIDTH * image.height / image.width)), Image.Resampling.LANCZOS
    )
    image = ImageOps.autocontrast(image, cutoff=(0.4, 0.6))
    image = image.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))
    # Vignette: the edges fall off a little, like the rulebook bands.
    mask = Image.radial_gradient("L").resize(image.size, Image.Resampling.BILINEAR)
    mask = mask.point(lambda v: min(255, max(0, round((v - 90) * 1.3))))
    dark = Image.new("RGB", image.size, (0, 0, 0))
    return Image.composite(dark, image, mask.point(lambda v: round(v * 0.55)))


def main(kinds: list[str]) -> None:
    os.makedirs(OUT, exist_ok=True)
    for kind in kinds or list(SCENES):
        scene = SCENES[kind]
        image = grade(frame(original(kind, scene), scene["crop"]))
        target = os.path.join(OUT, f"{kind}.webp")
        image.save(target, "WEBP", quality=72, method=6)
        print(f"{kind:12s} {image.width}x{image.height} {os.path.getsize(target) // 1024} KB  <- {scene['title']}")


if __name__ == "__main__":
    main(sys.argv[1:])
