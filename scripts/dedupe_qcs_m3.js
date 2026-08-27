const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ich_m3_nonclinical.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

console.log("QCs before dedupe:", bundle.quantitative_criteria.length);

const seen = new Map();
const dedupedQcs = [];

for (const qc of bundle.quantitative_criteria) {
  // Key by source_unit_id, value/fraction, and normalized source_text
  const normText = (qc.source_text || "").toLowerCase().trim();
  const valKey = qc.value !== null ? qc.value : JSON.stringify(qc.value_fraction);
  const key = `${qc.source_unit_id}|${valKey}|${normText}`;

  if (!seen.has(key)) {
    seen.set(key, qc);
    dedupedQcs.push(qc);
  }
}

console.log("QCs after dedupe:", dedupedQcs.length);
bundle.quantitative_criteria = dedupedQcs;

// Update condition applies_to_ids to map to retained QCs
const retainedQcIds = new Set(dedupedQcs.map((q) => q.criterion_id));
for (const cond of bundle.conditions) {
  cond.applies_to_ids = cond.applies_to_ids.filter(
    (id) => bundle.knowledge_records.some((k) => k.knowledge_record_id === id) || retainedQcIds.has(id)
  );
}

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
console.log("Deduplication complete!");
