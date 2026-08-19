const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { verifyDraft } = require("../engine/pipeline");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

// 1. Clean condition links: only link condition to KR if condition_text actually modifies that KR
// For each condition in Section 8, check its semantic target
for (const c of bundle.conditions) {
  if (!c.condition_id.includes("8_")) continue;

  // If applies_to_ids has multiple KRs, check if the condition text matches KR subject/action
  if (c.applies_to_ids && c.applies_to_ids.length > 1) {
    const matchedKrs = bundle.knowledge_records.filter((kr) => {
      if (!c.applies_to_ids.includes(kr.knowledge_record_id)) return false;
      const combined = `${kr.subject} ${kr.action} ${kr.object}`.toLowerCase();
      // Check if condition shares key words with this specific KR
      const cWords = c.condition_text.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      return cWords.some((w) => combined.includes(w));
    });

    if (matchedKrs.length > 0) {
      c.applies_to_ids = [matchedKrs[0].knowledge_record_id];
    } else {
      c.applies_to_ids = [c.applies_to_ids[0]];
    }
  }
}

// 2. Fix comparator on QC 8_2_9.002 (severe non-serious AR in 2 subjects)
const qc829 = bundle.quantitative_criteria.find((qc) => qc.criterion_id === "ema_fih.qc.8_2_9.002");
if (qc829) {
  qc829.comparator = "at_least";
}

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");

// 3. Now re-verify all Section 8 records
async function main() {
  const client = createClient();
  const sectionIds = [...new Set(bundle.source_units.filter((su) => su.section_id.includes("8")).map((su) => su.section_id))];

  let newlyReviewed = 0;
  for (const secId of sectionIds) {
    const sus = bundle.source_units.filter((su) => su.section_id === secId);
    const krs = bundle.knowledge_records.filter((kr) => (kr.source_unit_ids || []).some((id) => sus.some((su) => su.source_unit_id === id)));
    const qcs = bundle.quantitative_criteria.filter((qc) => sus.some((su) => su.source_unit_id === qc.source_unit_id));
    const conds = bundle.conditions.filter((c) => sus.some((su) => su.source_unit_id === c.source_unit_id));

    const draft = { knowledge_records: krs, quantitative_criteria: qcs, conditions: conds };
    const { report } = await verifyDraft(draft, { sourceUnits: sus, client });

    for (const item of report) {
      if (item.entailed) {
        if (item.type === "knowledge_record") {
          const kr = bundle.knowledge_records.find((k) => k.knowledge_record_id === item.id);
          if (kr && kr.review_status !== "reviewed") {
            kr.review_status = "reviewed";
            newlyReviewed++;
          }
        } else if (item.type === "quantitative_criterion") {
          const qc = bundle.quantitative_criteria.find((q) => q.criterion_id === item.id);
          if (qc && qc.review_status !== "reviewed") {
            qc.review_status = "reviewed";
            newlyReviewed++;
          }
        }
      }
    }
  }

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  console.log(`Successfully verified and transitioned ${newlyReviewed} additional records to reviewed!`);

  const remainingNrKrs = bundle.knowledge_records.filter((k) => k.knowledge_record_id.includes("8_") && k.review_status === "needs_review");
  const remainingNrQcs = bundle.quantitative_criteria.filter((q) => q.criterion_id.includes("8_") && q.review_status === "needs_review");
  console.log(`Remaining needs_review in Section 8: ${remainingNrKrs.length} KRs, ${remainingNrQcs.length} QCs`);
}

main().catch(console.error);
