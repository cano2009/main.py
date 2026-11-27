// Fieldworks asset and connection validator. Run it on models built without baking (BAKE.enabled = false) so every
// part is still its own mesh. Checks:
//   floating   - parts not touching the rest of the model (connected through overlapping bounds) or the ground
//   holes      - open edges on solid parts (missing faces); parts marked userData.open are intentional
//   materials  - meshes with no material, or broken geometry (NaN positions, no triangles)
//   ports      - sockets not sitting on the model surface, required ports left unconnected
//   links      - cable and pipe ends not reaching their port, incompatible pairs
//   collision  - machines whose physics collider does not cover the model
// Every finding: { level: 'error' | 'warn', model, check, part, detail }.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldPos, worldDir, canConnect } from './ports.js';

const V = THREE.Vector3;
function meshesOf(root) {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isMesh && !o.userData.outline && !o.isInstancedMesh && o.visible) out.push(o); });
  return out;
}
const label = (o) => o.name || o.geometry.type.replace('Geometry', '') + (o.material && o.material.name ? ' ' + o.material.name : '');

export function auditGeometry(model, o) {
  o = o || {};
  const F = [], name = model.name || model.root.name, meshes = meshesOf(model.root);
  const groundY = (o.groundY !== undefined ? o.groundY : model.root.getWorldPosition(new V()).y) + 0.04;
  // materials and broken geometry
  meshes.forEach((mm) => {
    if (!mm.material) F.push({ level: 'error', model: name, check: 'materials', part: label(mm), detail: 'No material' });
    const p = mm.geometry.attributes.position;
    if (!p || p.count < 3) F.push({ level: 'error', model: name, check: 'materials', part: label(mm), detail: 'Empty geometry' });
    else for (let i = 0; i < p.count; i++) if (!isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) { F.push({ level: 'error', model: name, check: 'materials', part: label(mm), detail: 'Invalid vertex positions' }); break; }
  });
  // floating parts: union of overlapping bounds, anchored by parts on the ground (or the root part for flying models)
  const solid = meshes.filter((mm) => !mm.material.transparent && !mm.userData.socketPart);
  const boxes = solid.map((mm) => new THREE.Box3().setFromObject(mm).expandByScalar(0.012));
  const parent = solid.map((_, i) => i), f = (i) => (parent[i] === i ? i : (parent[i] = f(parent[i])));
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) if (boxes[i].intersectsBox(boxes[j])) parent[f(i)] = f(j);
  const anchored = new Set();
  solid.forEach((_, i) => { if (o.flying ? i === 0 : boxes[i].min.y <= groundY) anchored.add(f(i)); });
  solid.forEach((mm, i) => { if (!anchored.has(f(i))) F.push({ level: 'error', model: name, check: 'floating', part: label(mm), detail: `Not attached to the rest of the model (at ${boxes[i].getCenter(new V()).toArray().map((v) => v.toFixed(2)).join(', ')})` }); });
  // holes: open edges on parts that should be closed
  solid.forEach((mm) => {
    const t = mm.geometry.type;
    if (mm.userData.open || mm.userData.noOutline || /Plane|Tube|Circle|Shape/.test(t) || (mm.geometry.parameters && mm.geometry.parameters.openEnded)) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', mm.geometry.attributes.position); if (mm.geometry.index) g.setIndex(mm.geometry.index);
    const w = mergeVertices(g, 1e-4), idx = w.index.array, edges = new Map();
    for (let k = 0; k < idx.length; k += 3) for (let e = 0; e < 3; e++) { const a = idx[k + e], b = idx[k + (e + 1) % 3], key = a < b ? a + '_' + b : b + '_' + a; edges.set(key, (edges.get(key) || 0) + 1); }
    let open = 0; edges.forEach((c) => { if (c === 1) open++; });
    const partial = /Sphere|Lathe/.test(t) && mm.geometry.parameters && ((mm.geometry.parameters.phiLength || 7) < 6.28 || (mm.geometry.parameters.thetaLength || 4) < 3.14 || t.includes('Lathe'));
    if (open > 0) F.push({ level: partial ? 'warn' : 'error', model: name, check: 'holes', part: label(mm), detail: partial ? `${open} open rim edges on a dome or turned part (check it sits against another part)` : `${open} open edges (missing faces)` });
  });
  // ports must sit on the model surface: a ray from just outside the socket back along -dir hits the model
  const ray = new THREE.Raycaster();
  (model.ports || []).filter((p) => p.type !== 'conveyor').forEach((p) => {   // conveyor ends are checked by their joint (gap and alignment)
    const wp = worldPos(p), wd = worldDir(p);
    ray.set(wp.clone().addScaledVector(wd, 0.05), wd.clone().negate()); ray.far = 0.25;
    const hit = ray.intersectObjects(meshes.filter((mm) => !mm.userData.socketPart), false)[0];
    if (!hit) F.push({ level: 'error', model: name, check: 'ports', part: p.id, detail: 'Socket is not on the machine surface (nothing behind it)' });
  });
  return F;
}
export function auditNetwork(models, net) {
  const F = [];
  models.forEach((md) => (md.ports || []).forEach((p) => {
    if (!p.links.length && !p.optional) F.push({ level: 'error', model: md.name, check: 'ports', part: p.id, detail: `${p.label} is not connected to anything` });
  }));
  net.links.forEach((L) => {
    const res = canConnect(L.a, L.b, L.kind);
    if (!res.ok) F.push({ level: 'error', model: L.a.owner.name, check: 'links', part: `${L.a.id} to ${L.b.owner.name}.${L.b.id}`, detail: res.reason });
    if (L.ends) {
      const da = L.ends[0].distanceTo(worldPos(L.a)), db = L.ends[1].distanceTo(worldPos(L.b));
      if (da > 0.02 || db > 0.02) F.push({ level: 'error', model: L.a.owner.name, check: 'links', part: `${L.a.id} to ${L.b.owner.name}.${L.b.id}`, detail: `Cable or pipe end is ${(Math.max(da, db) * 100).toFixed(0)} cm from its socket` });
    }
  });
  return F;
}
/** colliders: [{ model, box: THREE.Box3 (world) }] */
export function auditColliders(list) {
  const F = [];
  list.forEach(({ model, box }) => {
    // footprint of what a vehicle or a player can reach: parts that start below 2.5 m (a rotor 15 m up needs no ground collider)
    const mb = new THREE.Box3(); meshesOf(model.root).filter((mm) => !mm.material.transparent).forEach((mm) => { const b = new THREE.Box3().setFromObject(mm); if (b.min.y < 2.5) mb.union(b); });
    if (!box) { F.push({ level: 'error', model: model.name, check: 'collision', part: 'body', detail: 'No physics collider' }); return; }
    const ix = Math.max(0, Math.min(box.max.x, mb.max.x) - Math.max(box.min.x, mb.min.x)), iz = Math.max(0, Math.min(box.max.z, mb.max.z) - Math.max(box.min.z, mb.min.z));
    const cover = (ix * iz) / Math.max(1e-6, (mb.max.x - mb.min.x) * (mb.max.z - mb.min.z));
    if (cover < 0.5) F.push({ level: 'warn', model: model.name, check: 'collision', part: 'body', detail: `Collider covers only ${Math.round(cover * 100)}% of the footprint` });
  });
  return F;
}
