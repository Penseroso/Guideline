const test = require("node:test");
const assert = require("node:assert/strict");

const { verifyDraft, extractAndVerifySection, siblingCriteria } = require("../engine/pipeline");

const sourceUnits = [
  { source_unit_id: "su.001", unit_order: 1, source_text: "Accuracy should be within ±15% of nominal concentration." }
];

function draftFixture() {
  return {
    knowledge_records: [
      {
        knowledge_record_id: "kr.001",
        source_unit_ids: ["su.001"],
        record_type: "recommendation",
        modality: "should",
        original_modal_text: "should be within",
        subject: "Accuracy",
        action: "be within ±15% of nominal concentration",
        object: null,
        normalized_ko: null,
        review_status: "needs_review"
      }
    ],
    quantitative_criteria: [
      {
        criterion_id: "qc.001",
        source_unit_id: "su.001",
        knowledge_record_id: "kr.001",
        parameter: "accuracy",
        comparator: "within",
        value: 15,
        value_fraction: null,
        unit: "%",
        value_status: "known",
        denominator_or_reference: "nominal concentration",
        condition_ids: [],
        source_text: "within ±15% of nominal concentration",
        review_status: "needs_review"
      }
    ],
    conditions: []
  };
}

test("verifyDraft promotes review_status to reviewed when the claim is entailed", async () => {
  const client = { complete: async () => ({ entailed: true, reason: "matches source" }) };
  const { draft, summary } = await verifyDraft(draftFixture(), { sourceUnits, client });
  assert.equal(draft.knowledge_records[0].review_status, "reviewed");
  assert.equal(draft.quantitative_criteria[0].review_status, "reviewed");
  assert.equal(summary.total, 2);
  assert.equal(summary.entailed, 2);
  assert.equal(summary.needs_review, 0);
});

test("verifyDraft keeps review_status=needs_review (never drops or force-promotes) when not entailed", async () => {
  const client = { complete: async () => ({ entailed: false, reason: "claim adds an unsupported detail" }) };
  const { draft, report, summary } = await verifyDraft(draftFixture(), { sourceUnits, client });
  assert.equal(draft.knowledge_records[0].review_status, "needs_review");
  assert.equal(draft.quantitative_criteria.length, 1, "failed verification must not delete the record");
  assert.equal(draft.quantitative_criteria[0].review_status, "needs_review");
  assert.equal(summary.needs_review, 2);
  assert.ok(report.every((r) => r.reason), "every report entry must carry a rejection reason");
});

test("verifyDraft never mutates the archive-schema record shape (no extra fields added)", async () => {
  const client = { complete: async () => ({ entailed: true, reason: "ok" }) };
  const { draft } = await verifyDraft(draftFixture(), { sourceUnits, client });
  const krKeys = Object.keys(draft.knowledge_records[0]).sort();
  const originalKeys = Object.keys(draftFixture().knowledge_records[0]).sort();
  assert.deepEqual(krKeys, originalKeys, "verification result must be reported separately, not merged into the record");
});

test("verifyDraft forwards an explicit verify model override without hardcoding one", async () => {
  const seenModels = [];
  const client = {
    complete: async (args) => {
      seenModels.push(args.model);
      return { entailed: true, reason: "ok" };
    }
  };
  await verifyDraft(draftFixture(), { sourceUnits, client, model: "gpt-5.6-luna" });
  assert.ok(seenModels.every((m) => m === "gpt-5.6-luna"));
});

test("verifyDraft omits the model field entirely when no override is given (adapter default applies)", async () => {
  const seenArgs = [];
  const client = { complete: async (args) => { seenArgs.push(args); return { entailed: true, reason: "ok" }; } };
  await verifyDraft(draftFixture(), { sourceUnits, client });
  assert.ok(seenArgs.every((a) => !("model" in a)));
});

test("extractAndVerifySection composes extraction then verification into one call (mocked client, no network)", async () => {
  const section = { document_id: "doc", section_id: "sec", section_number: "1.1", title: "Test" };
  const client = {
    complete: async ({ schema }) => {
      if (schema && schema.properties && schema.properties.knowledge_records) {
        // this is the extraction call
        return {
          knowledge_records: [
            { temp_id: 1, source_unit_ids: ["su.001"], record_type: "recommendation", modality: "should", original_modal_text: "should be within", subject: "Accuracy", action: "be within ±15%", object: null, normalized_ko: null }
          ],
          quantitative_criteria: [],
          conditions: []
        };
      }
      // this is the verification call
      return { entailed: true, reason: "matches" };
    }
  };
  const { draft, summary } = await extractAndVerifySection({ section, sourceUnits, client });
  assert.equal(draft.knowledge_records.length, 1);
  assert.equal(draft.knowledge_records[0].review_status, "reviewed");
  assert.equal(summary.total, 1);
});

// --- siblingCriteria: multi-signal grouping (working_docs/milestone_log.md M1) ---
// Multiple independent relational signals, not a fixed pair — see the
// SIBLING_SIGNALS list in engine/pipeline.js for why each one is included
// (or, for shared source_unit_id, deliberately excluded).

// --- verifyKnowledgeRecord: surface original_modal_text when the
// recomposed subject/action/object claim doesn't already carry it
// (working_docs/milestone_log.md M1, found on real M10 3.2.5.2 kr.005) ---

test("verifyKnowledgeRecord appends the source's own modal wording when it is a soft modality not echoed in action (e.g. 'it is recommended')", async () => {
  const kr = {
    knowledge_record_id: "kr.005",
    source_unit_ids: ["su.001"],
    record_type: "recommendation",
    modality: "other",
    original_modal_text: "it is recommended",
    subject: "Accuracy and precision of the QCs",
    action: "be demonstrated",
    object: "over at least one run of equivalent size",
    normalized_ko: null,
    review_status: "needs_review"
  };
  const su = [{ source_unit_id: "su.001", unit_order: 1, source_text: "it is recommended to demonstrate accuracy and precision of the QCs over at least one run of equivalent size." }];
  const captured = [];
  const client = { complete: async (args) => { captured.push(args.messages[0].content); return { entailed: true, reason: "ok" }; } };
  const { draft } = await verifyDraft({ knowledge_records: [kr], quantitative_criteria: [], conditions: [] }, { sourceUnits: su, client });
  assert.match(captured[0], /it is recommended/, "claim must surface the soft modal wording instead of reading as a bare imperative");
  assert.equal(draft.knowledge_records[0].review_status, "reviewed");
});

test("verifyKnowledgeRecord does not duplicate the modal wording when action already echoes it (e.g. 'should be within')", async () => {
  const kr = {
    knowledge_record_id: "kr.001",
    source_unit_ids: ["su.001"],
    record_type: "recommendation",
    modality: "should",
    original_modal_text: "should be within",
    subject: "Accuracy",
    action: "should be within ±15% of nominal concentration",
    object: null,
    normalized_ko: null,
    review_status: "needs_review"
  };
  const su = [{ source_unit_id: "su.001", unit_order: 1, source_text: "Accuracy should be within ±15% of nominal concentration." }];
  const captured = [];
  const client = { complete: async (args) => { captured.push(args.messages[0].content); return { entailed: true, reason: "ok" }; } };
  await verifyDraft({ knowledge_records: [kr], quantitative_criteria: [], conditions: [] }, { sourceUnits: su, client });
  const claimPortion = captured[0].split("Claim to check:")[1];
  const occurrences = (claimPortion.match(/should be within/gi) || []).length;
  assert.equal(occurrences, 1, "must not append a redundant duplicate of wording already present in the recomposed claim");
});

test("siblingCriteria trusts an explicitly-declared joint_with_ids over heuristic signals, even when they'd disagree", () => {
  // Explicit field says "not joint" despite a heuristic signal (shared
  // knowledge_record_id + equal condition_ids) that would otherwise group
  // them — explicit, extraction-time-grounded data must win.
  const qcA = { criterion_id: "qc.a", knowledge_record_id: "kr.001", condition_ids: [], joint_with_ids: ["qc.c"] };
  const qcB = { criterion_id: "qc.b", knowledge_record_id: "kr.001", condition_ids: [] }; // no joint_with_ids: heuristic-eligible
  const qcC = { criterion_id: "qc.c", knowledge_record_id: "kr.999", condition_ids: [] };
  const siblings = siblingCriteria(qcA, [qcA, qcB, qcC]);
  assert.deepEqual(siblings.map((s) => s.criterion_id), ["qc.c"], "explicit joint_with_ids must be used as-is, not unioned with the heuristic-matched qc.b");
});

test("siblingCriteria groups criteria sharing a knowledge_record_id", () => {
  const qcA = { criterion_id: "qc.a", knowledge_record_id: "kr.001", condition_ids: [] };
  const qcB = { criterion_id: "qc.b", knowledge_record_id: "kr.001", condition_ids: [] };
  const qcC = { criterion_id: "qc.c", knowledge_record_id: "kr.999", condition_ids: [] };
  const siblings = siblingCriteria(qcA, [qcA, qcB, qcC]);
  assert.deepEqual(siblings.map((s) => s.criterion_id), ["qc.b"]);
});

test("siblingCriteria groups criteria sharing an overlapping condition_ids entry, even with different knowledge_record_id", () => {
  const qcA = { criterion_id: "qc.a", knowledge_record_id: "kr.001", condition_ids: ["cond.001"] };
  const qcB = { criterion_id: "qc.b", knowledge_record_id: "kr.002", condition_ids: ["cond.001", "cond.002"] };
  const siblings = siblingCriteria(qcA, [qcA, qcB]);
  assert.deepEqual(siblings.map((s) => s.criterion_id), ["qc.b"]);
});

test("siblingCriteria does not group unrelated criteria (no shared signal) and excludes self", () => {
  const qcA = { criterion_id: "qc.a", knowledge_record_id: "kr.001", condition_ids: ["cond.001"] };
  const qcB = { criterion_id: "qc.b", knowledge_record_id: "kr.002", condition_ids: ["cond.002"] };
  const siblings = siblingCriteria(qcA, [qcA, qcB]);
  assert.deepEqual(siblings, []);
});

test("siblingCriteria does NOT group a general rule with its own exception, even when they share a knowledge_record_id (mutually exclusive circumstances, not jointly applicable)", () => {
  // Real bug found live on M10 3.2.5.2: kr.012 bundles "accuracy within
  // 15%" (general, no condition) with "accuracy within 20% at the LLOQ"
  // (an exception, condition_ids=["cond.007"]). Grouping them as
  // "jointly applicable" via knowledge_record_id alone asserted a false
  // conjunction (accuracy can't be both within 15% and within 20% for
  // the same case) and was correctly rejected by the verifier.
  const general = { criterion_id: "qc.general", knowledge_record_id: "kr.012", condition_ids: [] };
  const exception = { criterion_id: "qc.exception", knowledge_record_id: "kr.012", condition_ids: ["cond.007"] };
  const siblingsOfGeneral = siblingCriteria(general, [general, exception]);
  const siblingsOfException = siblingCriteria(exception, [general, exception]);
  assert.deepEqual(siblingsOfGeneral, []);
  assert.deepEqual(siblingsOfException, []);
});

test("siblingCriteria groups two criteria sharing the same single condition_ids entry, even with different knowledge_record_id (e.g. two different parameters both scoped 'at the LLOQ')", () => {
  const accuracyAtLLOQ = { criterion_id: "qc.acc-lloq", knowledge_record_id: "kr.012", condition_ids: ["cond.007"] };
  const precisionAtLLOQ = { criterion_id: "qc.prec-lloq", knowledge_record_id: "kr.013", condition_ids: ["cond.007"] };
  const siblings = siblingCriteria(accuracyAtLLOQ, [accuracyAtLLOQ, precisionAtLLOQ]);
  assert.deepEqual(siblings.map((s) => s.criterion_id), ["qc.prec-lloq"]);
});

test("siblingCriteria does not treat mere shared source_unit_id as a grouping signal (would over-group unrelated criteria in one paragraph)", () => {
  const qcA = { criterion_id: "qc.a", source_unit_id: "su.001", knowledge_record_id: "kr.001", condition_ids: [] };
  const qcB = { criterion_id: "qc.b", source_unit_id: "su.001", knowledge_record_id: "kr.002", condition_ids: [] };
  const siblings = siblingCriteria(qcA, [qcA, qcB]);
  assert.deepEqual(siblings, []);
});

// --- Held-out synthetic compound-criteria case (NOT drawn from real M10/S6
// data — written to prove the multi-signal grouping generalizes, not just
// re-solves the one known qc.010/011/012 case) ---
//
// Scenario: "The assay must recover between 85% and 115% of the spiked
// concentration, with a %CV not exceeding 10%." — one sentence, two
// entangled numeric criteria (a range's lower/upper bound, and a separate
// precision bound), extracted as three QuantitativeCriterion records
// sharing one knowledge_record_id, none restating the others' value.

function syntheticCompoundFixture() {
  const su = { source_unit_id: "su.syn.001", unit_order: 1, source_text: "The assay must recover between 85% and 115% of the spiked concentration, with a %CV not exceeding 10%." };
  const kr = {
    knowledge_record_id: "kr.syn.001",
    source_unit_ids: ["su.syn.001"],
    record_type: "requirement",
    modality: "must",
    original_modal_text: "must recover",
    subject: "The assay",
    action: "recover between 85% and 115% of the spiked concentration, with a %CV not exceeding 10%",
    object: null,
    normalized_ko: null,
    review_status: "needs_review"
  };
  const criteria = [
    { criterion_id: "qc.syn.001", source_unit_id: "su.syn.001", knowledge_record_id: "kr.syn.001", parameter: "recovery", comparator: "at_least", value: 85, value_fraction: null, unit: "%", value_status: "known", denominator_or_reference: "spiked concentration", condition_ids: [], source_text: "recover between 85%", review_status: "needs_review" },
    { criterion_id: "qc.syn.002", source_unit_id: "su.syn.001", knowledge_record_id: "kr.syn.001", parameter: "recovery", comparator: "not_exceed", value: 115, value_fraction: null, unit: "%", value_status: "known", denominator_or_reference: "spiked concentration", condition_ids: [], source_text: "and 115%", review_status: "needs_review" },
    { criterion_id: "qc.syn.003", source_unit_id: "su.syn.001", knowledge_record_id: "kr.syn.001", parameter: "%CV", comparator: "not_exceed", value: 10, value_fraction: null, unit: "%", value_status: "known", denominator_or_reference: null, condition_ids: [], source_text: "not exceeding 10%", review_status: "needs_review" }
  ];
  return { sourceUnits: [su], draft: { knowledge_records: [kr], quantitative_criteria: criteria, conditions: [] } };
}

test("verifyQuantitativeCriterion includes sibling criterion values in the claim for a held-out synthetic compound statement (generalization check, not tuned to real data)", async () => {
  const { sourceUnits, draft } = syntheticCompoundFixture();
  const captured = [];
  const client = {
    complete: async (args) => {
      captured.push(args.messages[0].content);
      return { entailed: true, reason: "matches" };
    }
  };
  await verifyDraft(draft, { sourceUnits, client });
  const recoveryLowClaim = captured.find((c) => c.includes('"recovery at least 85'));
  assert.ok(recoveryLowClaim, "expected a claim for the recovery lower-bound criterion");
  // The lower-bound claim must mention its siblings (upper bound and %CV)
  // without restating their own claim as if it were the primary one.
  assert.match(recoveryLowClaim, /recovery not_exceed 115|recovery not exceeding 115/);
  assert.match(recoveryLowClaim, /%CV not_exceed 10|%CV not exceeding 10/);
});

test("verifyQuantitativeCriterion surfaces the linked KnowledgeRecord's own modal wording instead of a fixed strength assumption (held-out synthetic case)", async () => {
  const { sourceUnits, draft } = syntheticCompoundFixture();
  const captured = [];
  const client = {
    complete: async (args) => {
      captured.push(args.messages[0].content);
      return { entailed: true, reason: "matches" };
    }
  };
  await verifyDraft(draft, { sourceUnits, client });
  const anyClaim = captured.find((c) => c.includes('"recovery at least 85'));
  assert.match(anyClaim, /must recover/, "claim should surface the source's own modal wording (\"must recover\"), not an assumed strength");
});
