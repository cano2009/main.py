# Fieldworks placeable power, hydraulic and processing parts (low-poly, original designs), one cell each (1.2 m).
# These replace the static bodies of the code-built parts in power.js. The game keeps its own animated pieces (the
# spinning shafts, the wind head and rotor, the clutch plate and lever, the valve handle, the rams, the pallet load and
# the glowing level gauges), so ports, shaft heights (HS 0.62), hose heights (HH 0.32) and every animation stay exact:
# these models are built around those pieces and leave them visible.
# Blender coords: x = game x (east), +y = game north (game -z), z up. Origin = cell centre on the ground.
# Usage: blender -b --python power_parts.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from factory_parts import *   # shares the materials, palette and helpers of the factory family

HS = 0.62; HH = 0.32
CONC = '#b9b4aa'; CONCD = '#9c978e'; RED = '#c9452f'; REDD = '#9a3322'; BRASS = '#c9a446'; ORANGE_D = '#c45f1c'
F.ROLE.update({CONC: (0.9, 0.0), CONCD: (0.9, 0.0), RED: (0.4, 0.08), REDD: (0.45, 0.1), BRASS: (0.3, 0.7)})

def pad(w, d, m=CONC):
    """Concrete foundation with a chamfered top and a steel skid frame bolted on."""
    block((w, d, 0.06), (0, 0, 0.03), m, 0.02)
    for sy in (-1, 1): block((w - 0.08, 0.06, 0.05), (0, sy * (d / 2 - 0.08), 0.085), RAILD, 0.008)
    for sx in (-1, 1):
        for sy in (-1, 1): bolt((sx * (w / 2 - 0.08), sy * (d / 2 - 0.08), 0.11), 'Z', 0.018, 0.012, 'steel')

def pillow(x, y=0.0):
    """Cast bearing block on a pedestal; the game's shaft runs through the bearing at HS."""
    block((0.16, 0.16, HS - 0.16), (x, y, (HS - 0.16) / 2 + 0.06), RAILD, 0.015)
    block((0.24, 0.24, 0.04), (x, y, 0.08), FOOT, 0.008)
    block((0.12, 0.22, 0.08), (x, y, HS - 0.12), FOOT, 0.012)
    cyl(0.085, 0.11, (x, y, HS), FOOT, axis='X', verts=8, bevel=0.01)
    for sy in (-1, 1): bolt((x, y + sy * 0.08, HS - 0.08), 'Z', 0.016, 0.012, 'steel')
    cyl(0.012, 0.04, (x, y, HS + 0.1), BRASS, verts=6, bevel=0)                             # grease nipple

def hose_x(x0, x1, y=0.0):
    cyl(0.04, x1 - x0, ((x0 + x1) / 2, y, HH), 'rubber', axis='X', verts=8, bevel=0)
def hose_y(y0, y1, x=0.0):
    cyl(0.04, y1 - y0, (x, (y0 + y1) / 2, HH), 'rubber', axis='Y', verts=8, bevel=0)
def ferrule(x, y, ax):
    cyl(0.062, 0.09, (x, y, HH), BRASS, axis=ax, verts=6, bevel=0.006)
    cyl(0.05, 0.03, (x + (0.05 if ax == 'X' and x > 0 else -0.05 if ax == 'X' else 0), y + (0.05 if ax == 'Y' and y > 0 else -0.05 if ax == 'Y' else 0), HH), STEEL, axis=ax, verts=6, bevel=0)
def stand(x, y):
    block((0.08, 0.08, HH - 0.08), (x, y, (HH - 0.08) / 2 + 0.06), RAILD, 0.01)
    block((0.16, 0.1, 0.05), (x, y, HH - 0.06), FOOT, 0.01)                                  # hose saddle
    block((0.16, 0.16, 0.03), (x, y, 0.075), FOOT, 0.006)

def gauge(x, y, z, facing='-Y'):
    ax = facing.strip('-'); s = -1 if facing.startswith('-') else 1
    cyl(0.055, 0.03, (x, y, z), FOOT, axis=ax, verts=8, bevel=0)
    o = (s * 0.018, 0, 0) if ax == 'X' else (0, s * 0.018, 0)
    cyl(0.045, 0.01, (x + o[0], y + o[1], z), 'cream', axis=ax, verts=8, bevel=0)

def rib_box(size, loc, m, ribs=3, axis='x'):
    """A cast housing with raised stiffening ribs."""
    block(size, loc, m, 0.03)
    sx, sy, sz = size; x, y, z = loc
    for k in range(ribs):
        t = -0.5 + (k + 1) / (ribs + 1)
        if axis == 'x': block((0.03, sy + 0.03, sz * 0.8), (x + t * sx, y, z), m, 0.008)
        else: block((sx + 0.03, 0.03, sz * 0.8), (x, y + t * sy, z), m, 0.008)

# ---------------------------------------------------------------------------
def motor_part():
    pad(1.0, 0.7)
    block((0.72, 0.42, 0.08), (-0.05, 0, 0.14), RAILD, 0.01)                                # motor base frame
    for x in (-0.3, 0.2): block((0.1, 0.36, HS - 0.42), (x, 0, 0.18 + (HS - 0.42) / 2), BLUED, 0.012)   # feet
    cyl(0.24, 0.58, (-0.05, 0, HS), BLUE, axis='X', verts=10, bevel=0.015)
    for k in range(5): cyl(0.262, 0.03, (-0.28 + k * 0.11, 0, HS), BLUE, axis='X', verts=10, bevel=0)   # cooling fins
    cyl(0.2, 0.1, (-0.4, 0, HS), FOOT, axis='X', verts=10, bevel=0.01)                     # fan cowl
    for k in range(3): block((0.012, 0.3, 0.02), (-0.455, 0, HS - 0.08 + k * 0.08), STEEL, 0.0)
    cyl(0.13, 0.06, (0.27, 0, HS), BLUED, axis='X', verts=10, bevel=0.01)                   # drive-end bearing cap
    block((0.2, 0.16, 0.14), (-0.05, -0.05, HS + 0.3), FOOT, 0.015)                         # terminal box
    block((0.12, 0.012, 0.07), (-0.05, -0.135, HS + 0.31), STEEL, 0.0)
    pipe([(-0.05, -0.14, HS + 0.28), (-0.05, -0.32, HS + 0.2), (-0.05, -0.33, 0.1)], 0.025, FOOT, bend=0.05)   # cable down to the riser
    block((0.14, 0.14, 0.12), (-0.05, -0.33, 0.12), FOOT, 0.01)
    block((0.14, 0.02, 0.08), (-0.1, -0.245, HS + 0.06), 'cream', 0.0)                      # nameplate
    block((0.16, 0.24, 0.04), (0.42, 0, HS + 0.13), ORANGE, 0.008)                          # coupling guard over the output
    for sy in (-1, 1): block((0.16, 0.03, 0.17), (0.42, sy * 0.12, HS + 0.03), ORANGE, 0.006)

def engine_part():
    pad(1.0, 0.8)
    block((0.82, 0.6, 0.06), (-0.08, 0, 0.13), RAILD, 0.01)
    block((0.62, 0.46, 0.42), (-0.08, 0, 0.37), ORANGE, 0.03)                                # crankcase and block
    block((0.56, 0.36, 0.14), (-0.08, 0, 0.65), ORANGE_D, 0.02)                              # cylinder head
    for x in (-0.26, -0.08, 0.1): block((0.12, 0.3, 0.06), (x, 0, 0.75), FOOT, 0.012)        # valve covers
    for x in (-0.26, -0.08, 0.1): cyl(0.03, 0.12, (x, 0.24, 0.62), STEEL, axis='Y', verts=6, bevel=0)   # injector pipes
    pipe([(-0.26, 0.18, 0.62), (-0.08, 0.2, 0.62), (0.1, 0.18, 0.62)], 0.03, '#6f767b', bend=0.04)       # exhaust manifold
    pipe([(-0.08, 0.2, 0.62), (-0.3, 0.16, 0.7), (-0.3, 0.15, 0.9)], 0.04, '#6f767b', bend=0.06)
    cyl(0.08, 0.36, (-0.3, 0.15, 1.08), '#6f767b', verts=8, bevel=0.01)                      # muffler
    cyl(0.05, 0.1, (-0.3, 0.15, 1.31), FOOT, verts=8, bevel=0)
    block((0.1, 0.5, 0.5), (-0.5, 0, 0.42), FOOT, 0.015)                                     # radiator
    for k in range(5): block((0.02, 0.42, 0.03), (-0.56, 0, 0.24 + k * 0.08), STEEL, 0.0)
    block((0.3, 0.2, 0.22), (-0.1, -0.36, 0.28), RED, 0.02)                                  # fuel tank
    cyl(0.04, 0.04, (-0.18, -0.36, 0.41), FOOT, verts=8, bevel=0)
    cyl(0.08, 0.16, (0.1, -0.28, 0.82), STEEL, verts=8, bevel=0.01)                          # air filter
    pipe([(0.1, -0.2, 0.8), (0.1, -0.1, 0.72)], 0.03, FOOT, bend=0)
    cyl(0.25, 0.1, (0.26, 0, HS - 0.04), ORANGE_D, axis='X', verts=10, bevel=0.01)           # flywheel housing
    block((0.08, 0.3, 0.3), (0.3, 0, HS - 0.06), RAILD, 0.01)
    block((0.16, 0.06, 0.12), (0.2, -0.26, 0.42), FOOT, 0.01)                                # starter
    gauge(-0.4, -0.27, 0.62)

def wind_part():
    """Lattice wind-pump tower; the game's head (rotor and tail) and vertical shaft stay and turn."""
    H = 4.2
    pad(1.1, 1.1)
    legs = [(-0.42, -0.42), (0.42, -0.42), (0.42, 0.42), (-0.42, 0.42)]
    for x, y in legs:
        bar(Vector((x, y, 0.06)), Vector((x * 0.25, y * 0.25, H)), 0.07, 0.07, RAILD)
        block((0.18, 0.18, 0.12), (x, y, 0.1), CONCD, 0.02); bolt((x, y, 0.16), 'Z', 0.02, 0.012, 'steel')
    for k in range(4):
        z0, z1 = 0.5 + k * 0.9, 0.5 + (k + 1) * 0.9
        s0, s1 = 1 - (z0 / H) * 0.75, 1 - (min(z1, H) / H) * 0.75
        for i in range(4):
            (ax, ay), (bx, by) = legs[i], legs[(i + 1) % 4]
            bar(Vector((ax * 0.42 / 0.42 * s0, ay * s0, z0)), Vector((bx * s0, by * s0, z0)), 0.04, 0.04, RAIL)
            if z1 <= H - 0.3: bar(Vector((ax * s0, ay * s0, z0)), Vector((bx * s1, by * s1, z1)), 0.03, 0.03, RAIL)
    block((0.5, 0.5, 0.05), (0, 0, H - 0.12), RAILD, 0.01)                                   # top platform
    block((0.36, 0.36, 0.2), (0, 0, H + 0.08), FOOT, 0.02)                                   # turntable bearing
    cyl(0.2, 0.05, (0, 0, H + 0.2), RAILD, verts=8, bevel=0)
    for k in range(10):                                                                     # ladder up the south-east leg
        z = 0.3 + k * 0.36; s = 1 - (z / H) * 0.75
        bar(Vector((0.42 * s - 0.03, -0.42 * s - 0.03, z)), Vector((0.42 * s + 0.03, -0.42 * s + 0.03, z)), 0.02, 0.02, CAP)
    # ground gearbox with its output on the east face
    rib_box((0.4, 0.4, 0.44), (0, 0, 0.3), GRND, 2)
    block((0.46, 0.46, 0.05), (0, 0, 0.54), FOOT, 0.01)
    block((0.22, 0.24, 0.24), (0.25, 0, HS - 0.05), GRND, 0.02)
    cyl(0.08, 0.06, (0.36, 0, HS), FOOT, axis='X', verts=8, bevel=0)
    gauge(0.0, -0.215, 0.36)

def gearbox_part(kind):
    big = kind != 'bevel'
    col = GRN if kind == 'stepup' else '#d9a326' if kind == 'reducer' else '#9aa2a8'
    pad(1.0, 1.0 if kind == 'bevel' else 0.5)
    w, d = (0.5, 0.44) if big else (0.44, 0.44)
    rib_box((w, d, HS + 0.08), (0, 0, (HS + 0.08) / 2 + 0.06), col, 3)
    block((w + 0.06, d + 0.06, 0.05), (0, 0, 0.09), FOOT, 0.01)                              # mounting flange
    block((w + 0.04, d + 0.04, 0.04), (0, 0, HS + 0.12), FOOT, 0.01)                         # split line
    block((w * 0.6, d * 0.6, 0.06), (0, 0, HS + 0.17), col, 0.015)                           # inspection cover
    for sx in (-1, 1):
        for sy in (-1, 1): bolt((sx * w * 0.25, sy * d * 0.25, HS + 0.2), 'Z', 0.015, 0.01, 'steel')
    cyl(0.02, 0.06, (w * 0.3, d * 0.3, HS + 0.23), FOOT, verts=6, bevel=0)                   # breather
    cyl(0.1, 0.06, (-w / 2 - 0.02, 0, HS), FOOT, axis='X', verts=8, bevel=0.01)              # input bearing cap
    if kind == 'bevel': cyl(0.1, 0.06, (0, -d / 2 - 0.02, HS), FOOT, axis='Y', verts=8, bevel=0.01)
    else: cyl(0.1, 0.06, (w / 2 + 0.02, 0, HS), FOOT, axis='X', verts=8, bevel=0.01)
    glow(cyl(0.035, 0.012, (0.1, -d / 2 - 0.006, 0.3), '#7fd8ff', axis='Y', verts=8, bevel=0, name='sight'), '#7fd8ff', 0.6)   # oil sight glass
    pillow(-0.42)
    if kind == 'bevel': block((0.16, 0.16, HS - 0.16), (0, -0.42, (HS - 0.16) / 2 + 0.06), RAILD, 0.015)   # output-side support
    else: pillow(0.42)
    # a ratio plate on the front: three bars for 3:1, a tall arrow for the step-up
    if kind == 'reducer':
        for k in range(3): block((0.04, 0.012, 0.1 - k * 0.025), (-0.08 + k * 0.08, -d / 2 - 0.02, 0.52), FOOT, 0.0)
    elif kind == 'stepup':
        cyl(0.07, 0.012, (0, -d / 2 - 0.02, 0.52), CAP, axis='Y', verts=3, bevel=0, rot=(math.pi / 2, 0, 0))
        block((0.03, 0.012, 0.12), (0, -d / 2 - 0.02, 0.44), CAP, 0.0)

def clutch_part():
    pad(1.0, 0.5)
    pillow(-0.35); pillow(0.35)
    cyl(0.2, 0.06, (-0.06, 0, HS), RAILD, axis='X', verts=10, bevel=0.01)                   # fixed driving disc
    for k in range(6): a = k / 6 * math.tau; bolt((-0.1, math.cos(a) * 0.14, HS + math.sin(a) * 0.14), '-X', 0.015, 0.01, 'steel')
    vault(0.26, 0.02, 0.3, (0, 0, HS), ORANGE, 6).rotation_euler = (0, 0, math.pi / 2)        # top guard over the discs
    block((0.14, 0.14, 0.4), (0.15, -0.3, 0.26), FOOT, 0.01)                                 # lever pedestal

def pack_part():
    pad(1.0, 0.8)
    block((0.7, 0.56, 0.48), (-0.05, 0, 0.32), RED, 0.03)                                    # oil tank
    block((0.74, 0.6, 0.04), (-0.05, 0, 0.58), FOOT, 0.01)
    for sx in (-1, 1): block((0.04, 0.58, 0.4), (-0.05 + sx * 0.25, 0, 0.32), REDD, 0.006)
    motor(-0.12, 0, 0.78, 'X', BLUE, 0.4, 0.15)
    block((0.18, 0.2, 0.22), (0.2, 0, 0.72), RAILD, 0.015)                                   # pump bell housing
    cyl(0.06, 0.04, (-0.3, -0.18, 0.62), 'cream', verts=8, bevel=0)                          # filler cap
    cyl(0.05, 0.16, (0.25, 0.18, 0.67), STEEL, verts=8, bevel=0.01)                          # return filter
    block((0.2, 0.16, 0.12), (0.3, -0.12, HH + 0.04), FOOT, 0.01)                            # valve manifold
    gauge(0.3, -0.2, HH + 0.18)
    pipe([(0.24, 0.0, 0.62), (0.3, -0.05, 0.5), (0.36, 0.0, HH)], 0.03, 'rubber', bend=0.04)
    block((0.12, 0.12, 0.12), (0.36, 0, HH), FOOT, 0.01); hose_x(0.42, 0.6); ferrule(0.56, 0, 'X')
    glow(block((0.03, 0.012, 0.3), (-0.3, -0.285, 0.33), '#58e0ff', 0.0, name='sight'), '#58e0ff', 0.7)   # level glass
    block((0.12, 0.12, 0.5), (-0.35, 0.32, 0.31), FOOT, 0.01)                                # cable riser

def pump_part():
    pad(1.0, 0.5)
    pillow(-0.35)
    cyl(0.17, 0.3, (0.05, 0, HS - 0.05), CAP, axis='X', verts=10, bevel=0.015)              # gear pump
    for k in range(4): a = k / 4 * math.tau + math.pi / 4; bolt((0.21, math.cos(a) * 0.11, HS - 0.05 + math.sin(a) * 0.11), 'X', 0.016, 0.01, 'steel')
    block((0.22, 0.3, HS - 0.24), (0.05, 0, (HS - 0.24) / 2 + 0.06), RAILD, 0.012)
    block((0.08, 0.08, 0.1), (0.05, -0.18, HS - 0.05), FOOT, 0.01)                           # suction port
    pipe([(0.2, 0, HS - 0.1), (0.36, 0, HS - 0.12), (0.4, 0, HH)], 0.04, 'rubber', bend=0.05)
    hose_x(0.38, 0.6); ferrule(0.56, 0, 'X'); stand(0.45, 0)

def hose_part(kind):
    block((1.0 if kind == 'hose' else 0.6, 0.3 if kind == 'hose' else 0.6, 0.05), (0, 0, 0.025), RAILD, 0.01)
    stand(0, 0)
    hose_x(-0.6, 0.04); ferrule(-0.56, 0, 'X')
    if kind != 'corner': hose_x(-0.04, 0.6); ferrule(0.56, 0, 'X')
    if kind != 'hose':
        hose_y(-0.6, 0.04); ferrule(0, -0.56, 'Y')
        block((0.14, 0.14, 0.14), (0, 0, HH), BRASS, 0.015)                                  # fitting block
        for sx in (-1, 1): bolt((sx * 0.05, 0, HH + 0.07), 'Z', 0.012, 0.008, 'steel')
    if kind == 'hose':
        stand(-0.4, 0); stand(0.4, 0)
        for x in (-0.2, 0.2): block((0.05, 0.1, 0.1), (x, 0, HH), FOOT, 0.006)               # hose clamps

def valve_part():
    block((1.0, 0.3, 0.05), (0, 0, 0.025), RAILD, 0.01); stand(-0.4, 0); stand(0.4, 0)
    hose_x(-0.6, -0.12); hose_x(0.12, 0.6); ferrule(-0.56, 0, 'X'); ferrule(0.56, 0, 'X')
    block((0.24, 0.2, 0.2), (0, 0, HH), RED, 0.02)                                           # ball valve body
    for sx in (-1, 1): cyl(0.08, 0.04, (sx * 0.12, 0, HH), REDD, axis='X', verts=8, bevel=0.005)
    cyl(0.035, 0.18, (0, 0, HH + 0.18), STEEL, verts=6, bevel=0)                             # stem up to the game's handle
    block((0.12, 0.012, 0.08), (0, -0.106, HH + 0.02), 'cream', 0.0)

def accum_part():
    block((0.7, 0.7, 0.05), (0, 0, 0.025), RAILD, 0.01)
    hose_x(-0.6, 0.6); ferrule(-0.56, 0, 'X'); ferrule(0.56, 0, 'X'); stand(-0.4, 0); stand(0.4, 0)
    block((0.14, 0.14, 0.14), (0, 0, HH), BRASS, 0.015)
    cyl(0.07, 0.12, (0, 0, HH + 0.12), STEEL, verts=8, bevel=0)
    cyl(0.21, 1.05, (0, 0, 0.95), ORANGE, verts=10, bevel=0.02)                             # bladder vessel
    cyl(0.215, 0.06, (0, 0, 0.5), ORANGE_D, verts=10, bevel=0)
    cyl(0.21, 0.12, (0, 0, 1.53), ORANGE, verts=10, bevel=0.03, r2=0.12)                     # domed top
    cyl(0.04, 0.08, (0, 0, 1.63), BRASS, verts=6, bevel=0)                                   # gas valve
    for a in (0.6, 2.2, 3.8, 5.4): bar(Vector((math.cos(a) * 0.32, math.sin(a) * 0.32, 0.05)), Vector((math.cos(a) * 0.21, math.sin(a) * 0.21, 0.75)), 0.04, 0.04, RAILD)
    ring(0.23, 0.02, (0, 0, 0.75), RAILD, axis='Z', segs=8)                                  # clamp band
    gauge(0, -0.215, 1.2)

def bin_part():
    """Supply bin: a ribbed steel silo on braced legs, a screw feeder carrying stock east down onto the belt."""
    pad(1.0, 1.0)
    for x, y in [(-0.38, -0.38), (0.38, -0.38), (0.38, 0.38), (-0.38, 0.38)]:
        block((0.08, 0.08, 1.2), (x, y, 0.66), RAILD, 0.01)
        block((0.16, 0.16, 0.04), (x, y, 0.08), FOOT, 0.006)
    for sy in (-1, 1): bar(Vector((-0.38, sy * 0.38, 0.12)), Vector((0.38, sy * 0.38, 0.75)), 0.03, 0.03, RAIL)
    for sx in (-1, 1): bar(Vector((sx * 0.38, -0.38, 0.12)), Vector((sx * 0.38, 0.38, 0.75)), 0.03, 0.03, RAIL)
    block((0.92, 0.92, 0.62), (0, 0, 1.55), CAP, 0.03)                                      # bin body
    for k in range(3):
        t = -0.36 + k * 0.36                                                               # clear of the level gauge
        for sy in (-1, 1): block((0.04, 0.03, 0.6), (t, sy * 0.47, 1.55), '#d9a326', 0.006)   # stiffening ribs
        for sx in (-1, 1): block((0.03, 0.04, 0.6), (sx * 0.47, t, 1.55), '#d9a326', 0.006)
    block((0.98, 0.98, 0.06), (0, 0, 1.88), '#d9a326', 0.015)                                # top rim
    block((0.5, 0.5, 0.04), (0.1, 0.1, 1.92), RAILD, 0.01)                                  # loading hatch
    cyl(0.03, 0.08, (0.3, 0.1, 1.95), FOOT, axis='Y', verts=6, bevel=0)
    cyl(0.16, 0.4, (0, 0, 1.05), '#d9a326', verts=4, bevel=0.01, r2=0.65, rot=(0, 0, math.pi / 4))   # hopper cone, narrow at the outlet
    block((0.22, 0.22, 0.12), (0, 0, 0.82), RAILD, 0.015)
    # screw feeder: tube from the outlet down to the belt, motor on the top end
    pipe([(0, 0, 0.82), (0.32, 0, 0.72), (0.56, 0, BY + 0.14)], 0.065, STEEL, bend=0.06)
    block((0.12, 0.16, 0.08), (0.56, 0, BY + 0.1), RAILD, 0.01)                             # discharge spout
    motor(-0.2, 0, 0.82, 'X', BLUE, 0.22, 0.08)
    block((0.3, 0.012, 0.18), (-0.15, -0.466, 1.62), 'cream', 0.0)                          # material placard

def pallet_part():
    """Sales pallet with a price post; the game stacks the sold units on it."""
    for y in (-0.38, 0.0, 0.38):
        for x in (-0.42, 0.0, 0.42): block((0.14, 0.12, 0.1), (x, y, 0.05), WOODD, 0.008)     # blocks
        block((1.0, 0.12, 0.03), (0, y, 0.115), WOODD, 0.006)                                 # stringers
    for k in range(7): block((0.13, 0.9, 0.03), (-0.43 + k * 0.143, 0, 0.145), WOOD if k % 2 == 0 else '#c0935c', 0.004)   # deck at the game's load height
    block((0.06, 0.06, 0.7), (0.46, 0.42, 0.4), RAILD, 0.008)                               # price post
    block((0.02, 0.26, 0.18), (0.46, 0.42, 0.74), CAP, 0.008)
    glow(block((0.012, 0.18, 0.08), (0.45, 0.42, 0.74), '#7fe8b0', 0.0, name='screen'), '#7fe8b0', 1.2)
    block((0.24, 0.24, 0.04), (0.46, 0.42, 0.02), FOOT, 0.006)

def proc_frame():
    pad(1.1, 1.1)
    block((0.84, 1.2, 0.08), (0.1, 0, BY - 0.1), RAILD, 0.012)                               # infeed/outfeed table, N to S
    for sy in (-1, 1):
        for x in (0.45, -0.25): block((0.07, 0.07, BY - 0.18), (x, sy * 0.5, (BY - 0.18) / 2 + 0.06), RAILD, 0.008)
    for sx in (-1, 1): block((0.05, 1.2, 0.06), (0.1 + sx * 0.4, 0, BY - 0.03), CAP, 0.008)    # side guides

def mill_part():
    proc_frame()
    cyl(0.34, 0.44, (0.12, 0, BY + 0.34), GRN, axis='X', verts=10, bevel=0.015)              # rotor drum
    for sx in (-1, 1): cyl(0.36, 0.04, (0.12 + sx * 0.2, 0, BY + 0.34), GRND, axis='X', verts=10, bevel=0)
    for k in range(8): a = k / 8 * math.tau; bolt((0.34, math.cos(a) * 0.26, BY + 0.34 + math.sin(a) * 0.26), 'X', 0.014, 0.01, 'steel')
    block((0.5, 0.5, 0.3), (0.12, 0, BY + 0.06), GRND, 0.02)                                 # discharge chute
    cyl(0.12, 0.32, (0.12, 0.1, BY + 0.82), STEEL, verts=4, bevel=0.01, r2=0.3, rot=(0, 0, math.pi / 4))   # feed hopper
    block((0.4, 0.4, 0.04), (0.12, 0.1, BY + 0.99), RAILD, 0.01)
    vent((0.12, -0.36, BY + 0.34), 0.3, 0.2, '-Y', 3, GRND, STEEL)
    pillow(-0.42)
    bar(Vector((-0.42, 0.0, HS)), Vector((-0.22, 0.0, BY + 0.34)), 0.06, 0.03, 'rubber')    # drive belt to the game's pulley
    block((0.36, 0.04, 0.5), (-0.32, -0.16, BY + 0.12), ORANGE, 0.008)                      # belt guard
    stack_light(0.4, 0.4, BY + 0.6)

def hyd_machine(long):
    proc_frame()
    z = BY + (0.62 if long else 0.3)
    if long:
        block((0.56, 1.1, 0.5), (0.12, 0, BY + 0.25), GRN, 0.03)                            # bale chamber
        for k in range(3): block((0.6, 0.04, 0.54), (0.12, -0.4 + k * 0.4, BY + 0.25), GRND, 0.008)   # chamber hoops
        block((0.4, 0.8, 0.02), (0.12, -0.1, BY + 0.51), FOOT, 0.0)                         # open top slot
        for k in range(4): block((0.012, 0.6, 0.06), (0.0 + k * 0.08, -0.1, BY + 0.52), STEEL, 0.0)   # twine needles
    else:
        block((0.24, 1.1, 0.12), (0.12, 0, BY + 0.06), RAILD, 0.012)                        # splitting beam
        block((0.12, 0.08, 0.4), (0.12, -0.38, BY + 0.32), RED, 0.01)                        # wedge
        for sx in (-1, 1): block((0.04, 0.2, 0.3), (0.12 + sx * 0.12, -0.38, BY + 0.3), REDD, 0.006)
        for sx in (-1, 1): block((0.04, 0.9, 0.16), (0.12 + sx * 0.18, 0.05, BY + 0.14), CAP, 0.006)   # log cradles
    cyl(0.1, 0.6, (0.12, 0.25, z), CAP, axis='Y', verts=8, bevel=0.01)                       # cylinder barrel
    for y in (0.0, 0.5): cyl(0.12, 0.05, (0.12, y, z), '#d9a326', axis='Y', verts=8, bevel=0)
    block((0.14, 0.1, z - 0.2), (0.05, 0.5, (z - 0.2) / 2 + 0.1), RAILD, 0.012)              # rear trunnion post
    block((0.12, 0.12, 0.12), (-0.33, 0, HH), FOOT, 0.01); hose_x(-0.6, -0.28); ferrule(-0.56, 0, 'X')
    pipe([(-0.3, 0, HH), (-0.1, 0.3, HH + 0.1), (0.05, 0.5, z)], 0.035, 'rubber', bend=0.06)
    gauge(-0.3, -0.07, HH + 0.14)

MODELS = {'pp_motor': motor_part, 'pp_engine': engine_part, 'pp_wind': wind_part, 'pp_shaft': lambda: (pad(1.0, 0.36), pillow(-0.3), pillow(0.3)),
          'pp_bevel': lambda: gearbox_part('bevel'), 'pp_reducer': lambda: gearbox_part('reducer'), 'pp_stepup': lambda: gearbox_part('stepup'),
          'pp_clutch': clutch_part, 'pp_pack': pack_part, 'pp_pump': pump_part, 'pp_hose': lambda: hose_part('hose'), 'pp_corner': lambda: hose_part('corner'),
          'pp_tee': lambda: hose_part('tee'), 'pp_valve': valve_part, 'pp_accum': accum_part, 'pp_bin': bin_part, 'pp_pallet': pallet_part,
          'pp_mill': mill_part, 'pp_baler': lambda: hyd_machine(True), 'pp_splitter': lambda: hyd_machine(False)}

if __name__ == '__main__':
    out, prefix = args()
    only = os.environ.get('ONLY')
    for name, fn in MODELS.items():
        if only and name not in only.split(','): continue
        reset(); fn(); export(os.path.join(out, name + '.glb')); print('exported', name)
    if prefix:
        reset()
        names = list(MODELS)
        for k, name in enumerate(names):
            before = set(bpy.data.objects); MODELS[name]()
            for o in [o for o in bpy.data.objects if o not in before and o.parent is None]: o.location.x += (k % 5) * 1.6 - 3.2; o.location.y += -(k // 5) * 1.6 + 2.4
        preview(prefix + '_all.png', cam_loc=(7, -10, 8), target=(0, 0, 0.6), lens=34, size=(1600, 1100))
