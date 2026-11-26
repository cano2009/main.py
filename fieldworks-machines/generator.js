// Fieldworks GX-12 diesel generator: open-skid genset model and its simulation.
// The model follows the engine reference: block and head with a bolted valve cover, red injector leads, chrome
// pulleys and belts at the front, chrome exhaust headers into a collector and muffler, radiator and fan, flywheel
// housing and alternator, fuel tank base, battery, control panel with live screen and gauges, and an open canopy.
// The simulation runs the engine (cranking, rpm, fuel, coolant, oil), supplies the line's real power demand,
// and trips its breaker when overloaded.

import * as THREE from 'three';
import * as P from './parts.js';
import { standardAct, standardActions, condColor, money } from './machine.js';

const V = THREE.Vector3;

export const GEN_DEF = {
  id: 'gx12', name: 'Diesel Generator', type: 'Generator set', brand: 'Fieldworks Power', model: 'GX-12', category: 'Utilities',
  levels: [
    { level: 1, ratedKw: 8, tankL: 60, cost: 0, parts: [] },
    { level: 2, ratedKw: 12, tankL: 90, cost: 2600, parts: ['Turbocharger kit', 'Alternator rewind 15 kVA'] },
    { level: 3, ratedKw: 18, tankL: 120, cost: 5600, parts: ['Intercooler', 'Alternator 22 kVA', 'Extended tank'] }
  ],
  fuelPrice: 1.6, wearPerHour: 10, repairCostPerPct: 5, ambientC: 18
};

export class Generator {
  constructor(def, started) {
    this.def = def; this.levelIndex = 0; this.on = true;
    this.rpm = started ? 1500 : 0; this.cranking = 0;
    this.fuel = def.levels[0].tankL * 0.8; this.coolantC = started ? 72 : def.ambientC; this.oilBar = started ? 4 : 0;
    this.condition = 100; this.hours = 0; this.energyKwh = 0; this.fuelUsedL = 0;
    this.fault = null; this.overT = 0; this.output = 0; this.demand = 0; this.time = 0; this.log = []; this.lph = 0;
  }
  get level() { return this.def.levels[this.levelIndex]; }
  note(t) { this.log.unshift({ t: this.time, text: t }); this.log.length = Math.min(this.log.length, 12); }
  setOn(v) { this.on = !!v; this.note(v ? 'Engine start requested' : 'Engine stopped by operator'); }
  efficiency() { return Math.max(0.55, Math.min(1, 0.55 + this.condition * 0.0045)); }
  outputOn() { return this.on && this.rpm >= 1400 && !this.fault; }
  loadFrac() { return this.output / this.level.ratedKw; }
  voltage() { return this.outputOn() ? 400 - 8 * this.loadFrac() : 0; }
  frequency() { return this.outputOn() ? 50 - 0.5 * this.loadFrac() : this.rpm / 30; }
  status() { if (!this.on) return 'off'; if (this.fault) return 'stopped'; if (this.rpm < 1400) return 'waiting'; return 'running'; }
  reason() {
    if (!this.on) return 'Engine off';
    if (this.fault) return this.fault.text;
    if (this.rpm < 1400) return this.rpm > 0 ? 'Starting engine' : 'Ready to start';
    return `Supplying ${this.output.toFixed(1)} kW`;
  }
  trip(code, text) { this.fault = { code, text, since: this.time }; this.note('Fault: ' + text); }
  tick(dt, demandKw) {
    this.time += dt;
    const L = this.level;
    const engineFault = this.fault && this.fault.code !== 'overload';
    const canRun = this.on && this.fuel > 0 && !engineFault;
    if (canRun) {
      if (this.rpm < 1400) { this.cranking += dt; this.rpm = Math.min(1500, this.rpm + dt * (this.cranking < 1.2 ? 220 : 950)); }
      else { this.cranking = 0; this.rpm += (1500 - 14 * this.loadFrac() - this.rpm) * Math.min(1, dt * 2); }
    } else { this.cranking = 0; this.rpm = Math.max(0, this.rpm - dt * 700); }
    this.demand = demandKw;
    this.output = this.outputOn() ? demandKw : 0;
    if (this.outputOn() && demandKw > L.ratedKw * 1.05) {
      this.overT += dt;
      if (this.overT > 1.5) { this.trip('overload', `Overload - breaker tripped (${demandKw.toFixed(1)} kW on a ${L.ratedKw} kW set)`); this.output = 0; }
    } else this.overT = Math.max(0, this.overT - dt);
    const running = this.rpm > 300;
    this.lph = running ? (0.6 + 0.26 * this.output) / this.efficiency() : 0;
    const used = this.lph * dt / 3600;
    this.fuel = Math.max(0, this.fuel - used); this.fuelUsedL += used;
    if (this.fuel <= 0 && !this.fault && this.on) this.trip('fuel', 'Out of fuel - engine stopped');
    const targetC = this.def.ambientC + (running ? 52 + 30 * this.loadFrac() + (100 - this.condition) * 0.18 : 0);
    this.coolantC += (targetC - this.coolantC) * Math.min(1, dt / 30);
    if (this.coolantC > 104 && !this.fault) this.trip('heat', 'Coolant over temperature - engine stopped');
    if (this.fault && this.fault.code === 'heat' && this.coolantC < 75) { this.note('Engine cooled down, fault cleared'); this.fault = null; }
    this.oilBar = (this.rpm / 1500) * (4.3 - (100 - this.condition) * 0.016);
    if (running) { this.hours += dt / 3600; this.condition = Math.max(0, this.condition - this.def.wearPerHour * dt / 3600); }
    this.energyKwh += this.output * dt / 3600;
  }
  repairCost() { return Math.ceil((100 - this.condition) * this.def.repairCostPerPct); }
  repair() { this.condition = 100; this.note('Serviced: oil, filters, belts'); }
  nextLevel() { return this.def.levels[this.levelIndex + 1] || null; }
  upgrade() { const n = this.nextLevel(); if (!n) return 0; this.levelIndex++; this.note('Upgraded to level ' + n.level); return n.cost; }
  refuelCost() { return Math.ceil((this.level.tankL - this.fuel) * this.def.fuelPrice); }
  act(id, wallet) {
    if (id === 'refuel') {
      const c = this.refuelCost();
      if (!c) return { msg: 'Tank already full' };
      if (c > wallet) return { msg: `Filling the tank costs ${money(c)}` };
      this.fuel = this.level.tankL; this.note('Refuelled to ' + this.level.tankL + ' L');
      if (this.fault && this.fault.code === 'fuel') this.fault = null;
      return { cost: c, msg: `Refuelled for ${money(c)}` };
    }
    if (id === 'breaker') {
      if (!this.fault || this.fault.code !== 'overload') return { msg: 'Breaker is closed' };
      this.fault = null; this.overT = 0; this.note('Breaker reset');
      return { msg: 'Breaker reset. It trips again if the load is still too high' };
    }
    return standardAct(this, id, wallet, 'Generator');
  }
  panel(env) {
    const L = this.level, f1 = (n) => n.toFixed(1), lf = this.loadFrac();
    const runtime = this.lph > 0 ? this.fuel / this.lph : Infinity;
    const next = this.nextLevel();
    const consumers = (env && env.consumers) || [];
    return {
      key: 'generator', title: `${this.def.model} ${this.def.name}`, sub: `${this.def.brand} · ${this.def.category}`, status: this.status(), reason: this.reason(),
      tabs: {
        overview: [['Type', this.def.type], ['Model', this.def.model], ['Status', this.reason()], ['Output', `${f1(this.output)} of ${L.ratedKw} kW`], ['Fuel', `${f1(this.fuel)} / ${L.tankL} L`], ['Runtime left', runtime === Infinity ? '–' : `${f1(runtime)} h at this load`], ['Condition', Math.round(this.condition) + '%'], ['Level', `${L.level} of ${this.def.levels.length}`]],
        performance: [['Output', f1(this.output) + ' kW'], ['Demand', f1(this.demand) + ' kW'], ['Rated output', L.ratedKw + ' kW'], ['Load', Math.round(lf * 100) + '%'], ['Voltage', Math.round(this.voltage()) + ' V'], ['Frequency', this.frequency().toFixed(2) + ' Hz'], ['Engine speed', Math.round(this.rpm) + ' rpm'], ['Fuel use', this.lph.toFixed(2) + ' L/h'], ['Coolant', f1(this.coolantC) + ' °C'], ['Oil pressure', f1(this.oilBar) + ' bar'], ['Efficiency', Math.round(this.efficiency() * 100) + '%'], ['Running hours', this.hours.toFixed(3) + ' h'], ['Energy supplied', this.energyKwh.toFixed(3) + ' kWh'], ['Fuel used', this.fuelUsedL.toFixed(3) + ' L']],
        resources: [['Fuel', 'Diesel'], ['Fuel tank', `${f1(this.fuel)} / ${L.tankL} L`], ['Refuel cost', money(this.refuelCost())], ...consumers.map((c) => [c.name, f1(c.kw) + ' kW']), ['Spare capacity', f1(Math.max(0, L.ratedKw - this.demand)) + ' kW']],
        upgrades: { rows: next ? [['Current level', `${L.level} of ${this.def.levels.length}`], ['Next level', next.level], ['Cost', money(next.cost)], ['Parts', next.parts.join(', ')]] : [['Current level', `${L.level} of ${this.def.levels.length}`], ['Next level', 'Fully upgraded']], gains: next ? [`Rated output ${L.ratedKw} -> ${next.ratedKw} kW`, `Fuel tank ${L.tankL} -> ${next.tankL} L`] : [] },
        operation: { rows: [['Current task', this.outputOn() ? `Supplying ${consumers.filter((c) => c.kw > 0.05).length} machines` : this.reason()], ['Breaker', this.fault && this.fault.code === 'overload' ? 'Tripped' : this.outputOn() ? 'Closed' : 'Open'], ['Fault', this.fault ? this.fault.text : 'None'], ['Maintenance', this.condition < 40 ? 'Service now' : this.condition < 70 ? 'Service soon' : 'OK'], ['Service cost', money(this.repairCost())], ...consumers.map((c) => [c.name, 'Connected'])], log: this.log.slice(0, 6) }
      },
      strip: [
        { k: 'Output', v: `${f1(this.output)} / ${L.ratedKw} kW`, f: lf, c: lf > 1 ? 'var(--bad)' : lf > 0.85 ? 'var(--warn)' : 'var(--ok)' },
        { k: 'Engine', v: Math.round(this.rpm) + ' rpm' }, { k: 'Voltage', v: Math.round(this.voltage()) + ' V' },
        { k: 'Fuel', v: f1(this.fuel) + ' L', f: this.fuel / L.tankL, c: 'var(--accent)' }, { k: 'Fuel use', v: this.lph.toFixed(2) + ' L/h' },
        { k: 'Coolant', v: Math.round(this.coolantC) + ' °C' }, { k: 'Condition', v: Math.round(this.condition) + '%', f: this.condition / 100, c: condColor(this.condition) }
      ],
      actions: [
        { id: 'power', label: this.on ? 'Stop engine' : 'Start engine' },
        { id: 'refuel', label: `Refuel ${money(this.refuelCost())}` },
        { id: 'breaker', label: 'Reset breaker', disabled: !(this.fault && this.fault.code === 'overload') },
        ...standardActions(this).slice(1)
      ]
    };
  }
}

// ---------------------------------------------------------------------------
export function buildGenerator(M) {
  const root = new THREE.Group(); root.name = 'GX-12 generator';
  const eng = new THREE.Group(); root.add(eng);           // engine and alternator (vibrate together)
  const bolts = P.boltSet(M.steel), eBolts = P.boltSet(M.steel);
  const live = { spinners: [], gauges: {}, eng };
  const darkGreen = new THREE.MeshStandardMaterial({ name: 'gen_tank', color: new THREE.Color('#25332a').convertSRGBToLinear(), metalness: 0.45, roughness: 0.5 });

  // ---------- skid and fuel tank ----------
  [-1, 1].forEach((s) => { const r = P.panel(1.96, 0.1, 0.09, M.darkSteel, 0.006); r.position.set(0, 0.05, s * 0.41); root.add(r); });
  [-0.85, 0, 0.85].forEach((x) => { const c = P.panel(0.08, 0.06, 0.82, M.darkSteel, 0.005); c.position.set(x, 0.07, 0); root.add(c); });
  [[-0.93, -1], [0.93, -1], [-0.93, 1], [0.93, 1]].forEach(([x, s]) => P.mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 18), M.steel, x, 0.1, s * 0.47, root));
  const tank = P.panel(1.86, 0.24, 0.8, darkGreen, 0.02); tank.position.y = 0.22; root.add(tank);
  for (let i = -3; i <= 3; i++) { const r = P.panel(0.025, 0.2, 0.81, darkGreen, 0.005); r.position.set(i * 0.25, 0.22, 0); root.add(r); }
  P.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 18), M.steel, 0.72, 0.37, 0.28, root);
  P.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 18), M.yellow, 0.72, 0.41, 0.28, root);
  const fuelG = P.gauge(0.045, M, { unit: 'FUEL', marks: ['E', '', '½', '', 'F'], red: undefined, green: [0.25, 1] });
  fuelG.position.set(0.42, 0.22, 0.405); root.add(fuelG); live.gauges.fuel = fuelG;
  const diesel = P.label(0.14, 0.05, ['DIESEL ONLY'], { bg: '#f2c21f' }); diesel.position.set(0.72, 0.22, 0.402); root.add(diesel);
  [[-0.42, -0.17], [-0.42, 0.17], [0.55, -0.17], [0.55, 0.17]].forEach(([x, z]) => P.mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.05, 16), M.rubber, x, 0.365, z, root));

  // ---------- engine ----------
  const EX = -0.2;
  const pan = P.panel(0.66, 0.1, 0.34, M.castIron, 0.02); pan.position.set(EX, 0.44, 0); eng.add(pan);
  const block = P.panel(0.72, 0.36, 0.4, M.castIron, 0.02); block.position.set(EX, 0.67, 0); eng.add(block);
  for (let i = 0; i < 5; i++) [-1, 1].forEach((s) => { const r = P.panel(0.025, 0.3, 0.02, M.castIron, 0.005); r.position.set(EX - 0.3 + i * 0.15, 0.66, s * 0.205); eng.add(r); });
  const gasket = P.panel(0.71, 0.012, 0.385, M.plastic, 0.002); gasket.position.set(EX, 0.853, 0); eng.add(gasket);
  const head = P.panel(0.7, 0.11, 0.38, M.castIron, 0.015); head.position.set(EX, 0.912, 0); eng.add(head);
  const cover = P.panel(0.68, 0.075, 0.3, M.steel, 0.028); cover.position.set(EX, 1.003, 0); eng.add(cover);
  const strip = P.panel(0.56, 0.008, 0.05, M.plastic, 0.003); strip.position.set(EX, 1.042, 0.07); eng.add(strip);
  eBolts.row(new V(EX - 0.31, 1.042, 0.125), new V(EX + 0.31, 1.042, 0.125), new V(0, 1, 0), 8, 0.007);
  eBolts.row(new V(EX - 0.31, 1.042, -0.125), new V(EX + 0.31, 1.042, -0.125), new V(0, 1, 0), 8, 0.007);
  P.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16), M.yellow, EX + 0.24, 1.055, 0.07, eng);
  // injectors with red leads to the glow-plug rail (the red-lead look from the engine reference)
  const rail = P.panel(0.6, 0.03, 0.035, M.plastic, 0.006); rail.position.set(EX, 0.99, -0.215); eng.add(rail);
  for (let i = 0; i < 4; i++) {
    const x = EX - 0.24 + i * 0.16;
    P.mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.05, 16), M.plastic, x, 1.065, -0.05, eng);
    P.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), M.chrome, x, 1.1, -0.05, eng);
    eng.add(P.cable(new V(x, 1.095, -0.05), new V(x + 0.03, 1.0, -0.23), 0.007, M.redWire, -0.07));
  }
  // intake: plenum, runners, hose to air filter
  P.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 20).rotateZ(Math.PI / 2), M.steel, EX, 0.9, 0.3, eng);
  for (let i = 0; i < 4; i++) P.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 14).rotateX(Math.PI / 2), M.steel, EX - 0.24 + i * 0.16, 0.9, 0.235, eng);
  eng.add(P.pipe([[EX - 0.31, 0.9, 0.3], [EX - 0.44, 0.9, 0.3], [EX - 0.44, 1.08, 0.3]], 0.035, M.rubber, M, { flanges: false, bend: 0.06 }));
  const filt = new THREE.Group(); filt.position.set(EX - 0.44, 1.08, 0.3); eng.add(filt);
  P.mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 24), M.motor, 0, 0.1, 0, filt);
  P.mesh(new THREE.SphereGeometry(0.09, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.motor, 0, 0.2, 0, filt);
  [0.04, 0.16].forEach((y) => P.mesh(new THREE.TorusGeometry(0.092, 0.006, 6, 24).rotateX(Math.PI / 2), M.steel, 0, y, 0, filt));
  // exhaust: four chrome headers into a collector, up to the muffler and the stack with a rain cap
  for (let i = 0; i < 4; i++) {
    const x = EX - 0.24 + i * 0.16;
    eng.add(P.pipe([[x, 0.9, -0.19], [x, 0.9, -0.3], [x, 0.74, -0.34], [x + 0.05, 0.72, -0.35]], 0.021, M.chrome, M, { flanges: false, bend: 0.05 }));
  }
  eng.add(P.pipe([[EX - 0.3, 0.72, -0.35], [0.28, 0.72, -0.35], [0.28, 1.18, -0.35]], 0.034, M.chrome, M, { bend: 0.08 }));
  P.mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.26, 24), M.darkSteel, 0.28, 1.31, -0.35, eng);
  [1.18, 1.44].forEach((y) => P.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), M.steel, 0.28, y, -0.35, eng));
  const shield = P.mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.18, 24, 1, true, -0.4, 1.8), M.steel, 0.28, 1.31, -0.35, eng); shield.material = M.steel;
  P.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 18), M.darkSteel, 0.28, 1.61, -0.35, eng);
  const capPivot = new THREE.Group(); capPivot.position.set(0.245, 1.785, -0.35); eng.add(capPivot);
  P.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 20), M.darkSteel, 0.035, 0, 0, capPivot);
  live.cap = capPivot; live.smokeAt = new V(0.28, 1.8, -0.35);
  // front: timing cover, crank / water pump / charging pulleys with belts, fan
  const tc = P.panel(0.05, 0.42, 0.34, M.castIron, 0.015); tc.position.set(EX - 0.385, 0.68, 0); eng.add(tc);
  const FX = EX - 0.44;
  function spinner(r, w, y, z, grooves) {
    const g = new THREE.Group(); g.position.set(FX, y, z); g.rotation.y = Math.PI / 2; eng.add(g);
    const p = P.pulley(r, w, M, { grooves }); g.add(p); live.spinners.push({ obj: p, r });
    return g;
  }
  spinner(0.085, 0.045, 0.53, 0, 2); spinner(0.06, 0.03, 0.8, 0, 1); spinner(0.045, 0.03, 0.72, 0.17, 1);
  const beltG = new THREE.Group(); beltG.position.set(FX, 0, 0); beltG.rotation.y = Math.PI / 2; eng.add(beltG);
  beltG.add(P.belt(new V(0, 0.53, 0), 0.08, new V(0, 0.8, 0), 0.055, 0.02, M.rubber));
  beltG.add(P.belt(new V(0, 0.53, 0), 0.08, new V(-0.17, 0.72, 0), 0.04, 0.02, M.rubber).translateZ(0.02));
  const chg = P.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 20).rotateZ(Math.PI / 2), M.steel, FX + 0.08, 0.72, 0.17, eng); void chg;
  const fan = P.fan(0.19, M); fan.rotation.z = Math.PI / 2; fan.position.set(FX - 0.05, 0.8, 0); eng.add(fan); live.fan = fan.userData.rotor;
  // radiator with fins, top tank, cap and hoses (on the skid, not vibrating)
  const RX = -0.86;
  const rframe = P.panel(0.07, 0.76, 0.8, M.darkSteel, 0.008); rframe.position.set(RX, 0.77, 0); root.add(rframe);
  const core = P.guard(0.7, 0.62, M, { mat: M.castIron, pitch: 0.012 }); core.rotation.y = Math.PI / 2; core.position.set(RX - 0.04, 0.76, 0); root.add(core);
  const rtop = P.panel(0.09, 0.06, 0.74, M.darkSteel, 0.01); rtop.position.set(RX, 1.17, 0); root.add(rtop);
  P.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16), M.brass, RX, 1.215, 0.25, root);
  root.add(P.pipe([[RX + 0.04, 1.08, -0.18], [EX - 0.5, 1.08, -0.18], [EX - 0.36, 0.95, -0.12]], 0.03, M.rubber, M, { flanges: false, bend: 0.06 }));
  root.add(P.pipe([[RX + 0.04, 0.48, 0.22], [EX - 0.5, 0.48, 0.22], [EX - 0.4, 0.6, 0.12]], 0.03, M.rubber, M, { flanges: false, bend: 0.06 }));
  // flywheel housing and alternator
  P.mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.13, 32).rotateZ(Math.PI / 2), M.castIron, 0.22, 0.66, 0, eng);
  eBolts.circle(new V(0.29, 0.66, 0), new V(1, 0, 0), 0.24, 10, 0.008);
  P.mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.52, 36).rotateZ(Math.PI / 2), M.paint, 0.55, 0.68, 0, eng);
  for (let i = 0; i < 9; i++) P.mesh(new THREE.TorusGeometry(0.272, 0.008, 6, 36).rotateY(Math.PI / 2), M.paint, 0.33 + i * 0.055, 0.68, 0, eng);
  P.mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.05, 36).rotateZ(Math.PI / 2), M.paint, 0.835, 0.68, 0, eng);
  const lv = P.louvres(0.26, 0.2, M); lv.rotation.y = Math.PI / 2; lv.position.set(0.865, 0.68, 0); eng.add(lv);
  const feet = P.panel(0.42, 0.1, 0.46, M.darkSteel, 0.008); feet.position.set(0.55, 0.4, 0); eng.add(feet);
  const tb = P.panel(0.26, 0.17, 0.24, M.paint, 0.012); tb.position.set(0.55, 1.03, 0); eng.add(tb);
  const tbl = P.panel(0.28, 0.02, 0.26, M.paint, 0.006); tbl.position.set(0.55, 1.12, 0); eng.add(tbl);
  eBolts.row(new V(0.44, 1.132, 0.1), new V(0.66, 1.132, 0.1), new V(0, 1, 0), 3, 0.006);
  eBolts.row(new V(0.44, 1.132, -0.1), new V(0.66, 1.132, -0.1), new V(0, 1, 0), 3, 0.006);
  P.mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 14).rotateZ(Math.PI / 2), M.plastic, 0.705, 1.02, -0.06, eng);
  const np = P.label(0.24, 0.085, ['FIELDWORKS POWER', 'GX-12  15 kVA  400 V 3~', '50 Hz  1500 rpm  SN 1186'], { bg: '#d9dcde', metal: true });
  np.position.set(0.55, 0.69, 0.274); eng.add(np);
  // starter, battery and cables
  P.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 18).rotateZ(Math.PI / 2), M.steel, 0.02, 0.52, 0.24, eng);
  const bat = P.panel(0.24, 0.17, 0.15, M.plastic, 0.01); bat.position.set(-0.6, 0.425, 0.3); root.add(bat);
  P.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), M.red, -0.68, 0.52, 0.3, root);
  P.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), M.plastic, -0.52, 0.52, 0.3, root);
  root.add(P.cable(new V(-0.68, 0.53, 0.3), new V(0.0, 0.56, 0.3), 0.009, M.redWire, 0.05));
  root.add(P.cable(new V(-0.52, 0.53, 0.3), new V(EX - 0.1, 0.5, 0.21), 0.009, M.cable, 0.03));

  // ---------- control panel ----------
  [0.36, 0.74].forEach((x) => { root.add(P.beam(new V(x, 0.14, 0.47), new V(x, 0.97, 0.47), 0.045, M.darkSteel)); });
  const box = P.panel(0.54, 0.44, 0.16, M.paint, 0.014); box.position.set(0.55, 1.18, 0.5); root.add(box);
  const hood = P.panel(0.58, 0.025, 0.24, M.paint, 0.008); hood.position.set(0.55, 1.41, 0.53); hood.rotation.x = 0.12; root.add(hood);
  const face = new THREE.Group(); face.position.set(0.55, 1.18, 0.581); root.add(face);
  const scr = P.screen(0.25, 0.15, M, { px: 480 }); scr.position.set(-0.1, 0.07, 0); face.add(scr); live.screen = scr.userData;
  [['oil', 0.07, { unit: 'bar', marks: ['0', '', '4', '', '8'], red: 0.85, green: [0.35, 0.7] }], ['temp', -0.03, { unit: '°C', marks: ['40', '', '80', '', '120'], red: 0.8, green: [0.3, 0.65] }]].forEach(([k, y, o]) => {
    const g = P.gauge(0.036, M, o); g.position.set(0.17, y + 0.03, 0); face.add(g); live.gauges[k] = g;
  });
  const vg = P.gauge(0.036, M, { unit: 'V', marks: ['0', '', '250', '', '500'], green: [0.7, 0.9] }); vg.position.set(0.1, -0.125, 0); face.add(vg); live.gauges.volt = vg;
  const es = P.emergencyStop(0.017, M); es.position.set(0.2, -0.13, 0); face.add(es);
  const key = P.selectorKnob(0.016, M); key.position.set(-0.19, -0.13, 0); face.add(key); live.key = key.userData.knob;
  live.pilots = ['#2fe06a', '#ffae1a', '#ff2a1f'].map((c, i) => { const b = P.pushButton(0.011, c, M); b.position.set(-0.11 + i * 0.045, -0.13, 0); face.add(b); return b.userData.cap; });
  const cl = P.label(0.2, 0.035, ['GX-12  ENGINE CONTROL'], { bg: '#d9dcde', metal: true }); cl.position.set(-0.1, 0.18, 0.004); face.add(cl);

  // ---------- open canopy ----------
  [[-0.9, -0.38], [-0.9, 0.38], [0.9, -0.38], [0.9, 0.38]].forEach(([x, z]) => root.add(P.beam(new V(x, 0.34, z), new V(x, 1.47, z), 0.05, M.paint)));
  [-0.38, 0.38].forEach((z) => root.add(P.beam(new V(-0.9, 1.45, z), new V(0.9, 1.45, z), 0.045, M.paint).rotateZ(0)));
  const roof = P.panel(2.02, 0.04, 0.94, M.paint, 0.012); roof.position.set(0, 1.5, 0); root.add(roof);
  const trim = P.panel(2.03, 0.018, 0.95, M.paint2, 0.006); trim.position.set(0, 1.475, 0); root.add(trim);
  const warn = P.label(0.3, 0.08, ['DANGER', 'Hot surfaces and moving parts'], { bg: '#f2c21f' }); warn.position.set(-0.3, 1.43, 0.405); root.add(warn);
  bolts.build(root); eBolts.build(eng);

  // ---------- smoke ----------
  const N = 140, pos = new Float32Array(N * 3), life = new Float32Array(N), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -100; life[i] = -1; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const smokeMat = new THREE.PointsMaterial({ color: new THREE.Color('#8c8f93'), size: 0.09, transparent: true, opacity: 0.35, depthWrite: false });
  const smoke = new THREE.Points(pg, smokeMat); smoke.frustumCulled = false; root.add(smoke);
  let emitAcc = 0, spin = 0, t = 0, screenT = 0;

  function animate(dt, g, panelData) {
    t += dt;
    const rps = g.rpm / 60, run = g.rpm > 300;
    spin += rps * dt * Math.PI * 2 * 0.12;                       // shown slowed so the parts read instead of strobing
    live.spinners.forEach((s) => { s.obj.rotation.z = -spin * (0.085 / s.r); });
    live.fan.rotation.y = spin * (0.085 / 0.06);
    eng.position.y = run ? Math.sin(t * rps * 2) * 0.0012 * (g.rpm < 1400 ? 2.5 : 1) : 0;
    eng.position.z = run ? Math.cos(t * rps * 1.7) * 0.0006 : 0;
    const flap = run ? 0.25 + 0.55 * Math.min(1, g.loadFrac()) + Math.sin(t * 23) * 0.06 : 0;
    live.cap.rotation.z += (flap - live.cap.rotation.z) * Math.min(1, dt * 6);
    live.gauges.oil.userData.setValue(g.oilBar / 8);
    live.gauges.temp.userData.setValue((g.coolantC - 40) / 80);
    live.gauges.volt.userData.setValue(g.voltage() / 500);
    live.gauges.fuel.userData.setValue(g.fuel / g.level.tankL);
    live.key.rotation.z = g.on ? -0.7 : 0;
    const st = g.status();
    live.pilots[0].material.emissiveIntensity = st === 'running' ? 3 : 0.05;
    live.pilots[1].material.emissiveIntensity = st === 'waiting' ? (Math.sin(t * 9) > 0 ? 3 : 0.2) : 0.05;
    live.pilots[2].material.emissiveIntensity = st === 'stopped' ? 3 : 0.05;
    // smoke: more with load, a dark puff while cranking
    const rate = run ? (g.rpm < 1400 ? 60 : 8 + 30 * Math.min(1.2, g.loadFrac())) : 0;
    emitAcc += rate * dt;
    smokeMat.color.set(g.rpm < 1400 && run ? '#3c3d3f' : '#8c8f93');
    for (let i = 0; i < N; i++) {
      if (life[i] < 0 && emitAcc >= 1) {
        emitAcc -= 1; life[i] = 2.4;
        pos[i * 3] = live.smokeAt.x + (Math.random() - 0.5) * 0.03; pos[i * 3 + 1] = live.smokeAt.y; pos[i * 3 + 2] = live.smokeAt.z + (Math.random() - 0.5) * 0.03;
        vel[i * 3] = 0.08 + Math.random() * 0.06; vel[i * 3 + 1] = 0.45 + Math.random() * 0.25; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
      }
      if (life[i] >= 0) {
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] *= 0.985;
        if (life[i] < 0) pos[i * 3 + 1] = -100;
      }
    }
    if (emitAcc > 1) emitAcc = 1;
    pg.attributes.position.needsUpdate = true;
    screenT -= dt;
    if (screenT <= 0 && panelData) { screenT = 0.25; drawScreen(live.screen, g, panelData); }
  }
  return { root, animate, live, terminal: new V(0.72, 1.03, -0.12) };
}

const STATUS_COL = { running: '#2fe06a', waiting: '#ffae1a', stopped: '#ff4a3a', off: '#7c8590' };
function drawScreen(sd, g, pd) {
  const x = sd.ctx, W = sd.canvas.width, H = sd.canvas.height, st = g.status(), L = g.level;
  x.fillStyle = '#0b1419'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#12232c'; x.fillRect(0, 0, W, 46);
  x.textBaseline = 'middle'; x.fillStyle = '#d9f2ff'; x.font = '700 22px Arial'; x.fillText('GX-12  GENERATOR', 14, 24);
  x.fillStyle = STATUS_COL[st]; x.fillRect(W - 130, 10, 118, 26); x.fillStyle = '#0b1419'; x.font = '700 15px Arial'; x.textAlign = 'center'; x.fillText(st.toUpperCase(), W - 71, 24); x.textAlign = 'left';
  x.fillStyle = '#8fb3c4'; x.font = '500 13px Arial'; x.fillText(pd.reason.slice(0, 52), 14, 62);
  const col = (cx, label, val, unit) => { x.fillStyle = '#7fa1b2'; x.font = '500 12px Arial'; x.fillText(label, cx, 86); x.fillStyle = '#e8f6ff'; x.font = '700 30px Arial'; x.fillText(val, cx, 116); x.fillStyle = '#7fa1b2'; x.font = '500 12px Arial'; x.fillText(unit, cx, 142); };
  col(14, 'OUTPUT', g.output.toFixed(1), `kW of ${L.ratedKw}`);
  col(150, 'VOLTAGE', String(Math.round(g.voltage())), `V  ${g.frequency().toFixed(1)} Hz`);
  col(290, 'ENGINE', String(Math.round(g.rpm)), 'rpm');
  const bars = [['LOAD', g.loadFrac(), `${Math.round(g.loadFrac() * 100)}%`, g.loadFrac() > 0.85 ? '#ffae1a' : '#2fe06a'], ['FUEL', g.fuel / L.tankL, `${g.fuel.toFixed(1)} L  ${g.lph.toFixed(2)} L/h`, '#e0b552'], ['COOLANT', (g.coolantC - 20) / 90, `${Math.round(g.coolantC)} °C`, g.coolantC > 95 ? '#ff4a3a' : '#2fd6ff']];
  bars.forEach(([lab, f, txt, c], i) => {
    const y = 162 + i * 26;
    x.fillStyle = '#7fa1b2'; x.font = '600 12px Arial'; x.fillText(lab, 14, y + 8);
    x.fillStyle = '#1d2a33'; x.fillRect(90, y, 200, 15); x.fillStyle = c; x.fillRect(90, y, 200 * Math.max(0, Math.min(1, f)), 15);
    x.fillStyle = '#e8f6ff'; x.font = '500 13px Arial'; x.fillText(txt, 300, y + 8);
  });
  sd.texture.needsUpdate = true;
}
