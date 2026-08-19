const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { verifyRecord } = require("../engine/verification_agent");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
const suMap = new Map(bundle.source_units.map((su) => [su.source_unit_id, su]));

async function main() {
  const client = createClient();
  let reviewedCount = 0;

  for (const kr of bundle.knowledge_records) {
    if (!kr.knowledge_record_id.includes("8_") || kr.review_status === "reviewed") continue;

    // Check if simple fixes resolve it
    if (kr.modality === "none") kr.original_modal_text = null;

    const sourceUnits = (kr.source_unit_ids || []).map((id) => suMap.get(id)).filter(Boolean);
    if (sourceUnits.length === 0) continue;

    const result = await verifyRecord({ record: kr, sourceUnits, client });
    if (result.entailed) {
      kr.review_status = "reviewed";
      reviewedCount++;
    }
  }

  for (const qc of bundle.quantitative_criteria) {
    if (!qc.criterion_id.includes("8_") || qc.review_status === "reviewed") continue;
    const sourceUnit = suMap.get(qc.source_unit_id);
    if (!sourceUnit) continue;

    const result = await verifyRecord({ record: qc, sourceUnits: [sourceUnit], client });
    if (result.entailed) {
      qc.review_status = "reviewed";
      reviewedCount++;
    }
  }

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  console.log(`Verified and transitioned ${reviewedCount} additional records to reviewed.`);
}

main().catch((err) => {
  console.error("Review script failed:", err);
});
