const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { aggregate, documentIdFromSourceUnitId, clusterRefusals, percentile } = require("../engine/query_stats");
const { readInteractions } = require("../engine/query_log");
const LEGACY_LOG_FIXTURE = path.resolve(__dirname, "fixtures", "query_log_legacy.jsonl");

test("documentIdFromSourceUnitId splits on the first dot only", () => {
  assert.equal(documentIdFromSourceUnitId("ich_m10.su.3_2_5_2.005"), "ich_m10");
  assert.equal(documentIdFromSourceUnitId("ich_s6_r1.su.part1.notes.note1.001"), "ich_s6_r1");
  assert.equal(documentIdFromSourceUnitId(null), null);
  assert.equal(documentIdFromSourceUnitId(""), null);
});

test("percentile returns null for an empty array, and the correct value otherwise", () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([10, 20, 30, 40], 0.5), 30);
  assert.equal(percentile([10, 20, 30, 40], 0), 10);
});

test("clusterRefusals only keeps tokens that recur across more than one question", () => {
  const clusters = clusterRefusals([
    "저분자 화합물에서 종 선택 기준은?",
    "small molecule 의약품에서 종 선택 기준은?",
    "sentinel dosing은 언제 필요한 거야?"
  ]);
  const molecule = clusters.find((c) => c.token === "molecule");
  assert.ok(molecule, "a token shared by 2+ refused questions must appear as a cluster");
  assert.equal(molecule.count, 2);
  assert.ok(clusters.every((c) => c.count > 1), "a token that appears in only one question is not a cluster");
});

test("aggregate: basic counts, path split, answer_rate", () => {
  const interactions = [
    { question: "q1", answered: true, path: "A" },
    { question: "q2", answered: true, path: "B" },
    { question: "q3", answered: false, path: "B" },
    { question: "q4", answered: false, path: null }
  ];
  const stats = aggregate(interactions);
  assert.equal(stats.total, 4);
  assert.equal(stats.answered, 2);
  assert.equal(stats.refused, 2);
  assert.equal(stats.answer_rate, 0.5);
  assert.deepEqual(stats.by_path, { A: 1, B: 2, null: 1 });
});

test("aggregate: by_document counts citations and distinct-answered-interactions separately", () => {
  const interactions = [
    { question: "q1", answered: true, path: "A", cited_source_unit_ids: ["ich_m10.su.1.001", "ich_m10.su.1.002"] },
    { question: "q2", answered: true, path: "A", cited_source_unit_ids: ["ich_m10.su.2.001"] },
    { question: "q3", answered: true, path: "A", cited_source_unit_ids: ["ema_fih.su.1.001"] }
  ];
  const stats = aggregate(interactions);
  assert.equal(stats.by_document.ich_m10.cited, 3, "3 total citations to ich_m10 across the two interactions that cite it");
  assert.equal(stats.by_document.ich_m10.answered, 2, "2 distinct interactions cited ich_m10");
  assert.equal(stats.by_document.ema_fih.cited, 1);
  assert.equal(stats.by_document.ema_fih.answered, 1);
});

test("aggregate: latency percentiles ignore interactions with no latency_ms (the 44 historical M2 entries predate that field)", () => {
  const interactions = [
    { question: "q1", answered: true, path: "A", latency_ms: 10 },
    { question: "q2", answered: true, path: "A", latency_ms: 50 },
    { question: "q3", answered: true, path: "A" } // no latency_ms at all
  ];
  const stats = aggregate(interactions);
  assert.equal(stats.latencies_measured, 2);
  assert.ok(stats.p50_latency_ms === 10 || stats.p50_latency_ms === 50);
});

test("aggregate: feedback_by_verdict and unresolved_feedback", () => {
  const feedback = [
    { verdict: "wrong_citation", triage: null },
    { verdict: "wrong_citation", triage: { status: "promoted" } },
    { verdict: "correct", triage: null }
  ];
  const stats = aggregate([], feedback);
  assert.equal(stats.feedback_total, 3);
  assert.deepEqual(stats.feedback_by_verdict, { wrong_citation: 2, correct: 1 });
  assert.equal(stats.unresolved_feedback, 2);
});

test("aggregate against a legacy query-log fixture runs without throwing", () => {
  const interactions = readInteractions(LEGACY_LOG_FIXTURE);
  const stats = aggregate(interactions, []);
  assert.equal(stats.total, interactions.length);
  assert.equal(stats.total, 2);
  assert.equal(stats.answered + stats.refused, stats.total);
  assert.ok(stats.answer_rate >= 0 && stats.answer_rate <= 1);
});
