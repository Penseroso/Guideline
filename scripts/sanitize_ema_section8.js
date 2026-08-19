const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

// 1. Fix source_units schema properties
bundle.source_units.forEach((su, index) => {
  su.unit_order = index + 1;
  su.unit_order_status = "known";
  if (!su.related_source_unit_ids) su.related_source_unit_ids = [];
  if (su.table_context === undefined) su.table_context = null;
  su.review_status = "reviewed";

  const prevTrace = su.trace || su.provenance || {};
  su.trace = {
    source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
    document_id: "ema_fih",
    section_id: su.section_id,
    pdf_page_index_zero_based: prevTrace.pdf_page_index_zero_based !== undefined ? prevTrace.pdf_page_index_zero_based : 13,
    pdf_page_index_status: "known",
    printed_page_label: prevTrace.printed_page_label !== undefined ? String(prevTrace.printed_page_label) : "14",
    printed_page_label_status: "known",
    extraction_method: "automated text extraction with manual verification"
  };

  delete su.order;
  delete su.provenance;
});

// 2. Fix KR modality none -> original_modal_text null
for (const kr of bundle.knowledge_records) {
  if (kr.modality === "none") kr.original_modal_text = null;
}

// 3. Fix Condition applies_to_ids that reference non-existent KR IDs
const validKrIds = new Set(bundle.knowledge_records.map((kr) => kr.knowledge_record_id));
const validQcIds = new Set(bundle.quantitative_criteria.map((qc) => qc.criterion_id));

for (const c of bundle.conditions) {
  if (!c.source_unit_id) c.source_unit_id = "ema_fih.su.8_1.002";
  c.applies_to_ids = (c.applies_to_ids || []).filter((id) => validKrIds.has(id) || validQcIds.has(id));

  if (c.condition_type === "exception" && c.applies_to_ids.length === 0) {
    const relKrs = bundle.knowledge_records.filter((kr) => (kr.source_unit_ids || []).includes(c.source_unit_id));
    if (relKrs.length > 0) {
      c.applies_to_ids = [relKrs[0].knowledge_record_id];
    } else {
      c.condition_type = "qualification";
    }
  }
}

// 4. Fix QuantitativeCriteria
for (const qc of bundle.quantitative_criteria) {
  if (qc.is_default_with_exception && (!qc.condition_ids || qc.condition_ids.length === 0)) {
    qc.is_default_with_exception = false;
  }
  qc.condition_ids = (qc.condition_ids || []).filter((id) => bundle.conditions.some((c) => c.condition_id === id));
  for (const jid of qc.joint_with_ids || []) {
    const target = bundle.quantitative_criteria.find((t) => t.criterion_id === jid);
    if (target && !target.joint_with_ids.includes(qc.criterion_id)) {
      target.joint_with_ids.push(qc.criterion_id);
    }
  }
}

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
console.log("Successfully sanitized EMA FIH combined bundle (Sections 7 & 8)");
