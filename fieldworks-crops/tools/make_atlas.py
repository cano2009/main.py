import sys, json, glob, numpy as np
from PIL import Image
A = sys.argv[1]; L = A + '/leaf'
def load(name):
    d = f'{L}/{name}'; g = lambda k: glob.glob(f'{d}/*_{k}.png')[0]
    c = Image.open(g('Color')).convert('RGB'); o = Image.open(g('Opacity')).convert('L'); n = Image.open(g('NormalGL')).convert('RGB')
    return c, o, n
def cell(imgs, cols, rows, ci, rj):
    w, h = imgs[0].size; box = (ci * w // cols, rj * h // rows, (ci + 1) * w // cols, (rj + 1) * h // rows)
    return [im.crop(box) for im in imgs]
def trim(c, o, n):
    a = np.array(o); ys, xs = np.where(a > 40); box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    return c.crop(box), o.crop(box), n.crop(box)
def rot_ccw(c, o, n):
    c2, o2 = c.rotate(90, expand=True), o.rotate(90, expand=True)
    arr = np.array(n.rotate(90, expand=True)).astype(np.int16)
    r, g = arr[..., 0].copy(), arr[..., 1].copy(); arr[..., 0] = 255 - g; arr[..., 1] = r
    return c2, o2, Image.fromarray(arr.clip(0, 255).astype(np.uint8))
SW, SH, AW, AH = 512, 1024, 2048, 2048
col = Image.new('RGBA', (AW, AH), (0, 0, 0, 0)); nor = Image.new('RGB', (AW, AH), (128, 128, 255))
slots = {}
def place(key, idx, c, o, n, pad=8):
    sx, sy = (idx % 4) * SW, (idx // 4) * SH
    w, h = c.size; k = min((SW - 2 * pad) / w, (SH - 2 * pad) / h); W, H = int(w * k), int(h * k)
    x0, y0 = sx + (SW - W) // 2, sy + SH - pad - H              # stem at the bottom edge of the slot
    c = c.resize((W, H), Image.LANCZOS); o = o.resize((W, H), Image.LANCZOS); n = n.resize((W, H), Image.LANCZOS)
    rgba = c.copy(); rgba.putalpha(o)
    # bleed leaf colour into transparent pixels so mip-maps don't darken the edges
    bg = c.resize((max(1, W // 16), max(1, H // 16)), Image.BOX).resize((W, H)); fill = Image.composite(c, bg, o.point(lambda v: 255 if v > 20 else 0))
    rgba = fill.copy(); rgba.putalpha(o)
    col.paste(rgba, (x0, y0)); nor.paste(n, (x0, y0))
    # uv: three.js flips Y, so v = 1 - pixelY / AH
    slots[key] = {'u0': x0 / AW, 'u1': (x0 + W) / AW, 'v0': 1 - (y0 + H) / AH, 'v1': 1 - y0 / AH, 'aspect': W / H}
c, o, n = load('Leaf001'); place('tomato', 0, *trim(*cell([c, o, n], 2, 1, 0, 0)))
c, o, n = load('Leaf003'); place('carrot', 1, *trim(*cell([c, o, n], 2, 1, 1, 0)))
c, o, n = load('LeafSet026'); place('melon', 2, *rot_ccw(*trim(*cell([c, o, n], 3, 2, 1, 0))))
c, o, n = load('LeafSet023'); place('pumpkin', 3, *rot_ccw(*trim(*cell([c, o, n], 2, 3, 0, 0))))
c, o, n = load('LeafSet009'); place('lettuce', 4, *trim(*cell([c, o, n], 3, 2, 0, 0)))
c, o, n = load('LeafSet014'); place('potato', 5, *trim(*cell([c, o, n], 3, 2, 1, 0)))
c, o, n = load('LeafSet024'); place('cabbage', 6, *trim(*cell([c, o, n], 3, 3, 1, 0)))
# slot 7: grass strip (luminance detail from the middle of a long leaf) and a neutral patch
# grass-type leaf: fine parallel veins, a pale midrib, streaks and speckle (luminance only, mean about 0.85)
H2, W2 = 1008, 360
xs = np.linspace(-1, 1, W2)[None, :]; ys = np.linspace(0, 1, H2)[:, None]
r = np.random.default_rng(7)
veins = 0.5 + 0.5 * np.cos(xs * np.pi * 34 + 0.6 * np.sin(ys * 9))
lum = 0.82 + 0.05 * veins ** 6 + 0.18 * np.exp(-(xs / 0.05) ** 2) - 0.08 * np.abs(xs) ** 3
streak = r.normal(0, 1, (1, W2)).repeat(H2, 0); from PIL import ImageFilter
streak = np.array(Image.fromarray(((streak * 20) + 128).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))) / 255 - 0.5
lum = lum + streak * 0.08 + r.normal(0, 0.015, (H2, W2))
hgt = 0.6 * veins ** 6 + 2.0 * np.exp(-(xs / 0.05) ** 2) + streak * 0.5
gy, gx = np.gradient(hgt); nx, ny = -gx * 3, gy * 3; nz = np.ones_like(nx); ln = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
gn = Image.fromarray(np.stack([(nx / ln * 0.5 + 0.5), (ny / ln * 0.5 + 0.5), (nz / ln * 0.5 + 0.5)], -1).__mul__(255).clip(0, 255).astype(np.uint8))
gs = Image.fromarray((lum * 255).clip(0, 255).astype(np.uint8))
sx, sy = 3 * SW, SH
col.paste(Image.merge('RGBA', [gs, gs, gs, Image.new('L', gs.size, 255)]), (sx + 8, sy + 8)); nor.paste(gn, (sx + 8, sy + 8))
slots['grass'] = {'u0': (sx + 8) / AW, 'u1': (sx + 368) / AW, 'v0': 1 - (sy + 1016) / AH, 'v1': 1 - (sy + 8) / AH, 'aspect': 1}
rng = np.random.default_rng(3); neu = (0.87 * 255 + rng.normal(0, 4, (1008, 120))).clip(0, 255).astype(np.uint8); ni = Image.fromarray(neu)
col.paste(Image.merge('RGBA', [ni, ni, ni, Image.new('L', ni.size, 255)]), (sx + 384, sy + 8))
slots['neutral'] = {'u': (sx + 444) / AW, 'v': 1 - (sy + 512) / AH}
col.save(A + '/out/crop_atlas_color.png', optimize=True); nor.save(A + '/out/crop_atlas_normal.jpg', quality=90)
open(A + '/out/cropatlas.js', 'w').write('/* Fieldworks crop leaf atlas: photo-scanned leaves (ambientCG, CC0). Slot rectangles in UV space. */\nwindow.FWCropAtlas = ' + json.dumps({'color': 'crop_atlas_color.png', 'normal': 'crop_atlas_normal.jpg', 'slots': slots}) + ';\n')
prev = Image.new('RGB', (AW, AH), (40, 40, 48)); prev.paste(col, (0, 0), col); prev.resize((1024, 1024)).save(A + '/atlas_preview.png')
print(json.dumps(slots, indent=0)[:900])
