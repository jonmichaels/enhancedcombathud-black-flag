const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("scripts/echBlackFlag.js", "utf8");
const helperSource = source
  .match(/const fallbackLabel[\s\S]*?export function getTooltipDamageParts[\s\S]*?\n}\n/)[0]
  .replaceAll("export function", "function");

const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(`${helperSource}\nthis.getSpellCircleSchoolSubtitle = getSpellCircleSchoolSubtitle;\nthis.getSpellTargetLabel = getSpellTargetLabel;\nthis.getSpellRangeLabel = getSpellRangeLabel;\nthis.getTooltipToHitLabel = getTooltipToHitLabel;\nthis.getTooltipDamageParts = getTooltipDamageParts;`, context);

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
  toHit: "+7",
  system: {
    damage: {
      parts: [
        { formula: "2d6", type: "fire" },
        { formula: "1d8", damageType: "radiant" },
      ],
    },
  },
};

const normalize = (value) => JSON.parse(JSON.stringify(value));

assert.strictEqual(context.getTooltipToHitLabel(activityWithDerivedCombatData), "+7");
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

console.log("tooltip helper tests passed");
