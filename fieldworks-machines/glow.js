// Fieldworks glowing machines (graphics step 2).
// Status lights, LEDs, light strips, screens, headlights and beacons that show what a machine is doing,
// with one colour code for the whole game, smooth state changes, blinking, and a small pool of real lights
// so glowing parts tint nearby surfaces. Works with graphics.js: bloom picks up anything brighter than 1.0.
// Written for three.js r147. Usage is in GLOW.md.

import * as THREE from 'three';

// One colour code everywhere. "flow" = water or power moving.
export const STATUS = {
  running: { color: '#2fe06a', blink: 0, label: 'Running' },
  waiting: { color: '#ffae1a', blink: 1.0, label: 'Waiting' },
  stopped: { color: '#ff2a1f', blink: 0, label: 'Stopped' },
  flow:    { color: '#2fd6ff', blink: 0, pulse: 1.4, label: 'Flowing' },
  off:     { color: '#202020', blink: 0, label: 'Off' }
};
const STACK_ORDER = ['stopped', 'waiting', 'running'];   // top to bottom: red, amber, green

const INTENSITY = { led: 3.2, stack: 3.0, strip: 2.2, screen: 1.5, head: 5.0, beacon: 4.0 };
const POOL = { off: 0, low: 0, medium: 4, high: 8 };     // real lights for spill, by effects quality

const tmpV = new THREE.Vector3();
const linCache = new Map();
const lin = (h) => { let c = linCache.get(h); if (!c) { c = new THREE.Color(h).convertSRGBToLinear(); linCache.set(h, c); } return c.clone(); };

function glowMaterial(name, color) {
  return new THREE.MeshStandardMaterial({ name, color: lin('#1a1a1a'), emissive: lin(color), emissiveIntensity: 0, roughness: 0.35, metalness: 0 });
}

/**
 * createGlow({ scene, quality })
 * quality: 'low' | 'medium' | 'high' (maps to the number of spill lights; low = glow only, no extra lights).
 */
export function createGlow(opts) {
  const scene = opts.scene;
  const machines = new Set();
  let quality = opts.quality || 'high';

  // ---------- light pool: a fixed number of PointLights, handed to the nearest glowing parts ----------
  // Keeping the count fixed avoids shader recompiles; unused lights sit at intensity 0.
  const pool = [];
  const poolGroup = new THREE.Group(); poolGroup.name = 'GlowLightPool'; scene.add(poolGroup);
  function buildPool() {
    pool.forEach((l) => poolGroup.remove(l)); pool.length = 0;
    for (let i = 0; i < POOL[quality]; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 2.2, 2);
      l.castShadow = false; poolGroup.add(l); pool.push(l);
    }
  }
  buildPool();

  // ---------- parts ----------
  // Every part: { mesh, mat, kind, role, base (intensity), spill (light radius or 0) }
  function makePart(parent, mesh, kind, role, spill) {
    mesh.castShadow = false; mesh.receiveShadow = false;
    parent.add(mesh);
    return { mesh, mat: mesh.material, kind, role: role || null, base: INTENSITY[kind] || 2, spill: spill || 0, level: 0, color: new THREE.Color() };
  }

  function stackLight(parent, o) {
    const g = new THREE.Group(); g.position.copy(o.position || new THREE.Vector3()); parent.add(g);
    const r = o.radius || 0.033, seg = o.segment || 0.07;
    const housing = new THREE.MeshStandardMaterial({ color: lin('#16181a'), roughness: 0.6, metalness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.15, seg * 0.8, 16), housing);
    base.position.y = seg * 0.4; g.add(base);
    const parts = STACK_ORDER.slice().reverse().map((state, i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, seg * 0.94, 16), glowMaterial('stack_' + state, STATUS[state].color));
      m.position.y = seg * 0.8 + seg * (i + 0.5);
      return makePart(g, m, 'stack', state, 1.6);
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.9, seg * 0.4, 12), housing);
    cap.position.y = seg * 0.8 + seg * 3 + seg * 0.2; g.add(cap);
    return parts;
  }
  function led(parent, o) {
    const s = o.size || 0.012;
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), glowMaterial('led', STATUS.running.color));
    m.position.copy(o.position);
    return [makePart(parent, m, 'led', null, o.spill === false ? 0 : 0.9)];
  }
  function strip(parent, o) {
    const a = o.from, b = o.to, len = a.distanceTo(b), w = o.width || 0.012;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, w, w), glowMaterial('strip', STATUS.running.color));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tmpV.copy(b).sub(a).normalize());
    return [makePart(parent, m, 'strip', null, o.spill === false ? 0 : 1.4)];
  }
  function screen(parent, o) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.width || 0.24, o.height || 0.12), glowMaterial('screen', o.color || '#7fe8d6'));
    m.position.copy(o.position); if (o.rotation) m.rotation.copy(o.rotation);
    if (o.map) { m.material.emissiveMap = o.map; m.material.emissive.set(0xffffff); }
    return [makePart(parent, m, 'screen', 'screen', o.spill === false ? 0 : 1.2)];
  }
  function headlight(parent, o) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(o.radius || 0.07, 18), glowMaterial('headlight', '#fff4dc'));
    m.position.copy(o.position); m.lookAt(tmpV.copy(o.position).add(o.direction || new THREE.Vector3(0, 0, 1)));
    const part = makePart(parent, m, 'head', 'head', 0);
    if (o.beam !== false) {
      const spot = new THREE.SpotLight(lin('#fff1d6'), 0, o.range || 22, 0.5, 0.5, 1.6);
      spot.position.copy(o.position);
      spot.target.position.copy(o.position).add((o.direction || new THREE.Vector3(0, 0, 1)).clone().multiplyScalar(5)).add(new THREE.Vector3(0, -0.8, 0));
      parent.add(spot, spot.target); part.spot = spot;
    }
    return [part];
  }
  function beacon(parent, o) {
    const g = new THREE.Group(); g.position.copy(o.position); parent.add(g);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(o.radius || 0.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glowMaterial('beacon', '#ffae1a'));
    const p = makePart(g, dome, 'beacon', 'beacon', 1.8); p.rotor = g;
    return [p];
  }

  // ---------- machines ----------
  function attach(object, config) {
    const m = { object, parts: [], state: config && config.state || 'running', time: Math.random() * 10, tier: (config && config.tier) || 1, extra: (config && config.extra) || 1 };
    const add = (list) => { m.parts.push(...list); return list; };
    const api = {
      object,
      stackLight: (o) => add(stackLight(object, o)),
      led: (o) => add(led(object, o)),
      strip: (o) => add(strip(object, o)),
      screen: (o) => add(screen(object, o)),
      headlight: (o) => add(headlight(object, o)),
      beacon: (o) => add(beacon(object, o)),
      // Use an existing mesh as a glowing part (its material becomes emissive). role: a STATUS name for a fixed
      // colour (stack segments), or null to follow the machine's state.
      adopt: (mesh, kind, role) => {
        if (!mesh.material.isMeshStandardMaterial) return;
        mesh.material = mesh.material.clone();
        mesh.material.emissive = lin(role && STATUS[role] ? STATUS[role].color : STATUS.running.color);
        return add([{ mesh, mat: mesh.material, kind, role: role || null, base: INTENSITY[kind] || 2, spill: kind === 'screen' ? 1.2 : kind === 'stack' ? 1.6 : 0.9, level: 0, color: new THREE.Color() }]);
      },
      setState: (s) => { if (STATUS[s]) m.state = s; },
      get state() { return m.state; },
      setHeadlights: (on) => { m.headOn = !!on; },
      setBeacon: (on) => { m.beaconOn = !!on; },
      remove: () => { machines.delete(m); }
    };
    m.api = api; m.headOn = true; m.beaconOn = false;
    machines.add(m);
    return api;
  }

  // Quick upgrade for an existing machine model without hand placement: a stack light on the top back corner and
  // a strip along the bottom of the front face. Use explicit parts for hero machines.
  function autoFit(object, config) {
    const api = attach(object, config);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
    const lo = box.min.clone().applyMatrix4(inv), hi = box.max.clone().applyMatrix4(inv);
    const min = lo.clone().min(hi), max = lo.clone().max(hi), size = max.clone().sub(min);
    const s = Math.max(0.6, Math.min(2, size.y));
    api.stackLight({ position: new THREE.Vector3(max.x - 0.08 * s, max.y, min.z + 0.08 * s), radius: 0.03 * s, segment: 0.065 * s });
    if (!config || config.strip !== false) api.strip({ from: new THREE.Vector3(min.x + 0.05, min.y + size.y * 0.12, max.z + 0.006), to: new THREE.Vector3(max.x - 0.05, min.y + size.y * 0.12, max.z + 0.006), width: 0.012 * s });
    return api;
  }

  // ---------- per frame ----------
  const candidates = [];
  function update(dt, camera) {
    candidates.length = 0;
    machines.forEach((m) => {
      m.time += dt;
      const st = STATUS[m.state];
      const blinkOn = st.blink ? Math.sin(m.time * Math.PI * 2 * st.blink) > -0.2 : true;
      const pulse = st.pulse ? 0.75 + 0.25 * Math.sin(m.time * Math.PI * 2 * st.pulse) : 1;
      m.parts.forEach((p) => {
        let target, colorHex;
        if (p.kind === 'stack') {
          const lit = m.state === p.role || (m.state === 'flow' && p.role === 'running');
          target = lit && blinkOn ? 1 : 0.04;
          colorHex = STATUS[p.role].color;
        } else if (p.kind === 'head') {
          target = m.headOn ? 1 : 0; colorHex = '#fff4dc';
        } else if (p.kind === 'beacon') {
          target = m.beaconOn ? 1 : 0; colorHex = '#ffae1a';
          if (p.rotor && m.beaconOn) p.rotor.rotation.y += dt * 6;
        } else if (p.kind === 'screen') {
          target = m.state === 'off' ? 0.05 : 1; colorHex = null;
        } else {
          target = m.state === 'off' ? 0 : (blinkOn ? pulse : 0.15);
          colorHex = st.color;
        }
        if (colorHex) { p.color.copy(lin(colorHex)); if (!p.mat.emissiveMap) p.mat.emissive.lerp(p.color, Math.min(1, dt * 10)); }
        p.level += (target - p.level) * Math.min(1, dt * (target > p.level ? 14 : 8));
        p.mat.emissiveIntensity = p.base * p.level * m.extra * (m.tier > 1 ? 1 + 0.15 * (m.tier - 1) : 1);
        if (p.spot) p.spot.intensity = 2.2 * p.level;
        if (p.spill && p.level > 0.2 && pool.length) {
          p.mesh.getWorldPosition(tmpV);
          candidates.push({ p, pos: tmpV.clone(), d: camera ? tmpV.distanceToSquared(camera.position) : 0 });
        }
      });
    });
    // Hand the light pool to the closest glowing parts.
    candidates.sort((a, b) => a.d - b.d);
    pool.forEach((l, i) => {
      const c = candidates[i];
      if (!c || c.d > 30 * 30) { l.intensity = 0; return; }
      l.position.copy(c.pos);
      l.color.copy(c.p.mat.emissiveMap ? lin('#bfeee6') : c.p.mat.emissive);
      l.distance = c.p.spill * 1.6;
      l.intensity = 0.9 * c.p.level * c.p.spill;
    });
  }

  return {
    attach, autoFit, update,
    setQuality(q) { if (POOL[q] === undefined || q === quality) return; quality = q; buildPool(); },
    get machines() { return Array.from(machines, (m) => m.api); },
    STATUS
  };
}
