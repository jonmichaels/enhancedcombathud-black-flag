import {initConfig} from "./echBlackFlag.js";
import { registerSettings } from "./settings.js";
import "../scss/module.scss";

export const MODULE_ID = "enhancedcombathud-black-flag";

Hooks.on("setup", () => {
    registerSettings();
    initConfig();
});
