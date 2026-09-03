const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const {
  classifyAnswerIntent,
  resolveRequestedDocumentIds,
  structuredQuery
} = require("../engine/query_router");

const { records, index } = loadStore();

function claimDocuments(match) {
  return new Set((match && match.claims || []).map((claim) => claim.record.document_id));
}

test("broad M10 full-validation request returns the complete child-section overview and never leaks another document", () => {
  const match = structuredQuery("LC-MS/MS에서 full validation 항목?", records, index);
  assert.ok(match && match.isSectionOverview);
  assert.equal(match.answerIntent, "section_overview");
  assert.equal(match.overviewSection.section_id, "ich_m10.sec.3_2");
  assert.equal(match.overviewGroups.length, 9);
  assert.equal(match.coverage.expected_section_count, 9);
  assert.equal(match.coverage.covered_section_count, 9);
  assert.deepEqual([...claimDocuments(match)], ["ich_m10"]);
});

test("a same-guideline concept comparison stays inside FDA 2014 instead of becoming a cross-guideline comparison", () => {
  const match = structuredQuery("patient-specific factor랑 product-specific factor를 비교해서 정리해줘.", records, index);
  assert.ok(match && match.isWithinDocumentComparison);
  assert.equal(match.answerIntent, "within_document_comparison");
  assert.deepEqual([...claimDocuments(match)], ["fda_ada_2014"]);
});

test("compound population question returns multiple M3 criteria in one scoped answer", () => {
  const match = structuredQuery("가임기 여성과 임산부는 뭐를 봐야 해?", records, index);
  assert.ok(match && match.isMultiCriterion);
  assert.equal(match.answerIntent, "multi_criterion");
  assert.ok(match.claims.length >= 2);
  assert.deepEqual([...claimDocuments(match)], ["ich_m3_r2"]);
});

test("explicit two-document duration comparison resolves only M3 and S6", () => {
  const match = structuredQuery("M3랑 S6에서 반복투여 독성시험 기간 차이?", records, index);
  assert.ok(match && match.isComparison);
  assert.deepEqual([...claimDocuments(match)].sort(), ["ich_m3_r2", "ich_s6_r1"]);
});

test("FIH toxicity overview is not collapsed to a sentinel scalar", () => {
  const match = structuredQuery("FIH 준비할 때 독성시험에서 뭘 봐?", records, index);
  assert.ok(match && match.isCoverageComposite);
  assert.equal(match.answerIntent, "topic_overview");
  assert.ok(match.claims.length >= 2);
  assert.deepEqual([...claimDocuments(match)], ["ema_fih"]);
});

test("bare clinical wording does not identify FDA 2014 as an explicitly requested document", () => {
  assert.equal(resolveRequestedDocumentIds("임상시험 전에 무엇을 준비해?", records), null);
});

test("crude Korean process wording is classified as a process rather than a scalar fact", () => {
  assert.equal(classifyAnswerIntent("stopping rule이랑 data review는 어떻게 연결돼?").kind, "process");
});

test("one-species exception wording never returns the opposite two-species duration rule as a structured answer", () => {
  const match = structuredQuery("관련 종이 한 종밖에 없으면 독성시험을 한 종으로 해도 돼?", records, index);
  assert.ok(match);
  assert.equal(match.record.id, "ich_s6_r1.kr.part2.2_2.005");
  const text = JSON.stringify(match || {});
  assert.doesNotMatch(text, /two relevant species|both a rodent and a non-rodent/i);
});

test("FIH non-clinical header question resolves section 6 rather than the dosing-selection chapter", () => {
  const match = structuredQuery("FIH 전에 보는 non-clinical 항목을 정리해줘.", records, index);
  assert.ok(match && match.isSectionOverview);
  assert.equal(match.overviewSection.section_id, "ema_fih.sec.6");
  assert.equal(match.overviewGroups.length, 6);
});

test("animal ADA interpretation is scoped to S6 toxicology rather than clinical ADA assay controls", () => {
  const match = structuredQuery("동물에서 항약물항체가 생기면 독성시험 결과를 어떻게 해석해야 해?", records, index);
  assert.ok(match);
  assert.equal(match.record.id, "ich_s6_r1.kr.3_6.003");
});

test("process selection retains later high-relevance EMA data-review and stopping-rule sections", () => {
  const match = structuredQuery("FIH stopping rule이랑 data review는 어떻게 연결돼?", records, index);
  assert.ok(match && match.isProcess);
  const sections = new Set(match.claims.map((claim) => claim.record.section_id));
  assert.ok(sections.has("ema_fih.sec.8_2_8"));
  assert.ok(sections.has("ema_fih.sec.8_2_9"));
});

test("cohort transition wording routes dose escalation to EMA FIH", () => {
  const match = structuredQuery("dose escalation은 어떤 정보 확인하고 다음 cohort로 넘어가?", records, index);
  assert.ok(match && match.isProcess);
  assert.deepEqual([...claimDocuments(match)], ["ema_fih"]);
  assert.ok(match.claims.some((claim) => claim.record.section_id === "ema_fih.sec.8_2_8"));
});

test("NOAEL in a microdose question does not force EMA starting-dose scope", () => {
  const match = structuredQuery("microdose Approach 1의 최대 용량과 NOAEL 기준은?", records, index);
  assert.ok(match && match.isMultiCriterion);
  assert.deepEqual([...claimDocuments(match)], ["ich_m3_r2"]);
  assert.deepEqual([...new Set(match.claims.map((claim) => claim.record.section_id))], ["ich_m3_r2.sec.7_1"]);
});

test("homologous protein wording routes to the S6 homologous-protein evidence", () => {
  const match = structuredQuery("relevant species가 없을 때 homologous protein은 언제 쓸 수 있어?", records, index);
  assert.ok(match);
  assert.deepEqual([...claimDocuments(match)], ["ich_s6_r1"]);
  assert.ok(match.claims.some((claim) => claim.record.section_id === "ich_s6_r1.sec.part2.2_3"));
});

test("compound duration and recovery question selects S6 evidence for both facets", () => {
  const match = structuredQuery("반복투여 독성시험 duration이랑 recovery는 어떻게 정해?", records, index);
  assert.ok(match && match.isMultiCriterion);
  assert.deepEqual([...claimDocuments(match)], ["ich_s6_r1"]);
  const sections = new Set(match.claims.map((claim) => claim.record.section_id));
  assert.ok(sections.has("ich_s6_r1.sec.part2.3_3"));
});

test("M3 broad development-support wording is rendered as a document overview", () => {
  const match = structuredQuery("ICH M3(R2)는 임상 개발 단계별로 어떤 비임상 자료를 다뤄?", records, index);
  assert.ok(match && match.isDocumentOverview);
  assert.equal(match.answerIntent, "document_overview");
  assert.deepEqual([...claimDocuments(match)], ["ich_m3_r2"]);
  assert.ok(match.claims.length >= 8);
});

test("validation taxonomy wording resolves the parent whose children are the validation types", () => {
  const match = structuredQuery("M10에서 분석법 밸리데이션 종류는 어떻게 나뉘어?", records, index);
  assert.ok(match && match.isSectionOverview);
  assert.equal(match.overviewSection.section_id, "ich_m10.sec.2_2");
  assert.deepEqual(match.overviewGroups.map((group) => group.section_number), ["2.2.1", "2.2.2", "2.2.3"]);
});

test("comma-separated named concepts are treated as a compound synthesis question", () => {
  const match = structuredQuery("건강인 초회 투여용량 정할 때 MABEL, NOAEL 같은 근거를 어떻게 같이 봐?", records, index);
  assert.ok(match && match.isMultiCriterion);
  assert.equal(match.answerIntent, "multi_criterion");
  assert.deepEqual([...claimDocuments(match)], ["ema_fih"]);
});

test("accuracy and precision contrast retains ordinary and LLOQ criteria for both measures", () => {
  const match = structuredQuery("LC-MS/MS accuracy와 precision 기준을 일반 QC랑 LLOQ로 나눠서 알려줘.", records, index);
  const ids = new Set(match.claims.map((claim) => claim.record.id));
  for (const id of [
    "ich_m10.qc.3_2_5_2.006",
    "ich_m10.qc.3_2_5_2.007",
    "ich_m10.qc.3_2_5_2.008",
    "ich_m10.qc.3_2_5_2.009"
  ]) assert.ok(ids.has(id), id);
});

test("clinical-trial duration wording selects the M3 duration matrix", () => {
  const match = structuredQuery("임상시험 기간이 길어지면 반복투여 독성시험 기간은 어떻게 맞춰야 해?", records, index);
  assert.ok(match && match.isProcess);
  assert.deepEqual([...claimDocuments(match)], ["ich_m3_r2"]);
  const ids = new Set(match.claims.map((claim) => claim.record.id));
  assert.ok(ids.has("ich_m3_r2.qc.5_1.001"));
  assert.ok(ids.has("ich_m3_r2.qc.5_1.005"));
});

test("positive ADA screening process retains confirmatory and downstream characterization evidence", () => {
  const match = structuredQuery("ADA screening 양성이면 그다음엔 뭘 확인해?", records, index);
  assert.ok(match && match.isProcess);
  const ids = new Set(match.claims.map((claim) => claim.record.id));
  assert.ok(ids.has("fda_ada.kr.IV_A_1.018"));
  assert.ok(ids.has("fda_ada.kr.IV_A_1.011"));
});

test("cross-guideline scope comparison prioritizes scope evidence over unrelated scalar criteria", () => {
  const match = structuredQuery("일반 저분자 의약품과 바이오의약품의 비임상 지원에서 M3(R2)와 S6(R1)의 적용 범위는 어떻게 달라?", records, index);
  assert.ok(match && match.isComparison);
  assert.deepEqual([...claimDocuments(match)].sort(), ["ich_m3_r2", "ich_s6_r1"]);
  assert.ok(match.claims.every((claim) => claim.record.type !== "quantitative_criterion"));
  assert.ok(match.claims.some((claim) => claim.record.section_number === "1.3" && claim.record.document_id === "ich_m3_r2"));
  assert.ok(match.claims.some((claim) => claim.record.section_number === "1.3" && claim.record.document_id === "ich_s6_r1"));
});
