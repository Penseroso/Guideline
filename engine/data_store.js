const fs = require("fs");
const path = require("path");

const { discoverJsonFiles } = require("../validation/validate_pilots");

const ROOT = path.resolve(__dirname, "..");
const PILOTS_DIR = path.join(ROOT, "data", "pilots");

function loadBundles(pilotsDir = PILOTS_DIR) {
  const files = discoverJsonFiles(pilotsDir);
  return files.map((file) => ({
    file,
    bundle: JSON.parse(fs.readFileSync(file, "utf8"))
  }));
}

function buildIndex(bundles) {
  const documents = new Map();
  const sections = new Map();
  const sourceUnits = new Map();
  const knowledgeRecords = new Map();
  const quantitativeCriteria = new Map();
  const conditions = new Map();
  const crossReferences = new Map();

  for (const { bundle } of bundles) {
    for (const d of bundle.documents || []) documents.set(d.document_id, d);
    for (const s of bundle.sections || []) sections.set(s.section_id, s);
    for (const su of bundle.source_units || []) sourceUnits.set(su.source_unit_id, su);
    for (const kr of bundle.knowledge_records || []) knowledgeRecords.set(kr.knowledge_record_id, kr);
    for (const qc of bundle.quantitative_criteria || []) quantitativeCriteria.set(qc.criterion_id, qc);
    for (const c of bundle.conditions || []) conditions.set(c.condition_id, c);
    for (const x of bundle.cross_references || []) crossReferences.set(x.xref_id, x);
  }

  return { documents, sections, sourceUnits, knowledgeRecords, quantitativeCriteria, conditions, crossReferences };
}

function citationFor(index, sourceUnitId) {
  const su = index.sourceUnits.get(sourceUnitId);
  if (!su) return null;
  const section = index.sections.get(su.section_id) || null;
  const document = index.documents.get(su.document_id) || null;
  return {
    source_unit_id: su.source_unit_id,
    document_id: su.document_id,
    guideline_code: document ? document.guideline_code : null,
    section_id: su.section_id,
    section_number: section ? section.section_number : null,
    section_title: section ? section.title : null,
    pdf_page_index_zero_based: su.trace.pdf_page_index_zero_based,
    pdf_page_index_status: su.trace.pdf_page_index_status,
    printed_page_label: su.trace.printed_page_label,
    printed_page_label_status: su.trace.printed_page_label_status,
    source_file_path: su.trace.source_file_path
  };
}

function sourceTextFor(index, sourceUnitIds) {
  return sourceUnitIds
    .map((id) => index.sourceUnits.get(id))
    .filter(Boolean)
    .sort((a, b) => (a.unit_order ?? 0) - (b.unit_order ?? 0))
    .map((su) => su.source_text)
    .join("\n");
}

function getAncestorSections(index, sectionId) {
  const path = [];
  let curr = index.sections.get(sectionId);
  while (curr) {
    path.unshift(curr);
    curr = curr.parent_section_id ? index.sections.get(curr.parent_section_id) : null;
  }
  return path;
}

function deriveRecordScope(record, ancestorSections, document) {
  const docId = (document && document.document_id) || (record.document_id || "");
  const docTitle = (document && document.title) || "";
  const sectionPath = ancestorSections.map((s) => s.title);
  const sectionPathLower = sectionPath.join(" > ").toLowerCase();

  let moleculeScope = "all";
  const explicitExclusions = [];
  let studyContextScope = "unknown";
  let assayTechnologyScope = "none";
  let topicScope = "general";

  // Document-level domain ontology
  if (docId.includes("s6") || docTitle.toLowerCase().includes("biotechnology")) {
    moleculeScope = "biotechnology";
    explicitExclusions.push("small_molecule", "atmp");
    studyContextScope = "nonclinical_safety";
    assayTechnologyScope = "in_vivo_toxicology";
  } else if (docId.includes("m10") || docTitle.toLowerCase().includes("bioanalytical")) {
    moleculeScope = "all";
    studyContextScope = "bioanalytical_validation";
  } else if (docId.includes("fda") && docTitle.toLowerCase().includes("immunogenicity")) {
    moleculeScope = "biotechnology";
    explicitExclusions.push("nonclinical", "small_molecule", "ivd");
    studyContextScope = "clinical_immunogenicity";
    assayTechnologyScope = "ada_multi_tiered";
  } else if (docId.includes("ema") && docTitle.toLowerCase().includes("first-in-human")) {
    moleculeScope = "all";
    explicitExclusions.push("atmp");
    studyContextScope = "early_clinical_fih";
  }

  // Section-level assay technology refinement
  if (sectionPathLower.includes("chromatography")) {
    assayTechnologyScope = "chromatography";
    explicitExclusions.push("ligand_binding_assay");
  } else if (sectionPathLower.includes("ligand binding")) {
    assayTechnologyScope = "ligand_binding_assay";
    explicitExclusions.push("chromatography");
  }

  // Section- & Record-level topic refinement
  const paramLower = (record.parameter || "").toLowerCase();
  if (paramLower.includes("duration")) {
    topicScope = "study_duration";
  } else if (
    paramLower === "accuracy" ||
    paramLower === "precision" ||
    paramLower.includes("qcs")
  ) {
    topicScope = "acceptance_criteria";
  } else if (
    paramLower.includes("species") ||
    sectionPathLower.includes("species selection") ||
    sectionPathLower.includes("species/model selection")
  ) {
    topicScope = "species_selection";
  } else if (sectionPathLower.includes("study design")) {
    topicScope = "study_duration";
  } else if (sectionPathLower.includes("partial validation")) {
    topicScope = "partial_validation";
  } else if (sectionPathLower.includes("accuracy and precision")) {
    topicScope = "acceptance_criteria";
  } else if (sectionPathLower.includes("starting dose") || paramLower.includes("dose")) {
    topicScope = "starting_dose";
  }

  return {
    section_path: sectionPath,
    document_title: docTitle,
    molecule_scope: moleculeScope,
    study_context_scope: studyContextScope,
    assay_technology_scope: assayTechnologyScope,
    topic_scope: topicScope,
    explicit_exclusions: explicitExclusions
  };
}

/**
 * Flattens KnowledgeRecord/QuantitativeCriterion/Condition into one
 * search/citation-ready shape for the query router. Each answerable
 * record carries its own resolved citations, verbatim source text, and
 * hierarchical 5-dimensional Scope metadata.
 */
function answerableRecords(index) {
  const records = [];

  for (const kr of index.knowledgeRecords.values()) {
    const citations = kr.source_unit_ids.map((id) => citationFor(index, id)).filter(Boolean);
    const sectionId = citations[0] ? citations[0].section_id : null;
    const documentId = citations[0] ? citations[0].document_id : null;
    const ancestorSections = sectionId ? getAncestorSections(index, sectionId) : [];
    const document = documentId ? index.documents.get(documentId) : null;
    const scope = deriveRecordScope(kr, ancestorSections, document);

    records.push({
      type: "knowledge_record",
      id: kr.knowledge_record_id,
      record_type: kr.record_type,
      modality: kr.modality,
      subject: kr.subject,
      action: kr.action,
      object: kr.object,
      condition_ids: kr.condition_ids || [],
      original_modal_text: kr.original_modal_text,
      review_status: kr.review_status,
      source_unit_ids: kr.source_unit_ids,
      source_text: sourceTextFor(index, kr.source_unit_ids),
      citations,
      document_id: documentId,
      guideline_code: citations[0] ? citations[0].guideline_code : null,
      section_id: sectionId,
      section_number: citations[0] ? citations[0].section_number : null,
      ...scope
    });
  }

  for (const qc of index.quantitativeCriteria.values()) {
    const citation = citationFor(index, qc.source_unit_id);
    const sectionId = citation ? citation.section_id : null;
    const documentId = citation ? citation.document_id : null;
    const ancestorSections = sectionId ? getAncestorSections(index, sectionId) : [];
    const document = documentId ? index.documents.get(documentId) : null;
    const scope = deriveRecordScope(qc, ancestorSections, document);

    records.push({
      type: "quantitative_criterion",
      id: qc.criterion_id,
      knowledge_record_id: qc.knowledge_record_id || null,
      parameter: qc.parameter,
      comparator: qc.comparator,
      value: qc.value,
      value_fraction: qc.value_fraction,
      unit: qc.unit,
      denominator_or_reference: qc.denominator_or_reference,
      condition_ids: qc.condition_ids || [],
      joint_with_ids: qc.joint_with_ids || [],
      is_default_with_exception: qc.is_default_with_exception || false,
      is_illustrative_example: qc.is_illustrative_example || false,
      value_status: qc.value_status,
      review_status: qc.review_status,
      source_unit_ids: [qc.source_unit_id],
      source_text: qc.source_text,
      citations: citation ? [citation] : [],
      document_id: documentId,
      guideline_code: citation ? citation.guideline_code : null,
      section_id: sectionId,
      section_number: citation ? citation.section_number : null,
      ...scope
    });
  }

  for (const c of index.conditions.values()) {
    const citation = citationFor(index, c.source_unit_id);
    const sectionId = citation ? citation.section_id : null;
    const documentId = citation ? citation.document_id : null;
    const ancestorSections = sectionId ? getAncestorSections(index, sectionId) : [];
    const document = documentId ? index.documents.get(documentId) : null;
    const scope = deriveRecordScope(c, ancestorSections, document);

    records.push({
      type: "condition",
      id: c.condition_id,
      condition_type: c.condition_type,
      applies_to_ids: c.applies_to_ids || [],
      review_status: c.review_status,
      source_unit_ids: [c.source_unit_id],
      source_text: c.condition_text,
      citations: citation ? [citation] : [],
      document_id: documentId,
      guideline_code: citation ? citation.guideline_code : null,
      section_id: sectionId,
      section_number: citation ? citation.section_number : null,
      ...scope
    });
  }

  return records;
}

function loadStore(pilotsDir = PILOTS_DIR) {
  const bundles = loadBundles(pilotsDir);
  const index = buildIndex(bundles);
  return { index, records: answerableRecords(index) };
}

function main() {
  const { index, records } = loadStore();
  console.log(`Loaded ${index.documents.size} document(s), ${index.sections.size} section(s), ${index.sourceUnits.size} source unit(s).`);
  console.log(`Answerable records: ${records.length} (knowledge_record + quantitative_criterion + condition).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  loadBundles,
  buildIndex,
  citationFor,
  sourceTextFor,
  answerableRecords,
  loadStore
};
