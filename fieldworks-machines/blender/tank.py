# Fieldworks water tank, mid-poly: one bolted shell ring (with or without the ladder cage) and the roof. The game stacks
# 3 to 5 rings with upgrades, so each ring group and the roof group get their own Blender body. Origins: the ring's bottom
# centre; the roof's bottom centre. Ladder on game +x, sight gauge on +z, inlet riser on -x (all match yard.js).
# Usage: blender -b --python tank.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from power_yard import *

R = 1.45; RH = 1.1; SH = '#cbd3d6'; SHD = '#b4bdc1'; TY = '#e9b830'; TO = '#ea7a2c'
F.ROLE.update({SH: (0.38, 0.4), SHD: (0.4, 0.4), TY: (0.38, 0.08)})

def shell_ring(cage):
    gc(R, RH, 0, RH / 2, 0, SH, verts=40, bevel=0)
    gc(R + 0.03, 0.06, 0, 0.03, 0, SHD, verts=40, bevel=0.01)                    # bolted flange at the seam
    for k in range(40):
        a = k / 40 * math.tau; gc(0.014, 0.02, math.cos(a) * (R + 0.02), 0.07, math.sin(a) * (R + 0.02), GRAPH, verts=6, bevel=0)   # flange bolts
    for k in range(10):                                                          # vertical lap seams
        a = k / 10 * math.tau + 0.15
        gb(0.02, RH - 0.08, 0.02, math.cos(a) * (R + 0.006), RH / 2, math.sin(a) * (R + 0.006), SHD, 0.0)
    # ladder on +x
    for z in (-0.2, 0.2): gb(0.05, RH, 0.05, R + 0.28, RH / 2, z, TY, 0.01)
    for k in range(4): gb(0.04, 0.04, 0.4, R + 0.28, 0.14 + k * 0.275, 0, TY, 0.006)
    for y in (0.3, 0.85):
        for z in (-0.2, 0.2): gb(0.28, 0.04, 0.04, R + 0.14, y, z, TY, 0.006)   # standoff brackets to the shell
    if cage:
        for y in (0.05, 0.6):
            for k in range(7):
                a0, a1 = -math.pi / 2 + k * math.pi / 7, -math.pi / 2 + (k + 1) * math.pi / 7
                gbar((R + 0.28 + 0.38 * math.cos(a0), y, 0.38 * math.sin(a0)), (R + 0.28 + 0.38 * math.cos(a1), y, 0.38 * math.sin(a1)), 0.03, 0.03, TY)
        for k in (-1, -0.33, 0.33, 1): gb(0.03, RH, 0.03, R + 0.28 + 0.38 * math.cos(k * 1.2), RH / 2, 0.38 * math.sin(k * 1.2), TY, 0.004)
    # sight gauge on +z (the float is the game's)
    gb(0.12, RH, 0.04, 0, RH / 2, R + 0.05, '#e6e8e2', 0.006)
    for k in range(4): gb(0.1 if k % 2 == 0 else 0.06, 0.012, 0.01, -0.09, 0.14 + k * 0.275, R + 0.075, INK, 0.0)
    gc(0.03, RH, 0.09, RH / 2, R + 0.07, '#bfe3f2', verts=8, bevel=0)
    gc(0.075, RH, -R - 0.14, RH / 2, -0.4, STEEL, verts=12, bevel=0)              # inlet riser
    gb(0.1, 0.06, 0.06, -R - 0.06, 0.6, -0.4, GRAPH, 0.006)

def roof():
    gc(R + 0.06, 0.6, 0, 0.3, 0, SH, verts=40, bevel=0.01, r2=0.18)              # cone roof
    gc(R + 0.08, 0.13, 0, 0.0, 0, TO, verts=40, bevel=0.01)                       # orange rim
    for k in range(16):                                                           # roof ribs
        a = k / 16 * math.tau
        gbar((math.cos(a) * (R - 0.05), 0.08, math.sin(a) * (R - 0.05)), (math.cos(a) * 0.22, 0.58, math.sin(a) * 0.22), 0.03, 0.02, SHD)
    for k in range(12):                                                           # handrail posts, open over the ladder
        a = k / 12 * math.tau
        if abs(math.atan2(math.sin(a), math.cos(a))) < 0.3: continue
        gb(0.035, 0.9, 0.035, math.cos(a) * (R - 0.08), 0.45, math.sin(a) * (R - 0.08), TY, 0.004)
    ring(R - 0.08, 0.025, (0, 0, 0.9), TY, axis='Z', segs=32); ring(R - 0.08, 0.018, (0, 0, 0.5), TY, axis='Z', segs=32)
    g = gb(0.5, 0.12, 0.5, 0.6, 0.18, 0.3, '#9aa1a6', 0.015); g.rotation_euler = (0, 0, -0.22)   # hatch
    gc(0.08, 0.3, 0, 0.7, 0, STEEL, verts=12); gc(0.16, 0.12, 0, 0.88, 0, '#9aa1a6', verts=12, r2=0.05)   # vent
    for z in (-0.2, 0.2): gb(0.05, 1.0, 0.05, R + 0.28, 0.5, z, TY, 0.006)       # ladder hand-holds over the rim
    gp([(-R - 0.14, 0, -0.4), (-R - 0.14, 0.25, -0.4), (-R + 0.15, 0.3, -0.35)], 0.075, STEEL, bend=0.08)

MODELS = {'fy_tankring': lambda: shell_ring(False), 'fy_tankringc': lambda: shell_ring(True), 'fy_tankroof': roof}

if __name__ == '__main__':
    out, prefix = args()
    for name, fn in MODELS.items():
        reset(); F.LEDS.clear(); fn(); export(os.path.join(out, name + '.glb')); print('exported', name)
