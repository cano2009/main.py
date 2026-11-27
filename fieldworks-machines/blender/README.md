# Fieldworks Blender models

Models are built by Python scripts in Blender (4.0+), exported as `.glb` into `../models/`, and loaded by the game
through `models.js`. Open a script in Blender's Scripting tab to edit a model by hand, or run it headless:

    blender -b --python conveyor.py -- ../models/wash_tunnel.glb preview.png

- `kit.py` – shared helpers: bevelled blocks, round cylinders, octagonal bolts, bent pipes, gears, vents, the
  Fieldworks palette, glTF export and a Cycles preview render.
- `washer.py` – the hoop washer: an original Fieldworks design (brush and flaps, spray hood with hoops, sump with sight glass, filter drum, pump, blower).
- `conveyor.py` – a conveyor section used for previews.

Named parts the game animates: `water0` (sump sight glass), `brush`, `fan`, `belt`.

Design rule: the reference images set the style (bevelled shapes, clean colour, detail density), never the machine itself. Each machine is designed from what it does.
