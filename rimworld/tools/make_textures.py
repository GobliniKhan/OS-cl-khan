"""Generate the small PNG textures for the ATLA Four Nations RimWorld mod.

Textures are kept at 64x64 (preview 256x256) so the mod stays light on the
integrated Intel HD 5000 GPU of an early-2014 Mac. Requires Pillow.

    python rimworld/tools/make_textures.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ATLA_FourNations")
TEX = os.path.join(ROOT, "Textures", "ATLA")
S = 64


def canvas(size=S):
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))


def glow_orb(inner, outer, size=S, radius=0.42, seed=0):
    """Soft radial orb, bright in the middle."""
    img = canvas(size)
    px = img.load()
    c = (size - 1) / 2
    r = size * radius
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c) / r
            if d > 1:
                continue
            t = d ** 1.4
            col = tuple(int(inner[i] * (1 - t) + outer[i] * t) for i in range(3))
            a = int(255 * (1 - d ** 3))
            px[x, y] = col + (a,)
    return img


def supersampled(draw_fn, size=S, factor=4):
    """Draw at higher resolution then downscale for smooth edges."""
    big = draw_fn(size * factor)
    return big.resize((size, size), Image.LANCZOS)


def flame(size=S, seed=1):
    def draw(n):
        img = canvas(n)
        d = ImageDraw.Draw(img)
        cx, base = n / 2, n * 0.63
        layers = [((190, 35, 10), 0.30), ((240, 110, 20), 0.23), ((255, 195, 60), 0.16), ((255, 245, 210), 0.08)]
        for col, w in layers:
            r = n * w
            pts = []
            for i in range(80):
                t = 2 * math.pi * i / 80
                x = r * math.sin(t) * math.sin(t / 2) ** 1.3
                y = -r * math.cos(t) * 1.25
                pts.append((cx + x, base - r * 0.25 + y - (r * 0.35 if math.cos(t) > 0 else 0)))
            d.polygon(pts, fill=col + (240,))
        return img.filter(ImageFilter.GaussianBlur(n / 120))
    return supersampled(draw, size)


def water_swirl(size=S):
    img = glow_orb((220, 245, 255), (30, 110, 210), size, 0.40)
    d = ImageDraw.Draw(img)
    c = size / 2
    for k in range(3):
        pts = []
        for i in range(40):
            t = i / 39
            a = t * math.pi * 1.6 + k * 2.1
            r = size * (0.08 + 0.32 * t)
            pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
        d.line(pts, fill=(240, 252, 255, 230), width=3)
    return img


def air_swirl(size=S):
    img = canvas(size)
    d = ImageDraw.Draw(img)
    c = size / 2
    for k in range(4):
        pts = []
        for i in range(50):
            t = i / 49
            a = t * math.pi * 2.2 + k * math.pi / 2
            r = size * (0.04 + 0.38 * t)
            pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
        d.line(pts, fill=(235, 240, 230, 210), width=3)
    return img.filter(ImageFilter.GaussianBlur(0.6))


def boulder(size=S, seed=3):
    return supersampled(lambda n: _boulder(n, seed), size)


def _boulder(size, seed):
    random.seed(seed)
    img = canvas(size)
    d = ImageDraw.Draw(img)
    c = size / 2
    pts = []
    for i in range(9):
        a = 2 * math.pi * i / 9
        r = size * random.uniform(0.32, 0.42)
        pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
    d.polygon(pts, fill=(110, 90, 60, 255), outline=(60, 45, 30, 255), width=max(1, size // 64))
    for _ in range(6):
        k = size / 64
        x, y = c + random.uniform(-14, 14) * k, c + random.uniform(-14, 14) * k
        d.line([(x, y), (x + random.uniform(-8, 8) * k, y + random.uniform(-8, 8) * k)], fill=(70, 55, 35, 255), width=int(2 * k))
    d.polygon([pts[6], pts[7], (c, c)], fill=(140, 120, 85, 255))
    return img


def lightning(size=S, seed=5):
    random.seed(seed)
    img = canvas(size)
    d = ImageDraw.Draw(img)
    pts = [(4, size / 2)]
    x = 4
    while x < size - 6:
        x += random.randint(6, 10)
        pts.append((x, size / 2 + random.randint(-9, 9)))
    d.line(pts, fill=(120, 170, 255, 200), width=6)
    d.line(pts, fill=(235, 245, 255, 255), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.5))


def glider_staff(size=S):
    img = canvas(size)
    d = ImageDraw.Draw(img)
    y = size / 2
    d.line([(2, y), (size - 4, y)], fill=(150, 95, 45, 255), width=4)
    d.line([(2, y - 1), (size - 4, y - 1)], fill=(190, 130, 70, 255), width=1)
    # folded orange wings
    d.polygon([(size * 0.55, y - 2), (size - 6, y - 9), (size - 6, y - 2)], fill=(235, 140, 30, 255))
    d.polygon([(size * 0.55, y + 2), (size - 6, y + 9), (size - 6, y + 2)], fill=(250, 200, 60, 255))
    d.rectangle([(4, y - 3), (9, y + 3)], fill=(120, 70, 30, 255))
    return img


def avatar_orb(size=S):
    img = canvas(size)
    c = size / 2
    q = [((235, 90, 30), (-1, -1)), ((60, 140, 230), (1, -1)), ((110, 160, 70), (-1, 1)), ((235, 225, 190), (1, 1))]
    for col, (sx, sy) in q:
        o = glow_orb(tuple(min(255, v + 60) for v in col), col, size // 2, 0.46)
        img.alpha_composite(o, (int(c + sx * size / 4 - size / 4), int(c + sy * size / 4 - size / 4)))
    core = glow_orb((255, 255, 255), (170, 230, 255), size, 0.2)
    img.alpha_composite(core)
    return img


def spirit_water(size=S):
    img = canvas(size)
    d = ImageDraw.Draw(img)
    # gourd flask
    d.ellipse([(16, 26), (48, 60)], fill=(170, 120, 60, 255), outline=(90, 60, 30, 255))
    d.ellipse([(22, 10), (42, 32)], fill=(170, 120, 60, 255), outline=(90, 60, 30, 255))
    d.rectangle([(28, 4), (36, 12)], fill=(120, 80, 40, 255))
    glow = glow_orb((230, 250, 255), (60, 160, 240), 26, 0.45)
    img.alpha_composite(glow, (19, 31))
    return img


def preview():
    big = Image.new("RGBA", (512, 512), (22, 24, 34, 255))
    d = ImageDraw.Draw(big)
    for r, col in [(240, (45, 40, 60)), (200, (35, 35, 50))]:
        d.ellipse([(256 - r, 256 - r), (256 + r, 256 + r)], fill=col + (255,))
    icons = [
        (flame(), (256, 70)),
        (water_swirl(), (70, 256)),
        (boulder(), (256, 442)),
        (air_swirl(), (442, 256)),
    ]
    for ic, (x, y) in icons:
        ic = ic.resize((150, 150), Image.LANCZOS)
        big.alpha_composite(ic, (x - 75, y - 75))
    a = avatar_orb().resize((170, 170), Image.LANCZOS)
    big.alpha_composite(a, (256 - 85, 256 - 85))
    return big.convert("RGB")


def save(img, *parts):
    path = os.path.join(TEX, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


def main():
    # Bending forms (equipped "weapons")
    save(flame(), "Weapons", "FireForms.png")
    save(water_swirl(), "Weapons", "WaterForms.png")
    save(boulder(seed=7), "Weapons", "EarthForms.png")
    save(glider_staff(), "Weapons", "GliderStaff.png")
    save(lightning(), "Weapons", "LightningForms.png")
    save(avatar_orb(), "Weapons", "AvatarState.png")
    # Projectiles
    save(glow_orb((255, 245, 180), (230, 80, 20)), "Projectiles", "Fireblast.png")
    save(glow_orb((235, 250, 255), (40, 120, 220)), "Projectiles", "WaterWhip.png")
    save(boulder(seed=11), "Projectiles", "Boulder.png")
    save(air_swirl(), "Projectiles", "AirBlast.png")
    save(lightning(seed=9), "Projectiles", "Lightning.png")
    save(avatar_orb(), "Projectiles", "AvatarBlast.png")
    # Items
    save(spirit_water(), "Items", "SpiritWater.png")
    # Mod preview
    os.makedirs(os.path.join(ROOT, "About"), exist_ok=True)
    preview().save(os.path.join(ROOT, "About", "Preview.png"), optimize=True)


if __name__ == "__main__":
    main()
