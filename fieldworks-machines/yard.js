// Fieldworks power-and-water yard: low-poly models with working moving parts.
// Wind turbine, solar array, storage tank, well pump jack (real four-bar linkage), spray drone and landing pad,
// utility poles and cables, lattice transmission tower, transformer, battery container, distribution panel,
// yard lights, a utility truck and physics props. Every builder returns { root, animate(...), ...anchors }.
// Units are metres. Written for three.js r147; run stylize() from lowpoly.js on each root for outlines.

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bake } from './lowpoly.js';

const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
export function flat(hex, o) {
  const k = hex + JSON.stringify(o || {});
  if (mats.has(k)) return mats.get(k);
  const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.05, flatShading: true }, o || {}));
  m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m);
  return m;
}
export const C = {
  white: flat('#eceee9', { roughness: 0.5 }), offWhite: flat('#d9ddd6', { roughness: 0.6 }),
  green: flat('#3f7d4c', { roughness: 0.5, metalness: 0.15 }), darkGreen: flat('#2f5a3b', { roughness: 0.5, metalness: 0.2 }),
  yellow: flat('#f2c230', { roughness: 0.5 }), orange: flat('#f0862a', { roughness: 0.5 }), red: flat('#d6402c', { roughness: 0.5 }),
  blue: flat('#2e6aa8', { roughness: 0.45, metalness: 0.2 }), grey: flat('#c2c7cb', { roughness: 0.5, metalness: 0.25 }),
  steel: flat('#9aa3ab', { roughness: 0.4, metalness: 0.5 }), dark: flat('#3a3f45', { roughness: 0.6, metalness: 0.3 }), black: flat('#1c1e21', { roughness: 0.65 }),
  concrete: flat('#c4beb2', { roughness: 0.95 }), concreteDark: flat('#a19b90', { roughness: 0.95 }),
  wood: flat('#a2703f', { roughness: 0.85 }), woodDark: flat('#6e4a2b', { roughness: 0.9 }),
  tank: flat('#cbd3d6', { roughness: 0.42, metalness: 0.35 }), insul: flat('#e6e1d3', { roughness: 0.3 }), bushing: flat('#8a3f22', { roughness: 0.35 }),
  hay: flat('#e2b950', { roughness: 0.95 }), hayEnd: flat('#c99a35', { roughness: 0.95 }), pumpkin: flat('#ee7d1c', { roughness: 0.6 }), stem: flat('#5d7a2a'),
  tire: flat('#232427', { roughness: 0.9 }), rim: flat('#c9ccd0', { roughness: 0.35, metalness: 0.6 }),
  glass: Object.assign(new THREE.MeshStandardMaterial({ color: lin('#bfe3f2'), roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }), { userData: { lowpoly: true } }),
  water: Object.assign(new THREE.MeshStandardMaterial({ color: lin('#3fb6e8'), roughness: 0.1, transparent: true, opacity: 0.75, flatShading: true }), { userData: { lowpoly: true } }),
  lamp: Object.assign(new THREE.MeshStandardMaterial({ color: lin('#222'), emissive: lin('#ffd9a0'), emissiveIntensity: 0 }), { userData: { lowpoly: true } })
};

// ---------------------------------------------------------------------------
// helpers
function put(p, m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (p) p.add(m); return m; }
export const box = (w, h, d, mat, x, y, z, p) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
export const cyl = (rt, rb, h, seg, mat, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat), x, y, z);
function cylAxis(r, len, seg, mat, axis, x, y, z, p) {
  const g = new THREE.CylinderGeometry(r, r, len, seg || 8);
  if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  return put(p, new THREE.Mesh(g, mat), x, y, z);
}
export function strutGeo(a, b, t, t2) {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.BoxGeometry(t, t2 || t, len);
  const m = new THREE.Matrix4().lookAt(new V(), d, Math.abs(d.y / len) > 0.98 ? new V(1, 0, 0) : new V(0, 1, 0));
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  return g.applyMatrix4(m);
}
const strut = (a, b, t, mat, p) => put(p, new THREE.Mesh(strutGeo(a, b, t), mat));
function merged(geos, mat, p) { const m = put(p, new THREE.Mesh(mergeBufferGeometries(geos.map((g) => (g.index ? g : g)), false), mat)); geos.forEach((g) => g.dispose()); return m; }
export function tube(points, r, mat, p, o) {
  const curve = new THREE.CatmullRomCurve3(points.map((q) => (q.isVector3 ? q : new V(...q))), false, 'centripetal');
  const m = put(p, new THREE.Mesh(new THREE.TubeGeometry(curve, (o && o.seg) || Math.max(8, points.length * 6), r, (o && o.radial) || 6, false), mat));
  m.userData.noOutline = !!(o && o.noOutline);
  return m;
}
export function catenary(a, b, sag, n) {
  const pts = []; n = n || 14;
  for (let i = 0; i <= n; i++) { const t = i / n; const q = a.clone().lerp(b, t); q.y -= sag * 4 * t * (1 - t); pts.push(q); }
  return pts;
}
// A glowing canvas screen (kept readable, never outlined).
export function screen(w, h, px, parent, x, y, z) {
  const canvas = document.createElement('canvas'); canvas.width = px || 256; canvas.height = Math.round(canvas.width * h / w);
  const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.15, roughness: 0.2 });
  mat.userData.lowpoly = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); mesh.userData.noOutline = true;
  mesh.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(mesh);
  return { mesh, canvas, ctx: canvas.getContext('2d'), tex, update() { tex.needsUpdate = true; } };
}
export function label(w, h, lines, o) {
  o = o || {};
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.max(32, Math.round(256 * h / w));
  const x = c.getContext('2d'); x.fillStyle = o.bg || '#f2c21f'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = o.fg || '#15171a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = Math.min(c.height / (lines.length + 0.6), 44); x.font = `700 ${fs}px Inter, Arial, sans-serif`;
  const widest = Math.max(...lines.map((t) => x.measureText(t).width)); if (widest > c.width * 0.9) { fs *= c.width * 0.9 / widest; x.font = `700 ${fs}px Inter, Arial, sans-serif`; }
  lines.forEach((t, i) => x.fillText(t, c.width / 2, c.height * (i + 1) / (lines.length + 1)));
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), Object.assign(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), { userData: { lowpoly: true } }));
  m.userData.noOutline = true;
  return m;
}
const pickable = (root, key) => { root.userData.pick = key; return root; };

// ---------------------------------------------------------------------------
// WIND TURBINE (FW-WT20): tapered tower, nacelle that yaws into the wind, three twisted blades with pitch control
function bladeGeometry() {
  const N = 8, pos = [], idx = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const c = t < 0.15 ? 0.34 + (t / 0.15) * 0.24 : 0.58 * (1 - t) + 0.11 * t;
    const th = c * (0.24 - 0.12 * t), tw = (1 - t) * 0.42;
    const pts = [[-0.3 * c, 0], [0.04 * c, th], [0.7 * c, 0], [0.04 * c, -0.45 * th]];
    pts.forEach(([x, z]) => pos.push(x * Math.cos(tw) - z * Math.sin(tw), t, x * Math.sin(tw) + z * Math.cos(tw)));
  }
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < 4; j++) {
    const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c2 = a + 4, d = b + 4;
    idx.push(a, b, c2, b, d, c2);
  }
  const L = (N - 1) * 4; idx.push(L, L + 1, L + 2, L, L + 2, L + 3, 0, 2, 1, 0, 3, 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const n = g.toNonIndexed(); n.computeVertexNormals(); return n;
}
export function windTurbine() {
  const root = pickable(new THREE.Group(), 'wind'); root.name = 'Wind turbine';
  const H = 14, rAt = (y) => 0.62 + (0.32 - 0.62) * (y / H);
  cyl(2.0, 2.25, 0.5, 8, C.concrete, 0, 0.25, 0, root);
  cyl(rAt(0), rAt(0) + 0.05, 0.12, 10, C.grey, 0, 0.56, 0, root);
  cyl(rAt(H), rAt(0), H, 10, C.white, 0, 0.5 + H / 2, 0, root);
  [4.5, 9.5].forEach((y) => cyl(rAt(y) + 0.03, rAt(y) + 0.03, 0.08, 10, C.offWhite, 0, 0.5 + y, 0, root));
  box(0.5, 1.1, 0.12, C.grey, 0, 1.25, rAt(0.7) - 0.02, root);
  box(1.0, 0.25, 0.8, C.concrete, 0, 0.62, 1.15, root);
  // ground control cabinet
  const cab = new THREE.Group(); cab.position.set(1.45, 0.5, 1.1); root.add(cab);
  box(0.62, 1.05, 0.36, C.grey, 0, 0.53, 0, cab); box(0.66, 0.06, 0.42, C.dark, 0, 1.08, 0, cab);
  const cabScreen = screen(0.36, 0.22, 192, cab, 0, 0.74, 0.185);
  // nacelle
  const yaw = new THREE.Group(); yaw.position.y = 0.5 + H; root.add(yaw);
  cyl(0.4, 0.4, 0.2, 10, C.grey, 0, 0.05, 0, yaw);
  const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 2.9, 6, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 6), C.white); put(yaw, nac, 0, 0.6, -0.45);
  box(1.06, 0.12, 2.6, C.green, 0, 0.45, -0.5, yaw);
  box(0.7, 0.18, 0.7, C.offWhite, 0, 1.2, -1.3, yaw);                         // cooler
  cyl(0.02, 0.02, 0.6, 5, C.dark, 0.2, 1.45, -1.55, yaw);                    // anemometer mast
  const anemo = new THREE.Group(); anemo.position.set(0.2, 1.76, -1.55); yaw.add(anemo);
  for (let k = 0; k < 3; k++) { const a = k * 2.094; const arm = box(0.26, 0.015, 0.015, C.dark, Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13, anemo); arm.rotation.y = -a; const cup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4, 0, Math.PI), C.dark); put(anemo, cup, Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26).rotation.y = -a; }
  const aviation = new V(-0.2, 1.38, -1.55);
  const rotor = new THREE.Group(); rotor.position.set(0, 0.6, 1.08); yaw.add(rotor);
  put(rotor, new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 8).rotateX(Math.PI / 2), C.white), 0, 0, 0.45);
  cylAxis(0.48, 0.5, 8, C.offWhite, 'z', 0, 0, -0.05, rotor);
  const bladeGeo = bladeGeometry(), blades = [];
  for (let k = 0; k < 3; k++) {
    const arm = new THREE.Group(); arm.rotation.z = k * Math.PI * 2 / 3; rotor.add(arm);
    const pitch = new THREE.Group(); pitch.position.y = 0.42; arm.add(pitch);
    cyl(0.17, 0.2, 0.3, 8, C.offWhite, 0, 0.1, 0, pitch);
    const b = put(pitch, new THREE.Mesh(bladeGeo, C.white), 0, 0.2, 0);
    const tip = box(0.12, 0.5, 0.05, C.red, 0, 0, 0, b); tip.scale.set(1, 1 / 4.4, 1);    // red tip marking (scaled with blade)
    blades.push({ pitch, blade: b, tip });
  }
  // windsock on its own pole
  const sock = new THREE.Group(); sock.position.set(4.6, 0, 3.4); root.add(sock);
  cyl(0.05, 0.07, 3.4, 6, C.steel, 0, 1.7, 0, sock);
  const sockHead = new THREE.Group(); sockHead.position.y = 3.35; sock.add(sockHead);
  const sockBody = new THREE.Group(); sockHead.add(sockBody);
  for (let i = 0; i < 5; i++) { const r0 = 0.22 - i * 0.03; const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0 - 0.03, r0, 0.34, 8, 1, true).rotateX(Math.PI / 2), i % 2 ? C.white : C.orange); seg.material = i % 2 ? C.white : C.orange; put(sockBody, seg, 0, 0, -0.2 - i * 0.34); }
  let lastLevel = -1;
  function setRotor(d) {
    const len = d / 2 - 0.62, s = d / 10;
    blades.forEach((b) => { b.blade.scale.set(s, len, s); b.tip.position.y = 1 - 0.06; });
  }
  setRotor(10);
  bake(rotor, blades.map((b) => b.pitch)); bake(yaw, [rotor, anemo]); bake(root, [yaw, sockHead]); bake(sockHead, []);
  return {
    root, yaw, rotor, cabScreen, aviation, cabinet: cab, terminal: new V(1.45, 0.6, 1.1),
    hubHeight: 0.5 + H + 0.6,
    animate(dt, sim, env) {
      if (sim.levelIndex !== lastLevel) { lastLevel = sim.levelIndex; setRotor(sim.level.rotorD); }
      yaw.rotation.y = sim.yaw; rotor.rotation.z = -sim.rot;
      blades.forEach((b) => { b.pitch.rotation.y = sim.pitch * Math.PI / 180; });
      anemo.rotation.y += dt * env.wind * 1.6;
      sockHead.rotation.y = env.windDir;
      const droop = Math.max(0, 1 - env.wind / 9);
      sockBody.rotation.x = -droop * 1.2 + Math.sin(performance.now() * 0.006) * 0.04 * Math.min(1, env.wind / 6);
    }
  };
}

// ---------------------------------------------------------------------------
// SOLAR ARRAY (FW-SA8): 8 modules on a torque tube, tilt table (tracker at level 3), ballast feet, string inverter
let cellTex = null;
function solarCells() {
  if (cellTex) return cellTex;
  const c = document.createElement('canvas'); c.width = 192; c.height = 320; const x = c.getContext('2d');
  x.fillStyle = '#c9ced3'; x.fillRect(0, 0, c.width, c.height);
  const cw = (c.width - 10) / 6, ch = (c.height - 10) / 10;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) {
    x.fillStyle = (i + j) % 2 ? '#1b3768' : '#1e3c70'; x.fillRect(5 + i * cw + 1, 5 + j * ch + 1, cw - 2, ch - 2);
    x.fillStyle = 'rgba(160,190,230,0.35)'; x.fillRect(5 + i * cw + cw * 0.33, 5 + j * ch + 1, 1.2, ch - 2); x.fillRect(5 + i * cw + cw * 0.66, 5 + j * ch + 1, 1.2, ch - 2);
  }
  cellTex = new THREE.CanvasTexture(c); cellTex.encoding = THREE.sRGBEncoding; cellTex.anisotropy = 8;
  return cellTex;
}
export function solarArray() {
  const root = pickable(new THREE.Group(), 'solar'); root.name = 'Solar array';
  const cellMat = new THREE.MeshStandardMaterial({ map: solarCells(), roughness: 0.22, metalness: 0.35 }); cellMat.userData.lowpoly = true;
  const table = new THREE.Group(); table.position.y = 1.55; root.add(table);
  cylAxis(0.08, 4.7, 8, C.steel, 'x', 0, 0, 0, table);
  [-0.85, 0.85].forEach((z) => box(4.5, 0.06, 0.08, C.steel, 0, 0.06, z, table));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = -1.62 + i * 1.08, z = j ? 0.88 : -0.88;
    box(1.04, 0.05, 1.72, C.grey, x, 0.12, z, table);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.66).rotateX(-Math.PI / 2), cellMat);
    face.userData.noOutline = true; put(table, face, x, 0.147, z);
  }
  [-1.95, 0, 1.95].forEach((x) => {
    box(0.6, 0.3, 0.9, C.concrete, x, 0.15, 0, root);
    box(0.12, 1.3, 0.12, C.steel, x, 0.9, 0, root);
    cylAxis(0.13, 0.16, 8, C.dark, 'x', x, 1.55, 0, root);
  });
  // tracker drive at the middle post
  const drive = new THREE.Group(); drive.position.set(0.25, 1.45, 0); root.add(drive);
  box(0.22, 0.3, 0.3, C.green, 0, 0, 0, drive); cylAxis(0.07, 0.25, 8, C.blue, 'z', 0.0, -0.1, 0.25, drive); drive.visible = false;
  // inverter on its own post
  const inv = new THREE.Group(); inv.position.set(3.1, 0, 0.3); root.add(inv);
  box(0.1, 1.6, 0.1, C.steel, 0, 0.8, -0.12, inv);
  box(0.52, 0.66, 0.22, C.offWhite, 0, 1.15, 0, inv); box(0.56, 0.05, 0.27, C.dark, 0, 1.5, 0, inv);
  for (let k = 0; k < 4; k++) box(0.42, 0.02, 0.04, C.grey, 0, 0.92 + k * 0.05, 0.12, inv);
  const invScreen = screen(0.3, 0.16, 192, inv, 0, 1.3, 0.112);
  bake(table, []); bake(root, [table, drive]);
  const dust = new THREE.Color(), cleanC = new THREE.Color(1, 1, 1), dirtC = lin('#b9a27a');
  return {
    root, table, invScreen, inverter: inv, terminal: new V(3.1, 0.2, 0.3),
    animate(dt, sim) {
      table.rotation.x = sim.tilt * Math.PI / 180;
      drive.visible = !!sim.level.tracker;
      cellMat.color.copy(dust.copy(cleanC).lerp(dirtC, Math.min(1, sim.soiling * 2.2)));
    }
  };
}

// ---------------------------------------------------------------------------
// STORAGE TANK: bolted steel rings (3 to 5 with upgrades), cone roof with railing, ladder and cage per ring,
// sight gauge with a float, manway, inlet riser from the well and an outlet with a red actuated valve
export const TANK_R = 1.45, RING_H = 1.1;
export function storageTank() {
  const root = pickable(new THREE.Group(), 'tank'); root.name = 'Storage tank';
  const R = TANK_R, B = 0.3;
  cyl(R + 0.4, R + 0.5, B, 16, C.concrete, 0, B / 2, 0, root);
  const rings = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group(); g.position.y = B + i * RING_H; root.add(g);
    cyl(R, R, RING_H, 18, C.tank, 0, RING_H / 2, 0, g);
    cyl(R + 0.035, R + 0.035, 0.07, 18, C.grey, 0, 0.02, 0, g);
    // ladder section on +x
    [-0.2, 0.2].forEach((z) => box(0.05, RING_H, 0.05, C.yellow, R + 0.28, RING_H / 2, z, g));
    const rungs = []; for (let k = 0; k < 4; k++) rungs.push(new THREE.BoxGeometry(0.035, 0.035, 0.4).translate(R + 0.28, 0.14 + k * 0.275, 0));
    merged(rungs, C.yellow, g);
    if (i >= 2) {   // safety cage from 2.2 m up
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.022, 4, 10, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), C.yellow);
      put(g, hoop, R + 0.28, 0.55, 0);
      [-1, 0, 1].forEach((k) => box(0.03, RING_H, 0.03, C.yellow, R + 0.28 + 0.38 * Math.cos(k * 0.9), RING_H / 2, 0.38 * Math.sin(k * 0.9), g));
    }
    // sight gauge section on +z
    box(0.1, RING_H, 0.04, C.white, 0, RING_H / 2, R + 0.05, g);
    for (let k = 0; k < 4; k++) box(k % 2 ? 0.06 : 0.1, 0.012, 0.01, C.black, -0.09, 0.14 + k * 0.275, R + 0.075, g);
    cyl(0.03, 0.03, RING_H, 6, C.glass, 0.09, RING_H / 2, R + 0.07, g);
    // inlet riser on -x side
    cyl(0.07, 0.07, RING_H, 8, C.steel, -R - 0.14, RING_H / 2, -0.4, g);
    rings.push(g);
  }
  const roof = new THREE.Group(); root.add(roof);
  put(roof, new THREE.Mesh(new THREE.ConeGeometry(R + 0.06, 0.6, 18), C.tank), 0, 0.3, 0);
  cyl(R + 0.07, R + 0.07, 0.13, 18, C.orange, 0, 0.0, 0, roof);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; if (Math.abs(a) < 0.3) continue; box(0.035, 0.9, 0.035, C.yellow, Math.cos(a) * (R - 0.08), 0.45, Math.sin(a) * (R - 0.08), roof); }
  put(roof, new THREE.Mesh(new THREE.TorusGeometry(R - 0.08, 0.025, 4, 20).rotateX(Math.PI / 2), C.yellow), 0, 0.9, 0);
  put(roof, new THREE.Mesh(new THREE.TorusGeometry(R - 0.08, 0.018, 4, 20).rotateX(Math.PI / 2), C.yellow), 0, 0.5, 0);
  box(0.5, 0.12, 0.5, C.grey, 0.6, 0.18, 0.3, roof).rotation.z = -0.22;                     // roof hatch
  cyl(0.08, 0.08, 0.3, 8, C.steel, 0, 0.7, 0, roof); cyl(0.16, 0.05, 0.12, 8, C.grey, 0, 0.88, 0, roof);   // vent
  [-0.2, 0.2].forEach((z) => box(0.05, 1.0, 0.05, C.yellow, R + 0.28, 0.5, z, roof));       // ladder hand-holds over the rim
  put(roof, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 8, Math.PI).rotateY(Math.PI / 2), C.yellow), R + 0.28, 1.0, 0);
  // inlet elbow into the roof
  tube([[-R - 0.14, 0, -0.4], [-R - 0.14, 0.25, -0.4], [-R + 0.15, 0.3, -0.35]], 0.07, C.steel, roof, { seg: 8 });
  // float on the sight gauge
  const float = box(0.12, 0.06, 0.08, C.orange, 0.09, 1, R + 0.08, root); float.userData.noOutline = true;
  // manway and outlet
  const man = cylAxis(0.32, 0.08, 12, C.grey, 'z', 0, 0, 0, null); man.position.set(Math.sin(-0.8) * (R + 0.03), B + 0.55, Math.cos(-0.8) * (R + 0.03)); man.rotation.y = -0.8; root.add(man);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; cylAxis(0.025, 0.1, 5, C.dark, 'z', Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.02, man); }
  const outA = new V(Math.sin(0.6) * R, B + 0.25, Math.cos(0.6) * R), outB = outA.clone().add(new V(0.9, 0, 0.9));
  tube([outA, outA.clone().lerp(outB, 0.5), outB], 0.07, C.steel, root, { seg: 6 });
  const valve = new THREE.Group(); valve.position.copy(outA.clone().lerp(outB, 0.55)); root.add(valve);
  box(0.2, 0.2, 0.2, C.red, 0, 0, 0, valve); box(0.22, 0.22, 0.3, C.red, 0, 0.24, 0, valve).rotation.y = Math.PI / 4;
  const flag = box(0.3, 0.04, 0.06, C.yellow, 0, 0.4, 0, valve);
  // inlet riser foot (where the well line arrives)
  const inletFoot = new V(-R - 0.14, B, -0.4);
  cyl(0.07, 0.07, B, 8, C.steel, inletFoot.x, B / 2, inletFoot.z, root);
  rings.forEach((g) => bake(g, [])); bake(roof, []); bake(root, [...rings, roof, float, valve]);
  let lastRings = -1;
  return {
    root, rings, roof, outlet: outB.clone(), inlet: new V(-R - 0.14, 0.1, -0.4),
    animate(dt, sim) {
      const n = sim.level.rings;
      if (n !== lastRings) { lastRings = n; rings.forEach((g, i) => { g.visible = i < n; }); roof.position.y = B + n * RING_H; }
      float.position.y = B + 0.03 + sim.frac() * (n * RING_H - 0.06);
      flag.rotation.y += ((sim.valveOpen ? Math.PI / 4 : -Math.PI / 4) - flag.rotation.y) * Math.min(1, dt * 4);
    }
  };
}

// ---------------------------------------------------------------------------
// WELL PUMP JACK (FW-PJ10): crank, pitman arms and walking beam solved as a real four-bar linkage.
// The horsehead is an arc about the beam pivot, so the bridle lifts the polished rod straight up and down.
export function pumpJack() {
  const root = pickable(new THREE.Group(), 'pump'); root.name = 'Pump jack';
  const PS = new V(0, 3.2, 0), A = 2.2, Bk = 1.7, CK = new V(1.7, 1.35, 0), LP = PS.y - CK.y;
  // skid
  [-0.55, 0.55].forEach((z) => { box(4.5, 0.08, 0.2, C.dark, 1.3, 0.04, z, root); box(4.5, 0.08, 0.2, C.dark, 1.3, 0.24, z, root); box(4.5, 0.2, 0.04, C.dark, 1.3, 0.14, z, root); });
  [-0.6, 0.6, 1.7, 3.0].forEach((x) => box(0.16, 0.16, 1.1, C.dark, x, 0.2, 0, root));
  // samson post (three legs) and saddle bearing
  [-1, 1].forEach((s) => strut(new V(-0.7, 0.28, s * 0.55), new V(0, PS.y - 0.25, s * 0.12), 0.14, C.green, root));
  strut(new V(0.9, 0.28, 0), new V(0.02, PS.y - 0.25, 0), 0.13, C.green, root);
  [0.9, 1.7].forEach((y) => strut(new V(-0.7 + 0.7 * y / 3, y, -0.55 + 0.43 * y / 3), new V(-0.7 + 0.7 * y / 3, y, 0.55 - 0.43 * y / 3), 0.06, C.green, root));
  box(0.36, 0.2, 0.5, C.dark, 0, PS.y - 0.27, 0, root);
  // gear reducer, crank shaft, motor and belt guard
  box(0.95, 1.1, 0.62, C.green, CK.x, 0.8, 0, root); box(1.0, 0.08, 0.68, C.darkGreen, CK.x, 1.32, 0, root);
  cylAxis(0.1, 1.05, 8, C.steel, 'z', CK.x, CK.y, 0, root);
  const motor = new THREE.Group(); motor.position.set(3.05, 0.52, -0.05); root.add(motor);
  cylAxis(0.22, 0.5, 10, C.blue, 'z', 0, 0, 0, motor); cylAxis(0.24, 0.04, 10, C.dark, 'z', 0, 0, -0.27, motor);
  for (let k = 0; k < 6; k++) { const f = box(0.04, 0.04, 0.46, C.blue, Math.cos(k) * 0.23, Math.sin(k) * 0.23, 0, motor); f.rotation.z = k; }
  box(0.3, 0.06, 0.4, C.dark, 0, -0.24, 0, motor);
  const motorPulley = cylAxis(0.1, 0.06, 8, C.steel, 'z', 0, 0, 0.36, motor);
  const sheave = cylAxis(0.34, 0.08, 12, C.steel, 'z', CK.x + 0.48, 0.75, 0.36, root);
  for (let k = 0; k < 4; k++) { const sp = box(0.6, 0.03, 0.04, C.dark, 0, 0, 0.05, sheave); sp.rotation.z = k * Math.PI / 4; }
  const guardShape = new THREE.Shape(); guardShape.moveTo(-0.42, 0.38); guardShape.lineTo(1.0, 0.22); guardShape.lineTo(1.12, 0); guardShape.lineTo(1.0, -0.22); guardShape.lineTo(-0.42, -0.42); guardShape.lineTo(-0.5, 0); guardShape.closePath();
  const guard = put(root, new THREE.Mesh(new THREE.ExtrudeGeometry(guardShape, { depth: 0.12, bevelEnabled: false }), C.yellow), CK.x + 0.48, 0.75, 0.43);
  guard.rotation.z = -0.27;
  // crank arms with counterweights (both sides)
  const cranks = [-0.43, 0.43].map((z) => {
    const g = new THREE.Group(); g.position.set(CK.x, CK.y, z); root.add(g);
    const arm = box(1, 0.2, 0.08, C.dark, 0.5, 0, 0, g);
    const wt = box(0.46, 0.56, 0.12, C.red, 0, 0, 0, g);
    const pin = cylAxis(0.05, 0.14, 6, C.steel, 'z', 0, 0, z > 0 ? 0.06 : -0.06, g);
    cylAxis(0.13, 0.12, 8, C.dark, 'z', 0, 0, 0, g);
    return { g, arm, wt, pin };
  });
  // pitman arms (positioned every frame)
  const pitmans = [-0.54, 0.54].map((z) => box(0.1, 0.1, 1, C.green, 0, 0, z, root));
  // walking beam with horsehead and equalizer
  const beam = new THREE.Group(); beam.position.copy(PS); root.add(beam);
  box(A + Bk - 0.1, 0.34, 0.26, C.green, (Bk - A) / 2 + 0.1, 0, 0, beam);
  box(A + Bk - 0.2, 0.05, 0.36, C.darkGreen, (Bk - A) / 2 + 0.1, 0.19, 0, beam);
  box(0.2, 0.16, 1.2, C.dark, Bk, -0.05, 0, beam);
  const hs = new THREE.Shape(), d0 = 0.42, w = 0.5;
  for (let i = 0; i <= 6; i++) { const a = Math.PI - d0 + (2 * d0 * i) / 6; const x = Math.cos(a) * A, y = Math.sin(a) * A; if (i === 0) hs.moveTo(x, y); else hs.lineTo(x, y); }
  for (let i = 6; i >= 0; i--) { const a = Math.PI - d0 + (2 * d0 * i) / 6; hs.lineTo(Math.cos(a) * (A - w), Math.sin(a) * (A - w)); }
  hs.closePath();
  put(beam, new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.44, bevelEnabled: false, curveSegments: 1 }), C.yellow), 0, 0, -0.22);
  // bridle, carrier bar and polished rod (world space under the beam)
  const bridle = [-0.12, 0.12].map((z) => cyl(0.014, 0.014, 1, 4, C.black, -A, 0, z, root));
  const carrier = box(0.12, 0.08, 0.42, C.dark, -A, 0, 0, root);
  const rod = cyl(0.028, 0.028, 1.9, 6, C.steel, -A, 0, 0, root); rod.userData.noOutline = true;
  // wellhead
  cyl(0.15, 0.15, 0.5, 10, C.grey, -A, 0.25, 0, root);
  box(0.26, 0.24, 0.26, C.red, -A, 0.6, 0, root);
  cylAxis(0.08, 0.34, 8, C.red, 'z', -A, 0.6, 0.22, root);
  cyl(0.09, 0.07, 0.26, 8, C.red, -A, 0.85, 0, root);
  const wheel = put(root, new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 4, 10), C.red), -A, 0.6, 0.45);
  // control box on a post
  const ctrl = new THREE.Group(); ctrl.position.set(3.9, 0, 1.0); root.add(ctrl);
  box(0.08, 1.4, 0.08, C.steel, 0, 0.7, -0.1, ctrl); box(0.42, 0.52, 0.22, C.grey, 0, 1.15, 0, ctrl);
  const ctrlScreen = screen(0.28, 0.16, 192, ctrl, 0, 1.24, 0.112);
  bake(beam, []); bake(motor, [motorPulley]); bake(root, [beam, motor, sheave, ...cranks.map((c) => c.g), ...pitmans, ...bridle, carrier, rod, wheel]);
  const Q = new V(), E = new V();
  let phi = 0;
  function solve(theta, r) {
    Q.set(CK.x + r * Math.cos(theta), CK.y + r * Math.sin(theta), 0);
    let lo = -0.8, hi = 0.8;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      const ex = PS.x + Bk * Math.cos(m), ey = PS.y + Bk * Math.sin(m);
      if (Math.hypot(ex - Q.x, ey - Q.y) > LP) hi = m; else lo = m;
    }
    phi = (lo + hi) / 2; E.set(PS.x + Bk * Math.cos(phi), PS.y + Bk * Math.sin(phi), 0);
  }
  return {
    root, ctrlScreen, control: ctrl, wellOutlet: new V(-A, 0.6, 0.4), terminal: new V(3.9, 0.2, 1.0),
    rodY: () => PS.y - 1.3 - A * phi,
    animate(dt, sim) {
      const r = sim.level.strokeM * Bk / (2 * A), theta = -sim.crank;
      solve(theta, r);
      beam.rotation.z = phi;
      cranks.forEach((c) => {
        c.g.rotation.z = theta;
        c.arm.scale.x = r + 0.45; c.arm.position.x = (r + 0.45) / 2;
        c.wt.position.x = r + 0.2; c.pin.position.x = r;
      });
      pitmans.forEach((p) => {
        p.position.set((Q.x + E.x) / 2, (Q.y + E.y) / 2, p.position.z);
        p.scale.z = LP; p.rotation.set(0, 0, 0);
        p.lookAt(p.parent.localToWorld(new V(E.x, E.y, p.position.z)));
      });
      const carY = PS.y - 1.3 - A * phi;
      carrier.position.y = carY;
      bridle.forEach((b) => { const top = PS.y; b.scale.y = top - carY; b.position.y = (top + carY) / 2; });
      rod.position.y = carY - 0.95 + 0.04;
      motorPulley.rotation.z -= sim.spmNow / 60 * 2 * Math.PI * dt * 24;
      sheave.rotation.z -= sim.spmNow / 60 * 2 * Math.PI * dt * 7;
      wheel.rotation.z = sim.status() === 'off' ? 1.2 : 0;
    }
  };
}

// ---------------------------------------------------------------------------
// SPRAY DRONE (FW-AD16) and its landing pad with charger and refill hose
export function sprayDrone() {
  const root = pickable(new THREE.Group(), 'drone'); root.name = 'Spray drone';
  const body = new THREE.Group(); root.add(body);
  box(0.52, 0.22, 0.74, C.white, 0, 0, 0, body); box(0.36, 0.12, 0.52, C.green, 0, 0.16, -0.02, body);
  box(0.3, 0.05, 0.1, C.black, 0, 0.04, 0.38, body);
  const props = [], discs = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, ex = Math.sin(a) * 0.95, ez = Math.cos(a) * 0.95;
    strut(new V(Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2), new V(ex, 0.02, ez), 0.07, C.dark, body);
    box(0.1, 0.1, 0.1, C.orange, Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4, body).rotation.y = a;
    cyl(0.08, 0.08, 0.12, 8, C.dark, ex, 0.06, ez, body);
    const p = new THREE.Group(); p.position.set(ex, 0.15, ez); body.add(p);
    box(0.78, 0.012, 0.07, C.black, 0, 0, 0, p).userData.noOutline = true;
    cyl(0.04, 0.04, 0.04, 6, C.orange, 0, 0.01, 0, p);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, depthWrite: false }));
    disc.position.copy(p.position); disc.userData.noOutline = true; body.add(disc);
    props.push({ p, dir: k % 2 ? 1 : -1 }); discs.push(disc);
  }
  // translucent tank with liquid level
  const tankG = cyl(0.19, 0.19, 0.34, 10, C.glass, 0, -0.27, 0, body);
  const liquid = cyl(0.17, 0.17, 0.32, 10, C.water, 0, -0.43, 0, body); liquid.userData.noOutline = true;
  cyl(0.06, 0.06, 0.05, 8, C.orange, 0, -0.08, 0, body);
  // boom and nozzles
  const boom = box(1.7, 0.035, 0.035, C.dark, 0, -0.42, 0.12, body);
  const nozzles = [-0.75, -0.25, 0.25, 0.75].map((x) => { cyl(0.012, 0.03, 0.06, 5, C.orange, x, -0.46, 0.12, body); return new V(x, -0.5, 0.12); });
  // landing gear
  [-0.3, 0.3].forEach((x) => { box(0.04, 0.04, 0.9, C.dark, x, -0.62, 0, body); strut(new V(x, -0.62, -0.25), new V(x * 0.7, -0.1, -0.15), 0.035, C.dark, body); strut(new V(x, -0.62, 0.25), new V(x * 0.7, -0.1, 0.15), 0.035, C.dark, body); });
  const gimbal = new THREE.Group(); gimbal.position.set(0, -0.08, 0.42); body.add(gimbal);
  put(gimbal, new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), C.black));
  // navigation lights: green right front, red left front, white strobe at the back
  const nav = (hex, x, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: lin(hex), emissiveIntensity: 4 })); m.material.userData.lowpoly = true; m.position.set(x, 0.0, z); m.userData.noOutline = true; body.add(m); return m; };
  const navL = [nav('#2fff6a', 0.67, 0.67), nav('#ff3020', -0.67, 0.67)], strobe = nav('#ffffff', 0, -0.39);
  bake(body, [...props.map((p) => p.p), ...discs, liquid, boom, strobe, ...navL]);
  let spin = 0;
  return {
    root, body, nozzles, liquid, boom,
    animate(dt, sim) {
      root.position.set(sim.pos.x, sim.pos.y + 0.55, sim.pos.z);
      root.rotation.y = sim.heading;
      const fwd = Math.min(0.22, sim.vel * 0.04);
      body.rotation.x += ((sim.pos.y > 0.32 ? fwd : 0) - body.rotation.x) * Math.min(1, dt * 3);
      const flying = sim.flyW > 0, idle = sim.status() !== 'off' && !sim.fault && (flying || sim.state === 'takeoff');
      spin += (flying || idle ? 60 : 0) * dt;
      props.forEach((p) => { p.p.rotation.y = spin * p.dir; });
      discs.forEach((d) => { d.material.opacity = flying ? 0.22 : 0; });
      props.forEach((p) => { p.p.children[0].visible = !flying; });
      const f = Math.max(0.02, sim.liquidL / sim.level.tankL); liquid.scale.y = f; liquid.position.y = -0.43 + 0.16 * f;
      boom.scale.x = sim.level.swath / 1.4;
      strobe.material.emissiveIntensity = (performance.now() % 1200) < 90 ? 8 : 0.2;
    }
  };
}
export function dronePad() {
  const root = pickable(new THREE.Group(), 'drone'); root.name = 'Drone pad';
  box(3.4, 0.16, 3.4, C.concreteDark, 0, 0.08, 0, root);
  const mk = [[0.16, 1.6, -0.55, 0], [0.16, 1.6, 0.55, 0], [1.1, 0.16, 0, 0]];
  mk.forEach(([w, d, x, z]) => box(w, 0.012, d, C.yellow, x, 0.166, z, root).userData.noOutline = true);
  [[3.2, 0.1, 0, 1.55], [3.2, 0.1, 0, -1.55], [0.1, 3.2, 1.55, 0], [0.1, 3.2, -1.55, 0]].forEach(([w, d, x, z]) => box(w, 0.012, d, C.white, x, 0.166, z, root).userData.noOutline = true);
  // charger cabinet
  const ch = new THREE.Group(); ch.position.set(-2.15, 0, -1.2); root.add(ch);
  box(0.6, 1.2, 0.42, C.offWhite, 0, 0.6, 0, ch); box(0.66, 0.06, 0.48, C.green, 0, 1.22, 0, ch);
  const chScreen = screen(0.36, 0.22, 192, ch, 0, 0.92, 0.215);
  tube([[-1.85, 0.4, -1.2], [-1.55, 0.06, -1.0], [-0.5, 0.18, -0.4]], 0.025, C.black, root, { seg: 10, noOutline: true });
  // hose reel for the refill line
  const reel = new THREE.Group(); reel.position.set(-2.15, 0, 1.2); root.add(reel);
  [-0.16, 0.16].forEach((z) => cylAxis(0.32, 0.03, 10, C.red, 'z', 0, 0.45, z, reel));
  cylAxis(0.18, 0.3, 10, C.dark, 'z', 0, 0.45, 0, reel);
  box(0.06, 0.45, 0.06, C.dark, 0, 0.22, 0, reel);
  bake(root, []);
  return { root, chScreen, charger: ch, reelPos: new V(-2.15, 0.1, 1.2), terminal: new V(-2.15, 0.1, -1.2) };
}
// Spray particles in world space
export function sprayFX(scene, count) {
  count = count || 420;
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3), life = new Float32Array(count);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: lin('#e8f6ff'), size: 0.07, transparent: true, opacity: 0.75, depthWrite: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  for (let i = 0; i < count; i++) { life[i] = 0; pos[i * 3 + 1] = -100; }
  let next = 0; const tmp = new V();
  return {
    points: pts,
    update(dt, drone, sim) {
      if (sim.spraying) {
        const n = Math.ceil(count * dt * 2.4);
        for (let k = 0; k < n; k++) {
          const i = next; next = (next + 1) % count;
          const nz = drone.nozzles[k % drone.nozzles.length];
          tmp.set(nz.x * (sim.level.swath / 1.4) + (Math.random() - 0.5) * 0.1, nz.y, nz.z); drone.body.localToWorld(tmp);
          pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
          vel[i * 3] = (Math.random() - 0.5) * 0.9; vel[i * 3 + 1] = -2.2 - Math.random() * 1.2; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
          life[i] = 0.9 + Math.random() * 0.3;
        }
      }
      for (let i = 0; i < count; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 3 * dt;
        if (pos[i * 3 + 1] < 0.05 || life[i] <= 0) { life[i] = 0; pos[i * 3 + 1] = -100; }
      }
      g.attributes.position.needsUpdate = true;
    }
  };
}

// ---------------------------------------------------------------------------
// ELECTRICAL NETWORK
export function utilityPole(h) {
  h = h || 7.5;
  const root = new THREE.Group(); root.name = 'Utility pole';
  cyl(0.11, 0.16, h, 7, C.wood, 0, h / 2, 0, root);
  box(2.0, 0.13, 0.13, C.woodDark, 0, h - 0.45, 0, root);
  [-1, 1].forEach((s) => strut(new V(s * 0.75, h - 0.5, 0.08), new V(0, h - 1.15, 0.08), 0.05, C.steel, root));
  const tips = [];
  [-0.85, 0, 0.85].forEach((x, i) => {
    const y = i === 1 ? h + 0.05 : h - 0.38;
    if (i === 1) cyl(0.035, 0.035, 0.3, 5, C.steel, 0, h - 0.1, 0, root);
    cyl(0.05, 0.075, 0.2, 7, C.insul, x, y + 0.1, 0, root);
    cyl(0.085, 0.085, 0.03, 7, C.insul, x, y + 0.13, 0, root);
    tips.push(new V(x, y + 0.22, 0));
  });
  bake(root, []);
  return { root, tips, h };
}
export function wires(scene, a, b, sag, mat, r) {
  const list = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) list.push(tube(catenary(a[i], b[i], sag), r || 0.022, mat || C.black, scene, { seg: 16, radial: 4, noOutline: true }));
  return list;
}
// Lattice transmission tower (export line to the utility)
export function latticeTower(h) {
  h = h || 17;
  const root = new THREE.Group(); root.name = 'Transmission tower';
  const geos = [], hw = (y) => 1.7 + (0.42 - 1.7) * Math.min(1, y / (h * 0.78));
  const levels = [0, 2.6, 5.0, 7.2, 9.2, 11.0, 12.6, 13.9, h - 1.2, h];
  const corner = (y, sx, sz) => new V(sx * hw(y), y, sz * hw(y));
  const S = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i], y1 = levels[i + 1];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = S[k], [bx, bz] = S[(k + 1) % 4];
      geos.push(strutGeo(corner(y0, ax, az), corner(y1, ax, az), 0.11));
      geos.push(strutGeo(corner(y1, ax, az), corner(y1, bx, bz), 0.06));
      geos.push(strutGeo(corner(y0, ax, az), corner(y1, bx, bz), 0.045));
      geos.push(strutGeo(corner(y0, bx, bz), corner(y1, ax, az), 0.045));
    }
  }
  const tips = [];
  [[13.2, 3.0], [h - 1.0, 2.2]].forEach(([y, L], j) => {
    [-1, 1].forEach((s) => {
      geos.push(strutGeo(new V(s * hw(y), y, -0.35), new V(s * L, y + 0.35, 0), 0.07));
      geos.push(strutGeo(new V(s * hw(y), y, 0.35), new V(s * L, y + 0.35, 0), 0.07));
      geos.push(strutGeo(new V(s * hw(y + 1.1), y + 1.1, 0), new V(s * L, y + 0.4, 0), 0.06));
      if (j === 0 || s < 0) tips.push(new V(s * L, y - 0.6, 0));
    });
  });
  geos.push(strutGeo(new V(0, h, 0), new V(0, h + 1.3, 0), 0.08));
  merged(geos, C.steel, root);
  tips.forEach((t) => { for (let k = 0; k < 4; k++) cyl(0.13, 0.13, 0.05, 8, C.insul, t.x, t.y + 0.15 + k * 0.13, 0, root); });
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => box(0.7, 0.35, 0.7, C.concrete, sx * 1.7, 0.1, sz * 1.7, root));
  bake(root, []);
  return { root, tips: tips.map((t) => t.clone().add(new V(0, 0.08, 0))), h };
}
// Pad-mounted step-up transformer
export function transformer() {
  const root = pickable(new THREE.Group(), 'grid'); root.name = 'Transformer';
  box(2.0, 0.25, 1.6, C.concrete, 0, 0.125, 0, root);
  box(1.3, 1.25, 0.95, C.darkGreen, 0, 0.88, 0, root); box(1.36, 0.08, 1.0, C.green, 0, 1.53, 0, root);
  [-1, 1].forEach((s) => { for (let k = 0; k < 6; k++) box(0.24, 0.95, 0.04, C.darkGreen, s * 0.78, 0.82, -0.36 + k * 0.145, root); });
  const tips = [];
  [-0.38, 0, 0.38].forEach((x) => { for (let k = 0; k < 4; k++) cyl(0.07, 0.07, 0.04, 8, C.bushing, x, 1.65 + k * 0.08, -0.15, root); cyl(0.035, 0.035, 0.42, 6, C.bushing, x, 1.75, -0.15, root); tips.push(new V(x, 2.0, -0.15)); });
  [-0.3, 0, 0.3].forEach((x) => cyl(0.035, 0.04, 0.16, 6, C.dark, x, 1.65, 0.25, root));
  const warn = label(0.5, 0.26, ['DANGER', 'HIGH VOLTAGE'], { bg: '#f2c21f' }); warn.position.set(0, 0.95, 0.477); root.add(warn);
  bake(root, []);
  return { root, tips, lv: new V(0, 1.7, 0.25) };
}
// Battery energy storage container (20 ft) with HVAC fans, status strip and SOC screen
export function batteryContainer() {
  const root = pickable(new THREE.Group(), 'grid'); root.name = 'Battery container';
  const Lx = 6.06, H = 2.44, Wz = 2.44;
  [-2.6, 0, 2.6].forEach((x) => box(0.5, 0.3, 2.6, C.concrete, x, 0.15, 0, root));
  box(Lx, H, Wz, C.white, 0, 0.3 + H / 2, 0, root);
  const ribs = [];
  for (let k = 0; k < 19; k++) { const x = -Lx / 2 + 0.3 + k * 0.3; [-1, 1].forEach((s) => ribs.push(new THREE.BoxGeometry(0.1, H - 0.2, 0.05).translate(x, 0.3 + H / 2, s * (Wz / 2 + 0.02)))); }
  merged(ribs, C.offWhite, root).userData.noOutline = true;
  [-1, 1].forEach((s) => box(Lx + 0.02, 0.12, Wz + 0.06, C.grey, 0, s > 0 ? 0.3 + H - 0.06 : 0.36, 0, root));
  // doors on +x end with locking bars
  [-0.58, 0.58].forEach((z) => { box(0.04, H - 0.25, 1.1, C.offWhite, Lx / 2 + 0.02, 0.3 + H / 2, z, root); [-0.25, 0.25].forEach((dz) => cyl(0.025, 0.025, H - 0.3, 5, C.steel, Lx / 2 + 0.07, 0.3 + H / 2, z + dz, root)); });
  // HVAC units on -x end
  const fans = [];
  [-0.6, 0.6].forEach((z) => {
    box(0.4, 0.9, 0.95, C.grey, -Lx / 2 - 0.2, 1.4, z, root);
    const f = new THREE.Group(); f.position.set(-Lx / 2 - 0.41, 1.4, z); f.rotation.y = -Math.PI / 2; root.add(f);
    put(f, new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), C.black), 0, 0, -0.005).userData.noOutline = true;
    for (let k = 0; k < 4; k++) { const b = box(0.6, 0.08, 0.01, C.dark, 0, 0, 0.005, f); b.rotation.z = k * Math.PI / 4; b.userData.noOutline = true; }
    fans.push(f);
  });
  const socScreen = screen(0.9, 0.5, 256, null); socScreen.mesh.position.set(1.6, 1.85, Wz / 2 + 0.05); root.add(socScreen.mesh);
  const name = label(1.3, 0.32, ['BESS  ·  Fieldworks Power'], { bg: '#2f5a3b', fg: '#f2efe4' }); name.position.set(-1.0, 2.1, Wz / 2 + 0.05); root.add(name);
  const warn = label(0.5, 0.26, ['LITHIUM', 'BATTERIES'], { bg: '#f2c21f' }); warn.position.set(Lx / 2 + 0.045, 1.9, 0); warn.rotation.y = Math.PI / 2; root.add(warn);
  bake(root, fans);
  return { root, socScreen, fans, stripFrom: new V(-2.6, 0.3 + H - 0.2, Wz / 2 + 0.06), stripTo: new V(2.6, 0.3 + H - 0.2, Wz / 2 + 0.06), terminal: new V(0, 0.1, Wz / 2) };
}
// Distribution panel: main breaker and three circuit breakers with handles that move, plus a flow screen
export function distributionPanel(circuits) {
  const root = pickable(new THREE.Group(), 'grid'); root.name = 'Distribution panel';
  box(1.8, 0.2, 0.9, C.concrete, 0, 0.1, 0, root);
  box(1.5, 1.85, 0.48, C.grey, 0, 1.13, 0, root); box(1.6, 0.08, 0.6, C.dark, 0, 2.1, 0.04, root);
  box(1.42, 1.77, 0.02, C.offWhite, 0, 1.13, 0.25, root);
  const flowScreen = screen(1.1, 0.52, 384, root, 0, 1.68, 0.265);
  const breakers = {};
  ['main', ...circuits].forEach((k, i) => {
    const g = new THREE.Group(); g.position.set(-0.56 + i * 0.28, 0.95, 0.27); root.add(g);
    box(0.2, 0.34, 0.06, C.black, 0, 0, 0, g);
    const handle = new THREE.Group(); g.add(handle);
    box(0.08, 0.16, 0.06, k === 'main' ? C.red : C.dark, 0, 0.08, 0.05, handle);
    const l = label(0.24, 0.08, [k.toUpperCase()], { bg: '#f2efe4' }); l.position.set(0, -0.28, 0.035); g.add(l);
    breakers[k] = { g, handle, led: new V(0, 0.24, 0.04) };
  });
  bake(root, Object.values(breakers).map((b) => b.handle));
  return { root, flowScreen, breakers, terminal: new V(0, 0.1, 0) };
}
export function lampPost() {
  const root = new THREE.Group(); root.name = 'Yard light';
  box(0.4, 0.2, 0.4, C.concrete, 0, 0.1, 0, root);
  cyl(0.06, 0.09, 5.2, 6, C.dark, 0, 2.7, 0, root);
  box(1.0, 0.07, 0.07, C.dark, 0.45, 5.2, 0, root);
  box(0.55, 0.12, 0.3, C.dark, 0.9, 5.15, 0, root);
  const lens = put(root, new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.22).rotateX(Math.PI / 2), C.lamp), 0.9, 5.085, 0);
  lens.userData.noOutline = true;
  bake(root, [lens]);
  return { root, lens, lightPos: new V(0.9, 4.9, 0) };
}

// ---------------------------------------------------------------------------
// UTILITY TRUCK (drives on cannon-es RaycastVehicle suspension)
export function truck() {
  const root = pickable(new THREE.Group(), 'truck'); root.name = 'Utility truck';
  const body = new THREE.Group(); root.add(body);          // chassis frame, centre of mass at origin
  box(1.7, 0.36, 4.3, C.red, 0, 0.12, 0.05, body);
  box(1.66, 0.62, 1.35, C.red, 0, 0.6, 1.25, body);          // bonnet and engine bay
  box(1.66, 0.75, 1.5, C.red, 0, 0.82, -0.05, body);          // cab
  box(1.5, 0.5, 0.05, C.glass, 0, 1.0, 0.71, body).rotation.x = -0.35;
  [-1, 1].forEach((s) => box(0.05, 0.42, 1.0, C.glass, s * 0.835, 1.0, -0.05, body));
  box(1.68, 0.06, 1.55, C.dark, 0, 1.22, -0.05, body);
  // load bed
  box(1.7, 0.08, 1.9, C.dark, 0, 0.34, -1.85, body);
  [-1, 1].forEach((s) => box(0.07, 0.42, 1.9, C.red, s * 0.82, 0.58, -1.85, body));
  box(1.7, 0.42, 0.07, C.red, 0, 0.58, -2.78, body); box(1.7, 0.5, 0.07, C.dark, 0, 0.62, -0.88, body);
  box(1.72, 0.2, 0.12, C.grey, 0, 0.05, 2.25, body); box(1.72, 0.2, 0.12, C.grey, 0, 0.05, -2.82, body);
  const head = [-0.6, 0.6].map((x) => box(0.28, 0.14, 0.04, C.lamp, x, 0.58, 1.93, body));
  head.forEach((m) => { m.userData.noOutline = true; });
  [-0.7, 0.7].forEach((x) => box(0.2, 0.1, 0.04, C.red, x, 0.5, -2.82, body).material = flat('#ff3b2b', { roughness: 0.3 }));
  box(0.7, 0.1, 0.25, C.orange, 0, 1.3, -0.2, body);         // roof beacon bar
  const wheels = [];
  [[0.82, 1.35], [-0.82, 1.35], [0.82, -1.65], [-0.82, -1.65]].forEach(([x, z]) => {
    const w = new THREE.Group(); root.add(w);
    cylAxis(0.42, 0.3, 12, C.tire, 'x', 0, 0, 0, w); cylAxis(0.25, 0.32, 8, C.rim, 'x', 0, 0, 0, w);
    for (let k = 0; k < 5; k++) { const a = k * 1.2566; box(0.34, 0.05, 0.05, C.dark, 0, Math.cos(a) * 0.15, Math.sin(a) * 0.15, w).rotation.x = a; }
    wheels.push({ g: w, x, z });
  });
  wheels.forEach((w) => bake(w.g, [])); bake(root, [...wheels.map((w) => w.g), ...head]);
  return { root, body, wheels, headlights: head };
}

// ---------------------------------------------------------------------------
// PHYSICS PROPS
export function crate() {
  const g = new THREE.Group(); g.name = 'Crate';
  box(0.7, 0.7, 0.7, C.wood, 0, 0, 0, g);
  const e = [], s = 0.36, t = 0.07;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { e.push(new THREE.BoxGeometry(t, 0.72, t).translate(a * s, 0, b * s)); e.push(new THREE.BoxGeometry(0.72, t, t).translate(0, a * s, b * s)); e.push(new THREE.BoxGeometry(t, t, 0.72).translate(a * s, b * s, 0)); });
  merged(e, C.woodDark, g);
  return bake(g, []);
}
export function barrel(color) {
  const g = new THREE.Group(); g.name = 'Barrel';
  cyl(0.29, 0.29, 0.88, 10, flat(color || '#2e6aa8', { roughness: 0.45, metalness: 0.3 }), 0, 0, 0, g);
  [-0.3, 0, 0.3].forEach((y) => cyl(0.3, 0.3, 0.05, 10, C.dark, 0, y, 0, g));
  cyl(0.05, 0.05, 0.03, 6, C.dark, 0.14, 0.44, 0, g);
  return bake(g, []);
}
export function pumpkin(seed) {
  const g = new THREE.Group(); g.name = 'Pumpkin';
  const geo = new THREE.IcosahedronGeometry(0.27, 1); let s = seed || 5;
  const p = geo.attributes.position, r = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
  const map = new Map();
  for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!map.has(k)) map.set(k, 1 + r() * 0.12); const f = map.get(k); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.74, p.getZ(i) * f); }
  geo.computeVertexNormals();
  put(g, new THREE.Mesh(geo, C.pumpkin));
  cyl(0.025, 0.04, 0.12, 5, C.stem, 0, 0.23, 0, g).rotation.z = 0.3;
  return g;
}
export function hayBale() {
  const g = new THREE.Group(); g.name = 'Hay bale';
  cylAxis(0.6, 1.1, 12, C.hay, 'x', 0, 0, 0, g);
  [-1, 1].forEach((s) => cylAxis(0.52, 0.02, 12, C.hayEnd, 'x', s * 0.555, 0, 0, g));
  [-0.3, 0, 0.3].forEach((x) => put(g, new THREE.Mesh(new THREE.TorusGeometry(0.605, 0.012, 3, 14).rotateY(Math.PI / 2), C.dark), x, 0, 0).userData.noOutline = true);
  return bake(g, []);
}
export function waterTrough() {
  const g = new THREE.Group(); g.name = 'Water trough';
  box(2.2, 0.08, 0.8, C.steel, 0, 0.45, 0, g);
  [-1, 1].forEach((s) => { box(2.2, 0.45, 0.06, C.steel, 0, 0.66, s * 0.38, g); box(0.06, 0.45, 0.8, C.steel, s * 1.08, 0.66, 0, g); });
  [-0.9, 0.9].forEach((x) => box(0.12, 0.45, 0.7, C.dark, x, 0.22, 0, g));
  const water = box(2.08, 0.02, 0.68, C.water, 0, 0.75, 0, g); water.userData.noOutline = true;
  bake(g, [water]);
  return { root: g, water };
}

// ---------------------------------------------------------------------------
// LOW-POLY CROP FIELD with per-plant colour: dry plants are pale, freshly sprayed plants turn deep green
export function cropField(F, scene) {
  const W = F.x1 - F.x0, D = F.z1 - F.z0, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2;
  const soil = box(W + 0.6, 0.1, D + 0.6, flat('#7a5636', { roughness: 1 }), cx, 0.03, cz, scene); soil.castShadow = false;
  const rows = Math.round(D / 0.5), ridges = [];
  for (let j = 0; j < rows; j++) ridges.push(new THREE.BoxGeometry(W, 0.1, 0.24).translate(cx, 0.1, F.z0 + (j + 0.5) * D / rows));
  const ridge = merged(ridges, flat('#8a6340', { roughness: 1 }), scene); ridge.castShadow = false;
  // plant: four flattened leaves around a short stem
  const leaves = [];
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + 0.3, l = new THREE.ConeGeometry(0.07, 0.36, 3);
    l.translate(0, 0.18, 0); l.scale(1, 1, 0.45); l.rotateX(0.75); l.rotateY(a); leaves.push(l);
  }
  leaves.push(new THREE.ConeGeometry(0.06, 0.3, 4).translate(0, 0.15, 0));
  const geo = mergeBufferGeometries(leaves.map((g) => g.toNonIndexed()), false); geo.computeVertexNormals();
  const per = Math.floor(W / 0.36), n = per * rows;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, flatShading: true }); mat.userData.lowpoly = true;
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.castShadow = true; mesh.receiveShadow = true;
  const plants = []; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V();
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let j = 0, i = 0; j < rows; j++) for (let k = 0; k < per; k++, i++) {
    const x = F.x0 + (k + 0.5) * W / per + (r() - 0.5) * 0.06, z = F.z0 + (j + 0.5) * D / rows + (r() - 0.5) * 0.05, size = 0.8 + r() * 0.45;
    q.setFromAxisAngle(new V(0, 1, 0), r() * 6.28); sc.set(size, size * (0.85 + r() * 0.3), size);
    m4.compose(new V(x, 0.14, z), q, sc); mesh.setMatrixAt(i, m4);
    plants.push({ x, z, wet: 0.15 + r() * 0.1, shade: r() });
  }
  scene.add(mesh);
  const dry = lin('#c2b25e'), wet = lin('#3d9a3a'), tmp = new THREE.Color();
  function paint() { plants.forEach((p, i) => { tmp.copy(dry).lerp(wet, Math.min(1, p.wet)).multiplyScalar(0.9 + p.shade * 0.2); mesh.setColorAt(i, tmp); }); mesh.instanceColor.needsUpdate = true; }
  paint();
  return {
    mesh, plants,
    wetness() { let a = 0; plants.forEach((p) => { a += Math.min(1, p.wet); }); return a / plants.length; },
    // spray: drone position, swath, wet the plants under the boom; dry: game seconds of drying
    update(simDt, dronePos, swath, spraying) {
      const k = simDt / (3 * 3600);
      plants.forEach((p) => {
        p.wet = Math.max(0, p.wet - k);
        if (spraying && Math.abs(p.z - dronePos.z) < swath / 2 && Math.abs(p.x - dronePos.x) < 0.5) p.wet = 1;
      });
    },
    paint
  };
}
