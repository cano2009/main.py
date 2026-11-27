# Fieldworks power yard, mid-poly (original designs): transformer, battery container (BESS), distribution panel and the
# solar array with its inverter. Built to the detail level of a commercial simulation game: two-tone painted casings,
# recessed grilles with slats, panel seams, corner screws, hazard stripes, nameplates, conduits into the ground, and
# soft rounded bevels with weighted normals. Each model leaves room for the game's own live pieces, which stay:
# screens, labels and LEDs (canvas and glow materials), the battery's HVAC fans, the breaker handles, the transformer's
# wire tips and sockets, and the solar table, which turns with the tracker (the Blender 'table' node is attached to it).
# Written in GAME coordinates (x east, y up, z south) through small wrappers; Blender gets (x, -z, y).
# Usage: blender -b --python power_yard.py -- <models dir> [preview prefix]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import factory_parts as F
from factory_parts import *
import bmesh

WHITE = '#e6e8e2'; WHITED = '#c8ccc4'; GRAPH = '#3a3f44'; GRAPHD = '#2b2f33'; FWG = '#3f8a4f'; FWGD = '#2f6a3c'
XG = '#5f7f5a'; XGD = '#4b6948'; PORC = '#c9642c'; PORCD = '#a84f20'; CONC = '#b9b4aa'; CONCD = '#9e998f'
HAZY = '#f2c21f'; ALU = '#c7ccd0'; INK = '#1e2124'
F.ROLE.update({WHITE: (0.42, 0.08), WHITED: (0.45, 0.1), GRAPH: (0.5, 0.25), GRAPHD: (0.55, 0.25), FWG: (0.42, 0.08), FWGD: (0.45, 0.08),
               XG: (0.48, 0.12), XGD: (0.5, 0.12), PORC: (0.25, 0.0), PORCD: (0.3, 0.0), CONC: (0.92, 0.0), CONCD: (0.92, 0.0),
               HAZY: (0.45, 0.0), ALU: (0.3, 0.65), INK: (0.6, 0.1)})

# ---------------------------------------------------------------------------
# game-frame wrappers
def gb(sx, sy, sz, x, y, z, m, bev=0.02): return block((sx, sz, sy), (x, -z, y), m, bev)
def gc(r, h, x, y, z, m, axis='y', verts=16, bevel=0.01, r2=None):
    return cyl(r, h, (x, -z, y), m, axis={'x': 'X', 'y': 'Z', 'z': 'Y'}[axis], verts=verts, bevel=bevel, r2=r2)
def gp(points, r, m, bend=0.06): return pipe([(x, -z, y) for x, y, z in points], r, m, bend=bend)
def gbar(a, b, w, h, m): return bar(Vector((a[0], -a[2], a[1])), Vector((b[0], -b[2], b[1])), w, h, m)

# face frames: u runs across the face (left to right seen from outside), n points out of the face
FACES = {'+z': ((1, 0, 0), (0, 0, 1)), '-z': ((-1, 0, 0), (0, 0, -1)), '+x': ((0, 0, -1), (1, 0, 0)), '-x': ((0, 0, 1), (-1, 0, 0))}
def fpt(f, o, cu, cv, cn):
    u, n = FACES[f]; return (o[0] + u[0] * cu + n[0] * cn, o[1] + cv, o[2] + u[2] * cu + n[2] * cn)
def fblock(f, o, cu, cv, cn, w, h, d, m, bev=0.004):
    u, n = FACES[f]; c = fpt(f, o, cu, cv, cn)
    return gb(w if u[0] else d, h, w if u[2] else d, *c, m, bev)
def fcyl(f, o, cu, cv, cn, r, d, m, verts=12, bevel=0.003):
    u, n = FACES[f]; c = fpt(f, o, cu, cv, cn); return gc(r, d, *c, m, axis='x' if n[0] else 'z', verts=verts, bevel=bevel)
def fquad(f, o, pts, cn, d, m):
    """A thin prism from a polygon given in face (u, v) coordinates."""
    bm = bmesh.new()
    def W(u_, v_, k):
        x, y, z = fpt(f, o, u_, v_, cn + k); return (x, -z, y)
    a = [bm.verts.new(W(u_, v_, 0)) for u_, v_ in pts]; b = [bm.verts.new(W(u_, v_, d)) for u_, v_ in pts]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    for k in range(len(pts)): bm.faces.new((a[k], a[(k + 1) % len(pts)], b[(k + 1) % len(pts)], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('quad'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('quad', me); bpy.context.collection.objects.link(ob); ob.data.materials.append(mat(m)); return ob

# detail kit
def grille(f, o, w, h, slats=None, frame=GRAPH, back=INK, slat=GRAPH):
    """Recessed louvre grille: dark backing, a raised frame and angled slats."""
    slats = slats or max(3, int(h / 0.045))
    fblock(f, o, 0, 0, 0.003, w, h, 0.006, back, 0.0)
    for s in (-1, 1):
        fblock(f, o, 0, s * (h / 2 - 0.012), 0.012, w, 0.024, 0.018, frame, 0.004)
        fblock(f, o, s * (w / 2 - 0.012), 0, 0.012, 0.024, h, 0.018, frame, 0.004)
    for k in range(slats):
        v = -h / 2 + 0.03 + k * (h - 0.06) / max(1, slats - 1)
        fblock(f, o, 0, v, 0.01, w - 0.04, 0.012, 0.016, slat, 0.0)
def screws(f, o, w, h, inset=0.03, r=0.012, m='steel'):
    for su in (-1, 1):
        for sv in (-1, 1): fcyl(f, o, su * (w / 2 - inset), sv * (h / 2 - inset), 0.004, r, 0.008, m, verts=8, bevel=0.002)
def seam(f, o, w, h, m=GRAPHD, t=0.008):
    """A panel outline: thin dark grooves around a door or service panel."""
    for s in (-1, 1):
        fblock(f, o, 0, s * h / 2, 0.001, w, t, 0.004, m, 0.0)
        fblock(f, o, s * w / 2, 0, 0.001, t, h, 0.004, m, 0.0)
def hazard(f, o, w, h, cn=0.002, band=None):
    """Yellow and black diagonal hazard band."""
    band = band or h * 1.1
    fblock(f, o, 0, 0, cn, w, h, 0.006, HAZY, 0.0)
    k = -w / 2 - h
    while k < w / 2:
        p = [(k, -h / 2), (k + band / 2, -h / 2), (k + band / 2 + h, h / 2), (k + h, h / 2)]
        p = [(min(max(u, -w / 2), w / 2), v) for u, v in p]
        if p[1][0] - p[0][0] > 0.002 or p[2][0] - p[3][0] > 0.002: fquad(f, o, p, cn + 0.006, 0.002, INK)
        k += band
def plate(f, o, w, h, bg='cream', lines=3):
    """Riveted nameplate with printed lines."""
    fblock(f, o, 0, 0, 0.003, w, h, 0.006, bg, 0.002)
    for i in range(lines): fblock(f, o, -w * 0.08, h / 2 - (i + 1) * h / (lines + 1), 0.0065, w * (0.7 - 0.12 * (i % 2)), h * 0.08, 0.001, INK, 0.0)
    screws(f, o, w, h, 0.015, 0.007)
def led(f, o, cu, cv, col, k=2.0):
    glow(fcyl(f, o, cu, cv, 0.006, 0.012, 0.012, col, verts=8, bevel=0), col, k)
def hinge(f, o, cu, cv, h=0.12):
    u, n = FACES[f]; c = fpt(f, o, cu, cv, 0.016); gc(0.016, h, *c, GRAPHD, axis='y', verts=8, bevel=0.003)
def conduit(top, down=0.0, r=0.03, m=GRAPH):
    """A cable conduit from a gland down into the ground with a sweep at the bottom."""
    x, y, z = top; gp([(x, y, z), (x, down + 0.12, z), (x, down + 0.02, z + 0.12)], r, m, bend=0.06)
def anchor_bolts(x0, x1, z0, z1, y, k=0.04):
    for x in (x0, x1):
        for z in (z0, z1):
            gc(0.03, 0.01, x, y + 0.005, z, GRAPH, verts=6, bevel=0.002); gc(0.014, 0.04, x, y + 0.02, z, 'steel', verts=6, bevel=0.002)
def pad(w, h, d, y0=0.0, m=CONC):
    gb(w, h, d, 0, y0 + h / 2, 0, m, 0.03)
    gb(w - 0.06, 0.012, d - 0.06, 0, y0 + h + 0.002, 0, CONCD, 0.004)      # trowelled top with a margin

# ---------------------------------------------------------------------------
def transformer():
    """Pad-mounted oil transformer: ribbed radiator banks, conservator, porcelain bushings, LV cable box."""
    pad(2.0, 0.25, 1.6)
    gb(1.5, 0.05, 1.12, 0, 0.275, 0, GRAPH, 0.01)                             # skid channels
    for x in (-0.6, 0.6): gb(0.1, 0.06, 1.18, x, 0.28, 0, GRAPHD, 0.008)
    Y0, Y1 = 0.3, 1.505
    gb(1.3, Y1 - Y0, 0.95, 0, (Y0 + Y1) / 2, 0, XG, 0.03)                       # tank
    for y in (Y0 + 0.06, Y1 - 0.05): gb(1.34, 0.05, 0.99, 0, y, 0, XGD, 0.012)  # stiffener bands
    gb(1.38, 0.06, 1.03, 0, Y1 + 0.03, 0, XGD, 0.015)                           # cover flange
    for k in range(10):                                                         # cover bolts
        a = -0.62 + k * 0.137
        for z in (-0.49, 0.49): gc(0.013, 0.02, a, Y1 + 0.07, z, 'steel', verts=6, bevel=0.002)
    gb(1.2, 0.04, 0.85, 0, Y1 + 0.08, 0, XG, 0.01)
    # radiator banks on both sides: fins with top and bottom headers
    for s in (-1, 1):
        for k in range(7):
            z = -0.36 + k * 0.12
            gb(0.26, 0.9, 0.035, s * 0.79, 0.86, z, XG, 0.006)
        for y in (0.42, 1.3): gc(0.04, 0.82, s * 0.79, y, 0.0, XGD, axis='z', verts=10)
        for y in (0.42, 1.3): gc(0.035, 0.14, s * 0.7, y, 0.0, XGD, axis='x', verts=10)
    # conservator tank on brackets with an oil level gauge, Buchholz relay pipe
    CX, CY, CZ = 0.56, 1.84, 0.27                                               # runs front to back on the east side, clear of the bushings
    gc(0.15, 0.56, CX, CY, CZ, XG, axis='z', verts=16, bevel=0.02)
    for z in (CZ - 0.28, CZ + 0.28): gc(0.155, 0.03, CX, CY, z, XGD, axis='z', verts=16, bevel=0.004)
    for z in (CZ - 0.16, CZ + 0.16): gb(0.06, 0.28, 0.06, CX, 1.66, z, XGD, 0.008)
    fcyl('+z', (CX, CY, CZ + 0.28), 0, 0, 0.01, 0.06, 0.03, GRAPH); fcyl('+z', (CX, CY, CZ + 0.28), 0, 0, 0.025, 0.05, 0.01, 'cream')
    gp([(CX - 0.1, 1.72, CZ - 0.1), (CX - 0.22, 1.62, CZ - 0.1), (CX - 0.22, Y1 + 0.1, CZ - 0.1)], 0.025, XGD, bend=0.04)
    gb(0.08, 0.08, 0.1, CX - 0.22, 1.6, CZ - 0.1, GRAPH, 0.01)
    # high-voltage bushings: stacked porcelain sheds with terminal caps (tips at y 1.96)
    for x in (-0.38, 0, 0.38):
        gc(0.08, 0.06, x, Y1 + 0.13, -0.15, GRAPH, verts=12)
        for k in range(5): gc(0.07 - k * 0.004, 0.035, x, 1.62 + k * 0.06, -0.15, PORC, verts=12, bevel=0.01)
        gc(0.04, 0.32, x, 1.76, -0.15, PORCD, verts=12)
        gc(0.03, 0.05, x, 1.935, -0.15, 'steel', verts=8)
    # low-voltage bushings and the cable box on the front (LV input port at y 0.5, z 0.615)
    for x in (-0.3, 0, 0.3):
        gc(0.045, 0.1, x, Y1 + 0.13, 0.25, GRAPH, verts=10); gc(0.03, 0.08, x, 1.65, 0.25, PORC, verts=10)
    gb(0.5, 0.36, 0.14, 0, 0.5, 0.545, XGD, 0.02); seam('+z', (0, 0.5, 0.615), 0.42, 0.28); screws('+z', (0, 0.5, 0.615), 0.46, 0.32, 0.02)
    for x in (-0.15, 0.15): conduit((x, 0.33, 0.56), 0.25, 0.028)
    # front details (the game's DANGER label sits at y 0.95 in the centre): thermometer, nameplate, drain valve, earth
    gauge_f = (-0.45, 1.18, 0.475); fcyl('+z', gauge_f, 0, 0, 0.012, 0.07, 0.025, GRAPH); fcyl('+z', gauge_f, 0, 0, 0.026, 0.058, 0.005, 'cream')
    fblock('+z', gauge_f, 0.0, 0.015, 0.03, 0.006, 0.04, 0.004, '#d24a35', 0.0)
    plate('+z', (0.45, 1.18, 0.475), 0.24, 0.16)
    gc(0.035, 0.12, 0.45, 0.4, 0.5, GRAPH, axis='z', verts=10); gb(0.08, 0.03, 0.03, 0.45, 0.4, 0.57, '#d24a35', 0.004)
    gp([(-0.64, 0.4, 0.4), (-0.75, 0.3, 0.55), (-0.8, 0.26, 0.7)], 0.012, COPPER, bend=0.03)          # earthing strap
    gb(0.06, 0.04, 0.04, -0.64, 0.4, 0.42, 'steel', 0.004)
    gc(0.05, 0.08, 0.5, Y1 + 0.12, -0.3, GRAPH, verts=10); gc(0.03, 0.06, 0.5, Y1 + 0.19, -0.3, '#d24a35', verts=8)   # pressure relief
    for x in (-0.55, 0.55):                                                     # lifting lugs
        for z in (-0.4, 0.4): gb(0.04, 0.1, 0.1, x, Y1 + 0.12, z, XGD, 0.008)
    hazard('+z', (0, 0.3, 0.81), 1.9, 0.07)                                     # curb edge of the pad
    anchor_bolts(-0.6, 0.6, -0.5, 0.5, 0.25)

def bess():
    """20 ft battery container: corrugated white walls, corner castings, cam-lock doors, HVAC on the far end."""
    Lx, H, Wz, Y0 = 6.06, 2.44, 2.44, 0.3
    for x in (-2.6, 0, 2.6): gb(0.5, 0.3, 2.6, x, 0.15, 0, CONC, 0.03); anchor_bolts(x - 0.15, x + 0.15, -1.1, 1.1, 0.3)
    gb(Lx - 0.1, H - 0.1, Wz - 0.08, 0, Y0 + H / 2, 0, WHITE, 0.02)               # box
    for y in (Y0 + 0.06, Y0 + H - 0.06):                                        # top and bottom rails
        for s in (-1, 1): gb(Lx - 0.2, 0.12, 0.08, 0, y, s * (Wz / 2 - 0.02), WHITED, 0.012)
        for s in (-1, 1): gb(0.08, 0.12, Wz - 0.2, s * (Lx / 2 - 0.02), y, 0, WHITED, 0.012)
    for sx in (-1, 1):                                                          # corner posts and castings
        for sz in (-1, 1):
            gb(0.12, H - 0.24, 0.12, sx * (Lx / 2 - 0.04), Y0 + H / 2, sz * (Wz / 2 - 0.04), WHITED, 0.015)
            for y in (Y0 + 0.08, Y0 + H - 0.08): gb(0.18, 0.12, 0.16, sx * (Lx / 2 - 0.06), y, sz * (Wz / 2 - 0.06), GRAPH, 0.012)
    # corrugated sides (kept within z 1.25 so the game's labels and screen sit proud of them)
    for s in (-1, 1):
        for k in range(18):
            x = -Lx / 2 + 0.34 + k * 0.31
            if s > 0 and (0.98 < x < 2.22 or -1.7 < x < -0.3) : gb(0.12, 0.5, 0.04, x, Y0 + 0.4, s * 1.21, WHITE, 0.008); continue
            gb(0.12, H - 0.32, 0.04, x, Y0 + H / 2, s * 1.21, WHITE, 0.008)
    gb(Lx - 0.3, 0.1, 0.02, 0, Y0 + 0.28, 1.235, FWG, 0.003)                    # Fieldworks green band
    gb(Lx - 0.3, 0.1, 0.02, 0, Y0 + 0.28, -1.235, FWG, 0.003)
    # mounting bezels behind the game's SOC screen and name board
    fblock('+z', (1.6, 1.85, 1.22), 0, 0, 0.0, 1.02, 0.62, 0.035, GRAPH, 0.01); screws('+z', (1.6, 1.85, 1.255), 1.0, 0.6, 0.025)
    fblock('+z', (-1.0, 2.1, 1.22), 0, 0, 0.0, 1.38, 0.4, 0.035, FWGD, 0.01)
    # DC junction box with glands and conduits into the plinth, fire panel and status lamp
    gb(0.5, 0.42, 0.12, 1.5, 0.75, 1.28, WHITED, 0.02); seam('+z', (1.5, 0.75, 1.34), 0.44, 0.36); hazard('+z', (1.5, 0.96, 1.342), 0.3, 0.05)
    for x in (1.38, 1.62): conduit((x, 0.54, 1.3), 0.0, 0.03)
    gb(0.34, 0.44, 0.08, -2.3, 1.2, 1.26, '#d24a35', 0.02); plate('+z', (-2.3, 1.28, 1.3), 0.24, 0.14, '#f2efe4', 2)
    led('+z', (-2.3, 1.06, 1.3), 0, 0, '#ff5a48', 1.6)
    # doors on +x with four locking bars, cams, handles and seals
    for z in (-0.58, 0.58):
        gb(0.05, H - 0.28, 1.12, Lx / 2 - 0.02, Y0 + H / 2, z, WHITE, 0.012)
        seam('+x', (Lx / 2 + 0.005, Y0 + H / 2, z), 1.06, H - 0.36)
        for dz in (-0.26, 0.26):
            gc(0.025, H - 0.3, Lx / 2 + 0.06, Y0 + H / 2, z + dz, 'steel', verts=10)
            for y in (Y0 + 0.25, Y0 + H - 0.25): gb(0.05, 0.08, 0.08, Lx / 2 + 0.045, y, z + dz, GRAPH, 0.008)
            gb(0.04, 0.32, 0.05, Lx / 2 + 0.09, Y0 + 1.05, z + dz, GRAPH, 0.008)
    plate('+x', (Lx / 2 + 0.01, Y0 + 1.75, -0.58), 0.3, 0.2)
    # HVAC on -x: two cabinets with grilles; the game's fans spin in the round openings (guards in front of them)
    for z in (-0.6, 0.6):
        gb(0.4, 0.9, 0.95, -Lx / 2 - 0.205, 1.4, z, WHITED, 0.02)
        seam('-x', (-Lx / 2 - 0.405, 1.4, z), 0.88, 0.84)
        ring(0.36, 0.022, (-Lx / 2 - 0.415, -z, 1.4), GRAPH, axis='X', segs=24)
        for k in range(5): gbar((-Lx / 2 - 0.46, 1.4 - 0.3 + k * 0.15, z - 0.34 + abs(k - 2) * 0.06), (-Lx / 2 - 0.46, 1.4 - 0.3 + k * 0.15, z + 0.34 - abs(k - 2) * 0.06), 0.012, 0.012, GRAPH)
        for d in (-1, 1): gbar((-Lx / 2 - 0.45, 1.4, z), (-Lx / 2 - 0.45, 1.4 + d * 0.36, z), 0.014, 0.014, GRAPH)
        grille('-x', (-Lx / 2 - 0.405, 1.04, z), 0.8, 0.12, 3, WHITED, INK, GRAPH)
        gb(0.3, 0.06, 0.9, -Lx / 2 - 0.2, 0.92, z, GRAPH, 0.01)
    # roof: slight crown, vent hoods, cable tray over the HVAC end
    gb(Lx - 0.2, 0.04, Wz - 0.2, 0, Y0 + H + 0.0, 0, WHITED, 0.01)
    for x in (-1.6, 0.0, 1.6):
        gb(0.42, 0.14, 0.42, x, Y0 + H + 0.09, 0, WHITED, 0.02); grille('+z', (x, Y0 + H + 0.09, 0.21), 0.36, 0.1, 3, WHITED, INK, GRAPH)

def dist_panel():
    """Outdoor switchboard: canopy roof, a door with a breaker window and screen bezel, side grilles, conduits."""
    pad(1.8, 0.2, 0.9)
    gb(1.56, 0.1, 0.52, 0, 0.25, 0, GRAPH, 0.012)                              # plinth
    hazard('+z', (0, 0.25, 0.262), 1.5, 0.06)
    gb(1.5, 1.85, 0.46, 0, 1.13, -0.01, '#9aa3a8', 0.025)                       # cabinet
    gb(1.62, 0.06, 0.62, 0, 2.08, 0.03, GRAPH, 0.012); gb(1.66, 0.02, 0.66, 0, 2.11, 0.03, GRAPHD, 0.004)   # canopy with drip edge
    # door: off-white face, outline seam, hinges, handle with lock; the breaker window and screen bezel are cut out
    fblock('+z', (0, 1.13, 0.22), 0, 0, 0.0, 1.42, 1.77, 0.03, WHITE, 0.008)
    seam('+z', (0, 1.13, 0.251), 1.38, 1.73)
    for y in (0.55, 1.13, 1.7): hinge('+z', (0, y, 0.24), -0.7, 0)
    fblock('+z', (0, 1.13, 0.25), 0.62, -0.1, 0.0, 0.05, 0.22, 0.03, GRAPH, 0.008); fcyl('+z', (0, 1.13, 0.25), 0.62, 0.05, 0.03, 0.018, 0.02, 'steel', verts=10)
    fblock('+z', (0, 1.68, 0.251), 0, 0, 0.0, 1.2, 0.6, 0.012, GRAPHD, 0.006)        # screen bezel (screen at z 0.265)
    led_strip((1.5, 0.02, 0.02), (0, -0.33, 2.03))                                 # LED under the canopy edge
    for sx in (-1, 1): led_strip((0.02, 0.02, 1.6), (sx * 0.716, -0.235, 1.13))       # door edge accents
    fblock('+z', (0, 0.95, 0.24), 0, 0, 0.0, 1.46, 0.5, 0.012, INK, 0.0)           # breaker window, recessed
    for s in (-1, 1): fblock('+z', (0, 0.95, 0.25), 0, s * 0.255, 0.0, 1.46, 0.02, 0.02, GRAPH, 0.004)
    for i in range(5):                                                         # breaker bodies (handles and labels are the game's)
        x = -0.56 + i * 0.28
        gb(0.2, 0.34, 0.06, x, 0.95, 0.27, INK, 0.012); gb(0.12, 0.22, 0.012, x, 0.95, 0.303, GRAPH, 0.004)
    plate('+z', (0.45, 0.48, 0.251), 0.3, 0.14)
    plate('+z', (-0.45, 0.48, 0.251), 0.3, 0.14, HAZY, 2)
    # sides: grilles, lifting eyes on the roof, conduits into the pad
    for s in (-1, 1):
        f = '+x' if s > 0 else '-x'
        grille(f, (s * 0.75, 0.6, 0.0), 0.3, 0.3, 6); grille(f, (s * 0.75, 1.65, 0.0), 0.3, 0.3, 6)
        ring(0.035, 0.01, (s * 0.6, -0.03, 2.15), 'steel', axis='Y', segs=10)
    for x in (-0.5, -0.25, 0.0, 0.25, 0.5): gp([(x, 0.3, -0.26), (x, 0.16, -0.3), (x, 0.03, -0.42)], 0.035, GRAPH, bend=0.05)
    gb(1.3, 0.1, 0.06, 0, 0.3, -0.27, GRAPHD, 0.008)                           # gland plate
    anchor_bolts(-0.8, 0.8, -0.38, 0.38, 0.2)

def solar():
    """Single-axis tracker: three driven piles with bearings, a torque tube and four framed modules a side (the table
    node turns with the game's tracker), and a string inverter on its own post with a canopy and DC isolator."""
    for x in (-1.95, 0, 1.95):
        gb(0.6, 0.3, 0.9, x, 0.15, 0, CONC, 0.03); anchor_bolts(x - 0.2, x + 0.2, -0.3, 0.3, 0.3)
        gb(0.14, 1.3, 0.14, x, 0.95, 0, ALU, 0.012); gb(0.24, 0.03, 0.24, x, 0.315, 0, GRAPH, 0.006)
        for k in range(2): gb(0.15, 0.02, 0.15, x, 0.5 + k * 0.6, 0, GRAPH, 0.004)
        gb(0.2, 0.18, 0.24, x, 1.48, 0, GRAPH, 0.02)                          # bearing housing
        gc(0.14, 0.18, x, 1.55, 0, GRAPHD, axis='x', verts=16, bevel=0.01)
    def table():
        gc(0.08, 4.7, 0, 1.55, 0, ALU, axis='x', verts=12, bevel=0.005)
        for z in (-0.85, 0.85): gb(4.5, 0.06, 0.08, 0, 1.61, z, ALU, 0.008)        # purlins
        for x in (-1.62, -0.54, 0.54, 1.62):
            for z in (-0.88, 0.88):
                gb(1.0, 0.03, 1.68, x, 1.655, z, '#2a3340', 0.004)               # module backsheet (cells are the game's)
                for s in (-1, 1):                                               # anodised frame around the cell face
                    gb(1.04, 0.035, 0.03, x, 1.685, z + s * 0.845, ALU, 0.004)
                    gb(0.03, 0.035, 1.72, x + s * 0.505, 1.685, z, ALU, 0.004)
                gb(0.14, 0.04, 0.1, x, 1.615, z - 0.4 * (1 if z > 0 else -1), INK, 0.006)   # junction box
        for x in (-1.62, -0.54, 0.54, 1.62): gb(0.06, 0.05, 1.7, x, 1.6, 0, GRAPH, 0.006)   # rails across the tube
        for x in (-1.95, 0.0, 1.95): gc(0.11, 0.06, x, 1.55, 0, GRAPH, axis='x', verts=12)  # clamps at the bearings
    node('table', (0, -0.0, 1.55), table)
    # string inverter at (3.1, 0, 0.3): post, canopy, finned heatsink, isolator, grilles; screen at y 1.3, z 0.412
    X, Z = 3.1, 0.3
    gb(0.3, 0.2, 0.4, X, 0.1, Z - 0.05, CONC, 0.02)
    gb(0.1, 1.6, 0.1, X, 0.9, Z - 0.12, ALU, 0.01)
    gb(0.56, 0.66, 0.2, X, 1.15, Z, WHITE, 0.025)
    fblock('+z', (X, 1.15, Z + 0.1), 0, 0, 0.0, 0.5, 0.6, 0.006, WHITED, 0.004); seam('+z', (X, 1.15, Z + 0.106), 0.5, 0.6)
    fblock('+z', (X, 1.3, Z + 0.106), 0, 0, 0.0, 0.34, 0.2, 0.004, INK, 0.003)        # screen bezel
    grille('+z', (X, 0.92, Z + 0.106), 0.42, 0.12, 4, WHITED, INK, GRAPH)
    led_strip((0.46, 0.012, 0.016), (X, -(Z + 0.108), 1.44))                        # status stripe on the inverter
    for k in range(7): gb(0.012, 0.56, 0.06, X - 0.21 + k * 0.07, 1.15, Z - 0.13, GRAPH, 0.002)   # heatsink fins at the back
    gb(0.64, 0.04, 0.34, X, 1.53, Z + 0.02, GRAPH, 0.01)                        # canopy
    gb(0.14, 0.18, 0.1, X + 0.38, 1.0, Z, GRAPH, 0.015)                          # DC isolator
    fcyl('+z', (X + 0.38, 1.0, Z + 0.05), 0, 0.02, 0.0, 0.045, 0.02, HAZY, verts=12); fblock('+z', (X + 0.38, 1.02, Z + 0.07), 0, 0, 0.0, 0.08, 0.025, 0.02, '#d24a35', 0.004)
    gp([(X + 0.38, 0.91, Z), (X + 0.38, 0.4, Z - 0.05), (X + 0.3, 0.22, Z - 0.1)], 0.02, GRAPH, bend=0.05)
    gp([(X, 0.82, Z - 0.02), (X, 0.25, Z - 0.05)], 0.025, GRAPH, bend=0)
    gp([(1.95, 1.4, 0.05), (2.5, 0.6, 0.2), (X - 0.05, 0.85, Z - 0.02)], 0.02, INK, bend=0.2)   # DC string cable
    plate('+z', (X - 0.16, 1.08, Z + 0.106), 0.12, 0.08, '#f2efe4', 2)

MODELS = {'py_transformer': transformer, 'py_bess': bess, 'py_panel': dist_panel, 'py_solar': solar}

if __name__ == '__main__':
    out, prefix = args()
    only = os.environ.get('ONLY')
    for name, fn in MODELS.items():
        if only and name not in only.split(','): continue
        reset(); F.LEDS.clear(); fn(); F.finalize_leds(); export(os.path.join(out, name + '.glb')); print('exported', name)
        if prefix:
            big = name in ('py_bess', 'py_solar')
            preview(f'{prefix}_{name}.png', cam_loc=(5.5, -7.5, 4.6) if big else (2.6, -3.6, 2.6), target=(0.3 if name == 'py_solar' else 0, 0, 1.1), lens=38, size=(900, 700))
