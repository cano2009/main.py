// Fieldworks crops, second generation: soft-shaded stylised plants with curved leaves, colour gradients from base to
// tip, glossy plump fruit and seven growth stages (seed, sprout, young, growing, mature, ready, harvested stubble).
// Two levels of detail per stage: lod 0 for close views, lod 1 for distance and phones. Harvested items for the line.
// Vertex colours and smooth normals: one double-sided material draws everything. Units are metres. three.js r147.

import * as THREE from 'three';
import { mergeBufferGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = THREE.Vector3;
const C = (h) => new THREE.Color(h).convertSRGBToLinear();
const M = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new V(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), new V(sx || 1, sy === undefined ? (sx || 1) : sy, sz === undefined ? (sx || 1) : sz));

class Kit {
  constructor(seed, lod, plant) { this.list = []; this.s = seed || 7; this.lod = lod || 0; this.lw = plant ? 1.55 : 1; this.ls = plant ? 1.15 : 1; this.fs = plant ? 1.25 : 1; }   // plants: fuller leaves and plumper fruit, like the reference art
  r() { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; }
  // a solid part with smooth normals and a gradient from colour a (bottom) to b (top)
  add(geo, a, b, m, flat) {
    let g = new THREE.BufferGeometry(); g.setAttribute('position', geo.attributes.position.clone()); if (geo.index) g.setIndex(geo.index.clone());
    if (m) g.applyMatrix4(m);
    if (!flat) g = mergeVertices(g, 1e-4);
    g.computeVertexNormals(); if (g.index) g = g.toNonIndexed();
    g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y, ca = C(a), cb = C(b || a), c = new THREE.Color();
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { c.copy(ca).lerp(cb, y1 > y0 ? (p.getY(i) - y0) / (y1 - y0) : 0); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); this.list.push(g); return this;
  }
  raw(g) { this.list.push(g); return this; }
  build() { const g = mergeBufferGeometries(this.list, false); g.computeBoundingBox(); g.computeBoundingSphere(); return g; }
  seg(hi, lo) { return this.lod ? lo : hi; }
}
// A curved leaf: grows along +y, bends toward +z by `curl` (radians over its length; negative cups inward),
// V-folded along the midrib, width profile from a rounded base to a pointed tip, colour from base to tip.
function leafGeo(len, wid, curl, cBase, cTip, o) {
  o = o || {};
  const n = o.seg || 5, fold = o.fold === undefined ? 0.28 : o.fold, pos = [], col = [], idx = [], cb = C(cBase), ct = C(cTip), rib = C(o.rib || cTip), c = new THREE.Color();
  let px = 0, py = 0, pz = 0, ang = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (i > 0) { ang += curl / n; py += Math.cos(ang) * len / n; pz += Math.sin(ang) * len / n; }
    const w = wid * Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * t)), o.round || 0.75) * (o.lobed ? 1 + 0.18 * Math.sin(t * 18) : 1) + (o.base || 0) * (1 - t);
    const nx = 0, ny = -Math.sin(ang), nz = Math.cos(ang);
    pos.push(px - w, py, pz, px + nx, py + ny * w * fold, pz + nz * w * fold, px + w, py, pz);
    c.copy(cb).lerp(ct, t); col.push(c.r, c.g, c.b); c.lerp(rib, 0.35); col.push(c.r, c.g, c.b); c.copy(cb).lerp(ct, t); col.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < n; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals(); g = g.toNonIndexed(); return g;
}
function leaf(k, len, wid, curl, a, b, m, o) { const g = leafGeo(len * k.ls, wid * k.lw, curl, a, b, Object.assign({ seg: k.seg(5, 3) }, o || {})); g.applyMatrix4(m); k.raw(g); }
// small fruit get fewer segments: they read the same and keep a full field light
const sphere = (k, r0, a, b, m) => { const r = r0 * k.fs, big = r >= 0.06, mid = r >= 0.03; return k.add(new THREE.SphereGeometry(r, big ? k.seg(14, 8) : mid ? k.seg(10, 6) : k.seg(6, 5), big ? k.seg(10, 6) : mid ? k.seg(7, 4) : k.seg(4, 3)), a, b, m); };
const stem = (k, r0, r1, h, a, b, m) => k.add(new THREE.CylinderGeometry(r1, r0, h, k.seg(6, 4), 1).translate(0, h / 2, 0), a, b, m);
function soil(k, big) { k.add(new THREE.SphereGeometry(big ? 0.13 : 0.1, k.seg(8, 6), 3, 0, Math.PI * 2, 0, Math.PI / 2), '#4f321c', '#7a5234', M(0, -0.025, 0, 0, 0, 0, 1, 0.35, 1)); }
// rosette: n leaves spread around the centre
function rosette(k, n, len, wid, curl, tilt, a, b, y, o) { for (let i = 0; i < n; i++) { const az = i / n * Math.PI * 2 + k.r() * 0.4, l = len * (0.8 + k.r() * 0.35); leaf(k, l, wid * (0.85 + k.r() * 0.3), curl, a, b, M(0, y || 0.01, 0, tilt * (0.8 + k.r() * 0.4), az, 0), o); } }
// trifoliate leaf group (strawberry, soybean)
function trifol(k, x, y, z, s, az, a, b) { [-0.7, 0, 0.7].forEach((d) => leaf(k, 0.07 * s, 0.035 * s, 0.6, a, b, M(x, y, z, 1.0, az + d, 0), { round: 0.6 })); }
function calyx(k, x, y, z, s, flip) { for (let i = 0; i < 5; i++) leaf(k, 0.03 * s, 0.012 * s, 0.5, '#2f7a24', '#5cae3a', M(x, y, z, (flip ? -1 : 1) * 1.3, i * 1.257, 0), { seg: 2, fold: 0 }); }

const G = {   // leaf palettes: [base, tip]
  green: ['#1f6b22', '#7fd03a'], dark: ['#195c20', '#4fb03a'], light: ['#3f9a28', '#a8e05a'], blue: ['#3c7a52', '#8fc49a'], gold: ['#b88a1a', '#f2d35a'], dry: ['#8a7a3a', '#c9b36a']
};
// ---------------------------------------------------------------------------
const GROW = {
  tomato(k, st, f) {
    const h = 0.5 * f + 0.12; stem(k, 0.012, 0.008, h, '#3f7a28', '#6fae3a');
    k.add(new THREE.BoxGeometry(0.012, h + 0.04, 0.012).translate(0, (h + 0.04) / 2, 0), '#7a5a34', '#a07a4c', M(0.04, 0, 0.02));
    for (let i = 0; i < 2 + st; i++) leaf(k, 0.15 * f + 0.06, 0.06, 0.9, ...G.green, M(0, h * (0.2 + i * 0.13), 0, 0.9, i * 2.4, 0), { lobed: true });
    if (st >= 4) for (let i = 0; i < (st === 5 ? 5 : 3); i++) { const az = i * 1.7, x = Math.cos(az) * 0.08, z = Math.sin(az) * 0.08, y = h * (0.3 + (i % 3) * 0.18); sphere(k, st === 5 ? 0.045 : 0.03, st === 5 ? (i === 4 ? '#d9741a' : '#c41f16') : '#6aa83a', st === 5 ? (i === 4 ? '#ffb24a' : '#ff6a48') : '#b4d46a', M(x, y, z, 0, 0, 0, 1, 0.9, 1)); calyx(k, x, y + (st === 5 ? 0.038 : 0.026), z, 1); }
  },
  eggplant(k, st, f) {
    const h = 0.4 * f + 0.1; stem(k, 0.014, 0.009, h, '#4f6a2a', '#6f8a3a');
    for (let i = 0; i < 2 + st; i++) leaf(k, 0.17 * f + 0.06, 0.08, 1.0, ...G.green, M(0, h * (0.15 + i * 0.12), 0, 1.0, i * 2.3, 0), { round: 0.6 });
    if (st >= 4) for (let i = 0; i < 3; i++) { const az = i * 2.1, x = Math.cos(az) * 0.08, z = Math.sin(az) * 0.08, y = h * 0.4; sphere(k, st === 5 ? 0.04 : 0.025, '#2e1347', '#8a4fb6', M(x, y - 0.03, z, 0.2, az, 0, 1, 1.7, 1)); calyx(k, x, y + 0.03, z, 1.2, true); }
  },
  pepper(k, st, f) {
    const h = 0.42 * f + 0.1; stem(k, 0.011, 0.007, h, '#3f7a28', '#6fae3a');
    for (let i = 0; i < 2 + st; i++) leaf(k, 0.12 * f + 0.05, 0.045, 0.8, ...G.light, M(0, h * (0.2 + i * 0.12), 0, 1.0, i * 2.5, 0));
    if (st >= 4) for (let i = 0; i < 5; i++) { const az = i * 1.3, x = Math.cos(az) * 0.07, z = Math.sin(az) * 0.07, y = h * (0.35 + (i % 3) * 0.15); k.add(new THREE.ConeGeometry(0.018, 0.11, k.seg(8, 5)).rotateX(Math.PI), st === 5 ? '#9a0f14' : '#3f8a2a', st === 5 ? '#ff3a24' : '#8fcf4a', M(x, y - 0.055, z, 0.25, az, 0)); stem(k, 0.005, 0.005, 0.03, '#2f7a24', '#5cae3a', M(x, y, z)); }
  },
  grape(k, st, f) {
    const h = 0.7 * f + 0.15; stem(k, 0.02, 0.014, h, '#5a3f24', '#8a6a44');
    k.add(new THREE.BoxGeometry(0.014, h + 0.05, 0.014).translate(0, (h + 0.05) / 2, 0), '#7a5a34', '#a07a4c', M(-0.04, 0, 0));
    for (let i = 0; i < 2 + st; i++) leaf(k, 0.13 * f + 0.06, 0.1, 0.9, ...G.dark, M(0, h * (0.35 + i * 0.1), 0, 1.1, i * 2.2, 0), { lobed: true, round: 0.5 });
    if (st >= 4) [0.8, -1.4].forEach((az) => { const x = Math.cos(az) * 0.09, z = Math.sin(az) * 0.09, y = h * 0.55; for (let r = 0; r < 4; r++) for (let j = 0; j < 4 - r; j++) { const a2 = j / (4 - r) * 6.28 + r; sphere(k, 0.02, st === 5 ? '#2e1a52' : '#6a9a3a', st === 5 ? '#8a5ac8' : '#c4e07a', M(x + Math.cos(a2) * 0.025 * (4 - r) / 3, y - r * 0.03, z + Math.sin(a2) * 0.025 * (4 - r) / 3)); } });
  },
  berry(k, st, f) {
    for (let i = 0; i < 2 + st; i++) { const az = i * 2.39, d = 0.05 * f + 0.02; stem(k, 0.004, 0.003, 0.07 * f + 0.03, '#3f7a28', '#5cae3a', M(Math.cos(az) * d * 0.3, 0, Math.sin(az) * d * 0.3, 0.5, az, 0)); trifol(k, Math.cos(az) * d, 0.07 * f + 0.03, Math.sin(az) * d, f + 0.4, az, ...G.dark); }
    if (st === 4) for (let i = 0; i < 3; i++) { const az = i * 2.1, x = Math.cos(az) * 0.07, z = Math.sin(az) * 0.07; for (let p = 0; p < 5; p++) k.add(new THREE.SphereGeometry(0.012, 5, 3), '#f4f2ea', '#ffffff', M(x + Math.cos(p * 1.257) * 0.013, 0.09, z + Math.sin(p * 1.257) * 0.013, 0, 0, 0, 1, 0.4, 1)); sphere(k, 0.007, '#f2c418', '#ffd84a', M(x, 0.094, z)); }
    if (st === 5) for (let i = 0; i < 5; i++) { const az = i * 1.3, x = Math.cos(az) * 0.09, z = Math.sin(az) * 0.09; k.add(new THREE.SphereGeometry(0.026, k.seg(9, 6), k.seg(7, 4)).scale(1, 1.25, 1).translate(0, -0.012, 0), '#b8101e', '#ff4a4a', M(x, 0.035, z, Math.PI, 0, 0)); calyx(k, x, 0.06, z, 0.8); }
  },
  wheat(k, st, f) { cereal(k, st, f, false); },
  rice(k, st, f) { cereal(k, st, f, true); },
  corn(k, st, f) {
    const h = 1.5 * f + 0.1; stem(k, 0.026, 0.016, h, '#3f7a24', st === 5 ? '#a8c24a' : '#8fc84a');
    for (let i = 0; i < 2 + st; i++) leaf(k, h * 0.42 + 0.05, 0.045, 1.6, st === 5 ? '#2f7a24' : G.green[0], st === 5 ? '#b8d65a' : G.green[1], M(0, h * (0.12 + i * 0.11), 0, 0.7, i * 2.5, 0));
    if (st >= 4) [0, 2.8].forEach((az, j) => { const y = h * (0.45 + j * 0.12), x = Math.cos(az) * 0.035, z = Math.sin(az) * 0.035; k.add(new THREE.SphereGeometry(0.05, k.seg(8, 5), k.seg(8, 5)).scale(1, 2.6, 1), st === 5 ? '#d99a12' : '#8fbf4a', st === 5 ? '#ffd84a' : '#c4e07a', M(x, y, z, 0.45, az, 0)); leaf(k, 0.15, 0.03, 0.4, '#4f9a2a', '#a7d65a', M(x, y - 0.06, z, 0.4, az + 0.5, 0)); });
    if (st >= 4) for (let i = 0; i < 5; i++) leaf(k, 0.12, 0.008, 1.2, '#c9b36a', '#efe0a0', M(0, h, 0, 0.4, i * 1.257, 0), { seg: 3, fold: 0 });
  },
  sunflower(k, st, f) {
    const h = 1.3 * f + 0.1; stem(k, 0.022, 0.014, h, '#4f8a2a', '#7fc04a');
    for (let i = 0; i < 2 + st; i++) leaf(k, 0.16 * f + 0.06, 0.09, 1.0, ...G.green, M(0, h * (0.15 + i * 0.12), 0, 1.0, i * 2.3, 0), { round: 0.55 });
    if (st === 4) sphere(k, 0.06, '#4f8a2a', '#9fd05a', M(0, h + 0.03, 0));
    if (st === 5) { const tilt = M(0, h + 0.02, 0.05, Math.PI / 2 - 0.45, 0, 0); const disc = new THREE.CylinderGeometry(0.1, 0.09, 0.05, k.seg(14, 8)); disc.applyMatrix4(tilt); k.add(disc, '#3a2412', '#7a4a22'); for (let i = 0; i < k.seg(16, 10); i++) { const a = i / k.seg(16, 10) * Math.PI * 2; const g = leafGeo(0.15, 0.05, 0.25, '#f2a800', '#ffe066', { seg: 3, fold: 0.15 }); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(tilt, M(0, 0.025, 0, 0, a, 0).multiply(M(0, 0, 0, Math.PI / 2, 0, 0)).multiply(M(0, 0.085, 0)))); k.raw(g); } }
  },
  carrot(k, st, f) {
    for (let i = 0; i < 3 + st; i++) { const az = i * 2.39; stem(k, 0.004, 0.003, 0.18 * f + 0.04, '#3f8a2a', '#5cae3a', M(0, 0, 0, 0.35, az, 0)); leaf(k, 0.12 * f + 0.04, 0.03, 0.7, ...G.green, M(Math.sin(az) * 0.05 * f, 0.15 * f + 0.03, Math.cos(az) * 0.05 * f, 0.8, az, 0), { lobed: true }); }
    if (st >= 4) k.add(new THREE.CylinderGeometry(0.03 + 0.01 * (st - 4), 0.026, 0.05, k.seg(10, 6)), '#d9520f', '#ff9a3a', M(0, 0.01, 0));
  },
  radish(k, st, f) { const r = st === 5 ? 0.05 : 0.035; if (st >= 4) sphere(k, r, '#a6132e', '#ff5a78', M(0, r * 0.6, 0, 0, 0, 0, 1, 0.9, 1)); rosette(k, 3 + st, 0.18 * f + 0.05, 0.045, 1.0, 0.35, ...G.green, st >= 4 ? r * 1.6 : 0.02, { round: 0.6 }); },
  beet(k, st, f) { const r = st === 5 ? 0.055 : 0.038; if (st >= 4) sphere(k, r, '#6a0a3c', '#d6337f', M(0, r * 0.55, 0, 0, 0, 0, 1, 0.85, 1)); rosette(k, 3 + st, 0.2 * f + 0.05, 0.05, 1.0, 0.4, '#8a1250', '#5fb83a', st >= 4 ? r * 1.5 : 0.02, { round: 0.6, rib: '#c62a6a' }); },
  garlic(k, st, f) { for (let i = 0; i < 2 + Math.min(st, 4); i++) leaf(k, 0.24 * f + 0.05, 0.012, 0.6, '#4f8a3a', '#a7d07a', M(0, 0.02, 0, 0.25, i * 2.4, 0), { fold: 0.5 }); if (st >= 4) sphere(k, st === 5 ? 0.045 : 0.032, '#c9b8d6', '#f8f4fa', M(0, 0.012, 0, 0, 0, 0, 1, 0.8, 1)); },
  potato(k, st, f) {
    const pal = st === 5 ? ['#7a7a2a', '#c9c25a'] : G.green;
    for (let i = 0; i < 2 + st; i++) { const az = i * 2.39; stem(k, 0.008, 0.006, 0.12 * f + 0.04, '#3f7a28', '#5cae3a', M(0, 0, 0, 0.5, az, 0)); leaf(k, 0.1 * f + 0.04, 0.05, 0.8, ...pal, M(Math.sin(az) * 0.06 * f, 0.11 * f + 0.03, Math.cos(az) * 0.06 * f, 0.8, az, 0), { round: 0.6 }); }
    if (st === 4) for (let i = 0; i < 3; i++) { sphere(k, 0.014, '#e8e0f0', '#ffffff', M(Math.cos(i * 2) * 0.05, 0.2 * f, Math.sin(i * 2) * 0.05)); }
    if (st === 5) [[0.1, 0.03], [-0.07, -0.08], [0.02, 0.1]].forEach(([x, z]) => sphere(k, 0.04, '#8a5a2a', '#d6a467', M(x, 0.01, z, 0, x * 9, 0, 1.3, 0.8, 1)));
  },
  pumpkin(k, st, f) {
    // leaves stand on long stalks above the ground; the fruit lies on the soil out at the end of a creeping vine,
    // green and streaked while unripe, deep orange when ready
    for (let i = 0; i < 2 + st; i++) { const az = i / (2 + st) * 6.28, d = 0.14 * f; stem(k, 0.008, 0.006, d + 0.1, '#3f7a28', '#6fae3a', M(0, 0.01, 0, 0.9, az, 0)); leaf(k, 0.12 * f + 0.04, 0.11 * f + 0.03, 1.3, ...G.light, M(Math.sin(az) * d, 0.1 + 0.03 * f, Math.cos(az) * d, 0.25, az + Math.PI, 0), { lobed: true, round: 0.45 }); }
    if (st >= 3) {
      const r = st === 5 ? 0.17 : st === 4 ? 0.12 : 0.07, fx = 0.2 + r, fz = 0.06, g = new THREE.SphereGeometry(r, k.seg(16, 10), k.seg(10, 6)), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), m = 1 + 0.08 * Math.cos(a * 8); p.setXYZ(i, x * m, p.getY(i) * 0.72, z * m); }
      stem(k, 0.01, 0.008, fx - r * 0.5, '#4f7a2a', '#7fa83a', M(0, 0.02, 0, 0, -Math.atan2(fz, fx), -Math.PI / 2 + 0.06));   // the vine along the ground
      k.add(g, st === 5 ? '#c4500c' : st === 4 ? '#3f6a22' : '#4f8a2a', st === 5 ? '#ffa02e' : st === 4 ? '#a6b84a' : '#8fc45a', M(fx, r * 0.7, fz));
      stem(k, 0.012, 0.009, 0.06, '#4f6a2a', '#8a9a4a', M(fx, r * 1.38, fz, 0, 0, 0.35));
    }
  },
  cabbage(k, st, f) {
    rosette(k, 3 + st, 0.12 * f + 0.05, 0.08 * f + 0.03, 1.4, 0.95, '#2f8a3a', '#7fd05a', 0.01, { round: 0.5, fold: 0.15 });
    if (st >= 3) { const r = 0.05 + 0.025 * (st - 3); sphere(k, r, '#8fc85a', '#e0f6a6', M(0, r * 0.85, 0, 0, 0, 0, 1, 0.9, 1)); for (let i = 0; i < 4; i++) leaf(k, r * 1.6, r * 1.1, -1.1, '#7fc04a', '#c6ec8a', M(0, 0.02, 0, 0.35, i * 1.57 + 0.4, 0), { round: 0.5, fold: 0.1 }); }
  },
  lettuce(k, st, f) { rosette(k, 5 + st * 2, 0.09 * f + 0.05, 0.075 * f + 0.025, -0.7, 0.75, '#3f8f24', '#b4e46a', 0.01, { round: 0.35, fold: 0.08 }); rosette(k, 3 + st, 0.06 * f + 0.03, 0.06 * f + 0.02, -1.2, 0.35, '#8fcf4a', '#d8f49a', 0.03, { round: 0.35, fold: 0.05 }); if (st >= 4) sphere(k, 0.04 * f + 0.02, '#9ad25a', '#e4f8a8', M(0, 0.04, 0, 0, 0, 0, 1, 0.8, 1)); },
  cotton(k, st, f) {
    const h = 0.55 * f + 0.08; stem(k, 0.012, 0.007, h, '#5a4a2a', '#8a6a3a');
    for (let i = 0; i < 2 + st; i++) { const y = h * (0.3 + i * 0.1), az = i * 2.2; leaf(k, 0.07 * f + 0.03, 0.035, 0.9, ...(st === 5 ? G.dry : G.green), M(0, y, 0, 1.1, az, 0), { lobed: true, round: 0.5 });
      if (st === 4) sphere(k, 0.025, '#e07aa8', '#ffc0dc', M(Math.cos(az) * 0.08, y + 0.03, Math.sin(az) * 0.08));
      if (st === 5) { const x = Math.cos(az) * 0.08, z = Math.sin(az) * 0.08; [[0, 0], [0.025, 0.01], [-0.02, 0.015]].forEach(([dx, dz]) => sphere(k, 0.028, '#e8e6e0', '#ffffff', M(x + dx, y + 0.04, z + dz))); calyx(k, x, y + 0.01, z, 1.2); } }
  },
  soybean(k, st, f) {
    const pal = st === 5 ? G.dry : G.green;
    for (let i = 0; i < 3 + st; i++) { const az = i * 2.39, d = (0.02 + k.r() * 0.05) * (f + 0.3), h = (0.1 + k.r() * 0.12) * f + 0.04; stem(k, 0.005, 0.004, h, st === 5 ? '#8a7a3a' : '#3f7a28', st === 5 ? '#c9b36a' : '#6fae3a', M(0, 0, 0, Math.atan2(d, h), az, 0)); trifol(k, Math.sin(az) * d, h, Math.cos(az) * d, 0.9 * f + 0.4, az, ...pal);
      if (st >= 4) for (let j = 0; j < 2; j++) k.add(new THREE.SphereGeometry(0.012, 6, 5).scale(1, 3.2, 1.3), st === 5 ? '#8a6a2a' : '#5f9a2a', st === 5 ? '#d6b46a' : '#b4d46a', M(Math.sin(az + j) * d * 0.7, h * 0.6, Math.cos(az + j) * d * 0.7, 2.6, az + j, 0)); }
  }
};
function cereal(k, st, f, rice) {
  const n = k.seg(rice ? 7 : 6, 3), h = (rice ? 0.6 : 0.72) * f, ripe = st === 5;
  const sc = ripe ? (rice ? ['#b8a050', '#e8d48a'] : G.gold) : st === 4 ? ['#6f9a2a', '#c9d65a'] : G.green;
  for (let i = 0; i < n; i++) {
    const az = i / n * 6.28 + k.r() * 0.5, lean = 0.08 + k.r() * 0.12, x = Math.cos(az) * 0.03, z = Math.sin(az) * 0.03;
    const sm = M(x, 0, z, lean, az, 0);
    stem(k, 0.007, 0.005, h, sc[0], sc[1], sm);
    leaf(k, h * 0.45 + 0.04, 0.014, 1.3, sc[0], sc[1], M(x, h * 0.2, z, 0.5, az + 1.5, 0), { seg: 3, fold: 0.4 });
    if (st >= 3) {
      const top = new V(0, h, 0).applyMatrix4(sm), ec = ripe ? (rice ? ['#c9a85a', '#f2e0a0'] : ['#c98a12', '#ffd84a']) : ['#7aa83a', '#c4e07a'];
      const grains = k.seg(rice ? 6 : 8, 3);
      for (let j = 0; j < grains; j++) {
        const t = j / grains, droop = rice ? t * t * 0.18 : 0, side = j % 2 ? 1 : -1;
        k.add(new THREE.OctahedronGeometry(0.014, 0).scale(0.8, 1.8, 0.8), ec[0], ec[1], M(top.x + side * 0.009 + Math.cos(az) * droop, top.y + (rice ? -t * 0.06 : t * 0.075) + 0.012, top.z + Math.sin(az) * droop, side * 0.35, az, 0), true);
        if (!rice && !k.lod && j % 2 === 0) k.add(new THREE.ConeGeometry(0.002, 0.05, 3).translate(0, 0.025, 0), ec[0], ec[1], M(top.x + side * 0.012, top.y + t * 0.075 + 0.025, top.z, side * 0.5, az, 0), true);
      }
    }
  }
}
function stageGeo(crop, st, lod) {
  const k = new Kit(st * 31 + crop.length * 7 + 3, lod, true);
  if (st === 0) { soil(k); sphere(k, 0.016, '#c9b27a', '#efe0b0', M(0.015, 0.012, 0.01, 0, 0, 0, 1.4, 0.8, 1)); stem(k, 0.005, 0.003, 0.03, '#6fae3a', '#a6dc5a', M(-0.01, 0.01, 0)); return k.build(); }   // seed just breaking the soil
  if (st === 1) {   // sprout: a sturdy stem, two broad seed leaves and the first true leaf unfolding
    soil(k); stem(k, 0.007, 0.005, 0.09, '#4f8a2a', '#8fd04a');
    [0, Math.PI].forEach((az) => leaf(k, 0.075, 0.045, 0.7, ...G.light, M(0, 0.085, 0, 1.0, az, 0), { seg: 3, round: 0.55 }));
    leaf(k, 0.06, 0.03, 0.4, ...G.green, M(0, 0.09, 0, 0.35, Math.PI / 2, 0), { seg: 3 });
    return k.build();
  }
  if (st === 6) { soil(k, true); if (/wheat|rice|corn|sunflower|cotton|soybean|tomato|eggplant|pepper|grape/.test(crop)) for (let i = 0; i < 6; i++) stem(k, 0.005, 0.005, 0.05 + k.r() * 0.04, '#9a7a3a', '#d6b46a', M(Math.cos(i * 1.1) * 0.05, 0, Math.sin(i * 1.1) * 0.05, 0.2, i, 0)); return k.build(); }
  const f = [0.35, 0.6, 0.82, 1][st - 2];
  GROW[crop](k, st, f);
  if (st < 5 || /radish|carrot|potato|cabbage|lettuce|berry|beet|garlic/.test(crop)) soil(k);
  return k.build();
}
const cache = new Map();
/** stages(crop, lod): seven geometries (seed, sprout, young, growing, mature, ready, harvested) */
export function stages(crop, lod) {
  const key = crop + '_' + (lod || 0);
  if (!cache.has(key)) cache.set(key, [0, 1, 2, 3, 4, 5, 6].map((st) => stageGeo(crop, st, lod || 0)));
  return cache.get(key);
}
// ---------------------------------------------------------------------------
// harvested items (bottom at y = 0)
const ITEM = {
  tomato(k) { sphere(k, 0.07, '#b81a12', '#ff6a48', M(0, 0.06, 0, 0, 0, 0, 1, 0.85, 1)); calyx(k, 0, 0.115, 0, 2); },
  eggplant(k) { sphere(k, 0.055, '#2e1347', '#8a4fb6', M(0, 0.05, 0, 0, 0, Math.PI / 2 - 0.2, 1, 2.2, 1)); calyx(k, 0.11, 0.07, 0, 1.8); },
  pepper(k) { k.add(new THREE.ConeGeometry(0.03, 0.17, 10).rotateZ(Math.PI / 2 + 0.15), '#9a0f14', '#ff3a24', M(0, 0.03, 0)); stem(k, 0.007, 0.006, 0.04, '#2f7a24', '#5cae3a', M(-0.09, 0.03, 0, 0, 0, Math.PI / 2)); },
  grape(k) { for (let r = 0; r < 4; r++) for (let j = 0; j < 5 - r; j++) { const a = j / (5 - r) * 6.28 + r; sphere(k, 0.024, '#2e1a52', '#8a5ac8', M(Math.cos(a) * 0.028 * (5 - r) / 3, 0.03 + r * 0.035, Math.sin(a) * 0.028 * (5 - r) / 3)); } stem(k, 0.005, 0.004, 0.05, '#6a5a2a', '#9a8a4a', M(0, 0.15, 0)); },
  berry(k) { for (let i = 0; i < 4; i++) { const a = i * 1.57, x = Math.cos(a) * 0.035, z = Math.sin(a) * 0.035; k.add(new THREE.SphereGeometry(0.03, 9, 7).scale(1, 1.25, 1), '#b8101e', '#ff4a4a', M(x, 0.03, z, Math.PI / 2, a, 0)); } },
  wheat(k) { for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, x = Math.cos(a) * 0.02, z = Math.sin(a) * 0.02; stem(k, 0.006, 0.005, 0.45, '#b88a1a', '#f2d35a', M(x, 0, z, 0.1, a, 0)); for (let j = 0; j < 5; j++) k.add(new THREE.OctahedronGeometry(0.013, 0).scale(0.8, 1.8, 0.8), '#c98a12', '#ffd84a', M(x * 2, 0.45 + j * 0.022, z * 2, 0, a, 0), true); } k.add(new THREE.TorusGeometry(0.035, 0.009, 4, 10).rotateX(Math.PI / 2), '#b89a5a', '#d6c08a', M(0, 0.2, 0)); },
  rice(k) { ITEM.wheat(k); },
  corn(k) { k.add(new THREE.SphereGeometry(0.04, 10, 10).scale(1, 3, 1), '#d99a12', '#ffd84a', M(0, 0.04, 0, 0, 0, Math.PI / 2)); [0.5, -0.5].forEach((a) => leaf(k, 0.16, 0.035, 0.3, '#4f9a2a', '#a7d65a', M(-0.08, 0.04, 0, a, 0, -Math.PI / 2))); },
  sunflower(k) { k.add(new THREE.CylinderGeometry(0.1, 0.09, 0.04, 14), '#3a2412', '#7a4a22', M(0, 0.03, 0)); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28, g = leafGeo(0.08, 0.025, 0.1, '#e8a005', '#ffd84a', { seg: 3, fold: 0 }); g.applyMatrix4(M(Math.cos(a) * 0.09, 0.03, Math.sin(a) * 0.09, Math.PI / 2, -a + Math.PI / 2, 0)); k.raw(g); } },
  carrot(k) { k.add(new THREE.ConeGeometry(0.035, 0.2, 10).rotateZ(Math.PI / 2), '#d9520f', '#ff9a3a', M(0.03, 0.035, 0)); for (let i = 0; i < 4; i++) leaf(k, 0.12, 0.025, 0.4, ...G.green, M(-0.07, 0.035, 0, 0.3 * (i - 1.5), 0, Math.PI / 2 + 0.2), { lobed: true }); },
  radish(k) { sphere(k, 0.05, '#a6132e', '#ff5a78', M(0, 0.05, 0)); k.add(new THREE.ConeGeometry(0.012, 0.06, 6).rotateZ(-Math.PI / 2), '#e8e0d8', '#ffffff', M(0.06, 0.04, 0)); for (let i = 0; i < 3; i++) leaf(k, 0.12, 0.035, 0.5, ...G.green, M(-0.04, 0.06, 0, 0.4 * (i - 1), 0, Math.PI / 2 + 0.3)); },
  beet(k) { sphere(k, 0.06, '#6a0a3c', '#d6337f', M(0, 0.055, 0)); for (let i = 0; i < 3; i++) leaf(k, 0.12, 0.04, 0.5, '#8a1250', '#6fbf3a', M(-0.05, 0.07, 0, 0.4 * (i - 1), 0, Math.PI / 2 + 0.3), { rib: '#c62a6a' }); },
  garlic(k) { sphere(k, 0.045, '#c9b8d6', '#f8f4fa', M(0, 0.04, 0, 0, 0, 0, 1, 0.85, 1)); k.add(new THREE.ConeGeometry(0.015, 0.05, 8), '#e0d6e8', '#f8f4fa', M(0, 0.1, 0)); },
  potato(k) { sphere(k, 0.05, '#8a5a2a', '#d6a467', M(0, 0.04, 0, 0, 0.6, 0, 1.4, 0.85, 1)); },
  pumpkin(k) { const g = new THREE.SphereGeometry(0.2, 18, 12), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), m = 1 + 0.08 * Math.cos(a * 8); p.setXYZ(i, x * m, p.getY(i) * 0.72, z * m); } k.add(g, '#c4500c', '#ffa02e', M(0, 0.145, 0)); stem(k, 0.016, 0.012, 0.07, '#4f6a2a', '#8a9a4a', M(0, 0.28, 0, 0, 0, 0.3)); },
  cabbage(k) { sphere(k, 0.1, '#8fc85a', '#e0f6a6', M(0, 0.1, 0)); for (let i = 0; i < 5; i++) leaf(k, 0.15, 0.1, -1.2, '#3f9a3a', '#9fd46a', M(0, 0.02, 0, 0.5, i * 1.257, 0), { round: 0.5, fold: 0.1 }); },
  lettuce(k) { sphere(k, 0.08, '#9ad25a', '#e4f8a8', M(0, 0.07, 0, 0, 0, 0, 1, 0.8, 1)); for (let i = 0; i < 7; i++) leaf(k, 0.12, 0.08, -0.9, '#4f9a2a', '#c4ec72', M(0, 0.02, 0, 0.6, i * 0.9, 0), { round: 0.45, lobed: true, fold: 0.1 }); },
  cotton(k) { [[0, 0], [0.04, 0.02], [-0.035, 0.025], [0.005, -0.04]].forEach(([x, z]) => sphere(k, 0.04, '#e8e6e0', '#ffffff', M(x, 0.05, z))); calyx(k, 0, 0.01, 0, 2.5); },
  soybean(k) { for (let i = 0; i < 6; i++) k.add(new THREE.SphereGeometry(0.014, 7, 6).scale(1, 4, 1.2), '#9a7a3a', '#d6b46a', M(Math.cos(i) * 0.03, 0.03, Math.sin(i) * 0.03, Math.PI / 2, i * 1.05, 0)); }
};
/** item(crop, dirty): a harvested product, bottom at y = 0 and centred */
export function item(crop, dirty) {
  const key = 'item_' + crop + (dirty ? 'd' : '');
  if (cache.has(key)) return cache.get(key);
  if (!ITEM[crop]) return null;
  const k = new Kit(crop.length * 13 + 1, 0); ITEM[crop](k); const g = k.build();
  g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  if (dirty) { const c = g.attributes.color, mud = C('#6b4a2c'); let s = 3; for (let f = 0; f < c.count; f += 3) { s = (s * 16807) % 2147483647; const w = s / 2147483647 < 0.4 ? 0.7 : 0.25; for (let j = 0; j < 3; j++) c.setXYZ(f + j, c.getX(f + j) * (1 - w) + mud.r * w, c.getY(f + j) * (1 - w) + mud.g * w, c.getZ(f + j) * (1 - w) + mud.b * w); } }
  cache.set(key, g); return g;
}
let shared = null;
/** Soft-shaded, double-sided vertex-colour material for every crop. */
export function material() {
  if (shared) return shared;
  shared = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, flatShading: true });
  shared.userData.lowpoly = true;
  return shared;
}
export const CROP_KEYS = ['tomato', 'eggplant', 'pepper', 'grape', 'berry', 'wheat', 'rice', 'corn', 'sunflower', 'carrot', 'radish', 'beet', 'garlic', 'potato', 'pumpkin', 'cabbage', 'lettuce', 'cotton', 'soybean'];
