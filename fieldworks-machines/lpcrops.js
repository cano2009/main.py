// Fieldworks low-poly crops: growth stages for the field and harvested items (dirty and washed) for the line.
// Clean faceted shapes with vertex colours (one material for everything), matching the low-poly reference art.
// Crops: radish, carrot, wheat (tied sheaf), cabbage, pumpkin, corn. Units are metres. three.js r147.

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const M = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), new THREE.Vector3(sx || 1, sy === undefined ? (sx || 1) : sy, sz === undefined ? (sx || 1) : sz));

class Kit {
  constructor(seed) { this.list = []; this.s = seed || 7; }
  r() { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; }
  add(geo, hex, m, jitter) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    ['uv', 'uv2', 'normal'].forEach((a) => g.attributes[a] && g.deleteAttribute(a));
    const c = lin(hex), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let f = 0; f < n; f += 3) {                                // slight per-face shade variation, like hand-painted facets
      const k = 1 + (jitter === undefined ? 0.06 : jitter) * (this.r() - 0.5) * 2;
      for (let j = 0; j < 3; j++) col.set([c.r * k, c.g * k, c.b * k], (f + j) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(g); return this;
  }
  build() { const g = mergeBufferGeometries(this.list, false); g.computeVertexNormals(); g.computeBoundingBox(); return g; }
}
// a faceted leaf: a flat 4-sided spike, base at the origin, pointing up (+y)
const leafGeo = (len, w) => new THREE.ConeGeometry(w, len, 4, 1).translate(0, len / 2, 0).scale(1, 1, 0.28);
function leaves(k, n, len, w, hex, tilt, y, seed) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (seed || 0), t = tilt * (0.8 + k.r() * 0.4), l = len * (0.8 + k.r() * 0.35);
    k.add(leafGeo(l, w), i % 2 ? hex : shade(hex, 0.9), M(0, y || 0, 0, t, a, 0));
  }
}
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }
const SOIL = '#6e4c30', LEAF = '#86bd45', LEAF2 = '#6fa83a', DARK_LEAF = '#5c9233';
const mound = (k) => k.add(new THREE.IcosahedronGeometry(0.09, 0), SOIL, M(0, -0.02, 0, 0, 0, 0, 1, 0.35, 1));

// ---------------------------------------------------------------------------
// harvested items (sit on y = 0)
const ITEM = {
  radish(k) {
    k.add(new THREE.IcosahedronGeometry(0.07, 0), '#d6404c', M(0, 0.07, 0, 0, 0, 0, 1, 0.92, 1));
    k.add(new THREE.ConeGeometry(0.03, 0.09, 5), '#f2ece4', M(0.075, 0.06, 0, 0, 0, Math.PI / 2 + 0.2));
    for (let i = 0; i < 4; i++) k.add(leafGeo(0.2, 0.035), i % 2 ? LEAF : LEAF2, M(-0.06, 0.08, 0, 0.3 * (i - 1.5), 0, Math.PI / 2 + 0.25));
  },
  carrot(k) {
    k.add(new THREE.ConeGeometry(0.042, 0.24, 6), '#ee7d22', M(0.04, 0.042, 0, 0, 0, Math.PI / 2));
    k.add(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 6), '#e06e18', M(-0.09, 0.042, 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 4; i++) k.add(leafGeo(0.18, 0.03), i % 2 ? LEAF : LEAF2, M(-0.1, 0.045, 0, 0.35 * (i - 1.5), 0, Math.PI / 2 + 0.2));
  },
  wheat(k) {   // sheaf tied with twine, lying on its side
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, rr = 0.025 + k.r() * 0.02, fan = 0.12 + k.r() * 0.1;
      const x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr;
      k.add(new THREE.BoxGeometry(0.016, 0.5, 0.016), i % 2 ? '#d8b11c' : '#c99f15', M(0.04 + x0, 0.25, z0, Math.sin(a) * fan, 0, -Math.cos(a) * fan * 0.6));
      k.add(new THREE.OctahedronGeometry(0.035, 0), '#dcb520', M(0.04 + x0 + Math.cos(a) * fan * 0.5, 0.52, z0 + Math.sin(a) * fan * 0.5, 0, k.r() * 3, 0, 0.9, 1.7, 0.9));
    }
    k.add(new THREE.TorusGeometry(0.05, 0.011, 3, 7), '#c9b27a', M(0.04, 0.19, 0, Math.PI / 2, 0, 0));
  },
  cabbage(k) {
    k.add(new THREE.IcosahedronGeometry(0.12, 1), '#a9cf6a', M(0, 0.11, 0, 0, 0, 0, 1, 0.9, 1));
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; k.add(new THREE.SphereGeometry(0.1, 5, 3, 0, Math.PI), i % 2 ? '#79ad44' : '#6e9f3c', M(Math.cos(a) * 0.06, 0.1, Math.sin(a) * 0.06, 0.2, -a + Math.PI / 2, 0, 1, 1.1, 0.5)); }
  },
  pumpkin(k) {
    const g = new THREE.IcosahedronGeometry(0.22, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), rib = 1 + 0.07 * Math.cos(a * 8); p.setXYZ(i, x * rib, p.getY(i) * 0.72, z * rib); }
    k.add(g, '#ee7f1f', M(0, 0.16, 0));
    k.add(new THREE.CylinderGeometry(0.02, 0.035, 0.1, 5), '#5f7a2a', M(0.01, 0.34, 0, 0, 0, 0.3));
    k.add(leafGeo(0.14, 0.05), LEAF2, M(0.02, 0.31, 0.02, 1.2, 0.6, 0));
  },
  corn(k) {
    k.add(new THREE.CylinderGeometry(0.038, 0.032, 0.24, 7), '#f2c832', M(0, 0.04, 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 3; i++) k.add(leafGeo(0.26, 0.04), i ? '#9cc65a' : '#86b54a', M(-0.14, 0.04, 0, (i - 1) * 0.6, 0, -Math.PI / 2 + 0.15, 1, 1, 0.9));
  }
  ,
  potato(k) { const g = new THREE.IcosahedronGeometry(0.075, 1); g.scale(1.25, 0.85, 1); k.add(g, '#b98a55', M(0, 0.065, 0)); [[0.05, 0.1, 0.03], [-0.04, 0.12, -0.03], [0.0, 0.07, 0.07]].forEach(([x, y, z]) => k.add(new THREE.IcosahedronGeometry(0.008, 0), '#7a5a35', M(x, y, z))); },
  tomato(k) { k.add(new THREE.IcosahedronGeometry(0.075, 1), '#d93a2a', M(0, 0.07, 0, 0, 0, 0, 1, 0.85, 1)); for (let i = 0; i < 5; i++) k.add(leafGeo(0.05, 0.015), '#3f8a2e', M(0, 0.13, 0, 1.3, i * 1.257, 0)); k.add(new THREE.CylinderGeometry(0.008, 0.01, 0.04, 5), '#3f8a2e', M(0, 0.15, 0)); },
  lettuce(k) { k.add(new THREE.IcosahedronGeometry(0.1, 1), '#b5d977', M(0, 0.09, 0, 0, 0, 0, 1, 0.8, 1)); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; k.add(new THREE.SphereGeometry(0.11, 5, 3, 0, Math.PI), i % 2 ? '#8cc24f' : '#9dce5a', M(Math.cos(a) * 0.05, 0.08, Math.sin(a) * 0.05, 0.4, -a + Math.PI / 2, 0, 1, 0.9, 0.45)); } },
  rice(k) { for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28, f = 0.1 + k.r() * 0.1; k.add(new THREE.BoxGeometry(0.01, 0.45, 0.01), '#d9c27a', M(Math.cos(a) * 0.02, 0.22, Math.sin(a) * 0.02, Math.sin(a) * f, 0, -Math.cos(a) * f * 0.6)); k.add(new THREE.OctahedronGeometry(0.022, 0), '#e9d48f', M(Math.cos(a) * (0.02 + f * 0.22), 0.45, Math.sin(a) * (0.02 + f * 0.22), 0.6, a, 0, 0.7, 1.9, 0.7)); } k.add(new THREE.TorusGeometry(0.035, 0.01, 3, 7), '#c9b27a', M(0, 0.17, 0, Math.PI / 2, 0, 0)); },
  cotton(k) { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; k.add(new THREE.IcosahedronGeometry(0.05, 0), '#f4f2ea', M(Math.cos(a) * 0.045, 0.06 + (i % 2) * 0.03, Math.sin(a) * 0.045)); } k.add(new THREE.IcosahedronGeometry(0.055, 0), '#ffffff', M(0, 0.11, 0)); for (let i = 0; i < 4; i++) k.add(leafGeo(0.06, 0.02), '#6b4a2c', M(0, 0.02, 0, 1.4, i * 1.57, 0)); },
  sunflower(k) { k.add(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10), '#6b4423', M(0, 0.03, 0)); for (let i = 0; i < 12; i++) k.add(leafGeo(0.09, 0.03), '#f2c418', M(Math.cos(i * 0.5236) * 0.1, 0.02, Math.sin(i * 0.5236) * 0.1, Math.PI / 2, -i * 0.5236 + Math.PI / 2, 0, 1, 1, 0.5)); },
  soybean(k) { for (let i = 0; i < 7; i++) { const a = i * 0.9; k.add(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.018, 0.07, 2, 6) : new THREE.CylinderGeometry(0.018, 0.018, 0.08, 6), '#b9a25a', M(Math.cos(a) * 0.04, 0.03 + (i % 3) * 0.02, Math.sin(a) * 0.04, Math.PI / 2, a, 0.3)); } },
  berry(k) { for (let i = 0; i < 6; i++) { const a = i * 1.05, x = Math.cos(a) * 0.05, z = Math.sin(a) * 0.05; k.add(new THREE.ConeGeometry(0.035, 0.06, 6).rotateX(Math.PI), '#d8263a', M(x, 0.04 + (i % 2) * 0.02, z)); k.add(leafGeo(0.025, 0.012), '#3f8a2e', M(x, 0.075 + (i % 2) * 0.02, z, 1.2, a, 0)); } },
  flour(k) { k.add(new THREE.BoxGeometry(0.3, 0.38, 0.18), '#efe8d6', M(0, 0.19, 0)); k.add(new THREE.BoxGeometry(0.22, 0.06, 0.12), '#e3dac4', M(0, 0.41, 0)); k.add(new THREE.BoxGeometry(0.2, 0.12, 0.005), '#3f7d4c', M(0, 0.2, 0.093)); },
  cornmeal(k) { k.add(new THREE.BoxGeometry(0.3, 0.38, 0.18), '#e9c64a', M(0, 0.19, 0)); k.add(new THREE.BoxGeometry(0.22, 0.06, 0.12), '#d9b43a', M(0, 0.41, 0)); k.add(new THREE.BoxGeometry(0.2, 0.12, 0.005), '#3f7d4c', M(0, 0.2, 0.093)); },
  bread(k) { k.add(new THREE.BoxGeometry(0.4, 0.03, 0.3), '#8d9396', M(0, 0.015, 0)); [-0.1, 0.1].forEach((x) => { const g = new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.06, 0.14, 2, 8) : new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8); g.rotateX(Math.PI / 2); g.scale(1, 0.75, 1); k.add(g, '#c98a3e', M(x, 0.075, 0)); k.add(new THREE.BoxGeometry(0.02, 0.01, 0.1), '#e8c48a', M(x, 0.12, 0)); }); }
};
const cache = new Map();
/** item(crop, dirty): geometry of a harvested item, bottom at y = 0, roughly centred */
export function item(crop, dirty) {
  const key = crop + (dirty ? 'd' : 'c');
  if (cache.has(key)) return cache.get(key);
  const k = new Kit(crop.length * 31 + 5); ITEM[crop](k);
  const g = k.build();
  if (crop === 'wheat') g.applyMatrix4(M(0, 0.07, 0, 0, 0, -Math.PI / 2));   // lay the sheaf down
  g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  if (dirty) {   // patches of field soil on the skin
    const c = g.attributes.color, mud = lin('#6b4a2c'); let s = 3;
    for (let f = 0; f < c.count; f += 3) { s = (s * 16807) % 2147483647; const w = (s / 2147483647) < 0.45 ? 0.75 : 0.3; for (let j = 0; j < 3; j++) c.setXYZ(f + j, c.getX(f + j) * (1 - w) + mud.r * w, c.getY(f + j) * (1 - w) + mud.g * w, c.getZ(f + j) * (1 - w) + mud.b * w); }
  }
  cache.set(key, g); return g;
}

// ---------------------------------------------------------------------------
// plant growth stages for the field: 0 sprout, 1 young, 2 growing, 3 ready to harvest
// ---------------------------------------------------------------------------
// growth stages: 0 seed, 1 sprout, 2 young, 3 growing, 4 mature, 5 ready to harvest, 6 harvested (stubble)
export const STAGE_NAMES = ['Seed', 'Sprout', 'Young', 'Growing', 'Mature', 'Ready', 'Harvested'];
function seedMound(k) { mound(k); k.add(new THREE.IcosahedronGeometry(0.02, 0), '#d8c38a', M(0.02, 0.015, 0.01, 0, 0, 0, 1.4, 0.8, 1)); }
function stalk(k, h, col, x, z, lean, a) { k.add(new THREE.BoxGeometry(0.014, h, 0.014).translate(0, h / 2, 0), col, M(x || 0, 0, z || 0, Math.sin(a || 0) * (lean || 0), 0, -Math.cos(a || 0) * (lean || 0))); }
const GROW = {
  radish(k, st, f) { leaves(k, 3 + st, 0.26 * f, 0.04 * f + 0.01, LEAF, 0.55, 0, 0.2); if (st >= 4) k.add(new THREE.IcosahedronGeometry(st === 5 ? 0.06 : 0.04, 0), st === 5 ? '#d6404c' : '#e7949b', M(0, 0.0, 0, 0, 0, 0, 1, 0.8, 1)); },
  carrot(k, st, f) { leaves(k, 3 + st, 0.3 * f, 0.026, DARK_LEAF, 0.4, 0, 0.1); if (st >= 4) k.add(new THREE.CylinderGeometry(0.038, 0.036, 0.04, 6), '#ee7d22', M(0, 0.005, 0)); },
  potato(k, st, f) { for (let i = 0; i < 2 + st; i++) { const a = i * 2.4; k.add(new THREE.IcosahedronGeometry(0.07 * f + 0.02, 0), st === 5 ? '#9fae4a' : i % 2 ? LEAF : LEAF2, M(Math.cos(a) * 0.08 * f, 0.1 * f + 0.04, Math.sin(a) * 0.08 * f, 0, 0, 0, 1, 0.7, 1)); stalk(k, 0.12 * f + 0.04, DARK_LEAF, 0, 0, 0.5, a); } if (st === 4) for (let i = 0; i < 3; i++) k.add(new THREE.IcosahedronGeometry(0.018, 0), '#f4f0e6', M(Math.cos(i * 2) * 0.06, 0.24, Math.sin(i * 2) * 0.06)); if (st === 5) [[0.1, 0.04], [-0.08, -0.06]].forEach(([x, z]) => k.add(new THREE.IcosahedronGeometry(0.045, 0), '#b98a55', M(x, 0.015, z, 0, 0, 0, 1.2, 0.8, 1))); },
  tomato(k, st, f) { const h = 0.55 * f + 0.1; k.add(new THREE.BoxGeometry(0.02, h + 0.15, 0.02).translate(0, (h + 0.15) / 2, 0), '#a7804f', M(0.05, 0, 0)); stalk(k, h, DARK_LEAF); for (let i = 0; i < 2 + st; i++) k.add(leafGeo(0.1 * f + 0.04, 0.035), i % 2 ? LEAF : LEAF2, M(0, h * (0.25 + i * 0.12), 0, 1.0, i * 2.3, 0)); if (st >= 4) for (let i = 0; i < 4; i++) k.add(new THREE.IcosahedronGeometry(0.035, 0), st === 5 ? (i === 3 ? '#e9792c' : '#d93a2a') : '#8cbf4a', M(Math.cos(i * 1.6) * 0.07, h * (0.35 + i * 0.12), Math.sin(i * 1.6) * 0.07)); },
  lettuce(k, st, f) { for (let i = 0; i < 3 + st; i++) { const a = i / (3 + st) * 6.28; k.add(new THREE.SphereGeometry(0.1 * f + 0.03, 5, 3, 0, Math.PI), i % 2 ? '#8cc24f' : '#9dce5a', M(Math.cos(a) * 0.05 * f, 0.05 * f, Math.sin(a) * 0.05 * f, 0.6, -a + Math.PI / 2, 0, 1, 0.9, 0.45)); } if (st >= 4) k.add(new THREE.IcosahedronGeometry(0.08 * f, 1), '#b5d977', M(0, 0.07, 0, 0, 0, 0, 1, 0.8, 1)); },
  cabbage(k, st, f) { leaves(k, 3 + st, 0.24 * f, 0.08 * f + 0.02, '#79ad44', 1.0, 0, 0); if (st >= 3) k.add(new THREE.IcosahedronGeometry(st === 5 ? 0.13 : 0.06 + 0.02 * (st - 3), 1), '#a9cf6a', M(0, 0.06 + 0.02 * (st - 3), 0, 0, 0, 0, 1, 0.85, 1)); },
  wheat(k, st, f) { const n = 3 + st, h = 0.65 * f, col = st === 5 ? '#d8b11c' : st === 4 ? '#b9c24a' : '#8fbf4a'; for (let i = 0; i < n; i++) { const a = i / n * 6.28, lean = 0.12 + k.r() * 0.1; stalk(k, h, col, Math.cos(a) * 0.04, Math.sin(a) * 0.04, lean, a); if (st >= 3) k.add(new THREE.OctahedronGeometry(0.03, 0), st === 5 ? '#e2bb24' : '#a9cc5c', M(Math.cos(a) * (0.04 + lean * h * 0.9), h * 0.97, Math.sin(a) * (0.04 + lean * h * 0.9), 0, a, 0, 0.8, 1.8, 0.8)); } },
  rice(k, st, f) { const n = 4 + st * 2, h = 0.6 * f, col = st === 5 ? '#d9c27a' : '#7fb34a'; for (let i = 0; i < n; i++) { const a = i / n * 6.28, lean = 0.18 + k.r() * 0.1; stalk(k, h, col, Math.cos(a) * 0.03, Math.sin(a) * 0.03, lean, a); if (st >= 4) k.add(new THREE.OctahedronGeometry(0.022, 0), st === 5 ? '#e9d48f' : '#b7d07a', M(Math.cos(a) * (0.03 + lean * h * 1.1), h * 0.88, Math.sin(a) * (0.03 + lean * h * 1.1), 0.9, a, 0, 0.7, 1.9, 0.7)); } },
  corn(k, st, f) { const h = 1.4 * f + 0.1; k.add(new THREE.CylinderGeometry(0.018, 0.026, h, 5).translate(0, h / 2, 0), st === 5 ? '#a8b552' : '#7fae3e'); for (let i = 0; i < 2 + st; i++) k.add(leafGeo(h * 0.42, 0.035), i % 2 ? LEAF : DARK_LEAF, M(0, h * (0.12 + i * 0.11), 0, 0.9, i * 2.4, 0)); if (st >= 4) { k.add(new THREE.CylinderGeometry(0.035, 0.03, 0.2, 6), st === 5 ? '#f2c832' : '#9cc65a', M(0.05, h * 0.55, 0, 0, 0, -0.35)); k.add(leafGeo(0.18, 0.03), '#d8c37a', M(0, h, 0)); } },
  cotton(k, st, f) { const h = 0.6 * f + 0.05; stalk(k, h, '#6b5a3a'); for (let i = 0; i < 2 + st; i++) { const a = i * 2.2, y = h * (0.3 + i * 0.1); k.add(leafGeo(0.1 * f + 0.03, 0.04), st === 5 ? '#8a7a45' : LEAF2, M(0, y, 0, 1.1, a, 0)); if (st === 4) k.add(new THREE.IcosahedronGeometry(0.03, 0), '#e9a3c0', M(Math.cos(a) * 0.08, y + 0.03, Math.sin(a) * 0.08)); if (st === 5) k.add(new THREE.IcosahedronGeometry(0.045, 0), '#f6f4ee', M(Math.cos(a) * 0.08, y + 0.04, Math.sin(a) * 0.08)); } },
  sunflower(k, st, f) { const h = 1.5 * f + 0.1; k.add(new THREE.CylinderGeometry(0.018, 0.028, h, 5).translate(0, h / 2, 0), '#6fa83a'); for (let i = 0; i < 2 + st; i++) k.add(new THREE.CylinderGeometry(0.09 * f + 0.03, 0.01, 0.01, 6), i % 2 ? LEAF : LEAF2, M(Math.cos(i * 2.1) * 0.08, h * (0.2 + i * 0.12), Math.sin(i * 2.1) * 0.08, 0.5, i * 2.1, 0)); if (st === 4) k.add(new THREE.IcosahedronGeometry(0.06, 0), '#7fae3e', M(0, h + 0.03, 0)); if (st === 5) { const tilt = M(0, h, 0.06, Math.PI / 2 - 0.4, 0, 0); const disc = new THREE.CylinderGeometry(0.11, 0.1, 0.04, 10); k.add(disc, '#6b4423', tilt); for (let i = 0; i < 12; i++) { const a = i * 0.5236, m = new THREE.Matrix4().multiplyMatrices(tilt, M(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15, 0, -a, 0, 1, 0.3, 0.6)); k.add(new THREE.ConeGeometry(0.045, 0.1, 4).rotateZ(Math.PI / 2), '#f2c418', m); } } },
  soybean(k, st, f) { for (let i = 0; i < 3 + st; i++) { const a = i * 1.9, y = 0.06 + i * 0.035 * f; stalk(k, 0.3 * f + 0.05, st === 5 ? '#9a8a4a' : DARK_LEAF, 0, 0, 0.3, a); for (let j = 0; j < 3; j++) k.add(new THREE.CylinderGeometry(0.035 * f + 0.01, 0.005, 0.008, 5), st === 5 ? '#b9a25a' : i % 2 ? LEAF : LEAF2, M(Math.cos(a + j * 0.7) * 0.09 * f, y + 0.12 * f, Math.sin(a + j * 0.7) * 0.09 * f, 0.4, a, 0)); if (st >= 4) k.add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 5), st === 5 ? '#b9a25a' : '#8cbf4a', M(Math.cos(a) * 0.04, y, Math.sin(a) * 0.04, 0.3, a, 1.2)); } },
  berry(k, st, f) { for (let i = 0; i < 2 + st; i++) { const a = i * 2.4; for (let j = 0; j < 3; j++) k.add(new THREE.CylinderGeometry(0.04 * f + 0.012, 0.005, 0.008, 6), i % 2 ? '#4f9a35' : '#5ea83c', M(Math.cos(a) * 0.07 * f + Math.cos(a + j * 2.1) * 0.03, 0.07 * f + 0.03, Math.sin(a) * 0.07 * f + Math.sin(a + j * 2.1) * 0.03, 0.3, a, 0)); } if (st === 4) for (let i = 0; i < 3; i++) k.add(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 5), '#f7f4ea', M(Math.cos(i * 2) * 0.06, 0.09, Math.sin(i * 2) * 0.06)); if (st === 5) for (let i = 0; i < 4; i++) k.add(new THREE.ConeGeometry(0.025, 0.045, 6).rotateX(Math.PI), '#d8263a', M(Math.cos(i * 1.6) * 0.09, 0.03, Math.sin(i * 1.6) * 0.09)); },
  pumpkin(k, st, f) { for (let i = 0; i < 2 + st; i++) { const a = i / (2 + st) * 6.28; k.add(new THREE.CylinderGeometry(0.13 * f + 0.03, 0.01, 0.02, 5), i % 2 ? LEAF : LEAF2, M(Math.cos(a) * 0.2 * f, 0.16 * f + 0.02, Math.sin(a) * 0.2 * f, 0.3, a, 0)); stalk(k, 0.16 * f + 0.02, DARK_LEAF, Math.cos(a) * 0.06 * f, Math.sin(a) * 0.06 * f, 0.7, a); } if (st >= 3) { const g = new THREE.IcosahedronGeometry(st === 5 ? 0.2 : st === 4 ? 0.13 : 0.07, 1); g.scale(1, 0.72, 1); k.add(g, st === 5 ? '#ee7f1f' : st === 4 ? '#c9b04a' : '#9cc04a', M(0.18, st === 5 ? 0.13 : 0.08, 0.1)); } }
};
function plantStage(crop, st, k) {
  if (st === 0) { seedMound(k); return; }
  if (st === 1) { mound(k); leaves(k, 2, 0.08, 0.02, LEAF, 0.5, 0, 0.4); return; }
  if (st === 6) {   // harvested: cut stubble on disturbed soil
    mound(k); k.add(new THREE.IcosahedronGeometry(0.05, 0), SOIL, M(0.07, -0.01, 0.04, 0, 0, 0, 1, 0.5, 1));
    if (/wheat|rice|corn|sunflower|cotton|soybean|tomato/.test(crop)) for (let i = 0; i < 5; i++) stalk(k, 0.06 + k.r() * 0.04, '#b59a52', Math.cos(i * 1.3) * 0.04, Math.sin(i * 1.3) * 0.04, 0.15, i);
    return;
  }
  const f = [0.32, 0.55, 0.8, 1][st - 2];
  GROW[crop](k, st, f);
  if (st < 5 || /radish|carrot|potato|cabbage|lettuce|berry/.test(crop)) mound(k);
}
/** stages(crop): seven geometries for the field (see STAGE_NAMES) */
export function stages(crop) {
  const key = 'st_' + crop;
  if (cache.has(key)) return cache.get(key);
  const out = [0, 1, 2, 3, 4, 5, 6].map((st) => { const k = new Kit(st * 13 + crop.length); plantStage(crop, st, k); return k.build(); });
  cache.set(key, out); return out;
}
/** A ploughed clod of soil for tilled, not yet sown ground. */
export function tilledGeo() { if (cache.has('tilled')) return cache.get('tilled'); const k = new Kit(5); k.add(new THREE.IcosahedronGeometry(0.11, 0), '#5a3c22', M(0, -0.01, 0, 0, 0, 0, 1.3, 0.35, 0.9)); k.add(new THREE.IcosahedronGeometry(0.06, 0), '#654428', M(0.09, 0.0, 0.05, 0, 0, 0, 1, 0.5, 1)); const g = k.build(); cache.set('tilled', g); return g; }
let shared = null;
/** One flat-shaded vertex-colour material for every crop mesh. */
export function material() {
  if (shared) return shared;
  shared = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0 });
  shared.userData.lowpoly = true;
  return shared;
}
export const CROP_KEYS = ['radish', 'carrot', 'potato', 'tomato', 'lettuce', 'cabbage', 'wheat', 'rice', 'corn', 'cotton', 'sunflower', 'soybean', 'berry', 'pumpkin'];
