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
});

// M5 Phase 1 item 2 (history/verification/engine_test_record_through_2026-08-28.md Entry 007 / M5 plan §1a): a
// comparison answer used to append a hardcoded, uncited "Key Comparison
// Takeaway" paragraph — including a study-design recommendation with no
// source_unit_id behind it — regardless of what was actually retrieved.
// These assert the real invariant (every claim traces to a resolvable
// citation, the takeaway is gone), not just that a header phrase appears.
test("a comparison answer never contains the removed uncited takeaway, and every claim has a real citation", () => {
  const match = structuredQuery("FDA ADA vs ICH M10 LBA 밸리데이션 차이점 비교", records, index);
  assert.ok(match && match.claims && match.claims.length > 0, "comparison match must expose a non-empty claims list");

  for (const claim of match.claims) {
    assert.ok(claim.source_unit_id, "every comparison claim must have a source_unit_id");
    assert.ok(index.sourceUnits.get(claim.source_unit_id), `claim's source_unit_id ${claim.source_unit_id} must resolve in the archive`);
  }

  const text = formatAnswer(match);
  assert.doesNotMatch(text, /Key Comparison Takeaway/);
  assert.doesNotMatch(text, /프로토콜을 수립해야 합니다/);
  assert.doesNotMatch(text, /엄격한 요건을 모두 충족/);
});

// Real document titles, not raw internal ids — the pre-fix bug:
// comparison_engine.js's index-lookup fallback degraded to
// `{title: docId}` whenever `index` wasn't available, which was always
// true through answer() (it never passed index into structuredQuery).
// Fixed two ways: docTitle now derives from the records' own
// document_title field (data_store.js) first, independent of `index`
// altogether; and answer() now also accepts and forwards an optional
// `index` (used by amendment's section-fallback resolution, see below),
// so both the index-present and index-absent paths are covered here.
// ich_m3_r2 isn't in formatComparativeAnswer's short hardcoded label table
// (ich_m10/fda_ada/ema_fih/ich_s6_r1 only), so it's the case that actually
// exercises the docTitle fallback in rendered output, not just the
// docResults data.
test("comparison docTitle is a real title, never the raw document id, with or without index passed through", async () => {
  const match = structuredQuery("FDA ADA vs ICH M10 LBA 밸리데이션 차이점 비교", records, index);
  const titles = match.docResults.map((d) => d.docTitle);
  assert.ok(!titles.includes("ich_m10"), "docTitle must never fall back to the raw document id");
  assert.ok(!titles.includes("fda_ada"), "docTitle must never fall back to the raw document id");

  const m3Match = structuredQuery("ICH M3와 EMA FIH 시작용량 비교", records, index);
  assert.ok(m3Match && m3Match.docResults.some((d) => d.docId === "ich_m3_r2"));
  const m3Text = formatAnswer(m3Match);
  assert.match(m3Text, /Guidance on Nonclinical Safety Studies/);
  assert.doesNotMatch(m3Text, /📌 \d\. ich_m3_r2 /);

  // Without index (older/simpler call sites still work correctly).
  const viaAnswerNoIndex = await answer("ICH M3와 EMA FIH 시작용량 비교", records);
  assert.match(viaAnswerNoIndex.text, /Guidance on Nonclinical Safety Studies/);

  // With index (cli.js/eval_harness.js/retest script all now pass it).
  const viaAnswerWithIndex = await answer("ICH M3와 EMA FIH 시작용량 비교", records, { index });
  assert.match(viaAnswerWithIndex.text, /Guidance on Nonclinical Safety Studies/);
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

// M5 Phase 1 item 3 (history/verification/engine_test_record_through_2026-08-28.md Entry 007 / M5 plan §1b):
// GUIDELINE_REVISIONS[*].keyNotes[].sourceUnitId was captured but never
// read anywhere — every "Key Amendment" bullet rendered with zero
// citation, for every document, unconditionally. These assert the real
// invariant instead of a header-phrase regex.
test("every amendment claim has a real, resolvable citation, and no unresolved note is shown in any form", () => {
  const match = structuredQuery("ICH S6 Addendum의 주요 개정 이력 및 Note 내용", records, index);
  assert.ok(match.claims.length > 0, "at least Note 1 must resolve for S6(R1)");
  for (const claim of match.claims) {
    assert.ok(claim.source_unit_id);
    assert.ok(index.sourceUnits.get(claim.source_unit_id), `claim's source_unit_id ${claim.source_unit_id} must resolve`);
    assert.ok(claim.citation && claim.citation.source_unit_id === claim.source_unit_id);
  }

  const text = formatAnswer(match);
  // S6(R1) has 5 keyNotes hardcoded but only 1 (Note 1) has any linked
  // structured content anywhere in the archive (verified directly against
  // the index — Notes 2-7's referenced SourceUnits don't exist at all).
  // The other 4 must not appear in any form, not even as "no grounding."
  assert.doesNotMatch(text, /Note 2\]/);
  assert.doesNotMatch(text, /근거 없음/);
  assert.doesNotMatch(text, /편집 주석/);
});

// The section-level fallback: a hardcoded sourceUnitId pointing at a
// section-heading SourceUnit (which correctly has no KnowledgeRecord of
// its own) still resolves to real content from that same section, rather
// than being dropped even though the section has substantial real
// content. Verified against real EMA FIH data (0/3 resolved before this
// fallback existed, 3/3 after).
test("amendment resolution falls back to a real record in the same section when the exact sourceUnitId is a heading with no linked record", () => {
  const headingUnit = index.sourceUnits.get("ema_fih.su.8_2_9.001");
  assert.ok(headingUnit, "fixture assumption: this heading unit exists in the archive");
  assert.ok(!records.some((r) => r.source_unit_ids && r.source_unit_ids.includes("ema_fih.su.8_2_9.001")), "fixture assumption: the heading itself has no linked record");

  const match = structuredQuery("EMA FIH 가이던스 개정 이력", records, index);
  assert.equal(match.docId, "ema_fih");
  assert.equal(match.claims.length, match.revInfo.keyNotes.length, "all 3 EMA FIH notes must resolve via the section fallback");

  // The 8.2.9 (Stopping Rules) note specifically must land in the 8.2.9
  // section, not some other section entirely — the fallback must stay
  // scoped to the target's own section, not just "any record."
  const stoppingRulesClaim = match.claims.find((c) => c.note === "Stopping Rules");
  assert.ok(stoppingRulesClaim);
  assert.equal(stoppingRulesClaim.citation.section_id, headingUnit.section_id);
  for (const claim of match.claims) {
    assert.ok(index.sourceUnits.get(claim.source_unit_id));
  }
});

test("answer() uses the structured route for cross-guideline comparisons with 0 LLM calls", async () => {
  const res = await answer("EMA FIH와 ICH S6의 비임상 동물종 선정 기준 비교", records);
  assert.equal(res.answered, true);
  assert.equal(res.route, "structured");
  assert.match(res.text, /규제 가이던스 상호 비교 분석/);
  assert.match(res.text, /EMA/);
  assert.match(res.text, /S6/);
});
