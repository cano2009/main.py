// Fieldworks farm machinery (low-poly): FW-T120 tractor with a three-point hitch, and three implements that couple
// to it through matching hitch ports: a 4-furrow plow, a 4-row seeder and a pull-type harvester with a collection
// bin. Tractor faces +z; an implement's origin is its hitch point and it trails toward -z. three.js r147.

import * as THREE from 'three';
import { bake } from './lowpoly.js';

const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
function mat(hex, o) { const k = hex + JSON.stringify(o || {}); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.05, flatShading: true }, o || {})); m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m); } return mats.get(k); }
export const lin2 = lin;
export const T = {
  green: mat('#3f7d4c'), greenD: mat('#2f5a3b'), yellow: mat('#e9b830'), dark: mat('#33363a'), steel: mat('#9aa1a6', { metalness: 0.3, roughness: 0.5 }),
  tire: mat('#232427', { roughness: 0.95 }), red: mat('#c94232'), black: mat('#1a1b1d'), seat: mat('#2b2d30'),
  glass: Object.assign(new THREE.MeshStandardMaterial({ color: lin('#bfe3f2'), roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false }), { userData: { lowpoly: true } }),
  lamp: Object.assign(new THREE.MeshStandardMaterial({ color: lin('#222'), emissive: lin('#fff2d0'), emissiveIntensity: 0 }), { userData: { lowpoly: true } })
};
function put(p, m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (p) p.add(m); return m; }
const box = (w, h, d, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
const cyl = (r, h, seg, m, x, y, z, p, r2) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r2 === undefined ? r : r2, h, seg || 8), m), x, y, z);
const cylX = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateZ(Math.PI / 2), m), x, y, z);
const cylZ = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateX(Math.PI / 2), m), x, y, z);
function strut(p, a, b, t, m) { const d = b.clone().sub(a), g = new THREE.BoxGeometry(t, t, d.length()); const mm = new THREE.Matrix4().lookAt(new V(), d, Math.abs(d.y / d.length()) > 0.98 ? new V(1, 0, 0) : new V(0, 1, 0)); mm.setPosition(a.clone().add(b).multiplyScalar(0.5)); return put(p, new THREE.Mesh(g.applyMatrix4(mm), m)); }
// wheel with tread lugs and a yellow rim; group spins about x
function wheel(r, w, lugs) {
  const g = new THREE.Group();
  cylX(r, w, 14, T.tire, 0, 0, 0, g);
  cylX(r * 0.62, w + 0.02, 10, T.yellow, 0, 0, 0, g);
  cylX(r * 0.22, w + 0.06, 8, T.dark, 0, 0, 0, g);
  for (let k = 0; k < (lugs || 14); k++) { const a = k / (lugs || 14) * Math.PI * 2; [-1, 1].forEach((s) => { const l = box(w * 0.48, r * 0.12, r * 0.12, T.tire, s * w * 0.25, Math.cos(a) * (r + 0.01), Math.sin(a) * (r + 0.01), g); l.rotation.x = -a + s * 0.35; }); }
  bake(g, []);
  return g;
}

// ---------------------------------------------------------------------------
export function tractor() {
  const root = new THREE.Group(); root.name = 'Tractor'; root.userData.pick = 'tractor';
  const body = new THREE.Group(); root.add(body);
  // frame, engine hood, grille, front weights
  box(0.6, 0.32, 3.1, T.dark, 0, 0.72, 0.15, body);
  box(0.78, 0.66, 1.55, T.green, 0, 1.18, 0.82, body);
  box(0.7, 0.08, 1.5, T.greenD, 0, 1.54, 0.82, body);
  box(0.62, 0.5, 0.05, T.dark, 0, 1.12, 1.61, body);
  for (let k = 0; k < 5; k++) box(0.56, 0.03, 0.02, T.steel, 0, 0.94 + k * 0.09, 1.64, body);
  box(0.9, 0.32, 0.3, T.yellow, 0, 0.72, 1.85, body);
  [-1, 1].forEach((s) => box(0.06, 0.28, 0.42, T.dark, s * 0.36, 0.72, 1.6, body));
  const heads = [-1, 1].map((s) => { const m = box(0.14, 0.1, 0.03, T.lamp, s * 0.27, 1.38, 1.6, body); m.userData.noOutline = true; return m; });
  // exhaust and air intake
  cyl(0.05, 0.75, 8, T.dark, 0.26, 1.85, 1.25, body); cyl(0.07, 0.06, 8, T.dark, 0.26, 2.24, 1.25, body);
  cyl(0.07, 0.5, 8, T.green, -0.26, 1.72, 1.32, body); cyl(0.09, 0.08, 8, T.dark, -0.26, 2.0, 1.32, body);
  // cab: floor, posts, roof, glass, seat, steering wheel, dashboard
  box(1.2, 0.08, 1.3, T.dark, 0, 1.36, -0.55, body);
  [[-0.56, -0.02], [0.56, -0.02], [-0.56, -1.12], [0.56, -1.12]].forEach(([x, z]) => box(0.07, 1.25, 0.07, T.dark, x, 1.98, z, body));
  box(1.36, 0.1, 1.36, T.green, 0, 2.64, -0.57, body); box(1.2, 0.06, 1.2, T.greenD, 0, 2.71, -0.57, body);
  box(1.05, 1.1, 0.02, T.glass, 0, 1.98, -0.01, body); box(1.05, 1.1, 0.02, T.glass, 0, 1.98, -1.13, body);
  [-1, 1].forEach((s) => box(0.02, 1.1, 1.05, T.glass, s * 0.565, 1.98, -0.57, body));
  box(0.5, 0.1, 0.45, T.seat, 0, 1.65, -0.75, body); box(0.5, 0.5, 0.1, T.seat, 0, 1.9, -0.95, body); box(0.12, 0.25, 0.12, T.dark, 0, 1.5, -0.75, body);
  box(0.9, 0.35, 0.2, T.dark, 0, 1.56, -0.12, body);
  strut(body, new V(0, 1.6, -0.2), new V(0, 1.95, -0.38), 0.04, T.dark);
  put(body, new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 4, 10).rotateX(-1.1), T.black), 0, 1.98, -0.4);
  const beacon = cyl(0.07, 0.1, 8, mat('#f08a24', { emissive: lin('#f08a24'), emissiveIntensity: 0.4 }), 0.45, 2.79, -1.0, body); beacon.userData.noOutline = true;
  [-1, 1].forEach((s) => { const w = box(0.14, 0.08, 0.05, T.lamp, s * 0.45, 2.6, 0.13, body); w.userData.noOutline = true; heads.push(w); });
  // mirrors on arms
  [-1, 1].forEach((s) => { strut(body, new V(s * 0.6, 2.3, -0.05), new V(s * 0.85, 2.3, 0.05), 0.03, T.dark); box(0.04, 0.2, 0.14, T.dark, s * 0.87, 2.3, 0.06, body); });
  // rear fenders, steps, fuel tank
  [-1, 1].forEach((s) => {
    const f = put(body, new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.5, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), mat('#3f7d4c', { side: THREE.DoubleSide })), s * 0.86, 0.78, -0.9);
    f.userData.open = true;   // fender: a half shell over the wheel
    box(0.5, 0.05, 1.5, T.green, s * 0.86, 1.72, -0.9, body);
    box(0.08, 0.84, 0.08, T.dark, s * 0.6, 1.3, -0.25, body);
    box(0.3, 0.04, 0.25, T.dark, s * 0.72, 0.95, -0.05, body);
  });
  box(0.5, 0.4, 0.5, T.green, -0.55, 0.95, 0.15, body); cyl(0.06, 0.05, 8, T.yellow, -0.55, 1.18, 0.15, body);
  // three-point hitch: lower links, top link, hitch beam (the hitch port sits at its centre)
  const HZ = -1.85, HY = 0.55;
  [-1, 1].forEach((s) => strut(body, new V(s * 0.25, 0.7, -1.25), new V(s * 0.42, HY, HZ + 0.05), 0.07, T.dark));
  strut(body, new V(0, 1.2, -1.2), new V(0, HY + 0.45, HZ + 0.05), 0.06, T.dark);
  box(0.95, 0.08, 0.08, T.dark, 0, HY, HZ + 0.05, body); box(0.08, 0.5, 0.08, T.dark, 0, HY + 0.25, HZ + 0.05, body);
  box(0.5, 0.3, 0.45, T.dark, 0, 0.78, -1.3, body);
  // wheels (spin; front pair steer)
  const rear = [-1, 1].map((s) => { const w = wheel(0.78, 0.46, 16); w.position.set(s * 0.86, 0.78, -0.9); root.add(w); return w; });
  const frontPivot = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.78, 0.45, 1.3); root.add(p); const w = wheel(0.45, 0.3, 12); p.add(w); return { p, w }; });
  box(1.4, 0.1, 0.12, T.dark, 0, 0.45, 1.3, root); box(0.26, 0.22, 0.3, T.dark, 0, 0.56, 1.3, root);   // front axle and its pivot block on the frame
  bake(body, [beacon, ...heads]);
  return { root, body, rear, front: frontPivot, heads, beacon, hitch: { pos: new V(0, HY, HZ), dir: new V(0, 0, -1) } };
}

// ---------------------------------------------------------------------------
// shared headstock: the A-frame that meets the tractor hitch (port 'hitch_in' at the origin, facing +z)
function headstock(p, w) {
  box(0.9, 0.08, 0.08, T.dark, 0, 0, -0.03, p); box(0.08, 0.5, 0.08, T.dark, 0, 0.25, -0.03, p);
  [-1, 1].forEach((s) => strut(p, new V(s * 0.42, 0, -0.03), new V(s * w * 0.3, 0.12, -0.6), 0.07, T.yellow));
  strut(p, new V(0, 0.48, -0.03), new V(0, 0.15, -0.6), 0.06, T.yellow);
}
export function plow() {
  const root = new THREE.Group(); root.name = 'Plow'; root.userData.pick = 'tractor';
  headstock(root, 2.0);
  strut(root, new V(-1.0, 0.15, -0.55), new V(1.0, 0.15, -1.7), 0.14, T.red);   // diagonal main beam
  const bodies = [];
  for (let i = 0; i < 4; i++) {
    const t = i / 3, x = -0.85 + 1.7 * t, z = -0.6 - 1.05 * t;
    box(0.08, 0.5, 0.08, T.red, x, -0.08, z, root);                       // leg
    const mb = box(0.42, 0.34, 0.05, T.steel, x + 0.12, -0.32, z - 0.05, root); mb.rotation.set(0.35, 0.65, 0.2);   // mouldboard
    put(root, new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4).rotateX(Math.PI / 2), T.dark), x - 0.02, -0.42, z + 0.18);   // share point
    bodies.push(mb);
  }
  const dw = new THREE.Group(); dw.position.set(1.05, -0.2, -1.7); root.add(dw); cylX(0.28, 0.14, 10, T.tire, 0, 0, 0, dw); cylX(0.16, 0.16, 8, T.yellow, 0, 0, 0, dw);
  box(0.08, 0.4, 0.08, T.red, 0.92, 0.05, -1.7, root);
  bake(root, [dw]);
  return { root, wheels: [dw], liftDown: -0.0, liftUp: 0.25 };
}
export function seeder() {
  const root = new THREE.Group(); root.name = 'Seeder'; root.userData.pick = 'tractor';
  headstock(root, 2.0);
  box(2.1, 0.12, 0.14, T.yellow, 0, 0.12, -0.62, root);                     // toolbar
  box(1.8, 0.55, 0.7, T.green, 0, 0.62, -0.95, root); box(1.86, 0.06, 0.76, T.greenD, 0, 0.92, -0.95, root);   // seed hopper
  box(1.5, 0.32, 0.5, T.green, 0, 0.22, -0.95, root);
  const units = [];
  for (let i = 0; i < 4; i++) {
    const x = -0.75 + i * 0.5, u = new THREE.Group(); u.position.set(x, 0.05, -0.75); root.add(u);
    box(0.08, 0.4, 0.5, T.dark, 0, 0, -0.2, u);
    cylX(0.17, 0.04, 10, T.steel, 0, -0.25, -0.1, u);                          // opening disc
    cylX(0.13, 0.1, 10, T.tire, 0, -0.32, -0.5, u);                             // press wheel
    cyl(0.025, 0.4, 6, T.black, 0, 0.18, -0.3, u);                             // seed tube
    units.push(u);
  }
  // fold-up row markers
  [-1, 1].forEach((s) => { strut(root, new V(s * 1.0, 0.12, -0.62), new V(s * 1.08, 0.95, -0.62), 0.05, T.yellow); cylX(0.12, 0.03, 8, T.steel, s * 1.1, 0.97, -0.62, root); });   // row markers folded up for transport
  bake(root, []);
  return { root, wheels: [], units, liftDown: 0.0, liftUp: 0.25 };
}
export function harvester() {
  const root = new THREE.Group(); root.name = 'Harvester'; root.userData.pick = 'tractor';
  // drawbar from the hitch, chassis, two wheels
  strut(root, new V(0, 0, -0.03), new V(0.0, 0.35, -1.0), 0.1, T.dark);
  box(0.9, 0.08, 0.08, T.dark, 0, 0, -0.03, root); box(0.08, 0.5, 0.08, T.dark, 0, 0.25, -0.03, root);
  box(1.4, 0.12, 2.0, T.dark, 0.0, 0.35, -1.9, root);
  box(2.0, 0.1, 0.1, T.dark, 0, -0.05, -2.1, root); box(0.3, 0.42, 0.1, T.dark, 0, 0.13, -2.1, root);   // axle under the chassis
  const wheels = [-1, 1].map((s) => { const w = wheel(0.5, 0.3, 12); w.position.set(s * 0.95, -0.05, -2.1); root.add(w); return w; });
  // pickup header with a turning reel, offset to the right so it runs beside the tractor track
  const head = new THREE.Group(); head.position.set(0, -0.25, -1.0); root.add(head);
  box(2.1, 0.3, 0.6, T.yellow, 0, 0.0, 0, head); box(2.1, 0.06, 0.5, T.dark, 0, -0.16, 0.12, head);
  [-1, 1].forEach((s) => box(0.06, 0.6, 0.65, T.yellow, s * 1.06, 0.2, 0, head));
  const reel = new THREE.Group(); reel.position.set(0, 0.35, 0.18); head.add(reel);
  cylX(0.04, 2.1, 8, T.steel, 0, 0, 0, reel);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const b = box(2.0, 0.04, 0.06, T.red, 0, Math.cos(a) * 0.24, Math.sin(a) * 0.24, reel); b.rotation.x = -a; }
  [-1, 1].forEach((s) => strut(head, new V(s * 1.0, 0.1, -0.05), new V(s * 1.0, 0.35, 0.18), 0.04, T.dark));
  strut(root, new V(0.0, -0.1, -1.2), new V(0, 0.35, -1.5), 0.08, T.dark);
  // elevator up into the bin, bin with fill level
  strut(root, new V(0.75, -0.1, -1.1), new V(0.75, 1.55, -1.6), 0.22, T.green);
  box(1.4, 1.0, 1.5, T.green, 0, 0.92, -2.05, root);
  [-1, 1].forEach((s) => box(0.06, 0.25, 1.5, T.greenD, s * 0.73, 1.52, -2.05, root));
  box(1.46, 0.25, 0.06, T.greenD, 0, 1.52, -1.27, root); box(1.46, 0.25, 0.06, T.greenD, 0, 1.52, -2.83, root);
  const fill = box(1.36, 0.6, 1.44, mat('#c9a43a'), 0, 1.1, -2.05, root); fill.geometry.translate(0, 0.3, 0); fill.position.y = 1.0; fill.userData.noOutline = true;
  bake(root, [reel, fill, ...wheels]); bake(head, [reel]);
  return { root, wheels, reel, fill, liftDown: 0.0, liftUp: 0.2, towed: true, axleBack: 2.1 };
}

/** Tipping trailer: drawbar with a hitch eye at the origin, tandem axle, red bed that tips about its rear edge on a
 *  hydraulic ram, mudguards and tail lights. bed.rotation.x < 0 tips it; load is the crop heap inside. */
export function trailer() {
  const root = new THREE.Group(); root.name = 'Trailer'; root.userData.pick = 'tractor';
  const RED = mat('#b5413a'), L0 = -1.0, L1 = -4.5, Y = 0.15;   // bed from z L0 to L1, chassis top at y Y (hitch at 0.55 m)
  // drawbar: A-frame from the hitch eye back to the chassis
  cylZ(0.07, 0.06, 10, T.dark, 0, 0, -0.02, root);
  [-1, 1].forEach((s) => strut(root, new V(0, 0, -0.05), new V(s * 0.55, Y - 0.05, L0 + 0.1), 0.09, T.dark));
  box(0.08, 0.25, 0.08, T.dark, 0, -0.15, -0.6, root);                                  // parking stand
  // chassis rails and cross members
  [-0.55, 0.55].forEach((x) => box(0.12, 0.16, L0 + 0.2 - L1, T.dark, x, Y - 0.08, (L0 + 0.2 + L1) / 2, root));   // rails run under the front cross member
  [L0 + 0.1, -2.2, -3.4, L1 + 0.1].forEach((z) => box(1.22, 0.1, 0.1, T.dark, 0, Y - 0.08, z, root));
  // tandem axle and wheels (wheel bottoms at y = -0.55)
  const wheels = [];
  [-2.75, -3.6].forEach((z) => { box(2.1, 0.09, 0.09, T.dark, 0, -0.13, z, root); [-1, 1].forEach((s) => { const w = wheel(0.42, 0.28, 12); w.position.set(s * 1.02, -0.13, z); root.add(w); wheels.push(w); }); });
  [-1, 1].forEach((s) => { box(0.32, 0.04, 1.5, T.dark, s * 1.02, 0.33, -3.18, root); box(0.1, 0.42, 0.1, T.dark, s * 0.75, 0.12, -3.18, root); });
  // tipping bed, hinged at the rear
  const bed = new THREE.Group(); bed.position.set(0, Y, L1 + 0.05); root.add(bed);
  const bl = L0 - L1 - 0.05;
  box(1.9, 0.08, bl, T.dark, 0, 0.04, bl / 2, bed);
  [-1, 1].forEach((s) => { box(0.06, 0.62, bl, RED, s * 0.94, 0.39, bl / 2, bed); box(0.08, 0.06, bl + 0.04, T.green, s * 0.94, 0.72, bl / 2, bed); for (let k = 0; k < 5; k++) box(0.08, 0.6, 0.06, mat('#9a3530'), s * 0.98, 0.39, 0.2 + k * (bl - 0.4) / 4, bed); });
  box(1.9, 0.82, 0.06, RED, 0, 0.49, bl, bed); box(1.94, 0.06, 0.1, T.green, 0, 0.92, bl, bed);   // front wall (taller)
  box(1.86, 0.6, 0.06, RED, 0, 0.38, 0.03, bed);                                                    // tailgate
  const load = box(1.8, 0.5, bl - 0.12, mat('#c9a43a'), 0, 0.08, bl / 2, bed); load.geometry.translate(0, 0.25, 0); load.position.y = 0.08; load.userData.noOutline = true;
  box(0.12, 0.08, 0.06, mat('#ff3b2b', { emissive: lin('#ff3b2b'), emissiveIntensity: 0.4 }), 0.75, 0.15, -0.02, bed); box(0.12, 0.08, 0.06, mat('#ff3b2b', { emissive: lin('#ff3b2b'), emissiveIntensity: 0.4 }), -0.75, 0.15, -0.02, bed);
  [-0.5, 0.5].forEach((x) => cylX(0.05, 0.12, 8, T.steel, x, 0.0, 0.0, bed));                     // hinge pins
  // hydraulic ram from the chassis to the bed front (stretches as the bed tips)
  const ram = cyl(0.05, 1, 8, T.steel, 0, 0, 0, root); ram.userData.noOutline = true;
  const ramBase = new V(0, Y, L0 - 0.35), ramTop = new V(0, 0.08, bl - 0.25);
  bake(root, [bed, ram, ...wheels]); bake(bed, [load]);
  const tmp = new V(), q = new THREE.Quaternion();
  return {
    root, bed, load, wheels, towed: true, axleBack: 3.18, liftUp: 0,
    set(tip, fill) {
      bed.rotation.x = -tip * 0.85; load.visible = fill > 0.01; load.scale.y = Math.max(0.02, fill);
      bed.updateMatrix(); tmp.copy(ramTop).applyMatrix4(bed.matrix);
      const d = tmp.clone().sub(ramBase); ram.position.copy(ramBase).addScaledVector(d, 0.5); ram.scale.y = d.length(); q.setFromUnitVectors(new V(0, 1, 0), d.normalize()); ram.quaternion.copy(q);
    }
  };
}
