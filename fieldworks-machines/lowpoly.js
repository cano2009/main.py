// Fieldworks low-poly style: turns any model built from the parts kit (or loaded) into the game's stylised look.
// Flat-shaded facets, clean saturated materials, no photo maps, and bold back-face outlines on larger parts.
// Canvas textures (screens, labels, gauges, hazard stripes, belts) are kept so information stays readable.
// Written for three.js r147.

import * as THREE from 'three';
import { mergeVertices, mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

// ---------------------------------------------------------------------------
// Polish: every plain box becomes a chamfered box (a narrow 45° bevel on each edge and a small facet on each corner),
// keeping its exact size, rotation and position. Faces stay crisp; the bevels catch the light the way the reference
// models do. Runs inside bake() and stylize(), so every model built from boxes gets it.
export const POLISH = { chamfer: true };
const V3 = THREE.Vector3;
function chamferGeo(w, h, d) {
  const c = Math.min(0.03, Math.min(w, h, d) * 0.14, Math.max(w, h, d) * 0.06);
  if (c < 0.004) return null;
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * w / 2, y = sy * h / 2, z = sz * d / 2;
    pts.push(new V3(x - sx * c, y, z), new V3(x, y - sy * c, z), new V3(x, y, z - sz * c));
  }
  return new ConvexGeometry(pts);
}
// the affine transform that was baked into a BoxGeometry after it was made (translate, rotate, lookAt...)
function boxMatrix(g) {
  const P = g.parameters, w = P.width, h = P.height, d = P.depth, p = g.attributes.position;
  const ref = new THREE.BoxGeometry(w, h, d, P.widthSegments, P.heightSegments, P.depthSegments).attributes.position;
  if (ref.count !== p.count) return null;
  const find = (sx, sy, sz) => { for (let i = 0; i < ref.count; i++) if (Math.abs(ref.getX(i) - sx * w / 2) < 1e-6 && Math.abs(ref.getY(i) - sy * h / 2) < 1e-6 && Math.abs(ref.getZ(i) - sz * d / 2) < 1e-6) return i; return -1; };
  const i0 = find(-1, -1, -1), ix = find(1, -1, -1), iy = find(-1, 1, -1), iz = find(-1, -1, 1), i1 = find(1, 1, 1);
  if ([i0, ix, iy, iz, i1].some((i) => i < 0)) return null;
  const at = (i) => new V3(p.getX(i), p.getY(i), p.getZ(i)), o = at(i0);
  const ex = at(ix).sub(o).divideScalar(w), ey = at(iy).sub(o).divideScalar(h), ez = at(iz).sub(o).divideScalar(d);
  const M = new THREE.Matrix4().makeBasis(ex, ey, ez);
  M.setPosition(o.clone().sub(new V3(-w / 2, -h / 2, -d / 2).applyMatrix4(M)));
  if (new V3(w / 2, h / 2, d / 2).applyMatrix4(M).distanceTo(at(i1)) > 1e-4) return null;
  return M;
}
export function polish(root) {
  if (!POLISH.chamfer) return root;
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.polished || o.userData.noChamfer) return;
    const g = o.geometry; if (!g || g.type !== 'BoxGeometry' || Array.isArray(o.material) || (o.material && (o.material.map || o.material.emissiveMap))) return;
    const M = boxMatrix(g); if (!M) return;
    const P = g.parameters, ng = chamferGeo(P.width, P.height, P.depth); if (!ng) return;
    ng.applyMatrix4(M); o.geometry = ng; o.userData.polished = true;
  });
  return root;
}

const matCache = new Map();
function stylMat(m, o) {
  if (!m || !m.isMeshStandardMaterial || m.userData.lowpoly) return m;
  if (matCache.has(m)) return matCache.get(m);
  const n = m.clone();
  n.flatShading = true;    // faceted low-poly look: every face reads as a flat plane of colour
  const keep = (t) => (t && t.isCanvasTexture ? t : null);
  n.map = keep(m.map); n.emissiveMap = keep(m.emissiveMap) || m.emissiveMap;
  n.normalMap = null; n.roughnessMap = null; n.metalnessMap = null; n.aoMap = null;
  n.roughness = Math.max(o.minRough || 0.42, m.roughness);
  n.metalness = Math.min(m.metalness, STYLE.mid ? 0.65 : 0.3);
  if (!STYLE.mid && !m.vertexColors && !m.map && !m.transparent) n.color.offsetHSL(0, 0.06, 0.02);   // a touch more saturated (faceted style only)
  n.userData = Object.assign({}, m.userData, { lowpoly: true });
  n.onBeforeCompile = m.onBeforeCompile; if (m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) n.customProgramCacheKey = m.customProgramCacheKey;
  n.needsUpdate = true;
  matCache.set(m, n);
  return n;
}

// Outline hulls use smoothed normals so the shell stays closed around hard, flat-shaded edges.
const hullCache = new WeakMap();
function hullGeometry(g) {
  if (hullCache.has(g)) return hullCache.get(g);
  let h = new THREE.BufferGeometry(); h.setAttribute('position', g.attributes.position.clone()); if (g.index) h.setIndex(g.index.clone());
  h = mergeVertices(h, 1e-4); h.computeVertexNormals();
  hullCache.set(g, h); return h;
}
// The reference look is clean faceted shapes without ink lines; set STYLE.outline = true for the toon style.
export const STYLE = { outline: false, mid: true };   // ink hulls off; mid: smooth bevelled shading (see below)
// Mid-poly style switch. Every material in the game used to ask for flat shading (one colour per facet). In the mid
// style surfaces shade smoothly across bevels and round parts while hard edges stay hard (boxes, chamfers and the
// Blender models carry their own split normals), which is what makes a model read as properly modelled rather than
// primitive. Natural props that should stay crisply faceted mark their material with userData.faceted.
Object.defineProperty(THREE.Material.prototype, 'flatShading', {
  configurable: true,
  get() { if (this.userData && this.userData.faceted) return true; return STYLE.mid ? false : !!this._flat; },
  set(v) { this._flat = !!v; }
});
const outlineMats = new Map();
function outlineMaterial(th, color) {
  const k = th.toFixed(4) + color;
  if (outlineMats.has(k)) return outlineMats.get(k);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTh = { value: th };
    // at least about 1.3 px wide at any distance, so far-away outlines stay solid instead of breaking up
    sh.vertexShader = 'uniform float uTh;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  float lpD = -(modelViewMatrix * vec4(position, 1.0)).z;
  float lpS = length(modelMatrix[0].xyz);
  transformed += normalize(normal) * max(uTh, lpD * 0.0012 / max(lpS, 1e-3));
  // far away the ink lines turn small objects into dark noise: the whole object drops its outline (decided once per object)
  if (-(viewMatrix * vec4(modelMatrix[3].xyz, 1.0)).z > 36.0) transformed = vec3(0.0);`);
  };
  m.customProgramCacheKey = () => 'lpoutline';
  m.userData.outline = true;
  outlineMats.set(k, m);
  return m;
}

/**
 * stylize(root, { outline: true, outlineColor: '#15171a', minSize: 0.07, thickness: 0.02 })
 * Converts materials in place and adds outlines as child meshes (userData.outline = true).
 */
export function stylize(root, o) {
  polish(root);
  o = Object.assign({ outline: STYLE.outline, outlineColor: '#15171a', minSize: 0.07, thickness: 0.022 }, o || {});
  const add = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.isMesh || obj.userData.outline || obj.isInstancedMesh) return;
    obj.material = Array.isArray(obj.material) ? obj.material.map((m) => stylMat(m, o)) : stylMat(obj.material, o);
    if (!o.outline || obj.userData.noOutline) return;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (!mat || mat.transparent || (mat.emissiveMap && mat.emissiveIntensity > 0)) return;
    const g = obj.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    const s = new THREE.Vector3(); obj.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    const size = g.boundingSphere.radius * Math.max(s.x, s.y, s.z);
    if (size < o.minSize) return;
    const th = Math.min(o.thickness, Math.max(0.004, size * 0.03)) / Math.max(1e-3, Math.max(s.x, s.y, s.z));
    add.push([obj, th]);
  });
  add.forEach(([obj, th]) => {
    const line = new THREE.Mesh(hullGeometry(obj.geometry), outlineMaterial(th, o.outlineColor));
    line.userData.outline = true; line.castShadow = false; line.receiveShadow = false; line.raycast = () => {};
    obj.add(line);
  });
  return root;
}

/**
 * bake(root, keep): merges every mesh under root that does not move into one mesh per material (far fewer draw
 * calls). keep: objects that animate; they and everything under them stay as they are. Run before stylize().
 */
export const BAKE = { enabled: true };   // the validator turns this off so every part stays a separate mesh
export function bake(root, keep) {
  polish(root);
  if (!BAKE.enabled) return root;
  const skip = new Set(keep || []);
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4();
  const byMat = new Map(), remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.outline) return;
    for (let a = o; a && a !== root; a = a.parent) if (skip.has(a) || !a.visible) return;
    const mat = o.material, g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if (!mat.map && !mat.emissiveMap) { g.deleteAttribute('uv'); } else if (!g.attributes.uv) return;
    if (g.attributes.uv2) g.deleteAttribute('uv2');
    if (!g.attributes.normal) g.computeVertexNormals();
    Object.keys(g.attributes).forEach((k) => { if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); });
    g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    const key = mat.uuid + (o.userData.noOutline ? 'n' : '') + (o.castShadow ? 's' : '');
    if (!byMat.has(key)) byMat.set(key, { mat, list: [], noOutline: o.userData.noOutline, cast: o.castShadow });
    byMat.get(key).list.push(g); remove.push(o);
  });
  remove.forEach((o) => { const kids = o.children.slice(); kids.forEach((k) => { if (!k.isMesh || remove.indexOf(k) < 0) o.parent.attach(k); }); o.parent.remove(o); });
  byMat.forEach(({ mat, list, noOutline, cast }) => {
    const mm = new THREE.Mesh(list.length > 1 ? mergeBufferGeometries(list, false) : list[0], mat);
    mm.castShadow = cast; mm.receiveShadow = true; mm.userData.noOutline = noOutline; mm.userData.baked = true;
    root.add(mm);
  });
  return root;
}

/** Low-poly crop materials (vertex colours, flat shading, wind hook). */
export function cropMaterials(F, onBeforeCompile) {
  return F.makeMaterials({ colorBoost: 1.08, onBeforeCompile, key: 'lp' }).map((m) => { m.flatShading = true; m.map = null; m.roughness = Math.max(0.55, m.roughness); return m; });
}

// ---------------------------------------------------------------------------
// Low-poly nature props
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
function flatMat(c, rough) { const m = new THREE.MeshStandardMaterial({ color: lin(c), roughness: rough || 0.85, flatShading: true }); m.userData.lowpoly = true; m.userData.faceted = true; return m; }
function softMat(c, rough) { const m = new THREE.MeshStandardMaterial({ color: lin(c), roughness: rough || 0.8 }); m.userData.lowpoly = true; return m; }
const NATURE = { trunk: softMat('#6f5136'), birch: softMat('#e8e4da'), leafA: softMat('#6fb544'), leafB: softMat('#549b37'), leafC: softMat('#d9822c'), rock: flatMat('#8d949a'), apple: flatMat('#d23a2c', 0.5) };
function jitter(geo, amt, seed) {
  let s = seed || 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
  const p = geo.attributes.position, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, [r() * amt, r() * amt, r() * amt]);
    const d = map.get(k); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals(); return geo;
}
export function tree(kind, seed) {
  const g = new THREE.Group(); let s = seed || 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const birch = kind === 'birch', h = 2.2 + r() * 1.6;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, h, 10), birch ? NATURE.birch : NATURE.trunk); trunk.position.y = h / 2; g.add(trunk);
  for (let k = 0; k < 3; k++) { const rt = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6), birch ? NATURE.birch : NATURE.trunk); const a = k * 2.1 + r(); rt.position.set(Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.14); rt.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(rt); }   // root flare
  const leaf = kind === 'autumn' ? NATURE.leafC : r() < 0.5 ? NATURE.leafA : NATURE.leafB;
  const n = birch ? 4 : 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const rad = (birch ? 0.55 : 0.8) + r() * 0.5;
    const lg = mergeVertices(jitter(new THREE.IcosahedronGeometry(rad, 2), rad * 0.1, i + seed * 7).deleteAttribute('normal').deleteAttribute('uv')); lg.computeVertexNormals();
    const c = new THREE.Mesh(lg, i % 2 && leaf !== NATURE.leafC ? (leaf === NATURE.leafA ? NATURE.leafB : NATURE.leafA) : leaf);   // rounder, two-tone foliage clumps
    c.position.set((r() - 0.5) * 1.1, h + (r() - 0.2) * 0.9, (r() - 0.5) * 1.1); c.scale.y = 0.85 + r() * 0.3; g.add(c);
    if (kind === 'apple') for (let k = 0; k < 6; k++) { const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), NATURE.apple); const d = new THREE.Vector3(r() - 0.5, r() - 0.3, r() - 0.5).normalize().multiplyScalar(rad * 0.98); a.position.copy(c.position).add(d); g.add(a); }
    if (birch && i < 3) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.0, 5), NATURE.birch); b.position.set(c.position.x * 0.5, h - 0.3, c.position.z * 0.5); b.lookAt(c.position); b.rotateX(Math.PI / 2); g.add(b); }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export function rock(size, seed) {
  const m = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.35, seed), NATURE.rock);
  m.scale.y = 0.6; m.castShadow = m.receiveShadow = true; return m;
}
export function grassTuft(seed) {
  const g = new THREE.Group(); let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.35 + r() * 0.25, 3), r() < 0.5 ? NATURE.leafA : NATURE.leafB);
    b.position.set((r() - 0.5) * 0.15, 0.16, (r() - 0.5) * 0.15); b.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6); g.add(b);
  }
  return g;
}
/** Low-poly terrain: flat around the yard, gentle hills beyond, per-face colour variation and dirt paths. */
export function terrain(o) {
  const size = o.size || 180, seg = o.seg || 90, flatR = o.flatR || 26;
  let geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const heightAt = (x, z) => terrainHeight(x, z, flatR);
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  // soft, large patches of colour (no per-triangle noise) and dirt paths that blend in at their edges
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const gA = lin('#8cc152'), gB = lin('#7bb446'), gC = lin('#9ccb5e'), dirt = lin('#b8996c'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = 0.5 + 0.25 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06) + 0.25 * Math.sin((x - z) * 0.035 + 0.5);
    c.copy(gB).lerp(n > 0.5 ? gC : gA, Math.abs(n - 0.5) * 1.6);
    if (o.paths) o.paths.forEach((pt) => { const dz = Math.abs(z - pt(x)); if (Math.abs(x) < 60 && dz < 2.2) c.lerp(dirt, Math.min(1, (2.2 - dz) / 0.9)); });
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.receiveShadow = true; m.material.userData.lowpoly = true; m.userData.heightAt = heightAt;
  return m;
}
export function terrainHeight(x, z, flatR) {
  const d = Math.hypot(x / 1.25, z), k = Math.min(1, Math.max(0, (d - (flatR || 26)) / 30));
  const hill = Math.sin(x * 0.045) * 2.2 + Math.cos(z * 0.038 + 1) * 2.6 + Math.sin((x + z) * 0.09) * 0.8;
  return (hill + 2.4) * k * k + (k > 0 ? Math.sin(x * 1.7 + z * 2.3) * 0.12 : 0) - 0.03;
}
