const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { verifyDraft } = require("../engine/pipeline");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
const suMap = new Map(bundle.source_units.map((su) => [su.source_unit_id, su]));

async function main() {
  const client = createClient();
  const unverified = [];

  // Group Section 8 items by section
  const sectionIds = [...new Set(bundle.source_units.filter((su) => su.section_id.includes("8")).map((su) => su.section_id))];

  for (const secId of sectionIds) {
    const sus = bundle.source_units.filter((su) => su.section_id === secId);
    const krs = bundle.knowledge_records.filter((kr) => (kr.source_unit_ids || []).some((id) => sus.some((su) => su.source_unit_id === id)));
    const qcs = bundle.quantitative_criteria.filter((qc) => sus.some((su) => su.source_unit_id === qc.source_unit_id));
    const conds = bundle.conditions.filter((c) => sus.some((su) => su.source_unit_id === c.source_unit_id));

    const draft = { knowledge_records: krs, quantitative_criteria: qcs, conditions: conds };
    const { report, summary } = await verifyDraft(draft, { sourceUnits: sus, client });

    for (const item of report) {
      if (!item.entailed) {
        unverified.push({ id: item.id, type: item.type, reason: item.reason, claim: item.claim });
      }
    }
  }

  console.log(`Total unverified items in Section 8: ${unverified.length}`);
  for (const item of unverified) {
    console.log(`\n[${item.id}] (${item.type}) Rejection Reason: ${item.reason}`);
    console.log(`  Claim: ${item.claim}`);
  }
}

main().catch(console.error);
