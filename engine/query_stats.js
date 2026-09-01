/**
 * engine/query_stats.js
 * M5 Phase 6 (history/verification/engine_test_record_through_2026-08-28.md Entry 008 / .claude/plans/scalable-
 * floating-elephant.md): a pure aggregation over the two logs that
 * already exist (the configured runtime query log via engine/query_log.js's
 * readInteractions(), and the configured runtime feedback log via engine/feedback_log.js's
 * readFeedback()) — no new monitoring system, no metrics server, no
 * time-series DB (product_roadmap.md §2.4.1's minimalism, applied to
 * ops the same way it was applied to the HTTP layer in Phase 3).
 *
 * Refusal clustering reuses the existing tokenizer/synonym map
 * (engine/text_utils.js) rather than any clustering library or
 * cleverness — this is exactly the same mechanism that already produced
 * the real M3 extraction-priority order from the original M2 log
 * (docs/milestone_log.md M2), now exposed as a live view instead of a
 * one-off manual read.
 */

const { tokenize } = require("./text_utils");

/**
 * Every real source_unit_id in this archive is `<document_id>.su....`
 * and no document_id itself contains a dot (verified against all 6:
 * ich_m10, ich_s6_r1, ich_m3_r2, ema_fih, fda_ada, fda_ada_2014) — so
 * the document is recoverable from the id string alone, no index
 * lookup needed.
 */
function documentIdFromSourceUnitId(sourceUnitId) {
  if (!sourceUnitId || typeof sourceUnitId !== "string") return null;
  const dot = sourceUnitId.indexOf(".");
  return dot === -1 ? sourceUnitId : sourceUnitId.slice(0, dot);
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  const idx = Math.min(sortedValues.length - 1, Math.floor(p * sortedValues.length));
  return sortedValues[idx];
}

/**
 * Groups refused questions by shared token, keeping only tokens that
 * recur across more than one question (a single-occurrence token isn't
 * a cluster, it's just that question's own wording). This is what
 * produced the real M3 backlog by hand in M2; here it's mechanical.
 */
function clusterRefusals(refusedQuestions, topN = 10) {
  const byToken = new Map();
  for (const q of refusedQuestions) {
    for (const t of new Set(tokenize(q))) {
      if (!byToken.has(t)) byToken.set(t, new Set());
      byToken.get(t).add(q);
    }
  }
  return [...byToken.entries()]
    .map(([token, questions]) => ({ token, count: questions.size, questions: [...questions] }))
    .filter((c) => c.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * aggregate(interactions, feedback) -> stats object, per M5 plan Phase 6.
 * Both arguments are plain arrays of the shapes readInteractions()/
 * readFeedback() already produce; tolerant of the 44 historical M2
 * entries that predate the Phase 5 field additions (mode, latency_ms,
 * cited_source_unit_ids are simply absent on those, not null-coerced
 * incorrectly).
 */
function aggregate(interactions, feedback = []) {
  const total = interactions.length;
  const answered = interactions.filter((i) => i.answered).length;

  const byRoute = { structured: 0, grounded_generation: 0, source_excerpts: 0, refusal: 0 };
  const byMode = {};
  const byDocument = {};
  const latencies = [];

  for (const i of interactions) {
    // Read historical A/B logs without rewriting them; all newly written
    // interactions use semantic routes.
    const route = i.route || (i.path === "A" ? "structured" : i.path === "B"
      ? i.mode === "extractive" ? "source_excerpts" : "grounded_generation"
      : "refusal");
    byRoute[route] = (byRoute[route] || 0) + 1;

    if (i.mode) byMode[i.mode] = (byMode[i.mode] || 0) + 1;

    if (typeof i.latency_ms === "number") latencies.push(i.latency_ms);

    const citedIds = i.cited_source_unit_ids || [];
    const docsThisInteraction = new Set();
    for (const suId of citedIds) {
      const docId = documentIdFromSourceUnitId(suId);
      if (!docId) continue;
      if (!byDocument[docId]) byDocument[docId] = { answered: 0, cited: 0 };
      byDocument[docId].cited++;
      docsThisInteraction.add(docId);
    }
    for (const docId of docsThisInteraction) byDocument[docId].answered++;
  }

  latencies.sort((a, b) => a - b);

  const refusedQuestions = interactions.filter((i) => !i.answered).map((i) => i.question);

  const feedbackByVerdict = {};
  for (const f of feedback) {
    feedbackByVerdict[f.verdict] = (feedbackByVerdict[f.verdict] || 0) + 1;
  }

  return {
    total,
    answered,
    refused: total - answered,
    answer_rate: total ? answered / total : null,
    by_route: byRoute,
    by_mode: byMode,
    by_document: byDocument,
    refusal_clusters: clusterRefusals(refusedQuestions),
    p50_latency_ms: percentile(latencies, 0.5),
    p95_latency_ms: percentile(latencies, 0.95),
    latencies_measured: latencies.length,
    feedback_total: feedback.length,
    feedback_by_verdict: feedbackByVerdict,
    unresolved_feedback: feedback.filter((f) => !f.triage).length
  };
}

module.exports = { aggregate, documentIdFromSourceUnitId, clusterRefusals, percentile };
