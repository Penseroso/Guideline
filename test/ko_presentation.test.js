const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { presentRecord } = require("../engine/answer_presenter");
const { answerEnvelope, ENVELOPE_VERSION } = require("../engine/answer_envelope");
const { structuredQuery } = require("../engine/query_router");
const { validateKoPresentation } = require("../validation/validate_ko_presentation");

const { records, index } = loadStore();

test("the Korean presentation overlay covers every quantitative criterion and condition with current source hashes", () => {
  const result = validateKoPresentation();
  assert.equal(result.ok, true, result.errors.slice(0, 5).join("\n"));
  assert.equal(result.entryCount, 1131);
  assert.equal(result.entryCount, result.targetCount);
});

test("a reviewed quantitative overlay becomes the primary Korean answer without changing source_text", () => {
  const record = records.find((item) => item.id === "ich_m10.qc.3_2_5_2.007");
  assert.ok(record);
  assert.equal(record.normalization_status, "reviewed");
  assert.match(record.normalized_ko, /LLOQ/);
  assert.match(presentRecord(record, "ko"), /±20%/);
  assert.equal(record.source_text, "except at the LLOQ, where it should be within ±20%");
});

test("a needs_review normalization is never used as the primary answer", () => {
  const synthetic = {
    type: "condition",
    source_text: "if the study is ongoing",
    normalized_ko: "검증되지 않은 번역",
    normalization_status: "needs_review"
  };
  assert.equal(presentRecord(synthetic, "ko"), synthetic.source_text);
});

test("answer envelope 2.0 returns citation-linked answer_units in the requested language", async () => {
  const envelope = await answerEnvelope("LLOQ 정확도 기준은 무엇인가요?", records, { index, responseLanguage: "ko" });
  assert.equal(ENVELOPE_VERSION, "2.0.0");
  assert.equal(envelope.answered, true);
  assert.ok(envelope.answer_units.length > 0);
  assert.match(envelope.answer_units[0].text, /±20%/);
  assert.ok(envelope.answer_units[0].record_id);
  assert.ok(envelope.answer_units[0].source_unit_id);
});

test("starting-dose relevance guard abstains instead of returning the sentinel subject-count criterion", () => {
  const match = structuredQuery("what is the recommended starting dose for first-in-human phase 1 trials", records, index);
  assert.equal(match, null);
});
