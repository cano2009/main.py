/* Fieldworks washing station: infeed conveyor, brush-and-spray washer, outfeed conveyor and a crate.
   Flow runs along +x. Belt top is at y = 0.8 m. Needs a global THREE (r147).
   build({ beltTexture, labelTexture }) returns the model plus the moving parts for animation. */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const col = (h) => new THREE.Color(h).convertSRGBToLinear();
  const BELT_Y = 0.8;

  function build(opts) {
    opts = opts || {};
    const g = new THREE.Group(); g.name = 'WashingStation';
    const std = (name, c, metal, rough, extra) => Object.assign(new THREE.MeshStandardMaterial({ name, color: col(c), metalness: metal, roughness: rough }), extra || {});
    const M = {
      steel: std('steel', '#c9ccd0', 0.85, 0.3),
      frame: std('frame', '#3b4148', 0.6, 0.45),
      roller: std('roller', '#9aa0a6', 0.8, 0.35),
      brush: std('brush', '#2f6fb0', 0, 0.95),
      core: std('brush_core', '#1d3f66', 0.2, 0.7),
      rubber: std('rubber', '#1d1e20', 0, 0.9),
      yellow: std('safety_yellow', '#e8b22a', 0.2, 0.5),
      wood: std('wood', '#a27b4d', 0, 0.85),
      woodDark: std('wood_dark', '#7d5a36', 0, 0.9),
      panel: std('panel', '#2c3a4a', 0.4, 0.5),
      tank: std('tank', '#3d6d8f', 0.5, 0.4),
      motor: std('motor', '#4a6b52', 0.5, 0.45),
      black: std('black', '#16181a', 0.3, 0.6),
      glass: std('glass', '#cfeaf5', 0.1, 0.05, { transparent: true, opacity: 0.2, depthWrite: false }),
      water: std('water', '#6fb6dd', 0.1, 0.08, { transparent: true, opacity: 0.6 }),
      green: std('light_green', '#36d46a', 0, 0.4, { emissive: col('#36d46a'), emissiveIntensity: 1.6 }),
      amber: std('light_amber', '#7a5a1c', 0, 0.5),
      red: std('light_red', '#6e1e1e', 0, 0.5),
      estop: std('estop', '#d2281f', 0.1, 0.4),
      screen: std('screen', '#2fb59a', 0, 0.3, { emissive: col('#2fb59a'), emissiveIntensity: 0.9 })
    };
    function mesh(geo, mat, x, y, z, parent) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      (parent || g).add(m); return m;
    }
    const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
    function cyl(r, len, mat, x, y, z, axis, seg, p) {
      const geo = new THREE.CylinderGeometry(r, r, len, seg || 16);
      if (axis === 'x') geo.rotateZ(Math.PI / 2); else if (axis === 'z') geo.rotateX(Math.PI / 2);
      return mesh(geo, mat, x, y, z, p);
    }
    function pipe(points, r, mat) {
      return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), 24, r, 8, false), mat, 0, 0, 0);
    }

    // ---------- conveyor ----------
    const belts = [];
    function conveyor(x0, x1, width, name) {
      const len = x1 - x0, cx = (x0 + x1) / 2;
      const beltMat = std(name + '_belt', '#2b2c2e', 0, 0.85);
      if (opts.beltTexture) {
        beltMat.map = opts.beltTexture.clone(); beltMat.map.needsUpdate = true;
        beltMat.map.wrapS = beltMat.map.wrapT = THREE.RepeatWrapping; beltMat.map.repeat.set(len / 0.12, 1);
        beltMat.color.set(0xffffff);
      }
      const belt = box(len, 0.03, width, beltMat, cx, BELT_Y - 0.015, 0);
      belt.name = name + '_belt';
      belts.push(belt);
      [-1, 1].forEach((s) => {
        box(len + 0.04, 0.09, 0.035, M.frame, cx, BELT_Y - 0.01, s * (width / 2 + 0.03));
        box(len + 0.04, 0.025, 0.04, M.yellow, cx, BELT_Y + 0.045, s * (width / 2 + 0.03));
      });
      [x0, x1].forEach((x) => cyl(0.04, width, M.roller, x, BELT_Y - 0.04, 0, 'z', 18));
      const nLegs = Math.max(2, Math.round(len / 0.9) + 1);
      for (let i = 0; i < nLegs; i++) {
        const x = x0 + 0.08 + (i / (nLegs - 1)) * (len - 0.16);
        [-1, 1].forEach((s) => box(0.05, BELT_Y - 0.06, 0.05, M.frame, x, (BELT_Y - 0.06) / 2, s * (width / 2 + 0.03)));
        box(0.04, 0.04, width + 0.06, M.frame, x, 0.25, 0);
        box(0.16, 0.02, 0.1, M.frame, x, 0.01, -(width / 2 + 0.03)); box(0.16, 0.02, 0.1, M.frame, x, 0.01, width / 2 + 0.03);
      }
      return belt;
    }
    const W = 0.56;
    conveyor(-3.1, -0.9, W, 'infeed');
    conveyor(0.9, 3.0, W, 'outfeed');
    // infeed motor
    cyl(0.07, 0.22, M.motor, -3.05, BELT_Y - 0.04, -(W / 2 + 0.17), 'z', 16);
    box(0.16, 0.12, 0.14, M.motor, -3.05, BELT_Y - 0.04, -(W / 2 + 0.33));
    cyl(0.07, 0.22, M.motor, 2.95, BELT_Y - 0.04, -(W / 2 + 0.17), 'z', 16);
    box(0.16, 0.12, 0.14, M.motor, 2.95, BELT_Y - 0.04, -(W / 2 + 0.33));
    // infeed chute
    const chute = new THREE.Group(); g.add(chute);
    box(0.5, 0.02, 0.6, M.steel, -3.0, BELT_Y + 0.22, 0, chute).rotation.z = -0.35;
    [-1, 1].forEach((s) => box(0.5, 0.14, 0.02, M.steel, -3.0, BELT_Y + 0.28, s * 0.3, chute).rotation.z = -0.35);

    // ---------- washer ----------
    const X0 = -0.9, X1 = 0.9, Z = 0.5, Y0 = 0.45, Y1 = 1.65, L = X1 - X0;
    [[X0 + 0.06, -Z + 0.06], [X0 + 0.06, Z - 0.06], [X1 - 0.06, -Z + 0.06], [X1 - 0.06, Z - 0.06]].forEach(([x, z]) => {
      box(0.08, Y0, 0.08, M.steel, x, Y0 / 2, z); box(0.16, 0.02, 0.16, M.steel, x, 0.01, z);
    });
    box(L, 0.06, 1.0, M.steel, 0, Y0 + 0.03, 0);
    box(L - 0.1, 0.02, 0.9, M.water, 0, Y0 + 0.07, 0).castShadow = false;
    box(L, Y1 - Y0 - 0.06, 0.03, M.steel, 0, (Y0 + Y1) / 2, -Z);
    box(L, 0.3, 0.03, M.steel, 0, 0.66, Z);
    const glass = box(L - 0.2, 0.7, 0.01, M.glass, 0, 1.16, Z); glass.castShadow = false;
    box(L, 0.14, 0.035, M.steel, 0, 1.58, Z);
    [-1, 1].forEach((s) => box(0.1, 0.7, 0.035, M.steel, s * (L / 2 - 0.05), 1.16, Z));
    box(0.04, 0.7, 0.02, M.steel, 0, 1.16, Z + 0.005);
    box(L + 0.06, 0.06, 1.06, M.steel, 0, Y1 + 0.03, 0);
    box(0.6, 0.12, 0.5, M.steel, -0.3, Y1 + 0.12, -0.1);
    cyl(0.07, 0.25, M.steel, 0.45, Y1 + 0.18, -0.25, 'y', 16);
    // end walls with an opening for the produce
    const OY0 = 0.74, OY1 = 1.14, OZ = 0.34;
    [X0, X1].forEach((x) => {
      box(0.03, OY0 - (Y0 + 0.06), 1.0, M.steel, x, (OY0 + Y0 + 0.06) / 2, 0);
      box(0.03, Y1 - OY1, 1.0, M.steel, x, (Y1 + OY1) / 2, 0);
      [-1, 1].forEach((s) => box(0.03, OY1 - OY0, Z - OZ, M.steel, x, (OY0 + OY1) / 2, s * (OZ + (Z - OZ) / 2)));
      box(0.035, 0.05, 1.0, M.yellow, x, Y1 - 0.05, 0);
    });
    // rubber flap curtains
    const flaps = [];
    [X0 - 0.02, X1 + 0.02].forEach((x) => {
      for (let k = 0; k < 7; k++) {
        const pivot = new THREE.Group(); pivot.position.set(x, OY1, -OZ + 0.05 + k * ((2 * OZ - 0.1) / 6)); g.add(pivot);
        const f = box(0.006, OY1 - OY0 - 0.04, 0.085, M.rubber, 0, -(OY1 - OY0 - 0.04) / 2, 0, pivot); f.castShadow = false;
        flaps.push({ pivot, x });
      }
    });
    // brush roller bed
    const brushes = [];
    for (let i = 0; i < 9; i++) {
      const x = -0.74 + i * 0.185;
      const br = new THREE.Group(); br.position.set(x, BELT_Y - 0.048, 0); g.add(br);
      cyl(0.048, 0.66, M.brush, 0, 0, 0, 'z', 14, br);
      for (let k = 0; k < 4; k++) { const ring = cyl(0.05, 0.02, M.core, 0, 0, -0.27 + k * 0.18, 'z', 14, br); ring.castShadow = false; }
      cyl(0.012, 0.8, M.steel, 0, 0, 0, 'z', 8, br);
      brushes.push(br);
    }
    [-1, 1].forEach((s) => box(L - 0.1, 0.05, 0.03, M.frame, 0, BELT_Y - 0.05, s * 0.36));
    // spray bars and nozzles
    const nozzles = [];
    [-0.35, 0.35].forEach((x) => {
      cyl(0.022, 0.86, M.steel, x, 1.45, 0, 'z', 12);
      for (let k = 0; k < 6; k++) {
        const z = -0.27 + k * 0.108;
        const n = mesh(new THREE.ConeGeometry(0.014, 0.035, 10), M.black, x, 1.415, z); n.rotation.x = Math.PI;
        nozzles.push(new THREE.Vector3(x, 1.39, z));
      }
    });
    // tank, pump and pipework at the back
    cyl(0.28, 0.72, M.tank, -0.25, 0.36, -0.98, 'y', 24);
    cyl(0.29, 0.04, M.steel, -0.25, 0.74, -0.98, 'y', 24);
    cyl(0.29, 0.04, M.steel, -0.25, 0.02, -0.98, 'y', 24);
    cyl(0.09, 0.26, M.motor, 0.42, 0.2, -0.95, 'x', 16);
    box(0.36, 0.06, 0.24, M.frame, 0.45, 0.06, -0.95);
    cyl(0.07, 0.1, M.steel, 0.25, 0.2, -0.95, 'x', 14);
    pipe([[0.0, 0.2, -0.98], [0.15, 0.2, -0.96], [0.25, 0.2, -0.95]], 0.025, M.steel);
    pipe([[0.25, 0.25, -0.92], [0.3, 0.8, -0.8], [0.3, 1.4, -0.62], [0.35, 1.5, -0.56]], 0.025, M.steel);
    cyl(0.025, 0.8, M.steel, 0.0, 1.5, -0.56, 'x', 10);
    [-0.35, 0.35].forEach((x) => cyl(0.022, 0.1, M.steel, x, 1.5, -0.5, 'z', 10));
    pipe([[0.6, Y0 + 0.02, -0.4], [0.6, 0.25, -0.6], [0.0, 0.2, -0.98]], 0.03, M.steel);
    // control panel
    box(0.06, 1.0, 0.06, M.frame, -1.25, 0.5, 0.72);
    box(0.4, 0.5, 0.12, M.panel, -1.25, 1.18, 0.72);
    box(0.24, 0.12, 0.01, M.screen, -1.25, 1.32, 0.785).castShadow = false;
    cyl(0.028, 0.03, M.estop, -1.34, 1.12, 0.79, 'z', 16);
    cyl(0.02, 0.025, M.green, -1.2, 1.12, 0.79, 'z', 14);
    cyl(0.02, 0.025, M.black, -1.13, 1.12, 0.79, 'z', 14);
    cyl(0.016, 0.02, M.amber, -1.2, 1.03, 0.79, 'z', 12);
    if (opts.labelTexture) {
      const lm = new THREE.MeshStandardMaterial({ map: opts.labelTexture, roughness: 0.4, metalness: 0.2 });
      box(0.62, 0.12, 0.006, lm, 0, 0.66, Z + 0.02).castShadow = false;
    }
    // stack light on the roof
    const beacon = { green: null, amber: null, red: null };
    cyl(0.035, 0.06, M.black, 0.7, Y1 + 0.09, 0.35, 'y', 16);
    beacon.green = cyl(0.033, 0.07, M.green, 0.7, Y1 + 0.155, 0.35, 'y', 16);
    beacon.amber = cyl(0.033, 0.07, M.amber, 0.7, Y1 + 0.225, 0.35, 'y', 16);
    beacon.red = cyl(0.033, 0.07, M.red, 0.7, Y1 + 0.295, 0.35, 'y', 16);
    cyl(0.02, 0.02, M.black, 0.7, Y1 + 0.34, 0.35, 'y', 12);

    // ---------- crate on a pallet ----------
    const CX = 3.38, CS = 0.72, CH = 0.46;
    for (let k = 0; k < 5; k++) box(CS + 0.06, 0.02, 0.12, M.wood, CX, 0.07, -CS / 2 + k * (CS / 4));
    [-1, 0, 1].forEach((k) => box(0.1, 0.06, CS + 0.06, M.woodDark, CX + k * (CS / 2 - 0.02), 0.03, 0));
    box(CS, 0.02, CS, M.woodDark, CX, 0.09, 0);
    for (let r = 0; r < 3; r++) {
      const y = 0.15 + r * 0.15;
      box(CS, 0.11, 0.02, M.wood, CX, y, CS / 2); box(CS, 0.11, 0.02, M.wood, CX, y, -CS / 2);
      box(0.02, 0.11, CS, M.wood, CX + CS / 2, y, 0); box(0.02, 0.11, CS, M.wood, CX - CS / 2, y, 0);
    }
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, c]) => box(0.05, CH, 0.05, M.woodDark, CX + a * (CS / 2 - 0.02), 0.08 + CH / 2, c * (CS / 2 - 0.02)));
    // short chute from the outfeed into the crate
    const ch2 = box(0.36, 0.02, W, M.steel, 3.12, BELT_Y - 0.1, 0); ch2.rotation.z = -0.5;

    return {
      group: g, belts, brushes, flaps, nozzles, beacon, materials: M,
      path: { x0: -3.05, wash0: -0.8, wash1: 0.8, x1: 2.98, y: BELT_Y, spray: [-0.35, 0.35] },
      crate: { x: CX, half: CS / 2 - 0.08, floor: 0.1 }
    };
  }

  root.FWStation = { build, BELT_Y };
})(typeof window !== 'undefined' ? window : globalThis);
