#!/usr/bin/env python3
"""Build the Acid Quest supplement tiles that the ClassicRPG sheet doesn't have.

Everything is drawn from the ClassicRPG palette (and, where possible, from pieces of
existing ClassicRPG tiles) so the additions match the original art.

Outputs, next to the source sheet:
  classic_rpg_extra.png   16x16 tiles, 16 per row
  classic_rpg_extra.json  { tile name: frame index }
  icons/icon_*.png        white 16x16 item icons in the style of app/assets/images/icons

Usage: python3 script/quest/build_extra_tiles.py   (standard library only)
"""
import json
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, "app", "javascript", "quest", "assets")
SHEET = os.path.join(ASSETS, "classic_rpg.png")

# ClassicRPG palette
PAL = {
    ".": None,
    "g": "82aa28", "G": "597f1e", "l": "c3d442", "t": "376129",
    "d": "d69a4e", "b": "945848", "B": "5c3841", "y": "f3d040",
    "w": "22636b", "m": "1f9983", "c": "7cd8eb",
    "s": "b9b5c3", "S": "76747d", "D": "57546f",
    "W": "f2f2f0", "k": "23213d",
    "r": "d17f6b", "q": "f1c28f",
}


def rgba(ch):
    h = PAL[ch]
    return (0, 0, 0, 0) if h is None else (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


# ---------- PNG io ----------

def load_png(path):
    data = open(path, "rb").read()
    i, idat = 8, b""
    while i < len(data):
        length = struct.unpack(">I", data[i:i + 4])[0]
        kind, chunk = data[i + 4:i + 8], data[i + 8:i + 8 + length]
        if kind == b"IHDR":
            w, h, depth, color = struct.unpack(">IIBB", chunk[:10])
            assert depth == 8 and color == 6, "expected 8-bit RGBA"
        elif kind == b"IDAT":
            idat += chunk
        i += 12 + length
    raw, stride, rows, prev, p = zlib.decompress(idat), w * 4, [], bytearray(w * 4), 0
    for _ in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        for x in range(stride):
            a = line[x - 4] if x >= 4 else 0
            b, c = prev[x], (prev[x - 4] if x >= 4 else 0)
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                pp = a + b - c
                pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line); prev = line
    return w, h, rows


def save_png(path, w, h, pixel):
    raw = b"".join(b"\x00" + bytes(v for x in range(w) for v in pixel(x, y)) for y in range(h))
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)


# ---------- tile helpers (a tile is a 16x16 list of RGBA tuples) ----------

_, _, SRC = load_png(SHEET)


def frame(n):
    return [[tuple(SRC[y][(n * 16 + x) * 4:(n * 16 + x) * 4 + 4]) for x in range(16)] for y in range(16)]


def blank():
    return [[(0, 0, 0, 0)] * 16 for _ in range(16)]


def art(rows):
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), rows
    return [[rgba(ch) for ch in r] for r in rows]


def over(base, top):
    return [[top[y][x] if top[y][x][3] else base[y][x] for x in range(16)] for y in range(16)]


def rot(t, turns=1):
    """Rotate clockwise by 90 degrees `turns` times."""
    for _ in range(turns % 4):
        t = [[t[15 - x][y] for x in range(16)] for y in range(16)]
    return t


def is_green(px):
    return px[3] and px[1] > px[0] + 20


# The grass fringe along the top of dirt tile 69, reused for every grassy edge
FRINGE = [[is_green(frame(69)[y][x]) for x in range(16)] for y in range(3)]


def top_edge(fill_row0=True, shade=None):
    """Transparent tile with a grass fringe along the top edge."""
    t = blank()
    for x in range(16):
        if fill_row0:
            t[0][x] = rgba("g")
        for y in range(3):
            if FRINGE[y][x]:
                t[y + (1 if fill_row0 else 0)][x] = rgba("g")
        if shade and not FRINGE[0][x]:
            t[1 if fill_row0 else 0][x] = rgba(shade)
    return t


# ---------- tiles ----------

tiles = {}


def add(name, t):
    tiles[name] = t


# Shorelines: water with grass edges on the land sides. Mask bits N=1 E=2 S=4 W=8.
# The top edge is drawn once and rotated for the other sides.
water = {"a": frame(13), "b": frame(14)}
edge = top_edge(shade="w")
for mask in range(16):
    for f, base in water.items():
        t = base
        for bit, turns in ((1, 0), (2, 1), (4, 2), (8, 3)):
            if mask & bit:
                t = over(t, rot(edge, turns))
        add(f"shore_{mask}_{f}", t)

# Inner corners: a small clump of grass where only the diagonal neighbour is land.
# Mask bits NE=1 SE=2 SW=4 NW=8.
clump = art(["ggg." + "." * 12, "gg.." + "." * 12, "g..." + "." * 12] + ["." * 16] * 13)
for mask in range(1, 16):
    t = blank()
    for bit, turns in ((8, 0), (1, 1), (2, 2), (4, 3)):
        if mask & bit:
            t = over(t, rot(clump, turns))
    add(f"shorecorner_{mask}", t)

# Plateau edges on the north, east and west sides of higher ground (south uses the
# ClassicRPG cliff lip). A dark rim with a shaded band inside. Bits N=1 E=2 W=4.
rim = art(["BBBBBBBBBBBBBBBB", "GGGGGGGGGGGGGGGG", "G.G..G.G..G..G.G"] + ["." * 16] * 13)
for mask in range(1, 8):
    t = blank()
    for bit, turns in ((1, 0), (2, 1), (4, 3)):
        if mask & bit:
            t = over(t, rot(rim, turns))
    add(f"cliffedge_{mask}", t)

stairs_v = art([
    "DDsssssssssssDDk",
    "DDSSSSSSSSSSSDDk",
    "DDDDDDDDDDDDDDDk",
    "DDsssssssssssDDk",
    "DDSSSSSSSSSSSDDk",
    "DDDDDDDDDDDDDDDk",
    "DDsssssssssssDDk",
    "DDSSSSSSSSSSSDDk",
    "DDDDDDDDDDDDDDDk",
    "DDsssssssssssDDk",
    "DDSSSSSSSSSSSDDk",
    "DDDDDDDDDDDDDDDk",
    "DDsssssssssssDDk",
    "DDSSSSSSSSSSSDDk",
    "DDDDDDDDDDDDDDDk",
    "DDsssssssssssDDk",
])
add("stairs_v", stairs_v)
add("stairs_h", rot(stairs_v))

ladder_v = art([
    "..Bb........bB..",
    "..Bb........bB..",
    "..BbyyyyyyyybB..",
    "..BbddddddddbB..",
    "..Bb........bB..",
    "..Bb........bB..",
    "..BbyyyyyyyybB..",
    "..BbddddddddbB..",
    "..Bb........bB..",
    "..Bb........bB..",
    "..BbyyyyyyyybB..",
    "..BbddddddddbB..",
    "..Bb........bB..",
    "..Bb........bB..",
    "..BbyyyyyyyybB..",
    "..BbddddddddbB..",
])
add("ladder_v", ladder_v)
add("ladder_h", rot(ladder_v))

bridge_v = art([
    "BbyyyyyyyyyyyybB",
    "BbddddddddddddbB",
    "BbbbbbbbbbbbbbbB",
    "BbyyyyyyyyyyyybB",
    "BbddddddddddddbB",
    "BbbbbbbbbbbbbbbB",
    "BbyyyyyyyyyyyybB",
    "BbddddddddddddbB",
    "BbbbbbbbbbbbbbbB",
    "BbyyyyyyyyyyyybB",
    "BbddddddddddddbB",
    "BbbbbbbbbbbbbbbB",
    "BbyyyyyyyyyyyybB",
    "BbddddddddddddbB",
    "BbbbbbbbbbbbbbbB",
    "BbyyyyyyyyyyyybB",
])
add("bridge_v", bridge_v)
add("bridge_h", rot(bridge_v))

# A fallen tree lying across the path (path runs vertically for _v)
log_v = art([
    "................",
    "................",
    "....tG..........",
    "...tGGt.........",
    "..BBBBBBBBBBBB..",
    ".BbbbBbbbbBbbBB.",
    ".BbBbbbbBbbbByyB",
    ".BbbbbBbbbbbBydB",
    ".BbbBbbbbBbbBydB",
    ".BbbbbbBbbbbByyB",
    "..BBBBBBBBBBBBB.",
    ".......tGt......",
    "......tGGGt.....",
    "................",
    "................",
    "................",
])
add("log_v", log_v)
add("log_h", rot(log_v))

add("stump", art([
    "................",
    "................",
    "................",
    "................",
    "................",
    ".....BBBBBB.....",
    "....ByyyyyyB....",
    "....BydddyyB....",
    "....ByyyyyyB....",
    "....BbbbbbbB....",
    "....BbBbbBbB....",
    "...GBbbbbbbBG...",
    "..GgBBBBBBBBgG..",
    "...G.G....G.....",
    "................",
    "................",
]))

add("soil", art([
    "bbbbbbbbbbbbbbbb",
    "dbdddbddddbdddbd",
    "BBBBBBBBBBBBBBBB",
    "bbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbb",
    "ddbdddbdddbdddbd",
    "BBBBBBBBBBBBBBBB",
    "bbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbb",
    "dbdddbddddbdddbd",
    "BBBBBBBBBBBBBBBB",
    "bbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbb",
    "ddbdddbdddbdddbd",
    "BBBBBBBBBBBBBBBB",
    "bbbbbbbbbbbbbbbb",
]))

# Castle wall top: ClassicRPG stone with crenellations cut into it
parapet = frame(16)
for y in range(4):
    for x in list(range(4, 8)) + list(range(12, 16)):
        parapet[y][x] = (0, 0, 0, 0)
for x in range(16):
    notch = x in range(4, 8) or x in range(12, 16)
    parapet[4 if notch else 0][x] = rgba("D")
add("parapet", parapet)

# ---------- animation frames ----------

def compose(frames_grid):
    """Stitch a grid of frame numbers into one big pixel canvas."""
    h, w = len(frames_grid) * 16, len(frames_grid[0]) * 16
    canvas = [[(0, 0, 0, 0)] * w for _ in range(h)]
    for ty, row in enumerate(frames_grid):
        for tx, n in enumerate(row):
            f = frame(n)
            for y in range(16):
                for x in range(16):
                    canvas[ty * 16 + y][tx * 16 + x] = f[y][x]
    return canvas


def shift_rows(canvas, upto_row, dx):
    """Shift the top rows sideways (a breeze through the leaves); lower rows stay put."""
    w = len(canvas[0])
    out = [row[:] for row in canvas]
    for y in range(min(upto_row, len(canvas))):
        out[y] = [canvas[y][x - dx] if 0 <= x - dx < w else (0, 0, 0, 0) for x in range(w)]
    return out


def split(canvas, frames_grid):
    for ty, row in enumerate(frames_grid):
        for tx, n in enumerate(row):
            add(f"sway_{n}", [[canvas[ty * 16 + y][tx * 16 + x] for x in range(16)] for y in range(16)])


# Foliage sway: second frame of a two-frame loop. Multi-tile trees shift as one piece so
# the seams between their tiles stay closed; trunks and stems stay planted.
for grid_, rows in (([[89, 90], [104, 105]], 16 + 9), ([[91], [106]], 16 + 6)):
    split(shift_rows(compose(grid_), rows, 1), grid_)
for n, rows in ((107, 10), (108, 10), (113, 9), (114, 9), (112, 6)):
    split(shift_rows(compose([[n]]), rows, 1), [[n]])

# Campfire: three flickering flame frames over the same logs and stones
fire_base = [
    "...S........S...",
    "..SSBbbbbbbBSS..",
    "...BbBBbBBbB....",
    "....BB....BB....",
    "................",
]
fire_flames = [
    ["................", ".......y........", "......yy........", "......yry.......", ".....yrWry......",
     ".....rWWWr......", "....yrWWWry.....", "....yrWWWry.....", ".....ryyyr......", "......rrr......."],
    ["................", "........y.......", "........yy......", ".......yry......", "......yrWry.....",
     ".....yrWWWr.....", "....yrWWWWry....", "....yrWWWry.....", ".....ryyyr......", "......rrr......."],
    ["......y.........", "......yy........", ".......yy.......", "......yryy......", ".....yrWWry.....",
     ".....rWWWWr.....", "....yrWWWry.....", "....yrWWWry.....", ".....ryyyrr.....", "......rrr......."],
]
for i, flames in enumerate(fire_flames):
    add(f"campfire_{i}", art(["................"] + flames + fire_base))

# People: recolour the traveler's frames. Hair is the top of the head (the whole back of the
# head when walking away); clothes are the body rows.
SKIN, SHADE = (0xf1, 0xc2, 0x8f), (0xd1, 0x7f, 0x6b)
WALK = {"down": [1, 2, 3], "side": [20, 21, 22], "up": [52, 53, 54]}


def dress(n, hair, cloth, hat=False):
    f = frame(n)
    hair_rows = range(1, 9) if n in WALK["up"] else range(1, 4)
    out = [row[:] for row in f]
    for y in range(16):
        for x in range(16):
            px = f[y][x]
            if not px[3]:
                continue
            rgb = px[:3]
            if y in hair_rows and rgb in (SKIN, SHADE) and hair:
                out[y][x] = rgba(hair[0] if rgb == SKIN else hair[1])
            elif 10 <= y <= 14 and rgb in (SKIN, SHADE):
                out[y][x] = rgba(cloth[0] if rgb == SKIN else cloth[1])
    if hat:
        brim = ".BBBBBBBBBBBBBB."
        crown = ["....BBBBBBBB....", "....BbbbbbbB....", "....ByyyyyyB...."]
        for y, line in enumerate(crown + [brim]):
            for x, ch in enumerate(line):
                if ch != ".":
                    out[y][x] = rgba(ch)
    return out


VILLAGERS = [(("B", "B"), ("m", "w")), (("y", "d"), ("G", "t")), (("k", "k"), ("b", "B"))]
for v, (hair, cloth) in enumerate(VILLAGERS):
    for frames in WALK.values():
        for n in frames:
            add(f"villager{v}_{n}", dress(n, hair, cloth))
for n in WALK["down"]:
    add(f"merchant_{n}", dress(n, None, ("y", "d"), hat=True))

# ---------- full-colour tools (toolbar and rewards) ----------
# Legendary tools are the same shapes recoloured in gold and crystal.

TOOLS = {
    "boat": [
        "................",
        "................",
        "...B........B...",
        "....B......B....",
        ".....B....B.....",
        "..kkkkkkkkkkkk..",
        ".kddddddddddddk.",
        ".kyyyyyyyyyyyyk.",
        ".kbbbbbbbbbbbbk.",
        "..kbBbbBbbBbbk..",
        "...kbbbbbbbbk...",
        "....kkkkkkkk....",
        "..cmwmcmwmcmwm..",
        ".mwmwmwmwmwmwmw.",
        "................",
        "................",
    ],
    "pickaxe": [
        "................",
        "...kkkkkkkkk....",
        "..kWssssssssk...",
        ".ksssSkkkkSssk..",
        "kssSk..kBk.kSsk.",
        "kSSk..kbBk..kSk.",
        ".kk..kbBk....k..",
        "....kbBk........",
        "...kbBk.........",
        "..kbBk..........",
        ".kbBk...........",
        "kbBk............",
        "kBk.............",
        ".k..............",
        "................",
        "................",
    ],
    "axe": [
        "................",
        ".......kkkk.....",
        "......kWsssk....",
        ".....kWssssSk...",
        ".....kssssSSk...",
        ".....ksssSSSk...",
        "......kkBbkkk...",
        ".....kbBk.......",
        "....kbBk........",
        "...kbBk.........",
        "..kbBk..........",
        ".kbBk...........",
        "kbBk............",
        "kBk.............",
        ".k..............",
        "................",
    ],
    "rope": [
        "................",
        "....kkkkkkk.....",
        "...kddyyyddk....",
        "..kdyBBBBBydk...",
        "..kdBk...kBdk...",
        "..kdBkkkk.kdk...",
        "..kdk.kdk.kdk...",
        "..kdBkkkk.kdk...",
        "..kdyBk..kBdk...",
        "...kdyyyyydk....",
        "....kkkkkkkdk...",
        "..........kdyk..",
        "...........kdk..",
        "............kk..",
        "................",
        "................",
    ],
    "lantern": [
        "................",
        "......kkkk......",
        ".....k....k.....",
        "....kkkkkkkk....",
        "....kByyyyBk....",
        "...ckyWWWWykc...",
        "...ckyWccWykc...",
        "...ckyWccWykc...",
        "...ckyWWWWykc...",
        "....kByyyyBk....",
        "....kkkkkkkk....",
        ".....kBBBBk.....",
        "......kkkk......",
        "................",
        "................",
        "................",
    ],
}
LEGENDARY = {"b": "y", "B": "d", "d": "W", "s": "c", "S": "m", "D": "w"}

tool_art = {}
for name, rows in TOOLS.items():
    tool_art[f"tool_{name}"] = rows
    tool_art[f"tool_{name}_legendary"] = ["".join(LEGENDARY.get(ch, ch) for ch in row) for row in rows]
for name, rows in tool_art.items():
    add(name, art(rows))

# ---------- cannon and ghost ----------

cannon = [
    "................",
    "................",
    "..........kk....",
    ".........kDDk...",
    "........kSDDDk..",
    ".......kSDDDDk..",
    "......kSDDDDk...",
    ".....kSDDDDk....",
    "....kDDDDDk.....",
    "...kbBBBbbk.....",
    "..kbBkkkBbBk....",
    "..kBkSkSkBBk....",
    "..kBkkDkkBk.....",
    "...kkk.kkk......",
    "................",
    "................",
]
add("cannon", art(cannon))
smoke = [row[:] for row in cannon]
puff = {(1, 11): "W", (1, 12): "W", (0, 12): "s", (0, 13): "W", (1, 13): "s", (2, 14): "W", (0, 14): "s"}
smoke = ["".join(puff.get((y, x), ch) for x, ch in enumerate(row)) for y, row in enumerate(smoke)]
add("cannon_smoke", art(smoke))

ghost = [
    "................",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "...WWWWWWWWWW...",
    "...WWkkWWkkWW...",
    "...WWkkWWkkWW...",
    "...WWWWWWWWWW...",
    "...WWWWkkWWWW...",
    "...WWWWWWWWWW...",
    "...WcWWWWWWcW...",
    "...WWcWWWWcWW...",
    "...cWW.WW.WWc...",
    "....c...c...c...",
    "................",
    "................",
    "................",
]
add("ghost_0", art(ghost))
ghost2 = ghost[:11] + ["...WWc.WW.cWW...", "...c...c...c....", "................", "................", "................"]
add("ghost_1", art(ghost2))

# ---------- item icons (white, same style as app/assets/images/icons) ----------

icons = {
    # Open Road: the category for topics that don't have one (a two-way signpost)
    "icon_open_road": [
        "................",
        ".......WW.......",
        "..WWWWWWWWWW....",
        "..WWWWWWWWWWW...",
        "..WWWWWWWWWWWW..",
        "..WWWWWWWWWWW...",
        "..WWWWWWWWWW....",
        ".......WW.......",
        "....WWWWWWWWWW..",
        "...WWWWWWWWWWW..",
        "..WWWWWWWWWWWW..",
        "...WWWWWWWWWWW..",
        "....WWWWWWWWWW..",
        ".......WW.......",
        ".....WWWWWW.....",
        "................",
    ],
    "icon_pickaxe": [
        "................",
        "....WWWWWWW.....",
        "..WWWWWWWWWWW...",
        ".WWW...WW..WWW..",
        ".WW...WW....WW..",
        ".W...WW......W..",
        "....WW..........",
        "...WW...........",
        "..WW............",
        ".WW.............",
        "WW..............",
        "W...............",
        "................",
        "................",
        "................",
        "................",
    ],
    "icon_axe": [
        "................",
        ".........WWWW...",
        "........WWWWWW..",
        ".......WWWWWWWW.",
        "......WWWWWWWWW.",
        ".....WWWWWWWWW..",
        "....WWW..WWWW...",
        "...WWW....WW....",
        "..WWW...........",
        ".WWW............",
        "WWW.............",
        "WW..............",
        "................",
        "................",
        "................",
        "................",
    ],
    "icon_rope": [
        "................",
        "................",
        ".....WWWWWW.....",
        "...WW......WW...",
        "..W..WWWWWW..W..",
        ".W..W......W..W.",
        ".W.W..WWWW..W.W.",
        ".W.W.W....W.W.W.",
        ".W.W.W....W.W.W.",
        ".W.W..WWWW..W.W.",
        ".W..W......W..W.",
        "..W..WWWWWW..W..",
        "...WW......WW...",
        ".....WWWWWWWW...",
        "............WW..",
        ".............W..",
    ],
}
for name, rows in icons.items():
    add(name, art(rows))

# ---------- write ----------

names = list(tiles)
per_row = 16
rows_n = (len(names) + per_row - 1) // per_row


def sheet_pixel(x, y):
    i = (y // 16) * per_row + x // 16
    return tiles[names[i]][y % 16][x % 16] if i < len(names) else (0, 0, 0, 0)


save_png(os.path.join(ASSETS, "classic_rpg_extra.png"), per_row * 16, rows_n * 16, sheet_pixel)
json.dump({n: i for i, n in enumerate(names)}, open(os.path.join(ASSETS, "classic_rpg_extra.json"), "w"), indent=0)

os.makedirs(os.path.join(ASSETS, "icons"), exist_ok=True)
for name in list(icons) + list(tool_art):
    save_png(os.path.join(ASSETS, "icons", f"{name}.png"), 16, 16, lambda x, y, n=name: tiles[n][y][x])

print(f"wrote {len(names)} tiles and {len(icons) + len(tool_art)} icons to {ASSETS}")
