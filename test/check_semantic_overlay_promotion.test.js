const assert = require("node:assert/strict");
const test = require("node:test");

const {
  manifestExerciseStats,
  bindingExerciseStats,
  recommendation
} = require("../scripts/check_semantic_overlay_promotion");

test("manifestExerciseStats counts only entries whose manifests array contains this manifest_id", () => {
  const auditData = [
    { semantic_plan: { manifests: [{ manifest_id: "a", status: "complete" }] } },
    { semantic_plan: { manifests: [{ manifest_id: "a", status: "partial" }] } },
    { semantic_plan: { manifests: [{ manifest_id: "b", status: "complete" }] } },
    { semantic_plan: { applicable: false } }
  ];
  const stats = manifestExerciseStats("a", auditData);
  assert.equal(stats.exercised, 2);
  assert.deepEqual(stats.statusCounts, { complete: 1, partial: 1 });
});

test("manifestExerciseStats returns zero exercise for a manifest never present in the audit", () => {
  const stats = manifestExerciseStats("never_appears", [{ semantic_plan: { manifests: [] } }]);
  assert.equal(stats.exercised, 0);
  assert.deepEqual(stats.statusCounts, {});
});

test("bindingExerciseStats counts axis occurrences and both_sides_evidenced separately", () => {
  const auditData = [
    { semantic_plan: { comparison: [{ axis_id: "x", both_sides_evidenced: true }] } },
    { semantic_plan: { comparison: [{ axis_id: "x", both_sides_evidenced: false }] } },
    { semantic_plan: { comparison: null } }
  ];
  const stats = bindingExerciseStats("x", auditData);
  assert.equal(stats.exercised, 2);
  assert.equal(stats.bothSidesEvidenced, 1);
});

test("recommendation blocks on a failing validator regardless of everything else", () => {
  const result = recommendation({ validatorOk: false, stale: false, exercised: 5 });
  assert.match(result, /^blocked/);
});

test("recommendation blocks on staleness even when the validator passes", () => {
  const result = recommendation({ validatorOk: true, stale: true, exercised: 5 });
  assert.match(result, /^blocked/);
});

test("recommendation reports insufficient_evidence when never exercised, distinct from blocked", () => {
  const result = recommendation({ validatorOk: true, stale: false, exercised: 0 });
  assert.match(result, /^insufficient_evidence/);
});

test("recommendation reports ready_for_human_review only once mechanical checks pass and it's been exercised", () => {
  const result = recommendation({ validatorOk: true, stale: false, exercised: 3 });
  assert.match(result, /^ready_for_human_review/);
});
