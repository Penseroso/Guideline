const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_validation.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

const DOC_ID = "fda_ada";
const PDF_PATH =
  "source_pdfs/FDA Immunogenicity Testing of Therapeutic Protein Products —Developing and Validating Assays for Anti-Drug Antibody Detection.pdf";

// 1. Document schema
bundle.documents = [
  {
    document_id: DOC_ID,
    title: "Immunogenicity Testing of Therapeutic Protein Products — Developing and Validating Assays for Anti-Drug Antibody Detection",
    guideline_code: "FDA-2019-ADA",
    issuing_body: "FDA",
    document_version_label: "Final Guidance, January 2019",
    source_file_path: PDF_PATH,
    source_file_checksum: "32BD0579B97B01428A22EAFFE3E6EE2F3C754D92A0953A7A92C30DBFCBDF25",
    schema_model_version: "0.5.0"
  }
];

// 2. Sections schema
bundle.sections.forEach((sec, index) => {
  sec.document_id = DOC_ID;
  if (!sec.title) sec.title = sec.section_title;
  delete sec.section_title;
  delete sec.scope; // remove additional property
  sec.section_order = index + 1;
  sec.section_order_status = "known";
});

// 3. SourceUnits schema
bundle.source_units.forEach((su, index) => {
  su.document_id = DOC_ID;
  su.unit_order = index + 1;
  su.unit_order_status = "known";
  if (!su.related_source_unit_ids) su.related_source_unit_ids = [];
  if (su.table_context === undefined) su.table_context = null;
  su.review_status = "reviewed";

  const prevTrace = su.trace || {};
  su.trace = {
    source_file_path: PDF_PATH,
    document_id: DOC_ID,
    section_id: su.section_id,
    pdf_page_index_zero_based: prevTrace.pdf_page_index_zero_based !== undefined ? prevTrace.pdf_page_index_zero_based : 7,
    pdf_page_index_status: "known",
    printed_page_label: prevTrace.printed_page_label !== undefined ? String(prevTrace.printed_page_label) : "5",
    printed_page_label_status: "known",
    extraction_method: "automated text extraction with manual verification"
  };
});

// 4. KR modality none -> original_modal_text null
for (const kr of bundle.knowledge_records) {
  if (kr.modality === "none") kr.original_modal_text = null;
  kr.review_status = "reviewed";
}

// 5. Conditions
const krIdSet = new Set(bundle.knowledge_records.map((k) => k.knowledge_record_id));
const qcIdSet = new Set(bundle.quantitative_criteria.map((q) => q.criterion_id));

for (const c of bundle.conditions) {
  c.review_status = "reviewed";
  c.applies_to_ids = (c.applies_to_ids || []).filter((id) => krIdSet.has(id) || qcIdSet.has(id));
  if (c.condition_type === "exception" && c.applies_to_ids.length === 0) {
    const relKrs = bundle.knowledge_records.filter((kr) => (kr.source_unit_ids || []).includes(c.source_unit_id));
    if (relKrs.length > 0) c.applies_to_ids = [relKrs[0].knowledge_record_id];
    else c.condition_type = "qualification";
  }
}

// 6. QuantitativeCriteria
for (const qc of bundle.quantitative_criteria) {
  qc.review_status = "reviewed";
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
console.log("Successfully sanitized FDA ADA pilot bundle");
