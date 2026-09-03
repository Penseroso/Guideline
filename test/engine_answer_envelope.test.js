const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { answer } = require("../engine/query_router");
const { answerEnvelope, ENVELOPE_VERSION, safeReviewedSemanticCoverage } = require("../engine/answer_envelope");
const fixture = require("./fixtures/eval_questions.json");

const { records, index } = loadStore();

// M5 Phase 2 (history/verification/engine_test_record_through_2026-08-28.md Entry 008 / M5 plan): the envelope
// mirrors structuredQuery/answerFallback directly rather than wrapping
// answer()'s output, so it's a genuinely separate control flow. This is
// the test that catches drift between the two — written before relying
// on the envelope for anything else.
test("contract parity: envelope.answered and envelope.prose never disagree with answer(), across the whole gold fixture", async () => {
  let checked = 0;
  for (const q of fixture.questions) {
    const viaAnswer = await answer(q.question, records, { index });
    const viaEnvelope = await answerEnvelope(q.question, records, { index });
    assert.equal(viaEnvelope.answered, viaAnswer.answered, `answered mismatch for ${q.id}`);
    assert.equal(viaEnvelope.prose, viaAnswer.text, `prose/text mismatch for ${q.id}`);
    checked++;
  }
  assert.ok(checked >= 20, `expected to check at least 20 fixture questions, checked ${checked}`);
});

test("every envelope claim has a non-empty, resolvable source_unit_id (the citation invariant, at the API boundary)", async () => {
  let claimsChecked = 0;
  for (const q of fixture.questions) {
    const env = await answerEnvelope(q.question, records, { index });
    for (const claim of env.claims) {
      assert.ok(claim.source_unit_id, `${q.id}: claim missing source_unit_id`);
      assert.ok(index.sourceUnits.get(claim.source_unit_id), `${q.id}: claim's source_unit_id does not resolve`);
      claimsChecked++;
    }
  }
  assert.ok(claimsChecked > 0, "expected at least one claim across the fixture");
});

test("envelope shape is always fully populated, whichever semantic route is taken", async () => {
  const hit = await answerEnvelope("minimum replicates required at each QC concentration level", records, { index });
  assert.equal(hit.envelope_version, ENVELOPE_VERSION);
  assert.equal(hit.answered, true);
  assert.equal(hit.mode, "structured");
  assert.equal(hit.route, "structured");
  assert.equal(typeof hit.prose, "string");
  assert.equal(hit.refusal, null);
  assert.ok(Array.isArray(hit.claims) && hit.claims.length > 0);
  assert.ok(Array.isArray(hit.answer_units) && hit.answer_units.length > 0);
  assert.equal(hit.answer_units[0].source_unit_id, hit.claims[0].source_unit_id);
  assert.ok(["reviewed", "needs_review"].includes(hit.review_status));
  assert.equal(typeof hit.timing_ms, "number");

  const refusal = await answerEnvelope("what is the meaning of life", records, { index });
  assert.equal(refusal.answered, false);
  assert.equal(refusal.mode, "refusal");
  assert.equal(refusal.route, "refusal");
  assert.equal(refusal.refusal.kind, "no_match");
  assert.deepEqual(refusal.claims, []);
  assert.deepEqual(refusal.answer_units, []);
});

test("mode discriminates comparison, amendment, and list distinctly — the information answer()'s own top-level result never exposed", async () => {
  const comparison = await answerEnvelope("FDA ADA vs ICH M10 LBA 밸리데이션 차이점 비교", records, { index });
  assert.equal(comparison.mode, "comparison");
  assert.equal(comparison.route, "structured");

  const amendment = await answerEnvelope("ICH S6 Addendum의 주요 개정 이력 및 Note 내용", records, { index });
  assert.equal(amendment.mode, "amendment");

  const list = await answerEnvelope("LBA 밸리데이션 항목", records, { index });
  assert.equal(list.mode, "section_overview");
});

test("a header-level question exposes section_overview as a distinct response contract", async () => {
  const overview = await answerEnvelope("lc-ms/ms에서 full validation 항목?", records, { index });
  assert.equal(overview.route, "structured");
  assert.equal(overview.mode, "section_overview");
  assert.equal(new Set(overview.answer_units.map((unit) => unit.overview_group && unit.overview_group.section_id)).size, 9);
  assert.ok(overview.answer_units.every((unit) => unit.overview_group));
});

test("auto preference synthesizes broad semantic modes but preserves exact section-overview rendering", async () => {
  let calls = 0;
  const client = {
    complete: async ({ schema }) => {
      calls++;
      return schema.properties.verdicts
        ? { verdicts: [{ unit_index: 0, entailed: true, source_index: 0, reason: "supported" }] }
        : { answered: true, units: [{ text: "근거 범위 안에서 종합한 답변입니다.", source_index: 0 }] };
    }
  };

  const process = await answerEnvelope("ADA multi-tiered testing은 단계별로 어떻게 이어져?", records, {
    client,
    store: fakeStore([]),
    index,
    generationPreference: "auto"
  });
  assert.equal(process.route, "grounded_generation");
  assert.equal(process.mode, "generated");
  assert.equal(process.semantic_mode, "process");
  assert.equal(process.coverage.generation_scope_limited_to_structured_claims, true);
  assert.equal(calls, 2);

  const overview = await answerEnvelope("LC-MS/MS에서 full validation 항목이 뭐야?", records, {
    client,
    store: fakeStore([]),
    index,
    generationPreference: "auto"
  });
  assert.equal(overview.route, "structured");
  assert.equal(overview.mode, "section_overview");
  assert.equal(calls, 2, "section overview must not call the generator");
});

test("cross-guideline generation that omits one side falls back to the complete structured comparison", async () => {
  const client = {
    complete: async ({ schema }) => schema.properties.verdicts
      ? { verdicts: [{ unit_index: 0, entailed: true, source_index: 0, reason: "supported" }] }
      : { answered: true, units: [{ text: "한 문서의 범위만 설명합니다.", source_index: 0 }] }
  };
  const env = await answerEnvelope(
    "M3(R2)와 S6(R1)의 적용 범위는 어떻게 달라?",
    records,
    { client, store: fakeStore([]), index, generationPreference: "auto" }
  );
  assert.equal(env.route, "structured");
  assert.equal(env.mode, "comparison");
  assert.deepEqual([...new Set(env.claims.map((claim) => claim.record.document_id))].sort(), ["ich_m3_r2", "ich_s6_r1"]);
});

// --- Grounded fallback routes via envelope (mocked clients + store, no network) ---

function fakeStore(candidateRecords) {
  return { search: async () => candidateRecords.map((record) => ({ record, score: 1 })) };
}

test("grounded-generation success and verification fallback both produce a fully-shaped envelope", async () => {
  const candidate = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const successClient = {
    complete: async ({ schema }) => schema.properties.verdicts
      ? { verdicts: [{ unit_index: 0, entailed: true, source_index: 0, reason: "matches" }] }
      : { answered: true, units: [{ text: "At least 5 replicates are required at each QC concentration level.", source_index: 0 }] }
  };
  const success = await answerEnvelope("replicate count", records, { client: successClient, store: fakeStore([candidate]), index });
  assert.equal(success.answered, true);
  assert.equal(success.mode, "generated");
  assert.equal(success.route, "grounded_generation");
  assert.ok(success.claims.length > 0);
  for (const claim of success.claims) assert.ok(claim.source_unit_id);

  const failClient = {
    complete: async ({ schema }) => schema.properties.verdicts
      ? { verdicts: [{ unit_index: 0, entailed: false, source_index: null, reason: "not supported" }] }
      : { answered: true, units: [{ text: "This is fabricated.", source_index: 0 }] }
  };
  const excerpts = await answerEnvelope("replicate count", records, { client: failClient, store: fakeStore([candidate]), index });
  assert.equal(excerpts.answered, true);
  assert.equal(excerpts.mode, "source_excerpts");
  assert.equal(excerpts.route, "source_excerpts");
  assert.equal(excerpts.answer_units[0].text, candidate.source_text);
});

// --- Stage C (docs/derived_semantic_layer.md §10): semantic_coverage on the grounded_generation synthesis box ---

function entailedClient(text) {
  return {
    complete: async ({ schema }) => schema.properties.verdicts
      ? { verdicts: [{ unit_index: 0, entailed: true, source_index: 0, reason: "supported" }] }
      : { answered: true, units: [{ text, source_index: 0 }] }
  };
}

test("semantic_coverage is present on a grounded_generation envelope for a document with a reviewed manifest, and reflects real facet coverage", async () => {
  const client = entailedClient("요약된 종합 답변입니다.");
  const env = await answerEnvelope("EMA FIH 가이드라인은 첫 투여 전에 뭘 종합해서 보라는 거야?", records, {
    client, store: fakeStore([]), index, generationPreference: "auto"
  });
  assert.equal(env.route, "grounded_generation");
  assert.ok(env.semantic_coverage, "expected a semantic_coverage annotation");
  const manifest = env.semantic_coverage.manifests.find((m) => m.manifest_id === "ema_fih.sem.manifest.document_overview");
  assert.ok(manifest);
  assert.equal(manifest.review_status, "reviewed");
  // Stage C is disclosure-only: it must never rewrite what was actually
  // generated or which claims/citations are shown.
  assert.ok(env.prose.startsWith("요약된 종합 답변입니다."));
});

test("semantic_coverage is null (not undefined, not an empty object) when nothing in the derived layer applies to this narrow structured topic", async () => {
  // M10's glossary section has no coverage_manifest scoped anywhere near
  // it — a real "genuinely not applicable" case, distinct from the
  // review_status filter (which test/engine_semantic_shadow.test.js
  // covers directly against a fake store).
  const client = { complete: async () => { throw new Error("must not be called"); } };
  const env = await answerEnvelope("M10 glossary에 정의는 뭐가 있어?", records, { client, store: fakeStore([]), index });
  assert.equal(env.route, "structured");
  assert.equal(env.semantic_coverage, null);
});

test("semantic_coverage is now also attached on the structured route — Stage C's grounded_generation-only scope was the first increment, not the final one", async () => {
  // No client at all (not even a throwing one): this question's mode
  // (multi_criterion) IS eligible for generation per shouldGenerate(), so
  // a throw-client would actually be invoked and throw. Omitting
  // generatorClient/verifierClient entirely is the deterministic way to
  // force the structured branch regardless of mode eligibility.
  const env = await answerEnvelope("분석 run을 accept하려면 calibration standard랑 QC가 각각 어떻게 돼야 해?", records, { index });
  assert.equal(env.route, "structured");
  assert.ok(env.semantic_coverage, "expected semantic_coverage on the structured route now that ich_m10.sem.manifest.run_acceptance is reviewed");
  const manifest = env.semantic_coverage.manifests.find((m) => m.manifest_id === "ich_m10.sem.manifest.run_acceptance");
  assert.ok(manifest);
  // Real Q06 shape: technique-agnostic wording leaves both branches ambiguous.
  assert.equal(manifest.status, "ambiguous");
});

test("semantic_coverage.comparison discloses the shared axis on a comparison answer, gated to reviewed bindings", async () => {
  // Same reasoning as above: comparison mode is generation-eligible, so no
  // client at all (not a throw-client) to force the deterministic structured path.
  const env = await answerEnvelope("M3(R2)와 S6(R1)의 적용 범위는 어떻게 달라?", records, { index });
  assert.equal(env.mode, "comparison");
  assert.ok(env.semantic_coverage, "expected a semantic_coverage annotation on the comparison answer");
  assert.ok(env.semantic_coverage.comparison, "expected a comparison entry");
  const axis = env.semantic_coverage.comparison.find((a) => a.axis_id === "scope.product_or_matrix");
  assert.ok(axis);
  assert.deepEqual(axis.bindings.map((b) => b.document_id).sort(), ["ich_m3_r2", "ich_s6_r1"]);
});

test("safeReviewedSemanticCoverage swallows an internal failure and returns null rather than throwing", () => {
  // A claim whose `record` access itself throws forces buildShadowPlan's
  // internal read path to fail — this must never propagate, since it sits
  // strictly after the real answer was already built.
  const poisonedClaim = { get record() { throw new Error("synthetic failure"); } };
  const result = safeReviewedSemanticCoverage("아무 질문", { claims: [poisonedClaim], scope: null });
  assert.equal(result, null);
});

test("a scope-excluded fallback query produces refusal.kind = scope_excluded via the envelope", async () => {
  const excluded = records.find((r) => r.id === "ich_s6_r1.kr.part1.3_3.001");
  assert.ok(excluded);
  const client = { complete: async () => { throw new Error("must not be called"); } };
  const env = await answerEnvelope("저분자 화합물의 독성 시험에서 종 선택 기준은?", records, { client, store: fakeStore([excluded]), index });
  assert.equal(env.answered, false);
  assert.equal(env.refusal.kind, "scope_excluded");
});
