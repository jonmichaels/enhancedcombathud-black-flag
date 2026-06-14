const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("scripts/echBlackFlag.js", "utf8");
const helperSource = source
  .match(/const fallbackLabel[\s\S]*?export function getSpellRangeLabel[\s\S]*?\n}\n/)[0]
  .replaceAll("export function", "function");

const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(`${helperSource}\nthis.getSpellCircleSchoolSubtitle = getSpellCircleSchoolSubtitle;\nthis.getSpellTargetLabel = getSpellTargetLabel;\nthis.getSpellRangeLabel = getSpellRangeLabel;`, context);

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

console.log("tooltip helper tests passed");
