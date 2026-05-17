import { MODULE_ID } from "./main.js";
import { setExplodeItemActivities } from "./echBlackFlag.js";

export function registerSettings() {
    const settings = {
        showWeaponsItems: {
            name: game.i18n.localize("enhancedcombathud-black-flag.settings.showWeaponsItems.name"),
            hint: game.i18n.localize("enhancedcombathud-black-flag.settings.showWeaponsItems.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: (sett) => {
                ui.ARGON.constructor.BlackFlag.itemTypes.consumable = ui.ARGON.constructor.BlackFlag.itemTypes.consumable.filter(i => i !== "weapon");
                if(sett) ui.ARGON.constructor.BlackFlag.itemTypes.consumable.push("weapon");
                ui.ARGON.refresh()
            },
        },
        showClassActions: {
            name: game.i18n.localize("enhancedcombathud-black-flag.settings.showClassActions.name"),
            hint: game.i18n.localize("enhancedcombathud-black-flag.settings.showClassActions.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: (sett) => {
                ui.ARGON.constructor.BlackFlag.mainBarFeatures = ui.ARGON.constructor.BlackFlag.mainBarFeatures.filter(i => i !== "class");
                if(sett) ui.ARGON.constructor.BlackFlag.mainBarFeatures.push("class");
                ui.ARGON.refresh()
            },
        },
        condenseClassActions: {
            name: game.i18n.localize("enhancedcombathud-black-flag.settings.condenseClassActions.name"),
            hint: game.i18n.localize("enhancedcombathud-black-flag.settings.condenseClassActions.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON.refresh(),
        },
        explodeItemActivities: {
            name: game.i18n.localize("enhancedcombathud-black-flag.settings.explodeItemActivities.name"),
            hint: game.i18n.localize("enhancedcombathud-black-flag.settings.explodeItemActivities.hint"),
            scope: "world",
            config: true,
            type: String,
            default: "only-weapons",
            choices: {
                "only-weapons": "enhancedcombathud-black-flag.settings.explodeItemActivities.only-weapons",
                "always": "enhancedcombathud-black-flag.settings.explodeItemActivities.always",
                "never": "enhancedcombathud-black-flag.settings.explodeItemActivities.never",
            },
            onChange: () => {
                setExplodeItemActivities();
                ui.ARGON.refresh();
            },
        },
        macroPanel: {
            name: game.i18n.localize("enhancedcombathud-black-flag.settings.macroPanel.name"),
            hint: game.i18n.localize("enhancedcombathud-black-flag.settings.macroPanel.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: true,
            onChange: () => ui.ARGON.refresh(),
        },
        switchEquip: {
            name: game.i18n.localize("enhancedcombathud-black-flag.settings.switchEquip.name"),
            hint: game.i18n.localize("enhancedcombathud-black-flag.settings.switchEquip.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON.refresh(),
        },
        showSpecialActions: {
            name: game.i18n.localize("enhancedcombathud-black-flag.settings.showSpecialActions.name"),
            hint: game.i18n.localize("enhancedcombathud-black-flag.settings.showSpecialActions.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.ARGON.refresh(),
        },
    };

    registerSettingsArray(settings);
}

export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
    return await game.settings.set(MODULE_ID, key, value);
}

function registerSettingsArray(settings) {
    for(const [key, value] of Object.entries(settings)) {
        game.settings.register(MODULE_ID, key, value);
    }
}
