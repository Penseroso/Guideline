const assert = require("node:assert/strict");
const test = require("node:test");

const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { buildShadowPlan, comparePlans } = require("../engine/semantic_shadow");

const store = loadSemanticOverlayStore();

function claim(record) {
  return { record, source_unit_id: null, citation: null };
}

test("loadSemanticOverlayStore loads all five committed sample overlays fresh (none stale)", () => {
  assert.equal(store.staleDocumentIds.size, 0, [...store.staleDocumentIds].join(", "));
  assert.deepEqual(
    [...store.overlaysByDocumentId.keys()].sort(),
    ["ema_fih", "fda_ada", "ich_m10", "ich_m3_r2", "ich_s6_r1"]
  );
});

test("no resolved document -> not applicable, distinct reason from no-overlay case", () => {
  const plan = buildShadowPlan("아무 문서와도 무관한 임의의 질문", { claims: [], scope: null }, { store });
  assert.equal(plan.applicable, false);
  assert.equal(plan.reason, "no_resolved_document");
});

test("resolved document with no overlay -> not applicable with a distinguishable reason", () => {
  const envelope = {
    answer_intent: "detail",
    scope: { resolved_document_ids: ["fda_ada_2014"], requested_document_ids: [] },
    claims: [claim({ id: "fda_ada_2014.kr.x.001", document_id: "fda_ada_2014" })]
  };
  const plan = buildShadowPlan("2014 가이드라인 질문", envelope, { store });
  assert.equal(plan.applicable, false);
  assert.equal(plan.reason, "no_overlay_for_document");
  assert.deepEqual(plan.document_ids, ["fda_ada_2014"]);
});

test("ich_m10 conditional branch: chromatography wording resolves only the chromatography group as applicable", () => {
  const envelope = {
    answer_intent: "multi_criterion",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [] },
    claims: [
      "ich_m10.qc.3_3_2.001", "ich_m10.qc.3_3_2.002", "ich_m10.qc.3_3_2.003",
      "ich_m10.qc.3_3_2.004", "ich_m10.qc.3_3_2.005", "ich_m10.qc.3_3_2.006"
    ].map((id) => claim({ id, document_id: "ich_m10" }))
  };
  const plan = buildShadowPlan("LC-MS/MS chromatography 분석 run 허용 기준이 뭐야?", envelope, { store });
  assert.equal(plan.applicable, true);
  const manifest = plan.manifests.find((m) => m.manifest_id === "ich_m10.sem.manifest.run_acceptance");
  assert.ok(manifest, "expected the run_acceptance manifest to be present");
  const chromatography = manifest.groups.find((g) => g.group_id === "chromatography_branch");
  const lba = manifest.groups.find((g) => g.group_id === "lba_branch");
  assert.equal(chromatography.applicability, "applicable");
  assert.equal(lba.applicability, "not_applicable");
  assert.equal(chromatography.facets[0].status, "covered");
  assert.equal(manifest.status, "complete");
});

test("ich_m10 conditional branch: technique-agnostic wording makes both branches ambiguous, not silently one-sided", () => {
  const envelope = {
    answer_intent: "multi_criterion",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [] },
    claims: [claim({ id: "ich_m10.qc.3_3_2.001", document_id: "ich_m10" })]
  };
  const plan = buildShadowPlan("분석 run을 accept하려면 어떻게 해야 해?", envelope, { store });
  const manifest = plan.manifests.find((m) => m.manifest_id === "ich_m10.sem.manifest.run_acceptance");
  assert.equal(manifest.status, "ambiguous");
  assert.ok(manifest.groups.every((g) => g.applicability === "ambiguous"));
});

test("ich_m10 conditional branch: partial chromatography coverage is reported as partial, not complete", () => {
  const envelope = {
    answer_intent: "multi_criterion",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [] },
    claims: [claim({ id: "ich_m10.qc.3_3_2.001", document_id: "ich_m10" })]
  };
  const plan = buildShadowPlan("chromatography 분석 run 허용 기준이 뭐야?", envelope, { store });
  const manifest = plan.manifests.find((m) => m.manifest_id === "ich_m10.sem.manifest.run_acceptance");
  const chromatography = manifest.groups.find((g) => g.group_id === "chromatography_branch");
  assert.equal(chromatography.facets[0].status, "partial");
  assert.equal(manifest.status, "partial");
});

test("ema_fih document overview: router under-classifying as topic_overview is visible via intent_match=false, not hidden", () => {
  // Reproduces the real Q26 shape from the answer-suitability audit: the
  // router resolved only the dose-selection sections and labeled the
  // answer topic_overview, collapsing the document-wide question.
  const envelope = {
    answer_intent: "topic_overview",
    scope: {
      resolved_document_ids: ["ema_fih"],
      requested_document_ids: ["ema_fih"],
      section_ids: ["ema_fih.sec.7_1", "ema_fih.sec.7_2"]
    },
    claims: [claim({ id: "ema_fih.kr.7_1.001", document_id: "ema_fih" })]
  };
  const plan = buildShadowPlan("EMA FIH 가이드라인은 첫 투여 전에 뭘 종합해서 보라는 거야?", envelope, { store });
  const manifest = plan.manifests.find((m) => m.manifest_id === "ema_fih.sem.manifest.document_overview");
  assert.ok(manifest);
  assert.equal(manifest.manifest_answer_intent, "document_overview");
  assert.equal(manifest.intent_match, false);
  // Only the dose_selection facet's member was actually cited; scope,
  // quality, non_clinical, and trial_planning are missing entirely.
  assert.equal(manifest.status, "partial");
  const dose = manifest.groups[0].facets.find((f) => f.facet_id === "ema_fih.sem.facet.dose_selection");
  const quality = manifest.groups[0].facets.find((f) => f.facet_id === "ema_fih.sem.facet.quality");
  assert.equal(dose.status, "covered");
  assert.equal(quality.status, "missing");
});

test("cross-document comparison: shared scope.product_or_matrix axis surfaces when both documents resolve", () => {
  const envelope = {
    answer_intent: null,
    scope: null,
    claims: [
      claim({ id: "ich_m3_r2.kr.1_3.004", document_id: "ich_m3_r2" }),
      claim({ id: "ich_s6_r1.kr.1_3.001", document_id: "ich_s6_r1" })
    ]
  };
  const plan = buildShadowPlan("M3(R2)와 S6(R1)의 적용 범위는 어떻게 달라?", envelope, { store });
  assert.equal(plan.applicable, true);
  assert.ok(plan.comparison, "expected a comparison plan even though envelope.scope was null");
  const axis = plan.comparison.find((a) => a.axis_id === "scope.product_or_matrix");
  assert.ok(axis);
  const documentIds = axis.bindings.map((b) => b.document_id).sort();
  assert.deepEqual(documentIds, ["ich_m3_r2", "ich_s6_r1"]);
});

test("a single resolved comparison document produces no comparison plan", () => {
  const envelope = {
    answer_intent: null,
    scope: null,
    claims: [claim({ id: "ich_m3_r2.kr.1_3.004", document_id: "ich_m3_r2" })]
  };
  const plan = buildShadowPlan("M3(R2)는 어떤 범위를 다뤄?", envelope, { store });
  assert.equal(plan.comparison, null);
});

test("comparePlans never mutates or reads back into the envelope it was given", () => {
  const envelope = {
    route: "structured",
    mode: "multi_criterion",
    answer_intent: "multi_criterion",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [] },
    coverage: { status: "representative" },
    claims: [claim({ id: "ich_m10.qc.3_3_2.001", document_id: "ich_m10" })]
  };
  const frozenEnvelope = JSON.parse(JSON.stringify(envelope));
  const result = comparePlans("chromatography 분석 run 허용 기준이 뭐야?", envelope, { store });
  assert.deepEqual(envelope, frozenEnvelope);
  assert.equal(result.existing_plan.route, "structured");
  assert.equal(result.existing_plan.claim_count, 1);
  assert.equal(result.semantic_plan.applicable, true);
});
