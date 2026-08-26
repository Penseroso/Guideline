const fs = require("fs");
const path = require("path");

const { loadStore } = require("./data_store");
const { evaluateRule } = require("./applicability");

const DEFAULT_FIXTURE = path.resolve(__dirname, "..", "test", "fixtures", "applicability_cases.json");

/**
 * Regression harness for the Applicability Engine (docs/schema.md
 * "Applicability Layer 0.1.0", docs/milestone_log.md M6) — the
 * evaluateRule()-side analogue of engine/eval_harness.js. Requires no LLM
 * call (evaluateRule is pure deterministic lookup over already-frozen
 * binding data), so this is free and safe to run in CI, same as
 * eval_harness.js's Option-A-only default.
 *
 * What this measures: "does the engine produce a consistent, correct
 * verdict given its current binding data" — NOT "are the underlying
 * bindings regulatorily correct" (that's the binding pipeline's own
 * entailment/full-scope gates, engine/binding_agent.js). See
 * test/fixtures/applicability_cases.json's own header for why this
 * fixture is a regression check, not a golden-ground-truth eval.
 */
function runApplicabilityEval({ fixturePath = DEFAULT_FIXTURE, index } = {}) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const resolvedIndex = index || loadStore().index;

  const results = fixture.cases.map((c) => {
    let actual;
    let error = null;
    try {
      actual = evaluateRule(c.rule_id, c.context, { index: resolvedIndex });
    } catch (e) {
      error = e.message;
    }
    return { id: c.id, expected: c, actual, error, checks: checkOne(c, actual, error) };
  });

  return { results, summary: summarize(results) };
}

function checkOne(expected, actual, error) {
  if (error) {
    return [{ name: "no_error", pass: false, detail: error }];
  }
  const checks = [{ name: "verdict_matches", pass: actual.verdict === expected.expect_verdict, detail: actual.verdict }];
  if (expected.expect_conditional_reason !== undefined) {
    checks.push({
      name: "conditional_reason_matches",
      pass: actual.conditional_reason === expected.expect_conditional_reason,
      detail: actual.conditional_reason
    });
  }
  return checks;
}

function summarize(results) {
  const allPass = (r) => r.checks.every((c) => c.pass);
  return {
    total: results.length,
    passed: results.filter(allPass).length,
    failures: results.filter((r) => !allPass(r)).map((r) => ({ id: r.id, checks: r.checks }))
  };
}

function main() {
  const { summary } = runApplicabilityEval();
  console.log(`Applicability eval: ${summary.passed}/${summary.total} passed.`);
  if (summary.failures.length > 0) {
    console.log("\nFailures:");
    for (const f of summary.failures) {
      console.log(`- ${f.id}: ${f.checks.filter((c) => !c.pass).map((c) => `${c.name} (got ${JSON.stringify(c.detail)})`).join(", ")}`);
    }
  }
  process.exit(summary.failures.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { runApplicabilityEval, checkOne, summarize };
