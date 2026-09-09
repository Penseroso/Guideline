const fs = require("node:fs");
const path = require("node:path");

const { loadStore } = require("../engine/data_store");
const { summarizeItems, PRICING_SNAPSHOT } = require("./analyze_latency_cost_baseline");

const ROOT = path.resolve(__dirname, "..");
const CORPUS_PATH = path.join(ROOT, "data", "eval", "typed_questions.json");
const INPUT_PATH = process.env.GUIDELINE_TYPED_EVAL_OUTPUT
  ? path.resolve(process.env.GUIDELINE_TYPED_EVAL_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "typed_eval_50plus_raw_2026-09-09.json");
const OUTPUT_PATH = process.env.GUIDELINE_PRODUCTION_SLO_OUTPUT
  ? path.resolve(process.env.GUIDELINE_PRODUCTION_SLO_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "response_intelligence_workstream_7_slo_baseline.json");

function claimGroundingRate(claims, sourceUnits) {
  if (!claims || claims.length === 0) return null;
  const grounded = claims.filter((claim) => claim.source_unit_id && sourceUnits.has(claim.source_unit_id));
  return grounded.length / claims.length;
}

/**
 * "Retrieval completeness" here means: for a question expected to answer,
 * did the engine actually ground its answer in resolvable evidence at all
 * (non-empty claims, every claim's source_unit_id resolves)? This is
 * deliberately not "did it retrieve the exact expected document/section" --
 * the typed corpus (data/eval/typed_questions.json) does not carry a
 * clean, uniform expected-document field for every question (the 50Q-
 * sourced entries only had a free-text guideline/section reference column
 * in the source markdown table, not a parsed document_id), so a per-
 * question scope-match check isn't honestly computable for the whole set
 * yet. Documented as a real scope limitation, not silently overclaimed.
 */
function retrievalGrounded(envelope, sourceUnits) {
  if (!envelope || !envelope.answered) return null;
  const claims = envelope.claims || [];
  if (claims.length === 0) return false;
  return claims.every((claim) => claim.source_unit_id && sourceUnits.has(claim.source_unit_id));
}

function answerabilityMatch(item) {
  if (item.expect_answered === null || item.expect_answered === undefined) return null;
  if (!item.envelope) return false;
  return item.envelope.answered === item.expect_answered;
}

// The `ambiguous` type's real success signal is not envelope.answered
// (Workstream 3 already found the routing layer abstains and then an
// ordinary fallback attempt usually still answers) -- it is whether the
// deterministic tie-abstention telemetry event actually fired.
const ROUTING_ABSTENTION_EVENTS = new Set(["routing_ambiguous_tie", "routing_list_ambiguous_tie", "manifest_ambiguous_tie"]);

function routingAbstentionFired(item) {
  if (!item.expect_routing_abstention) return null;
  if (!item.envelope || !item.envelope.telemetry) return false;
  const events = (item.envelope.telemetry.events || []).map((e) => e.event);
  return events.some((event) => ROUTING_ABSTENTION_EVENTS.has(event));
}

/**
 * routingAbstentionFired only checks that the router *noticed* the
 * ambiguity internally -- it says nothing about whether the final answer
 * the user sees is actually safe. Workstream 3's own manifest-ambiguity
 * trace already showed the real failure mode this misses entirely: router
 * abstains correctly, then an ordinary fallback silently mixes claims from
 * two unrelated documents into one answer with no disclosure that the
 * question was ambiguous. Confirmed real and not just theoretical: of the
 * 19 `ambiguous`-type questions in the Workstream 7 baseline run, exactly
 * 1 (`ws3_ambiguous_tie.days`) did this -- a generated answer blending
 * fda_ada and ich_m10 content with no indication to the user.
 *
 * A final answer is judged unsafe here only when it silently presents
 * claims from more than one document as an undifferentiated answer:
 * `refusal` (correctly declined) and `comparison` mode (documents are
 * explicitly, separately labeled by design -- see
 * `docs/answer_suitability_evaluation.md`'s comparison contract) are both
 * safe regardless of document count; any other answered route/mode is
 * unsafe once its claims span more than one document.
 */
function crossScopeSafe(item) {
  if (!item.expect_routing_abstention) return null;
  if (!item.envelope) return false;
  const envelope = item.envelope;
  if (!envelope.answered || envelope.route === "refusal") return true;
  if (envelope.mode === "comparison") return true;
  const documentIds = new Set((envelope.claims || []).map((claim) => claim.record && claim.record.document_id).filter(Boolean));
  return documentIds.size <= 1;
}

function summarizeType(items, sourceUnits, pricing) {
  const withEnvelope = items.filter((item) => item.envelope && !item.error);
  const answerabilityChecks = withEnvelope.map(answerabilityMatch).filter((v) => v !== null);
  const groundingRates = withEnvelope.map((item) => claimGroundingRate(item.envelope.claims, sourceUnits)).filter((v) => v !== null);
  const retrievalChecks = withEnvelope.map((item) => retrievalGrounded(item.envelope, sourceUnits)).filter((v) => v !== null);
  const abstentionChecks = withEnvelope.map(routingAbstentionFired).filter((v) => v !== null);
  const crossScopeChecks = withEnvelope.map(crossScopeSafe).filter((v) => v !== null);
  const unsafeIds = withEnvelope.filter((item) => crossScopeSafe(item) === false).map((item) => item.id);

  const latencyCost = withEnvelope.every((item) => item.envelope.telemetry)
    ? summarizeItems(withEnvelope, pricing)
    : null;

  return {
    n: items.length,
    errors: items.length - withEnvelope.length,
    answerability: answerabilityChecks.length ? answerabilityChecks.filter(Boolean).length / answerabilityChecks.length : null,
    answerability_checked: answerabilityChecks.length,
    claim_grounding_rate: groundingRates.length ? groundingRates.reduce((a, b) => a + b, 0) / groundingRates.length : null,
    retrieval_grounded_rate: retrievalChecks.length ? retrievalChecks.filter(Boolean).length / retrievalChecks.length : null,
    routing_abstention_rate: abstentionChecks.length ? abstentionChecks.filter(Boolean).length / abstentionChecks.length : null,
    routing_abstention_checked: abstentionChecks.length,
    cross_scope_safe_rate: crossScopeChecks.length ? crossScopeChecks.filter(Boolean).length / crossScopeChecks.length : null,
    cross_scope_unsafe_ids: unsafeIds,
    latency_cost: latencyCost
  };
}

/**
 * The saved run's per-item fields (expect_answered, expect_routing_
 * abstention, ...) were captured at run time from whatever
 * data/eval/typed_questions.json looked like *then*. If the corpus
 * definition is refined afterward (as it was here -- the `ambiguous`
 * type's expectation was corrected after the first run), the saved
 * results would silently keep the stale field values unless re-run. This
 * overlays the *current* corpus definition by id instead of trusting only
 * what's embedded in the saved run, so a corpus refinement doesn't require
 * paying for a new full run just to take effect in the analysis.
 */
function withCurrentCorpusFields(results) {
  if (!fs.existsSync(CORPUS_PATH)) return results;
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8"));
  const byId = new Map(corpus.questions.map((q) => [q.id, q]));
  return results.map((result) => {
    const current = byId.get(result.id);
    return current ? { ...result, ...current, envelope: result.envelope, elapsed_ms: result.elapsed_ms, error: result.error } : result;
  });
}

function analyze() {
  const results = withCurrentCorpusFields(JSON.parse(fs.readFileSync(INPUT_PATH, "utf8")));
  const { records } = loadStore();
  const sourceUnits = new Set();
  for (const record of records) for (const id of record.source_unit_ids || []) sourceUnits.add(id);

  const byType = {};
  for (const item of results) {
    if (!byType[item.type]) byType[item.type] = [];
    byType[item.type].push(item);
  }

  const perType = Object.fromEntries(
    Object.entries(byType).sort(([a], [b]) => a.localeCompare(b))
      .map(([type, items]) => [type, summarizeType(items, sourceUnits, PRICING_SNAPSHOT)])
  );

  return {
    generated_at: new Date().toISOString(),
    source: path.relative(ROOT, INPUT_PATH),
    total_questions: results.length,
    overall: summarizeType(results, sourceUnits, PRICING_SNAPSHOT),
    by_type: perType
  };
}

/**
 * --check compares a report's per-type numbers against docs/production_slo.md's
 * frozen SLO_TARGETS below (kept in this file, not parsed from the prose
 * doc, so the gate is a real code check -- same pattern as
 * scripts/audit_answer_routing_hardening.js's exit-code gate). Update both
 * this constant and docs/production_slo.md together when the baseline is
 * deliberately revised; a silent drift between them is itself a bug.
 */
const SLO_TARGETS = {
  // Correctness dimensions: the Workstream 7 baseline measured 100% on
  // every checked type for these three, so the target is that same 100%
  // -- any regression below it is a real defect, not noise.
  min_answerability: 1.0,
  min_claim_grounding_rate: 1.0,
  min_retrieval_grounded_rate: 1.0,
  // The `ambiguous` type's real baseline was 18/19, not 1.0 -- one real
  // probe did not reproduce its tie on the Workstream 7 run (see the
  // report). The target is the measured baseline itself (kept as the
  // exact fraction, not a rounded decimal literal -- a rounded 0.9474
  // would be *higher* than the true 18/19 and falsely breach against the
  // very run that established it), not an undemonstrated 100%; a drop
  // *below* this is a regression, holding steady or improving is not a
  // breach.
  min_routing_abstention_rate: 18 / 19,
  // Unlike routing_abstention_rate (an internal-detection reliability
  // signal this repo currently treats as tolerable variance),
  // cross_scope_safe_rate is a user-facing safety invariant: once
  // ambiguity is detected, the final answer must never silently blend
  // claims from more than one document. The Workstream 7 baseline run
  // measured 18/19 here too (one real case,
  // ws3_ambiguous_tie.days, mixed fda_ada and ich_m10 content with no
  // disclosure) -- but the target is deliberately kept at the correct 1.0,
  // not lowered to match that baseline. This check is EXPECTED to fail
  // against the current baseline until that real defect is fixed; do not
  // "fix" the failure by loosening this constant.
  min_cross_scope_safe_rate: 1.0,
  // Latency/cost budget: baseline p95/max per docs/production_slo.md,
  // with a 20% margin before flagging a regression (stochastic
  // generation/verification variance already documented in Workstreams 2
  // and 5 means small run-to-run drift is expected, not a defect).
  max_overall_p95_ms: Math.round(27679 * 1.2),
  max_overall_cost_usd_per_question: Math.round((1.310562 / 72) * 1.2 * 1e6) / 1e6
};

function checkAgainstSlo(report) {
  const breaches = [];
  for (const [type, summary] of Object.entries(report.by_type)) {
    if (summary.answerability !== null && summary.answerability < SLO_TARGETS.min_answerability) {
      breaches.push(`${type}: answerability ${summary.answerability} < ${SLO_TARGETS.min_answerability}`);
    }
    if (summary.claim_grounding_rate !== null && summary.claim_grounding_rate < SLO_TARGETS.min_claim_grounding_rate) {
      breaches.push(`${type}: claim_grounding_rate ${summary.claim_grounding_rate} < ${SLO_TARGETS.min_claim_grounding_rate}`);
    }
    if (summary.retrieval_grounded_rate !== null && summary.retrieval_grounded_rate < SLO_TARGETS.min_retrieval_grounded_rate) {
      breaches.push(`${type}: retrieval_grounded_rate ${summary.retrieval_grounded_rate} < ${SLO_TARGETS.min_retrieval_grounded_rate}`);
    }
    if (summary.routing_abstention_rate !== null && summary.routing_abstention_rate < SLO_TARGETS.min_routing_abstention_rate) {
      breaches.push(`${type}: routing_abstention_rate ${summary.routing_abstention_rate} < ${SLO_TARGETS.min_routing_abstention_rate}`);
    }
    if (summary.cross_scope_safe_rate !== null && summary.cross_scope_safe_rate < SLO_TARGETS.min_cross_scope_safe_rate) {
      breaches.push(`${type}: cross_scope_safe_rate ${summary.cross_scope_safe_rate} < ${SLO_TARGETS.min_cross_scope_safe_rate} (unsafe: ${summary.cross_scope_unsafe_ids.join(", ")})`);
    }
  }
  if (report.overall.latency_cost) {
    const p95 = report.overall.latency_cost.request_elapsed.p95_ms;
    if (p95 > SLO_TARGETS.max_overall_p95_ms) breaches.push(`overall: p95 ${p95}ms > ${SLO_TARGETS.max_overall_p95_ms}ms`);
    const costPerQuestion = report.overall.latency_cost.llm.estimated_cost_usd / report.total_questions;
    if (costPerQuestion > SLO_TARGETS.max_overall_cost_usd_per_question) {
      breaches.push(`overall: cost/question $${costPerQuestion} > $${SLO_TARGETS.max_overall_cost_usd_per_question}`);
    }
  }
  return breaches;
}

function main() {
  const report = analyze();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Total questions: ${report.total_questions}`);
  for (const [type, summary] of Object.entries(report.by_type)) {
    console.log(`  ${type}: n=${summary.n} answerability=${summary.answerability} grounding=${summary.claim_grounding_rate} retrieval=${summary.retrieval_grounded_rate} abstention=${summary.routing_abstention_rate} cross_scope_safe=${summary.cross_scope_safe_rate}${summary.cross_scope_unsafe_ids.length ? ` (unsafe: ${summary.cross_scope_unsafe_ids.join(", ")})` : ""}`);
  }
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);

  if (process.argv.includes("--check") || process.env.GUIDELINE_PRODUCTION_SLO_CHECK === "true") {
    const breaches = checkAgainstSlo(report);
    if (breaches.length) {
      console.error(`SLO breaches (${breaches.length}):`);
      for (const breach of breaches) console.error(`  - ${breach}`);
      process.exitCode = 1;
    } else {
      console.log("SLO check: pass");
    }
  }
}

if (require.main === module) main();

module.exports = { analyze, checkAgainstSlo, SLO_TARGETS, claimGroundingRate, retrievalGrounded, answerabilityMatch, crossScopeSafe, routingAbstentionFired };
