/**
 * Deterministic verification of the semantic overlay's manifest/facet/
 * comparison-binding inventory. Authoring is section-driven in
 * build_semantic_manifests.js; this script independently checks the
 * emitted topology, record membership, inventory, and the routing audit
 * from audit_semantic_manifest_routing.js.
 */
const fs = require("node:fs");
const path = require("node:path");

const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { PARENT_SECTIONS, DOCUMENT_AREAS, LEAF_TOPICS } = require("./build_semantic_manifests");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_AUDIT = path.join(ROOT, "logs", "runtime", "semantic_stage_d_audit.json");
const OUTPUT_PATH = process.env.GUIDELINE_STAGE_D_VERIFICATION_OUTPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_D_VERIFICATION_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_d_verification.json");
const SPECIALIZED_MANIFEST_IDS = [
  "ich_m10.sem.manifest.run_acceptance",
  "fda_ada.sem.manifest.screening_performance"
];

function sameSet(actual, expected) {
  return actual.size === expected.size && [...actual].every((item) => expected.has(item));
}

function addCheck(checks, name, ok, detail) {
  checks.push({ name, ok, detail });
}

function verifyStageD() {
  const checks = [];
  const validation = validateSemanticOverlays();
  addCheck(checks, "semantic_schema_and_invariants", validation.ok, validation.errors);

  const store = loadSemanticOverlayStore();
  addCheck(checks, "no_stale_overlays", store.staleDocumentIds.size === 0, [...store.staleDocumentIds]);
  const overlays = [...store.overlaysByDocumentId.values()];
  const manifests = overlays.flatMap((overlay) => overlay.coverage_manifests || []);
  const manifestIds = new Set(manifests.map((manifest) => manifest.manifest_id));
  addCheck(checks, "final_unique_manifest_count", manifests.length === 55 && manifestIds.size === 55, {
    total: manifests.length,
    unique: manifestIds.size
  });

  for (const overlay of overlays) {
    const facetsById = new Map(overlay.facets.map((facet) => [facet.facet_id, facet]));
    for (const sectionId of PARENT_SECTIONS[overlay.document_id]) {
      const manifest = overlay.coverage_manifests.find((item) => item.target.type === "section" && item.target.id === sectionId);
      const actualScopes = new Set((manifest && manifest.coverage_groups || [])
        .flatMap((group) => group.facet_ids)
        .map((id) => facetsById.get(id) && facetsById.get(id).scope)
        .filter(Boolean));
      const expectedScopes = new Set(store.sectionIndex.childrenBySectionId.get(sectionId) || []);
      addCheck(checks, `parent_children:${sectionId}`, Boolean(manifest) && sameSet(actualScopes, expectedScopes), {
        actual: [...actualScopes], expected: [...expectedScopes]
      });
    }

    const documentManifest = overlay.coverage_manifests.find((item) => item.target.type === "document");
    const actualAreas = new Set((documentManifest && documentManifest.coverage_groups || [])
      .flatMap((group) => group.facet_ids)
      .map((id) => facetsById.get(id) && facetsById.get(id).scope)
      .filter(Boolean));
    const expectedAreas = new Set(DOCUMENT_AREAS[overlay.document_id]);
    addCheck(checks, `document_overview:${overlay.document_id}`, Boolean(documentManifest) && sameSet(actualAreas, expectedAreas), {
      actual: [...actualAreas], expected: [...expectedAreas]
    });

    for (const topic of LEAF_TOPICS[overlay.document_id] || []) {
      const id = `${overlay.document_id}.sem.manifest.${topic.key}`;
      const manifest = overlay.coverage_manifests.find((item) => item.manifest_id === id);
      const expectedMembers = new Set(topic.facets.flatMap((facet) => facet.members));
      const actualMembers = new Set((manifest && manifest.coverage_groups || [])
        .flatMap((group) => group.facet_ids)
        .flatMap((facetId) => (facetsById.get(facetId) || {}).member_record_ids || []));
      const wrongSections = [...actualMembers].filter((recordId) => store.sectionIndex.sectionIdByRecordId.get(recordId) !== topic.section);
      addCheck(checks, `leaf_members:${id}`, Boolean(manifest) && sameSet(actualMembers, expectedMembers) && wrongSections.length === 0, {
        members: actualMembers.size, wrong_sections: wrongSections
      });
    }
  }

  addCheck(checks, "independent_specialized_manifests", SPECIALIZED_MANIFEST_IDS.every((id) => manifestIds.has(id)), SPECIALIZED_MANIFEST_IDS);

  const auditPath = process.env.GUIDELINE_STAGE_D_AUDIT_INPUT
    ? path.resolve(process.env.GUIDELINE_STAGE_D_AUDIT_INPUT)
    : DEFAULT_AUDIT;
  let audit = [];
  if (fs.existsSync(auditPath)) audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  addCheck(checks, "post_authoring_manifest_audit", audit.length === 55 && audit.every((entry) => entry.shadow_exercised && entry.selected_as_best_match), {
    path: path.relative(ROOT, auditPath),
    total: audit.length,
    shadow_exercised: audit.filter((entry) => entry.shadow_exercised).length,
    served_selected: audit.filter((entry) => entry.selected_as_best_match).length
  });

  const reviewableObjects = overlays.flatMap((overlay) => [
    ...(overlay.facets || []),
    ...(overlay.coverage_manifests || []),
    ...(overlay.comparison_bindings || [])
  ]);
  const reviewStatuses = reviewableObjects.reduce((counts, item) => {
    counts[item.review_status] = (counts[item.review_status] || 0) + 1;
    return counts;
  }, {});
  const engineeringComplete = checks.every((check) => check.ok);
  const liveAuditPath = process.env.GUIDELINE_STAGE_D_LIVE_AUDIT_INPUT
    ? path.resolve(process.env.GUIDELINE_STAGE_D_LIVE_AUDIT_INPUT)
    : null;
  const liveAuditAvailable = Boolean(liveAuditPath && fs.existsSync(liveAuditPath));
  let liveAuditValid = false;
  if (liveAuditAvailable) {
    const liveAudit = JSON.parse(fs.readFileSync(liveAuditPath, "utf8"));
    liveAuditValid = liveAudit.length === 50 && new Set(liveAudit.map((item) => item.id)).size === 50 &&
      liveAudit.every((item) => !item.error && item.envelope && Array.isArray(item.envelope.claims) && item.envelope.envelope_version === "2.2.0");
  }
  return {
    stage: "D",
    generated_at: new Date().toISOString(),
    engineering_completion: engineeringComplete ? "complete" : "failed",
    final_reviewed_promotion: engineeringComplete && reviewStatuses.needs_review == null && liveAuditValid
      ? "eligible"
      : "pending",
    live_50_question_audit: liveAuditValid ? "valid" : liveAuditAvailable ? "invalid" : "not_available",
    review_status_counts: reviewStatuses,
    checks
  };
}

function main() {
  const report = verifyStageD();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  for (const check of report.checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}`);
  console.log(`Engineering completion: ${report.engineering_completion}`);
  console.log(`Final reviewed promotion: ${report.final_reviewed_promotion}`);
  console.log(`Live 50-question audit: ${report.live_50_question_audit}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
  if (report.engineering_completion !== "complete") process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { verifyStageD };
