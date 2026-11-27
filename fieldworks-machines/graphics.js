// Fieldworks graphics pipeline.
// Drop-in rendering upgrade: HDR post-processing (ambient occlusion, bloom, anti-aliasing, tone mapping,
// colour grading), image-based reflections, shadow quality, adaptive resolution and graphics presets.
// It wraps the game's existing renderer, scene, camera and sun; nothing in the game is replaced.
// Written for three.js r147 (examples/jsm). Usage is in INTEGRATION.md.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ---------------------------------------------------------------------------
// Presets. "custom" starts from whatever was last chosen and lets the player change single settings.
// renderScale multiplies the device pixel ratio (capped by maxPixelRatio).
// viewDistance, foliageDensity and textureQuality are handed to the game through onChange;
// the game decides what they mean for its chunks, grass and textures.
export const PRESETS = {
  low: {
    renderScale: 0.8, maxPixelRatio: 1, antialias: 'fxaa', ao: false, aoStrength: 0, bloom: false, bloomStrength: 0,
    shadows: 'low', reflections: 'off', envStrength: 0, grade: true, vignette: 0, viewDistance: 0.6, foliageDensity: 0.4,
    textureQuality: 'low', effects: 'low', adaptive: true
  },
  medium: {
    renderScale: 1, maxPixelRatio: 1, antialias: 'smaa', ao: true, aoStrength: 1.0, bloom: true, bloomStrength: 0.2,
    shadows: 'medium', reflections: 'low', envStrength: 0.32, grade: true, vignette: 0.15, viewDistance: 0.8, foliageDensity: 0.7,
    textureQuality: 'medium', effects: 'medium', adaptive: true
  },
  high: {
    renderScale: 1, maxPixelRatio: 1.5, antialias: 'smaa', ao: true, aoStrength: 1.1, bloom: true, bloomStrength: 0.3,
    shadows: 'high', reflections: 'high', envStrength: 0.38, grade: true, vignette: 0.2, viewDistance: 1, foliageDensity: 1,
    textureQuality: 'high', effects: 'high', adaptive: false
  },
  ultra: {
    renderScale: 1, maxPixelRatio: 2, antialias: 'smaa', ao: true, aoStrength: 1.1, bloom: true, bloomStrength: 0.6,
    shadows: 'ultra', reflections: 'high', envStrength: 0.25, grade: true, vignette: 0.22, viewDistance: 1.3, foliageDensity: 1.3,
    textureQuality: 'ultra', effects: 'high', adaptive: false
  },
  cinematic: {
    renderScale: 1.25, maxPixelRatio: 2, antialias: 'smaa', ao: true, aoStrength: 1.25, bloom: true, bloomStrength: 0.7,
    shadows: 'ultra', reflections: 'high', envStrength: 0.3, grade: true, vignette: 0.32, viewDistance: 1.5, foliageDensity: 1.5,
    textureQuality: 'ultra', effects: 'high', adaptive: false
  }
};
export const PRESET_NAMES = ['low', 'medium', 'high', 'ultra', 'cinematic', 'custom'];

const SHADOWS = {
  off: null,
  low: { size: 1024, type: THREE.PCFShadowMap },
  medium: { size: 2048, type: THREE.PCFSoftShadowMap },
  high: { size: 2048, type: THREE.PCFSoftShadowMap },
  ultra: { size: 4096, type: THREE.PCFSoftShadowMap }
};
const ANISO = { low: 1, medium: 4, high: 8, ultra: 16 };

// Colour grading looks, used per area (farm, workshop, factory, greenhouse, power).
// temp: + warm / - cool; tint: + magenta / - green; lift and gain are per-channel shadow and highlight colour.
export const GRADES = {
  neutral:   { exposure: 1.0, contrast: 1.0, saturation: 1.0, temp: 0, tint: 0, lift: [0, 0, 0], gain: [1, 1, 1] },
  farm:      { exposure: 1.0, contrast: 1.07, saturation: 1.04, temp: 0.03, tint: -0.01, lift: [0, 0, 0.004], gain: [1.02, 1.0, 0.96] },
  workshop:  { exposure: 1.0, contrast: 1.08, saturation: 1.02, temp: 0.1, tint: 0, lift: [0.012, 0.006, 0], gain: [1.03, 0.99, 0.93] },
  factory:   { exposure: 1.02, contrast: 1.1, saturation: 0.96, temp: -0.06, tint: 0, lift: [0, 0.004, 0.012], gain: [0.97, 1.0, 1.04] },
  greenhouse:{ exposure: 1.06, contrast: 1.03, saturation: 1.1, temp: -0.01, tint: -0.03, lift: [0, 0.01, 0.004], gain: [0.98, 1.03, 0.98] },
  power:     { exposure: 0.98, contrast: 1.12, saturation: 0.95, temp: -0.09, tint: 0.01, lift: [0, 0.006, 0.016], gain: [0.95, 1.0, 1.06] },
  dusk:      { exposure: 0.95, contrast: 1.06, saturation: 1.05, temp: 0.14, tint: 0.02, lift: [0.012, 0.004, 0.012], gain: [1.05, 0.96, 0.9] }
};

// Final pass: exposure -> ACES filmic -> grade -> vignette -> sRGB. Replaces the renderer's own tone mapping,
// which three.js skips when rendering into the composer's HDR buffers.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    exposure: { value: 1 }, contrast: { value: 1 }, saturation: { value: 1 },
    temp: { value: 0 }, tint: { value: 0 },
    lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) },
    vignette: { value: 0.2 }, resolution: { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float exposure, contrast, saturation, temp, tint, vignette;
    uniform vec3 lift, gain;
    varying vec2 vUv;
    vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c) {
      const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c *= exposure / 0.6; c = IN * c; c = RRTAndODTFit(c); c = OUT * c; return clamp(c, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;
      c *= vec3(1.0 + temp * 0.6, 1.0 - tint * 0.5, 1.0 - temp * 0.6);
      c = aces(c);
      c = c * gain + lift * (1.0 - c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.18) * contrast + 0.18;
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.35, 0.95, length(d * vec2(1.15, 1.0)) * 1.25);
      gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
    }`
};

function readStore(key) { try { const v = window.localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function writeStore(key, v) { try { window.localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

/**
 * createGraphics({ renderer, scene, camera, sun, onChange, storageKey, targetFps })
 *   renderer, scene, camera: the game's existing objects.
 *   sun: the main DirectionalLight (optional), for shadow quality.
 *   onChange(settings): called after every settings change, for the game-side settings
 *                       (viewDistance, foliageDensity, textureQuality, effects).
 */
export function createGraphics(opts) {
  const { renderer, scene } = opts;
  let camera = opts.camera;
  const sun = opts.sun || null;
  const storageKey = opts.storageKey || 'fieldworks.graphics';
  const onChange = opts.onChange || (() => {});
  const targetMs = 1000 / (opts.targetFps || 60);

  const stored = readStore(storageKey);
  let presetName = stored && stored.preset && PRESET_NAMES.includes(stored.preset) ? stored.preset : 'high';
  const settings = Object.assign({}, PRESETS.high, presetName !== 'custom' ? PRESETS[presetName] : {}, stored && stored.preset === 'custom' ? stored.settings : {});

  // The composer does the tone mapping and sRGB conversion now.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.shadowMap.enabled = true;
  renderer.physicallyCorrectLights = renderer.physicallyCorrectLights || false;

  const size = new THREE.Vector2();
  renderer.getSize(size);
  const hdr = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, encoding: THREE.LinearEncoding });
  const composer = new EffectComposer(renderer, hdr);

  const renderPass = new RenderPass(scene, camera);
  const sao = new SAOPass(scene, camera, false, true, new THREE.Vector2(256, 256));
  Object.assign(sao.params, { output: 0, saoBias: 0.5, saoIntensity: 0.012, saoScale: 4, saoKernelRadius: 22, saoMinResolution: 0, saoBlur: true, saoBlurRadius: 6, saoBlurStdDev: 3, saoBlurDepthCutoff: 0.01 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.42, 1.4);
  const final = new ShaderPass(FinalShader);
  const smaa = new SMAAPass(256, 256);
  const fxaa = new ShaderPass(FXAAShader);
  composer.addPass(renderPass);
  composer.addPass(sao);
  composer.addPass(bloom);
  composer.addPass(final);
  composer.addPass(smaa);
  composer.addPass(fxaa);

  // ---------- environment reflections ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  let roomEnv = null;
  let envOwner = null;
  let envSource = 'room';
  let roomEnvStrength = -1;
  function roomEnvironment() {
    const k = settings.envStrength === undefined ? 0.2 : settings.envStrength;
    if (roomEnv && roomEnvStrength === k) return roomEnv;
    if (roomEnv) roomEnv.dispose();
    const room = new RoomEnvironment();
    room.traverse((o) => {
      if (o.isLight) o.intensity *= k;
      if (o.material && o.material.isMeshBasicMaterial) o.material.color.multiplyScalar(k);
      if (o.material && o.material.isMeshStandardMaterial) o.material.color.multiplyScalar(Math.max(0.05, k));
    });
    roomEnv = pmrem.fromScene(room, 0.04).texture;
    roomEnvStrength = k;
    return roomEnv;
  }
  // setEnvironment('room' | 'none' | THREE.Texture | THREE.Scene)
  function setEnvironment(src) {
    envSource = src === undefined ? 'room' : src;
    if (envOwner) { envOwner.dispose(); envOwner = null; }
    if (settings.reflections === 'off' || !settings.envStrength || src === 'none') { scene.environment = null; return; }
    if (src === 'room' || !src) { scene.environment = roomEnvironment(); return; }
    if (src.isScene) { envOwner = pmrem.fromScene(src, 0.02).texture; scene.environment = envOwner; return; }
    if (src.isTexture) { envOwner = src.mapping === THREE.CubeUVReflectionMapping ? null : pmrem.fromEquirectangular(src).texture; scene.environment = envOwner || src; }
  }

  // ---------- grading ----------
  let gradeNow = Object.assign({}, GRADES.farm), gradeTarget = Object.assign({}, GRADES.farm), gradeSpeed = 1.5;
  function setGrade(name, seconds) {
    const g = typeof name === 'string' ? GRADES[name] : name;
    if (!g) return;
    gradeTarget = Object.assign({}, GRADES.neutral, g);
    gradeSpeed = seconds === 0 ? 1e6 : 1 / Math.max(0.05, seconds === undefined ? 1.2 : seconds);
  }
  function stepGrade(dt) {
    const k = Math.min(1, dt * gradeSpeed * 3);
    ['exposure', 'contrast', 'saturation', 'temp', 'tint'].forEach((key) => { gradeNow[key] += (gradeTarget[key] - gradeNow[key]) * k; });
    ['lift', 'gain'].forEach((key) => { gradeNow[key] = gradeNow[key].map((v, i) => v + (gradeTarget[key][i] - v) * k); });
    const u = final.uniforms, on = settings.grade;
    u.exposure.value = gradeNow.exposure;
    u.contrast.value = on ? gradeNow.contrast : 1;
    u.saturation.value = on ? gradeNow.saturation : 1;
    u.temp.value = on ? gradeNow.temp : 0;
    u.tint.value = on ? gradeNow.tint : 0;
    u.lift.value.set(...(on ? gradeNow.lift : [0, 0, 0]));
    u.gain.value.set(...(on ? gradeNow.gain : [1, 1, 1]));
    u.vignette.value = settings.vignette;
  }

  // ---------- applying settings ----------
  let dynScale = 1;
  function pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    return Math.max(0.5, Math.min(dpr, settings.maxPixelRatio) * settings.renderScale * dynScale);
  }
  function applyShadows() {
    const s = SHADOWS[settings.shadows];
    renderer.shadowMap.enabled = !!s;
    if (s) renderer.shadowMap.type = s.type;
    if (sun) {
      sun.castShadow = !!s;
      if (s && sun.shadow.mapSize.x !== s.size) {
        sun.shadow.mapSize.set(s.size, s.size);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }
    renderer.shadowMap.needsUpdate = true;
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  }
  function applyTextures(root) {
    const max = renderer.capabilities.getMaxAnisotropy();
    const a = Math.min(max, ANISO[settings.textureQuality] || 4);
    (root || scene).traverse((o) => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((k) => {
          if (m[k] && m[k].anisotropy !== a) { m[k].anisotropy = a; m[k].needsUpdate = true; }
        });
      });
    });
  }
  function apply(changed) {
    sao.enabled = settings.ao;
    sao.params.saoIntensity = 0.012 * (settings.aoStrength || 1);
    bloom.enabled = settings.bloom;
    bloom.strength = settings.bloomStrength;
    smaa.enabled = settings.antialias === 'smaa';
    fxaa.enabled = settings.antialias === 'fxaa';
    if (!changed || changed.includes('shadows')) applyShadows();
    if (!changed || changed.includes('textureQuality')) applyTextures();
    if (!changed || changed.includes('reflections') || changed.includes('envStrength')) setEnvironment(envSource);
    resize();
    writeStore(storageKey, { preset: presetName, settings: presetName === 'custom' ? settings : undefined });
    onChange(Object.assign({ preset: presetName }, settings));
  }

  function resize(w, h) {
    if (w && h) renderer.setSize(w, h, false);
    renderer.getSize(size);
    const pr = pixelRatio();
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    composer.setSize(size.x, size.y);
    const W = Math.round(size.x * pr), H = Math.round(size.y * pr);
    sao.setSize(Math.round(W / 2), Math.round(H / 2));
    bloom.setSize(Math.round(W / 2), Math.round(H / 2));
    fxaa.uniforms.resolution.value.set(1 / W, 1 / H);
    final.uniforms.resolution.value.set(W, H);
  }

  // ---------- adaptive resolution ----------
  let acc = 0, frames = 0, lastMs = 0;
  function adapt(dtMs) {
    acc += dtMs; frames++;
    if (acc < 1000) return;
    const avg = acc / frames; lastMs = avg; acc = 0; frames = 0;
    if (!settings.adaptive) { if (dynScale !== 1) { dynScale = 1; resize(); } return; }
    let next = dynScale;
    if (avg > targetMs * 1.15) next = Math.max(0.85, dynScale - 0.05);
    else if (avg < targetMs * 0.8) next = Math.min(1, dynScale + 0.05);
    if (next !== dynScale) { dynScale = next; resize(); }
  }

  // A plain-colour sky is shown by the game exactly as written (it skips tone mapping and colour conversion).
  // Here it goes through the whole pipeline, so find the input colour that comes out as the same on-screen colour.
  const bgIn = new THREE.Color();
  function forward(rgb) {
    const u = final.uniforms;
    let c = [rgb[0] * (1 + u.temp.value * 0.6), rgb[1] * (1 - u.tint.value * 0.5), rgb[2] * (1 - u.temp.value * 0.6)];
    const e = u.exposure.value / 0.6;
    c = c.map((v) => v * e);
    const IN = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
    const OUT = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
    const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
    c = mul(IN, c).map((v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081));
    c = mul(OUT, c).map((v) => Math.min(1, Math.max(0, v)));
    const g = u.gain.value, l = u.lift.value;
    c = [c[0] * g.x + l.x * (1 - c[0]), c[1] * g.y + l.y * (1 - c[1]), c[2] * g.z + l.z * (1 - c[2])];
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return c.map((v) => ((lum + (v - lum) * u.saturation.value) - 0.18) * u.contrast.value + 0.18);
  }
  function backgroundFor(bg) {
    const target = [bg.r, bg.g, bg.b].map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    let x = target.slice();
    for (let i = 0; i < 14; i++) {
      const f = forward(x);
      x = x.map((v, k) => Math.min(30, Math.max(0, v * (target[k] + 1e-4) / (f[k] + 1e-4))));
    }
    return bgIn.setRGB(x[0], x[1], x[2]);
  }
  renderer.info.autoReset = false;

  // ---------- public API ----------
  let prev = performance.now();
  const api = {
    composer, passes: { renderPass, sao, bloom, final, smaa, fxaa },
    get settings() { return Object.assign({ preset: presetName }, settings); },
    setPreset(name) {
      if (!PRESET_NAMES.includes(name)) return;
      presetName = name;
      if (name !== 'custom') Object.assign(settings, PRESETS[name]);
      apply();
    },
    set(partial) {
      presetName = 'custom';
      Object.assign(settings, partial);
      apply(Object.keys(partial));
    },
    setCamera(cam) { camera = cam; renderPass.camera = cam; sao.camera = cam; },
    setEnvironment, setGrade, resize,
    applyTextures,
    // Call once per frame instead of renderer.render(scene, camera).
    render(dt) {
      const now = performance.now();
      const ms = now - prev; prev = now;
      stepGrade(dt !== undefined ? dt : ms / 1000);
      adapt(ms);
      renderer.info.reset();
      const bg = scene.background;
      const keep = !!(bg && bg.isColor);
      if (keep) { scene.background = backgroundFor(bg); }
      composer.render(dt);
      if (keep) scene.background = bg;
    },
    info() {
      const r = renderer.info.render;
      return { frameMs: Math.round(lastMs * 10) / 10, drawCalls: r.calls, triangles: r.triangles, pixelRatio: Math.round(pixelRatio() * 100) / 100, preset: presetName };
    },
    dispose() { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); pmrem.dispose(); if (roomEnv) roomEnv.dispose(); }
  };
  apply();
  return api;
}

/**
 * Optional settings panel (plain DOM, no dependencies). Mount it in the game's options menu:
 *   menu.appendChild(createSettingsPanel(gfx));
 */
export function createSettingsPanel(gfx) {
  const el = document.createElement('div');
  el.className = 'fw-gfx-panel';
  el.style.cssText = 'font:14px system-ui,sans-serif;color:#efe6d2;background:#1f1a13;border:1px solid #3a3124;border-radius:12px;padding:14px;display:grid;gap:10px;min-width:260px';
  const row = (label, input) => { const r = document.createElement('label'); r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px'; r.append(label, input); return r; };
  const select = (key, options) => {
    const s = document.createElement('select');
    s.id = 'fw-gfx-' + key;
    options.forEach((o) => { const op = document.createElement('option'); op.value = o; op.textContent = o[0].toUpperCase() + o.slice(1); s.appendChild(op); });
    s.onchange = () => (key === 'preset' ? gfx.setPreset(s.value) : gfx.set({ [key]: s.value }));
    return s;
  };
  const check = (key) => { const c = document.createElement('input'); c.type = 'checkbox'; c.id = 'fw-gfx-' + key; c.onchange = () => gfx.set({ [key]: c.checked }); return c; };
  const range = (key, min, max, step) => { const r = document.createElement('input'); r.type = 'range'; r.id = 'fw-gfx-' + key; Object.assign(r, { min, max, step }); r.oninput = () => gfx.set({ [key]: Number(r.value) }); return r; };
  const fields = {
    preset: select('preset', PRESET_NAMES),
    renderScale: range('renderScale', 0.5, 1.5, 0.05),
    shadows: select('shadows', ['off', 'low', 'medium', 'high', 'ultra']),
    reflections: select('reflections', ['off', 'low', 'high']),
    envStrength: range('envStrength', 0, 1, 0.05),
    antialias: select('antialias', ['off', 'fxaa', 'smaa']),
    ao: check('ao'), bloom: check('bloom'), grade: check('grade'), adaptive: check('adaptive'),
    textureQuality: select('textureQuality', ['low', 'medium', 'high', 'ultra']),
    effects: select('effects', ['low', 'medium', 'high']),
    viewDistance: range('viewDistance', 0.4, 1.6, 0.1),
    foliageDensity: range('foliageDensity', 0.2, 1.6, 0.1)
  };
  const labels = {
    preset: 'Preset', renderScale: 'Resolution scale', shadows: 'Shadows', reflections: 'Reflections', envStrength: 'Reflection strength', antialias: 'Anti-aliasing',
    ao: 'Ambient occlusion', bloom: 'Glow (bloom)', grade: 'Colour grading', adaptive: 'Adaptive resolution',
    textureQuality: 'Texture quality', effects: 'Effects quality', viewDistance: 'View distance', foliageDensity: 'Foliage density'
  };
  Object.keys(fields).forEach((k) => el.appendChild(row(labels[k], fields[k])));
  const stats = document.createElement('div');
  stats.style.cssText = 'font:12px ui-monospace,monospace;color:#a89a80';
  el.appendChild(stats);
  function refresh() {
    const s = gfx.settings;
    Object.keys(fields).forEach((k) => { const f = fields[k]; if (f.type === 'checkbox') f.checked = !!s[k]; else f.value = s[k]; });
    const i = gfx.info();
    stats.textContent = `${i.frameMs} ms · ${i.drawCalls} draw calls · ${(i.triangles / 1000).toFixed(0)}k triangles · scale ${i.pixelRatio}`;
  }
  refresh();
  el.addEventListener('change', refresh);
  setInterval(refresh, 1000);
  return el;
}
