import { MODULE_ID } from "./main.js";
import { getSetting } from "./settings.js";

const ECHItems = {};

const fallbackLabel = (...values) => values.find((value) => value !== undefined && value !== null && value !== "") ?? "-";

export function getSpellCircleSchoolSubtitle(item) {
    const blackFlagConfig = globalThis.CONFIG?.BlackFlag;
    const circle = item?.system?.circle?.base ?? item?.system?.circle?.value;
    const circleLabels = blackFlagConfig?.spellCircles?.({ dashed: true }) ?? blackFlagConfig?.spellCircles?.() ?? {};
    const circleLabel = fallbackLabel(circleLabels[circle], item?.labels?.level);
    const schoolLabel = fallbackLabel(blackFlagConfig?.spellSchools?.localized?.[item?.system?.school], item?.labels?.school);
    return [circleLabel, schoolLabel].filter((part) => part && part !== "-").join(" ") || "-";
}

export function getSpellTargetLabel(item) {
    return fallbackLabel(
        item?.system?.target?.label,
        item?.system?.target?.affects?.labels?.sheet,
        item?.system?.target?.template?.label,
        item?.labels?.target
    );
}

export function getSpellRangeLabel(item) {
    const rangeLabel = fallbackLabel(item?.system?.range?.label, item?.labels?.range);
    const templateLabel = item?.system?.target?.template?.label;
    if (item?.system?.range?.unit === "self" && templateLabel && !String(rangeLabel).includes(String(templateLabel))) {
        return `${rangeLabel} (${templateLabel})`;
    }
    return rangeLabel;
}

const formatSigned = (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "number") return value >= 0 ? `+${value}` : `${value}`;
    const text = String(value);
    return /^-/.test(text) || /^\+/.test(text) ? text : `+${text}`;
};

export function getTooltipToHitLabel(item) {
    return fallbackLabel(
        item?.labels?.toHit,
        item?.toHit,
        formatSigned(item?.system?.toHit),
        formatSigned(item?.system?.attack?.bonus)
    );
}

export function getTooltipDamageParts(item) {
    if (item?.labels?.damages?.length) return item.labels.damages;

    const parts = [];
    const base = item?.item?.system?.damage?.base ?? item?.system?.damage?.base;
    const includeBase = item?.system?.damage?.includeBase;
    if (includeBase && base?.formula) parts.push(base);

    for (const part of item?.system?.damage?.parts ?? []) {
        if (part?.formula) parts.push(part);
    }

    return parts.map((part) => ({
        formula: part.formula,
        damageType: part.damageType ?? part.type ?? part.types?.[0]
    }));
}

let explodeItemActivities;
export function setExplodeItemActivities() {
    explodeItemActivities = getSetting("explodeItemActivities");
}

export function initConfig() {
    console.log("[Argon-BF] initConfig started");

    Hooks.on("updateItem", (item) => {
        if(item.parent === ui.ARGON._actor && ui.ARGON.rendered) ui.ARGON.components.portrait.refresh()
    })

    Hooks.on("argonInit", (CoreHUD) => {
        console.log("[Argon-BF] argonInit handler started");
        if (game.system.id !== "black-flag") return console.log("[Argon-BF] Wrong system, exiting. System is:", game.system.id);
        registerItems();
        setExplodeItemActivities();
        const ARGON = CoreHUD.ARGON;

        class DND5eTooltip extends ARGON.CORE.Tooltip {
            get classes() {
                const original = super.classes;
                return original.concat(["blackflag"]);
            }
        }

        const isMIDI = game.modules.get("midi-qol")?.active;
        const getMidiFlag = (actionType) => {
            if (!isMIDI || !ui.ARGON._actor) return null;
            const flag = ui.ARGON._actor.getFlag("midi-qol", "actions") ?? {};
            const value = flag[actionType] ?? false;
            const midiAction = value ? 0 : 1;
            return midiAction;
        };

        function expandItemIntoActivities(item) {
            if(explodeItemActivities === "never") return false;
            if(explodeItemActivities === "always") return true;
            if(explodeItemActivities === "only-weapons") return item.type === "weapon";
        }

        function expandActivities(itemList, activationType) {
            const items = [];
            const activities = []
            for(const item of itemList) {
                if(expandItemIntoActivities(item)) {
                    activities.push(Array.from(item.system.activities).filter(activity => checkActivationType(activity, activationType) && activity.type !== "cast"));
                } else {
                    items.push(item);
                }
            }
            const allElements = [...items, ...(activities.flat())];
            const weapons = allElements.filter(item => (item.item ?? item).type === "weapon");
            const nonWeapons = allElements.filter(item => (item.item ?? item).type !== "weapon");
            return [...weapons, ...nonWeapons];
        }

        const checkActivationType = (itemOrActivity, activationTypes) => {
            if (itemOrActivity.activation?.type) return activationTypes.includes(itemOrActivity.activation.type);
            if (!itemOrActivity?.system?.activities) {
                return;
            }
            for (const activity of Array.from(itemOrActivity.system.activities)) {
                if(activationTypes.includes(activity.activation?.type)) return true;
            }
        }

        const getActivationType = (item) => {
            const activities = Array.from(item?.system?.activities ?? []);
            const primaryActivity = activities.find((activity) => activity.activation?.primary) ?? activities[0];
            return primaryActivity?.activation?.type ?? item?.system?.casting?.type;
        };

        const getActionType = (item) => {
            if (!item?.system?.activities?.size) {
                return;
            }
            return Array.from(item.system.activities)[0]?.actionType;
        };

        const actionTypes = {
            action: ["action"],
            bonus: ["bonus"],
            reaction: ["reaction", "reactiondamage", "reactionmanual"],
            free: ["special"],
        };

        const itemTypes = {
            spell: ["spell"],
            feature: ["feature", "talent"],
            consumable: ["consumable", "gear", "sundry", "container", "tool"],
        };

        const mainBarFeatures = [];

        if (game.settings.get(MODULE_ID, "showWeaponsItems")) itemTypes.consumable.unshift("weapon");
        if (game.settings.get(MODULE_ID, "showClassActions")) mainBarFeatures.push("class");

        CoreHUD.BlackFlag = {
            actionTypes,
            itemTypes,
            mainBarFeatures,
            ECHItems,
        };

        Hooks.callAll("enhanced-combat-hud.blackflag.initConfig", { actionTypes, itemTypes, ECHItems });

        async function getTooltipDetails(item, type) {
            let title, description, itemType, subtitle, target, range, dt;
            let damageTypes = [];
            let properties = [];
            let materialComponents = "";

            if (type == "skill") {
                title = CONFIG.BlackFlag.skills.localized[item];
                const key = `enhancedcombathud-black-flag.skills.${item}.tooltip`;
                description = game.i18n.has(key) ? game.i18n.localize(key) : "";
            } else if (type == "save") {
                title = CONFIG.BlackFlag.abilities.localized[item];
                const key = `enhancedcombathud-black-flag.abilities.${item}.tooltip`;
                description = game.i18n.has(key) ? game.i18n.localize(key) : "";
            } else {
                if (!item || !item.system) return;

                title = item.name;
                description = item.system.identified ? item.system.description.value : item.system.description.unidentified ?? item.system.description.value;
                itemType = item.type;
                target = item.type === "spell" ? getSpellTargetLabel(item) : (item.labels?.target || "-");
                range = item.type === "spell" ? getSpellRangeLabel(item) : (item.labels?.range || "-");
                properties = [];
                let property;
                dt = getTooltipDamageParts(item).map(d => d.damageType);
                damageTypes = dt && dt.length ? dt : [];
                materialComponents = "";

                switch (itemType) {
                    case "weapon":
                        subtitle = CONFIG.BlackFlag.weaponTypes.localized[item.system.type?.value];
                        property = game.i18n.localize(`BF.ACTIVITY.Type.${getActionType(item)}`);
                        if (property) properties.push(property);
                        for (const propName of item.system.properties) {
                            let prop = CONFIG.BlackFlag.weaponProperties.includes(propName) ? game.i18n.localize(`BF.WEAPON.Property.${propName}`) : undefined;
                            if (prop) properties.push(prop);
                        }
                        break;
                    case "spell":
                        subtitle = getSpellCircleSchoolSubtitle(item);
                        properties.push(CONFIG.BlackFlag.spellSchools.localized[item.system.school]);
                        if (item.labels?.duration) properties.push(item.labels.duration);
                        if (item.labels?.save) properties.push(item.labels.save);
                        for (let comp of (item.labels?.components?.all ?? [])) {
                            properties.push(comp.abbr);
                        }
                        if (item.labels?.materials) materialComponents = item.labels.materials;
                        break;
                    case "consumable":
                        subtitle = CONFIG.BlackFlag.consumableCategories.localized[item.system.type?.base];
                        {
                            const actionType = getActionType(item);
                            if (actionType) {
                                const key = `BF.ACTIVITY.Type.${actionType}`;
                                property = game.i18n.has(key) ? game.i18n.localize(key) : actionType;
                            }
                        }
                        if (property) properties.push(property);
                        break;
                    case "feature":
                        subtitle = null;
                        {
                            const actionType = getActionType(item);
                            if (actionType) {
                                const key = `BF.ACTIVITY.Type.${actionType}`;
                                property = game.i18n.has(key) ? game.i18n.localize(key) : actionType;
                            }
                        }
                        if (property) properties.push(property);
                        break;
                }
            }

            if (description) description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(description, { async: true, relativeTo: item });
            let details = [];
            if (target || range) {
                details = [
                    {
                        label: "enhancedcombathud-black-flag.tooltip.target.name",
                        value: target,
                    },
                    {
                        label: "enhancedcombathud-black-flag.tooltip.range.name",
                        value: range,
                    },
                ];
            }
            const toHit = getTooltipToHitLabel(item);
            if (toHit !== "-") {
                details.push({
                    label: "enhancedcombathud-black-flag.tooltip.toHit.name",
                    value: toHit,
                });
            }
            const damages = getTooltipDamageParts(item);
            if (damages.length) {
                let dmgString = "";
                damages.forEach((dDmg) => {
                    dmgString += dDmg.formula + " " + getDamageTypeIcon(dDmg.damageType) + " ";
                });
                details.push({
                    label: "enhancedcombathud-black-flag.tooltip.damage.name",
                    value: dmgString,
                });
            }

            const tooltipProperties = [];
            if (damageTypes?.length) damageTypes.forEach((d) => tooltipProperties.push({ label: d, primary: true }));
            if (properties?.length) properties.forEach((p) => tooltipProperties.push({ label: p?.label ?? p, secondary: true }));
            return { title, description, subtitle, details, properties: tooltipProperties, footerText: materialComponents };
        }

        function getDamageTypeIcon(damageType) {
            damageType ??= "";
            switch (damageType.toLowerCase()) {
                case "acid":
                    return '<i class="fas fa-flask"></i>';
                case "bludgeoning":
                    return '<i class="fas fa-hammer"></i>';
                case "cold":
                    return '<i class="fas fa-snowflake"></i>';
                case "fire":
                    return '<i class="fas fa-fire"></i>';
                case "force":
                    return '<i class="fas fa-hand-sparkles"></i>';
                case "lightning":
                    return '<i class="fas fa-bolt"></i>';
                case "necrotic":
                    return '<i class="fas fa-skull"></i>';
                case "piercing":
                    return '<i class="fas fa-crosshairs"></i>';
                case "poison":
                    return '<i class="fas fa-skull-crossbones"></i>';
                case "psychic":
                    return '<i class="fas fa-brain"></i>';
                case "radiant":
                    return '<i class="fas fa-sun"></i>';
                case "slashing":
                    return '<i class="fas fa-cut"></i>';
                case "thunder":
                    return '<i class="fas fa-bell"></i>';
                case "healing":
                    return '<i class="fas fa-heart"></i>';
                default:
                    return '<i class="fas fa-sparkles"></i>';
            }
        }

        function getProficiencyIcon(proficiency) {
            if (proficiency == 0) return '<i style="margin-right: 1ch; pointer-events: none" class="far fa-circle"> </i>';
            else if (proficiency == 1) return '<i style="margin-right: 1ch; pointer-events: none" class="fas fa-check"> </i>';
            else if (proficiency == 2) return '<i style="margin-right: 1ch; pointer-events: none" class="fas fa-check-double"> </i>';
            else if (proficiency == 0.5) return '<i style="margin-right: 1ch; pointer-events: none" class="fas fa-adjust"> </i>';
            else return '<i style="margin-right: 1ch; pointer-events: none" class="far fa-circle"> </i>';
        }

        function condenseItemButtons(items) {
            const condenseClassActions = game.settings.get(MODULE_ID, "condenseClassActions");
            if (!condenseClassActions) return items.map((item) => new DND5eItemButton({ item, inActionPanel: true }));
            const condensedItems = [];
            const barItemsLength = items.length;
            const barItemsMultipleOfTwo = barItemsLength - (barItemsLength % 2);
            let currentSplitButtonItemButton = null;
            for (let i = 0; i < barItemsLength; i++) {
                const isCondensedButton = i < barItemsMultipleOfTwo;
                const item = items[i];
                if (isCondensedButton) {
                    if (currentSplitButtonItemButton) {
                        const button = new DND5eItemButton({ item, inActionPanel: false });
                        condensedItems.push(new ARGON.MAIN.BUTTONS.SplitButton(currentSplitButtonItemButton, button));
                        currentSplitButtonItemButton = null;
                    } else {
                        currentSplitButtonItemButton = new DND5eItemButton({ item, inActionPanel: false });
                    }
                } else {
                    condensedItems.push(new DND5eItemButton({ item, inActionPanel: true }));
                }
            }
            return condensedItems;
        }

        class DND5ePortraitPanel extends ARGON.PORTRAIT.PortraitPanel {
            constructor(...args) {
                console.log("[Argon-BF] Portrait constructor, actor type:", args[0]?.actor?.type || "unknown");
                super(...args);
            }

            get description() {
                const { type, system } = this.actor;
                const actor = this.actor;
                const isNPC = type === "npc";
                const isPC = type === "pc";
                if (isNPC) {
                    const traitsType = actor.system.traits?.type;
                    const typeValue = traitsType?.value;
                    const typeLabel = (typeValue && CONFIG.BlackFlag.creatureTypes?.[typeValue]?.label) || traitsType?.custom || typeValue || "Creature";
                    const creatureType = typeof typeLabel === "string" ? typeLabel : "Creature";
                    const cr = system.attributes.cr >= 1 || system.attributes.cr <= 0 ? system.attributes.cr : `1/${1 / system.attributes.cr}`;
                    return `CR ${cr} ${creatureType}`;
                } else if (isPC) {
                    const classes = Object.values(actor.system.progression?.classes ?? {})
                        .map((c) => c.document?.name ?? c.name ?? "")
                        .join(" / ");
                    return `Level ${system.progression?.levels?.length ?? 0} ${classes} (${this.actor.items.find(i => i.type === "lineage")?.name || this.actor.items.find(i => i.type === "heritage")?.name})`;
                } else {
                    return "";
                }
            }

            get isDead() {
                return this.isDying && this.actor.type !== "pc";
            }

            get isDying() {
                return this.actor.system.attributes.hp.value <= 0;
            }

            get successes() {
                return this.actor.system.attributes?.death?.success ?? 0;
            }

            get failures() {
                return this.actor.system.attributes?.death?.failure ?? 0;
            }

            get configurationTemplate() {
                return "modules/enhancedcombathud-black-flag/templates/argon-actor-config.hbs";
            }

            async _onDeathSave(event) {
                this.actor.rollDeathSave({});
            }

            async getStatBlocks() { console.log("[BF] Portrait.getStatBlocks");
                const HPText = "Hit Points"
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase())
                    .join("");
                const ACText = "Armor Class"
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase())
                    .join("");
                const SpellDC = `Spell Save DC`;

                const hpColor = this.actor.system.attributes.hp.temp ? "#6698f3" : "rgb(0 255 170)";
                const tempMax = this.actor.system.attributes.hp.tempmax;
                const hpMaxColor = tempMax ? (tempMax > 0 ? "rgb(222 91 255)" : "#ffb000") : "rgb(255 255 255)";

                return [
                    [
                        {
                            text: `${this.actor.system.attributes.hp.value + (this.actor.system.attributes.hp.temp ?? 0)}`,
                            color: hpColor,
                        },
                        {
                            text: `/`,
                        },
                        {
                            text: `${this.actor.system.attributes.hp.max + (this.actor.system.attributes.hp.tempmax ?? 0)}`,
                            color: hpMaxColor,
                        },
                        {
                            text: HPText,
                        },
                    ],
                    [
                        {
                            text: ACText,
                        },
                        {
                            text: this.actor.system.attributes.ac.value,
                            color: "var(--ech-movement-baseMovement-background)",
                        },
                    ],
                    [
                        {
                            text: SpellDC,
                        },
                        {
                            text: this.actor.system.spellcasting.dc,
                            color: "var(--ech-movement-baseMovement-background)",
                        },
                    ],
                ];
            }
        }

        class DND5eDrawerButton extends ARGON.DRAWER.DrawerButton {
            constructor(buttons, item, type) {
                super(buttons);
                this.item = item;
                this.type = type;
            }

            get hasTooltip() {
                return true;
            }

            async getTooltipData() {
                const tooltipData = await getTooltipDetails(this.item, this.type);
                return tooltipData;
            }
        }

        class DND5eDrawerPanel extends ARGON.DRAWER.DrawerPanel {
            constructor(...args) {
                super(...args);
            }

            get categories() {
                const abilities = this.actor.system.abilities;
                const skills = this.actor.system.proficiencies?.skills ?? {};
                const tools = this.actor.system.proficiencies?.tools ?? {};

                const addSign = (value) => {
                    if (value >= 0) return `+${value}`;
                    return value;
                };

                const abilitiesButtons = Object.keys(abilities).map((ability) => {
                    const abilityData = abilities[ability];
                    return new DND5eDrawerButton(
                        [
                            {
                                label: CONFIG.BlackFlag.abilities.localized[ability],
                                onClick: (event) => this.actor.rollAbilityCheck({ ability, event }),
                            },
                            {
                                label: addSign(abilityData.mod + (abilityData.checkBonus || 0)),
                                onClick: (event) => this.actor.rollAbilityCheck({ ability, event }),
                            },
                            {
                                label: addSign(abilityData.mod + (abilityData.save?.proficiency?.flat ?? 0)),
                                onClick: (event) => this.actor.rollSavingThrow({ ability, event }),
                            },
                        ],
                        ability,
                        "save",
                    );
                });

                const skillsButtons = Object.keys(skills).map((skill) => {
                    const skillData = skills[skill];
                    return new DND5eDrawerButton(
                        [
                            {
                                label: getProficiencyIcon(skillData.proficiency.multiplier) + CONFIG.BlackFlag.skills.localized[skill],
                                onClick: (event) => this.actor.rollSkill({ skill, event }),
                            },
                            {
                                label: `${addSign(skillData.mod)}<span style="margin: 0 1rem; filter: brightness(0.8)">(${skillData.passive ?? 0})</span>`,
                                style: "display: flex; justify-content: flex-end;",
                            },
                        ],
                        skill,
                        "skill",
                    );
                });

                function getToolLabel(key) {
                    // Black Flag uses tools/toolTypes configs — check safely
                    const toolCfg = CONFIG.BlackFlag.tools;
                    if (toolCfg && key in toolCfg) {
                        const item = toolCfg[key];
                        if (typeof item == "string") {
                            const name = fromUuidSync(item)?.name;
                            if (name) return name;
                            return item;
                        }
                        const name = fromUuidSync(item?.id)?.name;
                        if (name) return name;
                        return item?.label ? game.i18n.localize(item.label) : key;
                    }
                    // Check toolTypes if available
                    const toolTypes = CONFIG.BlackFlag.toolTypes;
                    if (toolTypes && key in toolTypes) {
                        return game.i18n.localize(toolTypes[key]?.label ?? key);
                    }
                    return key.charAt(0).toUpperCase() + key.slice(1);
                }

                const toolButtons = Object.entries(tools).map(([key, tool]) => {
                    return new DND5eDrawerButton(
                        [
                            {
                                label: getProficiencyIcon(tool.proficiency.multiplier) + getToolLabel(key, tool),
                                onClick: (event) => this.actor.rollTool({tool: key})
                            },
                            {
                                label: addSign(tool.mod + tool.proficiency.multiplier * this.actor.system.attributes.proficiency),
                            },
                        ],
                        tool,
                    );
                });

                return [
                    {
                        gridCols: "5fr 2fr 2fr",
                        captions: [
                            {
                                label: "Abilities",
                                align: "left",
                            },
                            {
                                label: "Check",
                                align: "center",
                            },
                            {
                                label: "Save",
                                align: "center",
                            },
                        ],
                        align: ["left", "center", "center"],
                        buttons: abilitiesButtons,
                    },
                    {
                        gridCols: "7fr 2fr",
                        captions: [
                            {
                                label: "Skills",
                            },
                            {
                                label: "",
                            },
                        ],
                        buttons: skillsButtons,
                    },
                    {
                        gridCols: "7fr 2fr",
                        captions: [
                            {
                                label: game.i18n.localize("enhancedcombathud-black-flag.hud.tools.name"),
                            },
                            {
                                label: "",
                            },
                        ],
                        buttons: toolButtons,
                    },
                ];
            }

            get title() {
                return `${game.i18n.localize("enhancedcombathud-black-flag.hud.saves.name")} / ${game.i18n.localize("enhancedcombathud-black-flag.hud.skills.name")} / ${game.i18n.localize("enhancedcombathud-black-flag.hud.tools.name")}`;
            }
        }

        class DND5eActionActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "Action";
            }

            get maxActions() {
                return this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return getMidiFlag("action") ?? (this.isActionUsed ? 0 : 1);
            }

            _onNewRound(combat) {
                this.isActionUsed = false;
                this.updateActionUse();
            }

            async _getButtons() {
                const spellItems = this.actor.items.filter((item) => itemTypes.spell.includes(item.type) && actionTypes.action.includes(getActivationType(item)) && !CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value));
                const featureItems = expandActivities(this.actor.items.filter((item) => itemTypes.feature.includes(item.type) && checkActivationType(item, actionTypes.action) && !CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value)), actionTypes.action);
                const consumableItems = expandActivities(this.actor.items.filter((item) => itemTypes.consumable.includes(item.type) && checkActivationType(item, actionTypes.action) && !CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value)), actionTypes.action);

                const spellButton = !spellItems.length ? [] : [new DND5eButtonPanelButton({ type: "spell", items: spellItems, color: 0 })].filter((button) => button.hasContents);

                const specialActions = Object.values(ECHItems);

                const showSpecialActions = game.settings.get(MODULE_ID, "showSpecialActions");
                const buttons = [];
                if (showSpecialActions) {
                    buttons.push(...[new DND5eItemButton({ item: null, isWeaponSet: true, isPrimary: true }), new ARGON.MAIN.BUTTONS.SplitButton(new DND5eSpecialActionButton(specialActions[0]), new DND5eSpecialActionButton(specialActions[1])), ...spellButton, new DND5eButtonPanelButton({ type: "feature", items: featureItems, color: 0 }), new ARGON.MAIN.BUTTONS.SplitButton(new DND5eSpecialActionButton(specialActions[2]), new DND5eSpecialActionButton(specialActions[3])), new ARGON.MAIN.BUTTONS.SplitButton(new DND5eSpecialActionButton(specialActions[4]), new DND5eSpecialActionButton(specialActions[5])), new DND5eButtonPanelButton({ type: "consumable", items: consumableItems, color: 0 })]);
                } else {
                    buttons.push(...[new DND5eItemButton({ item: null, isWeaponSet: true, isPrimary: true }), ...spellButton, new DND5eButtonPanelButton({ type: "feature", items: featureItems, color: 0 }), new DND5eButtonPanelButton({ type: "consumable", items: consumableItems, color: 0 })]);
                }

                const barItems = this.actor.items.filter((item) => CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value) && checkActivationType(item, actionTypes.action));
                buttons.push(...condenseItemButtons(barItems));

                return buttons.filter((button) => button.hasContents || button.items == undefined || button.items.length);
            }
        }

        class DND5eBonusActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "Bonus Action";
            }

            get maxActions() {
                return this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return getMidiFlag("bonus") ?? (this.isActionUsed ? 0 : 1);
            }

            _onNewRound(combat) {
                this.isActionUsed = false;
                this.updateActionUse();
            }

            async _getButtons() {
                const buttons = [new DND5eItemButton({ item: null, isWeaponSet: true, isPrimary: false })];
                for (const [type, types] of Object.entries(itemTypes)) {
                    const items = this.actor.items.filter((item) => types.includes(item.type) && checkActivationType(item, actionTypes.bonus) && !CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value));
                    if (!items.length) continue;
                    if (type === "spell") {
                        const itemsWithCorrectActionTypeAsMainActivity = items.filter(item => actionTypes.bonus.includes(getActivationType(item)));
                        const button = new DND5eButtonPanelButton({ type, items: itemsWithCorrectActionTypeAsMainActivity, color: 1 });
                        if (button.hasContents) buttons.push(button);
                        continue;
                    }
                    // const activities = items.map(item => Array.from(item.system.activities)).flat().filter(activity => checkActivationType(activity, actionTypes.bonus));
                    const itemsAndActivities = expandActivities(items, actionTypes.bonus);
                    if (!itemsAndActivities.length) continue;
                    const button = new DND5eButtonPanelButton({ type, items: itemsAndActivities, color: 1 });
                    if (button.hasContents) buttons.push(button);
                }

                const barItems = this.actor.items.filter((item) => CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value) && checkActivationType(item, actionTypes.bonus));
                buttons.push(...condenseItemButtons(barItems));

                return buttons;
            }
        }

        class DND5eReactionActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "Reaction";
            }

            get maxActions() {
                return this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return getMidiFlag("reaction") ?? (this.isActionUsed ? 0 : 1);
            }

            _onNewRound(combat) {
                this.isActionUsed = false;
                this.updateActionUse();
            }

            async _getButtons() {
                const buttons = [new DND5eItemButton({ item: null, isWeaponSet: true, isPrimary: true })];
                //buttons.push(new DND5eEquipmentButton({slot: 1}));
                for (const [type, types] of Object.entries(itemTypes)) {
                    const items = this.actor.items.filter((item) => types.includes(item.type) && checkActivationType(item, actionTypes.reaction) && !CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value));
                    if (!items.length) continue;
                    if (type === "spell") {
                        const itemsWithCorrectActionTypeAsMainActivity = items.filter(item => actionTypes.reaction.includes(getActivationType(item)));
                        const button = new DND5eButtonPanelButton({ type, items: itemsWithCorrectActionTypeAsMainActivity, color: 1 });
                        if (button.hasContents) buttons.push(button);
                        continue;
                    }
                    // const activities = items.map(item => Array.from(item.system.activities)).flat().filter(activity => checkActivationType(activity, actionTypes.reaction));
                    const itemsAndActivities = expandActivities(items, actionTypes.reaction);
                    if (!itemsAndActivities.length) continue;
                    const button = new DND5eButtonPanelButton({ type, items: itemsAndActivities, color: 3 });
                    if (button.hasContents) buttons.push(button);
                }

                const barItems = this.actor.items.filter((item) => CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value) && checkActivationType(item, actionTypes.reaction));
                buttons.push(...condenseItemButtons(barItems));

                return buttons;
            }
        }

        class DND5eFreeActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "Free Action";
            }

            get maxActions() {
                return this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return this.isActionUsed ? 0 : 1;
            }

            _onNewRound(combat) {
                this.isActionUsed = false;
                this.updateActionUse();
            }

            async _getButtons() {
                const buttons = [];

                for (const [type, types] of Object.entries(itemTypes)) {
                    const items = this.actor.items.filter((item) => types.includes(item.type) && checkActivationType(item, actionTypes.free) && !CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value));
                    if (!items.length) continue;
                    if (type === "spell") {
                        const itemsWithCorrectActionTypeAsMainActivity = items.filter(item => actionTypes.free.includes(getActivationType(item)));
                        const button = new DND5eButtonPanelButton({ type, items: itemsWithCorrectActionTypeAsMainActivity, color: 1 });
                        if (button.hasContents) buttons.push(button);
                        continue;
                    }
                    // const activities = items.map(item => Array.from(item.system.activities)).flat().filter(activity => checkActivationType(activity, actionTypes.free));
                    const itemsAndActivities = expandActivities(items, actionTypes.free);
                    if (!itemsAndActivities.length) continue;
                    const button = new DND5eButtonPanelButton({ type, items: itemsAndActivities, color: 2 });
                    if (button.hasContents) buttons.push(button);
                }

                const barItems = this.actor.items.filter((item) => CoreHUD.BlackFlag.mainBarFeatures.includes(item.system.type?.value) && checkActivationType(item, actionTypes.free));
                buttons.push(...condenseItemButtons(barItems));

                return buttons;
            }
        }

        class DND5eLegActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "Legendary Action";
            }

            get maxActions() {
                return this.actor?.inCombat ? this.actor.system.attributes?.legendary?.max ?? null : null;
            }

            get currentActions() {
                return this.actor.system.attributes?.legendary?.value ?? null;
            }

            async _getButtons() {
                const buttons = [];
                const legendary = this.actor.items.filter((item) => getActivationType(item) === "legendary");
                legendary.forEach((item) => {
                    buttons.push(new DND5eItemButton({ item, inActionPanel: true }));
                });
                return buttons;
            }
        }

        class DND5eLairActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "Lair Action";
            }

            get maxActions() {
                return this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return this.actor.system.attributes?.lair?.value ?? 0 * 1;
            }

            async _getButtons() {
                const buttons = [];
                const lair = this.actor.items.filter((item) => getActivationType(item) === "lair");
                lair.forEach((item) => {
                    buttons.push(new DND5eItemButton({ item, inActionPanel: true }));
                });
                return buttons;
            }
        }

        class DND5eMythicActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "Legendary Action";
            }

            get maxActions() {
                return null; //this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return null; //this.actor.system.resources.mythic?.value * 1;
            }

            async _getButtons() {
                const buttons = [];
                const mythic = this.actor.items.filter((item) => getActivationType(item) === "mythic");
                mythic.forEach((item) => {
                    buttons.push(new DND5eItemButton({ item, inActionPanel: true }));
                });
                return buttons;
            }
        }

        class DND5eItemButton extends ARGON.MAIN.BUTTONS.ItemButton {
            constructor(...args) {
                super(...args);
            }

            get item() {
                return this._item?.item ?? this._item;
            }

            get isActivity() {
                return !this._item?.system?.activities;
            }

            get activity() {
                if (this.isActivity) return this._item;
                return Array.from(this._item.system.activities)[0];
            }

            get hasTooltip() {
                return true;
            }

            get ranges() {
                const activity = this.activity;
                const touchRange = activity.range.units == "touch" ? canvas?.scene?.grid?.distance : null;
                return {
                    normal: activity?.range?.value ?? touchRange,
                    long: activity?.range?.long ?? null,
                };
            }

            get label() {
                if(!this.isActivity) return super.label;
                return this.activity.name + ` (${this.item.name})`;
            }

            get targets() {
                const activity = this.activity;
                const validTargets = ["creature", "ally", "enemy"];
                const actionType = activity.actionType;
                const affects = activity.target?.affects ?? {};
                const targetType = affects.type;
                if (!activity.target?.template?.units && validTargets.includes(targetType)) {
                    return affects.count ?? 1;
                } else if (validTargets.includes(targetType) && affects.count) {
                    return affects.count;
                } else if (actionType === "mwak" || actionType === "rwak" || actionType === "msak" || actionType === "rsak") {
                    return affects.count || 1;
                }
                return null;
            }

            get visible() {
                if (!this._isWeaponSet) return super.visible;
                const isReaction = this.parent instanceof DND5eReactionActionPanel;
                const isMelee = this.activity?.actionType === "mwak";
                if (isReaction && !isMelee) return false;
                if (this._isPrimary) return super.visible;
                if (this.activity?.type?.value === "shield") return false;
                return super.visible;
            }

            async getTooltipData() {
                const tooltipData = this.isActivity ? await getTooltipDetails({...this.item, ...this.activity, name: this.label}) : await getTooltipDetails(this.item);
                tooltipData.propertiesLabel = "enhancedcombathud-black-flag.tooltip.properties.name";
                return tooltipData;
            }

            async _onLeftClick(event) {
                // ui.ARGON.interceptNextDialog(event.currentTarget);
                // const used = await this.activity.use({event, legacy: false}, {event});
                if(!this.isActivity) return this.item.use({event, legacy: false}, {event});
                const used = await this.activity.use({event, legacy: false}, {event});
                if (used) {
                    DND5eItemButton.consumeActionEconomy(this.activity);
                    const useOtherItem = this.activity?.consumption?.targets?.find(t => t.type === "itemUses");
                    if (useOtherItem) {
                        const otherItem = this.actor.items.get(useOtherItem.target);
                        const allConnectedItems = this.actor.items.filter(i => i.system.activities?.find(a => a.consumption?.targets?.find(t => t.type === "itemUses" && t.target === otherItem.id)));
                        ui.ARGON.updateItemButtons(allConnectedItems);
                    }
                    this.render(true)
                }
            }

            async _onRightClick(event) {
                if(!this.isActivity) return this.item?.sheet?.render(true);
                this.activity?.sheet?.render(true);
            }

            static consumeActionEconomy(activity) {
                const activationType = activity?.activation?.type;
                let actionType = null;
                for (const [type, types] of Object.entries(actionTypes)) {
                    if (types.includes(activationType)) actionType = type;
                }
                if (!actionType) return;
                if (game.combat?.combatant?.actor !== activity.item.parent) actionType = "reaction";
                if (actionType === "action") {
                    ui.ARGON.components.main[0].isActionUsed = true;
                    ui.ARGON.components.main[0].updateActionUse();
                } else if (actionType === "bonus") {
                    ui.ARGON.components.main[1].isActionUsed = true;
                    ui.ARGON.components.main[1].updateActionUse();
                } else if (actionType === "reaction") {
                    ui.ARGON.components.main[2].isActionUsed = true;
                    ui.ARGON.components.main[2].updateActionUse();
                } else if (actionType === "free") {
                    ui.ARGON.components.main[3].isActionUsed = true;
                    ui.ARGON.components.main[3].updateActionUse();
                } else if (actionType === "legendary") {
                    ui.ARGON.components.main[4].isActionUsed = true;
                }
            }

            async render(...args) {
                await super.render(...args);
                if (this.activity) {
                    const weapons = this.actor.items.filter((item) => item.consume?.target === this.activity.id);
                    ui.ARGON.updateItemButtons(weapons);
                }
            }

            get quantity() {
                if(!this.item) return null;
                if (this.item.system.uses?.max) return this.item.system.uses.max - this.item.system.uses.spent;
                if (!this.activity) return null;
                const showQuantityItemTypes = ["consumable"];
                const consumeType = this.activity?.consume?.type;
                const useAmmo = this.item.system.ammunition?.type;
                const useOtherItem = this.activity?.consumption?.targets?.find(t => t.type === "itemUses");
                if (useOtherItem) {
                    const otherItem = this.actor.items.get(useOtherItem.target);
                    if (otherItem && otherItem.system.uses?.max) {
                        return otherItem.system.uses.max - otherItem.system.uses.spent;
                    }
                }
                if (useAmmo) {
                    const ammoItem = this.item.system.ammunitionOptions[0]?.item;
                    if (!ammoItem) return null;
                    return Math.floor(ammoItem.system.quantity ?? 0);
                } else if (consumeType === "attribute") {
                    return Math.floor(getProperty(this.actor, this.activity.consume.target) / this.activity.consume.amount);
                } else if (consumeType === "charges") {
                    const chargesItem = this.actor.items.get(this.activity.consume.target);
                    if (!chargesItem) return null;
                    return Math.floor((chargesItem.uses?.value ?? 0) / this.activity.consume.amount);
                } else if (showQuantityItemTypes.includes(this.item.type) && !this.activity.uses.max) {
                    return this.item.system.quantity;
                } else if (this.activity.uses.value !== null && this.activity.uses.per !== null && this.activity.uses.max) {
                    return this.activity.uses.value;
                }
                return null;
            }
        }

        class DND5eButtonPanelButton extends ARGON.MAIN.BUTTONS.ButtonPanelButton {
            constructor({ type, items, color }) {
                super();
                this.type = type;
                this.items = items;
                this.color = color;
                this.itemsWithSpells = [];
                this._spells = this.prePrepareSpells();
            }

            get hasContents() {
                return this._spells ? !!this._spells.length || !!this.itemsWithSpells.length : !!this.items.length;
            }

            get colorScheme() {
                return this.color;
            }

            get id() {
                return `${this.type}-${this.color}`;
            }

            get label() {
                switch (this.type) {
                    case "spell":
                        return "enhancedcombathud-black-flag.hud.castspell.name";
                    case "feature":
                        return "enhancedcombathud-black-flag.hud.usepower.name";
                    case "consumable":
                        return "enhancedcombathud-black-flag.hud.useitem.name";
                    case "weapon":
                        return "enhancedcombathud-black-flag.hud.useitem.name";
                }
            }

            get icon() {
                switch (this.type) {
                    case "spell":
                        return "modules/enhancedcombathud/icons/spell-book.webp";
                    case "feature":
                        return "modules/enhancedcombathud/icons/mighty-force.webp";
                    case "consumable":
                        return "modules/enhancedcombathud/icons/drink-me.webp";
                    case "weapon":
                        return "modules/enhancedcombathud/icons/drink-me.webp";
                }
            }

            get showPreparedOnly() {
                if (this.actor.type !== "pc") return false;
                const preparedFlag = this.actor.getFlag(MODULE_ID, "showPrepared");
                if(preparedFlag === "auto") {
                    const classes = Object.keys(this.actor.system.progression?.classes ?? {});
                    const requiresPreparation = ["cleric", "druid", "wizard"].some((className) => classes.includes(className));
                    return requiresPreparation;
                }
                if (preparedFlag === "all") return false;
                // default 2024 rules: all classes prepare spells
                return true;
            }

            prePrepareSpells() {
                if (this.type !== "spell") return;

                const spellLevels = CONFIG.BlackFlag.spellCircles();
                const itemsToIgnore = [];
                const magicItems = new Map();
                this.items.filter((item) => item.flags["black-flag"]?.cachedFor).forEach(is => {
                    const activity = fromUuidSync(this.actor.documentName + "." + this.actor.id + is.flags["black-flag"].cachedFor);
                    itemsToIgnore.push(is);
                    if(!activity?.displayInSpellbook) return;
                    const magicItem = activity.item;
                    const current = magicItems.get(magicItem);
                    current ? current.push(is) : magicItems.set(magicItem, [is]);
                })

                for (const [item, spells] of magicItems) {
                    this.itemsWithSpells.push({
                        label: item.name,
                        buttons: spells.map((spell) => new DND5eItemButton({ item: spell })),
                        uses: () => {
                            return { max: item.system?.uses?.max, value: item.system?.uses?.value };
                        },
                    });
                }
                
                this.items = this.items.filter((item) => !itemsToIgnore.includes(item));
                if (this.showPreparedOnly) {
                    const allowIfNotPrepared = ["atWill", "innate", "pact"];
                    this.items = this.items.filter((item) => {
                        if (allowIfNotPrepared.includes(item.getFlag('black-flag', 'relationship.mode'))) return true;
                        if (item.system?.circle?.base == 0) return true;
                        return item.system?.prepared > 0;
                    });
                }

                const spells = [
                    ...this.itemsWithSpells,
                    {
                        label: "At-Will",
                        buttons: this.items.filter((item) => item.getFlag('black-flag', 'relationship.mode') === "atWill").map((item) => new DND5eItemButton({ item })),
                        uses: { max: Infinity, value: Infinity },
                    },
                    {
                        label: "Innate",
                        buttons: this.items.filter((item) => item.getFlag('black-flag', 'relationship.mode') === "innate").map((item) => new DND5eItemButton({ item })),
                        uses: { max: Infinity, value: Infinity },
                    },
                    {
                        label: Object.values(spellLevels)[0],
                        buttons: this.items.filter((item) => item.system?.circle?.base == 0).map((item) => new DND5eItemButton({ item })),
                        uses: { max: Infinity, value: Infinity },
                    },
                    {
                        label: "Pact Magic",
                        buttons: this.items.filter((item) => item.getFlag('black-flag', 'relationship.mode') === "pact").map((item) => new DND5eItemButton({ item })),
                        uses: () => {
                            return this.actor.system.spellcasting.slots.pact;
                        },
                    },
                ];
                const spellRelationshipMode = (item) => item.getFlag('black-flag', 'relationship.mode');
                const isStandardLeveledSpell = (item) => !spellRelationshipMode(item) || spellRelationshipMode(item) === "spell";
                for (const [level, label] of Object.entries(spellLevels)) {
                    const levelSpells = this.items.filter((item) => item.system?.circle?.base == level && isStandardLeveledSpell(item));
                    if (!levelSpells.length || level == 0) continue;
                    spells.push({
                        label,
                        buttons: levelSpells.map((item) => new DND5eItemButton({ item })),
                        uses: () => {
                            return this.actor.system.spellcasting.slots[`circle-${level}`];
                        },
                    });
                }
                return spells.filter((spell) => spell.buttons.length);
            }

            async _getPanel() {
                if (this.type === "spell") {
                    return new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanel({ id: this.id, accordionPanelCategories: this._spells.map(({ label, buttons, uses }) => new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory({ label, buttons, uses })) });
                } else {
                    return new ARGON.MAIN.BUTTON_PANELS.ButtonPanel({ id: this.id, buttons: this.items.map((item) => new DND5eItemButton({ item })) });
                }
            }
        }

        class DND5eSpecialActionButton extends ARGON.MAIN.BUTTONS.ActionButton {
            constructor(specialItem) {
                super();
                const actorItem = this.actor.items.getName(specialItem.name);
                this.actorItem = actorItem;
                this.statusId = specialItem.flags?.statusId?.id;
                this.item = actorItem ?? specialItem;
            }

            get label() {
                return this.item.name;
            }

            get icon() {
                return this.item.img;
            }

            get hasTooltip() {
                return true;
            }

            get activity() {
                if (!this.item?.system?.activities) {
                    return;
                }
                return Array.from(this.item.system.activities)[0];
            }

            async getTooltipData() {
                const tooltipData = await getTooltipDetails(this.item);
                tooltipData.propertiesLabel = "enhancedcombathud-black-flag.tooltip.properties.name";
                return tooltipData;
            }

            async _onLeftClick(event) {
                const useCE = game.modules.get("dfreds-convenient-effects")?.active && game.dfreds.effectInterface.findEffect({ effectName: this.label });
                let success = false;
                if (useCE) {
                    success = true;
                    await game.dfreds.effectInterface.toggleEffect({ effectName: this.label, overlay: false, uuids: [this.actor.uuid] });
                } else {
                    success = this.actorItem ? await this.activity.use({ event }, { event }) : await this.createChatMessage();
                    if(this.statusId) {
                        const status = CONFIG.statusEffects.find(e => e.id === this.statusId || e._id === this.statusId);
                        if(status) this.actor.toggleStatusEffect(status.id);
                    }
                }
                if (success) {
                    DND5eItemButton.consumeActionEconomy(this.item);
                }
            }

            async createChatMessage() {
                return await ChatMessage.create({
                    user: game.user,
                    speaker: {
                        actor: this.actor,
                        token: this.actor.token,
                        alias: this.actor.name,
                    },
                    content: `
                    <div class="chat-card item-card" data-display-challenge="">

    <section class="card-header description collapsible">

        <header class="summary">
            <img class="gold-icon" src="${this.icon}">
            <div class="name-stacked border">
                <span class="title">${this.label}</span>
                <span class="subtitle">
                    Feature
                </span>
            </div>
            <i class="fas fa-chevron-down fa-fw"></i>
        </header>

        <section class="details collapsible-content card-content">
            <div class="wrapper">
                ${this.item.system.description.value}
            </div>
        </section>
    </section>


</div>
                    `,
                });
            }
        }

        class DND5eMovementHud extends ARGON.MovementHud {
            get movementMax() {
                if (!this.actor) return 0;
                if (!this.actor.system.traits.movement.types[this.movementMode]?.value ?? 0) return 0;
                return this.actor.system.traits.movement.types[this.movementMode]?.value ?? 0 / canvas.scene.dimensions.distance;
            }
        }

        class DND5eButtonHud extends ARGON.ButtonHud {
            constructor(...args) {
                super(...args);
            }

            get visible() {
                return !game.combat?.started;
            }

            async _getButtons() {
                return [
                    {
                        label: "Long Rest",
                        onClick: (event) => this.actor.longRest(),
                        icon: "fas fa-bed",
                    },
                    {
                        label: "Short Rest",
                        onClick: (event) => this.actor.shortRest(),
                        icon: "fas fa-coffee",
                    },
                ];
            }
        }

        class DND5eWeaponSets extends ARGON.WeaponSets {
            async getDefaultSets() {
                const sets = await super.getDefaultSets();
                const isTransformed = this.actor.flags?.["black-flag"]?.isPolymorphed;
                if (this.actor.type !== "npc" && !isTransformed) return sets;
                const actions = this.actor.items.filter((item) => item.type === "weapon" && getActivationType(item) === "action");
                const bonus = this.actor.items.filter((item) => item.type === "weapon" && getActivationType(item) === "bonus");
                return {
                    1: {
                        primary: actions[0]?.uuid ?? null,
                        secondary: bonus[0]?.uuid ?? null,
                    },
                    2: {
                        primary: actions[1]?.uuid ?? null,
                        secondary: bonus[1]?.uuid ?? null,
                    },
                    3: {
                        primary: actions[2]?.uuid ?? null,
                        secondary: bonus[2]?.uuid ?? null,
                    },
                };
            }

            async _getSets() {
                const isTransformed = this.actor.flags?.["black-flag"]?.isPolymorphed;

                const sets = isTransformed ? await this.getDefaultSets() : foundry.utils.mergeObject(await this.getDefaultSets(), foundry.utils.deepClone(this.actor.getFlag("enhancedcombathud", "weaponSets") || {}));

                for (const [set, slots] of Object.entries(sets)) {
                    slots.primary = slots.primary ? await fromUuid(slots.primary) : null;
                    slots.secondary = slots.secondary ? await fromUuid(slots.secondary) : null;
                }
                return sets;
            }

            async _onSetChange({ sets, active }) {
                const switchEquip = game.settings.get("enhancedcombathud-black-flag", "switchEquip");
                if (!switchEquip) return;
                const updates = [];
                const activeSet = sets[active];
                const activeItems = Object.values(activeSet).filter((item) => item);
                const inactiveSets = Object.values(sets).filter((set) => set !== activeSet);
                const inactiveItems = inactiveSets
                    .flatMap((set) => Object.values(set))
                    .filter((item) => item)
                    .filter((item) => !activeItems.includes(item));
                activeItems.forEach((item) => {
                    if (!item.system?.equipped) updates.push({ _id: item.id, "system.equipped": true });
                });
                inactiveItems.forEach((item) => {
                    if (item.system?.equipped) updates.push({ _id: item.id, "system.equipped": false });
                });
                return await this.actor.updateEmbeddedDocuments("Item", updates);
            }
        }

        const enableMacroPanel = game.settings.get(MODULE_ID, "macroPanel");

        const mainPanels = [DND5eActionActionPanel, DND5eBonusActionPanel, DND5eReactionActionPanel, DND5eFreeActionPanel, DND5eLegActionPanel, DND5eLairActionPanel, DND5eMythicActionPanel];
        if (enableMacroPanel) mainPanels.push(ARGON.PREFAB.MacroPanel);
        mainPanels.push(ARGON.PREFAB.PassTurnPanel);

        console.log("[Argon-BF] Defining portrait panel...");
        CoreHUD.definePortraitPanel(DND5ePortraitPanel);
        console.log("[Argon-BF] Portrait panel defined");
        console.log("[Argon-BF] Defining drawer panel...");
        CoreHUD.defineDrawerPanel(DND5eDrawerPanel);
        console.log("[Argon-BF] Drawer panel defined");
        console.log("[Argon-BF] Defining main panels:", mainPanels.length, "panels");
        CoreHUD.defineMainPanels(mainPanels);
        console.log("[Argon-BF] Main panels defined");
        CoreHUD.defineMovementHud(DND5eMovementHud);
        CoreHUD.defineButtonHud(DND5eButtonHud);
        CoreHUD.defineWeaponSets(DND5eWeaponSets);
        CoreHUD.defineTooltip(DND5eTooltip);
        console.log("[Argon-BF] Defining supported actor types: pc, npc");
        CoreHUD.defineSupportedActorTypes(["pc", "npc"]);
        console.log("[Argon-BF] argonInit handler COMPLETED successfully");
    });
}

function registerItems() {
    ECHItems[game.i18n.localize("enhancedcombathud-black-flag.items.disengage.name")] = {
        name: game.i18n.localize("enhancedcombathud-black-flag.items.disengage.name"),
        type: "feature",
        img: "modules/enhancedcombathud/icons/journey.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-black-flag.items.disengage.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: 1,
                units: "turn",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },
            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
        },
        sort: 0,
        flags: {
            core: {
                sourceId: "Item.wyQkeuZkttllAFB1",
            },

            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-black-flag.items.dodge.name")] = {
        name: game.i18n.localize("enhancedcombathud-black-flag.items.dodge.name"),
        type: "feature",
        img: "modules/enhancedcombathud/icons/armor-upgrade.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-black-flag.items.dodge.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: 1,
                units: "round",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            statusId: {
                        id: "dodging",
            },
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-black-flag.items.ready.name")] = {
        name: game.i18n.localize("enhancedcombathud-black-flag.items.ready.name"),
        type: "feature",
        img: "modules/enhancedcombathud/icons/clockwork.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-black-flag.items.ready.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: null,
                units: "",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-black-flag.items.hide.name")] = {
        name: game.i18n.localize("enhancedcombathud-black-flag.items.hide.name"),
        type: "feature",
        img: "modules/enhancedcombathud/icons/cloak-dagger.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-black-flag.items.hide.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: null,
                units: "",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            recharge: {
                value: null,
                charged: false,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            statusId: {
                        id: "hiding",
            },
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-black-flag.items.dash.name")] = {
        name: game.i18n.localize("enhancedcombathud-black-flag.items.dash.name"),
        type: "feature",
        img: "modules/enhancedcombathud/icons/walking-boot.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-black-flag.items.dash.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: null,
                units: "",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-black-flag.items.shove.name")] = {
        name: game.i18n.localize("enhancedcombathud-black-flag.items.shove.name"),
        type: "feature",
        img: "modules/enhancedcombathud/icons/shield-bash.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-black-flag.items.shove.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: null,
                units: "",
            },
            target: {
                value: 1,
                width: null,
                units: "",
                type: "creature",
            },
            range: {
                value: null,
                long: null,
                units: "touch",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
}
