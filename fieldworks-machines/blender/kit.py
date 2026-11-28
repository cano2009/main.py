# Fieldworks Blender kit: helpers that build stylised low-poly models the way the reference art is made —
# chunky blocks with real bevels, octagonal bolts, rounded pipes with proper bends, gears, ribbed frames —
# in the Fieldworks palette. Every model script imports this, builds into one collection and calls export().
# Run: blender -b --python <model>.py -- <out.glb> [preview.png]
import bpy, bmesh, math, sys, os

# Low-poly mode: flat-shaded facets, few segments, single-step bevels (the chunky faceted look of the art direction)
LOWPOLY = False   # mid-poly: 2-segment bevels with weighted (hardened) normals, full segment counts, smooth round parts
def segs_(n, lo=6): return max(lo, int(round(n * 0.32))) if LOWPOLY else n
from mathutils import Vector, Matrix

PALETTE = {
    'green': '#3f8a4f', 'greenD': '#2c6239', 'yellow': '#f0bd2f', 'yellowD': '#c9961c', 'steel': '#b4bcc2',
    'steelD': '#7d868d', 'dark': '#3b4045', 'belt': '#2f3336', 'beltLine': '#8d9499', 'cream': '#ece6d6',
    'red': '#d24a35', 'blue': '#3f86c6', 'water': '#3fc3e0', 'black': '#1e2124', 'orange': '#ea7a2c', 'rubber': '#26292c',
}

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1]

_mats = {}
def mat(name, rough=0.6, metal=0.0, emit=0.0):
    key = (name, rough, metal, emit)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(name + ('_e' if emit else ''))
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    col = srgb(PALETTE.get(name, name))
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = col
        b.inputs['Emission Strength'].default_value = emit
    _mats[key] = m
    return m

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()

def _finish(o, m, bevel, segs=2, smooth=False):
    if m: o.data.materials.append(m if not isinstance(m, str) else mat(m))
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 1 if LOWPOLY else segs; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(40)
        b.harden_normals = not LOWPOLY
        o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(35)
        if not LOWPOLY:
            for p in o.data.polygons: p.use_smooth = True   # bevels shade as soft rounded edges, flat faces stay flat
    if smooth:
        for p in o.data.polygons: p.use_smooth = not LOWPOLY
        o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(50)
    return o

def block(size, loc, m, bevel=0.02, rot=(0, 0, 0), name='block', segs=2):
    """Box of size (x, y, z) centred at loc (Blender is z-up; the exporter converts to y-up)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)   # keep the pivot at the part: later rotations turn it in place
    return _finish(o, m, min(bevel, min(size) * 0.45), segs)

def cyl(r, depth, loc, m, axis='Z', verts=12, bevel=0.01, name='cyl', r2=None, rot=None):
    verts = segs_(verts, 6) if verts > 8 else verts
    rr = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis] if rot is None else rot
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rr)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rr)
    o = bpy.context.object; o.name = name
    _finish(o, m, min(bevel, r * 0.4, depth * 0.4) if bevel else 0, 2)
    for p in o.data.polygons:
        if abs(p.normal.dot(Vector((0, 0, 1)))) < 0.5: p.use_smooth = not LOWPOLY   # round sides, flat caps
    return o

def bolt(loc, normal='Y', r=0.03, h=0.02, m='steel'):
    """Octagonal bolt head standing out of a face whose normal is ±X/±Y/±Z."""
    ax = normal.strip('-'); s = -1 if normal.startswith('-') else 1
    off = Vector({'X': (s * h / 2, 0, 0), 'Y': (0, s * h / 2, 0), 'Z': (0, 0, s * h / 2)}[ax])
    return cyl(r, h, Vector(loc) + off, m, axis=ax, verts=8, bevel=0.004, name='bolt')

def pipe(points, r, m, name='pipe', bend=0.08, verts=10):
    """A tube through points with rounded bends (a bevelled poly curve)."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 0 if LOWPOLY else 3; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(points) - 1)
    for i, p in enumerate(points): sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    if bend:
        b = o.modifiers.new('round', 'BEVEL'); b.affect = 'VERTICES'; b.width = bend; b.segments = 1 if LOWPOLY else 4; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(20)
    o.data.materials.append(mat(m) if isinstance(m, str) else m)
    for p in o.data.polygons: p.use_smooth = not LOWPOLY
    return o

def gear(loc, r, teeth, depth, m, axis='Y'):
    bm = bmesh.new()
    pts = []
    for i in range(teeth * 2):
        a = i / (teeth * 2) * math.tau; rr = r if i % 2 == 0 else r * 0.8
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    top = [bm.verts.new((x, y, depth / 2)) for x, y in pts]; bot = [bm.verts.new((x, y, -depth / 2)) for x, y in pts]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts); bm.faces.new((bot[i], bot[j], top[j], top[i]))
    me = bpy.data.meshes.new('gear'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('gear', me); bpy.context.collection.objects.link(o)
    o.location = loc; o.rotation_euler = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    _finish(o, m, 0.006)
    cyl(r * 0.3, depth * 1.4, loc, 'steel', axis=axis, verts=8)
    return o

def vent(center, w, h, normal, slats, m_frame='steelD', m_slat='steel'):
    """Louvred vent panel on a face (normal 'Y' or '-Y' or 'X' or '-X')."""
    ax = normal.strip('-'); s = -1 if normal.startswith('-') else 1; c = Vector(center)
    if ax == 'Y':
        block((w, 0.02, h), c + Vector((0, s * 0.01, 0)), m_frame, 0.005)
        for i in range(slats): block((w * 0.84, 0.025, h * 0.5 / slats), c + Vector((0, s * 0.022, -h * 0.4 + i * h * 0.8 / max(1, slats - 1))), m_slat, 0.003)
    else:
        block((0.02, w, h), c + Vector((s * 0.01, 0, 0)), m_frame, 0.005)
        for i in range(slats): block((0.025, w * 0.84, h * 0.5 / slats), c + Vector((s * 0.022, 0, -h * 0.4 + i * h * 0.8 / max(1, slats - 1))), m_slat, 0.003)

def empty(name, loc):
    o = bpy.data.objects.new(name, None); o.location = loc; bpy.context.collection.objects.link(o); return o

def join(objs, name, parent=None):
    """Join meshes (modifiers applied) into one object; used for parts that move together."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); o = bpy.context.object; o.name = name
    if parent: o.parent = parent
    return o

def bake_ao(distance=0.28, samples=24, floor=0.66):
    """Bake ambient occlusion into vertex colours (Cycles): contact shadows where parts meet, free at run time.
    Modifiers are applied first so the colours land on the final vertices; values are lifted so AO tints, not blackens."""
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.data.materials and not any(m and m.blend_method != 'OPAQUE' for m in o.data.materials)]
    if not meshes: return
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.convert(target='MESH')                       # applies the bevels
    for o in meshes:
        ca = o.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); o.data.color_attributes.active_color = ca
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    if not sc.world: sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = distance
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', use_clear=True, margin=0)
    for o in meshes:
        d = o.data.color_attributes['Col'].data
        for c in d:
            v = c.color[0]; v = floor + (1 - floor) * v; c.color = (v, v, v, 1.0)

def export(path):
    if os.environ.get('FW_BAKE', '1') == '1': bake_ao()
    for m in bpy.data.materials:   # closed models: single-sided faces (glass stays double-sided)
        if m.blend_method == 'OPAQUE': m.use_backface_culling = True
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True, export_extras=True, export_colors=True)

def preview(path, cam_loc=(5, -5, 4), target=(0, 0, 0.6), size=(1000, 800), lens=50, ortho=None):
    """Clean studio render to check the model (Cycles on the CPU, soft light, grey backdrop)."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = False; sc.cycles.samples = int(os.environ.get('FW_SAMPLES', 96)); sc.cycles.device = 'CPU'
    sc.render.resolution_x, sc.render.resolution_y = size; sc.render.filepath = path; sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.78, 0.8, 0.82, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); fl = bpy.context.object; fl.data.materials.append(mat('#d7d9db', 0.9)); fl.name = '__floor'
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.angle = math.radians(12)
    so = bpy.data.objects.new('__sun', sun); so.rotation_euler = (math.radians(50), math.radians(10), math.radians(35)); bpy.context.collection.objects.link(so)
    cd = bpy.data.cameras.new('cam'); cd.lens = lens
    if ortho: cd.type = 'ORTHO'; cd.ortho_scale = ortho
    co = bpy.data.objects.new('__cam', cd); bpy.context.collection.objects.link(co); co.location = cam_loc
    d = Vector(target) - Vector(cam_loc); co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); sc.camera = co
    bpy.ops.render.render(write_still=True)
    for n in ('__floor', '__sun', '__cam'): bpy.data.objects.remove(bpy.data.objects[n])

def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return (a[0] if a else None), (a[1] if len(a) > 1 else None)

def vault(r_out, thick, length, loc, m, segs=16, name='vault', angle=math.pi, start=None):
    """Half-barrel shell (an arch extruded along x): r_out outer radius, opening downward onto loc's z."""
    bm = bmesh.new(); ri = r_out - thick; prof = []
    a0 = (math.pi - angle) / 2 if start is None else start
    for i in range(segs + 1):
        a = a0 + i / segs * angle; prof.append((math.cos(a), math.sin(a)))
    rings = []
    for x in (-length / 2, length / 2):
        outer = [bm.verts.new((x, c * r_out, s * r_out)) for c, s in prof]
        inner = [bm.verts.new((x, c * ri, s * ri)) for c, s in prof]
        rings.append((outer, inner))
    (o0, i0), (o1, i1) = rings
    for k in range(segs):
        bm.faces.new((o0[k], o0[k + 1], o1[k + 1], o1[k])); bm.faces.new((i0[k + 1], i0[k], i1[k], i1[k + 1]))
        bm.faces.new((o0[k + 1], o0[k], i0[k], i0[k + 1])); bm.faces.new((o1[k], o1[k + 1], i1[k + 1], i1[k]))
    for o, i in ((o0, i0), (o1, i1)):
        for k in (0, segs):
            pass
    bm.faces.new((o0[0], i0[0], i1[0], o1[0])); bm.faces.new((o1[segs], i1[segs], i0[segs], o0[segs]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = loc
    _finish(o, m, 0.012)
    for p in o.data.polygons:
        if abs(p.normal.x) < 0.5: p.use_smooth = not LOWPOLY
    return o

def ring(r, tube, loc, m, axis='X', name='ring', segs=24, arc=None):
    """Torus (or a partial hoop when arc is given in radians, opening downward)."""
    if arc:
        pts = []; a0 = (math.pi - arc) / 2
        for i in range(segs + 1):
            a = a0 + i / segs * arc; pts.append((0, math.cos(a) * r, math.sin(a) * r))
        o = pipe([(loc[0] + p[0], loc[1] + p[1], loc[2] + p[2]) for p in pts], tube, m, name, bend=0)
        return o
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=tube, major_segments=segs, minor_segments=8, location=loc,
                                     rotation={'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis])
    o = bpy.context.object; o.name = name; o.data.materials.append(mat(m) if isinstance(m, str) else m)
    for p in o.data.polygons: p.use_smooth = not LOWPOLY
    return o

def lathe(profile, loc, m, axis='Z', segs=32, name='lathe', smooth=True):
    segs = segs_(segs, 6)
    """Revolve a profile [(radius, height), ...] around an axis through loc. Ends close with caps.
    axis: 'Z' (up), 'Y' or '-Y' (along y), 'X' or '-X'."""
    bm = bmesh.new(); rings = []
    for r, h in profile:
        if r < 1e-4: rings.append([bm.verts.new((0, 0, h))]); continue
        rings.append([bm.verts.new((math.cos(k / segs * math.tau) * r, math.sin(k / segs * math.tau) * r, h)) for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1: continue
        if len(a) == 1:
            for k in range(segs): bm.faces.new((a[0], b[k], b[(k + 1) % segs]))
        elif len(b) == 1:
            for k in range(segs): bm.faces.new((a[k], b[0], a[(k + 1) % segs]))
        else:
            for k in range(segs): bm.faces.new((a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]))
    if len(rings[0]) > 1: bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = {'Z': (0, 0, 0), '-Z': (math.pi, 0, 0), 'Y': (-math.pi / 2, 0, 0), '-Y': (math.pi / 2, 0, 0), 'X': (0, math.pi / 2, 0), '-X': (0, -math.pi / 2, 0)}[axis]
    o.data.materials.append(mat(m) if isinstance(m, str) else m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = not LOWPOLY
        o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(48)
    return o

def loft(sections, m, n=6, name='loft', smooth=True):
    n = max(1, n // 3) if LOWPOLY else n
    """A body lofted through rounded-rectangle sections along y: [(y, width, height, zc, round), ...].
    round is the corner radius as a fraction of the smaller side (0.5 = fully rounded). Ends are capped."""
    bm = bmesh.new(); rings = []
    for y, w, h, zc, rnd in sections:
        r = min(w, h) * rnd; pts = []
        for cx, cz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, math.pi / 2), (-w / 2 + r, -h / 2 + r, math.pi), (w / 2 - r, -h / 2 + r, 1.5 * math.pi)):
            for k in range(n + 1):
                a = a0 + k / n * math.pi / 2; pts.append((cx + math.cos(a) * r, cz + math.sin(a) * r))
        rings.append([bm.verts.new((x, y, zc + z)) for x, z in pts])
    N = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for k in range(N): bm.faces.new((a[k], a[(k + 1) % N], b[(k + 1) % N], b[k]))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat(m) if isinstance(m, str) else m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = not LOWPOLY
        o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(40)
    return o
