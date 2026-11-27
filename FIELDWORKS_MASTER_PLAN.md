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

## Stage 1b (done here): everything that does not need the PC

| Prompt section | What exists now |
|---|---|
| 6. Crops | 19 soft-shaded crops with the full 7-stage cycle and two levels of detail, plus harvested items. Soil states for plowing and sowing. |
| 7, 11. Machinery and transport | Tractor with plow, seeder, harvester and a tipping trailer. Implements couple through hitch ports; towed ones articulate behind the drawbar. The harvest is augered into the trailer, hauled and tipped into the hopper. |
| 8. Production chain | Wheat to flour to bread to crates, and corn to cornmeal. The sorter pushes grain onto a cross belt and a grain elevator that feeds the mill's top hopper, all joined port to port. |
| 12. Buildings | Barn, warehouse and greenhouse: complete models with snapping placement, rotation, blocked-placement reasons, colliders and removal. |
| 20. Saving | Autosave with a backup copy and validation on load. |
| 3, 16. Validation | Every new model passes the validator (0 errors, 0 warnings). It found and fixed a floating tractor front axle, harvester wheels with no axle, oven walls 27 cm above their base, and an unmounted mill motor. |

## Stage 1c (done here): the 100x prompt, first connected loop

This stage builds one loop that runs through the whole farm, instead of many disconnected machines: soil sets crop quality, the sorter rejects poor produce, the digester turns rejects into power and fertiliser, and the rover puts the fertiliser back where the soil needs it. The rules controller and the diagnostics sit on top of everything.

| 100x prompt section | What exists now | Files |
|---|---|---|
| 2E. Smart resource recovery | Bio-recovery digester: an auger from the sorter's reject tote, a twin-shaft shredder, a heated digester tank with a gas dome that swells with biogas, a biogas engine that powers the yard, a flare, and a digestate pump. Digestion slows below 30 °C, and the engine's waste heat keeps the tank warm. | `invent.js`, `industry.js` |
| 2A, 2C. Adaptive agricultural engine, autonomous rover | Soil steward station (scanning mast, weather head, console with a live nitrogen map, digestate tank, rover dock with a charger and fill spout) and a high-clearance straddle rover. The rover drives through the east gate, probes stale zones and feeds hungry ones. | `invent.js`, `industry.js` |
| 6, 7. Soil intelligence | Every plant cell has moisture, nitrogen, organic matter and compaction. Crops have nitrogen needs, legumes fix their own, organic matter holds water and releases nitrogen, plowing loosens soil and heavy passes pack it, and planting the same crop twice costs 15% growth. Rain waters the field. | `sims.js` |
| 8. Quality grades | Soil quality during growth sets grade A (+20%), B or C. The optical sorter brushes grade C into the reject tote. | `sims.js` |
| 5. Programmable automation | Logic controller with up to 8 rules (if a sensor is above or below a value, then an action). It has 12 sensors and 9 actions, and each action works only on a machine wired to the controller by a purple signal cable. The rules are edited in the game, held with a small margin so they don't flicker, saved, and shown on the cabinet's lights. | `industry.js`, `yard.html` |
| 4. Connections | A new digestate line port type. 74 links: a buried digestate main, five signal cables, a new pole on the overhead line, and the auger joined to the tote. | `ports.js` |
| 14, 15. Diagnostics and screens | A Diagnose tab on every machine: unconnected ports, power (and which breaker or rule cut it), faults, wear and process problems, each with a fix. A yard-wide diagnostics view. Live screens on the digester, steward, rover and controller. | `yard.html` |
| 16. Quality control | All new models pass the validator: 0 errors, 0 warnings. | `validate.js` |

Still to build from the 100x prompt, in order of value: the modular machine designer (section 3), production recipes and multi-stage cores (2B, 2D, 8), mechanical and hydraulic power types (4, 9), fluid pressure and flow (11), logistics routes and forklifts (12), blueprints, milestones and environmental footprint (14), and crop research (6).

## Stage 2: needs the real project (PC connected)
1. Inspect the real game: engine, chunk terrain, save format, building system, vehicles, existing assets.
2. Run the validator on every real model (it works on any three.js object tree) and fix what it finds.
3. Move ports and links into the game's building system: snapping, placement preview, and a red "cannot connect" reason.
4. Save and load the connection graph with the world (section 20).

## Later stages (not started)
- More production chains: wood to furniture, ore to parts, milk to cheese (section 8). These need animals, a forest and mining first.
- A player-driven tractor using the truck's suspension (sections 7 and 11).
- Biomes, rivers, towns and roads in the infinite world (section 13).
- Multiplayer authority, anti-cheat, moderation and the staff application system: these need the game's server design first (sections 18 and 19).
