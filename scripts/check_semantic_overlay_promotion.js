/**
 * scripts/check_semantic_overlay_promotion.js
 * Read-only readiness worksheet for docs/derived_semantic_layer.md §11's
 * "활성화 승인 기준" (Stage C activation criteria), evaluated per manifest
 * and per comparison binding. Never writes review_status anywhere. Stage D
 * recognizes engineering completion independently from final reviewed
 * promotion: when a live 50-question audit cannot run, implementation may
 * be complete while promotion remains pending.
 */
const fs = require("fs");
const path = require("path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");

const ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = path.join(ROOT, "logs", "runtime");

const PENDING_REVIEW_CRITERIA = [
  "live 50문항 감사에서 부적합 응답 수가 증가하지 않고 기존 적합 응답이 회귀하지 않는다",
  "각 생성 문장과 UI 근거 카드가 document, section, record/source unit으로 추적된다"
];

function findLatestShadowAudit() {
  if (!fs.existsSync(RUNTIME_DIR)) return null;
  const candidates = fs.readdirSync(RUNTIME_DIR)
    .filter((name) => /^semantic_shadow_50_\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort();
  if (candidates.length === 0) return null;
  const file = path.join(RUNTIME_DIR, candidates[candidates.length - 1]);
  return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) };
}

function readAudit(file) {
  const resolved = path.resolve(file);
  return { file: resolved, data: JSON.parse(fs.readFileSync(resolved, "utf8")) };
}

function findAuditInputs() {
  const explicit = String(process.env.GUIDELINE_PROMOTION_AUDIT_INPUTS || "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit.map(readAudit);
  const inputs = [];
  const latest = findLatestShadowAudit();
  if (latest) inputs.push(latest);
  const stageD = path.join(RUNTIME_DIR, "semantic_stage_d_audit.json");
  if (fs.existsSync(stageD)) inputs.push(readAudit(stageD));
  return inputs;
}

function manifestExerciseStats(manifestId, auditData) {
  const statusCounts = new Map();
  let exercised = 0;
  for (const entry of auditData || []) {
    if (entry.manifest_id === manifestId) {
      if (!entry.shadow_exercised) continue;
      exercised += 1;
      const status = entry.selected_as_best_match ? "stage_d_selected" : "stage_d_shadow_only";
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      continue;
    }
    const manifest = (entry.semantic_plan && entry.semantic_plan.manifests || [])
      .find((m) => m.manifest_id === manifestId);
    if (!manifest) continue;
    exercised += 1;
    statusCounts.set(manifest.status, (statusCounts.get(manifest.status) || 0) + 1);
  }
  return { exercised, statusCounts: Object.fromEntries(statusCounts) };
}

function bindingExerciseStats(axisId, auditData) {
  let exercised = 0;
  let bothSidesEvidenced = 0;
  for (const entry of auditData || []) {
    const axis = (entry.semantic_plan && entry.semantic_plan.comparison || [])
      .find((a) => a.axis_id === axisId);
    if (!axis) continue;
    exercised += 1;
    if (axis.both_sides_evidenced) bothSidesEvidenced += 1;
  }
  return { exercised, bothSidesEvidenced };
}

function recommendation({ validatorOk, stale, exercised }) {
  if (!validatorOk) return "blocked — validator fails, see errors above";
  if (stale) return "blocked — source_bundle_sha256 is stale against the current core bundle";
  if (exercised === 0) return "insufficient_evidence — never appeared in the last shadow audit replay; run npm run shadow:semantic against real questions covering this scope first";
  return "ready_for_review — mechanical checks pass; final reviewed promotion still requires the criteria below";
}

function main() {
  const validation = validateSemanticOverlays();
  const validatorOk = validation.ok;
  const store = loadSemanticOverlayStore();
  const audits = findAuditInputs();
  const auditData = audits.flatMap((audit) => audit.data);

  console.log(`Schema + validator: ${validatorOk ? "PASS" : "FAIL"} (npm run validate:semantic)`);
  if (!validatorOk) {
    for (const error of validation.errors) console.log(`  - ${error}`);
  }
  console.log(`Stale documents excluded from the store right now: ${store.staleDocumentIds.size === 0 ? "none" : [...store.staleDocumentIds].join(", ")}`);
  if (audits.length > 0) {
    console.log(`Audit inputs: ${audits.map((audit) => `${path.relative(ROOT, audit.file)} (${audit.data.length})`).join(", ")}`);
  } else {
    console.log("Audit inputs: none — set GUIDELINE_PROMOTION_AUDIT_INPUTS or run the Stage D/shadow audits first.");
  }
  const liveAudit = process.env.GUIDELINE_PROMOTION_LIVE_AUDIT_INPUT
    ? path.resolve(process.env.GUIDELINE_PROMOTION_LIVE_AUDIT_INPUT)
    : null;
  const liveAuditAvailable = Boolean(liveAudit && fs.existsSync(liveAudit));
  const engineeringComplete = validatorOk && store.staleDocumentIds.size === 0 && auditData.some((entry) => entry.manifest_id && entry.shadow_exercised);
  const allReviewed = [...store.overlaysByDocumentId.values()].every((overlay) =>
    ["facets", "coverage_manifests", "comparison_bindings"].every((collection) =>
      (overlay[collection] || []).every((item) => item.review_status === "reviewed")
    )
  );
  const finalPromotionComplete = engineeringComplete && liveAuditAvailable && allReviewed;
  console.log(`Engineering completion: ${engineeringComplete ? "complete" : "pending"}`);
  console.log(`Final reviewed promotion: ${finalPromotionComplete ? "complete" : liveAuditAvailable ? "reviewable (live audit supplied)" : "pending (live 50-question audit unavailable)"}`);
  console.log("");

  for (const [documentId, overlay] of store.overlaysByDocumentId) {
    const stale = store.staleDocumentIds.has(documentId);
    for (const manifest of overlay.coverage_manifests || []) {
      const stats = manifestExerciseStats(manifest.manifest_id, auditData);
      console.log(`manifest ${manifest.manifest_id} (${documentId}, review_status=${manifest.review_status})`);
      console.log(`  recommendation: ${finalPromotionComplete ? "reviewed — activation gates complete" : recommendation({ validatorOk, stale, exercised: stats.exercised })}`);
      console.log(`  exercised in supplied audits: ${stats.exercised} question(s), status breakdown: ${JSON.stringify(stats.statusCounts)}`);
      if (!finalPromotionComplete) for (const criterion of PENDING_REVIEW_CRITERIA) console.log(`  pending review: ${criterion}`);
      console.log("");
    }
    for (const binding of overlay.comparison_bindings || []) {
      const stats = bindingExerciseStats(binding.axis_id, auditData);
      console.log(`comparison_binding ${binding.binding_id} (${documentId}, axis=${binding.axis_id}, review_status=${binding.review_status})`);
      console.log(`  recommendation: ${finalPromotionComplete ? "reviewed — activation gates complete" : recommendation({ validatorOk, stale, exercised: stats.exercised })}`);
      console.log(`  exercised in supplied audits: ${stats.exercised} question(s), both_sides_evidenced in ${stats.bothSidesEvidenced} of those`);
      if (!finalPromotionComplete) for (const criterion of PENDING_REVIEW_CRITERIA) console.log(`  pending review: ${criterion}`);
      console.log("");
    }
  }
}

if (require.main === module) main();

module.exports = { findLatestShadowAudit, findAuditInputs, manifestExerciseStats, bindingExerciseStats, recommendation };
