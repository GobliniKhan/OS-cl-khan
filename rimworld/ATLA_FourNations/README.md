# Avatar: The Last Airbender – Four Nations (RimWorld mod)

*Water. Earth. Fire. Air.* Bending, the Avatar and the four nations in RimWorld.
The mod is built to run on old hardware such as an **early-2014 MacBook Air or iMac**.

## Why it runs on an early-2014 Mac

| Concern | What this mod does |
|---|---|
| CPU / platform | **XML only.** No C# DLLs and no Harmony, so there is nothing compiled that could break on macOS or on an Intel CPU. |
| GPU (Intel HD 5000 / Iris, shared VRAM) | Every texture is 64×64 and about 40 KB in total. Clothing reuses the game's own art, recoloured. |
| TPS (game speed) | Nothing ticks in the background. Only projectiles in flight do any work. |
| Dependencies | **No DLC and no other mods.** Core RimWorld only. |
| Versions | RimWorld **1.4, 1.5 and 1.6**. Early-2014 Macs can update to macOS 11 Big Sur, which is new enough for these versions. |

## What it adds

**Traits:** *Firebender*, *Waterbender*, *Earthbender*, *Airbender* and the rare *the Avatar*. They can turn up on any colonist, and each comes with matching stat bonuses: earthbenders mine fast, airbenders run fast and dodge, and so on.

**Research:** a new **Four Nations** tab:
1. *Bending basics* (Neolithic) unlocks the four elemental forms and the nation clothing.
2. *Advanced bending* unlocks Lightning Generation and Spirit Oasis water.
3. *Avatar State* unlocks the Avatar State.

**Bending forms.** Make these at a crafting spot or smithy, then **equip** one on a colonist like a weapon:

| Form | Style | Cost |
|---|---|---|
| Firebending forms | 3-shot burst of fire blasts that set targets alight | 30 wood, 15 cloth |
| Waterbending forms | 2-hit water whip that staggers | 20 wood, 20 cloth |
| Earthbending forms | slow, heavy thrown boulder with big stagger | 40 granite blocks, 10 cloth |
| Air Nomad glider staff | fast, long-range air gusts, plus a melee staff | 50 wood, 25 cloth |
| Lightning generation | single long-range bolt, armor-piercing, starts no fires | 60 silver, 20 cloth |
| Avatar State | slow, explosive four-element blast. Keep friendlies clear! | 40 jade, 15 gold |

**Nation clothing** (tailoring bench): Air Nomad robes (+move speed), Water Tribe parka (very warm), Fire Nation uniform (fire resistant) and Earth Kingdom garb (+mining).

**Spirit Oasis water** (crafting spot or drug lab, made from 1 herbal medicine): for about half a day it reduces pain by 40%, halves bleeding and boosts immunity.

## Installing on a Mac

1. Download this `ATLA_FourNations` folder, or `ATLA_FourNations.zip` and unzip it.
2. Open your RimWorld Mods folder. On a Mac it is **inside the app**:
   - Steam: in Finder, press **⇧⌘G** and go to
     `~/Library/Application Support/Steam/steamapps/common/RimWorld/`.
     Right-click **RimWorldMac.app**, choose **Show Package Contents**, then open **Mods**.
   - DRM-free/GOG: right-click the RimWorld app → **Show Package Contents** → **Mods**.
3. Copy the `ATLA_FourNations` folder into `Mods`.
4. Start RimWorld → **Mods** → enable **Avatar: The Last Airbender - Four Nations** → restart when asked.

The mod can be added to an existing save at any time. To remove it, unequip and destroy its items first.

### Performance tips for a 2014 Mac
- Options → Graphics: lower the resolution or use windowed mode, and turn off *Plant sway*.
- Use a **small or medium map** and a population of around 8 colonists.
- Keep the mod list short. This mod costs almost nothing, but large content mods add up quickly.

## Making a team Avatar start
Use **Create custom scenario** (from *Crashlanded*) and add **Forced trait** parts:
*the Avatar*, *Waterbender*, *Earthbender* and *Firebender*. Add **Start with** parts for
the matching bending forms.

## Troubleshooting
If the debug log (top-left red box) says a texture or sound "could not be found", a vanilla
asset was renamed in your game version. The mod still works. Please report the message.

## Rebuilding textures
`python rimworld/tools/make_textures.py` (needs Pillow) redraws every texture and `About/Preview.png`.

Avatar: The Last Airbender is © Nickelodeon/Paramount. This is a free, non-commercial fan mod.
