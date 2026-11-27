# Fieldworks power row, rebuilt in Blender: wind turbine, solar array, battery container, distribution panel,
# transformer, utility pole, transmission tower, yard light. Each model keeps the old one's attachment points
# exactly (wire tips, screen and label faces, pivots), so the game swaps it in without touching cables or logic.
# Moving parts are empties the game re-parents into its own animated groups:
#   wind_turbine: 'yaw' (nacelle, turns to the wind) > 'rotor' (spins);  solar_array: 'table' (tilts);
#   battery: 'fan0', 'fan1' (HVAC fans).
# Coordinates: game (x, y, z) = Blender (x, -z, y). Usage: blender -b --python power_row.py -- <models dir> [lineup.png]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import *
import bmesh

W = '#eef1f2'; W2 = '#d9dee1'; CONC = '#bfb9ad'; WOOD = '#8a5d36'; WOODD = '#6b4528'; INS = '#e9e4d2'; PORC = '#8a3f22'

def G(x, y, z): return (x, -z, y)          # game coords -> Blender

def parent(objs, empty):
    for o in objs: o.parent = empty

def collect(fn):
    """Run fn and return the objects it created (for parenting)."""
    before = set(bpy.data.objects); fn(); return [o for o in bpy.data.objects if o not in before]

def blade(length, c0, c1, twist=20, t=0.07, m=W, name='blade'):
    """A tapered, twisted blade along +z from the origin (chord along x), with a rounded root."""
    bm = bmesh.new(); secs = 9; rings = []
    for i in range(secs + 1):
        f = i / secs; z = f * length
        ch = (c0 + (c1 - c0) * f ** 0.8) * (1 - 0.35 * max(0, 0.12 - f) / 0.12 if f < 0.12 else 1)
        th = t * (1 - 0.6 * f); tw = math.radians(twist * (1 - f)); off = -ch * 0.25
        pts = [(-ch * 0.5 + off, 0), (-ch * 0.2 + off, th), (ch * 0.5 + off, th * 0.2), (ch * 0.5 + off, -th * 0.2), (-ch * 0.2 + off, -th * 0.6)]
        rings.append([bm.verts.new((x * math.cos(tw) - y * math.sin(tw), x * math.sin(tw) + y * math.cos(tw), z)) for x, y in pts])
    for a, b in zip(rings, rings[1:]):
        for k in range(5): bm.faces.new((a[k], a[(k + 1) % 5], b[(k + 1) % 5], b[k]))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat(m, 0.35))
    for p in o.data.polygons: p.use_smooth = True
    o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(60)
    return o

def strut(a, b, t, m, round_=False):
    """A beam from a to b, built directly as mesh data (square or 8-sided), bevelled."""
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    u = d.cross(up).normalized(); v = d.cross(u).normalized()
    n = 8 if round_ else 4; r = t / 2 if round_ else t / 2 * math.sqrt(2)
    off = 0 if round_ else math.pi / 4
    bm = bmesh.new(); ring = lambda p: [bm.verts.new(p + (u * math.cos(off + k / n * math.tau) + v * math.sin(off + k / n * math.tau)) * r) for k in range(n)]
    r0, r1 = ring(a), ring(b)
    for k in range(n): bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
    bm.faces.new(list(reversed(r0))); bm.faces.new(r1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('strut'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('strut', me); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat(m) if isinstance(m, str) else m)
    if round_:
        for p in o.data.polygons: p.use_smooth = True
    else:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = min(0.012, t * 0.2); bv.segments = 1
    return o

# ---------------------------------------------------------------------------
def wind_turbine():
    H = 14; rAt = lambda y: 0.62 + (0.32 - 0.62) * (y / H)
    YAW = 0.5 + H; HUB = (0, -1.08, YAW + 0.6)          # yaw pivot height; rotor pivot (Blender)
    # ---------- foundation: octagonal plinth, grout ring, anchor bolts, tower flange
    cyl(2.15, 0.45, (0, 0, 0.225), CONC, verts=8, bevel=0.06)
    cyl(1.05, 0.12, (0, 0, 0.5), '#a9a397', verts=32, bevel=0.03)
    for k in range(20):
        a = k / 20 * math.tau; cyl(0.032, 0.09, (math.cos(a) * 0.8, math.sin(a) * 0.8, 0.6), 'steelD', verts=6, bevel=0.005)
    cyl(rAt(0) + 0.09, 0.12, (0, 0, 0.62), W2, verts=40, bevel=0.025)
    # ---------- tower: smooth taper, flange seams, top flange and yaw bearing
    cyl(rAt(0), H, (0, 0, 0.5 + H / 2), W, verts=40, bevel=0, r2=rAt(H))
    for y in (4.6, 9.3): cyl(rAt(y) + 0.022, 0.06, (0, 0, 0.5 + y), W2, verts=40, bevel=0.008)
    cyl(rAt(H) + 0.04, 0.1, (0, 0, YAW - 0.05), W2, verts=40, bevel=0.015)
    # ---------- tower door (game front = Blender -y) with frame, round window, hinges and handle
    dy = -rAt(0.8) - 0.03
    block((0.62, 0.16, 1.32), (0, dy + 0.02, 1.4), W2, 0.05)
    block((0.48, 0.06, 1.16), (0, dy - 0.05, 1.38), '#cfd5d9', 0.025)
    cyl(0.09, 0.03, (0, dy - 0.085, 1.72), 'steelD', axis='Y', verts=20, bevel=0.006)
    cyl(0.07, 0.03, (0, dy - 0.095, 1.72), '#2d4250', axis='Y', verts=20, bevel=0.0)
    for z in (1.0, 1.75): block((0.05, 0.06, 0.14), (-0.25, dy - 0.07, z), 'steelD', 0.01)
    block((0.04, 0.05, 0.16), (0.18, dy - 0.1, 1.33), 'dark', 0.01)
    # ---------- steel stair: landing in front of the door and two steps, railings both sides
    LY = dy - 0.55
    block((0.92, 0.7, 0.06), (0, LY, 0.74), 'steelD', 0.012)
    for k in range(7): block((0.88, 0.02, 0.015), (0, LY - 0.3 + k * 0.1, 0.775), 'steel', 0.0)
    for x in (-0.42, 0.42):
        for yy in (LY - 0.3, LY + 0.3): block((0.05, 0.05, 0.3), (x, yy, 0.59), 'steelD', 0.008)
    for i, (sy, sz) in enumerate(((LY - 0.48, 0.6), (LY - 0.68, 0.48))):
        block((0.78, 0.22, 0.04), (0, sy, sz), 'steelD', 0.008)
        for x in (-0.4, 0.4): block((0.04, 0.24, sz - 0.44), (x, sy, (sz + 0.44) / 2), 'steelD', 0.006)
    for x in (-0.46, 0.46):
        for yy in (LY - 0.75, LY - 0.3, LY + 0.32): cyl(0.022, 0.95, (x, yy, 0.74 + 0.47 if yy > LY - 0.5 else 0.5 + 0.47), 'yellow', verts=8, bevel=0)
        strut((x, LY - 0.75, 1.45), (x, LY - 0.3, 1.69), 0.022, 'yellow', True)
        strut((x, LY - 0.3, 1.69), (x, LY + 0.32, 1.69), 0.022, 'yellow', True)
        strut((x, LY - 0.75, 1.05), (x, LY - 0.3, 1.25), 0.018, 'yellow', True)
        strut((x, LY - 0.3, 1.25), (x, LY + 0.32, 1.25), 0.018, 'yellow', True)
    # ---------- ground control cabinet (screen face kept at game z = 1.285) with conduit into the tower
    block((0.76, 0.5, 0.08), G(1.45, 0.54, 1.12), CONC, 0.02)
    block((0.64, 0.33, 1.06), G(1.45, 1.11, 1.095), W2, 0.04)                         # front face at game z 1.26
    block((0.72, 0.44, 0.06), G(1.45, 1.67, 1.12), 'dark', 0.02)
    block((0.42, 0.02, 0.28), G(1.45, 1.24, 1.268), 'dark', 0.006)                     # bezel; the live screen sits just in front
    for k in range(4): block((0.46, 0.02, 0.025), G(1.45, 0.72 + k * 0.055, 1.27), 'steelD', 0.004)
    for x in (1.15, 1.75): block((0.02, 0.022, 0.98), G(x, 1.11, 1.27), '#c3c9cd', 0.0)
    cyl(0.03, 0.03, G(1.66, 1.55, 1.272), 'green', axis='Y', verts=10)
    pipe([G(1.25, 0.62, 0.95), G(0.9, 0.62, 0.7), G(0.55, 0.62, 0.35)], 0.04, 'dark')
    # ---------- nacelle (turns with the yaw)
    yaw = empty('yaw', (0, 0, YAW))
    def nac():
        cyl(rAt(H) + 0.06, 0.16, (0, 0, YAW + 0.07), 'steelD', verts=40, bevel=0.02)            # yaw bearing
        loft([(1.95, 0.62, 0.62, YAW + 0.68, 0.48), (1.75, 0.98, 0.94, YAW + 0.64, 0.38), (0.9, 1.14, 1.1, YAW + 0.62, 0.32),
              (-0.35, 1.16, 1.12, YAW + 0.62, 0.32), (-0.72, 1.06, 1.04, YAW + 0.62, 0.38), (-0.88, 0.9, 0.9, YAW + 0.62, 0.46)], W, 6, 'nacelle')
        loft([(1.7, 0.96, 0.22, YAW + 0.26, 0.4), (-0.7, 1.08, 0.22, YAW + 0.24, 0.4)], '#c2c8cc', 4, 'skirt')
        for sx in (-1, 1):
            block((0.03, 2.3, 0.11), (sx * 0.582, 0.45, YAW + 0.47), 'green', 0.012)                  # stripe
            block((0.03, 0.32, 0.18), (sx * 0.585, -0.35, YAW + 0.78), 'yellow', 0.01)               # logo plate
            vent((sx * 0.57, 1.05, YAW + 0.78), 0.42, 0.26, 'X' if sx > 0 else '-X', 5, '#b7bec3', W2)
        # roof: cooler with fins, hatch, handrail, aviation light and wind sensor mast
        block((0.66, 0.62, 0.16), (0, 1.35, YAW + 1.26), W2, 0.04)
        for k in range(7): block((0.6, 0.025, 0.09), (0, 1.1 + k * 0.08, YAW + 1.38), 'steelD', 0.006)
        block((0.5, 0.6, 0.04), (0, 0.15, YAW + 1.19), '#d3d8db', 0.015)
        block((0.06, 0.08, 0.04), (0.2, -0.12, YAW + 1.23), 'dark', 0.008)
        for x in (-0.5, 0.5):
            for yy in (-0.35, 0.45, 1.0): cyl(0.016, 0.3, (x, yy, YAW + 1.32), 'yellow', verts=8, bevel=0)
            strut((x, -0.35, YAW + 1.47), (x, 1.0, YAW + 1.47), 0.016, 'yellow', True)
        cyl(0.025, 0.24, (-0.2, 1.55, YAW + 1.36), 'dark', verts=8)
        cyl(0.06, 0.04, (-0.2, 1.55, YAW + 1.495), 'dark', verts=12, bevel=0.008)
        lathe([(0.055, 0), (0.05, 0.05), (0.03, 0.09), (0, 0.1)], (-0.2, 1.55, YAW + 1.515), 'red', segs=14)   # aviation light (glow sits here)
        cyl(0.02, 0.6, (0.22, 1.55, YAW + 1.55), 'dark', verts=8)
        block((0.3, 0.02, 0.02), (0.22, 1.55, YAW + 1.86), 'dark', 0.004)
        for sx in (-1, 1): lathe([(0.04, 0), (0.035, 0.03), (0, 0.04)], (0.22 + sx * 0.15, 1.55, YAW + 1.86), W2, segs=10)
    parts = collect(nac)
    for o in parts: o.parent = yaw; o.matrix_parent_inverse = yaw.matrix_world.inverted()
    # ---------- rotor: smooth nose cone with a seam ring and three blades in bolted root cuffs
    rotor = empty('rotor', HUB); rotor.parent = yaw; rotor.matrix_parent_inverse = yaw.matrix_world.inverted()
    def rot():
        lathe([(0.58, 0), (0.62, 0.12), (0.62, 0.3), (0.57, 0.55), (0.45, 0.8), (0.28, 1.0), (0.1, 1.12), (0, 1.15)], (0, -0.86, YAW + 0.6), W, axis='-Y', segs=36, name='spinner')
        lathe([(0.635, 0), (0.635, 0.035)], (0, -0.97, YAW + 0.6), W2, axis='-Y', segs=36)
        cyl(0.5, 0.16, (0, -0.84, YAW + 0.6), 'steelD', axis='Y', verts=32, bevel=0.02)
        for k in range(3):
            a = k * math.tau / 3; d = Vector((math.sin(a), 0, math.cos(a))); c = Vector(HUB)
            b = blade(4.25, 0.64, 0.15, 18, 0.1, W)
            tip = blade(0.42, 0.16, 0.06, 0, 0.045, 'red'); tip.location = (0, 0, 4.22); tip.parent = b
            cuff = lathe([(0.2, 0), (0.21, 0.05), (0.2, 0.32), (0.17, 0.42), (0.14, 0.5)], (0, 0, -0.05), W2, segs=20); cuff.parent = b
            for j in range(10):
                aa = j / 10 * math.tau; bo = cyl(0.016, 0.03, (math.cos(aa) * 0.215, math.sin(aa) * 0.215, 0.02), 'steelD', verts=6, bevel=0); bo.parent = b
            b.rotation_euler = (0, a, 0); b.location = c + d * 0.48
    rp = collect(rot)
    for o in rp:
        if o.parent is None: o.parent = rotor; o.matrix_parent_inverse = rotor.matrix_world.inverted()

def solar_array():
    table = empty('table', G(0, 1.55, 0))
    tp = []
    def panels():
        cyl(0.08, 4.8, G(0, 1.55, 0), 'steelD', axis='X', verts=16)
        for z in (-0.86, 0.86): block((4.5, 0.08, 0.06), G(0, 1.62, z), 'steel', 0.01)
        for i in range(4):
            for j in (-1, 1):
                x = -1.62 + i * 1.08; z = j * 0.88
                block((1.04, 1.72, 0.06), G(x, 1.67, z), '#2a2f36', 0.012)              # aluminium frame
                block((0.98, 1.66, 0.02), G(x, 1.7, z), '#1f3d8a', 0.004)               # cells
                for c in range(1, 6): block((0.008, 1.64, 0.006), G(x - 0.49 + c * 0.163, 1.712, z), '#9fb3d9', 0.0)
                for r in range(1, 10): block((0.96, 0.008, 0.006), G(x, 1.712, z - 0.83 + r * 0.166), '#9fb3d9', 0.0)
                block((0.12, 0.06, 0.04), G(x, 1.64, z + j * 0.6), 'dark', 0.01)        # junction box
    tp = collect(panels)
    for o in tp: o.parent = table; o.matrix_parent_inverse = table.matrix_world.inverted()
    for x in (-1.95, 0, 1.95):
        block((0.7, 1.0, 0.32), G(x, 0.16, 0), CONC, 0.05)                              # ballast
        block((0.14, 0.14, 1.28), G(x, 0.92, 0), 'steel', 0.03)
        block((0.3, 0.3, 0.05), G(x, 0.34, 0), 'steelD', 0.01)
        cyl(0.15, 0.2, G(x, 1.55, 0), 'dark', axis='X', verts=16, bevel=0.02)
        for s in (-1, 1): strut(G(x, 0.4, s * 0.4), G(x, 1.2, 0), 0.045, 'steel')
    # inverter on its post (screen face at game z = 0.412 kept)
    block((0.1, 0.1, 1.6), G(3.1, 0.8, 0.18), 'steelD', 0.02)
    block((0.4, 0.4, 0.1), G(3.1, 0.05, 0.2), CONC, 0.02)
    block((0.54, 0.22, 0.68), G(3.1, 1.15, 0.3), W, 0.04)
    block((0.6, 0.28, 0.05), G(3.1, 1.51, 0.3), 'dark', 0.015)
    block((0.36, 0.02, 0.2), G(3.1, 1.3, 0.405), 'dark', 0.006)
    for k in range(4): block((0.42, 0.02, 0.03), G(3.1, 0.92 + k * 0.05, 0.412), W2, 0.004)
    cyl(0.03, 0.06, G(2.92, 0.86, 0.3), 'dark', verts=8)
    cyl(0.03, 0.06, G(3.28, 0.86, 0.3), 'dark', verts=8)

def battery():
    Lx, H, Wz = 6.06, 2.44, 2.44
    for x in (-2.6, 0, 2.6): block((0.55, 2.7, 0.3), G(x, 0.15, 0), CONC, 0.05)
    block((Lx, Wz, H), G(0, 0.3 + H / 2, 0), W, 0.04)
    for k in range(19):                                       # corrugation
        x = -Lx / 2 + 0.3 + k * 0.3
        for s in (-1, 1): block((0.12, 0.06, H - 0.24), G(x, 0.3 + H / 2, s * (Wz / 2 + 0.02)), W2, 0.02)
    block((Lx + 0.04, Wz + 0.08, 0.13), G(0, 0.36, 0), '#9aa2a8', 0.03)
    block((Lx - 0.1, Wz - 0.1, 0.04), G(0, 0.3 + H + 0.01, 0), W2, 0.01)                   # roof panel
    for sx in (-1, 1):
        for sz in (-1, 1): block((0.16, 0.16, 0.16), G(sx * (Lx / 2 - 0.06), 0.3 + H - 0.08, sz * (Wz / 2 - 0.06)), 'steelD', 0.02)   # corner castings
    # doors on +x with locking bars and handles
    for z in (-0.6, 0.6):
        block((0.05, 1.12, H - 0.26), G(Lx / 2 + 0.03, 0.3 + H / 2, z), W2, 0.02)
        for dz in (-0.26, 0.26):
            cyl(0.028, H - 0.3, G(Lx / 2 + 0.08, 0.3 + H / 2, z + dz), 'steel', verts=8, bevel=0)
            block((0.06, 0.06, 0.2), G(Lx / 2 + 0.11, 1.2, z + dz), 'dark', 0.01)
    # HVAC units on -x with fan shrouds; the fans are their own parts
    for i, z in enumerate((-0.6, 0.6)):
        block((0.42, 0.98, 0.95), G(-Lx / 2 - 0.21, 1.4, z), W2, 0.05)
        cyl(0.38, 0.06, G(-Lx / 2 - 0.42, 1.4, z), 'dark', axis='X', verts=24, bevel=0.01)
        f = empty(f'fan{i}', (0, 0, 0))
        fp = collect(lambda: [cyl(0.07, 0.05, (0, 0.02, 0), 'steelD', axis='Y', verts=12), [block((0.6, 0.012, 0.09), (0, 0.0, 0), 'steel', 0.004, rot=(0, k * math.pi / 4, 0)) for k in range(4)]])
        for o in fp: o.parent = f
    block((0.5, 0.12, 0.42), G(1.5, 0.75, Wz / 2 + 0.09), W2, 0.03)                      # DC junction box
    block((0.98, 0.02, 0.58), G(1.6, 1.85, Wz / 2 + 0.035), 'dark', 0.008)              # screen bezel
    block((1.38, 0.02, 0.4), G(-1.0, 2.1, Wz / 2 + 0.035), '#2f5a3b', 0.008)           # name plate backing

def distribution_panel():
    block((1.9, 0.95, 0.2), G(0, 0.1, 0), CONC, 0.04)
    block((1.52, 0.5, 1.88), G(0, 1.13, 0), '#c7cdd1', 0.05)
    block((1.66, 0.66, 0.08), G(0, 2.12, 0.04), 'dark', 0.03)                         # roof canopy
    block((1.44, 0.02, 1.8), G(0, 1.13, 0.246), '#eef1f2', 0.02)                       # door face (screen and breakers sit on it)
    for y in (0.5, 1.75): block((0.05, 0.06, 0.16), G(-0.74, y, 0.27), 'steelD', 0.01)  # hinges
    block((0.04, 0.06, 0.22), G(0.68, 1.13, 0.28), 'dark', 0.01)                         # handle
    for s in (-1, 1):
        for k in range(5): block((0.02, 0.36, 0.04), G(s * 0.77, 1.5 + k * 0.08, 0), 'steelD', 0.005)
    for x in (-0.5, -0.17, 0.17, 0.5): cyl(0.05, 0.12, G(x, 0.26, 0.0), 'dark', verts=10)     # cable glands into the plinth
    block((0.3, 0.02, 0.22), G(0.55, 0.35, 0.26), 'yellow', 0.006)

def transformer():
    block((2.1, 1.7, 0.25), G(0, 0.125, 0), CONC, 0.05)
    block((1.32, 0.97, 1.27), G(0, 0.88, 0), '#356a45', 0.06)
    block((1.4, 1.05, 0.09), G(0, 1.55, 0), 'green', 0.03)
    for s in (-1, 1):                                                              # radiator banks
        for k in range(7): block((0.26, 0.035, 1.0), G(s * 0.8, 0.84, -0.4 + k * 0.133), '#2d5a3a', 0.008)
        for y in (0.42, 1.28): cyl(0.035, 0.95, G(s * 0.68, y, 0.0), 'steelD', axis='Y', verts=8)
    cyl(0.17, 0.9, G(0, 1.82, 0.32), '#2d5a3a', axis='X', verts=20, bevel=0.03)      # conservator tank
    for x in (-0.35, 0.35): block((0.06, 0.06, 0.22), G(x, 1.68, 0.32), 'steelD', 0.01)
    pipe([G(0.3, 1.6, 0.2), G(0.3, 1.75, 0.25)], 0.025, 'steelD', bend=0)
    for x in (-0.38, 0.0, 0.38):                                                     # HV bushings (tips at game y 1.96)
        cyl(0.09, 0.06, G(x, 1.62, -0.15), 'steelD', verts=12)
        for k in range(4): cyl(0.075 - k * 0.004, 0.05, G(x, 1.68 + k * 0.075, -0.15), PORC, verts=14, bevel=0.012)
        cyl(0.035, 0.12, G(x, 1.93, -0.15), 'steel', verts=8)
    for x in (-0.3, 0.0, 0.3): cyl(0.04, 0.16, G(x, 1.65, 0.25), 'dark', verts=10)    # LV bushings
    block((0.46, 0.16, 0.36), G(0, 0.5, 0.55), '#2d5a3a', 0.03)                      # LV cable box
    block((0.3, 0.02, 0.18), G(0.42, 1.2, 0.486), 'steel', 0.004)                     # rating plate

def utility_pole(h=7.5):
    cyl(0.11, h, (0, 0, h / 2), WOOD, verts=10, bevel=0, r2=0.11) if False else cyl(0.16, h, (0, 0, h / 2), WOOD, verts=10, bevel=0, r2=0.11)
    for y in (h - 0.02,): cyl(0.12, 0.04, (0, 0, y), 'dark', verts=10)
    for k in range(9): cyl(0.016, 0.16, G(0.1 if k % 2 else -0.1, 1.6 + k * 0.5, 0.0), 'steel', axis='X', verts=6)   # step bolts
    block((2.0, 0.14, 0.14), G(0, h - 0.45, 0), WOODD, 0.025)
    for s in (-1, 1): strut(G(s * 0.75, h - 0.5, 0.08), G(0, h - 1.15, 0.08), 0.045, 'steelD')
    for i, x in enumerate((-0.85, 0, 0.85)):
        y = h + 0.05 if i == 1 else h - 0.38
        if i == 1: cyl(0.035, 0.32, G(0, h - 0.1, 0), 'steel', verts=8)
        cyl(0.03, 0.1, G(x, y + 0.0, 0), 'steel', verts=8)
        cyl(0.075, 0.08, G(x, y + 0.07, 0), INS, verts=14, bevel=0.01, r2=0.05)
        cyl(0.088, 0.03, G(x, y + 0.115, 0), INS, verts=14, bevel=0.008)
        cyl(0.045, 0.04, G(x, y + 0.14, 0), INS, verts=12, bevel=0.008)
    block((0.18, 0.08, 0.26), G(0, h - 1.8, 0.14), 'yellow', 0.01)                    # pole tag

def lattice_tower(h=17):
    hw = lambda y: 1.7 + (0.42 - 1.7) * min(1, y / (h * 0.78))
    levels = [0, 2.6, 5.0, 7.2, 9.2, 11.0, 12.6, 13.9, h - 1.2, h]
    S = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    C = lambda y, sx, sz: G(sx * hw(y), y, sz * hw(y))
    M = '#9aa3ab'
    for i in range(len(levels) - 1):
        y0, y1 = levels[i], levels[i + 1]
        for k in range(4):
            (ax, az), (bx, bz) = S[k], S[(k + 1) % 4]
            strut(C(y0, ax, az), C(y1, ax, az), 0.12, M)
            strut(C(y1, ax, az), C(y1, bx, bz), 0.065, M)
            ym = (y0 + y1) / 2                                                           # K-bracing to a mid node
            mid = Vector(C(ym, ax, az)).lerp(Vector(C(ym, bx, bz)), 0.5)
            strut(C(y0, ax, az), mid, 0.05, M); strut(C(y0, bx, bz), mid, 0.05, M)
            strut(mid, C(y1, ax, az), 0.045, M); strut(mid, C(y1, bx, bz), 0.045, M)
    for (y, L), j in (((13.2, 3.0), 0), ((h - 1.0, 2.2), 1)):
        for s in (-1, 1):
            strut(G(s * hw(y), y, -0.35), G(s * L, y + 0.35, 0), 0.075, M); strut(G(s * hw(y), y, 0.35), G(s * L, y + 0.35, 0), 0.075, M)
            strut(G(s * hw(y + 1.1), y + 1.1, 0), G(s * L, y + 0.4, 0), 0.06, M)
            if j == 0 or s < 0:
                t = (s * L, y + 0.35 - 0.7)
                cyl(0.03, 0.72, G(t[0], t[1] + 0.35, 0), 'steelD', verts=8)
                for k in range(6): cyl(0.13, 0.045, G(t[0], t[1] + 0.1 + k * 0.1, 0), '#8fb3c9', verts=14, bevel=0.012)   # glass discs
                cyl(0.05, 0.06, G(t[0], t[1] + 0.02, 0), 'dark', verts=8)
    strut(G(0, h, 0), G(0, h + 1.3, 0), 0.08, M)
    for sx, sz in S:
        block((0.8, 0.8, 0.4), G(sx * 1.7, 0.12, sz * 1.7), CONC, 0.06)
        block((0.3, 0.3, 0.12), G(sx * 1.7, 0.36, sz * 1.7), 'steelD', 0.02)
    block((0.4, 0.02, 0.3), G(0, 2.2, -1.25), 'yellow', 0.01)                         # danger plate

def yard_light():
    block((0.44, 0.44, 0.22), (0, 0, 0.11), CONC, 0.04)
    block((0.26, 0.26, 0.03), (0, 0, 0.235), 'steelD', 0.01)
    for sx in (-1, 1):
        for sy in (-1, 1): bolt((sx * 0.1, sy * 0.1, 0.25), 'Z', 0.018, 0.02)
    cyl(0.09, 5.0, (0, 0, 2.75), 'dark', verts=16, bevel=0, r2=0.055)
    cyl(0.1, 0.4, (0, 0, 0.45), '#4a5057', verts=16, bevel=0.02)
    pipe([(0, 0, 5.1), (0.0, 0, 5.22), (0.3, 0, 5.24), (0.62, 0, 5.22)], 0.04, 'dark', bend=0.12)
    block((0.6, 0.34, 0.12), (0.9, 0, 5.16), '#3b4045', 0.03)                            # LED head (lens below)
    for k in range(5): block((0.5, 0.02, 0.05), (0.9, -0.12 + k * 0.06, 5.245), 'steelD', 0.005)   # cooling fins
    cyl(0.03, 0.04, (0.62, 0, 5.16), 'steelD', axis='X', verts=8)

MODELS = {'wind_turbine': wind_turbine, 'solar_array': solar_array, 'battery': battery, 'dist_panel': distribution_panel,
          'transformer': transformer, 'utility_pole': utility_pole, 'lattice_tower': lattice_tower, 'yard_light': yard_light}

if __name__ == '__main__':
    out, png = args()
    only = os.environ.get('ONLY')
    for name, fn in MODELS.items():
        if only and name not in only.split(','): continue
        reset(); fn(); export(os.path.join(out, name + '.glb')); print('exported', name)
    if png:
        reset()
        lay = [('wind_turbine', -16, 0), ('solar_array', -9, 1), ('battery', -1.5, 1), ('dist_panel', 4.3, 1), ('transformer', 7.3, 1), ('utility_pole', 10, 0), ('lattice_tower', 15, 0), ('yard_light', 20, 0)]
        for name, x, _ in lay:
            before = set(bpy.data.objects); MODELS[name](); new = [o for o in bpy.data.objects if o not in before and o.parent is None]
            for o in new: o.location.x += x
        preview(png, cam_loc=(-2, -17, 5.5), target=(-2, 0, 1.2), lens=32, size=(1800, 800))
        preview(png.replace('.png', '_tall.png'), cam_loc=(2, -44, 9), target=(2, 0, 9), lens=40, size=(1800, 900))
