# Fieldworks vehicles, mid-poly (original designs): FW-T120 tractor, utility truck, tipping trailer.
# Same dimensions, pivots and attach points as the game's code-built vehicles (farm.js, yard.js). Moving parts are
# nodes the game drives: tractor body, w_rear0/1, w_front0/1 (front ones turn inside the game's steering pivots);
# truck body, wheel0..3 (placed by the physics vehicle); trailer bed (tips at its rear hinge) and w0..3.
# The game keeps its own head lamps, beacon, tail lamps, trailer load and tipping ram.
# Game coordinates (x right, y up, z forward for the tractor and truck; the trailer trails toward -z).
# Usage: blender -b --python vehicles.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from power_yard import *
from buildings import glass_mat

TG = '#3f7d4c'; TGD = '#2f5a3b'; TY = '#e9b830'; TYD = '#c9961c'; TIRE = '#232427'; TIRED = '#1a1b1d'; CHROME = '#d9dde0'
TRED = '#c23a2e'; TREDD = '#9a2e25'; SEAT = '#2b2d30'
F.ROLE.update({TG: (0.32, 0.12), TGD: (0.36, 0.12), TY: (0.34, 0.1), TYD: (0.38, 0.1), TIRE: (0.92, 0.0), TIRED: (0.95, 0.0),
               CHROME: (0.15, 0.95), TRED: (0.3, 0.12), TREDD: (0.34, 0.12), SEAT: (0.8, 0.0)})

def tyre(r, w, lugs, rim=TY, ag=True):
    """Tyre on its axle (game x) at the origin: chevron lugs for farm tyres, a dished rim with a hub and studs."""
    gc(r * 0.97, w, 0, 0, 0, TIRE, axis='x', verts=24, bevel=0.03)
    for s in (-1, 1): gc(r * 0.8, 0.02, s * (w / 2 - 0.005), 0, 0, TIRED, axis='x', verts=24, bevel=0.004)   # sidewall
    for k in range(lugs):
        a = k / lugs * math.tau
        if ag:
            for s in (-1, 1):
                p0 = Vector((s * 0.02, math.cos(a) * r * 0.96, math.sin(a) * r * 0.96))
                b2 = a + s * 0.22
                p1 = Vector((s * (w / 2 - 0.01), math.cos(b2) * r * 0.96, math.sin(b2) * r * 0.96))
                gbar((p0.x, p0.y, p0.z), (p1.x, p1.y, p1.z), r * 0.11, r * 0.09, TIRE)
        else:
            q = Vector((0, math.cos(a) * r * 0.975, math.sin(a) * r * 0.975))
            gb(w * 0.9, 0.03, 0.03, 0, q.y, q.z, TIRED, 0.0).rotation_euler = (a, 0, 0)
    for s in (-1, 1):
        gc(r * 0.62, 0.03, s * (w / 2 + 0.004), 0, 0, rim, axis='x', verts=20, bevel=0.01)
        gc(r * 0.46, 0.03, s * (w / 2 + 0.02), 0, 0, rim, axis='x', verts=16, bevel=0.01)
        gc(r * 0.2, 0.05, s * (w / 2 + 0.035), 0, 0, GRAPH, axis='x', verts=12, bevel=0.008)
        for k in range(6):
            a = k / 6 * math.tau
            gc(r * 0.025 + 0.006, 0.03, s * (w / 2 + 0.05), math.cos(a) * r * 0.13, math.sin(a) * r * 0.13, CHROME, axis='x', verts=6, bevel=0.002)
        gc(r * 0.07, 0.05, s * (w / 2 + 0.06), 0, 0, CHROME, axis='x', verts=10, bevel=0.005)

def mk_wheel(name, c, r, w, lugs, **k):
    """Build the tyre at the origin, then move it to c and wrap it in a node at c."""
    objs = collect(lambda: tyre(r, w, lugs, **k))
    for o in objs:
        if o.parent is None: o.location = (o.location.x + c[0], o.location.y - c[2], o.location.z + c[1])
    e = empty(name, (c[0], -c[2], c[1])); bpy.context.view_layer.update()
    for o in objs:
        if o.parent is None: o.parent = e; o.matrix_parent_inverse = e.matrix_world.inverted()
    return e

# ---------------------------------------------------------------------------
def tractor():
    gl = glass_mat('#bfe3f2', 0.3)
    def body():
        gb(0.6, 0.32, 3.1, 0, 0.72, 0.15, GRAPH, 0.03)                                    # frame
        # hood: rounded, with a yellow stripe, side grilles and a grille with chrome surround
        gb(0.8, 0.64, 1.56, 0, 1.18, 0.82, TG, 0.09)
        gb(0.62, 0.06, 1.4, 0, 1.52, 0.84, TG, 0.03)
        for s in (-1, 1):
            gb(0.012, 0.06, 1.3, s * 0.402, 1.3, 0.85, TY, 0.0)
            grille('+x' if s > 0 else '-x', (s * 0.4, 1.06, 1.15), 0.6, 0.28, 6, TGD, INK, GRAPH)
        gb(0.66, 0.54, 0.06, 0, 1.12, 1.6, CHROME, 0.02)
        grille('+z', (0, 1.08, 1.63), 0.54, 0.36, 8, GRAPH, INK, GRAPH)
        for s in (-1, 1): fblock('+z', (0, 1.38, 1.61), s * 0.27, 0, 0.0, 0.2, 0.15, 0.03, GRAPH, 0.01)   # bezels behind the game's lamps
        fblock('+z', (0, 1.47, 1.61), 0, 0, 0.0, 0.18, 0.05, 0.02, TY, 0.004)          # badge
        # front weights: a stack of yellow plates with lifting handles
        for k in range(5):
            gb(0.9, 0.3, 0.05, 0, 0.72, 1.72 + k * 0.055, TY if k % 2 == 0 else TYD, 0.012)
        gb(0.24, 0.1, 0.26, 0, 0.92, 1.83, GRAPH, 0.02)
        for s in (-1, 1): gb(0.06, 0.28, 0.42, s * 0.36, 0.72, 1.6, GRAPH, 0.01)
        # exhaust stack with heat shield and rain cap; pre-cleaner intake
        gc(0.05, 0.8, 0.26, 1.88, 1.25, CHROME, verts=12)
        gc(0.065, 0.36, 0.26, 1.8, 1.25, GRAPH, verts=12, bevel=0.005)
        for k in range(4): gb(0.005, 0.3, 0.012, 0.26 + 0.066 * math.cos(k * 0.8 - 0.4), 1.8, 1.25 + 0.066 * math.sin(k * 0.8 - 0.4), INK, 0.0)
        gc(0.07, 0.03, 0.26, 2.29, 1.25, GRAPH, verts=12)
        gc(0.07, 0.5, -0.26, 1.72, 1.32, TG, verts=12); gc(0.1, 0.12, -0.26, 2.02, 1.32, GRAPH, verts=12, bevel=0.01)
        gc(0.11, 0.04, -0.26, 2.1, 1.32, CHROME, verts=12)
        # cab: floor, posts, roof with a light bar, glass, door, seat, wheel, dash, mirrors
        gb(1.2, 0.08, 1.3, 0, 1.36, -0.55, GRAPH, 0.02)
        for x, z in ((-0.56, -0.02), (0.56, -0.02), (-0.56, -1.12), (0.56, -1.12)): gb(0.07, 1.25, 0.07, x, 1.98, z, GRAPH, 0.02)
        gb(1.38, 0.12, 1.4, 0, 2.64, -0.57, TG, 0.04); gb(1.2, 0.06, 1.2, 0, 2.73, -0.57, TGD, 0.02)
        gb(1.1, 0.06, 0.08, 0, 2.62, 0.13, GRAPH, 0.01)                               # light bar (game lamps on it)
        for o, sz in (((0, 1.98, -0.01), (1.05, 1.1, 0.02)), ((0, 1.98, -1.13), (1.05, 1.1, 0.02))):
            g = gb(sz[0], sz[1], sz[2], *o, None, 0.0); g.data.materials.append(gl)
        for s in (-1, 1):
            g = gb(0.02, 1.1, 1.05, s * 0.565, 1.98, -0.57, None, 0.0); g.data.materials.append(gl)
            gb(0.03, 0.04, 0.12, s * 0.585, 1.75, -0.2, CHROME, 0.006)                 # door handle
            gb(0.03, 1.1, 0.04, s * 0.575, 1.98, -0.57, GRAPH, 0.004)                  # door frame bar
            gbar((s * 0.6, 2.3, -0.05), (s * 0.85, 2.3, 0.05), 0.03, 0.03, GRAPH); gb(0.04, 0.22, 0.15, s * 0.88, 2.3, 0.06, GRAPH, 0.01)
            for k, y in enumerate((0.95, 1.18)): gb(0.3, 0.04, 0.24, s * 0.72, y, -0.05, GRAPH, 0.006)   # steps
            gb(0.08, 0.9, 0.08, s * 0.6, 1.3, -0.25, GRAPH, 0.01)
        gb(0.5, 0.12, 0.46, 0, 1.65, -0.75, SEAT, 0.04); gb(0.5, 0.52, 0.12, 0, 1.92, -0.97, SEAT, 0.04)
        gb(0.12, 0.25, 0.12, 0, 1.5, -0.75, GRAPH, 0.01)
        gb(0.9, 0.36, 0.22, 0, 1.56, -0.12, GRAPH, 0.03)
        glow(gb(0.3, 0.1, 0.01, 0, 1.68, -0.008, '#7fe8b0', 0.0), '#7fe8b0', 0.8)       # dash display
        gbar((0, 1.6, -0.2), (0, 1.95, -0.38), 0.04, 0.04, GRAPH)
        ring(0.15, 0.02, (0, 0.4, 1.98), INK, axis='Y', segs=16).rotation_euler = (math.pi / 2 - 1.1, 0, 0)
        # rear fenders with work lamps, fuel tank, battery box, hitch with linkage and PTO guard
        for s in (-1, 1):
            vault(0.9, 0.04, 0.52, (s * 0.86, 0.9, 0.78), TG, 16)                      # fender arched over the rear wheel
            gb(0.52, 0.05, 1.5, s * 0.86, 1.72, -0.9, TG, 0.015)
            gb(0.14, 0.1, 0.08, s * 0.86, 1.62, -0.15, GRAPH, 0.01); glow(gb(0.1, 0.06, 0.01, s * 0.86, 1.62, -0.105, '#fff2d0', 0.0), '#fff2d0', 0.4)
            glow(gb(0.08, 0.1, 0.02, s * 0.86, 1.4, -1.7, '#ff3b2b', 0.0), '#ff3b2b', 0.6)
        gb(0.5, 0.42, 0.52, -0.55, 0.96, 0.15, TG, 0.05); gc(0.06, 0.05, -0.55, 1.19, 0.15, TY, verts=12)
        gb(0.36, 0.3, 0.3, 0.55, 0.92, 0.25, GRAPH, 0.02); fblock('+x', (0.73, 0.92, 0.25), 0, 0, 0.0, 0.22, 0.2, 0.01, TY, 0.004)
        HZ, HY = -1.85, 0.55
        for s in (-1, 1): gbar((s * 0.25, 0.7, -1.25), (s * 0.42, HY, HZ + 0.05), 0.08, 0.08, GRAPH)
        gbar((0, 1.2, -1.2), (0, HY + 0.45, HZ + 0.05), 0.07, 0.07, GRAPH)
        for s in (-1, 1): gc(0.04, 0.5, s * 0.2, 0.95, -1.45, TY, verts=10)          # lift rams
        gb(0.95, 0.08, 0.08, 0, HY, HZ + 0.05, GRAPH, 0.01); gb(0.08, 0.5, 0.08, 0, HY + 0.25, HZ + 0.05, GRAPH, 0.01)
        gb(0.5, 0.3, 0.45, 0, 0.78, -1.3, GRAPH, 0.03)
        vault(0.12, 0.02, 0.2, (0, 1.85, 0.62), TY, 8)                                 # PTO shield over the output stub
        fblock('+x', (0.4, 1.35, 0.4), 0, 0, 0.0, 0.3, 0.08, 0.01, CHROME, 0.0)       # model badge
    node('body', (0, 0, 0), body)
    # front axle and pivot block stay on the chassis
    gb(1.4, 0.1, 0.12, 0, 0.45, 1.3, GRAPH, 0.02); gb(0.26, 0.22, 0.3, 0, 0.56, 1.3, GRAPH, 0.03)
    for k, s in enumerate((-1, 1)):
        mk_wheel('w_rear%d' % k, (s * 0.86, 0.78, -0.9), 0.78, 0.46, 18)
        mk_wheel('w_front%d' % k, (s * 0.78, 0.45, 1.3), 0.45, 0.3, 14)

def truck():
    """Utility pickup: chassis centre at the origin, wheels placed by the physics vehicle."""
    gl = glass_mat('#4f7488', 0.7)
    def body():
        gb(1.7, 0.32, 4.3, 0, 0.12, 0.05, GRAPH, 0.03)                                  # ladder frame
        gb(1.68, 0.62, 1.36, 0, 0.62, 1.25, TRED, 0.1)                                  # bonnet
        gb(1.4, 0.04, 1.0, 0, 0.94, 1.2, TREDD, 0.02)
        gb(1.68, 0.8, 1.52, 0, 0.84, -0.05, TRED, 0.1)                                  # cab
        gb(1.6, 0.06, 1.45, 0, 1.26, -0.08, TREDD, 0.03)
        w = gb(1.5, 0.5, 0.04, 0, 1.02, 0.7, None, 0.0); w.data.materials.append(gl); w.rotation_euler = (-0.35, 0, 0)
        for s in (-1, 1):
            w = gb(0.04, 0.4, 1.0, s * 0.845, 1.02, -0.05, None, 0.0); w.data.materials.append(gl)
            gb(0.02, 0.62, 1.1, s * 0.84, 0.64, -0.05, TREDD, 0.004)                   # door outline panel
            gb(0.03, 0.04, 0.14, s * 0.86, 0.82, -0.25, CHROME, 0.006)
            gbar((s * 0.84, 1.08, 0.5), (s * 1.0, 1.1, 0.55), 0.03, 0.03, GRAPH); gb(0.05, 0.2, 0.14, s * 1.02, 1.1, 0.56, GRAPH, 0.01)
            gb(0.06, 0.06, 1.1, s * 0.86, 0.06, -0.05, GRAPH, 0.01)                     # side step
        grille('+z', (0, 0.6, 1.93), 1.1, 0.26, 5, CHROME, INK, GRAPH)
        for x in (-0.6, 0.6): fblock('+z', (x, 0.58, 1.93), 0, 0, 0.0, 0.32, 0.18, 0.02, CHROME, 0.008)   # lamp bezels
        gb(1.74, 0.2, 0.14, 0, 0.05, 2.26, '#9aa1a6', 0.04)                             # bumpers
        gb(1.74, 0.2, 0.14, 0, 0.05, -2.83, '#9aa1a6', 0.04)
        # load bed with ribbed floor, stake pockets, tailgate and a toolbox
        gb(1.7, 0.08, 1.9, 0, 0.34, -1.85, GRAPH, 0.01)
        for k in range(6): gb(0.04, 0.02, 1.86, -0.6 + k * 0.24, 0.39, -1.85, GRAPHD, 0.0)
        for s in (-1, 1):
            gb(0.07, 0.44, 1.9, s * 0.82, 0.58, -1.85, TRED, 0.015)
            gb(0.1, 0.04, 1.94, s * 0.82, 0.81, -1.85, GRAPH, 0.008)
            for z in (-1.2, -2.5): gb(0.08, 0.06, 0.08, s * 0.82, 0.8, z, INK, 0.004)
        gb(1.7, 0.44, 0.07, 0, 0.58, -2.78, TRED, 0.015); fblock('-z', (0, 0.72, -2.82), 0, 0, 0.0, 0.5, 0.08, 0.01, CHROME, 0.0)
        gb(1.7, 0.52, 0.07, 0, 0.62, -0.88, GRAPH, 0.01)
        gb(1.5, 0.3, 0.36, 0, 0.55, -1.15, '#b8bec2', 0.02)                             # toolbox
        for x in (-0.4, 0.4): gb(0.16, 0.03, 0.04, x, 0.66, -0.96, CHROME, 0.004)
        for x in (-0.7, 0.7): glow(gb(0.2, 0.12, 0.03, x, 0.5, -2.83, '#ff3b2b', 0.0), '#ff3b2b', 0.6)
        gb(0.8, 0.1, 0.25, 0, 1.33, -0.2, GRAPH, 0.02)
        for x in (-0.25, 0.25): glow(gb(0.3, 0.08, 0.2, x, 1.4, -0.2, '#f08a24', 0.0), '#f08a24', 0.8)   # beacon bar
        fblock('+x', (0.86, 0.78, -0.05), 0, 0, 0.0, 0.5, 0.12, 0.004, '#f2efe4', 0.0)  # door decal
    node('body', (0, 0, 0), body)
    for k in range(4): mk_wheel('wheel%d' % k, (0, 0, 0), 0.42, 0.3, 26, rim='#c7ccd0', ag=False)

def trailer():
    RED = '#b5413a'; REDD = '#9a3530'; L0, L1, Y = -1.0, -4.5, 0.15
    gc(0.08, 0.08, 0, 0, -0.02, GRAPH, axis='z', verts=12)                              # hitch eye
    for s in (-1, 1): gbar((0, 0, -0.05), (s * 0.55, Y - 0.05, L0 + 0.1), 0.1, 0.1, GRAPH)
    gb(0.1, 0.08, 0.3, 0, 0.04, -0.25, TY, 0.01)
    gb(0.08, 0.3, 0.08, 0, -0.15, -0.6, GRAPH, 0.01); gb(0.2, 0.03, 0.2, 0, -0.3, -0.6, GRAPH, 0.004)
    for x in (-0.55, 0.55): gb(0.12, 0.18, L0 + 0.2 - L1, x, Y - 0.08, (L0 + 0.2 + L1) / 2, GRAPH, 0.012)
    for z in (L0 + 0.1, -2.2, -3.4, L1 + 0.1): gb(1.22, 0.1, 0.1, 0, Y - 0.08, z, GRAPH, 0.01)
    for z in (-2.75, -3.6): gb(2.1, 0.09, 0.09, 0, -0.13, z, GRAPH, 0.01)
    for s in (-1, 1):
        gb(0.34, 0.04, 1.5, s * 1.02, 0.33, -3.18, GRAPH, 0.008)                         # mudguards
        gb(0.1, 0.44, 0.1, s * 0.75, 0.12, -3.18, GRAPH, 0.01)
        for z in (-2.75, -3.6): gb(0.12, 0.06, 0.3, s * 0.55, -0.06, z, GRAPHD, 0.008)  # leaf spring hangers
    bl = L0 - L1 - 0.05
    def bed():
        gb(1.9, 0.08, bl, 0, Y + 0.04, L1 + 0.05 + bl / 2, GRAPH, 0.01)
        for s in (-1, 1):
            gb(0.06, 0.62, bl, s * 0.94, Y + 0.39, L1 + 0.05 + bl / 2, RED, 0.012)
            gb(0.09, 0.07, bl + 0.04, s * 0.94, Y + 0.72, L1 + 0.05 + bl / 2, TG, 0.012)
            for k in range(6): gb(0.08, 0.6, 0.06, s * 0.98, Y + 0.39, L1 + 0.25 + k * (bl - 0.4) / 5, REDD, 0.008)
        gb(1.9, 0.84, 0.06, 0, Y + 0.49, L0, RED, 0.012); gb(1.96, 0.07, 0.11, 0, Y + 0.93, L0, TG, 0.012)
        for x in (-0.6, 0, 0.6): gb(0.06, 0.8, 0.08, x, Y + 0.49, L0 + 0.04, REDD, 0.008)
        gb(1.86, 0.6, 0.06, 0, Y + 0.38, L1 + 0.08, RED, 0.012)                          # tailgate
        for x in (-0.6, 0.6): gb(0.1, 0.1, 0.08, x, Y + 0.62, L1 + 0.04, GRAPH, 0.008) # latches
        hazard('-z', (0, Y + 0.18, L1 + 0.04), 1.6, 0.08)
        for x in (-0.5, 0.5): gc(0.05, 0.12, x, Y, L1 + 0.05, 'steel', axis='x', verts=10)
    node('bed', (0, -(L1 + 0.05), Y), bed)
    k = 0
    for z in (-2.75, -3.6):
        for s in (-1, 1): mk_wheel('w%d' % k, (s * 1.02, -0.13, z), 0.42, 0.28, 14); k += 1

MODELS = {'vh_tractor': tractor, 'vh_truck': truck, 'vh_trailer': trailer}

if __name__ == '__main__':
    out, prefix = args()
    only = os.environ.get('ONLY')
    for name, fn in MODELS.items():
        if only and name not in only.split(','): continue
        reset(); fn(); export(os.path.join(out, name + '.glb')); print('exported', name)
        if prefix: preview(f'{prefix}_{name}.png', cam_loc=(5.2, -6.5, 3.6) if name != 'vh_trailer' else (5.5, 7.8, 3.4), target=(0, -0.2, 1.0) if name != 'vh_trailer' else (0, 2.6, 0.5), lens=40, size=(900, 700))
