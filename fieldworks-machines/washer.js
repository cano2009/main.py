// Fieldworks WS-300 Brush Washer: hero machine built from the parts kit, plus detailed conveyors and an operator console.
// Flow runs along +x, belt top at y = 0.8. build() returns the model and an animate(dt, stats) function that drives
// every moving part, gauge, screen and light from the machine simulation (machine.js).

import * as THREE from 'three';
import * as P from './parts.js';

const V = THREE.Vector3;
export const BELT_Y = 0.8;

// ---------------------------------------------------------------------------
// Conveyor: channel frame, belt, head and tail drums, return idlers, legs with braces and base plates,
// drive motor and gearbox behind a guard, guide rails, speed sign.
export function conveyor(x0, x1, M, o) {
  o = o || {};
  const g = new THREE.Group(), len = x1 - x0, cx = (x0 + x1) / 2, W = o.width || 0.56;
  const bolts = P.boltSet(M.steel);
  // belt with a moving texture
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#26272a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#34363a'; x.fillRect(0, 0, 8, 64); x.fillStyle = '#1c1d1f'; x.fillRect(8, 0, 3, 64);
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(len / 0.1, 1);
  const beltMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const belt = P.mesh(new THREE.BoxGeometry(len, 0.012, W - 0.02), beltMat, cx, BELT_Y - 0.006, 0, g);
  const ret = P.mesh(new THREE.BoxGeometry(len - 0.1, 0.008, W - 0.04), M.rubber, cx, BELT_Y - 0.13, 0, g); void ret;
  // side channels (C-section look: web + two lips)
  [-1, 1].forEach((s) => {
    const z = s * (W / 2 + 0.02);
    const web = P.panel(len + 0.06, 0.12, 0.012, M.paint, 0.003); web.position.set(cx, BELT_Y - 0.05, z); g.add(web);
    [0.01, -0.11].forEach((dy) => { const lip = P.panel(len + 0.06, 0.012, 0.04, M.paint, 0.003); lip.position.set(cx, BELT_Y + dy, z + s * 0.014); g.add(lip); });
    bolts.row(new V(x0 + 0.05, BELT_Y - 0.05, z + s * 0.007), new V(x1 - 0.05, BELT_Y - 0.05, z + s * 0.007), new V(0, 0, s), Math.max(2, Math.round(len / 0.25)), 0.005);
    // guide rail on posts
    const rail = P.panel(len, 0.02, 0.02, M.paint2, 0.004); rail.position.set(cx, BELT_Y + 0.075, s * (W / 2 - 0.005)); g.add(rail);
    for (let i = 0; i <= Math.round(len / 0.5); i++) { const px = x0 + 0.06 + i * (len - 0.12) / Math.round(len / 0.5); const post = P.panel(0.014, 0.07, 0.014, M.steel, 0.003); post.position.set(px, BELT_Y + 0.035, s * (W / 2 + 0.008)); g.add(post); }
  });
  // drums and idlers
  const drums = [];
  [x0, x1].forEach((xx) => drums.push(P.mesh(new THREE.CylinderGeometry(0.06, 0.06, W - 0.03, 24).rotateX(Math.PI / 2), M.steel, xx, BELT_Y - 0.066, 0, g)));
  for (let i = 1; i < Math.round(len / 0.45); i++) drums.push(P.mesh(new THREE.CylinderGeometry(0.022, 0.022, W - 0.06, 14).rotateX(Math.PI / 2), M.steel, x0 + i * 0.45, BELT_Y - 0.15, 0, g));
  // legs
  const nLegs = Math.max(2, Math.round(len / 0.9) + 1);
  for (let i = 0; i < nLegs; i++) {
    const lx = x0 + 0.1 + (i / (nLegs - 1)) * (len - 0.2);
    [-1, 1].forEach((s) => {
      const z = s * (W / 2 + 0.03);
      g.add(P.beam(new V(lx, 0.012, z), new V(lx, BELT_Y - 0.11, z), 0.045, M.paint));
      g.add(P.basePlate(0.11, M, bolts, new V(lx, 0, z)));
    });
    g.add(P.beam(new V(lx, 0.28, -(W / 2 + 0.03)), new V(lx, 0.28, W / 2 + 0.03), 0.035, M.paint));
    const gu = P.gusset(0.07, 0.006, M.paint); gu.position.set(lx + 0.02, BELT_Y - 0.11, W / 2 + 0.03); gu.rotation.z = Math.PI; g.add(gu);
  }
  // drive at the tail end: motor + gearbox under a guard
  const driveX = o.driveAt === 'head' ? x1 : x0;
  const mot = P.motor({ length: 0.2, radius: 0.055 }, M); mot.rotation.y = Math.PI / 2; mot.position.set(driveX + (o.driveAt === 'head' ? -0.15 : 0.15), BELT_Y - 0.2, -(W / 2 + 0.16)); g.add(mot);
  const gb = P.gearbox({ w: 0.15, h: 0.14, d: 0.12 }, M); gb.position.set(driveX, BELT_Y - 0.08, -(W / 2 + 0.12)); g.add(gb);
  const gd = P.guard(0.3, 0.22, M); gd.position.set(driveX + (o.driveAt === 'head' ? -0.08 : 0.08), BELT_Y - 0.13, -(W / 2 + 0.26)); g.add(gd);
  P.cable(new V(driveX + 0.15, BELT_Y - 0.12, -(W / 2 + 0.14)), new V(driveX + 0.5, 0.02, -(W / 2 + 0.1)), 0.008, M.cable, 0.05);
  bolts.build(g);
  return { group: g, belt, tex, drums, motorShaft: mot.userData.shaft, len };
}

// ---------------------------------------------------------------------------
export function build(M, opts) {
  opts = opts || {};
  const root = new THREE.Group(); root.name = 'WS-300';
  const machine = new THREE.Group(); machine.name = 'WS-300 washer'; root.add(machine);
  const bolts = P.boltSet(M.steel);
  const X = 1.0, Z = 0.55, TANK_B = 0.45, TANK_T = 0.75, HOOD_T = 1.62;
  const live = { brushes: [], pulleys: [], fans: [], gauges: {}, screens: {}, glow: {}, flaps: [], waterColumn: null, doors: {} };

  // ---------- frame ----------
  [[-X + 0.04, -Z + 0.04], [-X + 0.04, Z - 0.04], [X - 0.04, -Z + 0.04], [X - 0.04, Z - 0.04]].forEach(([x, z]) => {
    machine.add(P.beam(new V(x, 0.012, z), new V(x, TANK_B, z), 0.07, M.darkSteel));
    machine.add(P.basePlate(0.15, M, bolts, new V(x, 0, z)));
    const gu = P.gusset(0.12, 0.008, M.darkSteel); gu.position.set(x + (x < 0 ? 0.035 : -0.035), TANK_B - 0.005, z); gu.rotation.z = x < 0 ? -Math.PI / 2 : Math.PI; gu.rotation.y = 0; machine.add(gu);
  });
  [-1, 1].forEach((s) => {
    machine.add(P.beam(new V(-X + 0.04, 0.16, s * (Z - 0.04)), new V(X - 0.04, 0.16, s * (Z - 0.04)), 0.05, M.darkSteel).rotateZ(0));
    machine.add(P.beam(new V(-X + 0.07, 0.18, s * (Z - 0.04)), new V(-0.1, TANK_B - 0.03, s * (Z - 0.04)), 0.04, M.darkSteel));
    machine.add(P.beam(new V(X - 0.07, 0.18, s * (Z - 0.04)), new V(0.1, TANK_B - 0.03, s * (Z - 0.04)), 0.04, M.darkSteel));
  });
  [-1, 1].forEach((s) => machine.add(P.beam(new V(s * (X - 0.04), 0.16, -Z + 0.04), new V(s * (X - 0.04), 0.16, Z - 0.04), 0.05, M.darkSteel)));

  // ---------- stainless tank ----------
  const tank = P.panel(2 * X - 0.02, TANK_T - TANK_B, 2 * Z - 0.02, M.stainless, 0.02); tank.position.set(0, (TANK_B + TANK_T) / 2, 0); machine.add(tank);
  const rim = P.panel(2 * X + 0.02, 0.025, 2 * Z + 0.02, M.stainless, 0.006); rim.position.set(0, TANK_T, 0); machine.add(rim);
  bolts.row(new V(-X + 0.08, TANK_T + 0.013, Z + 0.004), new V(X - 0.08, TANK_T + 0.013, Z + 0.004), new V(0, 1, 0), 12, 0.006);
  bolts.row(new V(-X + 0.08, TANK_T + 0.013, -Z - 0.004), new V(X - 0.08, TANK_T + 0.013, -Z - 0.004), new V(0, 1, 0), 12, 0.006);
  // seam ribs on the tank
  for (let i = -2; i <= 2; i++) { const r = P.panel(0.02, TANK_T - TANK_B - 0.04, 0.012, M.stainless, 0.004); r.position.set(i * 0.38, (TANK_B + TANK_T) / 2, Z + 0.002); machine.add(r); }
  // water level sight glass (front left) with a live water column
  const sg = new THREE.Group(); sg.position.set(-X + 0.16, (TANK_B + TANK_T) / 2, Z + 0.03); machine.add(sg);
  P.mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 16), M.glass, 0, 0, 0, sg).castShadow = false;
  [-0.14, 0.14].forEach((y) => P.mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 16), M.chrome, 0, y, 0, sg));
  const colMat = new THREE.MeshStandardMaterial({ color: 0x0c2b38, emissive: new THREE.Color('#2fd6ff').convertSRGBToLinear(), emissiveIntensity: 1.6, roughness: 0.2 });
  live.waterColumn = P.mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.25, 12).translate(0, 0.125, 0), colMat, 0, -0.125, 0, sg);
  live.waterColumn.castShadow = false;
  // drain with ball valve
  const drain = P.pipe([[X - 0.25, TANK_B + 0.02, Z - 0.15], [X - 0.25, 0.22, Z - 0.15], [X - 0.25, 0.22, Z + 0.25]], 0.022, M.steel, M);
  machine.add(drain);
  const valve = new THREE.Group(); valve.position.set(X - 0.25, 0.22, Z + 0.1); machine.add(valve);
  P.mesh(new THREE.SphereGeometry(0.034, 16, 12), M.brass, 0, 0, 0, valve);
  const lever = P.panel(0.16, 0.012, 0.022, M.red, 0.004); lever.position.set(0.07, 0.045, 0); valve.add(lever);
  P.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 10), M.steel, 0, 0.025, 0, valve);

  // ---------- brush bed ----------
  [-1, 1].forEach((s) => { const r = P.panel(2 * X - 0.1, 0.05, 0.03, M.darkSteel, 0.004); r.position.set(0, BELT_Y - 0.06, s * 0.4); machine.add(r); });
  for (let i = 0; i < 9; i++) {
    const bx = -0.76 + i * 0.19;
    const br = new THREE.Group(); br.position.set(bx, BELT_Y - 0.05, 0); machine.add(br);
    P.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 20).rotateX(Math.PI / 2), M.brush || M.motor, 0, 0, 0, br);
    for (let k = 0; k < 6; k++) P.mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 20).rotateX(Math.PI / 2), M.darkSteel, 0, 0, -0.3 + k * 0.12, br).castShadow = false;
    P.mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 10).rotateX(Math.PI / 2), M.chrome, 0, 0, -0.25, br);
    const sp = P.pulley(0.032, 0.02, M, { grooves: 1 }); sp.position.set(0, 0, -0.84); br.add(sp);
    [-1, 1].forEach((s) => { const bb = P.bearingBlock(0.012, M); bb.position.set(bx, BELT_Y - 0.05, s * 0.43); bb.rotation.x = s < 0 ? 0 : 0; machine.add(bb); });
    live.brushes.push(br);
  }
  // brush drive belt along the back, behind a guard
  machine.add(P.belt(new V(-0.76, BELT_Y - 0.05, 0), 0.034, new V(0.76, BELT_Y - 0.05, 0), 0.034, 0.016, M.rubber).translateZ(-0.84));
  const longGuard = P.guard(1.7, 0.16, M); longGuard.position.set(0, BELT_Y - 0.05, -0.88); machine.add(longGuard);

  // ---------- main drive: motor under the tank, belt to gearbox, gearbox to brush line ----------
  const mot = P.motor({ length: 0.34, radius: 0.1 }, M);
  mot.rotation.y = Math.PI / 2;              // shaft points to -z (out of the back)
  mot.position.set(0.72, 0.21, -0.54);
  machine.add(mot);
  const motorTipZ = -0.54 - 0.34 * 0.95;
  const pm = P.pulley(0.055, 0.05, M); pm.position.set(0.72, 0.21, motorTipZ + 0.02); machine.add(pm);
  const gb = P.gearbox({ w: 0.3, h: 0.24, d: 0.2 }, M); gb.rotation.y = Math.PI; gb.position.set(0.72, 0.52, -0.66); machine.add(gb);
  const gbIn = new V(0.72 + 0.3 * 0.28, 0.52 - 0.24 * 0.18, motorTipZ + 0.02);
  const pg = P.pulley(0.12, 0.05, M); pg.position.copy(gbIn); machine.add(pg);
  machine.add(P.belt(new V(0.72, 0.21, 0), 0.05, new V(gbIn.x, gbIn.y, 0), 0.112, 0.04, M.rubber).translateZ(motorTipZ + 0.02));
  const drvGuard = P.guard(0.36, 0.56, M); drvGuard.position.set(0.76, 0.36, motorTipZ - 0.04); machine.add(drvGuard);
  const gbOut = new V(0.72 - 0.3 * 0.25, 0.52 + 0.24 * 0.2, -0.84);
  const po = P.pulley(0.04, 0.025, M, { grooves: 1 }); po.position.copy(gbOut); machine.add(po);
  machine.add(P.belt(new V(gbOut.x, gbOut.y, 0), 0.04, new V(0.76, BELT_Y - 0.05, 0), 0.034, 0.016, M.rubber).translateZ(-0.84));
  live.pulleys.push({ obj: pm, ratio: 1 }, { obj: pg, ratio: 0.46 }, { obj: po, ratio: 0.12 }, { obj: mot.userData.shaft, ratio: 1, axis: 'x' });
  P.mesh(new THREE.BoxGeometry(0.5, 0.02, 0.32), M.darkSteel, 0.72, 0.1, -0.54, machine);
  // red power leads from the motor terminal box (the engine-wire look from the reference)
  for (let k = 0; k < 3; k++) machine.add(P.cable(new V(0.72 + 0.12, 0.36, -0.5 + k * 0.03), new V(1.3 + k * 0.03, 0.84, -0.92), 0.007, M.redWire, 0.1));

  // ---------- hood ----------
  [[-X + 0.025, -Z + 0.025], [-X + 0.025, Z - 0.025], [X - 0.025, -Z + 0.025], [X - 0.025, Z - 0.025]].forEach(([x, z]) => machine.add(P.beam(new V(x, TANK_T, z), new V(x, HOOD_T, z), 0.05, M.paint)));
  const roof = P.panel(2 * X + 0.06, 0.05, 2 * Z + 0.06, M.paint, 0.012); roof.position.set(0, HOOD_T + 0.025, 0); machine.add(roof);
  const roofTrim = P.panel(2 * X + 0.07, 0.02, 2 * Z + 0.07, M.paint2, 0.006); roofTrim.position.set(0, HOOD_T - 0.005, 0); machine.add(roofTrim);
  // back: two access doors with louvres
  [-0.5, 0.42].forEach((x0, i) => { const d = P.accessDoor(0.86, 0.78, M, { louvres: true }); d.position.set(x0 + (i ? -0.42 : -0.43), (TANK_T + HOOD_T) / 2 + 0.01, -Z - 0.01); d.rotation.y = Math.PI; d.position.x += 0.86; machine.add(d); live.doors['back' + i] = d; });
  // front: window door (left) and a solid door (right)
  const fw = P.accessDoor(1.1, 0.8, M, { window: true }); fw.position.set(-X + 0.05, (TANK_T + HOOD_T) / 2 + 0.01, Z + 0.01); machine.add(fw); live.doors.front = fw;
  const fd = P.accessDoor(0.78, 0.8, M, { louvres: true }); fd.position.set(-X + 1.17, (TANK_T + HOOD_T) / 2 + 0.01, Z + 0.01); machine.add(fd);
  // ends: frame around the produce opening, hazard stripes, flap curtain
  const OY0 = BELT_Y - 0.02, OY1 = BELT_Y + 0.38, OZ = 0.34;
  [-1, 1].forEach((s) => {
    const x = s * (X + 0.005);
    const top = P.panel(0.03, HOOD_T - OY1, 2 * Z, M.paint, 0.006); top.position.set(x, (HOOD_T + OY1) / 2, 0); machine.add(top);
    const low = P.panel(0.03, OY0 - TANK_T, 2 * Z, M.paint, 0.006); low.position.set(x, (OY0 + TANK_T) / 2, 0); machine.add(low);
    [-1, 1].forEach((t) => { const side = P.panel(0.03, OY1 - OY0, Z - OZ, M.paint, 0.006); side.position.set(x, (OY0 + OY1) / 2, t * (OZ + (Z - OZ) / 2)); machine.add(side); });
    const hz = P.hazardStripe(2 * OZ + 0.1, 0.05); hz.position.set(x + s * 0.017, OY1 + 0.04, 0); hz.rotation.y = s * Math.PI / 2; machine.add(hz);
    for (let k = 0; k < 8; k++) {
      const pv = new THREE.Group(); pv.position.set(x + s * 0.02, OY1, -OZ + 0.04 + k * (2 * OZ - 0.08) / 7); machine.add(pv);
      const f = P.panel(0.006, OY1 - OY0 - 0.03, 0.08, M.rubber, 0.002); f.position.y = -(OY1 - OY0 - 0.03) / 2; f.castShadow = false; pv.add(f);
      live.flaps.push({ pivot: pv, x: x, side: s });
    }
  });
  // roof: exhaust fan, spray manifold, stack light
  const fn = P.fan(0.14, M); fn.position.set(-0.45, HOOD_T + 0.05, -0.1); machine.add(fn); live.fans.push(fn.userData.rotor);
  // spray bars inside
  [-0.35, 0.35].forEach((x) => {
    P.mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 14).rotateX(Math.PI / 2), M.stainless, x, 1.42, 0, machine);
    for (let k = 0; k < 6; k++) { const n = P.mesh(new THREE.ConeGeometry(0.013, 0.035, 10), M.brass, x, 1.39, -0.28 + k * 0.112, machine); n.rotation.x = Math.PI; }
  });

  // ---------- pump skid (back left): motor, pump, filter, valve, pipework to roof manifold ----------
  const skid = new THREE.Group(); skid.position.set(-0.6, 0, -0.98); root.add(skid);
  const base = P.panel(0.8, 0.06, 0.42, M.darkSteel, 0.006); base.position.y = 0.03; skid.add(base);
  [-0.35, 0.35].forEach((x) => [-0.17, 0.17].forEach((z) => bolts.add(new V(-0.6 + x, 0.062, -0.98 + z), new V(0, 1, 0), 0.007)));
  const pmot = P.motor({ length: 0.3, radius: 0.085 }, M); pmot.position.set(0.12, 0.17, 0); skid.add(pmot);
  // pump volute
  const volute = new THREE.Group(); volute.position.set(-0.13, 0.17, 0); skid.add(volute);
  P.mesh(new THREE.LatheGeometry([new THREE.Vector2(0.02, -0.06), new THREE.Vector2(0.11, -0.05), new THREE.Vector2(0.125, 0), new THREE.Vector2(0.11, 0.05), new THREE.Vector2(0.02, 0.06)], 32).rotateZ(Math.PI / 2), M.castIron, 0, 0, 0, volute);
  bolts.circle(new V(-0.13 - 0.6 - 0.065, 0.17, -0.98), new V(-1, 0, 0), 0.095, 8, 0.006);
  live.pulleys.push({ obj: pmot.userData.shaft, ratio: 1.4, axis: 'x' });
  // filter canister (domed, like a gas bottle)
  const filt = new THREE.Group(); filt.position.set(-0.3, 0.06, 0.08); skid.add(filt);
  P.mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.32, 24), M.motor, 0, 0.2, 0, filt);
  P.mesh(new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.motor, 0, 0.36, 0, filt);
  P.mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.05, 14), M.brass, 0, 0.44, 0, filt);
  P.mesh(new THREE.TorusGeometry(0.076, 0.008, 8, 24).rotateX(Math.PI / 2), M.darkSteel, 0, 0.12, 0, filt);
  // suction from tank, delivery up the back to the roof manifold
  root.add(P.pipe([[-0.2, 0.55, -Z], [-0.2, 0.55, -0.8], [-0.2, 0.34, -0.8], [-0.73, 0.34, -0.8], [-0.73, 0.17, -0.98]], 0.026, M.steel, M, { flanges: true }));
  root.add(P.pipe([[-0.6 - 0.13 - 0.1, 0.17, -0.98], [-0.98, 0.17, -0.98], [-0.98, HOOD_T + 0.12, -0.98], [-0.98, HOOD_T + 0.12, -0.25], [-0.35, HOOD_T + 0.12, -0.25], [0.35, HOOD_T + 0.12, -0.25]], 0.026, M.stainless, M, { couplings: 2 }));
  [-0.35, 0.35].forEach((x) => root.add(P.pipe([[x, HOOD_T + 0.12, -0.25], [x, HOOD_T + 0.12, 0], [x, HOOD_T + 0.04, 0]], 0.02, M.stainless, M, { flanges: false })));
  const pg1 = P.gauge(0.05, M, { unit: 'bar', marks: ['0', '', '2', '', '4', '', '6'], red: 0.83, green: [0.45, 0.75] });
  pg1.position.set(-0.98, HOOD_T + 0.12, -0.9); pg1.rotation.y = -Math.PI / 2; root.add(pg1);
  P.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 10).rotateZ(Math.PI / 2), M.brass, -0.95, HOOD_T + 0.12, -0.9, root);
  live.gauges.pressure = pg1;
  // ball valve on the delivery line
  const bv = new THREE.Group(); bv.position.set(-0.98, 0.7, -0.98); root.add(bv);
  P.mesh(new THREE.SphereGeometry(0.04, 16, 12), M.brass, 0, 0, 0, bv);
  const bl = P.panel(0.14, 0.012, 0.022, M.red, 0.004); bl.position.set(0, 0.03, 0.07); bl.rotation.y = Math.PI / 2; bv.add(bl);

  // ---------- electrical cabinet on the back ----------
  const CABX = 1.38, CABZ = -0.92;
  const cab = P.cabinet({ w: 0.42, h: 0.56, d: 0.2 }, M); cab.position.set(CABX, 1.12, CABZ); root.add(cab);
  root.add(P.beam(new V(CABX, 0.012, CABZ - 0.02), new V(CABX, 0.84, CABZ - 0.02), 0.06, M.darkSteel));
  root.add(P.basePlate(0.16, M, bolts, new V(CABX, 0, CABZ - 0.02)));
  const cabLbl = P.label(0.2, 0.06, ['DANGER 400 V', 'Isolate before opening'], { bg: '#f2c21f' }); cabLbl.position.set(CABX + 0.02, 1.3, CABZ + 0.135); root.add(cabLbl);
  live.cabinetLed = new V(CABX + 0.15, 1.36, CABZ + 0.11);

  // ---------- labels ----------
  const np = P.label(0.34, 0.12, ['FIELDWORKS MACHINERY', 'WS-300 Brush Washer', '400 V 3~  6.2 kW  SN 0427'], { bg: '#d9dcde', metal: true });
  np.position.set(0.6, 0.62, Z + 0.012); root.add(np);
  const warn = P.label(0.26, 0.09, ['DANGER', 'Rotating brushes. Do not reach in.'], { bg: '#f2c21f' });
  warn.position.set(X - 0.36, 1.5, Z + 0.03); root.add(warn);

  // ---------- operator console (front left) ----------
  const con = P.console_({ w: 0.8, h: 1.08, d: 0.58 }, M); con.position.set(-1.65, 0, 0.95); con.rotation.y = 0.55; root.add(con);
  const desk = con.userData.desk, upper = con.userData.upper;
  const scr = P.screen(0.5, 0.28, M, { px: 640 }); scr.position.set(0, 0.0, 0.004); upper.add(scr); live.screens.console = scr.userData;
  const kp = P.keypad(4, 3, 0.022, M); kp.position.set(0.24, -0.02, 0); desk.add(kp);
  const es = P.emergencyStop(0.024, M); es.position.set(-0.3, 0.02, 0); desk.add(es); live.estop = es;
  const kn = P.selectorKnob(0.022, M); kn.position.set(-0.17, 0.06, 0); desk.add(kn); live.knob = kn.userData.knob;
  const bStart = P.pushButton(0.016, '#2fbf55', M); bStart.position.set(-0.17, -0.06, 0); desk.add(bStart);
  const bStop = P.pushButton(0.016, '#202224', M); bStop.position.set(-0.08, -0.06, 0); desk.add(bStop);
  const tg = [0, 1, 2].map((i) => { const t = P.toggleSwitch(0.012, M); t.position.set(-0.02 + i * 0.05, 0.06, 0); desk.add(t); return t.userData.lever; });
  live.toggles = tg;
  const pilots = ['#2fe06a', '#ffae1a', '#ff2a1f'].map((c, i) => { const b = P.pushButton(0.011, c, M); b.position.set(0.02 + i * 0.045, -0.06, 0); desk.add(b); return b.userData.cap; });
  live.pilots = { running: pilots[0], waiting: pilots[1], stopped: pilots[2], start: bStart.userData.cap };
  const conLbl = P.label(0.22, 0.05, ['WS-300  Operator station'], { bg: '#d9dcde', metal: true }); conLbl.position.set(0, -0.19, 0.004); upper.add(conLbl);
  // conduit from console to the machine along the floor
  const tray = P.panel(1.2, 0.03, 0.08, M.darkSteel, 0.004); tray.position.set(-1.05, 0.015, 0.75); tray.rotation.y = 0.4; root.add(tray);
  // machine-mounted mini status screen beside the window
  const mini = P.screen(0.22, 0.12, M, { px: 384 }); mini.position.set(0.55, 1.42, Z + 0.035); root.add(mini); live.screens.mini = mini.userData;

  bolts.build(root);

  // ---------- animation ----------
  let spin = 0, screenT = 0;
  function animate(dt, s, items) {
    const st = s.identity.status, run = st === 'running';
    const speed = run ? s.performance.beltSpeed : 0;
    spin += speed * dt;
    live.brushes.forEach((b) => { b.rotation.z = -spin / 0.05 * 1.6; });
    live.pulleys.forEach((p) => { if (p.axis === 'x') p.obj.rotation.x = spin * 40 * p.ratio; else p.obj.rotation.z = -spin * 40 * p.ratio; });
    live.fans.forEach((f) => { f.rotation.y += dt * (st === 'off' ? 0 : run ? 18 : 6); });
    live.gauges.pressure.userData.setValue(s.performance.sprayBar / 6);
    live.waterColumn.scale.y = Math.max(0.02, s.resources.water / s.resources.waterCap);
    live.knob.rotation.z = -0.6 + s.upgrades.level * 0.6;
    live.toggles.forEach((t, i) => { t.rotation.x = (i === 0 ? st !== 'off' : i === 1 ? s.performance.sprayBar > 0.5 : s.performance.condition > 40) ? -0.4 : 0.4; });
    Object.entries(live.pilots).forEach(([k, cap]) => { const on = k === 'start' ? st !== 'off' : st === k; cap.material.emissiveIntensity = on ? (k === 'waiting' ? (Math.sin(performance.now() / 160) > 0 ? 3 : 0.2) : 3) : 0.05; });
    if (items) live.flaps.forEach((f) => {
      const near = items.some((it) => Math.abs(it.x - f.x) < 0.22);
      const target = near ? 0.55 * f.side : 0;
      f.pivot.rotation.z += (target - f.pivot.rotation.z) * Math.min(1, dt * 8);
    });
    screenT -= dt;
    if (screenT <= 0) { screenT = 0.25; drawConsole(live.screens.console, s); drawMini(live.screens.mini, s); }
  }

  return { root, machine, console: con, live, animate, X, Z, HOOD_T };
}

// ---------------------------------------------------------------------------
// Screens. Only values from Machine.stats().
const STATUS_COL = { running: '#2fe06a', waiting: '#ffae1a', stopped: '#ff4a3a', off: '#7c8590' };
function bar(x, X0, Y0, W, H, f, col) { x.fillStyle = '#1d2a33'; x.fillRect(X0, Y0, W, H); x.fillStyle = col; x.fillRect(X0, Y0, W * Math.max(0, Math.min(1, f)), H); }
function drawConsole(sd, s) {
  const x = sd.ctx, W = sd.canvas.width, H = sd.canvas.height, p = s.performance, r = s.resources, o = s.operation, st = s.identity.status;
  x.fillStyle = '#0b1419'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#12232c'; x.fillRect(0, 0, W, 52);
  x.fillStyle = '#d9f2ff'; x.font = '700 26px Arial'; x.textBaseline = 'middle'; x.fillText(`${s.identity.model}  ${s.identity.name.toUpperCase()}`, 18, 27);
  x.fillStyle = STATUS_COL[st]; x.fillRect(W - 170, 12, 152, 30); x.fillStyle = '#0b1419'; x.font = '700 18px Arial'; x.textAlign = 'center'; x.fillText(st.toUpperCase(), W - 94, 28); x.textAlign = 'left';
  x.fillStyle = '#8fb3c4'; x.font = '500 15px Arial'; x.fillText(o.fault || s.identity.reason, 18, 70);
  const col = (cx, label, val, unit) => { x.fillStyle = '#7fa1b2'; x.font = '500 14px Arial'; x.fillText(label, cx, 100); x.fillStyle = '#e8f6ff'; x.font = '700 34px Arial'; x.fillText(val, cx, 134); x.fillStyle = '#7fa1b2'; x.font = '500 14px Arial'; x.fillText(unit, cx, 162); };
  col(18, 'THROUGHPUT', p.throughputPerMin.toFixed(1), `items/min  max ${Math.round(p.maxPerMin)}`);
  col(230, 'BELT', p.beltSpeed.toFixed(2), 'm/s');
  col(360, 'POWER', p.powerKw.toFixed(1), `kW  rated ${p.ratedKw.toFixed(1)}`);
  col(520, 'MOTOR', Math.round(p.motorC) + '°', 'C');
  const rows = [['WATER', r.water / r.waterCap, `${Math.round(r.water)} / ${r.waterCap} L`, '#2fd6ff'], ['CONDITION', p.condition / 100, `${Math.round(p.condition)}%  ${o.maintenance}`, p.condition < 40 ? '#ff4a3a' : p.condition < 70 ? '#ffae1a' : '#2fe06a'], ['INPUT', r.inCount / r.inCap, `${r.inCount} / ${r.inCap}`, '#b9c4cc'], ['OUTPUT', r.outCount / r.outCap, `${r.outCount} / ${r.outCap}`, '#b9c4cc']];
  rows.forEach(([label, f, txt, c], i) => { const y = 188 + i * 30; x.fillStyle = '#7fa1b2'; x.font = '600 14px Arial'; x.fillText(label, 18, y + 9); bar(x, 120, y, 330, 18, f, c); x.fillStyle = '#e8f6ff'; x.font = '500 15px Arial'; x.fillText(txt, 462, y + 9); });
  x.fillStyle = '#7fa1b2'; x.font = '500 14px Arial'; x.fillText(`${o.task}   ${o.progress ? Math.round(o.progress * 100) + '%' : ''}   Level ${s.upgrades.level}/${s.upgrades.maxLevel}   Total ${p.totalDone}`, 18, H - 16);
  sd.texture.needsUpdate = true;
}
function drawMini(sd, s) {
  const x = sd.ctx, W = sd.canvas.width, H = sd.canvas.height, st = s.identity.status, p = s.performance;
  x.fillStyle = '#0b1419'; x.fillRect(0, 0, W, H);
  x.fillStyle = STATUS_COL[st]; x.fillRect(0, 0, 10, H);
  x.fillStyle = '#e8f6ff'; x.font = '700 30px Arial'; x.textBaseline = 'middle'; x.fillText(st.toUpperCase(), 26, 40);
  x.fillStyle = '#9fc1d2'; x.font = '600 22px Arial'; x.fillText(`${p.throughputPerMin.toFixed(1)}/min  ${p.sprayBar.toFixed(1)} bar`, 26, 92);
  x.fillText(`${Math.round(p.motorC)}°C  ${Math.round(p.condition)}%`, 26, 136);
  x.fillStyle = '#5f7f8f'; x.font = '500 18px Arial'; x.fillText(s.identity.model, W - 100, 180);
  sd.texture.needsUpdate = true;
}
