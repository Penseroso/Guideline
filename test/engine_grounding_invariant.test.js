const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { structuredQuery } = require("../engine/query_router");
const fixture = require("./fixtures/eval_questions.json");

const { records, index } = loadStore();

/**
 * M5 plan Phase 1 item 9 (history/verification/engine_test_record_through_2026-08-28.md Entry 007/008): the actual
 * acceptance bar for the grounding fixes is not "does this string contain
 * a citation" (checkOne in engine/eval_harness.js only ever checked a
 * single expected substring against the whole answer text, which is how
 * the comparison/amendment defects shipped invisibly under a reported
 * 100% citation_precision — see engine_m4_comparison_amendment.test.js
 * and history/verification/engine_test_record_through_2026-08-28.md Entry 007 for the concrete reproduction). The
 * real invariant is structural: every claim a match object carries has a
 * source_unit_id that resolves to a real SourceUnit in the archive. This
 * is asserted directly on `claims[]`, never by re-parsing rendered prose,
 * so it stays stable across future formatting changes.
 */
function assertAllClaimsGrounded(claims, label) {
  assert.ok(Array.isArray(claims), `${label}: match must expose a claims array`);
  assert.ok(claims.length > 0, `${label}: claims array must be non-empty for an answered match`);
  for (const claim of claims) {
    assert.ok(claim.source_unit_id, `${label}: claim missing source_unit_id — ${JSON.stringify(claim.record?.id)}`);
    assert.ok(index.sourceUnits.get(claim.source_unit_id), `${label}: claim's source_unit_id ${claim.source_unit_id} does not resolve in the archive`);
    assert.ok(claim.citation, `${label}: claim missing a citation object`);
    assert.equal(claim.citation.source_unit_id, claim.source_unit_id, `${label}: citation must match the claim's own source_unit_id`);
  }
}

test("every answer-expected gold question that resolves via structured routing produces a fully grounded claims list", () => {
  let checked = 0;
  for (const q of fixture.questions) {
    if (!q.expect_answered) continue;
    const match = structuredQuery(q.question, records, index);
    if (!match) continue; // falls through to grounded retrieval in the real system; not this test's concern
    assertAllClaimsGrounded(match.claims, q.id);
    checked++;
  }
  // Sanity: this must actually have exercised a meaningful number of
  // real structured matches, not silently checked zero.
  assert.ok(checked >= 10, `expected to check at least 10 structured matches, only checked ${checked}`);
});

test("every mode independently: structured single record, criterion, section-overview/list-composite, sibling-composite, comparison, amendment", () => {
  const single = structuredQuery("minimum replicates required at each QC concentration level", records, index);
  assert.ok(single);
  assertAllClaimsGrounded(single.claims, "single-record criterion");

  const list = structuredQuery("LBA 밸리데이션 항목", records, index);
  assert.ok(list && (list.isSectionOverview || list.isListComposite));
  assertAllClaimsGrounded(list.claims, list.isSectionOverview ? "section-overview" : "list-composite");

  const siblingComposite = structuredQuery("accuracy 허용기준", records, index);
  assert.ok(siblingComposite && siblingComposite.isComposite);
  assertAllClaimsGrounded(siblingComposite.claims, "sibling-composite");

  const comparison = structuredQuery("FDA ADA vs ICH M10 LBA 밸리데이션 차이점 비교", records, index);
  assert.ok(comparison && comparison.isComparison);
  assertAllClaimsGrounded(comparison.claims, "comparison");

  const amendment = structuredQuery("ICH S6 Addendum의 주요 개정 이력 및 Note 내용", records, index);
  assert.ok(amendment && amendment.isAmendment);
  assertAllClaimsGrounded(amendment.claims, "amendment");

  const bareKr = structuredQuery("펩타이드 접합체 신규 독소 관련 종 선택", records, index) || structuredQuery("ADC 신규 독소 종 선택", records, index);
  if (bareKr && !bareKr.isComposite && !bareKr.isComparison && !bareKr.isAmendment) {
    assertAllClaimsGrounded(bareKr.claims, "single knowledge_record");
  }
});

test("no claim's record is missing citations entirely, across every answerable record type in the archive (upstream data invariant the claims list depends on)", () => {
  const withoutCitation = records.filter((r) => !r.citations || r.citations.length === 0);
  assert.equal(withoutCitation.length, 0, `${withoutCitation.length} answerable records have zero citations — the claims grounding invariant cannot hold if the underlying data doesn't`);
});
