"""Icons and the social preview for the game site, in the table's palette.

Usage: python scripts/make-brand-assets.py   (needs Pillow and the Windows fonts Georgia Bold and Segoe UI)
Writes app/icon.png, app/apple-icon.png, app/favicon.ico, public/icons/*, and app/opengraph-image.jpg / twitter-image.jpg.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = r"C:\Windows\Fonts"
SLATE = (13, 17, 23)
INK = (10, 12, 16)
BRASS = (198, 165, 108)
BRASS_LIGHT = (241, 217, 166)
DISTRICTS = [(232, 212, 154), (156, 196, 228), (163, 217, 189), (238, 174, 196)]


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def icon(size: int, rounded: bool = True) -> Image.Image:
    """Brass serif P on dark slate, with the four district colors along the bottom."""
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = int(s * 0.22) if rounded else 0
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=SLATE)
    # Soft brass glow behind the letter.
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((s * 0.18, s * 0.12, s * 0.82, s * 0.76), fill=(*BRASS, 70))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(s * 0.09)))
    d = ImageDraw.Draw(img)
    f = font("georgiab.ttf", int(s * 0.66))
    box = d.textbbox((0, 0), "P", font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s * 0.86 - h) / 2 - box[1]), "P", font=f, fill=BRASS_LIGHT)
    # District stripe.
    bar_w, bar_h = s * 0.56, max(s * 0.06, scale * 2)
    x0, y0 = (s - bar_w) / 2, s * 0.80
    seg = bar_w / 4
    for i, color in enumerate(DISTRICTS):
        d.rectangle((x0 + i * seg, y0, x0 + (i + 1) * seg, y0 + bar_h), fill=color)
    if rounded:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=255)
        img.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (s, s), 0), mask))
    return img.resize((size, size), Image.LANCZOS)


app = os.path.join(ROOT, "app")
icon(512).save(os.path.join(app, "icon.png"), optimize=True)
# Apple adds its own rounding: a full square.
icon(180, rounded=False).convert("RGB").save(os.path.join(app, "apple-icon.png"), optimize=True)
icon(256).save(os.path.join(app, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
# Manifest icons.
os.makedirs(os.path.join(ROOT, "public", "icons"), exist_ok=True)
for size in (192, 512):
    icon(size).save(os.path.join(ROOT, "public", "icons", f"icon-{size}.png"), optimize=True)
    icon(size, rounded=False).convert("RGB").save(os.path.join(ROOT, "public", "icons", f"maskable-{size}.png"), optimize=True)

# --- Social preview, 1200 x 630 ------------------------------------------------------------
W, H = 1200, 630
art = Image.open(os.path.join(ROOT, "public", "art", "box-cover.jpg")).convert("RGB")
ratio = max(W / art.width, H / art.height)
art = art.resize((round(art.width * ratio), round(art.height * ratio)), Image.LANCZOS)
left = int((art.width - W) * 0.75)
top = int((art.height - H) * 0.35)
og = art.crop((left, top, left + W, top + H)).convert("RGBA")
# Darken toward the text side.
shade = Image.new("RGBA", (W, H))
sd = ImageDraw.Draw(shade)
for x in range(W):
    t = x / W
    alpha = int(255 * (0.97 if t < 0.6 else max(0.4, 0.97 - (t - 0.6) * 1.6)))
    sd.line((x, 0, x, H), fill=(*INK, alpha))
og = Image.alpha_composite(og, shade)
d = ImageDraw.Draw(og)
x = 80
# District stripe + eyebrow.
for i, color in enumerate(DISTRICTS):
    d.rounded_rectangle((x + i * 26, 92, x + i * 26 + 22, 102), radius=5, fill=color)
d.text((x + 120, 84), "A TWO-PLAYER POLITICAL CARD GAME", font=font("seguisb.ttf", 22), fill=(200, 200, 205))
title = font("segoeuib.ttf", 112)
d.text((x - 4, 140), "Pax", font=title, fill=(245, 245, 247))
# Brass gradient for "Corruption".
word = "Corruption"
box = d.textbbox((0, 0), word, font=title)
tw, th = box[2] - box[0], box[3] - box[1] + 30
grad = Image.new("RGBA", (tw + 10, th + 40))
gd = ImageDraw.Draw(grad)
for gx in range(grad.width):
    t = gx / grad.width
    c = tuple(int(BRASS_LIGHT[k] + (BRASS[k] - BRASS_LIGHT[k]) * t) for k in range(3))
    gd.line((gx, 0, gx, grad.height), fill=(*c, 255))
mask = Image.new("L", grad.size, 0)
ImageDraw.Draw(mask).text((-box[0], -box[1] + 10), word, font=title, fill=255)
og.paste(grad, (x - 4 + box[0], 262 + box[1] - 10), mask)
body = font("segoeui.ttf", 32)
d.text((x, 420), "Play free in your browser:", font=body, fill=(214, 211, 209))
d.text((x, 462), "pass-and-play or online with a friend.", font=body, fill=(214, 211, 209))
d.text((x, 540), "pax-corruption-game.vercel.app", font=font("seguisb.ttf", 24), fill=BRASS)
og.convert("RGB").save(os.path.join(app, "opengraph-image.jpg"), quality=86, optimize=True, progressive=True)
og.convert("RGB").save(os.path.join(app, "twitter-image.jpg"), quality=86, optimize=True, progressive=True)
alt = "Pax Corruption: a two-player political card game. Play free in your browser, pass-and-play or online with a friend."
for name in ("opengraph-image.alt.txt", "twitter-image.alt.txt"):
    open(os.path.join(app, name), "w", encoding="utf-8").write(alt)
print("ok", os.path.getsize(os.path.join(app, "opengraph-image.jpg")))
