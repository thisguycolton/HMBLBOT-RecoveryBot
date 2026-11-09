#!/usr/bin/env python3
"""Draws the demo kit's pictures with Pillow: a logo and a cover for each fake group and a
cartoon avatar for each fake member. Everything is drawn from code, so there is no stock art
or real person in any of it. Run by `bin/rails demo:seed`; output goes to tmp/demo_assets/.

    python3 script/demo/make_images.py tmp/demo_assets
"""
import json, math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SS = 3  # draw at 3x and shrink, for smooth edges


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def gradient(w, h, top, bottom, diagonal=True):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = ((x / w) * 0.6 + (y / h) * 0.4) if diagonal else y / h
            px[x, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img


# ---------- logos: a rounded badge with a simple symbol ----------

def symbol(d, kind, cx, cy, r, fg, acc):
    if kind == "sun":
        for i in range(12):
            a = i * math.pi / 6
            d.line([cx + math.cos(a) * r * .62, cy + math.sin(a) * r * .62, cx + math.cos(a) * r * .95, cy + math.sin(a) * r * .95], fill=fg, width=int(r * .09))
        d.ellipse([cx - r * .45, cy - r * .45, cx + r * .45, cy + r * .45], fill=fg)
    elif kind == "moon":
        d.ellipse([cx - r * .6, cy - r * .6, cx + r * .6, cy + r * .6], fill=fg)
        d.ellipse([cx - r * .25, cy - r * .75, cx + r * .85, cy + r * .45], fill=acc)
        for sx, sy, s in ((.55, -.45, .08), (.2, .55, .06), (.75, .1, .05)):
            d.ellipse([cx + r * sx - r * s, cy + r * sy - r * s, cx + r * sx + r * s, cy + r * sy + r * s], fill=fg)
    elif kind == "book":
        d.polygon([(cx, cy - r * .35), (cx - r * .8, cy - r * .55), (cx - r * .8, cy + r * .45), (cx, cy + r * .65)], fill=fg)
        d.polygon([(cx, cy - r * .35), (cx + r * .8, cy - r * .55), (cx + r * .8, cy + r * .45), (cx, cy + r * .65)], fill=shade(fg, .85))
        d.line([cx, cy - r * .35, cx, cy + r * .65], fill=acc, width=int(r * .06))
    elif kind == "rose":
        for i in range(6):
            a = i * math.pi / 3
            x, y = cx + math.cos(a) * r * .42, cy + math.sin(a) * r * .42
            d.ellipse([x - r * .3, y - r * .3, x + r * .3, y + r * .3], fill=fg)
        d.ellipse([cx - r * .28, cy - r * .28, cx + r * .28, cy + r * .28], fill=acc)
    elif kind == "pine":
        for i, (w, y) in enumerate(((.7, -.55), (.55, -.15), (.4, .25))):
            d.polygon([(cx, cy + r * (y - .45)), (cx - r * w, cy + r * (y + .3)), (cx + r * w, cy + r * (y + .3))], fill=fg)
        d.rectangle([cx - r * .08, cy + r * .5, cx + r * .08, cy + r * .75], fill=fg)
    elif kind == "lighthouse":
        d.polygon([(cx - r * .3, cy + r * .75), (cx + r * .3, cy + r * .75), (cx + r * .18, cy - r * .35), (cx - r * .18, cy - r * .35)], fill=fg)
        d.rectangle([cx - r * .24, cy - r * .55, cx + r * .24, cy - r * .35], fill=acc)
        d.polygon([(cx - r * .28, cy - r * .55), (cx + r * .28, cy - r * .55), (cx, cy - r * .85)], fill=fg)
        for sgn in (-1, 1):
            d.polygon([(cx + sgn * r * .26, cy - r * .45), (cx + sgn * r * .95, cy - r * .7), (cx + sgn * r * .95, cy - r * .2)], fill=acc)
    elif kind == "star":
        pts = []
        for i in range(10):
            rr = r * (.85 if i % 2 == 0 else .38)
            a = -math.pi / 2 + i * math.pi / 5
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        d.polygon(pts, fill=fg)
    elif kind == "steps":
        for i in range(4):
            d.rectangle([cx - r * .75 + i * r * .38, cy + r * (.6 - i * .35), cx - r * .37 + i * r * .38, cy + r * .75], fill=fg if i % 2 == 0 else acc)


def logo(spec, path):
    n = 512 * SS
    bg, fg, acc = hexrgb(spec["a"]), (255, 255, 255), hexrgb(spec["b"])
    img = gradient(n, n, bg, acc, diagonal=True).convert("RGBA")
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n, n], radius=n // 5, fill=255)
    img.putalpha(mask)
    d = ImageDraw.Draw(img)
    d.ellipse([n * .08, n * .08, n * .92, n * .92], outline=(255, 255, 255, 150), width=int(n * .012))
    symbol(d, spec["symbol"], n / 2, n * .46, n * .30, fg, shade(bg, .9))
    f = font(int(n * .075))
    text = spec["short"].upper()
    w = d.textlength(text, font=f)
    d.text(((n - w) / 2, n * .78), text, font=f, fill=(255, 255, 255, 235))
    img.resize((512, 512), Image.LANCZOS).save(path)


# ---------- covers: a wide gradient scene ----------

def cover(spec, path):
    w, h = 1800 * 1, 560
    W, H = w * 2, h * 2
    a, b = hexrgb(spec["a"]), hexrgb(spec["b"])
    img = gradient(W, H, shade(a, 1.1), shade(b, .9)).convert("RGBA")
    rnd = random.Random(spec["short"])
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    scene = spec["scene"]
    if scene == "sunrise":
        d.ellipse([W * .62, H * .35, W * .62 + 520, H * .35 + 520], fill=(255, 236, 170, 235))
        for i, k in enumerate((.72, .82, .92)):
            pts = [(0, H)]
            for x in range(0, W + 80, 80):
                pts.append((x, H * k + math.sin(x / 260 + i * 2) * 50))
            pts.append((W, H))
            d.polygon(pts, fill=(*shade(b, .55 + i * .12), 255))
    elif scene == "night":
        for _ in range(90):
            x, y, s = rnd.randint(0, W), rnd.randint(0, int(H * .7)), rnd.randint(3, 9)
            d.ellipse([x, y, x + s, y + s], fill=(255, 255, 255, rnd.randint(120, 255)))
        d.ellipse([W * .75, H * .12, W * .75 + 260, H * .12 + 260], fill=(255, 247, 214, 255))
        d.ellipse([W * .75 + 70, H * .12 - 30, W * .75 + 330, H * .12 + 230], fill=(*shade(a, .8), 255))
        pts = [(0, H), (0, H * .85)] + [(x, H * .86 + math.sin(x / 400) * 40) for x in range(0, W + 100, 100)] + [(W, H)]
        d.polygon(pts, fill=(*shade(b, .4), 255))
    elif scene == "lake":
        d.rectangle([0, H * .6, W, H], fill=(*shade(b, 1.0), 255))
        for i in range(14):
            y = H * .62 + i * 34
            d.line([(W * .1 + (i % 3) * 120, y), (W * .9 - (i % 4) * 140, y)], fill=(255, 255, 255, 60), width=6)
        for x in range(0, W, 190):
            hh = rnd.randint(160, 340)
            d.polygon([(x, H * .6), (x + 95, H * .6 - hh), (x + 190, H * .6)], fill=(*shade(a, .55), 255))
    elif scene == "desert":
        d.ellipse([W * .15, H * .2, W * .15 + 380, H * .2 + 380], fill=(255, 220, 160, 230))
        for i, k in enumerate((.78, .88)):
            pts = [(0, H)] + [(x, H * k + math.sin(x / 340 + i * 1.7) * 60) for x in range(0, W + 90, 90)] + [(W, H)]
            d.polygon(pts, fill=(*shade(b, .6 + i * .15), 255))
        for x, s in ((W * .55, 1.0), (W * .8, 1.4)):
            c = (*shade(a, .45), 255)
            d.rounded_rectangle([x, H * .5, x + 46 * s, H * .9], radius=22, fill=c)
            d.rounded_rectangle([x - 55 * s, H * .6, x - 20 * s, H * .72], radius=16, fill=c)
            d.rounded_rectangle([x + 66 * s, H * .55, x + 100 * s, H * .68], radius=16, fill=c)
    elif scene == "pines":
        for x in range(-40, W, 150):
            hh = rnd.randint(300, 520)
            for t in range(4):
                top = H - hh + t * hh * .2
                d.polygon([(x + 75, top), (x + 75 - 70 + t * 4, top + hh * .34), (x + 75 + 70 - t * 4, top + hh * .34)], fill=(*shade(b, .5 + t * .04), 255))
    elif scene == "harbor":
        d.rectangle([0, H * .68, W, H], fill=(*shade(b, .75), 255))
        for i in range(10):
            y = H * .7 + i * 36
            d.arc([W * .05 + i * 90, y, W * .05 + i * 90 + 300, y + 40], 0, 180, fill=(255, 255, 255, 70), width=5)
        d.polygon([(W * .8, H * .68), (W * .8 + 70, H * .68), (W * .8 + 52, H * .15), (W * .8 + 18, H * .15)], fill=(255, 255, 255, 235))
        d.rectangle([W * .8 + 10, H * .08, W * .8 + 60, H * .15], fill=(255, 220, 120, 255))
        d.polygon([(W * .8 + 60, H * .1), (W * .8 + 900, H * .0), (W * .8 + 900, H * .22)], fill=(255, 240, 180, 70))
    elif scene == "city":
        for x in range(0, W, 110):
            hh = rnd.randint(180, 460)
            d.rectangle([x, H - hh, x + 100, H], fill=(*shade(a, .45), 255))
            for wy in range(int(H - hh + 20), H - 20, 44):
                for wx in (x + 16, x + 52):
                    if rnd.random() > .35:
                        d.rectangle([wx, wy, wx + 20, wy + 24], fill=(255, 228, 140, 255))
    elif scene == "hill":
        d.polygon([(0, H), (0, H * .75)] + [(x, H * .55 + math.sin(x / 500) * 120) for x in range(0, W + 100, 100)] + [(W, H)], fill=(*shade(b, .65), 255))
        for i in range(8):
            x = 200 + i * 210
            d.line([(x, H), (x + 40 * (i % 3 - 1), H * .75)], fill=(255, 255, 255, 120), width=14)
    img = Image.alpha_composite(img, layer)
    img = img.filter(ImageFilter.GaussianBlur(1.2)).resize((w, h), Image.LANCZOS).convert("RGB")
    img.save(path, quality=88)


# ---------- avatars: cartoon faces ----------

SKIN = ["#f6d3b5", "#e8b48a", "#c98d62", "#9a6340", "#6e4429", "#f2c9a0"]
HAIR = ["#2b2118", "#5a3a22", "#a55a2a", "#d8a84a", "#c8c8c8", "#1b1b1f", "#7a3b2e"]
BGS = ["#ffd6a5", "#caffbf", "#9bf6ff", "#bdb2ff", "#ffc6ff", "#fdffb6", "#ffadad", "#a0c4ff"]
SHIRT = ["#e76f51", "#2a9d8f", "#264653", "#f4a261", "#6d597a", "#457b9d", "#e5989b", "#588157"]


def avatar(seed, path, hair_style, beard, glasses):
    rnd = random.Random(seed)
    n = 512 * SS
    skin, hair = hexrgb(rnd.choice(SKIN)), hexrgb(rnd.choice(HAIR))
    img = Image.new("RGB", (n, n), hexrgb(rnd.choice(BGS)))
    d = ImageDraw.Draw(img)
    cx, cy = n / 2, n * .52
    shirt = hexrgb(rnd.choice(SHIRT))
    d.ellipse([cx - n * .42, n * .78, cx + n * .42, n * 1.3], fill=shirt)
    d.rectangle([cx - n * .07, n * .66, cx + n * .07, n * .8], fill=shade(skin, .92))
    if hair_style in ("long", "bob"):
        d.rounded_rectangle([cx - n * .27, cy - n * .30, cx + n * .27, cy + (n * .30 if hair_style == "long" else n * .12)], radius=int(n * .12), fill=hair)
    d.ellipse([cx - n * .035 - n * .27, cy - n * .03, cx - n * .035 - n * .2, cy + n * .06], fill=skin)  # ears
    d.ellipse([cx + n * .2 + n * .035, cy - n * .03, cx + n * .27 + n * .035, cy + n * .06], fill=skin)
    d.ellipse([cx - n * .23, cy - n * .27, cx + n * .23, cy + n * .25], fill=skin)  # head
    # hair on top
    if hair_style == "short":
        d.pieslice([cx - n * .25, cy - n * .31, cx + n * .25, cy + n * .1], 180, 360, fill=hair)
    elif hair_style == "curly":
        for i in range(9):
            a = math.pi + i * math.pi / 8
            x, y = cx + math.cos(a) * n * .22, cy - n * .06 + math.sin(a) * n * .24
            d.ellipse([x - n * .08, y - n * .08, x + n * .08, y + n * .08], fill=hair)
    elif hair_style in ("long", "bob"):
        d.pieslice([cx - n * .25, cy - n * .31, cx + n * .25, cy + n * .12], 180, 360, fill=hair)
    elif hair_style == "bun":
        d.pieslice([cx - n * .25, cy - n * .31, cx + n * .25, cy + n * .1], 180, 360, fill=hair)
        d.ellipse([cx - n * .08, cy - n * .42, cx + n * .08, cy - n * .27], fill=hair)
    elif hair_style == "bald":
        pass
    elif hair_style == "cap":
        d.pieslice([cx - n * .25, cy - n * .31, cx + n * .25, cy + n * .08], 180, 360, fill=shirt)
        d.rounded_rectangle([cx - n * .27, cy - n * .08, cx + n * .12, cy - n * .04], radius=10, fill=shade(shirt, .8))
    # face
    ey = cy - n * .02
    for sx in (-1, 1):
        ex = cx + sx * n * .085
        d.ellipse([ex - n * .035, ey - n * .04, ex + n * .035, ey + n * .04], fill=(255, 255, 255))
        d.ellipse([ex - n * .018, ey - n * .02, ex + n * .018, ey + n * .02], fill=(35, 30, 30))
        d.line([ex - n * .045, ey - n * .075, ex + n * .045, ey - n * .08 - sx * n * .004], fill=hair if hair_style != "bald" else shade(skin, .6), width=int(n * .014))
    for sx in (-1, 1):
        d.ellipse([cx + sx * n * .15 - n * .03, cy + n * .06, cx + sx * n * .15 + n * .03, cy + n * .1], fill=(*shade(skin, 1.0)[:2], 140))
    d.arc([cx - n * .09, cy + n * .03, cx + n * .09, cy + n * .15], 15, 165, fill=(120, 50, 50), width=int(n * .013))
    d.ellipse([cx - n * .014, cy + n * .03, cx + n * .014, cy + n * .06], fill=shade(skin, .85))  # nose
    if beard:
        d.pieslice([cx - n * .21, cy - n * .02, cx + n * .21, cy + n * .26], 0, 180, fill=hair)
        d.arc([cx - n * .09, cy + n * .06, cx + n * .09, cy + n * .17], 15, 165, fill=(235, 170, 170), width=int(n * .014))
    if glasses:
        for sx in (-1, 1):
            ex = cx + sx * n * .085
            d.ellipse([ex - n * .06, ey - n * .055, ex + n * .06, ey + n * .055], outline=(40, 40, 50), width=int(n * .01))
        d.line([cx - n * .025, ey, cx + n * .025, ey], fill=(40, 40, 50), width=int(n * .01))
    img.resize((512, 512), Image.LANCZOS).save(path, quality=90)


def main(out):
    spec = json.load(open(os.path.join(out, "spec.json")))
    for g in spec["groups"]:
        logo(g, os.path.join(out, f"logo-{g['slug']}.png"))
        cover(g, os.path.join(out, f"cover-{g['slug']}.jpg"))
    for u in spec["people"]:
        avatar(u["username"], os.path.join(out, f"avatar-{u['username']}.jpg"), u["hair"], u["beard"], u["glasses"])
    print(f"drew {len(spec['groups'])} logos + covers and {len(spec['people'])} avatars in {out}")


if __name__ == "__main__":
    main(sys.argv[1])
