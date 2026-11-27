# Fieldworks processing line and bakery chain, mid-poly (original designs): optical sorter, carton packer, stone mill,
# tunnel oven, crate bagger. Same footprints and belt height (0.8 m) as line.js and food.js. Moving parts are nodes
# built around the game's own pivots and attached to its groups: sorter 'brush' and 'pusher', packer 'head',
# mill 'runner', bagger 'press'. The game keeps its glowing light bars and oven mouths, screens and status lights.
# Usage: blender -b --python line_chain.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from power_yard import *
from implements import mk_node

BY = 0.8
LY = '#e9b830'; LYD = '#c9961c'; LG = '#3f7d4c'; LGD = '#2f5a3b'; CARD = '#b98b4f'; CARDL = '#cfa266'; TAPE = '#d9c9a0'
STONE = '#a7a29a'; STONED = '#857f77'; BRK = '#a8442e'; BRKD = '#8a3624'; OAK = '#8a6440'; OAKD = '#6b4b2e'; CREAM = '#ece6d6'
F.ROLE.update({LY: (0.34, 0.08), LYD: (0.38, 0.08), LG: (0.4, 0.08), LGD: (0.42, 0.08), CARD: (0.85, 0.0), CARDL: (0.85, 0.0), TAPE: (0.6, 0.0),
               STONE: (0.9, 0.0), STONED: (0.92, 0.0), BRK: (0.88, 0.0), BRKD: (0.9, 0.0), OAK: (0.75, 0.0), OAKD: (0.78, 0.0), CREAM: (0.5, 0.0)})

def foot(x, z, s=0.36): gb(s, 0.12, s, x, 0.06, z, GRAPH, 0.02); anchor_bolts(x - s * 0.35, x + s * 0.35, z - s * 0.35, z + s * 0.35, 0.12)

def sorter():
    H = 1.75
    for s in (-1, 1):
        z = s * 0.6; f = '+z' if s > 0 else '-z'
        foot(0, z, 0.5)
        gb(0.42, H - 0.12, 0.26, 0, 0.12 + (H - 0.12) / 2, z, LY, 0.04)                 # pillar
        grille('+x', (0.21, 0.95, z), 0.18, 0.5, 8, LYD, INK, GRAPH); grille('-x', (-0.21, 0.95, z), 0.18, 0.5, 8, LYD, INK, GRAPH)
        seam(f, (0, 1.3, z + s * 0.13), 0.3, 0.5); screws(f, (0, 1.3, z + s * 0.131), 0.3, 0.5, 0.025)
        led_strip((0.012, 0.02, H - 0.4), (0.215, -z, 0.12 + (H - 0.12) / 2))
    gb(0.52, 0.3, 1.5, 0, H + 0.1, 0, LY, 0.04)                                          # arch beam
    gb(0.56, 0.05, 1.54, 0, H + 0.27, 0, GRAPH, 0.012)
    for z in (-0.4, 0.0, 0.4): grille('+x', (0.26, H + 0.1, z), 0.3, 0.18, 3, LYD, INK, GRAPH)
    # camera head under the arch with a lens and lens hood (light bars are the game's)
    gb(0.36, 0.22, 0.6, 0, H - 0.15, 0, GRAPH, 0.03)
    gc(0.08, 0.12, 0, H - 0.3, 0.12, INK, verts=16); gc(0.055, 0.02, 0, H - 0.37, 0.12, '#2a4d6e', verts=16, bevel=0)
    gc(0.1, 0.06, 0, H - 0.24, 0.12, GRAPH, verts=16, r2=0.08)
    gp([(0.18, H - 0.1, -0.2), (0.21, H - 0.1, -0.5), (0.21, H - 0.3, -0.6)], 0.02, INK, bend=0.04)
    # brush diverter (spins) and grain pusher (slides)
    def brush():
        gc(0.035, 1.12, 0, 0, 0, STEEL, axis='z', verts=12)
        for k in range(3):
            b = gb(0.2, 0.03, 0.9, 0, 0, 0, '#c23a2e', 0.006); b.rotation_euler = (0, k * math.pi / 3, 0)
        for s in (-1, 1): gc(0.05, 0.04, 0, 0, s * 0.56, GRAPH, axis='z', verts=12)
    mk_node('brush', (-0.12, BY + 0.16, 0), brush)
    for s in (-1, 1): gb(0.1, 0.18, 0.06, -0.12, BY + 0.16, s * 0.6, GRAPH, 0.01)        # brush bearings
    gb(0.95, 0.02, 0.16, -0.67, BY - 0.01, 0.5, STEEL, 0.004)
    gb(0.3, 0.22, 0.14, -0.75, BY + 0.1, -0.6, LYD, 0.02); gb(0.62, 0.08, 0.08, -0.45, BY + 0.1, -0.6, LYD, 0.012)
    gc(0.045, 0.2, -0.75, BY + 0.1, -0.45, BLUE, axis='z', verts=12)
    def pusher():
        gc(0.025, 0.4, 0, 0, 0.2, STEEL, axis='z', verts=10)
        gb(0.34, 0.14, 0.03, 0, 0, 0.41, '#c23a2e', 0.008); gb(0.3, 0.1, 0.012, 0, 0, 0.428, 'rubber', 0.002)
    mk_node('pusher', (-0.75, BY + 0.09, -0.42), pusher)
    # reject chute and bin, control box
    c = gb(0.4, 0.04, 0.6, -0.12, 0.62, -0.95, STEEL, 0.008); c.rotation_euler = (-0.45, 0, 0)
    for s in (-1, 1): w = gb(0.03, 0.12, 0.6, -0.12 + s * 0.2, 0.67, -0.95, STEEL, 0.004); w.rotation_euler = (-0.45, 0, 0)
    gb(0.56, 0.42, 0.46, -0.12, 0.21, -1.35, LGD, 0.03); gb(0.5, 0.03, 0.4, -0.12, 0.42, -1.35, INK, 0.004)
    for s in (-1, 1): gb(0.04, 0.06, 0.2, -0.12 + s * 0.3, 0.32, -1.35, GRAPH, 0.008)
    gb(0.3, 0.36, 0.14, 0.26, 1.25, -0.6, CREAM, 0.02); seam('-z', (0.26, 1.25, -0.672), 0.26, 0.32)
    for i, col in enumerate(('green', 'yellow', 'red')): fcyl('-z', (0.26, 1.12, -0.67), -0.07 + i * 0.07, 0, 0.0, 0.018, 0.02, col, verts=10)

def carton_packer():
    H = 2.5
    for s in (-1, 1):
        z = s * 0.62
        foot(0, z, 0.44)
        gb(0.28, H - 0.12, 0.28, 0, 0.12 + (H - 0.12) / 2, z, LG, 0.04)
        gb(0.07, H - 0.4, 0.05, -0.16, H / 2, z, LY, 0.008)                                # guide rail for the carriage
        for y in (0.5, 1.2, 1.9): screws('-x', (-0.14, y, z), 0.2, 0.2, 0.02)
        led_strip((0.012, 0.02, H - 0.6), (0.145, -z, H / 2))
        hazard('+x', (0.142, 0.4, z), 0.24, 0.14)
    gb(0.4, 0.22, 1.6, 0, H + 0.08, 0, LY, 0.04); gb(0.44, 0.05, 1.64, 0, H + 0.21, 0, GRAPH, 0.012)
    gc(0.08, 0.3, 0, H + 0.05, 0, BLUE, verts=12)                                          # lift motor
    # forming table, open carton with flaps, infeed lip and guides
    gb(0.9, 0.08, 0.9, -0.1, BY - 0.08, 0, STEEL, 0.012)
    for sx in (-1, 1):
        for sz in (-1, 1): gb(0.06, BY - 0.12, 0.06, -0.1 + sx * 0.4, (BY - 0.12) / 2, sz * 0.4, RAILD, 0.008)
    gb(0.5, 0.3, 0.5, -0.1, BY + 0.11, 0, CARD, 0.012)
    for s in (-1, 1): f = gb(0.5, 0.02, 0.18, -0.1, BY + 0.27, s * 0.33, CARDL, 0.004); f.rotation_euler = (s * 0.9, 0, 0)
    gb(0.46, 0.02, 0.46, -0.1, BY + 0.265, 0, INK, 0.0)
    gb(0.24, 0.04, 0.62, 0.47, BY - 0.02, 0, STEEL, 0.008)
    for s in (-1, 1): gb(0.24, 0.1, 0.03, 0.47, BY + 0.03, s * 0.3, LY, 0.006)
    def head():
        gb(0.3, 0.16, 1.0, 0, 0, 0, LY, 0.03)
        for z in (-0.3, 0.3):
            gb(0.08, 0.3, 0.08, -0.1, -0.22, z, RAILD, 0.01); gb(0.16, 0.04, 0.16, -0.1, -0.38, z, GRAPH, 0.008)
        gc(0.12, 0.08, 0.1, -0.05, 0, TAPE, axis='z', verts=16); gc(0.05, 0.1, 0.1, -0.05, 0, GRAPH, axis='z', verts=12)
        for s in (-1, 1): gb(0.06, 0.12, 0.08, -0.16, 0, s * 0.62 * 0.8, GRAPH, 0.008)    # rail shoes
        hazard('+x', (0.151, 0, 0), 0.9, 0.08)
    mk_node('head', (0, H - 0.45, 0), head)
    # flat carton magazine
    for x, z in ((0.8, 0.15), (0.8, -0.45), (0.3, -0.45)): gb(0.06, 1.4, 0.06, x, 0.7, z, RAILD, 0.008)
    for k in range(9): gb(0.46, 0.035, 0.56, 0.55, 0.45 + k * 0.05, -0.15, CARD if k % 2 else CARDL, 0.003)
    gb(0.56, 0.05, 0.66, 0.55, 0.4, -0.15, STEEL, 0.008)

def stone_mill():
    gb(1.4, 0.15, 1.4, 0, 0.075, 0, STONED, 0.03)
    for x, z in ((-0.6, -0.6), (0.6, -0.6), (-0.6, 0.6), (0.6, 0.6)):
        gb(0.15, 2.3, 0.15, x, 1.2, z, OAK, 0.02)
        gb(0.2, 0.08, 0.2, x, 0.19, z, GRAPH, 0.01)
    for z in (-0.6, 0.6): gb(1.36, 0.13, 0.15, 0, 2.3, z, OAK, 0.02)
    for x in (-0.6, 0.6): gb(0.15, 0.13, 1.36, x, 2.3, 0, OAK, 0.02)
    for s in (-1, 1):
        gbar((s * 0.6, 1.6, -0.6), (s * 0.6, 2.2, -0.15), 0.08, 0.08, OAKD); gbar((s * 0.6, 1.6, 0.6), (s * 0.6, 2.2, 0.15), 0.08, 0.08, OAKD)
    gb(1.1, 0.6, 1.1, 0, 0.5, 0, LG, 0.04)                                               # housing
    for y in (0.3, 0.7): gb(1.14, 0.05, 1.14, 0, y, 0, LGD, 0.01)
    plate('+z', (0.25, 0.5, 0.55), 0.24, 0.14)
    gc(0.52, 0.18, 0, 0.89, 0, STONE, verts=20, bevel=0.02)                               # bed stone
    gc(0.56, 0.06, 0, 0.83, 0, GRAPH, verts=20)
    def runner():
        gc(0.5, 0.18, 0, 0, 0, STONE, verts=20, bevel=0.03)
        gc(0.12, 0.2, 0, 0.02, 0, STONED, verts=12)
        for k in range(6): b = gb(0.44, 0.02, 0.04, math.cos(k * 1.047) * 0.27, 0.095, math.sin(k * 1.047) * 0.27, STONED, 0.0); b.rotation_euler = (0, 0, -k * 1.047)
        ring(0.51, 0.02, (0, 0, 0.0), GRAPH, axis='Z', segs=20)
    mk_node('runner', (0, 1.07, 0), runner)
    cyl_h = gc(0.12, 0.6, 0, 1.75, 0, LY, verts=4, r2=0.42); cyl_h.rotation_euler = (0, 0, math.pi / 4)   # hopper
    gb(0.5, 0.06, 0.5, 0, 2.06, 0, LYD, 0.012)
    gc(0.05, 0.4, 0, 1.35, 0, STEEL, verts=8)
    motor(0, 0.75, 0.45, 'X', LG, 0.4, 0.16)                                           # blender coords: game z -0.75
    gb(0.7, 0.14, 0.3, 0.1, 0.24, -0.68, RAILD, 0.015)
    gb(0.5, 0.5, 0.08, 0.3, 0.6, -0.6, ORANGE, 0.015)                                      # belt guard
    sp = gb(0.5, 0.08, 0.24, 0.72, 0.72, 0, STEEL, 0.01); sp.rotation_euler = (0, 0.35, 0)
    for s in (-1, 1): w = gb(0.5, 0.1, 0.02, 0.72, 0.77, s * 0.11, STEEL, 0.003); w.rotation_euler = (0, 0.35, 0)

def tunnel_oven(L=1.69):
    gb(L, 0.78, 1.2, 0, 0.39, 0, BRK, 0.03)
    for y in (0.2, 0.45, 0.7): gb(L + 0.01, 0.02, 1.21, 0, y, 0, BRKD, 0.0)               # mortar courses
    for s in (-1, 1):
        gb(L, 0.66, 0.25, 0, 1.1, s * 0.48, BRK, 0.02)
        for y in (0.95, 1.25): gb(L + 0.01, 0.02, 0.26, 0, y, s * 0.48, BRKD, 0.0)
    gb(L + 0.1, 0.25, 1.24, 0, 1.55, 0, BRK, 0.02)
    gb(L + 0.16, 0.08, 1.3, 0, 1.71, 0, GRAPH, 0.012)
    for s in (-1, 1):
        gb(0.06, 0.66, 0.8, s * (L / 2 + 0.02), 1.12, 0, GRAPH, 0.01)                     # mouth frames (glow is the game's)
        for sx in (-1, 1): gb(0.08, 1.6, 0.08, s * (L / 2 - 0.04), 0.82, sx * 0.62, GRAPH, 0.01)   # corner angles
    gb(L, 0.03, 0.72, 0, 0.81, 0, STEEL, 0.004)
    for k in range(int(L / 0.12)): gb(0.02, 0.012, 0.7, -L / 2 + 0.06 + k * 0.12, 0.83, 0, RAILD, 0.0)   # mesh belt slats
    cx = -L / 2 + 0.3
    gc(0.14, 1.0, cx, 2.2, -0.3, GRAPH, verts=16); gc(0.18, 0.08, cx, 2.74, -0.3, GRAPH, verts=16)
    gc(0.22, 0.06, cx, 2.84, -0.3, RAILD, verts=4, r2=0.04)
    for y in (1.9, 2.4): gc(0.16, 0.04, cx, y, -0.3, RAILD, verts=16)
    gb(0.4, 0.45, 0.1, L / 2 - 0.35, 1.1, 0.65, CREAM, 0.02); seam('+z', (L / 2 - 0.35, 1.1, 0.701), 0.36, 0.41)
    fcyl('+z', (L / 2 - 0.42, 0.98, 0.7), 0, 0, 0.0, 0.05, 0.03, '#c23a2e', verts=12)
    for k in range(3): fcyl('+z', (L / 2 - 0.3 + k * 0.06, 0.98, 0.7), 0, 0, 0.0, 0.018, 0.02, ('green', 'yellow', 'red')[k], verts=10)
    gp([(0.3, 1.71, 0.35), (0.3, 1.95, 0.35), (0.0, 2.0, 0.35), (-0.2, 1.95, 0.0)], 0.04, STEEL, bend=0.08)   # vapour vent
    led_strip((L - 0.2, 0.02, 0.02), (0, -0.656, 1.62))

def bagger():
    gb(1.0, 0.75, 1.0, 0, 0.375, 0, STEEL, 0.04)
    seam('+z', (0, 0.4, 0.5), 0.86, 0.6); grille('+x', (0.5, 0.4, 0), 0.6, 0.3, 6, STEELM, INK, GRAPH)
    for x, z in ((-0.45, -0.45), (0.45, -0.45), (-0.45, 0.45), (0.45, 0.45)):
        gb(0.09, 1.6, 0.09, x, 1.55, z, LY, 0.015)
    gb(1.0, 0.13, 1.0, 0, 2.35, 0, LY, 0.025); gb(1.04, 0.04, 1.04, 0, 2.43, 0, GRAPH, 0.008)
    gc(0.08, 0.3, 0, 2.55, 0, BLUE, verts=12)
    def press():
        gb(0.7, 0.1, 0.6, 0, 0, 0, GRAPH, 0.02)
        gc(0.05, 0.5, 0, 0.3, 0, STEEL, verts=10)
        for sx in (-1, 1):
            for sz in (-1, 1): gc(0.02, 0.06, sx * 0.28, -0.08, sz * 0.22, 'rubber', verts=8)
    mk_node('press', (0, 1.9, 0), press)
    gb(0.6, 0.3, 0.45, 0, 0.9, 0, '#a26b35', 0.015)
    for s in (-1, 1): gb(0.62, 0.04, 0.03, 0, 0.9, s * 0.23, '#82592f', 0.0)
    for k in range(5): gb(0.55, 0.06, 0.42, 0, 0.82 + k * 0.07, -0.85, '#a26b35' if k % 2 else '#b47b45', 0.006)
    gb(0.65, 0.78, 0.5, 0, 0.39, -0.85, STEELM, 0.02)
    hazard('+z', (0, 0.06, 0.505), 0.96, 0.08)
    led_strip((0.02, 1.4, 0.02), (0.455, -0.505, 1.5))

MODELS = {'lc_sorter': sorter, 'lc_cpacker': carton_packer, 'lc_mill': stone_mill, 'lc_oven': tunnel_oven, 'lc_bagger': bagger}

if __name__ == '__main__':
    out, prefix = args()
    only = os.environ.get('ONLY')
    for name, fn in MODELS.items():
        if only and name not in only.split(','): continue
        reset(); F.LEDS.clear(); fn(); F.finalize_leds(); export(os.path.join(out, name + '.glb')); print('exported', name)
        if prefix: preview(f'{prefix}_{name}.png', cam_loc=(3.4, -4.2, 3.2), target=(0, 0, 1.1), lens=36, size=(700, 600))
