const test = require("node:test");
const assert = require("node:assert/strict");

const { runApplicabilityEval, checkOne, summarize } = require("../engine/eval_applicability");

test("checkOne passes when verdict and conditional_reason both match", () => {
  const checks = checkOne(
    { expect_verdict: "conditional", expect_conditional_reason: "partial_scope_mismatch" },
    { verdict: "conditional", conditional_reason: "partial_scope_mismatch" },
    null
  );
  assert.ok(checks.every((c) => c.pass));
});

test("checkOne fails verdict_matches when the verdict differs", () => {
  const checks = checkOne({ expect_verdict: "applicable" }, { verdict: "conditional", conditional_reason: "partial_scope_mismatch" }, null);
  assert.equal(checks.find((c) => c.name === "verdict_matches").pass, false);
});

test("checkOne only checks conditional_reason when the fixture case declares an expectation for it", () => {
  const checks = checkOne({ expect_verdict: "applicable" }, { verdict: "applicable", conditional_reason: null }, null);
  assert.equal(checks.length, 1);
});

test("checkOne reports a thrown error as a failing no_error check rather than crashing", () => {
  const checks = checkOne({ expect_verdict: "applicable" }, undefined, "unknown rule_id \"bogus\"");
  assert.equal(checks.length, 1);
  assert.equal(checks[0].pass, false);
  assert.match(checks[0].detail, /unknown rule_id/);
});

test("summarize counts total/passed/failures correctly", () => {
  const results = [
    { id: "a", checks: [{ pass: true }] },
    { id: "b", checks: [{ pass: false }] }
  ];
  const summary = summarize(results);
  assert.equal(summary.total, 2);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failures.length, 1);
  assert.equal(summary.failures[0].id, "b");
});

test("runApplicabilityEval against the real fixture and real archive currently passes end to end (regression guard, no LLM call)", () => {
  const { summary } = runApplicabilityEval();
  assert.equal(summary.total, 30);
  assert.equal(summary.passed, 30, `unexpected failures: ${JSON.stringify(summary.failures)}`);
});
