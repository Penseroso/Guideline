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
async function runEval({ fixturePath = DEFAULT_FIXTURE, records, index, client, store } = {}) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  let answerableRecords = records;
  let answerableIndex = index;
  if (!answerableRecords) {
    ({ records: answerableRecords, index: answerableIndex } = loadStore());
  }

  const results = [];
  for (const q of fixture.questions) {
    const result = await answer(q.question, answerableRecords, { client, store, index: answerableIndex });
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

/**
 * M5 Phase 5 (history/verification/engine_test_record_through_2026-08-28.md Entry 008, Decision Point 3): a
 * `status: "known_gap"` fixture entry is a currently-failing case
 * promoted from real user feedback (scripts/promote_feedback_to_eval.js)
 * — by definition the engine cannot answer it correctly today. It's
 * excluded from the pass/fail gate (it would otherwise permanently fail
 * CI for a known, tracked, not-yet-fixed coverage gap) but still run and
 * reported separately as `known_gaps`, so it stays visible instead of
 * silently disappearing from the fixture.
 */
function isKnownGap(expected) {
  return expected && expected.status === "known_gap";
}

function summarize(results) {
  const gapResults = results.filter((r) => isKnownGap(r.expected));
  const gatedResults = results.filter((r) => !isKnownGap(r.expected));
  const total = gatedResults.length;
  const allPass = (r) => r.checks.every((c) => c.pass);

  const refusalCases = gatedResults.filter((r) => r.expected.expect_answered === false);
  const answerCases = gatedResults.filter((r) => r.expected.expect_answered === true);

  const refusalCorrect = refusalCases.filter(allPass).length;
  // "citation precision" is a QUESTION-level check: does the whole answer
  // text contain the one expected citation substring somewhere. It does
  // NOT verify every individual claim in a multi-claim answer (a
  // comparison, an amendment, a list) — a question can pass this check
  // while containing other, completely uncited content elsewhere in the
  // same answer. This is exactly how the comparison/amendment grounding
  // defects shipped invisibly under a reported 100% here (verified live,
  // history/verification/engine_test_record_through_2026-08-28.md Entry 007; see claim_grounding_rate below for the
  // metric that actually checks what this comment used to claim it did).
  const citationPrecise = answerCases.filter(allPass).length;

  // claim_grounding_rate: the real per-claim invariant (M5 plan Phase 1
  // item 10/11) — of every claim across every answered case, what
  // fraction have a source_unit_id that resolves in the archive. Distinct
  // from citation_precision: this can be 100% while citation_precision is
  // lower (a correct claim, worded differently than the fixture's exact
  // expected substring), and — before the Phase 1 fixes — citation_precision
  // could read 100% while this was well below it (uncited claims never
  // touched by the expected-substring check at all).
  const answeredResults = gatedResults.filter((r) => r.actual && r.actual.answered);
  const allClaims = answeredResults.flatMap((r) => r.actual.claims || []);
  const groundedClaims = allClaims.filter((c) => c.source_unit_id);
  const claimGroundingRate = allClaims.length ? groundedClaims.length / allClaims.length : null;

  return {
    total,
    passed: gatedResults.filter(allPass).length,
    refusal_correctness: refusalCases.length ? refusalCorrect / refusalCases.length : null,
    citation_precision: answerCases.length ? citationPrecise / answerCases.length : null,
    claim_grounding_rate: claimGroundingRate,
    claims_checked: allClaims.length,
    known_gaps: gapResults.length,
    failures: gatedResults.filter((r) => !allPass(r)).map((r) => ({ id: r.id, question: r.question, checks: r.checks }))
  };
}

async function main() {
  // --option-b: also exercise the Option B (grounded RAG) fallback path,
  // which this harness has otherwise never run — main() previously always
  // called runEval() with no {client, store}, so Option A was the only
  // path ever measured despite runEval() accepting both since M1
  // (history/verification/engine_test_record_through_2026-08-28.md Entry 007 Step 0).
  const useOptionB = process.argv.includes("--option-b");
  let client, store;
  if (useOptionB) {
    const { records } = loadStore();
    const { setUpOptionB } = require("./cli");
    ({ client, store } = setUpOptionB(records));
    if (!client) {
      console.error("--option-b requested but no LLM provider is configured (see .env.example).");
      process.exit(2);
    }
  }

  const { summary, results } = await runEval({ client, store });
  recordEvalHistory(summary, { optionB: useOptionB });
  console.log(`Eval: ${summary.passed}/${summary.total} passed.${useOptionB ? " (Option B enabled)" : ""}`);
  console.log(`Citation precision (answer-expected cases, question-level substring check): ${formatPct(summary.citation_precision)}`);
  console.log(`Claim grounding rate (claim-level, every citation resolves in the archive, ${summary.claims_checked} claims checked): ${formatPct(summary.claim_grounding_rate)}`);
  console.log(`Refusal correctness (refusal-expected cases): ${formatPct(summary.refusal_correctness)}`);
  if (summary.known_gaps > 0) {
    console.log(`Known gaps (excluded from the pass/fail gate, run and tracked anyway): ${summary.known_gaps}`);
  }
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

const EVAL_HISTORY_PATH = path.resolve(__dirname, "..", "logs", "eval_history.jsonl");

/**
 * M5 Phase 5 (history/verification/engine_test_record_through_2026-08-28.md Entry 008 / M5 plan §5-6): the drift
 * record product_roadmap.md §2.6 item 8 calls for ("tracked error rate
 * over time") — as a file, not a new monitoring system. Appends one line
 * per `npm run eval` run; never overwrites, so the file itself is the
 * history.
 */
function recordEvalHistory(summary, { optionB = false, historyPath = EVAL_HISTORY_PATH } = {}) {
  let engineVersion = null;
  try {
    engineVersion = require("../package.json").version;
  } catch {
    // package.json always exists in this repo; defensive only.
  }
  let commit = null;
  try {
    commit = require("child_process").execSync("git rev-parse --short HEAD", { cwd: path.resolve(__dirname, ".."), stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    // Not fatal — git may be unavailable in some environments.
  }
  const entry = {
    timestamp: new Date().toISOString(),
    engine_version: engineVersion,
    commit,
    option_b: optionB,
    total: summary.total,
    passed: summary.passed,
    citation_precision: summary.citation_precision,
    claim_grounding_rate: summary.claim_grounding_rate,
    refusal_correctness: summary.refusal_correctness
  };
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

if (require.main === module) {
  main();
}

module.exports = { runEval, checkOne, summarize, recordEvalHistory, EVAL_HISTORY_PATH };
