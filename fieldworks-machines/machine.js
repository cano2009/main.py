// Fieldworks machine simulation.
// A machine definition plus a running state that processes real items: input buffer -> processing slots -> output.
// It tracks power, water, motor temperature, wear, faults, maintenance and upgrades, and measures throughput from
// items actually finished. Screens and the inspection panel read only from stats(), so nothing shown is invented.
// No three.js dependency: the same class can run on the game's server or client.

export const WASHER_DEF = {
  id: 'ws300', name: 'Brush Washer', type: 'Produce washer', brand: 'Fieldworks Machinery', model: 'WS-300',
  category: 'Processing', input: 'Dirty produce', output: 'Washed produce',
  // one entry per upgrade level
  levels: [
    { level: 1, beltSpeed: 0.3, slots: 3, motorKw: 2.2, pumpKw: 1.1, waterLpm: 38, inCap: 12, outCap: 24, cost: 0, parts: [] },
    { level: 2, beltSpeed: 0.42, slots: 4, motorKw: 3.0, pumpKw: 1.5, waterLpm: 46, inCap: 18, outCap: 32, cost: 1800, parts: ['Brush set (nylon)', 'Spray nozzles x12'] },
    { level: 3, beltSpeed: 0.58, slots: 5, motorKw: 4.0, pumpKw: 2.2, waterLpm: 58, inCap: 24, outCap: 40, cost: 4200, parts: ['Gearbox 1:12', 'High-pressure pump', 'Brush set (nylon)'] }
  ],
  washLength: 1.6,          // metres of brush bed an item travels
  waterTankL: 400,
  refillLpm: 34,            // mains refill
  wearPerHour: 18,          // condition % lost per operating hour (fast, for gameplay)
  repairCostPerPct: 6,
  ambientC: 18
};

export class Machine {
  constructor(def) {
    this.def = def;
    this.levelIndex = 0;
    this.on = true;
    this.inBuffer = [];       // items waiting to enter
    this.slots = [];          // items being processed: { item, progress 0..1 }
    this.outBuffer = [];      // finished items waiting for collection
    this.water = def.waterTankL * 0.9;
    this.motorC = def.ambientC;
    this.condition = 100;
    this.hours = 0;
    this.fault = null;        // { code, text, since }
    this.time = 0;
    this.finishedTimes = [];  // timestamps of finished items (throughput)
    this.totalDone = 0;
    this.energyKwh = 0;
    this.waterUsedL = 0;
    this.log = [];
    this.listeners = new Set();
  }
  get level() { return this.def.levels[this.levelIndex]; }
  on_(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { this.listeners.forEach((f) => f(ev, this)); }
  note(text) { this.log.unshift({ t: this.time, text }); this.log.length = Math.min(this.log.length, 12); }

  // ---------- inputs and outputs ----------
  canAccept() { return this.inBuffer.length < this.level.inCap; }
  feed(item) { if (!this.canAccept()) return false; this.inBuffer.push(item); return true; }
  take() { const it = this.outBuffer.shift(); if (it) this.emit({ type: 'taken', item: it }); return it || null; }

  // ---------- controls ----------
  setOn(v) { this.on = !!v; this.note(v ? 'Started by operator' : 'Stopped by operator'); this.emit({ type: 'power' }); }
  clearFault() { if (!this.fault) return; this.note('Fault cleared: ' + this.fault.text); this.fault = null; this.emit({ type: 'fault' }); }
  repairCost() { return Math.ceil((100 - this.condition) * this.def.repairCostPerPct); }
  repair() { const c = this.repairCost(); this.condition = 100; if (this.fault && this.fault.code === 'jam') this.fault = null; this.note('Serviced, condition 100%'); this.emit({ type: 'repair', cost: c }); return c; }
  nextLevel() { return this.def.levels[this.levelIndex + 1] || null; }
  upgrade() { const n = this.nextLevel(); if (!n) return 0; this.levelIndex++; this.note('Upgraded to level ' + n.level); this.emit({ type: 'upgrade' }); return n.cost; }

  // ---------- simulation ----------
  status() {
    if (!this.on) return 'off';
    if (this.fault) return 'stopped';
    if (this.outBuffer.length >= this.level.outCap) return 'waiting';
    if (!this.slots.length && !this.inBuffer.length) return 'waiting';
    return 'running';
  }
  reason() {
    if (!this.on) return 'Switched off';
    if (this.fault) return this.fault.text;
    if (this.outBuffer.length >= this.level.outCap) return 'Output full - collect washed produce';
    if (!this.slots.length && !this.inBuffer.length) return 'Waiting for produce';
    return 'Washing';
  }
  efficiency() {
    const c = this.condition;
    return Math.max(0.35, Math.min(1, 0.55 + c * 0.0045));   // 100% -> 1.0, 50% -> 0.78, 0% -> 0.55
  }
  tick(dt) {
    this.time += dt;
    const L = this.level, st = this.status(), running = st === 'running';
    // motor temperature follows load
    const load = running ? Math.min(1, (this.slots.length + 0.5) / L.slots) : 0;
    const targetC = this.def.ambientC + (running ? 22 + 38 * load * (1.25 - 0.25 * this.efficiency()) + (100 - this.condition) * 0.12 : 0);
    this.motorC += (targetC - this.motorC) * Math.min(1, dt / 25);
    // water: spraying uses it, mains refills it
    const use = running ? (L.waterLpm / 60) * dt : 0;
    this.water = Math.max(0, Math.min(this.def.waterTankL, this.water - use + (this.def.refillLpm / 60) * dt));
    this.waterUsedL += use;
    // power
    const kw = this.powerKw();
    this.energyKwh += kw * dt / 3600;
    if (running) { this.hours += dt / 3600; this.condition = Math.max(0, this.condition - this.def.wearPerHour * dt / 3600); }
    // faults
    if (!this.fault && this.on) {
      if (this.water < this.def.waterTankL * 0.05) this.fault = { code: 'water', text: 'Low water - spray pressure lost', since: this.time };
      else if (this.motorC > 92) this.fault = { code: 'heat', text: 'Motor over temperature', since: this.time };
      else if (running && this.condition < 25 && Math.random() < dt * 0.02) this.fault = { code: 'jam', text: 'Brush bed jammed - service needed', since: this.time };
      if (this.fault) { this.note('Fault: ' + this.fault.text); this.emit({ type: 'fault' }); }
    }
    if (this.fault && this.fault.code === 'water' && this.water > this.def.waterTankL * 0.25) this.clearFault();
    if (this.fault && this.fault.code === 'heat' && this.motorC < 70) this.clearFault();
    // processing
    if (running || (this.on && !this.fault && this.outBuffer.length < L.outCap)) {
      const rate = (L.beltSpeed * this.efficiency()) / this.def.washLength;      // fraction of the bed per second
      for (let i = this.slots.length - 1; i >= 0; i--) {
        const s = this.slots[i];
        s.progress += rate * dt;
        if (s.progress >= 1) {
          if (this.outBuffer.length >= L.outCap) { s.progress = 1; continue; }
          this.slots.splice(i, 1);
          s.item.clean = true;
          this.outBuffer.push(s.item);
          this.finishedTimes.push(this.time);
          this.totalDone++;
          this.emit({ type: 'finished', item: s.item });
        }
      }
      // admit a new item when the first slot is clear
      const spacing = 1 / L.slots;
      const lastIn = this.slots.length ? Math.min(...this.slots.map((s) => s.progress)) : 1;
      if (this.inBuffer.length && this.slots.length < L.slots && lastIn >= spacing) {
        const item = this.inBuffer.shift();
        this.slots.push({ item, progress: 0 });
        this.emit({ type: 'started', item });
      }
    }
    while (this.finishedTimes.length && this.time - this.finishedTimes[0] > 60) this.finishedTimes.shift();
  }
  powerKw() {
    const st = this.status(), L = this.level;
    if (st === 'off') return 0.02;
    if (st === 'stopped') return 0.12;
    if (st === 'waiting') return 0.25 + L.pumpKw * 0.1;
    return (L.motorKw * (0.55 + 0.45 * Math.min(1, this.slots.length / L.slots)) + L.pumpKw) / this.efficiency();
  }
  sprayBar() {
    const st = this.status();
    if (st !== 'running') return st === 'waiting' ? 0.4 : 0;
    return 4.2 * Math.min(1, this.water / (this.def.waterTankL * 0.25)) * (0.9 + 0.1 * this.efficiency()) * (this.levelIndex === 2 ? 1.3 : 1);
  }
  // Everything the screens and panel show. Per minute figures come from items actually finished.
  stats() {
    const L = this.level, el = Math.min(60, Math.max(1, this.time));
    const perMin = this.finishedTimes.length * (60 / el);
    const maxPerMin = (L.beltSpeed / this.def.washLength) * L.slots * 60;
    const next = this.nextLevel();
    const current = this.slots.length ? this.slots.reduce((a, s) => (s.progress > a.progress ? s : a)) : null;
    const rate = (L.beltSpeed * this.efficiency()) / this.def.washLength;
    return {
      identity: { name: this.def.name, type: this.def.type, brand: this.def.brand, model: this.def.model, category: this.def.category, status: this.status(), reason: this.reason() },
      performance: {
        throughputPerMin: perMin, maxPerMin, beltSpeed: L.beltSpeed * this.efficiency(), slots: L.slots, inRate: perMin,
        powerKw: this.powerKw(), ratedKw: L.motorKw + L.pumpKw, waterLpm: this.status() === 'running' ? L.waterLpm : 0,
        efficiency: this.efficiency(), motorC: this.motorC, condition: this.condition, hours: this.hours,
        sprayBar: this.sprayBar(), energyKwh: this.energyKwh, waterUsedL: this.waterUsedL, totalDone: this.totalDone
      },
      resources: {
        input: this.def.input, output: this.def.output, inCount: this.inBuffer.length, inCap: L.inCap,
        processing: this.slots.length, outCount: this.outBuffer.length, outCap: L.outCap,
        water: this.water, waterCap: this.def.waterTankL,
        missing: this.inBuffer.length || this.slots.length ? [] : [this.def.input],
        limits: [this.outBuffer.length >= L.outCap ? 'Output full' : null, this.water < this.def.waterTankL * 0.2 ? 'Water low' : null].filter(Boolean)
      },
      upgrades: {
        level: L.level, maxLevel: this.def.levels.length, next: next ? {
          level: next.level, cost: next.cost, parts: next.parts,
          gains: [`Belt ${L.beltSpeed} -> ${next.beltSpeed} m/s`, `Slots ${L.slots} -> ${next.slots}`, `Max ${Math.round(maxPerMin)} -> ${Math.round((next.beltSpeed / this.def.washLength) * next.slots * 60)} items/min`, `Output store ${L.outCap} -> ${next.outCap}`]
        } : null
      },
      operation: {
        task: current ? `Washing ${current.item.label || 'item'}` : this.reason(), progress: current ? current.progress : 0,
        remainingS: current ? (1 - current.progress) / Math.max(1e-6, rate) : 0,
        fault: this.fault ? this.fault.text : null,
        maintenance: this.condition < 40 ? 'Service now' : this.condition < 70 ? 'Service soon' : 'OK', repairCost: this.repairCost(),
        connections: { infeed: true, outfeed: true, water: this.water > 0, power: true },
        log: this.log.slice(0, 6)
      }
    };
  }
}
