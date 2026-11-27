# Fieldworks power and water yard (low-poly)

`yard.html` is a playable low-poly yard where every machine works and depends on the others.

![Yard](images/yard_overview.png)

## What's in it

| Machine | Model and behaviour | Files |
|---|---|---|
| Wind turbine FW-WT20 | Tapered tower, nacelle that yaws into the wind, three twisted blades with pitch control, anemometer, windsock. Power rises with the cube of the wind up to rated output, then the blades pitch. It waits below 3 m/s and feathers and brakes above 24 m/s. | `yard.js` `windTurbine()`, `sims.js` `WindTurbine` |
| Solar array FW-SA8 | 8 modules on a torque tube, ballast feet, string inverter with a live screen. Output follows the sun angle, weather, cell temperature and dust. The level 3 tracker follows the sun. | `solarArray()`, `SolarArray` |
| Power network FW-GRID | Battery container (BESS), distribution panel with moving breaker handles and a flow screen, transformer, poles, cables and lattice towers. Renewables run first, then the battery, then the diesel set, which starts and stops on its own. Loads are shed in order (lights, drone charger, pump). Surplus is sold to the utility. | `batteryContainer()`, `distributionPanel()`, `transformer()`, `utilityPole()`, `latticeTower()`, `PowerGrid` |
| Diesel generator GX-12 | The existing engineered model in the low-poly style, used as automatic backup. | `generator.js` |
| Pump jack FW-PJ10 | Crank, pitman arms and walking beam solved as a real four-bar linkage; the horsehead arc lifts the rod straight up and down. Each stroke lifts the plunger volume from a 60 m well. | `pumpJack()`, `PumpJack` |
| Storage tank | 3 to 5 bolted rings (one per upgrade), cone roof with railing, ladder and cage, sight gauge with a float that tracks the level, manway, and a red outlet valve. | `storageTank()`, `StorageTank` |
| Spray drone FW-AD16 | Quad frame, spinning props, translucent tank with a liquid level, boom and spray mist, navigation lights. It refills from the tank, charges on the pad from the network, then sprays the field lane by lane and returns on an empty tank or low battery. | `sprayDrone()`, `dronePad()`, `sprayFX()`, `SprayDrone` |
| Crop field | Instanced low-poly plants; sprayed plants turn green and dry out over a few hours, which starts the next mission. | `cropField()` |
| Utility truck | Drivable on cannon-es raycast suspension: four springs, real mass, grip and brakes. Crates ride in the bed. | `truck()` plus the vehicle setup in `yard.html` |
| Physics props | Crates, barrels, pumpkins and hay bales with mass and friction; tap one to push it. Bodies sleep when still. The drone pushes props out of its way. | `crate()`, `barrel()`, `pumpkin()`, `hayBale()` |

World controls: time of day, simulation speed (1x, 10x, 60x), wind (calm to storm), weather (clear, cloudy, rain), and physics drops. Night uses its own colour grade and the yard lights only work while their circuit has power.

## The low-poly style (`lowpoly.js`)

- `stylize(root)`: flat-shaded materials, photo maps removed, canvas screens and labels kept, and outlines made from inverted hulls with smoothed normals. Outlines stay at least about 1.3 px wide at any distance.
- `bake(root, keep)`: merges every part that does not move into one mesh per material. The yard went from about 2,200 draw calls to about 470. Run it before `stylize()`, and list the parts that animate in `keep`.
- `tree()`, `rock()`, `grassTuft()`, `terrain()`, `terrainHeight()`: nature and ground.

## Putting it into the game

1. Copy `lowpoly.js`, `yard.js` and `sims.js` next to the existing machine files (`machine.js`, `parts.js`, `generator.js`, `graphics.js`, `glow.js`, `outline.js`).
2. Build a machine, then `bake()` (the builders already bake themselves), then `stylize()`, then attach glow lights. Glow must come after `stylize()`, because `stylize()` replaces materials.
3. Each frame call the sim's `tick(dt, env)` and the model's `animate(dt, sim, env)`. `env` is `{ hour, sunDir, irradiance, wind, windDir, airC }`.
4. Panels use the same `panel()` and `act(id, wallet)` format as the wash line.
5. cannon-es (0.20.0) runs the physics. After you place or rotate a static body, call `body.updateAABB()`. Without it, raycasts (and so the truck's wheels) miss the body.
