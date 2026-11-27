# Conveyor section and wash tunnel, after the reference isometric conveyor machines: a chunky side-rail profile with
# flared feet and bolt heads, a dark belt with light chevron cleats, end rollers, and a wash tunnel that straddles
# the belt with ribbed entry frames, two water tanks with level bands, hoses and a service ladder.
# Blender z-up; belt runs along +x, belt top at z = 0.8. Exported glTF is y-up (x stays x, z becomes -y... handled
# by the exporter: Blender +y becomes glTF -z).
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import *

BELT_Z = 0.8

def conveyor(length=2.4, x0=0.0, name='Conveyor'):
    W = 0.74
    objs = []
    for s in (-1, 1):
        y = s * (W / 2 + 0.06)
        # side rail: tall web, a lip on top, a flared foot every 1.2 m
        objs.append(block((length, 0.09, 0.26), (x0 + length / 2, y, BELT_Z - 0.09), 'steel', 0.02))
        objs.append(block((length, 0.15, 0.05), (x0 + length / 2, y + s * 0.03, BELT_Z + 0.05), 'yellow', 0.015))
        objs.append(block((length, 0.13, 0.05), (x0 + length / 2, y + s * 0.02, BELT_Z - 0.21), 'steelD', 0.012))
        n = max(2, round(length / 1.2) + 1)
        for i in range(n):
            x = x0 + 0.15 + i * (length - 0.3) / (n - 1)
            objs.append(block((0.16, 0.1, BELT_Z - 0.26), (x, y, (BELT_Z - 0.26) / 2), 'steelD', 0.02))
            objs.append(block((0.34, 0.2, 0.05), (x, y + s * 0.03, 0.025), 'dark', 0.015))   # flared foot
            objs.append(block((0.22, 0.04, 0.12), (x, y, 0.13), 'steelD', 0.01, rot=(0, 0, 0)))
        for i in range(int(length / 0.4)):
            objs.append(bolt((x0 + 0.2 + i * 0.4, y + s * 0.045, BELT_Z - 0.06), 'Y' if s > 0 else '-Y', 0.022, 0.018))
    # cross ties under the belt
    for i in range(max(2, round(length / 0.8))):
        objs.append(block((0.06, W + 0.1, 0.05), (x0 + 0.2 + i * (length - 0.4) / max(1, round(length / 0.8) - 1), 0, BELT_Z - 0.2), 'steelD', 0.01))
    # end rollers
    for x in (x0 + 0.04, x0 + length - 0.04):
        objs.append(cyl(0.075, W + 0.04, (x, 0, BELT_Z - 0.08), 'steelD', axis='Y', verts=16))
    # the belt (the game scrolls a texture on this mesh, so it keeps its own name and UVs)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x0 + length / 2, 0, BELT_Z - 0.03)); belt = bpy.context.object
    belt.scale = (length - 0.02, W, 0.06); bpy.ops.object.transform_apply(scale=True); belt.name = 'belt'
    belt.data.materials.append(mat('belt', 0.85)); belt['belt'] = 1
    return objs, belt

def wash_tunnel(x0=-1.1, L=2.2):
    """Straddles a belt from x0 to x0+L. Housing in light steel, green accents, cyan water."""
    objs = []
    cx = x0 + L / 2
    # entry and exit tunnels: four stepped rib frames each, in light grey with a darker inner lining
    for side in (-1, 1):
        xe = cx + side * (L / 2 - 0.3)
        for k in range(4):
            x = xe + side * (k * 0.11 - 0.05)
            g = 0.03 * k
            for s in (-1, 1): objs.append(block((0.09, 0.1, 0.62 - g), (x, s * (0.52 - g / 2), BELT_Z + 0.28 - g / 2), 'steel' if k % 2 == 0 else '#d3d8db', 0.015))
            objs.append(block((0.09, 1.14 - g, 0.1), (x, 0, BELT_Z + 0.6 - g), 'steel' if k % 2 == 0 else '#d3d8db', 0.015))
        objs.append(block((0.04, 1.0, 0.04), (xe + side * 0.38, 0, BELT_Z + 0.62), 'greenD', 0.01))
    # main housing over the belt, a recessed top deck, side doors with bolt rows
    objs.append(block((L - 0.9, 1.2, 0.86), (cx, 0, BELT_Z + 0.29), '#c7cdd1', 0.04))
    objs.append(block((L - 0.8, 1.3, 0.08), (cx, 0, BELT_Z + 0.75), 'steelD', 0.02))
    objs.append(block((L - 1.1, 1.0, 0.12), (cx, 0, BELT_Z + 0.83), '#b7bec3', 0.03))
    for s in (-1, 1):
        objs.append(block((L - 1.2, 0.03, 0.5), (cx, s * 0.61, BELT_Z + 0.25), '#dfe3e6', 0.012))
        for i in range(4): objs.append(bolt((cx - 0.48 + i * 0.32, s * 0.61, BELT_Z + 0.58), 'Y' if s > 0 else '-Y', 0.022, 0.016))
        # base plinth the housing stands on, beside the belt
        objs.append(block((L - 0.85, 0.22, BELT_Z - 0.1), (cx, s * 0.62, (BELT_Z - 0.1) / 2), 'steelD', 0.03))
        objs.append(block((L - 0.75, 0.3, 0.06), (cx, s * 0.64, 0.03), 'dark', 0.02))
    # service ladder on the front (-y) face: white rails and rungs, standing on the plinth
    for dx in (-0.18, 0.18):
        objs.append(block((0.07, 0.06, 1.25), (cx + 0.32 + dx, -0.78, 0.8), '#e9ece9', 0.02))
        objs.append(block((0.1, 0.12, 0.06), (cx + 0.32 + dx, -0.73, 1.38), '#e9ece9', 0.02))
    for k in range(5): objs.append(block((0.36, 0.05, 0.05), (cx + 0.32, -0.78, 0.35 + k * 0.22), '#e9ece9', 0.01))
    objs.append(block((0.5, 0.18, 0.06), (cx + 0.32, -0.7, 0.2), '#e9ece9', 0.02))
    # control box with gauge and two buttons on the front, left of the ladder
    objs.append(block((0.34, 0.12, 0.36), (cx - 0.25, -0.66, BELT_Z + 0.18), 'green', 0.02))
    objs.append(cyl(0.07, 0.03, (cx - 0.31, -0.725, BELT_Z + 0.24), 'cream', axis='Y', verts=16))
    objs.append(cyl(0.03, 0.03, (cx - 0.16, -0.725, BELT_Z + 0.26), 'red', axis='Y', verts=10))
    objs.append(cyl(0.03, 0.03, (cx - 0.16, -0.725, BELT_Z + 0.14), 'yellow', axis='Y', verts=10))
    # back face: a louvred vent and a window onto the drive gears
    vent((cx - 0.25, 0.62, BELT_Z + 0.3), 0.42, 0.34, 'Y', 5)
    objs.append(block((0.4, 0.03, 0.3), (cx + 0.3, 0.615, BELT_Z + 0.3), 'steelD', 0.01))
    gear((cx + 0.22, 0.645, BELT_Z + 0.32), 0.09, 10, 0.03, 'dark', 'Y'); gear((cx + 0.37, 0.645, BELT_Z + 0.27), 0.065, 8, 0.03, 'dark', 'Y')
    # two water tanks on the top deck: white shells, a cyan band showing the water, octagonal lids
    tanks = []
    for i, (tx, ty) in enumerate(((cx + 0.05, 0.25), (cx + 0.38, -0.02))):
        objs.append(cyl(0.17, 0.12, (tx, ty, BELT_Z + 0.95), 'steelD', verts=8, bevel=0.015))
        objs.append(cyl(0.16, 0.56, (tx, ty, BELT_Z + 1.29), '#e8ebe9', verts=8, bevel=0.0))
        band = cyl(0.165, 0.24, (tx, ty, BELT_Z + 1.17), 'water', verts=8, bevel=0.0); band.name = f'water{i}'; tanks.append(band)
        objs.append(cyl(0.18, 0.07, (tx, ty, BELT_Z + 1.6), 'steel', verts=8, bevel=0.02))
    # pump block and cyan hoses from the tanks down into the housing and round to the side
    objs.append(block((0.32, 0.28, 0.2), (cx - 0.3, 0.15, BELT_Z + 0.98), '#e3e6e8', 0.03))
    objs.append(block((0.34, 0.3, 0.05), (cx - 0.3, 0.15, BELT_Z + 1.1), 'steelD', 0.015))
    for dx in (-0.08, 0.0, 0.08): objs.append(block((0.03, 0.04, 0.08), (cx - 0.3 + dx, 0.31, BELT_Z + 0.95), 'steel', 0.006))
    W = 'water'
    objs.append(pipe([(cx - 0.42, 0.15, BELT_Z + 1.08), (cx - 0.55, 0.15, BELT_Z + 1.2), (cx - 0.55, 0.42, BELT_Z + 1.2), (cx - 0.48, 0.48, BELT_Z + 0.9)], 0.028, W))
    objs.append(pipe([(cx - 0.22, 0.15, BELT_Z + 1.08), (cx - 0.12, 0.15, BELT_Z + 1.22), (cx + 0.05, 0.25, BELT_Z + 1.22), (cx + 0.05, 0.25, BELT_Z + 1.02)], 0.028, W))
    objs.append(pipe([(cx - 0.3, 0.02, BELT_Z + 1.08), (cx - 0.3, -0.2, BELT_Z + 1.1), (cx - 0.15, -0.35, BELT_Z + 0.9)], 0.028, W))
    objs.append(pipe([(cx + 0.38, -0.02, BELT_Z + 1.02), (cx + 0.55, -0.2, BELT_Z + 0.95), (cx + 0.62, -0.62, BELT_Z + 0.6), (cx + 0.62, -0.63, BELT_Z + 0.3)], 0.028, W))
    return objs, tanks

if __name__ == '__main__':
    out, png = args()
    reset()
    w_objs, tanks = wash_tunnel(-1.1, 2.2)
    export(out)            # the tunnel alone: the game's own belt runs through it
    c_objs, belt = conveyor(4.8, -2.4)
    if png: preview(png, cam_loc=(4.6, -5.4, 4.4), target=(0, 0, 0.75), lens=40)
