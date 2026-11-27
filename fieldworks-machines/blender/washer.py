# Fieldworks hoop washer: an original produce washer designed around its job (soak, scrub, spray, recycle, dry).
#  - entry: hanging rubber flaps and a spinning brush roller ('brush')
#  - a low half-barrel hood in machinery green with three yellow spray hoops and a long viewing window
#  - a sump tank under the belt with a sight glass ('water0'), a side filter drum, and a pump with a gauge that
#    feeds the hoops through a riser and manifold
#  - exit: a snail-shell air blower ('fan') on the hood blowing down onto the produce
# Blender z-up; the belt runs along x through the machine, belt top at z = 0.8. Origin at the machine centre.
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import *

BZ = 0.8; L = 1.9; R = 0.52

def hoop_washer():
    objs = []
    # ---- frame: four posts each side on a skid, the sump tank hangs between them under the belt
    for x in (-L / 2 + 0.12, L / 2 - 0.12):
        for s in (-1, 1):
            objs.append(block((0.1, 0.1, BZ - 0.06), (x, s * 0.56, (BZ - 0.06) / 2), 'steelD', 0.02))
    for s in (-1, 1):
        objs.append(block((L + 0.1, 0.16, 0.08), (0, s * 0.56, 0.04), 'dark', 0.025))           # skid rails
        objs.append(block((L - 0.1, 0.08, 0.08), (0, s * 0.56, BZ - 0.12), 'greenD', 0.02))      # top rails
    sump = block((L - 0.4, 1.0, 0.42), (0, 0, 0.36), 'green', 0.05, name='sump')
    objs.append(block((L - 0.34, 1.04, 0.05), (0, 0, 0.58), 'greenD', 0.02))                     # sump lip
    objs.append(block((L - 0.5, 0.9, 0.05), (0, 0, 0.13), 'dark', 0.02))
    # sight glass on the front of the sump (the water level inside it is animated)
    objs.append(block((0.32, 0.03, 0.26), (-0.42, -0.51, 0.37), 'steelD', 0.008))
    objs.append(block((0.28, 0.02, 0.22), (-0.42, -0.52, 0.37), '#1d3b48', 0.004))
    w = block((0.26, 0.02, 0.2), (-0.42, -0.528, 0.27 + 0.1), 'water', 0.003, name='water0')
    for dx in (-0.13, 0.13): objs.append(bolt((-0.42 + dx, -0.525, 0.48), '-Y', 0.016, 0.012))
    # drain valve with a red handwheel at the low corner
    objs.append(cyl(0.035, 0.12, (0.62, -0.53, 0.2), 'steelD', axis='Y'))
    objs.append(ring(0.06, 0.012, (0.62, -0.6, 0.2), 'red', axis='Y'))
    # ---- hood: a half-barrel over the belt from just above the belt rails
    hood = vault(R, 0.05, L - 0.5, (0, 0, BZ + 0.02), 'green', 18)
    objs.append(vault(R + 0.015, 0.03, 0.06, (-(L - 0.5) / 2, 0, BZ + 0.02), 'greenD', 18))
    objs.append(vault(R + 0.015, 0.03, 0.06, ((L - 0.5) / 2, 0, BZ + 0.02), 'greenD', 18))
    # viewing window: a dark glass band along the front of the hood, with a light frame
    objs.append(vault(R + 0.012, 0.02, L - 0.75, (0, 0, BZ + 0.02), 'steelD', 6, angle=math.radians(40), start=math.radians(108)))
    objs.append(vault(R + 0.02, 0.012, L - 0.82, (0, 0, BZ + 0.02), '#22343c', 6, angle=math.radians(34), start=math.radians(111)))
    # three spray hoops outside the hood, each with nozzle stubs pointing in, fed from a top manifold
    for x in (-0.42, 0.0, 0.42):
        objs.append(ring(R + 0.07, 0.03, (x, 0, BZ + 0.02), 'yellow', arc=math.radians(150), segs=20))
        for a in (30, 60, 90, 120, 150):
            ar = math.radians(a)
            objs.append(cyl(0.026, 0.06, (x, math.cos(ar) * (R + 0.07), BZ + 0.02 + math.sin(ar) * (R + 0.07)), 'steelD', verts=8, rot=(ar - math.pi / 2, 0, 0)))
    objs.append(pipe([(-0.55, 0, BZ + R + 0.13), (0.55, 0, BZ + R + 0.13)], 0.035, 'steel', bend=0))   # manifold
    for x in (-0.42, 0.0, 0.42): objs.append(cyl(0.03, 0.08, (x, 0, BZ + R + 0.09), 'steel', verts=8))
    # ---- recirculation: filter drum on the back of the sump, pump with gauge, riser up to the manifold
    objs.append(cyl(0.2, 0.5, (-0.25, 0.68, 0.42), 'cream', verts=16))
    for z in (0.26, 0.58): objs.append(cyl(0.21, 0.04, (-0.25, 0.68, z), 'steelD', verts=16))
    objs.append(cyl(0.12, 0.06, (-0.25, 0.68, 0.7), 'steelD', verts=12))
    objs.append(block((0.22, 0.2, 0.1), (-0.25, 0.68, 0.15), 'dark', 0.02))
    objs.append(pipe([(-0.25, 0.5, 0.25), (-0.25, 0.48, 0.25)], 0.04, 'steelD', bend=0))
    # pump: yellow volute and a blue motor on a little plinth at the back right
    objs.append(block((0.5, 0.3, 0.1), (0.4, 0.72, 0.05), 'dark', 0.02))
    objs.append(cyl(0.14, 0.12, (0.28, 0.72, 0.28), 'yellow', axis='X', verts=16))
    objs.append(cyl(0.11, 0.3, (0.5, 0.72, 0.28), 'blue', axis='X', verts=14))
    for k in range(4): objs.append(cyl(0.118, 0.02, (0.4 + k * 0.07, 0.72, 0.28), 'blue', axis='X', verts=14))
    objs.append(block((0.12, 0.12, 0.08), (0.5, 0.72, 0.43), 'dark', 0.015))
    objs.append(pipe([(-0.05, 0.68, 0.42), (0.1, 0.72, 0.42), (0.22, 0.72, 0.3)], 0.035, 'steelD'))       # filter -> pump
    objs.append(pipe([(0.28, 0.72, 0.42), (0.28, 0.72, 0.62), (0.28, 0.66, BZ + 0.1), (0.62, 0.5, BZ + 0.45), (0.55, 0.12, BZ + R + 0.13)], 0.035, 'steelD'))
    objs.append(cyl(0.05, 0.03, (0.28, 0.69, 0.6), 'cream', axis='Y', verts=16))                         # pressure gauge
    objs.append(block((0.01, 0.005, 0.04), (0.29, 0.672, 0.61), 'red', 0.0))
    # ---- entry: rubber flaps hanging from a bar, and the brush roller behind them
    xe = -L / 2 + 0.2
    objs.append(block((0.06, 1.0, 0.06), (xe - 0.08, 0, BZ + 0.48), 'steelD', 0.01))
    for k in range(6): objs.append(block((0.012, 0.14, 0.4), (xe - 0.08, -0.35 + k * 0.14, BZ + 0.27), 'rubber', 0.003))
    brush = cyl(0.08, 0.86, (xe + 0.08, 0, BZ + 0.12), 'steelD', axis='Y', verts=10, name='brush_core')
    bristles = [cyl(0.11, 0.08, (xe + 0.08, -0.36 + k * 0.12, BZ + 0.12), 'orange', axis='Y', verts=10) for k in range(7)]
    br = join([brush] + bristles, 'brush')
    # ---- exit: snail-shell blower on top, duct down through the hood
    xb = L / 2 - 0.45
    objs.append(cyl(0.2, 0.18, (xb, 0.18, BZ + R + 0.3), 'yellow', axis='Y', verts=20))
    objs.append(block((0.18, 0.18, 0.22), (xb + 0.18, 0.18, BZ + R + 0.2), 'yellow', 0.03))
    objs.append(cyl(0.1, 0.16, (xb, -0.0, BZ + R + 0.3), 'dark', axis='Y', verts=14))                    # motor
    fan = cyl(0.12, 0.02, (xb, 0.28, BZ + R + 0.3), 'steelD', axis='Y', verts=6, name='fan')
    objs.append(block((0.22, 0.14, 0.08), (xb + 0.18, 0.18, BZ + R + 0.07), 'steelD', 0.02))
    # a small status beacon post on the control end, and the nameplate
    objs.append(block((0.3, 0.02, 0.09), (0.2, -0.515, 0.47), 'yellow', 0.008))   # nameplate on the sump
    return br, fan, w

if __name__ == '__main__':
    out, png = args()
    reset()
    hoop_washer()
    export(out)
    if png:
        preview(png, cam_loc=(3.4, -3.9, 2.6), target=(0, 0, 0.75), lens=45)
        preview(png.replace('.png', '_back.png'), cam_loc=(-3.2, 3.8, 2.4), target=(0, 0, 0.7), lens=45)
