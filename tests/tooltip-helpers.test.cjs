const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("scripts/echBlackFlag.js", "utf8");
const helperSource = source
  .match(/const fallbackLabel[\s\S]*?export function getTooltipDamageParts[\s\S]*?\n}\n/)[0]
  .replaceAll("export function", "function");

const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(`${helperSource}\nthis.getSpellCircleSchoolSubtitle = getSpellCircleSchoolSubtitle;\nthis.getSpellTargetLabel = getSpellTargetLabel;\nthis.getSpellRangeLabel = getSpellRangeLabel;\nthis.isStandardSpellMode = isStandardSpellMode;\nthis.isSpellPreparedForHud = isSpellPreparedForHud;\nthis.getSpellSlotUses = getSpellSlotUses;\nthis.getTooltipToHitLabel = getTooltipToHitLabel;\nthis.getTooltipDamageParts = getTooltipDamageParts;`, context);

context.globalThis.CONFIG = {
  BlackFlag: {
    spellCircles: () => ({ 0: "Cantrip", 1: "1st Circle" }),
    spellSchools: { localized: { evocation: "Evocation" } },
  },
};

const spell = {
  type: "spell",
  labels: {},
  system: {
    circle: { base: 1 },
    school: "evocation",
    range: { label: "60 feet", unit: "ft" },
    target: {
      label: "One creature",
      affects: { labels: { sheet: "One creature" } },
      template: { label: "" },
    },
  },
};

assert.strictEqual(context.getSpellCircleSchoolSubtitle(spell), "1st Circle Evocation");
assert.strictEqual(context.getSpellTargetLabel(spell), "One creature");
assert.strictEqual(context.getSpellRangeLabel(spell), "60 feet");

const selfAreaSpell = {
  type: "spell",
  labels: { range: "Self" },
  system: {
    circle: { base: 0 },
    school: "evocation",
    range: { label: "Self", unit: "self" },
    target: { template: { label: "15-foot Cone" } },
  },
};

assert.strictEqual(context.getSpellCircleSchoolSubtitle(selfAreaSpell), "Cantrip Evocation");
assert.strictEqual(context.getSpellRangeLabel(selfAreaSpell), "Self (15-foot Cone)");

const legacyLabelsOnly = {
  labels: { level: "2nd Circle", school: "Illusion", target: "Legacy Target", range: "Legacy Range" },
  system: {},
};

assert.strictEqual(context.getSpellCircleSchoolSubtitle(legacyLabelsOnly), "2nd Circle Illusion");
assert.strictEqual(context.getSpellTargetLabel(legacyLabelsOnly), "Legacy Target");
assert.strictEqual(context.getSpellRangeLabel(legacyLabelsOnly), "Legacy Range");

const activityWithDerivedCombatData = {
  system: {
    damage: {
      parts: [
        { formula: "2d6", type: "fire" },
        { formula: "1d8", damageType: "radiant" },
      ],
    },
  },
};
Object.defineProperty(activityWithDerivedCombatData, "toHit", { value: "+7", enumerable: false });

const normalize = (value) => JSON.parse(JSON.stringify(value));

assert.strictEqual(context.getTooltipToHitLabel(activityWithDerivedCombatData), "+7");
assert.strictEqual(context.getTooltipToHitLabel({ ...activityWithDerivedCombatData }), "-");
assert.deepStrictEqual(normalize(context.getTooltipDamageParts(activityWithDerivedCombatData)), [
  { formula: "2d6", damageType: "fire" },
  { formula: "1d8", damageType: "radiant" },
]);

const weaponAttackActivity = {
  system: {
    toHit: 5,
    damage: {
      includeBase: true,
      parts: [{ formula: "1d4", type: "poison" }],
    },
  },
  item: {
    system: {
      damage: { base: { formula: "1d8", type: "slashing" } },
    },
  },
};

assert.strictEqual(context.getTooltipToHitLabel(weaponAttackActivity), "+5");
assert.deepStrictEqual(normalize(context.getTooltipDamageParts(weaponAttackActivity)), [
  { formula: "1d8", damageType: "slashing" },
  { formula: "1d4", damageType: "poison" },
]);

const itemLabelCombatData = {
  labels: {
    toHit: "+9",
    damages: [{ formula: "3d10", damageType: "necrotic" }],
  },
  system: {
    toHit: 1,
    damage: { parts: [{ formula: "1d4", type: "fire" }] },
  },
};

assert.strictEqual(context.getTooltipToHitLabel(itemLabelCombatData), "+9");
assert.deepStrictEqual(normalize(context.getTooltipDamageParts(itemLabelCombatData)), [
  { formula: "3d10", damageType: "necrotic" },
]);

const spellAttackActivity = {
  range: { label: "120 feet", unit: "ft" },
  target: { label: "One target", affects: { labels: { sheet: "One target" } } },
  system: { damage: { parts: [{ formula: "4d6", type: "fire" }] } },
  item: spell,
};
Object.defineProperty(spellAttackActivity, "toHit", { value: "+6", enumerable: false });

assert.strictEqual(context.getSpellTargetLabel(spellAttackActivity), "One target");
assert.strictEqual(context.getSpellRangeLabel(spellAttackActivity), "120 feet");
assert.strictEqual(context.getTooltipToHitLabel(spellAttackActivity), "+6");
assert.deepStrictEqual(normalize(context.getTooltipDamageParts(spellAttackActivity)), [
  { formula: "4d6", damageType: "fire" },
]);

const activityWithParentLabelsOnly = {
  system: { damage: { parts: [] } },
  item: itemLabelCombatData,
};

assert.strictEqual(context.getTooltipToHitLabel(activityWithParentLabelsOnly), "+9");
assert.deepStrictEqual(normalize(context.getTooltipDamageParts(activityWithParentLabelsOnly)), [
  { formula: "3d10", damageType: "necrotic" },
]);

const burningHandsSpellItem = {
  type: "spell",
  labels: {},
  system: {
    activities: new Map([
      ["cast", { type: "cast", system: {} }],
      ["save", {
        type: "save",
        system: { damage: { parts: [{ formula: "3d6", type: "fire" }] } },
      }],
    ]),
  },
};

assert.deepStrictEqual(normalize(context.getTooltipDamageParts(burningHandsSpellItem)), [
  { formula: "3d6", damageType: "fire" },
]);

const spellAttackItem = {
  type: "spell",
  labels: {},
  system: {
    activities: new Map([
      ["attack", {
        type: "attack",
        system: {
          attack: { bonus: 7 },
          damage: { parts: [{ formula: "2d10", type: "radiant" }] },
        },
      }],
    ]),
  },
};

assert.strictEqual(context.getTooltipToHitLabel(spellAttackItem), "+7");
assert.deepStrictEqual(normalize(context.getTooltipDamageParts(spellAttackItem)), [
  { formula: "2d10", damageType: "radiant" },
]);

assert.strictEqual(context.isStandardSpellMode(undefined), true);
assert.strictEqual(context.isStandardSpellMode("spell"), true);
assert.strictEqual(context.isStandardSpellMode("standard"), true);
assert.strictEqual(context.isStandardSpellMode("atWill"), false);

const hudSpell = (mode, system = {}) => ({
  system: { circle: { base: 1 }, ...system },
  getFlag: (_scope, key) => key === "relationship.mode" ? mode : undefined,
});
assert.strictEqual(context.isSpellPreparedForHud(hudSpell("standard", { prepared: true })), true);
assert.strictEqual(context.isSpellPreparedForHud(hudSpell("standard", { prepared: false })), false);
assert.strictEqual(context.isSpellPreparedForHud(hudSpell("standard", {})), true);
assert.strictEqual(context.isSpellPreparedForHud(hudSpell("atWill", { prepared: false })), true);
assert.strictEqual(context.isSpellPreparedForHud(hudSpell("standard", { circle: { base: 0 }, prepared: false })), true);

assert.deepStrictEqual(context.getSpellSlotUses({ system: { spellcasting: { slots: { "circle-1": { value: 2, max: 4 } } } } }, "circle-1"), { value: 2, max: 4 });
const missingCircleUses = context.getSpellSlotUses({ system: { spellcasting: {} } }, "circle-1");
assert.strictEqual(missingCircleUses.value, Infinity);
assert.strictEqual(missingCircleUses.max, Infinity);
const missingSpellcastingUses = context.getSpellSlotUses({ system: {} }, "circle-1");
assert.strictEqual(missingSpellcastingUses.value, Infinity);
assert.strictEqual(missingSpellcastingUses.max, Infinity);

const manifest = JSON.parse(fs.readFileSync("module.json", "utf8"));
assert.strictEqual(manifest.compatibility.minimum, "13");
assert.strictEqual(manifest.compatibility.verified, "14");
assert.strictEqual(manifest.compatibility.maximum, "14");
const argonCompatibility = manifest.relationships.requires.find((relationship) => relationship.id === "enhancedcombathud").compatibility;
assert.strictEqual(argonCompatibility.minimum, "3.0.4");
assert.strictEqual(argonCompatibility.verified, undefined);
assert.strictEqual(argonCompatibility.maximum, undefined);
const blackFlagCompatibility = manifest.relationships.systems.find((relationship) => relationship.id === "black-flag").compatibility;
assert.strictEqual(blackFlagCompatibility.minimum, "2.0.0");
assert.strictEqual(blackFlagCompatibility.verified, "3.0.075");
assert.strictEqual(blackFlagCompatibility.maximum, undefined);

assert.match(source, /const rangeUnit = activity\?\.range\?\.unit \?\? activity\?\.range\?\.units;/);
assert.match(source, /const templateUnit = activity\.target\?\.template\?\.unit \?\? activity\.target\?\.template\?\.units;/);
assert.match(source, /get useTargetPicker\(\) \{\n\s+return false;\n\s+\}/);
assert.match(source, /const used = await activity\?\.activate\?\.\(\{ event, legacy: false \}, \{ event \}\);/);
assert.doesNotMatch(source, /this\.item\.use\(/);
assert.doesNotMatch(source, /this\.activity\.use\(/);

console.log("tooltip helper tests passed");
