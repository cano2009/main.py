// Fieldworks FR-6 pick-and-place robot: 5-axis arm model, inverse kinematics, motion controller and simulation.
// Joints: base yaw, shoulder, elbow, wrist pitch, wrist roll. The gripper always points straight down and its jaws
// stay across the conveyor, so the arm can pick an item off the belt and set it down in the crate the same way up.
// The controller plans each pick (approach, lower, grip, lift, carry, lower, release, clear) and moves in joint space
// with eased motion at the joints' speed limits. The simulation counts real picks and tracks power, heat and wear.

import * as THREE from 'three';
import * as P from './parts.js';
import { standardAct, standardActions, condColor, money } from './machine.js';

const V = THREE.Vector3;
export const ARM = { shoulderY: 0.62, L1: 0.85, L2: 0.8, L3: 0.21 };

export const ROBOT_DEF = {
  id: 'fr6', name: 'Pick-and-place Robot', type: '5-axis robot arm', brand: 'Fieldworks Automation', model: 'FR-6', category: 'Automation',
  levels: [
    { level: 1, speed: 1.0, payloadKg: 15, ratedKw: 1.4, cost: 0, parts: [] },
    { level: 2, speed: 1.45, payloadKg: 25, ratedKw: 1.9, cost: 2200, parts: ['Servo drives x5', 'Harmonic gearbox (J2)'] },
    { level: 3, speed: 2.0, payloadKg: 40, ratedKw: 2.6, cost: 4800, parts: ['High-torque servos x5', 'Gripper with force sensing'] }
  ],
  jointSpeed: [1.1, 0.9, 1.1, 1.8, 2.2],   // rad/s at level 1
  wearPerHour: 14, repairCostPerPct: 5, ambientC: 18
};
export const CROP_KG = { pumpkin: 5.5, watermelon: 7.5, cabbage: 1.4, potato: 0.2, carrot: 0.12 };

// ---------------------------------------------------------------------------
export class RobotSim {
  constructor(def) {
    this.def = def; this.levelIndex = 0; this.on = true; this.powered = true;
    this.condition = 100; this.hours = 0; this.energyKwh = 0; this.time = 0; this.fault = null;
    this.jointC = def.ambientC; this.duty = 0; this.moving = false; this.carry = null; this.carryKg = 0;
    this.placedTimes = []; this.cycleTimes = []; this.lastPlace = null; this.totalPlaced = 0;
    this.task = 'Starting'; this.waitReason = 'Waiting for washed produce'; this.stepProgress = 0;
    this.crate = { count: 0, cap: 0 }; this.log = [];
  }
  get level() { return this.def.levels[this.levelIndex]; }
  note(t) { this.log.unshift({ t: this.time, text: t }); this.log.length = Math.min(this.log.length, 12); }
  setOn(v) { this.on = !!v; this.note(v ? 'Started by operator' : 'Stopped by operator'); }
  efficiency() { return Math.max(0.55, Math.min(1, 0.55 + this.condition * 0.0045)); }
  canMove() { return this.on && this.powered && !this.fault; }
  speeds() { return this.def.jointSpeed.map((s) => s * this.level.speed * this.efficiency()); }
  status() { if (!this.on) return 'off'; if (!this.powered || this.fault) return 'stopped'; return this.moving || this.carry ? 'running' : 'waiting'; }
  reason() {
    if (!this.on) return 'Switched off';
    if (!this.powered) return 'No power - check the generator';
    if (this.fault) return this.fault.text;
    return this.moving || this.carry ? this.task : this.waitReason;
  }
  powerKw() {
    const st = this.status();
    if (st === 'off') return 0.02;
    if (!this.powered) return 0;
    if (this.fault) return 0.15;
    if (!this.moving) return 0.3;
    return this.level.ratedKw * (0.55 + 0.45 * Math.min(1, this.carryKg / this.level.payloadKg)) / this.efficiency();
  }
  onPick(item, kg) { this.carry = item; this.carryKg = kg; }
  onPlace() {
    this.carry = null; this.carryKg = 0; this.totalPlaced++;
    if (this.lastPlace !== null) { this.cycleTimes.push(this.time - this.lastPlace); if (this.cycleTimes.length > 10) this.cycleTimes.shift(); }
    this.lastPlace = this.time; this.placedTimes.push(this.time);
  }
  tick(dt) {
    this.time += dt;
    this.duty += ((this.moving ? 1 : 0) - this.duty) * Math.min(1, dt / 8);
    const target = this.def.ambientC + this.duty * (30 + (100 - this.condition) * 0.45) + (this.carryKg / this.level.payloadKg) * 8;
    this.jointC += (target - this.jointC) * Math.min(1, dt / 20);
    this.energyKwh += this.powerKw() * dt / 3600;
    if (this.moving) { this.hours += dt / 3600; this.condition = Math.max(0, this.condition - this.def.wearPerHour * dt / 3600); }
    if (!this.fault && this.canMove()) {
      if (this.jointC > 80) { this.fault = { code: 'heat', text: 'Joint J2 over temperature' }; this.note('Fault: ' + this.fault.text); }
      else if (this.moving && this.condition < 20 && Math.random() < dt * 0.03) { this.fault = { code: 'grip', text: 'Gripper pressure low - service needed' }; this.note('Fault: ' + this.fault.text); }
    }
    if (this.fault && this.fault.code === 'heat' && this.jointC < 60) { this.note('Joint cooled, fault cleared'); this.fault = null; }
    while (this.placedTimes.length && this.time - this.placedTimes[0] > 60) this.placedTimes.shift();
  }
  repairCost() { return Math.ceil((100 - this.condition) * this.def.repairCostPerPct); }
  repair() { this.condition = 100; if (this.fault && this.fault.code === 'grip') this.fault = null; this.note('Serviced: gripper seals, joint grease'); }
  nextLevel() { return this.def.levels[this.levelIndex + 1] || null; }
  upgrade() { const n = this.nextLevel(); if (!n) return 0; this.levelIndex++; this.note('Upgraded to level ' + n.level); return n.cost; }
  act(id, wallet) { return standardAct(this, id, wallet, 'Robot'); }
  panel() {
    const L = this.level, f1 = (n) => n.toFixed(1), el = Math.min(60, Math.max(1, this.time));
    const perMin = this.placedTimes.length * (60 / el);
    const cyc = this.cycleTimes.length ? this.cycleTimes.reduce((a, b) => a + b, 0) / this.cycleTimes.length : 0;
    const next = this.nextLevel(), sp = this.speeds();
    return {
      key: 'robot', title: `${this.def.model} ${this.def.name}`, sub: `${this.def.brand} · ${this.def.category}`, status: this.status(), reason: this.reason(),
      tabs: {
        overview: [['Type', this.def.type], ['Model', this.def.model], ['Status', this.reason()], ['Picks', f1(perMin) + ' /min'], ['Crate', `${this.crate.count} / ${this.crate.cap}`], ['Power', this.powerKw().toFixed(2) + ' kW'], ['Condition', Math.round(this.condition) + '%'], ['Level', `${L.level} of ${this.def.levels.length}`]],
        performance: [['Picks', f1(perMin) + ' /min'], ['Cycle time', cyc ? f1(cyc) + ' s' : '–'], ['Placed in total', this.totalPlaced], ['Base speed', f1(sp[0] * 57.3) + ' °/s'], ['Shoulder speed', f1(sp[1] * 57.3) + ' °/s'], ['Payload rating', L.payloadKg + ' kg'], ['Current load', this.carryKg ? f1(this.carryKg) + ' kg' : 'Empty'], ['Power draw', this.powerKw().toFixed(2) + ' kW'], ['Rated power', f1(L.ratedKw) + ' kW'], ['Joint temperature', f1(this.jointC) + ' °C'], ['Efficiency', Math.round(this.efficiency() * 100) + '%'], ['Running hours', this.hours.toFixed(3) + ' h'], ['Energy used', this.energyKwh.toFixed(3) + ' kWh']],
        resources: [['Input', 'Washed produce from the outfeed belt'], ['Output', 'Crate on pallet'], ['Holding', this.carry ? `${this.carry.label} (${f1(this.carryKg)} kg)` : 'Nothing'], ['Crate', `${this.crate.count} / ${this.crate.cap}`], ['Limits', this.crate.count >= this.crate.cap ? 'Crate full' : 'None']],
        upgrades: { rows: next ? [['Current level', `${L.level} of ${this.def.levels.length}`], ['Next level', next.level], ['Cost', money(next.cost)], ['Parts', next.parts.join(', ')]] : [['Current level', `${L.level} of ${this.def.levels.length}`], ['Next level', 'Fully upgraded']], gains: next ? [`Joint speed x${L.speed} -> x${next.speed}`, `Payload ${L.payloadKg} -> ${next.payloadKg} kg`, `Rated power ${L.ratedKw} -> ${next.ratedKw} kW`] : [] },
        operation: { rows: [['Current task', this.reason()], ['Step progress', Math.round(this.stepProgress * 100) + '%'], ['Fault', this.fault ? this.fault.text : 'None'], ['Maintenance', this.condition < 40 ? 'Service now' : this.condition < 70 ? 'Service soon' : 'OK'], ['Service cost', money(this.repairCost())], ['Pick-up', 'Outfeed belt end'], ['Drop-off', 'Crate'], ['Power', this.powered ? 'GX-12 generator' : 'No supply']], log: this.log.slice(0, 6) }
      },
      strip: [
        { k: 'Picks', v: f1(perMin) + ' /min' }, { k: 'Cycle', v: cyc ? f1(cyc) + ' s' : '–' }, { k: 'Power', v: f1(this.powerKw()) + ' kW' },
        { k: 'Joints', v: Math.round(this.jointC) + ' °C' }, { k: 'Load', v: this.carryKg ? f1(this.carryKg) + ' kg' : 'Empty', f: this.carryKg / L.payloadKg },
        { k: 'Condition', v: Math.round(this.condition) + '%', f: this.condition / 100, c: condColor(this.condition) },
        { k: 'Crate', v: `${this.crate.count} / ${this.crate.cap}`, f: this.crate.count / Math.max(1, this.crate.cap) }
      ],
      actions: [...standardActions(this), { id: 'sell', label: this.crate.count ? `Sell crate (${this.crate.count})` : 'Sell crate', primary: true }]
    };
  }
}

// ---------------------------------------------------------------------------
// Inverse kinematics. tip: where the gripper's grip point must be (world). base: robot base on the floor (world).
// Returns [yaw, shoulder, elbow, wristPitch, wristRoll].
export function solveIK(tip, base) {
  const w = tip.clone(); w.y += ARM.L3;
  const dx = w.x - base.x, dz = w.z - base.z;
  const yaw = Math.atan2(-dz, dx);
  let r = Math.hypot(dx, dz), z = w.y - (base.y + ARM.shoulderY);
  const L1 = ARM.L1, L2 = ARM.L2;
  let d = Math.hypot(r, z);
  const dmax = (L1 + L2) * 0.985, dmin = Math.abs(L1 - L2) + 0.08;
  if (d > dmax) { r *= dmax / d; z *= dmax / d; d = dmax; }
  if (d < dmin) { const k = dmin / Math.max(1e-6, d); r *= k; z *= k; d = dmin; }
  const e = Math.acos(Math.max(-1, Math.min(1, (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2))));
  const a1 = Math.atan2(z, r) + Math.atan2(L2 * Math.sin(e), L1 + L2 * Math.cos(e));
  const a2 = -e;
  return [yaw, a1, a2, -Math.PI / 2 - (a1 + a2), yaw];
}
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ---------------------------------------------------------------------------
export function buildRobot(M) {
  const paint = new THREE.MeshStandardMaterial({ name: 'robot_paint', color: new THREE.Color('#e9a21c').convertSRGBToLinear(), metalness: 0.3, roughness: 0.36 });
  const joint = new THREE.MeshStandardMaterial({ name: 'robot_joint', color: new THREE.Color('#2a2d31').convertSRGBToLinear(), metalness: 0.55, roughness: 0.4 });
  const root = new THREE.Group(); root.name = 'FR-6 robot cell';
  const arm = new THREE.Group(); root.add(arm);
  const bolts = P.boltSet(M.steel);

  function housing(parent, x, y, z, r, len, axis) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const geo = (rr, l) => { const c = new THREE.CylinderGeometry(rr, rr, l, 32); if (axis === 'z') c.rotateX(Math.PI / 2); return c; };
    P.mesh(geo(r, len), joint, 0, 0, 0, g);
    [-1, 1].forEach((s) => {
      const cap = P.mesh(geo(r * 0.82, 0.02), paint, 0, 0, 0, g); if (axis === 'z') cap.position.z = s * (len / 2 + 0.01); else cap.position.y = s * (len / 2 + 0.01);
      const n = axis === 'z' ? new V(0, 0, s) : new V(0, s, 0);
      const b = P.boltSet(M.steel); b.circle(axis === 'z' ? new V(0, 0, s * (len / 2 + 0.02)) : new V(0, s * (len / 2 + 0.02), 0), n, r * 0.6, 8, r * 0.07); b.build(g);
    });
    return g;
  }
  function servo(parent, x, y, z, axis, r, len) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const c = new THREE.CylinderGeometry(r, r, len, 24); if (axis === 'z') c.rotateX(Math.PI / 2); else if (axis === 'x') c.rotateZ(Math.PI / 2);
    P.mesh(c, joint, 0, 0, 0, g);
    const capG = new THREE.CylinderGeometry(r * 1.05, r * 1.05, len * 0.18, 24); if (axis === 'z') capG.rotateX(Math.PI / 2); else if (axis === 'x') capG.rotateZ(Math.PI / 2);
    const cap = P.mesh(capG, M.darkSteel, 0, 0, 0, g); if (axis === 'z') cap.position.z = len * 0.45; else if (axis === 'x') cap.position.x = len * 0.45; else cap.position.y = len * 0.45;
    const gland = P.mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, r * 0.5, 10), M.plastic, 0, r, 0, g); void gland;
    return g;
  }

  // base and pedestal
  P.mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.03, 40), M.darkSteel, 0, 0.015, 0, arm);
  bolts.circle(new V(0, 0.03, 0), new V(0, 1, 0), 0.3, 8, 0.012);
  P.mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 32), paint, 0, 0.17, 0, arm);
  for (let i = 0; i < 4; i++) { const r = P.panel(0.025, 0.2, 0.07, paint, 0.006); const a = i * Math.PI / 2 + Math.PI / 4; r.position.set(Math.cos(a) * 0.19, 0.13, Math.sin(a) * 0.19); r.rotation.y = -a; arm.add(r); }
  P.mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.04, 40), paint, 0, 0.33, 0, arm);
  bolts.circle(new V(0, 0.352, 0), new V(0, 1, 0), 0.205, 12, 0.008);
  const baseLbl = P.label(0.12, 0.04, ['FR-6'], { bg: '#1d1f22', fg: '#e9a21c' }); baseLbl.position.set(0, 0.17, 0.181); arm.add(baseLbl);
  // J1 turntable
  const yaw = new THREE.Group(); yaw.position.y = 0.35; arm.add(yaw);
  P.mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.12, 40), paint, 0, 0.06, 0, yaw);
  P.mesh(new THREE.TorusGeometry(0.218, 0.006, 6, 40).rotateX(Math.PI / 2), joint, 0, 0.004, 0, yaw);
  servo(yaw, -0.17, 0.12, 0.08, 'y', 0.05, 0.15);
  [-1, 1].forEach((s) => { const c = P.panel(0.28, 0.3, 0.045, paint, 0.02); c.position.set(0, 0.24, s * 0.135); yaw.add(c); });
  housing(yaw, 0, ARM.shoulderY - 0.35, 0, 0.095, 0.32, 'z');
  servo(yaw, 0, ARM.shoulderY - 0.35, 0.24, 'z', 0.065, 0.14);
  // J2 shoulder and upper arm
  const shoulder = new THREE.Group(); shoulder.position.y = ARM.shoulderY - 0.35; yaw.add(shoulder);
  const ua = P.panel(ARM.L1 + 0.1, 0.17, 0.15, paint, 0.045); ua.position.x = ARM.L1 / 2; shoulder.add(ua);
  const uaCover = P.panel(ARM.L1 * 0.6, 0.11, 0.008, joint, 0.02); uaCover.position.set(ARM.L1 * 0.5, 0, 0.077); shoulder.add(uaCover);
  const uaLbl = P.label(0.16, 0.05, ['FIELDWORKS', 'FR-6'], { bg: '#1d1f22', fg: '#e9a21c' }); uaLbl.position.set(ARM.L1 * 0.5, 0, 0.082); shoulder.add(uaLbl);
  shoulder.add(P.cable(new V(0.06, 0.09, -0.05), new V(ARM.L1 - 0.06, 0.09, -0.05), 0.011, M.cable, -0.015));
  for (let i = 1; i < 4; i++) { const clip = P.panel(0.025, 0.02, 0.03, joint, 0.004); clip.position.set(i * ARM.L1 / 4, 0.09, -0.05); shoulder.add(clip); }
  // J3 elbow and forearm
  const elbow = new THREE.Group(); elbow.position.x = ARM.L1; shoulder.add(elbow);
  housing(elbow, 0, 0, 0, 0.08, 0.24, 'z');
  servo(elbow, 0, 0, -0.17, 'z', 0.055, 0.12);
  const fa = P.panel(ARM.L2 + 0.04, 0.12, 0.11, paint, 0.035); fa.position.x = ARM.L2 / 2; elbow.add(fa);
  servo(elbow, -0.14, 0, 0, 'x', 0.06, 0.2);
  elbow.add(P.cable(new V(-0.04, 0.07, 0.04), new V(ARM.L2 - 0.06, 0.065, 0.04), 0.009, M.cable, -0.012));
  // J4 wrist pitch
  const wrist = new THREE.Group(); wrist.position.x = ARM.L2; elbow.add(wrist);
  housing(wrist, 0, 0, 0, 0.055, 0.17, 'z');
  // J5 wrist roll and gripper (gripper axis along +x, pointing down in use)
  const roll = new THREE.Group(); wrist.add(roll);
  P.mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 28).rotateZ(Math.PI / 2), joint, 0.045, 0, 0, roll);
  P.mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.014, 28).rotateZ(Math.PI / 2), M.steel, 0.075, 0, 0, roll);
  const rb = P.boltSet(M.steel); rb.circle(new V(0.083, 0, 0), new V(1, 0, 0), 0.045, 6, 0.004); rb.build(roll);
  const palm = P.panel(0.05, 0.08, 0.48, joint, 0.01); palm.position.x = 0.105; roll.add(palm);
  const railG = P.panel(0.014, 0.03, 0.47, M.chrome, 0.004); railG.position.set(0.135, 0, 0); roll.add(railG);
  const cam = P.panel(0.04, 0.035, 0.05, M.plastic, 0.006); cam.position.set(0.1, 0.06, 0.12); roll.add(cam);
  P.mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.015, 14), M.glass, 0.1, 0.08, 0.12, roll);
  const fingers = [-1, 1].map((s) => {
    const f = new THREE.Group(); roll.add(f);
    const block = P.panel(0.04, 0.05, 0.04, joint, 0.006); block.position.x = 0.14; f.add(block);
    const blade = P.panel(0.16, 0.045, 0.022, M.steel, 0.006); blade.position.set(0.22, 0, 0); f.add(blade);
    const pad = P.panel(0.11, 0.04, 0.008, M.rubber, 0.003); pad.position.set(0.24, 0, -s * 0.014); f.add(pad);
    f.userData.side = s;
    return f;
  });
  const gripPoint = new THREE.Object3D(); gripPoint.position.x = ARM.L3; roll.add(gripPoint);
  bolts.build(arm);

  // controller cabinet, teach pendant and cable to the base
  const cab = P.cabinet({ w: 0.5, h: 0.9, d: 0.34 }, M); cab.position.set(-0.15, 0.47, -0.88); root.add(cab);
  const plinth = P.panel(0.52, 0.04, 0.36, M.darkSteel, 0.006); plinth.position.set(-0.15, 0.02, -0.88); root.add(plinth);
  const pendant = new THREE.Group(); pendant.position.set(0.12, 0.62, -0.7); pendant.rotation.set(-0.15, 0.25, 0); root.add(pendant);
  const pb = P.panel(0.2, 0.28, 0.045, M.plastic, 0.02); pendant.add(pb);
  const ps = P.screen(0.15, 0.11, M, { px: 360 }); ps.position.set(0, 0.04, 0.024); pendant.add(ps);
  const pe = P.emergencyStop(0.012, M); pe.position.set(0.06, -0.1, 0.022); pendant.add(pe);
  const pk = P.keypad(3, 2, 0.016, M); pk.position.set(-0.03, -0.09, 0.022); pendant.add(pk);
  const hook = P.panel(0.05, 0.04, 0.03, M.darkSteel, 0.005); hook.position.set(0.12, 0.76, -0.72); root.add(hook);
  root.add(P.cable(new V(0.12, 0.48, -0.7), new V(0.02, 0.6, -0.71), 0.006, M.cable, 0.2));
  root.add(P.pipe([[-0.15, 0.05, -0.7], [-0.15, 0.03, -0.3], [-0.12, 0.03, -0.2]], 0.022, M.cable, M, { flanges: false, bend: 0.1 }));
  const cabLbl = P.label(0.22, 0.06, ['FR-6 CONTROLLER', '400 V 3~  2.6 kW'], { bg: '#d9dcde', metal: true }); cabLbl.position.set(-0.15, 0.76, -0.705); root.add(cabLbl);

  function setPose(q) { yaw.rotation.y = q[0]; shoulder.rotation.z = q[1]; elbow.rotation.z = q[2]; wrist.rotation.z = q[3]; roll.rotation.x = q[4]; }
  function setOpen(w) { fingers.forEach((f) => { f.position.z = f.userData.side * (w / 2 + 0.011); }); }
  return { root, roll, gripPoint, setPose, setOpen, pendant: ps.userData, cabinet: cab, cabinetTop: new V(-0.15, 0.94, -0.88) };
}

// ---------------------------------------------------------------------------
// Motion controller. env provides the cell: pickReady(), take(item), crateFull(), nextSlot(), slotPos(i, item),
// release(item, pos), kg(item), scene attach handled by release().
export class RobotController {
  constructor(model, sim, base) {
    this.m = model; this.sim = sim; this.base = base.clone();
    this.home = this.base.clone().add(new V(0.15, 1.02, 0.3));
    this.q = solveIK(this.home, this.base); this.open = 0.3;
    this.queue = []; this.seg = null; this.atHome = true; this.screenT = 0;
    this.apply();
  }
  apply() { this.m.setPose(this.q); this.m.setOpen(this.open); }
  start(step) {
    const s = this.sim;
    if (step.task) s.task = step.task;
    if (step.onStart) step.onStart();
    let q1 = this.q.slice(), o1 = step.open !== undefined ? step.open : this.open, dur = 0.3;
    if (step.type === 'move') {
      q1 = solveIK(step.tip, this.base);
      q1[0] = this.q[0] + wrap(q1[0] - this.q[0]); q1[4] = this.q[4] + wrap(q1[4] - this.q[4]);
      const sp = s.speeds();
      dur = Math.max(0.25, ...q1.map((a, i) => Math.abs(a - this.q[i]) / sp[i]));
      this.atHome = !!step.home;
    } else dur = (step.type === 'grip' ? 0.4 : 0.3) / Math.max(0.6, s.level.speed * 0.8);
    if (step.width !== undefined) o1 = step.width;
    this.seg = { q0: this.q.slice(), dq: q1.map((a, i) => a - this.q[i]), o0: this.open, o1, dur, t: 0, step };
  }
  plan(env) {
    const s = this.sim, it = env.pickReady();
    const goHome = (why) => { s.waitReason = why; if (!this.atHome) this.queue.push({ type: 'move', tip: this.home, open: 0.3, task: 'Returning home', home: true }); };
    if (!it) return goHome('Waiting for washed produce');
    if (env.crateFull()) return goHome('Crate full - sell it');
    if (env.kg(it) > s.level.payloadKg) return goHome(`Item too heavy for the gripper (${s.level.payloadKg} kg max)`);
    const pick = it.obj.position.clone().add(new V(0, it.h / 2, 0));
    const hi = Math.max(pick.y + 0.25, 0.95 + it.h / 2);
    const slot = env.slotPos(env.nextSlot(), it);
    const place = slot.clone().add(new V(0, it.h / 2 + 0.006, 0));
    const placeHi = Math.max(place.y + 0.22, 0.66 + it.h / 2);
    const openW = Math.min(0.42, it.wid + 0.09);
    const above = (p, y) => new V(p.x, y, p.z);
    this.queue.push(
      { type: 'move', tip: above(pick, hi), open: openW, task: 'Moving to pick-up' },
      { type: 'move', tip: pick, task: 'Lowering to produce' },
      { type: 'grip', width: Math.max(0.02, it.wid * 0.97), task: 'Gripping', onStart: () => env.take(it), onEnd: () => { this.m.root.updateMatrixWorld(true); this.m.roll.attach(it.obj); s.onPick(it, env.kg(it)); s.note(`Picked ${it.label}`); } },
      { type: 'move', tip: above(pick, hi), task: 'Lifting' },
      { type: 'move', tip: above(place, placeHi), task: 'Carrying to crate' },
      { type: 'move', tip: place, task: 'Lowering into crate' },
      { type: 'release', open: openW, task: 'Releasing', onStart: () => { env.release(it, slot); s.onPlace(); } },
      { type: 'move', tip: above(place, placeHi), task: 'Clearing the crate' }
    );
  }
  tick(dt, env) {
    const s = this.sim;
    s.moving = s.canMove() && !!this.seg && this.seg.step.type === 'move';
    s.tick(dt);
    if (s.canMove()) {
      if (!this.seg) { if (!this.queue.length) this.plan(env); if (this.queue.length) this.start(this.queue.shift()); }
      if (this.seg) {
        const g = this.seg; g.t += dt;
        const k = Math.min(1, g.t / g.dur), e = k * k * (3 - 2 * k);
        this.q = g.q0.map((a, i) => a + g.dq[i] * e); this.open = g.o0 + (g.o1 - g.o0) * e;
        s.stepProgress = k;
        if (k >= 1) { this.seg = null; if (g.step.onEnd) g.step.onEnd(); }
      }
    }
    this.apply();
    this.screenT -= dt;
    if (this.screenT <= 0) { this.screenT = 0.25; drawPendant(this.m.pendant, s); }
  }
}

const STATUS_COL = { running: '#2fe06a', waiting: '#ffae1a', stopped: '#ff4a3a', off: '#7c8590' };
function drawPendant(sd, s) {
  const x = sd.ctx, W = sd.canvas.width, H = sd.canvas.height, st = s.status(), p = s.panel();
  x.fillStyle = '#0b1419'; x.fillRect(0, 0, W, H);
  x.fillStyle = STATUS_COL[st]; x.fillRect(0, 0, W, 40);
  x.fillStyle = '#0b1419'; x.font = '700 20px Arial'; x.textBaseline = 'middle'; x.fillText('FR-6  ' + st.toUpperCase(), 12, 21);
  x.fillStyle = '#9fc1d2'; x.font = '500 15px Arial'; x.fillText(s.reason().slice(0, 34), 12, 60);
  const rows = p.strip.slice(0, 5);
  rows.forEach((r, i) => { x.fillStyle = '#7fa1b2'; x.font = '600 14px Arial'; x.fillText(r.k.toUpperCase(), 12, 92 + i * 34); x.fillStyle = '#e8f6ff'; x.font = '700 20px Arial'; x.fillText(r.v, 150, 92 + i * 34); });
  sd.texture.needsUpdate = true;
}
