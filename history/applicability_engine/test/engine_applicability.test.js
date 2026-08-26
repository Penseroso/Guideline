const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateRule } = require("../engine/applicability");

// Synthetic archive fixture — not the real archive, so tests don't depend
// on live data staying byte-identical. Mirrors exactly the shape
// engine/data_store.js's buildIndex()/getAncestorSections() produce,
// since engine/applicability.js reuses data_store's real citationFor().
function baseIndex() {
  const documents = new Map([["test_doc", { document_id: "test_doc", guideline_code: "TEST-1" }]]);
  const sections = new Map([["sec1", { section_id: "sec1", section_number: "1", title: "Test Section" }]]);
  const sourceUnits = new Map([
    [
      "su1",
      {
        source_unit_id: "su1",
        document_id: "test_doc",
        section_id: "sec1",
        trace: {
          pdf_page_index_zero_based: 0,
          pdf_page_index_status: "known",
          printed_page_label: "1",
          printed_page_label_status: "known",
          source_file_path: "source_pdfs/test.pdf"
        }
      }
    ]
  ]);
  const knowledgeRecords = new Map([
    ["rule1", { knowledge_record_id: "rule1", source_unit_ids: ["su1"], review_status: "reviewed" }]
  ]);
  const quantitativeCriteria = new Map();
  const conditions = new Map();
  const conditionsByTarget = new Map();
  return { documents, sections, sourceUnits, knowledgeRecords, quantitativeCriteria, conditions, conditionsByTarget };
}

function addCondition(index, { id, type = "precondition", text = "some condition text" }) {
  index.conditions.set(id, { condition_id: id, condition_type: type, condition_text: text, applies_to_ids: ["rule1"] });
  index.conditionsByTarget.set("rule1", [...(index.conditionsByTarget.get("rule1") || []), id]);
}

function makeBinding(overrides = {}) {
  return {
    binding_id: "b1",
    condition_id: "c1",
    bindability: "bindable",
    non_bindable_reason: null,
    binding_role: "partial_scope",
    predicate: { all_of: [{ slot: "molecule_class", operator: "equals", value: "biotechnology" }] },
    evidence_span: "some",
    verification_status: "verified",
    ...overrides
  };
}

test("a rule with no attached conditions is applicable", () => {
  const index = baseIndex();
  const result = evaluateRule("rule1", {}, { index, bindingsByConditionId: new Map() });
  assert.equal(result.verdict, "applicable");
  assert.equal(result.conditional_reason, null);
  assert.deepEqual(result.basis, []);
});

test("full_scope predicate false -> not_applicable", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1" });
  const bindings = new Map([["c1", makeBinding({ binding_role: "full_scope" })]]);
  const result = evaluateRule("rule1", { molecule_class: "small_molecule" }, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "not_applicable");
  assert.equal(result.conditional_reason, null);
  assert.equal(result.basis[0].outcome, "full_scope_violated");
});

test("exception predicate true -> not_applicable", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1", type: "exception" });
  const bindings = new Map([["c1", makeBinding({ binding_role: "exception" })]]);
  const result = evaluateRule("rule1", { molecule_class: "biotechnology" }, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "not_applicable");
  assert.equal(result.basis[0].outcome, "exception_triggered");
});

test("partial_scope predicate false -> conditional, NEVER not_applicable (guards against overclaiming with incomplete binding coverage)", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1" });
  const bindings = new Map([["c1", makeBinding({ binding_role: "partial_scope" })]]);
  const result = evaluateRule("rule1", { molecule_class: "small_molecule" }, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "conditional");
  assert.equal(result.conditional_reason, "partial_scope_mismatch");
  assert.equal(result.basis[0].outcome, "partial_scope_mismatch");
});

test("partial_scope predicate true does not disqualify — verdict stays applicable", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1" });
  const bindings = new Map([["c1", makeBinding({ binding_role: "partial_scope" })]]);
  const result = evaluateRule("rule1", { molecule_class: "biotechnology" }, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "applicable");
  assert.equal(result.basis[0].outcome, "satisfied");
});

test("missing slot in context -> insufficient_context with the exact unresolved slot name", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1" });
  const bindings = new Map([["c1", makeBinding({ binding_role: "full_scope" })]]);
  const result = evaluateRule("rule1", {}, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "insufficient_context");
  assert.deepEqual(result.unresolved_slots, ["molecule_class"]);
});

test("non_bindable condition -> conditional with reason non_bindable_condition, original condition_text surfaced", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1", text: "in certain justified cases" });
  const bindings = new Map([
    ["c1", makeBinding({ bindability: "non_bindable", binding_role: null, predicate: null, non_bindable_reason: "expert_judgment_required" })]
  ]);
  const result = evaluateRule("rule1", {}, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "conditional");
  assert.equal(result.conditional_reason, "non_bindable_condition");
  assert.equal(result.basis[0].condition_text, "in certain justified cases");
});

test("a condition with no authored binding yet -> conditional with reason unbound_condition, not silently applicable", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1" });
  const result = evaluateRule("rule1", {}, { index, bindingsByConditionId: new Map() });
  assert.equal(result.verdict, "conditional");
  assert.equal(result.conditional_reason, "unbound_condition");
});

test("a needs_review full_scope binding never produces not_applicable — downgraded to conditional instead", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1" });
  const bindings = new Map([["c1", makeBinding({ binding_role: "full_scope", verification_status: "needs_review" })]]);
  const result = evaluateRule("rule1", { molecule_class: "small_molecule" }, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "conditional");
  assert.equal(result.conditional_reason, "unverified_binding");
  assert.equal(result.basis[0].outcome, "full_scope_violated_unverified");
  assert.equal(result.basis[0].binding_verification_status, "needs_review", "must still be exposed in the result");
});

test("a needs_review binding whose predicate holds does not silently resolve to applicable — downgraded to conditional for consistency with the not_applicable guard", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1" });
  const bindings = new Map([["c1", makeBinding({ binding_role: "partial_scope", verification_status: "needs_review" })]]);
  const result = evaluateRule("rule1", { molecule_class: "biotechnology" }, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "conditional");
  assert.equal(result.conditional_reason, "unverified_binding");
  assert.equal(result.basis[0].outcome, "satisfied_unverified");
});

test("a needs_review exception binding never produces not_applicable — downgraded to conditional instead", () => {
  const index = baseIndex();
  addCondition(index, { id: "c1", type: "exception" });
  const bindings = new Map([["c1", makeBinding({ binding_role: "exception", verification_status: "needs_review" })]]);
  const result = evaluateRule("rule1", { molecule_class: "biotechnology" }, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "conditional");
  assert.equal(result.conditional_reason, "unverified_binding");
});

test("verdict priority: not_applicable outranks conditional, insufficient_context, and applicable even when all four occur on the same rule", () => {
  const index = baseIndex();
  addCondition(index, { id: "c_partial" });
  addCondition(index, { id: "c_missing_slot" });
  addCondition(index, { id: "c_full_scope_violation" });
  const bindings = new Map([
    ["c_partial", makeBinding({ condition_id: "c_partial", binding_role: "partial_scope", predicate: { all_of: [{ slot: "molecule_class", operator: "equals", value: "biotechnology" }] } })],
    ["c_missing_slot", makeBinding({ condition_id: "c_missing_slot", binding_role: "partial_scope", predicate: { all_of: [{ slot: "development_stage", operator: "equals", value: "nonclinical" }] } })],
    ["c_full_scope_violation", makeBinding({ condition_id: "c_full_scope_violation", binding_role: "full_scope", predicate: { all_of: [{ slot: "regulatory_authority", operator: "equals", value: "ich" }] } })]
  ]);
  const result = evaluateRule("rule1", { molecule_class: "small_molecule", regulatory_authority: "fda" }, { index, bindingsByConditionId: bindings });
  assert.equal(result.verdict, "not_applicable");
  assert.equal(result.basis.length, 3, "every condition's own outcome is still recorded, even though only one determines the final verdict");
});

test("scope exclusion gate produces not_applicable independent of any Condition binding", () => {
  const index = baseIndex();
  index.documents.set("s6_test", { document_id: "s6_test" });
  index.sourceUnits.set("su_s6", {
    source_unit_id: "su_s6",
    document_id: "s6_test",
    section_id: "sec1",
    trace: { pdf_page_index_zero_based: 0, pdf_page_index_status: "known", printed_page_label: "1", printed_page_label_status: "known", source_file_path: "x" }
  });
  index.knowledgeRecords.set("rule_s6", { knowledge_record_id: "rule_s6", source_unit_ids: ["su_s6"], review_status: "reviewed" });
  // Real document_scope_profiles.json entry: ich_s6_r1 excludes small_molecule.
  index.documents.set("ich_s6_r1", { document_id: "ich_s6_r1" });
  index.sourceUnits.set("su_real_s6", {
    source_unit_id: "su_real_s6",
    document_id: "ich_s6_r1",
    section_id: "sec1",
    trace: { pdf_page_index_zero_based: 0, pdf_page_index_status: "known", printed_page_label: "1", printed_page_label_status: "known", source_file_path: "x" }
  });
  index.knowledgeRecords.set("rule_real_s6", { knowledge_record_id: "rule_real_s6", source_unit_ids: ["su_real_s6"], review_status: "reviewed" });

  const result = evaluateRule("rule_real_s6", { molecule_class: "small_molecule" }, { index, bindingsByConditionId: new Map() });
  assert.equal(result.verdict, "not_applicable");
  assert.ok(result.scope_basis.exclusions_triggered.length > 0);
  assert.equal(result.scope_basis.matched_profile, "ich_s6_r1");
});

test("evaluateRule throws a clear error for an unknown rule_id", () => {
  const index = baseIndex();
  assert.throws(() => evaluateRule("not_a_real_rule", {}, { index, bindingsByConditionId: new Map() }), /unknown rule_id/);
});

test("citations are always populated from the rule's own source units", () => {
  const index = baseIndex();
  const result = evaluateRule("rule1", {}, { index, bindingsByConditionId: new Map() });
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].source_unit_id, "su1");
});

test("rule_review_status is surfaced from the source record", () => {
  const index = baseIndex();
  const result = evaluateRule("rule1", {}, { index, bindingsByConditionId: new Map() });
  assert.equal(result.rule_review_status, "reviewed");
});
