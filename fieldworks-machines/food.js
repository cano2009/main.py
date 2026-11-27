// Fieldworks food production machines (low-poly): stone mill, tunnel oven and crate bagger. Items flow along +x
// through the chain; the belt top is at 0.8 m like the processing line. three.js r147.

import * as THREE from 'three';
import { bake } from './lowpoly.js';

const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
function mat(hex, o) { const k = hex + JSON.stringify(o || {}); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.75, metalness: 0.05, flatShading: false }, o || {})); m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m); } return mats.get(k); }
const F = { green: mat('#3f7d4c'), greenD: mat('#2f5a3b'), yellow: mat('#e9b830'), steel: mat('#a3a9ad', { metalness: 0.3, roughness: 0.5 }), steelD: mat('#6f767b'), dark: mat('#3c3f42'), stone: mat('#b7b0a4'), stoneD: mat('#9a9387'), brick: mat('#b5553c'), cream: mat('#e9e4d6'), wood: mat('#9a7a52'), black: mat('#1d1f1f') };
function put(p, m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (p) p.add(m); return m; }
const box = (w, h, d, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
const cyl = (r, h, seg, m, x, y, z, p, r2) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r2 === undefined ? r : r2, h, seg || 8), m), x, y, z);
const cylX = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateZ(Math.PI / 2), m), x, y, z);
const cylZ = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateX(Math.PI / 2), m), x, y, z);

/** Stone mill: grain hopper on top, two millstones in a timber frame (the runner stone turns), flour spout. */
export function mill() {
  const root = new THREE.Group(); root.name = 'Stone mill'; root.userData.pick = 'chain';
  box(1.4, 0.15, 1.4, F.stoneD, 0, 0.075, 0, root);
  [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([x, z]) => box(0.14, 2.3, 0.14, F.wood, x, 1.2, z, root));
  [-0.6, 0.6].forEach((z) => box(1.34, 0.12, 0.14, F.wood, 0, 2.3, z, root));
  [-0.6, 0.6].forEach((x) => box(0.14, 0.12, 1.34, F.wood, x, 2.3, 0, root));
  box(1.1, 0.6, 1.1, F.green, 0, 0.5, 0, root);                                    // housing
  cyl(0.5, 0.18, 12, F.stone, 0, 0.89, 0, root);                                   // bed stone
  const runner = new THREE.Group(); runner.position.y = 1.07; root.add(runner);
  cyl(0.5, 0.18, 12, F.stone, 0, 0, 0, runner); cyl(0.12, 0.2, 8, F.stoneD, 0, 0.02, 0, runner);
  for (let k = 0; k < 3; k++) { const g = box(0.9, 0.02, 0.05, F.stoneD, 0, 0.095, 0, runner); g.rotation.y = k * 1.047; }
  // hopper and shoe
  put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.12, 0.6, 4, 1).rotateY(Math.PI / 4), F.yellow), 0, 1.75, 0);
  box(0.5, 0.06, 0.5, F.yellow, 0, 2.06, 0, root);
  cyl(0.05, 0.4, 6, F.steel, 0, 1.35, 0, root);
  // drive: motor and belt guard on the back
  cylX(0.16, 0.4, 10, F.green, 0, 0.45, -0.75, root); box(0.3, 0.3, 0.2, F.greenD, 0.3, 0.45, -0.75, root);
  box(0.7, 0.14, 0.3, F.steelD, 0.1, 0.24, -0.68, root);   // motor mount bolted to the housing
  // flour spout to the belt (+x side)
  const sp = box(0.5, 0.08, 0.22, F.steel, 0.72, 0.72, 0, root); sp.rotation.z = -0.35;
  bake(root, [runner]);
  return { root, runner, outAt: new V(0.95, 0.8, 0) };
}
/** Tunnel oven: brick body with a steel belt through it, glowing mouth, chimney and control panel. */
export function oven(len) {
  len = len || 1.7;
  const root = new THREE.Group(); root.name = 'Tunnel oven'; root.userData.pick = 'chain';
  box(len, 0.78, 1.2, F.brick, 0, 0.39, 0, root);
  [-1, 1].forEach((s) => box(len, 0.66, 0.25, F.brick, 0, 1.1, s * 0.48, root));
  box(len + 0.1, 0.25, 1.24, F.brick, 0, 1.55, 0, root);
  box(len + 0.16, 0.08, 1.3, F.dark, 0, 1.71, 0, root);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x220a04, emissive: lin('#ff6a1a'), emissiveIntensity: 0.3 }); glowMat.userData.lowpoly = true;
  const mouths = [-1, 1].map((s) => { const m = box(0.02, 0.55, 0.7, glowMat, s * (len / 2 + 0.005), 1.12, 0, root); m.userData.noOutline = true; return m; });
  box(len, 0.03, 0.72, F.steel, 0, 0.81, 0, root);
  cyl(0.14, 1.0, 8, F.dark, -len / 2 + 0.3, 2.2, -0.3, root); cyl(0.18, 0.08, 8, F.dark, -len / 2 + 0.3, 2.74, -0.3, root);
  box(0.4, 0.45, 0.1, F.cream, len / 2 - 0.35, 1.1, 0.65, root); box(0.26, 0.14, 0.01, mat('#123326'), len / 2 - 0.35, 1.2, 0.705, root);
  const dial = cyl(0.05, 0.03, 10, F.red || F.yellow, len / 2 - 0.42, 0.98, 0.715, root); dial.rotation.x = Math.PI / 2;
  bake(root, mouths);
  return { root, mouths };
}
/** Crate bagger: a frame with a lid press that closes each crate, and a crate magazine. */
export function bagger() {
  const root = new THREE.Group(); root.name = 'Crate bagger'; root.userData.pick = 'chain';
  box(1.0, 0.75, 1.0, F.steel, 0, 0.375, 0, root);
  [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].forEach(([x, z]) => box(0.08, 1.6, 0.08, F.yellow, x, 1.55, z, root));
  box(1.0, 0.12, 1.0, F.yellow, 0, 2.35, 0, root);
  const press = new THREE.Group(); press.position.y = 1.9; root.add(press);
  box(0.7, 0.1, 0.6, F.dark, 0, 0, 0, press); cyl(0.05, 0.5, 6, F.steel, 0, 0.3, 0, press);
  box(0.6, 0.3, 0.45, mat('#a26b35'), 0, 0.9, 0, root);                              // the open crate being filled
  // crate magazine beside it
  for (let k = 0; k < 5; k++) box(0.55, 0.06, 0.42, mat('#a26b35'), 0, 0.82 + k * 0.07, -0.85, root);
  box(0.65, 0.78, 0.5, F.steelD, 0, 0.39, -0.85, root);
  bake(root, [press]);
  return { root, press };
}
