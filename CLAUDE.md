# enhancedcombathud-black-flag — Foundry VTT Development Notes

## Purpose
- Adds Black Flag Roleplaying / Tales of the Valiant support to Argon Combat HUD (`enhancedcombathud`).
- Provides system-specific HUD panels for PCs and NPCs: portrait stats, weapon/item buttons, spell accordion, class features, special actions, reactions, drawer skills/saves/tools, and actor configuration.
- Ported from the Argon / D&D 5E integration and adapted to Black Flag's item, activity, spell, and actor data models.

## Runtime Targets
- Current `module.json` target: Foundry v13 minimum / v14 verified, Black Flag v2 minimum / v3 verified.
- Current compatibility work: Foundry v14 + Black Flag v3 runtime testing on the local development server; v13 + Black Flag v2 remains supported by the source compatibility paths.
- Local project: `/home/jon/projects/enhancedcombathud-black-flag`.
- v13 module symlink: `/home/jon/foundryuserdata/Data/modules/enhancedcombathud-black-flag -> /home/jon/projects/enhancedcombathud-black-flag`.
- v14 module symlink: `/home/jon/foundryuserdata14/Data/modules/enhancedcombathud-black-flag -> /home/jon/projects/enhancedcombathud-black-flag`.
- Required dependency module: `enhancedcombathud` version 3.0.4+; v14 testing uses Argon / enhancedcombathud 5.0.1.
- Use the locally configured Foundry v13/v14 development server/session from the active environment. Do not commit private Foundry hostnames, URLs, credentials, or world-specific data.

## Build / Packaging
- Source entry: `scripts/main.js`.
- Main implementation: `scripts/echBlackFlag.js`.
- Settings: `scripts/settings.js`.
- Styles entry: `scss/module.scss`.
- Compiled runtime files loaded by Foundry:
  - `index.js`
  - `index.js.map`
  - `styles/module.css`
  - `module.json`
  - `languages/en.json`
- Build command: `npm run build`.
- Static checks:
  - `node --check scripts/main.js`
  - `node --check scripts/settings.js`
  - `node --check scripts/echBlackFlag.js`
  - `python3 -m json.tool module.json >/dev/null`
- Release packaging must keep `module.json` at the zip root for Foundry installer compatibility. `module.zip` is a generated release asset and should not be committed.

## Current Architecture
- `Hooks.on("setup")` in `scripts/main.js` registers settings and calls `initConfig()`.
- `initConfig()` waits for `argonInit`, exits unless `game.system.id === "black-flag"`, then registers Black Flag-specific HUD classes into Argon.
- `CoreHUD.BlackFlag` stores shared Black Flag integration state:
  - `actionTypes`
  - `itemTypes`
  - `mainBarFeatures`
  - `ECHItems`
- Important classes in `scripts/echBlackFlag.js`:
  - `DND5ePortraitPanel` — portrait, HP, AC, spell DC, PC/NPC description.
  - `DND5eDrawerPanel` / `DND5eDrawerButton` — abilities, saves, skills, tools.
  - `DND5eActionActionPanel`, `DND5eBonusActionPanel`, `DND5eReactionActionPanel`, `DND5eFreeActionPanel` — main action economy panels.
  - `DND5eButtonPanelButton` — grouped panels, including spell accordion construction.
  - `DND5eItemButton` — item/activity button display, tooltip, and activation.
  - `DND5eSpecialActionButton` — built-in actions such as Disengage, Dodge, Ready, Dash, Hide, Shove.
- Activity expansion is controlled by the module setting `explodeItemActivities` (`only-weapons`, `always`, `never`).

## Black Flag Data Model Rules
- Black Flag actors use `pc` and `npc` actor types.
- Black Flag item types used here include:
  - `spell`
  - `weapon`
  - `feature`
  - `talent`
  - `consumable`
  - `gear`
  - `sundry`
  - `container`
  - `tool`
- Items commonly expose activities through `item.system.activities`, which is iterable. Activity activation is read from `activity.activation.type`.
- `checkActivationType(itemOrActivity, activationTypes)` should support both direct activities and parent items with `system.activities`.
- Do not assume the first activity is the only meaningful activity unless live data proves it; multi-activity items are common in Black Flag.
- Spell circle data is read from `item.system.circle.base`, where `0` is a cantrip and higher numbers are leveled spell circles.
- Black Flag spell slot data is read from `actor.system.spellcasting.slots`, with leveled slots keyed as `circle-<level>` and pact slots keyed as `pact`.
- Spell relationship mode may be stored in `item.getFlag("black-flag", "relationship.mode")`, but live Black Flag v2 data may omit this flag on ordinary prepared spells. Do not require the flag to be exactly `"spell"` for ordinary leveled spells unless live inspection proves it is always present.
- Spell preparation state is currently checked with `item.system.prepared > 0`; verify live data before changing this because Black Flag versions may represent preparation differently.

## Spell HUD Pitfalls
- Cantrips can appear even when leveled spells do not because cantrips are grouped by `item.system.circle.base == 0` without requiring `relationship.mode === "spell"`.
- Leveled ordinary spells can disappear if filtering requires `item.getFlag("black-flag", "relationship.mode") === "spell"` and the flag is missing or undefined.
- At-will, innate, and pact spells are special modes and should keep their dedicated groups.
- When fixing spell display bugs, inspect real actor items in Foundry v13 / BF v2 before coding. Confirm at minimum: spell name, circle, preparation value, relationship mode, activities, activation type, and resulting HUD grouping.

## Reference Workflow
- Load/read this file before editing.
- Follow the global Foundry rule: reference before intuition. Inspect live Black Flag actor/item data before changing data-model logic.
- Prefer focused compatibility fixes over broad refactors.
- After changing source, run `npm run build` so `index.js`, `index.js.map`, and `styles/module.css` reflect the source.
- Verify with live Foundry v13 / Black Flag v2 and/or Foundry v14 / Black Flag v3 when the change affects runtime behavior.
- Commit and push every meaningful change using git identity `hermes90201`.

## Known Pitfalls
- This project has generated build artifacts (`index.js`, `index.js.map`, `styles/module.css`) committed as runtime files. Source changes are incomplete until the build output is regenerated and committed.
- `module.zip` is generated for GitHub release assets only; do not commit it.
- The code still uses DND5e-prefixed class names because it was ported from the Argon D&D 5E plugin. Do not rename broadly unless doing a deliberate refactor.
- Do not commit private Foundry hostnames, URLs, credentials, local world data, or full copyrighted RPG source prose.
