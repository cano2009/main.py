// Fieldworks buildings (low-poly, complete from every side): barn, warehouse and greenhouse. Each has closed walls,
// a full roof, a door, a foundation slab and a footprint used for placement, snapping and collision.
// Origin at the centre of the slab, door facing +z. three.js r147.

import * as THREE from 'three';
import { bake } from './lowpoly.js';

const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
function mat(hex, o) { const k = hex + JSON.stringify(o || {}); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0, flatShading: true }, o || {})); m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m); } return mats.get(k); }
function put(p, m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (p) p.add(m); return m; }
const box = (w, h, d, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
// a closed prism from a 2D profile (x, y) extruded along z, centred
function prism(points, depth, m, p) {
  const sh = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2);
  return put(p, new THREE.Mesh(g, m));
}
export const BUILDINGS = {
  barn: { name: 'Barn', size: [8, 10], cost: 9000, desc: 'Storage barn with a gambrel roof and sliding doors' },
  warehouse: { name: 'Warehouse', size: [10, 12], cost: 14000, desc: 'Steel warehouse with a roller door' },
  greenhouse: { name: 'Greenhouse', size: [6, 10], cost: 6500, desc: 'Glass greenhouse on a steel frame' }
};
export function building(kind) {
  const [W, D] = BUILDINGS[kind].size, root = new THREE.Group(); root.name = BUILDINGS[kind].name; root.userData.pick = 'build'; root.userData.kind = kind;
  box(W + 0.4, 0.2, D + 0.4, mat('#a39d92'), 0, 0.1, 0, root);                      // foundation slab
  if (kind === 'barn') {
    const red = mat('#b5413a'), white = mat('#efeae0'), roof = mat('#4c4f55');
    const H = 3.4, prof = [[-W / 2, 0], [W / 2, 0], [W / 2, H], [W * 0.32, H + 1.6], [0, H + 2.3], [-W * 0.32, H + 1.6], [-W / 2, H]];
    const body = prism(prof, D, red, root); body.position.y = 0.2;
    // roof skin slightly proud of the walls on each slope
    [[-1], [1]].forEach(([s]) => {
      const a = new THREE.Vector2(s * W / 2, H), b = new THREE.Vector2(s * W * 0.32, H + 1.6), c = new THREE.Vector2(0, H + 2.3);
      [[a, b], [b, c]].forEach(([p0, p1]) => { const len = p0.distanceTo(p1), r = box(len + 0.3, 0.12, D + 0.5, roof, (p0.x + p1.x) / 2, 0.2 + (p0.y + p1.y) / 2 + 0.06, 0, root); r.rotation.z = Math.atan2(p1.y - p0.y, p1.x - p0.x); });
    });
    // trim, sliding doors with cross braces, hay loft door
    [-1, 1].forEach((s) => box(0.16, H, 0.16, white, s * (W / 2 - 0.02), 0.2 + H / 2, D / 2 + 0.01, root));
    [-1, 1].forEach((s) => { const d = box(1.7, 2.8, 0.1, red, s * 0.86, 1.6, D / 2 + 0.06, root); box(1.7, 0.12, 0.12, white, s * 0.86, 3.0, D / 2 + 0.1, root); box(1.7, 0.12, 0.12, white, s * 0.86, 0.26, D / 2 + 0.1, root); const x = box(2.1, 0.12, 0.12, white, s * 0.86, 1.6, D / 2 + 0.12, root); x.rotation.z = s * 0.98; void d; });
    box(3.7, 0.12, 0.14, mat('#6f767b'), 0, 3.12, D / 2 + 0.12, root);                // door track
    box(1.2, 1.0, 0.1, white, 0, 4.4, D / 2 + 0.06, root); box(1.0, 0.8, 0.1, red, 0, 4.4, D / 2 + 0.1, root);
    [-2.6, 2.6].forEach((x) => { box(0.9, 0.9, 0.1, white, x, 2.2, D / 2 + 0.05, root); box(0.7, 0.7, 0.1, mat('#2a3235'), x, 2.2, D / 2 + 0.07, root); });
    box(0.5, 0.6, 0.5, white, 0, H + 2.6, 0, root); put(root, new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.4, 4).rotateY(Math.PI / 4), roof), 0, H + 3.1, 0);
  } else if (kind === 'warehouse') {
    const wall = mat('#c9cdd0'), rib = mat('#aeb3b7'), roof = mat('#7f868c'), green = mat('#3f7d4c'), H = 5;
    const body = prism([[-W / 2, 0], [W / 2, 0], [W / 2, H], [0, H + 1.2], [-W / 2, H]], D, wall, root); body.position.y = 0.2;
    for (let x = -W / 2 + 0.5; x < W / 2; x += 0.5) [-1, 1].forEach((s) => box(0.08, H - 0.2, 0.06, rib, x, 0.2 + H / 2, s * (D / 2 + 0.02), root));
    for (let z = -D / 2 + 0.5; z < D / 2; z += 0.5) [-1, 1].forEach((s) => box(0.06, H - 0.2, 0.08, rib, s * (W / 2 + 0.02), 0.2 + H / 2, z, root));
    [-1, 1].forEach((s) => { const len = Math.hypot(W / 2, 1.2), r = box(len + 0.4, 0.12, D + 0.5, roof, s * W / 4, 0.2 + H + 0.66, 0, root); r.rotation.z = -s * Math.atan2(1.2, W / 2); });
    box(4.2, 3.8, 0.12, mat('#9aa1a6'), 0, 2.1, D / 2 + 0.08, root);
    for (let k = 0; k < 12; k++) box(4.1, 0.03, 0.04, rib, 0, 0.4 + k * 0.3, D / 2 + 0.15, root);
    box(4.6, 0.4, 0.3, green, 0, 4.2, D / 2 + 0.12, root);
    box(1.0, 2.1, 0.1, green, 3.6, 1.25, D / 2 + 0.07, root);
    box(3.2, 0.6, 0.06, green, 0, H - 0.2, D / 2 + 0.1, root);
  } else {
    const frame = mat('#e9e4d6'), glass = Object.assign(new THREE.MeshStandardMaterial({ color: lin('#cfe9e0'), roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false }), { userData: { lowpoly: true } });
    const H = 2.4, R = 1.5;
    box(W, 0.4, D, mat('#a39d92'), 0, 0.4, 0, root);                                   // knee wall
    const shell = prism([[-W / 2, 0], [W / 2, 0], [W / 2, H], [0, H + R], [-W / 2, H]], D, glass, root); shell.position.y = 0.6; shell.castShadow = false;
    for (let z = -D / 2; z <= D / 2 + 0.01; z += D / 5) {
      [-1, 1].forEach((s) => box(0.07, H, 0.07, frame, s * W / 2, 0.6 + H / 2, z, root));
      [-1, 1].forEach((s) => { const len = Math.hypot(W / 2, R), r = box(len, 0.07, 0.07, frame, s * W / 4, 0.6 + H + R / 2, z, root); r.rotation.z = -s * Math.atan2(R, W / 2); });
      box(W, 0.06, 0.06, frame, 0, 0.6 + H, z, root);
    }
    [-1, 1].forEach((s) => box(0.07, 0.07, D, frame, s * W / 2, 0.6 + H, 0, root)); box(0.08, 0.08, D, frame, 0, 0.6 + H + R, 0, root);
    box(1.1, 2.1, 0.08, frame, 0, 1.65, D / 2 + 0.02, root); box(0.95, 1.95, 0.04, glass, 0, 1.65, D / 2 + 0.05, root);
    // planting benches with seedlings inside
    [-1.4, 1.4].forEach((x) => { box(1.6, 0.08, D - 1.5, mat('#9a7a52'), x, 0.9, -0.2, root); for (let z = -D / 2 + 1.2; z < D / 2 - 1.4; z += 0.5) put(root, new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), mat('#6fa83a')), x, 1.08, z); [-0.7, 0.7].forEach((dx) => box(0.08, 0.7, D - 1.6, mat('#755c3c'), x + dx, 0.55, -0.2, root)); });
  }
  bake(root, []);
  return { root, kind, size: BUILDINGS[kind].size };
}
