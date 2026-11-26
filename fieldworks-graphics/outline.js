// Fieldworks interaction outlines (graphics step 3).
// A clean outline that follows an object's real shape: subtle when the player looks at or walks up to something
// they can use, stronger when it's selected, green or red while placing. Outlines fade in and out.
// Uses three.js OutlinePass inside the graphics.js pipeline. Written for three.js r147. Usage is in OUTLINE.md.

import * as THREE from 'three';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

// Colours are final screen colours (the passes run after tone mapping).
export const OUTLINE_STYLES = {
  hover:   { color: '#f4efe2', hidden: null,      strength: 2.4, thickness: 1.0, glow: 0.0, pulse: 0 },
  select:  { color: '#ffc23d', hidden: '#5a4210', strength: 5.0, thickness: 1.6, glow: 0.35, pulse: 0 },
  place:   { color: '#46e07a', hidden: '#2a8a48', strength: 8.0, thickness: 2.2, glow: 0.8, pulse: 1.6 },
  blocked: { color: '#ff4a3a', hidden: '#a0281e', strength: 8.0, thickness: 2.2, glow: 0.8, pulse: 0.8 }
};

/**
 * createOutlines({ gfx, scene, camera, quality })
 *   gfx: the object from graphics.js createGraphics (the passes are added to its pipeline, after tone mapping).
 *   quality: 'low' | 'medium' | 'high'  (low halves the outline buffers again).
 */
export function createOutlines(opts) {
  const { gfx, scene } = opts;
  let camera = opts.camera;
  const composer = gfx.composer;
  const size = new THREE.Vector2();
  composer.renderer.getSize(size);

  // Two hover passes so the old target can fade out while the new one fades in.
  const slots = {};
  function makePass(style) {
    const p = new OutlinePass(new THREE.Vector2(size.x, size.y), scene, camera, []);
    p.enabled = false;
    p._style = style; p._level = 0; p._target = 0;
    applyStyle(p, OUTLINE_STYLES[style]);
    return p;
  }
  function applyStyle(p, s) {
    p.visibleEdgeColor.set(s.color).convertSRGBToLinear();
    p.hiddenEdgeColor.set(s.hidden || '#000000').convertSRGBToLinear();
    p.edgeThickness = s.thickness; p.edgeGlow = s.glow; p.pulsePeriod = s.pulse;
    p._strength = s.strength;
  }
  slots.hoverA = makePass('hover');
  slots.hoverB = makePass('hover');
  slots.select = makePass('select');
  slots.place = makePass('place');
  const passes = Object.values(slots);
  const finalIndex = composer.passes.indexOf(gfx.passes.final);
  passes.forEach((p, i) => composer.insertPass(p, finalIndex + 1 + i));

  function setQuality(q) {
    passes.forEach((p) => { p.downSampleRatio = q === 'low' ? 3 : 2; });
    resize();
  }
  function resize() {
    composer.renderer.getSize(size);
    const pr = composer.renderer.getPixelRatio();
    passes.forEach((p) => p.setSize(Math.round(size.x * pr), Math.round(size.y * pr)));
  }

  // ---------- targets ----------
  const roots = new Set();                 // registered interactable objects
  let hoverActive = slots.hoverA, hoverTarget = null, selectTarget = null, placeTarget = null;

  function setTarget(pass, obj) {
    pass.selectedObjects = obj ? [obj] : [];
    pass._target = obj ? 1 : 0;
  }
  function hover(obj) {
    obj = obj || null;
    if (obj === hoverTarget) return;
    // fade the current hover out on its own pass, bring the new one in on the other pass
    hoverActive._target = 0;
    hoverActive = hoverActive === slots.hoverA ? slots.hoverB : slots.hoverA;
    hoverTarget = obj;
    if (obj && obj !== selectTarget) setTarget(hoverActive, obj); else hoverActive._target = 0;
  }
  function select(obj) {
    selectTarget = obj || null;
    setTarget(slots.select, selectTarget);
    if (selectTarget && selectTarget === hoverTarget) hoverActive._target = 0;
  }
  function placing(obj, valid) {
    placeTarget = obj || null;
    applyStyle(slots.place, OUTLINE_STYLES[valid === false ? 'blocked' : 'place']);
    setTarget(slots.place, placeTarget);
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster();
  const centre = new THREE.Vector2(0, 0);
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  function rootOf(o) { while (o && !roots.has(o)) o = o.parent; return o || null; }
  /**
   * pick({ pointer, reach, player })
   *   pointer: normalised screen position (-1..1); defaults to the screen centre (first-person aim).
   *   reach: how far away something can be used (metres).
   *   player: the player's position, for the "walked up to it" fallback when nothing is under the aim.
   * Returns the interactable root object, or null.
   */
  function pick(o) {
    o = o || {};
    const reach = o.reach || 4;
    camera.updateMatrixWorld();
    ray.setFromCamera(o.pointer || centre, camera);
    ray.far = reach + camera.position.distanceTo(o.player || camera.position);
    const hits = ray.intersectObjects(Array.from(roots), true);
    for (const h of hits) { const r = rootOf(h.object); if (r && r.visible) return r; }
    if (!o.player) return null;
    // Nothing under the aim: the nearest interactable in front of the player within reach.
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    let best = null, bestD = reach * 0.75;
    roots.forEach((r) => {
      if (!r.visible) return;
      r.getWorldPosition(tmp);
      const d = tmp.distanceTo(o.player);
      tmp.sub(o.player).setY(0).normalize();
      if (d < bestD && tmp.dot(fwd) > 0.5) { best = r; bestD = d; }
    });
    return best;
  }

  // ---------- per frame ----------
  function update(dt) {
    passes.forEach((p) => {
      p._level += (p._target - p._level) * Math.min(1, dt * (p._target > p._level ? 12 : 9));
      p.edgeStrength = p._strength * p._level;
      if (p._target === 0 && p._level < 0.02) { p._level = 0; p.selectedObjects = []; }
      p.enabled = p.selectedObjects.length > 0;   // passes with nothing to draw cost nothing
    });
  }

  resize();
  return {
    register(obj) { roots.add(obj); return obj; },
    unregister(obj) { roots.delete(obj); if (hoverTarget === obj) hover(null); if (selectTarget === obj) select(null); },
    hover, select, placing, pick, update, resize, setQuality,
    setCamera(cam) { camera = cam; passes.forEach((p) => { p.renderCamera = cam; }); },
    get hovered() { return hoverTarget; },
    get selected() { return selectTarget; },
    passes: slots
  };
}
