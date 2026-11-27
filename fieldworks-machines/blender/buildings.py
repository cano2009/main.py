# Fieldworks buildings, mid-poly (original designs): barn, warehouse, greenhouse. Same footprints as the game's
# (barn 8 x 10, warehouse 10 x 12, greenhouse 6 x 10, door on the +z end), built with the shared detail kit:
# board-and-batten siding, standing-seam roofs, trim, gutters and downpipes, framed windows, sliding and roller doors,
# lamps, vents and signage blanks. Game coordinates through the power_yard wrappers.
# Usage: blender -b --python buildings.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from power_yard import *

BARN = '#b5413a'; BARND = '#97342e'; TRIM = '#efeae0'; ROOF = '#4c4f55'; ROOFD = '#3c3f44'; STONE = '#8f8a82'; GLASS = '#2d4656'
CLAD = '#c9cdd0'; CLADD = '#aeb3b7'; DOOR = '#9aa1a6'; WOODB = '#8a6440'; SOIL = '#5a4330'; LEAF = '#5ea83c'
F.ROLE.update({BARN: (0.7, 0.0), BARND: (0.72, 0.0), TRIM: (0.55, 0.0), ROOF: (0.38, 0.55), ROOFD: (0.4, 0.55), STONE: (0.92, 0.0),
               GLASS: (0.08, 0.3), CLAD: (0.38, 0.5), CLADD: (0.4, 0.5), DOOR: (0.4, 0.45), WOODB: (0.8, 0.0), SOIL: (0.95, 0.0), LEAF: (0.6, 0.0)})

def glass_mat(col='#cfe9e0', alpha=0.28):
    m = bpy.data.materials.new('glass'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(col); b.inputs['Roughness'].default_value = 0.05; b.inputs['Alpha'].default_value = alpha
    m.blend_method = 'BLEND'; m.shadow_method = 'NONE'; return m
def gprism(poly, z0, z1, m, bevel=0.01):
    """Extrude a (x, y) outline between game z0 and z1."""
    return prism([(x, y) for x, y in poly], -z1, -z0, m, 'y', bevel=bevel)
def window(f, o, w, h, cross=True):
    fblock(f, o, 0, 0, 0.0, w + 0.14, h + 0.14, 0.05, TRIM, 0.01)                 # frame
    fblock(f, o, 0, 0, 0.0, w, h, 0.06, GLASS, 0.0)
    fblock(f, o, 0, -h / 2 - 0.09, 0.0, w + 0.24, 0.06, 0.1, TRIM, 0.008)         # sill
    if cross:
        fblock(f, o, 0, 0, 0.0, 0.04, h, 0.07, TRIM, 0.0); fblock(f, o, 0, 0, 0.0, w, 0.04, 0.07, TRIM, 0.0)
def lamp(f, o):
    """Gooseneck barn lamp over a door."""
    u, n = FACES[f]
    p0 = fpt(f, o, 0, 0, 0.0); p1 = fpt(f, o, 0, 0.2, 0.28); p2 = fpt(f, o, 0, 0.1, 0.36)
    gp([p0, p1, p2], 0.018, GRAPH, bend=0.08)
    c = fpt(f, o, 0, 0.02, 0.38); gc(0.14, 0.08, *c, GRAPH, verts=16, bevel=0.01, r2=0.05)
    glow(gc(0.07, 0.02, c[0], c[1] - 0.045, c[2], '#ffe3a0', verts=12, bevel=0), '#ffe3a0', 1.2)
    fblock(f, o, 0, 0, 0.0, 0.1, 0.14, 0.03, GRAPH, 0.006)
def downpipe(x, z, top, m=ROOFD):
    gp([(x, top, z), (x, 0.5, z), (x, 0.3, z + (0.15 if z > 0 else -0.15))], 0.045, m, bend=0.06)
    for y in (1.2, 2.2, 3.0):
        if y < top - 0.2: gb(0.06, 0.04, 0.06, x, y, z, ROOFD, 0.004)

# ---------------------------------------------------------------------------
def barn():
    W, D, H = 8, 10, 3.4
    gb(W + 0.4, 0.2, D + 0.4, 0, 0.1, 0, CONC, 0.04)                             # slab
    Y0 = 0.2
    prof = [(-W / 2, 0), (W / 2, 0), (W / 2, H), (W * 0.32, H + 1.6), (0, H + 2.3), (-W * 0.32, H + 1.6), (-W / 2, H)]
    gprism([(x, y + Y0) for x, y in prof], -D / 2, D / 2, BARN, 0.02)
    gb(W + 0.08, 0.5, D + 0.08, 0, Y0 + 0.25, 0, STONE, 0.02)                     # stone plinth course
    # board-and-batten: raised battens on the long walls and the gable ends
    for s in (-1, 1):
        for k in range(int(D / 0.3)):
            z = -D / 2 + 0.15 + k * 0.3
            gb(0.03, H - 0.55, 0.05, s * (W / 2 + 0.015), Y0 + 0.5 + (H - 0.5) / 2, z, BARND, 0.004)
    for s in (-1, 1):
        for k in range(int(W / 0.3)):
            x = -W / 2 + 0.15 + k * 0.3
            top = H + (1.6 * (W / 2 - abs(x)) / (W / 2 - W * 0.32) if abs(x) > W * 0.32 else 1.6 + 0.7 * (W * 0.32 - abs(x)) / (W * 0.32))
            if s > 0 and abs(x) < 1.85 and True: top_door = 3.0; gb(0.05, top - top_door - 0.1, 0.03, x, Y0 + top_door + (top - top_door - 0.1) / 2, s * (D / 2 + 0.015), BARND, 0.004) if top > top_door + 0.3 else None; continue
            gb(0.05, top - 0.6, 0.03, x, Y0 + 0.5 + (top - 0.6) / 2, s * (D / 2 + 0.015), BARND, 0.004)
    # corner and gable trim, eave fascia
    for sx in (-1, 1):
        for sz in (-1, 1): gb(0.16, H - 0.45, 0.16, sx * (W / 2 - 0.0), Y0 + 0.5 + (H - 0.5) / 2, sz * (D / 2 - 0.0), TRIM, 0.01)
    pts = [(-W / 2 - 0.25, H - 0.12), (-W * 0.32, H + 1.6), (0, H + 2.3), (W * 0.32, H + 1.6), (W / 2 + 0.25, H - 0.12)]
    # roof: two slopes each side, standing seams, ridge cap; trim boards along the gable edge
    for i in range(4):
        p0, p1 = pts[i], pts[i + 1]
        a = Vector(p0); b = Vector(p1); d = (b - a).normalized(); n = Vector((-d.y, d.x))
        if n.y < 0: n = -n
        poly = [tuple(a + Vector((0, Y0))), tuple(b + Vector((0, Y0))), tuple(b + n * 0.12 + Vector((0, Y0))), tuple(a + n * 0.12 + Vector((0, Y0)))]
        gprism(poly, -D / 2 - 0.3, D / 2 + 0.3, ROOF, 0.006)
        for z in [(-D / 2 - 0.25 + k * 0.45) for k in range(int((D + 0.5) / 0.45) + 1)]:   # standing seams run down the slope
            gbar(Vector((a.x + n.x * 0.14, a.y + n.y * 0.14 + Y0, z)), Vector((b.x + n.x * 0.14, b.y + n.y * 0.14 + Y0, z)), 0.03, 0.03, ROOFD)
        for s in (-1, 1):                                                          # gable trim boards
            mid = (a + b) / 2 + n * 0.02
            gprism([tuple(a + Vector((0, Y0)) - n * 0.08), tuple(b + Vector((0, Y0)) - n * 0.08), tuple(b + Vector((0, Y0)) + n * 0.06), tuple(a + Vector((0, Y0)) + n * 0.06)], s * (D / 2) - 0.06, s * (D / 2) + 0.08, TRIM, 0.005)
    gb(0.3, 0.14, D + 0.7, 0, Y0 + H + 2.42, 0, ROOFD, 0.02)                      # ridge cap
    # gutters on the eaves with downpipes at the corners
    for s in (-1, 1):
        gc(0.07, D + 0.5, s * (W / 2 + 0.28), Y0 + H - 0.2, 0, ROOFD, axis='z', verts=12)
        for sz in (-1, 1): downpipe(s * (W / 2 + 0.28), sz * (D / 2 + 0.05), Y0 + H - 0.25)
    # front (+z): two sliding doors with X braces on a top track, loft door with hoist beam, windows, lamps
    F_ = '+z'; zf = D / 2 + 0.03
    for s in (-1, 1):
        o = (s * 0.88, 1.65, zf)
        fblock(F_, o, 0, 0, 0.0, 1.72, 2.9, 0.08, BARN, 0.01)
        for k in range(6): fblock(F_, o, -0.75 + k * 0.3, 0, 0.08, 0.04, 2.8, 0.02, BARND, 0.0)
        for v in (-1.35, 1.35, 0): fblock(F_, o, 0, v, 0.08, 1.72, 0.14, 0.04, TRIM, 0.006)
        for sv in (-1, 1): fquad(F_, o, [(-0.8, sv * -1.25), (-0.68, sv * -1.25), (0.8, sv * 1.25), (0.68, sv * 1.25)], 0.1, 0.04, TRIM)
        fblock(F_, o, s * -0.72, 0, 0.12, 0.05, 0.3, 0.04, GRAPH, 0.006)          # handle
        for u in (-0.6, 0.6): fcyl(F_, (s * 0.88, 3.15, zf), u, 0, 0.14, 0.05, 0.04, GRAPH, verts=12)   # rollers
    fblock(F_, (0, 3.2, zf), 0, 0, 0.1, 3.9, 0.12, 0.08, '#6f767b', 0.01)         # track
    fblock(F_, (0, 4.45, zf), 0, 0, 0.0, 1.3, 1.1, 0.06, TRIM, 0.01); fblock(F_, (0, 4.45, zf), 0, 0, 0.04, 1.06, 0.86, 0.05, BARN, 0.006)
    for sv in (-1, 1): fquad(F_, (0, 4.45, zf), [(-0.5, sv * -0.4), (-0.4, sv * -0.4), (0.5, sv * 0.4), (0.4, sv * 0.4)], 0.09, 0.03, TRIM)
    gb(0.14, 0.14, 0.9, 0, Y0 + H + 1.75, zf + 0.35, WOODB, 0.01)                 # hoist beam
    gc(0.08, 0.05, 0, Y0 + H + 1.6, zf + 0.72, GRAPH, axis='x', verts=12); gp([(0, Y0 + H + 1.55, zf + 0.72), (0, Y0 + H + 0.7, zf + 0.72)], 0.008, '#c9a46a', bend=0)
    for x in (-2.7, 2.7): window(F_, (x, 2.3, zf), 0.8, 0.8)
    for x in (-2.0, 2.0): lamp(F_, (x, 3.55, zf))
    # sides: a row of windows and a personnel door on the east wall
    for s in (-1, 1):
        f = '+x' if s > 0 else '-x'
        for z in (-3.0, -0.6, 1.8): window(f, (s * (W / 2 + 0.03), 2.2, z), 0.7, 0.6)
    fblock('+x', (W / 2 + 0.03, 1.3, 3.6), 0, 0, 0.0, 1.0, 2.2, 0.05, TRIM, 0.01); fblock('+x', (W / 2 + 0.03, 1.3, 3.6), 0, 0, 0.03, 0.86, 2.06, 0.05, BARND, 0.006)
    fcyl('+x', (W / 2 + 0.03, 1.3, 3.6), 0.3, 0, 0.08, 0.03, 0.03, 'steel', verts=10); lamp('+x', (W / 2 + 0.03, 2.75, 3.6))
    # back: two windows and the vent
    for x in (-2.0, 2.0): window('-z', (x, 2.3, -D / 2 - 0.03), 0.9, 0.8)
    # cupola with louvres and a weathervane
    CY = Y0 + H + 2.45
    gb(0.8, 0.7, 0.8, 0, CY + 0.35, 0, TRIM, 0.02)
    for f, o in (('+z', (0, CY + 0.4, 0.4)), ('-z', (0, CY + 0.4, -0.4)), ('+x', (0.4, CY + 0.4, 0)), ('-x', (-0.4, CY + 0.4, 0))): grille(f, o, 0.5, 0.42, 5, TRIM, INK, TRIM)
    gc(0.66, 0.42, 0, CY + 0.91, 0, ROOF, verts=4, bevel=0.02, r2=0.06).rotation_euler = (0, 0, math.pi / 4)
    gc(0.012, 0.6, 0, CY + 1.3, 0, GRAPH, verts=6, bevel=0)
    gb(0.4, 0.1, 0.012, 0.05, CY + 1.45, 0, GRAPH, 0.0); fquad('+z', (0.27, CY + 1.45, 0), [(0, -0.08), (0.14, 0), (0, 0.08)], -0.006, 0.012, GRAPH)

def warehouse():
    W, D, H = 10, 12, 5
    gb(W + 0.4, 0.2, D + 0.4, 0, 0.1, 0, CONC, 0.04); Y0 = 0.2
    gprism([(-W / 2, Y0), (W / 2, Y0), (W / 2, Y0 + H), (0, Y0 + H + 1.2), (-W / 2, Y0 + H)], -D / 2, D / 2, CLAD, 0.02)
    gb(W + 0.06, 0.4, D + 0.06, 0, Y0 + 0.2, 0, GRAPH, 0.012)                    # dado band
    for s in (-1, 1):                                                           # trapezoidal cladding ribs
        for k in range(int(D / 0.4)): gb(0.05, H - 0.45, 0.1, s * (W / 2 + 0.025), Y0 + 0.4 + (H - 0.45) / 2, -D / 2 + 0.2 + k * 0.4, CLADD, 0.006)
    for s in (-1, 1):
        for k in range(int(W / 0.4)):
            x = -W / 2 + 0.2 + k * 0.4
            if s > 0 and abs(x) < 2.3: continue
            top = H + 1.2 * (1 - abs(x) / (W / 2))
            gb(0.1, top - 0.45, 0.05, x, Y0 + 0.4 + (top - 0.45) / 2, s * (D / 2 + 0.025), CLADD, 0.006)
    for sx in (-1, 1):
        for sz in (-1, 1): gb(0.14, H - 0.4, 0.14, sx * (W / 2 + 0.02), Y0 + 0.4 + (H - 0.4) / 2, sz * (D / 2 + 0.02), '#3f7d4c', 0.01)
    # roof with ridge vent, skylight strips, green fascia and gutters
    for s in (-1, 1):
        a = Vector((s * (W / 2 + 0.3), Y0 + H - 0.06)); b = Vector((0, Y0 + H + 1.2)); d = (b - a).normalized(); n = Vector((-d.y, d.x))
        if n.y < 0: n = -n
        gprism([tuple(a), tuple(b), tuple(b + n * 0.12), tuple(a + n * 0.12)], -D / 2 - 0.3, D / 2 + 0.3, ROOF, 0.006)
        for z in [(-D / 2 - 0.2 + k * 0.5) for k in range(int((D + 0.4) / 0.5) + 1)]:
            gbar(Vector((a.x + n.x * 0.14, a.y + n.y * 0.14, z)), Vector((b.x + n.x * 0.14, b.y + n.y * 0.14, z)), 0.03, 0.03, ROOFD)
        for zc in (-3.5, 0.5, 4.5):
            m = a + (b - a) * 0.5 + n * 0.135
            gprism([tuple(a + (b - a) * 0.3 + n * 0.125), tuple(a + (b - a) * 0.7 + n * 0.125), tuple(a + (b - a) * 0.7 + n * 0.14), tuple(a + (b - a) * 0.3 + n * 0.14)], zc - 0.6, zc + 0.6, '#d8e6ea', 0.0)
        gb(0.3, 0.5, D + 0.6, s * (W / 2 + 0.22), Y0 + H - 0.05, 0, '#3f7d4c', 0.02)   # fascia
        for sz in (-1, 1): downpipe(s * (W / 2 + 0.3), sz * (D / 2 + 0.05), Y0 + H - 0.3, '#2f6a3c')
    gb(0.7, 0.3, D * 0.8, 0, Y0 + H + 1.32, 0, ROOFD, 0.02)
    for s in (-1, 1): grille('+x' if s > 0 else '-x', (s * 0.35, Y0 + H + 1.32, 0), D * 0.75, 0.16, 3, ROOFD, INK, GRAPH)
    # front: roller door in a frame with guide rails, motor box and bollards; personnel door; sign band; lamps
    F_ = '+z'; zf = D / 2 + 0.05
    fblock(F_, (0, 2.15, zf), 0, 0, 0.0, 4.6, 4.0, 0.12, GRAPH, 0.012)
    fblock(F_, (0, 2.1, zf), 0, -0.05, 0.05, 4.2, 3.8, 0.04, DOOR, 0.004)
    for k in range(18): fblock(F_, (0, 0.4 + k * 0.21, zf), 0, 0, 0.09, 4.16, 0.03, 0.02, CLADD, 0.0)
    for u in (-2.2, 2.2): fblock(F_, (0, 2.1, zf), u, 0, 0.08, 0.12, 3.9, 0.08, GRAPH, 0.006)
    fblock(F_, (0, 4.3, zf), 0, 0, 0.08, 4.6, 0.36, 0.3, GRAPH, 0.02); fblock(F_, (0, 4.3, zf), 2.45, 0, 0.12, 0.3, 0.3, 0.2, '#3f7d4c', 0.015)
    hazard(F_, (0, 0.45, zf), 4.2, 0.12, 0.1)
    for u in (-2.6, 2.6):
        gc(0.08, 0.9, u, Y0 + 0.45, zf + 0.5, HAZY, verts=12, bevel=0.02); gc(0.085, 0.08, u, Y0 + 0.7, zf + 0.5, INK, verts=12, bevel=0)
    fblock(F_, (3.6, 1.25, zf), 0, 0, 0.0, 1.14, 2.24, 0.06, GRAPH, 0.01); fblock(F_, (3.6, 1.25, zf), 0, 0, 0.04, 1.0, 2.1, 0.05, '#3f7d4c', 0.006)
    fcyl(F_, (3.6, 1.25, zf), 0.38, 0, 0.1, 0.03, 0.03, 'steel', verts=10); window(F_, (3.6, 1.7, zf + 0.06), 0.4, 0.5, False)
    fblock(F_, (0, H - 0.15, zf), 0, 0, 0.0, 3.4, 0.62, 0.08, '#3f7d4c', 0.015); fblock(F_, (0, H - 0.15, zf), 0, 0, 0.06, 3.1, 0.38, 0.02, TRIM, 0.0)
    for u in (-2.9, 2.9): lamp(F_, (u, 3.9, zf))
    for s in (-1, 1):
        for z in (-3.6, 0.0, 3.6): window('+x' if s > 0 else '-x', (s * (W / 2 + 0.08), 3.6, z), 1.4, 0.5, False)

def greenhouse():
    W, D, H, R = 6, 10, 2.4, 1.5
    gb(W + 0.4, 0.2, D + 0.4, 0, 0.1, 0, CONC, 0.04)
    gb(W, 0.4, D, 0, 0.4, 0, STONE, 0.02)                                      # knee wall
    gb(W + 0.06, 0.05, D + 0.06, 0, 0.62, 0, TRIM, 0.01)
    gl = glass_mat()
    o = gprism([(-W / 2, 0.6), (W / 2, 0.6), (W / 2, 0.6 + H), (0, 0.6 + H + R), (-W / 2, 0.6 + H)], -D / 2, D / 2, None, 0.0); o.data.materials.append(gl)
    FR = '#e9e4d6'
    for k in range(6):
        z = -D / 2 + k * D / 5
        for s in (-1, 1):
            gb(0.08, H, 0.08, s * W / 2, 0.6 + H / 2, z, FR, 0.01)
            gbar(Vector((s * W / 2, 0.6 + H, z)), Vector((0, 0.6 + H + R, z)), 0.08, 0.08, FR)
        gb(W, 0.06, 0.06, 0, 0.6 + H, z, FR, 0.006)
        for s in (-1, 1): gbar(Vector((s * W / 2, 0.6 + H, z)), Vector((s * 1.0, 0.6 + H + R * 0.67, z)), 0.04, 0.04, FR)   # truss braces
    for s in (-1, 1):
        gb(0.08, 0.08, D, s * W / 2, 0.6 + H, 0, FR, 0.008)
        for k in range(10): gb(0.04, H, 0.04, s * (W / 2 + 0.005), 0.6 + H / 2, -D / 2 + 0.5 + k * 1.0, FR, 0.004)   # glazing bars
        for k in range(10): gbar(Vector((s * (W / 2 + 0.01), 0.6 + H + 0.02, -D / 2 + 0.5 + k * 1.0)), Vector((0, 0.6 + H + R + 0.02, -D / 2 + 0.5 + k * 1.0)), 0.03, 0.03, FR)
        gc(0.06, D + 0.3, s * (W / 2 + 0.08), 0.6 + H - 0.04, 0, FR, axis='z', verts=12)                # gutters
        # ridge vents, propped open
        for zc in (-2.5, 2.5):
            a = Vector((0, 0.6 + H + R)); b = Vector((s * 0.9, 0.6 + H + R * 0.7 + 0.25))
            gb(0.04, 0.04, 1.6, b.x, b.y, zc, FR, 0.004); gbar(Vector((0, a.y, zc - 0.8)), Vector((b.x, b.y, zc - 0.8)), 0.04, 0.04, FR); gbar(Vector((0, a.y, zc + 0.8)), Vector((b.x, b.y, zc + 0.8)), 0.04, 0.04, FR)
    gb(0.1, 0.1, D, 0, 0.6 + H + R, 0, FR, 0.008)
    for x in (-1.5, 1.5): gb(0.04, H + R * (1 - abs(x) / (W / 2)) - 0.05, 0.04, x, 0.6 + (H + R * (1 - abs(x) / (W / 2))) / 2, D / 2 + 0.01, FR, 0.004)
    # door
    fblock('+z', (0, 1.65, D / 2 + 0.01), 0, 0, 0.0, 1.16, 2.14, 0.06, FR, 0.008)
    d = fblock('+z', (0, 1.65, D / 2 + 0.01), 0, 0, 0.03, 0.96, 1.96, 0.02, None, 0.0); d.data.materials.append(gl)
    fcyl('+z', (0, 1.65, D / 2 + 0.01), 0.38, 0, 0.06, 0.025, 0.03, 'steel', verts=10)
    # benches with seedling trays, a water tank and a heater
    for x in (-1.4, 1.4):
        gb(1.6, 0.06, D - 1.5, x, 0.92, -0.2, WOODB, 0.01)
        for dx in (-0.7, 0.7):
            for z in (-3.8, -0.2, 3.4): gb(0.06, 0.62, 0.06, x + dx, 0.6, z, '#6f767b', 0.006)
        for z in [(-D / 2 + 1.3 + k * 1.05) for k in range(8)]:
            gb(1.4, 0.06, 0.9, x, 0.98, z, INK, 0.006)
            for i in range(4):
                for j in range(3):
                    p = (x - 0.5 + i * 0.33, 1.06, z - 0.3 + j * 0.3)
                    gc(0.05, 0.06, *p, SOIL, verts=8, bevel=0)
                    gc(0.06, 0.12, p[0], 1.15, p[2], LEAF, verts=5, bevel=0, r2=0.0)
    gc(0.35, 0.9, -2.4, 0.65, -4.3, '#3f86c6', verts=16, bevel=0.03)
    gb(0.5, 0.7, 0.35, 2.4, 0.75, -4.4, GRAPH, 0.02); grille('+z', (2.4, 0.75, -4.22), 0.4, 0.5, 8)

MODELS = {'bd_barn': barn, 'bd_warehouse': warehouse, 'bd_greenhouse': greenhouse}

if __name__ == '__main__':
    out, prefix = args()
    only = os.environ.get('ONLY')
    for name, fn in MODELS.items():
        if only and name not in only.split(','): continue
        reset(); fn(); export(os.path.join(out, name + '.glb')); print('exported', name)
        if prefix: preview(f'{prefix}_{name}.png', cam_loc=(13, -17, 10), target=(0, 0, 2.6), lens=36, size=(900, 700))
