/**
 * Hierarchy-derived semantic overlay authoring: generates the
 * facet/coverage_manifest/comparison_binding inventory for a document from
 * its own section structure (PARENT_SECTIONS/DOCUMENT_AREAS/LEAF_TOPICS
 * below are per-document config authored by hand — adding a new document
 * means adding its own entry here first, this is not a zero-config
 * generic scan).
 *
 * The inventory is section-driven, never question-driven. New objects are
 * deliberately authored as needs_review; promotion remains a separate,
 * evidence-backed review action (see promote_semantic_summaries.js for the
 * summary_specs/salience_profiles layer built on top of this inventory).
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const GUIDELINES_DIR = path.join(ROOT, "data", "guidelines");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");

const PARENT_SECTIONS = {
  ema_fih: ["ema_fih.sec.5", "ema_fih.sec.6", "ema_fih.sec.7", "ema_fih.sec.8", "ema_fih.sec.8_2"],
  fda_ada_2014: [
    "fda_ada_2014.sec.3", "fda_ada_2014.sec.5", "fda_ada_2014.sec.5_a",
    "fda_ada_2014.sec.5_b", "fda_ada_2014.sec.app_a"
  ],
  fda_ada: ["fda_ada.sec.3", "fda_ada.sec.4", "fda_ada.sec.5", "fda_ada.sec.5_b", "fda_ada.sec.6", "fda_ada.sec.7"],
  ich_m10: [
    "ich_m10.sec.1", "ich_m10.sec.2", "ich_m10.sec.2_2", "ich_m10.sec.3", "ich_m10.sec.3_2",
    "ich_m10.sec.3_2_5", "ich_m10.sec.3_3", "ich_m10.sec.4", "ich_m10.sec.4_1", "ich_m10.sec.4_2",
    "ich_m10.sec.4_2_4", "ich_m10.sec.4_3", "ich_m10.sec.6", "ich_m10.sec.7", "ich_m10.sec.8"
  ],
  ich_m3_r2: ["ich_m3_r2.sec.1", "ich_m3_r2.sec.5", "ich_m3_r2.sec.7", "ich_m3_r2.sec.11"],
  ich_s6_r1: [
    "ich_s6_r1.sec.part1", "ich_s6_r1.sec.part1.1", "ich_s6_r1.sec.part1.4",
    "ich_s6_r1.sec.part2", "ich_s6_r1.sec.part2.2", "ich_s6_r1.sec.part2.3", "ich_s6_r1.sec.part2.5"
  ]
};

const DOCUMENT_AREAS = {
  ema_fih: ["ema_fih.sec.2", "ema_fih.sec.5", "ema_fih.sec.6", "ema_fih.sec.7", "ema_fih.sec.8"],
  fda_ada_2014: ["fda_ada_2014.sec.1", "fda_ada_2014.sec.3", "fda_ada_2014.sec.4", "fda_ada_2014.sec.5", "fda_ada_2014.sec.app_a"],
  fda_ada: ["fda_ada.sec.1", "fda_ada.sec.3", "fda_ada.sec.4", "fda_ada.sec.5", "fda_ada.sec.6", "fda_ada.sec.7", "fda_ada.sec.8"],
  ich_m10: ["ich_m10.sec.1", "ich_m10.sec.2", "ich_m10.sec.3", "ich_m10.sec.4", "ich_m10.sec.5", "ich_m10.sec.6", "ich_m10.sec.7", "ich_m10.sec.8"],
  ich_m3_r2: [
    "ich_m3_r2.sec.1", "ich_m3_r2.sec.2", "ich_m3_r2.sec.3", "ich_m3_r2.sec.4", "ich_m3_r2.sec.5",
    "ich_m3_r2.sec.6", "ich_m3_r2.sec.7", "ich_m3_r2.sec.8", "ich_m3_r2.sec.9", "ich_m3_r2.sec.10",
    "ich_m3_r2.sec.11", "ich_m3_r2.sec.12", "ich_m3_r2.sec.13", "ich_m3_r2.sec.14", "ich_m3_r2.sec.15",
    "ich_m3_r2.sec.16", "ich_m3_r2.sec.17"
  ],
  ich_s6_r1: ["ich_s6_r1.sec.part1.1_3", "ich_s6_r1.sec.part1.2", "ich_s6_r1.sec.part1.3_1", "ich_s6_r1.sec.part1.4", "ich_s6_r1.sec.part2"]
};

const SCOPE_SECTIONS = {
  ema_fih: "ema_fih.sec.2",
  fda_ada_2014: "fda_ada_2014.sec.1",
  fda_ada: "fda_ada.sec.1",
  ich_m10: "ich_m10.sec.1_3",
  ich_m3_r2: "ich_m3_r2.sec.1_3",
  ich_s6_r1: "ich_s6_r1.sec.part1.1_3"
};

const EXISTING_PARENT_MANIFESTS = {
  "fda_ada.sec.6": "fda_ada.sem.manifest.assay_validation",
  "fda_ada_2014.sec.5": "fda_ada_2014.sem.manifest.risk_factors"
};

const EXISTING_PARENT_INTENTS = {
  "fda_ada.sec.6": "topic_overview",
  "fda_ada_2014.sec.5": "topic_overview"
};

const LEAF_TOPICS = {
  ich_m10: [{
    key: "isr_process", section: "ich_m10.sec.5", intent: "process",
    facets: [
      { key: "purpose", role: "purpose", members: ["ich_m10.kr.5.001", "ich_m10.kr.5.002", "ich_m10.kr.5.003"] },
      { key: "applicability", role: "condition", members: ["ich_m10.kr.5.004", "ich_m10.cond.5.001", "ich_m10.cond.5.002"] },
      { key: "sample_selection", role: "procedure_step", members: ["ich_m10.qc.5.003", "ich_m10.qc.5.004", "ich_m10.qc.5.005", "ich_m10.qc.5.006", "ich_m10.qc.5.008"] },
      { key: "chromatography_acceptance", role: "criterion", members: ["ich_m10.qc.5.009", "ich_m10.qc.5.010"], when: { slot_id: "target_assay", value: "chromatography" } },
      { key: "lba_acceptance", role: "criterion", members: ["ich_m10.qc.5.011"], when: { slot_id: "target_assay", value: "ligand_binding_assay" } }
    ]
  }],
  fda_ada: [{
    key: "multi_tier_testing", section: "fda_ada.sec.4_a_1", intent: "process",
    facets: [
      { key: "screening", role: "procedure_step", members: ["fda_ada.kr.IV_A_1.001", "fda_ada.kr.IV_A_1.002", "fda_ada.kr.IV_A_1.003", "fda_ada.kr.IV_A_1.004"] },
      { key: "confirmatory", role: "procedure_step", members: ["fda_ada.kr.IV_A_1.005", "fda_ada.kr.IV_A_1.006", "fda_ada.kr.IV_A_1.010"] },
      { key: "downstream_characterization", role: "procedure_step", members: ["fda_ada.kr.IV_A_1.011", "fda_ada.kr.IV_A_1.012"] }
    ]
  }],
  fda_ada_2014: [{
    key: "clinical_risk_mitigation", section: "fda_ada_2014.sec.4", intent: "process",
    facets: [
      { key: "baseline", role: "procedure_step", members: ["fda_ada_2014.kr.4.001"] },
      { key: "risk_stratified_sampling", role: "condition", members: ["fda_ada_2014.kr.4.002", "fda_ada_2014.kr.4.003", "fda_ada_2014.kr.4.006", "fda_ada_2014.kr.4.007"] },
      { key: "event_triggered_sampling", role: "condition", members: ["fda_ada_2014.cond.4.002", "fda_ada_2014.cond.4.005", "fda_ada_2014.cond.4.006"] },
      { key: "premedication_boundary", role: "boundary", members: ["fda_ada_2014.kr.4.004", "fda_ada_2014.kr.4.005"] }
    ]
  }],
  ich_m3_r2: [{
    key: "high_dose_selection", section: "ich_m3_r2.sec.1_5", intent: "multi_criterion",
    facets: [
      { key: "selection_endpoints", role: "criterion", members: ["ich_m3_r2.kr.1_5.001"] },
      { key: "limit_dose", role: "criterion", members: ["ich_m3_r2.kr.1_5.003", "ich_m3_r2.qc.1_5.001"] },
      { key: "exposure_margin", role: "criterion", members: ["ich_m3_r2.kr.1_5.004", "ich_m3_r2.qc.1_5.003"] },
      { key: "exceptions", role: "exception", members: ["ich_m3_r2.kr.1_5.002", "ich_m3_r2.cond.1_5.002", "ich_m3_r2.cond.1_5.003"] }
    ]
  }],
  ich_s6_r1: [{
    key: "species_number_conditions", section: "ich_s6_r1.sec.part2.2_2", intent: "multi_criterion",
    facets: [
      { key: "two_species_short_term", role: "criterion", members: ["ich_s6_r1.kr.part2.2_2.001", "ich_s6_r1.cond.part2.2_2.001"] },
      { key: "one_species_long_term", role: "condition", members: ["ich_s6_r1.kr.part2.2_2.002", "ich_s6_r1.cond.part2.2_2.002"] },
      { key: "single_relevant_species", role: "condition", members: ["ich_s6_r1.kr.part2.2_2.005", "ich_s6_r1.cond.part2.2_2.004"] },
      { key: "boundaries", role: "boundary", members: ["ich_s6_r1.kr.part2.2_2.003", "ich_s6_r1.kr.part2.2_2.004", "ich_s6_r1.kr.part2.2_2.006"] }
    ]
  }]
};

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(text) { return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex"); }
function slug(value) {
  return String(value || "section").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 72);
}
function facetRole(section) {
  const title = section.title.toLowerCase();
  if (title.includes("scope")) return "scope";
  if (title.includes("validation") || title.includes("dose") || title.includes("toxicity")) return "criterion";
  if (title.includes("study") || title.includes("protocol") || title.includes("implementation")) return "procedure_step";
  return "purpose";
}
function facetId(documentId, section) {
  const identity = String(section.section_number).toLowerCase() === "notes"
    ? slug(section.section_id.replace(`${documentId}.sec.`, ""))
    : `${slug(section.section_number)}_${slug(section.title)}`;
  return `${documentId}.sem.facet.section_${identity}`;
}
function manifestId(documentId, section) {
  return `${documentId}.sem.manifest.section_${slug(section.section_number)}_${slug(section.title)}`;
}
function recordId(record) { return record.knowledge_record_id || record.criterion_id || record.condition_id; }

function loadBundles() {
  const byDocumentId = new Map();
  for (const name of fs.readdirSync(GUIDELINES_DIR).filter((item) => item.endsWith(".json"))) {
    const bundle = readJson(path.join(GUIDELINES_DIR, name));
    byDocumentId.set(bundle.documents[0].document_id, bundle);
  }
  return byDocumentId;
}

function sourceUnitForRecord(bundle, record) {
  const id = record.source_unit_id || (record.source_unit_ids || [])[0];
  return bundle.source_units.find((unit) => unit.source_unit_id === id);
}

function evidenceRef(bundle, wantedId) {
  const all = [...bundle.knowledge_records, ...bundle.quantitative_criteria, ...bundle.conditions];
  const record = all.find((item) => recordId(item) === wantedId);
  if (!record) throw new Error(`Cannot resolve evidence record ${wantedId}`);
  const unit = sourceUnitForRecord(bundle, record);
  const sourceText = record.source_text || record.condition_text || unit && unit.source_text;
  return { record_id: wantedId, source_unit_id: unit.source_unit_id, source_text_sha256: sha256(sourceText) };
}

function firstKnowledgeEvidence(bundle, sectionId) {
  const unitIds = new Set(bundle.source_units.filter((unit) => unit.section_id === sectionId).map((unit) => unit.source_unit_id));
  const record = bundle.knowledge_records.find((item) => (item.source_unit_ids || []).some((id) => unitIds.has(id)));
  if (!record) throw new Error(`No KnowledgeRecord evidence in ${sectionId}`);
  return evidenceRef(bundle, record.knowledge_record_id);
}

function upsertById(items, idField, item) {
  const index = items.findIndex((entry) => entry[idField] === item[idField]);
  if (index === -1) items.push(item);
  else items[index] = item;
}

function existingFacetForScope(overlay, sectionId) {
  return overlay.facets.find((facet) => facet.scope === sectionId && facet.coverage_basis === "section_census" &&
    !facet.facet_id.includes("screening_performance"));
}

function ensureSectionFacet(overlay, sectionsById, sectionId, parentFacetId = null) {
  const existing = existingFacetForScope(overlay, sectionId);
  if (existing) return existing.facet_id;
  const section = sectionsById.get(sectionId);
  if (!section) throw new Error(`Unknown section ${sectionId}`);
  const id = facetId(overlay.document_id, section);
  upsertById(overlay.facets, "facet_id", {
    facet_id: id,
    concept_id: `${overlay.document_id}.concept.${slug(section.title)}`,
    scope: sectionId,
    parent_facet_id: parentFacetId,
    member_record_ids: [],
    coverage_basis: "section_census",
    semantic_role: facetRole(section),
    review_status: "needs_review"
  });
  return id;
}

function buildParentManifest(overlay, bundle, sectionId) {
  const sectionsById = new Map(bundle.sections.map((section) => [section.section_id, section]));
  const parent = sectionsById.get(sectionId);
  const children = bundle.sections.filter((section) => section.parent_section_id === sectionId)
    .sort((a, b) => a.section_order - b.section_order);
  if (children.length < 2) throw new Error(`${sectionId} is not a substantive parent section`);
  const rootFacetId = ensureSectionFacet(overlay, sectionsById, sectionId);
  const childFacetIds = children.map((child) => ensureSectionFacet(overlay, sectionsById, child.section_id, rootFacetId));
  const existingId = EXISTING_PARENT_MANIFESTS[sectionId];
  const generatedId = existingId || manifestId(overlay.document_id, parent);
  const prior = overlay.coverage_manifests.find((manifest) => manifest.manifest_id === generatedId);
  upsertById(overlay.coverage_manifests, "manifest_id", {
    manifest_id: generatedId,
    target: { type: "section", id: sectionId },
    answer_intent: EXISTING_PARENT_INTENTS[sectionId] || "section_overview",
    scope_selectors: [],
    coverage_groups: [{
      group_id: "direct_child_sections",
      selection: "all",
      facet_ids: childFacetIds,
      when: null,
      on_ambiguity: "disclose_gap",
      display_order: 1
    }],
    review_status: prior ? prior.review_status : "needs_review"
  });
}

function buildDocumentOverview(overlay, bundle) {
  const existing = overlay.coverage_manifests.find((manifest) => manifest.manifest_id === `${overlay.document_id}.sem.manifest.document_overview`);
  if (existing) return;
  const sectionsById = new Map(bundle.sections.map((section) => [section.section_id, section]));
  const facets = DOCUMENT_AREAS[overlay.document_id].map((id) => ensureSectionFacet(overlay, sectionsById, id));
  overlay.coverage_manifests.push({
    manifest_id: `${overlay.document_id}.sem.manifest.document_overview`,
    target: { type: "document", id: overlay.document_id },
    answer_intent: "document_overview",
    scope_selectors: [],
    coverage_groups: [{
      group_id: "major_areas",
      selection: "all",
      facet_ids: facets,
      when: null,
      on_ambiguity: "disclose_gap",
      display_order: 1
    }],
    review_status: "needs_review"
  });
}

function buildLeafTopic(overlay, topic) {
  const rootId = `${overlay.document_id}.sem.facet.${topic.key}`;
  const allMembers = [...new Set(topic.facets.flatMap((facet) => facet.members))];
  const priorRoot = overlay.facets.find((facet) => facet.facet_id === rootId);
  upsertById(overlay.facets, "facet_id", {
    facet_id: rootId,
    concept_id: `${overlay.document_id}.concept.${topic.key}`,
    scope: topic.section,
    parent_facet_id: null,
    member_record_ids: allMembers,
    coverage_basis: "declared_members",
    semantic_role: topic.intent === "process" ? "procedure_step" : "criterion",
    review_status: priorRoot ? priorRoot.review_status : "needs_review"
  });
  const groups = topic.facets.map((spec, index) => {
    const id = `${rootId}.${spec.key}`;
    const priorFacet = overlay.facets.find((facet) => facet.facet_id === id);
    upsertById(overlay.facets, "facet_id", {
      facet_id: id,
      concept_id: `${overlay.document_id}.concept.${topic.key}.${spec.key}`,
      scope: topic.section,
      parent_facet_id: rootId,
      member_record_ids: spec.members,
      coverage_basis: "declared_members",
      semantic_role: spec.role,
      review_status: priorFacet ? priorFacet.review_status : "needs_review"
    });
    return {
      group_id: spec.key,
      selection: "all",
      facet_ids: [id],
      when: spec.when || null,
      on_ambiguity: spec.when ? "present_branches" : "disclose_gap",
      display_order: index + 1
    };
  });
  const leafManifestId = `${overlay.document_id}.sem.manifest.${topic.key}`;
  const priorManifest = overlay.coverage_manifests.find((manifest) => manifest.manifest_id === leafManifestId);
  upsertById(overlay.coverage_manifests, "manifest_id", {
    manifest_id: leafManifestId,
    target: { type: "facet", id: rootId },
    answer_intent: topic.intent,
    scope_selectors: [],
    coverage_groups: groups,
    review_status: priorManifest ? priorManifest.review_status : "needs_review"
  });
}

function ensureScopeBinding(overlay, bundle) {
  const sectionId = SCOPE_SECTIONS[overlay.document_id];
  let facet = overlay.facets.find((item) => item.scope === sectionId && item.concept_id === "guideline_applicability_scope");
  if (!facet) {
    facet = {
      facet_id: `${overlay.document_id}.sem.facet.scope`,
      concept_id: "guideline_applicability_scope",
      scope: sectionId,
      parent_facet_id: null,
      member_record_ids: [],
      coverage_basis: "section_census",
      semantic_role: "scope",
      review_status: "needs_review"
    };
    upsertById(overlay.facets, "facet_id", facet);
  }
  const id = `${overlay.document_id}.sem.binding.scope_product_or_matrix`;
  const prior = overlay.comparison_bindings.find((binding) => binding.binding_id === id);
  upsertById(overlay.comparison_bindings, "binding_id", {
    binding_id: id,
    axis_id: "scope.product_or_matrix",
    facet_id: facet.facet_id,
    evidence_refs: prior ? prior.evidence_refs : [firstKnowledgeEvidence(bundle, sectionId)],
    display_label_key: `${overlay.document_id}.scope.product_or_matrix`,
    review_status: prior ? prior.review_status : "needs_review"
  });
}

function main() {
  const bundles = loadBundles();
  let total = 0;
  for (const documentId of Object.keys(PARENT_SECTIONS)) {
    const file = path.join(OVERLAY_DIR, `${documentId}.json`);
    const overlay = readJson(file);
    const bundle = bundles.get(documentId);
    // Part I and Part II both contain a section named "Notes", which once
    // collided into a single non-path-qualified facet id — this stale
    // object is filtered out; a path-qualified facet id is generated for
    // each "Notes" section separately below.
    if (documentId === "ich_s6_r1") {
      overlay.facets = overlay.facets.filter((facet) => facet.facet_id !== "ich_s6_r1.sem.facet.section_notes_notes");
    }
    overlay.semantic_overlay_version = "0.3.0";
    overlay.derivation = { method: "agent_assisted", pipeline_version: "stage-d-2026-09-08" };
    for (const sectionId of PARENT_SECTIONS[documentId]) buildParentManifest(overlay, bundle, sectionId);
    buildDocumentOverview(overlay, bundle);
    for (const topic of LEAF_TOPICS[documentId] || []) buildLeafTopic(overlay, topic);
    ensureScopeBinding(overlay, bundle);
    overlay.facets.sort((a, b) => a.facet_id.localeCompare(b.facet_id));
    overlay.coverage_manifests.sort((a, b) => a.manifest_id.localeCompare(b.manifest_id));
    overlay.comparison_bindings.sort((a, b) => a.binding_id.localeCompare(b.binding_id));
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
    total += overlay.coverage_manifests.length;
    console.log(`${documentId}: ${overlay.coverage_manifests.length} manifests, ${overlay.facets.length} facets`);
  }
  if (total !== 55) throw new Error(`Manifest inventory mismatch: expected 55 unique manifests, found ${total}`);
  console.log(`Manifest inventory: ${total} unique manifests`);
}

if (require.main === module) main();

module.exports = { PARENT_SECTIONS, DOCUMENT_AREAS, SCOPE_SECTIONS, LEAF_TOPICS };
