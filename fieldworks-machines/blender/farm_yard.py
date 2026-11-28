# Fieldworks farm yard, mid-poly (original designs): the pump jack's static body and its walking beam.
# Same geometry as yard.js pumpJack(): pivot (saddle) at (0, 3.2, 0), horsehead radius 2.2 toward -x, crank at
# (1.7, 1.35), wellhead at x = -2.2. The 'beam' node is built around the pivot and rocks in the game's beam group; the
# cranks, counterweights, pitmans, bridle, polished rod, motor, sheave and the control screen stay the game's.
# Usage: blender -b --python farm_yard.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from power_yard import *
from implements import mk_node
import bmesh

PG = '#3f7d4c'; PGD = '#2f5a3b'; PY = '#e9b830'; PYD = '#c9961c'; PR = '#c23a2e'
F.ROLE.update({PG: (0.4, 0.1), PGD: (0.42, 0.1), PY: (0.35, 0.08), PYD: (0.38, 0.08), PR: (0.38, 0.08)})
PS = (0, 3.2, 0); A = 2.2; BK = 1.7; CK = (1.7, 1.35)

def ibeam(a, b, h, w, m):
    """An I-section member between two game points, flanges top and bottom."""
    gbar(a, b, w * 0.35, h, m)
    for s in (-1, 1): gbar((a[0], a[1] + s * h / 2, a[2]), (b[0], b[1] + s * h / 2, b[2]), w, 0.03, m)

def pump_jack():
    # concrete pad and steel skid with cross members and anchor bolts
    gb(5.0, 0.12, 1.5, 1.2, 0.06, 0, CONC, 0.03)
    for z in (-0.55, 0.55):
        gb(4.5, 0.08, 0.2, 1.3, 0.16, z, GRAPH, 0.01); gb(4.5, 0.08, 0.2, 1.3, 0.36, z, GRAPH, 0.01); gb(4.5, 0.2, 0.04, 1.3, 0.26, z, GRAPH, 0.008)
    for x in (-0.6, 0.6, 1.7, 3.0): gb(0.16, 0.16, 1.1, x, 0.32, 0, GRAPH, 0.012)
    anchor_bolts(-0.9, 3.5, -0.7, 0.7, 0.12)
    hazard('+z', (1.3, 0.12, 0.75), 4.4, 0.06)
    # samson post: three I-section legs, cross braces, a ladder and the saddle bearing
    for s in (-1, 1): ibeam((-0.7, 0.4, s * 0.55), (0, PS[1] - 0.25, s * 0.12), 0.14, 0.16, PG)
    ibeam((0.9, 0.4, 0), (0.02, PS[1] - 0.25, 0), 0.13, 0.15, PG)
    for y in (1.0, 1.9): gbar((-0.7 + 0.7 * y / 3, y, -0.55 + 0.43 * y / 3), (-0.7 + 0.7 * y / 3, y, 0.55 - 0.43 * y / 3), 0.06, 0.06, PGD)
    for k in range(7): gb(0.03, 0.03, 0.3, 0.75 - k * 0.1, 0.6 + k * 0.36, 0, PY, 0.0)                  # ladder rungs on the rear leg
    gb(0.38, 0.22, 0.52, 0, PS[1] - 0.27, 0, GRAPH, 0.02)
    for s in (-1, 1): gc(0.1, 0.1, 0, PS[1] - 0.02, s * 0.2, GRAPHD, axis='z', verts=14)                 # saddle bearing caps
    gc(0.05, 0.6, 0, PS[1], 0, 'steel', axis='z', verts=12)
    # gear reducer with ribs and an oil sight, the belt guard over the sheave
    gb(0.95, 1.1, 0.62, CK[0], 0.85, 0, PG, 0.04)
    for k in range(3): gb(0.04, 1.0, 0.66, CK[0] - 0.3 + k * 0.3, 0.85, 0, PGD, 0.008)
    gb(1.0, 0.08, 0.68, CK[0], 1.38, 0, PGD, 0.015)
    gc(0.14, 0.7, CK[0], CK[1], 0, GRAPH, axis='z', verts=14)
    glow(gc(0.04, 0.01, CK[0] + 0.3, 0.6, 0.315, '#7fd8ff', axis='z', verts=10, bevel=0), '#7fd8ff', 0.5)
    plate('+z', (CK[0] - 0.2, 0.95, 0.312), 0.24, 0.14)
    gb(0.4, 0.12, 0.5, 3.05, 0.34, -0.05, GRAPH, 0.01)                                                  # motor rail
    g = gb(1.45, 0.72, 0.1, CK[0] + 0.78, 0.75, 0.49, PY, 0.03); g.rotation_euler = (0, 0.27, 0)       # belt guard over the sheave (tilted about game z = blender y)
    for k in range(4): gr = gb(0.03, 0.55, 0.012, CK[0] + 0.35 + k * 0.28, 0.75 - 0.08 * k, 0.545, PYD, 0.0); gr.rotation_euler = (0, 0.27, 0)
    # wellhead: casing, tee, stuffing box, flowline, valves and a gauge
    gc(0.16, 0.5, -A, 0.37, 0, '#9aa1a6', verts=16); gc(0.22, 0.06, -A, 0.14, 0, GRAPH, verts=16)
    gb(0.28, 0.26, 0.28, -A, 0.72, 0, PR, 0.02)
    gc(0.09, 0.36, -A, 0.72, 0.22, PR, axis='z', verts=12); gc(0.12, 0.04, -A, 0.72, 0.4, GRAPH, axis='z', verts=12)
    gc(0.1, 0.28, -A, 0.98, 0, PR, verts=12); gc(0.06, 0.1, -A, 1.16, 0, 'steel', verts=10)
    gp([(-A, 0.72, 0.42), (-A, 0.72, 0.8), (-A + 0.4, 0.3, 1.0), (-A + 1.2, 0.2, 1.0)], 0.05, GRAPH, bend=0.1)
    fcyl('-z', (-A, 0.95, -0.14), 0.12, 0, 0.0, 0.05, 0.03, GRAPH); fcyl('-z', (-A, 0.95, -0.17), 0.12, 0, 0.0, 0.04, 0.01, 'cream')
    for x, z in ((-A - 0.5, -0.5), (-A + 0.5, -0.5), (-A - 0.5, 0.5), (-A + 0.5, 0.5)): gb(0.06, 0.5, 0.06, x, 0.25, z, PY, 0.008)   # guard posts
    for z in (-0.5, 0.5): gb(1.0, 0.04, 0.04, -A, 0.42, z, PY, 0.006)
    # walking beam (rocks in the game's beam group): I-beam, equaliser, a curved horsehead and a handrail
    def beam():
        ibeam((-A + 0.3, 0, 0), (BK, 0, 0), 0.34, 0.28, PG)
        gb(0.22, 0.18, 1.22, BK, -0.05, 0, GRAPH, 0.02)                                                 # equaliser
        gc(0.09, 0.3, 0, 0, 0, GRAPHD, axis='z', verts=14)
        # horsehead: a curved plate following the arc of radius A, with side cheeks
        bm = bmesh.new(); d0 = 0.42; N = 10; rows = []
        for i in range(N + 1):
            a = math.pi - d0 + 2 * d0 * i / N; row = []
            for rr, zz in ((A, -0.22), (A, 0.22), (A - 0.5, 0.22), (A - 0.5, -0.22)):
                x, y = math.cos(a) * rr, math.sin(a) * rr; row.append(bm.verts.new((x, -zz, y)))
            rows.append(row)
        for i in range(N):
            for j in range(4): bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][(j + 1) % 4], rows[i][(j + 1) % 4]))
        bm.faces.new(rows[0]); bm.faces.new(list(reversed(rows[-1])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new('horsehead'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('horsehead', me); bpy.context.collection.objects.link(o); o.data.materials.append(mat(PY))
        for p in o.data.polygons: p.use_smooth = True
        for s in (-1, 1):
            for i in range(0, N + 1, 2):
                a = math.pi - d0 + 2 * d0 * i / N; gc(0.012, 0.02, math.cos(a) * (A - 0.25), math.sin(a) * (A - 0.25), s * 0.225, GRAPH, axis='z', verts=6)
        gb(0.06, 0.5, 0.48, -A + 0.4, 0, 0, PYD, 0.01)
        for x in (-1.4, -0.6, 0.6): gb(0.03, 0.3, 0.03, x, 0.32, 0.2, PY, 0.0)                          # handrail posts
        gbar((-1.4, 0.47, 0.2), (0.6, 0.47, 0.2), 0.03, 0.03, PY)
    mk_node('beam', PS, beam)

MODELS = {'fy_pumpjack': pump_jack}

if __name__ == '__main__':
    out, prefix = args()
    for name, fn in MODELS.items():
        reset(); F.LEDS.clear(); fn(); export(os.path.join(out, name + '.glb')); print('exported', name)
        if prefix: preview(f'{prefix}_{name}.png', cam_loc=(4.5, -7.5, 4.5), target=(0.6, 0, 1.8), lens=36, size=(900, 700))
