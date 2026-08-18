const test = require("node:test");
const assert = require("node:assert/strict");

const { verifyDraft, extractAndVerifySection } = require("../engine/pipeline");

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
