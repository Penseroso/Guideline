const fs = require("fs");
const path = require("path");

const { discoverJsonFiles } = require("../validation/validate_pilots");

const ROOT = path.resolve(__dirname, "..");
const PILOTS_DIR = path.join(ROOT, "data", "pilots");
const KO_PRESENTATION_DIR = path.join(ROOT, "data", "presentation", "ko");
const SCOPE_PROFILES_PATH = path.join(ROOT, "data", "ontology", "document_scope_profiles.json");

let scopeProfilesCache = null;
function loadScopeProfiles() {
  if (!scopeProfilesCache) {
    scopeProfilesCache = JSON.parse(fs.readFileSync(SCOPE_PROFILES_PATH, "utf8"));
  }
  return scopeProfilesCache;
}

function loadBundles(pilotsDir = PILOTS_DIR) {
  const files = discoverJsonFiles(pilotsDir);
  return files.map((file) => ({
    file,
    bundle: JSON.parse(fs.readFileSync(file, "utf8"))
  }));
}

function loadKoPresentation(directory = KO_PRESENTATION_DIR) {
  const entries = new Map();
  if (!fs.existsSync(directory)) return entries;
  for (const file of discoverJsonFiles(directory)) {
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const entry of overlay.entries || []) entries.set(entry.record_id, entry);
  }
  return entries;
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

  const conditionsByTarget = buildConditionsByTarget(conditions);
  const crossReferencesBySourceUnit = buildCrossReferencesBySourceUnit(crossReferences);

  return { documents, sections, sourceUnits, knowledgeRecords, quantitativeCriteria, conditions, crossReferences, conditionsByTarget, crossReferencesBySourceUnit };
}

function buildCrossReferencesBySourceUnit(crossReferences) {
  const bySu = new Map();
  for (const x of crossReferences.values()) {
    if (!bySu.has(x.source_unit_id)) bySu.set(x.source_unit_id, []);
    bySu.get(x.source_unit_id).push(x);
  }
  return bySu;
}

function resolveCrossReferences(index, sourceUnitIds) {
  const xrefs = [];
  const seen = new Set();
  for (const suId of sourceUnitIds || []) {
    const list = index.crossReferencesBySourceUnit.get(suId) || [];
    for (const x of list) {
      if (seen.has(x.xref_id)) continue;
      seen.add(x.xref_id);
      let targetCitation = null;
      let targetText = null;
      if (x.target_id) {
        const targetSu = index.sourceUnits.get(x.target_id);
        if (targetSu) {
          const targetSec = index.sections.get(targetSu.section_id);
          const targetDoc = index.documents.get(targetSu.document_id);
          const page = targetSu.trace && targetSu.trace.printed_page_label ? `p.${targetSu.trace.printed_page_label}` : `pdf page ${targetSu.trace?.pdf_page_index_zero_based ?? '?'}`;
          targetCitation = `${targetDoc?.guideline_code || targetDoc?.document_id || 'Guideline'} §${targetSec?.section_number || '?'}, ${page} [${targetSu.source_unit_id}]`;
          targetText = targetSu.source_text;
        }
      }
      xrefs.push({
        xref_id: x.xref_id,
        source_unit_id: x.source_unit_id,
        raw_reference_text: x.raw_reference_text,
        target_type: x.target_type,
        target_id: x.target_id,
        resolution_status: x.resolution_status,
        target_citation: targetCitation,
        target_source_text: targetText
      });
    }
  }
  return xrefs;
}

/**
 * Reverse index: target_id (KnowledgeRecord/QuantitativeCriterion/SourceUnit)
 * -> [condition_id, ...] whose applies_to_ids names it. KnowledgeRecord has no
 * native condition_ids field in the schema (only QuantitativeCriterion does) —
 * this is the only place a KR's applicable Conditions can be recovered from.
 */
function buildConditionsByTarget(conditions) {
  const byTarget = new Map();
  for (const c of conditions.values()) {
    for (const targetId of c.applies_to_ids || []) {
      if (!byTarget.has(targetId)) byTarget.set(targetId, []);
      byTarget.get(targetId).push(c.condition_id);
    }
  }
  return byTarget;
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

/**
 * Data-driven replacement for the formerly-hardcoded document/section
 * classification chain (docs/schema.md Model 0.6.0; scope_profiles_version
 * 0.1.0, data/ontology/document_scope_profiles.json). Kept as a pure function
 * of (record, ancestorSections, document) so behavior stays a deterministic
 * table lookup, not a growing if/else chain. Only change from the prior
 * hardcoded version: document matching is exact document_id equality instead
 * of substring .includes() (docId.includes("s6") etc. was a latent false-
 * positive risk on any future document_id incidentally containing that
 * substring), and topic_rules gained FDA-ADA-specific entries appended after
 * all legacy entries so no legacy record's topic_scope changes.
 */
function deriveRecordScope(record, ancestorSections, document) {
  const profiles = loadScopeProfiles();
  const docId = (document && document.document_id) || (record.document_id || "");
  const docTitle = (document && document.title) || "";
  const sectionPath = ancestorSections.map((s) => s.title);
  const sectionPathLower = sectionPath.join(" > ").toLowerCase();

  const docProfile = profiles.document_profiles.find((p) => p.document_id === docId) || profiles.default_profile;
  let moleculeScope = docProfile.molecule_scope;
  let studyContextScope = docProfile.study_context_scope;
  let assayTechnologyScope = docProfile.assay_technology_scope;
  const explicitExclusions = [...docProfile.explicit_exclusions];

  // Section-level assay technology refinement (first matching rule wins, same
  // as the original if/else-if chain)
  for (const rule of profiles.section_assay_rules) {
    if (sectionPathLower.includes(rule.when_section_path_includes)) {
      assayTechnologyScope = rule.assay_technology_scope;
      explicitExclusions.push(...rule.explicit_exclusions_add);
      break;
    }
  }

  // Section- & Record-level topic refinement (first matching rule wins)
  const paramLower = (record.parameter || "").toLowerCase();
  let topicScope = profiles.default_topic_scope;
  for (const rule of profiles.topic_rules) {
    const matches =
      (rule.when_parameter_includes && paramLower.includes(rule.when_parameter_includes)) ||
      (rule.when_parameter_equals_any && rule.when_parameter_equals_any.includes(paramLower)) ||
      (rule.when_section_path_includes && sectionPathLower.includes(rule.when_section_path_includes));
    if (matches) {
      topicScope = rule.topic_scope;
      break;
    }
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
 * Resolves a list of Condition ids into their type/text, for display as a
 * caveat alongside an answer — verbatim condition_text only, never a
 * judgment about whether the condition holds (that's a product-boundary
 * line, docs/project_scope.md non-goals: this only shows what the source
 * itself says applies, it never concludes suitability or applicability
 * for the reader's own situation).
 */
function resolveConditionSummaries(index, conditionIds, koPresentation = new Map()) {
  return conditionIds
    .map((id) => index.conditions.get(id))
    .filter(Boolean)
    .map((c) => {
      const ko = koPresentation.get(c.condition_id);
      return {
        condition_id: c.condition_id,
        condition_type: c.condition_type,
        condition_text: c.condition_text,
        normalized_ko: ko && ko.normalization_status === "reviewed" ? ko.normalized_ko : null,
        normalization_status: ko ? ko.normalization_status : "needs_review"
      };
    });
}

/**
 * Flattens KnowledgeRecord/QuantitativeCriterion/Condition into one
 * search/citation-ready shape for the query router. Each answerable
 * record carries its own resolved citations, verbatim source text, and
 * hierarchical 5-dimensional Scope metadata.
 */
function answerableRecords(index, koPresentation = new Map()) {
  const records = [];

  for (const kr of index.knowledgeRecords.values()) {
    const citations = kr.source_unit_ids.map((id) => citationFor(index, id)).filter(Boolean);
    const sectionId = citations[0] ? citations[0].section_id : null;
    const documentId = citations[0] ? citations[0].document_id : null;
    const ancestorSections = sectionId ? getAncestorSections(index, sectionId) : [];
    const document = documentId ? index.documents.get(documentId) : null;
    const scope = deriveRecordScope(kr, ancestorSections, document);
    const conditionIds = index.conditionsByTarget.get(kr.knowledge_record_id) || [];

    records.push({
      type: "knowledge_record",
      id: kr.knowledge_record_id,
      record_type: kr.record_type,
      modality: kr.modality,
      subject: kr.subject,
      action: kr.action,
      object: kr.object,
      condition_ids: conditionIds,
      applicable_conditions: resolveConditionSummaries(index, conditionIds, koPresentation),
      original_modal_text: kr.original_modal_text,
      normalized_ko: kr.normalized_ko || null,
      normalization_status: kr.normalized_ko ? "reviewed" : "needs_review",
      review_status: kr.review_status,
      source_unit_ids: kr.source_unit_ids,
      source_text: sourceTextFor(index, kr.source_unit_ids),
      citations,
      cross_references: resolveCrossReferences(index, kr.source_unit_ids),
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
    const ko = koPresentation.get(qc.criterion_id);

    records.push({
      type: "quantitative_criterion",
      id: qc.criterion_id,
      knowledge_record_id: qc.knowledge_record_id || null,
      parameter: qc.parameter,
      comparator: qc.comparator,
      value: qc.value,
      value_fraction: qc.value_fraction,
      value_range: qc.value_range || null,
      value_text: qc.value_text || null,
      unit: qc.unit,
      denominator_or_reference: qc.denominator_or_reference,
      condition_ids: qc.condition_ids || [],
      applicable_conditions: resolveConditionSummaries(index, qc.condition_ids || [], koPresentation),
      joint_with_ids: qc.joint_with_ids || [],
      is_default_with_exception: qc.is_default_with_exception || false,
      is_illustrative_example: qc.is_illustrative_example || false,
      value_status: qc.value_status,
      normalized_ko: ko && ko.normalization_status === "reviewed" ? ko.normalized_ko : null,
      normalization_status: ko ? ko.normalization_status : "needs_review",
      review_status: qc.review_status,
      source_unit_ids: [qc.source_unit_id],
      source_text: qc.source_text,
      citations: citation ? [citation] : [],
      cross_references: resolveCrossReferences(index, [qc.source_unit_id]),
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
    const ko = koPresentation.get(c.condition_id);

    records.push({
      type: "condition",
      id: c.condition_id,
      condition_type: c.condition_type,
      applies_to_ids: c.applies_to_ids || [],
      normalized_ko: ko && ko.normalization_status === "reviewed" ? ko.normalized_ko : null,
      normalization_status: ko ? ko.normalization_status : "needs_review",
      review_status: c.review_status,
      source_unit_ids: [c.source_unit_id],
      source_text: c.condition_text,
      citations: citation ? [citation] : [],
      cross_references: resolveCrossReferences(index, [c.source_unit_id]),
      document_id: documentId,
      guideline_code: citation ? citation.guideline_code : null,
      section_id: sectionId,
      section_number: citation ? citation.section_number : null,
      ...scope
    });
  }

  return records;
}

function loadStore(pilotsDir = PILOTS_DIR, koPresentationDir = KO_PRESENTATION_DIR) {
  const bundles = loadBundles(pilotsDir);
  const index = buildIndex(bundles);
  const koPresentation = loadKoPresentation(koPresentationDir);
  return { index, records: answerableRecords(index, koPresentation), koPresentation };
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
  loadKoPresentation,
  buildIndex,
  buildConditionsByTarget,
  citationFor,
  sourceTextFor,
  getAncestorSections,
  deriveRecordScope,
  answerableRecords,
  loadStore
};
