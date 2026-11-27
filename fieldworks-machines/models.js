// Fieldworks model loader: brings in .glb models made in Blender (see blender/), and swaps them in for the older
// code-built models without touching the game logic. The old model's group stays (its ports, picking, status
// lights and colliders are unchanged); only its visible meshes are hidden and the Blender model is added inside it.
// Named parts inside a model (belt, water0, water1, ...) are returned so the game can animate them. three.js r147.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader(), cache = new Map();
// Merge a loaded model's static meshes by material: a Blender model arrives as 100+ meshes, which would be 100+ draw
// calls (and as many again for shadows) every frame. Moving parts are left alone: anything under an animated node (an
// empty in Blender), and any glowing mesh (lamps, beams, screens), which the game drives one by one.
function mergeStatic(scene) {
  // each static mesh joins its nearest animated node (or the model root) in that node's own frame, so moving parts
  // become one mesh per material each and still turn as a unit
  scene.updateMatrixWorld(true);
  const m4 = new THREE.Matrix4(), groups = new Map(), done = [];
  scene.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.children.length) return;
    const mt = o.material; if (mt.emissive && mt.emissiveIntensity > 0 && (mt.emissive.r + mt.emissive.g + mt.emissive.b) > 0.05) return;
    let host = o.parent; while (host !== scene && host.isMesh) host = host.parent;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    Object.keys(g.attributes).forEach((k) => { if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); });
    g.applyMatrix4(m4.copy(host.matrixWorld).invert().multiply(o.matrixWorld));
    const key = host.uuid + '|' + mt.uuid + '|' + Object.keys(g.attributes).sort().join(',');
    if (!groups.has(key)) groups.set(key, { host, mat: mt, list: [] });
    groups.get(key).list.push(g); done.push(o);
  });
  done.forEach((o) => o.parent.remove(o));
  groups.forEach(({ host, mat, list }) => { const mm = new THREE.Mesh(list.length > 1 ? mergeBufferGeometries(list, false) : list[0], mat); mm.name = 'merged'; host.add(mm); });
  // glowing bits and other loose small meshes: no shadow of their own (too small to show, one shadow draw each)
  scene.traverse((o) => { if (o.isMesh && o.name !== 'merged') { o.geometry.computeBoundingSphere(); o.userData.smallCaster = o.geometry.boundingSphere.radius < 0.15; } });
  return scene;
}

// status lights added by glow.js are emissive and drawn on top: they stay (the caller may move them)
const isGlow = (m) => m.material && m.material.emissive && m.material.emissiveIntensity > 0 && !m.material.map && (m.material.emissive.r + m.material.emissive.g + m.material.emissive.b) > 0.05;
// screens and printed labels are canvas textures with live content: they stay, and the Blender models leave room for them
const isCanvas = (m) => m.material && ((m.material.map && m.material.map.isCanvasTexture) || (m.material.emissiveMap && m.material.emissiveMap.isCanvasTexture));
export function loadModel(url) {
  // the web demo can only serve scripts, so each .glb also ships as a .glb.js module holding it as base64
  const viaJs = (u) => import('./' + u + '.js').then((m) => { const b = atob(m.default), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return new Promise((ok, bad) => loader.parse(a.buffer, '', (g) => ok(g.scene), bad)); });
  if (!cache.has(url)) cache.set(url, viaJs(url).catch(() => new Promise((ok, bad) => loader.load(url, (g) => ok(g.scene), undefined, bad))).then(mergeStatic));
  return cache.get(url).then((s) => s.clone(true));
}
/** swap(host, url, o): hide host's own meshes (but not its port sockets or glow lights), add the model inside it.
 *  o.keep(mesh) -> true keeps an old mesh visible. o.attach: { nodeName: group } moves a node into a game group. Resolves to { scene, parts: { name: Object3D } }. */
export function swap(host, url, o) {
  o = o || {};
  return loadModel(url).then((scene) => {
    host.traverse((m) => { if (m.isMesh && !m.userData.socketPart && !isGlow(m) && !isCanvas(m) && !(o.keep && o.keep(m))) m.visible = false; });
    const parts = {};
    scene.traverse((m) => {
      if (m.name) parts[m.name] = m;
      if (!m.isMesh) return;
      m.castShadow = !m.userData.smallCaster; m.receiveShadow = true;
      const mat = m.material; if (mat) { mat.needsUpdate = true; mat.userData.lowpoly = true; mat.envMapIntensity = 0.85; if (mat.roughness !== undefined) mat.roughness = Math.max(0.28, mat.roughness); }   // the model's own bevelled normals give the mid-poly shading
    });
    scene.userData.fromBlender = url;
    host.add(scene);
    // moving parts: a named node goes into the game's own animated group, at that group's pivot
    const found = Object.entries(o.attach || {}).map(([name, group]) => [scene.getObjectByName(name), group]);   // find all first: a node can sit inside another one being moved
    found.forEach(([n, group]) => { if (!n || !group) return; group.add(n); n.position.set(0, 0, 0); n.quaternion.identity(); });
    return { scene, parts };
  }).catch((e) => { console.warn('Model not loaded, keeping the built-in one:', url, e && e.message); return null; });
}
