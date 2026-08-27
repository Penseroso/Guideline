const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent } = require("../engine/pipeline");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ich_m3_nonclinical.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

const batch1Data = JSON.parse(fs.readFileSync(path.resolve(__dirname, "ich_m3_batch1_data.json"), "utf8"));

const SOURCE_PDF = "source_pdfs/ICH M3.pdf";

function makeTrace(sectionId, zeroBasedPdfPage, printedPage) {
  return {
    source_file_path: SOURCE_PDF,
    document_id: "ich_m3_r2",
    section_id: sectionId,
    pdf_page_index_zero_based: zeroBasedPdfPage,
    pdf_page_index_status: "known",
    printed_page_label: String(printedPage),
    printed_page_label_status: "known",
    extraction_method: "automated text extraction with manual verification"
  };
}

async function main() {
  console.log("=== Running 3-Pass Extraction on ICH M3(R2) Batch 1 (Sections 1~5) ===");
  const client = createClient();

  for (const sec of batch1Data.sections) {
    if (!bundle.sections.some((s) => s.section_id === sec.section_id)) {
      bundle.sections.push(sec);
    }
  }

  for (const rawSu of batch1Data.source_units) {
    const su = {
      source_unit_id: rawSu.source_unit_id,
      document_id: rawSu.document_id,
      section_id: rawSu.section_id,
      unit_order: rawSu.unit_order,
      unit_order_status: "known",
      unit_type: rawSu.unit_type,
      source_text: rawSu.source_text,
      related_source_unit_ids: [],
      table_context: null,
      trace: makeTrace(rawSu.section_id, rawSu.pdfPage, rawSu.printedPage),
      review_status: "reviewed"
    };
    if (!bundle.source_units.some((s) => s.source_unit_id === su.source_unit_id)) {
      bundle.source_units.push(su);
    }
  }

  bundle.sections.sort((a, b) => a.section_order - b.section_order);
  bundle.source_units.sort((a, b) => a.unit_order - b.unit_order);

  const sectionIds = batch1Data.sections.map((s) => s.section_id);

  for (const secId of sectionIds) {
    const sec = bundle.sections.find((s) => s.section_id === secId);
    const sus = bundle.source_units.filter((u) => u.section_id === secId);
    if (sus.length === 0) continue;

    console.log(`\nExtracting Section ${sec.section_number}: ${sec.title} (${sus.length} SourceUnits)...`);
    const res = await extractSectionSelfConsistent({
      section: sec,
      sourceUnits: sus,
      client,
      passes: 3
    });

    console.log(`  ➔ Drafted: ${res.draft.knowledge_records.length} KR, ${res.draft.quantitative_criteria.length} QC, ${res.draft.conditions.length} Cond`);
    console.log(`  ➔ Verification Entailed: ${res.report.claims_entailed} / ${res.report.claims_verified}`);

    bundle.knowledge_records.push(...res.draft.knowledge_records);
    bundle.quantitative_criteria.push(...res.draft.quantitative_criteria);
    bundle.conditions.push(...res.draft.conditions);
  }

  const seenKr = new Set();
  bundle.knowledge_records = bundle.knowledge_records.filter((k) => {
    if (seenKr.has(k.knowledge_record_id)) return false;
    seenKr.add(k.knowledge_record_id);
    return true;
  });

  const seenQc = new Set();
  bundle.quantitative_criteria = bundle.quantitative_criteria.filter((q) => {
    if (seenQc.has(q.criterion_id)) return false;
    seenQc.add(q.criterion_id);
    return true;
  });

  const seenCond = new Set();
  bundle.conditions = bundle.conditions.filter((c) => {
    if (seenCond.has(c.condition_id)) return false;
    seenCond.add(c.condition_id);
    return true;
  });

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  console.log("\n==================================================");
  console.log("Successfully completed ICH M3(R2) Batch 1!");
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Batch 1 extraction failed:", err);
  process.exit(1);
});
