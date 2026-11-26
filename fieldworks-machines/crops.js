/* Fieldworks crop models.
   Nine crops, five growth stages each, plus a harvested item (dirty or washed) for each crop.
   Every model is one BufferGeometry with vertex colours and UVs into a shared leaf-vein texture (leafTexture()).
   Units are metres; a plant's base sits at the origin, roots and tubers go below y = 0. Needs a global THREE (r147). */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const V3 = THREE.Vector3;
  const Y = new V3(0, 1, 0);
  const Curve = (pts, closed) => new THREE.CatmullRomCurve3(pts, !!closed);
  const dirOf = (az) => new V3(Math.cos(az), 0, Math.sin(az));

  function rng(seed) {
    let s = ((seed + 1) * 2654435761) >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  const hexCache = new Map();
  function hex(h) {
    let c = hexCache.get(h);
    if (!c) { c = new THREE.Color(h).convertSRGBToLinear(); hexCache.set(h, c); }
    return c.clone();
  }
  function mixHex(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
  function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const L = (a, b, t) => a + (b - a) * t, c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  const COND = { dry: '#a3925a', dryTip: '#8a6f43', lown: '#c9d273' };

  // ---------- shared leaf texture: grass veins | broad-leaf veins | plain ----------
  const UVR = { grass: [0.02, 0.44], broad: [0.52, 0.94] };
  function leafTexture() {
    const W = 512, H = 256, d = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = (y + 0.5) / H;
      const n = (hash3(x * 0.37, y * 0.53, 1) - 0.5) * 0.03 + (vnoise(x / 6, y / 6, 3) - 0.5) * 0.05;
      let val;
      if (u < 0.47) {
        const a = Math.min(1, Math.max(0, (u - 0.02) / 0.42)), mid = Math.abs(a - 0.5);
        val = 0.84 + 0.07 * Math.pow(Math.max(0, Math.cos(a * Math.PI * 2 * 9)), 6) + (mid < 0.035 ? 0.15 * (1 - mid / 0.035) : 0) - 0.05 * Math.pow(mid * 2, 4) + n;
      } else if (u < 0.965) {
        const a = Math.min(1, Math.max(0, (u - 0.52) / 0.42)), mid = Math.abs(a - 0.5);
        const sec = v * 7 - mid * 6, fr = sec - Math.floor(sec);
        val = 0.83 + (mid < 0.03 ? 0.17 * (1 - mid / 0.03) : 0) + (fr < 0.07 && mid > 0.03 ? 0.1 * (1 - fr / 0.07) : 0)
          + (vnoise(x / 3.5, y / 3.5, 7) > 0.72 ? 0.035 : 0) - 0.06 * Math.pow(mid * 2, 3) + n;
      } else val = 0.87;
      const i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = Math.round(Math.max(0, Math.min(1, val)) * 255); d[i + 3] = 255;
    }
    return { width: W, height: H, data: d, colorBoost: 1.15 };
  }

  // ---------- geometry builder ----------
  function Builder(seed, spots) { this.p = []; this.c = []; this.uv = []; this.i = []; this.r = rng(seed); this.spots = spots; this.face = 0; }
  Builder.prototype.v = function (pos, col, u, v) {
    this.p.push(pos.x, pos.y, pos.z); this.c.push(col.r, col.g, col.b);
    this.uv.push(u === undefined ? 0.985 : u, v === undefined ? 0.5 : v);
    return this.p.length / 3 - 1;
  };
  Builder.prototype.tri = function (a, b, c) { this.i.push(a, b, c); };
  Builder.prototype.count = function () { return this.p.length / 3; };
  Builder.prototype.geometry = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  };
  // Recolour vertices from `start` on: fn(x, y, z) returns [hexColour, amount] or null.
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
    const N = new V3().crossVectors(B, T).normalize();
    return { B, N };
  }
  function orth(v, T) {
    const o = v.clone().sub(T.clone().multiplyScalar(v.dot(T)));
    return o.lengthSq() < 1e-10 ? frame(T).B : o.normalize();
  }
  function flatSide(dir) {
    const s = new V3().crossVectors(Y, dir);
    return s.lengthSq() < 1e-6 ? frame(dir).B : s.normalize();
  }

  function shade(b, base, tip, t, age, cond) {
    const col = hex(base).lerp(hex(tip), Math.pow(Math.min(1, Math.max(0, t)), 1.5));
    if (cond === 'dry') col.lerp(hex(COND.dry), 0.35 + 0.3 * age).lerp(hex(COND.dryTip), 0.6 * Math.pow(t, 2.5));
    else if (cond === 'lown') col.lerp(hex(COND.lown), 0.25 + 0.5 * age);
    else if (cond === 'rust' && b.spots && b.r() < b.spots.rate * (0.6 + 0.9 * age)) col.lerp(hex(b.r() < 0.55 ? b.spots.a : b.spots.b), 0.8);
    return col.multiplyScalar(0.94 + b.r() * 0.1);
  }
  const plain = (b, base, tip, t) => hex(base).lerp(hex(tip || base), Math.max(0, Math.min(1, t || 0))).multiplyScalar(0.94 + b.r() * 0.1);

  // ---------- parts ----------
  function tube(b, curve, segs, radial, rad, colAt) {
    const rings = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, P = curve.getPoint(t), f = frame(curve.getTangent(t)), r = rad(t), ring = [];
      for (let k = 0; k < radial; k++) {
        const a = (k / radial) * Math.PI * 2;
        ring.push(b.v(P.clone().addScaledVector(f.N, Math.cos(a) * r).addScaledVector(f.B, Math.sin(a) * r), colAt(t)));
      }
      rings.push(ring);
    }
    for (let s = 0; s < segs; s++) for (let k = 0; k < radial; k++) {
      const a = rings[s][k], c = rings[s][(k + 1) % radial], d = rings[s + 1][k], e = rings[s + 1][(k + 1) % radial];
      b.tri(a, c, d); b.tri(c, e, d);
    }
  }

  // A blade with a raised midrib (three vertices across). o.uv picks the vein pattern.
  function ribbon(b, curve, segs, width, lateral0, o) {
    const reg = UVR[o.uv];
    let prev = null;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, P = curve.getPoint(t), T = curve.getTangent(t);
      const S = orth(lateral0.clone().applyAxisAngle(T, (o.twist || 0) * t), T);
      const W = new V3().crossVectors(S, T).normalize();
      const w = width(t), fold = w * (o.fold === undefined ? 0.3 : o.fold);
      const wl = o.wave ? Math.sin(t * o.wave[0]) * o.wave[1] : 0, wr = o.wave ? Math.sin(t * o.wave[0] + 2.1) * o.wave[1] : 0;
      const u = (j) => (reg ? reg[0] + (reg[1] - reg[0]) * j / 2 : undefined);
      const row = [
        b.v(P.clone().addScaledVector(S, -w).addScaledVector(W, wl), o.colAt(t, 0), u(0), t),
        b.v(P.clone().addScaledVector(W, fold), o.colAt(t, 1), u(1), t),
        b.v(P.clone().addScaledVector(S, w).addScaledVector(W, wr), o.colAt(t, 2), u(2), t)
      ];
      if (prev) {
        b.tri(prev[0], prev[1], row[0]); b.tri(prev[1], row[1], row[0]);
        b.tri(prev[1], prev[2], row[1]); b.tri(prev[2], row[2], row[1]);
      }
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

  // Body turned around an axis. prof = [[height, radius], ...]; colAt(t, ring, segment).
  function lathe(b, origin, axis, prof, radial, colAt, ribs, jitter) {
    const f = frame(axis), rings = [];
    prof.forEach((pr, i) => {
      const t = i / (prof.length - 1), c = origin.clone().addScaledVector(axis, pr[0]), ring = [];
      for (let k = 0; k < radial; k++) {
        const a = (k / radial) * Math.PI * 2 + Math.PI / radial;
        const rr = pr[1] * (ribs && k % 2 ? 1 - ribs : 1) * (jitter ? 1 + (b.r() - 0.5) * jitter : 1);
        ring.push(b.v(c.clone().addScaledVector(f.N, Math.cos(a) * rr).addScaledVector(f.B, Math.sin(a) * rr), colAt(t, i, k)));
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
      const ctr = b.v(R.c, colAt(R.t, R.i, 0));
      for (let k = 0; k < radial; k++) {
        const a = R.ring[k], c = R.ring[(k + 1) % radial];
        if (idx === 0) b.tri(ctr, c, a); else b.tri(ctr, a, c);
      }
    });
  }

  function diamond(b, c, dir, perp, len, wid, col, colTip) {
    const base = b.v(c, col, 0.73, 0), tip = b.v(c.clone().addScaledVector(dir, len), colTip, 0.73, 1);
    const m = c.clone().addScaledVector(dir, len * 0.42);
    const l = b.v(m.clone().addScaledVector(perp, -wid), col, 0.52, 0.42), r = b.v(m.clone().addScaledVector(perp, wid), col, 0.94, 0.42);
    b.tri(base, l, tip); b.tri(base, tip, r);
  }

  function leafCurve(node, D, L, erect, droop) {
    const pt = (out, up) => node.clone().addScaledVector(D, L * out).addScaledVector(Y, L * up);
    return Curve([
      node.clone(),
      pt(0.12 * (1 - erect), 0.3),
      pt(0.42 * (1 - erect * 0.6), 0.55 + 0.2 * erect - droop * 0.3),
      pt(0.68 * (1 - erect * 0.5), 0.62 + 0.3 * erect - droop * 0.85),
      pt(0.86 * (1 - erect * 0.4), 0.52 + 0.38 * erect - droop * 1.55)
    ]);
  }

  // A broad leaf blade leaving `start` along `dir`. Faces up, cupped by o.cup, lobed or frilled.
  function blade(b, start, dir, L, W, o) {
    const up = o.tilt === undefined ? 0.3 : o.tilt, dr = o.droop || 0;
    const pt = (f, h) => start.clone().addScaledVector(dir, L * f).addScaledVector(Y, L * h);
    const curve = Curve([start.clone(), pt(0.33, up * 0.45 + 0.02), pt(0.66, up * 0.72 - dr * 0.22), pt(1.0, up * 0.78 - dr * 0.62)]);
    const lob = o.lobes, wf = o.width || ((t) => Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * t)), 0.7));
    ribbon(b, curve, o.segs || 6, (t) => W * wf(t) * (lob ? 1 + lob[1] * Math.sin(t * Math.PI * lob[0]) : 1), flatSide(dir), {
      uv: 'broad', fold: o.cup === undefined ? 0.35 : o.cup, wave: o.wave, twist: o.twist || 0,
      colAt: (t, part) => { const c = shade(b, o.pal[0], o.pal[1], t, o.age || 0, o.cond); return part === 1 ? c.multiplyScalar(1.07) : c; }
    });
    return curve;
  }

  function flower(b, c, size, pet, ctr, cup) {
    const tipC = b.v(c.clone().addScaledVector(Y, size * 0.18), hex(ctr));
    const at = (ang, d, h) => c.clone().add(new V3(Math.cos(ang) * d, h, Math.sin(ang) * d));
    const a0 = b.r() * 6.28;
    for (let k = 0; k < 5; k++) {
      const a = a0 + k * 1.2566;
      b.tri(b.v(at(a - 0.55, size * 0.18, 0), hex(pet)), b.v(at(a, size, size * (cup === undefined ? 0.35 : cup)), hex(pet).multiplyScalar(1.05)), b.v(at(a + 0.55, size * 0.18, 0), hex(pet)));
      b.tri(b.v(at(a - 0.6, size * 0.2, 0), hex(ctr)), b.v(at(a + 0.6, size * 0.2, 0), hex(ctr)), tipC);
    }
  }

  // Compound leaf (tomato, potato): petiole, `pairs` pairs of leaflets and a tip leaflet.
  function compoundLeaf(b, node, D, L, droop, age, cond, pal, pairs) {
    const curve = leafCurve(node, D, L, 0.28, droop);
    tube(b, curve, 3, 3, (t) => 0.0017 * (1 - 0.5 * t), (t) => shade(b, pal.stem, pal.stemTip, t, age * 0.4, cond === 'rust' ? 'healthy' : cond));
    const leaflet = (P, dir, ll) => {
      const c = Curve([P.clone(), P.clone().addScaledVector(dir, ll * 0.5).addScaledVector(Y, ll * 0.05), P.clone().addScaledVector(dir, ll).addScaledVector(Y, -ll * (0.15 + droop * 0.3))]);
      ribbon(b, c, 3, (t) => ll * 0.36 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * t)), 0.8), flatSide(dir), {
        uv: 'broad', fold: 0.28 + (cond === 'dry' ? 0.5 : 0), wave: [16, ll * 0.03],
        colAt: (t, part) => { const k = shade(b, pal.leaf, pal.tip, t, age, cond); return part === 1 ? k.multiplyScalar(1.08) : k; }
      });
    };
    for (let j = 0; j < pairs; j++) {
      const t = 0.34 + (j / pairs) * 0.5, P = curve.getPoint(t), T = curve.getTangent(t), lat = flatSide(T);
      for (const sd of [-1, 1]) leaflet(P, T.clone().multiplyScalar(0.35).addScaledVector(lat, sd * 0.9).addScaledVector(Y, -0.1).normalize(), L * (0.4 - 0.06 * j));
    }
    leaflet(curve.getPoint(1), curve.getTangent(1), L * 0.42);
  }

  function seedling(b, az0, H, pal, cond, o) {
    const stem = Curve([new V3(0, -0.004, 0), new V3(0.002, H * 0.5, 0), new V3(0, H, 0.002)]);
    tube(b, stem, 3, 4, (t) => (o.stemR || 0.0022) * (1 - 0.3 * t), (t) => plain(b, o.stemCol || '#7fa64e', o.stemCol || '#7fa64e', t));
    const top = stem.getPoint(1);
    for (let k = 0; k < 2; k++) {
      blade(b, top, dirOf(az0 + k * Math.PI), o.cot[0], o.cot[1], { tilt: 0.25, droop: cond === 'dry' ? 0.6 : 0.1, cup: 0.15, pal: o.cotPal || ['#79b350', '#93c565'], cond, segs: 4 });
    }
    if (o.trueL) blade(b, top.clone().addScaledVector(Y, 0.003), dirOf(az0 + Math.PI / 2), o.trueL, o.trueL * (o.trueW || 0.6), { tilt: 0.7, droop: 0.05, cup: 0.3, pal, cond, lobes: o.lobes, segs: 4 });
  }

  // Soil on a harvested item: patches, more toward the bottom, and a few stuck clods.
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
    for (let k = 0; k < clods; k++) {
      const v = start + Math.floor(b.r() * (end - start));
      const p = new V3(b.p[v * 3], b.p[v * 3 + 1], b.p[v * 3 + 2]);
      if (p.y > minY + hgt * 0.65) continue;
      const r = size * (0.018 + b.r() * 0.022), col = hex(b.r() < 0.5 ? '#5a4029' : '#6e5236');
      const pts = [new V3(r, 0, 0), new V3(-r, 0, 0), new V3(0, r * 0.8, 0), new V3(0, -r * 0.8, 0), new V3(0, 0, r), new V3(0, 0, -r)]
        .map((q) => b.v(q.multiplyScalar(0.8 + b.r() * 0.4).add(p), col.clone().multiplyScalar(0.85 + b.r() * 0.3)));
      [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]].forEach((f) => b.tri(pts[f[0]], pts[f[1]], pts[f[2]]));
    }
  }

  function finish(b, stems, aoH) {
    if (aoH) {
      for (let v = 0; v < b.count(); v++) {
        const y = b.p[v * 3 + 1];
        if (y < 0) continue;
        const f = 0.58 + 0.42 * Math.min(1, Math.pow(y / aoH, 0.7));
        b.c[v * 3] *= f; b.c[v * 3 + 1] *= f; b.c[v * 3 + 2] *= f;
      }
    }
    const g = b.geometry();
    g.userData = { stems: stems || 1, triangles: b.i.length / 3, face: b.face };
    return g;
  }

  // =====================================================================
  // WHEAT
  // =====================================================================
  const WP = {
    leaf: ['#7dbd45', '#62a63b', '#529735', '#5b9837', '#b39a4f'],
    leafTip: ['#9ccc5c', '#86bb52', '#79b04c', '#86b04a', '#d1b866'],
    stalk: ['#8cbc52', '#86b84f', '#7aac46', '#8fb24c', '#d8ba69'],
    ear: ['#9ec450', '#9ec450', '#9ec450', '#a3c654', '#d8b25b'],
    earHi: ['#c2db7a', '#c2db7a', '#c2db7a', '#c6dc7e', '#ecd089'],
    awn: ['#b8d474', '#b8d474', '#b8d474', '#bfd77f', '#ead492']
  };
  const WHEAT_STAGES = [
    { name: 'Seedling', day: 7, height: 0.10 }, { name: 'Tillering', day: 30, height: 0.22 },
    { name: 'Stem extension', day: 65, height: 0.58 }, { name: 'Heading', day: 95, height: 0.86 }, { name: 'Ripe', day: 130, height: 0.88 }
  ];

  function wheatLeaf(b, node, az, L, erect, droop, stage, age, cond) {
    const D = dirOf(az), maxW = 0.0105 * (stage < 2 ? 0.8 : 1);
    ribbon(b, leafCurve(node, D, L, erect, droop), 10, (t) => maxW * Math.pow(1 - t, 0.75) * Math.min(1, 0.4 + t * 5), flatSide(D), {
      uv: 'grass', twist: (b.r() - 0.5) * 0.9, fold: 0.35 + (cond === 'dry' ? 0.5 : 0),
      colAt: (t, part) => { const c = shade(b, WP.leaf[stage], WP.leafTip[stage], t, age, cond); return part === 1 ? c.multiplyScalar(1.08) : c; }
    });
  }

  function wheatEar(b, top, T0, lean, stage, cond) {
    const ripe = stage === 4, len = ripe ? 0.092 : 0.082;
    const nod = (ripe ? 1.0 : 0.15) + (cond === 'dry' ? 0.4 : 0);
    const side = lean.clone().setY(0);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const bend = (k) => side.clone().multiplyScalar(len * 0.16 * nod * k).addScaledVector(Y, -len * 0.12 * nod * k * k);
    const curve = Curve([top.clone(), top.clone().addScaledVector(T0, len * 0.35).add(bend(0.6)), top.clone().addScaledVector(T0, len * 0.7).add(bend(1.6)), top.clone().addScaledVector(T0, len).add(bend(2.8))]);
    tube(b, curve, 6, 3, () => 0.0016, (t) => shade(b, WP.stalk[stage], WP.ear[stage], t, 0, cond));
    for (let i = 0; i < 16; i++) {
      const t = 0.04 + (i / 15) * 0.92, P = curve.getPoint(t), T = curve.getTangent(t), f = frame(T);
      const sd = i % 2 ? 1 : -1, size = 1 - Math.pow(Math.abs(t - 0.45) * 1.3, 2) * 0.5;
      const S = f.B.clone().applyAxisAngle(T, (i % 4 < 2 ? 0.25 : -0.25));
      const dir = T.clone().addScaledVector(S, sd * 0.55).normalize();
      const c = P.clone().addScaledVector(S, sd * 0.006);
      const Ls = 0.0175 * size, Ws = 0.0085 * size, Th = 0.006 * size;
      const W = new V3().crossVectors(dir, S).normalize();
      const col = shade(b, WP.ear[stage], WP.earHi[stage], b.r() * 0.6, 0, cond), colHi = col.clone().lerp(hex(WP.earHi[stage]), 0.5);
      const tip = b.v(c.clone().addScaledVector(dir, Ls * 0.6), colHi), bot = b.v(c.clone().addScaledVector(dir, -Ls * 0.4), col);
      const l = b.v(c.clone().addScaledVector(S, -Ws / 2), col), r = b.v(c.clone().addScaledVector(S, Ws / 2), col);
      const fr = b.v(c.clone().addScaledVector(W, Th / 2), colHi), bk = b.v(c.clone().addScaledVector(W, -Th / 2), col);
      b.tri(tip, l, fr); b.tri(tip, fr, r); b.tri(tip, r, bk); b.tri(tip, bk, l);
      b.tri(bot, fr, l); b.tri(bot, r, fr); b.tri(bot, bk, r); b.tri(bot, l, bk);
      const aLen = (ripe ? 0.062 : 0.05) * (0.8 + b.r() * 0.4);
      const aDir = T.clone().addScaledVector(S, sd * (ripe ? 0.5 : 0.3)).normalize();
      const a0 = c.clone().addScaledVector(dir, Ls * 0.55), a1 = a0.clone().addScaledVector(aDir, aLen);
      const ac = hex(WP.awn[stage]), act = ac.clone().multiplyScalar(1.1);
      [W, S].forEach((ax) => { const aw = ax.clone().multiplyScalar(0.0009); b.tri(b.v(a0.clone().sub(aw), ac), b.v(a0.clone().add(aw), ac), b.v(a1, act)); });
    }
  }

  function wheatStem(b, origin, stageIdx, cond) {
    const r = b.r, st = WHEAT_STAGES[stageIdx], lowN = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry';
    const droopBase = dry ? 0.45 : 0.12, az0 = r() * Math.PI * 2;
    if (stageIdx === 0) { for (let k = 0; k < 3; k++) wheatLeaf(b, origin.clone(), az0 + k * 2.3 + r() * 0.4, (0.08 + r() * 0.04) * lowN, 0.78, droopBase * 0.6, 0, k / 3, cond); return; }
    if (stageIdx === 1) { for (let k = 0; k < 7; k++) wheatLeaf(b, origin.clone().add(new V3(0, 0.005 * k, 0)), az0 + k * 2.4 + r() * 0.5, (0.14 + r() * 0.1) * lowN, 0.38, droopBase + 0.05, 1, 1 - k / 7, cond); return; }
    const H = st.height * (0.92 + r() * 0.12) * (cond === 'lown' ? 0.88 : 1);
    const lean = new V3((r() - 0.5) * 0.16, 0, (r() - 0.5) * 0.16), pts = [];
    for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push(origin.clone().add(new V3(lean.x * t * t * H, t * H, lean.z * t * t * H))); }
    if (stageIdx === 4 && lean.lengthSq() > 1e-6) pts[5].addScaledVector(lean.clone().normalize(), 0.03);
    const curve = Curve(pts);
    tube(b, curve, 8, 4, (t) => 0.0034 - 0.0013 * t, (t) => shade(b, WP.stalk[stageIdx], WP.stalk[stageIdx], t, stageIdx === 4 ? 0.6 : 0.1, cond));
    const nodes = stageIdx === 2 ? [0.04, 0.2, 0.42, 0.64] : [0.05, 0.25, 0.48, 0.7, 0.84];
    nodes.forEach((t, k) => {
      const last = k === nodes.length - 1 && stageIdx >= 3, age = 1 - k / nodes.length;
      const L = (last ? 0.15 : 0.2 + r() * 0.05) * lowN;
      const droop = stageIdx === 4 ? 0.35 + age * 0.4 + (dry ? 0.2 : 0) : droopBase + age * 0.1;
      wheatLeaf(b, curve.getPoint(t), az0 + k * Math.PI + (r() - 0.5) * 0.6, L, last ? 0.6 : 0.3, droop, stageIdx, stageIdx === 4 ? 1 : age * 0.7, cond);
    });
    if (stageIdx >= 3) wheatEar(b, curve.getPoint(1), curve.getTangent(1), lean, stageIdx, cond);
  }

  function wheatClump(o) {
    const stage = o.stage | 0, cond = o.condition || 'healthy', seed = o.seed || 1;
    const stems = o.stems || (stage === 0 ? 1 : stage === 1 ? 2 : 3);
    const b = new Builder(seed * 7919 + stage * 131 + cond.length, { rate: 0.3, a: '#c47a2a', b: '#8d4f1c' });
    for (let s = 0; s < stems; s++) {
      const a = (s / stems) * Math.PI * 2 + b.r(), d = stems > 1 ? 0.012 + b.r() * 0.014 : 0;
      wheatStem(b, new V3(Math.cos(a) * d, 0, Math.sin(a) * d), stage, cond);
    }
    return finish(b, stems, Math.max(0.05, WHEAT_STAGES[stage].height * 0.3));
  }

  function wheatSheaf(b) {
    const n = 9;
    for (let s = 0; s < n; s++) {
      const a = (s / n) * Math.PI * 2, rr = 0.012 + b.r() * 0.012;
      const o = new V3(0, 0.04 + Math.sin(a) * rr, Math.cos(a) * rr);
      const fan = new V3(0, Math.sin(a), Math.cos(a)).multiplyScalar(0.03);
      const c = Curve([o.clone().add(new V3(-0.34, 0, 0)).add(fan), o.clone().add(new V3(-0.05, 0, 0)), o.clone().add(new V3(0.2, 0, 0)).add(fan)]);
      tube(b, c, 4, 3, () => 0.0028, (t) => plain(b, '#d6b866', '#e0c57a', t));
      wheatEar(b, c.getPoint(1), c.getTangent(1), new V3(1, 0, 0), 4, 'healthy');
    }
    const band = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; band.push(new V3(-0.06, 0.04 + Math.sin(a) * 0.031, Math.cos(a) * 0.031)); }
    tube(b, Curve(band, true), 8, 3, () => 0.004, () => plain(b, '#b88f52'));
  }

  // =====================================================================
  // CORN
  // =====================================================================
  const CP = {
    leaf: ['#5aa83c', '#4f9a37', '#47913a', '#47913a', '#b39a5f'], tip: ['#7cc04e', '#6db146', '#64a843', '#6aa545', '#8c7347'],
    rib: ['#b9dc8a', '#acd27f', '#a5cc7e', '#a5cc7e', '#d8c58f'], stalk: ['#86b850', '#7cab47', '#78a646', '#7aa546', '#c4a96e']
  };
  const CORN_STAGES = [
    { name: 'Seedling', day: 10, height: 0.16 }, { name: 'Knee high', day: 35, height: 0.6 }, { name: 'Tasseling', day: 65, height: 2.0 },
    { name: 'Silking', day: 75, height: 2.1 }, { name: 'Mature', day: 120, height: 2.05 }
  ];

  function cornLeaf(b, node, az, L, maxW, erect, droop, stage, age, cond) {
    const D = dirOf(az);
    ribbon(b, leafCurve(node, D, L, erect, droop), 9, (t) => maxW * Math.min(1, 0.22 + t * 3.2) * Math.pow(1 - t, 0.6), flatSide(D), {
      uv: 'grass', twist: (b.r() - 0.5) * 0.6, fold: 0.16 + (cond === 'dry' ? 0.45 : 0), wave: [26, maxW * 0.06],
      colAt: (t, part) => (part === 1 ? shade(b, CP.rib[stage], CP.rib[stage], t, age * 0.5, cond === 'rust' ? 'healthy' : cond) : shade(b, CP.leaf[stage], CP.tip[stage], t, age, cond))
    });
  }

  function cornTassel(b, top, T, stage) {
    const col = stage === 4 ? ['#a88d5c', '#8a6f45'] : ['#b9c46a', '#ddd28a'];
    tube(b, Curve([top.clone(), top.clone().addScaledVector(T, 0.12), top.clone().addScaledVector(T, 0.24).add(new V3(0.012, -0.01, 0))]), 3, 3, (t) => 0.004 * (1 - t * 0.7), (t) => plain(b, col[0], col[1], t));
    const a0 = b.r() * Math.PI * 2;
    for (let k = 0; k < 7; k++) {
      const D = dirOf(a0 + k * 2.4), s = top.clone().addScaledVector(T, 0.02 + 0.015 * k), L = 0.13 + b.r() * 0.06;
      const c = Curve([s, s.clone().addScaledVector(D, L * 0.4).addScaledVector(Y, L * 0.12), s.clone().addScaledVector(D, L * 0.8), s.clone().addScaledVector(D, L).addScaledVector(Y, -L * 0.35)]);
      card(b, c, 3, (t) => 0.0034 * (1 - t * 0.5), (t) => plain(b, col[0], col[1], t));
    }
  }

  // A bare cob: kernel rows in a checker of two yellows.
  function cornCob(b, base, axis, len, R) {
    const prof = [[0, R * 0.55], [len * 0.04, R * 0.92], [len * 0.15, R], [len * 0.5, R * 0.97], [len * 0.8, R * 0.85], [len * 0.94, R * 0.55], [len, R * 0.15]];
    const fine = [];
    for (let i = 0; i < prof.length - 1; i++) { fine.push(prof[i]); fine.push([(prof[i][0] + prof[i + 1][0]) / 2, (prof[i][1] + prof[i + 1][1]) / 2]); }
    fine.push(prof[prof.length - 1]);
    lathe(b, base, axis, fine, 14, (t, i, k) => hex((i + k) % 2 ? '#e9b93a' : '#d99f22').multiplyScalar(0.92 + b.r() * 0.14), 0.07);
  }
  function huskLeaves(b, base, axis, len, n, col, back) {
    const f = frame(axis);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3, out = f.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.B, Math.sin(a));
      const s = base.clone().addScaledVector(axis, len * 0.04).addScaledVector(out, 0.02);
      const pts = back
        ? [s, s.clone().addScaledVector(out, 0.03).addScaledVector(axis, -0.02), s.clone().addScaledVector(out, 0.05).addScaledVector(axis, -len * 0.4), s.clone().addScaledVector(out, 0.045).addScaledVector(axis, -len * 0.7).addScaledVector(Y, -0.03)]
        : [s, s.clone().addScaledVector(axis, len * 0.5).addScaledVector(out, 0.012), s.clone().addScaledVector(axis, len * 0.95)];
      ribbon(b, Curve(pts), 4, (t) => 0.022 * Math.pow(1 - t, 0.5) + 0.002, f.B.clone().multiplyScalar(-Math.sin(a)).addScaledVector(f.N, Math.cos(a)).cross(axis).normalize(), {
        uv: 'grass', fold: -0.25, colAt: (t) => plain(b, col[0], col[1], t)
      });
    }
  }

  function cornEar(b, node, az, stage, cond, scale) {
    const D = dirOf(az), ripe = stage === 4, small = (cond === 'lown' ? 0.82 : cond === 'dry' ? 0.9 : 1) * scale;
    const axis = (ripe ? D.clone().multiplyScalar(0.95).addScaledVector(Y, 0.05) : D.clone().multiplyScalar(0.7).addScaledVector(Y, 0.72)).normalize();
    const base = node.clone().addScaledVector(D, 0.025), len = 0.26 * small, R = 0.034 * small;
    tube(b, Curve([node.clone(), node.clone().addScaledVector(D, 0.014).addScaledVector(axis, 0.006), base.clone()]), 2, 5, () => 0.008, () => plain(b, ripe ? '#c4a96e' : '#7aa546'));
    if (ripe) {
      cornCob(b, base, axis, len * 0.9, R);
      huskLeaves(b, base, axis, len, 4, ['#d8c08a', '#b89a62'], true);
      const tip = base.clone().addScaledVector(axis, len * 0.9);
      for (let k = 0; k < 5; k++) {
        const c = Curve([tip.clone(), tip.clone().addScaledVector(axis, 0.02).add(new V3(0, -0.01, (k - 2) * 0.006)), tip.clone().addScaledVector(axis, 0.035).add(new V3(0, -0.035, (k - 2) * 0.01))]);
        card(b, c, 2, () => 0.0015, (t) => plain(b, '#6a4626', '#3e2814', t));
      }
      return;
    }
    const prof = [[0, R * 0.3], [len * 0.08, R * 0.75], [len * 0.25, R], [len * 0.55, R * 0.95], [len * 0.8, R * 0.7], [len * 0.95, R * 0.3], [len, R * 0.1]];
    lathe(b, base, axis, prof, 8, (t, i, k) => plain(b, k % 2 ? '#6aa03f' : '#7cb24c', '#a6c96c', t), 0.06);
    const tip = base.clone().addScaledVector(axis, len);
    for (let k = 0; k < 2; k++) {
      const s = base.clone().addScaledVector(axis, len * 0.8), dir = axis.clone().applyAxisAngle(Y, (k ? 1 : -1) * 0.5);
      ribbon(b, Curve([s, s.clone().addScaledVector(dir, len * 0.25), s.clone().addScaledVector(dir, len * 0.42).addScaledVector(Y, -0.02)]), 3, (t) => 0.014 * (1 - t), frame(dir).B, { uv: 'grass', fold: 0.2, colAt: (t) => plain(b, '#6fa844', '#a6c96c', t) });
    }
    const sc = stage === 3 ? ['#efdf96', '#c9906b'] : ['#e6d48c', '#e6d48c'], f = frame(axis);
    for (let k = 0; k < 10; k++) {
      const a = k * 0.63, out = f.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.B, Math.sin(a)), L = 0.14 + b.r() * 0.04;
      const c = Curve([tip.clone(), tip.clone().addScaledVector(axis, L * 0.35).addScaledVector(out, L * 0.2), tip.clone().addScaledVector(axis, L * 0.45).addScaledVector(out, L * 0.5).addScaledVector(Y, -L * 0.6)]);
      card(b, c, 3, () => 0.0017, (t) => plain(b, sc[0], sc[1], t));
    }
  }

  function cornPlant(b, stage, cond) {
    const r = b.r, dry = cond === 'dry', sc = cond === 'lown' ? 0.85 : 1, dAdd = dry ? 0.35 : 0, az0 = r() * Math.PI * 2;
    if (stage === 0) {
      tube(b, Curve([new V3(0, -0.005, 0), new V3(0, 0.012, 0), new V3(0, 0.028, 0)]), 2, 5, () => 0.0035, (t) => plain(b, CP.stalk[0], CP.stalk[0], t));
      for (let k = 0; k < 3; k++) cornLeaf(b, new V3(0, 0.006 + 0.009 * k, 0), az0 + k * Math.PI + (r() - 0.5) * 0.5, (0.08 + 0.035 * k) * sc, 0.012 + 0.004 * k, 0.62, 0.12 + dAdd, 0, 1 - k / 3, cond);
      return;
    }
    const H = (stage === 1 ? 0.24 : 1.62 * (0.95 + r() * 0.1)) * sc;
    const lean = new V3((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.05), pts = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new V3(lean.x * t * t * H, t * H, lean.z * t * t * H)); }
    const stalk = Curve(pts), R0 = stage === 1 ? 0.009 : 0.016;
    tube(b, stalk, 10, 7, (t) => R0 * (1 - 0.45 * t), (t) => shade(b, CP.stalk[stage], CP.stalk[stage], t, stage === 4 ? 0.7 : 0.1, cond === 'rust' ? 'healthy' : cond));
    const n = stage === 1 ? 7 : stage === 4 ? 11 : 12;
    for (let i = 0; i < n; i++) {
      const t = stage === 1 ? 0.05 + (i / n) * 0.9 : 0.05 + (i / n) * 0.84;
      const L = (stage === 1 ? 0.28 + 0.24 * Math.sin(Math.PI * (i + 1) / (n + 1)) : 0.5 + 0.42 * Math.sin(Math.PI * (i + 0.8) / (n + 0.6))) * sc;
      const W = (stage === 1 ? 0.045 : 0.075) * (0.9 + r() * 0.2) * sc;
      cornLeaf(b, stalk.getPoint(t), az0 + i * Math.PI + (r() - 0.5) * 0.45, L, W, 0.28 + 0.3 * (i / n), 0.42 + dAdd + (stage === 4 ? 0.3 : 0) + (1 - i / n) * 0.1, stage, 1 - i / n, cond);
    }
    if (stage >= 2) {
      cornTassel(b, stalk.getPoint(1), stalk.getTangent(1), stage);
      for (let k = 0; k < 6; k++) {
        const D = dirOf(az0 + k * 1.05);
        tube(b, Curve([new V3(0, 0.07 + 0.015 * (k % 2), 0).addScaledVector(D, 0.012), new V3(0, 0.035, 0).addScaledVector(D, 0.035), new V3(0, -0.01, 0).addScaledVector(D, 0.058)]), 3, 3, () => 0.003,
          () => plain(b, stage === 4 ? '#b39a64' : '#a9bf6a', stage === 4 ? '#8d744a' : '#c9b47a', 0.5));
      }
    }
    if (stage >= 3) {
      const earAz = az0 + Math.PI / 2 + (r() - 0.5) * 0.3;
      b.face = earAz;
      cornEar(b, stalk.getPoint(0.45), earAz, stage, cond, 1);
      cornEar(b, stalk.getPoint(0.36), earAz + 0.5, stage, cond, 0.72);
    }
  }

  function cornItem(b) {
    const base = new V3(-0.12, 0.034, 0), axis = new V3(1, 0, 0);
    cornCob(b, base, axis, 0.22, 0.032);
    huskLeaves(b, base, axis, 0.26, 4, ['#d8c890', '#b8a070'], true);
  }

  // =====================================================================
  // CARROT
  // =====================================================================
  const KP = { frond: '#4a9733', frondTip: '#6db84a', pet: '#6ea84a', petTip: '#5c9a3c', root: '#e8761f', rootTip: '#cf5f18', shoulder: '#8f8a2c' };
  const CARROT_STAGES = [
    { name: 'Seedling', day: 8, height: 0.05 }, { name: 'Leafing', day: 25, height: 0.12 }, { name: 'Root forming', day: 45, height: 0.2 },
    { name: 'Bulking', day: 60, height: 0.28 }, { name: 'Ready', day: 75, height: 0.32 }
  ];
  const K_DEPTH = [0.012, 0.045, 0.095, 0.15, 0.18], K_R = [0.0016, 0.004, 0.009, 0.015, 0.019];
  const K_L = [0.03, 0.09, 0.17, 0.24, 0.28], K_N = [1, 4, 7, 9, 10];

  function carrotRoot(b, top, axis, depth, R, cond) {
    const prof = [[0, R * 0.5], [depth * 0.04, R * 0.9], [depth * 0.12, R], [depth * 0.25, R * 0.92], [depth * 0.4, R * 0.76], [depth * 0.6, R * 0.52], [depth * 0.82, R * 0.25], [depth * 0.95, R * 0.07], [depth, 0.0004]];
    lathe(b, top, axis, prof, 10, (t, i) => {
      const c = t < 0.08 ? hex(KP.shoulder).lerp(hex(KP.root), t / 0.08) : hex(KP.root).lerp(hex(KP.rootTip), t);
      if (cond === 'lown') c.lerp(hex('#e9a46a'), 0.35);
      if (cond === 'dry') c.lerp(hex('#b3703a'), 0.25);
      return c.multiplyScalar((i % 2 ? 0.93 : 1) * (0.95 + b.r() * 0.08));
    }, 0, 0.06);
  }

  function carrotFrond(b, crown, D, L, erect, droop, age, cond, pairs) {
    const curve = leafCurve(crown, D, L, erect, droop);
    tube(b, curve, 3, 3, (t) => (0.0011 + 0.0005 * L / 0.28) * (1 - 0.6 * t), (t) => shade(b, KP.pet, KP.petTip, t, age * 0.5, cond === 'rust' ? 'healthy' : cond));
    const leaflet = (P, dir, len, wid, t) => diamond(b, P, dir, flatSide(dir), len, wid, shade(b, KP.frond, KP.frond, t, age, cond), shade(b, KP.frondTip, KP.frondTip, t, age, cond));
    for (let j = 0; j < pairs; j++) {
      const t = 0.34 + (j / pairs) * 0.6, P = curve.getPoint(t), T = curve.getTangent(t), lat = flatSide(T).negate();
      const s = 0.05 * (L / 0.28) * (1.15 - t * 0.6);
      for (const sd of [-1, 1]) {
        leaflet(P, T.clone().multiplyScalar(0.5).addScaledVector(lat, sd * 0.85).addScaledVector(Y, 0.12).normalize(), s, s * 0.34, t);
        leaflet(P.clone().addScaledVector(lat, sd * s * 0.3), T.clone().multiplyScalar(0.2).addScaledVector(lat, sd * 0.95).addScaledVector(Y, 0.3).normalize(), s * 0.55, s * 0.2, t);
        if (j < pairs - 1) leaflet(P.clone().addScaledVector(lat, sd * s * 0.45), T.clone().multiplyScalar(0.9).addScaledVector(lat, sd * 0.35).normalize(), s * 0.6, s * 0.2, t);
      }
    }
    leaflet(curve.getPoint(1), curve.getTangent(1), 0.03 * L / 0.28, 0.009 * L / 0.28, 1);
  }

  function carrotPlant(b, stage, cond) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry';
    const y0 = stage >= 2 ? 0.012 : 0.003;
    carrotRoot(b, new V3(0, y0, 0), new V3(0, -1, 0), K_DEPTH[stage] * sc, K_R[stage] * sc, cond);
    const crown = new V3(0, y0 + 0.002, 0), az0 = r() * Math.PI * 2;
    if (stage === 0) {
      for (let k = 0; k < 2; k++) {
        const D = dirOf(az0 + k * Math.PI);
        ribbon(b, leafCurve(crown, D, 0.028 * sc, 0.55, 0.1 + (dry ? 0.3 : 0)), 4, (t) => 0.0022 * Math.pow(1 - t, 0.5) * Math.min(1, 0.4 + t * 4), flatSide(D), {
          uv: 'grass', fold: 0.2, colAt: (t) => shade(b, '#6fb04a', '#8cc45e', t, 0.3, cond)
        });
      }
    }
    for (let i = 0; i < K_N[stage]; i++) {
      const n = K_N[stage], D = dirOf(az0 + 0.6 + i * 2.39996), L = K_L[stage] * (0.72 + 0.38 * r()) * sc;
      carrotFrond(b, crown, D, L, 0.8 - 0.18 * (1 - i / n) - 0.08 * r(), 0.1 + (dry ? 0.55 : 0) + (stage === 4 ? 0.05 : 0), i / n < 0.4 ? 0.8 : 0.3, cond, stage === 0 ? 2 : 4);
    }
  }

  function carrotItem(b) {
    carrotRoot(b, new V3(0.08, 0.02, 0), new V3(-1, 0, 0.02).normalize(), 0.18, 0.02, 'healthy');
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05, s = new V3(0.085, 0.02 + Math.sin(a) * 0.006, Math.cos(a) * 0.006);
      const e = s.clone().add(new V3(0.05 + b.r() * 0.02, Math.sin(a) * 0.015, Math.cos(a) * 0.015));
      tube(b, Curve([s, s.clone().lerp(e, 0.5), e]), 2, 3, () => 0.0018, (t) => plain(b, KP.pet, KP.frond, t));
    }
  }

  // =====================================================================
  // TOMATO
  // =====================================================================
  const TP = {
    leaf: '#3f832f', tip: '#58a03d', stem: '#5c8a39', stemTip: '#79a64b', wood: '#8a6a45', woodDark: '#6e5236',
    flower: '#f2cf31', anther: '#dba51f', calyx: '#4e8a33', green: '#86b545', greenTop: '#5f9634', red: '#d0331f', redTop: '#da5632', orange: '#e2742a'
  };
  const TOMATO_STAGES = [
    { name: 'Seedling', day: 10, height: 0.08 }, { name: 'Young plant', day: 30, height: 0.45 }, { name: 'Flowering', day: 50, height: 1.1 },
    { name: 'Green fruit', day: 70, height: 1.5 }, { name: 'Ripe', day: 90, height: 1.6 }
  ];

  function tomatoFruit(b, c, R, cA, cTop) {
    const prof = [[-0.95, 0], [-0.75, 0.6], [-0.4, 0.92], [0.05, 1], [0.45, 0.93], [0.72, 0.7], [0.88, 0]].map((p) => [p[0] * R * 0.85, p[1] * R]);
    lathe(b, c, Y, prof, 9, (t) => hex(cA).lerp(hex(cTop), Math.pow(t, 2)).multiplyScalar(0.95 + b.r() * 0.08), 0.045);
    const top = c.clone().addScaledVector(Y, R * 0.74), ctr = b.v(top.clone().addScaledVector(Y, 0.004), hex(TP.calyx));
    for (let k = 0; k < 5; k++) {
      const a = k * 1.2566 + b.r() * 0.3;
      const p1 = b.v(top.clone().add(new V3(Math.cos(a) * R * 0.75, -R * 0.12, Math.sin(a) * R * 0.75)), hex(TP.calyx));
      const p2 = b.v(top.clone().add(new V3(Math.cos(a + 0.35) * R * 0.2, 0, Math.sin(a + 0.35) * R * 0.2)), hex(TP.calyx));
      b.tri(ctr, p1, p2);
    }
  }

  function tomatoFlower(b, c) {
    const tip = b.v(c.clone().addScaledVector(Y, -0.009), hex(TP.anther)), ring = [];
    const at = (ang, d, h) => c.clone().add(new V3(Math.cos(ang) * d, h, Math.sin(ang) * d));
    for (let k = 0; k < 5; k++) {
      const a = k * 1.2566;
      ring.push(at(a, 0.0025, 0));
      b.tri(b.v(at(a - 0.5, 0.003, 0), hex(TP.flower)), b.v(at(a, 0.013, 0.006), hex(TP.flower)), b.v(at(a + 0.5, 0.003, 0), hex(TP.flower)));
    }
    for (let k = 0; k < 5; k++) b.tri(b.v(ring[k], hex(TP.anther)), b.v(ring[(k + 1) % 5], hex(TP.anther)), tip);
  }

  function tomatoTruss(b, node, D, stage, ripeness, cond) {
    const c = Curve([node.clone(), node.clone().addScaledVector(D, 0.05).addScaledVector(Y, 0.015), node.clone().addScaledVector(D, 0.1).addScaledVector(Y, -0.025), node.clone().addScaledVector(D, 0.13).addScaledVector(Y, -0.07)]);
    card(b, c, 3, () => 0.0019, (t) => plain(b, TP.stem, TP.stemTip, t));
    [0.35, 0.55, 0.75, 0.95].forEach((t, k) => {
      const P = c.getPoint(t), lat = flatSide(c.getTangent(t)), sd = k % 2 ? 1 : -1;
      if (stage === 2 || (stage === 3 && k === 3)) { tomatoFlower(b, P.clone().addScaledVector(lat, sd * 0.012).addScaledVector(Y, -0.008)); return; }
      if (stage < 3) return;
      const R = (stage === 3 ? 0.024 : 0.033) * (0.85 + b.r() * 0.3) * (cond === 'lown' ? 0.85 : 1) * (cond === 'dry' ? 0.85 : 1);
      const ctr = P.clone().addScaledVector(lat, sd * 0.018).addScaledVector(Y, -R * 0.95 - 0.008);
      let col = [TP.green, TP.greenTop];
      if (stage === 4) {
        const ripe = ripeness - k * 0.12 + b.r() * 0.15;
        col = ripe > 0.62 ? [TP.red, TP.redTop] : ripe > 0.38 ? [TP.orange, TP.redTop] : [TP.green, TP.greenTop];
      }
      card(b, Curve([P.clone(), P.clone().lerp(ctr, 0.5).addScaledVector(Y, 0.005), ctr.clone().addScaledVector(Y, R * 0.75)]), 2, () => 0.0012, () => hex(TP.stem));
      tomatoFruit(b, ctr, R, col[0], col[1]);
    });
  }

  const TPAL = { leaf: TP.leaf, tip: TP.tip, stem: TP.stem, stemTip: TP.stemTip };
  function tomatoPlant(b, stage, cond) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    if (stage === 0) {
      seedling(b, az0, 0.05, [TP.leaf, TP.tip], cond, { cot: [0.032, 0.009], stemCol: TP.stem });
      compoundLeaf(b, new V3(0, 0.054, 0), dirOf(az0 + 1.57), 0.05, 0.1, 0, cond, TPAL, 1);
      return;
    }
    const H = TOMATO_STAGES[stage].height * (0.94 + r() * 0.1) * sc * (dry ? 0.92 : 1), sx = 0.085, pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new V3(Math.sin(k * 1.9) * 0.014 * t + (stage >= 2 ? sx * 0.6 * t : 0), t * H, Math.cos(k * 2.3) * 0.012 * t)); }
    pts[0].y = -0.005;
    const stem = Curve(pts), R0 = stage === 1 ? 0.006 : 0.01;
    tube(b, stem, 12, 6, (t) => R0 * (1 - 0.5 * t), (t) => plain(b, TP.stem, TP.stemTip, t));
    if (stage >= 2) {
      lathe(b, new V3(sx, -0.05, 0), Y, [[0, 0.013], [H + 0.2, 0.013], [H + 0.24, 0.002]], 4, (t, i, k) => hex(k % 2 ? TP.wood : TP.woodDark).lerp(hex(TP.wood), 0.5).multiplyScalar(0.92 + b.r() * 0.12));
      [0.3, 0.55, 0.8].forEach((t) => {
        const p = stem.getPoint(t), ring = [];
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ring.push(new V3((p.x + sx) / 2 + Math.cos(a) * (Math.abs(sx - p.x) / 2 + 0.016), p.y, p.z / 2 + Math.sin(a) * 0.018)); }
        tube(b, Curve(ring, true), 6, 3, () => 0.002, () => plain(b, '#d9c79a'));
      });
    }
    const nl = stage === 1 ? 6 : 12, trusses = stage >= 2 ? { 2: 1.0, 4: 0.9, 6: 0.75, 8: 0.6, 10: 0.45 } : {};
    let first = true;
    for (let i = 0; i < nl; i++) {
      const t = 0.08 + (i / nl) * 0.86, node = stem.getPoint(t), az = az0 + i * 2.4, D = dirOf(az), age = 1 - i / nl;
      const L = (0.24 + 0.12 * Math.sin(Math.PI * (0.25 + 0.75 * (i / nl)))) * sc * (stage === 1 ? 0.7 : 1);
      const droop = 0.3 + (dry ? 0.5 : 0) + age * 0.1;
      if (stage >= 2 && i % 3 === 1 && t < 0.8) {
        const end = node.clone().addScaledVector(D, 0.13).addScaledVector(Y, 0.12);
        tube(b, Curve([node.clone(), node.clone().addScaledVector(D, 0.06).addScaledVector(Y, 0.035), end]), 3, 4, (tt) => 0.005 * (1 - 0.4 * tt), (tt) => plain(b, TP.stem, TP.stemTip, tt));
        compoundLeaf(b, end, D.clone().applyAxisAngle(Y, 0.6), L * 0.9, droop, age, cond, TPAL, 2);
      }
      compoundLeaf(b, node, D, L, droop, age, cond, TPAL, 2);
      if (trusses[i] !== undefined) {
        const tAz = az + Math.PI;
        if (first) { b.face = tAz; first = false; }
        tomatoTruss(b, node.clone().addScaledVector(Y, 0.02), dirOf(tAz), stage, trusses[i], cond);
      }
    }
    compoundLeaf(b, stem.getPoint(1), dirOf(az0 + 1), 0.1 * sc, 0.1, 0, cond, TPAL, 1);
  }

  // =====================================================================
  // WATERMELON
  // =====================================================================
  const MP = { leaf: '#4f8a3c', tip: '#6c9f50', vine: '#6c9a48', dark: '#2d5a23', light: '#86b35b', spot: '#d8c46c' };
  const MELON_STAGES = [
    { name: 'Seedling', day: 10, height: 0.05 }, { name: 'Vining', day: 30, height: 0.18 }, { name: 'Flowering', day: 50, height: 0.25 },
    { name: 'Fruit set', day: 65, height: 0.28 }, { name: 'Ripe', day: 90, height: 0.3 }
  ];
  function runner(b, origin, az, len, wob, col, cond) {
    const D = dirOf(az), P = flatSide(D), pts = [];
    for (let k = 0; k <= 7; k++) {
      const d = len * k / 7;
      pts.push(origin.clone().addScaledVector(D, d).addScaledVector(P, Math.sin(k * 1.4 + az * 3) * wob * Math.min(1, k / 2)).add(new V3(0, 0.012 + 0.006 * Math.sin(k * 2.1), 0)));
    }
    const c = Curve(pts);
    tube(b, c, 12, 4, (t) => 0.0055 * (1 - 0.45 * t), (t) => shade(b, col, col, t, 0.2, cond === 'rust' ? 'healthy' : cond));
    return c;
  }
  function melonFruit(b, c, axis, R, len, ripe) {
    const start = b.count(), hs = [-1, -0.9, -0.68, -0.36, 0, 0.36, 0.68, 0.9, 1];
    lathe(b, c, axis, hs.map((h) => [h * len / 2, R * Math.pow(Math.max(0, 1 - h * h), 0.5)]), 16, (t, i, k) => {
      const dark = ((k + (i % 3 === 1 ? 1 : 0)) % 2) === 0;
      return hex(dark ? MP.dark : MP.light).multiplyScalar(0.92 + b.r() * 0.12);
    });
    if (ripe) tint(b, start, (x, y) => (y < c.y - R * 0.5 ? [MP.spot, Math.min(1, (c.y - R * 0.5 - y) / (R * 0.3)) * 0.8] : null));
    const tip = c.clone().addScaledVector(axis, len / 2);
    tube(b, Curve([tip, tip.clone().addScaledVector(axis, 0.015).addScaledVector(Y, 0.006), tip.clone().addScaledVector(axis, 0.03).addScaledVector(Y, 0.004)]), 2, 3, () => 0.003, () => plain(b, MP.vine));
  }
  function vinePlant(b, stage, cond, o) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    if (stage === 0) { seedling(b, az0, 0.04, o.pal, cond, { cot: [0.026, 0.013], trueL: 0.035, trueW: 0.8, lobes: o.lobes, stemCol: o.vine }); return null; }
    const nR = [0, 2, 3, 4, 4][stage], lenR = o.lens[stage] * sc, runners = [];
    tube(b, Curve([new V3(0, -0.01, 0), new V3(0, 0.02, 0), new V3(0, 0.03, 0.005)]), 2, 5, () => 0.008, () => plain(b, o.vine));
    for (let j = 0; j < nR; j++) {
      const az = az0 + (j * Math.PI * 2) / nR + (r() - 0.5) * 0.5, len = lenR * (0.8 + 0.3 * r());
      const curve = runner(b, new V3(0, 0.02, 0), az, len, 0.09, o.vine, cond);
      runners.push({ curve, az });
      const count = Math.max(2, Math.floor(len / o.spacing));
      for (let q = 0; q < count; q++) {
        const t = (q + 0.6) / (count + 0.3), P = curve.getPoint(t), side = q % 2 ? 1 : -1;
        const ld = dirOf(az + side * (0.9 + r() * 0.5)), ph = o.petH * (0.75 + 0.5 * r());
        const top = P.clone().addScaledVector(Y, ph).addScaledVector(ld, 0.02);
        tube(b, Curve([P.clone(), P.clone().addScaledVector(Y, ph * 0.6).addScaledVector(ld, 0.005), top]), 2, 3, () => 0.0028, () => plain(b, o.vine));
        const age = stage === 4 && o.dieBack ? 1 - t * 0.5 : 1 - t;
        const pal = stage === 4 && o.dieBack && r() < 0.4 ? ['#8d8a3c', '#a49650'] : o.pal;
        blade(b, top, ld, o.leafL * sc * (t < 0.2 ? 0.8 : 1) * (0.85 + 0.3 * r()), o.leafW * sc, {
          tilt: 0.35, droop: 0.3 + (dry ? 0.5 : 0), cup: o.cup || 0.2, lobes: o.lobes, wave: [20, 0.004], pal, age, cond, segs: 7
        });
        if (stage >= 2 && q === 1 && j < 3) flower(b, P.clone().addScaledVector(Y, 0.03).addScaledVector(ld, -0.03), o.flowerSize, o.flower[0], o.flower[1], 0.45);
      }
    }
    return runners;
  }
  function melonPlant(b, stage, cond) {
    const runners = vinePlant(b, stage, cond, { pal: [MP.leaf, MP.tip], vine: MP.vine, lens: [0, 0.5, 1.1, 1.5, 1.7], spacing: 0.2, petH: 0.08, leafL: 0.13, leafW: 0.07, lobes: [7, 0.38], flower: ['#f0d33a', '#d9a520'], flowerSize: 0.022 });
    if (!runners || stage < 3) return;
    const sc = cond === 'lown' ? 0.85 : 1;
    const fruits = stage === 3 ? [[0, 0.45, 0.05, 0.13], [1, 0.6, 0.045, 0.12]] : [[0, 0.5, 0.115, 0.32], [2, 0.55, 0.08, 0.22]];
    fruits.forEach(([j, t, R, len], n) => {
      const rn = runners[j % runners.length], P = rn.curve.getPoint(t), T = rn.curve.getTangent(t).setY(0).normalize();
      const side = flatSide(T), c = P.clone().addScaledVector(side, (R + 0.03) * sc).setY(R * sc * 0.9);
      if (n === 0) b.face = Math.atan2(c.z, c.x);
      melonFruit(b, c, T.applyAxisAngle(Y, 0.3), R * sc, len * sc, stage === 4);
    });
  }

  // =====================================================================
  // PUMPKIN
  // =====================================================================
  const PP = { leaf: '#3f7a2f', tip: '#5d9440', vine: '#6a8f42' };
  const PUMPKIN_STAGES = [
    { name: 'Seedling', day: 10, height: 0.06 }, { name: 'Vining', day: 30, height: 0.3 }, { name: 'Flowering', day: 55, height: 0.45 },
    { name: 'Green fruit', day: 75, height: 0.5 }, { name: 'Ripe', day: 110, height: 0.5 }
  ];
  function pumpkinFruit(b, c, R, Hf, ripe) {
    const prof = [[0, R * 0.2], [Hf * 0.06, R * 0.66], [Hf * 0.22, R * 0.93], [Hf * 0.48, R], [Hf * 0.74, R * 0.9], [Hf * 0.9, R * 0.62], [Hf * 0.97, R * 0.25], [Hf * 0.9, R * 0.06]];
    lathe(b, c, Y, prof, 20, (t, i, k) => {
      const groove = k % 2 === 1;
      const base = ripe ? (groove ? '#c05c10' : '#ea8420') : (groove ? '#56722a' : '#7a983c');
      return hex(base).lerp(hex(ripe ? '#f3a54a' : '#a6bd62'), 0.25 * Math.sin(t * Math.PI)).multiplyScalar(0.94 + b.r() * 0.1);
    }, 0.09);
    const top = c.clone().addScaledVector(Y, Hf * 0.9), side = dirOf(b.r() * 6.28);
    tube(b, Curve([top, top.clone().addScaledVector(Y, 0.05).addScaledVector(side, 0.01), top.clone().addScaledVector(Y, 0.085).addScaledVector(side, 0.04)]), 4, 6, (t) => 0.016 - 0.005 * t, (t) => plain(b, '#7b7442', '#5a5230', t));
  }
  function pumpkinPlant(b, stage, cond) {
    const runners = vinePlant(b, stage, cond, { pal: [PP.leaf, PP.tip], vine: PP.vine, lens: [0, 0.6, 1.3, 1.6, 1.7], spacing: 0.26, petH: 0.26, leafL: 0.26, leafW: 0.15, lobes: [5, 0.2], cup: 0.4, flower: ['#f2a62a', '#e07d17'], flowerSize: 0.045, dieBack: true });
    if (!runners || stage < 3) return;
    const sc = cond === 'lown' ? 0.85 : 1, rn = runners[0], P = rn.curve.getPoint(0.55), side = flatSide(rn.curve.getTangent(0.55).setY(0).normalize());
    const R = (stage === 3 ? 0.1 : 0.18) * sc, c = P.clone().addScaledVector(side, R + 0.04).setY(0);
    b.face = Math.atan2(c.z, c.x);
    pumpkinFruit(b, c, R, R * 1.45, stage === 4);
  }

  // =====================================================================
  // LETTUCE
  // =====================================================================
  const LP = { outer: '#4f9a32', outerTip: '#72b444', inner: '#9fcd5e', innerTip: '#c2e07c' };
  const LETTUCE_STAGES = [
    { name: 'Seedling', day: 7, height: 0.03 }, { name: 'Young', day: 18, height: 0.07 }, { name: 'Rosette', day: 30, height: 0.12 },
    { name: 'Heading', day: 42, height: 0.16 }, { name: 'Ready', day: 55, height: 0.2 }
  ];
  function lettucePlant(b, stage, cond, head) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    const n = [4, 8, 14, 20, 26][stage], Lm = [0.03, 0.08, 0.13, 0.16, 0.18][stage] * sc * (head ? 0.85 : 1);
    tube(b, Curve([new V3(0, -0.01, 0), new V3(0, 0.005, 0), new V3(0, 0.012, 0)]), 2, 5, () => 0.007, () => plain(b, '#d8e6b0'));
    for (let i = 0; i < n; i++) {
      const q = i / Math.max(1, n - 1), D = dirOf(az0 + i * 2.39996);
      const L = Lm * (1 - 0.55 * q) * (0.9 + 0.2 * r()), W = L * (stage < 1 ? 0.55 : 0.82);
      const start = new V3(D.x * 0.006 * (1 - q), 0.006 + 0.025 * q * (stage / 4), D.z * 0.006 * (1 - q));
      blade(b, start, D, L, W, {
        tilt: head ? 0.75 + 0.4 * q : 0.22 + 0.7 * q, droop: (head ? 0.05 : 0.35 * (1 - q)) + (dry ? 0.4 : 0), cup: 0.5 + 0.4 * q,
        wave: [34, W * 0.13], pal: [mixHex(LP.outer, LP.inner, q), mixHex(LP.outerTip, LP.innerTip, q)], segs: 5, age: 1 - q, cond,
        width: (t) => Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * Math.pow(t, 0.75))), 0.6)
      });
    }
  }

  // =====================================================================
  // CABBAGE
  // =====================================================================
  const CB = { leaf: '#5e8f76', tip: '#8db497', head: '#c3d99c', headTop: '#dcebbd', wrap: '#a9c98a' };
  const CABBAGE_STAGES = [
    { name: 'Seedling', day: 10, height: 0.04 }, { name: 'Young', day: 25, height: 0.12 }, { name: 'Leafy', day: 45, height: 0.22 },
    { name: 'Heading', day: 65, height: 0.28 }, { name: 'Ready', day: 85, height: 0.3 }
  ];
  function cabbageHead(b, ctr, R) {
    const hs = [-1, -0.82, -0.5, -0.1, 0.35, 0.72, 0.93, 1];
    lathe(b, ctr, Y, hs.map((h) => [h * R * 0.92, R * Math.pow(Math.max(0, 1 - h * h), 0.5)]), 14, (t, i, k) =>
      hex(CB.head).lerp(hex(CB.headTop), t).multiplyScalar(((k + i * 2) % 5 === 0 ? 0.9 : 1) * (0.96 + b.r() * 0.06)));
    for (let j = 0; j < 5; j++) {
      const az = j * 1.2566 + 0.4, pts = [];
      [0.35, 0.85, 1.35, 1.85, 2.2].forEach((ph) => pts.push(ctr.clone().add(new V3(Math.cos(az) * Math.sin(ph) * R * 1.05, -Math.cos(ph) * R * 1.0, Math.sin(az) * Math.sin(ph) * R * 1.05))));
      ribbon(b, Curve(pts), 5, (t) => R * 0.8 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.6), new V3(-Math.sin(az), 0, Math.cos(az)), {
        uv: 'broad', fold: -0.12, colAt: (t, part) => { const c = plain(b, CB.wrap, CB.head, t); return part === 1 ? c.multiplyScalar(1.08) : c; }
      });
    }
  }
  function cabbagePlant(b, stage, cond, head) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    const hs = [0.02, 0.03, 0.04, 0.05, 0.05][stage];
    tube(b, Curve([new V3(0, -0.01, 0), new V3(0, hs * 0.5, 0), new V3(0, hs, 0)]), 2, 6, () => (head ? 0.016 : 0.006 + 0.002 * stage), () => plain(b, '#b8cf98', '#cfe0b0', 0.5));
    const n = head ? 3 : [3, 6, 9, 11, 12][stage], Lb = head ? 0.12 : [0.035, 0.12, 0.2, 0.24, 0.26][stage] * sc;
    for (let i = 0; i < n; i++) {
      const q = i / n, D = dirOf(az0 + i * 2.39996), L = Lb * (0.85 + 0.3 * r());
      blade(b, new V3(0, hs * (0.3 + 0.7 * q), 0).addScaledVector(D, 0.008), D, L, L * 0.85, {
        tilt: head ? 0.9 : 0.55 - 0.25 * (1 - q) * (stage / 4), droop: (head ? 0.1 : 0.3) + (dry ? 0.4 : 0), cup: 0.45, wave: [14, L * 0.04],
        pal: [CB.leaf, CB.tip], segs: 6, age: 1 - q, cond, width: (t) => Math.pow(Math.sin(Math.PI * (0.15 + 0.85 * t)), 0.5)
      });
    }
    const R = head ? 0.085 : [0, 0, 0, 0.055, 0.095][stage] * sc;
    if (R > 0) cabbageHead(b, new V3(0, hs + R * 0.85, 0), R);
  }

  // =====================================================================
  // POTATO
  // =====================================================================
  const PO = { leaf: '#3f7a33', tip: '#579445', stem: '#5d8a3c', stemTip: '#6f9a48', skin: '#c49a64', eye: '#8a6640', flower: '#ece6f4', fctr: '#e8c22a' };
  const POTATO_STAGES = [
    { name: 'Sprouting', day: 12, height: 0.06 }, { name: 'Vegetative', day: 30, height: 0.3 }, { name: 'Flowering', day: 50, height: 0.5 },
    { name: 'Tuber bulking', day: 70, height: 0.55 }, { name: 'Ready', day: 100, height: 0.45 }
  ];
  function tuber(b, c, axis, R, len) {
    const hs = [-1, -0.8, -0.45, 0, 0.45, 0.8, 1];
    lathe(b, c, axis, hs.map((h) => [h * len / 2, R * Math.pow(Math.max(0, 1 - h * h), 0.5) * (0.92 + 0.16 * b.r())]), 9, () => hex(b.r() < 0.07 ? PO.eye : PO.skin).multiplyScalar(0.92 + b.r() * 0.12), 0, 0.1);
  }
  function potatoPlant(b, stage, cond) {
    const r = b.r, sc = cond === 'lown' ? 0.85 : 1, dry = cond === 'dry', az0 = r() * Math.PI * 2;
    const dead = stage === 4, pal = dead ? { leaf: '#b0a24a', tip: '#8a7438', stem: '#9a8c4a', stemTip: '#857640' } : { leaf: PO.leaf, tip: PO.tip, stem: PO.stem, stemTip: PO.stemTip };
    if (stage === 0) {
      tuber(b, new V3(0, -0.07, 0), new V3(1, 0, 0), 0.026, 0.075);
      tube(b, Curve([new V3(0, -0.05, 0), new V3(0.004, 0, 0), new V3(0, 0.05, 0.003)]), 4, 4, () => 0.003, (t) => plain(b, '#c9b48a', PO.stem, t));
      compoundLeaf(b, new V3(0, 0.05, 0), dirOf(az0), 0.05, 0.05, 0, cond, pal, 1);
      compoundLeaf(b, new V3(0, 0.045, 0), dirOf(az0 + 2.6), 0.04, 0.05, 0, cond, pal, 1);
      return;
    }
    const H = POTATO_STAGES[stage].height * sc, ns = 4;
    for (let s = 0; s < ns; s++) {
      const a = az0 + s * 1.57 + r() * 0.4, D = dirOf(a), base = D.clone().multiplyScalar(0.015);
      const h = H * (0.8 + 0.3 * r()) * (dead ? 0.85 : 1);
      const stem = Curve([base.clone().setY(-0.01), base.clone().addScaledVector(D, 0.03).setY(h * 0.35), base.clone().addScaledVector(D, 0.07 + (dead ? 0.08 : 0)).setY(h * 0.7), base.clone().addScaledVector(D, 0.09 + (dead ? 0.15 : 0)).setY(h * (dead ? 0.75 : 1))]);
      tube(b, stem, 5, 4, (t) => 0.0055 * (1 - 0.4 * t), (t) => plain(b, pal.stem, pal.stemTip, t));
      const nl = stage === 1 ? 3 : 4;
      for (let i = 0; i < nl; i++) {
        const t = 0.3 + (i / nl) * 0.68;
        compoundLeaf(b, stem.getPoint(t), dirOf(a + (i % 2 ? 1.2 : -1.2) + r() * 0.3), (0.13 + 0.05 * r()) * sc, 0.25 + (dry || dead ? 0.45 : 0), 1 - t, cond, pal, 2);
      }
      if ((stage === 2 || stage === 3) && s < (stage === 2 ? 3 : 2)) {
        const top = stem.getPoint(1);
        for (let k = 0; k < (stage === 2 ? 4 : 2); k++) flower(b, top.clone().add(new V3((r() - 0.5) * 0.05, 0.02 + r() * 0.02, (r() - 0.5) * 0.05)), 0.014, PO.flower, PO.fctr, 0.25);
      }
    }
    const nt = [0, 2, 4, 6, 7][stage], Rt = [0, 0.012, 0.02, 0.03, 0.034][stage] * sc;
    for (let k = 0; k < nt; k++) {
      const a = k * 2.4 + r(), d = 0.05 + 0.07 * r(), c = new V3(Math.cos(a) * d, -0.035 - 0.07 * r(), Math.sin(a) * d);
      tube(b, Curve([new V3(0, -0.015, 0), new V3(c.x * 0.5, c.y * 0.7 - 0.01, c.z * 0.5), c.clone()]), 3, 3, () => 0.0018, () => plain(b, '#d8c8a0'));
      tuber(b, c, dirOf(r() * 6.28).add(new V3(0, (r() - 0.5) * 0.3, 0)).normalize(), Rt, Rt * 2.7);
    }
  }

  // =====================================================================
  function single(fn, spots, salt, aoK) {
    return function (o) {
      const stage = o.stage | 0, cond = o.condition || 'healthy', seed = o.seed || 1;
      const b = new Builder(seed * 7919 + stage * 131 + cond.length + salt, spots);
      fn(b, stage, cond);
      return finish(b, 1, aoK[stage]);
    };
  }
  function item(fn, salt, round) {
    return function (o) {
      const b = new Builder((o.seed || 1) * 104729 + salt, null);
      fn(b);
      if (o.dirty) dirtify(b, 0, o.amount === undefined ? 0.85 : o.amount);
      const g = finish(b, 1, 0);
      const bb = g.boundingBox;
      g.userData.length = bb.max.x - bb.min.x; g.userData.height = bb.max.y - bb.min.y; g.userData.round = round;
      return g;
    };
  }
  const ao = (stages, k) => stages.map((s) => Math.max(0.04, s.height * k));

  const CROPS = {
    wheat: {
      name: 'Winter wheat', short: 'Wheat', unit: 'stem', disease: 'Rust', spot: '#c47a2a', dot: '#d8b25b', item: 'Wheat sheaf',
      STAGES: WHEAT_STAGES, field: { row: 0.2, step: 0.13, size: 4.2, stems: (s) => (s < 2 ? 1 : 2) }, stiff: 1,
      note: 'Ears turn gold and nod as the grain fills. Drilled in rows 20 cm apart.',
      clump: wheatClump, produce: item(wheatSheaf, 1, false)
    },
    corn: {
      name: 'Corn', short: 'Corn', unit: 'plant', disease: 'Rust', spot: '#c47a2a', dot: '#e3c35a', item: 'Corn cob',
      STAGES: CORN_STAGES, field: { row: 0.75, step: 0.24, size: 6 }, stiff: 0.5,
      note: 'The tassel sheds pollen onto the silks. Each plant carries a main ear and a smaller second one; at maturity the husk dries and opens on the cob.',
      clump: single(cornPlant, { rate: 0.2, a: '#c47a2a', b: '#7d3f14' }, 17, ao(CORN_STAGES, 0.15)), produce: item(cornItem, 2, false)
    },
    carrot: {
      name: 'Carrot', short: 'Carrot', unit: 'plant', disease: 'Leaf blight', spot: '#6b4423', dot: '#e8761f', item: 'Carrot',
      STAGES: CARROT_STAGES, field: { row: 0.3, step: 0.07, size: 4.2 }, stiff: 0.8, rootDepth: K_DEPTH,
      note: 'Most of the crop is under the soil. Pull one up to check the root before harvest.',
      clump: single(carrotPlant, { rate: 0.2, a: '#6b4423', b: '#a08a3a' }, 29, ao(CARROT_STAGES, 0.35)), produce: item(carrotItem, 3, false)
    },
    tomato: {
      name: 'Tomato', short: 'Tomato', unit: 'plant', disease: 'Blight', spot: '#6b4423', dot: '#d0331f', item: 'Tomato',
      STAGES: TOMATO_STAGES, field: { row: 1.0, step: 0.6, size: 5 }, stiff: 0.35,
      note: 'Staked and tied from flowering, and grows to about 1.6 m. Fruit ripens from the lowest truss up, so a ripe plant carries red, orange and green tomatoes.',
      clump: single(tomatoPlant, { rate: 0.22, a: '#4a3220', b: '#b7a03a' }, 41, ao(TOMATO_STAGES, 0.15)),
      produce: item((b) => tomatoFruit(b, new V3(0, 0.035 * 0.81, 0), 0.035, TP.red, TP.redTop), 4, true)
    },
    watermelon: {
      name: 'Watermelon', short: 'Watermelon', unit: 'plant', disease: 'Powdery mildew', spot: '#d9d6c0', dot: '#3f7a2f', item: 'Watermelon',
      spread: 3.0, STAGES: MELON_STAGES, field: { row: 1.8, step: 1.0, size: 7 }, stiff: 0.6,
      note: 'Vines run along the ground with lobed leaves. A ripe melon has a creamy yellow patch where it rested on the soil.',
      clump: single(melonPlant, { rate: 0.3, a: '#d9d6c0', b: '#b8b49a' }, 53, ao(MELON_STAGES, 0.8)),
      produce: item((b) => melonFruit(b, new V3(0, 0.12 * 0.95, 0), new V3(1, 0, 0), 0.12, 0.34, true), 5, true)
    },
    pumpkin: {
      name: 'Pumpkin', short: 'Pumpkin', unit: 'plant', disease: 'Powdery mildew', spot: '#d9d6c0', dot: '#ea8420', item: 'Pumpkin',
      spread: 3.2, STAGES: PUMPKIN_STAGES, field: { row: 2.0, step: 1.2, size: 8 }, stiff: 0.5,
      note: 'Big leaves on tall stalks shade the fruit. The vines die back as the pumpkin turns orange.',
      clump: single(pumpkinPlant, { rate: 0.3, a: '#d9d6c0', b: '#b8b49a' }, 67, ao(PUMPKIN_STAGES, 0.6)),
      produce: item((b) => pumpkinFruit(b, new V3(0, 0, 0), 0.17, 0.25, true), 6, false)
    },
    lettuce: {
      name: 'Lettuce', short: 'Lettuce', unit: 'plant', disease: 'Downy mildew', spot: '#c9c25a', dot: '#9bcf5f', item: 'Lettuce head',
      STAGES: LETTUCE_STAGES, field: { row: 0.35, step: 0.3, size: 4.2 }, stiff: 0.4,
      note: 'Frilly leaves grow from the centre outward; the inner leaves stay pale and cup into a loose head.',
      clump: single(lettucePlant, { rate: 0.25, a: '#c9c25a', b: '#8a7a3a' }, 79, ao(LETTUCE_STAGES, 0.7)),
      produce: item((b) => lettucePlant(b, 4, 'healthy', true), 7, false)
    },
    cabbage: {
      name: 'Cabbage', short: 'Cabbage', unit: 'plant', disease: 'Black rot', spot: '#4a3b22', dot: '#8db497', item: 'Cabbage head',
      STAGES: CABBAGE_STAGES, field: { row: 0.6, step: 0.5, size: 5 }, stiff: 0.3,
      note: 'Waxy blue-green outer leaves feed a tight pale head that forms in the middle.',
      clump: single(cabbagePlant, { rate: 0.22, a: '#4a3b22', b: '#c9b84a' }, 83, ao(CABBAGE_STAGES, 0.6)),
      produce: item((b) => cabbagePlant(b, 4, 'healthy', true), 8, true)
    },
    potato: {
      name: 'Potato', short: 'Potato', unit: 'plant', disease: 'Late blight', spot: '#4a3220', dot: '#c49a64', item: 'Potato',
      STAGES: POTATO_STAGES, field: { row: 0.75, step: 0.32, size: 5 }, stiff: 0.6, rootDepth: [0.09, 0.08, 0.11, 0.13, 0.14],
      note: 'Tubers swell underground on runners from the stem. The tops yellow and fall over when they are ready to dig.',
      clump: single(potatoPlant, { rate: 0.22, a: '#4a3220', b: '#b7a03a' }, 97, ao(POTATO_STAGES, 0.3)),
      produce: item((b) => tuber(b, new V3(0, 0.033, 0), new V3(1, 0, 0.15).normalize(), 0.034, 0.1), 9, true)
    }
  };
  const CONDITIONS = { healthy: 'Healthy', dry: 'Dry', lown: 'Low nitrogen', rust: 'Disease' };

  root.FWCrops = { CROPS, CONDITIONS, rng, leafTexture };
})(typeof window !== 'undefined' ? window : globalThis);
