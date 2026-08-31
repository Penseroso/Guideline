const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { answer } = require("../engine/query_router");
const { answerEnvelope, ENVELOPE_VERSION } = require("../engine/answer_envelope");
const fixture = require("./fixtures/eval_questions.json");

const { records, index } = loadStore();

// M5 Phase 2 (history/verification/engine_test_record_through_2026-08-28.md Entry 008 / M5 plan): the envelope
// mirrors structuredQuery/answerOptionB directly rather than wrapping
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

test("envelope shape is always fully populated, whichever mode/path is taken", async () => {
  const hit = await answerEnvelope("minimum replicates required at each QC concentration level", records, { index });
  assert.equal(hit.envelope_version, ENVELOPE_VERSION);
  assert.equal(hit.answered, true);
  assert.equal(hit.mode, "structured");
  assert.equal(hit.path, "A");
  assert.equal(typeof hit.prose, "string");
  assert.equal(hit.refusal, null);
  assert.ok(Array.isArray(hit.claims) && hit.claims.length > 0);
  assert.ok(Array.isArray(hit.answer_units) && hit.answer_units.length > 0);
  assert.equal(hit.answer_units[0].source_unit_id, hit.claims[0].source_unit_id);
  assert.ok(["reviewed", "needs_review"].includes(hit.review_status));
  assert.equal(typeof hit.timing_ms, "number");

  const refusalNoProvider = await answerEnvelope("what is the meaning of life", records, { index });
  assert.equal(refusalNoProvider.answered, false);
  assert.equal(refusalNoProvider.mode, "refusal");
  assert.equal(refusalNoProvider.path, null);
  assert.equal(refusalNoProvider.refusal.kind, "no_provider");
  assert.deepEqual(refusalNoProvider.claims, []);
  assert.deepEqual(refusalNoProvider.answer_units, []);
});

test("mode discriminates comparison, amendment, and list distinctly — the information answer()'s own top-level result never exposed", async () => {
  const comparison = await answerEnvelope("FDA ADA vs ICH M10 LBA 밸리데이션 차이점 비교", records, { index });
  assert.equal(comparison.mode, "comparison");
  assert.equal(comparison.path, "A");

  const amendment = await answerEnvelope("ICH S6 Addendum의 주요 개정 이력 및 Note 내용", records, { index });
  assert.equal(amendment.mode, "amendment");

  const list = await answerEnvelope("LBA 밸리데이션 항목", records, { index });
  assert.equal(list.mode, "list");
});

// --- Option B via envelope (mocked client + store, no network) ---

function fakeStore(candidateRecords) {
  return { search: async () => candidateRecords.map((record) => ({ record, score: 1 })) };
}

test("Option B success and refusal both produce a fully-shaped envelope", async () => {
  const candidate = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const successClient = {
    complete: async ({ schema }) => schema.properties.verdicts
      ? { verdicts: [{ unit_index: 0, entailed: true, source_index: 0, reason: "matches" }] }
      : { answered: true, units: [{ text: "At least 5 replicates are required at each QC concentration level." }] }
  };
  const success = await answerEnvelope("replicate count", records, { client: successClient, store: fakeStore([candidate]), index });
  assert.equal(success.answered, true);
  assert.equal(success.mode, "rag");
  assert.equal(success.path, "B");
  assert.ok(success.claims.length > 0);
  for (const claim of success.claims) assert.ok(claim.source_unit_id);

  const failClient = {
    complete: async ({ schema }) => schema.properties.verdicts
      ? { verdicts: [{ unit_index: 0, entailed: false, source_index: null, reason: "not supported" }] }
      : { answered: true, units: [{ text: "This is fabricated." }] }
  };
  const refused = await answerEnvelope("replicate count", records, { client: failClient, store: fakeStore([candidate]), index });
  assert.equal(refused.answered, false);
  assert.equal(refused.mode, "refusal");
  assert.equal(refused.path, "B");
  assert.equal(refused.refusal.kind, "verification_failed");
});

test("a scope-excluded Option B query produces refusal.kind = scope_excluded via the envelope", async () => {
  const excluded = records.find((r) => r.id === "ich_s6_r1.kr.part1.3_3.001");
  assert.ok(excluded);
  const client = { complete: async () => { throw new Error("must not be called"); } };
  const env = await answerEnvelope("저분자 화합물의 독성 시험에서 종 선택 기준은?", records, { client, store: fakeStore([excluded]), index });
  assert.equal(env.answered, false);
  assert.equal(env.refusal.kind, "scope_excluded");
});
