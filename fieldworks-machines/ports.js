// Fieldworks connection points. Every machine declares ports where its visible sockets are: cable glands, pipe
// flanges, conveyor ends, hitches. Links (cables, pipes, belts) are only ever built from one port to another, so a
// cable always ends at a terminal and a pipe always meets a flange. canConnect() explains why a pair is invalid.
// Written for three.js r147.

import * as THREE from 'three';

const V = THREE.Vector3;
export const PORT_TYPES = {
  power:    { label: 'Electrical power', color: '#ffcf33', maxGap: 0.05 },
  water:    { label: 'Water pipe',       color: '#3fb6e8', maxGap: 0.05 },
  fuel:     { label: 'Fuel line',        color: '#e0702a', maxGap: 0.05 },
  conveyor: { label: 'Conveyor',         color: '#9bd04a', maxGap: 0.15, align: 25 },
  wire:     { label: 'Overhead line',    color: '#d0d0d0', maxGap: 0.05 },
  signal:   { label: 'Automation signal', color: '#c58cff', maxGap: 0.05 },
  hitch:    { label: 'Three-point hitch', color: '#e9b830', maxGap: 0.05, align: 10 }
};

/**
 * port(id, type, io, pos, dir, o): a connection point in the model's local space.
 *   io: 'in' | 'out' | 'both'. dir: the way the socket faces (a link leaves along it).
 *   o.capacity: kW, L/min or items/min. o.optional: may stay unconnected without being a fault.
 */
export function port(id, type, io, pos, dir, o) {
  o = o || {};
  return { id, type, io, pos: new V(...pos), dir: new V(...dir).normalize(), capacity: o.capacity || 0, optional: !!o.optional, label: o.label || id, links: [], owner: null, socket: o.socket !== false };
}
/** Attach ports to a built model and add the visible socket for each one (gland, flange or belt end plate). */
export function attachPorts(model, list, name) {
  model.ports = list; model.name = name || model.root.name;
  list.forEach((p) => { p.owner = model; if (p.socket) socket(model.root, p); });
  return model;
}
const mats = {};
function m(hex) { if (!mats[hex]) { mats[hex] = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), roughness: 0.6, metalness: 0.2, flatShading: true }); mats[hex].userData.lowpoly = true; } return mats[hex]; }
function socket(parent, p) {
  const g = new THREE.Group(); g.position.copy(p.pos); g.quaternion.setFromUnitVectors(new V(0, 1, 0), p.dir); parent.add(g);
  const add = (geo, hex, y) => { const mesh = new THREE.Mesh(geo, m(hex)); mesh.position.y = y; mesh.castShadow = true; mesh.userData.socketPart = true; g.add(mesh); return mesh; };
  if (p.type === 'power' || p.type === 'signal') { add(new THREE.CylinderGeometry(0.045, 0.055, 0.06, 8), '#2b2d30', -0.03); add(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 8), '#575b60', 0.0); }
  else if (p.type === 'water' || p.type === 'fuel') { add(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 10), '#8f979c', -0.018); }
  g.userData.socket = p.id; p.socketMesh = g;
  return g;
}
export function worldPos(p, out) { p.owner.root.updateMatrixWorld(true); return (out || new V()).copy(p.pos).applyMatrix4(p.owner.root.matrixWorld); }
export function worldDir(p, out) { const q = new THREE.Quaternion(); p.owner.root.getWorldQuaternion(q); return (out || new V()).copy(p.dir).applyQuaternion(q).normalize(); }
export function find(model, id) { const p = model.ports.find((q) => q.id === id); if (!p) throw new Error(`${model.name} has no port ${id}`); return p; }

/** canConnect(a, b, kind): { ok, reason } */
export function canConnect(a, b, kind) {
  if (a === b) return { ok: false, reason: 'A port cannot connect to itself' };
  if (a.type !== b.type) return { ok: false, reason: `${PORT_TYPES[a.type].label} cannot connect to ${PORT_TYPES[b.type].label.toLowerCase()}` };
  if (a.io === 'in' && b.io === 'in') return { ok: false, reason: 'Both ends are inputs: nothing would flow' };
  if (a.io === 'out' && b.io === 'out') return { ok: false, reason: 'Both ends are outputs' };
  if (a.type === 'conveyor' || kind === 'direct') {   // direct joints must touch and face each other
    const T = PORT_TYPES[a.type], pa = worldPos(a), pb = worldPos(b), gap = pa.distanceTo(pb);
    if (gap > T.maxGap) return { ok: false, reason: `Ends are ${(gap * 100).toFixed(0)} cm apart (max ${(T.maxGap * 100).toFixed(0)} cm)` };
    const ang = Math.acos(Math.max(-1, Math.min(1, -worldDir(a).dot(worldDir(b))))) * 57.3;
    if (ang > (T.align || 30)) return { ok: false, reason: `Ends are misaligned by ${ang.toFixed(0)}°` };
  }
  if (a.capacity && b.capacity && a.io === 'out' && b.capacity < a.capacity * 0.25) return { ok: true, warn: 'Receiving side is much smaller than the supply' };
  return { ok: true };
}
/** A network of links between ports. Visual builders receive the exact world end points. */
export function createNetwork() {
  const links = [];
  return {
    links,
    link(a, b, kind, build) {
      const res = canConnect(a, b, kind);
      if (!res.ok) throw new Error(`Cannot connect ${a.owner.name}.${a.id} to ${b.owner.name}.${b.id}: ${res.reason}`);
      const L = { a, b, kind, ok: true };
      a.links.push(L); b.links.push(L);
      if (build) {
        const pa = worldPos(a), pb = worldPos(b), da = worldDir(a), db = worldDir(b);
        L.mesh = build(pa, pb, da, db);
        L.ends = [pa.clone(), pb.clone()];
      }
      links.push(L); return L;
    },
    connected(p) { return p.links.length > 0; },
    unlink(L) { [L.a, L.b].forEach((p) => { const i = p.links.indexOf(L); if (i >= 0) p.links.splice(i, 1); }); const i = links.indexOf(L); if (i >= 0) links.splice(i, 1); }
  };
}
/** Ground-run route between two sockets: out of each socket along its facing, down to the ground, across. */
export function groundRoute(pa, pb, da, db, h) {
  h = h === undefined ? 0.05 : h;
  const a1 = pa.clone().addScaledVector(da, 0.12), b1 = pb.clone().addScaledVector(db, 0.12);
  const pts = [pa, a1];
  if (a1.y > h + 0.05) pts.push(new V(a1.x, h, a1.z));
  if (b1.y > h + 0.05) pts.push(new V(b1.x, h, b1.z));
  pts.push(b1, pb);
  return pts;
}
/** A tube that follows a polyline with tight rounded corners (cables and pipes). */
export function tubePath(pts, r, mat, parent) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < pts.length - 1; i++) if (pts[i].distanceTo(pts[i + 1]) > 1e-4) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  const geo = new THREE.TubeGeometry(path, Math.max(8, path.curves.length * 4), r, 6, false);
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.noOutline = r < 0.04;
  if (parent) parent.add(mesh);
  return mesh;
}
