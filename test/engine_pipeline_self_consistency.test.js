const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mergeExtractionPasses,
  extractSectionSelfConsistent,
  verifyClaimEnsemble,
  qcFingerprint,
  krFingerprint
} = require("../engine/pipeline");

test("qcFingerprint matches two QuantitativeCriteria with the same fact but different wording", () => {
  const a = { source_unit_id: "su.1", comparator: "at_least", value: 5, value_fraction: null, unit: "replicates", parameter: "replicates" };
  const b = { source_unit_id: "su.1", comparator: "at_least", value: 5, value_fraction: null, unit: "replicates", parameter: "replicates analysed" };
  assert.equal(qcFingerprint(a), qcFingerprint(b));
});

test("qcFingerprint does NOT match two different values", () => {
  const a = { source_unit_id: "su.1", comparator: "at_least", value: 5, value_fraction: null, unit: "replicates" };
  const b = { source_unit_id: "su.1", comparator: "at_least", value: 3, value_fraction: null, unit: "replicates" };
  assert.notEqual(qcFingerprint(a), qcFingerprint(b));
});

test("krFingerprint is insensitive to minor wording differences but sensitive to a different action", () => {
  const a = { source_unit_ids: ["su.1"], record_type: "recommendation", modality: "should", action: "be within 15 percent" };
  const b = { source_unit_ids: ["su.1"], record_type: "recommendation", modality: "should", action: "be  within   15 PERCENT" };
  const c = { source_unit_ids: ["su.1"], record_type: "recommendation", modality: "should", action: "be within 20 percent" };
  assert.equal(krFingerprint(a), krFingerprint(b));
  assert.notEqual(krFingerprint(a), krFingerprint(c));
});

test("mergeExtractionPasses dedupes a fact found in multiple passes and records agreement count", () => {
  const draftA = {
    knowledge_records: [],
    quantitative_criteria: [{ criterion_id: "x", source_unit_id: "su.1", comparator: "at_least", value: 5, value_fraction: null, unit: "replicates", parameter: "replicates", value_status: "known", denominator_or_reference: null, source_text: "at least 5", condition_ids: [], knowledge_record_id: null }],
    conditions: []
  };
  const draftB = {
    knowledge_records: [],
    quantitative_criteria: [{ criterion_id: "y", source_unit_id: "su.1", comparator: "at_least", value: 5, value_fraction: null, unit: "replicates", parameter: "replicates analysed", value_status: "known", denominator_or_reference: null, source_text: "at least 5", condition_ids: [], knowledge_record_id: null }],
    conditions: []
  };
  const draftC = { knowledge_records: [], quantitative_criteria: [], conditions: [] }; // this pass missed it entirely

  const { draft, agreement } = mergeExtractionPasses([draftA, draftB, draftC], { documentId: "doc", sectionNumber: "1.1" });
  assert.equal(draft.quantitative_criteria.length, 1, "same fact from 2 passes must collapse to 1 record");
  assert.equal(agreement.quantitative_criteria[0].agreementCount, 2);
  assert.equal(agreement.quantitative_criteria[0].ofPasses, 3);
});

test("mergeExtractionPasses keeps a fact found in only 1 of N passes (union, not intersection)", () => {
  const draftA = { knowledge_records: [], quantitative_criteria: [{ criterion_id: "x", source_unit_id: "su.1", comparator: "at_least", value: 5, value_fraction: null, unit: null, parameter: "p", value_status: "known", denominator_or_reference: null, source_text: "s", condition_ids: [], knowledge_record_id: null }], conditions: [] };
  const draftB = { knowledge_records: [], quantitative_criteria: [], conditions: [] };
  const { draft, agreement } = mergeExtractionPasses([draftA, draftB], { documentId: "doc", sectionNumber: "1.1" });
  assert.equal(draft.quantitative_criteria.length, 1, "a fact from even 1 pass must survive the union");
  assert.equal(agreement.quantitative_criteria[0].agreementCount, 1);
});

test("mergeExtractionPasses assigns fresh sequential IDs and never leaves the closed schema shape polluted with bookkeeping fields", () => {
  const draftA = { knowledge_records: [], quantitative_criteria: [{ criterion_id: "stale-id-from-pass-1", source_unit_id: "su.1", comparator: "at_least", value: 5, value_fraction: null, unit: null, parameter: "p", value_status: "known", denominator_or_reference: null, source_text: "s", condition_ids: [], knowledge_record_id: "some-other-passes-kr-id" }], conditions: [] };
  const { draft } = mergeExtractionPasses([draftA], { documentId: "ich_m10", sectionNumber: "6.1" });
  assert.equal(draft.quantitative_criteria[0].criterion_id, "ich_m10.qc.6_1.001");
  assert.equal(draft.quantitative_criteria[0].knowledge_record_id, null, "stale cross-pass reference must be dropped, not left dangling");
  assert.ok(!("_agreementCount" in draft.quantitative_criteria[0]), "internal bookkeeping must not leak into the returned record");
});

test("extractSectionSelfConsistent runs extraction `passes` times and verifies the merged result (mocked, no network)", async () => {
  let extractCalls = 0;
  const section = { document_id: "doc", section_id: "sec", section_number: "1.1", title: "T" };
  const sourceUnits = [{ source_unit_id: "su.1", unit_order: 1, source_text: "Accuracy must be within 15%." }];
  const client = {
    complete: async ({ schema }) => {
      if (schema && schema.properties && schema.properties.knowledge_records) {
        extractCalls += 1;
        return {
          knowledge_records: [],
          quantitative_criteria: [{ temp_id: 1, source_unit_id: "su.1", knowledge_record_temp_id: null, condition_temp_ids: [], parameter: "accuracy", comparator: "within", value: 15, value_fraction: null, unit: "%", value_status: "known", denominator_or_reference: null, source_text: "within 15%" }],
          conditions: []
        };
      }
      return { entailed: true, reason: "matches" };
    }
  };
  const { draft, agreement, passes } = await extractSectionSelfConsistent({ section, sourceUnits, client, passes: 3 });
  assert.equal(extractCalls, 3, "must call extraction exactly `passes` times");
  assert.equal(passes, 3);
  assert.equal(draft.quantitative_criteria.length, 1, "identical fact across all 3 passes must dedupe to 1");
  assert.equal(agreement.quantitative_criteria[0].agreementCount, 3);
  assert.equal(draft.quantitative_criteria[0].review_status, "reviewed");
});

test("verifyClaimEnsemble requires all calls to agree entailed before trusting it", async () => {
  let call = 0;
  const client = { complete: async () => { call += 1; return { entailed: call === 1, reason: `call ${call}` }; } }; // first true, second false
  const result = await verifyClaimEnsemble({ claim: "x", sourceText: "y", client, times: 2 });
  assert.equal(result.entailed, false, "disagreement between ensemble calls must not be trusted");
  assert.equal(result.agreement, 1);
  assert.equal(result.of, 2);
});

test("verifyClaimEnsemble passes only when every call agrees", async () => {
  const client = { complete: async () => ({ entailed: true, reason: "ok" }) };
  const result = await verifyClaimEnsemble({ claim: "x", sourceText: "y", client, times: 2 });
  assert.equal(result.entailed, true);
  assert.equal(result.agreement, 2);
});
