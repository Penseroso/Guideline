const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { verifyDraft } = require("../engine/pipeline");

async function main() {
  const client = createClient();
  const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_validation.json");
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

  console.log("=== Auditing FDA ADA Guidance (2019) Sections through Verification Agent ===");
  console.log(`Total Entities: ${bundle.knowledge_records.length} KR, ${bundle.quantitative_criteria.length} QC, ${bundle.conditions.length} Cond`);

  const allReports = [];

  for (const sec of bundle.sections) {
    const secKrs = bundle.knowledge_records.filter((k) => {
      const su = bundle.source_units.find((s) => (k.source_unit_ids || []).includes(s.source_unit_id));
      return su && su.section_id === sec.section_id;
    });
    const secQcs = bundle.quantitative_criteria.filter((q) => {
      const su = bundle.source_units.find((s) => s.source_unit_id === q.source_unit_id);
      return su && su.section_id === sec.section_id;
    });
    const secConds = bundle.conditions.filter((c) => {
      const su = bundle.source_units.find((s) => s.source_unit_id === c.source_unit_id);
      return su && su.section_id === sec.section_id;
    });
    const secSus = bundle.source_units.filter((s) => s.section_id === sec.section_id);

    if (secSus.length === 0) continue;

    console.log(`\n--- Auditing ${sec.section_number}: ${sec.title} (${secKrs.length} KR, ${secQcs.length} QC, ${secConds.length} Cond) ---`);

    const result = await verifyDraft(
      {
        knowledge_records: secKrs,
        quantitative_criteria: secQcs,
        conditions: secConds
      },
      {
        sourceUnits: secSus,
        client
      }
    );

    const rep = result.report || [];
    const passed = rep.filter((r) => r.entailed);
    const flagged = rep.filter((r) => !r.entailed);

    console.log(`  Result: ${passed.length} Entailed, ${flagged.length} Flagged`);
    if (flagged.length > 0) {
      for (const f of flagged) {
        console.log(`    [FLAGGED ${f.type}] ID: ${f.id}`);
        console.log(`      Claim: "${f.claim}"`);
        console.log(`      Reason: ${f.reason}`);
      }
    }

    allReports.push(...rep);
  }

  const totalPassed = allReports.filter((r) => r.entailed);
  const totalFlagged = allReports.filter((r) => !r.entailed);

  console.log("\n=============================================");
  console.log("FINAL AUDIT SUMMARY ACROSS ALL SECTIONS");
  console.log("=============================================");
  console.log(`Total Entities Audited: ${allReports.length}`);
  console.log(`Entailed (Confirmed): ${totalPassed.length}`);
  console.log(`Flagged (Requires Attention): ${totalFlagged.length}`);

  // Save audit log
  const outPath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_audit_report.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        total: allReports.length,
        passed: totalPassed.length,
        flagged: totalFlagged.length,
        flagged_items: totalFlagged
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\nAudit log saved to: ${outPath}`);
}

main().catch(console.error);
