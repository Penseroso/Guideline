/**
 * engine/query_stats.js
 * A pure aggregation over the two logs that already exist (the configured
 * runtime query log via engine/query_log.js's readInteractions(), and the
 * configured runtime feedback log via engine/feedback_log.js's
 * readFeedback()) — no new monitoring system, no metrics server, no
 * time-series DB (product_roadmap.md §2.4.1's minimalism, applied to ops
 * the same way it was applied to the HTTP layer).
 *
 * Refusal clustering reuses the existing tokenizer/synonym map
 * (engine/text_utils.js) rather than any clustering library or
 * cleverness — this is exactly the same mechanism that already produced
 * a real extraction-priority order from an early query log, now exposed
 * as a live view instead of a one-off manual read.
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

function latencySummary(values) {
  const sorted = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  return {
    measured: sorted.length,
    p50_ms: percentile(sorted, 0.5),
    p95_ms: percentile(sorted, 0.95),
    max_ms: sorted.length ? sorted[sorted.length - 1] : null
  };
}

/**
 * Groups refused questions by shared token, keeping only tokens that
 * recur across more than one question (a single-occurrence token isn't
 * a cluster, it's just that question's own wording). This is the same
 * grouping that once produced a real extraction backlog by hand; here
 * it's mechanical.
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
 * aggregate(interactions, feedback) -> stats object.
 * Both arguments are plain arrays of the shapes readInteractions()/
 * readFeedback() already produce; tolerant of historical entries that
 * predate later field additions (mode, latency_ms, cited_source_unit_ids
 * are simply absent on those, not null-coerced incorrectly).
 */
function aggregate(interactions, feedback = []) {
  const total = interactions.length;
  const answered = interactions.filter((i) => i.answered).length;

  const byRoute = { structured: 0, grounded_generation: 0, source_excerpts: 0, refusal: 0 };
  const byMode = {};
  const byDocument = {};
  const latencies = [];
  const telemetryStages = { routing: [], retrieval: [], generation: [], verification: [], presentation: [], unaccounted: [] };
  const llm = {
    calls: 0,
    input_tokens: 0,
    cached_input_tokens: 0,
    cache_write_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0
  };
  let telemetryMeasured = 0;

  for (const i of interactions) {
    // Read historical A/B logs without rewriting them; all newly written
    // interactions use semantic routes.
    const route = i.route || (i.path === "A" ? "structured" : i.path === "B"
      ? i.mode === "extractive" ? "source_excerpts" : "grounded_generation"
      : "refusal");
    byRoute[route] = (byRoute[route] || 0) + 1;

    if (i.mode) byMode[i.mode] = (byMode[i.mode] || 0) + 1;

    if (typeof i.latency_ms === "number") latencies.push(i.latency_ms);

    if (i.telemetry && i.telemetry.stages_ms && i.telemetry.llm) {
      telemetryMeasured++;
      for (const stage of ["routing", "retrieval", "generation", "verification", "presentation"]) {
        if (typeof i.telemetry.stages_ms[stage] === "number") telemetryStages[stage].push(i.telemetry.stages_ms[stage]);
      }
      if (typeof i.telemetry.unaccounted_ms === "number") telemetryStages.unaccounted.push(i.telemetry.unaccounted_ms);
      llm.calls += Number(i.telemetry.llm.calls) || 0;
      for (const key of Object.keys(llm).filter((key) => key !== "calls")) {
        llm[key] += Number(i.telemetry.llm.usage && i.telemetry.llm.usage[key]) || 0;
      }
    }

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
    telemetry: {
      measured: telemetryMeasured,
      stages: Object.fromEntries(Object.entries(telemetryStages).map(([stage, values]) => [stage, latencySummary(values)])),
      llm
    },
    feedback_total: feedback.length,
    feedback_by_verdict: feedbackByVerdict,
    unresolved_feedback: feedback.filter((f) => !f.triage).length
  };
}

module.exports = { aggregate, documentIdFromSourceUnitId, clusterRefusals, latencySummary, percentile };
