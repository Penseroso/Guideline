const fs = require("fs");
const path = require("path");

const { loadStore } = require("./data_store");
const { answer } = require("./query_router");

const DEFAULT_FIXTURE = path.resolve(__dirname, "..", "test", "fixtures", "eval_questions.json");

/**
 * Sampling-based drift monitoring (product_roadmap.md §2.5.1, §2.6
 * item 8) — moved up to M1 because it's the only systemic-error
 * detector once no human reads every record. Runs each gold question
 * through the real router (Option A only unless a client/store is
 * passed in) and reports two headline metrics from TPP §1.5:
 * citation precision and refusal correctness — plus the underlying
 * per-question detail so a failure is traceable to which check broke.
 */
async function runEval({ fixturePath = DEFAULT_FIXTURE, records, client, store } = {}) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const answerableRecords = records || loadStore().records;

  const results = [];
  for (const q of fixture.questions) {
    const result = await answer(q.question, answerableRecords, { client, store });
    results.push({ id: q.id, question: q.question, expected: q, actual: result, checks: checkOne(q, result) });
  }
  return { results, summary: summarize(results) };
}

function checkOne(expected, actual) {
  const checks = [];

  checks.push({
    name: "answered_matches_expectation",
    pass: actual.answered === expected.expect_answered
  });

  if (expected.expect_answered) {
    if (expected.expect_citation_contains) {
      checks.push({
        name: "citation_contains",
        pass: actual.answered && actual.text.includes(expected.expect_citation_contains),
        detail: expected.expect_citation_contains
      });
    }
    if (expected.expect_text_contains) {
      checks.push({
        name: "text_contains",
        pass: actual.answered && actual.text.includes(expected.expect_text_contains),
        detail: expected.expect_text_contains
      });
    }
  }

  return checks;
}

function summarize(results) {
  const total = results.length;
  const allPass = (r) => r.checks.every((c) => c.pass);

  const refusalCases = results.filter((r) => r.expected.expect_answered === false);
  const answerCases = results.filter((r) => r.expected.expect_answered === true);

  const refusalCorrect = refusalCases.filter(allPass).length;
  // "citation precision" here is the fraction of answer-expected cases
  // whose citation/text checks all passed — i.e. every claim that was
  // supposed to carry a supported citation actually did (TPP §1.5).
  const citationPrecise = answerCases.filter(allPass).length;

  return {
    total,
    passed: results.filter(allPass).length,
    refusal_correctness: refusalCases.length ? refusalCorrect / refusalCases.length : null,
    citation_precision: answerCases.length ? citationPrecise / answerCases.length : null,
    failures: results.filter((r) => !allPass(r)).map((r) => ({ id: r.id, question: r.question, checks: r.checks }))
  };
}

async function main() {
  const { summary, results } = await runEval();
  console.log(`Eval: ${summary.passed}/${summary.total} passed.`);
  console.log(`Citation precision (answer-expected cases): ${formatPct(summary.citation_precision)}`);
  console.log(`Refusal correctness (refusal-expected cases): ${formatPct(summary.refusal_correctness)}`);
  if (summary.failures.length > 0) {
    console.log("\nFailures:");
    for (const f of summary.failures) {
      console.log(`- ${f.id} (${JSON.stringify(f.question)}): ${f.checks.filter((c) => !c.pass).map((c) => c.name).join(", ")}`);
    }
  }
  for (const r of results) {
    if (r.expected.note) console.log(`[note] ${r.id}: ${r.expected.note}`);
  }
  process.exit(summary.failures.length > 0 ? 1 : 0);
}

function formatPct(x) {
  return x === null ? "n/a" : `${Math.round(x * 100)}%`;
}

if (require.main === module) {
  main();
}

module.exports = { runEval, checkOne, summarize };
