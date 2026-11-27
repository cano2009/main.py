// Fieldworks machine designer: build a machine from parts on a frame, and it works only as well as its parts allow.
// A design picks one part for each mount: frame, drive, transmission, process module, input, output, control and
// cooling. evaluate() checks it like an engineer would (no drive, a shaft too weak for the load, a diesel with no
// radiator, a light frame under a heavy press...) and works out its real speed, power, heat and cost. build3D() makes
// the low-poly machine from the same parts, with moving shafts, belts and modules. CustomMachine runs it: it draws
// supply from a pallet, processes it at the speed the drive train can deliver, heats up, jams or trips, and fills an
// output pallet that is sold. The workshop bay is where it stands. Units are metres. three.js r147.

import * as THREE from 'three';
import { Unit } from './sims.js';
import { bake } from './lowpoly.js';
import { screen } from './yard.js';

const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
function mat(hex, o) { const k = hex + JSON.stringify(o || {}); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.05, flatShading: true }, o || {})); m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m); } return mats.get(k); }
const M = {
  green: mat('#3f7d4c'), greenD: mat('#2f5a3b'), yellow: mat('#e9b830'), yellowD: mat('#c99a22'), cream: mat('#e6e0cf'), steel: mat('#a3a9ad', { metalness: 0.3, roughness: 0.5 }),
  steelD: mat('#6f767b', { metalness: 0.3, roughness: 0.55 }), dark: mat('#33363a'), black: mat('#1b1c1e'), red: mat('#c94232'), blue: mat('#2c4f7c', { roughness: 0.4, metalness: 0.3 }),
  orange: mat('#e0702a'), concrete: mat('#c4beb2', { roughness: 0.95 }), wood: mat('#9a7a52'), woodD: mat('#755c3c'), rubber: mat('#2a2c2e', { roughness: 0.9 }), sack: mat('#d8c9a0', { roughness: 0.95 }),
  copper: mat('#b8733a', { metalness: 0.4, roughness: 0.45 }), roof: mat('#4f8a5c', { roughness: 0.6 })
};
const glowMat = (hex, i) => { const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: lin(hex), emissiveIntensity: i === undefined ? 2 : i }); m.userData.lowpoly = true; return m; };
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
// Parts. kw: power delivered (drives) or needed (modules). torque: 1 light, 2 medium, 3 heavy. heat: heat added
// (or removed, cooling). price in dollars.
export const MOUNTS = ['frame', 'drive', 'transmission', 'process', 'input', 'output', 'control', 'cooling'];
export const MOUNT_NAMES = { frame: 'Frame', drive: 'Drive', transmission: 'Transmission', process: 'Process module', input: 'Input', output: 'Output', control: 'Control', cooling: 'Cooling' };
export const PARTS = {
  frame: {
    light: { name: 'Light frame', price: 600, maxTorque: 2, note: 'For light and medium loads' },
    heavy: { name: 'Heavy frame', price: 1400, maxTorque: 3, note: 'Braced for presses and engines' }
  },
  drive: {
    none: { name: 'None', price: 0, kw: 0 },
    motor3: { name: 'Electric motor 3 kW', price: 900, kw: 3, heat: 0.4, electric: true, note: 'Needs the workshop power supply' },
    motor7: { name: 'Electric motor 7.5 kW', price: 1900, kw: 7.5, heat: 0.8, electric: true, note: 'Needs the workshop power supply' },
    diesel: { name: 'Diesel engine 12 kW', price: 2600, kw: 12, heat: 2.2, fuelLph: 3.2, heavy: true, note: 'Runs off the grid; burns fuel, needs a radiator' }
  },
  transmission: {
    none: { name: 'None', price: 0 },
    shaft: { name: 'Direct shaft', price: 150, eff: 0.98, torque: 1, note: 'Cheap and efficient, light loads only' },
    belt: { name: 'Belt drive', price: 420, eff: 0.94, torque: 2, note: 'Slips under heavy loads' },
    gearbox: { name: 'Gearbox', price: 1100, eff: 0.9, torque: 3, note: 'Takes any load, loses 10%' }
  },
  process: {
    none: { name: 'None', price: 0 },
    cleaner: { name: 'Seed cleaner drum', price: 1600, kw: 1.5, torque: 1, heat: 0.4, rate: 14, input: 'raw grain', output: 'clean seed', buy: 0.5, sell: 1.3, note: 'Sieves raw grain into seed' },
    mixer: { name: 'Feed mixer', price: 2200, kw: 2.5, torque: 2, heat: 0.5, rate: 9, input: 'grain mix', output: 'animal feed', buy: 0.7, sell: 1.75, note: 'Blends grain into feed' },
    oil: { name: 'Screw oil press', price: 3400, kw: 5, torque: 3, heat: 2, rate: 5, input: 'sunflower seed', output: 'oil bottle', buy: 0.9, sell: 3.1, note: 'Presses oil from sunflower seed' },
    pellet: { name: 'Ring-die pellet press', price: 3900, kw: 6, torque: 3, heat: 2.6, rate: 7, input: 'sawdust', output: 'wood pellets', buy: 0.3, sell: 1.55, note: 'Presses sawdust into pellets' }
  },
  input: {
    none: { name: 'None', price: 0 },
    hopper: { name: 'Gravity hopper', price: 250, feed: 6, note: 'Hand-tipped: up to 6 per minute' },
    screw: { name: 'Screw feeder', price: 950, feed: 22, kw: 0.4, note: 'Lifts from the supply pallet: up to 22 per minute' }
  },
  output: {
    none: { name: 'None', price: 0 },
    chute: { name: 'Gravity chute', price: 200, cap: 30, note: 'Drops product onto the pallet' },
    bagger: { name: 'Sack bagger', price: 1300, cap: 12, kw: 0.5, valueX: 1.15, note: '+15% value, up to 12 per minute' }
  },
  control: {
    manual: { name: 'Manual switch', price: 80, note: 'Overheating or a full pallet trips it' },
    smart: { name: 'Smart controller', price: 1200, smart: true, note: 'Slows down before it overheats, pauses when the pallet is full, live screen' }
  },
  cooling: {
    none: { name: 'None', price: 0, cool: 0 },
    fan: { name: 'Fan', price: 300, cool: 1.4, kw: 0.2, note: 'Removes some heat' },
    radiator: { name: 'Radiator and fan', price: 900, cool: 3.2, kw: 0.3, note: 'Needed by a diesel engine' }
  }
};
export const DEFAULT_DESIGN = { name: 'Seed cleaner Mk1', frame: 'light', drive: 'motor3', transmission: 'shaft', process: 'cleaner', input: 'hopper', output: 'chute', control: 'manual', cooling: 'none' };
export function cleanDesign(d) { const o = Object.assign({}, DEFAULT_DESIGN, d || {}); MOUNTS.forEach((k) => { if (!PARTS[k][o[k]]) o[k] = DEFAULT_DESIGN[k]; }); o.name = String(o.name || 'Untitled').slice(0, 40); return o; }

/** evaluate(design): { ok, issues: [{ lvl, text, fix }], stats } — the engineering check the Test button runs. */
export function evaluate(design) {
  const d = cleanDesign(design), P = (k) => PARTS[k][d[k]], F = P('frame'), Dr = P('drive'), T = P('transmission'), Pr = P('process'), I = P('input'), O = P('output'), C = P('control'), Co = P('cooling');
  const issues = [], add = (lvl, text, fix) => issues.push({ lvl, text, fix: fix || '' });
  const cost = MOUNTS.reduce((a, k) => a + P(k).price, 0);
  if (d.drive === 'none') add('error', 'No drive: nothing turns the machine', 'Fit an electric motor or a diesel engine');
  if (d.transmission === 'none' && d.drive !== 'none' && d.process !== 'none') add('error', 'The drive is not connected to the process module', 'Fit a shaft, belt drive or gearbox between them');
  if (d.process === 'none') add('error', 'No process module: the machine would do nothing', 'Fit a cleaner, mixer, oil press or pellet press');
  if (d.input === 'none') add('error', 'No input: nothing can get into the module', 'Fit a hopper or a screw feeder');
  if (d.output === 'none') add('error', 'No output: product has nowhere to go', 'Fit a chute or a bagger');
  // drive train
  const load = Pr.kw || 0, aux = (I.kw || 0) + (O.kw || 0) + (Co.kw || 0);
  let slip = 1;
  if (T.torque && Pr.torque > T.torque) {
    if (d.transmission === 'shaft') add('error', `A direct shaft would shear under the ${Pr.name.toLowerCase()}`, 'Use a belt drive or a gearbox');
    else { slip = 0.6; add('warn', 'The belt slips under this heavy module: 40% of the power is lost', 'A gearbox takes heavy loads'); }
  }
  const avail = (Dr.kw || 0) * (T.eff || 0) * slip, ratio = load ? avail / load : 0;
  if (Dr.kw && T.eff && load && ratio < 0.5 && !(d.transmission === 'shaft' && Pr.torque > 1)) add('error', `The drive delivers ${avail.toFixed(1)} kW but the module needs ${load} kW: it would stall`, 'Fit a bigger motor or the diesel');
  else if (Dr.kw && T.eff && load && ratio < 1) add('warn', `Underpowered: ${avail.toFixed(1)} of ${load} kW, so it runs at ${Math.round(ratio * 100)}% speed`, 'A bigger drive or a more efficient transmission');
  if (F.maxTorque < Math.max(Pr.torque || 0, Dr.heavy ? 3 : 0)) add('error', `The light frame would shake apart under ${Dr.heavy && !(Pr.torque > 2) ? 'the diesel engine' : 'this heavy module'}`, 'Use the heavy frame');
  // heat: what the drive and module make, less what the cooling takes away
  const heat = (Dr.heat || 0) + (Pr.heat || 0) * Math.min(1, ratio || 0) - (Co.cool || 0);
  // the same temperature model the running machine uses: about 38 °C plus 32 °C per unit of heat load
  const tempSS = 38 + Math.max(0, heat) * 32;
  if (Dr.heavy && d.cooling !== 'radiator') add('error', 'A diesel engine without a radiator overheats within minutes', 'Fit the radiator and fan');
  else if (!C.smart && tempSS > 95) add('error', `Settles at about ${Math.round(tempSS)} °C: it will overheat and trip at 95 °C`, 'Add a fan or a radiator');
  else if (tempSS > 80) add('warn', C.smart ? `Runs warm (about ${Math.round(tempSS)} °C): the controller slows it down to stay under 85 °C` : `Runs hot (about ${Math.round(tempSS)} °C), close to its 95 °C trip`, 'More cooling lets it run at full speed');
  if (Dr.electric === undefined && d.drive !== 'none' && !Dr.fuelLph) add('error', 'Unknown drive');
  // throughput: the slowest of the module at its delivered speed, the feeder and the output
  const speed = Math.max(0, Math.min(1, ratio)), rate = Pr.rate ? Math.min(Pr.rate * speed, I.feed || 0, O.cap || 0) : 0;
  if (Pr.rate && I.feed && I.feed < Pr.rate * speed) add('warn', `The ${I.name.toLowerCase()} limits it to ${I.feed} per minute`, 'A screw feeder keeps the module full');
  if (Pr.rate && O.cap && O.cap < Pr.rate * speed) add('warn', `The ${O.name.toLowerCase()} limits it to ${O.cap} per minute`, 'A gravity chute is faster');
  if (!C.smart) add('info', 'Manual switch: overheating or a full pallet trips the machine', 'A smart controller avoids both and shows live data');
  const kwDraw = (Dr.electric ? Math.min(Dr.kw, load / ((T.eff || 1) * slip)) + aux : aux);
  const value = (Pr.sell || 0) * (O.valueX || 1), margin = rate * (value - (Pr.buy || 0));
  const ok = !issues.some((i) => i.lvl === 'error');
  if (ok && !issues.some((i) => i.lvl === 'warn')) add('ok', 'Design checks out', `${rate.toFixed(1)} ${Pr.output} per minute`);
  return { ok, issues, design: d, stats: { cost, rate, speed, heat, tempSS, kwDraw, avail, load, value, margin, electric: !!Dr.electric, fuelLph: Dr.fuelLph || 0, smart: !!C.smart, input: Pr.input, output: Pr.output, buy: Pr.buy || 0 } };
}

// ---------------------------------------------------------------------------
// 3D: the machine from its parts. Origin at the frame centre on the ground; length along x (input end -x, output +x).
const Y0 = 0.75, HS = Y0 + 0.3;   // deck top, shaft height
export function build3D(design) {
  const d = cleanDesign(design), root = new THREE.Group(); root.name = d.name; root.userData.pick = 'workshop';
  const spin = [], anim = {}; let terminal = null, inlet = new V(0.45, Y0 + 0.75, 0), outlet = new V(0.95, Y0 + 0.2, 0);
  // frame: legs, side rails, cross members, deck plate
  const heavy = d.frame === 'heavy', t = heavy ? 0.12 : 0.08;
  [-1.25, 1.25, ...(heavy ? [0] : [])].forEach((x) => [-0.5, 0.5].forEach((z) => { box(t, Y0 - 0.04, t, M.steelD, x, (Y0 - 0.04) / 2, z, root); box(t + 0.1, 0.03, t + 0.1, M.steelD, x, 0.015, z, root); }));
  [-0.5, 0.5].forEach((z) => box(2.62, t, t, M.yellow, 0, Y0 - 0.04 - t / 2 + 0.04, z, root));
  [-1.25, -0.45, 0.45, 1.25].forEach((x) => box(t, t * 0.8, 1.0, M.yellowD, x, Y0 - 0.06, 0, root));
  box(2.6, 0.03, 1.04, M.steel, 0, Y0 - 0.015, 0, root);
  if (heavy) [-1, 1].forEach((s) => { strut(root, new V(-1.25, 0.1, s * 0.5), new V(0, Y0 - 0.1, s * 0.5), 0.06, M.steelD); strut(root, new V(1.25, 0.1, s * 0.5), new V(0, Y0 - 0.1, s * 0.5), 0.06, M.steelD); });
  // drive (shaft out at x -0.55)
  if (d.drive === 'motor3' || d.drive === 'motor7') {
    const big = d.drive === 'motor7', r = big ? 0.2 : 0.15, x0 = big ? -1.2 : -1.1, x1 = -0.62;
    box(x1 - x0, 0.06, r * 2, M.steelD, (x0 + x1) / 2, Y0 + 0.03, 0, root);
    box(0.08, HS - Y0 - r + 0.04, r * 1.6, M.steelD, x0 + 0.08, (Y0 + HS - r + 0.04) / 2, 0, root); box(0.08, HS - Y0 - r + 0.04, r * 1.6, M.steelD, x1 - 0.08, (Y0 + HS - r + 0.04) / 2, 0, root);
    cylX(r, x1 - x0, 14, M.blue, (x0 + x1) / 2, HS, 0, root);
    for (let k = 0; k < 6; k++) cylX(r + 0.02, 0.025, 14, M.blue, x0 + 0.06 + k * (x1 - x0 - 0.12) / 5, HS, 0, root);
    cylX(r * 0.6, 0.06, 10, M.steelD, x0 - 0.02, HS, 0, root);
    box(0.16, 0.12, 0.16, M.dark, (x0 + x1) / 2, HS + r + 0.05, 0, root);
    terminal = new V((x0 + x1) / 2, HS + r + 0.11, 0);
    cylX(0.03, 0.12, 8, M.steel, x1 + 0.04, HS, 0, root);
    anim.drive = 'motor';
  } else if (d.drive === 'diesel') {
    box(0.55, 0.06, 0.5, M.steelD, -0.85, Y0 + 0.03, 0, root);
    box(0.5, 0.36, 0.42, M.orange, -0.86, Y0 + 0.24, 0, root);
    box(0.44, 0.14, 0.36, M.dark, -0.86, Y0 + 0.49, 0, root);
    [-0.18, -0.06, 0.06].forEach((dx) => box(0.08, 0.05, 0.3, M.steelD, -0.86 + dx + 0.06, Y0 + 0.585, 0, root));
    cyl(0.04, 0.6, 8, M.steelD, -0.98, Y0 + 0.86, -0.12, root); cyl(0.055, 0.06, 8, M.black, -0.98, Y0 + 1.17, -0.12, root);
    box(0.2, 0.16, 0.12, M.red, -0.7, Y0 + 0.5, 0.26, root);   // fuel tank on the side
    cylX(0.05, 0.12, 8, M.steel, -0.56, HS, 0, root);
    anim.drive = 'diesel';
  }
  // cooling at the far end of the drive
  if (d.cooling !== 'none' && d.drive !== 'none') {
    const rad = d.cooling === 'radiator', fx = -1.32;
    box(0.2, 0.08, rad ? 0.5 : 0.34, M.steelD, -1.22, HS, 0, root);
    if (rad) { box(0.08, 0.5, 0.56, M.dark, fx, Y0 + 0.28, 0, root); for (let k = 0; k < 6; k++) box(0.09, 0.02, 0.5, M.steelD, fx, Y0 + 0.08 + k * 0.08, 0, root); box(0.12, 0.04, 0.5, M.steelD, fx, Y0 + 0.02, 0, root); }
    const fan = new THREE.Group(); fan.position.set(fx - (rad ? 0.07 : 0.02), HS, 0); root.add(fan);
    cylX(0.04, 0.06, 8, M.dark, 0, 0, 0, fan); for (let k = 0; k < 4; k++) { const b = box(0.02, 0.2, 0.06, M.yellow, 0, 0, 0, fan); b.geometry.translate(0, 0.1, 0); b.rotation.x = k * Math.PI / 2; }
    const ring = put(root, new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 16).rotateY(Math.PI / 2), M.steelD), fx - (rad ? 0.07 : 0.02), HS, 0);
    strut(root, new V(fx - (rad ? 0.07 : 0.02), HS - 0.22, 0), new V(fx - (rad ? 0.07 : 0.02), Y0, 0), 0.04, M.steelD);
    spin.push({ g: fan, axis: 'x', k: 10 }); ring.userData.noOutline = false;
  }
  // transmission between x -0.55 and -0.05
  if (d.transmission === 'shaft') {
    const s = new THREE.Group(); s.position.set(-0.3, HS, 0); root.add(s);
    cylX(0.035, 0.56, 8, M.steel, 0, 0, 0, s); [-0.2, 0.2].forEach((x) => cylX(0.07, 0.05, 10, M.yellowD, x, 0, 0, s));
    box(0.08, HS - Y0, 0.14, M.steelD, -0.3, (Y0 + HS) / 2 - 0.03, 0, root);   // pillow block
    spin.push({ g: s, axis: 'x', k: 1 });
  } else if (d.transmission === 'belt') {
    const z = 0.36;
    [-0.55, -0.05].forEach((x, i) => { cylZ(0.03, z + 0.05, 8, M.steel, x, HS, z / 2, root); const pg = new THREE.Group(); pg.position.set(x, HS, z); root.add(pg); cylZ(i ? 0.14 : 0.08, 0.06, 14, M.steelD, 0, 0, 0, pg); box(0.02, i ? 0.24 : 0.12, 0.065, M.yellowD, 0, 0, 0, pg); spin.push({ g: pg, axis: 'z', k: i ? 0.57 : 1 }); });
    strut(root, new V(-0.55, HS + 0.08, z), new V(-0.05, HS + 0.14, z), 0.03, M.rubber); strut(root, new V(-0.55, HS - 0.08, z), new V(-0.05, HS - 0.14, z), 0.03, M.rubber);
    box(0.72, 0.36, 0.03, M.yellow, -0.3, HS, z + 0.07, root); box(0.72, 0.03, 0.1, M.yellow, -0.3, HS + 0.18, z + 0.03, root);   // belt guard
    box(0.06, HS - Y0 + 0.15, 0.06, M.steelD, -0.3, (Y0 + HS + 0.15) / 2, z + 0.07, root);
  } else if (d.transmission === 'gearbox') {
    box(0.4, HS - Y0 + 0.2, 0.42, M.greenD, -0.3, (Y0 + HS + 0.2) / 2, 0, root);
    box(0.44, 0.04, 0.46, M.dark, -0.3, HS + 0.2, 0, root); cyl(0.04, 0.06, 6, M.yellow, -0.3, HS + 0.25, 0.1, root);
    [-0.53, -0.07].forEach((x) => { const s = new THREE.Group(); s.position.set(x, HS, 0); root.add(s); cylX(0.04, 0.08, 8, M.steel, 0, 0, 0, s); spin.push({ g: s, axis: 'x', k: 1 }); });
  }
  // bearing block at the module's input shaft
  if (d.process !== 'none') { box(0.12, HS - Y0 + 0.1, 0.2, M.steelD, 0.02, (Y0 + HS + 0.1) / 2, 0, root); cylX(0.035, 0.12, 8, M.steel, -0.06, HS, 0, root); }
  // process module (x 0.1 .. 1.0)
  if (d.process === 'cleaner') {
    [0.2, 0.85].forEach((x) => box(0.08, 0.35, 0.6, M.steelD, x, Y0 + 0.175, 0, root));
    const drum = new THREE.Group(); drum.position.set(0.52, Y0 + 0.4, 0); root.add(drum);
    cylX(0.27, 0.78, 14, M.steel, 0, 0, 0, drum); for (let k = 0; k < 5; k++) cylX(0.285, 0.03, 14, M.dark, -0.34 + k * 0.17, 0, 0, drum);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; box(0.7, 0.02, 0.02, M.yellowD, 0, Math.cos(a) * 0.28, Math.sin(a) * 0.28, drum); }
    cylX(0.03, 0.4, 8, M.steel, 0.02 + 0.2, Y0 + 0.4, 0, root);   // drum axle into the bearing block
    strut(root, new V(0.08, HS, 0), new V(0.14, Y0 + 0.4, 0), 0.05, M.steelD);
    box(0.7, 0.04, 0.5, M.steelD, 0.52, Y0 + 0.08, 0, root);   // fines tray
    spin.push({ g: drum, axis: 'x', k: 0.3 });
    inlet = new V(0.3, Y0 + 0.68, 0); outlet = new V(1.0, Y0 + 0.3, 0);
    box(0.16, 0.2, 0.3, M.steel, 0.95, Y0 + 0.3, 0, root);
  } else if (d.process === 'mixer') {
    [[0.25, -0.22], [0.25, 0.22], [0.75, 0]].forEach(([x, z]) => box(0.06, 0.36, 0.06, M.steelD, x, Y0 + 0.18, z, root));
    cyl(0.33, 0.5, 14, M.green, 0.45, Y0 + 0.66, 0, root); cyl(0.33, 0.22, 14, M.greenD, 0.45, Y0 + 0.3, 0, root, 0.08);
    cyl(0.35, 0.04, 14, M.yellow, 0.45, Y0 + 0.92, 0, root);
    box(0.3, 0.16, 0.2, M.dark, 0.16, HS, 0, root);   // bevel gear box
    strut(root, new V(0.16, HS + 0.08, 0), new V(0.45, Y0 + 0.28, 0), 0.04, M.steel, true);
    const paddle = new THREE.Group(); paddle.position.set(0.45, Y0 + 0.98, 0); root.add(paddle);
    cyl(0.03, 0.14, 8, M.steel, 0, 0, 0, paddle); box(0.5, 0.03, 0.05, M.yellowD, 0, 0.06, 0, paddle);
    spin.push({ g: paddle, axis: 'y', k: 0.5 });
    inlet = new V(0.6, Y0 + 0.94, 0.1); outlet = new V(0.98, Y0 + 0.22, 0);
    strut(root, new V(0.45, Y0 + 0.22, 0), new V(0.98, Y0 + 0.22, 0), 0.07, M.steelD, true);
  } else if (d.process === 'oil') {
    cylX(0.16, 0.84, 12, M.steel, 0.55, HS, 0, root);
    for (let k = 0; k < 6; k++) cylX(0.175, 0.025, 12, M.dark, 0.2 + k * 0.14, HS, 0, root);
    box(0.16, HS - Y0 + 0.2, 0.36, M.greenD, 0.12, (Y0 + HS + 0.2) / 2, 0, root);   // gear head
    box(0.7, 0.06, 0.4, M.yellowD, 0.55, Y0 + 0.08, 0, root); box(0.04, 0.12, 0.4, M.yellowD, 0.2, Y0 + 0.14, 0, root);   // oil tray
    [0.3, 0.8].forEach((x) => box(0.08, HS - Y0 - 0.12, 0.24, M.steelD, x, Y0 + (HS - Y0 - 0.12) / 2 + 0.06, 0, root));
    box(0.14, 0.24, 0.14, M.steelD, 0.3, HS + 0.24, 0, root);   // feed throat
    const screw = new THREE.Group(); screw.position.set(1.0, HS, 0); root.add(screw); cylX(0.05, 0.1, 6, M.dark, 0, 0, 0, screw); box(0.04, 0.12, 0.03, M.yellow, 0, 0, 0, screw);
    spin.push({ g: screw, axis: 'x', k: 0.4 });
    inlet = new V(0.3, HS + 0.36, 0); outlet = new V(1.05, HS - 0.05, 0);
  } else if (d.process === 'pellet') {
    box(0.66, 0.62, 0.56, M.green, 0.5, Y0 + 0.31, 0, root);
    box(0.7, 0.05, 0.6, M.greenD, 0.5, Y0 + 0.645, 0, root);
    box(0.2, 0.3, 0.3, M.dark, 0.12, HS, 0, root);
    const die = new THREE.Group(); die.position.set(0.5, Y0 + 0.32, 0.285); root.add(die);
    cylZ(0.22, 0.04, 16, M.steelD, 0, 0, 0, die); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; cylZ(0.025, 0.05, 6, M.black, Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0, die); } box(0.06, 0.3, 0.05, M.yellow, 0, 0, 0.02, die);
    spin.push({ g: die, axis: 'z', k: 0.35 });
    box(0.22, 0.22, 0.04, M.dark, 0.5, Y0 + 0.32, 0.27, root);
    cyl(0.12, 0.3, 4, M.steel, 0.4, Y0 + 0.8, 0, root, 0.08);
    inlet = new V(0.4, Y0 + 0.95, 0); outlet = new V(0.85, Y0 + 0.2, 0);
    box(0.14, 0.12, 0.2, M.steelD, 0.88, Y0 + 0.2, 0, root);
  }
  // input
  if (d.input !== 'none' && d.process !== 'none') {
    const big = d.input === 'hopper';
    const hop = put(root, new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.34 : 0.22, 0.1, big ? 0.36 : 0.26, 4, 1, true).rotateY(Math.PI / 4), mat('#e9b830', { side: THREE.DoubleSide })), inlet.x, inlet.y + (big ? 0.18 : 0.13), inlet.z);
    hop.userData.openOk = true;
    box(0.16, 0.06, 0.16, M.steelD, inlet.x, inlet.y, inlet.z, root);
    if (d.input === 'screw') {
      const foot = new V(inlet.x - 0.15, 0.45, -1.05), top = new V(inlet.x, inlet.y + 0.3, inlet.z - 0.1);
      strut(root, foot, top, 0.07, M.steelD, true); box(0.16, 0.18, 0.16, M.dark, top.x, top.y + 0.05, top.z, root);
      box(0.1, 0.45, 0.1, M.steelD, foot.x, 0.225, foot.z, root); box(0.3, 0.03, 0.3, M.steelD, foot.x, 0.015, foot.z, root);
      strut(root, new V(foot.x, 0.6, -0.95), new V(foot.x, Y0 - 0.06, -0.5), 0.04, M.steelD);
      anim.feeder = true;
    }
  }
  // output to the pallet at x +1.95
  if (d.output !== 'none' && d.process !== 'none') {
    if (d.output === 'bagger') {
      box(0.32, 0.46, 0.44, M.cream, 1.12, Y0 + 0.23, 0, root); box(0.36, 0.05, 0.48, M.dark, 1.12, Y0 + 0.48, 0, root);
      strut(root, outlet, new V(1.0, Y0 + 0.4, 0), 0.06, M.steelD, true);
      const clamp = new THREE.Group(); clamp.position.set(1.3, Y0 - 0.05, 0); root.add(clamp); box(0.06, 0.2, 0.3, M.red, 0, 0, 0, clamp); anim.clamp = clamp;
      box(0.06, 0.3, 0.06, M.steelD, 1.3, Y0 + 0.1, 0.18, root);
      outlet = new V(1.3, Y0 - 0.15, 0);
    }
    const a = new V(Math.max(outlet.x, 1.0), Math.min(outlet.y, Y0 + 0.2), 0), b = new V(1.75, 0.42, 0);
    { const dd = b.clone().sub(a), g = new THREE.BoxGeometry(0.34, 0.03, dd.length()), mm = new THREE.Matrix4().lookAt(new V(), dd, new V(0, 1, 0)); mm.setPosition(a.clone().add(b).multiplyScalar(0.5)); put(root, new THREE.Mesh(g.applyMatrix4(mm), M.steel)); }   // chute plate
    [-0.16, 0.16].forEach((z) => strut(root, new V(a.x, a.y + 0.05, z), new V(b.x, b.y + 0.05, z), 0.03, M.yellowD));
    if (outlet.x < 1.0) strut(root, outlet, a, 0.06, M.steelD, true);
    box(0.05, 0.4, 0.05, M.steelD, 1.7, 0.2, 0, root);
  }
  // control
  let scr = null; const lamp = box(0.05, 0.05, 0.05, glowMat('#3fd27a', 0.2), -0.25, 0, 0.75, null); lamp.userData.noOutline = true;
  if (d.control === 'smart') {
    box(0.06, 1.45, 0.06, M.steelD, -0.25, 0.725, 0.68, root); box(0.06, 0.06, 0.2, M.steelD, -0.25, Y0 - 0.1, 0.6, root);
    box(0.42, 0.34, 0.18, M.cream, -0.25, 1.32, 0.72, root);
    scr = screen(0.34, 0.22, 192, root, -0.25, 1.33, 0.812); box(0.38, 0.26, 0.01, M.dark, -0.25, 1.33, 0.807, root);
    cyl(0.03, 0.1, 8, M.dark, -0.1, 1.54, 0.72, root); lamp.position.set(-0.1, 1.62, 0.72); root.add(lamp);
  } else {
    box(0.18, 0.24, 0.1, M.yellow, -0.25, Y0 - 0.1, 0.58, root); cyl(0.04, 0.05, 8, M.red, -0.25, Y0 - 0.08, 0.64, root).rotation.x = Math.PI / 2;
    lamp.position.set(-0.25, Y0 + 0.05, 0.58); root.add(lamp);
  }
  bake(root, [...spin.map((s) => s.g), ...(scr ? [scr.mesh] : []), lamp, ...(anim.clamp ? [anim.clamp] : [])]);
  return { root, spin, anim, terminal, screen: scr, lamp, design: d };
}
/** Paint a built machine as a blueprint (unbuilt design) or restore its real materials. */
export function setBlueprint(model, on) {
  if (!model.bp) model.bp = Object.assign(new THREE.MeshStandardMaterial({ color: lin('#5ab8ff'), emissive: lin('#1b5c96'), emissiveIntensity: 0.6, transparent: true, opacity: 0.45, depthWrite: false }), { userData: { lowpoly: true } });
  model.root.traverse((o) => { if (!o.isMesh || o.userData.noOutline && o.material.emissiveMap) return; if (on) { if (!o.userData.realMat) o.userData.realMat = o.material; o.material = model.bp; } else if (o.userData.realMat) o.material = o.userData.realMat; });
}

// ---------------------------------------------------------------------------
/** Workshop bay: a concrete pad with a steel portal roof, a workbench, a parts rack, a power pedestal, a supply
 *  pallet (left of the machine) and an output pallet (right). Origin at the pad centre; the machine stands at 0,0. */
export function workshopBay() {
  const root = new THREE.Group(); root.name = 'Workshop bay'; root.userData.pick = 'workshop';
  box(6.4, 0.14, 4.2, M.concrete, 0, 0.07, 0, root);
  box(6.44, 0.02, 0.12, M.yellow, 0, 0.145, 2.0, root);
  // portal frame and roof
  const H = 3.3;
  [-2.9, 2.9].forEach((x) => [-1.8, 1.8].forEach((z) => { box(0.16, H, 0.16, M.steelD, x, 0.14 + H / 2, z, root); box(0.3, 0.04, 0.3, M.steelD, x, 0.16, z, root); }));
  [-1.8, 1.8].forEach((z) => box(6.0, 0.18, 0.14, M.steelD, 0, H + 0.14, z, root));
  [-2.9, 0, 2.9].forEach((x) => box(0.14, 0.18, 3.8, M.steelD, x, H + 0.14, 0, root));
  for (let k = 0; k < 6; k++) { const p = box(1.04, 0.05, 4.1, M.roof, -2.6 + k * 1.04, H + 0.25, 0, root); p.rotation.z = 0; }
  for (let k = 0; k < 6; k++) box(0.04, 0.07, 4.1, M.greenD, -3.1 + k * 1.04, H + 0.28, 0, root);
  [-1, 1].forEach((s) => strut(root, new V(s * 2.9, H - 0.6, -1.8), new V(s * 2.2, H + 0.06, -1.8), 0.08, M.steelD));
  // back wall: workbench, tool board, parts rack
  box(2.0, 0.08, 0.6, M.wood, -1.5, 0.95, -1.6, root); [-2.4, -0.6].forEach((x) => [-1.4, -1.8].forEach((z) => box(0.06, 0.8, 0.06, M.steelD, x, 0.54, z, root)));
  box(2.0, 0.9, 0.04, M.woodD, -1.5, 1.85, -1.88, root); box(0.06, 0.8, 0.06, M.steelD, -2.4, 1.4, -1.88, root); box(0.06, 0.8, 0.06, M.steelD, -0.6, 1.4, -1.88, root);
  [[-2.1, 0.1], [-1.8, 0], [-1.5, 0.15], [-1.1, 0.05]].forEach(([x, dy]) => box(0.05, 0.3, 0.02, M.steel, x, 1.9 + dy, -1.85, root));
  box(0.3, 0.12, 0.2, M.red, -2.0, 1.05, -1.55, root); box(0.2, 0.14, 0.14, M.blue, -1.2, 1.06, -1.6, root);
  [0.6, 1.2, 1.8].forEach((y) => box(1.3, 0.04, 0.5, M.yellowD, 1.9, y, -1.6, root)); [1.28, 2.52].forEach((x) => [-1.38, -1.82].forEach((z) => box(0.05, 1.8, 0.05, M.steelD, x, 1.04, z, root)));
  [[1.5, 0.6], [2.0, 0.6], [1.7, 1.2], [2.2, 1.8]].forEach(([x, y]) => box(0.32, 0.18, 0.3, M.cream, x, y + 0.1, -1.6, root));
  cylX(0.1, 0.3, 10, M.blue, 1.95, 1.31, -1.6, root);
  // sign on the front beam
  box(1.6, 0.36, 0.04, M.yellow, 0, H - 0.12, 1.88, root);
  // power pedestal at the front left
  box(0.24, 1.0, 0.2, M.green, -2.5, 0.64, 1.3, root); box(0.28, 0.05, 0.24, M.greenD, -2.5, 1.16, 1.3, root);
  // pallets: supply (behind the input end) and output (beside the output end)
  const supply = pallet(root, -0.3, -1.05), output = pallet(root, 1.95, 0);
  bake(root, [supply.g, output.g]);
  return { root, supply, output, pedestal: new V(-2.5, 0.9, 1.4), H };
}
function pallet(root, x, z) {
  box(1.0, 0.12, 0.8, M.wood, x, 0.2, z, root); [-0.4, 0, 0.4].forEach((dx) => box(0.1, 0.06, 0.8, M.woodD, x + dx, 0.11, z, root));
  const g = new THREE.Group(); g.position.set(x, 0.26, z); root.add(g);
  const items = [];
  for (let k = 0; k < 12; k++) { const m = box(0.28, 0.16, 0.22, M.sack, -0.32 + (k % 3) * 0.32, 0.08 + Math.floor(k / 6) * 0.17, -0.22 + Math.floor((k % 6) / 3) * 0.3, g); m.visible = false; items.push(m); }
  return { g, items, show(f) { const n = Math.round(Math.max(0, Math.min(1, f)) * items.length); items.forEach((m, i) => { m.visible = i < n; }); } };
}

// ---------------------------------------------------------------------------
export const CUSTOM_DEF = { id: 'workshop', name: 'Custom Machine', short: 'Custom machine', brand: 'Your workshop', model: '', category: 'Workshop', levels: [{ level: 1, cost: 0, parts: [] }], wearPerHour: 2, repairCostPerPct: 10, palletCap: 40, supplyCap: 60, fuelL: 40 };
export class CustomMachine extends Unit {
  constructor() {
    super(CUSTOM_DEF);
    this.built = null; this.draft = cleanDesign(DEFAULT_DESIGN); this.supply = 0; this.hopper = 0; this.progress = 0; this.out = 0; this.made = 0; this.earned = 0; this.spent = 0;
    this.tempC = 20; this.fuel = 0; this.saved = []; this.lastTest = null; this.run = 0;
  }
  ev() { return this.built ? evaluate(this.built) : null; }
  running() { return !!this.built && this.on && !this.fault && this.ev().ok && (this.ev().stats.electric ? this.powered : this.fuel > 0); }
  status() { if (!this.built) return 'off'; if (!this.on) return 'off'; if (this.fault || !this.ev().ok) return 'stopped'; if (this.ev().stats.electric && !this.powered) return 'stopped'; if (!this.ev().stats.electric && this.fuel <= 0) return 'stopped'; return this.supply + this.hopper > 0 && this.run > 0.05 ? 'running' : 'waiting'; }
  reason() {
    if (!this.built) return 'Nothing built yet: design a machine and build it';
    const E = this.ev(), S = E.stats;
    if (!this.on) return 'Switched off'; if (this.fault) return this.fault.text; if (!E.ok) return E.issues.find((i) => i.lvl === 'error').text;
    if (S.electric && !this.powered) return 'No power at the workshop'; if (!S.electric && this.fuel <= 0) return 'Out of diesel';
    if (this.out >= this.def.palletCap) return 'Output pallet full';
    if (!this.supply && !this.hopper) return `Waiting for ${S.input}: buy a supply pallet`;
    if (this.run < 0.99 && S.smart && this.tempC > 80) return `Slowed to ${Math.round(this.run * 100)}% to stay cool`;
    return `Making ${S.output} at ${(S.rate * this.run).toFixed(1)} per minute`;
  }
  powerKw() { if (!this.built || !this.ev().stats.electric) return 0; return this.running() && this.run > 0 ? this.ev().stats.kwDraw * Math.max(0.3, this.run) : 0.02; }
  build(wallet) {
    const E = evaluate(this.draft); if (!E.ok) return { msg: 'The design has errors: test it and fix them first' };
    if (E.stats.cost > wallet) return { msg: `Building it costs $${E.stats.cost}` };
    const old = this.built && this.ev().stats.input; this.built = cleanDesign(this.draft); this.fault = null; this.condition = 100; this.tempC = 20; this.progress = 0;
    if (old && old !== this.ev().stats.input) { this.supply = 0; this.hopper = 0; }
    this.note(`Built ${this.built.name} for $${E.stats.cost}`);
    return { cost: E.stats.cost, msg: `${this.built.name} built: ${E.stats.rate.toFixed(1)} ${E.stats.output} per minute` };
  }
  tick(dt) {
    this.time += dt; if (!this.built) return 0;
    const E = this.ev(), S = E.stats, D = this.def;
    let earned = 0;
    const can = this.running() && this.out < D.palletCap;
    // feeder: supply pallet -> hopper, up to the input's rate
    const feed = PARTS.input[this.built.input].feed || 0;
    if (can && this.hopper < 4 && this.supply > 0) { const q = Math.min(this.supply, feed * dt / 60, 4 - this.hopper); this.supply -= q; this.hopper += q; }
    // heat: rises with the heat load while it runs; a smart controller throttles before 85 °C, a manual switch trips at 95 °C
    const heatLoad = S.heat * (this.run || 0);
    const target = 20 + Math.max(0, heatLoad) * 32 + (this.run > 0 ? 18 : 0);
    this.tempC += (target - this.tempC) * Math.min(1, dt / 90);
    let want = can && this.hopper > 0.01 ? 1 : 0;
    if (S.smart && this.tempC > 80) want = Math.min(want, Math.max(0.25, 1 - (this.tempC - 80) / 12));
    this.run += (want - this.run) * Math.min(1, dt * 2);
    if (!S.smart && this.tempC > 95) this.trip('Overheated at ' + Math.round(this.tempC) + ' °C', true);
    if (!S.smart && this.out >= D.palletCap && !this.fault) this.trip('Output jammed: the pallet is full', false);
    // processing at the delivered rate
    if (this.run > 0.01 && this.hopper > 0) {
      const n = Math.min(this.hopper, S.rate * this.run * dt / 60); this.hopper -= n; this.progress += n;
      while (this.progress >= 1) { this.progress -= 1; this.out++; this.made++; }
      if (!S.electric) this.fuel = Math.max(0, this.fuel - S.fuelLph * this.run * dt / 3600);
      this.energyKwh += this.powerKw() * dt / 3600; this.wear(dt, true);
    }
    if (this.out >= D.palletCap && S.smart) earned += this.sell(true);
    return earned;
  }
  sell(auto) { if (!this.out || !this.built) return 0; const v = this.out * this.ev().stats.value; this.note(`${auto ? 'Pallet full, sold' : 'Sold'} ${this.out} ${this.ev().stats.output} for $${v.toFixed(0)}`); this.earned += v; this.out = 0; if (this.fault && /jammed/.test(this.fault.text)) this.fault = null; return v; }
  act(id, wallet) {
    if (id === 'ws-build') return this.build(wallet);
    if (id === 'ws-test') { this.lastTest = evaluate(this.draft); return { msg: this.lastTest.ok ? 'Test passed: ' + this.lastTest.stats.rate.toFixed(1) + ' per minute' : 'Test failed: see the problems in the Operation tab' }; }
    if (id === 'ws-buy') { if (!this.built) return { msg: 'Build a machine first' }; const S = this.ev().stats, n = Math.min(40, this.def.supplyCap - Math.floor(this.supply)), c = Math.ceil(n * S.buy); if (n <= 0) return { msg: 'The supply pallet is full' }; if (c > wallet) return { msg: `A pallet of ${S.input} costs $${c}` }; this.supply += n; this.spent += c; this.note(`Bought ${n} ${S.input} for $${c}`); return { cost: c, msg: `${n} ${S.input} delivered for $${c}` }; }
    if (id === 'ws-fuel') { const n = Math.ceil(this.def.fuelL - this.fuel), c = Math.ceil(n * 1.4); if (n <= 0) return { msg: 'The tank is full' }; if (c > wallet) return { msg: `Fuel costs $${c}` }; this.fuel = this.def.fuelL; return { cost: c, msg: `Refuelled ${n} L for $${c}` }; }
    if (id === 'ws-sell') { const v = this.sell(false); return v ? { cost: -v, msg: `Sold for $${v.toFixed(0)}` } : { msg: 'Nothing on the pallet yet' }; }
    if (id === 'ws-reset') { if (this.fault) { this.fault = null; this.tempC = Math.min(this.tempC, 60); this.note('Reset by operator'); return { msg: 'Machine reset' }; } return { msg: 'No fault to reset' }; }
    if (id === 'power') { this.setOn(!this.on); return { msg: this.on ? 'Machine started' : 'Machine stopped' }; }
    return super.act(id, wallet);
  }
  panel() {
    const E = this.ev(), S = E && E.stats, D = this.def, dE = evaluate(this.draft);
    const head = { key: 'workshop', title: this.built ? this.built.name : 'Workshop', sub: 'Your workshop · Workshop', status: this.status(), reason: this.reason() };
    const partRows = (d) => MOUNTS.map((k) => [MOUNT_NAMES[k], PARTS[k][d[k]].name]);
    return Object.assign(head, {
      tabs: {
        overview: this.built ? [['Status', this.reason()], ['Makes', `${S.output} from ${S.input}`], ['Speed', `${(S.rate * this.run).toFixed(1)} of ${S.rate.toFixed(1)} per minute`], ['Temperature', Math.round(this.tempC) + ' °C'], ['Supply pallet', Math.floor(this.supply) + ' ' + S.input], ['Output pallet', `${this.out} of ${D.palletCap}`], ...(S.electric ? [['Power', this.powerKw().toFixed(1) + ' kW']] : [['Diesel', this.fuel.toFixed(1) + ' L']]), ...partRows(this.built)] : [['Status', 'Nothing built yet'], ['Draft', dE.design.name], ['Draft cost', '$' + dE.stats.cost], ['Next', 'Open the Operation tab to design it, then Test and Build']],
        performance: this.built ? [['Made', this.made], ['Earned', '$' + this.earned.toFixed(0)], ['Spent on supply', '$' + this.spent.toFixed(0)], ['Margin at full speed', '$' + S.margin.toFixed(2) + ' per minute'], ['Drive delivers', S.avail.toFixed(1) + ' kW of ' + S.load + ' kW'], ['Heat load', S.heat.toFixed(1)], ['Energy used', this.energyKwh.toFixed(2) + ' kWh'], ['Condition', Math.round(this.condition) + '%']] : [['Built', 'Nothing yet']],
        resources: this.built ? [['Input', `${S.input} at $${S.buy.toFixed(2)} each`], ['Output', `${S.output} sold at $${S.value.toFixed(2)} each`], ['Supply', S.electric ? 'Workshop power from pole F' : 'Diesel, ' + S.fuelLph + ' L/h at full load']] : [['Input', 'Depends on the process module']],
        upgrades: { rows: [['Upgrades', 'Change parts in the designer and build again']], gains: [] },
        operation: { designer: true, rows: [], log: this.log.slice(0, 6) }
      },
      strip: this.built ? [{ k: 'Speed', v: (S.rate * this.run).toFixed(1) + '/min', f: this.run, c: 'var(--ok)' }, { k: 'Temp', v: Math.round(this.tempC) + ' °C', f: this.tempC / 100, c: this.tempC > 80 ? 'var(--bad)' : 'var(--warn)' }, { k: 'Supply', v: Math.floor(this.supply), f: this.supply / D.supplyCap }, { k: 'Pallet', v: `${this.out}/${D.palletCap}`, f: this.out / D.palletCap }, { k: 'Earned', v: '$' + this.earned.toFixed(0) }, this.condStat()] : [{ k: 'Draft cost', v: '$' + dE.stats.cost }, { k: 'Draft test', v: dE.ok ? 'passes' : 'has errors' }],
      actions: [{ id: 'ws-test', label: 'Test design' }, { id: 'ws-build', label: `Build ($${dE.stats.cost})`, primary: dE.ok, disabled: !dE.ok }, ...(this.built ? [{ id: 'ws-buy', label: `Buy ${S.input}`, primary: !this.supply }, ...(S.electric ? [] : [{ id: 'ws-fuel', label: 'Refuel' }]), { id: 'ws-sell', label: `Sell pallet (${this.out})`, disabled: !this.out }, { id: 'ws-reset', label: 'Reset fault', disabled: !this.fault }, { id: 'power', label: this.on ? 'Stop' : 'Start' }, { id: 'service', label: `Service $${this.repairCost()}` }] : [])]
    });
  }
}
