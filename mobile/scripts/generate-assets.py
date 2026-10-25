"""Regenerates launcher icons + splash for the Android app from ../public/icon-512.png.
Run:  python3 scripts/generate-assets.py   (needs Pillow)
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "..", "public", "icon-512.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
GREEN = (15, 100, 16)

src = Image.open(SRC).convert("RGB")
# Crop the white glyph (everything that isn't the green background)
px = src.load()
w, h = src.size
xs, ys = [], []
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        if r > 150 and g > 150 and b > 150:
            xs.append(x); ys.append(y)
glyph = src.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1)).convert("RGBA")
# Turn the glyph into white-on-transparent so it can sit on any background
glyph = glyph.convert("RGB")
alpha = glyph.split()[0].point(lambda v: max(0, min(255, int((v - 15) * 255 / 240))))
white = Image.new("RGBA", glyph.size, (255, 255, 255, 255))
white.putalpha(alpha)
glyph = white

def compose(size, glyph_ratio, bg=GREEN, transparent=False):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0) if transparent else bg + (255,))
    gw, gh = glyph.size
    scale = size * glyph_ratio / max(gw, gh)
    g = glyph.resize((max(1, int(gw * scale)), max(1, int(gh * scale))), Image.LANCZOS)
    canvas.alpha_composite(g, ((size - g.width) // 2, (size - g.height) // 2))
    return canvas

# Legacy launcher icons (square + round)
legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for d, px_ in legacy.items():
    out = os.path.join(RES, f"mipmap-{d}")
    os.makedirs(out, exist_ok=True)
    sq = compose(px_, 0.60)
    sq.convert("RGB").save(os.path.join(out, "ic_launcher.png"))
    # round
    from PIL import ImageDraw
    mask = Image.new("L", (px_ * 4, px_ * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, px_ * 4 - 1, px_ * 4 - 1), fill=255)
    mask = mask.resize((px_, px_), Image.LANCZOS)
    rd = sq.copy(); rd.putalpha(mask)
    rd.save(os.path.join(out, "ic_launcher_round.png"))
    # adaptive foreground: 108dp canvas, glyph inside 66dp safe zone
    fg_px = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}[d]
    compose(fg_px, 0.42, transparent=True).save(os.path.join(out, "ic_launcher_foreground.png"))

# Adaptive icon definitions
any26 = os.path.join(RES, "mipmap-anydpi-v26")
os.makedirs(any26, exist_ok=True)
xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
for n in ("ic_launcher.xml", "ic_launcher_round.xml"):
    open(os.path.join(any26, n), "w").write(xml)

vals = os.path.join(RES, "values")
os.makedirs(vals, exist_ok=True)
open(os.path.join(vals, "ic_launcher_background.xml"), "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F6410</color>\n</resources>\n')

# Splash (all drawable* splash.png): green with centred glyph
splash_sizes = {
    "drawable": (480, 320),
    "drawable-land-mdpi": (480, 320), "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720), "drawable-land-xxhdpi": (1600, 960), "drawable-land-xxxhdpi": (1920, 1280),
    "drawable-port-mdpi": (320, 480), "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280), "drawable-port-xxhdpi": (960, 1600), "drawable-port-xxxhdpi": (1280, 1920),
}
for d, (sw, sh) in splash_sizes.items():
    folder = os.path.join(RES, d)
    os.makedirs(folder, exist_ok=True)
    c = Image.new("RGBA", (sw, sh), GREEN + (255,))
    gh_target = int(min(sw, sh) * 0.28)
    scale = gh_target / max(glyph.size)
    g = glyph.resize((int(glyph.width * scale), int(glyph.height * scale)), Image.LANCZOS)
    c.alpha_composite(g, ((sw - g.width) // 2, (sh - g.height) // 2))
    c.convert("RGB").save(os.path.join(folder, "splash.png"))

# Web (PWA) maskable icons
PUB = os.path.join(ROOT, "..", "public")
for s in (192, 512):
    compose(s, 0.52).convert("RGB").save(os.path.join(PUB, f"icon-maskable-{s}.png"))
# Offline page logo
compose(192, 0.60).convert("RGB").save(os.path.join(ROOT, "www", "icon.png"))
print("assets generated")
