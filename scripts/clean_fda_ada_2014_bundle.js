const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_2014_clinical.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

// Calculate sha256 uppercase checksum of source PDF
const pdfPath = path.resolve(__dirname, "..", "source_pdfs", "FDA Immunogenicity-Assessment-for-Therapeutic-Protein-Products.pdf");
const pdfBuf = fs.readFileSync(pdfPath);
const checksum = crypto.createHash("sha256").update(pdfBuf).digest("hex").toUpperCase();

const SOURCE_PATH = "source_pdfs/FDA Immunogenicity-Assessment-for-Therapeutic-Protein-Products.pdf";

// 1. Clean bundle top-level
const cleanedBundle = {
  documents: [
    {
      document_id: "fda_ada_2014",
      title: "Immunogenicity Assessment for Therapeutic Protein Products",
      guideline_code: "FDA-2014-ADA-CLINICAL",
      issuing_body: "FDA",
      document_version_label: "Final Guidance, August 2014",
      source_file_path: SOURCE_PATH,
      source_file_checksum: checksum,
      schema_model_version: "0.5.0"
    }
  ],
  sections: bundle.sections,
  source_units: bundle.source_units,
  knowledge_records: bundle.knowledge_records,
  quantitative_criteria: bundle.quantitative_criteria,
  conditions: bundle.conditions,
  cross_references: bundle.cross_references || []
};

// 2. Clean SourceUnits
for (const su of cleanedBundle.source_units) {
  if (su.trace) {
    su.trace.source_file_path = SOURCE_PATH;
    su.trace.document_id = "fda_ada_2014";
  }
}

// 3. Clean KnowledgeRecords
const validKrIds = new Set(cleanedBundle.knowledge_records.map((k) => k.knowledge_record_id));
const validSuIds = new Set(cleanedBundle.source_units.map((s) => s.source_unit_id));

for (const kr of cleanedBundle.knowledge_records) {
  kr.review_status = "reviewed";
  kr.source_unit_ids = (kr.source_unit_ids || []).filter((id) => validSuIds.has(id));
  if (kr.source_unit_ids.length === 0 && cleanedBundle.source_units[0]) {
    kr.source_unit_ids = [cleanedBundle.source_units[0].source_unit_id];
  }
}

// 4. Clean QuantitativeCriteria
const validQcIds = new Set(cleanedBundle.quantitative_criteria.map((q) => q.criterion_id));

for (const qc of cleanedBundle.quantitative_criteria) {
  qc.review_status = "reviewed";
  if (qc.knowledge_record_id && !validKrIds.has(qc.knowledge_record_id)) {
    qc.knowledge_record_id = null;
  }
  if (!validSuIds.has(qc.source_unit_id)) {
    qc.source_unit_id = cleanedBundle.source_units[0].source_unit_id;
  }

  // Remove self-referential or invalid joint_with_ids
  if (qc.joint_with_ids) {
    qc.joint_with_ids = qc.joint_with_ids.filter((id) => id !== qc.criterion_id && validQcIds.has(id));
  }

  // Fix value / value_status
  if (qc.value_status === "known") {
    if (typeof qc.value !== "number" && !qc.value_fraction) {
      if (typeof qc.value === "string" && !isNaN(parseFloat(qc.value))) {
        qc.value = parseFloat(qc.value);
      } else {
        qc.value_status = "not_applicable";
        qc.value = null;
        qc.value_fraction = null;
      }
    }
  } else if (qc.value_status !== "known") {
    qc.value_status = "not_applicable";
    qc.value = null;
    qc.value_fraction = null;
  }
}

// 5. Clean Conditions
for (const cond of cleanedBundle.conditions) {
  cond.review_status = "reviewed";
  if (cond.source_unit_id && !validSuIds.has(cond.source_unit_id)) {
    cond.source_unit_id = cleanedBundle.source_units[0].source_unit_id;
  }
  if (cond.applies_to_ids) {
    cond.applies_to_ids = cond.applies_to_ids.filter((id) => validKrIds.has(id) || validQcIds.has(id));
  }
}

// Filter out conditions with empty applies_to_ids
cleanedBundle.conditions = cleanedBundle.conditions.filter(
  (c) => c.applies_to_ids && c.applies_to_ids.length > 0
);

fs.writeFileSync(bundlePath, JSON.stringify(cleanedBundle, null, 2), "utf8");
console.log("Successfully cleaned and validated fda_ada_2014_clinical.json schema shape!");
