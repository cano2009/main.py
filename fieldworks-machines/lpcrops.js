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
function plantStage(crop, st, k) {
  if (st === 0) { mound(k); leaves(k, 2, 0.08, 0.02, LEAF, 0.5, 0, 0.4); return; }
  const young = st === 1;
  switch (crop) {
    case 'radish':
      leaves(k, young ? 3 : 5, young ? 0.13 : 0.24, young ? 0.025 : 0.04, LEAF, 0.55, 0, 0.2);
      if (st === 3) { k.add(new THREE.IcosahedronGeometry(0.06, 0), '#d6404c', M(0, 0.0, 0, 0, 0, 0, 1, 0.8, 1)); } break;
    case 'carrot':
      leaves(k, young ? 3 : 6, young ? 0.14 : 0.28, young ? 0.018 : 0.026, DARK_LEAF, 0.4, 0, 0.1);
      if (st >= 2) k.add(new THREE.CylinderGeometry(0.038, 0.036, 0.04, 6), '#ee7d22', M(0, 0.005, 0));
      break;
    case 'wheat': {
      const n = young ? 5 : 9, h = young ? 0.25 : st === 2 ? 0.5 : 0.62, col = st === 3 ? '#d8b11c' : '#8fbf4a';
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.28, x = Math.cos(a) * 0.04, z = Math.sin(a) * 0.04, lean = 0.12 + k.r() * 0.1;
        k.add(new THREE.BoxGeometry(0.014, h, 0.014).translate(0, h / 2, 0), col, M(x, 0, z, Math.sin(a) * lean, 0, -Math.cos(a) * lean));
        if (st >= 2) k.add(new THREE.OctahedronGeometry(0.03, 0), st === 3 ? '#e2bb24' : '#a9cc5c', M(x + Math.cos(a) * lean * h * 0.9, h * 0.97, z + Math.sin(a) * lean * h * 0.9, 0, a, 0, 0.8, 1.8, 0.8));
      }
      break;
    }
    case 'cabbage':
      leaves(k, young ? 4 : 6, young ? 0.13 : 0.22, young ? 0.05 : 0.08, '#79ad44', 1.0, 0, 0);
      if (st >= 2) k.add(new THREE.IcosahedronGeometry(st === 3 ? 0.13 : 0.08, 1), '#a9cf6a', M(0, st === 3 ? 0.1 : 0.06, 0, 0, 0, 0, 1, 0.85, 1));
      break;
    case 'pumpkin':
      for (let i = 0; i < (young ? 3 : 5); i++) { const a = i / 5 * 6.28; k.add(new THREE.CylinderGeometry(young ? 0.07 : 0.13, 0.01, 0.02, 5), i % 2 ? LEAF : LEAF2, M(Math.cos(a) * (young ? 0.08 : 0.2), young ? 0.1 : 0.16, Math.sin(a) * (young ? 0.08 : 0.2), 0.3, a, 0)); k.add(new THREE.BoxGeometry(0.012, 0.16, 0.012), DARK_LEAF, M(Math.cos(a) * 0.06, 0.07, Math.sin(a) * 0.06, 0, a, 0.7)); }
      if (st === 3) { const g = new THREE.IcosahedronGeometry(0.2, 1); g.scale(1, 0.72, 1); k.add(g, '#ee7f1f', M(0.18, 0.13, 0.1)); }
      else if (st === 2) k.add(new THREE.IcosahedronGeometry(0.08, 0), '#9cc04a', M(0.15, 0.06, 0.08));
      break;
    case 'corn': {
      const h = young ? 0.35 : st === 2 ? 0.9 : 1.35;
      k.add(new THREE.CylinderGeometry(0.018, 0.026, h, 5).translate(0, h / 2, 0), st === 3 ? '#a8b552' : '#7fae3e');
      for (let i = 0; i < (young ? 3 : 6); i++) k.add(leafGeo(h * 0.45, 0.035), i % 2 ? LEAF : DARK_LEAF, M(0, h * (0.15 + i * 0.12), 0, 0.9, i * 2.4, 0));
      if (st === 3) { k.add(new THREE.CylinderGeometry(0.035, 0.03, 0.2, 6), '#f2c832', M(0.05, h * 0.55, 0, 0, 0, -0.35)); k.add(leafGeo(0.18, 0.03), '#d8c37a', M(0, h, 0)); }
      break;
    }
  }
  if (st < 3 || crop === 'radish' || crop === 'carrot') mound(k);
}
/** stages(crop): four geometries for the field (sprout, young, growing, ready) */
export function stages(crop) {
  const key = 'st_' + crop;
  if (cache.has(key)) return cache.get(key);
  const out = [0, 1, 2, 3].map((st) => { const k = new Kit(st * 13 + crop.length); plantStage(crop, st, k); return k.build(); });
  cache.set(key, out); return out;
}
let shared = null;
/** One flat-shaded vertex-colour material for every crop mesh. */
export function material() {
  if (shared) return shared;
  shared = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0 });
  shared.userData.lowpoly = true;
  return shared;
}
export const CROP_KEYS = ['radish', 'carrot', 'wheat', 'cabbage', 'pumpkin', 'corn'];
