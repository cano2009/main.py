# Fieldworks factory parts (low-poly, original designs): a conveyor family and four inline machines that straddle it.
#   conveyors (1 cell, 1.2 m): belt, bturn (right), bleft (left), split, merge, filter, sensor
#   machines (2 cells, 2.4 m): sawmill, stonecutter, smelter, packer
# The Fieldworks conveyor: arched steel side rails with a yellow guard cap, flared foot pads, octagonal bolts, a dark
# belt with raised light cleats. Junctions carry a four-post head with a coloured indicator deck.
# Animated nodes: cleats (scroll along x), wheel / blade (spin about the game z axis), press (moves down),
# beam (sensor light curtain), glow (furnace mouth).
# Blender coords: x = along the belt (game x), +y = game north, z up. Belt top at BY. Origin = centre of the footprint.
# Usage: blender -b --python factory_parts.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import *
from kit import _finish
import bmesh

BY = 0.55; C = 1.2
RAIL = '#a9b0b5'; RAILD = '#7f878d'; CAP = '#f2bd2c'; FOOT = '#3b4045'; BELT = '#2f3336'; CLEAT = '#c9ced2'
GRN = '#3f8a4f'; GRND = '#2c6239'; WOOD = '#b0834f'; WOODD = '#82592f'; BRICK = '#a8442e'; CHAR = '#4a4f55'; COPPER = '#c27a3a'

def collect(fn):
    before = set(bpy.data.objects); fn(); return [o for o in bpy.data.objects if o not in before]
def node(name, loc, fn):
    e = empty(name, loc)
    for o in collect(fn):
        if o.parent is None and o is not e: o.parent = e; o.matrix_parent_inverse = e.matrix_world.inverted()
    return e

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

def rail_profile(L):
    h = BY - 0.02; a = L / 2
    return [(-a, 0), (-a + 0.17, 0), (-a + 0.3, 0.15), (a - 0.3, 0.15), (a - 0.17, 0), (a, 0), (a, h), (-a, h)]

def side_rail(L, side, along='x', c=0.0):
    """A conveyor side rail of length L on side +1/-1 of the belt, running along x (or along y when along='y')."""
    s = side; ax = 'y' if along == 'x' else 'x'
    t0, t1 = s * 0.4, s * 0.54
    prism(rail_profile(L), min(t0, t1), max(t0, t1), RAIL, ax)
    # inner step lip, yellow guard cap, foot pads and bolts
    if along == 'x':
        block((L, 0.05, 0.16), (c, s * 0.385, BY - 0.12), RAILD, 0.008)
        block((L, 0.17, 0.06), (c, s * 0.475, BY + 0.03), CAP, 0.015)
        for x in (-L / 2 + 0.1, L / 2 - 0.1): block((0.22, 0.2, 0.05), (c + x, s * 0.48, 0.025), FOOT, 0.012)
        for x in [c - L / 2 + 0.3 + k * 0.6 for k in range(int(L / 0.6))]: bolt((x, s * 0.54, BY - 0.2), 'Y' if s > 0 else '-Y', 0.026, 0.02, 'steel')
    else:
        block((0.05, L, 0.16), (s * 0.385, c, BY - 0.12), RAILD, 0.008)
        block((0.17, L, 0.06), (s * 0.475, c, BY + 0.03), CAP, 0.015)
        for y in (-L / 2 + 0.1, L / 2 - 0.1): block((0.2, 0.22, 0.05), (s * 0.48, c + y, 0.025), FOOT, 0.012)
        for y in [c - L / 2 + 0.3 + k * 0.6 for k in range(int(L / 0.6))]: bolt((s * 0.54, y, BY - 0.2), 'X' if s > 0 else '-X', 0.026, 0.02, 'steel')

def belt_deck(L, W=0.8):
    block((L, W, 0.06), (0, 0, BY - 0.03), BELT, 0.006, name='belt')
    for x in (-L / 2 + 0.03, L / 2 - 0.03): cyl(0.045, W, (x, 0, BY - 0.05), RAILD, axis='Y', verts=8, bevel=0)

def cleats(L):
    n = int((L - 0.12) / 0.24)
    def mk():
        for k in range(n): block((0.035, 0.7, 0.014), (-L / 2 + 0.1 + k * 0.24, 0, BY + 0.007), CLEAT, 0.004)
    node('cleats', (0, 0, BY), mk)

def straight(L=C, with_cleats=True):
    for s in (-1, 1): side_rail(L, s)
    for x in [(-L / 2 + 0.3 + k * 0.6) for k in range(max(1, int(L / 0.6)))]: block((0.08, 0.8, 0.06), (x, 0, BY - 0.24), RAILD, 0.01)   # cross ties
    belt_deck(L)
    if with_cleats: cleats(L)

def corner_post(x, y, h=BY - 0.02):
    block((0.16, 0.16, h), (x, y, h / 2), RAIL, 0.02); block((0.2, 0.2, 0.05), (x, y, 0.025), FOOT, 0.012)
    block((0.18, 0.18, 0.05), (x, y, h + 0.035), CAP, 0.012)

def square_deck(open_sides):
    """1 x 1 cell deck: rails on the closed sides, posts at the corners."""
    if 'N' not in open_sides: side_rail(C, 1)
    if 'S' not in open_sides: side_rail(C, -1)
    if 'E' not in open_sides: side_rail(C, 1, 'y')
    if 'W' not in open_sides: side_rail(C, -1, 'y')
    for sx, ex in ((-1, 'W'), (1, 'E')):
        for sy, ey in ((-1, 'S'), (1, 'N')):
            if ex in open_sides and ey in open_sides: corner_post(sx * 0.5, sy * 0.5)   # a post only where no rail holds the corner
    block((0.94, 0.94, 0.06), (0, 0, BY - 0.03), BELT, 0.006, name='belt')
    block((0.7, 0.7, 0.05), (0, 0, BY - 0.3), RAILD, 0.01)

def turn(side):
    """Right turn (side=-1: W -> S) or left (side=+1: W -> N). Game S = Blender -y."""
    square_deck({'W', 'N' if side > 0 else 'S'})
    cx, cy = -0.6, side * 0.6        # the inner corner between the two open sides (right turn: south-west)
    for k in range(5):
        a = math.radians(12 + k * 16.5)
        d = Vector((math.sin(a), -side * math.cos(a), 0))
        bar(Vector((cx, cy, BY + 0.007)) + d * 0.3, Vector((cx, cy, BY + 0.007)) + d * 0.86, 0.035, 0.014, CLEAT)
    # one cap where the two rails meet, covering the joint
    ox, oy = 0.475, -side * 0.475
    block((0.22, 0.22, 0.09), (ox, oy, BY + 0.04), CAP, 0.015)

def bar(p0, p1, w, h, m):
    d = (p1 - p0); u = Vector((-d.y, d.x, 0)).normalized() * w / 2; z = Vector((0, 0, h / 2))
    bm = bmesh.new(); vs = [bm.verts.new(p + o) for p in (p0, p1) for o in (u + z, -u + z, -u - z, u - z)]
    a, b = vs[:4], vs[4:]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    for k in range(4): bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('bar'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('bar', me); bpy.context.collection.objects.link(o); o.data.materials.append(mat(m)); return o

def head(icon):
    """Four-post junction head with a raised indicator deck."""
    H = BY + 0.46
    for sx in (-1, 1):
        for sy in (-1, 1):
            block((0.14, 0.14, H - BY + 0.04), (sx * 0.5, sy * 0.5, (H + BY) / 2), RAIL, 0.02)
    block((1.12, 1.12, 0.1), (0, 0, H + 0.06), CAP, 0.025)                          # yellow frame
    block((0.9, 0.9, 0.1), (0, 0, H + 0.08), '#9aa2a8', 0.02)                        # steel deck inset
    for sx in (-1, 1):
        for sy in (-1, 1): bolt((sx * 0.5, sy * 0.5, H + 0.11), 'Z', 0.03, 0.02, RAILD)
    for sx in (-1, 1): block((1.12, 0.06, 0.1), (0, sx * 0.53, H - 0.04), RAILD, 0.012)
    Z = H + 0.145
    def arrow(x0, y0, x1, y1, col, w=0.09):
        a, b = Vector((x0, y0, Z)), Vector((x1, y1, Z)); d = (b - a); L = d.length; ang = math.atan2(d.y, d.x)
        sh = block((L - 0.12, w, 0.025), (a + d.normalized() * (L - 0.12) / 2), col, 0.004); sh.rotation_euler = (0, 0, ang)
        hd = cyl(0.13, 0.025, b - d.normalized() * 0.06, col, verts=3, bevel=0); hd.rotation_euler = (0, 0, ang)
    if icon == 'split':
        arrow(-0.35, 0, 0.0, 0, '#3fb85f'); arrow(0.0, 0, 0.0, 0.36, '#3fb85f'); arrow(0.0, 0, 0.0, -0.36, '#3fb85f')
    elif icon == 'merge':
        arrow(-0.38, 0.3, 0.0, 0.02, '#3f86c6'); arrow(-0.38, -0.3, 0.0, -0.02, '#3f86c6'); arrow(-0.38, 0, 0.36, 0, '#3f86c6')
    elif icon == 'filter':
        arrow(-0.36, 0, 0.36, 0, '#9aa2a8'); arrow(0.0, 0, 0.0, -0.36, '#f0a030')
        cyl(0.13, 0.03, (-0.08, 0, Z + 0.01), '#f0a030', verts=3, bevel=0, rot=(0, 0, math.pi))
        # a small material display on the north face
        block((0.3, 0.03, 0.16), (0, 0.565, H + 0.06), FOOT, 0.006)
        s = block((0.24, 0.02, 0.1), (0, 0.58, H + 0.06), '#ffcf70', 0.0, name='screen'); s.data.materials.clear(); s.data.materials.append(mat('#ffcf70', 0.4, emit=1.5))

def sensor():
    straight()
    for sy in (-1, 1):
        block((0.12, 0.12, 0.62), (0, sy * 0.56, BY + 0.31), RAIL, 0.02)
        block((0.18, 0.1, 0.22), (0, sy * 0.49, BY + 0.38), FOOT, 0.02)             # emitter heads facing the belt
        cyl(0.04, 0.02, (0, sy * 0.435, BY + 0.38), '#ff5a48', axis='Y', verts=8, bevel=0)
    block((0.16, 1.24, 0.1), (0, 0, BY + 0.66), CAP, 0.02)
    b = block((0.02, 0.86, 0.02), (0, 0, BY + 0.38), '#ff5a48', 0.0, name='beam'); b.data.materials.clear(); b.data.materials.append(mat('#ff5a48', 0.4, emit=3))
    block((0.24, 0.14, 0.2), (0.12, 0.66, BY + 0.5), GRN, 0.02)                    # counter box with a display
    s = block((0.16, 0.02, 0.1), (0.12, 0.735, BY + 0.52), '#7fe8b0', 0.0, name='screen'); s.data.materials.clear(); s.data.materials.append(mat('#7fe8b0', 0.4, emit=1.5))

# ---------------------------------------------------------------------------
# machines: 2 cells long; the belt runs through a tunnel at belt height
L2 = 2 * C

def tunnel_frame(x, col, depth=0.14, top=BY + 0.62):
    """A chunky portal frame over the belt with rubber flaps hanging in it."""
    for sy in (-1, 1): block((depth, 0.16, top - BY + 0.06), (x, sy * 0.53, (top + BY) / 2 + 0.0), col, 0.02)
    block((depth, 1.22, 0.14), (x, 0, top), col, 0.02)
    for k in range(6): block((0.012, 0.13, top - BY - 0.12), (x, -0.36 + k * 0.145, (top + BY) / 2 + 0.02), 'rubber', 0.002)

def stack_light(x, y, z):
    cyl(0.018, 0.16, (x, y, z + 0.08), RAILD, verts=6, bevel=0)
    for i, c in enumerate(('#3fd27a', '#ffb02e', '#ff5a48')):
        l = cyl(0.04, 0.06, (x, y, z + 0.2 + i * 0.065), c, verts=8, bevel=0.004, name=('lamp_g', 'lamp_a', 'lamp_r')[i]); l.data.materials.clear(); l.data.materials.append(mat(c, 0.4, emit=0.6))
    cyl(0.042, 0.02, (x, y, z + 0.4), FOOT, verts=8, bevel=0)

def panel(x, y, z, side=-1, col=GRN):
    """Control box on a side face with a screen and three buttons."""
    block((0.34, 0.12, 0.3), (x, y, z), col, 0.02)
    s = block((0.22, 0.02, 0.12), (x - 0.03, y + side * 0.065, z + 0.05), '#7fe8b0', 0.0, name='screen'); s.data.materials.clear(); s.data.materials.append(mat('#7fe8b0', 0.4, emit=1.5))
    for i, c in enumerate(('green', 'yellow', 'red')): cyl(0.022, 0.03, (x - 0.1 + i * 0.07, y + side * 0.07, z - 0.08), c, axis='Y', verts=8, bevel=0)

def sawmill():
    straight(L2)
    tunnel_frame(-0.95, GRN); tunnel_frame(0.95, GRN)
    # log feed rollers with spikes before the saw
    for x in (-0.7, -0.45):
        cyl(0.07, 0.74, (x, 0, BY + 0.12), CAP, axis='Y', verts=8, bevel=0)
        for k in range(5): cyl(0.085, 0.03, (x, -0.3 + k * 0.15, BY + 0.12), RAILD, axis='Y', verts=8, bevel=0)
        for sy in (-1, 1): block((0.08, 0.06, 0.22), (x, sy * 0.4, BY + 0.1), RAILD, 0.01)
    # saw housing: posts from the rails, a green body bridging the belt, a yellow wheel cover on top
    for sx in (-1, 1):
        for sy in (-1, 1): block((0.14, 0.14, 0.5), (sx * 0.5, sy * 0.53, BY + 0.25), GRND, 0.02)
    block((1.18, 1.14, 0.5), (0, 0, BY + 0.72), GRN, 0.04)
    block((1.24, 1.2, 0.06), (0, 0, BY + 0.47), GRND, 0.02)
    vent((0.32, -0.57, BY + 0.72), 0.34, 0.26, '-Y', 4, RAILD, '#d7dbde')
    panel(-0.25, -0.62, BY + 0.72)
    # band wheel: big octagonal cover above, the wheel itself visible on the south face, spinning
    cyl(0.46, 0.34, (0, 0.05, BY + 1.18), CAP, axis='Y', verts=10, bevel=0.02)
    cyl(0.4, 0.36, (0, 0.05, BY + 1.18), '#d9a326', axis='Y', verts=10, bevel=0)
    def wheel():
        cyl(0.36, 0.05, (0, -0.15, BY + 1.18), RAILD, axis='Y', verts=10, bevel=0.01)
        cyl(0.08, 0.08, (0, -0.17, BY + 1.18), FOOT, axis='Y', verts=8, bevel=0)
        for k in range(5):
            a = k / 5 * math.tau; block((0.05, 0.03, 0.3), (math.sin(a) * 0.16, -0.19, BY + 1.18 + math.cos(a) * 0.16), '#d7dbde', 0.004, rot=(0, -a, 0))
    node('wheel', (0, -0.15, BY + 1.18), wheel)
    block((0.04, 0.02, 0.48), (0, -0.2, BY + 0.27), '#d7dbde', 0.0)             # the band blade dropping through the tunnel
    # drive: blue motor on the north side with a belt guard up to the wheel
    cyl(0.14, 0.4, (-0.35, 0.42, BY + 1.05), 'blue', axis='X', verts=10, bevel=0.01)
    for k in range(3): cyl(0.15, 0.03, (-0.45 + k * 0.1, 0.42, BY + 1.05), 'blue', axis='X', verts=10, bevel=0)
    block((0.2, 0.08, 0.36), (-0.1, 0.38, BY + 1.15), CAP, 0.015)
    # sawdust extraction: a duct from the roof to a little cyclone
    pipe([(0.35, 0.25, BY + 1.0), (0.35, 0.25, BY + 1.5), (0.7, 0.25, BY + 1.55), (0.82, 0.25, BY + 1.35)], 0.06, '#d7dbde', bend=0.1)
    cyl(0.16, 0.3, (0.82, 0.25, BY + 1.22), '#d7dbde', verts=8, bevel=0.01); cyl(0.16, 0.24, (0.82, 0.25, BY + 0.95), '#c3c9cd', verts=8, bevel=0, r2=0.05)
    for sy in (0.12, 0.38): block((0.04, 0.04, 0.5), (0.95, sy, BY + 0.7), RAILD, 0.006)
    stack_light(-0.45, 0.4, BY + 0.97)

def stonecutter():
    straight(L2)
    tunnel_frame(-1.0, '#5b7da6'); tunnel_frame(1.0, '#5b7da6')
    # gantry: four posts, two side beams, a cross beam carrying the cutter head
    for sx in (-1, 1):
        for sy in (-1, 1): block((0.14, 0.14, 1.0), (sx * 0.55, sy * 0.56, BY + 0.5), '#5b7da6', 0.02)
        block((0.18, 1.28, 0.16), (sx * 0.55, 0, BY + 1.06), '#4a6890', 0.02)
    for sy in (-1, 1): block((1.28, 0.16, 0.14), (0, sy * 0.56, BY + 1.06), '#4a6890', 0.02)
    block((0.3, 1.2, 0.18), (0, 0, BY + 1.06), CAP, 0.02)
    block((0.32, 0.36, 0.3), (0, -0.05, BY + 0.86), CAP, 0.03)                     # carriage
    cyl(0.12, 0.34, (0, 0.24, BY + 0.86), 'blue', axis='Y', verts=10, bevel=0.01)   # motor
    def blade():
        cyl(0.32, 0.03, (0, -0.15, BY + 0.42), '#d7dbde', axis='Y', verts=16, bevel=0)
        cyl(0.07, 0.06, (0, -0.15, BY + 0.42), FOOT, axis='Y', verts=8, bevel=0)
        for k in range(16): a = k / 16 * math.tau; block((0.05, 0.035, 0.03), (math.sin(a) * 0.32, -0.15, BY + 0.42 + math.cos(a) * 0.32), '#8d969c', 0.0, rot=(0, -a, 0))
    node('blade', (0, -0.15, BY + 0.42), blade)
    vault(0.38, 0.04, 0.12, (0, -0.15, BY + 0.42), '#ea7a2c', 8).rotation_euler = (math.pi / 2, 0, 0)  # orange half guard
    block((0.08, 0.1, 0.3), (0, -0.15, BY + 0.66), CAP, 0.01)
    # cooling water: an octagonal tank on the gantry with a band, pipe and nozzle at the blade
    cyl(0.22, 0.55, (0.55, 0.0, BY + 1.42), '#d7dbde', verts=8, bevel=0.01)
    cyl(0.225, 0.14, (0.55, 0.0, BY + 1.36), 'water', verts=8, bevel=0)
    cyl(0.24, 0.05, (0.55, 0.0, BY + 1.72), RAILD, verts=8, bevel=0)
    pipe([(0.42, -0.1, BY + 1.2), (0.2, -0.2, BY + 1.0), (0.12, -0.27, BY + 0.72)], 0.025, 'water', bend=0.05)
    # splash shields on the side, a slurry tray and the control box
    for sy in (-1, 1): block((1.0, 0.03, 0.4), (0, sy * 0.6, BY + 0.62), '#c3c9cd', 0.01)
    block((0.9, 0.1, 0.14), (0, -0.6, BY - 0.02), RAILD, 0.01); block((0.86, 0.06, 0.03), (0, -0.6, BY + 0.05), 'water', 0.004)   # slurry gutter on the rail
    panel(-0.7, -0.66, BY + 0.85, -1, '#5b7da6')
    stack_light(0.55, 0.56, BY + 1.14)

def smelter():
    straight(L2)
    tunnel_frame(1.02, CHAR)
    # furnace body: refractory block in charcoal with brick-red courses, a glowing mouth on the entry side
    block((1.5, 1.28, 0.32), (-0.2, 0, BY - 0.04 + 0.16 - 0.02), CHAR, 0.03) if False else None
    for sy in (-1, 1): block((1.5, 0.22, 0.75), (-0.2, sy * 0.52, BY + 0.36), CHAR, 0.04)
    block((1.5, 1.28, 0.55), (-0.2, 0, BY + 0.98), CHAR, 0.05)
    for z in (BY + 0.3, BY + 0.62, BY + 0.92):
        for sy in (-1, 1): block((1.52, 0.02, 0.07), (-0.2, sy * 0.64, z), BRICK, 0.004)
    block((0.06, 0.82, 0.62), (-0.96, 0, BY + 0.34), '#2a2d30', 0.01)               # mouth frame
    g = block((0.04, 0.72, 0.5), (-0.94, 0, BY + 0.3), '#ff8a2a', 0.0, name='glow'); g.data.materials.clear(); g.data.materials.append(mat('#ff8a2a', 0.5, emit=4))
    # crucible on top with copper induction coils and a pour spout toward the exit
    cyl(0.36, 0.5, (-0.3, 0, BY + 1.5), '#5a5f65', verts=8, bevel=0.02)
    for z in (BY + 1.33, BY + 1.47, BY + 1.61): cyl(0.39, 0.06, (-0.3, 0, z), COPPER, verts=8, bevel=0.005)
    cyl(0.3, 0.06, (-0.3, 0, BY + 1.78), '#2a2d30', verts=8, bevel=0)
    m = cyl(0.25, 0.02, (-0.3, 0, BY + 1.79), '#ffb03a', verts=8, bevel=0, name='glow2'); m.data.materials.clear(); m.data.materials.append(mat('#ffb03a', 0.5, emit=3))
    block((0.4, 0.12, 0.08), (0.05, 0, BY + 1.62), '#5a5f65', 0.01)
    # ore hopper on the entry end, chimney stack with bands, heat-shield fins
    cyl(0.34, 0.38, (-0.75, 0.25, BY + 1.45), CAP, verts=4, bevel=0.01, r2=0.14, rot=(0, 0, math.pi / 4))
    block((0.16, 0.16, 0.2), (-0.75, 0.25, BY + 1.2), RAILD, 0.01)
    cyl(0.17, 2.0, (0.35, 0.36, BY + 2.0), '#6f767b', verts=8, bevel=0)
    for z in (BY + 1.4, BY + 2.1, BY + 2.8): cyl(0.19, 0.08, (0.35, 0.36, z), CHAR, verts=8, bevel=0)
    cyl(0.23, 0.1, (0.35, 0.36, BY + 3.02), CHAR, verts=8, bevel=0.01)
    for k in range(5): block((0.04, 0.02, 0.5), (-0.7 + k * 0.2, -0.66, BY + 0.98), '#6f767b', 0.004)
    # ingot moulds cooling on a ledge by the exit, gauges and the stack light
    block((0.5, 0.26, 0.06), (0.68, -0.74, BY - 0.1), RAILD, 0.01)
    for k in range(3): block((0.12, 0.18, 0.06), (0.52 + k * 0.16, -0.74, BY - 0.04), '#b8c0c6', 0.008)
    for x in (-0.55, -0.3):
        cyl(0.06, 0.03, (x, -0.655, BY + 1.0), 'cream', axis='Y', verts=10, bevel=0); cyl(0.065, 0.02, (x, -0.65, BY + 1.0), FOOT, axis='Y', verts=10, bevel=0)
    stack_light(0.4, -0.45, BY + 1.26)

def packer():
    straight(L2)
    # magazine of empty crates on the north side
    block((0.62, 0.5, 0.06), (-0.55, 0.85, BY - 0.04), RAILD, 0.01)
    for x in (-0.82, -0.28):
        block((0.05, 0.05, BY - 0.05), (x, 0.66, (BY - 0.05) / 2), RAILD, 0.006); block((0.05, 0.05, BY - 0.05), (x, 1.04, (BY - 0.05) / 2), RAILD, 0.006)
    for k in range(3):
        z = BY + 0.13 + k * 0.27
        block((0.42, 0.38, 0.26), (-0.55, 0.85, z), WOOD, 0.02)
        for sx in (-1, 1): block((0.03, 0.4, 0.28), (-0.55 + sx * 0.21, 0.85, z), WOODD, 0.004)
    # yellow portal frame and the press head that closes the crate
    for sx in (-1, 1):
        for sy in (-1, 1): block((0.14, 0.14, 1.15), (0.05 + sx * 0.5, sy * 0.56, BY + 0.58), CAP, 0.02)
    for sy in (-1, 1): block((1.14, 0.16, 0.14), (0.05, sy * 0.56, BY + 1.2), CAP, 0.02)
    block((0.3, 1.2, 0.18), (0.05, 0, BY + 1.2), '#d9a326', 0.02)
    cyl(0.07, 0.4, (0.05, 0, BY + 0.98), '#d7dbde', verts=8, bevel=0)
    def press():
        block((0.46, 0.46, 0.08), (0.05, 0, BY + 0.62), RAILD, 0.015)
        cyl(0.04, 0.24, (0.05, 0, BY + 0.78), '#d7dbde', verts=8, bevel=0)
        for sx in (-1, 1):
            for sy in (-1, 1): cyl(0.02, 0.06, (0.05 + sx * 0.18, sy * 0.18, BY + 0.56), FOOT, verts=6, bevel=0)
    node('press', (0.05, 0, BY + 0.62), press)
    # arm that sets an empty crate, a nail gun, a lid stack, the panel and a stack light
    pipe([(-0.3, 0.6, BY + 1.0), (-0.1, 0.45, BY + 1.05), (-0.05, 0.3, BY + 0.85)], 0.04, CAP, bend=0.05)
    block((0.16, 0.12, 0.16), (-0.05, 0.28, BY + 0.78), FOOT, 0.02)
    block((0.36, 0.34, 0.18), (0.75, 0.78, BY - 0.02), WOOD, 0.02)
    for k in range(3): block((0.36, 0.34, 0.03), (0.75, 0.78, BY + 0.09 + k * 0.035), WOODD if k % 2 else WOOD, 0.004)
    panel(-0.7, -0.62, BY + 0.5, -1, '#d9a326')
    stack_light(0.55, -0.56, BY + 1.27)

MODELS = {'fw_belt': lambda: straight(), 'fw_bturn': lambda: turn(-1), 'fw_bleft': lambda: turn(1),
          'fw_split': lambda: (square_deck({'W', 'N', 'S'}), head('split')), 'fw_merge': lambda: (square_deck({'W', 'N', 'S', 'E'}), head('merge')),
          'fw_filter': lambda: (square_deck({'W', 'E', 'S'}), head('filter')), 'fw_sensor': sensor,
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
