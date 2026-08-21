const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_validation.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

console.log("=== FDA ADA BUNDLE DETAILED BREAKDOWN ===");
console.log(`KnowledgeRecords (${bundle.knowledge_records.length}):`);
const krBySection = {};
for (const kr of bundle.knowledge_records) {
  const su = bundle.source_units.find((s) => (kr.source_unit_ids || []).includes(s.source_unit_id));
  const sec = su ? su.section_id : "unknown";
  krBySection[sec] = (krBySection[sec] || 0) + 1;
}
console.log(krBySection);

console.log(`\nQuantitativeCriteria (${bundle.quantitative_criteria.length}):`);
for (const qc of bundle.quantitative_criteria) {
  console.log(`[${qc.criterion_id}] Section: ${qc.section_number} | Param: ${qc.parameter} | Value: ${qc.comparator} ${qc.numeric_value_standard || (qc.fraction_numerator + '/' + qc.fraction_denominator)} ${qc.unit} | Modal: ${qc.modality} | Status: ${qc.review_status}`);
}

console.log(`\nConditions (${bundle.conditions.length}):`);
const condTypes = {};
for (const c of bundle.conditions) {
  condTypes[c.condition_type] = (condTypes[c.condition_type] || 0) + 1;
}
console.log(condTypes);

// Check if any condition has empty applies_to_ids
const danglingConds = bundle.conditions.filter((c) => !c.applies_to_ids || c.applies_to_ids.length === 0);
console.log(`\nDangling conditions (applies_to_ids empty): ${danglingConds.length}`);

// Check all 5 pilot files
const pilotsDir = path.resolve(__dirname, "..", "data", "pilots");
const files = fs.readdirSync(pilotsDir).filter((f) => f.endsWith(".json"));
console.log("\n=== ALL 5 PILOT BUNDLES REVIEW STATUS ===");
for (const f of files) {
  const b = JSON.parse(fs.readFileSync(path.join(pilotsDir, f), "utf8"));
  const krs = b.knowledge_records || [];
  const qcs = b.quantitative_criteria || [];
  const conds = b.conditions || [];
  const nr = krs.filter((k) => k.review_status === "needs_review").length +
             qcs.filter((q) => q.review_status === "needs_review").length +
             conds.filter((c) => c.review_status === "needs_review").length;
  console.log(`${f}: Total Entities: ${krs.length + qcs.length + conds.length} | needs_review: ${nr}`);
}
