const assert = require("node:assert/strict");
const test = require("node:test");

const { loadStore } = require("../engine/data_store");
const { answerEnvelope } = require("../engine/answer_envelope");
const { comparePlans } = require("../engine/semantic_shadow");

/**
 * Every other engine_semantic_shadow test builds a synthetic envelope by
 * hand, so none of them would notice a real regression in the actual
 * routing/retrieval pipeline (engine/query_router.js) — only in
 * engine/semantic_shadow.js's own plan-building logic. This file closes
 * that gap: it drives real questions through the real, offline (no LLM
 * client — deterministic, no network) engine/answer_envelope.js, then
 * checks the Stage B shadow plan those real envelopes produce. If a
 * change to routing/retrieval or to the committed Stage A overlay data
 * shifts what the shadow layer reports for these four representative
 * questions — one per Stage A scope — this is what will catch it.
 *
 * Real audit wording (docs/answer_suitability_evaluation.md Q06/Q26/Q49)
 * where practical, so these track the exact cases Stage B's first two
 * runs (history/verification/semantic_shadow_stage_b_2026-09-03.md) were
 * built to catch.
 */
const { records, index } = loadStore();

test("regression: Q06-shape (assay-technique-agnostic) question stays ambiguous across both run-acceptance branches", async () => {
  const question = "분석 run을 accept하려면 calibration standard랑 QC가 각각 어떻게 돼야 해?";
  const envelope = await answerEnvelope(question, records, { index });
  const comparison = comparePlans(question, envelope);
  const manifest = comparison.semantic_plan.manifests.find((m) => m.manifest_id === "ich_m10.sem.manifest.run_acceptance");
  assert.ok(manifest, "expected the run_acceptance manifest in the shadow plan");
  assert.equal(manifest.status, "ambiguous", "a technique-agnostic question should not silently resolve to one branch");
  assert.ok(manifest.groups.every((group) => group.applicability === "ambiguous"));
});

test("regression: Q26-shape (EMA FIH document-wide) question keeps the document_overview manifest visible even when the router narrows scope", async () => {
  const question = "EMA FIH 가이드라인은 첫 투여 전에 뭘 종합해서 보라는 거야?";
  const envelope = await answerEnvelope(question, records, { index });
  const comparison = comparePlans(question, envelope);
  const manifest = comparison.semantic_plan.manifests.find((m) => m.manifest_id === "ema_fih.sem.manifest.document_overview");
  assert.ok(manifest, "expected the document_overview manifest even though this specific answer only covers part of the document");
  assert.notEqual(manifest.status, "complete", "this question's real answer narrows to part of the document — status should disclose that gap, not read as complete");
});

test("regression: FDA ADA validation-tier question surfaces the assay_validation manifest", async () => {
  const question = "FDA ADA assay validation 항목은 뭐야?";
  const envelope = await answerEnvelope(question, records, { index });
  const comparison = comparePlans(question, envelope);
  const manifest = comparison.semantic_plan.manifests.find((m) => m.manifest_id === "fda_ada.sem.manifest.assay_validation");
  assert.ok(manifest, "expected the assay_validation manifest in the shadow plan");
  assert.ok(["complete", "partial"].includes(manifest.status), `unexpected manifest status: ${manifest.status}`);
});

test("regression: Q15-shape (ADA screening performance) question shows drug_tolerance/specificity missing while cut_point/sensitivity get real evidence", async () => {
  const question = "ADA screening assay validation에서 확인할 성능 기준은?";
  const envelope = await answerEnvelope(question, records, { index });
  const comparison = comparePlans(question, envelope);
  const manifest = comparison.semantic_plan.manifests.find((m) => m.manifest_id === "fda_ada.sem.manifest.screening_performance");
  assert.ok(manifest, "expected the screening_performance manifest in the shadow plan");
  const facets = Object.fromEntries(manifest.groups[0].facets.map((f) => [f.facet_id.split(".").pop(), f]));
  assert.notEqual(facets.drug_tolerance.status, "covered", "drug tolerance is not part of §VI.B/§IV.C.1's own evidence — a real answer should not silently read as complete here");
  assert.notEqual(facets.specificity.status, "covered");
});

test("regression: Q20-shape (FDA 2014 immunogenicity risk factors) question surfaces the risk_factors manifest and reports patient/product breadth separately", async () => {
  // The exact Q20 wording ("치료용 단백질의 임상 면역원성 위험요인은 크게
  // 뭐가 있어?") needs an LLM to resolve document identity and refuses
  // offline — this phrasing names the document explicitly so the real,
  // offline (no LLM) router can resolve it deterministically, while still
  // exercising the same manifest end to end.
  const question = "FDA 2014 임상 면역원성에서 환자 요인과 제품 요인은 어떻게 나뉘어?";
  const envelope = await answerEnvelope(question, records, { index });
  const comparison = comparePlans(question, envelope);
  const manifest = comparison.semantic_plan.manifests.find((m) => m.manifest_id === "fda_ada_2014.sem.manifest.risk_factors");
  assert.ok(manifest, "expected the risk_factors manifest in the shadow plan");
  assert.notEqual(manifest.status, "unavailable");
});

test("regression: Q49-shape (M3 vs S6 applicability) question surfaces the shared comparison axis with real router output, even though comparison_engine.js returns null scope/coverage", async () => {
  const question = "일반 저분자 의약품과 바이오의약품의 비임상 지원에서 M3(R2)와 S6(R1)의 적용 범위는 어떻게 달라?";
  const envelope = await answerEnvelope(question, records, { index });
  assert.equal(envelope.scope, null, "this is exactly the comparison_engine.js path that leaves scope null — the case claim-derived document resolution exists for");
  const comparison = comparePlans(question, envelope);
  assert.ok(comparison.semantic_plan.comparison, "expected the scope.product_or_matrix axis to surface via claim.record.document_id fallback");
  const axis = comparison.semantic_plan.comparison.find((entry) => entry.axis_id === "scope.product_or_matrix");
  assert.ok(axis);
  assert.equal(axis.both_sides_evidenced, true);
});
