// Fieldworks placeable power: mechanical shafts, hydraulics, belts and the machines they drive, built by the player
// on a 1.2 m grid. Every part has typed ports on its sides (shaft, hydraulic, item). Parts placed next to each other
// connect when their facing ports match. Each tick the networks are solved:
//  - shaft networks: sources (electric motor, diesel engine, wind rotor) at their own speed; gearboxes change speed
//    (3:1 down, 1:25 up), shafts and gears lose a little each; two drives at different speeds fight and stall; a
//    clutch splits a network; machines get power in proportion and need their speed window.
//  - hydraulic networks: a power pack or a shaft-driven pump gives flow at up to 200 bar; consumers need a pressure
//    and a flow; an accumulator stores oil under pressure for peaks; a valve splits; an open hose end leaks.
//  - items: belts carry units cell to cell, machines buffer and process them, bins feed, pallets sell.
// Units are metres. three.js r147.

import * as THREE from 'three';
import { bake } from './lowpoly.js';

export const CELL = 1.2;
const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
function mat(hex, o) { const k = hex + JSON.stringify(o || {}); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.05, flatShading: true }, o || {})); m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m); } return mats.get(k); }
const M = {
  green: mat('#3f7d4c'), greenD: mat('#2f5a3b'), yellow: mat('#e9b830'), yellowD: mat('#c99a22'), cream: mat('#e6e0cf'), steel: mat('#a3a9ad', { metalness: 0.3, roughness: 0.5 }),
  steelD: mat('#6f767b', { metalness: 0.3, roughness: 0.55 }), dark: mat('#33363a'), black: mat('#1b1c1e'), red: mat('#c94232'), blue: mat('#2c4f7c', { roughness: 0.4, metalness: 0.3 }),
  orange: mat('#e0702a'), concrete: mat('#c4beb2', { roughness: 0.95 }), wood: mat('#9a7a52'), woodD: mat('#755c3c'), rubber: mat('#2a2c2e', { roughness: 0.9 }), brass: mat('#c9a13a', { metalness: 0.5, roughness: 0.4 }),
  sail: mat('#efe7d2', { roughness: 0.8 }), belt: mat('#34373a', { roughness: 0.9 }), hay: mat('#e2b950', { roughness: 0.95 }), log: mat('#8a5a32'), logEnd: mat('#d9b27a'), sack: mat('#d8c9a0', { roughness: 0.95 }), grain: mat('#d9a93a')
};
function put(p, m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (p) p.add(m); return m; }
const box = (w, h, d, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
const cyl = (r, h, seg, m, x, y, z, p, r2) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r2 === undefined ? r : r2, h, seg || 8), m), x, y, z);
const cylX = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateZ(Math.PI / 2), m), x, y, z);
const cylZ = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateX(Math.PI / 2), m), x, y, z);
function strut(p, a, b, t, m, round) {
  const d = b.clone().sub(a), len = d.length();
  const g = round ? new THREE.CylinderGeometry(t, t, len, 8).rotateX(Math.PI / 2) : new THREE.BoxGeometry(t, t, len);
  const mm = new THREE.Matrix4().lookAt(new V(), d, Math.abs(d.y / len) > 0.98 ? new V(1, 0, 0) : new V(0, 1, 0)); mm.setPosition(a.clone().add(b).multiplyScalar(0.5));
  return put(p, new THREE.Mesh(g.applyMatrix4(mm), m));
}

// ---------------------------------------------------------------------------
// sides: E +x, S +z, W -x, N -z (local). A part rotated r quarter turns (clockwise from above) turns E toward S.
export const SIDES = ['E', 'S', 'W', 'N'];
const DIR = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
export const turn = (side, r) => SIDES[(SIDES.indexOf(side) + r) % 4];
const HS = 0.62, HH = 0.32; export const BY = 0.55;   // shaft height, hose height, belt height
export const MATS = {
  grain: { name: 'Raw grain', buy: 0.5 }, meal: { name: 'Grain meal', sell: 1.4 },
  straw: { name: 'Loose straw', buy: 0.25 }, bale: { name: 'Straw bale', sell: 1.2 },
  log: { name: 'Log', buy: 1.0 }, firewood: { name: 'Firewood bundle', sell: 2.7 },
  plank: { name: 'Plank', sell: 1.5 }, stone: { name: 'Stone block', buy: 0.35 }, brick: { name: 'Cut brick', sell: 1.0 },
  ore: { name: 'Iron ore', buy: 0.8 }, ingot: { name: 'Iron ingot', sell: 3.9 }, crate: { name: 'Packed crate', sell: 0 }
};
export const BIN_MATS = ['grain', 'straw', 'log', 'stone', 'ore'];
// conveyor parts: items ride from the side they entered to the side the part sends them (local sides)
export const CONV = new Set(['belt', 'bturn', 'bleft', 'split', 'merge', 'filter', 'sensor']);
// ports: [side, type, io, group]. group: parts with internal shaft links say how speed changes between ports (ratio).
export const PARTS = {
  motor: { name: 'Electric motor', cat: 'mech', price: 1400, ports: [['E', 'shaft', 'out']], src: { kw: 5.5, rpm: 1500, electric: true }, note: '5.5 kW at 1,500 rpm from the yard network' },
  engine: { name: 'Diesel engine', cat: 'mech', price: 2600, ports: [['E', 'shaft', 'out']], src: { kw: 12, rpm: 1800, fuel: 3.4 }, note: '12 kW at 1,800 rpm, burns diesel' },
  wind: { name: 'Wind rotor', cat: 'mech', price: 2200, ports: [['E', 'shaft', 'out']], src: { wind: true }, note: 'Free power from the wind, but slow: about 8 rpm per m/s. Needs a step-up gearbox' },
  shaft: { name: 'Shaft', cat: 'mech', price: 120, ports: [['W', 'shaft', 'both'], ['E', 'shaft', 'both']], loss: 0.01, note: 'Carries power straight on (1% loss)' },
  bevel: { name: 'Bevel gearbox', cat: 'mech', price: 650, ports: [['W', 'shaft', 'both'], ['S', 'shaft', 'both']], loss: 0.03, note: 'Turns the drive 90° (3% loss)' },
  reducer: { name: 'Reduction gearbox 3:1', cat: 'mech', price: 900, ports: [['W', 'shaft', 'in'], ['E', 'shaft', 'out']], ratio: 1 / 3, loss: 0.04, note: 'Input on the west face: a third of the speed, three times the torque' },
  stepup: { name: 'Step-up gearbox 1:25', cat: 'mech', price: 1300, ports: [['W', 'shaft', 'in'], ['E', 'shaft', 'out']], ratio: 25, loss: 0.06, note: 'Input on the west face: 25 times the speed, for the wind rotor' },
  clutch: { name: 'Clutch', cat: 'mech', price: 480, ports: [['W', 'shaft', 'both'], ['E', 'shaft', 'both']], loss: 0.01, toggle: 'engaged', note: 'Engage or release to connect or split a line' },
  pack: { name: 'Hydraulic power pack', cat: 'hyd', price: 2400, ports: [['E', 'hyd', 'out']], hsrc: { flow: 45, bar: 200, kw: 7.5, electric: true }, note: '45 L/min at 200 bar from an electric motor' },
  pump: { name: 'Hydraulic pump', cat: 'hyd', price: 1100, ports: [['W', 'shaft', 'in'], ['E', 'hyd', 'out']], disp: 0.03, eff: 0.85, note: 'Shaft-driven: 30 mL per turn, so 45 L/min at 1,500 rpm' },
  hose: { name: 'Hose', cat: 'hyd', price: 60, ports: [['W', 'hyd', 'both'], ['E', 'hyd', 'both']], note: 'High-pressure hose' },
  corner: { name: 'Hose corner', cat: 'hyd', price: 80, ports: [['W', 'hyd', 'both'], ['S', 'hyd', 'both']], note: 'Hose with a 90° fitting' },
  tee: { name: 'Hose tee', cat: 'hyd', price: 140, ports: [['W', 'hyd', 'both'], ['E', 'hyd', 'both'], ['S', 'hyd', 'both']], note: 'Splits a line in two' },
  valve: { name: 'Valve', cat: 'hyd', price: 260, ports: [['W', 'hyd', 'both'], ['E', 'hyd', 'both']], toggle: 'open', note: 'Open or close to connect or isolate' },
  accum: { name: 'Accumulator', cat: 'hyd', price: 900, ports: [['W', 'hyd', 'both'], ['E', 'hyd', 'both']], store: 8, note: 'Stores 8 L of oil under pressure for peaks' },
  belt: { name: 'Belt', cat: 'belt', price: 180, ports: [['W', 'item', 'in'], ['E', 'item', 'out']], note: 'Carries units from the west end to the east end' },
  bturn: { name: 'Right turn belt', cat: 'belt', price: 260, ports: [['W', 'item', 'in'], ['S', 'item', 'out']], note: 'Turns units to the right' },
  bleft: { name: 'Left turn belt', cat: 'belt', price: 260, ports: [['W', 'item', 'in'], ['N', 'item', 'out']], note: 'Turns units to the left' },
  split: { name: 'Splitter', cat: 'belt', price: 650, ports: [['W', 'item', 'in'], ['N', 'item', 'out'], ['S', 'item', 'out']], note: 'Sends units left and right in turn; if one side is blocked, all go the other way' },
  merge: { name: 'Merger', cat: 'belt', price: 650, ports: [['W', 'item', 'in'], ['N', 'item', 'in'], ['S', 'item', 'in'], ['E', 'item', 'out']], note: 'Joins up to three belts into one' },
  filter: { name: 'Filter', cat: 'belt', price: 900, ports: [['W', 'item', 'in'], ['E', 'item', 'out'], ['S', 'item', 'out']], toggle: 'filter', note: 'Sends the chosen material to the right, everything else straight on' },
  sensor: { name: 'Belt sensor', cat: 'belt', price: 420, ports: [['W', 'item', 'in'], ['E', 'item', 'out']], note: 'A light curtain that counts every unit that passes' },
  sawmill: { name: 'Band sawmill', cat: 'machine', len: 2, price: 3400, ports: [['W', 'item', 'in', 0], ['E', 'item', 'out', 1]], use: { electric: true, kw: 1.2 }, recipe: ['log', 'plank', 1, 2], t: 2.6, note: 'One log into two planks. 1.2 kW from the yard network' },
  stonecutter: { name: 'Stone cutter', cat: 'machine', len: 2, price: 3800, ports: [['W', 'item', 'in', 0], ['E', 'item', 'out', 1]], use: { electric: true, kw: 1.5 }, recipe: ['stone', 'brick', 1, 3], t: 3.2, note: 'One block into three cut bricks, water-cooled. 1.5 kW' },
  smelter: { name: 'Ore smelter', cat: 'machine', len: 2, price: 5200, ports: [['W', 'item', 'in', 0], ['E', 'item', 'out', 1]], use: { electric: true, kw: 2.4 }, recipe: ['ore', 'ingot', 2, 1], t: 5, note: 'Two ore into one iron ingot. 2.4 kW induction furnace' },
  packer: { name: 'Crate packer', cat: 'machine', len: 2, price: 2900, ports: [['W', 'item', 'in', 0], ['E', 'item', 'out', 1]], use: { electric: true, kw: 0.5 }, recipe: ['*', 'crate', 4, 1], t: 2.2, note: 'Packs four of the same product into a crate worth 25% more. 0.5 kW' },
  bin: { name: 'Supply bin', cat: 'belt', price: 500, ports: [['E', 'item', 'out']], bin: true, note: 'Holds bought material and feeds it out of the east side' },
  mill: { name: 'Hammer mill', cat: 'machine', price: 2600, ports: [['W', 'shaft', 'in'], ['N', 'item', 'in'], ['S', 'item', 'out']], use: { shaft: true, kw: 4, rpm: [900, 2400] }, recipe: ['grain', 'meal'], t: 2.4, note: 'Grain → meal. Needs 4 kW on its shaft at 900–2,400 rpm' },
  baler: { name: 'Hydraulic baler', cat: 'machine', price: 3200, ports: [['W', 'hyd', 'in'], ['N', 'item', 'in'], ['S', 'item', 'out']], use: { hyd: true, bar: 150, flow: 25 }, recipe: ['straw', 'bale'], t: 3.0, note: 'Straw → bales. Needs 150 bar and 25 L/min' },
  splitter: { name: 'Log splitter', cat: 'machine', price: 2100, ports: [['W', 'hyd', 'in'], ['N', 'item', 'in'], ['S', 'item', 'out']], use: { hyd: true, bar: 120, flow: 15 }, recipe: ['log', 'firewood'], t: 3.6, note: 'Logs → firewood. Needs 120 bar and 15 L/min' },
  pallet: { name: 'Sales pallet', cat: 'belt', price: 300, ports: [['W', 'item', 'in'], ['N', 'item', 'in'], ['E', 'item', 'in'], ['S', 'item', 'in']], sink: true, note: 'Sells what arrives, 20 units a pallet' }
};

// ---------------------------------------------------------------------------
// 3D models. Each sits in its cell (origin at the cell centre, on the ground), facing local east.
export function partModel(type) {
  const root = new THREE.Group(); root.name = PARTS[type].name; root.userData.pick = 'parts';
  const spin = []; const A = {};
  const plate = (w, d, m) => box(w || 1.0, 0.06, d || 1.0, m || M.concrete, 0, 0.03, 0, root);
  const pillow = (x, z) => { box(0.16, HS - 0.1, 0.14, M.steelD, x, (HS - 0.1) / 2 + 0.04, z || 0, root); box(0.2, 0.1, 0.2, M.dark, x, HS - 0.04, z || 0, root); };
  const shaftG = (x0, x1, z, k) => { const g = new THREE.Group(); g.position.set((x0 + x1) / 2, HS, z || 0); root.add(g); cylX(0.045, x1 - x0, 8, M.steel, 0, 0, 0, g); box(0.02, 0.1, 0.02, M.yellow, 0, 0.0, 0.05, g); spin.push({ g, axis: 'x', port: k }); return g; };
  const hoseZ = (z0, z1, x) => { cylZ(0.04, z1 - z0, 8, M.rubber, x || 0, HH, (z0 + z1) / 2, root); };
  const hoseX = (x0, x1, z) => { cylX(0.04, x1 - x0, 8, M.rubber, (x0 + x1) / 2, HH, z || 0, root); };
  const ferrule = (x, z, ax) => (ax === 'z' ? cylZ : cylX)(0.06, 0.08, 8, M.brass, x, HH, z, root);
  const hoseStand = (x, z) => { box(0.08, HH - 0.04, 0.08, M.steelD, x, (HH - 0.04) / 2 + 0.03, z, root); box(0.14, 0.04, 0.14, M.steelD, x, HH - 0.06, z, root); };
  if (type === 'motor') {
    plate(1.0, 0.7);
    box(0.7, 0.1, 0.42, M.steelD, -0.05, 0.11, 0, root); [-0.3, 0.2].forEach((x) => box(0.08, HS - 0.38, 0.34, M.steelD, x, 0.16 + (HS - 0.38) / 2, 0, root));
    cylX(0.24, 0.62, 14, M.blue, -0.05, HS, 0, root); for (let k = 0; k < 5; k++) cylX(0.26, 0.03, 14, M.blue, -0.3 + k * 0.12, HS, 0, root);
    box(0.18, 0.14, 0.18, M.dark, -0.05, HS + 0.3, 0, root); cylX(0.14, 0.08, 10, M.steelD, -0.4, HS, 0, root);
    box(0.12, 0.5, 0.12, M.dark, -0.05, 0.31, -0.35, root);   // cable riser from the buried yard supply
    shaftG(0.26, 0.6, 0, 0);
  } else if (type === 'engine') {
    plate(1.0, 0.8);
    box(0.7, 0.46, 0.5, M.orange, -0.1, 0.29, 0, root); box(0.6, 0.18, 0.44, M.dark, -0.1, 0.61, 0, root);
    [-0.28, -0.1, 0.08].forEach((x) => box(0.1, 0.06, 0.36, M.steelD, x, 0.73, 0, root));
    cyl(0.05, 0.6, 8, M.steelD, -0.3, 0.98, -0.15, root); cyl(0.065, 0.06, 8, M.black, -0.3, 1.3, -0.15, root);
    box(0.3, 0.22, 0.16, M.red, -0.1, 0.26, 0.33, root);
    box(0.08, 0.3, 0.3, M.steelD, 0.29, HS - 0.06, 0, root);
    shaftG(0.25, 0.6, 0, 0); A.exhaust = new V(-0.3, 1.36, -0.15);
  } else if (type === 'wind') {
    plate(1.1, 1.1);
    const H = 4.2;
    [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]].forEach(([x, z]) => strut(root, new V(x, 0.06, z), new V(x * 0.25, H, z * 0.25), 0.06, M.steelD));
    for (let k = 0; k < 4; k++) { const y = 0.9 + k * 0.85, s = 1 - (y / H) * 0.75; [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]].forEach(([a, b, c, d]) => strut(root, new V(a * 0.42 * s, y, b * 0.42 * s), new V(c * 0.42 * s, y, d * 0.42 * s), 0.035, M.steel)); }
    box(0.36, 0.2, 0.36, M.dark, 0, H + 0.08, 0, root);
    const head = new THREE.Group(); head.position.set(0, H + 0.28, 0); root.add(head);
    box(0.5, 0.22, 0.24, M.green, 0, 0, 0, head); box(0.06, 0.5, 0.9, M.red, -0.55, 0.1, 0, head);   // tail vane
    strut(head, new V(-0.25, 0, 0), new V(-0.55, 0.1, 0), 0.04, M.steelD);
    const rotor = new THREE.Group(); rotor.position.set(0.34, 0, 0); head.add(rotor);
    cylX(0.12, 0.16, 10, M.dark, 0, 0, 0, rotor);
    for (let k = 0; k < 6; k++) { const arm = new THREE.Group(); arm.rotation.x = k * Math.PI / 3; rotor.add(arm); box(0.03, 1.3, 0.05, M.steelD, 0.02, 0.7, 0, arm); const sl = box(0.02, 0.9, 0.34, M.sail, 0.04, 0.85, 0.12, arm); sl.rotation.y = 0.35; }
    spin.push({ g: rotor, axis: 'x', port: 0 });
    // vertical drive shaft down the tower to a ground gearbox with the output on the east face
    const vs = new THREE.Group(); vs.position.set(0, (H + 0.06) / 2 + 0.2, 0); root.add(vs); cyl(0.035, H - 0.5, 8, M.steel, 0, 0, 0, vs); spin.push({ g: vs, axis: 'y', port: 0 });
    box(0.36, 0.42, 0.36, M.greenD, 0, 0.27, 0, root); box(0.2, 0.2, 0.2, M.greenD, 0.25, HS - 0.05, 0, root);
    shaftG(0.32, 0.6, 0, 0); A.head = head;
  } else if (type === 'shaft') {
    plate(1.0, 0.36); pillow(-0.3); pillow(0.3); shaftG(-0.6, 0.6, 0, 0);
  } else if (type === 'bevel' || type === 'reducer' || type === 'stepup' || type === 'clutch') {
    plate(1.0, type === 'bevel' ? 1.0 : 0.5);
    if (type === 'clutch') {
      pillow(-0.35); pillow(0.35); shaftG(-0.6, -0.08, 0, 0); shaftG(0.08, 0.6, 0, 1);
      const d1 = cylX(0.2, 0.06, 14, M.steelD, -0.06, HS, 0, root), d2 = new THREE.Group(); d2.position.set(0.06, HS, 0); root.add(d2); cylX(0.2, 0.06, 14, M.yellowD, 0, 0, 0, d2);
      box(0.06, 0.4, 0.06, M.dark, 0.15, 0.24, 0.3, root); const lever = new THREE.Group(); lever.position.set(0.15, 0.44, 0.3); root.add(lever); box(0.04, 0.5, 0.04, M.red, 0, 0.25, 0, lever); cyl(0.05, 0.08, 8, M.black, 0, 0.52, 0, lever);
      A.plate = d2; A.lever = lever; d1.userData.k = 0;
    } else {
      const big = type !== 'bevel';
      box(big ? 0.52 : 0.46, HS + 0.14, big ? 0.46 : 0.46, type === 'stepup' ? M.green : type === 'reducer' ? M.yellowD : M.steelD, 0, (HS + 0.14) / 2 + 0.03, 0, root);
      box(big ? 0.56 : 0.5, 0.05, big ? 0.5 : 0.5, M.dark, 0, HS + 0.2, 0, root);
      if (type === 'stepup') cyl(0.05, 0.08, 6, M.yellow, 0, HS + 0.26, 0.12, root);
      shaftG(-0.6, -0.2, 0, 0);
      if (type === 'bevel') { const g = new THREE.Group(); g.position.set(0, HS, 0.4); root.add(g); cylZ(0.045, 0.4, 8, M.steel, 0, 0, 0, g); box(0.1, 0.02, 0.02, M.yellow, 0.05, 0, 0, g); spin.push({ g, axis: 'z', port: 1 }); }
      else shaftG(0.2, 0.6, 0, 1);
    }
  } else if (type === 'pack') {
    plate(1.0, 0.8);
    box(0.7, 0.5, 0.56, M.red, -0.05, 0.31, 0, root); box(0.74, 0.04, 0.6, M.dark, -0.05, 0.58, 0, root);
    cylX(0.16, 0.42, 12, M.blue, -0.1, 0.78, 0, root); box(0.16, 0.2, 0.2, M.steelD, 0.2, 0.7, 0, root);
    cyl(0.07, 0.04, 12, M.cream, -0.3, 0.64, 0.24, root); cyl(0.05, 0.14, 8, M.steelD, 0.25, 0.65, -0.18, root);
    box(0.12, 0.12, 0.12, M.steelD, 0.36, HH, 0, root); hoseX(0.42, 0.6, 0); ferrule(0.56, 0, 'x');
    box(0.12, 0.5, 0.12, M.dark, -0.35, 0.31, -0.32, root);
  } else if (type === 'pump') {
    plate(1.0, 0.5); pillow(-0.35); shaftG(-0.6, -0.12, 0, 0);
    cylX(0.17, 0.3, 12, M.yellow, 0.05, HS - 0.05, 0, root); box(0.22, HS - 0.2, 0.3, M.steelD, 0.05, (HS - 0.2) / 2 + 0.04, 0, root);
    strut(root, new V(0.2, HS - 0.1, 0), new V(0.4, HH, 0), 0.05, M.rubber, true); hoseX(0.38, 0.6, 0); ferrule(0.56, 0, 'x');
  } else if (type === 'hose' || type === 'corner' || type === 'tee') {
    plate(type === 'hose' ? 1.0 : 0.6, type === 'hose' ? 0.3 : 0.6, M.steelD);
    hoseStand(0, 0);
    hoseX(-0.6, 0.04, 0); ferrule(-0.56, 0, 'x');
    if (type !== 'corner') { hoseX(-0.04, 0.6, 0); ferrule(0.56, 0, 'x'); }
    if (type !== 'hose') { hoseZ(-0.04, 0.6, 0); ferrule(0, 0.56, 'z'); cyl(0.07, 0.12, 8, M.brass, 0, HH, 0, root); }
    if (type === 'hose') { hoseStand(-0.4, 0); hoseStand(0.4, 0); }
  } else if (type === 'valve') {
    plate(1.0, 0.3, M.steelD); hoseStand(-0.4, 0); hoseStand(0.4, 0);
    hoseX(-0.6, -0.1, 0); hoseX(0.1, 0.6, 0); ferrule(-0.56, 0, 'x'); ferrule(0.56, 0, 'x');
    box(0.22, 0.2, 0.18, M.red, 0, HH, 0, root); cyl(0.03, 0.18, 6, M.steel, 0, HH + 0.18, 0, root);
    const h = new THREE.Group(); h.position.set(0, HH + 0.28, 0); root.add(h); box(0.36, 0.04, 0.06, M.yellow, 0.1, 0, 0, h); A.handle = h;
  } else if (type === 'accum') {
    plate(0.7, 0.7, M.steelD); hoseX(-0.6, 0.6, 0); ferrule(-0.56, 0, 'x'); ferrule(0.56, 0, 'x'); hoseStand(-0.4, 0); hoseStand(0.4, 0);
    cyl(0.2, 1.1, 12, M.orange, 0, 0.95, 0.0, root); put(root, new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), M.orange), 0, 1.5, 0);
    cyl(0.08, HH + 0.1, 8, M.steelD, 0, (HH + 0.4) / 2, 0, root); cyl(0.24, 0.06, 12, M.dark, 0, 0.4, 0, root);
    const g = box(0.04, 0.8, 0.03, mat('#58e0ff', { emissive: lin('#58e0ff'), emissiveIntensity: 0.8 }), 0.2, 0.62, 0, root); g.geometry.translate(0, 0.4, 0); g.userData.noOutline = true; A.level = g;
  } else if (type === 'belt' || type === 'bturn') {
    // a 1.2 m belt section on A-frame legs; the corner is a powered roller deck with guide rails
    [-0.45, 0.45].forEach((x) => [-1, 1].forEach((s) => strut(root, new V(x, 0.0, s * 0.34), new V(x, BY - 0.1, s * 0.3), 0.05, M.steelD)));
    [-0.45, 0.45].forEach((x) => box(0.06, 0.05, 0.7, M.steelD, x, BY - 0.12, 0, root));
    box(1.2, 0.1, 0.76, M.green, 0, BY - 0.08, 0, root);
    if (type === 'belt') {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#34373a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#6a6f72'; x.fillRect(28, 0, 6, 64);
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2.6, 1); tex.encoding = THREE.sRGBEncoding;
      const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }); bm.userData.lowpoly = true;
      box(1.2, 0.03, 0.7, bm, 0, BY - 0.02, 0, root); A.tex = tex;
      [-1, 1].forEach((s) => box(1.2, 0.08, 0.05, M.yellow, 0, BY + 0.03, s * 0.4, root));
      [-0.58, 0.58].forEach((x) => cylZ(0.06, 0.78, 8, M.steel, x, BY - 0.06, 0, root));
    } else {
      for (let k = 0; k < 7; k++) cylX(0.03, 0.7, 8, M.steel, 0, BY - 0.03, -0.3 + k * 0.1, root);
      box(0.06, 0.12, 1.2, M.yellow, 0.42, BY + 0.03, 0, root); box(1.2, 0.12, 0.06, M.yellow, 0, BY + 0.03, -0.42, root);
      box(0.1, 0.2, 0.1, M.yellowD, 0.0, BY + 0.06, 0.0, root).visible = false;
    }
    box(0.14, 0.14, 0.14, M.dark, 0.2, BY - 0.17, 0.3, root);   // drive motor hung under the belt frame
  } else if (type === 'bin') {
    [[-0.38, -0.38], [0.38, -0.38], [0.38, 0.38], [-0.38, 0.38]].forEach(([x, z]) => box(0.07, 1.25, 0.07, M.steelD, x, 0.625, z, root));
    plate(1.0, 1.0);
    box(0.92, 0.6, 0.92, M.yellow, 0, 1.55, 0, root); put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.16, 0.4, 4).rotateY(Math.PI / 4), M.yellowD), 0, 1.05, 0);
    box(0.2, 0.2, 0.2, M.steelD, 0, 0.88, 0, root); strut(root, new V(0, 0.85, 0), new V(0.6, BY + 0.06, 0), 0.06, M.steel, true);
    const lvl = box(0.03, 0.54, 0.04, mat('#3fd27a', { emissive: lin('#3fd27a'), emissiveIntensity: 0.8 }), 0.47, 1.28, 0.3, root); lvl.geometry.translate(0, 0.27, 0); lvl.userData.noOutline = true; A.level = lvl;
  } else if (type === 'mill' || type === 'baler' || type === 'splitter') {
    plate(1.1, 1.1);
    // item path through the machine runs north to south at belt height; the drive comes in from the west
    box(0.84, 0.08, 1.2, M.steelD, 0.1, BY - 0.1, 0, root); [-1, 1].forEach((s) => box(0.06, BY - 0.14, 0.06, M.steelD, 0.45, (BY - 0.14) / 2 + 0.04, s * 0.5, root)); [-1, 1].forEach((s) => box(0.06, BY - 0.14, 0.06, M.steelD, -0.25, (BY - 0.14) / 2 + 0.04, s * 0.5, root));
    if (type === 'mill') {
      cylX(0.34, 0.44, 14, M.green, 0.12, BY + 0.34, 0, root); box(0.5, 0.3, 0.5, M.greenD, 0.12, BY + 0.06, 0, root);
      put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.3, 4).rotateY(Math.PI / 4), M.steel), 0.12, BY + 0.8, -0.1);
      const pul = new THREE.Group(); pul.position.set(-0.22, BY + 0.34, 0); root.add(pul); cylX(0.26, 0.06, 14, M.yellowD, 0, 0, 0, pul); box(0.07, 0.48, 0.04, M.dark, 0, 0, 0, pul); spin.push({ g: pul, axis: 'x', port: 0 });
      strut(root, new V(-0.22, BY + 0.34, 0), new V(-0.22, HS, 0), 0.05, M.steel, true); pillow(-0.42); shaftG(-0.6, -0.2, 0, 0);
      strut(root, new V(-0.42, HS, 0), new V(-0.22, BY + 0.34, 0), 0.05, M.rubber);   // drive belt up to the rotor pulley
      A.shake = pul;
    } else {
      const long = type === 'baler';
      box(long ? 0.56 : 0.24, long ? 0.5 : 0.12, 1.1, long ? M.green : M.steelD, 0.12, BY + (long ? 0.25 : 0.06), 0, root);
      if (!long) { box(0.12, 0.4, 0.08, M.red, 0.12, BY + 0.32, 0.38, root); }   // splitting wedge at the south end
      cylZ(0.09, 0.6, 10, M.yellow, 0.12, BY + (long ? 0.62 : 0.3), -0.25, root);
      const ram = new THREE.Group(); ram.position.set(0.12, BY + (long ? 0.62 : 0.3), 0.05); root.add(ram); cylZ(0.04, 0.4, 8, M.steel, 0, 0, 0, ram); box(long ? 0.4 : 0.2, long ? 0.4 : 0.2, 0.04, M.steelD, 0, long ? -0.25 : 0, 0.2, ram);
      A.ram = ram; A.ram0 = 0.05;
      box(0.1, 0.12, 0.12, M.steelD, -0.33, HH, 0, root); hoseX(-0.6, -0.28, 0); ferrule(-0.56, 0, 'x'); strut(root, new V(-0.3, HH, 0), new V(0.05, BY + (long ? 0.62 : 0.3), -0.5), 0.035, M.rubber, true);
      box(0.1, BY + (long ? 0.62 : 0.3) - 0.2, 0.1, M.steelD, 0.05, (BY + (long ? 0.62 : 0.3) - 0.2) / 2 + 0.1, -0.5, root);
    }
  } else if (type === 'pallet') {
    box(1.0, 0.12, 0.9, M.wood, 0, 0.1, 0, root); [-0.4, 0, 0.4].forEach((dx) => box(0.1, 0.06, 0.9, M.woodD, dx, 0.03, 0, root));
    const g = new THREE.Group(); g.position.set(0, 0.16, 0); root.add(g); const items = [];
    for (let k = 0; k < 12; k++) { const m = box(0.28, 0.18, 0.24, M.sack, -0.32 + (k % 3) * 0.32, 0.09 + Math.floor(k / 6) * 0.19, -0.25 + Math.floor((k % 6) / 3) * 0.32, g); m.visible = false; items.push(m); }
    A.items = items; A.pg = g;
  }
  const keep = [...spin.map((s) => s.g), ...['plate', 'lever', 'handle', 'level', 'ram', 'head', 'pg', 'shake'].map((k) => A[k]).filter(Boolean)];
  bake(root, keep); root.userData.keep = keep;   // the animated pieces a Blender body leaves visible
  return { root, spin, A, type };
}
const IG = {};
export function itemMesh(m) {
  if (!IG[m]) {
    IG[m] = m === 'log' ? [new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8).rotateZ(Math.PI / 2).translate(0, 0.1, 0), M.log]
      : m === 'firewood' ? [new THREE.BoxGeometry(0.34, 0.16, 0.2).translate(0, 0.08, 0), M.logEnd]
      : m === 'straw' ? [new THREE.DodecahedronGeometry(0.12, 0).translate(0, 0.08, 0), M.hay]
      : m === 'bale' ? [new THREE.BoxGeometry(0.42, 0.22, 0.26).translate(0, 0.11, 0), M.hay]
      : m === 'grain' ? [new THREE.CylinderGeometry(0.1, 0.13, 0.12, 8).translate(0, 0.06, 0), M.grain]
      : m === 'plank' ? [new THREE.BoxGeometry(0.5, 0.05, 0.16).translate(0, 0.025, 0), mat('#d9b27a')]
      : m === 'stone' ? [new THREE.DodecahedronGeometry(0.15, 0).scale(1.2, 0.8, 1).translate(0, 0.11, 0), mat('#9a958c')]
      : m === 'brick' ? [new THREE.BoxGeometry(0.26, 0.1, 0.13).translate(0, 0.05, 0), mat('#b9b2a5')]
      : m === 'ore' ? [new THREE.IcosahedronGeometry(0.13, 0).translate(0, 0.1, 0), mat('#7a5a4a')]
      : m === 'ingot' ? [new THREE.CylinderGeometry(0.07, 0.11, 0.3, 4, 1).rotateY(Math.PI / 4).rotateZ(Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.05, 0), mat('#b8c0c6', { metalness: 0.5, roughness: 0.35 })]
      : m === 'crate' ? [new THREE.BoxGeometry(0.34, 0.26, 0.3).translate(0, 0.13, 0), mat('#b0834f')]
      : [new THREE.BoxGeometry(0.26, 0.14, 0.2).translate(0, 0.07, 0), M.sack];
  }
  const me = new THREE.Mesh(IG[m][0], IG[m][1]); me.castShadow = true; return me;
}

// ---------------------------------------------------------------------------
// The placed parts and their networks.
export class PartGrid {
  constructor() { this.parts = []; this.cells = new Map(); this.nextId = 1; this.items = 1; this.sold = {}; this.earned = 0; this.log = []; this.time = 0; this.nets = { shaft: [], hyd: [] }; }
  key(i, j) { return i + ',' + j; }
  at(i, j) { return this.cells.get(this.key(i, j)) || null; }
  note(t) { this.log.unshift({ t: this.time, text: t }); this.log.length = Math.min(this.log.length, 12); }
  add(type, i, j, r, st) {
    const P = PARTS[type]; const p = { id: this.nextId++, type, i, j, r: r || 0, on: true, engaged: true, open: true, supply: 0, mat: P.bin ? 'grain' : null, fmat: P.toggle === 'filter' ? 'log' : null, fuel: P.src && P.src.fuel ? 40 : 0, buf: [], out: [], belt: [], t: 0, stored: 0, made: 0, sold: 0, palletN: 0, palletV: 0 };
    if (st) Object.assign(p, st);
    this.parts.push(p); this.footprint(p).forEach(([a, b]) => this.cells.set(this.key(a, b), p)); this.solve(); return p;
  }
  remove(p) { this.parts = this.parts.filter((q) => q !== p); this.footprint(p).forEach(([a, b]) => this.cells.delete(this.key(a, b))); this.solve(); }
  // the cells a part covers: long machines run along their local x (east)
  static cellsOf(type, i, j, r) { const n = PARTS[type].len || 1, [dx, dz] = DIR[turn('E', r || 0)]; return Array.from({ length: n }, (_, k) => [i + dx * k, j + dz * k]); }
  footprint(p) { return PartGrid.cellsOf(p.type, p.i, p.j, p.r); }
  // world side of a port, the cell it sits on, and the neighbouring part's matching port
  ports(p) { const [dx, dz] = DIR[turn('E', p.r)]; return PARTS[p.type].ports.map(([side, type, io, off], k) => ({ p, k, side: turn(side, p.r), type, io, ci: p.i + dx * (off || 0), cj: p.j + dz * (off || 0) })); }
  peer(port) {
    const [di, dj] = DIR[port.side], q = this.at(port.ci + di, port.cj + dj); if (!q || q === port.p) return null;
    const qp = this.ports(q).find((x) => x.side === OPP[port.side] && x.type === port.type && x.ci + DIR[x.side][0] === port.ci && x.cj + DIR[x.side][1] === port.cj); if (!qp) return null;
    if (port.type === 'item' && !((port.io === 'out' && qp.io === 'in') || (port.io === 'in' && qp.io === 'out'))) return null;
    if (port.type === 'shaft' && ((port.io === 'out' && qp.io === 'out') || (port.io === 'in' && qp.io === 'in'))) return { bad: true, q, qp };
    return { q, qp };
  }
  // group shaft and hydraulic ports into networks (connected components through parts and joints)
  solve() {
    const N = { shaft: [], hyd: [] };
    ['shaft', 'hyd'].forEach((T) => {
      const seen = new Set(), nodes = []; this.parts.forEach((p) => this.ports(p).forEach((pt) => { if (pt.type === T) nodes.push(pt); }));
      const id = (pt) => pt.p.id + ':' + pt.k;
      nodes.forEach((start) => {
        if (seen.has(id(start))) return;
        const net = { type: T, ports: [], parts: new Set(), open: [], clash: [] }, st = [start]; seen.add(id(start));
        while (st.length) {
          const pt = st.pop(); net.ports.push(pt); net.parts.add(pt.p);
          // inside the part: shafts pass through unless a clutch is released; hydraulics pass unless a valve is closed;
          // machines and sources end the line
          const P = PARTS[pt.p.type];
          const through = T === 'shaft' ? (pt.p.type === 'clutch' ? pt.p.engaged : !!(P.loss || P.ratio)) : (pt.p.type === 'valve' ? pt.p.open : ['hose', 'corner', 'tee', 'accum'].includes(pt.p.type));
          if (through) this.ports(pt.p).forEach((o) => { if (o.type === T && !seen.has(id(o))) { seen.add(id(o)); st.push(o); } });
          const pe = this.peer(pt);
          if (!pe) { if (through || (T === 'hyd' && P.hsrc) || (T === 'hyd' && pt.p.type === 'pump')) net.open.push(pt); continue; }
          if (pe.bad) net.clash.push(pt);
          if (!seen.has(id(pe.qp))) { seen.add(id(pe.qp)); st.push(pe.qp); }
        }
        N[T].push(net);
      });
    });
    this.nets = N;
    this.parts.forEach((p) => { p.net = {}; });
    N.shaft.forEach((n) => n.parts.forEach((p) => { p.net.shaft = n; })); N.hyd.forEach((n) => n.parts.forEach((p) => { p.net.hyd = n; }));
  }
  // speed of every shaft port in a network, from its first source; returns conflicts between sources
  speeds(net, env) {
    const rpm = new Map(), id = (pt) => pt.p.id + ':' + pt.k;
    const src = net.ports.filter((pt) => PARTS[pt.p.type].src && pt.io === 'out');
    const srpm = (pt) => (PARTS[pt.p.type].src.wind ? env.wind * 8 : PARTS[pt.p.type].src.rpm) * (this.running(pt.p, env) ? 1 : 0);
    let conflict = null;
    src.forEach((s0) => {
      if (rpm.has(id(s0))) { const a = rpm.get(id(s0)), b = srpm(s0); if (a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) > 0.1) conflict = [a, b]; return; }
      const st = [[s0, srpm(s0)]]; rpm.set(id(s0), srpm(s0));
      while (st.length) {
        const [pt, r] = st.pop(), P = PARTS[pt.p.type];
        const inside = pt.p.type === 'clutch' ? pt.p.engaged : !!(P.loss || P.ratio);
        if (inside) this.ports(pt.p).forEach((o) => { if (o.type !== 'shaft' || o.k === pt.k) return; let rr = r; if (P.ratio) rr = pt.io === 'in' ? r * P.ratio : r / P.ratio; if (!rpm.has(id(o))) { rpm.set(id(o), rr); st.push([o, rr]); } });
        const pe = this.peer(pt); if (pe && !pe.bad) { if (!rpm.has(id(pe.qp))) { rpm.set(id(pe.qp), r); st.push([pe.qp, r]); } else if (PARTS[pe.q.type].src) { const a = rpm.get(id(pe.qp)); if (a > 0 && r > 0 && Math.abs(a - r) / Math.max(a, r) > 0.1) conflict = [a, r]; } }
      }
    });
    return { rpm, conflict };
  }
  running(p, env) { const S = PARTS[p.type].src || PARTS[p.type].hsrc; if (!S) return true; if (!p.on) return false; if (S.electric && !env.powered) return false; if (S.fuel && p.fuel <= 0) return false; if (S.wind && (env.wind < 2.5 || env.wind > 24)) return false; return true; }
  srcKw(p, env) { const S = PARTS[p.type].src; if (!this.running(p, env)) return 0; if (S.wind) return Math.min(6, 0.006 * Math.pow(env.wind, 3)); return S.kw; }
  // tick: env { wind, powered (yard power for electric parts), dt }. Returns { kw (yard electricity), earned }
  tick(dt, env) {
    this.time += dt; let gridKw = 0, earned = 0;
    // shaft networks: supply, losses, demand (machines and pumps), speeds
    this.nets.shaft.forEach((n) => {
      const { rpm, conflict } = this.speeds(n, env); n.rpm = rpm; n.conflict = conflict;
      let eff = 1; n.parts.forEach((p) => { const L = PARTS[p.type].loss; if (L) eff *= 1 - L; }); n.eff = eff;
      const srcs = [...n.parts].filter((p) => PARTS[p.type].src), supply = conflict ? 0 : srcs.reduce((a, p) => a + this.srcKw(p, env), 0) * eff;
      const users = [...n.parts].filter((p) => (PARTS[p.type].use && PARTS[p.type].use.shaft) || p.type === 'pump');
      const want = users.reduce((a, p) => a + (p.type === 'pump' ? (p.wantKw || 0) : p.busy ? PARTS[p.type].use.kw : 0.15), 0);
      n.supply = supply; n.want = want; n.f = want > 0 ? Math.min(1, supply / want) : supply > 0 ? 1 : 0;
      const used = Math.min(supply, want) / Math.max(eff, 0.01), sKw = srcs.reduce((a, p) => a + this.srcKw(p, env), 0) || 1;
      srcs.forEach((p) => { const share = this.srcKw(p, env) / sKw, load = used * share; p.loadKw = load; const S = PARTS[p.type].src; if (S.electric) gridKw += load / 0.92 + 0.05; if (S.fuel) p.fuel = Math.max(0, p.fuel - S.fuel * (0.15 + 0.85 * load / S.kw) * dt / 3600); });
      users.forEach((p) => { const pt = this.ports(p).find((x) => x.type === 'shaft'); p.rpm = rpm.get(p.id + ':' + pt.k) || 0; p.f = n.f; });
    });
    this.parts.forEach((p) => { if (!p.net.shaft || ![...p.net.shaft.parts].some((q) => PARTS[q.type].src)) { if ((PARTS[p.type].use && PARTS[p.type].use.shaft) || p.type === 'pump') { p.f = 0; p.rpm = 0; } } });
    // hydraulic networks. A source gives flow at whatever pressure the work needs, limited by its power
    // (kW = bar x L/min / 600): a weak pump still reaches 150 bar, only with less flow, so the ram moves slower.
    // Accumulators fill when nothing is working and give a fast stroke; an open hose end lets the pressure out.
    this.nets.hyd.forEach((n) => {
      const srcs = [...n.parts].filter((p) => PARTS[p.type].hsrc || p.type === 'pump');
      const users = [...n.parts].filter((p) => PARTS[p.type].use && PARTS[p.type].use.hyd), accs = [...n.parts].filter((p) => p.type === 'accum');
      const leak = n.open.length > 0, working = users.filter((p) => p.busy);
      const bar = working.length ? Math.max(...working.map((p) => PARTS[p.type].use.bar)) : 200;
      const want = working.reduce((a, p) => a + PARTS[p.type].use.flow, 0);
      const qAt = (p) => { if (p.type === 'pack') return this.running(p, env) ? PARTS.pack.hsrc.flow : 0; const kw = (p.f || 0) * (p.wantKw || 0); return Math.min(PARTS.pump.disp * (p.rpm || 0), kw * PARTS.pump.eff * 600 / bar); };
      let flow = srcs.reduce((a, p) => a + qAt(p), 0), fromAcc = 0;
      if (leak) { accs.forEach((a) => { a.stored = Math.max(0, a.stored - 30 * dt / 60); }); }
      else if (want > 0) { accs.forEach((a) => { const q = Math.min(a.stored, Math.max(0, want - flow - fromAcc) * dt / 60); a.stored -= q; fromAcc += q * 60 / dt; }); }
      else { let spare = flow; accs.forEach((a) => { const q = Math.min(PARTS.accum.store - a.stored, spare * dt / 60); a.stored += q; spare -= q * 60 / dt; }); }
      const total = leak ? 0 : flow + fromAcc;
      const f = want > 0 ? Math.min(1, total / want) : 0;
      working.forEach((p) => { p.f = f; p.bar = total > 0 ? PARTS[p.type].use.bar : 0; });
      users.filter((p) => !p.busy).forEach((p) => { p.f = leak || !srcs.length ? 0 : 1; p.bar = leak ? 0 : 200; });
      const charging = !leak && !want && accs.some((a) => a.stored < PARTS.accum.store - 0.01);
      n.flow = total; n.want = want; n.leak = leak; n.bar = leak ? Math.min(12, flow * 0.3) : want > 0 ? (total > 0 ? bar : 0) : (flow > 0 || accs.some((a) => a.stored > 0.1) ? 200 : 0);
      // what the sources are asked for: the users, or refilling the accumulators, or the leak
      const askQ = (want > 0 ? want : charging ? 45 : 0) + (leak ? 30 : 0);
      srcs.forEach((p) => {
        const share = askQ / Math.max(1, srcs.length);
        if (p.type === 'pack') { const q = this.running(p, env) ? Math.min(PARTS.pack.hsrc.flow, share) : 0; gridKw += this.running(p, env) ? 0.1 + PARTS.pack.hsrc.kw * q / PARTS.pack.hsrc.flow : 0; p.loadQ = q; }
        else { p.wantNext = Math.min(share, PARTS.pump.disp * (p.rpm || 0)) * bar / 600 / PARTS.pump.eff; p.loadQ = Math.min(qAt(p), share); }
      });
      if (!srcs.length) users.forEach((p) => { p.f = 0; p.bar = 0; });
    });
    this.parts.forEach((p) => { if (p.type === 'pump') p.wantKw = Math.max(0.05, p.wantNext || 0); if (PARTS[p.type].use && PARTS[p.type].use.hyd && !p.net.hyd) { p.f = 0; p.bar = 0; } });
    // machines: speed windows, processing, buffers
    this.parts.forEach((p) => {
      const P = PARTS[p.type]; if (!P.use) return;
      let f = p.f || 0;
      if (P.use.electric) { f = env.powered && p.on ? 1 : 0; p.why = !env.powered ? 'No yard power' : null; gridKw += p.busy && f ? P.use.kw : 0.08; }
      if (P.use.shaft) { const [lo, hi] = P.use.rpm; if (p.rpm > hi) { f = 0; p.why = `Overspeed: ${Math.round(p.rpm)} rpm, its limit is ${hi}`; } else if (p.rpm < lo) { f *= p.rpm / lo; p.why = p.rpm > 0 ? `Too slow: ${Math.round(p.rpm)} rpm, it needs ${lo}` : null; } else p.why = null; }
      p.speed = f;
      // hydraulic machines eject the finished unit and reload between strokes (no oil used then: accumulators refill)
      if (p.rest > 0) p.rest -= dt;
      const need = P.recipe[2] || 1, make = P.recipe[3] || 1;
      if (!p.busy && !(p.rest > 0) && p.buf.length >= need && p.out.length < 4) { p.busy = true; p.t = P.t; p.cur = p.buf.splice(0, need); }
      if (p.busy) {
        p.t -= dt * f;
        if (p.t <= 0) {
          p.busy = false; p.made++; if (P.use.hyd) p.rest = 2.0;
          const val = p.cur.reduce((a, it) => a + (it.val || MATS[it.mat].sell || MATS[it.mat].buy || 0), 0);
          for (let k = 0; k < make; k++) p.out.push(P.recipe[1] === 'crate' ? { id: this.items++, mat: 'crate', inside: p.cur[0].mat, val: val * 1.25 } : { id: this.items++, mat: P.recipe[1] });
          p.cur = null;
        }
      }
    });
    // belts and transfers. Conveyor items carry the local side they came in by (from), the side they leave by (to)
    // and their progress p (0..1) along that path; spacing keeps them 0.34 of a cell apart.
    const speed = env.powered ? 0.55 : 0; this.beltSpeed = speed;
    const local = (q, worldSide) => SIDES[(SIDES.indexOf(worldSide) - q.r + 4) % 4];
    const inPort = (q, side) => this.ports(q).find((x) => x.type === 'item' && x.io === 'in' && x.side === side);
    const accepts = (q, side, it) => { // can part q take this unit entering through its world side `side`?
      if (!inPort(q, side)) return false;
      if (CONV.has(q.type)) return !q.belt.some((o) => o.p < 0.36);
      const P = PARTS[q.type];
      if (P.use) {
        const need = P.recipe[2] || 1;
        if (P.recipe[0] === '*') return it.mat !== 'crate' && q.buf.length < need * 2 && (!q.buf.length || q.buf[0].mat === it.mat) && (!q.cur || q.cur[0].mat === it.mat || !q.buf.length);
        return q.buf.length < Math.max(4, need * 2) && it.mat === P.recipe[0];
      }
      return q.type === 'pallet';
    };
    const routeOut = (q, it) => {
      const T = q.type;
      if (T === 'bturn') return 'S'; if (T === 'bleft') return 'N';
      if (T === 'filter') return it.mat === q.fmat ? 'S' : 'E';
      if (T === 'split') { const a = q.flip ? 'S' : 'N'; q.flip = !q.flip; return a; }
      return 'E';
    };
    const give = (q, it, worldSide) => {
      if (CONV.has(q.type)) { it.p = 0; it.from = local(q, worldSide); it.to = routeOut(q, it); q.belt.push(it); return; }
      if (q.type === 'pallet') { q.palletN++; const v = it.val || MATS[it.mat].sell || (MATS[it.mat].buy || 0) * 0.5; q.palletV += v; this.sold[it.mat] = (this.sold[it.mat] || 0) + 1; return; }
      q.buf.push(it);
    };
    // the neighbour across a local side of part p (for long parts the port says which cell)
    const across = (p, lside) => { const pt = this.ports(p).find((x) => x.type === 'item' && x.io === 'out' && x.side === turn(lside, p.r)); if (!pt) return null; const [di, dj] = DIR[pt.side], q = this.at(pt.ci + di, pt.cj + dj); return q && q !== p ? { q, side: OPP[pt.side] } : null; };
    const outPeer = (p) => { const pt = this.ports(p).find((x) => x.type === 'item' && x.io === 'out'); return pt ? across(p, SIDES[(SIDES.indexOf(pt.side) - p.r + 4) % 4]) : null; };
    this.parts.forEach((p) => {
      if (CONV.has(p.type)) {
        p.belt.sort((a, b) => b.p - a.p);
        for (let k = 0; k < p.belt.length; k++) {
          const it = p.belt[k], lim = k === 0 ? 1 : p.belt[k - 1].p - 0.34;
          // a splitter picks its side at the centre: the other side if this one is blocked
          if (p.type === 'split' && it.p < 0.5 && Math.min(lim, it.p + speed * dt / CELL) >= 0.5) { const o = across(p, it.to); if (!o || !accepts(o.q, o.side, it)) { const alt = it.to === 'N' ? 'S' : 'N', o2 = across(p, alt); if (o2 && accepts(o2.q, o2.side, it)) it.to = alt; } }
          it.p = Math.max(it.p, Math.min(lim, it.p + speed * dt / CELL));
        }
        const h = p.belt[0];
        if (h && h.p >= 1) { const o = across(p, h.to); if (o && accepts(o.q, o.side, h)) { give(o.q, p.belt.shift(), o.side); if (p.type === 'sensor') { p.count = (p.count || 0) + 1; p.blink = 0.4; } } }
        if (p.blink > 0) p.blink -= dt;
      } else if (p.type === 'bin') {
        p.cool = (p.cool || 0) - dt;
        if (p.supply >= 1 && p.cool <= 0) { const o = outPeer(p), it = { id: this.items++, mat: p.mat }; if (o && accepts(o.q, o.side, it)) { give(o.q, it, o.side); p.supply -= 1; p.cool = 1.4; } }
      } else if (PARTS[p.type].use && p.out.length) { const o = outPeer(p); if (o && accepts(o.q, o.side, p.out[0])) give(o.q, p.out.shift(), o.side); }
      else if (p.type === 'pallet' && p.palletN >= 20) { earned += p.palletV; this.earned += p.palletV; this.note(`Pallet sold: ${p.palletN} units for $${p.palletV.toFixed(0)}`); p.sold += p.palletN; p.palletN = 0; p.palletV = 0; }
    });
    gridKw += this.parts.filter((p) => CONV.has(p.type)).length * 0.12;
    return { kw: gridKw, earned };
  }
  // what to draw on a part: [{ it, x, y, z }] in the part's local frame (x east along its length, z south)
  visItems(p) {
    const SP = { E: [0.6, 0], W: [-0.6, 0], N: [0, -0.6], S: [0, 0.6] }, out = [];
    if (CONV.has(p.type)) p.belt.forEach((it) => { const a = SP[it.from] || SP.W, b = SP[it.to] || SP.E, t = it.p; const [x, z] = t < 0.5 ? [a[0] * (1 - t * 2), a[1] * (1 - t * 2)] : [b[0] * (t - 0.5) * 2, b[1] * (t - 0.5) * 2]; out.push({ it, x, y: BY, z }); });
    else if (PARTS[p.type].use) {
      const L = (PARTS[p.type].len || 1) * CELL / 2;
      if (PARTS[p.type].len) { (p.buf || []).slice(0, 2).forEach((it, k) => out.push({ it, x: -L + 0.25 + k * 0.32, y: BY, z: 0 })); if (p.busy && p.cur) out.push({ it: p.cur[0], x: -0.1 + (1 - Math.max(0, p.t) / PARTS[p.type].t) * 0.3, y: BY, z: 0 }); if (p.out[0]) out.push({ it: p.out[0], x: L - 0.25, y: BY, z: 0 }); }
      else if (p.out[0]) out.push({ it: p.out[0], x: 0.1, y: BY, z: 0.45 });
    }
    return out;
  }
  // is there a part past this conveyor's exit that could ever take this unit (a busy machine is just a queue)
  nextTakes(p, it) {
    const pt = this.ports(p).find((x) => x.type === 'item' && x.io === 'out' && x.side === turn(it.to || 'E', p.r)); if (!pt) return false;
    const [di, dj] = DIR[pt.side], q = this.at(pt.ci + di, pt.cj + dj); if (!q || q === p) return false;
    if (!this.ports(q).some((x) => x.type === 'item' && x.io === 'in' && x.side === OPP[pt.side])) return false;
    const R = PARTS[q.type].recipe; return !R || R[0] === '*' || R[0] === it.mat;
  }
  // engineering check of the whole build: open ends, clashes, drives fighting, speeds, pressures
  diagnose() {
    const out = [], add = (lvl, text, fix) => out.push({ lvl, text, fix: fix || '' }), at = (p) => `${PARTS[p.type].name} at ${p.i},${p.j}`;
    this.nets.shaft.forEach((n) => {
      if (n.conflict) add('error', `Two drives fight on one shaft line: ${Math.round(n.conflict[0])} vs ${Math.round(n.conflict[1])} rpm`, 'Split them with a clutch, or match their speeds with a gearbox');
      n.clash.forEach((pt) => add('error', `${at(pt.p)}: two outputs face each other`, 'Turn one of them around'));
      const hasSrc = [...n.parts].some((p) => PARTS[p.type].src), users = [...n.parts].filter((p) => (PARTS[p.type].use && PARTS[p.type].use.shaft) || p.type === 'pump');
      if (users.length && !hasSrc) users.forEach((p) => add('warn', `${at(p)}: no drive on its shaft line`, 'Connect a motor, an engine or a wind rotor'));
      if (hasSrc && users.length && n.f < 0.99 && n.want > 0.2) add('warn', `Shaft line underpowered: ${n.supply.toFixed(1)} of ${n.want.toFixed(1)} kW`, 'Add a drive, or more wind');
    });
    this.nets.hyd.forEach((n) => {
      if (n.leak) n.open.forEach((pt) => add('error', `${at(pt.p)}: open hose end, oil is spraying out`, 'Cap it with a valve, connect it, or remove it'));
      const users = [...n.parts].filter((p) => PARTS[p.type].use && PARTS[p.type].use.hyd), srcs = [...n.parts].filter((p) => PARTS[p.type].hsrc || p.type === 'pump');
      if (users.length && !srcs.length) users.forEach((p) => add('warn', `${at(p)}: no pressure source on its line`, 'Connect a power pack or a pump'));
      users.forEach((p) => { if (p.busy && srcs.length && !n.leak && p.f < 0.5) add('warn', `${at(p)}: strokes at ${Math.round(p.f * 100)}% speed: only ${n.flow.toFixed(1)} of ${n.want} L/min`, 'More power on the pump, a power pack, or an accumulator'); });
    });
    this.parts.forEach((p) => {
      const P = PARTS[p.type];
      if (P.use && P.use.shaft && p.why) add('warn', `${at(p)}: ${p.why}`, p.rpm > P.use.rpm[1] ? 'Put a reduction gearbox before it' : 'Speed it up with a step-up gearbox, or use a faster drive');
      if (p.type === 'bin' && p.supply < 1) add('info', `${at(p)}: empty`, 'Buy a load of ' + MATS[p.mat].name.toLowerCase());
      if (P.src && P.src.fuel && p.fuel < 4) add('warn', `${at(p)}: out of diesel`, 'Refuel it');
      if (P.use) { const o = this.ports(p).find((x) => x.type === 'item' && x.io === 'out'); const [di, dj] = DIR[o.side]; if (!this.at(o.ci + di, o.cj + dj)) add('warn', `${at(p)}: nothing takes its output`, 'Run a belt to a sales pallet'); }
      if (P.use && P.use.electric && p.why) add('warn', `${at(p)}: ${p.why}`, 'Check the yard power network');
      if (CONV.has(p.type) && p.belt.length && p.belt[0].p >= 1 && !this.nextTakes(p, p.belt[0])) add('warn', `${at(p)}: units are waiting at the end of the belt`, 'Continue the belt to a machine or a pallet, or check that the next part takes this material');
    });
    return out;
  }
}
