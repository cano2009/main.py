// Fieldworks mechanical parts kit.
// Procedural, engineered components shared by every machine: bevelled panels, bolts and bolt circles, flanges and
// pipes, motors, gearboxes, pulleys and belts, bearings, frames with gussets, hinged access doors, louvred vents,
// guards, gauges, buttons, switches, knobs, keypads, consoles, cabinets, cables and hydraulic cylinders.
// Machines combine the same parts in different layouts, so they share a construction language without looking alike.
// Units are metres. Written for three.js r147. Browser only (gauges and labels draw on canvas).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();

// ---------------------------------------------------------------------------
// Materials. One palette per machine family; pass overrides for brand colours.
export function materials(o) {
  o = o || {};
  const std = (name, c, metal, rough, extra) => Object.assign(new THREE.MeshStandardMaterial({ name, color: lin(c), metalness: metal, roughness: rough }), extra || {});
  return {
    paint: std('paint', o.paint || '#2f5a3b', 0.35, 0.42),            // Fieldworks machinery green
    paint2: std('paint_trim', o.trim || '#e3b23c', 0.3, 0.45),        // safety yellow trim
    darkSteel: std('dark_steel', '#2c3034', 0.75, 0.42),
    steel: std('steel', '#b8bdc2', 0.9, 0.3),
    stainless: std('stainless', '#c9cdd1', 0.95, 0.22),
    chrome: std('chrome', '#eef1f4', 1.0, 0.1),
    castIron: std('cast_iron', '#3b3f43', 0.6, 0.62),
    motor: std('motor_paint', o.motor || '#2e5f8f', 0.4, 0.4),
    rubber: std('rubber', '#17181a', 0, 0.88),
    plastic: std('black_plastic', '#1d1f22', 0.05, 0.5),
    brass: std('brass', '#c39a4a', 1.0, 0.3),
    copper: std('copper', '#b8703a', 1.0, 0.32),
    redWire: std('red_wire', '#c4221c', 0.05, 0.35),
    cable: std('cable', '#202224', 0.05, 0.6),
    glass: std('glass', '#cfeaf5', 0.1, 0.04, { transparent: true, opacity: 0.18, depthWrite: false }),
    red: std('red', '#c8211a', 0.15, 0.4),
    yellow: std('yellow', '#f0c021', 0.15, 0.45),
    hazard: null,
    label: null
  };
}

// ---------------------------------------------------------------------------
// Basic shapes
export function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
// Box with bevelled edges. Every visible box in a machine should be one of these, never a sharp cube.
export function panel(w, h, d, mat, r) {
  const rad = Math.min(r === undefined ? 0.008 : r, w / 2.2, h / 2.2, d / 2.2);
  return mesh(new RoundedBoxGeometry(w, h, d, 2, rad), mat);
}
export function cyl(r, len, mat, axis, seg) {
  const g = new THREE.CylinderGeometry(r, r, len, seg || 20);
  if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  return mesh(g, mat);
}
function orientTo(obj, normal) { obj.quaternion.setFromUnitVectors(new V(0, 0, 1), normal.clone().normalize()); }

// ---------------------------------------------------------------------------
// Fasteners: collect many bolts and build them as one merged mesh (cheap to draw).
export function boltSet(mat) {
  const parts = [];
  const head = new THREE.CylinderGeometry(1, 1, 0.65, 6).rotateX(Math.PI / 2).translate(0, 0, 0.32);
  const washer = new THREE.CylinderGeometry(1.35, 1.35, 0.18, 14).rotateX(Math.PI / 2).translate(0, 0, 0.09);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V();
  const api = {
    add(pos, normal, r) {
      q.setFromUnitVectors(new V(0, 0, 1), (normal || new V(0, 0, 1)).clone().normalize());
      s.setScalar(r || 0.006);
      m4.compose(pos, q, s);
      parts.push(head.clone().applyMatrix4(m4), washer.clone().applyMatrix4(m4));
      return api;
    },
    circle(centre, normal, radius, n, r) {
      const f = frameFor(normal);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        api.add(centre.clone().addScaledVector(f.u, Math.cos(a) * radius).addScaledVector(f.v, Math.sin(a) * radius), normal, r);
      }
      return api;
    },
    row(from, to, normal, n, r) {
      for (let i = 0; i < n; i++) api.add(from.clone().lerp(to, n === 1 ? 0.5 : i / (n - 1)), normal, r);
      return api;
    },
    build(parent) {
      if (!parts.length) return null;
      const m = mesh(mergeBufferGeometries(parts), mat);
      m.castShadow = false;
      if (parent) parent.add(m);
      return m;
    }
  };
  return api;
}
function frameFor(n) {
  n = n.clone().normalize();
  const ref = Math.abs(n.y) < 0.95 ? new V(0, 1, 0) : new V(1, 0, 0);
  const u = new V().crossVectors(ref, n).normalize(), v = new V().crossVectors(n, u).normalize();
  return { u, v };
}

// ---------------------------------------------------------------------------
// Pipes: bends, flanges at each end, optional couplings along the run.
export function flange(rPipe, M, bolts, nBolts) {
  const g = new THREE.Group();
  const rf = rPipe * 2.1;
  mesh(new THREE.CylinderGeometry(rf, rf, rPipe * 0.45, 24).rotateX(Math.PI / 2), M.steel, 0, 0, 0, g);
  mesh(new THREE.CylinderGeometry(rPipe * 1.25, rPipe * 1.45, rPipe * 0.9, 20).rotateX(Math.PI / 2), M.steel, 0, 0, -rPipe * 0.6, g);
  if (bolts) bolts.circle(new V(0, 0, rPipe * 0.23), new V(0, 0, 1), rf * 0.75, nBolts || 6, rPipe * 0.16);
  return g;
}
export function pipe(points, r, mat, M, o) {
  o = o || {};
  const g = new THREE.Group();
  const pts = points.map((p) => (p.isVector3 ? p.clone() : new V(...p)));
  // round the corners with short bends
  const path = new THREE.CurvePath();
  const bend = o.bend === undefined ? r * 3 : o.bend;
  let start = pts[0].clone();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    if (!c) { path.add(new THREE.LineCurve3(start, b.clone())); break; }
    const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
    const k = Math.min(bend, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
    const p1 = b.clone().addScaledVector(d1, -k), p2 = b.clone().addScaledVector(d2, k);
    path.add(new THREE.LineCurve3(start, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    start = p2;
  }
  const len = path.getLength();
  mesh(new THREE.TubeGeometry(path, Math.max(8, Math.round(len * 40)), r, 14, false), mat, 0, 0, 0, g);
  if (o.flanges !== false && M) {
    const bolts = boltSet(M.steel);
    [[path.getPoint(0), path.getTangent(0).negate()], [path.getPoint(1), path.getTangent(1)]].forEach(([p, t]) => {
      const f = flange(r, M, bolts, 6); f.position.copy(p).addScaledVector(t, -r * 0.2); orientTo(f, t); g.add(f);
    });
    if (o.couplings) for (let i = 1; i <= o.couplings; i++) {
      const t = i / (o.couplings + 1), c = mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.3, r * 1.6, 16).rotateX(Math.PI / 2), M.steel);
      c.position.copy(path.getPointAt(t)); orientTo(c, path.getTangentAt(t)); g.add(c);
    }
    bolts.build(g);
  }
  g.userData.path = path;
  return g;
}
// Cable hanging between two points.
export function cable(from, to, r, mat, sag) {
  const a = from.isVector3 ? from : new V(...from), b = to.isVector3 ? to : new V(...to);
  const mid = a.clone().lerp(b, 0.5); mid.y -= sag === undefined ? a.distanceTo(b) * 0.12 : sag;
  const c = new THREE.QuadraticBezierCurve3(a, mid, b);
  return mesh(new THREE.TubeGeometry(c, 20, r, 8, false), mat);
}

// ---------------------------------------------------------------------------
// Drive train
export function pulley(r, width, M, o) {
  o = o || {};
  const g = new THREE.Group(), grooves = o.grooves || 2;
  const prof = [];
  prof.push(new THREE.Vector2(r * 0.25, -width / 2), new THREE.Vector2(r, -width / 2));
  for (let i = 0; i < grooves; i++) {
    const z0 = -width / 2 + (width / grooves) * i, z1 = z0 + width / grooves;
    prof.push(new THREE.Vector2(r, z0 + 0.15 * (z1 - z0)), new THREE.Vector2(r * 0.86, z0 + 0.5 * (z1 - z0)), new THREE.Vector2(r, z0 + 0.85 * (z1 - z0)));
  }
  prof.push(new THREE.Vector2(r, width / 2), new THREE.Vector2(r * 0.25, width / 2));
  const rim = mesh(new THREE.LatheGeometry(prof, 40).rotateX(Math.PI / 2), o.mat || M.chrome, 0, 0, 0, g);
  // web with lightening holes look: recessed face and hub
  mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, width * 0.35, 32).rotateX(Math.PI / 2), M.darkSteel, 0, 0, 0, g);
  mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, width * 1.15, 24).rotateX(Math.PI / 2), o.mat || M.chrome, 0, 0, 0, g);
  const bolts = boltSet(M.steel);
  bolts.circle(new V(0, 0, width * 0.58), new V(0, 0, 1), r * 0.22, 6, r * 0.04);
  bolts.circle(new V(0, 0, width * 0.18), new V(0, 0, 1), r * 0.58, 8, r * 0.05);
  bolts.build(g);
  rim.userData.isRim = true;
  return g;
}
// Open belt around two pulleys in the XY plane (pulleys centred at a and b, radii ra and rb), width along Z.
export function belt(a, ra, b, rb, width, mat) {
  const d = b.clone().sub(a), L = d.length(), ang = Math.atan2(d.y, d.x);
  const beta = Math.asin((ra - rb) / L);
  const pts = [];
  const arc = (c, r, from, to, n) => { for (let i = 0; i <= n; i++) { const t = from + (to - from) * (i / n); pts.push(new THREE.Vector2(c.x + Math.cos(t) * r, c.y + Math.sin(t) * r)); } };
  arc(a, ra, ang + Math.PI / 2 + beta, ang + Math.PI * 1.5 - beta, 24);
  arc(b, rb, ang - Math.PI / 2 - beta, ang + Math.PI / 2 + beta, 24);
  const shape = new THREE.Shape(pts.map((p) => p.clone().multiplyScalar(1.0)));
  const inner = pts.map((p, i) => { const c = i <= 24 ? a : b, r = i <= 24 ? ra : rb; const dir = p.clone().sub(new THREE.Vector2(c.x, c.y)).normalize(); return p.clone().sub(dir.multiplyScalar(Math.min(0.012, r * 0.18))); });
  shape.holes.push(new THREE.Path(inner.reverse()));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -width / 2);
  const outerR = 1.0;
  void outerR;
  return mesh(geo, mat);
}
export function motor(o, M) {
  o = o || {};
  const len = o.length || 0.32, r = o.radius || 0.09, g = new THREE.Group();
  // ribbed housing along X
  mesh(new THREE.CylinderGeometry(r, r, len, 28).rotateZ(Math.PI / 2), M.motor, 0, 0, 0, g);
  const fins = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    fins.push(new THREE.BoxGeometry(len * 0.86, r * 0.16, r * 0.05).translate(0, r * 1.03, 0).rotateX(a));
  }
  mesh(mergeBufferGeometries(fins), M.motor, 0, 0, 0, g);
  // end bells
  [-1, 1].forEach((s) => mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.0, len * 0.08, 28).rotateZ(Math.PI / 2), M.motor, s * len * 0.5, 0, 0, g));
  // fan cowl with slots at the back
  mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.08, len * 0.32, 28, 1, true).rotateZ(Math.PI / 2), M.motor, -len * 0.66, 0, 0, g);
  for (let i = 0; i < 4; i++) { const t = new THREE.TorusGeometry(r * (0.25 + i * 0.22), r * 0.035, 6, 28).rotateY(Math.PI / 2); mesh(t, M.darkSteel, -len * 0.82, 0, 0, g); }
  // shaft with key
  const shaft = mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, len * 0.45, 16).rotateZ(Math.PI / 2), M.chrome, len * 0.72, 0, 0, g);
  // terminal box with cable gland
  const tb = panel(len * 0.36, r * 0.55, r * 0.9, M.motor, 0.01); tb.position.set(0, r * 1.25, 0); g.add(tb);
  const lid = panel(len * 0.38, r * 0.08, r * 0.95, M.motor, 0.006); lid.position.set(0, r * 1.55, 0); g.add(lid);
  mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.14, r * 0.25, 12).rotateX(Math.PI / 2), M.plastic, len * 0.06, r * 1.25, r * 0.55, g);
  // feet
  [-1, 1].forEach((s) => { const f = panel(len * 0.75, r * 0.12, r * 0.45, M.motor, 0.006); f.position.set(0, -r * 0.98, s * r * 0.72); g.add(f); });
  const bolts = boltSet(M.steel);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => bolts.add(new V(sx * len * 0.3, -r * 0.92, sz * r * 0.8), new V(0, 1, 0), r * 0.07)));
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => bolts.add(new V(sx * len * 0.15, r * 1.6, sz * r * 0.38), new V(0, 1, 0), r * 0.045)));
  bolts.circle(new V(len * 0.54, 0, 0), new V(1, 0, 0), r * 0.82, 6, r * 0.06);
  bolts.build(g);
  // nameplate
  const np = mesh(new THREE.BoxGeometry(len * 0.3, r * 0.4, 0.002), M.stainless, 0, 0.0, r * 1.11, g); np.castShadow = false;
  g.userData = { shaft, shaftTip: new V(len * 0.95, 0, 0), radius: r, length: len };
  return g;
}
export function gearbox(o, M) {
  o = o || {};
  const w = o.w || 0.26, h = o.h || 0.22, d = o.d || 0.18, g = new THREE.Group();
  const body = panel(w, h, d, M.castIron, 0.02); g.add(body);
  // split line flange with bolts
  const fl = panel(w * 1.06, h * 0.08, d * 1.08, M.castIron, 0.006); fl.position.y = h * 0.05; g.add(fl);
  const bolts = boltSet(M.steel);
  bolts.row(new V(-w * 0.45, h * 0.1, d * 0.54), new V(w * 0.45, h * 0.1, d * 0.54), new V(0, 1, 0), 5, 0.006);
  bolts.row(new V(-w * 0.45, h * 0.1, -d * 0.54), new V(w * 0.45, h * 0.1, -d * 0.54), new V(0, 1, 0), 5, 0.006);
  // ribs
  for (let i = -1; i <= 1; i++) { const rb = panel(w * 0.05, h * 0.8, d * 1.04, M.castIron, 0.004); rb.position.set(i * w * 0.3, -h * 0.05, 0); g.add(rb); }
  // bearing bosses and shafts (input low, output high, along Z)
  const inS = mesh(new THREE.CylinderGeometry(0.014, 0.014, d * 0.9, 14).rotateX(Math.PI / 2), M.chrome, -w * 0.28, -h * 0.18, d * 0.7, g);
  const outS = mesh(new THREE.CylinderGeometry(0.02, 0.02, d * 0.9, 14).rotateX(Math.PI / 2), M.chrome, w * 0.25, h * 0.2, d * 0.7, g);
  [[-w * 0.28, -h * 0.18, 0.04], [w * 0.25, h * 0.2, 0.055]].forEach(([x, y, r]) => {
    mesh(new THREE.CylinderGeometry(r, r, d * 0.14, 24).rotateX(Math.PI / 2), M.castIron, x, y, d * 0.55, g);
    bolts.circle(new V(x, y, d * 0.62), new V(0, 0, 1), r * 0.75, 4, 0.005);
  });
  // breather, sight glass, drain plug
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), M.brass, -w * 0.3, h * 0.6, 0, g);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 18).rotateX(Math.PI / 2), M.glass, w * 0.05, -h * 0.15, d * 0.51, g);
  mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.012, 6).rotateX(Math.PI / 2), M.steel, w * 0.3, -h * 0.4, d * 0.51, g);
  bolts.build(g);
  g.userData = { input: inS, output: outS, inputPos: new V(-w * 0.28, -h * 0.18, d * 0.95), outputPos: new V(w * 0.25, h * 0.2, d * 0.95) };
  return g;
}
export function bearingBlock(shaftR, M) {
  const g = new THREE.Group();
  const base = panel(shaftR * 9, shaftR * 1.4, shaftR * 3.2, M.castIron, 0.004); base.position.y = -shaftR * 1.8; g.add(base);
  mesh(new THREE.CylinderGeometry(shaftR * 2.2, shaftR * 2.2, shaftR * 2.8, 22).rotateX(Math.PI / 2), M.castIron, 0, 0, 0, g);
  mesh(new THREE.CylinderGeometry(shaftR * 0.3, shaftR * 0.3, shaftR * 1.2, 8), M.brass, 0, shaftR * 2.6, 0, g);
  const b = boltSet(M.steel); b.add(new V(-shaftR * 3.5, -shaftR * 1.1, 0), new V(0, 1, 0), shaftR * 0.5).add(new V(shaftR * 3.5, -shaftR * 1.1, 0), new V(0, 1, 0), shaftR * 0.5); b.build(g);
  return g;
}
export function hydraulicCylinder(len, r, M) {
  const g = new THREE.Group();
  const barrel = mesh(new THREE.CylinderGeometry(r, r, len * 0.55, 20), M.paint, 0, len * 0.275, 0, g);
  const rod = mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, len * 0.55, 16), M.chrome, 0, len * 0.55, 0, g);
  [0, len * 0.55].forEach((y) => mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, r * 0.4, 20), M.darkSteel, 0, y, 0, g));
  const clevis = mesh(new THREE.TorusGeometry(r * 0.6, r * 0.22, 8, 18), M.steel, 0, len * 0.85, 0, g);
  void barrel;
  g.userData = { setExtension(t) { rod.position.y = len * (0.45 + 0.25 * t); clevis.position.y = rod.position.y + len * 0.3; } };
  return g;
}

// ---------------------------------------------------------------------------
// Structure
// Square tube member between two points, with base plates where it meets the floor.
export function beam(from, to, size, mat) {
  const a = from.isVector3 ? from : new V(...from), b = to.isVector3 ? to : new V(...to);
  const L = a.distanceTo(b);
  const m = panel(size, L, size, mat, Math.min(0.006, size * 0.12));
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
export function gusset(size, thick, mat) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(size, 0); s.lineTo(0, size); s.lineTo(0, 0);
  return mesh(new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }).translate(0, 0, -thick / 2), mat);
}
export function basePlate(size, M, bolts, at) {
  const p = panel(size, 0.012, size, M.darkSteel, 0.003);
  p.position.copy(at); p.position.y += 0.006;
  const o = size * 0.32;
  [[-o, -o], [o, -o], [-o, o], [o, o]].forEach(([x, z]) => bolts.add(new V(at.x + x, 0.012, at.z + z), new V(0, 1, 0), 0.007));
  return p;
}
// Access door: recessed panel, two hinges on the left, a pull handle and two quarter-turn latches.
// Returns a pivot group (rotate .rotation.y to open).
export function accessDoor(w, h, M, o) {
  o = o || {};
  const pivot = new THREE.Group();
  const door = panel(w, h, 0.018, o.mat || M.paint, 0.006); door.position.set(w / 2, 0, 0); pivot.add(door);
  const inset = panel(w * 0.86, h * 0.86, 0.006, o.mat || M.paint, 0.004); inset.position.set(w / 2, 0, 0.011); pivot.add(inset);
  if (o.window) { const win = panel(w * 0.62, h * 0.46, 0.008, M.glass, 0.004); win.position.set(w / 2, h * 0.14, 0.012); win.castShadow = false; pivot.add(win); }
  [-1, 1].forEach((s) => {
    mesh(new THREE.CylinderGeometry(0.008, 0.008, h * 0.16, 12), M.steel, -0.004, s * h * 0.34, 0.012, pivot);
    const leaf = panel(0.03, h * 0.14, 0.004, M.steel, 0.002); leaf.position.set(0.016, s * h * 0.34, 0.012); pivot.add(leaf);
  });
  // handle: bar on two standoffs
  const hx = w * 0.9;
  mesh(new THREE.CylinderGeometry(0.007, 0.007, h * 0.22, 12), M.chrome, hx, 0, 0.042, pivot);
  [-1, 1].forEach((s) => mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.035, 10).rotateX(Math.PI / 2), M.chrome, hx, s * h * 0.1, 0.026, pivot));
  [-1, 1].forEach((s) => {
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 18).rotateX(Math.PI / 2), M.darkSteel, hx, s * h * 0.36, 0.014, pivot);
    const slot = panel(0.016, 0.004, 0.004, M.steel, 0.001); slot.position.set(hx, s * h * 0.36, 0.019); pivot.add(slot);
  });
  const b = boltSet(M.steel);
  [-1, 1].forEach((s) => b.row(new V(0.006, s * h * 0.38, 0.016), new V(0.026, s * h * 0.3, 0.016), new V(0, 0, 1), 2, 0.004));
  b.build(pivot);
  if (o.louvres) pivot.add(louvres(w * 0.6, h * 0.22, M, o.mat || M.paint).translateX(w / 2).translateY(-h * 0.28).translateZ(0.016));
  return pivot;
}
export function louvres(w, h, M, mat) {
  const g = new THREE.Group(), n = Math.max(3, Math.round(h / 0.022));
  const frame = panel(w, h, 0.01, mat || M.paint, 0.003); g.add(frame);
  const bg = panel(w * 0.92, h * 0.88, 0.004, M.darkSteel, 0.001); bg.position.z = 0.004; g.add(bg);
  for (let i = 0; i < n; i++) { const s = panel(w * 0.9, h / n * 0.9, 0.004, mat || M.paint, 0.0015); s.position.set(0, -h * 0.44 + (i + 0.5) * (h * 0.88 / n), 0.009); s.rotation.x = -0.6; g.add(s); }
  return g;
}
// Mesh guard (bars on a frame), used over belts and fans.
export function guard(w, h, M, o) {
  o = o || {};
  const g = new THREE.Group(), bars = [], pitch = o.pitch || 0.025;
  const fr = 0.008;
  [[0, h / 2, w, fr], [0, -h / 2, w, fr], [-w / 2, 0, fr, h], [w / 2, 0, fr, h]].forEach(([x, y, ww, hh]) => { const p = panel(ww + fr, hh + fr, fr * 1.6, o.mat || M.paint2, 0.002); p.position.set(x, y, 0); g.add(p); });
  for (let x = -w / 2 + pitch; x < w / 2; x += pitch) bars.push(new THREE.BoxGeometry(0.003, h, 0.003).translate(x, 0, 0));
  for (let y = -h / 2 + pitch; y < h / 2; y += pitch) bars.push(new THREE.BoxGeometry(w, 0.003, 0.003).translate(0, y, 0.003));
  const grid = mesh(mergeBufferGeometries(bars), o.mat || M.paint2, 0, 0, 0, g); grid.castShadow = false;
  return g;
}
export function hazardStripe(w, h) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#e8b51f'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#17181a';
  for (let i = -64; i < 256; i += 48) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 24, 64); x.lineTo(i + 88, 0); x.lineTo(i + 64, 0); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.repeat.set(w / h / 4, 1);
  const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.1 }));
  m.castShadow = false; return m;
}
export function label(w, h, lines, o) {
  o = o || {};
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const x = c.getContext('2d');
  x.fillStyle = o.bg || '#e9e6dc'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = o.fg || '#1c1e20'; x.lineWidth = 8; x.strokeRect(8, 8, c.width - 16, c.height - 16);
  x.fillStyle = o.fg || '#1c1e20'; x.textBaseline = 'middle';
  lines.forEach((ln, i) => { x.font = (i === 0 ? '700 ' : '500 ') + Math.round(c.height / (lines.length + 1) * (i === 0 ? 0.62 : 0.42)) + 'px Arial, sans-serif'; x.fillText(ln, 24, (i + 1) * c.height / (lines.length + 1)); });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: o.metal ? 0.7 : 0.05 }));
  m.castShadow = false; return m;
}

// ---------------------------------------------------------------------------
// Controls
export function pushButton(r, color, M, o) {
  o = o || {};
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(r * 1.4, r * 1.4, r * 0.4, 20).rotateX(Math.PI / 2), M.chrome, 0, 0, r * 0.2, g);
  const cap = mesh(new THREE.CylinderGeometry(r, r * 1.02, r * 0.6, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: lin(color), roughness: 0.35, emissive: lin(color), emissiveIntensity: 0 }), 0, 0, r * 0.6, g);
  g.userData.cap = cap;
  return g;
}
export function emergencyStop(r, M) {
  const g = new THREE.Group();
  const plate = mesh(new THREE.CylinderGeometry(r * 2.2, r * 2.2, r * 0.15, 28).rotateX(Math.PI / 2), M.yellow, 0, 0, r * 0.08, g); void plate;
  mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.8, r * 0.8, 20).rotateX(Math.PI / 2), M.plastic, 0, 0, r * 0.55, g);
  const head = mesh(new THREE.SphereGeometry(r * 1.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), M.red, 0, 0, r * 0.95, g);
  head.scale.set(1, 1, 0.55);
  mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, r * 0.25, 24).rotateX(Math.PI / 2), M.red, 0, 0, r * 1.0, g);
  return g;
}
export function selectorKnob(r, M) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.3, r * 0.25, 24).rotateX(Math.PI / 2), M.chrome, 0, 0, r * 0.12, g);
  const knob = new THREE.Group(); knob.position.z = r * 0.25; g.add(knob);
  mesh(new THREE.CylinderGeometry(r * 0.9, r, r * 0.6, 20).rotateX(Math.PI / 2), M.plastic, 0, 0, r * 0.3, knob);
  const bar = panel(r * 0.35, r * 1.7, r * 0.55, M.plastic, r * 0.1); bar.position.z = r * 0.75; knob.add(bar);
  const mark = panel(r * 0.12, r * 0.6, r * 0.05, M.stainless, 0.001); mark.position.set(0, r * 0.5, r * 1.04); knob.add(mark);
  g.userData.knob = knob;
  return g;
}
export function toggleSwitch(r, M) {
  const g = new THREE.Group();
  const base = panel(r * 2, r * 2.8, r * 0.6, M.darkSteel, r * 0.15); base.position.z = r * 0.3; g.add(base);
  const lever = new THREE.Group(); lever.position.z = r * 0.6; lever.rotation.x = -0.4; g.add(lever);
  mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.25, r * 1.6, 10).rotateX(Math.PI / 2), M.chrome, 0, 0, r * 0.8, lever);
  mesh(new THREE.SphereGeometry(r * 0.32, 12, 8), M.chrome, 0, 0, r * 1.6, lever);
  g.userData.lever = lever;
  return g;
}
export function keypad(cols, rows, key, M) {
  const g = new THREE.Group(), geos = [];
  const pitch = key * 1.25;
  const base = panel(cols * pitch + key * 0.4, rows * pitch + key * 0.4, key * 0.3, M.darkSteel, key * 0.08); base.position.z = key * 0.15; g.add(base);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) geos.push(new RoundedBoxGeometry(key, key, key * 0.35, 1, key * 0.12).translate((c - (cols - 1) / 2) * pitch, (r - (rows - 1) / 2) * pitch, key * 0.45));
  mesh(mergeBufferGeometries(geos), M.plastic, 0, 0, 0, g);
  return g;
}
// Round dial gauge with a moving needle. setValue(0..1).
export function gauge(r, M, o) {
  o = o || {};
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#f1efe8'; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  if (o.red !== undefined) { x.strokeStyle = '#d0342a'; x.lineWidth = 14; x.beginPath(); x.arc(128, 128, 98, a0 + (a1 - a0) * o.red, a1); x.stroke(); }
  if (o.green) { x.strokeStyle = '#3aa45a'; x.lineWidth = 14; x.beginPath(); x.arc(128, 128, 98, a0 + (a1 - a0) * o.green[0], a0 + (a1 - a0) * o.green[1]); x.stroke(); }
  x.strokeStyle = '#1b1c1e';
  for (let i = 0; i <= 40; i++) { const a = a0 + (a1 - a0) * i / 40, l = i % 5 ? 10 : 20; x.lineWidth = i % 5 ? 2 : 4; x.beginPath(); x.moveTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); x.lineTo(128 + Math.cos(a) * (112 - l), 128 + Math.sin(a) * (112 - l)); x.stroke(); }
  x.fillStyle = '#1b1c1e'; x.font = '700 22px Arial'; x.textAlign = 'center';
  (o.marks || ['0', '', '', '', '', '', '', '', '8']).forEach((t, i, arr) => { if (!t) return; const a = a0 + (a1 - a0) * i / (arr.length - 1); x.fillText(t, 128 + Math.cos(a) * 78, 136 + Math.sin(a) * 78); });
  x.font = '600 18px Arial'; x.fillText(o.unit || 'bar', 128, 186);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, r * 0.4, 28).rotateX(Math.PI / 2), M.chrome, 0, 0, 0, g);
  const face = mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), 0, 0, r * 0.18, g); face.castShadow = false;
  const needle = new THREE.Group(); needle.position.z = r * 0.22; g.add(needle);
  mesh(new THREE.BoxGeometry(r * 0.06, r * 0.82, r * 0.02).translate(0, r * 0.32, 0), M.red, 0, 0, 0, needle);
  mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.05, 12).rotateX(Math.PI / 2), M.plastic, 0, 0, r * 0.01, needle);
  const glass = mesh(new THREE.CircleGeometry(r * 1.02, 32), M.glass, 0, 0, r * 0.26, g); glass.castShadow = false;
  let cur = 0;
  g.userData.setValue = (v) => { cur += (Math.max(0, Math.min(1, v)) - cur) * 0.15; needle.rotation.z = -((a0 + (a1 - a0) * cur) - Math.PI * 1.5) ; };
  g.userData.setValue(0);
  return g;
}
// A live screen: canvas texture on a bezel. draw(ctx, w, h) is called by the owner whenever data changes.
export function screen(w, h, M, o) {
  o = o || {};
  const g = new THREE.Group();
  const bez = panel(w + 0.02, h + 0.02, 0.012, M.plastic, 0.004); g.add(bez);
  const c = document.createElement('canvas'); c.width = o.px || 512; c.height = Math.round(c.width * h / w);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.25, roughness: 0.18, metalness: 0 });
  const face = mesh(new THREE.PlaneGeometry(w, h), mat, 0, 0, 0.0065, g); face.castShadow = false;
  g.userData = { canvas: c, ctx: c.getContext('2d'), texture: t, face };
  return g;
}
// Sloped desk console (operator station): cabinet with door and vents, sloped control surface, upper screen panel.
export function console_(o, M) {
  o = o || {};
  const w = o.w || 0.9, h = o.h || 1.05, d = o.d || 0.62, g = new THREE.Group();
  const cab = panel(w, h * 0.66, d * 0.9, M.paint, 0.012); cab.position.set(0, h * 0.33, -d * 0.05); g.add(cab);
  const plinth = panel(w * 0.98, 0.05, d * 0.86, M.darkSteel, 0.006); plinth.position.set(0, 0.025, -d * 0.05); g.add(plinth);
  const door = accessDoor(w * 0.42, h * 0.48, M, { louvres: true }); door.position.set(-w * 0.45, h * 0.32, d * 0.4 + 0.001); g.add(door);
  g.add(louvres(w * 0.3, h * 0.12, M).translateX(w * 0.27).translateY(h * 0.12).translateZ(d * 0.405));
  // sloped desk
  const desk = new THREE.Group(); desk.position.set(0, h * 0.66, d * 0.32); desk.rotation.x = -0.42; g.add(desk);
  const top = panel(w * 1.02, 0.04, d * 0.62, M.paint, 0.01); top.position.set(0, 0, -d * 0.28); top.rotation.x = Math.PI / 2 - 0.42 * 0 - Math.PI / 2; desk.add(top);
  const face = new THREE.Group(); face.position.set(0, 0.021, -d * 0.28); face.rotation.x = -Math.PI / 2; desk.add(face);
  // upper panel with screen
  const upper = panel(w, h * 0.3, 0.06, M.paint, 0.012); upper.position.set(0, h * 0.86, -d * 0.36); upper.rotation.x = -0.12; g.add(upper);
  const upFace = new THREE.Group(); upFace.position.set(0, h * 0.86, -d * 0.36 + 0.031); upFace.rotation.x = -0.12; g.add(upFace);
  g.userData = { desk: face, upper: upFace, w, h, d };
  return g;
}
// Electrical cabinet with a hinged door (open it with userData.door.rotation.y).
export function cabinet(o, M) {
  o = o || {};
  const w = o.w || 0.5, h = o.h || 0.8, d = o.d || 0.25, g = new THREE.Group();
  const body = panel(w, h, d, o.mat || M.paint, 0.008); g.add(body);
  const door = accessDoor(w * 0.96, h * 0.96, M, { mat: o.mat || M.paint, louvres: true }); door.position.set(-w * 0.48, 0, d / 2); g.add(door);
  const roof = panel(w * 1.08, 0.02, d * 1.15, o.mat || M.paint, 0.006); roof.position.y = h / 2 + 0.01; g.add(roof);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 14), M.plastic, w * 0.3, -h / 2 - 0.03, 0, g);
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 14), M.plastic, -w * 0.2, -h / 2 - 0.03, 0, g);
  g.userData = { door };
  return g;
}
// Fan with spinning blades behind a round grille (roof exhaust).
export function fan(r, M) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.12, r * 0.6, 32, 1, true), M.paint, 0, r * 0.3, 0, g);
  const rotor = new THREE.Group(); rotor.position.y = r * 0.3; g.add(rotor);
  const blades = [];
  for (let i = 0; i < 5; i++) blades.push(new THREE.BoxGeometry(r * 0.85, 0.004, r * 0.26).translate(r * 0.45, 0, 0).rotateX(0.35).rotateY((i / 5) * Math.PI * 2));
  mesh(mergeBufferGeometries(blades), M.steel, 0, 0, 0, rotor);
  mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, r * 0.12, 16), M.darkSteel, 0, 0, 0, rotor);
  for (let i = 1; i <= 4; i++) mesh(new THREE.TorusGeometry(r * i / 4.2, 0.0035, 6, 32).rotateX(Math.PI / 2), M.darkSteel, 0, r * 0.6, 0, g);
  g.userData.rotor = rotor;
  return g;
}
