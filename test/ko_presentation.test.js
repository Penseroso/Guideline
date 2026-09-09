const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore, trustedKoPresentation } = require("../engine/data_store");
const { presentRecord } = require("../engine/answer_presenter");
const { answerEnvelope, ENVELOPE_VERSION } = require("../engine/answer_envelope");
const { structuredQuery } = require("../engine/query_router");
const { sourceHash, validateKoPresentation } = require("../validation/validate_ko_presentation");

const { records, index } = loadStore();

test("the Korean presentation overlay covers every answerable record with current source hashes", () => {
  const result = validateKoPresentation();
  assert.equal(result.ok, true, result.errors.slice(0, 5).join("\n"));
  assert.equal(result.entryCount, 2693);
  assert.equal(result.entryCount, result.targetCount);
});

test("an unattested KnowledgeRecord normalization fails closed to source-derived semantics", () => {
  const record = {
    type: "knowledge_record",
    subject: "Consultation with the regulatory authority",
    action: "is recommended",
    object: null,
    source_text: "Consultation with the regulatory authority is recommended.",
    normalized_ko: null,
    normalization_status: "needs_review"
  };
  assert.equal(trustedKoPresentation(undefined, record.source_text, "\uaddc\uc81c\uae30\uad00\uacfc\uc758 \ud611\uc758\uac00 \uad8c\uc7a5\ub41c\ub2e4."), null);
  assert.equal(presentRecord(record, "ko"), "Consultation with the regulatory authority is recommended");
});

test("runtime rejects a reviewed presentation entry when its source hash is stale", () => {
  const entry = {
    record_type: "condition",
    source_text_sha256: "0".repeat(64),
    normalized_ko: "\uc9c4\ud589 \uc911\uc778 \uc2dc\ud5d8\uc778 \uacbd\uc6b0",
    normalization_status: "reviewed"
  };
  assert.equal(trustedKoPresentation(entry, "if the study is ongoing"), null);
});

test("runtime rejects a KnowledgeRecord presentation when its normalized-text hash is stale", () => {
  const sourceText = "Consultation is recommended.";
  const normalizedKo = "\ud611\uc758\uac00 \uad8c\uc7a5\ub41c\ub2e4.";
  const entry = {
    record_type: "knowledge_record",
    source_text_sha256: sourceHash(sourceText),
    normalized_ko_sha256: "0".repeat(64),
    normalization_status: "reviewed"
  };
  assert.equal(trustedKoPresentation(entry, sourceText, normalizedKo), null);
});

test("a reviewed quantitative overlay becomes the primary Korean answer without changing source_text", () => {
  const record = records.find((item) => item.id === "ich_m10.qc.3_2_5_2.007");
  assert.ok(record);
  assert.equal(record.normalization_status, "reviewed");
  assert.match(record.normalized_ko, /LLOQ/);
  assert.match(presentRecord(record, "ko"), /\u00b120%/);
  assert.equal(record.source_text, "except at the LLOQ, where it should be within \u00b120%");
});

test("a needs_review normalization is never used as the primary answer", () => {
  const synthetic = {
    type: "condition",
    source_text: "if the study is ongoing",
    normalized_ko: "\uac80\uc99d\ub418\uc9c0 \uc54a\uc740 \ubc88\uc5ed",
    normalization_status: "needs_review"
  };
  assert.equal(presentRecord(synthetic, "ko"), synthetic.source_text);
});

test("answer envelope 2.6 returns citation-linked answer_units in the requested language", async () => {
  const envelope = await answerEnvelope("LLOQ \uc815\ud655\ub3c4 \uae30\uc900\uc740 \ubb34\uc5c7\uc778\uac00?", records, { index, responseLanguage: "ko" });
  assert.equal(ENVELOPE_VERSION, "2.6.0");
  assert.equal(envelope.answered, true);
  assert.ok(envelope.answer_units.length > 0);
  assert.match(envelope.answer_units[0].text, /\u00b120%/);
  assert.ok(envelope.answer_units[0].record_id);
  assert.ok(envelope.answer_units[0].source_unit_id);
});

test("starting-dose relevance guard abstains instead of returning the sentinel subject-count criterion", () => {
  const match = structuredQuery("what is the recommended starting dose for first-in-human phase 1 trials", records, index);
  assert.equal(match, null);
});
