// Fieldworks model loader: brings in .glb models made in Blender (see blender/), and swaps them in for the older
// code-built models without touching the game logic. The old model's group stays (its ports, picking, status
// lights and colliders are unchanged); only its visible meshes are hidden and the Blender model is added inside it.
// Named parts inside a model (belt, water0, water1, ...) are returned so the game can animate them. three.js r147.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader(), cache = new Map();
// status lights added by glow.js are emissive and drawn on top: they stay (the caller may move them)
const isGlow = (m) => m.material && m.material.emissive && m.material.emissiveIntensity > 0 && !m.material.map && (m.material.emissive.r + m.material.emissive.g + m.material.emissive.b) > 0.05;
export function loadModel(url) {
  if (!cache.has(url)) cache.set(url, new Promise((ok, bad) => loader.load(url, (g) => ok(g.scene), undefined, bad)));
  return cache.get(url).then((s) => s.clone(true));
}
/** swap(host, url, o): hide host's own meshes (but not its port sockets or glow lights), add the model inside it.
 *  o.keep(mesh) -> true keeps an old mesh visible. Resolves to { scene, parts: { name: Object3D } }. */
export function swap(host, url, o) {
  o = o || {};
  return loadModel(url).then((scene) => {
    host.traverse((m) => { if (m.isMesh && !m.userData.socketPart && !isGlow(m) && !(o.keep && o.keep(m))) m.visible = false; });
    const parts = {};
    scene.traverse((m) => {
      if (m.name) parts[m.name] = m;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      const mat = m.material; if (mat) { mat.userData.lowpoly = true; mat.envMapIntensity = 0.3; if (mat.roughness !== undefined) mat.roughness = Math.max(0.35, mat.roughness); }
    });
    scene.userData.fromBlender = url;
    host.add(scene);
    return { scene, parts };
  }).catch((e) => { console.warn('Model not loaded, keeping the built-in one:', url, e && e.message); return null; });
}
