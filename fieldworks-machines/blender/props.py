# Fieldworks yard props, mid-poly (original designs): wooden crate, steel drum, round hay bale. Same sizes and origins as
# yard.js (centred on the origin, matching their physics bodies). The drum's paint is its own material named 'paint' so
# the game tints each drum. Game coordinates through the power_yard wrappers.
# Usage: blender -b --python props.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from power_yard import *

PINE = '#c49a62'; PINED = '#9a7444'; HAY = '#d9b85a'; HAYD = '#b8933a'; HAYL = '#ecd488'
F.ROLE.update({PINE: (0.85, 0.0), PINED: (0.88, 0.0), HAY: (0.95, 0.0), HAYD: (0.95, 0.0), HAYL: (0.95, 0.0)})

def crate():
    S = 0.7
    gb(S - 0.04, S - 0.04, S - 0.04, 0, 0, 0, PINED, 0.01)                       # inner box
    for f in ('+z', '-z', '+x', '-x'):                                          # planks on each side
        for k in range(4):
            v = -S / 2 + 0.09 + k * 0.174
            fblock(f, {'+z': (0, 0, S / 2 - 0.02), '-z': (0, 0, -S / 2 + 0.02), '+x': (S / 2 - 0.02, 0, 0), '-x': (-S / 2 + 0.02, 0, 0)}[f], 0, v, 0.0, S - 0.12, 0.16, 0.025, PINE if k % 2 else '#cfa56c', 0.006)
    for y in (-1, 1):                                                           # top and bottom planks
        for k in range(4): gb(0.16, 0.025, S - 0.12, -S / 2 + 0.09 + k * 0.174, y * (S / 2 - 0.01), 0, PINE if k % 2 else '#cfa56c', 0.006)
    t = 0.07; s = S / 2 - t / 2 + 0.01                                           # corner and edge battens
    for a in (-1, 1):
        for b in (-1, 1):
            gb(t, S + 0.02, t, a * s, 0, b * s, PINED, 0.012)
            gb(S + 0.02, t, t, 0, a * s, b * s, PINED, 0.012)
            gb(t, t, S + 0.02, a * s, b * s, 0, PINED, 0.012)
    for f, o in (('+z', (0, 0, S / 2 + 0.03)), ('-z', (0, 0, -S / 2 - 0.03))):  # diagonal brace and nails
        fquad(f, o, [(-0.27, -0.24), (-0.21, -0.27), (0.27, 0.24), (0.21, 0.27)], -0.01, 0.022, PINED)
        for u in (-0.29, 0.29):
            for v in (-0.29, 0.29): fcyl(f, o, u, v, 0.0, 0.008, 0.008, GRAPH, verts=6)
    fblock('+x', (S / 2 + 0.03, 0, 0), 0, 0.02, 0.0, 0.3, 0.12, 0.004, '#3a2a1a', 0.0)   # stencilled mark

def drum():
    H = 0.88; R = 0.29
    body = gc(R - 0.005, H - 0.02, 0, 0, 0, '#2e6aa8', verts=24, bevel=0.01)
    body.data.materials.clear(); m = mat('#ffffff', 0.38, 0.35); m.name = 'paint'; body.data.materials.append(m)
    for y in (-0.3, 0.0, 0.3): ring(R + 0.006, 0.016, (0, 0, y), GRAPH, axis='Z', segs=24)   # rolling hoops
    for s in (-1, 1): ring(R - 0.01, 0.018, (0, 0, s * (H / 2 - 0.01)), GRAPH, axis='Z', segs=24)   # chime rims
    gc(R - 0.03, 0.01, 0, H / 2 - 0.01, 0, GRAPH, verts=24)                              # lid
    gc(0.045, 0.03, 0.14, H / 2 + 0.005, 0, '#9aa1a6', verts=10); gc(0.025, 0.035, -0.15, H / 2 + 0.005, 0.03, '#9aa1a6', verts=8)   # bungs
    fblock('+z', (0, 0.12, R - 0.01), 0, 0, 0.0, 0.16, 0.12, 0.004, '#f2efe4', 0.0)    # label

def hay_bale():
    R = 0.6; L = 1.1
    gc(R - 0.01, L - 0.04, 0, 0, 0, HAY, axis='x', verts=28, bevel=0.06)
    for s in (-1, 1):                                                               # spiral-rolled ends
        for k in range(5): ring(0.1 + k * 0.1, 0.012, (s * (L / 2 - 0.015), 0, 0), HAYD if k % 2 else HAYL, axis='X', segs=24)
        gc(0.06, 0.02, s * (L / 2 - 0.01), 0, 0, HAYD, axis='x', verts=10)
    for x in (-0.36, -0.12, 0.12, 0.36): ring(R + 0.004, 0.01, (x, 0, 0), '#e8e2d0', axis='X', segs=28)   # net-wrap bands
    for k in range(14):                                                             # loose straw tufts on the surface
        a = k / 14 * math.tau; x = -0.45 + (k * 0.37) % 0.9
        gbar((x, math.cos(a) * R, math.sin(a) * R), (x + 0.08, math.cos(a + 0.1) * (R + 0.02), math.sin(a + 0.1) * (R + 0.02)), 0.012, 0.006, HAYL)

MODELS = {'pr_crate': crate, 'pr_drum': drum, 'pr_hay': hay_bale}

if __name__ == '__main__':
    out, prefix = args()
    for name, fn in MODELS.items():
        reset(); F.LEDS.clear(); fn()
        export(os.path.join(out, name + '.glb')); print('exported', name)
        if prefix:
            for o in bpy.data.objects:
                if o.parent is None: o.location.z += 0.62
            preview(f'{prefix}_{name}.png', cam_loc=(1.9, -2.3, 1.8), target=(0, 0, 0.6), lens=40, size=(500, 420))
