# Argon Combat HUD — Black Flag / Tales of the Valiant

> **⚠️ Disclaimer:** This module was created by an AI coding agent (Hephaestus, via Hermes Agent) under the direction of Jon Michaels. While tested and functional, users should verify behavior in their own games before relying on it in critical sessions.

[![Foundry VTT](https://img.shields.io/badge/Foundry-v13--v14-orange)](https://foundryvtt.com)
[![Black Flag](https://img.shields.io/badge/System-Black%20Flag%20%2F%20ToV-blue)](https://github.com/koboldpress/black-flag)
[![Version](https://img.shields.io/badge/Version-v1.1-green)](https://github.com/jonmichaels/enhancedcombathud-black-flag/releases)

System-specific plugin that adds Black Flag Roleplaying (Tales of the Valiant) support to the [Argon Combat HUD](https://github.com/theripper93/enhancedcombathud). Provides an action-oriented HUD overlay for both PCs and NPCs during combat.

## Features

- **PC HUD** — Portrait, HP/AC, spell save DC, long/short rest, weapon attacks, class features, bonus actions, and reactions
- **NPC HUD** — Portrait with challenge rating and creature type, HP/AC, attacks, legendary/lair actions, and special actions (Disengage, Dodge, Ready, Dash, Hide, Shove)
- **Drawer Panel** — Abilities with checks and saves, skills with passives, and tool proficiencies
- **Spell Support** — Spellcasting with circle filtering, preparation mode awareness, and spell slot tracking
- **Weapon Sets** — Toggleable weapon quick-access with primary/secondary hand support
- **Configurable** — Per-actor spell preparation mode, show/hide weapons, class actions, and special actions via module settings

## Installation

**In Foundry VTT:**

1. Go to **Add-on Modules** → **Install Module**
2. Paste the manifest URL: `https://github.com/jonmichaels/enhancedcombathud-black-flag/releases/latest/download/module.json`
3. Click **Install**

**Manual:**

Download the latest release zip and extract to `Data/modules/enhancedcombathud-black-flag/`.

## Requirements

- **Foundry VTT** v13–v14
- **Argon - Combat HUD (CORE)** (`enhancedcombathud`) v3.0.4+; use the Argon major compatible with your Foundry/Black Flag stack (Argon 4 for Foundry v13 / BF v2, Argon 5 verified on Foundry v14 / BF v3)
- **Black Flag Roleplaying** (Tales of the Valiant) system v2.0+ (v3.0.075 verified on Foundry v14)

## How It Works

1. **Enable the module** — After installing both Argon CORE and this plugin, enable both in your world's Module Management.
2. **Select a token** — Click any actor token on the canvas.
3. **Click the Argon icon** — The HUD appears as an overlay. Buttons are organized by action economy (action, bonus action, reaction, free action).
4. **Configure** — Click the gear icon on the portrait for per-actor spell preparation settings. Module-wide settings (weapons visibility, class actions, special actions) are in Foundry's Configure Settings → Module Settings.

NPCs display attacks and features automatically. PCs can drag weapons into quick-access slots via weapon sets configuration.

## Module Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Show Items in Weapons Category | On | Display weapon items in the HUD action panels |
| Show Class Actions | On | Display class feature items |
| Condense Class Actions | Off | Group class actions into split buttons |
| Explode Item Activities | Only Weapons | How to expand multi-activity items |
| Show Macro Panel | Off | Show a macro quick-launch panel |
| Switch Equipment | Off | Show an equipment switch button |
| Show Special Actions | On | Show Disengage, Dodge, Ready, Dash, Hide, Shove |
| Per-actor Spell Prep | Prepared Only | Which spells to show (Prepared Only / Auto / All) |


## Release Notes

### v1.1

- Adds Foundry VTT v14 and Black Flag Roleplaying v3 compatibility.
- Fixes Black Flag v3 spell grouping so spells of 1st circle and above appear in the Argon HUD instead of only cantrips.

## Credits

This module is a Black Flag / Tales of the Valiant port of the Argon Combat HUD D&D 5E plugin.

- **Argon CORE & D&D 5E plugin:** [theripper93](https://www.patreon.com/theripper93) — original creator
- **Black Flag port:** Jon Michaels, coded by Hephaestus (AI agent via Hermes Agent)

## License

MIT
