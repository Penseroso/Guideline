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
  assert.deepEqual(chromatography.facets[0].exact, { covered: 6, total: 6 });
  // §3.3.2's own section census (all knowledge_records/quantitative_criteria/
  // conditions filed there, not just the 6 curated member_record_ids) is
  // larger than the curated sample — exact coverage can be complete without
  // the section count also being 6/6.
  assert.equal(chromatography.facets[0].section.total, 18);
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
  assert.deepEqual(chromatography.facets[0].exact, { covered: 1, total: 6 });
  assert.equal(manifest.status, "partial");
});

test("facet coverage falls back to the section census when cited evidence is topically right but not the curated sample", () => {
  // None of these five claim ids are fda_ada's curated member_record_ids
  // (one representative record per validation tier) — they're other real
  // records from the same five sections. Exact-only scoring would read
  // this as "missing" everywhere despite every section being genuinely
  // touched (the false negative Stage B's first run hit on Q14).
  const envelope = {
    answer_intent: "topic_overview",
    scope: { resolved_document_ids: ["fda_ada"], requested_document_ids: [], section_ids: ["fda_ada.sec.6"] },
    // Real archive record ids, each filed under the same section as the
    // corresponding curated member (fda_ada.kr.VI_A.001 etc.) but not
    // equal to it — this is what makes it an "exact miss, section hit".
    claims: [
      "fda_ada.kr.VI_A.002", "fda_ada.kr.VI_B.002", "fda_ada.kr.VI_C.002",
      "fda_ada.kr.VI_D.002", "fda_ada.kr.VI_E.002"
    ].map((id) => claim({ id, document_id: "fda_ada" }))
  };
  const plan = buildShadowPlan("FDA ADA assay validation 항목은 뭐야?", envelope, { store });
  const manifest = plan.manifests.find((m) => m.manifest_id === "fda_ada.sem.manifest.assay_validation");
  assert.ok(manifest);
  for (const facet of manifest.groups[0].facets) {
    assert.equal(facet.exact.covered, 0, `${facet.facet_id} exact should be 0 — cited a different record`);
    assert.ok(facet.section.covered > 0, `${facet.facet_id} section coverage should reflect the same-section citation`);
    assert.equal(facet.status, "partial");
  }
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

test("a manifest scoped to a sibling section is still reported relevant, not just ancestor/descendant matches", () => {
  // §3.3.1 (Analytical Run) and §3.3.2 (Acceptance Criteria, the
  // run_acceptance manifest's chromatography scope) are siblings under
  // §3.3 — neither an ancestor nor a descendant of the other.
  const envelope = {
    answer_intent: "detail",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [], section_ids: ["ich_m10.sec.3_3_1"] },
    claims: []
  };
  const plan = buildShadowPlan("analytical run은 어떻게 구성해?", envelope, { store });
  const manifest = plan.manifests.find((m) => m.manifest_id === "ich_m10.sem.manifest.run_acceptance");
  assert.ok(manifest, "expected the sibling section to still surface the run_acceptance manifest");
});

test("a manifest scoped far away from the resolved sections (no shared ancestor or sibling) is not reported", () => {
  const envelope = {
    answer_intent: "detail",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [], section_ids: ["ich_m10.sec.9"] },
    claims: []
  };
  const plan = buildShadowPlan("glossary에 정의는 뭐가 있어?", envelope, { store });
  const manifest = plan.manifests.find((m) => m.manifest_id === "ich_m10.sem.manifest.run_acceptance");
  assert.equal(manifest, undefined);
});

test("section coverage granularity switches to child-section breadth for a chapter-scoped facet, not raw record count", () => {
  // ema_fih.sem.facet.dose_selection's scope (§7) has 7 real sub-sections
  // (§7.1-§7.7) totalling ~197 individual records — flat record recall
  // there would make the "section" signal permanently near-zero regardless
  // of how good an answer is. §7.2 (Starting dose for healthy volunteers)
  // is one specific real sub-section; citing something from it should
  // register as "1 of 7 sub-topics touched", not "a handful out of 197".
  const envelope = {
    answer_intent: "topic_overview",
    scope: { resolved_document_ids: ["ema_fih"], requested_document_ids: [], section_ids: ["ema_fih.sec.7_2"] },
    claims: [claim({ id: "ema_fih.kr.7_2.001", document_id: "ema_fih" })]
  };
  const plan = buildShadowPlan("건강인 초회 투여용량은 어떻게 정해?", envelope, { store });
  const manifest = plan.manifests.find((m) => m.manifest_id === "ema_fih.sem.manifest.document_overview");
  assert.ok(manifest);
  const dose = manifest.groups[0].facets.find((f) => f.facet_id === "ema_fih.sem.facet.dose_selection");
  assert.equal(dose.section.granularity, "section");
  assert.equal(dose.section.total, 7);
  assert.equal(dose.section.covered, 1);

  // A leaf-scoped facet (no sub-sections of its own) keeps the original
  // fine-grained record recall — the fix only changes chapter-shaped scopes.
  const quality = manifest.groups[0].facets.find((f) => f.facet_id === "ema_fih.sem.facet.quality");
  assert.equal(quality.section.granularity, "section"); // §5 also has 3 real sub-sections
  assert.equal(quality.section.total, 3);
});

test("a leaf-scoped facet (no sub-sections of its own) still reports record-granularity section coverage", () => {
  const envelope = {
    answer_intent: "multi_criterion",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [] },
    claims: [claim({ id: "ich_m10.qc.3_3_2.001", document_id: "ich_m10" })]
  };
  const plan = buildShadowPlan("chromatography 분석 run 허용 기준이 뭐야?", envelope, { store });
  const manifest = plan.manifests.find((m) => m.manifest_id === "ich_m10.sem.manifest.run_acceptance");
  const chromatography = manifest.groups.find((g) => g.group_id === "chromatography_branch");
  assert.equal(chromatography.facets[0].section.granularity, "record");
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

test("comparison bindings are annotated with per-side coverage, and both_sides_evidenced is false when one side was never cited", () => {
  // Only ich_m3_r2's scope evidence was actually cited; ich_s6_r1 is
  // resolved too (e.g. named in the question, via scope.requested_document_ids)
  // but nothing from its scope facet's member/section was in the answer.
  const envelope = {
    answer_intent: null,
    claims: [claim({ id: "ich_m3_r2.kr.1_3.004", document_id: "ich_m3_r2" })],
    scope: { resolved_document_ids: [], requested_document_ids: ["ich_s6_r1"] }
  };
  const plan = buildShadowPlan("M3(R2)와 S6(R1)의 적용 범위는 어떻게 달라?", envelope, { store });
  const axis = plan.comparison.find((a) => a.axis_id === "scope.product_or_matrix");
  assert.ok(axis);
  const m3Binding = axis.bindings.find((b) => b.document_id === "ich_m3_r2");
  const s6Binding = axis.bindings.find((b) => b.document_id === "ich_s6_r1");
  // Only 1 of ich_m3_r2.sem.facet.scope's 2 curated members was cited, so
  // this is "partial", not "covered" — still non-"missing", which is what
  // both_sides_evidenced actually checks.
  assert.equal(m3Binding.coverage.status, "partial");
  assert.equal(s6Binding.coverage.status, "missing");
  assert.equal(axis.both_sides_evidenced, false);
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

test("comparePlans never mutates or reads back into the envelope it was given, and records the existing engine's real presentation order", () => {
  const envelope = {
    route: "structured",
    mode: "multi_criterion",
    answer_intent: "multi_criterion",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [] },
    coverage: { status: "representative" },
    claims: [
      claim({ id: "ich_m10.qc.3_3_2.002", document_id: "ich_m10" }),
      claim({ id: "ich_m10.qc.3_3_2.001", document_id: "ich_m10" })
    ]
  };
  const frozenEnvelope = JSON.parse(JSON.stringify(envelope));
  const result = comparePlans("chromatography 분석 run 허용 기준이 뭐야?", envelope, { store });
  assert.deepEqual(envelope, frozenEnvelope);
  assert.equal(result.existing_plan.route, "structured");
  assert.equal(result.existing_plan.claim_count, 2);
  // Order preserved exactly as the envelope presented it (002 before 001)
  // so it can be diffed against semantic_plan.salience[].order — the side
  // Stage B's first run never actually captured.
  assert.deepEqual(result.existing_plan.claim_order, ["ich_m10.qc.3_3_2.002", "ich_m10.qc.3_3_2.001"]);
  assert.equal(result.semantic_plan.applicable, true);
});

test("a stale overlay is reported distinctly from a document that never had one", () => {
  const fakeStore = {
    archive: store.archive,
    sectionIndex: store.sectionIndex,
    overlaysByDocumentId: new Map(),
    staleDocumentIds: new Set(["ich_m10"])
  };
  const envelope = {
    answer_intent: "multi_criterion",
    scope: { resolved_document_ids: ["ich_m10"], requested_document_ids: [] },
    claims: [claim({ id: "ich_m10.qc.3_3_2.001", document_id: "ich_m10" })]
  };
  const plan = buildShadowPlan("chromatography 분석 run 허용 기준이 뭐야?", envelope, { store: fakeStore });
  assert.equal(plan.applicable, false);
  assert.equal(plan.reason, "overlay_stale");
  assert.deepEqual(plan.stale_document_ids, ["ich_m10"]);
});
