import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createRequire } from 'module';
import fs from 'fs';
import { PNG } from 'pngjs';
globalThis.THREE = THREE;
globalThis.FileReader = class { readAsArrayBuffer(b){ b.arrayBuffer().then(r=>{this.result=r; this.onloadend&&this.onloadend();}); } };
const req = createRequire(import.meta.url);
req(process.argv[2]); req(process.argv[3]);
const out = process.argv[4];
const { CROPS, leafTexture, soilTexture, makeMaterials } = globalThis.FWCrops;
console.warn = () => {};
const exp = (obj) => new Promise((res, rej) => new GLTFExporter().parse(obj, res, rej, { binary: true }));
for (const [key, crop] of Object.entries(CROPS)) {
  const scene = new THREE.Scene(); scene.name = 'Fieldworks_' + key;
  const mat = makeMaterials();
  const step = Math.max(0.5, (crop.spread || 0) * 1.1, crop.STAGES[4].height * 0.6);
  crop.STAGES.forEach((s, i) => { const m = new THREE.Mesh(crop.clump({ stage: i, seed: 3 }), mat); m.name = `${key}_stage${i + 1}_${s.name.toLowerCase().replace(/ /g, '_')}`; m.position.x = i * step; scene.add(m); });
  [['dirty', true, 0.9], ['washed', false, 0.5]].forEach(([n, d, rough], j) => {
    const m = new THREE.Mesh(crop.produce({ dirty: d }), makeMaterials({ roughness: d ? 1.4 : 0.9 }));
    m.name = `${key}_item_${n}`; m.position.set(j * 0.5, 0, -1); scene.add(m);
  });
  fs.writeFileSync(`${out}/fieldworks_${key}.glb`, Buffer.from(await exp(scene)));
}
const st = globalThis.FWStation.build({});
fs.writeFileSync(`${out}/fieldworks_washing_station.glb`, Buffer.from(await exp(st.group)));
const L = leafTexture(), png = new PNG({ width: L.width, height: L.height });
png.data = Buffer.from(L.data); fs.writeFileSync(`${out}/fieldworks_leaf_veins.png`, PNG.sync.write(png));
for (const [nm, dry] of [['soil', false], ['soil_dry', true]]) { const t = soilTexture({ size: 1024, dry }); for (const [k, data] of [['albedo', t.albedo], ['normal', t.normal]]) { const q = new PNG({ width: t.width, height: t.height }); q.data = Buffer.from(data); fs.writeFileSync(`${out}/fieldworks_${nm}_${k}.png`, PNG.sync.write(q)); } }
console.log('done');
