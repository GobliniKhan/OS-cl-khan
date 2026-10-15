# Four Nations Colony

A playable 2D top-down colony simulation prototype inspired by *Avatar: The Last Airbender* and *RimWorld*.

- `AvatarColony.jsx`: the game, written as one self-contained React component (HTML5 Canvas + Tailwind HUD + `lucide-react` icons). Drop it into any React artifact or app that has Tailwind and `lucide-react` (it uses icons available since lucide-react 0.263).
- `index.html`: a prebuilt, offline copy (React, icons and compiled Tailwind CSS inlined). Open it in a browser to play.

## Playing

| Input | Action |
| --- | --- |
| WASD / arrow keys, or drag with the Select tool | Pan |
| Mouse wheel, or the zoom buttons | Zoom |
| Space, 1, 2, 3 | Pause, 1x, 2x, 3x speed |
| Esc / right-click | Back to the Select tool |
| Drag with a tool | Designate mining/chopping, place blueprints, paint zones |

Bottom bar: **Orders** (Mine, Chop, Hunt, Clear), **Structures** (Stone Wall, Door, Bed, Campfire, Tea Table, Spike Trap) and **Zones** (Stockpile, Cabbage Patch, Jasmine Tea). Dragging a wall box draws its outline.

## Systems

- **Map**: procedurally generated 40x40 grid with grass, fertile soil, stone deposits, water and trees. Day/night cycle (one in-game day lasts 3 minutes at 1x) with campfire lighting.
- **Colonists**: start with four benders (Earth, Water, Fire, Air); a Non-Bender wanderer joins on the first storyteller event. Each has Health, Chi, Food, Rest and Harmony, plus thoughts, injuries and an inventory.
  - Earthbender: mines and builds 2.2x faster and raises stone walls instantly with 25 Chi (no stone used).
  - Waterbender: waters a 5x5 crop area in one motion, tends and heals wounds, and drops combat to save a bleeding ally.
  - Firebender: kindles campfires with Chi, flash-cooks 3x faster, and has the strongest ranged attack.
  - Airbender: moves 2.5x faster, carries 75 items instead of 25, and its gusts knock enemies back.
  - Non-Bender: builds 1.5x faster (traps 3x) and chi-blocks enemies in melee so they cannot bend.
- **Jobs**: each colonist picks work autonomously by priority: eat, then sleep, then tend or rescue the wounded, then its discipline's work list (build, mine, chop, haul, plant, harvest, water, cook, kindle, deconstruct), then tea and wandering. Tiles and items are reserved so two colonists never take the same task. Pathfinding is Dijkstra on an 8-way grid.
- **Harmony**: needs, events, tea, meals and deaths add or remove Harmony. If it stays below 22, the colonist can have a mental break: Fire Tantrum (firebenders hurl fire at structures), Gale Wandering (airbenders) or Chi Catatonia (everyone else).
- **Combat**: Fire Nation Scouts (fireballs, burns) and Sandbenders (sand blades, bleeding cuts) raid from the map edge. They target colonists, bash through doors and walls, and flee when badly hurt. Walls block projectiles. Spike traps root and damage raiders. A colonist whose Health drops below 15 is downed and bleeds until tended. Others carry them to a bed. A colonist dies only by bleeding out or starving.
- **Storyteller**: "Uncle Iroh" and "Azula" events come every 70–125 seconds: Full Moon (Waterbenders get unlimited Chi and +50% speed), Heatwave (crops dry out and wither unless watered), a Platypus-Bear (neutral until startled or hunted; drops meat), raids, and a tea caravan with supplies.

## Rebuilding `index.html`

`index.html` is a bundle of `AvatarColony.jsx` built with esbuild (React 18.3.1, lucide-react 0.263.1) plus Tailwind 3.4 CSS compiled with `content` set to `AvatarColony.jsx`. Bundle an entry that renders `<AvatarColony />` into `#root` and inline the JS and CSS into the page.

The simulation core is exported as `__sim` (`createGame`, `update`, `applyTool`, `fireEvent`) so you can test it headlessly in Node. Setting `globalThis.__COLONY_DEBUG__ = true` before the game mounts exposes the live game state as `globalThis.__colony`.
