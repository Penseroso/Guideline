const fs = require("node:fs");
const path = require("node:path");

const { loadStore } = require("../engine/data_store");
const { createStore } = require("../engine/vector_store");
const { tokenize } = require("../engine/text_utils");
const { structuredQuery } = require("../engine/query_router");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { selectReviewedRoutingManifest, reviewedRoutingEligibility } = require("../engine/semantic_routing");
const { createAnswerTelemetry } = require("../engine/answer_telemetry");
const { PRICING_SNAPSHOT } = require("./analyze_latency_cost_baseline");

const ROOT = path.resolve(__dirname, "..");
const ROUTING_HARDENING_INPUT = process.env.GUIDELINE_ROUTING_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_ROUTING_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "answer_routing_hardening_audit.json");
const FIFTY_Q_INPUT = process.env.GUIDELINE_LATENCY_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_LATENCY_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "answer_suitability_50_workstream_2.json");
const OUTPUT_PATH = process.env.GUIDELINE_QUERY_RESOLUTION_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_QUERY_RESOLUTION_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "response_intelligence_workstream_3_taxonomy.json");

// A word that hits one of query_router.js's special-cased scoring bonuses
// (species/cohort/homologous/recovery/approach/...) would score far above a
// plain 0.5-per-token match and defeat a below-floor probe. Real distinctive
// content words are picked avoiding this list.
const SPECIAL_CASED_WORDS = new Set([
  "species", "cohort", "cohorts", "homologous", "protein", "recovery", "approach",
  "reversible", "criteria", "criterion", "acceptance", "single", "only"
]);
const FILLER_SUFFIX = "xylophone marmalade zeppelin";

// Maps every routing/generation telemetry event (Workstream 1-3
// instrumentation) to exactly one Workstream 3 milestone taxonomy category.
// `null` marks an operational/retry/success event, not a failure to classify.
const EVENT_TAXONOMY = {
  routing_document_gate_empty: "evidence_absent",
  routing_below_confidence_floor: "deterministic_confidence_gap",
  routing_broad_no_composite: "deterministic_confidence_gap",
  routing_coverage_composite_below_threshold: "deterministic_confidence_gap",
  manifest_no_eligible_candidate: "deterministic_confidence_gap",
  routing_ambiguous_tie: "ambiguous_scope",
  routing_list_ambiguous_tie: "ambiguous_scope",
  manifest_ambiguous_tie: "ambiguous_scope",
  retrieval_no_candidates: "evidence_absent",
  generation_model_declined: "response_generation_verification_failure",
  generation_failed: "response_generation_verification_failure",
  verification_failed: "response_generation_verification_failure",
  generated_answer_rejected: "response_generation_verification_failure",
  structured_routing_rejected: "response_generation_verification_failure",
  generation_retry: null,
  verification_retry: null,
  generation_skipped: null,
  grounded_generation_succeeded: null
};

function classifyEvents(events) {
  const categories = new Set();
  for (const event of events || []) {
    const category = EVENT_TAXONOMY[event.event];
    if (category) categories.add(category);
  }
  return [...categories];
}

/**
 * Real, corpus-derived ambiguous-tie probes: quantitative_criterion records
 * that share an exact `parameter` name but are not siblings (different
 * knowledge_record_id and different source_unit_ids[0]) per query_router.js's
 * own `areSiblings` contract. A bare "<parameter> acceptance criteria"
 * question reliably scores every same-parameter QC identically (the special-
 * cased "criteria"/"acceptance" tokens plus an exact `parameter` match), so
 * this reproduces structuredQuery's real Case-4 ambiguous-tie abstention
 * without inventing synthetic records.
 */
function buildAmbiguousTieProbes(records) {
  const qcs = records.filter((r) => r.type === "quantitative_criterion" && r.parameter);
  const byParam = new Map();
  for (const record of qcs) {
    const key = String(record.parameter).trim().toLowerCase();
    if (!byParam.has(key)) byParam.set(key, []);
    byParam.get(key).push(record);
  }
  const probes = [];
  for (const [param, list] of byParam) {
    const nonSiblingIds = new Set();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const sameUnit = a.source_unit_ids && b.source_unit_ids && a.source_unit_ids[0] === b.source_unit_ids[0];
        const sameKr = a.knowledge_record_id && b.knowledge_record_id && a.knowledge_record_id === b.knowledge_record_id;
        if (!sameUnit && !sameKr) {
          nonSiblingIds.add(a.id);
          nonSiblingIds.add(b.id);
        }
      }
    }
    if (nonSiblingIds.size < 2) continue;
    const members = list.filter((record) => nonSiblingIds.has(record.id));
    probes.push({
      probe_id: `ambiguous_tie.${param.replace(/[^a-z0-9]+/g, "_")}`,
      kind: "ambiguous_tie",
      question: `${param} acceptance criteria`,
      ground_truth_record_ids: members.map((record) => record.id),
      ground_truth_document_ids: [...new Set(members.map((record) => record.document_id))]
    });
  }
  return probes;
}

/**
 * Real, corpus-derived confidence-floor probes: one distinctive real content
 * word (>=6 chars, excluding query_router.js's special-cased bonus/penalty
 * vocabulary) from a real narrative record per document, combined with
 * generic filler tokens absent from the archive. A single real-word overlap
 * scores ~0.5-2.5 via sourceTokens/docTitleTokens alone, matchedCount 1,
 * below MIN_MATCHED_TOKENS(2) for a detail-breadth question.
 */
function buildConfidenceFloorProbes(records, tokenize) {
  const byDocument = new Map();
  for (const record of records) {
    if (record.type !== "knowledge_record" || !record.source_text) continue;
    if (!byDocument.has(record.document_id)) byDocument.set(record.document_id, []);
    byDocument.get(record.document_id).push(record);
  }
  const probes = [];
  for (const [documentId, list] of byDocument) {
    const sorted = [...list].sort((a, b) => b.source_text.length - a.source_text.length);
    const source = sorted[0];
    if (!source) continue;
    const word = tokenize(source.source_text).find((t) => t.length >= 6 && !SPECIAL_CASED_WORDS.has(t));
    if (!word) continue;
    probes.push({
      probe_id: `confidence_floor.${documentId}`,
      kind: "confidence_floor",
      question: `${word} ${FILLER_SUFFIX}`,
      ground_truth_record_id: source.id,
      ground_truth_document_id: documentId
    });
  }
  return probes;
}

/**
 * Real, corpus-derived manifest-ambiguity probes: reviewed coverage
 * manifests whose id suffix (topic) recurs across >=2 distinct documents
 * with a section target (document-target "whole guideline" manifests need
 * an explicit multi-document request and are reported separately, see the
 * report's manifest-ambiguity section). A bare topic question with no named
 * document reproduces selectReviewedRoutingManifest's real tie-abstention.
 */
function buildManifestAmbiguityProbes(semanticStore) {
  const { eligible } = reviewedRoutingEligibility(semanticStore);
  const byTopic = new Map();
  for (const entry of eligible) {
    if (entry.manifest.target && entry.manifest.target.type === "document") continue;
    const topic = entry.manifest_id.split(".manifest.").pop();
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(entry);
  }
  const probes = [];
  for (const [topic, entries] of byTopic) {
    const documentIds = new Set(entries.map((entry) => entry.document_id));
    if (documentIds.size < 2) continue;
    const label = topic.replace(/_/g, " ");
    probes.push({
      probe_id: `manifest_ambiguity.${topic}`,
      kind: "manifest_ambiguity",
      question: `가이드라인의 ${label} 항목은 뭐가 있어?`,
      ground_truth_manifest_ids: entries.map((entry) => entry.manifest_id),
      ground_truth_document_ids: [...documentIds]
    });
  }
  return probes;
}

function runAmbiguousTieProbe(probe, records) {
  const telemetry = createAnswerTelemetry();
  const match = structuredQuery(probe.question, records, null, { telemetry });
  return { ...probe, matched: Boolean(match), events: telemetry.events, categories: classifyEvents(telemetry.events) };
}

async function runConfidenceFloorProbe(probe, records, store) {
  const telemetry = createAnswerTelemetry();
  const match = structuredQuery(probe.question, records, null, { telemetry });
  const retrievalResults = await store.search(probe.question, 5);
  const retrievedIds = retrievalResults.map((item) => (item.record || item).id || item.id);
  const retrievalFoundGroundTruth = retrievedIds.includes(probe.ground_truth_record_id);
  return {
    ...probe,
    matched: Boolean(match),
    events: telemetry.events,
    categories: classifyEvents(telemetry.events),
    retrieval_found_ground_truth: retrievalFoundGroundTruth,
    // The router's own scorer can correctly identify the right document
    // even below the confidence floor. When it does but the separate
    // vector-store retrieval used for fallback does NOT surface the same
    // record, that is a real retrieval miss distinct from a resolution
    // miss (the milestone's bullet 2 distinction).
    classification: retrievalFoundGroundTruth ? "resolution_recoverable_by_fallback" : "retrieval_miss"
  };
}

function runManifestAmbiguityProbe(probe, semanticStore) {
  const telemetry = createAnswerTelemetry();
  const result = selectReviewedRoutingManifest(probe.question, {
    requestedDocumentIds: null,
    intent: { kind: "topic_overview", breadth: "broad", documentOverview: false },
    queryScope: {},
    scored: [],
    store: semanticStore,
    telemetry
  });
  return { ...probe, matched: Boolean(result), events: telemetry.events, categories: classifyEvents(telemetry.events) };
}

/**
 * Reuses Workstream 1's existing 220-probe routing-hardening audit
 * (`npm run audit:routing:hardening`) rather than re-running it: every probe
 * there already carries ground truth (`document_id`/`manifest_id`), and the
 * hard gate (structured/manifest_selected/correct_document_scope/
 * claims_grounded) already passed 220/220. The `mode_or_intent_diagnostics`
 * subset -- manifest and document resolved correctly, but the router's own
 * mode/answer_intent label disagreed with the manifest's declaration -- is a
 * real, already-measured query-understanding/resolution-miss case flagged by
 * Workstream 1 for this workstream to classify.
 */
function loadRoutingHardeningDiagnostics() {
  if (!fs.existsSync(ROUTING_HARDENING_INPUT)) return null;
  const report = JSON.parse(fs.readFileSync(ROUTING_HARDENING_INPUT, "utf8"));
  const diagnostics = report.results.filter((result) => !result.checks.expected_mode || !result.checks.expected_answer_intent);
  return {
    source: path.relative(ROOT, ROUTING_HARDENING_INPUT),
    probe_count: report.probe_count,
    passed: report.passed,
    mode_or_intent_diagnostics: diagnostics.map((result) => ({
      probe_id: result.probe_id,
      document_id: result.document_id,
      manifest_id: result.manifest_id,
      expected_answer_intent: result.answer_intent,
      actual_answer_intent: result.actual_answer_intent,
      route: result.route,
      mode: result.mode
    }))
  };
}

/**
 * Reuses Workstream 2's fresh 50-question production-path run: real
 * production questions, already executed, already carrying telemetry. This
 * tells us how often the routing-abstention branches actually fire in real
 * traffic (as opposed to the targeted probes above, which are constructed
 * specifically to exercise them) -- both a positive and a null result here
 * are meaningful measurements.
 */
function loadFiftyQuestionCorpus() {
  if (!fs.existsSync(FIFTY_Q_INPUT)) return null;
  const results = JSON.parse(fs.readFileSync(FIFTY_Q_INPUT, "utf8"));
  const perQuestion = results.map((item) => ({
    id: item.id,
    route: item.envelope.route,
    categories: classifyEvents(item.envelope.telemetry && item.envelope.telemetry.events)
  }));
  const counts = {};
  for (const question of perQuestion) {
    for (const category of question.categories) counts[category] = (counts[category] || 0) + 1;
  }
  return { source: path.relative(ROOT, FIFTY_Q_INPUT), questions: perQuestion.length, category_counts: counts, per_question: perQuestion };
}

// Workstream 2's measured baseline (history/verification/
// response_intelligence_workstream_2_2026-09-09.md), used here only to
// project added/removed latency and cost for a candidate LLM intervention --
// not re-measured by this script.
const WS2_BASELINE = {
  generation_ms: { p50: 3423, p95: 11801 },
  verification_ms: { p50: 4632, p95: 19603 },
  generation_model: "gpt-5.6-terra",
  verification_model: "gpt-5.6-sol",
  assumed_tokens_per_call: { input: 2600, output: 650 } // overall run average, 165,901 tokens / 94 calls / ~2 fields
};

function projectedCallCost(model, tokens = WS2_BASELINE.assumed_tokens_per_call) {
  const rate = PRICING_SNAPSHOT.per_million_tokens[model];
  if (!rate) return null;
  return Math.round(((tokens.input * rate.input) + (tokens.output * rate.output)) / 1_000_000 * 1e6) / 1e6;
}

function buildInterventionCandidates({ ambiguousTieResults, confidenceFloorResults, manifestAmbiguityResults, routingHardening, fiftyQ }) {
  const realAmbiguousTieHits = ambiguousTieResults.filter((r) => r.categories.includes("ambiguous_scope")).length;
  const realManifestAmbiguityHits = manifestAmbiguityResults.filter((r) => r.categories.includes("ambiguous_scope")).length;
  const retrievalMisses = confidenceFloorResults.filter((r) => r.classification === "retrieval_miss").length;
  const recoverableByFallback = confidenceFloorResults.filter((r) => r.classification === "resolution_recoverable_by_fallback").length;
  const oneCallCost = projectedCallCost(WS2_BASELINE.generation_model);

  return [
    {
      id: "skip_speculative_generation_when_structured_adequate",
      category: "response_generation_verification_failure",
      escalation_condition: "generated_answer_rejected / structured_routing_rejected (Workstream 2 finding)",
      deterministic_evidence_available: "The already-complete deterministic structured/manifest answer itself.",
      measured_coverage: "12/23 final-structured Workstream 2 baseline cases (see workstream_2 report)",
      direction: "cost_negative",
      projected_latency_cost_impact: "Removes ~11,043 ms p50 / 24,741 ms p95 and ~2.5 LLM calls per affected question (Workstream 2 measurement) -- highest-value, lowest-risk candidate.",
      recommendation: "Highest priority for Workstream 5: add a pre-generation adequacy check so a complete deterministic answer is returned without attempting generation first."
    },
    {
      id: "llm_disambiguation_on_ambiguous_tie",
      category: "ambiguous_scope",
      escalation_condition: "routing_ambiguous_tie / routing_list_ambiguous_tie",
      deterministic_evidence_available: "The tied candidate record set itself (ids, documents, sections) -- no new retrieval needed.",
      measured_coverage: `${realAmbiguousTieHits}/${ambiguousTieResults.length} real corpus-derived same-parameter, non-sibling probes actually tied (0 occurrences found in the Workstream 2 50-question production corpus)`,
      direction: "cost_positive",
      projected_latency_cost_impact: `One bounded, single-shot disambiguation call over an already-fixed small candidate set (est. ~${oneCallCost === null ? "n/a" : `$${oneCallCost}`}/call, p50 ~${WS2_BASELINE.generation_ms.p50} ms, using ${WS2_BASELINE.generation_model} rates) -- no additional retrieval cost.`,
      recommendation: "Workstream 5 candidate, conditional only: escalate exclusively on this exact abstention event, never broadened to ordinary detail questions."
    },
    {
      id: "llm_disambiguation_on_manifest_ambiguous_tie",
      category: "ambiguous_scope",
      escalation_condition: "manifest_ambiguous_tie",
      deterministic_evidence_available: "The tied manifest list (document/topic/section identity) -- no new retrieval needed.",
      measured_coverage: `${realManifestAmbiguityHits}/${manifestAmbiguityResults.length} real cross-document topic-overlap manifest groups actually tied`,
      direction: "cost_positive",
      projected_latency_cost_impact: `Same shape as the routing-tie candidate above (~${oneCallCost === null ? "n/a" : `$${oneCallCost}`}/call). Real occurrence count in the current 55-manifest reviewed inventory is small (see report).`,
      recommendation: "Workstream 5 candidate, same conditional scope as above; low volume today, revisit as more manifests are authored."
    },
    {
      id: "retrieval_quality_upgrade_for_confidence_floor_misses",
      category: "retrieval_miss",
      escalation_condition: "routing_below_confidence_floor where the separate vector-store retrieval also fails to surface the ground-truth record",
      deterministic_evidence_available: "N/A -- this is retrieval quality, not an LLM planning decision.",
      measured_coverage: `${retrievalMisses}/${confidenceFloorResults.length} confidence-floor probes were also missed by store.search (${recoverableByFallback}/${confidenceFloorResults.length} were still found by retrieval despite the structured router scoring them sub-floor)`,
      direction: "out_of_scope_for_llm_planning",
      projected_latency_cost_impact: "N/A",
      recommendation: "Explicitly out of scope for Workstream 5 per the milestone -- becomes Workstream 4's benchmark denominator instead."
    },
    {
      id: "mode_intent_relabeling_diagnostics",
      category: "query_understanding_resolution_miss",
      escalation_condition: "Workstream 1 mode_or_intent_diagnostics (manifest/document correct, router's own mode/answer_intent label disagrees)",
      deterministic_evidence_available: routingHardening
        ? `The manifest's own declared answer_intent, already resolved (n=${routingHardening.mode_or_intent_diagnostics.length}).`
        : "Not available -- run npm run audit:routing:hardening first.",
      measured_coverage: routingHardening ? `${routingHardening.mode_or_intent_diagnostics.length}/${routingHardening.probe_count} eligible probes` : "unavailable",
      direction: "diagnostic_only",
      projected_latency_cost_impact: "None -- these already answer correctly today; only the internal mode/intent label disagrees with the manifest.",
      recommendation: "Not an LLM intervention candidate: a deterministic relabeling fix (prefer the selected manifest's declared answer_intent once a manifest is authoritative) is cheaper and sufficient; revisit only if it starts causing an observable answer defect."
    }
  ];
}

async function analyze() {
  const { records } = loadStore();
  const store = createStore();
  store.index(records);
  const semanticStore = loadSemanticOverlayStore();

  const ambiguousTieProbes = buildAmbiguousTieProbes(records);
  const confidenceFloorProbes = buildConfidenceFloorProbes(records, tokenize);
  const manifestAmbiguityProbes = buildManifestAmbiguityProbes(semanticStore);

  const ambiguousTieResults = ambiguousTieProbes.map((probe) => runAmbiguousTieProbe(probe, records));
  const confidenceFloorResults = [];
  for (const probe of confidenceFloorProbes) confidenceFloorResults.push(await runConfidenceFloorProbe(probe, records, store));
  const manifestAmbiguityResults = manifestAmbiguityProbes.map((probe) => runManifestAmbiguityProbe(probe, semanticStore));

  const routingHardening = loadRoutingHardeningDiagnostics();
  const fiftyQ = loadFiftyQuestionCorpus();

  const categoryCounts = {};
  const tally = (category) => { categoryCounts[category] = (categoryCounts[category] || 0) + 1; };
  for (const r of ambiguousTieResults) for (const c of r.categories) tally(c);
  for (const r of confidenceFloorResults) for (const c of r.categories) tally(c);
  for (const r of manifestAmbiguityResults) for (const c of r.categories) tally(c);
  if (routingHardening) categoryCounts.query_understanding_resolution_miss = routingHardening.mode_or_intent_diagnostics.length;
  if (fiftyQ) for (const [category, count] of Object.entries(fiftyQ.category_counts)) categoryCounts[category] = (categoryCounts[category] || 0) + count;

  return {
    generated_at: new Date().toISOString(),
    corpora: {
      ambiguous_tie_probes: { count: ambiguousTieProbes.length, results: ambiguousTieResults },
      confidence_floor_probes: { count: confidenceFloorProbes.length, results: confidenceFloorResults },
      manifest_ambiguity_probes: { count: manifestAmbiguityProbes.length, results: manifestAmbiguityResults },
      routing_hardening_reuse: routingHardening,
      fifty_question_production_reuse: fiftyQ
    },
    taxonomy_category_counts: categoryCounts,
    candidate_llm_interventions: buildInterventionCandidates({ ambiguousTieResults, confidenceFloorResults, manifestAmbiguityResults, routingHardening, fiftyQ })
  };
}

async function main() {
  const report = await analyze();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Ambiguous-tie probes: ${report.corpora.ambiguous_tie_probes.count}`);
  console.log(`Confidence-floor probes: ${report.corpora.confidence_floor_probes.count}`);
  console.log(`Manifest-ambiguity probes: ${report.corpora.manifest_ambiguity_probes.count}`);
  console.log(`Taxonomy category counts: ${JSON.stringify(report.taxonomy_category_counts)}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});

module.exports = {
  EVENT_TAXONOMY,
  classifyEvents,
  buildAmbiguousTieProbes,
  buildConfidenceFloorProbes,
  buildManifestAmbiguityProbes,
  analyze
};
