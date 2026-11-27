# Fieldworks master plan: status and stages

This tracks the "Professional game development master prompt" against what exists.

The real game lives on the owner's PC (`C:\Users\gaelc\Downloads\Fieldworks`). That PC has not been connected to the cloud sessions, so nothing here has been merged into the real game yet. Everything below is built and tested in `fieldworks-machines/` as modules plus a playable yard page (`yard.html`), ready to move into the game.

Before integrating, step 1 of the prompt still has to happen: inspect the real project, its engine, its systems and its assets.

## Stage 1 (done here): completeness and connections

| Prompt section | What exists now | Files |
|---|---|---|
| 3. Asset audit | An automated validator for floating parts, open holes, empty or broken geometry, sockets off the surface, unconnected ports, cable or pipe ends away from their sockets, and missing colliders. Run `yard.html?audit=1`. The first run found 71 problems, including a truck bumper floating 70 cm behind the chassis, tower insulators hanging below their arms, a pump pulley with no shaft, and packer and pallet not connected. It now reports 0 errors and 5 warnings (open rims on old generator domes). | `validate.js` |
| 4. Connection system | Ports with an id, type (power, water, fuel, conveyor, overhead wire, signal), in/out/both, position, facing, capacity and links. Each port has a visible gland or flange. `canConnect()` refuses wrong types, two inputs, two outputs, and gaps or misalignment on direct joints, and says why. | `ports.js` |
| 5. Modular connection | Every cable, wire and pipe in the yard is built from one port to another, 48 links over 80 ports. Conveyor joints must touch (15 cm or less) and face each other (25° or less). The hopper, belt, packer, roller chute and pallet are joined this way. | `yard.html` |
| 9. Electrical | Wind, solar, battery, diesel auto-start, breakers, load shedding and export. The processing line, lights and drinks cooler are now on real cables. | `sims.js` `PowerGrid` |
| 10. Physics | cannon-es rigid bodies with mass and friction, a truck on raycast suspension, sleeping bodies, and colliders on every machine (checked by the validator). | `yard.html` |
| 2. Art direction | Low-poly flat shading with bold ink outlines that stay solid at any distance, a consistent palette, and sharp full-resolution rendering. | `lowpoly.js`, `graphics.js` |
| 6, 8. Crops and processing | Six crops with four growth stages, watering, harvest, and a washer, sorter, packer and pallet that sell. | `lpcrops.js`, `line.js`, `sims.js` |

## Stage 2: needs the real project (PC connected)
1. Inspect the real game: engine, chunk terrain, save format, building system, vehicles, existing assets.
2. Run the validator on every real model (it works on any three.js object tree) and fix what it finds.
3. Move ports and links into the game's building system: snapping, placement preview, and a red "cannot connect" reason.
4. Save and load the connection graph with the world (section 20).

## Later stages (not started)
- Crops: rice, cotton, sunflowers, soybeans, berries, potatoes, tomatoes and lettuce in the new style, and a seed-to-harvested 7-stage cycle (section 6).
- Machinery: tractor and implements with hitches as ports (sections 7 and 11).
- Production chains: wheat to flour to bread, and the others (section 8).
- Buildings with snapping foundations (section 12).
- Biomes, rivers, towns and roads in the infinite world (section 13).
- Multiplayer authority, anti-cheat, moderation and the staff application system: these need the game's server design first (sections 18 and 19).
