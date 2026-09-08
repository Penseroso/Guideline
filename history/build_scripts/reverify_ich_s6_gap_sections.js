const fs = require("node:fs");
const { createClient } = require("../engine/llm_client");
const { verifySection, BUNDLE_PATH } = require("./backfill_ich_s6_gap_sections");
const { validateFiles } = require("../validation/validate_structured_data");

const SECTION_IDS = process.argv.slice(2);
if (SECTION_IDS.length === 0) throw new Error("usage: node scripts/reverify_ich_s6_gap_sections.js <section_id> [...more]");

async function main() {
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8"));
  const verifier = createClient("openai", { model: process.env.GUIDELINE_S6_VERIFICATION_MODEL || "gpt-5.6-sol" });

  const report = [];
  for (const sectionId of SECTION_IDS) {
    const section = bundle.sections.find((item) => item.section_id === sectionId);
    if (!section) throw new Error(`${sectionId}: section not found`);
    const sourceUnits = bundle.source_units.filter((unit) => unit.section_id === sectionId);
    const sourceUnitIds = new Set(sourceUnits.map((unit) => unit.source_unit_id));
    const draft = {
      knowledge_records: bundle.knowledge_records.filter((record) => record.source_unit_ids.some((id) => sourceUnitIds.has(id))),
      quantitative_criteria: bundle.quantitative_criteria.filter((record) => sourceUnitIds.has(record.source_unit_id)),
      conditions: bundle.conditions.filter((record) => sourceUnitIds.has(record.source_unit_id))
    };
    const verification = await verifySection({ section, sourceUnits, draft, verifier });
    report.push({ section_id: sectionId, review_status: verification.reviewStatus, failures: verification.failures });
    console.log(JSON.stringify(report.at(-1)));
  }

  fs.writeFileSync(BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  const validation = validateFiles([BUNDLE_PATH]);
  if (!validation.ok) {
    console.error(validation.errors.join("\n"));
    process.exitCode = 1;
  }
  const unresolved = report.filter((item) => item.review_status !== "reviewed");
  console.log(`S6 gap-section reverify: ${report.length - unresolved.length}/${report.length} sections independently verified; ${unresolved.length} unresolved.`);
  if (unresolved.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
