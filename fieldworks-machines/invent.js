// Fieldworks original machines (low-poly, in the Fieldworks colours):
//  - Bio-recovery digester: an inclined auger from the sorter's reject tote, a twin-shaft shredder, a heated digester
//    tank with a gas membrane that swells with biogas, a biogas engine, a safety flare and a live screen.
//  - Soil steward: a field-edge station with a scanning mast, a weather head, a digestate tank, a console and a
//    rover dock with a charger and a swinging fill spout.
//  - Straddle rover: a high-clearance four-leg field robot that rides over the rows, with a soil probe that drives
//    into the ground, a dosing boom that lowers to the crop, a digestate tank and a spinning lidar.
//  - Logic controller: a rule cabinet with a glass door, controller modules with blinking lights and a screen.
// Every builder returns { root, ...moving parts and anchors }. Units are metres. three.js r147.

import * as THREE from 'three';
import { bake } from './lowpoly.js';
import { screen } from './yard.js';

const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
function mat(hex, o) { const k = hex + JSON.stringify(o || {}); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.05, flatShading: true }, o || {})); m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m); } return mats.get(k); }
export const M = {
  green: mat('#3f7d4c'), greenD: mat('#2f5a3b'), yellow: mat('#e9b830'), yellowD: mat('#c99a22'), cream: mat('#e6e0cf'), creamD: mat('#cfc7b2'),
  steel: mat('#a3a9ad', { metalness: 0.3, roughness: 0.5 }), steelD: mat('#6f767b', { metalness: 0.3, roughness: 0.55 }), dark: mat('#33363a'), black: mat('#1b1c1e'),
  concrete: mat('#c4beb2', { roughness: 0.95 }), red: mat('#c94232'), blue: mat('#2c4f7c', { roughness: 0.3, metalness: 0.3 }), tire: mat('#232427', { roughness: 0.95 }),
  dome: mat('#d9cfa8', { roughness: 0.55 }), brown: mat('#6b4a2a'), lens: mat('#1e3550', { roughness: 0.1, metalness: 0.4 }),
  glass: Object.assign(new THREE.MeshStandardMaterial({ color: lin('#cfe6ee'), roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false }), { userData: { lowpoly: true } })
};
const glowMat = (hex, i) => { const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: lin(hex), emissiveIntensity: i === undefined ? 2 : i }); m.userData.lowpoly = true; return m; };
function put(p, m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (p) p.add(m); return m; }
const box = (w, h, d, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
const cyl = (r, h, seg, m, x, y, z, p, r2) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r2 === undefined ? r : r2, h, seg || 8), m), x, y, z);
const cylX = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateZ(Math.PI / 2), m), x, y, z);
const cylZ = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateX(Math.PI / 2), m), x, y, z);
function strut(p, a, b, t, m, round) {
  const d = b.clone().sub(a), len = d.length();
  const g = round ? new THREE.CylinderGeometry(t, t, len, 8).rotateX(Math.PI / 2) : new THREE.BoxGeometry(t, t, len);
  const mm = new THREE.Matrix4().lookAt(new V(), d, Math.abs(d.y / len) > 0.98 ? new V(1, 0, 0) : new V(0, 1, 0)); mm.setPosition(a.clone().add(b).multiplyScalar(0.5));
  return put(p, new THREE.Mesh(g.applyMatrix4(mm), m));
}
function pipe(p, pts, r, m) { const c = new THREE.CatmullRomCurve3(pts.map((q) => (q.isVector3 ? q : new V(...q))), false, 'centripetal', 0.2); return put(p, new THREE.Mesh(new THREE.TubeGeometry(c, pts.length * 10, r, 8, false), m)); }
const bolt = (p, x, y, z, axis) => (axis === 'x' ? cylX : axis === 'y' ? (r, l, s, m, X, Y, Z, P) => cyl(r, l, s, m, X, Y, Z, P) : cylZ)(0.02, 0.025, 6, M.steelD, x, y, z, p);

// ---------------------------------------------------------------------------
/** Bio-recovery digester. Origin at the plinth centre, length along x. foot: local point of the auger's foot
 *  (inside the sorter's reject tote). Returns rotors (spin about z), auger (spin), dome (scale y with gas), flame. */
export function digester(foot) {
  const root = new THREE.Group(); root.name = 'Bio-recovery digester'; root.userData.pick = 'digester';
  const PY = 0.16;
  box(3.0, PY, 1.9, M.concrete, 0, PY / 2, 0, root);
  box(3.04, 0.03, 1.94, M.creamD, 0, PY + 0.005, 0, root);
  // digester tank with steel bands, a sight glass and a gas membrane dome
  const TX = -0.55, TR = 0.78, TH = 1.3;
  cyl(TR, TH, 20, M.green, TX, PY + TH / 2, 0, root);
  [0.3, 0.7, 1.1].forEach((y) => cyl(TR + 0.025, 0.05, 20, M.steel, TX, PY + y, 0, root));
  cyl(TR + 0.04, 0.08, 20, M.steelD, TX, PY + TH, 0, root);
  const dome = new THREE.Group(); dome.position.set(TX, PY + TH + 0.03, 0); root.add(dome);
  put(dome, new THREE.Mesh(new THREE.SphereGeometry(TR - 0.02, 18, 12), M.dome));   // closed membrane; its lower half sits inside the tank
  dome.scale.y = 0.55;
  cyl(0.08, 0.1, 8, M.steelD, TX, PY + TH + 0.3, 0, root);   // gas take-off on the crown (the dome rises around it)
  box(0.07, 0.5, 0.03, M.lens, TX + 0.2, PY + 0.75, TR - 0.02, root);   // sight glass
  [-1, 1].forEach((s) => box(0.03, 0.56, 0.05, M.steelD, TX + 0.2 + s * 0.05, PY + 0.75, TR - 0.01, root));
  // ladder on the north face with standoff brackets
  const LZ = -TR - 0.08;
  [-0.18, 0.18].forEach((dx) => { box(0.04, TH + 0.35, 0.04, M.yellow, TX + dx, PY + (TH + 0.35) / 2, LZ, root); [0.25, 1.05].forEach((y) => box(0.04, 0.04, 0.14, M.steelD, TX + dx, PY + y, LZ + 0.06, root)); });
  for (let k = 0; k < 6; k++) box(0.36, 0.03, 0.03, M.yellow, TX, PY + 0.2 + k * 0.24, LZ, root);
  // mixer motor on the west side
  box(0.26, 0.34, 0.3, M.yellowD, TX - TR - 0.08, PY + 0.75, 0, root); cylX(0.1, 0.2, 10, M.dark, TX - TR - 0.25, PY + 0.75, 0, root);
  // twin-shaft shredder on a frame, with a tapered hopper; a short screw feeds the tank
  const SX = 0.75, SZ = 0.45;
  [-1, 1].forEach((a) => [-1, 1].forEach((b) => box(0.08, 0.52, 0.08, M.steelD, SX + a * 0.27, PY + 0.26, SZ + b * 0.27, root)));
  box(0.66, 0.08, 0.66, M.steelD, SX, PY + 0.52, SZ, root);
  box(0.66, 0.4, 0.66, M.yellow, SX, PY + 0.76, SZ, root);
  box(0.7, 0.05, 0.7, M.dark, SX, PY + 0.98, SZ, root);
  const hop = put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.33, 0.36, 4, 1, true).rotateY(Math.PI / 4), mat('#a3a9ad', { metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide })), SX, PY + 1.18, SZ);
  hop.userData.openOk = true;
  const rotors = [-0.1, 0.1].map((dx) => { const g = new THREE.Group(); g.position.set(SX + dx, PY + 1.04, SZ); root.add(g); cylZ(0.045, 0.6, 8, M.steel, 0, 0, 0, g); for (let k = 0; k < 5; k++) { const t = box(0.17, 0.035, 0.04, M.dark, 0, 0, -0.24 + k * 0.12, g); t.rotation.z = k * 1.2; } return g; });
  box(0.12, 0.2, 0.2, M.dark, SX + 0.37, PY + 0.76, SZ, root);   // shredder gearbox
  cylX(0.08, 0.3, 10, M.steelD, 0.3, PY + 0.7, SZ * 0.4, root);   // screw from the shredder into the tank
  // biogas engine in its enclosure, with a radiator, an exhaust stack and a screen
  const EX = 0.95, EZ = -0.5;
  box(0.9, 0.7, 0.62, M.green, EX, PY + 0.35, EZ, root);
  box(0.94, 0.05, 0.66, M.greenD, EX, PY + 0.72, EZ, root);
  for (let k = 0; k < 6; k++) box(0.02, 0.4, 0.5, M.dark, EX + 0.46, PY + 0.38, EZ - 0.2 + k * 0.08 - 0.0, root).scale.set(1, 1, 0.12);
  box(0.03, 0.44, 0.52, M.steelD, EX + 0.455, PY + 0.38, EZ, root);
  [-1, 1].forEach((s) => { box(0.3, 0.02, 0.02, M.steel, EX - 0.2, PY + 0.55, EZ + s * 0.312, root); });
  cyl(0.06, 0.8, 8, M.steelD, EX - 0.25, PY + 1.1, EZ - 0.12, root); cyl(0.075, 0.08, 8, M.dark, EX - 0.25, PY + 1.5, EZ - 0.12, root);
  // gas line from the crown down to the engine and a branch to the flare
  pipe(root, [[TX, PY + TH + 0.35, 0], [TX + 0.4, PY + TH + 0.35, -0.25], [EX - 0.05, PY + 0.95, EZ], [EX - 0.05, PY + 0.74, EZ]], 0.035, M.yellowD);
  const FX = -1.32, FZ = -0.72;
  cyl(0.05, 2.3, 8, M.steelD, FX, PY + 1.15, FZ, root); cyl(0.09, 0.12, 8, M.dark, FX, PY + 2.3, FZ, root); box(0.3, 0.04, 0.3, M.steelD, FX, PY + 0.02, FZ, root);
  pipe(root, [[TX - 0.1, PY + TH + 0.32, 0.05], [TX - 0.5, PY + TH + 0.32, -0.35], [FX, PY + 1.5, FZ], [FX, PY + 1.3, FZ]], 0.028, M.yellowD);
  const flame = put(root, new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 6), glowMat('#ff8a2a', 3)), FX, PY + 2.52, FZ); flame.userData.noOutline = true; flame.visible = false;
  // digestate outlet stub with a valve on the north side, low
  cylZ(0.06, 0.25, 10, M.steelD, TX + 0.45, PY + 0.2, -TR + 0.02, root); box(0.12, 0.14, 0.08, M.red, TX + 0.45, PY + 0.32, -TR - 0.04, root);
  // inclined auger from the reject tote up to the hopper, with its drive at the head
  const head = new V(SX, PY + 1.55, SZ), ft = foot ? foot.clone() : new V(1.48, 0.35, 1.55), dir = head.clone().sub(ft).normalize();
  strut(root, ft, head, 0.075, M.steelD, true);
  const auger = new THREE.Group(); auger.position.copy(ft.clone().add(head).multiplyScalar(0.5)); auger.quaternion.setFromUnitVectors(new V(0, 1, 0), dir); root.add(auger);
  const AL = ft.distanceTo(head);
  for (let k = 0; k < 10; k++) { const f = box(0.17, 0.02, 0.06, M.yellowD, 0, -AL / 2 + 0.12 + k * (AL - 0.24) / 9, 0, auger); f.rotation.y = k * 0.9; }
  box(0.18, 0.16, 0.22, M.dark, head.x, head.y + 0.06, head.z, root);
  strut(root, new V(head.x, head.y - 0.06, head.z), new V(SX, PY + 1.18, SZ), 0.06, M.steel, true);   // head drops into the hopper
  // stand under the auger's middle, on the plinth edge
  const mid = ft.clone().lerp(head, 0.45); strut(root, new V(mid.x, PY, Math.min(mid.z, 0.9)), mid, 0.045, M.steelD); box(0.14, 0.03, 0.14, M.steelD, mid.x, PY + 0.015, Math.min(mid.z, 0.9), root);
  // live screen on the engine enclosure's south face
  const scr = screen(0.42, 0.26, 256, root, EX, PY + 0.4, EZ - 0.322);
  scr.mesh.rotation.y = Math.PI; box(0.46, 0.3, 0.02, M.dark, EX, PY + 0.4, EZ - 0.312, root);
  const lamp = box(0.06, 0.06, 0.06, glowMat('#3fd27a', 1.5), EX + 0.35, PY + 0.76, EZ - 0.2, root); lamp.userData.noOutline = true;
  bake(root, [dome, auger, ...rotors, flame, scr.mesh, lamp]);
  return { root, dome, rotors, auger, flame, screen: scr, lamp, ledAt: new V(EX + 0.35, PY + 0.8, EZ - 0.2) };
}

// ---------------------------------------------------------------------------
/** Soil steward station. Origin at the pad centre; the rover dock is at dockAt (local). Returns scanner (spins about
 *  y), cups (anemometer), spout (fill arm valve), screen, tankFill (scale y), beacon position. */
export function steward() {
  const root = new THREE.Group(); root.name = 'Soil steward'; root.userData.pick = 'steward';
  const PY = 0.15, dockAt = new V(-0.9, 0, 2.6);
  box(2.6, PY, 2.2, M.concrete, 0, PY / 2, 0, root);
  box(0.7, 0.1, 0.9, M.concrete, dockAt.x, 0.05, 1.45, root);
  // rover dock: grating, guide rails and wheel stops
  box(1.7, 0.05, 1.6, M.steelD, dockAt.x, 0.025, dockAt.z, root);
  for (let k = 0; k < 7; k++) box(1.66, 0.012, 0.03, M.dark, dockAt.x, 0.055, dockAt.z - 0.7 + k * 0.233, root);
  [-1, 1].forEach((s) => { box(1.5, 0.1, 0.07, M.yellow, dockAt.x, 0.1, dockAt.z + s * 0.78, root); box(0.1, 0.12, 0.2, M.yellowD, dockAt.x + 0.8, 0.06, dockAt.z + s * 0.55, root); });
  // charger post with contact arm, which also carries the fill arm
  const PX = dockAt.x + 1.05;
  box(0.26, 2.5, 0.26, M.green, PX, 1.25, dockAt.z, root); box(0.32, 0.06, 0.32, M.greenD, PX, 2.51, dockAt.z, root); box(0.36, 0.08, 0.36, M.steelD, PX, 0.04, dockAt.z, root);
  box(0.36, 0.08, 0.12, M.dark, PX - 0.3, 0.55, dockAt.z, root); [-1, 1].forEach((s) => box(0.05, 0.05, 0.05, M.yellow, PX - 0.49, 0.55, dockAt.z + s * 0.03, root));
  // cabinet with the console, keypad and status beacon (console faces the field, -x)
  const CX = -0.55, CZ = -0.5;
  box(0.95, 1.5, 0.6, M.green, CX, PY + 0.75, CZ, root);
  box(1.05, 0.06, 0.7, M.greenD, CX, PY + 1.53, CZ, root);
  box(0.02, 1.3, 0.5, M.greenD, CX - 0.48, PY + 0.72, CZ, root);
  const scr = screen(0.46, 0.32, 256, root, CX - 0.5, PY + 1.12, CZ); scr.mesh.rotation.y = -Math.PI / 2;
  box(0.02, 0.36, 0.5, M.dark, CX - 0.492, PY + 1.12, CZ, root);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) box(0.02, 0.05, 0.06, M.cream, CX - 0.495, PY + 0.7 + a * 0.08, CZ - 0.09 + b * 0.09, root);
  box(0.04, 0.12, 0.03, M.steel, CX - 0.5, PY + 0.45, CZ + 0.18, root);
  cyl(0.07, 0.06, 8, M.dark, CX + 0.3, PY + 1.59, CZ + 0.15, root);
  for (let k = 0; k < 4; k++) box(0.02, 0.06, 0.4, M.greenD, CX + 0.476, PY + 0.4 + k * 0.1, CZ, root);   // louvres on the back
  // scanning mast: three-leg lattice with a platform, a rotating scanner head and a weather head
  const MX = 0.6, MZ = -0.5, MH = 3.6, legs = [0, 1, 2].map((i) => { const a = i / 3 * Math.PI * 2 + 0.3; return [Math.cos(a) * 0.22, Math.sin(a) * 0.22]; });
  legs.forEach(([x, z], i) => {
    box(0.05, MH, 0.05, M.steelD, MX + x, PY + MH / 2, MZ + z, root);
    const [x2, z2] = legs[(i + 1) % 3];
    for (let k = 0; k < 5; k++) { strut(root, new V(MX + x, PY + 0.1 + k * 0.7, MZ + z), new V(MX + x2, PY + 0.45 + k * 0.7, MZ + z2), 0.025, M.steel); strut(root, new V(MX + x, PY + 0.45 + k * 0.7, MZ + z), new V(MX + x2, PY + 0.8 + k * 0.7 > PY + MH ? PY + MH - 0.02 : PY + 0.8 + k * 0.7, MZ + z2), 0.025, M.steel); }
  });
  box(0.7, 0.05, 0.7, M.steelD, MX, PY + MH, MZ, root);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; box(k % 2 ? 0.03 : 0.7, 0.2, k % 2 ? 0.7 : 0.03, M.yellow, MX + Math.cos(a) * 0.34, PY + MH + 0.12, MZ + Math.sin(a) * 0.34, root); }
  const scanner = new THREE.Group(); scanner.position.set(MX, PY + MH + 0.03, MZ); root.add(scanner);
  cyl(0.08, 0.3, 8, M.dark, 0, 0.15, 0, scanner); box(0.5, 0.16, 0.22, M.cream, 0, 0.38, 0, scanner);
  const dish = put(scanner, new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.08, 12).rotateZ(Math.PI / 2), M.creamD)); dish.position.set(0.29, 0.38, 0);
  cyl(0.03, 0.1, 6, M.dark, 0.36, 0.38, 0, scanner).rotation.z = Math.PI / 2;
  const sweep = box(0.02, 0.05, 0.18, glowMat('#58e0ff', 2.5), 0.335, 0.38, 0, scanner); sweep.userData.noOutline = true;
  box(0.42, 0.02, 0.06, M.lens, -0.05, 0.47, 0, scanner);
  // weather head on a side boom: anemometer cups and a rain gauge
  box(0.7, 0.04, 0.04, M.steel, MX - 0.45, PY + MH - 0.4, MZ, root); cyl(0.02, 0.35, 6, M.steel, MX - 0.78, PY + MH - 0.22, MZ, root);
  const cups = new THREE.Group(); cups.position.set(MX - 0.78, PY + MH - 0.03, MZ); root.add(cups);
  cyl(0.02, 0.06, 6, M.dark, 0, 0, 0, cups); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; box(0.18, 0.012, 0.012, M.steel, Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09, cups).rotation.y = -a; const cup = put(cups, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 6).rotateZ(Math.PI / 2), M.cream)); cup.position.set(Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18); cup.rotation.y = -a + Math.PI / 2; }
  cyl(0.05, 0.12, 8, M.cream, MX - 0.12, PY + MH - 0.32, MZ, root);
  // digestate tank on a ring stand, with a level gauge, inlet flange and the fill arm over the dock
  const TX = 0.6, TZ = 0.55, TR = 0.42, TH = 1.25;
  cyl(TR + 0.03, 0.2, 14, M.steelD, TX, PY + 0.1, TZ, root);
  cyl(TR, TH, 16, M.cream, TX, PY + 0.2 + TH / 2, TZ, root);
  put(root, new THREE.Mesh(new THREE.SphereGeometry(TR, 14, 10), M.cream)).position.set(TX, PY + 0.2 + TH, TZ);
  cyl(0.09, 0.08, 8, M.steelD, TX, PY + 0.2 + TH + TR - 0.02, TZ, root);
  box(0.05, TH - 0.2, 0.04, M.dark, TX - TR - 0.01, PY + 0.2 + TH / 2, TZ, root);
  const tankFill = box(0.035, TH - 0.24, 0.045, glowMat('#c58a3a', 0.9), TX - TR - 0.025, PY + 0.32, TZ, root); tankFill.geometry.translate(0, (TH - 0.24) / 2, 0); tankFill.userData.noOutline = true;
  cylX(0.055, 0.2, 10, M.steelD, TX + TR + 0.06, PY + 0.35, TZ, root);
  const armY = 2.45;
  pipe(root, [[TX, PY + 0.2 + TH + TR - 0.02, TZ], [TX, armY, TZ], [TX, armY, dockAt.z - 0.25], [TX - 0.25, armY, dockAt.z], [dockAt.x + 0.2, armY, dockAt.z], [dockAt.x, armY - 0.05, dockAt.z]], 0.04, M.steelD);
  const spout = new THREE.Group(); spout.position.set(dockAt.x, armY - 0.05, dockAt.z); root.add(spout);
  cyl(0.035, 0.22, 8, M.steelD, 0, -0.1, 0, spout); box(0.1, 0.08, 0.1, M.red, 0, 0.0, 0, spout);
  box(0.12, 0.12, 0.12, M.steelD, PX - 0.06, armY, dockAt.z, root);   // arm clamp on the charger post
  const beaconAt = new V(CX + 0.3, PY + 1.62, CZ + 0.15);
  bake(root, [scanner, cups, spout, scr.mesh, tankFill, sweep]);
  return { root, scanner, cups, spout, screen: scr, tankFill, beaconAt, dockAt };
}

// ---------------------------------------------------------------------------
/** Straddle rover. Origin on the ground between the wheels; faces +z. Returns wheels (spin about x), lidar (spin y),
 *  probe (move y: 0 up, -0.9 down), boom (move y), spray (show when dosing), tank fill (scale y), screen. */
export function rover() {
  const root = new THREE.Group(); root.name = 'Field rover'; root.userData.pick = 'steward';
  const TX = 0.52, TZ = 0.56, WR = 0.2, FY = 1.36;
  const wheels = [];
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    const x = sx * TX, z = sz * TZ;
    // leg: a tapered column down to the hub fork
    box(0.09, FY - WR - 0.05, 0.12, M.green, x, WR + 0.05 + (FY - WR - 0.05) / 2, z, root);
    box(0.13, 0.08, 0.16, M.greenD, x, FY - 0.08, z, root);
    box(0.04, 0.24, 0.12, M.steelD, x - sx * 0.1, WR + 0.08, z, root);
    box(0.2, 0.06, 0.12, M.steelD, x - sx * 0.03, WR + 0.18, z, root);
    cylX(0.04, 0.18, 8, M.steel, x - sx * 0.06, WR, z, root);
    const w = new THREE.Group(); w.position.set(x + sx * 0.04, WR, z); root.add(w);
    cylX(WR, 0.11, 14, M.tire, 0, 0, 0, w); cylX(WR * 0.6, 0.12, 10, M.yellow, 0, 0, 0, w); cylX(WR * 0.2, 0.14, 6, M.dark, 0, 0, 0, w);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; box(0.1, 0.03, 0.04, M.tire, 0, Math.cos(a) * (WR + 0.005), Math.sin(a) * (WR + 0.005), w).rotation.x = -a; }
    wheels.push(w);
  }));
  // side frames: a cross brace between the front and back legs on each side, clear of the crop rows
  [-1, 1].forEach((sx) => { strut(root, new V(sx * TX, 0.75, -TZ), new V(sx * TX, FY - 0.1, TZ), 0.045, M.greenD); strut(root, new V(sx * TX, 0.75, TZ), new V(sx * TX, FY - 0.1, -TZ), 0.045, M.greenD); box(0.06, 0.06, TZ * 2, M.steelD, sx * TX, 0.75, 0, root); });
  // top frame and body pod
  box(TX * 2 + 0.16, 0.1, TZ * 2 + 0.2, M.steelD, 0, FY, 0, root);
  [-1, 1].forEach((s) => box(TX * 2 + 0.16, 0.12, 0.06, M.yellow, 0, FY + 0.02, s * (TZ + 0.1), root));
  box(0.72, 0.3, 0.92, M.green, 0, FY + 0.2, 0, root);
  box(0.76, 0.05, 0.96, M.greenD, 0, FY + 0.36, 0, root);
  // sensor head at the front, with a camera lens, lamps and a lidar puck that spins
  box(0.5, 0.2, 0.16, M.dark, 0, FY + 0.18, 0.52, root);
  cylZ(0.06, 0.04, 10, M.lens, -0.12, FY + 0.18, 0.61, root); cylZ(0.06, 0.04, 10, M.lens, 0.12, FY + 0.18, 0.61, root);
  const lamps = [-0.2, 0.2].map((x) => { const m = box(0.06, 0.04, 0.02, glowMat('#fff2d0', 0), x, FY + 0.06, 0.6, root); m.userData.noOutline = true; return m; });
  cyl(0.05, 0.08, 8, M.dark, 0, FY + 0.42, 0.3, root);
  const lidar = new THREE.Group(); lidar.position.set(0, FY + 0.5, 0.3); root.add(lidar);
  cyl(0.08, 0.08, 10, M.black, 0, 0, 0, lidar); box(0.04, 0.03, 0.02, glowMat('#58e0ff', 2), 0, 0.01, 0.08, lidar).userData.noOutline = true;
  // digestate tank (lies along z) with a fill neck under the station's spout
  cylZ(0.21, 0.66, 14, M.cream, 0, FY + 0.6, -0.12, root);
  [-0.4, 0.17].forEach((z) => box(0.48, 0.1, 0.05, M.steelD, 0, FY + 0.43, z, root));
  cyl(0.06, 0.12, 8, M.steelD, 0, FY + 0.84, -0.12, root);
  const tankFill = box(0.03, 0.34, 0.02, glowMat('#c58a3a', 0.9), 0.212, FY + 0.43, -0.12, root); tankFill.geometry.translate(0, 0.17, 0); tankFill.userData.noOutline = true;
  // solar skin and antenna on the back
  box(0.7, 0.03, 0.3, M.blue, 0, FY + 0.4, -0.38, root); cyl(0.01, 0.4, 4, M.dark, 0.3, FY + 0.58, -0.42, root);
  // soil probe: a housing under the frame and a rod that drives down into the ground
  box(0.16, 0.24, 0.16, M.yellowD, 0, FY - 0.17, -0.1, root);
  const probe = new THREE.Group(); probe.position.set(0, 0, -0.1); root.add(probe);
  cyl(0.025, 0.95, 8, M.steel, 0, FY - 0.6, 0, probe); cyl(0.015, 0.08, 6, M.dark, 0, FY - 1.11, 0, probe, 0.002);
  // dosing boom: slides on two guide tubes under the front of the frame; nozzles spray when it is down
  [-0.32, 0.32].forEach((x) => cyl(0.025, FY - 0.45, 8, M.steel, x, 0.45 + (FY - 0.45) / 2, 0.45, root));
  const boom = new THREE.Group(); boom.position.set(0, FY - 0.15, 0.45); root.add(boom);
  box(1.0, 0.06, 0.06, M.yellow, 0, 0, 0, boom); [-0.32, 0.32].forEach((x) => box(0.08, 0.1, 0.08, M.dark, x, 0, 0, boom));
  const spray = [];
  [-0.45, -0.15, 0.15, 0.45].forEach((x) => { cyl(0.02, 0.06, 6, M.dark, x, -0.05, 0, boom); const s = put(boom, new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6, 1, true), Object.assign(new THREE.MeshStandardMaterial({ color: lin('#8a6a3a'), transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }), { userData: { lowpoly: true } })), x, -0.24, 0); s.userData.noOutline = true; s.visible = false; spray.push(s); });
  const scr = screen(0.3, 0.14, 192, root, 0, FY + 0.22, -0.465); scr.mesh.rotation.y = Math.PI;
  box(0.34, 0.18, 0.02, M.dark, 0, FY + 0.22, -0.455, root);
  cyl(0.05, 0.05, 8, M.dark, -0.28, FY + 0.405, 0.3, root);   // beacon base
  const beaconAt = new V(-0.28, FY + 0.43, 0.3);
  bake(root, [...wheels, lidar, probe, boom, scr.mesh, tankFill, ...lamps]);
  return { root, wheels, lidar, probe, boom, spray, tankFill, screen: scr, lamps, beaconAt, wheelR: WR };
}

// ---------------------------------------------------------------------------
/** Logic controller cabinet. Origin at the plinth centre, door faces +z. Returns leds (emissive meshes), screen. */
export function controller() {
  const root = new THREE.Group(); root.name = 'Logic controller'; root.userData.pick = 'logic';
  box(0.95, 0.12, 0.62, M.concrete, 0, 0.06, 0, root);
  box(0.8, 1.5, 0.42, mat('#c9ccc4', { roughness: 0.55 }), 0, 0.87, 0, root);
  box(0.92, 0.05, 0.56, M.greenD, 0, 1.645, 0.02, root);
  box(0.76, 1.42, 0.03, mat('#b9bcb4', { roughness: 0.55 }), 0, 0.87, 0.22, root);
  [-1, 1].forEach((s) => box(0.03, 0.08, 0.04, M.dark, 0.33, 0.95 + s * 0.45, 0.235, root));
  box(0.04, 0.16, 0.04, M.dark, 0.33, 0.9, 0.25, root);
  // window into the rule modules
  box(0.6, 0.5, 0.02, M.dark, -0.03, 0.82, 0.236, root);
  const glass = box(0.56, 0.46, 0.01, M.glass, -0.03, 0.82, 0.248, root); glass.userData.noOutline = true;
  box(0.52, 0.04, 0.03, M.steel, -0.03, 0.95, 0.25, root); box(0.52, 0.04, 0.03, M.steel, -0.03, 0.72, 0.25, root);
  const leds = [];
  for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
    box(0.07, 0.16, 0.05, k === 0 ? M.blue : M.cream, -0.25 + k * 0.088, 0.83 + (r ? -0.115 : 0.115) * 0.0 + (r ? -0.12 : 0.06), 0.24, root);
    const l = box(0.025, 0.025, 0.01, glowMat('#3fd27a', 0.3), -0.25 + k * 0.088, 0.88 + (r ? -0.12 : 0.06), 0.266, root); l.userData.noOutline = true; leds.push(l);
  }
  const scr = screen(0.5, 0.26, 256, root, -0.03, 1.32, 0.238); box(0.54, 0.3, 0.02, M.dark, -0.03, 1.32, 0.23, root);
  // cable tray and glands under the back
  box(0.7, 0.08, 0.12, M.steelD, 0, 0.2, -0.26, root);
  cyl(0.012, 0.35, 4, M.dark, -0.32, 1.84, -0.1, root); cyl(0.03, 0.04, 6, M.dark, -0.32, 1.67, -0.1, root);
  bake(root, [scr.mesh, ...leds]);
  return { root, leds, screen: scr, ledAt: new V(0.3, 1.7, 0.1) };
}
