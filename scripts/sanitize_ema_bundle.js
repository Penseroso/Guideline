const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

// 1. Fix modal text when modality is none
for (const kr of bundle.knowledge_records) {
  if (kr.modality === "none") {
    kr.original_modal_text = null;
  }
}

// 2. Fix conditions
for (const c of bundle.conditions) {
  if (!c.source_unit_id) {
    c.source_unit_id = "ema_fih.su.7_3.003";
  }
  if (c.condition_type === "exception" && (!c.applies_to_ids || c.applies_to_ids.length === 0)) {
    const relKrs = bundle.knowledge_records.filter((kr) => kr.source_unit_ids.includes(c.source_unit_id));
    if (relKrs.length > 0) {
      c.applies_to_ids = [relKrs[0].knowledge_record_id];
    } else {
      c.condition_type = "qualification";
    }
  }
}

// 3. Fix quantitative criteria
for (const qc of bundle.quantitative_criteria) {
  if (qc.is_default_with_exception && (!qc.condition_ids || qc.condition_ids.length === 0)) {
    qc.is_default_with_exception = false;
  }
  // Ensure reciprocal joint_with_ids
  for (const jid of qc.joint_with_ids) {
    const target = bundle.quantitative_criteria.find((t) => t.criterion_id === jid);
    if (target && !target.joint_with_ids.includes(qc.criterion_id)) {
      target.joint_with_ids.push(qc.criterion_id);
    }
  }
}

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
console.log("Successfully sanitized data/pilots/ema_fih_dosing.json");
