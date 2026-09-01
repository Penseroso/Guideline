const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { answer } = require("../engine/query_router");
const { answerEnvelope, ENVELOPE_VERSION } = require("../engine/answer_envelope");
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
  assert.equal(list.mode, "list");
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

test("a scope-excluded fallback query produces refusal.kind = scope_excluded via the envelope", async () => {
  const excluded = records.find((r) => r.id === "ich_s6_r1.kr.part1.3_3.001");
  assert.ok(excluded);
  const client = { complete: async () => { throw new Error("must not be called"); } };
  const env = await answerEnvelope("저분자 화합물의 독성 시험에서 종 선택 기준은?", records, { client, store: fakeStore([excluded]), index });
  assert.equal(env.answered, false);
  assert.equal(env.refusal.kind, "scope_excluded");
});
