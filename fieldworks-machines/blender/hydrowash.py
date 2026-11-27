# Fieldworks Hydro-Wash Station Mk II: a tunnel washer that straddles the line belt.
# Core housing with service hatch, louvres and bolted corners; stepped entry/exit shrouds with rubber curtains;
# a gridded catwalk with railings on top carrying two fluid tanks (wash, rinse) with sight windows, a twin dosing
# pump with pressure gauges, a flanged manifold with valves, and hoses dropping into the spray tunnels; a caged
# ladder; a control post with screen, buttons, e-stop and a stack light; hazard-striped skids, drip trays.
# Animated parts: fluid0, fluid1 (tank levels), stack_g / stack_a / stack_r (stack light lamps).
# Blender z-up, belt along x, belt top z = 0.8. Run with --preview-belt to add a belt section to the preview only.
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import *

BZ = 0.8
GREY, GREY2, GREY3 = '#cfd4d8', '#b9c0c5', '#e3e7ea'

def hazard(x0, x1, y, z, h=0.06, d=0.03):
    n = int((x1 - x0) / 0.1)
    for i in range(n):
        block(((x1 - x0) / n, d, h), (x0 + (i + 0.5) * (x1 - x0) / n, y, z), 'yellow' if i % 2 == 0 else 'black', 0.004)

def hydrowash(preview_belt=False):
    # ---------- skids and drip trays
    for s in (-1, 1):
        block((2.5, 0.2, 0.1), (0, s * 0.66, 0.05), 'dark', 0.03)
        hazard(-1.2, 1.2, s * 0.765, 0.07)
    for sx in (-1, 1):
        block((0.62, 1.05, 0.06), (sx * 0.86, 0, 0.16), 'steelD', 0.02)          # drip tray
        for s in (-1, 1): block((0.62, 0.03, 0.08), (sx * 0.86, s * 0.51, 0.22), 'steelD', 0.01)
    pipe([(0.86, 0.3, 0.14), (0.86, 0.75, 0.14), (0.9, 0.85, 0.06)], 0.025, 'steelD')     # drain
    # ---------- core housing: from the skids up over the belt
    for s in (-1, 1):
        block((1.1, 0.24, BZ - 0.05), (0, s * 0.58, (BZ - 0.05) / 2 + 0.1), GREY2, 0.03)   # legs beside the belt
    block((1.14, 1.4, 0.72), (0, 0, BZ + 0.43), GREY, 0.05)
    block((1.2, 1.46, 0.06), (0, 0, BZ + 0.08), 'steelD', 0.02)
    block((1.2, 1.46, 0.07), (0, 0, BZ + 0.81), 'steelD', 0.02)
    # front face: a hinged service hatch with a handle, bolts at the corners and a louvre panel
    block((0.5, 0.03, 0.46), (-0.22, -0.715, BZ + 0.43), GREY3, 0.015)
    for z in (BZ + 0.3, BZ + 0.56): block((0.05, 0.03, 0.08), (-0.48, -0.73, z), 'steelD', 0.01)
    block((0.04, 0.05, 0.16), (0.0, -0.74, BZ + 0.43), 'dark', 0.01)
    for dx, dz in ((-0.43, 0.2), (-0.01, 0.2), (-0.43, -0.2), (-0.01, -0.2)): bolt((-0.22 + dx + 0.22, -0.73, BZ + 0.43 + dz), '-Y', 0.016, 0.012)
    vent((0.3, -0.7, BZ + 0.45), 0.36, 0.4, '-Y', 6, 'steelD', GREY3)
    vent((0.3, 0.7, BZ + 0.45), 0.36, 0.4, 'Y', 6, 'steelD', GREY3)
    block((0.5, 0.03, 0.4), (-0.22, 0.715, BZ + 0.43), GREY3, 0.015)
    for s in (-1, 1):
        for x in (-0.53, 0.53):
            for z in (BZ + 0.16, BZ + 0.72): bolt((x, s * 0.72, z), 'Y' if s > 0 else '-Y', 0.022, 0.016)
    # ---------- shrouds: four stepped frames each side, a yellow lip and rubber curtains at the mouth
    for sx in (-1, 1):
        for k in range(4):
            x = sx * (0.6 + k * 0.13); g = k * 0.04; c = GREY if k % 2 == 0 else GREY3
            for s in (-1, 1): block((0.11, 0.12, 0.64 - g), (x, s * (0.6 - g / 2), BZ + 0.27 - g / 2 + 0.02), c, 0.02)
            block((0.11, 1.32 - g, 0.12), (x, 0, BZ + 0.6 - g), c, 0.02)
        xm = sx * 1.02
        for s in (-1, 1): block((0.05, 0.06, 0.5), (xm + sx * 0.04, s * 0.5, BZ + 0.24), 'yellow', 0.01)
        block((0.05, 1.06, 0.06), (xm + sx * 0.04, 0, BZ + 0.49), 'yellow', 0.01)
        for k in range(7): block((0.012, 0.13, 0.38), (xm + sx * 0.01, -0.42 + k * 0.14, BZ + 0.27), 'rubber', 0.003)
        # roof plate over each shroud
        block((0.5, 1.2, 0.04), (sx * 0.8, 0, BZ + 0.67), 'steelD', 0.01)
    # ---------- top catwalk: grating, toe boards and a railing on the back and the ends
    TZ = BZ + 0.85
    block((1.3, 1.5, 0.04), (0, 0, TZ), 'steelD', 0.01)
    for k in range(13): block((0.02, 1.46, 0.03), (-0.6 + k * 0.1, 0, TZ + 0.03), 'steel', 0.004)
    for s in (-1, 1): block((1.3, 0.03, 0.08), (0, s * 0.74, TZ + 0.05), 'yellow', 0.008)
    for x in (-0.62, -0.2, 0.2, 0.62): block((0.04, 0.04, 0.55), (x, 0.72, TZ + 0.3), 'yellow', 0.008)
    for z in (TZ + 0.3, TZ + 0.56): block((1.28, 0.04, 0.04), (0, 0.72, z), 'yellow', 0.008)
    for x in (-0.62, 0.62):
        for y in (0.3, -0.12): block((0.04, 0.04, 0.55), (x, y, TZ + 0.3), 'yellow', 0.008)
        for z in (TZ + 0.3, TZ + 0.56): block((0.04, 0.86, 0.04), (x, 0.3, z), 'yellow', 0.008)
    # ---------- two fluid tanks on saddles (wash: cyan, rinse: pale green), sight window with level, lid handle
    for i, (tx, ty, col) in enumerate(((-0.32, 0.3, 'water'), (0.18, 0.3, '#7fd68a'))):
        for dx in (-0.12, 0.12): block((0.06, 0.4, 0.1), (tx + dx, ty, TZ + 0.08), 'dark', 0.01)
        cyl(0.21, 0.62, (tx, ty, TZ + 0.45), GREY3, verts=10, bevel=0.0)
        for z in (TZ + 0.2, TZ + 0.7): cyl(0.215, 0.04, (tx, ty, z), 'steelD', verts=10, bevel=0.0)
        cyl(0.23, 0.08, (tx, ty, TZ + 0.8), 'steel', verts=10, bevel=0.02)
        cyl(0.08, 0.06, (tx, ty, TZ + 0.87), 'steelD', verts=8)
        block((0.12, 0.03, 0.03), (tx, ty, TZ + 0.92), 'dark', 0.01)
        # sight window facing the front, with the fluid level inside it (animated)
        block((0.09, 0.03, 0.42), (tx, ty - 0.205, TZ + 0.45), 'steelD', 0.008)
        block((0.06, 0.03, 0.38), (tx, ty - 0.215, TZ + 0.45), '#1f2f36', 0.004)
        lv = block((0.05, 0.03, 0.36), (tx, ty - 0.222, TZ + 0.27), col, 0.003, name=f'fluid{i}')
        lv.data.transform(Matrix.Translation((0, 0, 0.18))); lv.location.z -= 0.18
        block((0.24, 0.02, 0.1), (tx, ty - 0.21, TZ + 0.6), col, 0.005)            # colour band label
    # ---------- dosing pump: twin motors on a block, two pressure gauges, outlets
    PX, PY = -0.05, -0.32
    block((0.56, 0.32, 0.18), (PX, PY, TZ + 0.12), 'green', 0.03)
    block((0.6, 0.36, 0.04), (PX, PY, TZ + 0.23), 'greenD', 0.01)
    for dx in (-0.14, 0.14):
        cyl(0.075, 0.22, (PX + dx, PY, TZ + 0.36), 'blue', verts=14)
        for k in range(3): cyl(0.08, 0.015, (PX + dx, PY, TZ + 0.3 + k * 0.05), 'blue', verts=14)
        cyl(0.05, 0.03, (PX + dx, PY, TZ + 0.48), 'dark', verts=10)
        cyl(0.045, 0.02, (PX + dx, PY - 0.17, TZ + 0.12), 'cream', axis='Y', verts=16)   # gauge dial
        cyl(0.05, 0.015, (PX + dx, PY - 0.163, TZ + 0.12), 'steelD', axis='Y', verts=16)
        block((0.006, 0.004, 0.035), (PX + dx + 0.008, PY - 0.182, TZ + 0.13), 'red', 0.0)
    # tank outlets into the pump (rigid pipes with flanges)
    for tx in (-0.32, 0.18):
        pipe([(tx, 0.1, TZ + 0.24), (tx, -0.05, TZ + 0.24), (PX + (0.14 if tx > 0 else -0.14), -0.12, TZ + 0.18)], 0.025, 'steel')
        cyl(0.04, 0.02, (tx, 0.1, TZ + 0.24), 'steelD', axis='Y', verts=10)
    # ---------- manifold along the front edge with two valves (red handwheels) and flanges
    MY = -0.62; MZ = TZ + 0.12
    pipe([(PX - 0.14, PY - 0.12, TZ + 0.2), (PX - 0.14, MY, MZ)], 0.03, 'steel')
    pipe([(PX + 0.14, PY - 0.12, TZ + 0.2), (PX + 0.14, MY, MZ)], 0.03, 'steel')
    pipe([(-0.58, MY, MZ), (0.58, MY, MZ)], 0.035, 'steel', bend=0)
    for x in (-0.58, -0.3, 0.3, 0.58): cyl(0.055, 0.025, (x, MY, MZ), 'steelD', axis='X', verts=10)
    for x in (-0.45, 0.45):
        block((0.08, 0.08, 0.08), (x, MY, MZ), 'dark', 0.015)
        cyl(0.012, 0.1, (x, MY, MZ + 0.08), 'steel', verts=6)
        ring(0.05, 0.01, (x, MY, MZ + 0.13), 'red', axis='Z')
    # hoses from the manifold ends down into the spray tunnels (with brass ferrules)
    for sx in (-1, 1):
        pipe([(sx * 0.6, MY, MZ), (sx * 0.7, MY - 0.05, MZ - 0.05), (sx * 0.86, -0.5, TZ - 0.05), (sx * 0.86, -0.42, BZ + 0.73)], 0.028, 'water')
        cyl(0.04, 0.05, (sx * 0.86, -0.42, BZ + 0.7), 'yellowD', verts=10)
    # ---------- caged ladder up the front-left to the catwalk
    LX = -0.85; LY = -0.84
    for dx in (-0.17, 0.17):
        block((0.05, 0.05, TZ + 0.5), (LX + dx, LY, (TZ + 0.5) / 2), 'yellow', 0.012)
        block((0.05, 0.14, 0.05), (LX + dx, LY + 0.07, TZ), 'yellow', 0.01)
    for k in range(8): cyl(0.016, 0.34, (LX, LY, 0.22 + k * 0.21), 'steel', axis='X', verts=8)
    # safety cage: horizontal half-hoops in front of the climber, tied by three vertical straps
    for z in (1.0, 1.35, 1.7, 2.05):
        pipe([(LX - 0.19 + 0.38 * (1 - math.cos(t)) / 2 * 0 + (-0.19 * math.cos(t)), LY - 0.02 - 0.26 * math.sin(t), z) for t in [i / 10 * math.pi for i in range(11)]], 0.013, 'yellow', bend=0)
    for t in (0.25, 0.5, 0.75):
        a = t * math.pi
        pipe([(LX - 0.19 * math.cos(a), LY - 0.02 - 0.26 * math.sin(a), 1.0), (LX - 0.19 * math.cos(a), LY - 0.02 - 0.26 * math.sin(a), 2.05)], 0.011, 'yellow', bend=0)
    # ---------- control post at the front-right: angled panel with screen, buttons, e-stop, stack light
    CX, CY = 0.95, -0.95
    block((0.1, 0.1, 1.05), (CX, CY, 0.52), 'steelD', 0.02); block((0.3, 0.3, 0.05), (CX, CY, 0.025), 'dark', 0.015)
    block((0.46, 0.14, 0.36), (CX, CY - 0.02, 1.2), 'green', 0.03)
    block((0.36, 0.02, 0.2), (CX - 0.03, CY - 0.095, 1.25), 'dark', 0.006)
    scr = block((0.32, 0.02, 0.16), (CX - 0.03, CY - 0.1, 1.25), '#7fe8b0', 0.0, name='screen'); scr.data.materials.clear(); scr.data.materials.append(mat('#7fe8b0', 0.3, emit=1.6))
    for i, c in enumerate(('green', 'yellow', 'blue')): cyl(0.022, 0.03, (CX - 0.14 + i * 0.07, CY - 0.1, 1.09), c, axis='Y', verts=10)
    cyl(0.045, 0.04, (CX + 0.16, CY - 0.11, 1.11), 'red', axis='Y', verts=14); cyl(0.032, 0.03, (CX + 0.16, CY - 0.095, 1.11), 'yellow', axis='Y', verts=12)
    cyl(0.02, 0.2, (CX + 0.15, CY, 1.48), 'steelD', verts=8)
    for i, (c, nm) in enumerate((('#3fd27a', 'stack_g'), ('#ffb02e', 'stack_a'), ('#ff5a48', 'stack_r'))):
        l = cyl(0.04, 0.07, (CX + 0.15, CY, 1.62 - i * 0.075), c, verts=12, bevel=0.004, name=nm)
        l.data.materials.clear(); l.data.materials.append(mat(c, 0.4, emit=0.6))
    cyl(0.042, 0.02, (CX + 0.15, CY, 1.67), 'dark', verts=12)
    # cable tray from the post into the housing
    pipe([(CX, CY + 0.05, 1.0), (CX, CY + 0.05, 0.3), (0.6, -0.72, 0.3), (0.5, -0.72, 0.3)], 0.025, 'dark')
    if preview_belt:
        import conveyor
        conveyor.conveyor(5.6, -2.8)

if __name__ == '__main__':
    out, png = args()
    reset()
    hydrowash(False)
    export(out)
    if png:
        reset(); hydrowash(True)
        preview(png, cam_loc=(4.4, -5.0, 4.3), target=(0, 0, 0.95), lens=38, size=(1200, 1000))
        preview(png.replace('.png', '_b.png'), cam_loc=(-4.0, 4.6, 3.2), target=(0, 0, 0.9), lens=38, size=(1200, 1000))
