const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runDeterministicGates,
  buildPredicate,
  resolveBindingRole,
  finalizeBindingShape,
  bindingIdFor,
  claimTextForBinding,
  proposeAndVerifyBinding
} = require("../engine/binding_agent");

const { validateBindingFiles } = require("../validation/validate_bindings");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function sequentialClient(responses) {
  let i = 0;
  return {
    complete: async () => {
      if (i >= responses.length) throw new Error("sequentialClient: ran out of canned responses");
      return responses[i++];
    }
  };
}

const CONDITION = {
  condition_id: "ich_s6_r1.cond.part2.2_2.001",
  condition_type: "precondition",
  condition_text: "If there are two pharmacologically relevant species for the clinical candidate (one rodent and one non-rodent)"
};

const EXCEPTION_CONDITION = {
  condition_id: "ich_s6_r1.cond.part2.2_2.003",
  condition_type: "exception",
  condition_text: "unless there is a scientific rationale for using non-rodents"
};

function draftBindable(overrides = {}) {
  return {
    bindability: "bindable",
    non_bindable_reason: null,
    binding_role: "partial_scope",
    group_type: "all_of",
    leaves: [{ slot: "relevant_species_availability", operator: "equals", value: "two_rodent_and_nonrodent", values: null }],
    evidence_span: "two pharmacologically relevant species",
    ...overrides
  };
}

function draftNonBindable(overrides = {}) {
  return {
    bindability: "non_bindable",
    non_bindable_reason: "epistemic_hedge",
    binding_role: null,
    group_type: null,
    leaves: [],
    evidence_span: "two pharmacologically relevant",
    ...overrides
  };
}

// --- bindingIdFor / resolveBindingRole / buildPredicate (pure helpers) ---

test("bindingIdFor derives the binding_id from the condition_id's own namespace", () => {
  assert.equal(bindingIdFor("ich_s6_r1.cond.part2.2_2.001"), "ich_s6_r1.bind.part2.2_2.001");
});

test("resolveBindingRole returns null for a non_bindable draft even when condition_type=exception (a structurally-exception condition can still be non-machine-bindable)", () => {
  const draft = draftNonBindable();
  assert.equal(resolveBindingRole(draft, EXCEPTION_CONDITION), null);
});

test("resolveBindingRole forces exception role from condition_type regardless of the model's proposal", () => {
  const draft = draftBindable({ binding_role: "partial_scope" });
  assert.equal(resolveBindingRole(draft, EXCEPTION_CONDITION), "exception");
});

test("resolveBindingRole defaults to partial_scope for a non-exception condition when the model didn't propose full_scope", () => {
  assert.equal(resolveBindingRole(draftBindable({ binding_role: "partial_scope" }), CONDITION), "partial_scope");
});

test("buildPredicate reassembles group_type/leaves into the persisted all_of/any_of shape", () => {
  const predicate = buildPredicate(draftBindable());
  assert.deepEqual(predicate, {
    all_of: [{ slot: "relevant_species_availability", operator: "equals", value: "two_rodent_and_nonrodent" }]
  });
});

test("buildPredicate returns null for a non_bindable draft", () => {
  assert.equal(buildPredicate(draftNonBindable()), null);
});

// --- finalizeBindingShape: guarantees the persisted shape is always
// structurally schema-valid, regardless of what the model proposed (real
// gaps found on a live S6(R1) run, docs/milestone_log.md M6) ---

test("finalizeBindingShape substitutes a fallback reason when the model proposed non_bindable with a missing/invalid reason", () => {
  const shape = finalizeBindingShape(draftNonBindable({ non_bindable_reason: null }), CONDITION);
  assert.equal(shape.bindability, "non_bindable");
  assert.ok(shape.non_bindable_reason, "must never persist a null reason for a non_bindable binding");
  assert.equal(shape.binding_role, null);
  assert.equal(shape.predicate, null);
});

test("finalizeBindingShape downgrades a bindable draft with zero usable leaves to non_bindable instead of persisting an empty predicate", () => {
  const shape = finalizeBindingShape(draftBindable({ leaves: [] }), CONDITION);
  assert.equal(shape.bindability, "non_bindable");
  assert.equal(shape.predicate, null);
  assert.equal(shape.binding_role, null);
});

test("finalizeBindingShape falls back to the full condition_text when evidence_span is not a real substring", () => {
  const shape = finalizeBindingShape(draftBindable({ evidence_span: "text nowhere in the condition" }), CONDITION);
  assert.equal(shape.evidence_span, CONDITION.condition_text);
});

test("finalizeBindingShape passes a well-formed draft through unchanged", () => {
  const draft = draftBindable();
  const shape = finalizeBindingShape(draft, CONDITION);
  assert.equal(shape.bindability, "bindable");
  assert.equal(shape.binding_role, "partial_scope");
  assert.deepEqual(shape.predicate, buildPredicate(draft));
  assert.equal(shape.evidence_span, draft.evidence_span);
});

test("a gate-failing proposal (missing non_bindable_reason) still produces a structurally schema-valid binding file, needs_review but never malformed — the exact defect found on a live S6(R1) run", async () => {
  const client = { complete: async () => draftNonBindable({ non_bindable_reason: null }) };
  const { binding } = await proposeAndVerifyBinding({ condition: CONDITION, client });
  assert.equal(binding.verification_status, "needs_review");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "binding_shape_e2e_"));
  try {
    const file = path.join(dir, "test_doc.json");
    fs.writeFileSync(file, JSON.stringify({ document_id: "test_doc", bindings: [binding] }));
    const index = { conditions: new Map([[CONDITION.condition_id, CONDITION]]) };
    const { buildSlotIndex } = require("../validation/validate_bindings");
    const result = validateBindingFiles([file], { index, slotById: buildSlotIndex() });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("claimTextForBinding renders an all_of predicate using the slot's natural-language value_labels, never the raw enum token or the long description", () => {
  const binding = {
    predicate: { all_of: [{ slot: "relevant_species_availability", operator: "equals", value: "two_rodent_and_nonrodent" }] }
  };
  const claim = claimTextForBinding(binding);
  assert.match(claim, /two pharmacologically relevant species/);
  assert.doesNotMatch(claim, /two_rodent_and_nonrodent/);
  assert.doesNotMatch(claim, /Whether, and how many/);
});

// --- runDeterministicGates ---

test("deterministic gate rejects an evidence_span that is not a verbatim substring of condition_text", () => {
  const draft = draftBindable({ evidence_span: "text that does not appear anywhere in the condition" });
  const gate = runDeterministicGates(draft, CONDITION);
  assert.equal(gate.passed, false);
  assert.ok(gate.reasons.some((r) => r.includes("verbatim substring")));
});

test("deterministic gate rejects a predicate referencing an unknown slot", () => {
  const draft = draftBindable({ leaves: [{ slot: "made_up_slot", operator: "equals", value: "x", values: null }] });
  const gate = runDeterministicGates(draft, CONDITION);
  assert.equal(gate.passed, false);
  assert.ok(gate.reasons.some((r) => r.includes("unknown slot")));
});

test("deterministic gate rejects a predicate value outside the slot's declared vocabulary", () => {
  const draft = draftBindable({
    leaves: [{ slot: "relevant_species_availability", operator: "equals", value: "three_species", values: null }]
  });
  const gate = runDeterministicGates(draft, CONDITION);
  assert.equal(gate.passed, false);
  assert.ok(gate.reasons.some((r) => r.includes("not in slot")));
});

test("deterministic gate rejects a non_bindable draft with an invalid reason", () => {
  const draft = draftNonBindable({ non_bindable_reason: "not_a_real_reason" });
  const gate = runDeterministicGates(draft, CONDITION);
  assert.equal(gate.passed, false);
  assert.ok(gate.reasons.some((r) => r.includes("non_bindable_reason")));
});

test("deterministic gate passes a well-formed bindable draft", () => {
  const gate = runDeterministicGates(draftBindable(), CONDITION);
  assert.equal(gate.passed, true, JSON.stringify(gate.reasons));
});

test("deterministic gate passes a well-formed non_bindable draft", () => {
  const gate = runDeterministicGates(draftNonBindable(), CONDITION);
  assert.equal(gate.passed, true, JSON.stringify(gate.reasons));
});

// --- proposeAndVerifyBinding orchestration ---

test("a deterministic-gate failure leaves the binding needs_review without calling the entailment agent", async () => {
  let calls = 0;
  const client = {
    complete: async () => {
      calls++;
      return draftBindable({ evidence_span: "text not in the condition at all" });
    }
  };
  const { binding, reasons } = await proposeAndVerifyBinding({ condition: CONDITION, client });
  assert.equal(binding.verification_status, "needs_review");
  assert.equal(calls, 1, "must not call the client again after the deterministic gate fails");
  assert.ok(reasons.length > 0);
});

test("a non_bindable draft that passes the deterministic gate is verified without an entailment call", async () => {
  let calls = 0;
  const client = {
    complete: async () => {
      calls++;
      return draftNonBindable();
    }
  };
  const { binding } = await proposeAndVerifyBinding({ condition: CONDITION, client });
  assert.equal(binding.bindability, "non_bindable");
  assert.equal(binding.verification_status, "verified");
  assert.equal(calls, 1, "non_bindable has no predicate claim to entail-check");
});

test("entailment failure leaves the binding needs_review — kept, not discarded", async () => {
  const client = sequentialClient([
    draftBindable(), // proposal
    { entailed: false, reason: "the predicate asserts more than the condition text states" } // entailment check
  ]);
  const { binding, reasons } = await proposeAndVerifyBinding({ condition: CONDITION, client, hasTargetRule: true });
  assert.equal(binding.verification_status, "needs_review");
  assert.ok(binding.predicate, "the binding object itself is still returned, not dropped");
  assert.ok(reasons.some((r) => r.includes("entailment failed")));
});

test("a full_scope proposal with no target rule is demoted to partial_scope without an LLM full-scope-gate call", async () => {
  const client = sequentialClient([
    draftBindable({ binding_role: "full_scope" }), // proposal
    { entailed: true, reason: "ok" } // entailment check
    // no third response queued — must not call complete() a third time
  ]);
  const { binding } = await proposeAndVerifyBinding({ condition: CONDITION, client, hasTargetRule: false });
  assert.equal(binding.binding_role, "partial_scope");
  assert.equal(binding.verification_status, "verified");
});

test("full_scope gate demotes to partial_scope when the gate is not confirmed, but the binding stays verified", async () => {
  const client = sequentialClient([
    draftBindable({ binding_role: "full_scope" }), // proposal
    { entailed: true, reason: "ok" }, // entailment check
    { full_scope_confirmed: false, reason: "a sibling condition also restricts this rule" } // full-scope gate
  ]);
  const { binding } = await proposeAndVerifyBinding({ condition: CONDITION, client, hasTargetRule: true, siblingConditionTexts: ["some other condition"] });
  assert.equal(binding.binding_role, "partial_scope");
  assert.equal(binding.verification_status, "verified", "demotion is not a rejection — the weaker claim is still true");
});

test("full_scope gate confirmed keeps binding_role as full_scope", async () => {
  const client = sequentialClient([
    draftBindable({ binding_role: "full_scope" }),
    { entailed: true, reason: "ok" },
    { full_scope_confirmed: true, reason: "no sibling conditions and the wording is exhaustive" }
  ]);
  const { binding } = await proposeAndVerifyBinding({ condition: CONDITION, client, hasTargetRule: true });
  assert.equal(binding.binding_role, "full_scope");
  assert.equal(binding.verification_status, "verified");
});

test("condition_type=exception always yields binding_role=exception regardless of the model's proposed role", async () => {
  const client = sequentialClient([
    draftBindable({
      binding_role: "full_scope",
      leaves: [{ slot: "relevant_species_availability", operator: "equals", value: "one", values: null }],
      evidence_span: "scientific rationale for using non-rodents"
    }),
    { entailed: true, reason: "ok" }
    // no full-scope-gate call expected: exception role bypasses that gate entirely
  ]);
  const { binding } = await proposeAndVerifyBinding({ condition: EXCEPTION_CONDITION, client, hasTargetRule: true });
  assert.equal(binding.binding_role, "exception");
  assert.equal(binding.verification_status, "verified");
});

test("a non_bindable proposal on a condition_type=exception condition produces binding_role=null, not a schema-invalid exception role (real bug found on a live S6(R1) run)", async () => {
  const client = sequentialClient([
    draftNonBindable({ non_bindable_reason: "expert_judgment_required", evidence_span: "scientific rationale" })
    // non_bindable requires no entailment call
  ]);
  const { binding } = await proposeAndVerifyBinding({ condition: EXCEPTION_CONDITION, client, hasTargetRule: true });
  assert.equal(binding.bindability, "non_bindable");
  assert.equal(binding.binding_role, null, "schema requires binding_role=null whenever bindability=non_bindable, even for a structurally-exception condition");
  assert.equal(binding.predicate, null);
  assert.equal(binding.verification_status, "verified");
});
