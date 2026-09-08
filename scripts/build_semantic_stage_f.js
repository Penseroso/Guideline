/**
 * Stage F (docs/derived_semantic_layer.md §10 단계 F): mechanical
 * summary_specs + salience_profiles authoring for the 47 manifests Stage D
 * generated but Stage E's narrow pilot scope never covered.
 *
 * Deliberately does NOT author any Korean presentation text — see the plan
 * decision recorded in history/verification/semantic_stage_f_2026-09-08.md:
 * a sample of parent sections (e.g. ich_m3_r2 §5, §11) have no directly-filed
 * content of their own, only in numbered sub-sections, so "quote an already-
 * reviewed sentence" would leave most new summaries with no text anyway, and
 * synthesizing new Korean prose across ~46 manifests without a review step
 * carries real accuracy risk. That is separate future manual work.
 *
 * Everything generated here is real, evidence-grounded structure:
 * - facet_ids are the manifest's own existing (Stage D reviewed) coverage
 *   facets, never invented.
 * - evidence_refs resolve to a real core record (KnowledgeRecord /
 *   QuantitativeCriterion / Condition) with a correct source_text_sha256.
 * - salience tier/rationale_code are derived deterministically from each
 *   facet's own existing, reviewed `semantic_role` — not a new judgment.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PILOTS_DIR = path.join(ROOT, "data", "pilots");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");

// coverage_manifest.answer_intent -> summary_spec.summary_kind. Only these
// four intents have a matching summary_kind in the schema; multi_criterion
// and comparison manifests get no summary_spec (a list-of-criteria or an
// axis-comparison answer isn't the "overview paragraph" shape summary_specs
// solve for).
const SUMMARY_KIND_BY_INTENT = {
  document_overview: "scope",
  section_overview: "section_overview",
  topic_overview: "topic_overview",
  process: "process_overview"
};

// salience_profile.context has no multi_criterion value; every pre-existing
// multi_criterion salience_profile (ich_m10 run_acceptance, fda_ada
// screening_performance) already used "detail" — followed here for
// consistency rather than inventing a new convention.
const SALIENCE_CONTEXT_BY_INTENT = {
  document_overview: "document_overview",
  section_overview: "section_overview",
  topic_overview: "topic_overview",
  process: "process",
  multi_criterion: "detail",
  comparison: "comparison"
};

// facet.semantic_role -> { tier, rationale_code }. Reuses each facet's own
// already-reviewed classification (docs/derived_semantic_layer.md §4.3) —
// not a new editorial judgment about importance.
const SALIENCE_BY_ROLE = {
  definition: { tier: "primary", rationale_code: "definition" },
  scope: { tier: "primary", rationale_code: "scope_boundary" },
  boundary: { tier: "primary", rationale_code: "scope_boundary" },
  criterion: { tier: "primary", rationale_code: "quantitative_criterion" },
  purpose: { tier: "primary", rationale_code: "governing_text" },
  exception: { tier: "supporting", rationale_code: "exception" },
  condition: { tier: "supporting", rationale_code: "governing_text" },
  procedure_step: { tier: "supporting", rationale_code: "governing_text" },
  risk_factor: { tier: "supporting", rationale_code: "governing_text" },
  evidence: { tier: "detail", rationale_code: "example" }
};

// Below this many facets, a manifest's disclosure list is already short
// enough that tiering adds no reading benefit.
const SALIENCE_MIN_FACETS = 5;

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(text) { return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex"); }

function loadBundles() {
  const byDocumentId = new Map();
  for (const name of fs.readdirSync(PILOTS_DIR).filter((item) => item.endsWith(".json"))) {
    const bundle = readJson(path.join(PILOTS_DIR, name));
    byDocumentId.set(bundle.documents[0].document_id, bundle);
  }
  return byDocumentId;
}

function recordId(record) { return record.knowledge_record_id || record.criterion_id || record.condition_id; }

function evidenceRef(bundle, wantedId) {
  const all = [...bundle.knowledge_records, ...bundle.quantitative_criteria, ...bundle.conditions];
  const record = all.find((item) => recordId(item) === wantedId);
  if (!record) throw new Error(`Cannot resolve evidence record ${wantedId}`);
  const unitId = record.source_unit_id || (record.source_unit_ids || [])[0];
  const unit = bundle.source_units.find((item) => item.source_unit_id === unitId);
  const sourceText = record.source_text || record.condition_text || (unit && unit.source_text);
  return { record_id: wantedId, source_unit_id: unit.source_unit_id, source_text_sha256: sha256(sourceText) };
}

/**
 * Any real record (KnowledgeRecord/QuantitativeCriterion/Condition) filed
 * under `sectionId` or one of its descendant sections, picked
 * deterministically (lexicographically first id) so reruns are stable.
 * Unlike scripts/build_semantic_stage_d.js's firstKnowledgeEvidence, this
 * walks descendants and isn't limited to KnowledgeRecord — needed because
 * several parent sections (e.g. ich_m3_r2 §5, §11) have no content directly
 * on the parent itself, only in numbered sub-sections.
 */
function firstEvidenceInSubtree(bundle, sectionsById, sectionId) {
  const subtree = new Set([sectionId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const section of bundle.sections) {
      if (section.parent_section_id && subtree.has(section.parent_section_id) && !subtree.has(section.section_id)) {
        subtree.add(section.section_id);
        grew = true;
      }
    }
  }
  const unitIds = new Set(bundle.source_units.filter((unit) => subtree.has(unit.section_id)).map((unit) => unit.source_unit_id));
  const candidates = [
    ...bundle.knowledge_records.filter((r) => (r.source_unit_ids || []).some((id) => unitIds.has(id))).map((r) => r.knowledge_record_id),
    ...bundle.quantitative_criteria.filter((r) => unitIds.has(r.source_unit_id)).map((r) => r.criterion_id),
    ...bundle.conditions.filter((r) => unitIds.has(r.source_unit_id)).map((r) => r.condition_id)
  ].sort();
  if (candidates.length === 0) throw new Error(`No evidence found under ${sectionId} or its descendants`);
  return evidenceRef(bundle, candidates[0]);
}

function evidenceForFacet(bundle, sectionsById, facet) {
  if (facet.coverage_basis === "declared_members") {
    if (!facet.member_record_ids || facet.member_record_ids.length === 0) {
      throw new Error(`Facet ${facet.facet_id} has coverage_basis declared_members but no member_record_ids`);
    }
    return evidenceRef(bundle, [...facet.member_record_ids].sort()[0]);
  }
  return firstEvidenceInSubtree(bundle, sectionsById, facet.scope);
}

function manifestFacetIds(manifest) {
  return [...new Set((manifest.coverage_groups || []).flatMap((group) => group.facet_ids || []))];
}

/**
 * Mirrors engine/semantic_shadow.js's selectServedSummary/selectServedSalience
 * matching so Stage F never authors a duplicate object for a manifest an
 * existing (Stage A/E) summary_spec or salience_profile already reaches,
 * whether by exact target match or facet containment.
 */
function summaryAlreadyCovers(overlay, manifest) {
  const facetIdSet = new Set(manifestFacetIds(manifest));
  return (overlay.summary_specs || []).some((summary) => {
    const exact = summary.target && summary.target.type === manifest.target.type && summary.target.id === manifest.target.id;
    return exact || summary.facet_ids.every((id) => facetIdSet.has(id));
  });
}

function salienceAlreadyCovers(overlay, manifest) {
  const facetIdSet = new Set(manifestFacetIds(manifest));
  return (overlay.salience_profiles || []).some((profile) => {
    const exact = profile.target_id === manifest.target.id;
    return exact || profile.items.every((item) => facetIdSet.has(item.facet_id));
  });
}

function buildSummarySpec(overlay, bundle, sectionsById, manifest) {
  const summaryKind = SUMMARY_KIND_BY_INTENT[manifest.answer_intent];
  if (!summaryKind) return null;
  if (summaryAlreadyCovers(overlay, manifest)) return null;

  const facetIds = manifestFacetIds(manifest);
  const facetsById = new Map(overlay.facets.map((facet) => [facet.facet_id, facet]));

  // Not every facet_id in a manifest necessarily has real content of its own
  // in this curated archive (e.g. ich_s6_r1 §5.1 "General Comments" is a real
  // leaf section with zero source_units) — try each in declared order rather
  // than assuming the first always works.
  let evidence = null;
  for (const facetId of facetIds) {
    const facet = facetsById.get(facetId);
    if (!facet) throw new Error(`${manifest.manifest_id}: facet ${facetId} not found in overlay`);
    try {
      evidence = evidenceForFacet(bundle, sectionsById, facet);
      break;
    } catch (error) {
      continue;
    }
  }
  // A parent section can carry its own directly-filed content (Stage D's
  // "one census bucket" rule) that no child facet represents — e.g.
  // ich_s6_r1 §5's own paragraph, when every §5.x child sub-section turns
  // out to have zero curated units of its own. Fall back to the manifest's
  // own target section before giving up.
  if (!evidence && manifest.target.type === "section") {
    try {
      evidence = firstEvidenceInSubtree(bundle, sectionsById, manifest.target.id);
    } catch (error) {
      evidence = null;
    }
  }
  if (!evidence) throw new Error(`${manifest.manifest_id}: no facet among [${facetIds.join(", ")}], nor its own target section, has any resolvable evidence`);

  const manifestKey = manifest.manifest_id.split(".manifest.").pop();
  return {
    summary_id: `${overlay.document_id}.sem.summary.${manifestKey}`,
    target: manifest.target,
    summary_kind: summaryKind,
    facet_ids: facetIds,
    sentence_roles: ["main_points"],
    evidence_refs: [evidence],
    review_status: "needs_review"
  };
}

function buildSalienceProfile(overlay, manifest) {
  const facetIds = manifestFacetIds(manifest);
  if (facetIds.length < SALIENCE_MIN_FACETS) return null;
  if (salienceAlreadyCovers(overlay, manifest)) return null;

  const facetsById = new Map(overlay.facets.map((facet) => [facet.facet_id, facet]));
  const tierCounters = { primary: 0, supporting: 0, detail: 0 };
  const items = facetIds.map((facetId) => {
    const facet = facetsById.get(facetId);
    if (!facet) throw new Error(`${manifest.manifest_id}: facet ${facetId} not found in overlay`);
    const mapped = SALIENCE_BY_ROLE[facet.semantic_role] || { tier: "supporting", rationale_code: "governing_text" };
    tierCounters[mapped.tier] += 1;
    return { facet_id: facetId, tier: mapped.tier, display_order: tierCounters[mapped.tier], rationale_code: mapped.rationale_code };
  });

  const manifestKey = manifest.manifest_id.split(".manifest.").pop();
  return {
    profile_id: `${overlay.document_id}.sem.profile.${manifestKey}`,
    target_id: manifest.target.id,
    context: SALIENCE_CONTEXT_BY_INTENT[manifest.answer_intent] || "detail",
    items,
    review_status: "needs_review"
  };
}

function main() {
  const bundles = loadBundles();
  let summariesAdded = 0;
  let salienceAdded = 0;

  for (const name of fs.readdirSync(OVERLAY_DIR).filter((item) => item.endsWith(".json")).sort()) {
    const file = path.join(OVERLAY_DIR, name);
    const overlay = readJson(file);
    const bundle = bundles.get(overlay.document_id);
    const sectionsById = new Map(bundle.sections.map((section) => [section.section_id, section]));

    for (const manifest of overlay.coverage_manifests) {
      const summary = buildSummarySpec(overlay, bundle, sectionsById, manifest);
      if (summary) {
        overlay.summary_specs.push(summary);
        summariesAdded += 1;
      }
      const salience = buildSalienceProfile(overlay, manifest);
      if (salience) {
        overlay.salience_profiles.push(salience);
        salienceAdded += 1;
      }
    }

    overlay.summary_specs.sort((a, b) => a.summary_id.localeCompare(b.summary_id));
    overlay.salience_profiles.sort((a, b) => a.profile_id.localeCompare(b.profile_id));
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
    console.log(`${overlay.document_id}: summary_specs=${overlay.summary_specs.length}, salience_profiles=${overlay.salience_profiles.length}`);
  }

  console.log(`Stage F: added ${summariesAdded} summary_spec(s), ${salienceAdded} salience_profile(s).`);
}

if (require.main === module) main();

module.exports = { SUMMARY_KIND_BY_INTENT, SALIENCE_BY_ROLE, SALIENCE_MIN_FACETS, summaryAlreadyCovers, salienceAlreadyCovers };
