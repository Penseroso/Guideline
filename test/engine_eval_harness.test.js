const test = require("node:test");
const assert = require("node:assert/strict");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runEval, checkOne, summarize, recordEvalHistory } = require("../engine/eval_harness");

function tempHistoryPath() {
  return path.join(os.tmpdir(), `eval_history_test_${Date.now()}_${Math.random().toString(36).slice(2)}.jsonl`);
}

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

// M5 plan Phase 1 items 10/11 (docs/test_record.md Entry 007/008):
// claim_grounding_rate is a distinct, claim-level metric from
// citation_precision (a question-level substring check) — this is the
// metric that actually would have caught the comparison/amendment
// grounding defects citation_precision missed by construction.
test("summarize computes claim_grounding_rate separately from citation_precision, at the claim level", () => {
  const results = [
    {
      expected: { expect_answered: true },
      checks: [{ pass: true }],
      actual: { answered: true, claims: [{ source_unit_id: "a.1" }, { source_unit_id: "a.2" }] }
    },
    {
      expected: { expect_answered: true },
      checks: [{ pass: true }],
      actual: { answered: true, claims: [{ source_unit_id: null }] }
    }
  ];
  const summary = summarize(results);
  assert.equal(summary.claims_checked, 3);
  assert.equal(summary.claim_grounding_rate, 2 / 3);
});

test("summarize returns null claim_grounding_rate when no answered case carries any claims (not 0 or NaN)", () => {
  const summary = summarize([{ expected: { expect_answered: false }, checks: [{ pass: true }], actual: { answered: false } }]);
  assert.equal(summary.claim_grounding_rate, null);
  assert.equal(summary.claims_checked, 0);
});

test("summarize tolerates results with no `actual` field at all (synthetic/minimal fixtures)", () => {
  const summary = summarize([{ expected: { expect_answered: true }, checks: [{ pass: true }] }]);
  assert.equal(summary.claim_grounding_rate, null);
});

// M5 Phase 5 (docs/test_record.md Entry 008): eval_history.jsonl is the
// drift-tracking record (product_roadmap.md §2.6 item 8) — a file, not a
// new monitoring system. Appends, never overwrites.
test("recordEvalHistory appends one line with engine_version, commit, and the three headline metrics", () => {
  const historyPath = tempHistoryPath();
  try {
    const summary = { total: 24, passed: 24, citation_precision: 1, claim_grounding_rate: 1, refusal_correctness: 1 };
    const entry = recordEvalHistory(summary, { optionB: false, historyPath });
    assert.ok(entry.timestamp);
    assert.equal(entry.total, 24);
    assert.equal(entry.citation_precision, 1);
    assert.equal(entry.claim_grounding_rate, 1);
    assert.equal(entry.option_b, false);

    const lines = fs.readFileSync(historyPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).total, 24);
  } finally {
    fs.rmSync(historyPath, { force: true });
  }
});

// M5 plan Decision Point 3: a status:"known_gap" fixture entry is a
// tracked, currently-failing case — excluded from the pass/fail gate
// (never blocks CI) but still counted and reported separately.
test("a status:'known_gap' entry is excluded from total/passed/citation_precision but reported as known_gaps", () => {
  const results = [
    { expected: { expect_answered: true }, checks: [{ pass: true }], actual: { answered: true, claims: [] } },
    { expected: { expect_answered: true, status: "known_gap" }, checks: [{ pass: false }], actual: { answered: false, claims: [] } }
  ];
  const summary = summarize(results);
  assert.equal(summary.total, 1, "known_gap case must not count toward total");
  assert.equal(summary.passed, 1);
  assert.equal(summary.citation_precision, 1);
  assert.equal(summary.known_gaps, 1);
  assert.equal(summary.failures.length, 0, "a known_gap failure must not appear in the gated failures list");
});

test("recordEvalHistory appends across multiple calls rather than overwriting", () => {
  const historyPath = tempHistoryPath();
  try {
    recordEvalHistory({ total: 24, passed: 22, citation_precision: 1, claim_grounding_rate: 1, refusal_correctness: 0.33 }, { optionB: true, historyPath });
    recordEvalHistory({ total: 24, passed: 24, citation_precision: 1, claim_grounding_rate: 1, refusal_correctness: 1 }, { optionB: true, historyPath });
    const lines = fs.readFileSync(historyPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).refusal_correctness, 0.33);
    assert.equal(JSON.parse(lines[1]).refusal_correctness, 1);
  } finally {
    fs.rmSync(historyPath, { force: true });
  }
});
