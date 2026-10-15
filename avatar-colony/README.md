# Four Nations Colony

A playable 2D top-down colony simulation prototype inspired by *Avatar: The Last Airbender* and *RimWorld*.

- `AvatarColony.jsx`: the game, written as one self-contained React component (HTML5 Canvas + Tailwind HUD + `lucide-react` icons). Drop it into any React artifact or app that has Tailwind and `lucide-react` (it uses icons available since lucide-react 0.263).
- `index.html`: a prebuilt, offline copy (React, icons and compiled Tailwind CSS inlined). Open it in a browser to play.

## Playing

The colonists have **free will** by default: they decide what the camp needs and place their own orders. All you do is watch, click anyone to inspect them, and set the speed. Each plan appears in the Storyteller log, voiced by the colonist who had the idea.

| Need | What the colonists do |
| --- | --- |
| Shelter | Lay out a bed for every colonist, including newcomers |
| Food | Keep a campfire, grow about 5 cabbage tiles per colonist (fertile soil first), hunt the platypus-bear when food runs low and the group is healthy |
| Materials | Mark the nearest trees and stone faces when wood or stone runs short |
| Storage | Grow the stockpile when it fills up |
| Harmony | Build a tea table once everyone has a bed, then plant jasmine for it |
| Defence | When their habits say so, raise a stone wall around camp a few sections at a time, with a gate on each side and spike traps outside the gates |
| Crises | Once learned, one colonist acts as medic (the Waterbender, or a backup) and breaks off from fighting to save a bleeding ally |

### Generations and learning

Generation 1 is naive and makes real mistakes: it never walls the camp, fights until it drops, has no medic, hunts the platypus-bear on sight, farms too little, and never builds a tea table. When every colonist is dead, the colony's chronicle becomes lessons:

| What went wrong | Lesson for the next generation |
| --- | --- |
| Raid deaths with the wall unfinished | Wall the camp after the first raid, or by an earlier day; keep more spike traps |
| Colonists downed while fighting | Fall back at a higher health threshold |
| Colonists bled out mid-battle | One colonist acts as medic |
| Mauled by the platypus-bear | Only hunt it when hungry and healthy |
| Hunger or starvation | Bigger farms, more meals cooked ahead |
| Crops withered in a heatwave | Water first during heatwaves |
| Repeated mental breaks | Build a tea table and grow jasmine |
| Builders waiting on materials | Keep larger wood and stone reserves |

Each generation also runs one small random experiment, which may itself be a mistake. A generation that does far worse than the best one so far starts again from the best one's habits before adding its own lessons. After the lessons report, the next generation starts automatically on a new valley. Raids grow every day without limit, so every generation eventually falls; the measure of progress is how many days each one lasts. The **Generation** button (top right) shows the current habits, a days-survived chart and every past colony's lessons. The lineage is saved in the browser's local storage and can be erased from that panel. Press 4 for 8x speed.

Press **Give orders** to take command and unlock the build tools. Colonists still work on their own, but only you place orders. Press **Free will** to hand control back.

| Input | Action |
| --- | --- |
| WASD / arrow keys, or drag with the Select tool | Pan |
| Mouse wheel, or the zoom buttons | Zoom |
| Space, 1, 2, 3, 4 | Pause, 1x, 2x, 3x, 8x speed |
| Esc / right-click | Back to the Select tool |
| Drag with a tool | Designate mining/chopping, place blueprints, paint zones |

In command mode, the bottom bar has **Orders** (Mine, Chop, Hunt, Clear), **Structures** (Stone Wall, Door, Bed, Campfire, Tea Table, Spike Trap) and **Zones** (Stockpile, Cabbage Patch, Jasmine Tea). Dragging a wall box draws its outline.

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

The simulation core is exported as `__sim` (`createGame`, `update`, `applyTool`, `fireEvent`) plus `chronicle` and `learnFromFall`, so you can run whole lineages headlessly in Node. Setting `globalThis.__COLONY_DEBUG__ = true` before the game mounts exposes the live game state as `globalThis.__colony`.
