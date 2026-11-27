// Fieldworks multi-stage production core: a spine conveyor with five module bays. Crops arrive from the farm (the
// sorter's router sends the crops you choose), ride the spine through the bays in order, and each module works on the
// materials it understands and passes the rest: a cleaner raises purity and throws out husks, a dryer takes the
// moisture out, a press splits oilseed into oil and seed cake, a mill splits grain into flour and bran, a mixer turns
// cake and bran (the byproducts) into animal feed, a bottler packs oil and sacks flour and feed. Order matters, power
// and heat are shared, and the slowest module sets the pace unless a buffer tank sits between stages.
// Also here: the router (flap gate) after the sorter, the 90° transfer table, and product meshes. three.js r147.

import * as THREE from 'three';
import { Unit, CROPS } from './sims.js';
import { bake } from './lowpoly.js';
import { screen } from './yard.js';

const V = THREE.Vector3;
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
const mats = new Map();
function mat(hex, o) { const k = hex + JSON.stringify(o || {}); if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.05, flatShading: true }, o || {})); m.color = lin(hex); m.userData.lowpoly = true; mats.set(k, m); } return mats.get(k); }
const M = {
  green: mat('#3f7d4c'), greenD: mat('#2f5a3b'), yellow: mat('#e9b830'), yellowD: mat('#c99a22'), cream: mat('#e6e0cf'), steel: mat('#a3a9ad', { metalness: 0.3, roughness: 0.5 }),
  steelD: mat('#6f767b', { metalness: 0.3, roughness: 0.55 }), dark: mat('#33363a'), black: mat('#1b1c1e'), red: mat('#c94232'), blue: mat('#2c4f7c', { roughness: 0.4, metalness: 0.3 }),
  orange: mat('#e0702a'), concrete: mat('#c4beb2', { roughness: 0.95 }), wood: mat('#9a7a52'), woodD: mat('#755c3c'), copper: mat('#b8733a', { metalness: 0.4, roughness: 0.45 }), teal: mat('#2f8f8a')
};
const glowMat = (hex, i) => { const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: lin(hex), emissiveIntensity: i === undefined ? 2 : i }); m.userData.lowpoly = true; return m; };
function put(p, m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (p) p.add(m); return m; }
const box = (w, h, d, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
const cyl = (r, h, seg, m, x, y, z, p, r2) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r2 === undefined ? r : r2, h, seg || 8), m), x, y, z);
const cylX = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateZ(Math.PI / 2), m), x, y, z);
const cylZ = (r, len, seg, m, x, y, z, p) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8).rotateX(Math.PI / 2), m), x, y, z);

// ---------------------------------------------------------------------------
// Materials: raw crops come from the farm with a purity (from their grade) and moisture; products carry both on.
export const MATERIALS = {
  sunflower: { name: 'Sunflower seed', kind: 'oilseed', value: 2.2 }, soybean: { name: 'Soybean', kind: 'oilseed', value: 1.3 },
  wheat: { name: 'Wheat', kind: 'grain', value: 1.8 }, corn: { name: 'Corn', kind: 'grain', value: 1.6 },
  oil: { name: 'Plant oil', value: 3.4 }, cake: { name: 'Seed cake', value: 0.9, by: true }, flour: { name: 'Flour', value: 2.6 }, bran: { name: 'Bran', value: 0.5, by: true },
  feed: { name: 'Animal feed', value: 2.4 }, bottle: { name: 'Bottled oil', value: 4.8 }, sack: { name: 'Sacked flour', value: 3.4 }, feedsack: { name: 'Sacked feed', value: 3.1 },
  waste: { name: 'Husks and stones', value: 0 }
};
export const CORE_CROPS = ['sunflower', 'soybean', 'wheat', 'corn'];
const raw = (m) => !!(MATERIALS[m] && MATERIALS[m].kind);
// Modules: what they act on, time per unit (s), power (kW), heat, price
export const MODULES = {
  empty: { name: 'Empty bay', price: 0 },
  cleaner: { name: 'Air cleaner', price: 1800, kw: 0.8, heat: 0, t: 1.6, color: '#2f8f8a', note: 'Raises purity of raw crops by 25 points; blows out husks and stones' },
  dryer: { name: 'Drum dryer', price: 2400, kw: 3, heat: 1.6, t: 2.6, color: '#e0702a', note: 'Dries raw crops: wet oilseed presses slower and makes poorer oil' },
  press: { name: 'Screw press', price: 3600, kw: 4, heat: 1.2, t: 3.2, color: '#3f7d4c', note: 'Oilseed → plant oil + seed cake' },
  mill: { name: 'Roller mill', price: 3000, kw: 3, heat: 0.5, t: 2.4, color: '#e9b830', note: 'Grain → flour + bran' },
  mixer: { name: 'Feed mixer', price: 2200, kw: 1.5, heat: 0.2, t: 2.2, color: '#2c4f7c', note: 'Two units of seed cake or bran → animal feed' },
  tank: { name: 'Buffer tank', price: 900, kw: 0.1, heat: 0, t: 0.3, cap: 24, color: '#a3a9ad', note: 'Stores 24 units so the stages before it keep running' },
  cooler: { name: 'Cooling unit', price: 1100, kw: 0.4, heat: -2.6, color: '#58a6c9', note: 'Removes heat from the whole core' },
  power: { name: 'Power cabinet', price: 1500, kw: 0, heat: 0.1, capKw: 14, color: '#c94232', note: '+14 kW on top of the 6 kW supply' },
  bottler: { name: 'Bottler and sacker', price: 2600, kw: 0.8, heat: 0, t: 1.2, color: '#c99a22', note: 'Bottles oil, sacks flour and feed: +40% value' }
};
export const BAYS = 5, BASE_KW = 6;
// what a module does to a unit: returns null (pass on), or { out: [materials], waste: bool, purity, moisture }
function acts(type, u) {
  if (type === 'cleaner') return raw(u.mat) && !u.cleaned;
  if (type === 'dryer') return raw(u.mat) && u.moisture > 0.12;
  if (type === 'press') return MATERIALS[u.mat].kind === 'oilseed';
  if (type === 'mill') return MATERIALS[u.mat].kind === 'grain';
  if (type === 'mixer') return u.mat === 'cake' || u.mat === 'bran';
  if (type === 'bottler') return u.mat === 'oil' || u.mat === 'flour' || u.mat === 'feed';
  if (type === 'tank') return true;
  return false;
}
/** evaluateCore(bays, routes): the configuration check (order, missing stages, power, heat). */
export function evaluateCore(bays, routes) {
  const issues = [], add = (lvl, text, fix) => issues.push({ lvl, text, fix: fix || '' });
  const idx = (t) => bays.indexOf(t), has = (t) => idx(t) >= 0, mods = bays.filter((b) => b !== 'empty');
  const capKw = BASE_KW + (has('power') ? MODULES.power.capKw : 0), kw = mods.reduce((a, b) => a + (MODULES[b].kw || 0), 0), heat = mods.reduce((a, b) => a + (MODULES[b].heat || 0), 0);
  const routed = CORE_CROPS.filter((c) => routes[c]);
  if (!routed.length) add('warn', 'No crops are routed to the core', 'Tick the crops the router should send here');
  if (routed.some((c) => MATERIALS[c].kind === 'oilseed') && !has('press')) add('error', 'Oilseed is routed here but there is no press', 'Install a screw press');
  if (routed.some((c) => MATERIALS[c].kind === 'grain') && !has('mill')) add('error', 'Grain is routed here but there is no mill', 'Install a roller mill');
  if (has('dryer') && has('press') && idx('dryer') > idx('press')) add('warn', 'The dryer is after the press: the seed is pressed wet', 'Move the dryer to a bay before the press');
  if (has('cleaner') && (has('press') && idx('cleaner') > idx('press') || has('mill') && idx('cleaner') > idx('mill'))) add('warn', 'The cleaner is after a processing stage, so it only sees products', 'Put the cleaner first');
  if (has('mixer') && !((has('press') && idx('press') < idx('mixer')) || (has('mill') && idx('mill') < idx('mixer')))) add('warn', 'The mixer has no seed cake or bran coming to it', 'Put a press or mill before the mixer');
  if (has('bottler') && !['press', 'mill', 'mixer'].some((t) => has(t) && idx(t) < idx('bottler'))) add('warn', 'The bottler is before anything it could pack', 'Move the bottler to the last bay');
  if ((has('press') || has('mill')) && !has('mixer')) add('info', 'Byproducts (seed cake, bran) are sold loose at a low price', 'A feed mixer turns them into animal feed');
  if (!has('cleaner') && routed.length) add('info', 'Without a cleaner, products keep the purity of the harvest', 'An air cleaner raises it');
  if (mods.filter((t) => ['press', 'mill', 'mixer', 'dryer'].includes(t)).length >= 2 && !has('tank')) add('info', 'No buffer tank: one slow stage holds up all the others', 'A buffer tank between stages smooths the flow');
  if (kw > capKw) add('warn', `Needs ${kw.toFixed(1)} kW but the supply gives ${capKw} kW: everything slows to ${Math.round(capKw / kw * 100)}%`, 'Install a power cabinet');
  const temp = 25 + Math.max(0, heat) * 18;
  if (temp > 70) add('warn', `Runs at about ${Math.round(temp)} °C: modules slow down to stay safe`, 'Install a cooling unit');
  if (!issues.some((i) => i.lvl === 'error' || i.lvl === 'warn')) add('ok', 'Line checks out', `${mods.length} modules, ${kw.toFixed(1)} of ${capKw} kW`);
  return { issues, kw, capKw, heat, temp, ok: !issues.some((i) => i.lvl === 'error') };
}

// ---------------------------------------------------------------------------
// Path of a unit (s in metres): west conveyor (5 m), transfer table (0.8 m), spine (7 m). Bay k sits at BAY_S[k].
export const PATH = { west: 5.0, table: 0.8, spine: 7.0 };
PATH.len = PATH.west + PATH.table + PATH.spine;
export const BAY_S = Array.from({ length: BAYS }, (_, k) => PATH.west + PATH.table + 0.6 + k * 1.25);
export const CORE_DEF = { id: 'core', name: 'Production Core', short: 'Production core', type: 'Five-bay modular production line', brand: 'Fieldworks Industry', model: 'FW-PC5', category: 'Production', levels: [{ level: 1, cost: 0, parts: [] }], wearPerHour: 1.5, repairCostPerPct: 14, belt: 0.45, gap: 0.42, palletUnits: 24 };
export class CoreSim extends Unit {
  constructor() {
    super(CORE_DEF);
    this.bays = Array(BAYS).fill('empty'); this.routes = { sunflower: true, soybean: true, wheat: false, corn: false };
    this.units = []; this.id = 1; this.work = Array.from({ length: BAYS }, () => ({ t: 0, unit: null, done: 0, hold: [] })); this.store = Array.from({ length: BAYS }, () => []);
    this.out = {}; this.outN = 0; this.waste = 0; this.earned = 0; this.sold = {}; this.tempC = 22; this.intake = 0; this.inhibit = null;
  }
  ev() { return evaluateCore(this.bays, this.routes); }
  running() { return this.on && this.powered && !this.fault && !this.inhibit; }
  // the router asks before sending a crop
  // the router asks before diverting a crop; canTake() is checked again when it reaches the flap
  wants(crop) { return !!this.routes[crop] && this.on && this.bays.some((b) => b !== 'empty') && this.units.length < 26; }
  canTake() { return this.running() && !this.units.some((u) => u.s < 0.6) && this.units.length < 28; }
  accept(crop, grade) { const p = { A: 0.92, B: 0.8, C: 0.62 }[grade || 'B'] || 0.8; this.units.push({ id: this.id++, mat: crop, purity: p, moisture: 0.22, s: 0, at: -1, done: {} }); this.intake++; }
  speed() { const E = this.ev(); return Math.min(1, E.capKw / Math.max(0.01, E.kw)) * (this.tempC > 70 ? Math.max(0.4, 1 - (this.tempC - 70) / 25) : 1) * this.efficiency(); }
  status() { if (!this.on) return 'off'; if (!this.powered || this.fault) return 'stopped'; if (this.inhibit || !this.ev().ok) return 'waiting'; return this.units.length || this.work.some((w) => w.unit) ? 'running' : 'waiting'; }
  reason() {
    if (!this.on) return 'Switched off'; if (!this.powered) return 'No power at the core'; if (this.fault) return this.fault.text; if (this.inhibit) return 'Held by ' + this.inhibit;
    const E = this.ev(); if (!E.ok) return E.issues.find((i) => i.lvl === 'error').text;
    if (!this.bays.some((b) => b !== 'empty')) return 'No modules installed: fill the bays';
    if (!this.units.length) return 'Waiting for crops from the router';
    const busy = this.work.map((w, k) => (w.unit ? MODULES[this.bays[k]].name.toLowerCase() : null)).filter(Boolean);
    return busy.length ? `Working: ${busy.join(', ')}` : `${this.units.length} units on the line`;
  }
  powerKw() { if (!this.running()) return 0.05; return this.bays.reduce((a, b, k) => a + (this.work[k].unit || b === 'tank' || b === 'cooler' ? MODULES[b].kw || 0 : 0.05), 0.3); }
  value(u) { const M = MATERIALS[u.mat]; return M.value * (0.6 + 0.4 * u.purity) * (u.moisture > 0.15 && (u.mat === 'oil' || u.mat === 'bottle') ? 0.8 : 1); }
  tick(dt) {
    this.time += dt; let earned = 0;
    const E = this.ev();
    this.tempC += (25 + Math.max(0, E.heat) * 18 * (this.running() && this.work.some((w) => w.unit) ? 1 : 0.3) - this.tempC) * Math.min(1, dt / 60);
    if (!this.running()) return 0;
    const v = this.def.belt * this.efficiency(), sp = this.speed(), gap = this.def.gap;
    this.units.sort((a, b) => b.s - a.s);
    // move units: each stops at a bay whose module acts on it, and keeps its gap to the one ahead
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i]; if (u.held) continue;
      let limit = PATH.len + 0.5;
      const ahead = this.units.slice(0, i).filter((a) => !a.held && a.s > u.s); if (ahead.length) limit = Math.min(limit, ahead[ahead.length - 1].s - gap);
      for (let k = 0; k < BAYS; k++) { const t = this.bays[k]; if (t === 'empty' || u.done[k] || u.s > BAY_S[k] + 0.01) continue; if (acts(t, u)) { limit = Math.min(limit, BAY_S[k]); break; } }
      u.s = Math.max(u.s, Math.min(limit, u.s + v * dt));
    }
    // modules take the unit sitting at their bay
    for (let k = 0; k < BAYS; k++) {
      const t = this.bays[k], W = this.work[k]; if (t === 'empty') continue; const Mo = MODULES[t];
      if (!W.unit) { const u = this.units.find((q) => !q.held && !q.done[k] && Math.abs(q.s - BAY_S[k]) < 0.02 && acts(t, q)); if (u) { if (t === 'tank') { if (this.store[k].length < Mo.cap) { u.held = true; this.store[k].push(u); } } else { W.unit = u; u.held = true; W.t = Mo.t * (t === 'press' && u.moisture > 0.15 ? 1.4 : 1); } } }
      if (t === 'tank') { // release the oldest stored unit when the spot after the bay is clear
        const st = this.store[k]; if (st.length && !this.units.some((q) => !q.held && q.s > BAY_S[k] && q.s < BAY_S[k] + gap + 0.02)) { const u = st.shift(); u.held = false; u.done[k] = true; u.s = BAY_S[k] + 0.02; }
        continue;
      }
      if (W.unit) {
        W.t -= dt * sp;
        if (W.t <= 0) {
          const u = W.unit; W.unit = null; u.held = false; u.done[k] = true; W.done++;
          const spawn = (m) => { const n = { id: this.id++, mat: m, purity: u.purity, moisture: u.moisture, s: BAY_S[k] - 0.15, done: Object.assign({}, u.done) }; this.units.push(n); return n; };
          if (t === 'cleaner') { u.cleaned = true; u.purity = Math.min(1, u.purity + 0.25); if (W.done % 9 === 0) { u.mat = 'waste'; } }
          else if (t === 'dryer') u.moisture = 0.09;
          else if (t === 'press') { u.mat = 'oil'; spawn('cake'); }
          else if (t === 'mill') { u.mat = 'flour'; spawn('bran'); }
          else if (t === 'mixer') { if (W.hold.length) { const other = W.hold.shift(); this.units = this.units.filter((q) => q !== other); u.mat = 'feed'; u.purity = (u.purity + other.purity) / 2; } else { u.held = true; W.hold.push(u); u.done[k] = false; W.waitT = 0; } }
          else if (t === 'bottler') u.mat = u.mat === 'oil' ? 'bottle' : u.mat === 'flour' ? 'sack' : 'feedsack';
          u.s = Math.max(u.s, BAY_S[k] + 0.01);
        }
      }
      // a mixer that waited too long for a second unit lets the first one go on, loose
      if (t === 'mixer' && W.hold.length) { W.waitT = (W.waitT || 0) + dt; if (W.waitT > 25) { const u = W.hold.shift(); u.held = false; u.done[k] = true; u.s = BAY_S[k] + 0.01; } }
    }
    // the end of the spine: waste to the bin, everything else onto the output pallet
    this.units = this.units.filter((u) => {
      if (u.held || u.s < PATH.len) return true;
      if (u.mat === 'waste') { this.waste++; return false; }
      this.out[u.mat] = (this.out[u.mat] || 0) + 1; this.outN++; this.outV = (this.outV || 0) + this.value(u);
      return false;
    });
    if (this.outN >= this.def.palletUnits) earned += this.sell(true);
    this.energyKwh += this.powerKw() * dt / 3600; this.wear(dt, this.work.some((w) => w.unit));
    return earned;
  }
  sell(auto) {
    if (!this.outN) return 0; const v = this.outV || 0;
    this.note(`${auto ? 'Pallet full, sold' : 'Sold'}: ${Object.entries(this.out).map(([m, n]) => `${n} ${MATERIALS[m].name.toLowerCase()}`).join(', ')} for $${v.toFixed(0)}`);
    Object.entries(this.out).forEach(([m, n]) => { this.sold[m] = (this.sold[m] || 0) + n; }); this.earned += v; this.out = {}; this.outN = 0; this.outV = 0; return v;
  }
  install(k, type, wallet) {
    const cur = this.bays[k]; if (cur === type) return { msg: '' };
    const price = MODULES[type].price, refund = Math.round(MODULES[cur].price / 2);
    if (price - refund > wallet) return { msg: `${MODULES[type].name} costs $${price}` };
    if (this.work[k].unit || this.store[k].length || this.work[k].hold.length) { [this.work[k].unit, ...this.store[k], ...this.work[k].hold].filter(Boolean).forEach((u) => { u.held = false; u.done[k] = true; }); this.work[k] = { t: 0, unit: null, done: 0, hold: [] }; this.store[k] = []; }
    this.bays[k] = type; this.note(`Bay ${k + 1}: ${type === 'empty' ? 'emptied' : MODULES[type].name + ' installed'}`);
    return { cost: price - refund, msg: type === 'empty' ? `Bay ${k + 1} emptied, $${refund} back` : `${MODULES[type].name} installed in bay ${k + 1} for $${price - refund}` };
  }
  act(id, wallet) {
    if (id === 'core-sell') { const v = this.sell(false); return v ? { cost: -v, msg: `Sold for $${v.toFixed(0)}` } : { msg: 'Nothing on the pallet yet' }; }
    if (id === 'power') { this.setOn(!this.on); return { msg: this.on ? 'Core started' : 'Core stopped' }; }
    return super.act(id, wallet);
  }
  panel() {
    const E = this.ev(), sumOut = Object.entries(this.out).map(([m, n]) => `${n} ${MATERIALS[m].name.toLowerCase()}`).join(', ') || 'empty';
    return Object.assign(this.head(), {
      tabs: {
        overview: [['Status', this.reason()], ...this.bays.map((b, k) => [`Bay ${k + 1}`, b === 'empty' ? 'empty' : `${MODULES[b].name}${this.work[k].unit ? ' · working' : b === 'tank' ? ` · ${this.store[k].length} stored` : ''} · ${this.work[k].done} done`]), ['Routed crops', CORE_CROPS.filter((c) => this.routes[c]).map((c) => MATERIALS[c].name).join(', ') || 'none'], ['Output pallet', `${this.outN} of ${this.def.palletUnits}: ${sumOut}`]],
        performance: [['Taken in', this.intake + ' units'], ['On the line', this.units.length], ['Speed', Math.round(this.speed() * 100) + '%'], ['Power', `${this.powerKw().toFixed(1)} kW (needs up to ${E.kw.toFixed(1)} of ${E.capKw})`], ['Temperature', Math.round(this.tempC) + ' °C'], ['Waste bin', this.waste + ' units'], ['Earned', '$' + this.earned.toFixed(0)], ...Object.entries(this.sold).map(([m, n]) => ['Sold ' + MATERIALS[m].name.toLowerCase(), n])],
        resources: Object.entries(MATERIALS).filter(([, m]) => m.value).map(([k, m]) => [m.name, `$${m.value.toFixed(2)} at full purity${m.by ? ' (byproduct)' : ''}`]),
        upgrades: { rows: [['Modules', 'Install and swap modules in the Operation tab'], ['Removing a module', 'Refunds half its price']], gains: [] },
        operation: { core: true, rows: [], log: this.log.slice(0, 6) }
      },
      strip: [{ k: 'On line', v: this.units.length }, { k: 'Speed', v: Math.round(this.speed() * 100) + '%', f: this.speed(), c: 'var(--ok)' }, { k: 'Power', v: `${this.powerKw().toFixed(1)}/${E.capKw} kW`, f: this.powerKw() / E.capKw }, { k: 'Temp', v: Math.round(this.tempC) + ' °C', f: this.tempC / 100, c: this.tempC > 70 ? 'var(--bad)' : 'var(--warn)' }, { k: 'Pallet', v: `${this.outN}/${this.def.palletUnits}`, f: this.outN / this.def.palletUnits }, { k: 'Earned', v: '$' + this.earned.toFixed(0) }],
      actions: [{ id: 'core-sell', label: `Sell pallet (${this.outN})`, disabled: !this.outN }, { id: 'power', label: this.on ? 'Stop core' : 'Start core' }, { id: 'service', label: `Service $${this.repairCost()}` }]
    });
  }
}

// ---------------------------------------------------------------------------
// 3D. The core's origin is the centre of the transfer table; the spine runs along +z, the west conveyor arrives
// from +x. Module bays are at local z = 0.4 + 0.6 + k*1.25 (matching BAY_S).
export const BELT_Y = 0.8;
export function coreBase() {
  const root = new THREE.Group(); root.name = 'Production core'; root.userData.pick = 'core';
  box(2.3, 0.1, 9.0, M.concrete, 0, 0.05, 4.1, root);
  box(2.34, 0.02, 0.1, M.yellow, 0, 0.11, -0.38, root);
  // transfer table: a powered roller deck that turns units 90°, on a round base
  cyl(0.36, 0.62, 12, M.steelD, 0, 0.41, 0, root); box(0.82, 0.08, 0.82, M.yellowD, 0, BELT_Y - 0.08, 0, root);
  const rollers = new THREE.Group(); rollers.position.set(0, BELT_Y - 0.02, 0); root.add(rollers);
  for (let k = 0; k < 6; k++) cylX(0.03, 0.74, 8, M.steel, 0, 0, -0.32 + k * 0.128, rollers);
  box(0.05, 0.12, 0.82, M.yellow, -0.42, BELT_Y + 0.03, 0, root);
  box(0.82, 0.12, 0.05, M.yellow, 0, BELT_Y + 0.03, -0.42, root);
  // output end: a pallet for products and a waste bin
  box(1.0, 0.12, 0.8, M.wood, 0, 0.16, 8.25, root); [-0.4, 0, 0.4].forEach((dx) => box(0.1, 0.06, 0.8, M.woodD, dx, 0.13, 8.25, root));
  const items = []; const pg = new THREE.Group(); pg.position.set(0, 0.22, 8.25); root.add(pg);
  for (let k = 0; k < 12; k++) { const m = box(0.26, 0.2, 0.22, k % 2 ? M.cream : M.yellowD, -0.32 + (k % 3) * 0.32, 0.1 + Math.floor(k / 6) * 0.21, -0.22 + Math.floor((k % 6) / 3) * 0.3, pg); m.visible = false; items.push(m); }
  box(0.6, 0.6, 0.6, M.greenD, 0.95, 0.4, 8.0, root); box(0.64, 0.04, 0.64, M.dark, 0.95, 0.72, 8.0, root);
  box(0.9, 0.04, 0.3, M.steel, 0.55, 0.92, 7.62, root).rotation.z = 0.35; [0.25, 0.85].forEach((x) => box(0.04, 0.8, 0.04, M.steelD, x, 0.5, 7.62, root));
  // the core's power and control post at the output end
  box(0.3, 1.2, 0.24, M.green, -0.95, 0.7, 8.0, root); box(0.36, 0.05, 0.3, M.greenD, -0.95, 1.32, 8.0, root);
  const scr = screen(0.5, 0.3, 256, root, -0.95, 1.65, 8.18); box(0.56, 0.36, 0.06, M.dark, -0.95, 1.65, 8.14, root); box(0.06, 0.35, 0.06, M.steelD, -0.95, 1.4, 8.1, root);
  bake(root, [rollers, pg, scr.mesh]);
  return { root, rollers, pallet: { g: pg, items, show(f) { const n = Math.round(Math.max(0, Math.min(1, f)) * items.length); items.forEach((m, i) => { m.visible = i < n; }); } }, screen: scr };
}
/** A module housing for one bay, straddling the spine belt. Origin at the bay centre on the plinth. */
export function moduleModel(type) {
  const root = new THREE.Group(); root.name = MODULES[type].name; root.userData.pick = 'core';
  const spin = [], C = mat(MODULES[type].color || '#888888');
  if (type === 'empty') {
    [-1, 1].forEach((s) => { box(0.08, 0.3, 0.08, M.yellow, s * 0.7, 0.25, -0.5, root); box(0.08, 0.3, 0.08, M.yellow, s * 0.7, 0.25, 0.5, root); box(0.08, 0.04, 1.08, M.yellow, s * 0.7, 0.42, 0, root); });
    bake(root, []); return { root, spin };
  }
  // common portal: four posts from the plinth, a deck above the belt, a nameplate and a status light
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => { box(0.08, 1.05, 0.08, M.steelD, sx * 0.62, 0.62, sz * 0.48, root); box(0.18, 0.04, 0.18, M.steelD, sx * 0.62, 0.12, sz * 0.48, root); }));
  box(1.36, 0.08, 1.06, M.steelD, 0, 1.18, 0, root);
  box(0.5, 0.12, 0.02, C, 0, 1.1, 0.53, root);   // nameplate hung from the deck edge
  const lamp = box(0.06, 0.06, 0.06, glowMat('#3fd27a', 0.3), 0.5, 1.26, 0.45, root); lamp.userData.noOutline = true;
  if (type === 'cleaner') {
    box(1.0, 0.5, 0.8, C, 0, 1.47, 0, root); cyl(0.22, 0.4, 10, M.cream, 0.2, 1.92, 0, root); cyl(0.22, 0.3, 10, M.cream, 0.2, 1.57 + 0.0, 0, root, 0.05);
    cylX(0.06, 0.5, 8, M.steelD, -0.25, 2.0, 0, root); box(0.18, 0.18, 0.18, M.dark, -0.5, 2.0, 0, root);
    const fan = new THREE.Group(); fan.position.set(-0.6, 2.0, 0); root.add(fan); for (let k = 0; k < 3; k++) { const b = box(0.02, 0.16, 0.05, M.yellow, 0, 0, 0, fan); b.geometry.translate(0, 0.08, 0); b.rotation.x = k * 2.09; } spin.push({ g: fan, axis: 'x', k: 3 });
  } else if (type === 'dryer') {
    const drum = new THREE.Group(); drum.position.set(0, 1.62, 0); root.add(drum);
    cylZ(0.38, 1.0, 14, C, 0, 0, 0, drum); [-0.35, 0, 0.35].forEach((z) => cylZ(0.4, 0.05, 14, M.steelD, 0, 0, z, drum)); spin.push({ g: drum, axis: 'z', k: 0.3 });
    [-0.4, 0.4].forEach((z) => box(0.9, 0.2, 0.08, M.steelD, 0, 1.3, z, root));
    box(0.3, 0.3, 0.3, M.dark, -0.5, 1.37, 0.3, root); cyl(0.06, 0.9, 8, M.steelD, 0.45, 2.1, -0.3, root); cyl(0.08, 0.06, 8, M.black, 0.45, 2.56, -0.3, root);
    cylZ(0.06, 0.3, 8, M.steelD, 0.45, 1.65, -0.42, root);
  } else if (type === 'press') {
    cylZ(0.18, 1.0, 12, M.steel, 0, 1.42, 0, root); for (let k = 0; k < 6; k++) cylZ(0.195, 0.03, 12, M.dark, 0, 1.42, -0.4 + k * 0.16, root);
    box(0.5, 0.5, 0.3, C, 0, 1.47, -0.42, root); box(0.24, 0.26, 0.24, M.steelD, 0, 1.73, 0.15, root);
    const screw = new THREE.Group(); screw.position.set(0, 1.42, 0.52); root.add(screw); cylZ(0.06, 0.08, 6, M.dark, 0, 0, 0, screw); box(0.03, 0.14, 0.03, M.yellow, 0, 0, 0.02, screw); spin.push({ g: screw, axis: 'z', k: 0.6 });
    box(0.32, 0.04, 0.6, M.yellowD, 0.4, 1.25, 0.1, root).rotation.z = -0.3;
  } else if (type === 'mill') {
    box(1.0, 0.7, 0.8, C, 0, 1.57, 0, root); box(1.04, 0.06, 0.84, M.dark, 0, 1.95, 0, root);
    put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.16, 0.4, 4, 1).rotateY(Math.PI / 4), M.steel), 0, 2.18, 0);
    [-0.13, 0.13].forEach((z, i) => { const r = new THREE.Group(); r.position.set(0.52, 1.57, z); root.add(r); cylX(0.11, 0.06, 12, M.steelD, 0, 0, 0, r); box(0.07, 0.2, 0.03, M.dark, 0, 0, 0, r); spin.push({ g: r, axis: 'x', k: i ? -1 : 1 }); });
  } else if (type === 'mixer') {
    cyl(0.42, 0.7, 14, C, 0, 1.62, 0, root); cyl(0.44, 0.05, 14, M.yellow, 0, 1.98, 0, root); cyl(0.42, 0.2, 14, M.steelD, 0, 1.17, 0, root, 0.24);
    box(0.24, 0.2, 0.24, M.dark, 0, 2.1, 0, root);
    const pad = new THREE.Group(); pad.position.set(0, 2.24, 0); root.add(pad); cyl(0.03, 0.1, 6, M.steel, 0, 0, 0, pad); box(0.36, 0.03, 0.05, M.yellow, 0, 0.04, 0, pad); spin.push({ g: pad, axis: 'y', k: 0.5 });
  } else if (type === 'tank') {
    cyl(0.48, 1.3, 14, M.steel, 0, 1.87, 0, root); cyl(0.48, 0.3, 14, M.steelD, 0, 1.07, 0, root, 0.2); cyl(0.5, 0.05, 14, M.dark, 0, 2.52, 0, root);
    box(0.06, 1.0, 0.04, M.dark, 0.49, 1.9, 0, root);
    const lvl = box(0.04, 0.96, 0.05, glowMat('#58e0ff', 0.9), 0.5, 1.42, 0, root); lvl.geometry.translate(0, 0.48, 0); lvl.userData.noOutline = true; lvl.scale.y = 0.02; root.userData.level = lvl;
  } else if (type === 'cooler') {
    [-0.25, 0.25].forEach((x) => { box(0.12, 0.9, 0.9, M.dark, x, 1.68, 0, root); for (let k = 0; k < 6; k++) box(0.14, 0.03, 0.86, C, x, 1.3 + k * 0.15, 0, root); });
    [-0.25, 0.25].forEach((x) => { const f = new THREE.Group(); f.position.set(x, 2.18, 0); root.add(f); cyl(0.05, 0.06, 8, M.dark, 0, 0, 0, f); for (let k = 0; k < 4; k++) { const b = box(0.04, 0.02, 0.34, M.steel, 0, 0.03, 0, f); b.rotation.y = k * Math.PI / 4; } spin.push({ g: f, axis: 'y', k: 4 }); });
    box(0.8, 0.04, 0.9, M.steelD, 0, 2.14, 0, root);
  } else if (type === 'power') {
    box(1.0, 0.9, 0.7, C, 0, 1.67, 0, root); box(1.04, 0.05, 0.74, M.dark, 0, 2.14, 0, root);
    for (let k = 0; k < 3; k++) cyl(0.06, 0.3, 8, M.copper, -0.3 + k * 0.3, 2.3, 0, root);
    [-0.2, 0.2].forEach((x) => box(0.3, 0.7, 0.02, M.greenD, x, 1.67, 0.36, root));
  } else if (type === 'bottler') {
    box(1.0, 0.36, 0.8, C, 0, 1.4, 0, root);
    const table = new THREE.Group(); table.position.set(0, 1.62, 0); root.add(table); cyl(0.36, 0.06, 16, M.steel, 0, 0, 0, table);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; cyl(0.04, 0.16, 8, M.teal, Math.cos(a) * 0.28, 0.11, Math.sin(a) * 0.28, table); } spin.push({ g: table, axis: 'y', k: 0.4 });
    box(0.12, 0.6, 0.12, M.steelD, -0.42, 1.88, 0, root); box(0.4, 0.1, 0.12, M.steelD, -0.24, 2.2, 0, root); cyl(0.05, 0.12, 8, M.dark, -0.06, 2.1, 0, root);
  }
  bake(root, [...spin.map((s) => s.g), lamp, ...(root.userData.level ? [root.userData.level] : [])]);
  return { root, spin, lamp, level: root.userData.level || null };
}
/** Router after the sorter: a short belt section with a flap gate that swings to send units out of the -x side. */
export function router() {
  const root = new THREE.Group(); root.name = 'Crop router'; root.userData.pick = 'core';
  const L = 0.8;
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(0.07, BELT_Y - 0.1, 0.07, M.steelD, sx * 0.36, (BELT_Y - 0.1) / 2, sz * 0.32, root)));
  box(0.8, 0.1, L, M.greenD, 0, BELT_Y - 0.1, 0, root); box(0.74, 0.03, L, M.dark, 0, BELT_Y - 0.035, 0, root);
  box(0.06, 0.16, L, M.yellow, 0.42, BELT_Y + 0.04, 0, root);   // rail on the +x side only: -x is the side exit
  [-1, 1].forEach((sz) => box(0.06, 0.16, 0.06, M.yellow, -0.42, BELT_Y + 0.04, sz * 0.37, root));
  box(0.08, 0.6, 0.08, M.steelD, 0.42, BELT_Y + 0.38, 0.32, root); box(0.18, 0.16, 0.16, M.dark, 0.42, BELT_Y + 0.62, 0.32, root);
  const flap = new THREE.Group(); flap.position.set(0.38, BELT_Y + 0.08, 0.32); root.add(flap);
  box(0.03, 0.14, 0.7, M.red, 0, 0, -0.35, flap); cyl(0.025, 0.2, 8, M.steel, 0, 0.02, 0, flap);
  flap.rotation.y = 0;
  bake(root, [flap]);
  return { root, flap };
}
// product meshes for units on the line (crops use the farm's own item meshes)
const PG = {};
export function productGeo(m) {
  if (PG[m]) return PG[m];
  if (m === 'oil') PG[m] = new THREE.CylinderGeometry(0.09, 0.09, 0.16, 8).translate(0, 0.08, 0);
  else if (m === 'bottle') PG[m] = new THREE.CylinderGeometry(0.05, 0.06, 0.2, 8).translate(0, 0.1, 0);
  else if (m === 'cake') PG[m] = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10).translate(0, 0.025, 0);
  else if (m === 'bran' || m === 'waste') PG[m] = new THREE.DodecahedronGeometry(0.08, 0).translate(0, 0.05, 0);
  else PG[m] = new THREE.BoxGeometry(0.22, 0.14, 0.16).translate(0, 0.07, 0);
  return PG[m];
}
export const productMat = (m) => ({ oil: mat('#e6b422', { roughness: 0.3 }), bottle: mat('#e6b422', { roughness: 0.25 }), cake: mat('#8a6a3a'), bran: mat('#b08850'), waste: mat('#4a4038'), flour: mat('#efe9da'), sack: mat('#d8c9a0'), feed: mat('#7a9a3a'), feedsack: mat('#6f8f3a') }[m] || mat('#cccccc'));
