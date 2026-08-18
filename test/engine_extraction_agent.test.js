const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractSection,
  finalizeDraft,
  validateSourceUnitIds,
  slugifySectionNumber,
  nextId,
  extractionOutputSchema
} = require("../engine/extraction_agent");

test("slugifySectionNumber replaces dots with underscores", () => {
  assert.equal(slugifySectionNumber("3.2.5.2"), "3_2_5_2");
});

test("nextId follows the existing archive ID convention", () => {
  assert.equal(nextId("ich_m10", "kr", "3.2.5.2", 3), "ich_m10.kr.3_2_5_2.003");
});

test("validateSourceUnitIds drops any ID not in the allowed set (the model must not cite outside its input)", () => {
  const allowed = ["ich_m10.su.6_1.001", "ich_m10.su.6_1.002"];
  const result = validateSourceUnitIds(["ich_m10.su.6_1.001", "ich_m10.su.hallucinated.999"], allowed);
  assert.deepEqual(result, ["ich_m10.su.6_1.001"]);
});

test("extractionOutputSchema has no id/review_status fields the model could set directly", () => {
  const schema = extractionOutputSchema();
  for (const arrayField of ["knowledge_records", "quantitative_criteria", "conditions"]) {
    const props = schema.properties[arrayField].items.properties;
    assert.ok(!("review_status" in props), `${arrayField} draft schema must not let the model self-assign review_status`);
    assert.ok(
      Object.keys(props).every((k) => !k.endsWith("_id") || k.endsWith("temp_id") || k === "source_unit_id" || k === "source_unit_ids"),
      `${arrayField} draft schema must not expose archive-assigned ID fields`
    );
  }
});

test("finalizeDraft assigns real IDs, remaps temp_id cross-links, and forces review_status=needs_review", () => {
  const section = { document_id: "ich_m10", section_id: "ich_m10.sec.6_1", section_number: "6.1", title: "Partial Validation" };
  const allowedSourceUnitIds = ["ich_m10.su.6_1.001", "ich_m10.su.6_1.002"];

  const draft = {
    conditions: [
      { temp_id: 1, source_unit_id: "ich_m10.su.6_1.001", condition_text: "when X applies", condition_type: "applicability", applies_to_temp_ids: [10] }
    ],
    knowledge_records: [
      {
        temp_id: 10,
        source_unit_ids: ["ich_m10.su.6_1.001", "ich_m10.su.hallucinated.999"],
        record_type: "recommendation",
        modality: "should",
        original_modal_text: "should",
        subject: "X",
        action: "be validated",
        object: null,
        normalized_ko: null
      }
    ],
    quantitative_criteria: [
      {
        temp_id: 20,
        source_unit_id: "ich_m10.su.6_1.002",
        knowledge_record_temp_id: 10,
        condition_temp_ids: [1],
        parameter: "accuracy",
        comparator: "within",
        value: 15,
        value_fraction: null,
        unit: "%",
        value_status: "known",
        denominator_or_reference: "nominal concentration",
        source_text: "within ±15%"
      }
    ]
  };

  const result = finalizeDraft(draft, { section, allowedSourceUnitIds });

  assert.equal(result.conditions[0].condition_id, "ich_m10.cond.6_1.001");
  assert.equal(result.conditions[0].review_status, "needs_review");

  assert.equal(result.knowledge_records[0].knowledge_record_id, "ich_m10.kr.6_1.001");
  assert.deepEqual(result.knowledge_records[0].source_unit_ids, ["ich_m10.su.6_1.001"], "hallucinated source_unit_id must be dropped");
  assert.equal(result.knowledge_records[0].review_status, "needs_review");

  const qc = result.quantitative_criteria[0];
  assert.equal(qc.criterion_id, "ich_m10.qc.6_1.001");
  assert.equal(qc.knowledge_record_id, "ich_m10.kr.6_1.001", "temp_id cross-link must resolve to the real assigned ID");
  assert.deepEqual(qc.condition_ids, ["ich_m10.cond.6_1.001"]);
  assert.equal(qc.review_status, "needs_review");

  assert.deepEqual(result.conditions[0].applies_to_ids, ["ich_m10.kr.6_1.001"], "applies_to_temp_ids must resolve too");
});

test("finalizeDraft resolves joint_with_temp_ids to real criterion_ids and enforces reciprocity even when the model declares it one-sidedly", () => {
  const section = { document_id: "ich_m10", section_id: "ich_m10.sec.3_2_5_2", section_number: "3.2.5.2", title: "Evaluation of Accuracy and Precision" };
  const allowedSourceUnitIds = ["ich_m10.su.3_2_5_2.005"];

  const draft = {
    conditions: [],
    knowledge_records: [],
    quantitative_criteria: [
      {
        temp_id: 1, source_unit_id: "ich_m10.su.3_2_5_2.005", knowledge_record_temp_id: null, condition_temp_ids: [],
        joint_with_temp_ids: [2, 3], // declares both partners
        parameter: "total QCs", comparator: "at_least", value: null,
        value_fraction: { numerator: 2, denominator: 3 }, unit: "fraction", value_status: "known",
        denominator_or_reference: "total QCs", source_text: "at least 2/3 of the total QCs"
      },
      {
        temp_id: 2, source_unit_id: "ich_m10.su.3_2_5_2.005", knowledge_record_temp_id: null, condition_temp_ids: [],
        joint_with_temp_ids: [], // one-sided: does NOT declare temp_id 1 back
        parameter: "QCs at each level", comparator: "at_least", value: 50, value_fraction: null, unit: "%",
        value_status: "known", denominator_or_reference: "each level", source_text: "at least 50% at each concentration level"
      },
      {
        temp_id: 3, source_unit_id: "ich_m10.su.3_2_5_2.005", knowledge_record_temp_id: null, condition_temp_ids: [],
        joint_with_temp_ids: [1], // declares 1, not 2
        parameter: "QC values", comparator: "within", value: 15, value_fraction: null, unit: "%",
        value_status: "known", denominator_or_reference: "nominal values", source_text: "within ±15%"
      }
    ]
  };

  const { quantitative_criteria } = finalizeDraft(draft, { section, allowedSourceUnitIds });
  const [q1, q2, q3] = quantitative_criteria;

  assert.deepEqual(q1.joint_with_ids.sort(), [q2.criterion_id, q3.criterion_id].sort());
  assert.deepEqual(q2.joint_with_ids.sort(), [q1.criterion_id, q3.criterion_id].sort(), "q2 must be symmetrized in even though it declared nothing itself");
  assert.deepEqual(q3.joint_with_ids.sort(), [q1.criterion_id, q2.criterion_id].sort(), "q3 must gain q2 via symmetrization even though only q1<->q3 was mutually declared directly");
});

test("finalizeDraft drops a self-referencing joint_with_temp_ids entry", () => {
  const section = { document_id: "ich_m10", section_id: "ich_m10.sec.3_2_5_2", section_number: "3.2.5.2", title: "Evaluation of Accuracy and Precision" };
  const allowedSourceUnitIds = ["ich_m10.su.3_2_5_2.005"];
  const draft = {
    conditions: [],
    knowledge_records: [],
    quantitative_criteria: [
      {
        temp_id: 1, source_unit_id: "ich_m10.su.3_2_5_2.005", knowledge_record_temp_id: null, condition_temp_ids: [],
        joint_with_temp_ids: [1],
        parameter: "x", comparator: "at_least", value: 1, value_fraction: null, unit: null,
        value_status: "known", denominator_or_reference: null, source_text: "x"
      }
    ]
  };
  const { quantitative_criteria } = finalizeDraft(draft, { section, allowedSourceUnitIds });
  assert.deepEqual(quantitative_criteria[0].joint_with_ids, []);
});

test("extractSection calls the client with the section's source units and returns finalized records (mocked client, no network)", async () => {
  const section = { document_id: "ich_m10", section_id: "ich_m10.sec.6_1", section_number: "6.1", title: "Partial Validation" };
  const sourceUnits = [
    { source_unit_id: "ich_m10.su.6_1.001", unit_order: 1, source_text: "Partial validations evaluate modifications." }
  ];

  let capturedArgs = null;
  const mockClient = {
    complete: async (args) => {
      capturedArgs = args;
      return { knowledge_records: [], quantitative_criteria: [], conditions: [] };
    }
  };

  const result = await extractSection({ section, sourceUnits, client: mockClient });

  assert.deepEqual(result, { knowledge_records: [], quantitative_criteria: [], conditions: [] });
  assert.ok(capturedArgs.schema, "extractSection must request schema-constrained output");
  assert.match(capturedArgs.messages[0].content, /ich_m10\.su\.6_1\.001/);
  assert.match(capturedArgs.messages[0].content, /Partial validations evaluate modifications\./);
});
