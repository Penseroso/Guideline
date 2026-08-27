const test = require("node:test");
const assert = require("node:assert/strict");

const { runEval, checkOne, summarize } = require("../engine/eval_harness");

test("checkOne passes when an expected refusal actually refuses", () => {
  const checks = checkOne({ expect_answered: false }, { answered: false, text: "Not found in the current archive." });
  assert.ok(checks.every((c) => c.pass));
});

test("checkOne fails the answered_matches_expectation check when an expected refusal actually answers", () => {
  const checks = checkOne({ expect_answered: false }, { answered: true, text: "some answer" });
  assert.equal(checks.find((c) => c.name === "answered_matches_expectation").pass, false);
});

test("checkOne verifies citation and text substrings only for answer-expected cases", () => {
  const expected = { expect_answered: true, expect_citation_contains: "M10 §3.2.5.2", expect_text_contains: "5" };
  const goodChecks = checkOne(expected, { answered: true, text: "5 replicates — M10 §3.2.5.2, p.14" });
  assert.ok(goodChecks.every((c) => c.pass));

  const badChecks = checkOne(expected, { answered: true, text: "something unrelated — S6 §2.1, p.9" });
  assert.ok(badChecks.some((c) => !c.pass));
});

test("summarize computes citation_precision and refusal_correctness separately", () => {
  const results = [
    { expected: { expect_answered: true }, checks: [{ pass: true }] },
    { expected: { expect_answered: true }, checks: [{ pass: false }] },
    { expected: { expect_answered: false }, checks: [{ pass: true }] }
  ];
  const summary = summarize(results);
  assert.equal(summary.total, 3);
  assert.equal(summary.citation_precision, 0.5);
  assert.equal(summary.refusal_correctness, 1);
});

test("summarize returns null (not 0 or NaN) for a metric with no applicable cases", () => {
  const summary = summarize([{ expected: { expect_answered: true }, checks: [{ pass: true }] }]);
  assert.equal(summary.refusal_correctness, null);
});

test("runEval against the real fixture and real pilot data currently passes end to end (regression guard)", async () => {
  const { summary } = await runEval();
  assert.equal(summary.total, 24);
  assert.equal(summary.passed, 24, `unexpected failures: ${JSON.stringify(summary.failures)}`);
  assert.equal(summary.citation_precision, 1);
  assert.equal(summary.refusal_correctness, 1);
});
