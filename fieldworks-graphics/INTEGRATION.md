# Fieldworks graphics pipeline: how to add it to the game

`graphics.js` is step 1 of the graphics upgrade (rendering setup). It wraps the game's existing renderer, scene, camera and sun. No game system is replaced: the only change in the game loop is one line.

It's written for **three.js r147** with ES module imports (`three/examples/jsm/...`). If the game uses another three.js version, check the import paths first. From r150, `three/addons/...` also works. From r152, colour handling changed (`outputColorSpace`), and the two lines that set `outputEncoding` need updating.

## What it adds

- **HDR post-processing chain:** scene → ambient occlusion (SAO, half resolution) → bloom → final pass (exposure, ACES filmic tone mapping, colour grading, vignette, sRGB) → anti-aliasing (SMAA or FXAA).
- **Bloom only on real light sources:** bloom starts above brightness 1.0, so only emissive parts glow. Make a part glow by giving it `emissive` colour with `emissiveIntensity` between 2 and 4. Ordinary bright surfaces like white walls and sky don't bloom.
- **Reflections:** an image-based environment map at an adjustable strength (default 0.2), so metal, glass and wet surfaces reflect.
- **Shadow quality:** off, low, medium, high, ultra (1024–4096, PCF or soft PCF) applied to the sun.
- **Colour grading looks for areas:** `farm`, `workshop`, `factory`, `greenhouse`, `power`, `dusk`, `neutral`, blended smoothly when the player moves between areas.
- **Presets:** Low, Medium, High, Ultra, Cinematic, Custom. Settings are saved in localStorage.
- **Adaptive resolution** on Low and Medium: it lowers the render scale (down to 60%) when a frame takes more than 1.15× the target.
- **Settings panel** (plain DOM): preset, resolution scale, shadows, reflections, reflection strength, anti-aliasing, ambient occlusion, bloom, colour grading, adaptive resolution, texture quality, effects quality, view distance, foliage density. It also shows live frame time, draw calls and triangles.
- **Plain-colour sky kept as it was:** if the game uses a `Color` as `scene.background`, it is shown exactly as before.

## Adding it (5 steps)

1. Copy `graphics.js` into the game's source, for example `js/graphics.js`.

2. Where the renderer, scene, camera and sun are created:

```js
import { createGraphics, createSettingsPanel } from './graphics.js';

const gfx = createGraphics({
  renderer, scene, camera,
  sun,                         // the main DirectionalLight
  targetFps: 60,
  onChange: (s) => {
    // Game-side settings. Map them onto the game's own systems:
    world.setViewDistance(s.viewDistance);       // e.g. chunk radius x s.viewDistance
    grass.setDensity(s.foliageDensity);
    particles.setQuality(s.effects);
  }
});
```

3. In the game loop, replace `renderer.render(scene, camera)` with:

```js
gfx.render(dt);   // dt in seconds
```

4. In the window resize handler, replace the renderer and camera size update with:

```js
camera.aspect = w / h; camera.updateProjectionMatrix();
gfx.resize(w, h);
```

5. In the options menu:

```js
optionsMenu.appendChild(createSettingsPanel(gfx));
```

**Optional:**
- `gfx.setGrade('workshop', 1.5)` when the player enters a shed; `gfx.setGrade('farm', 2)` when they leave.
- `gfx.setEnvironment(skyScene)` to reflect the game's own sky outdoors; it defaults to a neutral room.
- `gfx.setCamera(cam)` when switching between the player camera and a vehicle camera.
- `gfx.applyTextures(newChunkGroup)` after loading new content, so texture filtering follows the texture quality setting.

## Things to check after adding it

- **Colours:** the final pass now does tone mapping and sRGB conversion, so the renderer's own `toneMapping` and `outputEncoding` are switched off by the module. Don't set them back elsewhere in the game.
- **Custom shaders:** a `ShaderMaterial` that includes `<tonemapping_fragment>` or `<encodings_fragment>` keeps working. One that does its own gamma correction will look too bright and needs that step removed.
- **Cost of ambient occlusion:** SAO renders the scene twice more (depth and normals), so it's only on High and above. If the game has many draw calls, use Medium or merge or instance more objects (step 8 of the plan).
- **Wind and other vertex animation:** the ambient-occlusion depth pass doesn't run custom vertex code, so swaying plants can get slightly offset ambient occlusion. It's barely visible at normal distances.

## Tested so far

- **Test scene:** I ran it in a test scene built from the Fieldworks crops and washing station, in a browser with software rendering, comparing before and after with the same camera and lights. The pictures are `images/before_after_washer.png` and `images/before_after_close.png`.
- **Presets:** every preset runs without errors.
- **Not yet tested:** frame time and draw calls on a real graphics card, and the pipeline inside the actual game. The test machine has no GPU, so its frame times say nothing about real performance. Measure in the game with the panel's live readout before and after.

## Running the test scene

```
cd test
# put three.module.js (r147) next to test.html and copy three/examples/jsm to ./jsm
python -m http.server 8000
# open http://localhost:8000/test.html?mode=before  and  ?mode=after&preset=high
```

The test page loads `crops.js` and `station.js` from the `fieldworks-crops` folder; copy them next to `test.html`.
