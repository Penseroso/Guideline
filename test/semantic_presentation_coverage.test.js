const assert = require("node:assert/strict");
const test = require("node:test");

const { auditSemanticPresentation } = require("../scripts/audit_semantic_presentation");
const { loadStore } = require("../engine/data_store");
const { answerEnvelope } = require("../engine/answer_envelope");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { buildReviewedSemanticCoverage } = require("../engine/semantic_shadow");

test("every applicable summary_spec has a fresh reviewed Korean presentation entry", () => {
  const result = auditSemanticPresentation();
  assert.equal(result.ok, true, result.errors.slice(0, 10).join("\n"));
  assert.equal(result.rows.length, 50);
  assert.equal(result.rows.filter((row) => row.present && row.reviewed && row.fresh).length, 50);
  assert.equal(result.rows.reduce((sum, row) => sum + row.gap_count, 0), 0);
  assert.deepEqual([...new Set(result.rows.flatMap((row) => row.gap_reasons))], []);
});

function withoutPresentationText(value) {
  if (Array.isArray(value)) return value.map(withoutPresentationText);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "text" && Object.hasOwn(value, "summary_id")) continue;
    result[key] = withoutPresentationText(item);
  }
  return result;
}

test("presentation activation changes summary text only, not manifest coverage planning", async () => {
  const { records, index } = loadStore();
  const semanticStore = loadSemanticOverlayStore();
  const noPresentationStore = { ...semanticStore, presentationByDocumentId: new Map() };
  const questions = [
    "EMA FIH 비임상 측면은 무엇을 다루나?",
    "ICH M10 크로마토그래피 밸리데이션은 어떻게 구성되나?",
    "FDA ADA 분석 설계 요소는 무엇인가?",
    "ICH S6(R1) 특정 고려사항은 무엇을 다루나?"
  ];
  for (const question of questions) {
    const envelope = await answerEnvelope(question, records, { index, generationPreference: "prefer_structured" });
    const withText = buildReviewedSemanticCoverage(question, envelope, { store: semanticStore });
    const withoutText = buildReviewedSemanticCoverage(question, envelope, { store: noPresentationStore });
    assert.deepEqual(withoutPresentationText(withText), withoutPresentationText(withoutText));
  }
});

