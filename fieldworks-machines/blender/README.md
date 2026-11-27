# Fieldworks Blender models

Models are built by Python scripts in Blender (4.0+), exported as `.glb` into `../models/`, and loaded by the game
through `models.js`. Open a script in Blender's Scripting tab to edit a model by hand, or run it headless:

    blender -b --python conveyor.py -- ../models/wash_tunnel.glb preview.png

- `kit.py` – shared helpers: bevelled blocks, round cylinders, octagonal bolts, bent pipes, gears, vents, the
  Fieldworks palette, glTF export and a Cycles preview render.
- `conveyor.py` – the wash tunnel (and a conveyor section used for previews).

Named parts the game animates: `water0`, `water1` (tank level bands), `belt` (scrolling belt).
