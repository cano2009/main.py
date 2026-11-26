/* Fieldworks crop models, version 4.
   Nine crops, five growth stages each, plus a harvested item (dirty or washed) for each crop.
   Each model is one BufferGeometry with vertex colours, UVs into the shared leaf-vein texture, and material groups:
   0 foliage, 1 glossy (fruit skin), 2 matte (roots, stems, soil), 3 waxy (kernels, rinds, cabbage).
   Use FWCrops.MATERIALS to make the four materials. soilTexture() makes a tileable soil albedo and normal map.
   Units are metres; a plant's base sits at the origin, roots and tubers go below y = 0. Needs a global THREE (r147).
   opts.lod = 1 gives a lighter wheat or corn plant for dense fields. */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const V3 = THREE.Vector3;
  const Y = new V3(0, 1, 0);
  const Curve = (pts, closed) => new THREE.CatmullRomCurve3(pts, !!closed);
  const dirOf = (az) => new V3(Math.cos(az), 0, Math.sin(az));
  const MAT = { FOLIAGE: 0, GLOSSY: 1, MATTE: 2, WAXY: 3 };
  const MATERIALS = [
    { name: 'crop_foliage', roughness: 0.72, metalness: 0 },
    { name: 'crop_glossy', roughness: 0.26, metalness: 0 },
    { name: 'crop_matte', roughness: 0.93, metalness: 0 },
    { name: 'crop_waxy', roughness: 0.48, metalness: 0 }
  ];

  function rng(seed) {
    let s = ((seed + 1) * 2654435761) >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const hexCache = new Map();
  function hex(h) { let c = hexCache.get(h); if (!c) { c = new THREE.Color(h).convertSRGBToLinear(); hexCache.set(h, c); } return c.clone(); }
  function mixHex(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
  function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const L = (a, b, t) => a + (b - a) * t, c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  const COND = { dry: '#a3925a', dryTip: '#8a6f43', lown: '#c9d273' };
  // Photo leaf atlas (cropatlas.js). When a model is built with { photo: true }, leaves use real scanned leaves:
  // the card's outline comes from the photo's alpha, the crop's colour tints the photo.
  const ATLAS = root.FWCropAtlas || null;
  const WHITE = new THREE.Color(1, 1, 1);
  function photoTint(c, k) {
    const m = Math.max(c.r, c.g, c.b) || 1;
    return WHITE.clone().lerp(new THREE.Color(c.r / m, c.g / m, c.b / m), k === undefined ? 0.45 : k);
  }

  // ---------------------------------------------------------------------------
  // Textures
  const UVR = { grass: [0.02, 0.44], broad: [0.52, 0.94] };
  function leafTexture() {
    const W = 1024, H = 256, d = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = (y + 0.5) / H;
      const n = (hash3(x * 0.37, y * 0.53, 1) - 0.5) * 0.025 + (vnoise(x / 7, y / 7, 3) - 0.5) * 0.05;
      let val;
      if (u < 0.47) {
        const a = Math.min(1, Math.max(0, (u - 0.02) / 0.42)), mid = Math.abs(a - 0.5);
        val = 0.84 + 0.06 * Math.pow(Math.max(0, Math.cos(a * Math.PI * 2 * 14)), 8) + (mid < 0.03 ? 0.16 * (1 - mid / 0.03) : 0) - 0.06 * Math.pow(mid * 2, 4) + n;
      } else if (u < 0.965) {
        const a = Math.min(1, Math.max(0, (u - 0.52) / 0.42)), mid = Math.abs(a - 0.5);
        const sec = v * 8 - mid * 6.5, fr = sec - Math.floor(sec);
        // tertiary net: cells between the secondary veins
        const cx = a * 26, cy = v * 34, cell = Math.min(Math.abs(cx - Math.round(cx)), Math.abs(cy - Math.round(cy)));
        val = 0.82 + (mid < 0.025 ? 0.18 * (1 - mid / 0.025) : 0) + (fr < 0.06 && mid > 0.025 ? 0.11 * (1 - fr / 0.06) : 0)
          + (cell < 0.06 ? 0.03 : 0) - 0.07 * Math.pow(mid * 2, 3) + n;
      } else val = 0.87;
      const i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = Math.round(Math.max(0, Math.min(1, val)) * 255); d[i + 3] = 255;
    }
    return { width: W, height: H, data: d, colorBoost: 1.15 };
  }
  // Tileable soil: clods, small stones, straw bits, organic flecks; cracks when dry. Albedo (sRGB) and normal map.
  function soilTexture(o) {
    o = o || {};
    const S = o.size || 512, dry = !!o.dry, P = 8;
    const per = (x, y, f) => { // periodic value noise on a P*f lattice
      const p = P * f, X = x * p, Yv = y * p, xi = Math.floor(X), yi = Math.floor(Yv), xf = X - xi, yf = Yv - yi;
      const h = (a, b) => hash3(((a % p) + p) % p, ((b % p) + p) % p, f * 13.1);
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
    };
    const cells = 14, feat = [];
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) feat.push([(i + hash3(i, j, 5)) / cells, (j + hash3(i, j, 9)) / cells]);
    const voro = (x, y) => {
      let d1 = 9, d2 = 9;
      const ci = Math.floor(x * cells), cj = Math.floor(y * cells);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = ((ci + di) % cells + cells) % cells, jj = ((cj + dj) % cells + cells) % cells, f = feat[jj * cells + ii];
        let fx = f[0] + Math.floor((ci + di) / cells) * 0, fy = f[1];
        fx += (ci + di - ii) / cells; fy += (cj + dj - jj) / cells;
        const d = Math.hypot(x - fx, y - fy);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      return d2 - d1;
    };
    const hgt = new Float32Array(S * S), col = new Float32Array(S * S * 3);
    const r = rng(dry ? 77 : 33);
    const base = dry ? [0.47, 0.37, 0.26] : [0.27, 0.19, 0.13], light = dry ? [0.62, 0.51, 0.37] : [0.42, 0.31, 0.21], darkC = dry ? [0.33, 0.25, 0.17] : [0.16, 0.11, 0.08];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, k = y * S + x;
      const n1 = per(u, v, 1), n2 = per(u, v, 3), n3 = per(u, v, 9), n4 = per(u, v, 22);
      const clod = Math.pow(Math.max(0, n3 - 0.45) * 1.8, 1.4);
      let h = n1 * 0.35 + n2 * 0.3 + clod * 0.5 + n4 * 0.12;
      let t = Math.min(1, Math.max(0, n2 * 0.6 + n4 * 0.4 + clod * 0.4));
      let c = [0, 1, 2].map((i) => darkC[i] + (light[i] - darkC[i]) * t);
      if (dry) { const e = voro(u, v); if (e < 0.012) { const k2 = 1 - e / 0.012; h -= 0.5 * k2; c = c.map((q, i) => q * (1 - 0.6 * k2) + darkC[i] * 0.2 * k2); } }
      else { const wet = per(u, v, 2); if (wet > 0.62) c = c.map((q) => q * (1 - (wet - 0.62) * 1.2)); }
      hgt[k] = h; col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
      void base;
    }
    const stamp = (cx, cy, rad, fn) => {
      const R = Math.ceil(rad);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy) / rad; if (d > 1) continue;
        const x = ((Math.round(cx) + dx) % S + S) % S, y = ((Math.round(cy) + dy) % S + S) % S;
        fn(y * S + x, d);
      }
    };
    for (let i = 0; i < 34; i++) { // stones
      const g = 0.3 + r() * 0.16, tint = [g, g * 0.97, g * 0.93], rad = 2 + r() * 5;
      stamp(r() * S, r() * S, rad, (k, d) => { const e = Math.sqrt(1 - d * d); hgt[k] += 0.45 * e; col[k * 3] = tint[0] * (0.8 + 0.2 * e); col[k * 3 + 1] = tint[1] * (0.8 + 0.2 * e); col[k * 3 + 2] = tint[2] * (0.8 + 0.2 * e); });
    }
    for (let i = 0; i < 45; i++) { // straw bits
      const x0 = r() * S, y0 = r() * S, a = r() * Math.PI, L = 8 + r() * 18, sc = [0.62, 0.52, 0.3].map((q) => q * (0.8 + r() * 0.3));
      for (let s = 0; s < L; s++) stamp(x0 + Math.cos(a) * s, y0 + Math.sin(a) * s, 1.1, (k) => { hgt[k] += 0.12; col[k * 3] = sc[0]; col[k * 3 + 1] = sc[1]; col[k * 3 + 2] = sc[2]; });
    }
    for (let i = 0; i < 400; i++) stamp(r() * S, r() * S, 1 + r(), (k) => { col[k * 3] *= 0.6; col[k * 3 + 1] *= 0.6; col[k * 3 + 2] *= 0.6; });
    const albedo = new Uint8Array(S * S * 4), normal = new Uint8Array(S * S * 4), str = 3.2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = y * S + x, at = (xx, yy) => hgt[((yy + S) % S) * S + ((xx + S) % S)];
      const nx = (at(x - 1, y) - at(x + 1, y)) * str, ny = (at(x, y - 1) - at(x, y + 1)) * str, l = Math.hypot(nx, ny, 1);
      normal[k * 4] = Math.round((nx / l * 0.5 + 0.5) * 255); normal[k * 4 + 1] = Math.round((ny / l * 0.5 + 0.5) * 255); normal[k * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); normal[k * 4 + 3] = 255;
      for (let i = 0; i < 3; i++) albedo[k * 4 + i] = Math.round(Math.max(0, Math.min(1, col[k * 3 + i])) * 255);
      albedo[k * 4 + 3] = 255;
    }
    return { width: S, height: S, albedo, normal };
  }

  // ---------------------------------------------------------------------------
  // Geometry builder with material groups
  function Builder(seed, spots, lod, photo) { this.p = []; this.c = []; this.uv = []; this.idx = [[], [], [], []]; this.mat = 0; this.r = rng(seed); this.spots = spots; this.face = 0; this.lod = lod || 0; this.photo = !!(photo && ATLAS); }
  Builder.prototype.v = function (pos, col, u, v) {
    this.p.push(pos.x, pos.y, pos.z); this.c.push(col.r, col.g, col.b);
    if (u === undefined && this.photo) this.uv.push(ATLAS.slots.neutral.u, ATLAS.slots.neutral.v);
    else this.uv.push(u === undefined ? 0.985 : u, v === undefined ? 0.5 : v);
    return this.p.length / 3 - 1;
  };
  Builder.prototype.tri = function (a, b, c) { this.idx[this.mat].push(a, b, c); };
  Builder.prototype.count = function () { return this.p.length / 3; };
  Builder.prototype.as = function (m, fn) { const prev = this.mat; this.mat = m; fn(); this.mat = prev; };
  Builder.prototype.geometry = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    let all = [], start = 0;
    this.idx.forEach((list, m) => { if (!list.length) return; g.addGroup(start, list.length, m); all = all.concat(list); start += list.length; });
    g.setIndex(all);
    g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  function tint(b, start, fn) {
    for (let v = start; v < b.count(); v++) {
      const res = fn(b.p[v * 3], b.p[v * 3 + 1], b.p[v * 3 + 2]);
      if (!res) continue;
      const c = hex(res[0]), m = res[1];
      b.c[v * 3] += (c.r - b.c[v * 3]) * m; b.c[v * 3 + 1] += (c.g - b.c[v * 3 + 1]) * m; b.c[v * 3 + 2] += (c.b - b.c[v * 3 + 2]) * m;
    }
  }
  function frame(T) {
    const ref = Math.abs(T.y) < 0.98 ? Y : new V3(1, 0, 0);
    const B = new V3().crossVectors(T, ref).normalize();
    return { B, N: new V3().crossVectors(B, T).normalize() };
  }
  function orth(v, T) { const o = v.clone().sub(T.clone().multiplyScalar(v.dot(T))); return o.lengthSq() < 1e-10 ? frame(T).B : o.normalize(); }
  function flatSide(dir) { const s = new V3().crossVectors(Y, dir); return s.lengthSq() < 1e-6 ? frame(dir).B : s.normalize(); }
  function shade(b, base, tip, t, age, cond) {
    const col = hex(base).lerp(hex(tip), Math.pow(Math.min(1, Math.max(0, t)), 1.5));
    if (cond === 'dry') col.lerp(hex(COND.dry), 0.35 + 0.3 * age).lerp(hex(COND.dryTip), 0.6 * Math.pow(t, 2.5));
    else if (cond === 'lown') col.lerp(hex(COND.lown), 0.25 + 0.5 * age);
    else if (cond === 'rust' && b.spots && b.r() < b.spots.rate * (0.6 + 0.9 * age)) col.lerp(hex(b.r() < 0.55 ? b.spots.a : b.spots.b), 0.8);
    return col.multiplyScalar(0.94 + b.r() * 0.1);
  }
  const plain = (b, base, tip, t) => hex(base).lerp(hex(tip || base), Math.max(0, Math.min(1, t || 0))).multiplyScalar(0.94 + b.r() * 0.1);

  // ---------------------------------------------------------------------------
  // Parts
  function tube(b, curve, segs, radial, rad, colAt) {
    const rings = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, P = curve.getPoint(t), f = frame(curve.getTangent(t)), r = rad(t), ring = [];
      for (let k = 0; k < radial; k++) { const a = (k / radial) * Math.PI * 2; ring.push(b.v(P.clone().addScaledVector(f.N, Math.cos(a) * r).addScaledVector(f.B, Math.sin(a) * r), colAt(t, k))); }
      rings.push(ring);
    }
    for (let s = 0; s < segs; s++) for (let k = 0; k < radial; k++) {
      const a = rings[s][k], c = rings[s][(k + 1) % radial], d = rings[s + 1][k], e = rings[s + 1][(k + 1) % radial];
      b.tri(a, c, d); b.tri(c, e, d);
    }
  }
  // Leaf blade, five vertices across: raised midrib (fold), cupping (cup), margin ruffles (wave), teeth (serr).
  // colAt(t, part, x): part 0 left, 1 midrib, 2 right; x from -1 to 1 across the blade.
  function ribbon(b, curve, segs, width, lateral0, o) {
    const slot = b.photo ? ATLAS.slots[o.slot || 'grass'] : null, tintLeaf = slot && o.slot && o.slot !== 'grass';
    const reg = slot ? null : UVR[o.uv], N = 4;
    let prev = null;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, P = curve.getPoint(t), T = curve.getTangent(t);
      const S = orth(lateral0.clone().applyAxisAngle(T, (o.twist || 0) * t), T);
      const W = new V3().crossVectors(S, T).normalize();
      let w = width(t);
      if (o.serr) w *= 1 - o.serr[1] * Math.abs(Math.sin(t * Math.PI * o.serr[0]));
      const fold = w * (o.fold === undefined ? 0.3 : o.fold), cup = w * (o.cup || 0);
      const row = [];
      for (let j = 0; j <= N; j++) {
        const x = (j / N) * 2 - 1, ax = Math.abs(x);
        const wv = o.wave ? Math.sin(t * o.wave[0] + (x < 0 ? 0 : 2.1) + ax * (o.wave[2] || 0)) * o.wave[1] * Math.pow(ax, 1.5) * (o.waveGrow ? Math.min(1, 0.3 + t * 1.4) : 1) : 0;
        const off = fold * (1 - Math.pow(ax, 1.3)) + cup * x * x + wv;
        const pos = P.clone().addScaledVector(S, w * x).addScaledVector(W, off);
        const part = j === 2 ? 1 : j < 2 ? 0 : 2;
        let col = o.colAt(t, part, x);
        if (tintLeaf) col = photoTint(col, o.tint);
        if (slot) row.push(b.v(pos, col, slot.u0 + (slot.u1 - slot.u0) * j / N, slot.v0 + (slot.v1 - slot.v0) * t));
        else row.push(b.v(pos, col, reg ? reg[0] + (reg[1] - reg[0]) * j / N : undefined, t));
      }
      if (prev) for (let j = 0; j < N; j++) { b.tri(prev[j], prev[j + 1], row[j]); b.tri(prev[j + 1], row[j + 1], row[j]); }
      prev = row;
    }
  }
  function card(b, curve, segs, width, colAt) {
    const f0 = frame(curve.getTangent(0));
    [f0.B, f0.N].forEach((L0) => {
      let prev = null;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, P = curve.getPoint(t), S = orth(L0, curve.getTangent(t)), w = width(t), col = colAt(t);
        const a = b.v(P.clone().addScaledVector(S, -w), col), c = b.v(P.clone().addScaledVector(S, w), col);
        if (prev) { b.tri(prev[0], prev[1], a); b.tri(prev[1], c, a); }
        prev = [a, c];
      }
    });
  }
  // Body turned around an axis. prof = [[height, radius], ...]. o.rad(a, t, i): radius multiplier.
  // o.bend: [direction, amount] curves the axis. colAt(t, ring, k, angle).
  function lathe(b, origin, axis, prof, radial, colAt, o) {
    o = o || {};
    const f = frame(axis), rings = [];
    prof.forEach((pr, i) => {
      const t = i / (prof.length - 1), c = origin.clone().addScaledVector(axis, pr[0]);
      if (o.bend) c.addScaledVector(o.bend[0], o.bend[1] * t * t);
      const ring = [];
      for (let k = 0; k < radial; k++) {
        const a = (k / radial) * Math.PI * 2 + Math.PI / radial;
        let rr = pr[1] * (o.ribs && k % 2 ? 1 - o.ribs : 1) * (o.jitter ? 1 + (b.r() - 0.5) * o.jitter : 1);
        if (o.rad) rr *= o.rad(a, t, i);
        ring.push(b.v(c.clone().addScaledVector(f.N, Math.cos(a) * rr).addScaledVector(f.B, Math.sin(a) * rr), colAt(t, i, k, a)));
      }
      rings.push({ ring, c, r: pr[1], t, i });
    });
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < radial; k++) {
      const a = rings[i].ring[k], c = rings[i].ring[(k + 1) % radial], d = rings[i + 1].ring[k], e = rings[i + 1].ring[(k + 1) % radial];
      b.tri(a, c, d); b.tri(c, e, d);
    }
    [0, rings.length - 1].forEach((idx) => {
      const R = rings[idx];
      if (R.r < 1e-5) return;
      const ctr = b.v(R.c, colAt(R.t, R.i, 0, 0));
      for (let k = 0; k < radial; k++) { const a = R.ring[k], c = R.ring[(k + 1) % radial]; if (idx === 0) b.tri(ctr, c, a); else b.tri(ctr, a, c); }
    });
  }
  function diamond(b, c, dir, perp, len, wid, col, colTip) {
    const ph = b.photo, U = (u) => (ph ? undefined : u), Vv = (v) => (ph ? undefined : v);
    const base = b.v(c, col, U(0.73), Vv(0)), tip = b.v(c.clone().addScaledVector(dir, len), colTip, U(0.73), Vv(1));
    const m = c.clone().addScaledVector(dir, len * 0.42);
    const l = b.v(m.clone().addScaledVector(perp, -wid), col, U(0.52), Vv(0.42)), r = b.v(m.clone().addScaledVector(perp, wid), col, U(0.94), Vv(0.42));
    b.tri(base, l, tip); b.tri(base, tip, r);
  }
  function leafCurve(node, D, L, erect, droop) {
    const pt = (out, up) => node.clone().addScaledVector(D, L * out).addScaledVector(Y, L * up);
    return Curve([node.clone(), pt(0.12 * (1 - erect), 0.3), pt(0.42 * (1 - erect * 0.6), 0.55 + 0.2 * erect - droop * 0.3),
      pt(0.68 * (1 - erect * 0.5), 0.62 + 0.3 * erect - droop * 0.85), pt(0.86 * (1 - erect * 0.4), 0.52 + 0.38 * erect - droop * 1.55)]);
  }
  // Broad leaf on a petiole-end: faces up, cupped, ruffled, lobed or toothed.
  function blade(b, start, dir, L, W, o) {
    const up = o.tilt === undefined ? 0.3 : o.tilt, dr = o.droop || 0;
    const pt = (f, h) => start.clone().addScaledVector(dir, L * f).addScaledVector(Y, L * h);
    const curve = Curve([start.clone(), pt(0.33, up * 0.45 + 0.02), pt(0.66, up * 0.72 - dr * 0.22), pt(1.0, up * 0.78 - dr * 0.62)]);
    const photo = b.photo && o.slot, lob = photo ? null : o.lobes, wf = o.width || ((t) => Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * t)), 0.7));
    const vein = photo ? null : o.vein || null;
    const widthFn = photo ? () => L * ATLAS.slots[o.slot].aspect * 0.5 * (o.photoScale || 1) : (t) => W * wf(t) * (lob ? 1 + lob[1] * Math.sin(t * Math.PI * lob[0]) : 1);
    ribbon(b, curve, o.segs || 7, widthFn, flatSide(dir), {
      uv: 'broad', slot: photo ? o.slot : null, tint: o.tint, fold: photo ? 0.04 : o.fold === undefined ? 0.1 : o.fold, cup: o.cup === undefined ? 0.25 : o.cup, wave: o.wave, waveGrow: o.waveGrow, serr: photo ? null : o.serr, twist: o.twist || 0,
      colAt: (t, part, x) => {
        const c = shade(b, o.pal[0], o.pal[1], t, o.age || 0, o.cond);
        if (part === 1) return vein ? c.lerp(hex(vein), 0.55) : c.multiplyScalar(1.07);
        return Math.abs(x) > 0.9 ? c.multiplyScalar(1.04) : c;
      }
    });
    return curve;
  }
  function flower(b, c, size, pet, ctr, cup) {
    b.as(MAT.WAXY, () => {
      const tipC = b.v(c.clone().addScaledVector(Y, size * 0.18), hex(ctr));
      const at = (ang, d, h) => c.clone().add(new V3(Math.cos(ang) * d, h, Math.sin(ang) * d));
      const a0 = b.r() * 6.28;
      for (let k = 0; k < 5; k++) {
        const a = a0 + k * 1.2566;
        const p0 = b.v(at(a - 0.5, size * 0.16, 0), hex(pet)), p1 = b.v(at(a - 0.32, size * 0.75, size * (cup === undefined ? 0.35 : cup) * 0.7), hex(pet));
        const p2 = b.v(at(a, size, size * (cup === undefined ? 0.35 : cup)), hex(pet).multiplyScalar(1.05)), p3 = b.v(at(a + 0.32, size * 0.75, size * (cup === undefined ? 0.35 : cup) * 0.7), hex(pet)), p4 = b.v(at(a + 0.5, size * 0.16, 0), hex(pet));
        b.tri(p0, p1, p2); b.tri(p0, p2, p4); b.tri(p2, p3, p4);
        b.tri(b.v(at(a - 0.6, size * 0.2, 0), hex(ctr)), b.v(at(a + 0.6, size * 0.2, 0), hex(ctr)), tipC);
      }
    });
  }
  // Compound leaf (tomato, potato): petiole, leaflet pairs with small leaflets between, terminal leaflet. Toothed.
  function compoundLeaf(b, node, D, L, droop, age, cond, pal, pairs) {
    const curve = leafCurve(node, D, L, 0.28, droop);
    tube(b, curve, 4, 4, (t) => 0.0019 * (1 - 0.5 * t), (t) => shade(b, pal.stem, pal.stemTip, t, age * 0.4, cond === 'rust' ? 'healthy' : cond));
    const leaflet = (P, dir, ll) => {
      const c = Curve([P.clone(), P.clone().addScaledVector(dir, ll * 0.5).addScaledVector(Y, ll * 0.06), P.clone().addScaledVector(dir, ll).addScaledVector(Y, -ll * (0.15 + droop * 0.3))]);
      const ph = b.photo && pal.photo;
      ribbon(b, c, 4, ph ? () => ll * ATLAS.slots[pal.photo].aspect * 0.55 : (t) => ll * 0.36 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * t)), 0.8), flatSide(dir), {
        uv: 'broad', slot: ph ? pal.photo : null, fold: ph ? 0.05 : 0.12, cup: 0.18 + (cond === 'dry' ? 0.5 : 0), wave: [18, ll * 0.035, 2], serr: ph ? null : pal.serr || [9, 0.12],
        colAt: (t, part) => { const k = shade(b, pal.leaf, pal.tip, t, age, cond); return part === 1 ? k.multiplyScalar(1.12) : k; }
      });
    };
    for (let j = 0; j < pairs; j++) {
      const t = 0.3 + (j / pairs) * 0.55, P = curve.getPoint(t), T = curve.getTangent(t), lat = flatSide(T);
      for (const sd of [-1, 1]) {
        leaflet(P, T.clone().multiplyScalar(0.35).addScaledVector(lat, sd * 0.9).addScaledVector(Y, -0.1).normalize(), L * (0.4 - 0.05 * j));
        if (j < pairs - 1 && !b.lod) leaflet(curve.getPoint(t + 0.09), T.clone().multiplyScalar(0.2).addScaledVector(lat, sd).normalize(), L * 0.12);
      }
    }
    leaflet(curve.getPoint(1), curve.getTangent(1), L * 0.44);
  }
  function tendril(b, start, dir, len, col) {
    const pts = [], side = flatSide(dir);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, a = t * Math.PI * 7, r = 0.004 + 0.012 * t * t;
      pts.push(start.clone().addScaledVector(dir, len * (0.6 * t + 0.4 * Math.min(1, t * 3)) * 0.6).addScaledVector(side, Math.cos(a) * r * (t > 0.4 ? 1 : 0)).addScaledVector(Y, 0.02 * Math.sin(t * Math.PI) + Math.sin(a) * r * (t > 0.4 ? 1 : 0)));
    }
    tube(b, Curve(pts), 24, 3, () => 0.0011, () => plain(b, col));
  }
  function seedling(b, az0, H, pal, cond, o) {
    const stem = Curve([new V3(0, -0.004, 0), new V3(0.002, H * 0.5, 0), new V3(0, H, 0.002)]);
    b.as(MAT.MATTE, () => tube(b, stem, 4, 5, (t) => (o.stemR || 0.0022) * (1 - 0.3 * t), (t) => plain(b, o.stemCol || '#7fa64e', o.stemCol || '#7fa64e', t)));
    const top = stem.getPoint(1);
    for (let k = 0; k < 2; k++) blade(b, top, dirOf(az0 + k * Math.PI), o.cot[0], o.cot[1], { tilt: 0.25, droop: cond === 'dry' ? 0.6 : 0.1, cup: 0.3, pal: o.cotPal || ['#79b350', '#93c565'], cond, segs: 5, slot: 'lettuce', photoScale: 0.9 });
    if (o.trueL) blade(b, top.clone().addScaledVector(Y, 0.003), dirOf(az0 + Math.PI / 2), o.trueL, o.trueL * (o.trueW || 0.6), { tilt: 0.7, droop: 0.05, cup: 0.35, pal, cond, lobes: o.lobes, serr: o.serr, segs: 6, slot: o.slot, photoScale: o.photoScale });
  }
  function dirtify(b, start, amount) {
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (let v = start; v < b.count(); v++) { const x = b.p[v * 3], y = b.p[v * 3 + 1]; minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const size = Math.max(0.03, maxY - minY, maxX - minX), s = 7 / size, hgt = Math.max(1e-4, maxY - minY);
    tint(b, start, (x, y, z) => {
      const n = vnoise(x * s, y * s, z * s) * 0.65 + vnoise(x * s * 2.7, y * s * 2.7, z * s * 2.7) * 0.35;
      const d = n + 0.45 * (1 - (y - minY) / hgt) - (1 - amount) * 0.7;
      if (d < 0.36) return null;
      return [vnoise(x * s * 1.3 + 9, y * s, z * s) > 0.5 ? '#5a4029' : '#7a5a3a', Math.min(0.95, (d - 0.36) * 3.6)];
    });
    const end = b.count(), clods = Math.round(8 + amount * 10);
    b.as(MAT.MATTE, () => {
      for (let k = 0; k < clods; k++) {
        const v = start + Math.floor(b.r() * (end - start));
        const p = new V3(b.p[v * 3], b.p[v * 3 + 1], b.p[v * 3 + 2]);
        if (p.y > minY + hgt * 0.65) continue;
        const r = size * (0.018 + b.r() * 0.022), col = hex(b.r() < 0.5 ? '#5a4029' : '#6e5236');
        const pts = [new V3(r, 0, 0), new V3(-r, 0, 0), new V3(0, r * 0.8, 0), new V3(0, -r * 0.8, 0), new V3(0, 0, r), new V3(0, 0, -r)]
          .map((q) => b.v(q.multiplyScalar(0.8 + b.r() * 0.4).add(p), col.clone().multiplyScalar(0.85 + b.r() * 0.3)));
        [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]].forEach((f) => b.tri(pts[f[0]], pts[f[1]], pts[f[2]]));
      }
    });
  }
  function finish(b, stems, aoH) {
    if (aoH) for (let v = 0; v < b.count(); v++) {
      const y = b.p[v * 3 + 1]; if (y < 0) continue;
      const f = 0.58 + 0.42 * Math.min(1, Math.pow(y / aoH, 0.7));
      b.c[v * 3] *= f; b.c[v * 3 + 1] *= f; b.c[v * 3 + 2] *= f;
    }
    const g = b.geometry();
    g.userData = { stems: stems || 1, triangles: g.index.count / 3, face: b.face };
    return g;
  }

  // =====================================================================
  // WHEAT
  // =====================================================================
  const WP = {
    leaf: ['#7dbd45', '#62a63b', '#529735', '#5b9837', '#b89b52'], leafTip: ['#9ccc5c', '#86bb52', '#79b04c', '#86b04a', '#8f7444'],
    stalk: ['#8cbc52', '#86b84f', '#7aac46', '#8fb24c', '#dcbd70'], ear: ['#9ec450', '#9ec450', '#9ec450', '#a3c654', '#cf9f48'],
    earHi: ['#c2db7a', '#c2db7a', '#c2db7a', '#c6dc7e', '#f0d38c'], awn: ['#b8d474', '#b8d474', '#b8d474', '#c4da84', '#e8d39a']
  };
  const WHEAT_STAGES = [
    { name: 'Seedling', day: 7, height: 0.10 }, { name: 'Tillering', day: 30, height: 0.22 },
    { name: 'Stem extension', day: 65, height: 0.6 }, { name: 'Heading', day: 95, height: 0.9 }, { name: 'Ripe', day: 130, height: 0.92 }
  ];
  function wheatLeaf(b, node, az, L, erect, droop, stage, age, cond, hue) {
    const D = dirOf(az), maxW = 0.009 * (stage < 2 ? 0.85 : 1);
    ribbon(b, leafCurve(node, D, L, erect, droop), b.lod ? 6 : 12, (t) => maxW * Math.pow(1 - t, 0.7) * Math.min(1, 0.45 + t * 5), flatSide(D), {
      uv: 'grass', twist: (b.r() - 0.5) * (stage === 4 ? 2.2 : 1.0), fold: 0.3 + (cond === 'dry' ? 0.5 : 0) + (stage === 4 ? 0.3 : 0),
      colAt: (t, part) => { const c = shade(b, WP.leaf[stage], WP.leafTip[stage], t, age, cond).multiplyScalar(hue); return part === 1 ? c.multiplyScalar(1.08) : c; }
    });
  }
  function wheatEar(b, top, T0, lean, stage, cond, hue) {
    const ripe = stage === 4, len = ripe ? 0.1 : 0.09;
    const nod = (ripe ? 1.1 : 0.15) + (cond === 'dry' ? 0.4 : 0);
    const side = lean.clone().setY(0); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
    const bend = (k) => side.clone().multiplyScalar(len * 0.16 * nod * k).addScaledVector(Y, -len * 0.12 * nod * k * k);
    const curve = Curve([top.clone(), top.clone().addScaledVector(T0, len * 0.35).add(bend(0.6)), top.clone().addScaledVector(T0, len * 0.7).add(bend(1.6)), top.clone().addScaledVector(T0, len).add(bend(2.8))]);
    tube(b, curve, 6, 3, () => 0.0016, (t) => shade(b, WP.stalk[stage], WP.ear[stage], t, 0, cond));
    const n = b.lod ? 12 : 22;
    b.as(MAT.WAXY, () => {
      for (let i = 0; i < n; i++) {
        const t = 0.03 + (i / (n - 1)) * 0.94, P = curve.getPoint(t), T = curve.getTangent(t), f = frame(T);
        const sd = i % 2 ? 1 : -1, size = (1 - Math.pow(Math.abs(t - 0.42) * 1.35, 2) * 0.55) * (b.lod ? 1.25 : 1);
        const S = f.B.clone().applyAxisAngle(T, (i % 4 < 2 ? 0.25 : -0.25));
        [[0, 1], [0.35, 0.72]].forEach(([shift, sc], fl) => {
          if (b.lod && fl) return;
          const dir = T.clone().addScaledVector(S, sd * (0.55 + shift * 0.4)).normalize();
          const c = P.clone().addScaledVector(S, sd * (0.0055 + shift * 0.006)).addScaledVector(f.N, (fl ? 1 : -1) * 0.002);
          const Ls = 0.017 * size * sc, Ws = 0.0082 * size * sc, Th = 0.0062 * size * sc;
          const W = new V3().crossVectors(dir, S).normalize();
          const col = shade(b, WP.ear[stage], WP.earHi[stage], b.r() * 0.6, 0, cond).multiplyScalar(hue), colHi = col.clone().lerp(hex(WP.earHi[stage]), 0.5);
          const tip = b.v(c.clone().addScaledVector(dir, Ls * 0.6), colHi), bot = b.v(c.clone().addScaledVector(dir, -Ls * 0.4), col);
          const l = b.v(c.clone().addScaledVector(S, -Ws / 2), col), r = b.v(c.clone().addScaledVector(S, Ws / 2), col);
          const fr = b.v(c.clone().addScaledVector(W, Th / 2), colHi), bk = b.v(c.clone().addScaledVector(W, -Th / 2), col);
          b.tri(tip, l, fr); b.tri(tip, fr, r); b.tri(tip, r, bk); b.tri(tip, bk, l);
          b.tri(bot, fr, l); b.tri(bot, r, fr); b.tri(bot, bk, r); b.tri(bot, l, bk);
          // awn: long, thin, slightly curved
          const aLen = (ripe ? 0.085 : 0.065) * (0.75 + b.r() * 0.5) * sc;
          const aDir = T.clone().addScaledVector(S, sd * (ripe ? 0.55 : 0.32)).addScaledVector(f.N, (b.r() - 0.5) * 0.3).normalize();
          const a0 = c.clone().addScaledVector(dir, Ls * 0.55), aMid = a0.clone().addScaledVector(aDir, aLen * 0.5), a1 = a0.clone().addScaledVector(aDir, aLen).addScaledVector(Y, -aLen * 0.08 * nod);
          const ac = hex(WP.awn[stage]).multiplyScalar(hue), act = ac.clone().multiplyScalar(1.12);
          [W, S].forEach((ax) => {
            const aw = ax.clone().multiplyScalar(0.0008);
            const q0 = b.v(a0.clone().sub(aw), ac), q1 = b.v(a0.clone().add(aw), ac), q2 = b.v(aMid.clone().sub(aw.clone().multiplyScalar(0.5)), ac), q3 = b.v(aMid.clone().add(aw.clone().multiplyScalar(0.5)), ac), q4 = b.v(a1, act);
            b.tri(q0, q1, q2); b.tri(q1, q3, q2); b.tri(q2, q3, q4);
          });
        });
      }
    });
  }
  function wheatStem(b, origin, stageIdx, cond) {
    const r = b.r, st = WHEAT_STAGES[stageIdx], lowN = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry';
    const droopBase = dry ? 0.45 : 0.12, az0 = r() * Math.PI * 2, hue = 0.9 + r() * 0.2;
    if (stageIdx === 0) { for (let k = 0; k < 3; k++) wheatLeaf(b, origin.clone(), az0 + k * 2.3 + r() * 0.4, (0.08 + r() * 0.04) * lowN, 0.78, droopBase * 0.6, 0, k / 3, cond, hue); return; }
    if (stageIdx === 1) { for (let k = 0; k < 7; k++) wheatLeaf(b, origin.clone().add(new V3(0, 0.005 * k, 0)), az0 + k * 2.4 + r() * 0.5, (0.15 + r() * 0.1) * lowN, 0.38, droopBase + 0.05, 1, 1 - k / 7, cond, hue); return; }
    const H = st.height * (0.88 + r() * 0.18) * (cond === 'lown' ? 0.88 : 1);
    const lean = new V3((r() - 0.5) * 0.18, 0, (r() - 0.5) * 0.18), pts = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(origin.clone().add(new V3(lean.x * t * t * H, t * H, lean.z * t * t * H))); }
    if (stageIdx === 4 && lean.lengthSq() > 1e-6) pts[6].addScaledVector(lean.clone().normalize(), 0.035);
    const curve = Curve(pts);
    tube(b, curve, b.lod ? 6 : 12, b.lod ? 3 : 5, (t) => 0.0028 - 0.001 * t, (t) => shade(b, WP.stalk[stageIdx], WP.stalk[stageIdx], t, stageIdx === 4 ? 0.6 : 0.1, cond).multiplyScalar(hue));
    // nodes: slight swellings
    if (!b.lod) [0.18, 0.4, 0.62].forEach((t) => { if (stageIdx < 3 && t > 0.5) return; const P = curve.getPoint(t); tube(b, Curve([P.clone().addScaledVector(Y, -0.004), P.clone(), P.clone().addScaledVector(Y, 0.004)]), 2, 5, (u) => 0.0033 * Math.sin(Math.PI * (0.2 + 0.6 * u)), () => plain(b, stageIdx === 4 ? '#c9a95c' : '#6f9e3e')); });
    const nodes = stageIdx === 2 ? [0.04, 0.2, 0.42, 0.64] : [0.04, 0.18, 0.4, 0.62, 0.8];
    nodes.forEach((t, k) => {
      const last = k === nodes.length - 1 && stageIdx >= 3, age = 1 - k / nodes.length;
      const L = (last ? 0.17 : 0.24 + r() * 0.08) * lowN;
      const droop = stageIdx === 4 ? 0.5 + age * 0.45 + (dry ? 0.2 : 0) : droopBase + 0.1 + age * 0.15;
      wheatLeaf(b, curve.getPoint(t), az0 + k * Math.PI + (r() - 0.5) * 0.6, L, last ? 0.55 : 0.22, droop, stageIdx, stageIdx === 4 ? 1 : age * 0.7, cond, hue);
    });
    if (stageIdx >= 3) wheatEar(b, curve.getPoint(1), curve.getTangent(1), lean, stageIdx, cond, hue);
  }
  function wheatClump(o) {
    const stage = o.stage | 0, cond = o.condition || 'healthy', seed = o.seed || 1, lod = o.lod || 0;
    const stems = o.stems || (stage === 0 ? 1 : stage === 1 ? 2 : stage === 2 ? 4 : 5);
    const b = new Builder(seed * 7919 + stage * 131 + cond.length, { rate: 0.3, a: '#c47a2a', b: '#8d4f1c' }, lod, o.photo);
    for (let s = 0; s < stems; s++) {
      const a = (s / stems) * Math.PI * 2 + b.r(), d = stems > 1 ? 0.01 + b.r() * 0.02 : 0;
      wheatStem(b, new V3(Math.cos(a) * d, 0, Math.sin(a) * d), stage, cond);
    }
    return finish(b, stems, Math.max(0.05, WHEAT_STAGES[stage].height * 0.3));
  }
  function wheatSheaf(b) {
    const n = 12;
    for (let s = 0; s < n; s++) {
      const a = (s / n) * Math.PI * 2, rr = 0.012 + b.r() * 0.014;
      const o = new V3(0, 0.045 + Math.sin(a) * rr, Math.cos(a) * rr), fan = new V3(0, Math.sin(a), Math.cos(a)).multiplyScalar(0.035);
      const c = Curve([o.clone().add(new V3(-0.36, 0, 0)).add(fan), o.clone().add(new V3(-0.05, 0, 0)), o.clone().add(new V3(0.2, 0, 0)).add(fan)]);
      tube(b, c, 4, 3, () => 0.0026, (t) => plain(b, '#d6b866', '#e0c57a', t));
      wheatEar(b, c.getPoint(1), c.getTangent(1), new V3(1, 0, 0), 4, 'healthy', 0.9 + b.r() * 0.2);
    }
    const band = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; band.push(new V3(-0.06, 0.045 + Math.sin(a) * 0.034, Math.cos(a) * 0.034)); }
    b.as(MAT.MATTE, () => tube(b, Curve(band, true), 8, 3, () => 0.004, () => plain(b, '#b88f52')));
  }

  // =====================================================================
  // CORN
  // =====================================================================
  const CP = {
    leaf: ['#5aa83c', '#4f9a37', '#47913a', '#47913a', '#b39a5f'], tip: ['#7cc04e', '#6db146', '#64a843', '#6aa545', '#8c7347'],
    rib: ['#c9e49d', '#bddc92', '#b5d690', '#b5d690', '#e0cf9c'], stalk: ['#8fc257', '#83b44d', '#7cad4a', '#7fac4b', '#c4a96e']
  };
  const CORN_STAGES = [
    { name: 'Seedling', day: 10, height: 0.16 }, { name: 'Knee high', day: 35, height: 0.6 }, { name: 'Tasseling', day: 65, height: 2.0 },
    { name: 'Silking', day: 75, height: 2.1 }, { name: 'Mature', day: 120, height: 2.05 }
  ];
  function cornLeaf(b, node, az, L, maxW, erect, droop, stage, age, cond) {
    const D = dirOf(az);
    ribbon(b, leafCurve(node, D, L, erect, droop), b.lod ? 7 : 14, (t) => maxW * Math.min(1, 0.3 + t * 3.0) * Math.pow(1 - t, 0.62), flatSide(D), {
      uv: 'grass', twist: (b.r() - 0.5) * 0.7, fold: 0.1 + (cond === 'dry' ? 0.45 : 0), cup: -0.08, wave: [30, maxW * 0.09, 3], waveGrow: true,
      colAt: (t, part, x) => (part === 1 ? shade(b, CP.rib[stage], CP.rib[stage], t, age * 0.5, cond === 'rust' ? 'healthy' : cond) : shade(b, CP.leaf[stage], CP.tip[stage], t, age, cond).multiplyScalar(Math.abs(x) < 0.6 ? 1.04 : 0.97))
    });
  }
  function cornTassel(b, top, T, stage) {
    const col = stage === 4 ? ['#a88d5c', '#8a6f45'] : ['#c4cb72', '#e6d98e'], anther = stage === 4 ? '#8a7448' : '#efd36a';
    tube(b, Curve([top.clone(), top.clone().addScaledVector(T, 0.14), top.clone().addScaledVector(T, 0.28).add(new V3(0.012, -0.01, 0))]), 4, 4, (t) => 0.0042 * (1 - t * 0.7), (t) => plain(b, col[0], col[1], t));
    const a0 = b.r() * Math.PI * 2, nb = b.lod ? 5 : 10;
    const spike = (curve, n) => {
      for (let i = 0; i < n; i++) {
        const t = 0.15 + (i / n) * 0.85, P = curve.getPoint(t), Tn = curve.getTangent(t), f = frame(Tn);
        [-1, 1].forEach((s) => diamond(b, P, Tn.clone().addScaledVector(f.B, s * 0.6).normalize(), f.N, 0.009, 0.0022, plain(b, col[0]), plain(b, anther)));
      }
    };
    b.as(MAT.WAXY, () => {
      spike(Curve([top.clone().addScaledVector(T, 0.12), top.clone().addScaledVector(T, 0.28)]), b.lod ? 4 : 9);
      for (let k = 0; k < nb; k++) {
        const D = dirOf(a0 + k * 2.4), s = top.clone().addScaledVector(T, 0.02 + 0.012 * k), L = 0.14 + b.r() * 0.07;
        const c = Curve([s, s.clone().addScaledVector(D, L * 0.4).addScaledVector(Y, L * 0.14), s.clone().addScaledVector(D, L * 0.8), s.clone().addScaledVector(D, L).addScaledVector(Y, -L * 0.4)]);
        b.as(MAT.FOLIAGE, () => card(b, c, 3, (t) => 0.0016 * (1 - t * 0.5), (t) => plain(b, col[0], col[1], t)));
        spike(c, b.lod ? 3 : 7);
      }
    });
  }
  // Cob with individual kernels in straight rows over a pale core.
  function cobProfile(t) { return t < 0.08 ? 0.62 + t * 4.5 : t > 0.68 ? Math.max(0.25, 1 - (t - 0.68) / 0.32 * 0.72) : 1; }
  function cornCob(b, base, axis, len, R, rows, perRow) {
    const f = frame(axis);
    b.as(MAT.MATTE, () => lathe(b, base, axis, [0, 0.1, 0.3, 0.6, 0.85, 1].map((t) => [t * len, R * 0.78 * cobProfile(t)]), 14, () => plain(b, '#efe1b2')));
    b.as(MAT.WAXY, () => {
      for (let k = 0; k < perRow; k++) for (let r = 0; r < rows; r++) {
        const t = (k + 0.5) / perRow, rr = R * cobProfile(t), a = (r / rows) * Math.PI * 2 + (k % 2) * 0.02;
        if (t > 0.95 && b.r() < 0.5) continue;
        const n = f.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.B, Math.sin(a)), c = f.N.clone().multiplyScalar(-Math.sin(a)).addScaledVector(f.B, Math.cos(a));
        const ctr = base.clone().addScaledVector(axis, t * len).addScaledVector(n, rr * 0.86);
        const wc = (Math.PI * rr / rows) * 0.93, wa = (len / perRow) * 0.47, hk = rr * 0.24;
        const yel = hex(b.r() < 0.04 ? '#f0cf6e' : '#e2a92b').lerp(hex('#f2c54a'), b.r() * 0.6);
        const top = yel.clone().multiplyScalar(1.12), side = yel.clone().multiplyScalar(0.78);
        const P = (sc, sa, h) => ctr.clone().addScaledVector(c, wc * sc).addScaledVector(axis, wa * sa).addScaledVector(n, h);
        const ct = b.v(P(0, 0, hk * 1.12), top), t1 = b.v(P(-0.82, -0.82, hk), top), t2 = b.v(P(0.82, -0.82, hk), top), t3 = b.v(P(0.82, 0.82, hk), top), t4 = b.v(P(-0.82, 0.82, hk), top);
        const b1 = b.v(P(-1, -1, -hk * 0.3), side), b2 = b.v(P(1, -1, -hk * 0.3), side), b3 = b.v(P(1, 1, -hk * 0.3), side), b4 = b.v(P(-1, 1, -hk * 0.3), side);
        b.tri(ct, t1, t2); b.tri(ct, t2, t3); b.tri(ct, t3, t4); b.tri(ct, t4, t1);
        b.tri(t1, b1, b2); b.tri(t1, b2, t2); b.tri(t2, b2, b3); b.tri(t2, b3, t3); b.tri(t3, b3, b4); b.tri(t3, b4, t4); b.tri(t4, b4, b1); b.tri(t4, b1, t1);
      }
    });
  }
  function husk(b, base, axis, len, R, n, col, mode) {
    const f = frame(axis);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3, out = f.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.B, Math.sin(a));
      const tang = f.N.clone().multiplyScalar(-Math.sin(a)).addScaledVector(f.B, Math.cos(a));
      const s = base.clone().addScaledVector(out, R * 0.6);
      let pts;
      if (mode === 'back') pts = [s, s.clone().addScaledVector(out, R * 0.9).addScaledVector(axis, -0.01), s.clone().addScaledVector(out, R * 1.6).addScaledVector(axis, -len * 0.35), s.clone().addScaledVector(out, R * 1.7).addScaledVector(axis, -len * 0.7).addScaledVector(Y, -0.03)];
      else if (mode === 'open') pts = [s, s.clone().addScaledVector(out, R * 0.7).addScaledVector(axis, len * 0.25), s.clone().addScaledVector(out, R * 1.6).addScaledVector(axis, len * 0.5), s.clone().addScaledVector(out, R * 2.6).addScaledVector(axis, len * 0.62)];
      else pts = [s, s.clone().addScaledVector(out, R * 0.55).addScaledVector(axis, len * 0.35), s.clone().addScaledVector(out, R * 0.35).addScaledVector(axis, len * 0.8), s.clone().addScaledVector(out, -R * 0.4).addScaledVector(axis, len * 1.08)];
      ribbon(b, Curve(pts), 6, (t) => R * (mode === 'closed' ? 1.15 : 1.0) * Math.pow(1 - t, 0.55) + 0.002, tang, {
        uv: 'grass', fold: -0.05, cup: -0.35, colAt: (t, part) => { const c = plain(b, col[0], col[1], t); return part === 1 ? c.multiplyScalar(1.06) : c; }
      });
    }
  }
  function silks(b, tip, axis, n, L, col) {
    const f = frame(axis);
    for (let k = 0; k < n; k++) {
      const a = k * 2.4, out = f.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.B, Math.sin(a)), l = L * (0.7 + b.r() * 0.6);
      const c = Curve([tip.clone(), tip.clone().addScaledVector(axis, l * 0.35).addScaledVector(out, l * 0.18), tip.clone().addScaledVector(axis, l * 0.5).addScaledVector(out, l * 0.5).addScaledVector(Y, -l * 0.6)]);
      card(b, c, 3, () => 0.0009, (t) => plain(b, col[0], col[1], t));
    }
  }
  function cornEar(b, node, az, stage, cond, scale) {
    const D = dirOf(az), ripe = stage === 4, small = (cond === 'lown' ? 0.82 : cond === 'dry' ? 0.9 : 1) * scale;
    const axis = (ripe ? D.clone().multiplyScalar(0.95).addScaledVector(Y, 0.05) : D.clone().multiplyScalar(0.62).addScaledVector(Y, 0.78)).normalize();
    const base = node.clone().addScaledVector(D, 0.03), len = 0.24 * small, R = 0.032 * small;
    tube(b, Curve([node.clone(), node.clone().addScaledVector(D, 0.016).addScaledVector(axis, 0.008), base.clone()]), 2, 6, () => 0.009, () => plain(b, ripe ? '#c4a96e' : '#7aa546'));
    if (ripe) {
      cornCob(b, base, axis, len * 0.92, R, b.lod ? 8 : 12, b.lod ? 10 : 22);
      husk(b, base, axis, len, R, 4, ['#dcc58f', '#b89a62'], 'back');
      silks(b, base.clone().addScaledVector(axis, len * 0.92), axis, b.lod ? 3 : 7, 0.05, ['#6a4626', '#3e2814']);
      return;
    }
    b.as(MAT.MATTE, () => lathe(b, base, axis, [[0, R * 0.3], [len * 0.1, R * 0.8], [len * 0.3, R], [len * 0.6, R * 0.94], [len * 0.82, R * 0.66], [len * 0.95, R * 0.28], [len, R * 0.08]], 10, (t) => plain(b, '#6aa03f', '#9cc066', t)));
    husk(b, base, axis, len, R, b.lod ? 3 : 6, ['#6fa844', '#a9cb72'], 'closed');
    silks(b, base.clone().addScaledVector(axis, len * 1.02), axis, b.lod ? 6 : 18, stage === 3 ? 0.16 : 0.11, stage === 3 ? ['#efe29c', '#c98f6a'] : ['#e9dc98', '#e9dc98']);
  }
  function cornPlant(b, stage, cond) {
    const r = b.r, dry = cond === 'dry', sc = cond === 'lown' ? 0.85 : 1, dAdd = dry ? 0.35 : 0, az0 = r() * Math.PI * 2;
    if (stage === 0) {
      b.as(MAT.MATTE, () => tube(b, Curve([new V3(0, -0.005, 0), new V3(0, 0.012, 0), new V3(0, 0.028, 0)]), 2, 6, () => 0.0035, (t) => plain(b, CP.stalk[0], CP.stalk[0], t)));
      for (let k = 0; k < 3; k++) cornLeaf(b, new V3(0, 0.006 + 0.009 * k, 0), az0 + k * Math.PI + (r() - 0.5) * 0.5, (0.08 + 0.035 * k) * sc, 0.012 + 0.004 * k, 0.62, 0.12 + dAdd, 0, 1 - k / 3, cond);
      return;
    }
    const H = (stage === 1 ? 0.24 : 1.62 * (0.95 + r() * 0.1)) * sc;
    const lean = new V3((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.05), pts = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new V3(lean.x * t * t * H, t * H, lean.z * t * t * H)); }
    const stalk = Curve(pts), R0 = stage === 1 ? 0.009 : 0.016;
    const n = stage === 1 ? 7 : stage === 4 ? 11 : 12;
    const nodeT = []; for (let i = 0; i < n; i++) nodeT.push(stage === 1 ? 0.05 + (i / n) * 0.9 : 0.05 + (i / n) * 0.84);
    b.as(MAT.WAXY, () => {
      tube(b, stalk, b.lod ? 8 : 18, b.lod ? 6 : 9, (t) => R0 * (1 - 0.45 * t), (t) => {
        const near = nodeT.some((nt) => Math.abs(t - nt) < 0.006);
        return shade(b, CP.stalk[stage], CP.stalk[stage], t, stage === 4 ? 0.7 : 0.1, cond === 'rust' ? 'healthy' : cond).multiplyScalar(near ? 0.8 : 1);
      });
      if (!b.lod) nodeT.forEach((t, i) => {   // node rings and the sheath that wraps the stalk above each node
        const P = stalk.getPoint(t), Rn = R0 * (1 - 0.45 * t);
        tube(b, Curve([P.clone().addScaledVector(Y, -0.005), P.clone(), P.clone().addScaledVector(Y, 0.006)]), 2, 9, (u) => Rn * (1.06 + 0.08 * Math.sin(Math.PI * u)), () => plain(b, stage === 4 ? '#a68a55' : '#b4ce7a'));
        const tN = Math.min(1, t + (i < n - 1 ? (nodeT[i + 1] - t) * 0.75 : 0.05));
        tube(b, Curve([P.clone(), stalk.getPoint((t + tN) / 2), stalk.getPoint(tN)]), 4, 9, (u) => Rn * (1.12 - 0.05 * u), (u) => shade(b, CP.leaf[stage], CP.rib[stage], u * 0.4, 0.3, cond === 'rust' ? 'healthy' : cond));
      });
    });
    for (let i = 0; i < n; i++) {
      const t = nodeT[i], P = stalk.getPoint(Math.min(1, t + (i < n - 1 ? (nodeT[i + 1] - t) * 0.75 : 0.05)));
      const L = (stage === 1 ? 0.28 + 0.24 * Math.sin(Math.PI * (i + 1) / (n + 1)) : 0.55 + 0.45 * Math.sin(Math.PI * (i + 0.8) / (n + 0.6))) * sc;
      const W = (stage === 1 ? 0.045 : 0.08) * (0.9 + r() * 0.2) * sc;
      cornLeaf(b, P, az0 + i * Math.PI + (r() - 0.5) * 0.45, L, W, 0.3 + 0.32 * (i / n), 0.45 + dAdd + (stage === 4 ? 0.3 : 0) + (1 - i / n) * 0.1, stage, 1 - i / n, cond);
    }
    if (stage >= 2) {
      cornTassel(b, stalk.getPoint(1), stalk.getTangent(1), stage);
      b.as(MAT.WAXY, () => {
        for (let k = 0; k < (b.lod ? 4 : 9); k++) {
          const D = dirOf(az0 + k * 0.7), h = 0.05 + 0.03 * (k % 3), out = 0.05 + 0.02 * (k % 2);
          tube(b, Curve([new V3(0, h + 0.03, 0).addScaledVector(D, 0.012), new V3(0, h * 0.6, 0).addScaledVector(D, out * 0.6), new V3(0, -0.012, 0).addScaledVector(D, out)]), 4, 4, (t) => 0.0034 * (1 - 0.3 * t), (t) => plain(b, stage === 4 ? '#b39a64' : '#a9c36a', stage === 4 ? '#8d744a' : '#d6b37c', t));
        }
      });
    }
    if (stage >= 3) {
      const earAz = az0 + Math.PI / 2 + (r() - 0.5) * 0.3;
      b.face = earAz;
      cornEar(b, stalk.getPoint(0.45), earAz, stage, cond, 1);
      if (!b.lod) cornEar(b, stalk.getPoint(0.36), earAz + 0.5, stage, cond, 0.72);
    }
  }
  function cornItem(b) {
    const base = new V3(-0.11, 0.036, 0), axis = new V3(1, 0, 0);
    cornCob(b, base, axis, 0.22, 0.034, 14, 30);
    husk(b, base.clone().addScaledVector(axis, 0.01), axis, 0.2, 0.034, 5, ['#7fb24c', '#b5d27e'], 'back');
    b.as(MAT.WAXY, () => tube(b, Curve([base.clone(), base.clone().addScaledVector(axis, -0.03), base.clone().addScaledVector(axis, -0.045)]), 2, 8, () => 0.016, () => plain(b, '#c9d49a')));
  }

  // =====================================================================
  // CARROT
  // =====================================================================
  const KP = { frond: '#4a9733', frondTip: '#6db84a', pet: '#6ea84a', petTip: '#5c9a3c', root: '#ec7a20', rootTip: '#cf5f18', shoulder: '#7f8a2c' };
  const CARROT_STAGES = [
    { name: 'Seedling', day: 8, height: 0.05 }, { name: 'Leafing', day: 25, height: 0.12 }, { name: 'Root forming', day: 45, height: 0.2 },
    { name: 'Bulking', day: 60, height: 0.28 }, { name: 'Ready', day: 75, height: 0.32 }
  ];
  const K_DEPTH = [0.012, 0.045, 0.095, 0.15, 0.18], K_R = [0.0016, 0.004, 0.009, 0.015, 0.019], K_L = [0.03, 0.09, 0.17, 0.24, 0.28], K_N = [1, 4, 7, 9, 10];
  function carrotRoot(b, top, axis, depth, R, cond) {
    const prof = [];
    const shapeR = (t) => (t < 0.04 ? 0.55 + t * 11 : t < 0.14 ? 1 : 1 - Math.pow((t - 0.14) / 0.86, 1.15) * 0.97);
    for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push([depth * t, Math.max(0.0004, R * shapeR(t))]); }
    const side = frame(axis).B;
    b.as(MAT.WAXY, () => lathe(b, top, axis, prof, 14, (t, i) => {
      const c = t < 0.07 ? hex(KP.shoulder).lerp(hex(KP.root), t / 0.07) : hex(KP.root).lerp(hex(KP.rootTip), t);
      if (cond === 'lown') c.lerp(hex('#e9a46a'), 0.35);
      if (cond === 'dry') c.lerp(hex('#b3703a'), 0.25);
      return c.multiplyScalar((i % 3 === 0 ? 1.08 : 1) * (0.95 + b.r() * 0.07));
    }, { rad: (a, t, i) => 1 - (i % 2 ? 0.035 : 0) + 0.03 * Math.sin(a * 3 + i), bend: [side, depth * 0.08] }));
    if (depth > 0.05) b.as(MAT.MATTE, () => {
      for (let k = 0; k < 16; k++) {
        const t = 0.2 + b.r() * 0.75, a = b.r() * Math.PI * 2, f = frame(axis);
        const out = f.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.B, Math.sin(a));
        const P = top.clone().addScaledVector(axis, depth * t).addScaledVector(out, R * shapeR(t) * 0.95).addScaledVector(side, depth * 0.08 * t * t);
        card(b, Curve([P, P.clone().addScaledVector(out, 0.006).addScaledVector(axis, 0.004), P.clone().addScaledVector(out, 0.012).addScaledVector(axis, 0.01)]), 2, () => 0.0004, () => plain(b, '#e8c49a'));
      }
    });
  }
  function carrotFrond(b, crown, D, L, erect, droop, age, cond, pairs) {
    const curve = leafCurve(crown, D, L, erect, droop);
    if (b.photo) {
      const w = L * ATLAS.slots.carrot.aspect * 0.5 * 1.15, lat = flatSide(D);
      ribbon(b, curve, 8, () => w, lat, { slot: 'carrot', tint: 0.6, fold: 0.02, cup: 0.18, twist: (b.r() - 0.5) * 0.8, colAt: (t) => shade(b, KP.frond, KP.frondTip, t, age, cond) });
      if (L > 0.12) ribbon(b, curve, 8, () => w * 0.8, lat.clone().applyAxisAngle(D, 1.1), { slot: 'carrot', tint: 0.6, fold: 0.02, cup: 0.1, colAt: (t) => shade(b, KP.frond, KP.frondTip, t, age, cond).multiplyScalar(0.92) });
      return;
    }
    tube(b, curve, 4, 3, (t) => (0.0011 + 0.0005 * L / 0.28) * (1 - 0.6 * t), (t) => shade(b, KP.pet, KP.petTip, t, age * 0.5, cond === 'rust' ? 'healthy' : cond));
    const lf = (P, dir, len, wid, t) => diamond(b, P, dir, flatSide(dir), len, wid, shade(b, KP.frond, KP.frond, t, age, cond), shade(b, KP.frondTip, KP.frondTip, t, age, cond));
    // tripinnate: each pinna is a short stalk with three lobed leaflets, each split again
    const pinna = (P, dir, s, t) => {
      const end = P.clone().addScaledVector(dir, s);
      card(b, Curve([P, P.clone().lerp(end, 0.5), end]), 1, () => 0.0005, () => shade(b, KP.pet, KP.pet, t, age, cond));
      [0.35, 0.7, 1].forEach((u, j) => {
        const Q = P.clone().lerp(end, u), sd = flatSide(dir);
        [-1, 1].forEach((side) => {
          if (j === 2 && side > 0) return;
          const d2 = j === 2 ? dir : dir.clone().multiplyScalar(0.5).addScaledVector(sd, side * 0.85).addScaledVector(Y, 0.15).normalize();
          const ls = s * (j === 2 ? 0.55 : 0.42);
          lf(Q, d2, ls, ls * 0.28, t);
          lf(Q.clone().addScaledVector(d2, ls * 0.4), d2.clone().addScaledVector(flatSide(d2), 0.8).normalize(), ls * 0.45, ls * 0.15, t);
          lf(Q.clone().addScaledVector(d2, ls * 0.4), d2.clone().addScaledVector(flatSide(d2), -0.8).normalize(), ls * 0.45, ls * 0.15, t);
        });
      });
    };
    for (let j = 0; j < pairs; j++) {
      const t = 0.32 + (j / pairs) * 0.6, P = curve.getPoint(t), T = curve.getTangent(t), lat = flatSide(T);
      const s = 0.055 * (L / 0.28) * (1.15 - t * 0.6);
      for (const sd of [-1, 1]) pinna(P, T.clone().multiplyScalar(0.45).addScaledVector(lat, sd * 0.85).addScaledVector(Y, 0.15).normalize(), s, t);
    }
    pinna(curve.getPoint(1), curve.getTangent(1), 0.04 * L / 0.28, 1);
  }
  function carrotPlant(b, stage, cond) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', y0 = stage >= 2 ? 0.012 : 0.003;
    carrotRoot(b, new V3(0, y0, 0), new V3(0, -1, 0), K_DEPTH[stage] * sc, K_R[stage] * sc, cond);
    const crown = new V3(0, y0 + 0.002, 0), az0 = r() * Math.PI * 2;
    if (stage === 0) for (let k = 0; k < 2; k++) {
      const D = dirOf(az0 + k * Math.PI);
      ribbon(b, leafCurve(crown, D, 0.028 * sc, 0.55, 0.1 + (dry ? 0.3 : 0)), 5, (t) => 0.0022 * Math.pow(1 - t, 0.5) * Math.min(1, 0.4 + t * 4), flatSide(D), { uv: 'grass', fold: 0.2, colAt: (t) => shade(b, '#6fb04a', '#8cc45e', t, 0.3, cond) });
    }
    for (let i = 0; i < K_N[stage]; i++) {
      const n = K_N[stage], D = dirOf(az0 + 0.6 + i * 2.39996), L = K_L[stage] * (0.72 + 0.38 * r()) * sc;
      carrotFrond(b, crown, D, L, 0.8 - 0.18 * (1 - i / n) - 0.08 * r(), 0.1 + (dry ? 0.55 : 0) + (stage === 4 ? 0.05 : 0), i / n < 0.4 ? 0.8 : 0.3, cond, stage === 0 ? 2 : stage < 3 ? 3 : 4);
    }
  }
  function carrotItem(b) {
    carrotRoot(b, new V3(0.08, 0.02, 0), new V3(-1, 0, 0.02).normalize(), 0.18, 0.02, 'healthy');
    for (let k = 0; k < 8; k++) {
      const a = k * 0.8, s = new V3(0.085, 0.02 + Math.sin(a) * 0.006, Math.cos(a) * 0.006);
      const e = s.clone().add(new V3(0.05 + b.r() * 0.025, Math.sin(a) * 0.016, Math.cos(a) * 0.016));
      tube(b, Curve([s, s.clone().lerp(e, 0.5), e]), 2, 3, () => 0.0017, (t) => plain(b, KP.pet, KP.frond, t));
    }
  }

  // =====================================================================
  // TOMATO
  // =====================================================================
  const TP = {
    leaf: '#3f832f', tip: '#58a03d', stem: '#5c8a39', stemTip: '#79a64b', wood: '#8a6a45', woodDark: '#6e5236',
    flower: '#f2cf31', anther: '#dba51f', calyx: '#4e8a33', green: '#7fb042', greenTop: '#5f9634', red: '#cf2d1a', redTop: '#d94a26', orange: '#e2742a'
  };
  const TOMATO_STAGES = [
    { name: 'Seedling', day: 10, height: 0.08 }, { name: 'Young plant', day: 30, height: 0.45 }, { name: 'Flowering', day: 50, height: 1.1 },
    { name: 'Green fruit', day: 70, height: 1.5 }, { name: 'Ripe', day: 90, height: 1.6 }
  ];
  function tomatoFruit(b, c, R, cA, cTop) {
    const prof = [[-0.95, 0], [-0.86, 0.38], [-0.68, 0.72], [-0.4, 0.93], [0, 1], [0.38, 0.95], [0.62, 0.82], [0.8, 0.55], [0.86, 0.22], [0.8, 0]].map((p) => [p[0] * R * 0.85, p[1] * R]);
    b.as(MAT.GLOSSY, () => lathe(b, c, Y, prof, 18, (t) => hex(cA).lerp(hex(cTop), Math.pow(t, 2.2)).multiplyScalar(0.96 + b.r() * 0.06), {
      rad: (a, t) => 1 - 0.045 * (0.5 + 0.5 * Math.cos(a * 5)) * Math.max(0, (t - 0.45) * 1.8)
    }));
    const top = c.clone().addScaledVector(Y, R * 0.69);
    b.as(MAT.MATTE, () => {
      tube(b, Curve([top.clone(), top.clone().addScaledVector(Y, R * 0.18), top.clone().addScaledVector(Y, R * 0.32).add(new V3(R * 0.08, 0, 0))]), 3, 5, () => R * 0.07, () => plain(b, TP.calyx));
      for (let k = 0; k < 6; k++) {
        const a = k * 1.047 + b.r() * 0.3, D = dirOf(a);
        const s = top.clone().addScaledVector(Y, R * 0.06);
        ribbon(b, Curve([s, s.clone().addScaledVector(D, R * 0.35).addScaledVector(Y, R * 0.05), s.clone().addScaledVector(D, R * 0.62).addScaledVector(Y, R * (b.r() < 0.5 ? 0.12 : -0.08))]), 3, (t) => R * 0.09 * (1 - t), flatSide(D), { uv: 'broad', fold: 0.2, colAt: (t) => plain(b, TP.calyx, '#6ea446', t) });
      }
    });
  }
  function tomatoFlower(b, c) {
    b.as(MAT.WAXY, () => {
      const tip = b.v(c.clone().addScaledVector(Y, -0.011), hex(TP.anther)), ring = [];
      const at = (ang, d, h) => c.clone().add(new V3(Math.cos(ang) * d, h, Math.sin(ang) * d));
      for (let k = 0; k < 5; k++) {
        const a = k * 1.2566; ring.push(at(a, 0.0026, 0));
        const p0 = b.v(at(a - 0.45, 0.003, 0), hex(TP.flower)), p1 = b.v(at(a, 0.009, 0.004), hex(TP.flower)), p2 = b.v(at(a, 0.014, 0.008), hex(TP.flower).multiplyScalar(1.05)), p3 = b.v(at(a + 0.45, 0.003, 0), hex(TP.flower));
        b.tri(p0, p1, p3); b.tri(p1, p2, p3);
      }
      for (let k = 0; k < 5; k++) b.tri(b.v(ring[k], hex(TP.anther)), b.v(ring[(k + 1) % 5], hex(TP.anther)), tip);
    });
  }
  function tomatoTruss(b, node, D, stage, ripeness, cond) {
    const c = Curve([node.clone(), node.clone().addScaledVector(D, 0.05).addScaledVector(Y, 0.015), node.clone().addScaledVector(D, 0.1).addScaledVector(Y, -0.025), node.clone().addScaledVector(D, 0.14).addScaledVector(Y, -0.075)]);
    b.as(MAT.MATTE, () => tube(b, c, 5, 4, () => 0.002, (t) => plain(b, TP.stem, TP.stemTip, t)));
    [0.3, 0.48, 0.66, 0.84, 1.0].forEach((t, k) => {
      const P = c.getPoint(t), lat = flatSide(c.getTangent(t)), sd = k % 2 ? 1 : -1;
      if (stage === 2 || (stage === 3 && k >= 3)) { tomatoFlower(b, P.clone().addScaledVector(lat, sd * 0.012).addScaledVector(Y, -0.008)); return; }
      if (stage < 3) return;
      const R = (stage === 3 ? 0.024 : 0.034) * (0.85 + b.r() * 0.3) * (cond === 'lown' ? 0.85 : 1) * (cond === 'dry' ? 0.85 : 1);
      const ctr = P.clone().addScaledVector(lat, sd * 0.019).addScaledVector(Y, -R * 0.95 - 0.01);
      let col = [TP.green, TP.greenTop];
      if (stage === 4) { const ripe = ripeness - k * 0.11 + b.r() * 0.15; col = ripe > 0.62 ? [TP.red, TP.redTop] : ripe > 0.38 ? [TP.orange, TP.redTop] : [TP.green, TP.greenTop]; }
      b.as(MAT.MATTE, () => tube(b, Curve([P.clone(), P.clone().lerp(ctr, 0.5).addScaledVector(Y, 0.006), ctr.clone().addScaledVector(Y, R * 0.85)]), 3, 3, () => 0.0013, () => hex(TP.stem)));
      tomatoFruit(b, ctr, R, col[0], col[1]);
    });
  }
  const TPAL = { leaf: TP.leaf, tip: TP.tip, stem: TP.stem, stemTip: TP.stemTip, serr: [11, 0.16], photo: 'tomato' };
  function tomatoPlant(b, stage, cond) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    if (stage === 0) { seedling(b, az0, 0.05, [TP.leaf, TP.tip], cond, { cot: [0.032, 0.009], stemCol: TP.stem }); compoundLeaf(b, new V3(0, 0.054, 0), dirOf(az0 + 1.57), 0.05, 0.1, 0, cond, TPAL, 1); return; }
    const H = TOMATO_STAGES[stage].height * (0.94 + r() * 0.1) * sc * (dry ? 0.92 : 1), sx = 0.085, pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new V3(Math.sin(k * 1.9) * 0.014 * t + (stage >= 2 ? sx * 0.6 * t : 0), t * H, Math.cos(k * 2.3) * 0.012 * t)); }
    pts[0].y = -0.005;
    const stem = Curve(pts), R0 = stage === 1 ? 0.006 : 0.01;
    b.as(MAT.MATTE, () => {
      tube(b, stem, 16, 7, (t) => R0 * (1 - 0.5 * t), (t) => plain(b, TP.stem, TP.stemTip, t));
      if (stage >= 2) {
        lathe(b, new V3(sx, -0.05, 0), Y, [[0, 0.013], [H + 0.2, 0.013], [H + 0.24, 0.002]], 6, (t, i, k) => hex(k % 2 ? TP.wood : TP.woodDark).lerp(hex(TP.wood), 0.5).multiplyScalar(0.9 + b.r() * 0.14));
        [0.3, 0.55, 0.8].forEach((t) => {
          const p = stem.getPoint(t), ring = [];
          for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ring.push(new V3((p.x + sx) / 2 + Math.cos(a) * (Math.abs(sx - p.x) / 2 + 0.016), p.y + Math.sin(a * 2) * 0.002, p.z / 2 + Math.sin(a) * 0.018)); }
          tube(b, Curve(ring, true), 8, 3, () => 0.002, () => plain(b, '#d9c79a'));
        });
      }
    });
    const nl = stage === 1 ? 6 : 12, trusses = stage >= 2 ? { 2: 1.0, 4: 0.9, 6: 0.75, 8: 0.6, 10: 0.45 } : {};
    let first = true;
    for (let i = 0; i < nl; i++) {
      const t = 0.08 + (i / nl) * 0.86, node = stem.getPoint(t), az = az0 + i * 2.4, D = dirOf(az), age = 1 - i / nl;
      const L = (0.24 + 0.12 * Math.sin(Math.PI * (0.25 + 0.75 * (i / nl)))) * sc * (stage === 1 ? 0.7 : 1);
      const droop = 0.3 + (dry ? 0.5 : 0) + age * 0.1;
      if (stage >= 2 && i % 3 === 1 && t < 0.8) {
        const end = node.clone().addScaledVector(D, 0.13).addScaledVector(Y, 0.12);
        b.as(MAT.MATTE, () => tube(b, Curve([node.clone(), node.clone().addScaledVector(D, 0.06).addScaledVector(Y, 0.035), end]), 4, 5, (tt) => 0.005 * (1 - 0.4 * tt), (tt) => plain(b, TP.stem, TP.stemTip, tt)));
        compoundLeaf(b, end, D.clone().applyAxisAngle(Y, 0.6), L * 0.9, droop, age, cond, TPAL, 3);
      }
      compoundLeaf(b, node, D, L, droop, age, cond, TPAL, 3);
      if (trusses[i] !== undefined) { const tAz = az + Math.PI; if (first) { b.face = tAz; first = false; } tomatoTruss(b, node.clone().addScaledVector(Y, 0.02), dirOf(tAz), stage, trusses[i], cond); }
    }
    compoundLeaf(b, stem.getPoint(1), dirOf(az0 + 1), 0.1 * sc, 0.1, 0, cond, TPAL, 2);
  }

  // =====================================================================
  // WATERMELON and PUMPKIN (vines)
  // =====================================================================
  const MP = { leaf: '#4f8a3c', tip: '#6c9f50', vine: '#6c9a48', dark: '#24501d', light: '#8fbe62', spot: '#e0cc72' };
  const MELON_STAGES = [
    { name: 'Seedling', day: 10, height: 0.05 }, { name: 'Vining', day: 30, height: 0.18 }, { name: 'Flowering', day: 50, height: 0.25 },
    { name: 'Fruit set', day: 65, height: 0.28 }, { name: 'Ripe', day: 90, height: 0.3 }
  ];
  function runner(b, origin, az, len, wob, col, cond) {
    const D = dirOf(az), Pp = flatSide(D), pts = [];
    for (let k = 0; k <= 9; k++) { const d = len * k / 9; pts.push(origin.clone().addScaledVector(D, d).addScaledVector(Pp, Math.sin(k * 1.4 + az * 3) * wob * Math.min(1, k / 2)).add(new V3(0, 0.012 + 0.006 * Math.sin(k * 2.1), 0))); }
    const c = Curve(pts);
    b.as(MAT.MATTE, () => tube(b, c, 18, 5, (t) => 0.0055 * (1 - 0.45 * t), (t) => shade(b, col, col, t, 0.2, cond === 'rust' ? 'healthy' : cond)));
    return c;
  }
  function melonFruit(b, c, axis, R, len, ripe) {
    const start = b.count(), hs = [];
    for (let i = 0; i <= 14; i++) hs.push(-1 + 2 * i / 14);
    b.as(MAT.GLOSSY, () => lathe(b, c, axis, hs.map((h) => [h * len / 2, R * Math.pow(Math.max(0, 1 - h * h), 0.5)]), 32, (t, i, k, a) => {
      const n = vnoise(t * 9, a * 1.6, 3) * 2.2 + vnoise(t * 25, a * 4, 7) * 0.6;
      const dark = Math.sin(a * 9 + n) > -0.15;
      return hex(dark ? MP.dark : MP.light).lerp(hex(MP.light), dark ? 0.12 * vnoise(t * 30, a * 8, 1) : 0).multiplyScalar(0.94 + b.r() * 0.08);
    }));
    if (ripe) tint(b, start, (x, y) => (y < c.y - R * 0.45 ? [MP.spot, Math.min(1, (c.y - R * 0.45 - y) / (R * 0.3)) * 0.85] : null));
    const tip = c.clone().addScaledVector(axis, len / 2);
    b.as(MAT.MATTE, () => tube(b, Curve([tip, tip.clone().addScaledVector(axis, 0.015).addScaledVector(Y, 0.007), tip.clone().addScaledVector(axis, 0.03).addScaledVector(Y, 0.004)]), 3, 4, () => 0.003, () => plain(b, MP.vine)));
  }
  function vinePlant(b, stage, cond, o) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    if (stage === 0) { seedling(b, az0, 0.04, o.pal, cond, { cot: [0.026, 0.013], trueL: 0.035, trueW: 0.8, lobes: o.lobes, serr: o.serr, stemCol: o.vine, slot: o.slot, photoScale: o.photoScale }); return null; }
    const nR = [0, 2, 3, 4, 4][stage], lenR = o.lens[stage] * sc, runners = [];
    b.as(MAT.MATTE, () => tube(b, Curve([new V3(0, -0.01, 0), new V3(0, 0.02, 0), new V3(0, 0.03, 0.005)]), 2, 6, () => 0.008, () => plain(b, o.vine)));
    for (let j = 0; j < nR; j++) {
      const az = az0 + (j * Math.PI * 2) / nR + (r() - 0.5) * 0.5, len = lenR * (0.8 + 0.3 * r());
      const curve = runner(b, new V3(0, 0.02, 0), az, len, 0.09, o.vine, cond);
      runners.push({ curve, az });
      const count = Math.max(2, Math.floor(len / o.spacing));
      for (let q = 0; q < count; q++) {
        const t = (q + 0.6) / (count + 0.3), P = curve.getPoint(t), side = q % 2 ? 1 : -1;
        const ld = dirOf(az + side * (0.9 + r() * 0.5)), ph = o.petH * (0.75 + 0.5 * r());
        const top = P.clone().addScaledVector(Y, ph).addScaledVector(ld, 0.02);
        b.as(MAT.MATTE, () => tube(b, Curve([P.clone(), P.clone().addScaledVector(Y, ph * 0.6).addScaledVector(ld, 0.005), top]), 3, 4, () => 0.0028, () => plain(b, o.vine)));
        const age = stage === 4 && o.dieBack ? 1 - t * 0.5 : 1 - t;
        const pal = stage === 4 && o.dieBack && r() < 0.4 ? ['#8d8a3c', '#a49650'] : o.pal;
        blade(b, top, ld, o.leafL * sc * (t < 0.2 ? 0.8 : 1) * (0.85 + 0.3 * r()), o.leafW * sc, {
          tilt: 0.35, droop: 0.3 + (dry ? 0.5 : 0), cup: o.cup || 0.25, lobes: o.lobes, width: o.width, serr: o.serr, wave: [22, 0.004, 2], pal, age, cond, segs: 10, vein: o.vein, slot: o.slot, photoScale: o.photoScale
        });
        if (q % 2 === 0) tendril(b, P.clone().addScaledVector(Y, 0.01), dirOf(az - side * 0.8), 0.09, o.vine);
        if (stage >= 2 && q === 1 && j < 3) flower(b, P.clone().addScaledVector(Y, 0.03).addScaledVector(ld, -0.03), o.flowerSize, o.flower[0], o.flower[1], 0.45);
      }
    }
    return runners;
  }
  function melonPlant(b, stage, cond) {
    const runners = vinePlant(b, stage, cond, {
      pal: [MP.leaf, MP.tip], vine: MP.vine, lens: [0, 0.5, 1.1, 1.5, 1.7], spacing: 0.16, petH: 0.09, leafL: 0.19, leafW: 0.08, cup: 0.15,
      width: (t) => Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * t)), 0.7) * (0.32 + 0.68 * Math.pow(Math.abs(Math.sin(t * Math.PI * 2.5)), 0.55)),
      vein: '#a9c98a', flower: ['#f0d33a', '#d9a520'], flowerSize: 0.022, slot: 'melon', photoScale: 1.5
    });
    if (!runners || stage < 3) return;
    const sc = cond === 'lown' ? 0.85 : 1;
    const fruits = stage === 3 ? [[0, 0.45, 0.05, 0.13], [1, 0.6, 0.045, 0.12]] : [[0, 0.5, 0.12, 0.33], [2, 0.55, 0.085, 0.22]];
    fruits.forEach(([j, t, R, len], n) => {
      const rn = runners[j % runners.length], P = rn.curve.getPoint(t), T = rn.curve.getTangent(t).setY(0).normalize();
      const c = P.clone().addScaledVector(flatSide(T), (R + 0.03) * sc).setY(R * sc * 0.9);
      if (n === 0) b.face = Math.atan2(c.z, c.x);
      melonFruit(b, c, T.applyAxisAngle(Y, 0.3), R * sc, len * sc, stage === 4);
    });
  }
  const PP = { leaf: '#3f7a2f', tip: '#5d9440', vine: '#6a8f42' };
  const PUMPKIN_STAGES = [
    { name: 'Seedling', day: 10, height: 0.06 }, { name: 'Vining', day: 30, height: 0.3 }, { name: 'Flowering', day: 55, height: 0.45 },
    { name: 'Green fruit', day: 75, height: 0.5 }, { name: 'Ripe', day: 110, height: 0.5 }
  ];
  function pumpkinFruit(b, c, R, Hf, ripe) {
    const prof = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, ang = t * Math.PI; prof.push([Hf * (0.5 - 0.5 * Math.cos(ang)) * 0.94, R * Math.pow(Math.sin(ang), 0.62) * (t < 0.08 || t > 0.92 ? 0.85 : 1) + R * 0.04]); }
    b.as(MAT.WAXY, () => lathe(b, c, Y, prof, 56, (t, i, k, a) => {
      const g = Math.pow(Math.abs(Math.cos(a * 5)), 0.5);
      const base = ripe ? hex('#c05a10').lerp(hex('#ef8a24'), g) : hex('#4f6b26').lerp(hex('#86a44a'), g);
      return base.lerp(hex(ripe ? '#f6b05a' : '#b2c46e'), 0.18 * Math.sin(t * Math.PI)).multiplyScalar(0.95 + b.r() * 0.07);
    }, { rad: (a, t) => 0.9 + 0.1 * Math.pow(Math.abs(Math.cos(a * 5)), 0.45) * (0.6 + 0.4 * Math.sin(t * Math.PI)) }));
    const top = c.clone().addScaledVector(Y, Hf * 0.92), side = dirOf(b.r() * 6.28);
    b.as(MAT.MATTE, () => lathe(b, top.clone().addScaledVector(Y, -0.01), Y, [[0, 0.026], [0.015, 0.017], [0.045, 0.014], [0.075, 0.013], [0.09, 0.01]], 12, (t) => plain(b, '#867a46', '#5b5230', t), { ribs: 0.22, bend: [side, 0.035] }));
  }
  function pumpkinPlant(b, stage, cond) {
    const runners = vinePlant(b, stage, cond, {
      pal: [PP.leaf, PP.tip], vine: PP.vine, lens: [0, 0.6, 1.3, 1.6, 1.7], spacing: 0.22, petH: 0.28, leafL: 0.36, leafW: 0.17, lobes: [5, 0.2], cup: 0.4, serr: [14, 0.08],
      vein: '#9dbb7a', flower: ['#f2a62a', '#e07d17'], flowerSize: 0.045, dieBack: true, slot: 'pumpkin', photoScale: 1.4
    });
    if (!runners || stage < 3) return;
    const sc = cond === 'lown' ? 0.85 : 1, rn = runners[0], P = rn.curve.getPoint(0.55), side = flatSide(rn.curve.getTangent(0.55).setY(0).normalize());
    const R = (stage === 3 ? 0.1 : 0.18) * sc, c = P.clone().addScaledVector(side, R + 0.04).setY(0);
    b.face = Math.atan2(c.z, c.x);
    pumpkinFruit(b, c, R, R * 1.4, stage === 4);
  }

  // =====================================================================
  // LETTUCE
  // =====================================================================
  const LP = { outer: '#4f9a32', outerTip: '#72b444', inner: '#a6d264', innerTip: '#c8e584', rib: '#e8f2cf' };
  const LETTUCE_STAGES = [
    { name: 'Seedling', day: 7, height: 0.03 }, { name: 'Young', day: 18, height: 0.07 }, { name: 'Rosette', day: 30, height: 0.12 },
    { name: 'Heading', day: 42, height: 0.16 }, { name: 'Ready', day: 55, height: 0.2 }
  ];
  function lettucePlant(b, stage, cond, head) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    const n = [4, 9, 16, 24, 30][stage], Lm = [0.03, 0.08, 0.13, 0.16, 0.18][stage] * sc * (head ? 0.85 : 1);
    b.as(MAT.MATTE, () => tube(b, Curve([new V3(0, -0.01, 0), new V3(0, 0.005, 0), new V3(0, 0.012, 0)]), 2, 6, () => 0.007, () => plain(b, '#d8e6b0')));
    for (let i = 0; i < n; i++) {
      const q = i / Math.max(1, n - 1), D = dirOf(az0 + i * 2.39996);
      const L = Lm * (1 - 0.55 * q) * (0.9 + 0.2 * r()), W = L * (stage < 1 ? 0.55 : 0.85);
      const start = new V3(D.x * 0.006 * (1 - q), 0.006 + 0.025 * q * (stage / 4), D.z * 0.006 * (1 - q));
      blade(b, start, D, L, W, {
        tilt: head ? 0.75 + 0.4 * q : 0.22 + 0.7 * q, droop: (head ? 0.05 : 0.35 * (1 - q)) + (dry ? 0.4 : 0), cup: 0.22 + 0.3 * q, fold: 0.04,
        wave: [30, W * 0.09, 4], waveGrow: true, pal: [mixHex(LP.outer, LP.inner, q), mixHex(LP.outerTip, LP.innerTip, q)], segs: 22, age: 1 - q, cond, vein: LP.rib, slot: 'lettuce', photoScale: 1.3, tint: 0.55,
        width: (t) => Math.pow(Math.sin(Math.PI * (0.1 + 0.82 * Math.pow(t, 0.8))), 0.5)
      });
    }
  }

  // =====================================================================
  // CABBAGE
  // =====================================================================
  const CB = { leaf: '#4a7a62', tip: '#77a088', head: '#7fa458', headTop: '#a3c477', wrap: '#7da562', vein: '#d6e6c8' };
  const CABBAGE_STAGES = [
    { name: 'Seedling', day: 10, height: 0.04 }, { name: 'Young', day: 25, height: 0.12 }, { name: 'Leafy', day: 45, height: 0.22 },
    { name: 'Heading', day: 65, height: 0.28 }, { name: 'Ready', day: 85, height: 0.3 }
  ];
  function cabbageHead(b, ctr, R) {
    const hs = [-1, -0.85, -0.6, -0.25, 0.15, 0.5, 0.78, 0.94, 1];
    b.as(MAT.FOLIAGE, () => {
      lathe(b, ctr, Y, hs.map((h) => [h * R * 0.92, R * 0.97 * Math.pow(Math.max(0, 1 - h * h), 0.5)]), 18, (t, i, k) => hex(CB.head).lerp(hex(CB.headTop), t).multiplyScalar(((k + i * 2) % 5 === 0 ? 0.92 : 1) * (0.96 + b.r() * 0.05)));
      // overlapping wrapper leaves, each hugging the head with a pale midrib and veins
      for (let j = 0; j < 9; j++) {
        const az = j * 2.39996 + 0.4, reach = 1.5 + (j % 3) * 0.35, pts = [];
        [0.3, 0.75, 1.15, 1.55, reach].forEach((ph) => pts.push(ctr.clone().add(new V3(Math.cos(az) * Math.sin(ph) * R * 1.03, -Math.cos(ph) * R * 1.0, Math.sin(az) * Math.sin(ph) * R * 1.03))));
        ribbon(b, Curve(pts), 12, b.photo ? () => R * 1.15 : (t) => R * 0.95 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.55), new V3(-Math.sin(az), 0, Math.cos(az)), {
          uv: 'broad', slot: b.photo ? 'cabbage' : null, tint: 0.75, fold: -0.06, cup: -0.12, wave: [12, R * 0.02, 3],
          colAt: (t, part, x) => { const c = plain(b, CB.wrap, CB.head, t); return part === 1 ? c.lerp(hex(CB.vein), 0.6) : Math.abs(Math.sin(x * 4 + t * 6)) < 0.15 ? c.lerp(hex(CB.vein), 0.3) : c; }
        });
      }
    });
  }
  function cabbagePlant(b, stage, cond, head) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    const hs = [0.02, 0.03, 0.04, 0.05, 0.05][stage];
    b.as(MAT.WAXY, () => tube(b, Curve([new V3(0, -0.01, 0), new V3(0, hs * 0.5, 0), new V3(0, hs, 0)]), 2, 7, () => (head ? 0.016 : 0.006 + 0.002 * stage), () => plain(b, '#b8cf98', '#cfe0b0', 0.5)));
    const n = head ? 3 : [3, 6, 9, 12, 13][stage], Lb = head ? 0.12 : [0.035, 0.12, 0.2, 0.24, 0.26][stage] * sc;
    b.as(MAT.WAXY, () => {
      for (let i = 0; i < n; i++) {
        const q = i / n, D = dirOf(az0 + i * 2.39996), L = Lb * (0.85 + 0.3 * r());
        blade(b, new V3(0, hs * (0.3 + 0.7 * q), 0).addScaledVector(D, 0.008), D, L, L * 0.88, {
          tilt: head ? 0.9 : 0.55 - 0.25 * (1 - q) * (stage / 4), droop: (head ? 0.1 : 0.32) + (dry ? 0.4 : 0), cup: 0.26, fold: 0.05, wave: [16, L * 0.025, 3], waveGrow: true,
          pal: [CB.leaf, CB.tip], segs: 16, age: 1 - q, cond, vein: CB.vein, slot: 'cabbage', photoScale: 1.35, tint: 0.7, width: (t) => Math.pow(Math.sin(Math.PI * (0.15 + 0.78 * t)), 0.5)
        });
      }
    });
    const R = head ? 0.085 : [0, 0, 0, 0.055, 0.095][stage] * sc;
    if (R > 0) cabbageHead(b, new V3(0, hs + R * 0.85, 0), R);
  }

  // =====================================================================
  // POTATO
  // =====================================================================
  const PO = { leaf: '#3f7a33', tip: '#579445', stem: '#5d8a3c', stemTip: '#6f9a48', skin: '#c89d66', eye: '#8a6640', flower: '#ece6f4', fctr: '#e8c22a' };
  const POTATO_STAGES = [
    { name: 'Sprouting', day: 12, height: 0.06 }, { name: 'Vegetative', day: 30, height: 0.3 }, { name: 'Flowering', day: 50, height: 0.5 },
    { name: 'Tuber bulking', day: 70, height: 0.55 }, { name: 'Ready', day: 100, height: 0.45 }
  ];
  function tuber(b, c, axis, R, len) {
    const hs = [-1, -0.9, -0.7, -0.4, 0, 0.4, 0.7, 0.9, 1], seed = b.r() * 50;
    const eyes = []; for (let k = 0; k < 7; k++) eyes.push([b.r() * Math.PI * 2, 0.15 + b.r() * 0.7]);
    const eyeAt = (a, t) => eyes.reduce((m, e) => { const da = Math.atan2(Math.sin(a - e[0]), Math.cos(a - e[0])), dt = (t - e[1]) * 4; return Math.max(m, Math.exp(-(da * da + dt * dt) * 18)); }, 0);
    b.as(MAT.MATTE, () => lathe(b, c, axis, hs.map((h) => [h * len / 2, R * Math.pow(Math.max(0, 1 - h * h), 0.5)]), 16, (t, i, k, a) => {
      const e = eyeAt(a, t), spk = vnoise(a * 6 + seed, t * 20, 2);
      return hex(PO.skin).lerp(hex(PO.eye), Math.max(e * 0.9, spk > 0.72 ? 0.35 : 0)).multiplyScalar(0.93 + b.r() * 0.1);
    }, { rad: (a, t) => (1 + 0.07 * (vnoise(a * 1.5 + seed, t * 3, 1) - 0.5)) * (1 - 0.14 * eyeAt(a, t)) }));
  }
  function potatoPlant(b, stage, cond) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2, dead = stage === 4;
    const pal = dead ? { leaf: '#b0a24a', tip: '#8a7438', stem: '#9a8c4a', stemTip: '#857640', serr: [7, 0.06], photo: 'potato' } : { leaf: PO.leaf, tip: PO.tip, stem: PO.stem, stemTip: PO.stemTip, serr: [7, 0.06], photo: 'potato' };
    if (stage === 0) {
      tuber(b, new V3(0, -0.07, 0), new V3(1, 0, 0), 0.026, 0.075);
      b.as(MAT.MATTE, () => tube(b, Curve([new V3(0, -0.05, 0), new V3(0.004, 0, 0), new V3(0, 0.05, 0.003)]), 4, 5, () => 0.003, (t) => plain(b, '#c9b48a', PO.stem, t)));
      compoundLeaf(b, new V3(0, 0.05, 0), dirOf(az0), 0.05, 0.05, 0, cond, pal, 1);
      compoundLeaf(b, new V3(0, 0.045, 0), dirOf(az0 + 2.6), 0.04, 0.05, 0, cond, pal, 1);
      return;
    }
    const H = POTATO_STAGES[stage].height * sc;
    for (let s = 0; s < 4; s++) {
      const a = az0 + s * 1.57 + r() * 0.4, D = dirOf(a), base = D.clone().multiplyScalar(0.015);
      const h = H * (0.8 + 0.3 * r()) * (dead ? 0.85 : 1);
      const stem = Curve([base.clone().setY(-0.01), base.clone().addScaledVector(D, 0.03).setY(h * 0.35), base.clone().addScaledVector(D, 0.07 + (dead ? 0.08 : 0)).setY(h * 0.7), base.clone().addScaledVector(D, 0.09 + (dead ? 0.15 : 0)).setY(h * (dead ? 0.75 : 1))]);
      b.as(MAT.MATTE, () => tube(b, stem, 7, 5, (t) => 0.0055 * (1 - 0.4 * t), (t) => plain(b, pal.stem, pal.stemTip, t)));
      const nl = stage === 1 ? 3 : 4;
      for (let i = 0; i < nl; i++) { const t = 0.3 + (i / nl) * 0.68; compoundLeaf(b, stem.getPoint(t), dirOf(a + (i % 2 ? 1.2 : -1.2) + r() * 0.3), (0.13 + 0.05 * r()) * sc, 0.25 + (dry || dead ? 0.45 : 0), 1 - t, cond, pal, 3); }
      if ((stage === 2 || stage === 3) && s < (stage === 2 ? 3 : 2)) {
        const top = stem.getPoint(1);
        for (let k = 0; k < (stage === 2 ? 5 : 2); k++) flower(b, top.clone().add(new V3((r() - 0.5) * 0.06, 0.02 + r() * 0.025, (r() - 0.5) * 0.06)), 0.015, PO.flower, PO.fctr, 0.2);
      }
    }
    const nt = [0, 2, 4, 6, 7][stage], Rt = [0, 0.012, 0.02, 0.03, 0.034][stage] * sc;
    for (let k = 0; k < nt; k++) {
      const a = k * 2.4 + r(), d = 0.05 + 0.07 * r(), c = new V3(Math.cos(a) * d, -0.035 - 0.07 * r(), Math.sin(a) * d);
      b.as(MAT.MATTE, () => tube(b, Curve([new V3(0, -0.015, 0), new V3(c.x * 0.5, c.y * 0.7 - 0.01, c.z * 0.5), c.clone()]), 4, 3, () => 0.0018, () => plain(b, '#d8c8a0')));
      tuber(b, c, dirOf(r() * 6.28).add(new V3(0, (r() - 0.5) * 0.3, 0)).normalize(), Rt, Rt * 2.7);
    }
  }

  // =====================================================================
  function single(fn, spots, salt, aoK) {
    return function (o) {
      const stage = o.stage | 0, cond = o.condition || 'healthy', seed = o.seed || 1;
      const b = new Builder(seed * 7919 + stage * 131 + cond.length + salt, spots, o.lod || 0, o.photo);
      fn(b, stage, cond);
      return finish(b, 1, aoK[stage]);
    };
  }
  function item(fn, salt, round) {
    return function (o) {
      const b = new Builder((o.seed || 1) * 104729 + salt, null, 0, o.photo);
      fn(b);
      if (o.dirty) dirtify(b, 0, o.amount === undefined ? 0.85 : o.amount);
      const g = finish(b, 1, 0), bb = g.boundingBox;
      g.userData.length = bb.max.x - bb.min.x; g.userData.height = bb.max.y - bb.min.y; g.userData.round = round;
      return g;
    };
  }
  const ao = (stages, k) => stages.map((s) => Math.max(0.04, s.height * k));

  const CROPS = {
    wheat: { name: 'Winter wheat', short: 'Wheat', unit: 'clump', disease: 'Rust', spot: '#c47a2a', dot: '#d8b25b', item: 'Wheat sheaf',
      STAGES: WHEAT_STAGES, field: { row: 0.17, step: 0.11, size: 4.2, stems: (s) => (s < 2 ? 1 : 3), lod: 1 }, stiff: 1,
      note: 'Each clump tillers into several stems. Ears carry two florets per spikelet and long awns, turn gold and nod as the grain fills.',
      clump: wheatClump, produce: item(wheatSheaf, 1, false) },
    corn: { name: 'Corn', short: 'Corn', unit: 'plant', disease: 'Rust', spot: '#c47a2a', dot: '#e3c35a', item: 'Corn cob',
      STAGES: CORN_STAGES, field: { row: 0.75, step: 0.24, size: 6, lod: 1 }, stiff: 0.5,
      note: 'Leaf sheaths wrap the stalk at every node. The branched tassel sheds pollen onto the silks; at maturity the husk dries and opens on a cob of individual kernels.',
      clump: single(cornPlant, { rate: 0.2, a: '#c47a2a', b: '#7d3f14' }, 17, ao(CORN_STAGES, 0.15)), produce: item(cornItem, 2, false) },
    carrot: { name: 'Carrot', short: 'Carrot', unit: 'plant', disease: 'Leaf blight', spot: '#6b4423', dot: '#e8761f', item: 'Carrot',
      STAGES: CARROT_STAGES, field: { row: 0.3, step: 0.07, size: 4.2 }, stiff: 0.8, rootDepth: K_DEPTH,
      note: 'Finely divided fronds above, a ringed root with fine hairs below. Pull one up to check the root before harvest.',
      clump: single(carrotPlant, { rate: 0.2, a: '#6b4423', b: '#a08a3a' }, 29, ao(CARROT_STAGES, 0.35)), produce: item(carrotItem, 3, false) },
    tomato: { name: 'Tomato', short: 'Tomato', unit: 'plant', disease: 'Blight', spot: '#6b4423', dot: '#d0331f', item: 'Tomato',
      STAGES: TOMATO_STAGES, field: { row: 1.0, step: 0.6, size: 5, lod: 1 }, stiff: 0.35,
      note: 'Staked and tied from flowering. Toothed compound leaves, glossy ribbed fruit with a star calyx, ripening from the lowest truss up.',
      clump: single(tomatoPlant, { rate: 0.22, a: '#4a3220', b: '#b7a03a' }, 41, ao(TOMATO_STAGES, 0.15)),
      produce: item((b) => tomatoFruit(b, new V3(0, 0.035 * 0.81, 0), 0.035, TP.red, TP.redTop), 4, true) },
    watermelon: { name: 'Watermelon', short: 'Watermelon', unit: 'plant', disease: 'Powdery mildew', spot: '#d9d6c0', dot: '#3f7a2f', item: 'Watermelon',
      STAGES: MELON_STAGES, field: { row: 1.8, step: 1.0, size: 7, lod: 1 }, stiff: 0.6, spread: 3.0,
      note: 'Vines with deeply lobed leaves and curling tendrils. Ripe melons have jagged stripes and a creamy patch where they rested on the soil.',
      clump: single(melonPlant, { rate: 0.3, a: '#d9d6c0', b: '#b8b49a' }, 53, ao(MELON_STAGES, 0.8)),
      produce: item((b) => melonFruit(b, new V3(0, 0.12 * 0.95, 0), new V3(1, 0, 0), 0.12, 0.34, true), 5, true) },
    pumpkin: { name: 'Pumpkin', short: 'Pumpkin', unit: 'plant', disease: 'Powdery mildew', spot: '#d9d6c0', dot: '#ea8420', item: 'Pumpkin',
      STAGES: PUMPKIN_STAGES, field: { row: 2.0, step: 1.2, size: 8, lod: 1 }, stiff: 0.5, spread: 3.2,
      note: 'Big toothed leaves on tall stalks shade deeply ribbed fruit with a woody stem. The vines die back as the pumpkin turns orange.',
      clump: single(pumpkinPlant, { rate: 0.3, a: '#d9d6c0', b: '#b8b49a' }, 67, ao(PUMPKIN_STAGES, 0.6)),
      produce: item((b) => pumpkinFruit(b, new V3(0, 0, 0), 0.17, 0.24, true), 6, false) },
    lettuce: { name: 'Lettuce', short: 'Lettuce', unit: 'plant', disease: 'Downy mildew', spot: '#c9c25a', dot: '#9bcf5f', item: 'Lettuce head',
      STAGES: LETTUCE_STAGES, field: { row: 0.35, step: 0.3, size: 4.2 }, stiff: 0.4,
      note: 'Ruffled leaves with pale ribs grow from the centre outward; the inner leaves stay light and cup into a loose head.',
      clump: single(lettucePlant, { rate: 0.25, a: '#c9c25a', b: '#8a7a3a' }, 79, ao(LETTUCE_STAGES, 0.7)), produce: item((b) => lettucePlant(b, 4, 'healthy', true), 7, false) },
    cabbage: { name: 'Cabbage', short: 'Cabbage', unit: 'plant', disease: 'Black rot', spot: '#4a3b22', dot: '#8db497', item: 'Cabbage head',
      STAGES: CABBAGE_STAGES, field: { row: 0.6, step: 0.5, size: 5 }, stiff: 0.3,
      note: 'Waxy blue-green outer leaves with pale veins feed a tight head of overlapping wrapper leaves.',
      clump: single(cabbagePlant, { rate: 0.22, a: '#4a3b22', b: '#c9b84a' }, 83, ao(CABBAGE_STAGES, 0.6)), produce: item((b) => cabbagePlant(b, 4, 'healthy', true), 8, true) },
    potato: { name: 'Potato', short: 'Potato', unit: 'plant', disease: 'Late blight', spot: '#4a3220', dot: '#c49a64', item: 'Potato',
      STAGES: POTATO_STAGES, field: { row: 0.75, step: 0.32, size: 5, lod: 1 }, stiff: 0.6, rootDepth: [0.09, 0.08, 0.11, 0.13, 0.14],
      note: 'Tubers with sunken eyes and speckled skin swell underground on runners. The tops flower, then yellow and fall over when ready to dig.',
      clump: single(potatoPlant, { rate: 0.22, a: '#4a3220', b: '#b7a03a' }, 97, ao(POTATO_STAGES, 0.3)),
      produce: item((b) => tuber(b, new V3(0, 0.034, 0), new V3(1, 0, 0.15).normalize(), 0.034, 0.1), 9, true) }
  };
  const CONDITIONS = { healthy: 'Healthy', dry: 'Dry', lown: 'Low nitrogen', rust: 'Disease' };

  // Helper for pages: make the four crop materials. o: { map, colorBoost, roughness (multiplier), onBeforeCompile }
  function makeMaterials(o) {
    o = o || {};
    return MATERIALS.map((d) => {
      const m = new THREE.MeshStandardMaterial({ name: d.name, vertexColors: true, side: THREE.DoubleSide, roughness: Math.min(1, d.roughness * (o.roughness || 1)), metalness: 0, map: o.map || null });
      if (o.normalMap) { m.normalMap = o.normalMap; m.normalScale = new THREE.Vector2(0.8, 0.8); }
      if (o.alphaTest) m.alphaTest = o.alphaTest;
      if (o.colorBoost) m.color.setScalar(o.colorBoost);
      const i = MATERIALS.indexOf(d);
      if (o.onBeforeCompile) { m.onBeforeCompile = (sh) => o.onBeforeCompile(sh, i); m.customProgramCacheKey = () => 'fwcrop' + i + (o.key || ''); }
      if (o.envMapIntensity !== undefined) m.envMapIntensity = o.envMapIntensity;
      return m;
    });
  }

  root.FWCrops = { CROPS, CONDITIONS, MATERIALS, MAT, rng, leafTexture, soilTexture, makeMaterials, hasPhotoAtlas: !!ATLAS };
})(typeof window !== 'undefined' ? window : globalThis);
