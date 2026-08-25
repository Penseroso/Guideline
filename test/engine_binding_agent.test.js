const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runDeterministicGates,
  buildPredicate,
  resolveBindingRole,
  bindingIdFor,
  claimTextForBinding,
  proposeAndVerifyBinding
} = require("../engine/binding_agent");

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

test("claimTextForBinding renders an all_of predicate as a natural-language restriction", () => {
  const binding = {
    predicate: { all_of: [{ slot: "relevant_species_availability", operator: "equals", value: "two_rodent_and_nonrodent" }] }
  };
  const claim = claimTextForBinding(binding);
  assert.match(claim, /applies only when/);
  assert.match(claim, /two_rodent_and_nonrodent/);
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
