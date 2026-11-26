import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { PNG } from 'pngjs';
import fs from 'fs';
const buf = fs.readFileSync(process.argv[2]);
const loader = new RGBELoader(); loader.setDataType(THREE.FloatType);
const r = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const { width: W, height: H, data } = r;
const m = new PNG({ width: W, height: H }), e = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) {
  const R = data[i * 4], G = data[i * 4 + 1], B = data[i * 4 + 2], mx = Math.max(R, G, B);
  let ex = mx > 1e-20 ? Math.ceil(Math.log2(mx)) : -128; ex = Math.max(-128, Math.min(127, ex));
  const s = 255 / Math.pow(2, ex);
  m.data[i * 4] = Math.min(255, Math.round(R * s)); m.data[i * 4 + 1] = Math.min(255, Math.round(G * s)); m.data[i * 4 + 2] = Math.min(255, Math.round(B * s)); m.data[i * 4 + 3] = 255;
  e.data[i * 4] = e.data[i * 4 + 1] = e.data[i * 4 + 2] = ex + 128; e.data[i * 4 + 3] = 255;
}
fs.writeFileSync(process.argv[3] + '_m.png', PNG.sync.write(m)); fs.writeFileSync(process.argv[3] + '_e.png', PNG.sync.write(e));
console.log(W, H, 'max', Math.max(...Array.from({ length: 2000 }, (_, k) => data[Math.floor(k / 2000 * W * H) * 4])));
