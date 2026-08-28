const test = require("node:test");
const assert = require("node:assert/strict");

const R = require("../web/render.js");

const i18n = {
  openPdf: "PDF 열기",
  applicableConditions: "적용 조건",
  crossReferences: "관련 조항",
  claimMissingCitation: "citation missing, claim withheld",
  normalizedKoLabel: "한국어 정규화 (참고)",
  pathALabel: "Path A",
  pathASub: "archive quoted directly",
  pathBLabel: "Path B",
  pathBSub: "generated, entailment-verified",
  pathExtractiveLabel: "Source excerpts",
  pathExtractiveSub: "verbatim, no generation",
  refusalTitle: "근거를 찾지 못했습니다",
  refusalBody: "이것은 archive-coverage 문제입니다",
  refusalNoMatch: "no match",
  refusalScopeExcluded: "scope excluded",
  refusalNoProvider: "no provider",
  refusalVerificationFailed: "verification failed",
  comparisonNote: "side by side, no judgment",
  parentVersion: "Parent",
  currentVersion: "Current",
  reviewStatusMeaning: "passed the pipeline, not human-read"
};

function realCitation(overrides) {
  return {
    source_unit_id: "ich_m10.su.3_2_5_2.005",
    document_id: "ich_m10",
    guideline_code: "M10",
    section_number: "3.2.5.2",
    section_title: "Evaluation of Accuracy and Precision",
    printed_page_label: "14",
    pdf_page_index_zero_based: 13,
    section_path: ["CHROMATOGRAPHY", "Validation", "Accuracy and Precision"],
    ...overrides
  };
}

test("escapeHtml neutralizes script tags and quotes — the injection invariant", () => {
  const escaped = R.escapeHtml(`<script>alert(1)</script> "quoted" 'single'`);
  assert.doesNotMatch(escaped, /<script>/);
  assert.match(escaped, /&lt;script&gt;/);
  assert.match(escaped, /&quot;quoted&quot;/);
});

test("a MUST-modality claim renders the MUST chip", () => {
  const claim = {
    citation: realCitation(),
    record: { type: "knowledge_record", modality: "must", original_modal_text: "must", source_text: "The sponsor must validate the method." }
  };
  const html = R.renderClaimCard(claim, i18n);
  assert.match(html, /modality-must/);
  assert.match(html, />MUST</);
});

test("a modality:none record renders an explicit NONE chip, never silently omitted", () => {
  const claim = {
    citation: realCitation(),
    record: { type: "knowledge_record", modality: "none", source_text: "Bioanalytical method validation is essential." }
  };
  const html = R.renderClaimCard(claim, i18n);
  assert.match(html, /modality-none/);
  assert.match(html, />NONE</);
});

// The hard invariant (M5 plan Phase 4 / §1.1): a missing citation must
// render the error placeholder, and the claim's content must NOT appear
// anywhere in the output — a UI bug must fail loud, never quietly ship
// an uncited claim.
test("a claim with no citation renders the error placeholder, and the claim content never appears", () => {
  const claim = { citation: null, record: { type: "knowledge_record", source_text: "SHOULD-NOT-APPEAR-ANYWHERE", modality: "must" } };
  const html = R.renderClaimCard(claim, i18n);
  assert.match(html, /claim-error/);
  assert.doesNotMatch(html, /SHOULD-NOT-APPEAR-ANYWHERE/);

  const claimNoSourceUnit = { citation: { document_id: "x" }, record: { type: "knowledge_record", source_text: "ALSO-SHOULD-NOT-APPEAR" } };
  const html2 = R.renderClaimCard(claimNoSourceUnit, i18n);
  assert.match(html2, /claim-error/);
  assert.doesNotMatch(html2, /ALSO-SHOULD-NOT-APPEAR/);
});

test("<script> content inside source_text is escaped, never executed as markup", () => {
  const claim = {
    citation: realCitation(),
    record: { type: "knowledge_record", modality: "should", source_text: '<script>alert(1)</script>' }
  };
  const html = R.renderClaimCard(claim, i18n);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
});

test("refusal envelope renders the refusal card, distinctly from an error state — never claim content", () => {
  const envelope = { answered: false, mode: "refusal", path: "B", refusal: { kind: "scope_excluded", reason: null }, claims: [] };
  const html = R.renderEnvelope(envelope, i18n);
  assert.match(html, /class="refusal"/);
  assert.doesNotMatch(html, /claim-error/, "a refusal is not the same thing as a missing-citation error");
  assert.match(html, /scope excluded/);
});

test("value_status: needs_review renders its warning banner on the criterion card", () => {
  const claim = {
    citation: realCitation(),
    record: {
      type: "quantitative_criterion", parameter: "selected concentration", comparator: "within", value: null,
      value_fraction: null, unit: null, value_status: "needs_review", source_text: "for example, EC50 to EC80"
    }
  };
  const html = R.renderClaimCard(claim, i18n);
  assert.match(html, /value-status-note/);
  assert.match(html, /needs_review/);
});

test("value_status: known renders no warning note at all", () => {
  const claim = {
    citation: realCitation(),
    record: { type: "quantitative_criterion", parameter: "accuracy", comparator: "within", value: 15, unit: "%", value_status: "known" }
  };
  const html = R.renderClaimCard(claim, i18n);
  assert.doesNotMatch(html, /value-status-note/);
});

// The §2.5.1 guard: review_status is uniformly "reviewed" across the
// whole archive today, so a per-card badge would misleadingly read as
// human sign-off. This is a negative assertion on purpose.
test("review_status:'reviewed' renders NO per-card badge anywhere in a claim card", () => {
  const claim = {
    citation: realCitation(),
    record: { type: "knowledge_record", modality: "should", source_text: "text", review_status: "reviewed" }
  };
  const html = R.renderClaimCard(claim, i18n);
  assert.doesNotMatch(html, /review-status-badge/);
  assert.doesNotMatch(html, />reviewed</i);
});

test("the transparency footer states the §2.5.1 meaning of review_status, once, at the envelope level", () => {
  const envelope = {
    answered: true, mode: "structured", path: "A",
    claims: [{ citation: realCitation(), record: { type: "knowledge_record", modality: "should", source_text: "t", review_status: "reviewed" } }]
  };
  const html = R.renderEnvelope(envelope, i18n);
  assert.match(html, /transparency-footer/);
  assert.match(html, /passed the pipeline, not human-read/);
});

test("path A and path B verdict bars are structurally distinct classes, not just a color/label difference", () => {
  const envA = { answered: true, mode: "structured", path: "A", claims: [{ citation: realCitation(), record: { type: "knowledge_record", modality: "must", source_text: "t" } }] };
  const envB = { answered: true, mode: "rag", path: "B", claims: [{ citation: realCitation(), record: { type: "knowledge_record", modality: "must", source_text: "t" } }] };
  assert.match(R.renderVerdictBar(envA, i18n), /class="verdict verdict-a"/);
  assert.match(R.renderVerdictBar(envB, i18n), /class="verdict verdict-b"/);
  assert.doesNotMatch(R.renderVerdictBar(envA, i18n), /class="verdict verdict-b"/);
});

test("extractive Path B is labeled as verbatim source text, never generated prose", () => {
  const envelope = { answered: true, mode: "extractive", path: "B", claims: [] };
  const html = R.renderVerdictBar(envelope, i18n);
  assert.match(html, /Source excerpts/);
  assert.match(html, /verbatim, no generation/);
  assert.doesNotMatch(html, /generated, entailment-verified/);
});

test("Path A answer text follows the active locale without issuing a new query", () => {
  const envelope = {
    answered: true,
    mode: "structured",
    path: "A",
    answer_units: [{ text: "STALE-API-TEXT", record_id: "kr.1", source_unit_id: "ich_m10.su.3_2_5_2.005" }],
    claims: [{
      source_unit_id: "ich_m10.su.3_2_5_2.005",
      citation: realCitation(),
      record: {
        id: "kr.1",
        type: "knowledge_record",
        modality: "should",
        source_text: "ENGLISH-SOURCE-TEXT",
        normalized_ko: "KOREAN-PRESENTATION",
        normalization_status: "reviewed"
      }
    }]
  };

  const koHtml = R.renderEnvelope(envelope, { ...i18n, locale: "ko" });
  const enHtml = R.renderEnvelope(envelope, { ...i18n, locale: "en" });
  assert.match(koHtml, /KOREAN-PRESENTATION/);
  assert.doesNotMatch(koHtml, /STALE-API-TEXT/);
  assert.match(enHtml, /ENGLISH-SOURCE-TEXT/);
  assert.doesNotMatch(enHtml, /KOREAN-PRESENTATION/);
});

test("no numeric confidence score field is ever rendered anywhere", () => {
  const envelope = {
    answered: true, mode: "structured", path: "A",
    claims: [{ citation: realCitation(), record: { type: "knowledge_record", modality: "must", source_text: "t" } }]
  };
  const html = R.renderEnvelope(envelope, i18n);
  assert.doesNotMatch(html, /score/i);
  assert.doesNotMatch(html, /confidence/i);
});

test("comparison mode groups claims into real per-document columns headed by the real title", () => {
  const envelope = {
    answered: true, mode: "comparison", path: "A",
    claims: [
      { citation: realCitation(), record: { type: "knowledge_record", modality: "should", source_text: "m10 claim", document_id: "ich_m10", document_title: "Bioanalytical Method Validation and Study Sample Analysis" } },
      { citation: realCitation({ source_unit_id: "fda_ada.su.5_b.001", document_id: "fda_ada", guideline_code: "FDA-2019-ADA" }), record: { type: "knowledge_record", modality: "should", source_text: "fda claim", document_id: "fda_ada", document_title: "Immunogenicity Testing of Therapeutic Protein Products" } }
    ]
  };
  const html = R.renderEnvelope(envelope, i18n);
  assert.match(html, /Bioanalytical Method Validation/);
  assert.match(html, /Immunogenicity Testing/);
  assert.doesNotMatch(html, />ich_m10</, "must never show the raw document id as a column header");
});

// design-taste-frontend audit finding: the previous i18n/render strings
// contained several em-dashes. Zero tolerance per that skill's Section
// 9.G, real strings only (not code comments), so exercise every mode.
test("no em-dash (U+2014) or en-dash-as-separator (U+2013) appears anywhere in rendered output, across every mode", () => {
  const claim = {
    citation: realCitation(),
    record: { type: "knowledge_record", modality: "must", original_modal_text: "shall", source_text: "text", normalized_ko: "텍스트" }
  };
  const hit = { answered: true, mode: "structured", path: "A", claims: [claim] };
  const refusal = { answered: false, mode: "refusal", path: "B", refusal: { kind: "scope_excluded", reason: "some reason" }, claims: [] };
  const comparison = { answered: true, mode: "comparison", path: "A", claims: [claim] };
  const amendment = { answered: true, mode: "amendment", path: "A", claims: [claim] };

  for (const env of [hit, refusal, comparison, amendment]) {
    const html = R.renderEnvelope(env, i18n);
    assert.doesNotMatch(html, /—/, `em-dash found in ${env.mode} rendering`);
    assert.doesNotMatch(html, /–/, `en-dash found in ${env.mode} rendering`);
  }
});

test("amendment mode shows a two-track parent/current layout plus resolved claims", () => {
  const envelope = {
    answered: true, mode: "amendment", path: "A",
    claims: [{ citation: realCitation({ source_unit_id: "ich_s6_r1.su.part1.notes.note1.001" }), record: { type: "knowledge_record", modality: "should", source_text: "note 1 text" } }]
  };
  const html = R.renderEnvelope(envelope, i18n);
  assert.match(html, /amendment-parent/);
  assert.match(html, /amendment-current/);
  assert.match(html, /note 1 text/);
});
