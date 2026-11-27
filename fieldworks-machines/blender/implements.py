# Fieldworks tractor implements, mid-poly (original designs): 4-furrow plow, 4-row seeder, pull-type harvester.
# Same origins and sizes as farm.js: the hitch point is the origin and the implement trails toward game -z.
# Moving parts are nodes the game drives: plow depth wheel 'dw'; seeder 'roll0..3' (press wheel and opening disc of each
# row unit, turning about x); harvester 'reel', 'w0', 'w1'. The game keeps the harvester's grain fill.
# Usage: blender -b --python implements.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from power_yard import *
from vehicles import tyre, mk_wheel, TG, TGD, TY, TYD, TIRE, CHROME

RED = '#c23a2e'; REDD = '#9a2e25'; MOULD = '#c9ced2'; SHARE = '#4a4f55'
F.ROLE.update({RED: (0.32, 0.12), REDD: (0.36, 0.12), MOULD: (0.18, 0.85), SHARE: (0.4, 0.6)})

def mk_node(name, c, fn):
    """Build fn() around the origin, move it to game point c and wrap it in a node there."""
    objs = collect(fn)
    for o in objs:
        if o.parent is None: o.location = (o.location.x + c[0], o.location.y - c[2], o.location.z + c[1])
    e = empty(name, (c[0], -c[2], c[1])); bpy.context.view_layer.update()
    for o in objs:
        if o.parent is None: o.parent = e; o.matrix_parent_inverse = e.matrix_world.inverted()
    return e

def mouldboard():
    """A curved, twisting steel mouldboard around the origin: it lifts the soil from the share and rolls it to the right."""
    import bmesh
    bm = bmesh.new(); rows = []
    for i in range(7):                                    # along the travel (game -z), the board curls and twists outward
        t = i / 6; z = 0.18 - t * 0.4; tw = t * 0.9
        row = []
        for j in range(5):                                # up the board
            u = j / 4; a = u * 1.25
            r = 0.26
            px = 0.04 + (1 - math.cos(a)) * r * (0.5 + tw); py = -0.12 + math.sin(a) * r
            row.append(bm.verts.new((px, -z, py)))
        rows.append(row)
    for i in range(6):
        for j in range(4): bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('mb'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('mb', me); bpy.context.collection.objects.link(o)
    sol = o.modifiers.new('t', 'SOLIDIFY'); sol.thickness = 0.02
    o.data.materials.append(mat(MOULD))
    for p in o.data.polygons: p.use_smooth = True
    gb(0.05, 0.14, 0.12, 0.0, 0.02, 0.0, GRAPH, 0.008)    # frog: the casting that joins it to the leg

def headstock(w):
    """A-frame that meets the tractor's three-point hitch, with link pins and a top-link bracket."""
    gb(0.9, 0.09, 0.09, 0, 0, -0.03, GRAPH, 0.012)
    gb(0.09, 0.52, 0.09, 0, 0.25, -0.03, GRAPH, 0.012)
    for s in (-1, 1):
        gbar((s * 0.42, 0, -0.03), (s * w * 0.3, 0.12, -0.6), 0.08, 0.08, TY)
        gc(0.03, 0.14, s * 0.42, 0, 0.0, 'steel', axis='x', verts=10)                   # lower link pins
    gbar((0, 0.48, -0.03), (0, 0.15, -0.6), 0.07, 0.07, TY)
    gc(0.03, 0.14, 0, 0.5, 0.0, 'steel', axis='x', verts=10)
    for s in (-1, 1): gb(0.02, 0.14, 0.12, s * 0.06, 0.5, -0.02, GRAPH, 0.004)          # top-link ears
    fblock('+z', (0, 0.3, 0.02), 0, 0, 0.0, 0.2, 0.1, 0.01, 'cream', 0.002)

def plow():
    headstock(2.0)
    gbar((-1.0, 0.15, -0.55), (1.0, 0.15, -1.7), 0.15, 0.15, RED)                        # main beam
    gbar((-0.95, 0.26, -0.55), (0.95, 0.26, -1.65), 0.04, 0.06, REDD)                    # top flange
    for i in range(4):
        t = i / 3; x = -0.85 + 1.7 * t; z = -0.6 - 1.05 * t
        gb(0.09, 0.5, 0.09, x, -0.08, z, RED, 0.012)                                      # leg
        gb(0.12, 0.1, 0.14, x, 0.13, z, GRAPH, 0.012)                                     # clamp on the beam
        for s in (-1, 1): gc(0.014, 0.18, x + s * 0.05, 0.13, z, 'steel', axis='z', verts=6)
        mk_node('mb%d' % i, (x, -0.33, z - 0.02), lambda: mouldboard())
        gb(0.3, 0.04, 0.1, x - 0.02, -0.46, z + 0.1, SHARE, 0.006)                        # share
        gc(0.06, 0.26, x - 0.04, -0.44, z + 0.2, SHARE, axis='z', verts=6, r2=0.01)       # point
        gb(0.06, 0.04, 0.4, x + 0.06, -0.42, z - 0.15, GRAPH, 0.006)                      # landside
    gb(0.09, 0.42, 0.09, 0.92, 0.05, -1.7, RED, 0.012)
    gb(0.2, 0.06, 0.09, 1.0, -0.1, -1.7, RED, 0.008)
    mk_wheel('dw', (1.05, -0.2, -1.7), 0.28, 0.14, 12)                                     # depth wheel
    plate('-x', (-0.99, 0.15, -0.6), 0.16, 0.1)

def seeder():
    headstock(2.0)
    gb(2.1, 0.12, 0.14, 0, 0.12, -0.62, TY, 0.02)                                         # toolbar
    gb(1.8, 0.55, 0.7, 0, 0.62, -0.95, TG, 0.05)                                          # seed hopper
    gb(1.86, 0.06, 0.76, 0, 0.92, -0.95, TGD, 0.02)
    for x in (-0.45, 0.45): gb(0.8, 0.04, 0.6, x, 0.96, -0.95, TG, 0.015); gc(0.02, 0.12, x + 0.3, 0.99, -0.95, GRAPH, axis='x', verts=8)   # lids, hinges
    gb(1.5, 0.32, 0.5, 0, 0.22, -0.95, TG, 0.03)
    for x in (-0.6, -0.2, 0.2, 0.6): fblock('+z', (x, 0.62, -0.6), 0, 0, 0.0, 0.03, 0.4, 0.01, TGD, 0.0)   # ribs
    fblock('+z', (0.55, 0.72, -0.6), 0, 0, 0.0, 0.3, 0.12, 0.01, TY, 0.004)
    glow(gb(0.12, 0.3, 0.012, -0.7, 0.62, -0.597, '#58e0ff', 0.0), '#58e0ff', 0.4)        # seed level window
    gc(0.1, 0.12, 0.85, 0.35, -0.95, GRAPH, axis='x', verts=12)                             # metering drive
    gp([(0.85, 0.35, -0.95), (0.95, 0.15, -0.95), (0.95, -0.15, -1.3)], 0.02, GRAPH, bend=0.05)
    for i in range(4):
        x = -0.75 + i * 0.5
        gb(0.08, 0.42, 0.52, x, 0.05, -0.95, GRAPH, 0.012)                                # row unit frame
        for s in (-1, 1): gb(0.02, 0.06, 0.3, x + s * 0.05, -0.12, -0.85, GRAPH, 0.004)  # parallel links
        gc(0.025, 0.42, x, 0.23, -1.05, INK, verts=8)                                     # seed tube
        gc(0.07, 0.1, x, 0.05, -0.83, TY, verts=10)                                       # down-force spring
        def roll():
            gc(0.17, 0.04, 0, 0.12, 0.42, MOULD, axis='x', verts=16, bevel=0.004)         # opening disc, ahead of the press wheel
            for k in range(6): a = k / 6 * math.tau; gc(0.012, 0.05, 0, 0.12 + math.cos(a) * 0.1, 0.42 + math.sin(a) * 0.1, GRAPH, axis='x', verts=6)
            tyre(0.13, 0.1, 10, rim=TY)                                                    # press wheel
        mk_node('roll%d' % i, (x, -0.27, -1.25), roll)
    for s in (-1, 1):                                                                       # row markers folded for transport
        gbar((s * 1.0, 0.12, -0.62), (s * 1.08, 0.95, -0.62), 0.06, 0.06, TY)
        gc(0.12, 0.03, s * 1.1, 0.97, -0.62, MOULD, axis='x', verts=16)

def harvester():
    gbar((0, 0, -0.03), (0, 0.35, -1.0), 0.11, 0.11, GRAPH)                               # drawbar
    gb(0.9, 0.09, 0.09, 0, 0, -0.03, GRAPH, 0.012); gb(0.09, 0.52, 0.09, 0, 0.25, -0.03, GRAPH, 0.012)
    gb(1.4, 0.12, 2.0, 0, 0.35, -1.9, GRAPH, 0.02)
    gb(2.0, 0.1, 0.1, 0, -0.05, -2.1, GRAPH, 0.012); gb(0.3, 0.42, 0.1, 0, 0.13, -2.1, GRAPH, 0.012)
    for k, s in enumerate((-1, 1)): mk_wheel('w%d' % k, (s * 0.95, -0.05, -2.1), 0.5, 0.3, 14)
    # pickup header
    gb(2.1, 0.3, 0.6, 0, -0.25, -1.0, TY, 0.04)
    gb(2.1, 0.06, 0.5, 0, -0.41, -0.88, GRAPH, 0.01)
    for k in range(14): gb(0.02, 0.1, 0.18, -0.98 + k * 0.15, -0.38, -0.66, MOULD, 0.003)   # pickup tines
    for s in (-1, 1):
        gb(0.07, 0.62, 0.66, s * 1.06, -0.05, -1.0, TY, 0.02)
        gb(0.03, 0.5, 0.5, s * 1.1, -0.05, -1.0, TYD, 0.006)
        gbar((s * 1.0, -0.15, -1.05), (s * 1.0, 0.1, -0.82), 0.045, 0.045, GRAPH)
        hazard('+z', (s * 0.85, -0.3, -0.69), 0.36, 0.08)
    def reel():
        gc(0.045, 2.1, 0, 0.1, -0.82, MOULD, axis='x', verts=12)
        for x in (-0.95, 0.0, 0.95):
            for k in range(5): a = k / 5 * math.tau; gbar((x, 0.1, -0.82), (x, 0.1 + math.cos(a) * 0.24, -0.82 + math.sin(a) * 0.24), 0.03, 0.03, GRAPH)
        for k in range(5):
            a = k / 5 * math.tau; gb(2.0, 0.045, 0.06, 0, 0.1 + math.cos(a) * 0.24, -0.82 + math.sin(a) * 0.24, RED, 0.008)
            for j in range(10): gb(0.015, 0.12, 0.015, -0.9 + j * 0.2, 0.1 + math.cos(a) * 0.3, -0.82 + math.sin(a) * 0.3, MOULD, 0.0)
    node('reel', (0, 0.1, -0.82), reel)
    gbar((0, -0.1, -1.2), (0, 0.35, -1.5), 0.09, 0.09, GRAPH)
    # elevator into the bin, bin with ladder and inspection hatch (the fill is the game's)
    gbar((0.75, -0.1, -1.1), (0.75, 1.55, -1.6), 0.24, 0.24, TG)
    for k in range(5):
        t = 0.15 + k * 0.17; gb(0.27, 0.03, 0.03, 0.75, -0.1 + 1.65 * t, -1.1 - 0.5 * t, TGD, 0.0)
    gc(0.1, 0.14, 0.75, 1.6, -1.62, GRAPH, axis='x', verts=12)
    gb(1.4, 1.0, 1.5, 0, 0.92, -2.05, TG, 0.04)
    for s in (-1, 1):
        gb(0.06, 0.26, 1.5, s * 0.73, 1.52, -2.05, TGD, 0.012)
        for z in (-1.5, -2.05, -2.6): fblock('+x' if s > 0 else '-x', (s * 0.7, 0.92, z), 0, 0, 0.0, 0.04, 0.95, 0.012, TGD, 0.0)
    gb(1.46, 0.26, 0.06, 0, 1.52, -1.27, TGD, 0.012); gb(1.46, 0.26, 0.06, 0, 1.52, -2.83, TGD, 0.012)
    for k in range(5): gb(0.3, 0.025, 0.03, -0.45, 0.5 + k * 0.22, -2.82, GRAPH, 0.0)     # ladder rungs
    for x in (-0.6, -0.3): gb(0.03, 1.1, 0.03, x, 0.95, -2.82, GRAPH, 0.0)
    fblock('-z', (0.35, 0.95, -2.8), 0, 0, 0.0, 0.4, 0.3, 0.01, TGD, 0.004); fblock('-z', (0.35, 1.15, -2.8), 0, 0, 0.0, 0.06, 0.03, 0.02, GRAPH, 0.004)
    for x in (-0.55, 0.55): glow(gb(0.12, 0.08, 0.03, x, 0.3, -2.95, '#ff3b2b', 0.0), '#ff3b2b', 0.6)
    gb(1.2, 0.06, 0.1, 0, 0.3, -2.95, GRAPH, 0.008)

MODELS = {'im_plow': plow, 'im_seeder': seeder, 'im_harvester': harvester}

if __name__ == '__main__':
    out, prefix = args()
    only = os.environ.get('ONLY')
    for name, fn in MODELS.items():
        if only and name not in only.split(','): continue
        reset(); F.LEDS.clear(); fn(); export(os.path.join(out, name + '.glb')); print('exported', name)
        if prefix: preview(f'{prefix}_{name}.png', cam_loc=(4.2, 3.4, 2.8), target=(0, 1.3, 0.2), lens=36, size=(800, 640))
