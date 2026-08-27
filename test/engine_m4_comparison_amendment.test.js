const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { structuredQuery, formatAnswer, answer } = require("../engine/query_router");
const { isComparisonQuery, answerComparison } = require("../engine/comparison_engine");
const { isAmendmentQuery, answerAmendment } = require("../engine/amendment_engine");

const { records, index } = loadStore();

test("isComparisonQuery detects comparative inquiry markers", () => {
  assert.equal(isComparisonQuery("FDA ADA vs ICH M10 차이점 비교"), true);
  assert.equal(isComparisonQuery("EMA FIH와 ICH S6 동물종 선정 기준 비교"), true);
  assert.equal(isComparisonQuery("LBA accuracy 기준은?"), false);
});

test("isAmendmentQuery detects revision and amendment markers", () => {
  assert.equal(isAmendmentQuery("ICH S6 Addendum 개정 이력"), true);
  assert.equal(isAmendmentQuery("EMA FIH 가이던스 개정판 주요 변경사항"), true);
  assert.equal(isAmendmentQuery("FDA ADA 컷포인트 수치 기준"), false);
});

test("structuredQuery routes comparison query to comparative answer format", () => {
  const match = structuredQuery("FDA ADA vs ICH M10 LBA 밸리데이션 차이점 비교", records, index);
  assert.ok(match);
  assert.equal(match.isComparison, true);
  assert.ok(match.docResults.length >= 2);

  const text = formatAnswer(match);
  assert.match(text, /규제 가이던스 상호 비교 분석/);
  assert.match(text, /FDA/);
  assert.match(text, /ICH/);
  assert.match(text, /비교 요약/);
});

test("structuredQuery routes amendment query to revision history format", () => {
  const match = structuredQuery("ICH S6 Addendum의 주요 개정 이력 및 Note 내용", records, index);
  assert.ok(match);
  assert.equal(match.isAmendment, true);
  assert.ok(match.revInfo);

  const text = formatAnswer(match);
  assert.match(text, /가이던스 개정 이력 및 유효 규제 상태/);
  assert.match(text, /S6\(R1\)/);
  assert.match(text, /Note 1/);
});

test("answer() executes Option A for cross-guideline comparisons with 0 LLM calls", async () => {
  const res = await answer("EMA FIH와 ICH S6의 비임상 동물종 선정 기준 비교", records);
  assert.equal(res.answered, true);
  assert.equal(res.path, "A");
  assert.match(res.text, /규제 가이던스 상호 비교 분석/);
  assert.match(res.text, /EMA/);
  assert.match(res.text, /S6/);
});
