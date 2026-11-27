// Fieldworks processing line: original low-poly machines in the Fieldworks colours (machinery green, safety yellow,
// brushed steel). Cleated conveyors on A-frame legs, a rotary drum washer, an optical sorter gantry with a brush
// diverter, a carton packing tower, a tapered harvest hopper, an output pallet, a stainless sink station and a
// drinks cooler. Items travel along -x; the belt top is at BELT_Y. Units are metres. three.js r147.

import * as THREE from 'three';
import { bake } from './lowpoly.js';

export const BELT_Y = 0.8;
const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
function mat(hex, o) {
  const k = hex + JSON.stringify(o || {});
  if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.78, metalness: 0, flatShading: true }, o || {})); m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m); }
  return mats.get(k);
}
export const L = {
  green: mat('#3f7d4c'), greenD: mat('#2f5a3b'), yellow: mat('#e9b830'), yellowD: mat('#c99a22'),
  steel: mat('#a3a9ad', { metalness: 0.25, roughness: 0.5 }), steelD: mat('#6f767b', { metalness: 0.25, roughness: 0.55 }), dark: mat('#3c3f42'),
  cream: mat('#e9e4d6'), rubber: mat('#34373a'), water: mat('#3fb6e8', { roughness: 0.3 }), red: mat('#c94232'),
  cardboard: mat('#c89a5c'), tape: mat('#e9d6a8'), wood: mat('#9a7a52'), woodD: mat('#755c3c'), black: mat('#1d1f1f'),
  glass: Object.assign(new THREE.MeshStandardMaterial({ color: lin('#cfe6ee'), roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }), { userData: { lowpoly: true } })
};
function put(p, m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (p) p.add(m); return m; }
const box = (w, h, d, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
const cyl = (r, h, seg, m, x, y, z, p, r2) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r2 === undefined ? r : r2, h, seg || 8), m), x, y, z);
const cylX = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateZ(Math.PI / 2), m), x, y, z);
const cylZ = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateX(Math.PI / 2), m), x, y, z);
function strut(p, a, b, t, m) {
  const d = b.clone().sub(a), g = new THREE.BoxGeometry(t, t, d.length());
  const mm = new THREE.Matrix4().lookAt(new V(), d, Math.abs(d.y / d.length()) > 0.98 ? new V(1, 0, 0) : new V(0, 1, 0)); mm.setPosition(a.clone().add(b).multiplyScalar(0.5));
  return put(p, new THREE.Mesh(g.applyMatrix4(mm), m));
}
function pipe(p, pts, r, m) { const c = new THREE.CatmullRomCurve3(pts.map((q) => new V(...q)), false, 'centripetal'); return put(p, new THREE.Mesh(new THREE.TubeGeometry(c, pts.length * 8, r, 6, false), m)); }
const rivet = (p, x, y, z) => cylZ(0.022, 0.02, 8, L.steel, x, y, z, p);

// cleated belt: dark rubber with straight raised cleats across it and a centre seam
let beltTex = null;
function beltTexture() {
  if (beltTex) return beltTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#34373a'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#2a2c2e'; x.fillRect(0, 58, 128, 12);
  x.fillStyle = '#6a6f72'; x.fillRect(54, 0, 9, 128);
  beltTex = new THREE.CanvasTexture(c); beltTex.encoding = THREE.sRGBEncoding; beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping; beltTex.anisotropy = 8;
  return beltTex;
}

// ---------------------------------------------------------------------------
/** conveyor(x0, x1): green channel frame with yellow lips, end rollers, A-frame legs and a drive motor at x0. */
export function conveyor(x0, x1) {
  const root = new THREE.Group(), len = x0 - x1, cx = (x0 + x1) / 2, W = 0.74;
  const tex = beltTexture().clone(); tex.needsUpdate = true; tex.repeat.set(len / 0.45, 1);
  const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, flatShading: true }); bm.userData.lowpoly = true;
  const belt = box(len, 0.04, W, bm, cx, BELT_Y - 0.02, 0, root);
  [-1, 1].forEach((s) => {
    const z = s * (W / 2 + 0.05);
    box(len + 0.1, 0.18, 0.07, L.green, cx, BELT_Y - 0.06, z, root);
    box(len + 0.1, 0.035, 0.11, L.yellow, cx, BELT_Y + 0.045, z, root);
    for (let x = x1 + 0.3; x < x0 - 0.1; x += 0.6) rivet(root, x, BELT_Y - 0.08, z + s * 0.04);
  });
  [x0 + 0.02, x1 - 0.02].forEach((x) => cylZ(0.07, W + 0.06, 10, L.steel, x, BELT_Y - 0.06, 0, root));
  // A-frame legs with a cross bar every 1.6 m
  const n = Math.max(2, Math.round(len / 1.6) + 1);
  for (let i = 0; i < n; i++) {
    const x = x1 + 0.25 + (len - 0.5) * i / (n - 1);
    [-1, 1].forEach((s) => {
      strut(root, new V(x - 0.18, 0.02, s * 0.44), new V(x, BELT_Y - 0.15, s * 0.36), 0.055, L.steelD);
      strut(root, new V(x + 0.18, 0.02, s * 0.44), new V(x, BELT_Y - 0.15, s * 0.36), 0.055, L.steelD);
      cyl(0.07, 0.03, 8, L.dark, x - 0.18, 0.015, s * 0.44, root); cyl(0.07, 0.03, 8, L.dark, x + 0.18, 0.015, s * 0.44, root);
    });
    box(0.05, 0.05, 0.8, L.steelD, x, 0.35, 0, root);
  }
  // drive: motor and gearbox under the head end
  cylX(0.1, 0.3, 10, L.green, x0 - 0.28, BELT_Y - 0.3, 0.3, root); box(0.16, 0.18, 0.16, L.greenD, x0 - 0.06, BELT_Y - 0.24, 0.3, root);
  bake(root, [belt]);
  return { root, belt, tex, move(d) { tex.offset.x += d / 0.45; } };
}

// ---------------------------------------------------------------------------
/** Rotary drum washer: a slatted drum on cradle rollers, spray bar with nozzles, back water tank with a sight glass. */
export function washer() {
  const root = new THREE.Group(); root.name = 'Drum washer'; root.userData.pick = 'line';
  const DY = BELT_Y + 0.22, R = 0.5, LEN = 1.4;
  // base frame and drip tray
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(0.09, DY - 0.2, 0.09, L.steelD, sx * 0.62, (DY - 0.2) / 2, sz * 0.6, root)));
  [-1, 1].forEach((sz) => box(1.34, 0.08, 0.09, L.steelD, 0, DY - 0.4, sz * 0.6, root));
  box(1.3, 0.06, 1.12, L.steel, 0, 0.32, 0, root); box(1.3, 0.12, 0.04, L.steel, 0, 0.38, 0.56, root); box(1.3, 0.12, 0.04, L.steel, 0, 0.38, -0.56, root);
  // cradle rollers the drum turns on
  [-0.5, 0.5].forEach((x) => [-1, 1].forEach((s) => { cylX(0.07, 0.12, 8, L.dark, x, DY - R + 0.02, s * 0.34, root); box(0.14, 0.1, 0.1, L.steelD, x, DY - R - 0.06, s * 0.34, root); }));
  // the drum (rotates about x)
  const drum = new THREE.Group(); drum.position.set(0, DY, 0); root.add(drum);
  put(drum, new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN, 10, 1, true).rotateZ(Math.PI / 2), L.green));
  put(drum, new THREE.Mesh(new THREE.CylinderGeometry(R - 0.04, R - 0.04, LEN - 0.02, 10, 1, true).rotateZ(Math.PI / 2), mat('#203a28', { side: THREE.BackSide })));
  for (let k = 0; k < 10; k++) { const a = (k + 0.5) / 10 * Math.PI * 2; const sl = box(LEN - 0.3, 0.03, 0.09, L.greenD, 0, Math.cos(a) * (R + 0.005), Math.sin(a) * (R + 0.005), drum); sl.rotation.x = -a; }
  [-LEN / 2, LEN / 2].forEach((x) => put(drum, new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.045, 5, 10).rotateY(Math.PI / 2), L.yellow), x, 0, 0));
  // spray bar with nozzles, on two back posts
  cylX(0.035, LEN + 0.3, 8, L.steel, 0, DY + R + 0.2, 0, root);
  for (let i = 0; i < 5; i++) put(root, new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 6).rotateX(Math.PI), L.yellow), -0.56 + i * 0.28, DY + R + 0.13, 0);
  [-0.7, 0.7].forEach((x) => { box(0.06, R + 0.6, 0.06, L.steelD, x, DY + (R + 0.2) / 2 - 0.1, -0.55, root); box(0.06, 0.06, 0.6, L.steelD, x, DY + R + 0.2, -0.27, root); });
  // water tank at the back with a sight glass showing the yard tank's level
  const T = new THREE.Group(); T.position.set(0.2, 0, -0.95); root.add(T);
  box(0.9, 1.1, 0.45, L.cream, 0, 0.75, 0, T); box(0.96, 0.06, 0.5, L.green, 0, 1.33, 0, T); box(0.96, 0.18, 0.5, L.greenD, 0, 0.12, 0, T);
  box(0.12, 0.82, 0.02, L.dark, -0.28, 0.75, 0.23, T);
  const level = box(0.08, 0.8, 0.02, L.water, -0.28, 0.35, 0.245, T); level.geometry.translate(0, 0.4, 0); level.userData.noOutline = true;
  pipe(root, [[0.35, 1.36, -0.95], [0.35, 1.75, -0.7], [0.55, DY + R + 0.2, -0.2], [0.75, DY + R + 0.2, 0]], 0.035, L.steel);
  cylZ(0.06, 0.1, 8, L.red, 0.35, 1.42, -0.72, root);
  bake(root, [drum, level]);
  return { root, drum, tanks: [level], ledAt: new V(0.55, 1.25, -0.71) };
}

// ---------------------------------------------------------------------------
/** Optical sorter: yellow pillars and a gantry arch carrying a camera head and light bars, a brush diverter that
 *  sweeps rejects into a side chute, and a control box. */
export function cutter() {
  const root = new THREE.Group(); root.name = 'Optical sorter'; root.userData.pick = 'line';
  const H = 1.75;
  [-1, 1].forEach((s) => {
    box(0.42, H, 0.26, L.yellow, 0, H / 2, s * 0.6, root);
    box(0.48, 0.14, 0.34, L.dark, 0, 0.07, s * 0.6, root);
    box(0.3, 0.5, 0.02, L.yellowD, 0, 0.9, s * 0.735, root);
    for (let k = 0; k < 4; k++) box(0.24, 0.025, 0.02, L.dark, 0, 0.75 + k * 0.08, s * 0.745, root);
  });
  box(0.52, 0.28, 1.5, L.yellow, 0, H + 0.1, 0, root);
  box(0.56, 0.06, 1.54, L.dark, 0, H + 0.27, 0, root);
  // camera head and light bars under the arch
  box(0.36, 0.22, 0.6, L.dark, 0, H - 0.15, 0, root);
  cyl(0.07, 0.12, 10, L.black, 0, H - 0.3, 0.12, root); cyl(0.05, 0.02, 10, mat('#2a4d6e', { roughness: 0.1 }), 0, H - 0.36, 0.12, root);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: lin('#dff4ff'), emissiveIntensity: 0.2 }); lightMat.userData.lowpoly = true;
  const lights = [-0.13, 0.13].map((x) => { const m = box(0.05, 0.03, 0.9, lightMat, x, H - 0.27, 0, root); m.userData.noOutline = true; return m; });
  // brush diverter across the belt (spins)
  const brush = new THREE.Group(); brush.position.set(-0.12, BELT_Y + 0.16, 0); root.add(brush);
  cylZ(0.035, 1.12, 8, L.steel, 0, 0, 0, brush);
  for (let k = 0; k < 3; k++) { const b = box(0.2, 0.03, 0.9, L.red, 0, 0, 0, brush); b.rotation.z = k * Math.PI / 3; }
  // reject chute and bin on the front
  const ch = box(0.4, 0.04, 0.6, L.steel, -0.12, 0.62, 0.95, root); ch.rotation.x = 0.45;
  [-1, 1].forEach((s) => { const w = box(0.03, 0.12, 0.6, L.steel, -0.12 + s * 0.2, 0.67, 0.95, root); w.rotation.x = 0.45; });
  box(0.55, 0.4, 0.45, L.greenD, -0.12, 0.2, 1.35, root); box(0.5, 0.02, 0.4, L.dark, -0.12, 0.405, 1.35, root);
  // control box on the back pillar
  box(0.3, 0.36, 0.14, L.cream, 0.26, 1.25, -0.6, root); box(0.2, 0.12, 0.01, mat('#123326'), 0.26, 1.3, -0.528, root);
  bake(root, [brush, ...lights]);
  return { root, heat: lights, gears: [{ g: brush, r: 0.09 }], ledAt: new V(0.33, 1.15, -0.52) };
}

// ---------------------------------------------------------------------------
/** Carton packing tower: two green towers, a yellow carriage that folds and tapes each box, a magazine of flat
 *  cartons at the back and the open carton the produce drops into. */
export function packer() {
  const root = new THREE.Group(); root.name = 'Carton packer'; root.userData.pick = 'line';
  const H = 2.5;
  [-1, 1].forEach((s) => { box(0.28, H, 0.28, L.green, 0, H / 2, s * 0.62, root); box(0.34, 0.12, 0.34, L.greenD, 0, 0.06, s * 0.62, root); box(0.06, H - 0.4, 0.04, L.yellow, -0.16, H / 2, s * 0.62, root); });
  box(0.4, 0.22, 1.6, L.yellow, 0, H + 0.08, 0, root);
  box(0.44, 0.05, 1.64, L.dark, 0, H + 0.21, 0, root);
  // forming table and the open carton
  box(0.9, 0.08, 0.9, L.steel, -0.1, BELT_Y - 0.08, 0, root);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(0.06, BELT_Y - 0.12, 0.06, L.steelD, -0.1 + sx * 0.4, (BELT_Y - 0.12) / 2, sz * 0.4, root)));
  box(0.5, 0.3, 0.5, L.cardboard, -0.1, BELT_Y + 0.11, 0, root);
  [-1, 1].forEach((s) => { const f = box(0.5, 0.02, 0.18, L.cardboard, -0.1, BELT_Y + 0.27, s * 0.33, root); f.rotation.x = s * 0.9; });
  box(0.46, 0.02, 0.46, L.black, -0.1, BELT_Y + 0.265, 0, root);
  box(0.24, 0.04, 0.62, L.steel, 0.47, BELT_Y - 0.02, 0, root); [-1, 1].forEach((s) => box(0.24, 0.1, 0.03, L.yellow, 0.47, BELT_Y + 0.03, s * 0.3, root));   // infeed lip and guides
  // carriage (moves down to fold and tape)
  const head = new THREE.Group(); root.add(head);
  box(0.3, 0.16, 1.0, L.yellow, 0, 0, 0, head);
  [-0.3, 0.3].forEach((z) => { box(0.08, 0.3, 0.08, L.steelD, -0.1, -0.22, z, head); box(0.16, 0.04, 0.16, L.dark, -0.1, -0.38, z, head); });
  cylZ(0.12, 0.08, 12, L.tape, 0.1, -0.05, 0.0, head); cylZ(0.05, 0.1, 8, L.dark, 0.1, -0.05, 0.0, head);
  // flat carton magazine at the back
  const mag = new THREE.Group(); mag.position.set(0.55, 0, -0.15); root.add(mag);
  [[0.25, 0.3], [0.25, -0.3], [-0.25, -0.3]].forEach(([x, z]) => box(0.06, 1.4, 0.06, L.steelD, x, 0.7, z, mag));
  for (let k = 0; k < 9; k++) box(0.46, 0.035, 0.56, k % 2 ? L.cardboard : mat('#b98b4f'), 0, 0.45 + k * 0.05, 0, mag);
  box(0.56, 0.05, 0.66, L.steel, 0, 0.4, 0, mag);
  bake(root, [head]);
  return { root, head, headRest: H - 0.45, headTravel: 0.95, ledAt: new V(0.15, H + 0.24, 0.55) };
}
/** Output pallet that collects packed boxes. */
export function pallet() {
  const root = new THREE.Group(); root.name = 'Pallet'; root.userData.pick = 'line';
  for (let k = 0; k < 5; k++) box(1.1, 0.03, 0.18, L.wood, 0, 0.13, -0.44 + k * 0.22, root);
  [-0.45, 0, 0.45].forEach((x) => box(0.12, 0.1, 1.1, L.woodD, x, 0.06, 0, root));
  bake(root, []);
  const boxGeo = new THREE.BoxGeometry(0.4, 0.28, 0.4), tapeGeo = new THREE.BoxGeometry(0.405, 0.02, 0.08), lblGeo = new THREE.BoxGeometry(0.16, 0.1, 0.005);
  const slots = [];
  for (let l = 0; l < 3; l++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const g = new THREE.Group(); g.position.set(-0.22 + i * 0.44, 0.29 + l * 0.29, -0.22 + j * 0.44); root.add(g);
    put(g, new THREE.Mesh(boxGeo, L.cardboard)); put(g, new THREE.Mesh(tapeGeo, L.tape), 0, 0.14, 0); put(g, new THREE.Mesh(lblGeo, L.green), 0, 0, 0.202);
    g.visible = false; slots.push(g);
  }
  return { root, slots, show(n) { slots.forEach((s, i) => { s.visible = i < n; }); } };
}
/** Tapered harvest hopper at the start of the line. */
export function bin() {
  const root = new THREE.Group(); root.name = 'Harvest hopper'; root.userData.pick = 'field';
  put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 0.7, 4, 1, true).rotateY(Math.PI / 4), mat('#e9b830', { side: THREE.DoubleSide })), 0, 1.25, 0);
  [[0, 0.6], [0, -0.6], [0.6, 0], [-0.6, 0]].forEach(([x, z]) => box(x ? 0.06 : 1.26, 0.06, z ? 0.06 : 1.26, L.yellowD, x, 1.61, z, root));
  box(0.62, 0.05, 0.62, L.dark, 0, 0.92, 0, root);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(0.08, 1.3, 0.08, L.steelD, sx * 0.42, 0.65, sz * 0.42, root)));
  const ch = box(0.5, 0.04, 0.4, L.steel, -0.55, 0.9, 0, root); ch.rotation.z = 0.35;
  [-1, 1].forEach((s) => { const w = box(0.5, 0.1, 0.03, L.steel, -0.55, 0.94, s * 0.2, root); w.rotation.z = 0.35; });
  bake(root, []);
  return { root, top: new V(0, 1.0, 0) };
}
/** Stainless hand-wash sink station with a gooseneck tap, towel roll and foot pedal. */
export function washTable() {
  const root = new THREE.Group(); root.name = 'Sink station';
  box(1.0, 0.82, 0.55, L.steel, 0, 0.41, 0, root);
  box(1.04, 0.05, 0.6, L.steel, 0, 0.84, 0, root);
  box(0.6, 0.02, 0.38, L.steelD, 0, 0.865, 0.02, root);
  box(1.0, 0.4, 0.04, L.steel, 0, 1.09, -0.27, root);
  cyl(0.025, 0.35, 8, L.steel, 0, 1.02, -0.18, root);
  pipe(root, [[0, 1.19, -0.18], [0, 1.27, -0.08], [0, 1.18, 0.02]], 0.022, L.steel);
  cylZ(0.07, 0.22, 10, L.cream, 0.36, 1.15, -0.18, root);
  box(0.12, 0.04, 0.08, L.dark, 0, 0.04, 0.32, root);
  bake(root, []);
  return { root };
}
/** Drinks cooler for the workers: cream cabinet, green lit header, full-height glass door with shelves. */
export function vendingMachine() {
  const root = new THREE.Group(); root.name = 'Drinks cooler'; root.userData.pick = 'vend';
  box(0.8, 1.9, 0.7, L.cream, 0, 0.97, 0, root);
  box(0.82, 0.06, 0.72, L.dark, 0, 0.03, 0, root);
  box(0.66, 1.38, 0.02, mat('#2a3235', { roughness: 0.3 }), -0.02, 0.92, 0.35, root);
  const cols = ['#d6402c', '#3fb6e8', '#e9b830', '#3f7d4c', '#f08a24', '#e9e4d6'];
  for (let s = 0; s < 5; s++) {
    box(0.6, 0.015, 0.4, L.steel, -0.02, 0.32 + s * 0.27, 0.12, root);
    for (let i = 0; i < 6; i++) cyl(0.035, 0.16, 6, mat(cols[(i + s) % cols.length], { roughness: 0.4 }), -0.27 + i * 0.1, 0.41 + s * 0.27, 0.18, root);
  }
  box(0.68, 1.4, 0.01, L.glass, -0.02, 0.92, 0.365, root);
  box(0.04, 0.8, 0.05, L.steel, 0.27, 0.95, 0.4, root);
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#2f5a3b'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#f4ecd2'; x.font = '800 34px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('COLD DRINKS', 128, 34);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.2), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.2 }));
  scr.material.userData.lowpoly = true; scr.userData.noOutline = true; scr.position.set(0, 1.78, 0.352); root.add(scr);
  const lamp = box(0.6, 0.02, 0.02, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: lin('#eaf6ff'), emissiveIntensity: 2 }), -0.02, 1.58, 0.33, root); lamp.material.userData.lowpoly = true;
  bake(root, [scr, lamp]);
  return { root, screen: scr, lamp };
}

/** Gravity roller chute from (x0, y0) down to (x1, y1) along -x: carries packed cartons from the packer onto the pallet. */
export function chute(x0, y0, x1, y1) {
  const root = new THREE.Group(); root.name = 'Roller chute'; root.userData.pick = 'line';
  const a = new V(x0, y0, 0), b = new V(x1, y1, 0), d = b.clone().sub(a), len = d.length(), ang = Math.atan2(d.y, -d.x);
  const deck = new THREE.Group(); deck.position.copy(a.clone().lerp(b, 0.5)); deck.rotation.z = -ang; root.add(deck);
  [-1, 1].forEach((s) => box(len, 0.08, 0.05, L.yellow, 0, 0.0, s * 0.3, deck));
  for (let k = 0; k < Math.floor(len / 0.12); k++) cylZ(0.03, 0.56, 8, L.steel, -len / 2 + 0.06 + k * 0.12, 0.0, 0, deck);
  [[-1, 0.35], [1, 0.35]].forEach(([s]) => box(0.05, y1 - 0.02, 0.05, L.steelD, x1 + 0.03, (y1 - 0.02) / 2, s * 0.3, root));
  [[-1], [1]].forEach(([s]) => box(0.05, y0 - 0.02, 0.05, L.steelD, x0 - 0.03, (y0 - 0.02) / 2, s * 0.3, root));
  bake(root, []);
  return { root, dirOut: d.clone().normalize() };
}
