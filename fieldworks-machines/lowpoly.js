// Fieldworks low-poly style: turns any model built from the parts kit (or loaded) into the game's stylised look.
// Flat-shaded facets, clean saturated materials, no photo maps, and bold back-face outlines on larger parts.
// Canvas textures (screens, labels, gauges, hazard stripes, belts) are kept so information stays readable.
// Written for three.js r147.

import * as THREE from 'three';
import { mergeVertices, mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matCache = new Map();
function stylMat(m, o) {
  if (!m || !m.isMeshStandardMaterial || m.userData.lowpoly) return m;
  if (matCache.has(m)) return matCache.get(m);
  const n = m.clone();
  n.flatShading = !m.userData.smooth;
  const keep = (t) => (t && t.isCanvasTexture ? t : null);
  n.map = keep(m.map); n.emissiveMap = keep(m.emissiveMap) || m.emissiveMap;
  n.normalMap = null; n.roughnessMap = null; n.metalnessMap = null; n.aoMap = null;
  n.roughness = Math.max(o.minRough || 0.42, m.roughness);
  n.metalness = Math.min(m.metalness, 0.3);
  if (!m.vertexColors && !m.map && !m.transparent) n.color.offsetHSL(0, 0.06, 0.02);   // a touch more saturated
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
export const STYLE = { outline: true };   // bold ink outlines (the master prompt's vending-machine look)
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
  transformed += normalize(normal) * max(uTh, lpD * 0.0015 / max(lpS, 1e-3));`);
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
function flatMat(c, rough) { const m = new THREE.MeshStandardMaterial({ color: lin(c), roughness: rough || 0.85, flatShading: true }); m.userData.lowpoly = true; return m; }
const NATURE = { trunk: flatMat('#7a5a3c'), birch: flatMat('#e8e4da'), leafA: flatMat('#7cc24a'), leafB: flatMat('#5ea83c'), leafC: flatMat('#e08a2e'), rock: flatMat('#8d949a'), apple: flatMat('#d23a2c', 0.5) };
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
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, h, 6), birch ? NATURE.birch : NATURE.trunk); trunk.position.y = h / 2; g.add(trunk);
  const leaf = kind === 'autumn' ? NATURE.leafC : r() < 0.5 ? NATURE.leafA : NATURE.leafB;
  const n = birch ? 4 : 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const rad = (birch ? 0.55 : 0.8) + r() * 0.5;
    const c = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(rad, 1), rad * 0.18, i + seed * 7), leaf);
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
  geo = geo.toNonIndexed(); geo.computeVertexNormals();
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const g1 = lin('#7fb54a'), g2 = lin('#6aa63f'), g3 = lin('#8fc256'), dirt = lin('#a98a62');
  for (let f = 0; f < pos.count / 3; f++) {
    let cx = 0, cz = 0; for (let j = 0; j < 3; j++) { cx += pos.getX(f * 3 + j) / 3; cz += pos.getZ(f * 3 + j) / 3; }
    const h = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453, rr = h - Math.floor(h);
    let c = rr < 0.33 ? g1 : rr < 0.66 ? g2 : g3;
    if (o.paths && o.paths.some((pt) => Math.abs(cz - pt(cx)) < 1.2 && Math.abs(cx) < 60)) c = dirt;
    for (let j = 0; j < 3; j++) cols.set([c.r, c.g, c.b], (f * 3 + j) * 3);
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
