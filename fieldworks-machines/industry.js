// Fieldworks advanced systems: the bio-recovery digester, the soil steward with its field rover, and the
// programmable logic controller. They close a loop through the farm: soil sets crop quality, the optical sorter
// rejects grade C produce, the digester turns rejects into biogas (power for the yard) and digestate (liquid
// fertiliser), the steward samples the soil and sends the rover to feed the zones that need it. The controller
// runs the player's rules over every machine that is wired to it. Panels and screens read panel().

import { Unit, CROPS, ZONES } from './sims.js';
import { standardActions, money } from './machine.js';

const f1 = (n) => n.toFixed(1), pc = (f) => Math.round(f * 100) + '%';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// biomass per reject item (kg): bulky crops carry more into the digester
const KG = { pumpkin: 6, cabbage: 2.5, corn: 1.2, wheat: 0.8, sunflower: 1.5, grape: 1, potato: 1.2 };

// ---------------------------------------------------------------------------
export const DIGESTER_DEF = {
  id: 'digester', name: 'Bio-Recovery Digester', short: 'Digester', type: 'Shredder, heated digester and biogas engine', brand: 'Fieldworks Recovery', model: 'FW-BRD1', category: 'Recovery',
  levels: [
    { level: 1, capKg: 400, gasCapM3: 10, chpKw: 3, cost: 0, parts: [] },
    { level: 2, capKg: 700, gasCapM3: 16, chpKw: 5, cost: 9000, parts: ['Second digester ring', 'Larger gas membrane', '5 kW engine'] }
  ],
  augerS: 5, gasPerKg: 0.2, digestatePerKg: 2.5, m3PerKwh: 0.55, targetC: 38, digestateCapL: 600, pumpLpm: 12,
  wearPerHour: 1.2, repairCostPerPct: 14
};
export class DigesterSim extends Unit {
  constructor() {
    super(DIGESTER_DEF);
    this.queue = []; this.augerT = 0; this.shredT = 0; this.massKg = 70; this.gasM3 = 3; this.tempC = 36; this.digestateL = 180; this.mode = 'auto'; this.force = null;
    this.chpOn = false; this.output = 0; this.flaring = false; this.fedKg = 0; this.gasMade = 0; this.kwhMade = 0; this.pumpedL = 0; this.flowLpm = 0; this.pumpOn = false;
  }
  accept(crop) { this.queue.push(crop); }
  running() { return this.on && !this.fault; }
  gasFrac() { return this.gasM3 / this.level.gasCapM3; }
  status() { if (!this.on) return 'off'; if (this.fault) return 'stopped'; if (this.tempC < 30 || this.massKg < 20) return 'waiting'; return 'running'; }
  reason() {
    if (!this.on) return 'Switched off'; if (this.fault) return this.fault.text;
    if (this.massKg < 20) return 'Almost empty: waiting for rejects from the sorter';
    if (this.tempC < 30) return `Too cold (${Math.round(this.tempC)} °C): gas production is slow`;
    if (this.flaring) return 'Gas holder full: flaring the surplus';
    if (this.chpOn) return `Biogas engine making ${f1(this.output)} kW`;
    return `Digesting ${Math.round(this.massKg)} kg, gas holder ${pc(this.gasFrac())}`;
  }
  // airC: outside temperature. dest: the steward's tank ({ room() -> L, fill(L) }). Returns kW sent to the grid.
  tick(dt, airC, dest) {
    this.time += dt; const D = this.def, L = this.level, h = dt / 3600;
    if (!this.running()) { this.output = 0; this.chpOn = false; this.flowLpm = 0; this.tempC += (airC - this.tempC) * h * 0.3; return 0; }
    // auger lifts one reject at a time from the tote into the twin-shaft shredder
    if (this.augerT > 0) { this.augerT -= dt; if (this.augerT <= 0) { const c = this.queue.shift(), kg = KG[c] || 1; if (this.massKg + kg <= L.capKg) { this.massKg += kg; this.fedKg += kg; this.shredT = 1.5; } else this.queue.unshift(c); } }
    else if (this.queue.length && this.massKg < L.capKg - 6) this.augerT = D.augerS;
    if (this.shredT > 0) this.shredT -= dt;
    // the bacteria work best at 38 °C: below 30 °C they slow right down
    const tf = clamp((this.tempC - 18) / (D.targetC - 18), 0.05, 1.1);
    const digested = Math.min(this.massKg, this.massKg * 0.08 * tf * h);
    this.massKg -= digested; const gas = digested * D.gasPerKg; this.gasM3 += gas; this.gasMade += gas;
    this.digestateL = Math.min(D.digestateCapL, this.digestateL + digested * D.digestatePerKg);
    // biogas engine: auto runs it when the holder is over 35% (until 10%), a rule can force it on or off
    const want = this.force === 'run' ? this.gasM3 > 0.2 : this.force === 'stop' ? false : this.mode === 'on' ? this.gasM3 > 0.2 : this.mode === 'off' ? false : this.chpOn ? this.gasFrac() > 0.1 : this.gasFrac() > 0.35;
    this.chpOn = want;
    const burn = this.chpOn ? Math.min(this.gasM3, L.chpKw * D.m3PerKwh * h) : 0;
    this.gasM3 -= burn; this.output = this.chpOn ? burn / (D.m3PerKwh * Math.max(h, 1e-9)) * this.efficiency() : 0; this.kwhMade += this.output * h;
    // engine heat warms the digester; without it the tank cools toward the air
    const heat = this.chpOn ? 9 * (this.output / L.chpKw) : 0;
    this.tempC += ((airC - this.tempC) * 0.25 + heat * (this.tempC < D.targetC + 2 ? 1 : 0)) * h * 2;
    this.flaring = this.gasM3 > L.gasCapM3; if (this.flaring) this.gasM3 = L.gasCapM3;
    // digestate pump: to the steward's tank through the buried pipe
    const room = dest ? dest.room() : 0; this.pumpOn = room > 1 && this.digestateL > 1;
    const q = this.pumpOn ? Math.min(D.pumpLpm * dt / 60, this.digestateL, room) : 0;
    if (q > 0) { dest.fill(q); this.digestateL -= q; this.pumpedL += q; }
    this.flowLpm = q / dt * 60;
    this.wear(dt, true);
    return this.output;
  }
  act(id, wallet) {
    if (id.startsWith('mode-')) { this.mode = id.slice(5); this.note(`Engine mode: ${this.mode}`); return { msg: `Biogas engine ${this.mode === 'auto' ? 'on automatic' : this.mode === 'on' ? 'forced on' : 'held off'}` }; }
    return super.act(id, wallet);
  }
  panel() {
    const D = this.def, L = this.level;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', D.type], ['Status', this.reason()], ['Feed waiting', this.queue.length + ' rejects in the tote'], ['In the digester', `${Math.round(this.massKg)} of ${L.capKg} kg`], ['Temperature', `${f1(this.tempC)} °C (best ${D.targetC} °C)`], ['Gas holder', `${f1(this.gasM3)} of ${L.gasCapM3} m³`], ['Engine', this.chpOn ? `Running, ${f1(this.output)} kW` : 'Stopped'], ['Digestate store', `${Math.round(this.digestateL)} of ${D.digestateCapL} L`]],
        performance: [['Biomass fed', f1(this.fedKg) + ' kg'], ['Biogas made', f1(this.gasMade) + ' m³'], ['Electricity made', f1(this.kwhMade) + ' kWh'], ['Digestate sent', Math.round(this.pumpedL) + ' L'], ['Pump', this.pumpOn ? `${f1(this.flowLpm)} L/min` : 'Idle'], ['Efficiency', pc(this.efficiency())]],
        resources: [['Input', 'Grade C rejects from the optical sorter'], ['Gas', `${D.gasPerKg} m³ per kg digested, ${D.m3PerKwh} m³ per kWh`], ['Heat', 'Engine waste heat keeps the tank warm'], ['Output', 'Power to the yard network, digestate to the soil steward']],
        upgrades: this.upgradeTab((a, b) => [`Digester ${a.capKg} -> ${b.capKg} kg`, `Gas holder ${a.gasCapM3} -> ${b.gasCapM3} m³`, `Engine ${a.chpKw} -> ${b.chpKw} kW`]),
        operation: { rows: [['Engine mode', this.mode + (this.force ? ` (rule: ${this.force})` : '')], ['Shredder', this.shredT > 0 ? 'Shredding' : 'Idle'], ['Flare', this.flaring ? 'Burning surplus' : 'Off'], ['Maintenance', this.maint()]], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Digester', v: Math.round(this.massKg) + ' kg', f: this.massKg / L.capKg, c: 'var(--ok)' }, { k: 'Temp', v: Math.round(this.tempC) + ' °C', f: this.tempC / 45, c: this.tempC < 30 ? 'var(--warn)' : 'var(--ok)' }, { k: 'Gas', v: pc(this.gasFrac()), f: this.gasFrac(), c: 'var(--accent)' }, { k: 'Engine', v: this.chpOn ? f1(this.output) + ' kW' : 'Off' }, { k: 'Digestate', v: Math.round(this.digestateL) + ' L', f: this.digestateL / D.digestateCapL, c: 'var(--water)' }, this.condStat()],
      actions: [{ id: 'mode-auto', label: 'Engine auto', disabled: this.mode === 'auto' }, { id: 'mode-on', label: 'Engine on', disabled: this.mode === 'on' }, { id: 'mode-off', label: 'Engine off', disabled: this.mode === 'off' }, ...standardActions(this)]
    });
  }
}

// ---------------------------------------------------------------------------
// Soil steward: a field-edge station. Its mast scans moisture over the whole field; nutrients are only known where
// the rover has pushed its probe in. It doses digestate where nitrogen is low and calls the drone when zones dry out.
export const STEWARD_DEF = {
  id: 'steward', name: 'Soil Steward', short: 'Soil steward', type: 'Adaptive field station with a straddle rover', brand: 'Fieldworks AgriTech', model: 'FW-SS1', category: 'Agriculture',
  levels: [
    { level: 1, speed: 0.75, roverTankL: 80, cost: 0, parts: [] },
    { level: 2, speed: 1.3, roverTankL: 140, cost: 7000, parts: ['Larger rover tank', 'Faster wheel motors'] }
  ],
  tankL: 500, doseL: 25, doseN: 0.2, probeS: 14, doseS: 22, staleH: 8, battKwh: 3, driveKw: 0.5, chargeKw: 1.5, fillLpm: 30, stationKw: 0.25,
  wearPerHour: 1, repairCostPerPct: 12
};
export class StewardSim extends Unit {
  constructor(geo) {
    super(STEWARD_DEF);
    // geo: { dock: {x,z}, gate: {x,z} } in world metres
    this.geo = geo; this.tankL = 200; this.auto = true; this.nTarget = 0.5; this.wetTarget = 0.35;
    const N = ZONES.nx * ZONES.nz; this.map = Array.from({ length: N }, () => ({ n: null, comp: null, t: -1e9, wet: 0 }));
    this.rover = { x: geo.dock.x, z: geo.dock.z, heading: -Math.PI / 2, vel: 0, batt: 3, tankL: 40, state: 'docked', path: [], job: null, workT: 0, probe: 0, boom: 0, log: [] };
    this.sampled = 0; this.dosedL = 0; this.doses = 0; this.requests = {}; this.lastDrone = -1e9; this.powerOk = true;
  }
  room() { return Math.max(0, this.def.tankL - this.tankL); }
  fill(L) { this.tankL = Math.min(this.def.tankL, this.tankL + L); }
  running() { return this.on && this.powered && !this.fault; }
  known(i) { return this.map[i].n !== null; }
  stale(i) { return (this.time - this.map[i].t) / 3600 > this.def.staleH; }
  status() { if (!this.on) return 'off'; if (!this.powered || this.fault) return 'stopped'; return this.rover.state === 'docked' && !this.rover.job ? 'waiting' : 'running'; }
  reason() {
    const R = this.rover;
    if (!this.on) return 'Switched off'; if (!this.powered) return 'No power - check the yard network'; if (this.fault) return this.fault.text;
    if (R.state === 'probe') return 'Rover sampling soil in zone ' + (R.job.zone + 1);
    if (R.state === 'dose') return 'Rover feeding zone ' + (R.job.zone + 1) + ' with digestate';
    if (R.state === 'drive') return R.job && R.job.kind === 'home' ? 'Rover returning to the dock' : `Rover driving to zone ${R.job.zone + 1}`;
    if (R.batt < this.def.battKwh * 0.35) return 'Rover charging';
    if (this.tankL < this.def.doseL) return 'Waiting for digestate';
    return 'Every zone checked: watching the field';
  }
  powerKw() { if (!this.on || this.fault) return 0.02; const R = this.rover; return this.def.stationKw + (R.state === 'docked' && R.batt < this.def.battKwh - 0.01 ? this.def.chargeKw : 0); }
  // choose the next job: probe stale zones first, then feed known hungry zones, nearest first
  plan(field) {
    const D = this.def, R = this.rover, from = R.job && R.job.zone !== undefined ? field.zoneCenter(R.job.zone) : { x: R.x, z: R.z };
    const dist = (i) => { const c = field.zoneCenter(i); return Math.hypot(c.x - from.x, c.z - from.z); };
    const idx = this.map.map((_, i) => i);
    const hungry = this.tankL + R.tankL >= D.doseL ? idx.filter((i) => this.known(i) && !this.stale(i) && this.map[i].n < this.nTarget) : [];
    if (this.requests.dose && hungry.length) { this.requests.dose = false; }
    if (hungry.length && R.tankL >= D.doseL) return { kind: 'dose', zone: hungry.sort((a, b) => this.map[a].n - this.map[b].n || dist(a) - dist(b))[0] };
    const stale = idx.filter((i) => this.stale(i));
    if (stale.length) return { kind: 'probe', zone: stale.sort((a, b) => dist(a) - dist(b))[0] };
    return null;
  }
  route(field, job) {
    const G = this.geo.gate, R = this.rover, inField = R.x < G.x - 0.4;
    const pts = [];
    if (job.kind === 'home') { if (inField) pts.push({ x: G.x - 1.2, z: G.z }); pts.push({ x: G.x + 0.6, z: G.z }, { x: this.geo.dock.x, z: this.geo.dock.z, face: -Math.PI / 2 }); }
    else { if (!inField) pts.push({ x: G.x + 0.6, z: G.z }, { x: G.x - 1.2, z: G.z }); const c = field.zoneCenter(job.zone); pts.push({ x: c.x, z: c.z }); }
    return pts;
  }
  // field: FieldSim. drone: SprayDrone (for irrigation requests). dt seconds.
  tick(dt, field, drone) {
    this.time += dt; const D = this.def, R = this.rover, L = this.level, h = dt / 3600;
    // the mast's moisture scan covers the whole field all the time
    const Z = field.zoneStats(); Z.forEach((s, i) => { this.map[i].wet = s.wet; });
    if (!this.running()) { R.vel = 0; return; }
    if (this.auto || this.requests.irrigate) {
      const dry = Z.filter((s) => s.wet < this.wetTarget).length;
      if ((dry >= 6 || (this.requests.irrigate && dry > 0)) && drone && drone.state === 'done' && this.time - this.lastDrone > 600) { drone.newMission(); this.lastDrone = this.time; this.requests.irrigate = false; this.note(`${dry} zones below ${pc(this.wetTarget)} moisture: drone sent out`); }
    }
    // rover state machine
    const go = (job) => { R.job = job; R.path = this.route(field, job); R.state = 'drive'; };
    if (R.state === 'docked') {
      R.vel = 0;
      R.batt = Math.min(D.battKwh, R.batt + D.chargeKw * h);
      const fill = Math.min(D.fillLpm * dt / 60, this.tankL, L.roverTankL - R.tankL); if (fill > 0) { R.tankL += fill; this.tankL -= fill; }
      if ((this.auto || this.requests.dose) && R.batt > D.battKwh * 0.8) { const j = this.plan(field); if (j && (j.kind === 'probe' || R.tankL >= Math.min(L.roverTankL, D.doseL + this.tankL) - 0.5)) go(j); }
    } else if (R.state === 'drive') {
      const t = R.path[0];
      if (!t) { if (R.job.kind === 'home') { R.state = 'docked'; R.job = null; } else { R.state = R.job.kind; R.workT = R.job.kind === 'probe' ? D.probeS : D.doseS; } }
      else {
        const dx = t.x - R.x, dz = t.z - R.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz);
        let dh = ((want - R.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const turn = Math.sign(dh) * Math.min(Math.abs(dh), 1.6 * dt); R.heading += turn;
        R.vel = Math.abs(dh) > 0.35 ? 0 : Math.min(L.speed, d * 1.2 + 0.1);
        const step = Math.min(d, R.vel * dt); R.x += Math.sin(R.heading) * step; R.z += Math.cos(R.heading) * step;
        R.batt = Math.max(0, R.batt - D.driveKw * h);
        if (d < 0.06) { R.path.shift(); if (!R.path.length && t.face !== undefined) R.heading = t.face; }
      }
    } else if (R.state === 'probe' || R.state === 'dose') {
      R.vel = 0; R.workT -= dt; R.batt = Math.max(0, R.batt - 0.15 * h);
      if (R.workT <= 0) {
        const z = R.job.zone, s = field.zoneStats()[z];
        if (R.state === 'probe') { Object.assign(this.map[z], { n: s.n, comp: s.comp, org: s.org, t: this.time }); this.sampled++; R.log.unshift({ t: this.time, text: `Zone ${z + 1}: N ${pc(s.n)}, compaction ${pc(s.comp)}` }); }
        else { const l = Math.min(D.doseL, R.tankL); R.tankL -= l; field.dose(z, D.doseN * l / D.doseL); this.dosedL += l; this.doses++; this.map[z].n = Math.min(1, s.n + D.doseN * l / D.doseL); this.map[z].t = this.time; this.note(`Fed zone ${z + 1} with ${Math.round(l)} L of digestate`); }
        const next = R.batt > D.battKwh * 0.3 ? this.plan(field) : null;
        if (next && (next.kind === 'probe' || R.tankL >= D.doseL)) go(next); else go({ kind: 'home' });
      }
    }
    R.probe += ((R.state === 'probe' ? 1 : 0) - R.probe) * Math.min(1, dt * 3);
    R.boom += ((R.state === 'dose' ? 1 : 0) - R.boom) * Math.min(1, dt * 3);
    this.energyKwh += this.powerKw() * h; this.wear(dt, R.state !== 'docked');
  }
  act(id, wallet) {
    if (id === 'auto') { this.auto = !this.auto; this.note(`Automatic ${this.auto ? 'on' : 'off'}`); return { msg: `Soil steward ${this.auto ? 'works on its own' : 'waits for orders'}` }; }
    if (id === 'survey') { this.map.forEach((m) => { m.t = -1e9; }); this.requests.dose = true; this.note('Full soil survey ordered'); return { msg: 'Every zone marked for a fresh soil sample' }; }
    if (id === 'feed') { this.requests.dose = true; return { msg: 'The rover will feed every known hungry zone' }; }
    if (id === 'home') { if (this.rover.state !== 'docked') { this.rover.job = { kind: 'home' }; this.rover.path = this.route(null, { kind: 'home' }); this.rover.state = 'drive'; } return { msg: 'Rover called back to the dock' }; }
    if (id.startsWith('nt-')) { this.nTarget = +id.slice(3) / 100; return { msg: `Feed zones below ${id.slice(3)}% nitrogen` }; }
    return super.act(id, wallet);
  }
  panel() {
    const D = this.def, R = this.rover, known = this.map.filter((m) => m.n !== null).length, hungry = this.map.filter((m) => m.n !== null && m.n < this.nTarget).length;
    const mapRows = []; for (let j = 0; j < ZONES.nz; j++) mapRows.push(['Row ' + (j + 1), this.map.slice(j * ZONES.nx, (j + 1) * ZONES.nx).map((m) => (m.n === null ? ' --' : String(Math.round(m.n * 100)).padStart(3, ' '))).join(' ')]);
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', D.type], ['Status', this.reason()], ['Zones sampled', `${known} of ${this.map.length}`], ['Hungry zones', `${hungry} below ${pc(this.nTarget)} nitrogen`], ['Dry zones', this.map.filter((m) => m.wet < this.wetTarget).length + ` below ${pc(this.wetTarget)}`], ['Digestate tank', `${Math.round(this.tankL)} of ${D.tankL} L`], ['Rover', `${R.state}, battery ${pc(R.batt / D.battKwh)}, tank ${Math.round(R.tankL)} L`]],
        performance: [['Soil samples taken', this.sampled], ['Zone feeds', this.doses], ['Digestate spread', Math.round(this.dosedL) + ' L'], ['Station power', f1(this.powerKw()) + ' kW'], ['Energy used', f1(this.energyKwh) + ' kWh'], ['Nitrogen map (%)', 'west → east'], ...mapRows],
        resources: [['Digestate', 'From the digester through the buried pipe'], ['Dose', `${D.doseL} L raises a zone's nitrogen by ${pc(D.doseN)}`], ['Moisture', 'Scanned from the mast for every zone'], ['Nutrients', 'Only known where the rover probed (good for ' + D.staleH + ' h)'], ['Rover battery', D.battKwh + ' kWh, charged at the dock']],
        upgrades: this.upgradeTab((a, b) => [`Rover tank ${a.roverTankL} -> ${b.roverTankL} L`, `Rover speed ${a.speed} -> ${b.speed} m/s`]),
        operation: { rows: [['Automatic', this.auto ? 'On' : 'Off'], ['Feed below', pc(this.nTarget) + ' nitrogen'], ['Irrigate below', pc(this.wetTarget) + ' moisture'], ['Maintenance', this.maint()]], log: [...R.log.slice(0, 3), ...this.log.slice(0, 4)] }
      },
      strip: [{ k: 'Sampled', v: `${known}/${this.map.length}`, f: known / this.map.length }, { k: 'Hungry', v: hungry, c: 'var(--warn)' }, { k: 'Digestate', v: Math.round(this.tankL) + ' L', f: this.tankL / D.tankL, c: 'var(--water)' }, { k: 'Rover', v: R.state }, { k: 'Battery', v: pc(R.batt / D.battKwh), f: R.batt / D.battKwh, c: 'var(--ok)' }, this.condStat()],
      actions: [{ id: 'auto', label: `Automatic: ${this.auto ? 'on' : 'off'}`, primary: !this.auto }, { id: 'survey', label: 'Full soil survey' }, { id: 'feed', label: 'Feed hungry zones' }, { id: 'home', label: 'Call rover home', disabled: R.state === 'docked' },
        ...[40, 50, 60].map((v) => ({ id: 'nt-' + v, label: `Feed below ${v}%`, disabled: Math.round(this.nTarget * 100) === v })), ...standardActions(this).slice(1)]
    });
  }
}

// ---------------------------------------------------------------------------
// Logic controller: IF <sensor> <compare> <value> THEN <action>. Rules are level-triggered: the action holds while
// the condition is true and releases when it turns false. An action only works on a machine wired to the controller.
export const CONTROLLER_DEF = {
  id: 'logic', name: 'Logic Controller', short: 'Controller', type: 'Programmable rule controller, 8 rules', brand: 'Fieldworks Automation', model: 'FW-LC8', category: 'Automation',
  levels: [{ level: 1, maxRules: 8, cost: 0, parts: [] }], wearPerHour: 0.1, repairCostPerPct: 5
};
export class LogicController extends Unit {
  // sensors: { id: { label, unit, get() } }. actions: { id: { label, target, apply(on, rule) } }. linked(target) -> bool
  constructor(sensors, actions, linked) {
    super(CONTROLLER_DEF);
    this.sensors = sensors; this.actions = actions; this.linked = linked; this.nextId = 1; this.fired = 0;
    this.rules = [];
  }
  add(r) { if (this.rules.length >= this.level.maxRules) return null; const rule = Object.assign({ id: this.nextId++, sensor: 'battery', cmp: '<', value: 25, action: 'gen.start', enabled: true, active: false, since: 0 }, r || {}); this.rules.push(rule); return rule; }
  remove(id) { const i = this.rules.findIndex((r) => r.id === id); if (i >= 0) { const r = this.rules[i]; if (r.active) this.actions[r.action].apply(false, r); this.rules.splice(i, 1); } }
  ok(r) { return !!(this.sensors[r.sensor] && this.actions[r.action]); }
  problem(r) { if (!this.ok(r)) return 'Unknown sensor or action'; const t = this.actions[r.action].target; if (!this.linked(t)) return `No signal cable to the ${t}`; return null; }
  status() { if (!this.on) return 'off'; if (!this.powered) return 'stopped'; if (this.rules.some((r) => r.enabled && this.problem(r))) return 'waiting'; return 'running'; }
  reason() { if (!this.on) return 'Switched off'; if (!this.powered) return 'No power'; const bad = this.rules.find((r) => r.enabled && this.problem(r)); if (bad) return `Rule ${this.rules.indexOf(bad) + 1}: ${this.problem(bad)}`; const n = this.rules.filter((r) => r.active).length; return `${this.rules.filter((r) => r.enabled).length} rules, ${n} active`; }
  text(r) { const S = this.sensors[r.sensor], A = this.actions[r.action]; return `If ${S ? S.label.toLowerCase() : '?'} ${r.cmp === '<' ? 'is below' : 'is above'} ${r.value}${S ? S.unit : ''}, ${A ? A.label.toLowerCase() : '?'}`; }
  tick(dt) {
    this.time += dt;
    // release first, then apply, so two rules on the same action keep it held while either is true
    const want = {};
    this.rules.forEach((r) => {
      const run = this.on && this.powered && r.enabled && this.ok(r) && !this.problem(r);
      const v = run ? this.sensors[r.sensor].get() : null;
      // 3% hysteresis band so a value sitting on the line does not flicker the machine
      const band = Math.abs(r.value) * 0.03 + 0.01, on = run && (r.active ? (r.cmp === '<' ? v < r.value + band : v > r.value - band) : (r.cmp === '<' ? v < r.value : v > r.value));
      r.now = v; if (on !== r.active) { r.active = on; r.since = this.time; if (on) { this.fired++; this.note(`Rule ${this.rules.indexOf(r) + 1} on: ${this.text(r)}`); } }
      if (on) want[r.action] = r;
    });
    Object.keys(this.actions).forEach((a) => this.actions[a].apply(!!want[a], want[a] || null));
  }
  act(id) {
    if (id === 'rule-add') { return this.add({ sensor: 'tank', cmp: '<', value: 15, action: 'line.stop' }) ? { msg: 'Rule added: set it up in the Operation tab' } : { msg: `This controller holds ${this.level.maxRules} rules` }; }
    if (id.startsWith('rule-del-')) { this.remove(+id.slice(9)); return { msg: 'Rule removed' }; }
    if (id.startsWith('rule-tog-')) { const r = this.rules.find((q) => q.id === +id.slice(9)); if (r) { r.enabled = !r.enabled; return { msg: `Rule ${r.enabled ? 'enabled' : 'disabled'}` }; } }
    if (id === 'power') { this.setOn(!this.on); return { msg: this.on ? 'Controller running' : 'Controller stopped: every rule released' }; }
    return { msg: '' };
  }
  // the rule editor is real HTML (selects and number boxes) built by the page from these fields
  panel() {
    const act = this.rules.filter((r) => r.active).length;
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Type', this.def.type], ['Status', this.reason()], ...this.rules.map((r, i) => [`Rule ${i + 1}${r.active ? ' · ACTIVE' : ''}`, (r.enabled ? '' : '(off) ') + this.text(r)])],
        performance: [['Rules', `${this.rules.length} of ${this.level.maxRules}`], ['Active now', act], ['Times a rule switched on', this.fired], ...this.rules.map((r, i) => [`Rule ${i + 1} reads`, r.now === null || r.now === undefined ? '–' : f1(r.now) + this.sensors[r.sensor].unit])],
        resources: Object.values(this.sensors).map((s) => [s.label, f1(s.get()) + s.unit]),
        upgrades: { rows: [['Current level', '1 of 1'], ['Next level', 'Not in this demo']], gains: [] },
        operation: { rules: true, rows: [], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'Rules', v: `${this.rules.length}/${this.level.maxRules}` }, { k: 'Active', v: act, c: 'var(--accent)' }, { k: 'Fired', v: this.fired }, { k: 'Status', v: this.status() }],
      actions: [{ id: 'rule-add', label: 'Add a rule', primary: true, disabled: this.rules.length >= this.level.maxRules }, { id: 'power', label: this.on ? 'Stop controller' : 'Start controller' }]
    });
  }
}
export { money };
