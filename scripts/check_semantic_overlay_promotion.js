/**
 * scripts/check_semantic_overlay_promotion.js
 * Read-only readiness worksheet for docs/derived_semantic_layer.md §11's
 * "활성화 승인 기준" (Stage C activation criteria), evaluated per manifest
 * and per comparison binding. Never writes review_status anywhere — §11
 * mixes objectively-checkable facts (schema/validator pass, no stale
 * objects) with outcome judgments that fundamentally cannot be verified
 * before Stage C exists to produce the outcome (whether the 50-question
 * audit's 적합 count actually goes up), so promotion stays a human
 * decision. What this script automates is: checking everything that CAN
 * be checked mechanically today, and separating that cleanly from what
 * still needs a human to look at the Stage C wiring plus a fresh audit
 * pass.
 */
const fs = require("fs");
const path = require("path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");

const ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = path.join(ROOT, "logs", "runtime");

// §11 criteria this script cannot evaluate on its own, listed once here
// rather than duplicated per manifest — they depend on Stage C existing
// (an actual served answer to judge) or on a human audit pass.
const PENDING_HUMAN_CRITERIA = [
  "50문항 감사에서 전체 적합 응답 수가 증가하고 기존 적합 응답이 회귀하지 않는다 (Stage C 구현 후 재감사 필요)",
  "각 생성 문장과 UI 근거 카드가 document, section, record/source unit으로 추적된다 (Stage C UI 필요)"
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

function manifestExerciseStats(manifestId, auditData) {
  const statusCounts = new Map();
  let exercised = 0;
  for (const entry of auditData || []) {
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
  return "ready_for_human_review — mechanical checks pass; still needs the human-judgment §11 criteria below before promotion";
}

function main() {
  const validation = validateSemanticOverlays();
  const validatorOk = validation.ok;
  const store = loadSemanticOverlayStore();
  const audit = findLatestShadowAudit();

  console.log(`Schema + validator: ${validatorOk ? "PASS" : "FAIL"} (npm run validate:semantic)`);
  if (!validatorOk) {
    for (const error of validation.errors) console.log(`  - ${error}`);
  }
  console.log(`Stale documents excluded from the store right now: ${store.staleDocumentIds.size === 0 ? "none" : [...store.staleDocumentIds].join(", ")}`);
  if (audit) {
    console.log(`Latest shadow audit replay: ${path.relative(ROOT, audit.file)} (${audit.data.length} questions)`);
  } else {
    console.log("Latest shadow audit replay: none found — run `npm run shadow:semantic` first for exercise counts below.");
  }
  console.log("");

  for (const [documentId, overlay] of store.overlaysByDocumentId) {
    const stale = store.staleDocumentIds.has(documentId);
    for (const manifest of overlay.coverage_manifests || []) {
      const stats = audit ? manifestExerciseStats(manifest.manifest_id, audit.data) : { exercised: 0, statusCounts: {} };
      console.log(`manifest ${manifest.manifest_id} (${documentId}, review_status=${manifest.review_status})`);
      console.log(`  recommendation: ${recommendation({ validatorOk, stale, exercised: stats.exercised })}`);
      console.log(`  exercised in latest replay: ${stats.exercised} question(s), status breakdown: ${JSON.stringify(stats.statusCounts)}`);
      for (const criterion of PENDING_HUMAN_CRITERIA) console.log(`  pending human judgment: ${criterion}`);
      console.log("");
    }
    for (const binding of overlay.comparison_bindings || []) {
      const stats = audit ? bindingExerciseStats(binding.axis_id, audit.data) : { exercised: 0, bothSidesEvidenced: 0 };
      console.log(`comparison_binding ${binding.binding_id} (${documentId}, axis=${binding.axis_id}, review_status=${binding.review_status})`);
      console.log(`  recommendation: ${recommendation({ validatorOk, stale, exercised: stats.exercised })}`);
      console.log(`  exercised in latest replay: ${stats.exercised} question(s), both_sides_evidenced in ${stats.bothSidesEvidenced} of those`);
      for (const criterion of PENDING_HUMAN_CRITERIA) console.log(`  pending human judgment: ${criterion}`);
      console.log("");
    }
  }
}

if (require.main === module) main();

module.exports = { findLatestShadowAudit, manifestExerciseStats, bindingExerciseStats, recommendation };
