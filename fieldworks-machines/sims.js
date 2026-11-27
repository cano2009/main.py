// Fieldworks power-and-water yard: simulations for the wind turbine, solar array, storage tank, well pump jack
// and spray drone. Every figure comes from the model: wind power through the rotor, sun angle on the panels,
// stroke volume of the pump, battery energy and spray rate of the drone. Panels and screens read panel().
// env (from the page): { hour, sunDir: {x,y,z} unit vector to the sun, irradiance W/m2, wind m/s, windDir rad, airC }

import { standardAct, standardActions, condColor, money } from './machine.js';

const f1 = (n) => n.toFixed(1), f2 = (n) => n.toFixed(2);
const lv = (u) => `${u.level.level} of ${u.def.levels.length}`;

export class Unit {
  constructor(def) { this.def = def; this.levelIndex = 0; this.on = true; this.condition = 100; this.hours = 0; this.time = 0; this.fault = null; this.log = []; this.energyKwh = 0; this.powered = true; }
  get level() { return this.def.levels[this.levelIndex]; }
  note(t) { this.log.unshift({ t: this.time, text: t }); this.log.length = Math.min(this.log.length, 12); }
  setOn(v) { this.on = !!v; this.note(v ? 'Started by operator' : 'Stopped by operator'); }
  efficiency() { return Math.max(0.55, Math.min(1, 0.55 + this.condition * 0.0045)); }
  wear(dt, running) { if (running) { this.hours += dt / 3600; this.condition = Math.max(0, this.condition - this.def.wearPerHour * dt / 3600); } }
  trip(text, service) { if (this.fault) return; this.fault = { text, service: !!service }; this.note('Fault: ' + text); }
  repairCost() { return Math.ceil((100 - this.condition) * this.def.repairCostPerPct); }
  repair() { this.condition = 100; if (this.fault && this.fault.service) this.fault = null; this.note('Serviced'); }
  nextLevel() { return this.def.levels[this.levelIndex + 1] || null; }
  upgrade() { const n = this.nextLevel(); if (!n) return 0; this.levelIndex++; this.note('Upgraded to level ' + n.level); return n.cost; }
  maint() { return this.condition < 40 ? 'Service now' : this.condition < 70 ? 'Service soon' : 'OK'; }
  upgradeTab(gains) {
    const L = this.level, n = this.nextLevel();
    return { rows: n ? [['Current level', lv(this)], ['Next level', n.level], ['Cost', money(n.cost)], ['Parts', n.parts.join(', ')]] : [['Current level', lv(this)], ['Next level', 'Fully upgraded']], gains: n ? gains(L, n) : [] };
  }
  head() { return { key: this.def.id, title: `${this.def.model} ${this.def.name}`, sub: `${this.def.brand} · ${this.def.category}`, status: this.status(), reason: this.reason() }; }
  condStat() { return { k: 'Condition', v: Math.round(this.condition) + '%', f: this.condition / 100, c: condColor(this.condition) }; }
  act(id, wallet) { return standardAct(this, id, wallet, this.def.short); }
}

// ---------------------------------------------------------------------------
export const WIND_DEF = {
  id: 'wind', name: 'Wind Turbine', short: 'Wind turbine', type: 'Three-blade horizontal-axis turbine', brand: 'Fieldworks Power', model: 'FW-WT20', category: 'Energy',
  levels: [
    { level: 1, ratedKw: 20, rotorD: 10, cost: 0, parts: [] },
    { level: 2, ratedKw: 30, rotorD: 12, cost: 9000, parts: ['Blade extensions x3', 'Gearbox 1:24'] },
    { level: 3, ratedKw: 45, rotorD: 14, cost: 18000, parts: ['Carbon blades x3', 'Direct-drive generator'] }
  ],
  cutIn: 3, ratedWind: 11, cutOut: 24, tsr: 7, cp: 0.42, wearPerHour: 3, repairCostPerPct: 30
};
export class WindTurbine extends Unit {
  constructor() { super(WIND_DEF); this.yaw = 0; this.rpm = 0; this.pitch = 90; this.output = 0; this.available = 0; this.yawErr = 0; this.wind = 0; this.rot = 0; }
  status() {
    if (!this.on) return 'off'; if (this.fault) return 'stopped';
    if (this.wind < this.def.cutIn || this.wind > this.def.cutOut) return 'waiting';
    return 'running';
  }
  reason() {
    if (!this.on) return 'Parked by operator'; if (this.fault) return this.fault.text;
    if (this.wind < this.def.cutIn) return `Wind too light (${f1(this.wind)} m/s, starts at ${this.def.cutIn})`;
    if (this.wind > this.def.cutOut) return `Storm: rotor feathered and braked (${f1(this.wind)} m/s)`;
    return `Generating ${f1(this.output)} kW`;
  }
  tick(dt, env) {
    this.time += dt; this.wind = env.wind;
    const D = this.def, L = this.level, R = L.rotorD / 2;
    // yaw toward the wind at 4 degrees per second
    const want = env.windDir; let err = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    this.yaw += Math.sign(err) * Math.min(Math.abs(err), (4 * Math.PI / 180) * dt); this.yawErr = err;
    const run = this.status() === 'running', v = env.wind;
    const pAvail = 0.5 * 1.225 * Math.PI * R * R * D.cp * Math.pow(v * Math.max(0, Math.cos(err)), 3) / 1000;
    this.available = pAvail;
    const targetPitch = !run ? 90 : v <= D.ratedWind ? 0 : Math.min(28, (v - D.ratedWind) * 2.2);
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 0.8);
    const ratedRpm = (D.tsr * D.ratedWind / R) * 60 / (2 * Math.PI);
    const targetRpm = run ? Math.min(ratedRpm, (D.tsr * v / R) * 60 / (2 * Math.PI)) : (this.fault || !this.on || v > D.cutOut ? 0 : Math.min(4, v * 1.2));
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 0.35);
    this.rot += this.rpm / 60 * 2 * Math.PI * dt;
    this.output = run ? Math.min(L.ratedKw, pAvail) * this.efficiency() * Math.min(1, this.rpm / Math.max(1, targetRpm)) : 0;
    this.energyKwh += this.output * dt / 3600;
    this.wear(dt, run);
    if (run && this.condition < 25 && Math.random() < dt * 0.01) this.trip('Gearbox vibration high - service needed', true);
  }
  panel() {
    const L = this.level;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', this.def.type], ['Model', this.def.model], ['Status', this.reason()], ['Output', `${f1(this.output)} of ${L.ratedKw} kW`], ['Wind', `${f1(this.wind)} m/s`], ['Condition', Math.round(this.condition) + '%'], ['Level', lv(this)]],
        performance: [['Output', f1(this.output) + ' kW'], ['Available in the wind', f1(this.available) + ' kW'], ['Rated output', L.ratedKw + ' kW'], ['Rotor diameter', L.rotorD + ' m'], ['Rotor speed', f1(this.rpm) + ' rpm'], ['Tip speed', f1(this.rpm / 60 * Math.PI * L.rotorD) + ' m/s'], ['Blade pitch', f1(this.pitch) + '°'], ['Yaw error', f1(Math.abs(this.yawErr) * 57.3) + '°'], ['Cut-in / rated / cut-out', `${this.def.cutIn} / ${this.def.ratedWind} / ${this.def.cutOut} m/s`], ['Efficiency', Math.round(this.efficiency() * 100) + '%'], ['Running hours', this.hours.toFixed(3) + ' h'], ['Energy produced', f2(this.energyKwh) + ' kWh']],
        resources: [['Input', 'Wind'], ['Output', 'Electricity to the yard grid'], ['Wind speed', f1(this.wind) + ' m/s'], ['Power in the wind', f1(this.available) + ' kW']],
        upgrades: this.upgradeTab((a, b) => [`Rated output ${a.ratedKw} -> ${b.ratedKw} kW`, `Rotor ${a.rotorD} -> ${b.rotorD} m`]),
        operation: { rows: [['Current task', this.reason()], ['Brake', this.rpm < 0.5 && this.pitch > 80 ? 'Applied' : 'Released'], ['Fault', this.fault ? this.fault.text : 'None'], ['Maintenance', this.maint()], ['Service cost', money(this.repairCost())], ['Grid', 'Connected']], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Output', v: `${f1(this.output)} / ${L.ratedKw} kW`, f: this.output / L.ratedKw, c: 'var(--ok)' }, { k: 'Wind', v: f1(this.wind) + ' m/s' }, { k: 'Rotor', v: f1(this.rpm) + ' rpm' }, { k: 'Pitch', v: Math.round(this.pitch) + '°' }, { k: 'Yaw error', v: Math.round(Math.abs(this.yawErr) * 57.3) + '°' }, this.condStat()],
      actions: [{ id: 'power', label: this.on ? 'Park rotor' : 'Release brake' }, ...standardActions(this).slice(1)]
    });
  }
}

// ---------------------------------------------------------------------------
export const SOLAR_DEF = {
  id: 'solar', name: 'Solar Array', short: 'Solar array', type: 'Ground-mounted PV array, 8 modules', brand: 'Fieldworks Power', model: 'FW-SA8', category: 'Energy',
  levels: [
    { level: 1, moduleW: 370, tracker: false, cost: 0, parts: [] },
    { level: 2, moduleW: 430, tracker: false, cost: 3200, parts: ['Mono PERC modules x8'] },
    { level: 3, moduleW: 430, tracker: true, cost: 7400, parts: ['Single-axis tracker drive', 'Slew bearing'] }
  ],
  modules: 8, tilt: 30, inverterEff: 0.96, tempCoef: -0.0038, wearPerHour: 0.5, repairCostPerPct: 10, cleanCost: 25
};
export class SolarArray extends Unit {
  constructor() { super(SOLAR_DEF); this.output = 0; this.soiling = 0.04; this.cellC = 15; this.cosInc = 0; this.tilt = SOLAR_DEF.tilt; this.irr = 0; }
  kWp() { return this.def.modules * this.level.moduleW / 1000; }
  status() { if (!this.on) return 'off'; if (this.fault) return 'stopped'; if (this.irr < 15) return 'waiting'; return 'running'; }
  reason() {
    if (!this.on) return 'Inverter switched off'; if (this.fault) return this.fault.text;
    if (this.irr < 15) return 'No sunlight';
    return `Generating ${f2(this.output)} kW`;
  }
  tick(dt, env) {
    this.time += dt;
    const s = env.sunDir, L = this.level;
    // modules face south (+z) at the fixed tilt; the tracker tilts them toward the sun's elevation
    const sunElev = Math.asin(Math.max(-1, Math.min(1, s.y)));
    const target = L.tracker ? Math.max(5, Math.min(60, 90 - sunElev * 57.3)) : this.def.tilt;
    this.tilt += (target - this.tilt) * Math.min(1, dt * 0.5);
    const t = this.tilt * Math.PI / 180, n = { x: 0, y: Math.cos(t), z: Math.sin(t) };
    this.cosInc = Math.max(0, n.x * s.x + n.y * s.y + n.z * s.z);
    this.irr = env.irradiance;
    const poa = env.irradiance * (s.y > 0 ? this.cosInc / Math.max(0.15, s.y) * 0.85 + 0.15 : 0);   // direct on the plane plus diffuse
    this.poa = Math.max(0, Math.min(1300, poa));
    this.cellC += (env.airC + this.poa / 800 * 25 - this.cellC) * Math.min(1, dt / 60);
    const tempF = 1 + this.def.tempCoef * (this.cellC - 25);
    const run = this.status() === 'running';
    this.output = run ? this.kWp() * (this.poa / 1000) * tempF * (1 - this.soiling) * this.def.inverterEff * this.efficiency() : 0;
    this.output = Math.max(0, this.output);
    this.soiling = Math.min(0.35, this.soiling + dt / 3600 * 0.012);
    this.energyKwh += this.output * dt / 3600;
    this.wear(dt, run);
  }
  act(id, wallet) {
    if (id === 'clean') {
      if (this.soiling < 0.005) return { msg: 'Panels are already clean' };
      if (this.def.cleanCost > wallet) return { msg: `Cleaning costs ${money(this.def.cleanCost)}` };
      const gain = this.soiling; this.soiling = 0; this.note(`Panels washed (+${Math.round(gain * 100)}% output)`);
      return { cost: this.def.cleanCost, msg: `Panels washed: ${Math.round(gain * 100)}% more output` };
    }
    return super.act(id, wallet);
  }
  panel() {
    const L = this.level;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', this.def.type], ['Model', this.def.model], ['Status', this.reason()], ['Output', `${f2(this.output)} of ${f2(this.kWp())} kWp`], ['Sunlight', Math.round(this.irr) + ' W/m²'], ['Soiling loss', Math.round(this.soiling * 100) + '%'], ['Level', lv(this)]],
        performance: [['Output', f2(this.output) + ' kW'], ['Peak rating', f2(this.kWp()) + ' kWp'], ['Sunlight', Math.round(this.irr) + ' W/m²'], ['On the panel plane', Math.round(this.poa || 0) + ' W/m²'], ['Panel tilt', Math.round(this.tilt) + '°' + (L.tracker ? ' (tracking)' : '')], ['Sun angle factor', Math.round(this.cosInc * 100) + '%'], ['Cell temperature', f1(this.cellC) + ' °C'], ['Heat loss', Math.round(Math.max(0, -this.def.tempCoef * (this.cellC - 25)) * 100) + '%'], ['Soiling loss', Math.round(this.soiling * 100) + '%'], ['Inverter efficiency', Math.round(this.def.inverterEff * 100) + '%'], ['Energy produced', f2(this.energyKwh) + ' kWh']],
        resources: [['Input', 'Sunlight'], ['Output', 'Electricity to the yard grid'], ['Modules', `${this.def.modules} x ${L.moduleW} W`], ['Dirt on panels', Math.round(this.soiling * 100) + '% loss']],
        upgrades: this.upgradeTab((a, b) => [`Module ${a.moduleW} -> ${b.moduleW} W`, b.tracker && !a.tracker ? 'Panels follow the sun' : 'Same fixed 30° tilt']),
        operation: { rows: [['Current task', this.reason()], ['Fault', this.fault ? this.fault.text : 'None'], ['Cleaning', this.soiling > 0.12 ? 'Clean now' : this.soiling > 0.06 ? 'Clean soon' : 'OK'], ['Maintenance', this.maint()], ['Grid', 'Connected']], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Output', v: `${f2(this.output)} / ${f1(this.kWp())} kW`, f: this.output / this.kWp(), c: 'var(--ok)' }, { k: 'Sunlight', v: Math.round(this.irr) + ' W/m²' }, { k: 'Sun angle', v: Math.round(this.cosInc * 100) + '%' }, { k: 'Cells', v: Math.round(this.cellC) + ' °C' }, { k: 'Soiling', v: Math.round(this.soiling * 100) + '%', f: this.soiling / 0.35, c: 'var(--warn)' }, this.condStat()],
      actions: [{ id: 'clean', label: `Wash panels ${money(this.def.cleanCost)}`, primary: this.soiling > 0.08 }, { id: 'power', label: this.on ? 'Inverter off' : 'Inverter on' }, ...standardActions(this).slice(1)]
    });
  }
}

// ---------------------------------------------------------------------------
export const TANK_DEF = {
  id: 'tank', name: 'Water Storage Tank', short: 'Tank', type: 'Welded steel tank on a concrete ring', brand: 'Fieldworks Water', model: 'FW-ST', category: 'Water',
  levels: [
    { level: 1, rings: 3, capacityL: 21000, cost: 0, parts: [] },
    { level: 2, rings: 4, capacityL: 28000, cost: 5200, parts: ['Shell ring 1.1 m', 'Longer ladder'] },
    { level: 3, rings: 5, capacityL: 35000, cost: 9800, parts: ['Shell ring 1.1 m', 'Roof vent upgrade'] }
  ],
  wearPerHour: 0.4, repairCostPerPct: 20
};
export class StorageTank extends Unit {
  constructor() { super(TANK_DEF); this.volumeL = 13000; this.inLpm = 0; this.outLpm = 0; this.valveOpen = true; this.usedL = 0; this.filledL = 0; }
  cap() { return this.level.capacityL; }
  frac() { return this.volumeL / this.cap(); }
  status() { if (this.fault) return 'stopped'; if (this.inLpm > 0.1 || this.outLpm > 0.1) return 'running'; return 'waiting'; }
  reason() {
    if (this.fault) return this.fault.text;
    if (this.frac() > 0.985) return 'Full - inlet closed';
    if (this.frac() < 0.05) return 'Nearly empty';
    if (this.inLpm > 0.1 && this.outLpm > 0.1) return 'Filling and supplying';
    if (this.inLpm > 0.1) return 'Filling';
    if (this.outLpm > 0.1) return 'Supplying';
    return 'Standing';
  }
  accepts() { return this.frac() < 0.985 && !this.fault; }
  draw(litres) { if (!this.valveOpen || this.fault) return 0; const got = Math.min(litres, this.volumeL); this.volumeL -= got; this.usedL += got; return got; }
  tick(dt, inLpm, outLpm) {
    this.time += dt; this.inLpm = this.accepts() ? inLpm : 0; this.outLpm = outLpm;
    const add = this.inLpm * dt / 60; this.volumeL = Math.min(this.cap(), this.volumeL + add); this.filledL += add;
    if (this.fault && this.fault.code === 'leak') this.volumeL = Math.max(0, this.volumeL - 6 * dt / 60);
    this.wear(dt, true);
    if (!this.fault && this.condition < 20 && Math.random() < dt * 0.005) { this.fault = { text: 'Leak at the manway gasket - service needed', service: true, code: 'leak' }; this.note('Fault: leak at manway'); }
  }
  act(id, wallet) {
    if (id === 'valve') { this.valveOpen = !this.valveOpen; this.note(this.valveOpen ? 'Outlet valve opened' : 'Outlet valve closed'); return { msg: this.valveOpen ? 'Outlet valve opened' : 'Outlet valve closed' }; }
    return super.act(id, wallet);
  }
  panel() {
    const L = this.level, pct = Math.round(this.frac() * 100);
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', this.def.type], ['Model', `${this.def.model}${Math.round(L.capacityL / 1000)}`], ['Status', this.reason()], ['Level', pct + '%'], ['Water', `${(this.volumeL / 1000).toFixed(2)} of ${L.capacityL / 1000} m³`], ['Condition', Math.round(this.condition) + '%'], ['Level', lv(this)]],
        performance: [['Inflow', f1(this.inLpm) + ' L/min'], ['Outflow', f1(this.outLpm) + ' L/min'], ['Net', f1(this.inLpm - this.outLpm) + ' L/min'], ['Water height', f2(this.frac() * L.rings * 1.1) + ' m'], ['Capacity', L.capacityL.toLocaleString() + ' L'], ['Filled in total', Math.round(this.filledL).toLocaleString() + ' L'], ['Supplied in total', Math.round(this.usedL).toLocaleString() + ' L']],
        resources: [['Contents', 'Well water'], ['Fed by', 'FW-PJ10 well pump jack'], ['Supplies', 'FW-AD16 spray drone'], ['Outlet valve', this.valveOpen ? 'Open' : 'Closed'], ['Limits', this.frac() > 0.985 ? 'Full' : this.frac() < 0.05 ? 'Nearly empty' : 'None']],
        upgrades: this.upgradeTab((a, b) => [`Capacity ${a.capacityL / 1000} -> ${b.capacityL / 1000} m³`, `Shell rings ${a.rings} -> ${b.rings}`]),
        operation: { rows: [['Current task', this.reason()], ['High-level switch', this.frac() > 0.985 ? 'Tripped (inlet closed)' : 'OK'], ['Fault', this.fault ? this.fault.text : 'None'], ['Maintenance', this.maint()], ['Service cost', money(this.repairCost())]], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Level', v: pct + '%', f: this.frac(), c: 'var(--water)' }, { k: 'Water', v: (this.volumeL / 1000).toFixed(2) + ' m³' }, { k: 'Inflow', v: f1(this.inLpm) + ' L/min' }, { k: 'Outflow', v: f1(this.outLpm) + ' L/min' }, { k: 'Outlet', v: this.valveOpen ? 'Open' : 'Closed' }, this.condStat()],
      actions: [{ id: 'valve', label: this.valveOpen ? 'Close outlet valve' : 'Open outlet valve' }, ...standardActions(this).slice(1)]
    });
  }
}

// ---------------------------------------------------------------------------
export const PUMP_DEF = {
  id: 'pump', name: 'Well Pump Jack', short: 'Pump jack', type: 'Beam pump on a 60 m water well', brand: 'Fieldworks Water', model: 'FW-PJ10', category: 'Water',
  levels: [
    { level: 1, spm: 8, strokeM: 1.2, plungerMm: 95, motorKw: 3.0, cost: 0, parts: [] },
    { level: 2, spm: 10, strokeM: 1.5, plungerMm: 95, motorKw: 4.0, cost: 4200, parts: ['Longer crank arms', 'Motor 4 kW'] },
    { level: 3, spm: 12, strokeM: 1.8, plungerMm: 110, motorKw: 5.5, cost: 8600, parts: ['Pump barrel 110 mm', 'Motor 5.5 kW', 'Gear reducer'] }
  ],
  wellDepthM: 60, volEff: 0.85, wearPerHour: 9, repairCostPerPct: 8
};
export class PumpJack extends Unit {
  constructor() { super(PUMP_DEF); this.crank = 0; this.spmNow = 0; this.flowLpm = 0; this.tankFull = false; this.pumpedL = 0; }
  status() { if (!this.on) return 'off'; if (!this.powered || this.fault) return 'stopped'; if (this.tankFull) return 'waiting'; return 'running'; }
  reason() {
    if (!this.on) return 'Switched off'; if (!this.powered) return 'No power - check the yard grid'; if (this.fault) return this.fault.text;
    if (this.tankFull) return 'Tank full - waiting';
    return `Pumping ${f1(this.flowLpm)} L/min`;
  }
  strokeL() { const L = this.level, a = Math.PI * Math.pow(L.plungerMm / 2000, 2); return a * L.strokeM * 1000; }
  rodLoadKn() { const L = this.level, a = Math.PI * Math.pow(L.plungerMm / 2000, 2); return (1000 * 9.81 * this.def.wellDepthM * a + 9.81 * 2.3 * this.def.wellDepthM) / 1000; }
  powerKw() { const st = this.status(); if (st === 'off') return 0.02; if (!this.powered) return 0; if (st !== 'running') return 0.08; return this.level.motorKw * (0.6 + 0.4 * this.spmNow / this.level.spm) / this.efficiency(); }
  tick(dt, env, tank) {
    this.time += dt; this.tankFull = !tank.accepts();
    const run = this.status() === 'running', L = this.level;
    const target = run ? L.spm * this.efficiency() : 0;
    this.spmNow += (target - this.spmNow) * Math.min(1, dt * 0.7);
    this.crank += this.spmNow / 60 * 2 * Math.PI * dt;
    this.flowLpm = this.spmNow * this.strokeL() * this.def.volEff;
    this.pumpedL += this.flowLpm * dt / 60;
    this.energyKwh += this.powerKw() * dt / 3600;
    this.wear(dt, run);
    if (run && this.condition < 25 && Math.random() < dt * 0.02) this.trip('Rod string wear - service needed', true);
  }
  panel() {
    const L = this.level;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', this.def.type], ['Model', this.def.model], ['Status', this.reason()], ['Flow', f1(this.flowLpm) + ' L/min'], ['Power', f2(this.powerKw()) + ' kW'], ['Condition', Math.round(this.condition) + '%'], ['Level', lv(this)]],
        performance: [['Strokes', f1(this.spmNow) + ' /min'], ['Stroke length', L.strokeM + ' m'], ['Plunger', L.plungerMm + ' mm'], ['Volume per stroke', f2(this.strokeL()) + ' L'], ['Flow', f1(this.flowLpm) + ' L/min'], ['Pump efficiency', Math.round(this.def.volEff * 100) + '%'], ['Well depth', this.def.wellDepthM + ' m'], ['Rod load', f1(this.rodLoadKn()) + ' kN'], ['Motor', f2(this.powerKw()) + ` of ${L.motorKw} kW`], ['Running hours', this.hours.toFixed(3) + ' h'], ['Energy used', f2(this.energyKwh) + ' kWh'], ['Pumped in total', Math.round(this.pumpedL).toLocaleString() + ' L']],
        resources: [['Input', 'Groundwater, 60 m down'], ['Output', 'Storage tank'], ['Tank accepts water', this.tankFull ? 'No (full)' : 'Yes']],
        upgrades: this.upgradeTab((a, b) => [`Strokes ${a.spm} -> ${b.spm} /min`, `Stroke ${a.strokeM} -> ${b.strokeM} m`, `Flow about ${Math.round(a.spm * a.strokeM * Math.PI * Math.pow(a.plungerMm / 2000, 2) * 850)} -> ${Math.round(b.spm * b.strokeM * Math.PI * Math.pow(b.plungerMm / 2000, 2) * 850)} L/min`]),
        operation: { rows: [['Current task', this.reason()], ['Fault', this.fault ? this.fault.text : 'None'], ['Maintenance', this.maint()], ['Service cost', money(this.repairCost())], ['Power', this.powered ? 'Yard grid' : 'No supply']], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Flow', v: f1(this.flowLpm) + ' L/min' }, { k: 'Strokes', v: f1(this.spmNow) + ' /min' }, { k: 'Power', v: f2(this.powerKw()) + ' kW' }, { k: 'Rod load', v: f1(this.rodLoadKn()) + ' kN' }, { k: 'Pumped', v: Math.round(this.pumpedL) + ' L' }, this.condStat()],
      actions: standardActions(this)
    });
  }
}

// ---------------------------------------------------------------------------
export const DRONE_DEF = {
  id: 'drone', name: 'Spray Drone', short: 'Drone', type: 'Quad-rotor crop sprayer', brand: 'Fieldworks Aero', model: 'FW-AD16', category: 'Agriculture',
  levels: [
    { level: 1, tankL: 16, batteryWh: 1400, swath: 1.4, speed: 3.0, sprayLpm: 1.6, cost: 0, parts: [] },
    { level: 2, tankL: 20, batteryWh: 1900, swath: 1.8, speed: 3.6, sprayLpm: 2.0, cost: 6500, parts: ['Battery 1900 Wh', 'Tank 20 L', 'Wider boom'] },
    { level: 3, tankL: 30, batteryWh: 2600, swath: 2.2, speed: 4.2, sprayLpm: 2.6, cost: 12500, parts: ['Battery 2600 Wh', 'Tank 30 L', 'Rotary atomisers'] }
  ],
  hoverW: 1900, chargeKw: 3.2, refillLpm: 18, reserve: 0.25, wearPerHour: 6, repairCostPerPct: 12
};
export class SprayDrone extends Unit {
  // field: { x0, x1, z0, z1 } in metres; pad: {x, z}
  constructor(field, pad) {
    super(DRONE_DEF);
    this.field = field; this.pad = pad; this.pos = { x: pad.x, y: 0.25, z: pad.z }; this.vel = 0; this.heading = 0;
    this.battWh = DRONE_DEF.levels[0].batteryWh * 0.9; this.liquidL = 0; this.state = 'refill'; this.lane = 0; this.laneT = 0;
    this.sprayedM2 = 0; this.spraying = false; this.charging = false; this.flyW = 0; this.missions = 0;
  }
  lanes() { return Math.max(1, Math.round((this.field.z1 - this.field.z0) / this.level.swath)); }
  totalM2() { return (this.field.x1 - this.field.x0) * (this.field.z1 - this.field.z0); }
  battPct() { return this.battWh / this.level.batteryWh; }
  status() {
    if (!this.on) return 'off'; if (this.fault) return 'stopped';
    if (this.state === 'done' || (this.state === 'charge' && !this.powered) || (this.state === 'refill' && this.waitWater)) return 'waiting';
    return 'running';
  }
  reason() {
    if (!this.on) return 'Grounded by operator'; if (this.fault) return this.fault.text;
    return ({ refill: this.waitWater ? 'Waiting for water in the tank' : 'Refilling from the tank', charge: this.powered ? 'Charging on the pad' : 'Charging paused - no grid power', takeoff: 'Taking off', transit: 'Flying to the field', spray: `Spraying lane ${this.lane + 1} of ${this.lanes()}`, return: this.retWhy || 'Returning to the pad', land: 'Landing', done: 'Field sprayed - mission complete' })[this.state];
  }
  chargeKw() { return this.charging && this.powered ? this.def.chargeKw : 0; }
  newMission() { this.lane = 0; this.laneT = 0; this.sprayedM2 = 0; this.state = 'refill'; this.missions++; this.note('New spray mission'); }
  act(id, wallet) {
    if (id === 'mission') { if (this.state !== 'done') return { msg: 'A mission is already running' }; this.newMission(); return { msg: 'New spray mission started' }; }
    return super.act(id, wallet);
  }
  waypoint() {
    const F = this.field, n = this.lanes(), z = F.z0 + (this.lane + 0.5) * (F.z1 - F.z0) / n, dir = this.lane % 2 === 0;
    return { a: { x: dir ? F.x0 : F.x1, z }, b: { x: dir ? F.x1 : F.x0, z } };
  }
  moveTo(dt, tx, ty, tz, speed) {
    const dx = tx - this.pos.x, dy = ty - this.pos.y, dz = tz - this.pos.z, d = Math.hypot(dx, dy, dz);
    const step = Math.min(d, speed * dt);
    if (d > 1e-4) { this.pos.x += dx / d * step; this.pos.y += dy / d * step; this.pos.z += dz / d * step; if (Math.hypot(dx, dz) > 0.05) this.heading = Math.atan2(dx, dz); }
    this.vel = step / Math.max(1e-6, dt);
    return d - step < 0.02;
  }
  tick(dt, env, tank) {
    this.time += dt; const L = this.level, D = this.def;
    this.spraying = false; this.charging = false; this.waitWater = false;
    const flying = this.pos.y > 0.3;
    if (!this.on || this.fault) {
      if (flying) { this.moveTo(dt, this.pos.x, 0.25, this.pos.z, 1); }
      this.flyW = flying ? D.hoverW : 0;
    } else {
      const cruise = 4, sprayH = 2.2, sp = L.speed * this.efficiency();
      switch (this.state) {
        case 'refill': {
          const need = L.tankL - this.liquidL;
          if (need > 0.01) { const got = tank.draw(Math.min(need, D.refillLpm * dt / 60)); this.liquidL += got; if (got <= 0) this.waitWater = true; }
          else this.state = this.battPct() < 0.97 ? 'charge' : 'takeoff';
          break;
        }
        case 'charge':
          if (this.powered) { this.charging = true; this.battWh = Math.min(L.batteryWh, this.battWh + D.chargeKw * 1000 * 0.93 * dt / 3600); }
          if (this.battPct() > 0.995) this.state = this.lane >= this.lanes() ? 'done' : 'takeoff';
          break;
        case 'takeoff': if (this.moveTo(dt, this.pos.x, cruise, this.pos.z, 1.5)) this.state = 'transit'; break;
        case 'transit': { const w = this.waypoint(); if (this.moveTo(dt, w.a.x + (w.b.x - w.a.x) * this.laneT, sprayH, w.a.z, sp * 1.4)) this.state = 'spray'; break; }
        case 'spray': {
          const w = this.waypoint(), len = Math.abs(w.b.x - w.a.x);
          if (this.liquidL <= 0.01 || this.battPct() < D.reserve) { this.retWhy = this.liquidL <= 0.01 ? 'Tank empty - returning to refill' : 'Battery low - returning to charge'; this.state = 'return'; this.note(this.retWhy); break; }
          const tx = w.a.x + (w.b.x - w.a.x) * Math.min(1, this.laneT + sp * dt / len);
          this.moveTo(dt, tx, sprayH, w.a.z, sp);
          const done = Math.abs(this.pos.x - w.a.x) / len; this.laneT = Math.min(1, Math.max(this.laneT, done));
          this.spraying = true; const use = Math.min(this.liquidL, L.sprayLpm * dt / 60); this.liquidL -= use;
          this.sprayedM2 = Math.min(this.totalM2(), this.sprayedM2 + this.vel * dt * L.swath);
          if (this.laneT >= 0.999) { this.lane++; this.laneT = 0; if (this.lane >= this.lanes()) { this.retWhy = 'Field finished - returning'; this.state = 'return'; this.note('All lanes sprayed'); } else this.state = 'transit'; }
          break;
        }
        case 'return': if (this.moveTo(dt, this.pad.x, cruise, this.pad.z, sp * 1.5)) this.state = 'land'; break;
        case 'land': if (this.moveTo(dt, this.pad.x, 0.25, this.pad.z, 0.9)) { this.state = this.lane >= this.lanes() ? 'charge' : 'refill'; if (this.lane >= this.lanes()) this.note('Landed, mission complete'); } break;
        case 'done': break;
      }
      this.flyW = this.pos.y > 0.3 ? D.hoverW * (1 + (this.liquidL / L.tankL) * 0.35) * (1 + this.vel * 0.02) / this.efficiency() : 0;
    }
    this.battWh = Math.max(0, this.battWh - this.flyW * dt / 3600);
    if (this.battWh <= 0 && this.pos.y > 0.3 && !this.fault) this.trip('Battery flat - emergency landing', false);
    this.energyKwh += this.chargeKw() * dt / 3600;
    this.wear(dt, this.pos.y > 0.3);
    if (this.pos.y > 0.3 && this.condition < 20 && Math.random() < dt * 0.01) this.trip('Motor 3 overheating - service needed', true);
  }
  panel() {
    const L = this.level, pct = Math.round(this.battPct() * 100), mins = this.flyW > 0 ? (this.battWh / this.flyW) * 60 : this.level.batteryWh / this.def.hoverW * 60;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', this.def.type], ['Model', this.def.model], ['Status', this.reason()], ['Battery', pct + '%'], ['Tank', `${f1(this.liquidL)} of ${L.tankL} L`], ['Field sprayed', `${Math.round(this.sprayedM2)} of ${Math.round(this.totalM2())} m²`], ['Level', lv(this)]],
        performance: [['Flight power', this.flyW ? f2(this.flyW / 1000) + ' kW' : 'Landed'], ['Flight time left', f1(mins) + ' min'], ['Speed', f1(this.vel) + ' m/s'], ['Height', f1(this.pos.y) + ' m'], ['Spray rate', this.spraying ? L.sprayLpm + ' L/min' : '0 L/min'], ['Spray swath', L.swath + ' m'], ['Battery', `${Math.round(this.battWh)} of ${L.batteryWh} Wh`], ['Charger', this.charging ? this.def.chargeKw + ' kW' : 'Idle'], ['Efficiency', Math.round(this.efficiency() * 100) + '%'], ['Flight hours', this.hours.toFixed(3) + ' h'], ['Missions', this.missions + 1]],
        resources: [['Liquid', 'Water from the storage tank'], ['Tank', `${f1(this.liquidL)} / ${L.tankL} L`], ['Field', `${Math.round(this.totalM2())} m², ${this.lanes()} lanes`], ['Progress', `${Math.round(this.sprayedM2 / this.totalM2() * 100)}%`]],
        upgrades: this.upgradeTab((a, b) => [`Tank ${a.tankL} -> ${b.tankL} L`, `Battery ${a.batteryWh} -> ${b.batteryWh} Wh`, `Swath ${a.swath} -> ${b.swath} m`, `Speed ${a.speed} -> ${b.speed} m/s`]),
        operation: { rows: [['Current task', this.reason()], ['Return reserve', Math.round(this.def.reserve * 100) + '% battery'], ['Fault', this.fault ? this.fault.text : 'None'], ['Maintenance', this.maint()], ['Service cost', money(this.repairCost())]], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Battery', v: pct + '%', f: this.battPct(), c: this.battPct() < 0.3 ? 'var(--bad)' : 'var(--ok)' }, { k: 'Tank', v: `${f1(this.liquidL)} L`, f: this.liquidL / L.tankL, c: 'var(--water)' }, { k: 'Sprayed', v: `${Math.round(this.sprayedM2 / this.totalM2() * 100)}%`, f: this.sprayedM2 / this.totalM2() }, { k: 'Speed', v: f1(this.vel) + ' m/s' }, { k: 'Power', v: this.flyW ? f2(this.flyW / 1000) + ' kW' : this.charging ? 'Charging' : '–' }, this.condStat()],
      actions: [{ id: 'mission', label: 'New mission', disabled: this.state !== 'done', primary: this.state === 'done' }, { id: 'power', label: this.on ? 'Ground drone' : 'Release drone' }, ...standardActions(this).slice(1)]
    });
  }
}

// ---------------------------------------------------------------------------
// Yard power network: renewables first, then the battery, then the diesel set (started automatically).
// Loads on separate breakers; when supply runs short, loads are shed in priority order (lights, charger, pump).
// Surplus charges the battery, then is sold to the utility through the transmission line.
export const GRID_DEF = {
  id: 'grid', name: 'Power Network', short: 'Power network', type: 'Hybrid microgrid with battery storage', brand: 'Fieldworks Power', model: 'FW-GRID', category: 'Energy',
  levels: [
    { level: 1, batteryKwh: 20, batteryKw: 10, panelKw: 40, cost: 0, parts: [] },
    { level: 2, batteryKwh: 40, batteryKw: 16, panelKw: 60, cost: 7800, parts: ['Battery rack x2', 'Inverter 16 kW'] },
    { level: 3, batteryKwh: 80, batteryKw: 25, panelKw: 80, cost: 15600, parts: ['Battery container', 'Inverter 25 kW', 'Main breaker 80 kW'] }
  ],
  exportPrice: 0.12, wearPerHour: 0.2, repairCostPerPct: 15, autoStartS: 3, autoStopS: 25
};
export const LOAD_ORDER = ['lights', 'line', 'charger', 'pump'];  // shed first -> last
export class PowerGrid extends Unit {
  constructor() {
    super(GRID_DEF);
    this.soc = 12; this.breakers = { pump: true, charger: true, lights: true, line: true }; this.powered = { pump: true, charger: true, lights: true, line: true };
    this.mainTripped = false; this.autoDiesel = true; this.deficitT = 0; this.surplusT = 0;
    this.flows = { renew: 0, wind: 0, solar: 0, diesel: 0, battIn: 0, battOut: 0, export: 0, demand: 0, served: 0, unmet: 0 };
    this.earned = 0; this.exportedKwh = 0;
  }
  status() { if (this.mainTripped) return 'stopped'; if (this.flows.unmet > 0.05) return 'waiting'; return 'running'; }
  reason() {
    if (this.mainTripped) return 'Main breaker tripped - reduce load and reset';
    if (this.flows.unmet > 0.05) return `Short of power: ${f1(this.flows.unmet)} kW shed`;
    if (this.flows.export > 0.05) return `Selling ${f1(this.flows.export)} kW to the utility`;
    if (this.flows.diesel > 0.05) return `Diesel covering ${f1(this.flows.diesel)} kW`;
    return 'Balanced';
  }
  // loads: { pump, charger, lights } requested kW (as if powered); gen: Generator sim from generator.js
  tick(dt, wind, solar, loads, gen) {
    this.time += dt; const L = this.level, F = this.flows;
    const want = {}; let demand = 0;
    for (const k of LOAD_ORDER) { want[k] = this.breakers[k] && !this.mainTripped ? loads[k] : 0; demand += want[k]; }
    if (demand > L.panelKw && !this.mainTripped) { this.mainTripped = true; this.note(`Main breaker tripped at ${f1(demand)} kW`); }
    const renew = this.mainTripped ? 0 : wind + solar;
    let net = renew - demand, battIn = 0, battOut = 0, exp = 0, dieselNeed = 0;
    if (net >= 0) {
      battIn = Math.min(net, L.batteryKw, (L.batteryKwh - this.soc) * 3600 / Math.max(dt, 1e-3)); net -= battIn; exp = net;
      this.surplusT += dt; this.deficitT = 0;
    } else {
      battOut = Math.min(-net, L.batteryKw, this.soc * 3600 / Math.max(dt, 1e-3) * 0.999); net += battOut;
      dieselNeed = -net; this.deficitT = dieselNeed > 0.2 ? this.deficitT + dt : 0; this.surplusT = 0;
    }
    if (this.autoDiesel && gen) {
      if (!gen.on && this.deficitT > this.def.autoStartS) { gen.setOn(true); this.note('Diesel auto-started'); }
      if (gen.on && this.surplusT > this.def.autoStopS && (this.soc > L.batteryKwh * 0.3 || renew - demand > 2)) { gen.setOn(false); this.note('Diesel auto-stopped: renewables cover the load'); }
    }
    let diesel = 0;
    if (gen) { gen.tick(dt, Math.min(Math.max(0, dieselNeed), gen.level.ratedKw)); diesel = gen.output; }
    const supply = renew + battOut + diesel - battIn - exp;
    let unmet = Math.max(0, demand - supply - 1e-6);
    // shed in priority order for the next tick
    const pw = {}; let short = unmet;
    for (const k of LOAD_ORDER) { pw[k] = want[k] > 0 || (this.breakers[k] && !this.mainTripped); }
    for (const k of LOAD_ORDER) { if (short <= 0.01) break; if (want[k] > 0) { pw[k] = false; short -= want[k]; } }
    for (const k of LOAD_ORDER) this.powered[k] = this.breakers[k] && !this.mainTripped && pw[k];
    this.soc = Math.max(0, Math.min(L.batteryKwh, this.soc + (battIn * 0.95 - battOut) * dt / 3600));
    this.exportedKwh += exp * dt / 3600; this.earned += exp * dt / 3600 * this.def.exportPrice;
    Object.assign(F, { renew, wind, solar, diesel, battIn, battOut, export: exp, demand, served: demand - unmet, unmet, loads: want });
    this.wear(dt, true);
    return exp * dt / 3600 * this.def.exportPrice;      // money earned this tick
  }
  act(id, wallet) {
    if (id.startsWith('brk-')) { const k = id.slice(4); this.breakers[k] = !this.breakers[k]; this.note(`Breaker ${k} ${this.breakers[k] ? 'closed' : 'opened'}`); return { msg: `${k[0].toUpperCase() + k.slice(1)} circuit ${this.breakers[k] ? 'on' : 'off'}` }; }
    if (id === 'main') { if (!this.mainTripped) return { msg: 'Main breaker is closed' }; this.mainTripped = false; this.note('Main breaker reset'); return { msg: 'Main breaker reset' }; }
    if (id === 'auto') { this.autoDiesel = !this.autoDiesel; this.note(`Diesel auto-start ${this.autoDiesel ? 'on' : 'off'}`); return { msg: `Diesel auto-start ${this.autoDiesel ? 'on' : 'off'}` }; }
    return super.act(id, wallet);
  }
  panel() {
    const L = this.level, F = this.flows, socP = this.soc / L.batteryKwh;
    const names = { pump: 'Pump jack', charger: 'Drone charger', lights: 'Yard lights', line: 'Processing line' };
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', this.def.type], ['Status', this.reason()], ['Generating', f1(F.renew + F.diesel) + ' kW'], ['Load', f1(F.served) + ' kW'], ['Battery', Math.round(socP * 100) + '%'], ['Sold to the utility', money(this.earned)], ['Level', lv(this)]],
        performance: [['Wind', f2(F.wind) + ' kW'], ['Solar', f2(F.solar) + ' kW'], ['Diesel', f2(F.diesel) + ' kW'], ['Battery charging', f2(F.battIn) + ' kW'], ['Battery supplying', f2(F.battOut) + ' kW'], ['Exporting', f2(F.export) + ' kW'], ['Demand', f2(F.demand) + ' kW'], ['Unmet (shed)', f2(F.unmet) + ' kW'], ['Exported in total', f2(this.exportedKwh) + ' kWh'], ['Export price', '$' + this.def.exportPrice + '/kWh']],
        resources: [['Battery', `${f1(this.soc)} of ${L.batteryKwh} kWh`], ['Battery power limit', L.batteryKw + ' kW'], ['Main breaker rating', L.panelKw + ' kW'], ...LOAD_ORDER.map((k) => [names[k], `${this.breakers[k] ? (this.powered[k] ? 'On' : 'Shed') : 'Off'} · ${f2((F.loads || {})[k] || 0)} kW`])],
        upgrades: this.upgradeTab((a, b) => [`Battery ${a.batteryKwh} -> ${b.batteryKwh} kWh`, `Battery power ${a.batteryKw} -> ${b.batteryKw} kW`, `Main breaker ${a.panelKw} -> ${b.panelKw} kW`]),
        operation: { rows: [['State', this.reason()], ['Main breaker', this.mainTripped ? 'Tripped' : 'Closed'], ['Diesel auto-start', this.autoDiesel ? 'On' : 'Off'], ['Shed order', 'Lights, line, charger, pump'], ['Maintenance', this.maint()]], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Generating', v: f1(F.renew + F.diesel) + ' kW' }, { k: 'Load', v: f1(F.served) + ' kW' }, { k: 'Battery', v: Math.round(socP * 100) + '%', f: socP, c: 'var(--ok)' }, { k: 'Diesel', v: f1(F.diesel) + ' kW' }, { k: 'Export', v: f1(F.export) + ' kW' }, { k: 'Earned', v: money(this.earned) }],
      actions: [
        ...LOAD_ORDER.slice().reverse().map((k) => ({ id: 'brk-' + k, label: `${names[k]}: ${this.breakers[k] ? 'on' : 'off'}` })),
        { id: 'auto', label: `Diesel auto: ${this.autoDiesel ? 'on' : 'off'}` },
        { id: 'main', label: 'Reset main breaker', disabled: !this.mainTripped, primary: this.mainTripped },
        ...standardActions(this).slice(2)
      ]
    });
  }
}


// ---------------------------------------------------------------------------
// Crop field: plants grow when the soil is wet (the drone waters it), are harvested into the line's bin, then replanted.
export const CROPS = {
  radish:    { name: 'Radish',    growHours: 3.5, value: 0.9, plantsPerItem: 5, density: 1 },
  carrot:    { name: 'Carrot',    growHours: 4.5, value: 1.0, plantsPerItem: 5, density: 1 },
  potato:    { name: 'Potato',    growHours: 5,   value: 1.2, plantsPerItem: 3, density: 0.5 },
  tomato:    { name: 'Tomato',    growHours: 5.5, value: 1.6, plantsPerItem: 2, density: 0.5 },
  lettuce:   { name: 'Lettuce',   growHours: 3,   value: 1.4, plantsPerItem: 2, density: 0.5 },
  cabbage:   { name: 'Cabbage',   growHours: 6,   value: 3.2, plantsPerItem: 2, density: 0.5 },
  wheat:     { name: 'Wheat',     growHours: 5.5, value: 1.8, plantsPerItem: 8, density: 1, grain: 'flour' },
  rice:      { name: 'Rice',      growHours: 6,   value: 2.0, plantsPerItem: 8, density: 1 },
  corn:      { name: 'Corn',      growHours: 7,   value: 1.6, plantsPerItem: 2, density: 0.5, grain: 'cornmeal' },
  cotton:    { name: 'Cotton',    growHours: 7,   value: 2.6, plantsPerItem: 3, density: 0.5 },
  sunflower: { name: 'Sunflower', growHours: 6.5, value: 2.2, plantsPerItem: 1, density: 0.25 },
  soybean:   { name: 'Soybean',   growHours: 5,   value: 1.3, plantsPerItem: 3, density: 0.5 },
  berry:     { name: 'Strawberry', growHours: 4,  value: 2.4, plantsPerItem: 2, density: 0.5 },
  pumpkin:   { name: 'Pumpkin',   growHours: 8,   value: 8.0, plantsPerItem: 1, density: 0.25 },
  eggplant:  { name: 'Eggplant',  growHours: 5.5, value: 2.0, plantsPerItem: 2, density: 0.5 },
  pepper:    { name: 'Chilli pepper', growHours: 5, value: 1.8, plantsPerItem: 3, density: 0.5 },
  grape:     { name: 'Grape',     growHours: 7,   value: 3.0, plantsPerItem: 2, density: 0.25 },
  garlic:    { name: 'Garlic',    growHours: 4.5, value: 1.1, plantsPerItem: 4, density: 1 },
  beet:      { name: 'Beetroot',  growHours: 4.5, value: 1.2, plantsPerItem: 3, density: 0.5 }
};
// Plant states: 'growing' (g 0..1, stages by g), 'stubble' (harvested), 'tilled' (plowed, ready to seed).
export class FieldSim {
  constructor(F) {
    this.def = { id: 'field', name: 'Crop Field', short: 'Field', model: 'Field 1', brand: 'Fieldworks Farm', category: 'Agriculture', levels: [{ level: 1, cost: 0, parts: [] }] };
    this.F = F; this.crop = 'radish'; this.next = 'radish'; this.time = 0; this.log = []; this.harvested = 0; this.autoFarm = true; this.levelIndex = 0; this.seedCost = 0.02;
    const W = F.x1 - F.x0, D = F.z1 - F.z0, rows = Math.round(D / 0.5), per = Math.floor(W / 0.36);
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    this.plants = [];
    for (let j = 0; j < rows; j++) for (let k = 0; k < per; k++) this.plants.push({ x: F.x0 + (k + 0.5) * W / per + (r() - 0.5) * 0.06, z: F.z0 + (j + 0.5) * D / rows + (r() - 0.5) * 0.05, row: j, col: k, g: 0.55 + r() * 0.5, state: 'growing', wet: 0.5 + r() * 0.2, shade: r(), rot: r() * 6.28, size: 0.85 + r() * 0.35 });
    this.applyDensity(); this.pending = 0;
  }
  get level() { return this.def.levels[0]; }
  note(t) { this.log.unshift({ t: this.time, text: t }); this.log.length = Math.min(this.log.length, 12); }
  applyDensity() { const d = CROPS[this.crop].density; this.plants.forEach((p) => { p.use = d >= 1 || (d >= 0.5 ? p.col % 2 === 0 : p.col % 2 === 0 && p.row % 2 === 0); }); this.used = this.plants.filter((p) => p.use); }
  // the crop in the ground stays until the field is sown again; setCrop picks the next sowing
  setCrop(key) { if (!CROPS[key] || key === this.next) return false; this.next = key; this.note(`Next sowing: ${CROPS[key].name.toLowerCase()}`); return true; }
  sowNext() { if (this.crop !== this.next) { this.crop = this.next; this.applyDensity(); } }
  frac(fn) { return this.used.filter(fn).length / this.used.length; }
  wetness() { let a = 0; this.plants.forEach((p) => { a += Math.min(1, p.wet); }); return a / this.plants.length; }
  ripe() { return this.frac((p) => p.state === 'growing' && p.g >= 1); }
  stubble() { return this.frac((p) => p.state === 'stubble'); }
  tilled() { return this.frac((p) => p.state === 'tilled'); }
  growth() { return this.used.reduce((a, p) => a + (p.state === 'growing' ? Math.min(1, p.g) : 0), 0) / this.used.length; }
  stageOf(p) { if (p.state === 'tilled') return -1; if (p.state === 'stubble') return 6; return p.g >= 1 ? 5 : p.g >= 0.72 ? 4 : p.g >= 0.45 ? 3 : p.g >= 0.22 ? 2 : p.g >= 0.06 ? 1 : 0; }
  status() { return this.wetness() < 0.25 && this.frac((p) => p.state === 'growing') > 0.5 ? 'waiting' : 'running'; }
  reason() {
    const C = CROPS[this.crop];
    if (this.ripe() > 0.9) return `${C.name} ready to harvest`;
    if (this.stubble() > 0.5) return 'Harvested - needs plowing';
    if (this.tilled() > 0.5) return 'Plowed - ready to sow';
    if (this.wetness() < 0.25) return 'Soil too dry - growth has almost stopped';
    return `${C.name} growing (${Math.round(this.growth() * 100)}%)`;
  }
  tick(dt, dronePos, swath, spraying) {
    this.time += dt;
    const C = CROPS[this.crop], k = dt / (3 * 3600), grow = dt / (C.growHours * 3600);
    this.plants.forEach((p) => {
      p.wet = Math.max(0, p.wet - k);
      if (spraying && Math.abs(p.z - dronePos.z) < swath / 2 && Math.abs(p.x - dronePos.x) < 0.5) p.wet = 1;
      if (p.use && p.state === 'growing' && p.g < 1) p.g = Math.min(1, p.g + grow * (p.wet > 0.25 ? 1 : 0.08));
    });
  }
  // work a strip (from a to b, width w) with an implement. Returns items harvested.
  work(op, ax, az, bx, bz, w) {
    if (op === 'seed') this.sowNext();
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6; let n = 0;
    this.plants.forEach((p) => {
      const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L2)), qx = ax + dx * t, qz = az + dz * t;
      if ((p.x - qx) * (p.x - qx) + (p.z - qz) * (p.z - qz) > (w / 2) * (w / 2)) return;
      if (op === 'plow' && p.state !== 'tilled') { p.state = 'tilled'; p.g = 0; }
      else if (op === 'seed' && p.state === 'tilled') { p.state = 'growing'; p.g = 0; }
      else if (op === 'harvest' && p.use && p.state === 'growing' && p.g >= 1) { p.state = 'stubble'; n++; }
    });
    this.pending += n / CROPS[this.crop].plantsPerItem;
    const items = Math.floor(this.pending); this.pending -= items; this.harvested += items;
    return items;
  }
  // instant actions for when the tractor is busy or switched off
  harvest() { const ripe = this.used.filter((p) => p.state === 'growing' && p.g >= 1); if (!ripe.length) return 0; ripe.forEach((p) => { p.state = 'stubble'; }); const n = Math.max(1, Math.round(ripe.length / CROPS[this.crop].plantsPerItem)); this.harvested += n; this.note(`Hand-harvested ${n} ${CROPS[this.crop].name.toLowerCase()}`); return n; }
  replant() { this.sowNext(); let n = 0; this.plants.forEach((p) => { if (p.state !== 'growing') { p.state = 'growing'; p.g = 0; n++; } }); this.note(`Replanted by hand with ${CROPS[this.crop].name.toLowerCase()}`); return n; }
  panel() {
    const C = CROPS[this.crop], st = [0, 0, 0, 0, 0, 0, 0], names = ['Seed', 'Sprout', 'Young', 'Growing', 'Mature', 'Ready', 'Harvested']; let tl = 0;
    this.used.forEach((p) => { const k = this.stageOf(p); if (k < 0) tl++; else st[k]++; });
    return {
      key: 'field', title: `Crop Field · ${C.name}`, sub: 'Fieldworks Farm · Agriculture', status: this.status(), reason: this.reason(),
      tabs: {
        overview: [['Crop', C.name], ['Next sowing', CROPS[this.next].name], ['Status', this.reason()], ['Growth', Math.round(this.growth() * 100) + '%'], ['Ready', Math.round(this.ripe() * 100) + '%'], ['Soil moisture', Math.round(this.wetness() * 100) + '%'], ['Harvested so far', this.harvested + ' items']],
        performance: [['Plants', this.used.length], ...names.map((n, i) => [n, st[i]]), ['Plowed, not sown', tl], ['Time to grow', C.growHours + ' h with wet soil'], ['Dry soil', 'Growth slows to 8%']],
        resources: [['Water', 'Sprayed by the drone'], ['Value per item', '$' + C.value.toFixed(2) + ' washed and packed'], ['Plants per item', C.plantsPerItem], ['Mill product', C.grain ? C.grain : 'none']],
        upgrades: { rows: [['Current level', '1 of 1'], ['Next level', 'Not in this demo']], gains: [] },
        operation: { rows: [['Cycle', 'Plow, sow, water, grow, harvest'], ['Auto farming', this.autoFarm ? 'On: the tractor plows, sows and harvests' : 'Off'], ['Harvest goes to', 'The line hopper (tractor harvester)']], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Growth', v: Math.round(this.growth() * 100) + '%', f: this.growth(), c: 'var(--ok)' }, { k: 'Ready', v: Math.round(this.ripe() * 100) + '%', f: this.ripe() }, { k: 'Moisture', v: Math.round(this.wetness() * 100) + '%', f: this.wetness(), c: 'var(--water)' }, { k: 'Crop', v: C.name }, { k: 'Harvested', v: this.harvested }],
      actions: [{ id: 'auto', label: `Auto farming: ${this.autoFarm ? 'on' : 'off'}`, primary: !this.autoFarm }, { id: 'harvest', label: 'Hand harvest', disabled: this.ripe() <= 0 }, { id: 'replant', label: 'Hand replant' }, ...Object.keys(CROPS).map((k) => ({ id: 'crop-' + k, label: (k === this.next ? 'Next: ' : '') + CROPS[k].name, disabled: k === this.next }))]
    };
  }
}

// ---------------------------------------------------------------------------
// Tractor: drives real jobs on the field with a hitched implement (plow, seeder, harvester).
// The page provides the route geometry: slots where implements are parked, the field gate, and the unload point.
export const TRACTOR_DEF = {
  id: 'tractor', name: 'Tractor', short: 'Tractor', type: 'Tractor with three-point hitch', brand: 'Fieldworks Motors', model: 'FW-T120', category: 'Vehicles',
  levels: [
    { level: 1, speed: 3.0, hp: 120, cost: 0, parts: [] },
    { level: 2, speed: 3.8, hp: 150, cost: 7000, parts: ['Turbocharger', 'Wider tyres'] },
    { level: 3, speed: 4.6, hp: 200, cost: 14000, parts: ['200 hp engine', 'GPS auto-steer'] }
  ],
  fuelL: 180, workLph: 14, driveLph: 6, binCap: 260, cartCap: 600, augerPerS: 25, unloadPerS: 15, wearPerHour: 2, repairCostPerPct: 20, fuelPrice: 1.6, width: 2.0, toolOffset: 2.6
};
export class TractorSim extends Unit {
  constructor(layout) {
    super(TRACTOR_DEF);
    this.L = layout; this.fuel = TRACTOR_DEF.fuelL * 0.8;
    this.pos = { x: layout.park.x, z: layout.park.z }; this.heading = layout.park.heading; this.vel = 0;
    this.implement = null; this.state = 'parked'; this.job = null; this.route = []; this.bin = 0; this.cart = 0; this.tip = 0; this.tipPhase = 0; this.augering = false; this.worked = 0; this.wheelRot = 0; this.toolDown = false;
  }
  status() { if (!this.on) return 'off'; if (this.fault) return 'stopped'; if (this.fuel <= 0) return 'stopped'; return this.state === 'parked' ? 'waiting' : 'running'; }
  reason() {
    if (!this.on) return 'Engine off'; if (this.fuel <= 0) return 'Out of fuel'; if (this.fault) return this.fault.text;
    if (this.state === 'parked') return this.implement ? `Parked with the ${this.implement}` : 'Parked';
    return this.stepLabel || 'Driving';
  }
  // build the route for a job: fetch implement, drive lanes, (unload), return implement
  startJob(job, field) {
    if (this.state !== 'parked') return false;
    const L = this.L, imp = { plow: 'plow', seed: 'seeder', harvest: 'harvester' }[job], F = field.F, R = [];
    const slot = L.slots[imp];
    if (this.implement && this.implement !== imp) { const s0 = L.slots[this.implement]; R.push({ x: s0.x + 3.6, z: s0.z, face: Math.PI / 2, label: `Returning the ${this.implement}` }, { x: s0.x + L.hitchBack, z: s0.z, reverse: true, label: `Parking the ${this.implement}` }, { detach: true }); }
    if (this.implement !== imp) { R.push({ x: slot.x + 3.6, z: slot.z, face: Math.PI / 2, label: `Going to the ${imp}` }, { x: slot.x + L.hitchBack, z: slot.z, reverse: true, label: `Backing up to the ${imp}` }, { attach: imp }); }
    R.push({ x: L.gate.x + 1.2, z: L.gate.z, label: 'Entering the field' });
    const lanes = Math.round((F.z1 - F.z0) / TRACTOR_DEF.width);
    for (let i = 0; i < lanes; i++) {
      const z = F.z0 + (i + 0.5) * (F.z1 - F.z0) / lanes, a = i % 2 ? F.x1 : F.x0, b = i % 2 ? F.x0 : F.x1;
      R.push({ x: a, z, label: `Lane ${i + 1} of ${lanes}`, tool: false }, { x: b, z, work: job, label: `${{ plow: 'Plowing', seed: 'Sowing', harvest: 'Harvesting' }[job]} lane ${i + 1} of ${lanes}` });
    }
    R.push({ x: F.x0 + 0.6, z: L.gate.z, label: 'Leaving the field' }, { x: L.gate.x - 1.0, z: L.gate.z, label: 'Leaving the field' });
    const park = (name, label) => { const sl = L.slots[name]; R.push({ x: sl.x + 3.6, z: sl.z, face: Math.PI / 2, label: label || `Returning the ${name}` }, { x: sl.x + L.hitchBack, z: sl.z, reverse: true, label: `Parking the ${name}` }, { detach: true }); };
    if (job === 'harvest') {
      // harvester -> parked beside the trailer -> auger the crop across -> haul the trailer to the hopper and tip it
      park('harvester'); R.push({ transfer: true, label: 'Augering the harvest into the trailer' });
      const ts = L.slots.trailer;
      R.push({ x: ts.x + 3.6, z: ts.z, face: Math.PI / 2, label: 'Going to the trailer' }, { x: ts.x + L.hitchBack, z: ts.z, reverse: true, label: 'Backing up to the trailer' }, { attach: 'trailer' });
      L.haul.forEach((p, i) => R.push({ x: p.x, z: p.z, label: 'Hauling to the hopper' }));
      R.push({ tip: true, label: 'Tipping into the hopper' });
      park('trailer', 'Taking the trailer back');
    } else park(imp);
    R.push({ park: true });
    this.route = R; this.job = job; this.state = 'driving'; this.worked = 0; this.note(`Job started: ${job}`);
    return true;
  }
  // field: FieldSim, cb: { attach(name), detach(name), unload(n) -> accepted }
  tick(dt, field, cb) {
    this.time += dt; const D = this.def;
    if (this.state === 'parked' || !this.on || this.fuel <= 0 || this.fault) { this.vel = 0; this.toolDown = false; return; }
    const step = this.route[0]; if (!step) { this.state = 'parked'; return; }
    this.stepLabel = step.label || this.stepLabel;
    if (step.attach) { this.implement = step.attach; cb.attach(step.attach); this.note(`Hitched the ${step.attach}`); this.route.shift(); return; }
    if (step.detach) { cb.detach(this.implement); this.note(`Unhitched the ${this.implement}`); this.implement = null; this.route.shift(); return; }
    if (step.park) { this.state = 'parked'; this.job = null; this.route.shift(); this.note('Job finished'); return; }
    if (step.transfer) {   // harvester bin -> trailer by auger
      this.augering = this.bin > 0; const n = Math.min(this.bin, Math.ceil(D.augerPerS * dt)); this.bin -= n; this.cart = Math.min(D.cartCap, this.cart + n); this.vel = 0;
      if (this.bin <= 0) { this.augering = false; this.route.shift(); this.note(`Trailer loaded: ${this.cart} items`); } return;
    }
    if (step.tip) {        // raise the bed, empty it into the hopper, lower it again
      this.vel = 0;
      if (this.tipPhase === 0) { this.tip = Math.min(1, this.tip + dt / 2.5); if (this.tip >= 1) this.tipPhase = 1; return; }
      if (this.tipPhase === 1) { const n = Math.min(this.cart, Math.ceil(D.unloadPerS * dt)), took = cb.unload(n); this.cart -= took; step.wait = took ? 0 : (step.wait || 0) + dt; if (this.cart <= 0 || step.wait > 8) { this.tipPhase = 2; if (this.cart > 0) this.note('Hopper full: kept the rest in the trailer'); } return; }
      this.tip = Math.max(0, this.tip - dt / 2); if (this.tip <= 0) { this.tipPhase = 0; this.route.shift(); this.note('Trailer emptied into the hopper'); } return;
    }
    if (step.unload) { const n = Math.min(this.bin, Math.ceil(D.unloadPerS * dt)); const took = cb.unload(n); this.bin -= took; this.vel = 0; if (this.bin <= 0 || took === 0 && n > 0 && this.bin > 0 && (step.wait = (step.wait || 0) + dt) > 8) this.route.shift(); return; }
    const sp = this.level.speed * this.efficiency() * (step.reverse ? 0.45 : step.work ? 1 : 1.4);
    const dx = step.x - this.pos.x, dz = step.z - this.pos.z, d = Math.hypot(dx, dz), mv = Math.min(d, sp * dt);
    const ax = this.pos.x - Math.sin(this.heading) * D.toolOffset, az = this.pos.z - Math.cos(this.heading) * D.toolOffset;
    if (d > 1e-4) {
      this.pos.x += dx / d * mv; this.pos.z += dz / d * mv;
      if (!step.reverse && d > 0.05) { const want = Math.atan2(dx, dz); let e = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)); this.heading += Math.sign(e) * Math.min(Math.abs(e), dt * 1.6); }
    }
    this.vel = mv / Math.max(dt, 1e-6) * (step.reverse ? -1 : 1);
    this.wheelRot += this.vel * dt;
    this.toolDown = !!step.work;
    if (step.work) {
      const bx = this.pos.x - Math.sin(this.heading) * D.toolOffset, bz = this.pos.z - Math.cos(this.heading) * D.toolOffset;
      const got = field.work(step.work, ax, az, this.pos.x, this.pos.z, D.width);   // the strip from the tool back to the tractor
      if (step.work === 'harvest') this.bin = Math.min(D.binCap, this.bin + got);
      this.worked += mv; void bx; void bz;
    }
    const lph = step.work ? D.workLph : D.driveLph; this.fuel = Math.max(0, this.fuel - lph * dt / 3600);
    if (this.fuel <= 0) this.note('Out of fuel');
    this.wear(dt, true);
    if (d - mv < 0.03) {
      // line up before backing onto a hitch: turn on the spot (a tight shuffle) until the heading matches
      if (step.face !== undefined) { const e = Math.atan2(Math.sin(step.face - this.heading), Math.cos(step.face - this.heading)); if (Math.abs(e) > 0.01) { this.heading += Math.sign(e) * Math.min(Math.abs(e), dt * 1.2); this.stepLabel = 'Lining up with the hitch'; return; } this.heading = step.face; }
      this.route.shift();
    }
  }
  refuelCost() { return Math.ceil((this.def.fuelL - this.fuel) * this.def.fuelPrice); }
  act(id, wallet, field) {
    if (['plow', 'seed', 'harvest'].includes(id)) { if (!this.startJob(id, field)) return { msg: 'The tractor is busy' }; return { msg: `Tractor: ${id} job started` }; }
    if (id === 'refuel') { const c = this.refuelCost(); if (!c) return { msg: 'Tank already full' }; if (c > wallet) return { msg: `Filling up costs ${money(c)}` }; this.fuel = this.def.fuelL; this.note('Refuelled'); return { cost: c, msg: `Refuelled for ${money(c)}` }; }
    return super.act(id, wallet);
  }
  panel() {
    const L = this.level, D = this.def;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', D.type], ['Status', this.reason()], ['Implement', this.implement || 'None'], ['Job', this.job || 'None'], ['Fuel', `${this.fuel.toFixed(1)} of ${D.fuelL} L`], ['Harvest bin', `${this.bin} of ${D.binCap} items`], ['Trailer load', `${this.cart} of ${D.cartCap} items`], ['Level', `${L.level} of ${D.levels.length}`]],
        performance: [['Engine', L.hp + ' hp'], ['Speed', Math.abs(this.vel).toFixed(1) + ' m/s'], ['Working width', D.width + ' m'], ['Distance worked', Math.round(this.worked) + ' m'], ['Fuel use', (this.toolDown ? D.workLph : this.vel ? D.driveLph : 0) + ' L/h'], ['Efficiency', Math.round(this.efficiency() * 100) + '%'], ['Hours', this.hours.toFixed(2) + ' h']],
        resources: [['Fuel', 'Diesel'], ['Refuel cost', money(this.refuelCost())], ['Hitch', 'Three-point, category 2'], ['Implements', 'Plow, seeder, harvester, tipping trailer']],
        upgrades: this.upgradeTab((a, b) => [`Engine ${a.hp} -> ${b.hp} hp`, `Working speed ${a.speed} -> ${b.speed} m/s`]),
        operation: { rows: [['Current step', this.reason()], ['Steps left', this.route.length], ['Fault', this.fault ? this.fault.text : 'None'], ['Maintenance', this.maint()]], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Fuel', v: Math.round(this.fuel) + ' L', f: this.fuel / D.fuelL, c: 'var(--accent)' }, { k: 'Speed', v: Math.abs(this.vel).toFixed(1) + ' m/s' }, { k: 'Implement', v: this.implement || '–' }, { k: 'Bin', v: this.bin, f: this.bin / D.binCap }, { k: 'Trailer', v: this.cart, f: this.cart / D.cartCap }, { k: 'Job', v: this.job || '–' }, this.condStat()],
      actions: [{ id: 'plow', label: 'Plow', disabled: this.state !== 'parked' }, { id: 'seed', label: 'Sow', disabled: this.state !== 'parked' }, { id: 'harvest', label: 'Harvest', disabled: this.state !== 'parked' }, { id: 'refuel', label: `Refuel ${money(this.refuelCost())}` }, ...standardActions(this).slice(1)]
    });
  }
}

// ---------------------------------------------------------------------------
// Food production chain: grain diverted at the sorter -> cross conveyor -> mill (wheat to flour, corn to cornmeal)
// -> oven (flour to bread) -> bagger (4 per crate) -> pallet (sold when full). Every station holds real items.
export const CHAIN_DEF = {
  id: 'chain', name: 'Food Production', short: 'Food line', type: 'Mill, oven and bagger', brand: 'Fieldworks Processing', model: 'FW-FP2', category: 'Processing',
  levels: [{ level: 1, millS: 4, bakeS: 10, cost: 0, parts: [] }, { level: 2, millS: 3, bakeS: 7, cost: 8000, parts: ['Steel rollers', 'Second heating zone'] }, { level: 3, millS: 2, bakeS: 5, cost: 16000, parts: ['Twin mill', 'Convection oven'] }],
  belt: 0.4, gap: 0.5, lengths: { cross: 3.4, milled: 2.6, baked: 2.2 }, millIn: 2, packN: 4, palletCrates: 12,
  value: { flour: 6, cornmeal: 5, bread: 11 }, kw: { mill: 4, oven: 6, bagger: 1, belts: 0.6 }, wearPerHour: 3, repairCostPerPct: 12
};
export class ChainSim extends Unit {
  constructor() { super(CHAIN_DEF); this.seg = { cross: [], milled: [], baked: [] }; this.millBuf = []; this.millT = 0; this.bagBuf = []; this.bagT = 0; this.crates = 0; this.crateValue = []; this.sold = 0; this.earned = 0; this.made = { flour: 0, cornmeal: 0, bread: 0 }; this.id = 1; this.ovenOn = false; }
  running() { return this.on && this.powered && !this.fault; }
  accept(crop) { if (this.seg.cross.length && this.seg.cross[this.seg.cross.length - 1].s < this.def.gap) return false; this.seg.cross.push({ id: this.id++, kind: crop, s: 0 }); return true; }
  busy() { return this.seg.cross.length + this.seg.milled.length + this.seg.baked.length + this.millBuf.length + this.bagBuf.length > 0 || this.millT > 0; }
  status() { if (!this.on) return 'off'; if (!this.powered || this.fault) return 'stopped'; return this.busy() ? 'running' : 'waiting'; }
  reason() { if (!this.on) return 'Switched off'; if (!this.powered) return 'No power - check the yard network'; if (this.fault) return this.fault.text; return this.busy() ? `Milling and baking (${this.made.bread} loaves so far)` : 'Waiting for wheat or corn from the sorter'; }
  powerKw() { if (!this.on || this.fault) return 0.03; const K = this.def.kw; return K.belts + (this.millT > 0 ? K.mill : 0.1) + (this.seg.milled.some((i) => i.kind === 'flour' && i.s > 0.6) ? K.oven : 0.4) + (this.bagT > 0 ? K.bagger : 0.05); }
  // speed: number or function(item) -> m/s; after(item) runs once the item has moved
  move(list, len, out, speed, dt, after) {
    for (let i = 0; i < list.length; i++) { const it = list[i], limit = i === 0 ? len : list[i - 1].s - this.def.gap, v = typeof speed === 'function' ? speed(it) : speed; it.s = Math.min(limit, it.s + v * dt); if (after) after(it); }
    while (list.length && list[0].s >= len && out(list[0])) list.shift();
  }
  tick(dt) {
    this.time += dt; const D = this.def, Lv = this.level; let earned = 0;
    if (!this.running()) return 0;
    const v = D.belt * this.efficiency();
    this.move(this.seg.cross, D.lengths.cross, (it) => { if (this.millBuf.length >= 6) return false; this.millBuf.push(it); return true; }, v, dt);
    if (this.millT > 0) { this.millT -= dt; if (this.millT <= 0) { const a = this.millBuf.splice(0, D.millIn), kind = a[0].kind === 'corn' ? 'cornmeal' : 'flour'; this.seg.milled.push({ id: this.id++, kind, s: 0 }); this.made[kind]++; } }
    else if (this.millBuf.length >= D.millIn && (!this.seg.milled.length || this.seg.milled[this.seg.milled.length - 1].s > D.gap)) this.millT = Lv.millS;
    // the oven tunnel is the second half of the milled belt: flour that passes through it comes out as bread
    const ovenStart = D.lengths.milled * 0.35, bakeV = (D.lengths.milled * 0.65) / Lv.bakeS;
    this.move(this.seg.milled, D.lengths.milled, (it) => { this.seg.baked.push({ id: this.id++, kind: it.kind, s: 0 }); return true; }, (it) => (it.kind === 'flour' && it.s >= ovenStart ? bakeV : v), dt, (it) => { if (it.kind === 'flour' && it.s >= D.lengths.milled - 0.001) { it.kind = 'bread'; this.made.bread++; } });
    this.move(this.seg.baked, D.lengths.baked, (it) => { if (this.bagBuf.length >= D.packN) return false; this.bagBuf.push(it); return true; }, v, dt);
    if (this.bagT > 0) { this.bagT -= dt; if (this.bagT <= 0) { const a = this.bagBuf.splice(0, D.packN); this.crates++; this.crateValue.push(a.reduce((s, it) => s + (D.value[it.kind] || 4), 0)); if (this.crates >= D.palletCrates) earned += this.sell(true); } }
    else if (this.bagBuf.length >= D.packN && this.crates < D.palletCrates) this.bagT = 2;
    this.energyKwh += this.powerKw() * dt / 3600; this.wear(dt, this.busy());
    return earned;
  }
  sell(auto) { if (!this.crates) return 0; const v = this.crateValue.reduce((a, b) => a + b, 0); this.note(`${auto ? 'Pallet full, sold' : 'Sold'} ${this.crates} crates for $${v.toFixed(0)}`); this.sold += this.crates; this.earned += v; this.crates = 0; this.crateValue = []; return v; }
  act(id, wallet) { if (id === 'sell') { const v = this.sell(false); return v ? { cost: -v, msg: `Crates sold for $${v.toFixed(0)}` } : { msg: 'No crates yet' }; } return super.act(id, wallet); }
  panel() {
    const L = this.level, D = this.def;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Chain', 'Wheat → flour → bread → crates · Corn → cornmeal → crates'], ['Status', this.reason()], ['Crates on the pallet', `${this.crates} of ${D.palletCrates}`], ['Sold', `${this.sold} crates, $${this.earned.toFixed(0)}`]],
        performance: [['Flour sacks milled', this.made.flour], ['Cornmeal sacks milled', this.made.cornmeal], ['Bread trays baked', this.made.bread], ['Mill time', L.millS + ' s per ' + D.millIn + ' sheaves'], ['Baking time', L.bakeS + ' s'], ['Power', this.powerKw().toFixed(1) + ' kW'], ['Energy used', this.energyKwh.toFixed(2) + ' kWh']],
        resources: [['Input', 'Wheat and corn diverted at the optical sorter'], ['Mill buffer', this.millBuf.length], ['Bagger buffer', this.bagBuf.length], ['Crate value', `bread $${D.value.bread}, flour $${D.value.flour}, cornmeal $${D.value.cornmeal} each`]],
        upgrades: this.upgradeTab((a, b) => [`Milling ${a.millS} -> ${b.millS} s`, `Baking ${a.bakeS} -> ${b.bakeS} s`]),
        operation: { rows: [['Mill', this.millT > 0 ? 'Grinding' : 'Ready'], ['Oven', this.seg.milled.some((i) => i.kind === 'flour') ? 'Baking' : 'Idle'], ['Bagger', this.bagT > 0 ? 'Packing' : 'Ready'], ['Maintenance', this.maint()]], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Flour', v: this.made.flour }, { k: 'Bread', v: this.made.bread }, { k: 'Cornmeal', v: this.made.cornmeal }, { k: 'Pallet', v: `${this.crates}/${D.palletCrates}`, f: this.crates / D.palletCrates }, { k: 'Power', v: this.powerKw().toFixed(1) + ' kW' }, { k: 'Sold', v: '$' + this.earned.toFixed(0) }],
      actions: [{ id: 'sell', label: `Sell crates (${this.crates})`, disabled: !this.crates, primary: this.crates > 0 }, { id: 'power', label: this.on ? 'Stop' : 'Start' }, ...standardActions(this).slice(1)]
    });
  }
}

// ---------------------------------------------------------------------------
// Processing line: harvest bin -> belt -> washer (uses tank water) -> cutter and sorter -> packer -> pallet -> sold.
export const LINE_DEF = {
  id: 'line', name: 'Processing Line', short: 'Processing line', type: 'Wash, sort and pack line', brand: 'Fieldworks Processing', model: 'FW-PL3', category: 'Processing',
  levels: [
    { level: 1, beltSpeed: 0.35, packSize: 4, cost: 0, parts: [] },
    { level: 2, beltSpeed: 0.5, packSize: 6, cost: 6000, parts: ['Belt motors 0.55 kW x3', 'Six-pack press head'] },
    { level: 3, beltSpeed: 0.7, packSize: 8, cost: 12000, parts: ['Belt motors 0.75 kW x3', 'Eight-pack press head', 'Optical sorter'] }
  ],
  waterPerItemL: 3, pressS: 2.4, palletBoxes: 12, gap: 0.42, wearPerHour: 4, repairCostPerPct: 10,
  zones: { wash: 4.6, cut: 8.6, pack: 12.0 }, kw: { belts: 1.1, washer: 1.1, cutter: 2.2, packer: 1.5 }
};
export class LineSim extends Unit {
  constructor() {
    super(LINE_DEF);
    this.bin = []; this.items = []; this.packBuf = []; this.pressT = 0; this.boxes = 0; this.boxValue = []; this.sold = 0; this.earned = 0;
    this.washed = 0; this.packed = 0; this.unwashed = 0; this.waterL = 0; this.idleT = 0; this.nextId = 1;
  }
  addToBin(crop, n, value) { for (let i = 0; i < n; i++) this.bin.push({ crop, value }); }
  running() { return this.on && this.powered && !this.fault; }
  status() { if (!this.on) return 'off'; if (!this.powered || this.fault) return 'stopped'; if (!this.items.length && !this.bin.length && !this.pressT) return 'waiting'; return 'running'; }
  reason() {
    if (!this.on) return 'Switched off'; if (!this.powered) return 'No power - check the yard network'; if (this.fault) return this.fault.text;
    if (this.boxes >= this.def.palletBoxes) return 'Pallet full';
    if (!this.items.length && !this.bin.length) return 'Waiting for the harvest';
    return `Processing ${this.items.length + this.packBuf.length} items`;
  }
  powerKw() {
    if (!this.on || this.fault) return 0.03;
    const K = this.def.kw, busy = this.items.length > 0 || this.bin.length > 0;
    return busy || this.pressT > 0 ? K.belts + K.washer + K.cutter + (this.pressT > 0 ? K.packer : 0.2) : 0.15;
  }
  // tank: StorageTank (washer water). Returns money earned this tick.
  tick(dt, tank) {
    this.time += dt; const D = this.def, Lv = this.level, Z = D.zones;
    let earned = 0;
    if (!this.running()) return 0;
    const v = Lv.beltSpeed * this.efficiency();
    // feed from the bin
    if (this.bin.length && (!this.items.length || this.items[this.items.length - 1].s > D.gap + 0.05)) {
      const b = this.bin.shift(); this.items.push({ id: this.nextId++, crop: b.crop, value: b.value, s: 0, washed: false, cut: false, z: (Math.random() - 0.5) * 0.18, rot: Math.random() * 6.28 });
    }
    // move: front item first, each keeps a gap behind the one ahead; the packer holds them while pressing
    const packOpen = this.packBuf.length < Lv.packSize && this.boxes < D.palletBoxes;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i], limit = i === 0 ? (packOpen ? Z.pack + 1 : Z.pack - 0.25) : this.items[i - 1].s - D.gap;
      it.s = Math.min(limit, it.s + v * dt);
      if (!it.washed && it.s >= Z.wash && !it.tried) { it.tried = true; const got = tank ? tank.draw(D.waterPerItemL) : D.waterPerItemL; this.waterL += got; if (got >= D.waterPerItemL * 0.99) { it.washed = true; this.washed++; } else this.unwashed++; }
      if (!it.cut && it.s >= Z.cut) { it.cut = true; if (this.divert && CROPS[it.crop] && CROPS[it.crop].grain && this.divert(it.crop)) { it.diverted = true; this.toChain = (this.toChain || 0) + 1; } }
    }
    this.items = this.items.filter((it) => !it.diverted);
    while (this.items.length && this.items[0].s >= Z.pack) this.packBuf.push(this.items.shift());
    // press
    if (this.pressT > 0) {
      this.pressT -= dt;
      if (this.pressT <= 0) {
        this.pressT = 0;
        const val = this.packBuf.splice(0, Lv.packSize).reduce((a, it) => a + it.value * (it.washed ? 1 : 0.6) * (it.cut ? 1.25 : 1), 0);
        this.boxes++; this.boxValue.push(val); this.packed++;
        if (this.boxes >= D.palletBoxes) earned += this.sellPallet(true);
      }
    } else if (this.packBuf.length >= Lv.packSize && this.boxes < D.palletBoxes) this.pressT = D.pressS;
    else if (this.packBuf.length && !this.items.length && !this.bin.length) { this.idleT += dt; if (this.idleT > 6) { this.pressT = D.pressS; this.idleT = 0; } }
    this.energyKwh += this.powerKw() * dt / 3600;
    this.wear(dt, true);
    return earned;
  }
  sellPallet(auto) {
    if (!this.boxes) return 0;
    const v = this.boxValue.reduce((a, b) => a + b, 0) * 1.0;
    this.note(`${auto ? 'Pallet full, sold' : 'Sold'} ${this.boxes} boxes for $${v.toFixed(0)}`);
    this.sold += this.boxes; this.earned += v; this.boxes = 0; this.boxValue = [];
    return v;
  }
  act(id, wallet) {
    if (id === 'sell') { const v = this.sellPallet(false); return v ? { cost: -v, msg: `Pallet sold for $${v.toFixed(0)}` } : { msg: 'No boxes on the pallet yet' }; }
    return super.act(id, wallet);
  }
  panel() {
    const L = this.level, D = this.def, pal = this.boxes / D.palletBoxes;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', D.type], ['Status', this.reason()], ['In the bin', this.bin.length + ' items'], ['On the belt', this.items.length + ' items'], ['Boxes on the pallet', `${this.boxes} of ${D.palletBoxes}`], ['Sold', `${this.sold} boxes, $${this.earned.toFixed(0)}`], ['Level', `${L.level} of ${D.levels.length}`]],
        performance: [['Belt speed', (L.beltSpeed * this.efficiency()).toFixed(2) + ' m/s'], ['Power', this.powerKw().toFixed(2) + ' kW'], ['Washed', this.washed], ['Not washed (no water)', this.unwashed], ['Boxes packed', this.packed], ['Items per box', L.packSize], ['Water used', Math.round(this.waterL) + ' L'], ['Energy used', this.energyKwh.toFixed(2) + ' kWh'], ['Efficiency', Math.round(this.efficiency() * 100) + '%']],
        resources: [['Water', D.waterPerItemL + ' L per item from the storage tank'], ['Power', 'Processing line circuit'], ['Washed and sorted', 'Full price, +25% for sorting'], ['Unwashed', '60% of the price']],
        upgrades: this.upgradeTab((a, b) => [`Belt ${a.beltSpeed} -> ${b.beltSpeed} m/s`, `Box ${a.packSize} -> ${b.packSize} items`]),
        operation: { rows: [['Current task', this.reason()], ['Press', this.pressT > 0 ? 'Packing' : 'Ready'], ['Fault', this.fault ? this.fault.text : 'None'], ['Maintenance', this.maint()], ['Service cost', money(this.repairCost())]], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Bin', v: this.bin.length }, { k: 'On belt', v: this.items.length }, { k: 'Pallet', v: `${this.boxes}/${D.palletBoxes}`, f: pal }, { k: 'Power', v: this.powerKw().toFixed(1) + ' kW' }, { k: 'Sold', v: '$' + this.earned.toFixed(0) }, this.condStat()],
      actions: [{ id: 'sell', label: `Sell pallet (${this.boxes})`, disabled: !this.boxes, primary: this.boxes > 0 }, { id: 'power', label: this.on ? 'Stop line' : 'Start line' }, ...standardActions(this).slice(1)]
    });
  }
}
