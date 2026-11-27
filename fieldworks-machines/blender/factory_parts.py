# Fieldworks factory parts (low-poly, original designs): a conveyor family and four inline machines that straddle it.
#   conveyors (1 cell, 1.2 m): belt, bturn (right), bleft (left), split, merge, filter, sensor
#   machines (2 cells, 2.4 m): sawmill, stonecutter, smelter, packer
# The Fieldworks conveyor: arched steel side rails with a yellow guard cap and bolted end flanges (so sections read as
# joined where they meet), a dark rubber belt with edge strips and raised cleats running over end drums. Turns are
# powered tapered-roller curves; junctions are ball-transfer tables under a four-post head that shows what they do.
# Every moving part is a named node the game animates in step with the simulation:
#   cleats (scroll along x), drum0/drum1 (belt drums), troll0..6 (turn rollers, spin about their own x),
#   paddle (splitter diverter, swings about y), pusher (filter kicker, slides south), beacon (merger lamp, spins),
#   beam (sensor curtain), wheel/feed0/feed1/pulley/clamp (sawmill), carriage/blade (stone cutter),
#   glow/glow2/fan (smelter), press/arm (packer), lamp_g/a/r (stack lights).
# Blender coords: x = along the belt (game x), +y = game north, z up. Belt top at BY. Origin = centre of the footprint.
# Usage: blender -b --python factory_parts.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import kit
from kit import *
from kit import _finish
import bmesh

BY = 0.55; C = 1.2
RAIL = '#a9b0b5'; RAILD = '#7f878d'; CAP = '#f2bd2c'; FOOT = '#3b4045'; BELT = '#2f3336'; CLEAT = '#c9ced2'
GRN = '#3f8a4f'; GRND = '#2c6239'; WOOD = '#b0834f'; WOODD = '#82592f'; BRICK = '#a8442e'; CHAR = '#4a4f55'; COPPER = '#c27a3a'
STEEL = '#d7dbde'; STEELM = '#c3c9cd'; BLUE = '#3f6fb0'; BLUED = '#2f5487'; ORANGE = '#ea7a2c'; SLATE = '#5b7da6'; SLATED = '#4a6890'

# Materials by role: painted steel is satin with a little metal, bare steel is brighter and more metallic, rubber and
# wood are matte, the yellow guard paint is glossy. Same palette as before, only the surfaces read better.
ROLE = {RAIL: (0.42, 0.35), RAILD: (0.45, 0.4), CAP: (0.36, 0.05), '#d9a326': (0.38, 0.05), FOOT: (0.6, 0.25), BELT: (0.9, 0.0),
        CLEAT: (0.55, 0.1), STEEL: (0.3, 0.6), STEELM: (0.32, 0.55), 'steel': (0.3, 0.6), COPPER: (0.32, 0.7), WOOD: (0.8, 0.0),
        WOODD: (0.82, 0.0), 'rubber': (0.9, 0.0), BLUE: (0.4, 0.1), BLUED: (0.42, 0.1), GRN: (0.45, 0.08), GRND: (0.48, 0.08),
        CHAR: (0.7, 0.15), BRICK: (0.85, 0.0), SLATE: (0.42, 0.1), SLATED: (0.45, 0.12), ORANGE: (0.4, 0.05), '#2a2d30': (0.65, 0.3),
        '#6f767b': (0.5, 0.4), '#5a5f65': (0.5, 0.45), '#9aa2a8': (0.36, 0.5), '#8d969c': (0.32, 0.6), '#4a5056': (0.85, 0.0)}
_mat0 = kit.mat
def rmat(name, rough=None, metal=None, emit=0.0):
    r, m = ROLE.get(name, (0.5, 0.12))
    return _mat0(name, r if rough is None else rough, m if metal is None else metal, emit)
kit.mat = rmat; mat = rmat

def collect(fn):
    before = set(bpy.data.objects); fn(); return [o for o in bpy.data.objects if o not in before]
def node(name, loc, fn, rot_z=None):
    e = empty(name, loc); bpy.context.view_layer.update()
    for o in collect(fn):
        if o.parent is None and o is not e: o.parent = e; o.matrix_parent_inverse = e.matrix_world.inverted()
    if rot_z is not None: e.rotation_euler = (0, 0, rot_z)
    return e
def glow(o, col, k):
    o.data.materials.clear(); o.data.materials.append(mat(col, 0.4, 0.0, emit=k)); return o

def prism(poly, a0, a1, m, axis='y', name='prism', bevel=0.012):
    """Extrude a polygon given in (u, z) between a0 and a1 along `axis` ('y': u is x; 'x': u is y)."""
    bm = bmesh.new()
    P = lambda u, z, a: (u, a, z) if axis == 'y' else (a, u, z)
    v0 = [bm.verts.new(P(u, z, a0)) for u, z in poly]; v1 = [bm.verts.new(P(u, z, a1)) for u, z in poly]
    bm.faces.new(v0); bm.faces.new(list(reversed(v1)))
    n = len(poly)
    for k in range(n): bm.faces.new((v0[k], v0[(k + 1) % n], v1[(k + 1) % n], v1[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return _finish(o, m, bevel, 1)

def bar(p0, p1, w, h, m):
    d = (p1 - p0); u = Vector((-d.y, d.x, 0)).normalized() * w / 2; z = Vector((0, 0, h / 2))
    bm = bmesh.new(); vs = [bm.verts.new(p + o) for p in (p0, p1) for o in (u + z, -u + z, -u - z, u - z)]
    a, b = vs[:4], vs[4:]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    for k in range(4): bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('bar'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('bar', me); bpy.context.collection.objects.link(o); o.data.materials.append(mat(m)); return o

# ---------------------------------------------------------------------------
# conveyor construction
def rail_profile(L):
    h = BY - 0.02; a = L / 2
    return [(-a, 0), (-a + 0.17, 0), (-a + 0.3, 0.15), (a - 0.3, 0.15), (a - 0.17, 0), (a, 0), (a, h), (-a, h)]

def side_rail(L, side, along='x', c=0.0):
    """A conveyor side rail of length L on side +1/-1 of the belt, running along x (or along y when along='y').
    Each end carries a bolted flange: where two sections meet the flanges sit back to back like a real joint."""
    s = side; ax = 'y' if along == 'x' else 'x'
    t0, t1 = s * 0.4, s * 0.54
    prism(rail_profile(L), min(t0, t1), max(t0, t1), RAIL, ax)
    P = (lambda u, v, z: (c + u, s * v, z)) if along == 'x' else (lambda u, v, z: (s * v, c + u, z))
    S = (lambda a, b, h: (a, b, h)) if along == 'x' else (lambda a, b, h: (b, a, h))
    nrm = ('Y' if s > 0 else '-Y') if along == 'x' else ('X' if s > 0 else '-X')
    block(S(L, 0.05, 0.16), P(0, 0.385, BY - 0.12), RAILD, 0.008)                     # inner step lip under the belt edge
    block(S(L, 0.17, 0.06), P(0, 0.475, BY + 0.03), CAP, 0.015)                       # yellow guard cap
    for e in (-1, 1):
        u = e * (L / 2 - 0.016)
        block(S(0.032, 0.2, BY - 0.12), P(u, 0.47, (BY - 0.12) / 2 + 0.07), RAILD, 0.006)   # end flange
        for z in (0.17, BY - 0.13): bolt(P(u, 0.57, z), nrm, 0.017, 0.012, 'steel')
        block(S(0.22, 0.2, 0.05), P(e * (L / 2 - 0.1), 0.48, 0.025), FOOT, 0.012)            # foot pad
        bolt(P(e * (L / 2 - 0.1), 0.53, 0.05), 'Z', 0.018, 0.012, 'steel')                  # anchor bolt
    for u in [-L / 2 + 0.3 + k * 0.6 for k in range(int(L / 0.6 + 1e-6))]:
        bolt(P(u, 0.54, BY - 0.2), nrm, 0.024, 0.018, 'steel')
    if L > 2: block(S(0.06, 0.03, BY - 0.2), P(0, 0.555, (BY - 0.2) / 2 + 0.16), RAILD, 0.006)   # stiffener on long rails

def belt_deck(L, W=0.8):
    block((L - 0.12, W, 0.05), (0, 0, BY - 0.025), BELT, 0.006, name='belt')
    for sy in (-1, 1): block((L - 0.12, 0.03, 0.006), (0, sy * 0.355, BY + 0.003), '#4a5056', 0.0)   # belt edge strips
    for k, x in enumerate((-L / 2 + 0.06, L / 2 - 0.06)):
        def mk(x=x):
            cyl(0.06, W - 0.02, (x, 0, BY - 0.06), BELT, axis='Y', verts=8, bevel=0)          # belt wrapped over the drum
            for a in (0, math.pi):                                                              # splice marks show the drum turning
                block((0.03, W - 0.1, 0.012), (x + math.sin(a) * 0.06, 0, BY - 0.06 + math.cos(a) * 0.06), '#4a5056', 0.0, rot=(0, a, 0))
        node('drum%d' % k, (x, 0, BY - 0.06), mk)
    block((L - 0.16, 0.66, 0.03), (0, 0, BY - 0.19), RAILD, 0.006)                          # slider bed under the belt

def cleats(L):
    n = int((L - 0.48) / 0.24 + 1e-6) + 1
    def mk():
        for k in range(n): block((0.035, 0.66, 0.016), (-L / 2 + 0.12 + k * 0.24, 0, BY + 0.008), CLEAT, 0.004)
    node('cleats', (0, 0, BY), mk)

def straight(L=C, with_cleats=True):
    for s in (-1, 1): side_rail(L, s)
    for x in [(-L / 2 + 0.3 + k * 0.6) for k in range(max(1, int(L / 0.6 + 1e-6)))]: block((0.08, 0.8, 0.06), (x, 0, BY - 0.26), RAILD, 0.01)   # cross ties
    belt_deck(L)
    if with_cleats: cleats(L)

def corner_post(x, y, h=BY - 0.02):
    block((0.16, 0.16, h), (x, y, h / 2), RAIL, 0.02); block((0.22, 0.22, 0.05), (x, y, 0.025), FOOT, 0.012)
    block((0.18, 0.18, 0.06), (x, y, h + 0.04), CAP, 0.012)
    for z in (0.18, h - 0.1): block((0.17, 0.17, 0.03), (x, y, z), RAILD, 0.006)          # clamp bands

def square_rails(open_sides):
    """1 x 1 cell: rails on the closed sides, a post at each corner no rail holds, and a cap on each outer rail joint."""
    closed = {'N', 'S', 'E', 'W'} - set(open_sides)
    if 'N' in closed: side_rail(C, 1)
    if 'S' in closed: side_rail(C, -1)
    if 'E' in closed: side_rail(C, 1, 'y')
    if 'W' in closed: side_rail(C, -1, 'y')
    for sx, ex in ((-1, 'W'), (1, 'E')):
        for sy, ey in ((-1, 'S'), (1, 'N')):
            if ex in open_sides and ey in open_sides: corner_post(sx * 0.5, sy * 0.5)
            elif ex in closed and ey in closed: block((0.22, 0.22, 0.09), (sx * 0.475, sy * 0.475, BY + 0.04), CAP, 0.015)
    for sy in (-0.3, 0.3): block((0.94, 0.08, 0.06), (0, sy, BY - 0.26), RAILD, 0.01)

def turn(side):
    """Right turn (side=-1: W -> S) or left (side=+1: W -> N): a pan of tapered rollers fanning around the inner corner."""
    square_rails({'W', 'N' if side > 0 else 'S'})
    block((0.98, 0.98, 0.04), (0, 0, BY - 0.12), FOOT, 0.008)                               # roller pan
    cx, cy = -0.6, side * 0.6                                                                # the inner corner of the curve
    for k in range(7):
        a = math.radians(9 + k * 12)
        d = Vector((math.sin(a), -side * math.cos(a), 0))
        t0 = 0.22; t1 = min(0.98 / max(math.sin(a), 1e-3), 0.98 / max(math.cos(a), 1e-3), 1.22) - 0.05
        mid = Vector((cx, cy, 0)) + d * ((t0 + t1) / 2); z = BY - 0.036
        def mk(mid=mid, ln=t1 - t0):
            cyl(0.024, ln, (mid.x, mid.y, z), STEELM, axis='X', verts=8, bevel=0, r2=0.04)
            cyl(0.02, ln + 0.05, (mid.x, mid.y, z), FOOT, axis='X', verts=6, bevel=0)      # axle through the roller
        node('troll%d' % k, (mid.x, mid.y, z), mk, rot_z=math.atan2(d.y, d.x))
    # roller bearing bars along the two closed rails and an inner hub plate at the corner
    corner = Vector((cx, cy, 0))
    for k in range(3):
        a0, a1 = math.radians(8 + k * 28), math.radians(8 + (k + 1) * 28)
        p0 = corner + Vector((math.sin(a0), -side * math.cos(a0), 0)) * 0.2; p1 = corner + Vector((math.sin(a1), -side * math.cos(a1), 0)) * 0.2
        bar(Vector((p0.x, p0.y, BY - 0.05)), Vector((p1.x, p1.y, BY - 0.05)), 0.05, 0.05, RAILD)

def ball_deck():
    """Ball-transfer table: units roll any way across it."""
    block((0.96, 0.96, 0.04), (0, 0, BY - 0.04), '#9aa2a8', 0.006)
    for i in range(5):
        for j in range(5): cyl(0.03, 0.03, (-0.36 + i * 0.18, -0.36 + j * 0.18, BY - 0.012), STEEL, verts=6, bevel=0.008)
    block((0.7, 0.7, 0.05), (0, 0, BY - 0.3), RAILD, 0.01)

def head(icon):
    """Four-post junction head with a raised indicator deck and the mechanism that does the job underneath."""
    H = BY + 0.46
    for sx in (-1, 1):
        for sy in (-1, 1):
            block((0.14, 0.14, H - BY + 0.04), (sx * 0.5, sy * 0.5, (H + BY) / 2), RAIL, 0.02)
            block((0.1, 0.03, 0.18), (sx * 0.5, sy * 0.44, H - 0.1), RAILD, 0.006)              # gusset
    block((1.12, 1.12, 0.1), (0, 0, H + 0.06), CAP, 0.025)                                       # yellow frame
    block((0.9, 0.9, 0.1), (0, 0, H + 0.08), '#9aa2a8', 0.02)                                     # steel deck inset
    for sx in (-1, 1):
        for sy in (-1, 1): bolt((sx * 0.5, sy * 0.5, H + 0.11), 'Z', 0.03, 0.02, RAILD)
    for sx in (-1, 1): block((1.12, 0.06, 0.1), (0, sx * 0.53, H - 0.04), RAILD, 0.012)
    pipe([(0.5, 0.56, 0.1), (0.5, 0.56, H - 0.12), (0.3, 0.56, H - 0.08)], 0.018, FOOT, bend=0.04)   # cable conduit up a post
    Z = H + 0.145
    def arrow(x0, y0, x1, y1, col, w=0.09):
        a, b = Vector((x0, y0, Z)), Vector((x1, y1, Z)); d = (b - a); L = d.length; ang = math.atan2(d.y, d.x)
        sh = block((L - 0.12, w, 0.025), (a + d.normalized() * (L - 0.12) / 2), col, 0.004); sh.rotation_euler = (0, 0, ang)
        hd = cyl(0.13, 0.025, b - d.normalized() * 0.06, col, verts=3, bevel=0); hd.rotation_euler = (0, 0, ang)
    if icon == 'split':
        arrow(-0.35, 0, 0.0, 0, '#3fb85f'); arrow(0.0, 0, 0.0, 0.36, '#3fb85f'); arrow(0.0, 0, 0.0, -0.36, '#3fb85f')
        # diverter paddle hinged at the closed east side; its tip swings to close the side a unit must not take
        cyl(0.05, 0.3, (0.34, 0, BY + 0.15), RAILD, verts=8, bevel=0.006)
        def pad():
            block((0.34, 0.04, 0.12), (0.17, 0, BY + 0.08), ORANGE, 0.012)
            block((0.04, 0.05, 0.13), (0.01, 0, BY + 0.08), 'rubber', 0.008)
            cyl(0.04, 0.16, (0.34, 0, BY + 0.1), STEEL, verts=8, bevel=0.005)
        node('paddle', (0.34, 0, BY + 0.08), pad)
        block((0.22, 0.16, 0.14), (0.34, 0, H - 0.12), BLUE, 0.015)                              # actuator under the deck
        pipe([(0.34, 0, H - 0.2), (0.34, 0, BY + 0.3)], 0.02, STEEL, bend=0)
    elif icon == 'merge':
        arrow(-0.38, 0.3, 0.0, 0.02, '#3f86c6'); arrow(-0.38, -0.3, 0.0, -0.02, '#3f86c6'); arrow(-0.38, 0, 0.36, 0, '#3f86c6')
        # entry guides that funnel the two side belts toward the exit, and a turning amber beacon while it merges
        for sy in (-1, 1): bar(Vector((0.2, sy * 0.46, BY + 0.06)), Vector((0.42, sy * 0.3, BY + 0.06)), 0.04, 0.1, CAP)
        cyl(0.08, 0.04, (0.3, 0.3, Z + 0.01), FOOT, verts=8, bevel=0)
        def bc():
            glow(cyl(0.06, 0.12, (0.3, 0.3, Z + 0.09), '#ffb02e', verts=8, bevel=0, name='beacon_l'), '#ffb02e', 2.5)
            block((0.02, 0.1, 0.1), (0.3, 0.3, Z + 0.09), STEEL, 0.0)
        node('beacon', (0.3, 0.3, Z + 0.09), bc)
        cyl(0.07, 0.02, (0.3, 0.3, Z + 0.16), '#ffb02e', verts=8, bevel=0)
    elif icon == 'filter':
        arrow(-0.36, 0, 0.36, 0, '#9aa2a8'); arrow(0.0, 0, 0.0, -0.36, '#f0a030')
        cyl(0.13, 0.03, (-0.08, 0, Z + 0.01), '#f0a030', verts=3, bevel=0, rot=(0, 0, math.pi))
        block((0.3, 0.03, 0.16), (0, 0.565, H + 0.06), FOOT, 0.006)
        glow(block((0.24, 0.02, 0.1), (0, 0.58, H + 0.06), '#ffcf70', 0.0, name='screen'), '#ffcf70', 1.5)
        # scanner hood over the entry and a pneumatic kicker on the closed north rail that pushes sorted units south
        block((0.16, 0.7, 0.06), (-0.3, 0, H - 0.08), FOOT, 0.01)
        glow(block((0.04, 0.6, 0.012), (-0.3, 0, H - 0.115), '#7fe8ff', 0.0, name='scan'), '#7fe8ff', 2)
        block((0.3, 0.14, 0.12), (0, 0.47, BY + 0.14), BLUE, 0.015)
        cyl(0.03, 0.06, (0, 0.47, BY + 0.23), STEEL, verts=6, bevel=0)
        def push():
            block((0.34, 0.04, 0.12), (0, 0.32, BY + 0.07), ORANGE, 0.012)
            cyl(0.022, 0.34, (0, 0.5, BY + 0.1), STEEL, axis='Y', verts=8, bevel=0)
        node('pusher', (0, 0.32, BY + 0.07), push)

def sensor():
    straight()
    for sy in (-1, 1):
        block((0.12, 0.12, 0.62), (0, sy * 0.56, BY + 0.31), RAIL, 0.02)
        block((0.18, 0.1, 0.22), (0, sy * 0.49, BY + 0.38), FOOT, 0.02)             # emitter heads facing the belt
        cyl(0.04, 0.02, (0, sy * 0.435, BY + 0.38), '#ff5a48', axis='Y', verts=8, bevel=0)
        for z in (BY + 0.3, BY + 0.46): cyl(0.018, 0.012, (0, sy * 0.435, z), '#ff5a48', axis='Y', verts=6, bevel=0)
    block((0.16, 1.24, 0.1), (0, 0, BY + 0.66), CAP, 0.02)
    for sy in (-1, 1): bolt((0, sy * 0.56, BY + 0.72), 'Z', 0.025, 0.015, RAILD)
    glow(block((0.02, 0.86, 0.02), (0, 0, BY + 0.38), '#ff5a48', 0.0, name='beam'), '#ff5a48', 3)
    block((0.26, 0.16, 0.22), (0.12, 0.66, BY + 0.5), GRN, 0.02)                    # counter box with a display
    glow(block((0.18, 0.02, 0.1), (0.12, 0.745, BY + 0.53), '#7fe8b0', 0.0, name='screen'), '#7fe8b0', 1.5)
    pipe([(0.12, 0.62, BY + 0.38), (0.06, 0.6, BY + 0.2), (0.0, 0.6, BY + 0.12)], 0.014, FOOT, bend=0.03)

# ---------------------------------------------------------------------------
# machines: 2 cells long; the belt runs through a tunnel at belt height
L2 = 2 * C

def tunnel_frame(x, col, depth=0.14, top=BY + 0.62):
    """A chunky portal frame over the belt with rubber flaps hanging in it."""
    for sy in (-1, 1):
        block((depth, 0.16, top - BY + 0.06), (x, sy * 0.53, (top + BY) / 2 + 0.0), col, 0.02)
        bolt((x, sy * 0.61, BY + 0.12), 'Y' if sy > 0 else '-Y', 0.02, 0.012, 'steel')
    block((depth, 1.22, 0.14), (x, 0, top), col, 0.02)
    for k in range(6): block((0.012, 0.13, top - BY - 0.12), (x, -0.36 + k * 0.145, (top + BY) / 2 + 0.02), 'rubber', 0.002)

def stack_light(x, y, z):
    cyl(0.018, 0.16, (x, y, z + 0.08), RAILD, verts=6, bevel=0)
    for i, c in enumerate(('#3fd27a', '#ffb02e', '#ff5a48')):
        glow(cyl(0.04, 0.06, (x, y, z + 0.2 + i * 0.065), c, verts=8, bevel=0.004, name=('lamp_g', 'lamp_a', 'lamp_r')[i]), c, 0.6)
    cyl(0.042, 0.02, (x, y, z + 0.4), FOOT, verts=8, bevel=0)

def panel(x, y, z, side=-1, col=GRN):
    """Control box on a side face with a screen, three buttons and an e-stop."""
    block((0.34, 0.12, 0.3), (x, y, z), col, 0.02)
    glow(block((0.22, 0.02, 0.12), (x - 0.03, y + side * 0.065, z + 0.05), '#7fe8b0', 0.0, name='screen'), '#7fe8b0', 1.5)
    for i, c in enumerate(('green', 'yellow', 'red')): cyl(0.022, 0.03, (x - 0.1 + i * 0.07, y + side * 0.07, z - 0.08), c, axis='Y', verts=8, bevel=0)
    cyl(0.035, 0.03, (x + 0.12, y + side * 0.07, z - 0.07), '#d24a35', axis='Y', verts=8, bevel=0.006)

def motor(x, y, z, axis, col, L=0.36, r=0.13):
    """Electric motor: finned body, fan cowl and terminal box (axis 'X' or 'Y')."""
    cyl(r, L, (x, y, z), col, axis=axis, verts=10, bevel=0.01)
    for k in range(4):
        o = -L / 2 + 0.06 + k * (L - 0.12) / 3
        cyl(r + 0.015, 0.025, (x + (o if axis == 'X' else 0), y + (o if axis == 'Y' else 0), z), col, axis=axis, verts=10, bevel=0)
    e = -L / 2 - 0.05
    cyl(r * 0.92, 0.1, (x + (e if axis == 'X' else 0), y + (e if axis == 'Y' else 0), z), FOOT, axis=axis, verts=10, bevel=0.01)
    block((0.12, 0.1, 0.08), (x, y, z + r + 0.03), FOOT, 0.012)

def sawmill():
    """Green timber machine: spiked feed rollers and a hold-down clamp grip the log, a vertical band saw splits it,
    sawdust is pulled up to a cyclone."""
    straight(L2)
    tunnel_frame(-0.95, GRN); tunnel_frame(0.95, GRN)
    for k, x in enumerate((-0.72, -0.47)):
        def fr(x=x):
            cyl(0.07, 0.72, (x, 0, BY + 0.11), CAP, axis='Y', verts=8, bevel=0)
            for j in range(5): cyl(0.088, 0.03, (x, -0.28 + j * 0.14, BY + 0.11), RAILD, axis='Y', verts=6, bevel=0)
        node('feed%d' % k, (x, 0, BY + 0.11), fr)
        for sy in (-1, 1): block((0.1, 0.06, 0.22), (x, sy * 0.39, BY + 0.1), RAILD, 0.01)
    # hold-down clamp on a bracket off the housing
    block((0.26, 0.12, 0.08), (-0.69, 0, BY + 0.98), GRND, 0.012)
    cyl(0.06, 0.32, (-0.72, 0, BY + 0.78), BLUE, verts=8, bevel=0.008)
    def cl():
        cyl(0.025, 0.24, (-0.72, 0, BY + 0.5), STEEL, verts=8, bevel=0)
        block((0.22, 0.5, 0.05), (-0.72, 0, BY + 0.36), RAILD, 0.01)
        for sy in (-0.16, 0, 0.16): block((0.03, 0.03, 0.04), (-0.72, sy, BY + 0.32), 'steel', 0.004)
    node('clamp', (-0.72, 0, BY + 0.36), cl)
    # saw housing
    for sx in (-1, 1):
        for sy in (-1, 1): block((0.14, 0.14, 0.5), (sx * 0.5, sy * 0.53, BY + 0.25), GRND, 0.02)
    block((1.18, 1.14, 0.5), (0, 0, BY + 0.72), GRN, 0.04)
    block((1.24, 1.2, 0.06), (0, 0, BY + 0.47), GRND, 0.02)
    for x in (-0.45, -0.15, 0.15, 0.45): bolt((x, -0.6, BY + 0.53), '-Y', 0.018, 0.012, 'steel')
    vent((0.32, -0.57, BY + 0.72), 0.34, 0.26, '-Y', 4, RAILD, STEEL)
    panel(-0.25, -0.62, BY + 0.72)
    block((0.42, 0.02, 0.34), (0.15, 0.58, BY + 0.72), GRND, 0.006)                          # access door
    block((0.06, 0.03, 0.12), (0.32, 0.6, BY + 0.72), STEEL, 0.008)
    # band wheel cover and the spinning wheel on the south face
    cyl(0.46, 0.34, (0, 0.05, BY + 1.18), CAP, axis='Y', verts=10, bevel=0.02)
    cyl(0.4, 0.36, (0, 0.05, BY + 1.18), '#d9a326', axis='Y', verts=10, bevel=0)
    def wheel():
        cyl(0.36, 0.05, (0, -0.15, BY + 1.18), RAILD, axis='Y', verts=10, bevel=0.01)
        cyl(0.08, 0.08, (0, -0.17, BY + 1.18), FOOT, axis='Y', verts=8, bevel=0)
        for k in range(5):
            a = k / 5 * math.tau; block((0.05, 0.03, 0.3), (math.sin(a) * 0.16, -0.19, BY + 1.18 + math.cos(a) * 0.16), STEEL, 0.004, rot=(0, -a, 0))
    node('wheel', (0, -0.15, BY + 1.18), wheel)
    block((0.04, 0.02, 0.48), (0, -0.2, BY + 0.27), STEEL, 0.0)                              # the band blade through the tunnel
    block((0.1, 0.06, 0.1), (0, -0.2, BY + 0.05), RAILD, 0.01)                                 # lower blade guide
    # drive: blue motor on the north side, a pulley and a belt guard up to the wheel
    motor(-0.35, 0.42, BY + 1.05, 'X', BLUE)
    def pl():
        cyl(0.09, 0.05, (-0.1, 0.42, BY + 1.05), STEEL, axis='X', verts=8, bevel=0)
        block((0.055, 0.02, 0.16), (-0.1, 0.42, BY + 1.05), RAILD, 0.0)
    node('pulley', (-0.1, 0.42, BY + 1.05), pl)
    block((0.08, 0.1, 0.4), (-0.04, 0.38, BY + 1.18), CAP, 0.015)
    # sawdust extraction: a duct from the roof to a cyclone over a sawdust bin
    pipe([(0.35, 0.25, BY + 1.0), (0.35, 0.25, BY + 1.5), (0.7, 0.25, BY + 1.55), (0.82, 0.25, BY + 1.35)], 0.06, STEEL, bend=0.1)
    cyl(0.16, 0.3, (0.82, 0.25, BY + 1.22), STEEL, verts=8, bevel=0.01); cyl(0.05, 0.24, (0.82, 0.25, BY + 0.95), STEELM, verts=8, bevel=0, r2=0.16)
    for sy in (0.12, 0.38): block((0.04, 0.04, 0.5), (0.95, sy, BY + 0.7), RAILD, 0.006)
    cyl(0.07, 0.06, (0.82, 0.25, BY + 0.8), RAILD, verts=8, bevel=0)                          # sawdust bag on the cyclone
    cyl(0.11, 0.22, (0.82, 0.25, BY + 0.66), '#c9a46a', verts=6, bevel=0.03, r2=0.08)
    for sy in (-1, 1): block((0.5, 0.03, 0.05), (0.72, sy * 0.33, BY + 0.05), CAP, 0.006)     # plank guides on the exit
    stack_light(-0.45, 0.4, BY + 0.97)

def stonecutter():
    """Blue bridge saw: a gantry over the belt carries a traversing carriage with a water-cooled diamond blade."""
    straight(L2)
    tunnel_frame(-1.0, SLATE); tunnel_frame(1.0, SLATE)
    for sx in (-1, 1):
        for sy in (-1, 1):
            block((0.14, 0.14, 1.0), (sx * 0.55, sy * 0.56, BY + 0.5), SLATE, 0.02)
            block((0.2, 0.2, 0.05), (sx * 0.55, sy * 0.56, BY + 0.03), FOOT, 0.01)
        block((0.18, 1.28, 0.16), (sx * 0.55, 0, BY + 1.06), SLATED, 0.02)
        bar(Vector((sx * 0.55, -0.5, BY + 0.6)), Vector((sx * 0.55, -0.1, BY + 0.98)), 0.05, 0.05, SLATED)   # knee braces
        bar(Vector((sx * 0.55, 0.5, BY + 0.6)), Vector((sx * 0.55, 0.1, BY + 0.98)), 0.05, 0.05, SLATED)
    for sy in (-1, 1): block((1.28, 0.16, 0.14), (0, sy * 0.56, BY + 1.06), SLATED, 0.02)
    block((0.3, 1.2, 0.18), (0, 0, BY + 1.06), CAP, 0.02)
    for k in range(9): block((0.035, 0.05, 0.03), (0.17, -0.48 + k * 0.12, BY + 1.0), RAILD, 0.0)   # traverse rack
    def carriage():
        block((0.34, 0.36, 0.3), (0, -0.05, BY + 0.86), CAP, 0.03)
        motor(0, 0.25, BY + 0.86, 'Y', BLUE, 0.28, 0.11)
        def blade():
            cyl(0.32, 0.03, (0, -0.15, BY + 0.42), STEEL, axis='Y', verts=8, bevel=0)
            cyl(0.07, 0.06, (0, -0.15, BY + 0.42), FOOT, axis='Y', verts=8, bevel=0)
            for k in range(12): a = k / 12 * math.tau; block((0.06, 0.036, 0.03), (math.sin(a) * 0.32, -0.15, BY + 0.42 + math.cos(a) * 0.32), '#8d969c', 0.0, rot=(0, -a, 0))
        node('blade', (0, -0.15, BY + 0.42), blade)
        vault(0.38, 0.04, 0.12, (0, -0.15, BY + 0.42), ORANGE, 8).rotation_euler = (math.pi / 2, 0, 0)
        block((0.08, 0.1, 0.3), (0, -0.15, BY + 0.66), CAP, 0.01)
        cyl(0.05, 0.06, (0.17, -0.05, BY + 0.96), RAILD, axis='X', verts=8, bevel=0)                  # rack pinion housing
        pipe([(0.1, -0.05, BY + 1.0), (0.12, -0.22, BY + 0.9), (0.1, -0.24, BY + 0.72)], 0.02, 'water', bend=0.04)
        cyl(0.025, 0.05, (0.1, -0.24, BY + 0.69), STEEL, verts=6, bevel=0)                             # coolant nozzle
    node('carriage', (0, -0.05, BY + 0.86), carriage)
    # cooling water: a tank on the gantry, a coolant pump and a drag chain feeding the carriage
    cyl(0.22, 0.55, (0.55, 0.0, BY + 1.42), STEEL, verts=8, bevel=0.01)
    cyl(0.225, 0.14, (0.55, 0.0, BY + 1.36), 'water', verts=8, bevel=0)
    cyl(0.24, 0.05, (0.55, 0.0, BY + 1.72), RAILD, verts=8, bevel=0)
    for k in range(5): block((0.06, 0.08, 0.05), (0.32, -0.3 + k * 0.1, BY + 1.2), FOOT, 0.008)    # drag chain
    motor(-0.55, 0.0, BY + 1.22, 'Y', BLUED, 0.24, 0.08)
    # splash shields, slurry gutter on the rail, control box and stack light
    for sy in (-1, 1): block((1.0, 0.03, 0.4), (0, sy * 0.6, BY + 0.62), STEELM, 0.01)
    block((0.9, 0.1, 0.14), (0, -0.6, BY - 0.02), RAILD, 0.01); block((0.86, 0.06, 0.03), (0, -0.6, BY + 0.05), 'water', 0.004)
    pipe([(0.46, -0.6, BY - 0.08), (0.46, -0.6, 0.12), (0.62, -0.6, 0.05)], 0.025, SLATED, bend=0.04)   # slurry drain
    panel(-0.7, -0.66, BY + 0.85, -1, SLATE)
    stack_light(0.55, 0.56, BY + 1.14)

def smelter():
    """Charcoal induction furnace: a glowing mouth swallows ore, copper coils heat the crucible, a blower feeds air,
    ingots leave through the cooling tunnel."""
    straight(L2)
    tunnel_frame(1.02, CHAR)
    for sy in (-1, 1): block((1.5, 0.22, 0.75), (-0.2, sy * 0.52, BY + 0.36), CHAR, 0.04)
    block((1.5, 1.28, 0.55), (-0.2, 0, BY + 0.98), CHAR, 0.05)
    for z in (BY + 0.3, BY + 0.62, BY + 0.92):
        for sy in (-1, 1): block((1.52, 0.02, 0.07), (-0.2, sy * 0.64, z), BRICK, 0.004)
    for sx in (-0.95, 0.55):                                                                     # bolted corner angles
        for sy in (-1, 1):
            block((0.08, 0.08, 1.2), (sx, sy * 0.63, BY + 0.62), RAILD, 0.01)
            for z in (BY + 0.2, BY + 0.7, BY + 1.15): bolt((sx, sy * 0.675, z), 'Y' if sy > 0 else '-Y', 0.016, 0.01, 'steel')
    block((0.06, 0.82, 0.62), (-0.96, 0, BY + 0.34), '#2a2d30', 0.01)
    glow(block((0.04, 0.72, 0.5), (-0.94, 0, BY + 0.3), '#ff8a2a', 0.0, name='glow'), '#ff8a2a', 4)
    # crucible with copper induction coils
    cyl(0.36, 0.5, (-0.3, 0, BY + 1.5), '#5a5f65', verts=8, bevel=0.02)
    for z in (BY + 1.33, BY + 1.47, BY + 1.61): cyl(0.39, 0.06, (-0.3, 0, z), COPPER, verts=8, bevel=0.005)
    cyl(0.3, 0.06, (-0.3, 0, BY + 1.78), '#2a2d30', verts=8, bevel=0)
    glow(cyl(0.25, 0.02, (-0.3, 0, BY + 1.79), '#ffb03a', verts=8, bevel=0, name='glow2'), '#ffb03a', 3)
    block((0.4, 0.12, 0.08), (0.05, 0, BY + 1.62), '#5a5f65', 0.01)
    pipe([(-0.62, -0.25, BY + 1.3), (-0.62, -0.45, BY + 1.3), (-0.62, -0.62, BY + 1.0)], 0.03, COPPER, bend=0.05)   # coil bus bars
    pipe([(-0.5, -0.25, BY + 1.3), (-0.5, -0.45, BY + 1.3), (-0.5, -0.62, BY + 1.0)], 0.03, COPPER, bend=0.05)
    # ore hopper, chimney with a spark-arrestor cap
    cyl(0.14, 0.38, (-0.75, 0.25, BY + 1.45), CAP, verts=4, bevel=0.01, r2=0.34, rot=(0, 0, math.pi / 4))
    block((0.16, 0.16, 0.2), (-0.75, 0.25, BY + 1.2), RAILD, 0.01)
    cyl(0.17, 2.0, (0.35, 0.36, BY + 2.0), '#6f767b', verts=8, bevel=0)
    for z in (BY + 1.4, BY + 2.1, BY + 2.8): cyl(0.19, 0.08, (0.35, 0.36, z), CHAR, verts=8, bevel=0)
    cyl(0.23, 0.1, (0.35, 0.36, BY + 3.02), CHAR, verts=8, bevel=0.01)
    cyl(0.26, 0.12, (0.35, 0.36, BY + 3.18), RAILD, verts=4, bevel=0.01, r2=0.04, rot=(0, 0, math.pi / 4))
    for sx in (-1, 1): block((0.03, 0.03, 0.12), (0.35 + sx * 0.18, 0.36, BY + 3.1), RAILD, 0.0)
    for k in range(5): block((0.04, 0.02, 0.5), (-0.7 + k * 0.2, -0.66, BY + 0.98), '#6f767b', 0.004)
    # combustion-air blower on the south face, its duct into the furnace base
    FX, FY, FZ = 0.12, -0.42, BY + 1.47
    cyl(0.2, 0.14, (FX, FY, FZ), BLUE, axis='Y', verts=10, bevel=0.01)
    cyl(0.22, 0.02, (FX, FY - 0.08, FZ), STEEL, axis='Y', verts=10, bevel=0)
    def fan():
        cyl(0.05, 0.04, (FX, FY - 0.11, FZ), FOOT, axis='Y', verts=8, bevel=0)
        for k in range(5): a = k / 5 * math.tau; block((0.06, 0.012, 0.16), (FX + math.sin(a) * 0.09, FY - 0.105, FZ + math.cos(a) * 0.09), STEEL, 0.0, rot=(0.35, -a, 0))
    node('fan', (FX, FY - 0.11, FZ), fan)
    for k in range(4): block((0.42, 0.015, 0.02), (FX, FY - 0.125, FZ - 0.13 + k * 0.085), RAILD, 0.0)   # grille
    block((0.18, 0.16, 0.24), (FX, FY + 0.12, BY + 1.33), BLUED, 0.01)                                     # duct into the roof
    for sx in (-1, 1): block((0.04, 0.2, 0.16), (FX + sx * 0.17, FY, BY + 1.33), RAILD, 0.006)
    # cooling tunnel water sprays, ingot moulds by the exit, gauges and the stack light
    for x in (0.85, 1.15): pipe([(x, -0.5, BY + 0.62), (x, 0.5, BY + 0.62)], 0.018, 'water', bend=0)
    block((0.5, 0.26, 0.06), (0.68, -0.74, BY - 0.1), RAILD, 0.01)
    for k in range(3): block((0.12, 0.18, 0.06), (0.52 + k * 0.16, -0.74, BY - 0.04), '#b8c0c6', 0.008)
    for x in (-0.25, 0.0):
        cyl(0.06, 0.03, (x, -0.655, BY + 1.0), 'cream', axis='Y', verts=10, bevel=0); cyl(0.065, 0.02, (x, -0.65, BY + 1.0), FOOT, axis='Y', verts=10, bevel=0)
    stack_light(0.46, -0.52, BY + 1.26)

def packer():
    """Yellow crate packer: a robot arm sets an empty crate from the magazine, units drop in, the press closes the lid."""
    straight(L2)
    # magazine of empty crates on the north side
    block((0.62, 0.5, 0.06), (-0.55, 0.8, BY - 0.04), RAILD, 0.01)
    for x in (-0.82, -0.28):
        for y in (0.62, 0.98): block((0.05, 0.05, BY - 0.05), (x, y, (BY - 0.05) / 2), RAILD, 0.006)
        block((0.05, 0.4, 0.04), (x, 0.8, 0.12), RAILD, 0.006)
    for k in range(3):
        z = BY + 0.13 + k * 0.27
        block((0.42, 0.34, 0.26), (-0.55, 0.8, z), WOOD, 0.02)
        for sx in (-1, 1): block((0.03, 0.36, 0.28), (-0.55 + sx * 0.21, 0.8, z), WOODD, 0.004)
    # yellow portal frame and the press head that closes the crate
    for sx in (-1, 1):
        for sy in (-1, 1):
            block((0.14, 0.14, 1.15), (0.05 + sx * 0.5, sy * 0.56, BY + 0.58), CAP, 0.02)
            block((0.2, 0.2, 0.05), (0.05 + sx * 0.5, sy * 0.56, BY + 0.03), FOOT, 0.01)
    for sy in (-1, 1): block((1.14, 0.16, 0.14), (0.05, sy * 0.56, BY + 1.2), CAP, 0.02)
    block((0.3, 1.2, 0.18), (0.05, 0, BY + 1.2), '#d9a326', 0.02)
    cyl(0.1, 0.3, (0.05, 0, BY + 1.42), BLUE, verts=8, bevel=0.01)                                # press cylinder
    cyl(0.07, 0.4, (0.05, 0, BY + 0.98), STEEL, verts=8, bevel=0)
    for sx in (-1, 1): cyl(0.025, 0.5, (0.05 + sx * 0.16, 0, BY + 0.95), STEELM, verts=6, bevel=0)  # guide rods
    def press():
        block((0.46, 0.46, 0.08), (0.05, 0, BY + 0.62), RAILD, 0.015)
        cyl(0.04, 0.24, (0.05, 0, BY + 0.78), STEEL, verts=8, bevel=0)
        for sx in (-1, 1):
            for sy in (-1, 1): cyl(0.02, 0.06, (0.05 + sx * 0.18, sy * 0.18, BY + 0.56), FOOT, verts=6, bevel=0)
    node('press', (0.05, 0, BY + 0.62), press)
    # robot arm on a pedestal between the magazine and the belt
    cyl(0.1, 0.42, (-0.62, 0.48, BY + 0.27), RAILD, verts=8, bevel=0.01)
    cyl(0.14, 0.04, (-0.62, 0.48, BY + 0.08), FOOT, verts=8, bevel=0)
    def arm():
        cyl(0.13, 0.12, (-0.62, 0.48, BY + 0.54), ORANGE, verts=8, bevel=0.01)
        bar(Vector((-0.62, 0.48, BY + 0.6)), Vector((-0.62, 0.2, BY + 0.95)), 0.1, 0.1, ORANGE)
        cyl(0.07, 0.14, (-0.62, 0.2, BY + 0.95), FOOT, axis='X', verts=8, bevel=0)
        bar(Vector((-0.62, 0.2, BY + 0.95)), Vector((-0.62, 0.0, BY + 0.78)), 0.08, 0.08, ORANGE)
        block((0.2, 0.08, 0.05), (-0.62, 0.0, BY + 0.74), FOOT, 0.01)
        for sx in (-1, 1): block((0.03, 0.06, 0.12), (-0.62 + sx * 0.09, 0.0, BY + 0.66), STEEL, 0.004)
    node('arm', (-0.62, 0.48, BY + 0.54), arm)
    # lid stack, label printer, panel and stack light
    block((0.36, 0.34, 0.18), (0.75, 0.74, BY - 0.02), WOOD, 0.02)
    for k in range(3): block((0.36, 0.34, 0.03), (0.75, 0.74, BY + 0.09 + k * 0.035), WOODD if k % 2 else WOOD, 0.004)
    block((0.2, 0.14, 0.2), (0.55, -0.62, BY + 0.2), STEEL, 0.015); cyl(0.06, 0.12, (0.55, -0.62, BY + 0.34), 'cream', axis='Y', verts=8, bevel=0)
    panel(-0.7, -0.62, BY + 0.5, -1, '#d9a326')
    stack_light(0.55, -0.56, BY + 1.27)

MODELS = {'fw_belt': lambda: straight(), 'fw_bturn': lambda: turn(-1), 'fw_bleft': lambda: turn(1),
          'fw_split': lambda: (square_rails({'W', 'N', 'S'}), ball_deck(), head('split')), 'fw_merge': lambda: (square_rails({'W', 'N', 'S', 'E'}), ball_deck(), head('merge')),
          'fw_filter': lambda: (square_rails({'W', 'E', 'S'}), ball_deck(), head('filter')), 'fw_sensor': sensor,
          'fw_sawmill': sawmill, 'fw_stonecutter': stonecutter, 'fw_smelter': smelter, 'fw_packer': packer}

if __name__ == '__main__':
    out, prefix = args()
    only = os.environ.get('ONLY')
    for name, fn in MODELS.items():
        if only and name not in only.split(','): continue
        reset(); fn(); export(os.path.join(out, name + '.glb')); print('exported', name)
    if prefix:
        reset()
        lay = [('fw_belt', -4.2, 1.6), ('fw_bturn', -2.8, 1.6), ('fw_bleft', -1.4, 1.6), ('fw_split', 0.0, 1.6), ('fw_merge', 1.4, 1.6), ('fw_filter', 2.8, 1.6), ('fw_sensor', 4.2, 1.6),
               ('fw_sawmill', -4.2, -1.4), ('fw_stonecutter', -1.4, -1.4), ('fw_smelter', 1.4, -1.4), ('fw_packer', 4.2, -1.4)]
        for name, x, y in lay:
            before = set(bpy.data.objects); MODELS[name]()
            for o in [o for o in bpy.data.objects if o not in before and o.parent is None]: o.location.x += x; o.location.y += y
        preview(prefix + '_all.png', cam_loc=(9, -11, 9), target=(0, 0, 0.6), lens=34, size=(1600, 1100))
