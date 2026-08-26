const fs = require("fs");
const path = require("path");

const { verifyClaim } = require("./verification_agent");

/**
 * Automated Condition -> RegulatoryContext-predicate binding pipeline
 * (Applicability Layer 0.1.0, docs/schema.md). Mirrors the existing
 * extraction_agent.js/verification_agent.js posture — the model proposes,
 * deterministic code enforces every invariant that must never depend on
 * the model getting it right on its own:
 *   1. LLM proposes bindability/non_bindable_reason/binding_role/predicate/
 *      evidence_span for one Condition (proposeBinding).
 *   2. Deterministic gate: schema-shape validity, evidence_span is a
 *      verbatim substring of condition_text, predicate slots/values are in
 *      the declared RegulatoryContext vocabulary (runDeterministicGates).
 *   3. A separate, narrower verification-agent call checks the predicate's
 *      natural-language restatement is actually entailed by condition_text
 *      (same primitive as verification_agent.js, reused not duplicated).
 *   4. A binding_role="full_scope" claim is never trusted from the proposal
 *      step alone — it passes a stricter, separate gate first, or is
 *      demoted to "partial_scope" (never rejected outright: the weaker
 *      claim is still true, so demotion loses nothing).
 *   5. verification_status="verified" only if every gate above passed;
 *      otherwise "needs_review" — kept and visible, never discarded
 *      (product_roadmap.md §2.5.1's "review_status... a record that fails
 *      verification is never dropped or silently promoted" principle,
 *      applied here to the derived binding layer's own status field).
 *
 * "exception" binding_role is never proposed by the model — it is derived
 * deterministically from the source Condition's own condition_type, the
 * same way schema.md already treats condition_type=exception as a
 * structural fact, not a judgment call.
 */

const CONTEXT_SLOTS_PATH = path.join(__dirname, "..", "data", "ontology", "context_slots.json");
let contextSlotsCache = null;
function loadContextSlots() {
  if (!contextSlotsCache) {
    contextSlotsCache = JSON.parse(fs.readFileSync(CONTEXT_SLOTS_PATH, "utf8"));
  }
  return contextSlotsCache;
}

function slotVocabulary() {
  const slots = loadContextSlots();
  return [...slots.program_slots, ...slots.program_finding_slots];
}

function findSlot(slotId) {
  return slotVocabulary().find((s) => s.slot_id === slotId) || null;
}

const NON_BINDABLE_REASONS = ["epistemic_hedge", "discourse_marker", "narrative_reference", "expert_judgment_required"];
const OPERATORS = ["equals", "not_equals", "in", "not_in"];

// --- LLM-facing draft schema -----------------------------------------
//
// Deliberately flat (no nested nullable predicate object, no oneOf on
// leaf.value) for the same reason extraction_agent.js's draft schemas
// avoid those shapes: OpenAI structured-output strict mode rejects
// `oneOf` and requires every declared property to be listed in
// `required`. group_type/leaves stand in for the persisted schema's
// `{ all_of: [...] } | { any_of: [...] }` predicate object, and
// value/values stand in for the operator-dependent scalar-vs-array
// value — both reassembled into the real persisted shape in
// buildPredicate() below, mirroring how extraction_agent.js's
// knowledge_record_temp_id / condition_temp_ids get remapped after
// the call instead of asking the model to emit final archive shapes.

function draftPredicateLeafSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["slot", "operator", "value", "values"],
    properties: {
      slot: { type: "string", description: "One of the slot_id values listed in the system prompt's slot vocabulary." },
      operator: { type: "string", enum: OPERATORS },
      value: { type: ["string", "null"], description: "Populate for operator equals/not_equals. Null for in/not_in." },
      values: {
        type: ["array", "null"],
        items: { type: "string" },
        description: "Populate for operator in/not_in. Null for equals/not_equals."
      }
    }
  };
}

function draftBindingSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["bindability", "non_bindable_reason", "binding_role", "group_type", "leaves", "evidence_span"],
    properties: {
      bindability: { type: "string", enum: ["bindable", "non_bindable"] },
      non_bindable_reason: { type: ["string", "null"], enum: [...NON_BINDABLE_REASONS, null] },
      binding_role: {
        type: ["string", "null"],
        enum: ["full_scope", "partial_scope", null],
        description: "Never propose \"exception\" — that role is assigned automatically from condition_type. Null when bindability=non_bindable."
      },
      group_type: { type: ["string", "null"], enum: ["all_of", "any_of", null], description: "Null when bindability=non_bindable." },
      leaves: { type: "array", items: draftPredicateLeafSchema() },
      evidence_span: {
        type: "string",
        minLength: 1,
        description: "An exact, minimal verbatim substring of the condition text — never a paraphrase."
      }
    }
  };
}

function slotVocabularyText() {
  return slotVocabulary()
    .map((s) => `- ${s.slot_id} (${s.kind}): ${s.description} Allowed values: ${s.values.join(", ")}.`)
    .join("\n");
}

function systemPrompt() {
  return (
    "You turn one regulatory guideline Condition's text into a machine-evaluable predicate over a fixed " +
    "vocabulary of RegulatoryContext slots, or explicitly mark it as not machine-evaluable. Only use the " +
    "slots and values listed below — never invent a new slot or value. " +
    "Mark bindability=\"non_bindable\" (with a reason) when the condition text is a general framing phrase, " +
    "a hedge (\"in general\", \"in most cases\", \"where feasible\"), a narrative/discourse marker (\"during " +
    "the CT\"), or something that requires case-by-case expert judgment rather than a checkable fact about " +
    "the program (e.g. \"in certain justified cases\", \"if appropriately justified\"). Use: " +
    "epistemic_hedge for approximate/typical-case language with no checkable threshold; " +
    "discourse_marker for connective/narrative phrases with no propositional content; " +
    "narrative_reference for phrases that just locate the statement in time/place/process rather than " +
    "state a condition; expert_judgment_required for phrases that explicitly defer to case-by-case " +
    "scientific justification. " +
    "When bindable, choose the slot(s) whose value the condition text actually asserts, using " +
    "\"equals\"/\"not_equals\" for a single value or \"in\"/\"not_in\" for a set. " +
    "binding_role: use \"partial_scope\" unless you are confident the condition, by itself, is the ENTIRE " +
    "applicability boundary for the rule it qualifies (\"full_scope\") — default to \"partial_scope\" " +
    "whenever unsure, since a wrong full_scope claim can wrongly tell a user a rule does not apply. Never " +
    "propose \"exception\" yourself. " +
    "evidence_span MUST be an exact, minimal verbatim substring of the condition text — never a paraphrase." +
    "\n\nAvailable slots:\n" +
    slotVocabularyText()
  );
}

async function proposeBinding({ condition, client, model }) {
  const userText = `Condition (condition_type=${condition.condition_type}):\n"""${condition.condition_text}"""`;
  return client.complete({
    system: systemPrompt(),
    messages: [{ role: "user", content: userText }],
    schema: draftBindingSchema(),
    ...(model ? { model } : {})
  });
}

// --- Deterministic gate ------------------------------------------------

function leafValues(leaf) {
  return leaf.operator === "in" || leaf.operator === "not_in" ? leaf.values || [] : [leaf.value];
}

function runDeterministicGates(draft, condition) {
  const reasons = [];

  if (!draft.evidence_span || !condition.condition_text.includes(draft.evidence_span)) {
    reasons.push("evidence_span is not a verbatim substring of condition_text");
  }

  if (draft.bindability === "non_bindable") {
    if (!NON_BINDABLE_REASONS.includes(draft.non_bindable_reason)) {
      reasons.push(`non_bindable_reason "${draft.non_bindable_reason}" is missing or not a declared reason`);
    }
  } else if (draft.bindability === "bindable") {
    if (draft.group_type !== "all_of" && draft.group_type !== "any_of") {
      reasons.push(`group_type "${draft.group_type}" must be "all_of" or "any_of"`);
    }
    if (!draft.leaves || draft.leaves.length === 0) {
      reasons.push("bindable binding proposed with no predicate leaves");
    }
    for (const leaf of draft.leaves || []) {
      const slot = findSlot(leaf.slot);
      if (!slot) {
        reasons.push(`predicate references unknown slot "${leaf.slot}"`);
        continue;
      }
      for (const v of leafValues(leaf)) {
        if (!slot.values.includes(v)) {
          reasons.push(`predicate value "${v}" is not in slot "${leaf.slot}"'s declared values`);
        }
      }
    }
  } else {
    reasons.push(`bindability "${draft.bindability}" is not "bindable" or "non_bindable"`);
  }

  return { passed: reasons.length === 0, reasons };
}

// --- Finalization into the persisted condition_binding.schema.json shape ---

function bindingIdFor(conditionId) {
  return conditionId.replace(".cond.", ".bind.");
}

// Fallback used only when the model's own proposal is already flagged
// invalid by runDeterministicGates (verification_status will be
// "needs_review" either way) but the *persisted* binding object must still
// satisfy condition_binding.schema.json's structural invariants — a
// non_bindable binding requires a non-null, enum-valid reason. Found live
// on a real S6(R1) run (docs/milestone_log.md M6): the model twice
// proposed bindability="non_bindable" with non_bindable_reason left null,
// and writing that straight through produced a schema-invalid file even
// though the pipeline correctly marked it needs_review. Mirrors
// engine/pipeline.js's own established principle for the source archive:
// a failed-verification record's rejection reason lives in a parallel
// report (here: the `reasons` array bind_conditions.js logs to the
// console), never inside the record itself, which must stay valid against
// the closed schema. "expert_judgment_required" is the most general of
// the four reasons — an honest placeholder for "a human needs to look at
// this," not a claim about which specific reason actually applies.
const FALLBACK_NON_BINDABLE_REASON = "expert_judgment_required";

function sanitizeNonBindableReason(reason) {
  return NON_BINDABLE_REASONS.includes(reason) ? reason : FALLBACK_NON_BINDABLE_REASON;
}

// Same principle for evidence_span: the schema requires a non-empty
// string. If the model's own value failed the verbatim-substring gate (or
// was missing/empty), fall back to the full condition_text — trivially a
// substring of itself, so the persisted binding is always schema-valid
// regardless of what the model proposed.
function sanitizeEvidenceSpan(evidenceSpan, condition) {
  return evidenceSpan && condition.condition_text.includes(evidenceSpan) ? evidenceSpan : condition.condition_text;
}

function buildPredicate(draft) {
  if (draft.bindability !== "bindable") return null;
  const leaves = draft.leaves.map((leaf) => ({
    slot: leaf.slot,
    operator: leaf.operator,
    value: leaf.operator === "in" || leaf.operator === "not_in" ? leaf.values || [] : leaf.value
  }));
  return { [draft.group_type]: leaves };
}

function sanitizeLeaves(leaves) {
  return (leaves || []).filter((leaf) => leaf && leaf.slot && OPERATORS.includes(leaf.operator));
}

/**
 * Composes bindingIdFor/sanitizeNonBindableReason/sanitizeEvidenceSpan/
 * buildPredicate/resolveBindingRole into one guarantee: whatever this
 * returns is always structurally valid against
 * condition_binding.schema.json's conditionBinding definition, regardless
 * of what the model proposed. runDeterministicGates (run separately,
 * against the raw draft) is what decides verification_status — this
 * function only decides what is *safe to persist*, the same separation
 * engine/extraction_agent.js already draws between
 * validateSourceUnitIds's sanitization and the verification step's
 * accept/reject judgment.
 */
function finalizeBindingShape(draft, condition) {
  const evidenceSpan = sanitizeEvidenceSpan(draft.evidence_span, condition);

  if (draft.bindability !== "bindable") {
    return {
      bindability: "non_bindable",
      non_bindable_reason: sanitizeNonBindableReason(draft.non_bindable_reason),
      binding_role: null,
      predicate: null,
      evidence_span: evidenceSpan
    };
  }

  const sanitizedDraft = {
    ...draft,
    group_type: draft.group_type === "any_of" ? "any_of" : "all_of",
    leaves: sanitizeLeaves(draft.leaves)
  };

  if (sanitizedDraft.leaves.length === 0) {
    // A "bindable" claim with no usable predicate leaves isn't actually
    // machine-evaluable — persisting it as non_bindable is a more accurate
    // representation than an empty predicate, and keeps the persisted
    // shape schema-valid (all_of/any_of require minItems:1).
    return {
      bindability: "non_bindable",
      non_bindable_reason: FALLBACK_NON_BINDABLE_REASON,
      binding_role: null,
      predicate: null,
      evidence_span: evidenceSpan
    };
  }

  return {
    bindability: "bindable",
    non_bindable_reason: null,
    binding_role: resolveBindingRole(sanitizedDraft, condition),
    predicate: buildPredicate(sanitizedDraft),
    evidence_span: evidenceSpan
  };
}

/**
 * binding_role resolution order: (1) non_bindable always has no role — the
 * schema requires binding_role=null whenever bindability=non_bindable, and
 * checking this first matters: a Condition can be structurally
 * condition_type="exception" in the source schema while its actual wording
 * is still not machine-checkable (e.g. "unless there is a scientific
 * rationale for using non-rodents" — an expert-judgment hedge, not a
 * checkable predicate). Found live on a real S6(R1) run
 * (docs/milestone_log.md M6): checking condition_type=exception first
 * unconditionally forced binding_role="exception" even when the model had
 * (correctly) proposed non_bindable, producing a schema-invalid
 * non_bindable+exception combination — and, more importantly, the wrong
 * *answer*: forcing a hedge-qualified exception into a hard deterministic
 * gate would let it flip a verdict to not_applicable without any actual
 * checkable evidence, exactly the overclaim this layer exists to prevent.
 * (2) condition_type=exception forces binding_role="exception" only once
 * bindability=bindable is already established — a structural fact, not a
 * judgment call, at that point. (3) otherwise trust the model's
 * full_scope/partial_scope choice for now — a full_scope claim is
 * re-checked and possibly demoted later in proposeAndVerifyBinding, once
 * entailment has already passed.
 */
function resolveBindingRole(draft, condition) {
  if (draft.bindability !== "bindable") return null;
  if (condition.condition_type === "exception") return "exception";
  return draft.binding_role === "full_scope" ? "full_scope" : "partial_scope";
}

// --- Entailment check (reuses verification_agent.js's verifyClaim) -----
//
// Renders each leaf using the slot's `value_labels` — a short, natural-
// language paraphrase (e.g. "there are two pharmacologically relevant
// species... one rodent and one non-rodent"), never the slot's long
// `description` sentence and never the raw snake_case enum token. Found
// live on a real S6(R1) dry-run (docs/milestone_log.md M6): the first
// version interpolated the full description sentence as if it were a
// noun phrase ("...applies only when Whether, and how many, ... exist for
// the clinical candidate. is \"two_rodent_and_nonrodent\"") and asserted
// "applies only when" exclusivity the condition text itself never states —
// verification correctly rejected essentially every bindable claim (13/13
// failed) for introducing an enum token and a framing the source doesn't
// support. `value_labels` fixes the grammar; describing a "circumstance"
// rather than asserting exclusivity avoids over-claiming beyond the
// condition's own wording.
const OPERATOR_PHRASE = {
  equals: (label) => label,
  not_equals: (label) => `not: ${label}`,
  in: (labels) => `one of the following: ${labels.join("; ")}`,
  not_in: (labels) => `none of the following: ${labels.join("; ")}`
};

function labelFor(slot, value) {
  return slot && slot.value_labels && slot.value_labels[value] ? slot.value_labels[value] : value;
}

function claimTextForBinding(binding) {
  const groupType = binding.predicate.all_of ? "all_of" : "any_of";
  const leaves = binding.predicate[groupType];
  const parts = leaves.map((leaf) => {
    const slot = findSlot(leaf.slot);
    if (leaf.operator === "in" || leaf.operator === "not_in") {
      return OPERATOR_PHRASE[leaf.operator](leaf.value.map((v) => labelFor(slot, v)));
    }
    return OPERATOR_PHRASE[leaf.operator](labelFor(slot, leaf.value));
  });
  const joiner = groupType === "all_of" ? "; and " : "; or ";
  return `This describes the following circumstance: ${parts.join(joiner)}.`;
}

// --- Stricter full_scope gate -------------------------------------------

const FULL_SCOPE_SYSTEM_PROMPT =
  "You judge whether ONE regulatory Condition, by itself, is the complete applicability boundary for the " +
  "rule it qualifies (full_scope_confirmed=true), or whether the rule's applicability could still depend on " +
  "other factors not captured by this one condition — for example, sibling conditions attached to the same " +
  "rule, or aspects of the condition's own wording this predicate does not fully capture " +
  "(full_scope_confirmed=false). Default to false whenever genuinely unsure: wrongly confirming full scope " +
  "risks telling a user a rule does not apply when it actually might, under a circumstance this condition " +
  "doesn't cover.";

function fullScopeGateSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["full_scope_confirmed", "reason"],
    properties: {
      full_scope_confirmed: { type: "boolean" },
      reason: { type: "string", minLength: 1 }
    }
  };
}

async function checkFullScopeGate({ condition, siblingConditionTexts = [], client, model }) {
  const userText = [
    `Condition under review: "${condition.condition_text}"`,
    siblingConditionTexts.length
      ? `Other conditions attached to the same rule:\n${siblingConditionTexts.map((t) => `- "${t}"`).join("\n")}`
      : "No other conditions are attached to this rule."
  ].join("\n\n");
  const result = await client.complete({
    system: FULL_SCOPE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText }],
    schema: fullScopeGateSchema(),
    ...(model ? { model } : {})
  });
  return { confirmed: Boolean(result.full_scope_confirmed), reason: result.reason };
}

// --- Orchestration -------------------------------------------------------

/**
 * @param {object} condition - a real archive Condition record (condition_id,
 *   condition_text, condition_type).
 * @param {string[]} [siblingConditionTexts] - condition_text of other
 *   Conditions targeting the same rule (KnowledgeRecord/QuantitativeCriterion)
 *   this condition applies to — used only by the full_scope gate.
 * @param {boolean} [hasTargetRule] - whether this condition's applies_to_ids
 *   is non-empty. A full_scope claim about a condition with no target rule
 *   at all is unverifiable by construction and is demoted without an LLM
 *   call.
 * @param {object} client - engine/llm_client.js client, used for both the
 *   proposal and (by default) verification calls.
 * @param {string} [model] - override for the proposal call.
 * @param {string} [verificationModel] - override for the entailment and
 *   full_scope gate calls — product_roadmap.md §2.5.1 prefers a different
 *   model/provider from the proposal step where practical.
 */
async function proposeAndVerifyBinding({
  condition,
  siblingConditionTexts = [],
  hasTargetRule = false,
  client,
  model,
  verificationModel
}) {
  const draft = await proposeBinding({ condition, client, model });
  // Gate against the model's raw, unsanitized proposal — its job is to
  // decide verification_status, not what gets persisted.
  const gate = runDeterministicGates(draft, condition);

  const binding = {
    binding_id: bindingIdFor(condition.condition_id),
    condition_id: condition.condition_id,
    // finalizeBindingShape guarantees this is always schema-structurally
    // valid, even when the gate above is about to fail — see its own
    // comment for why that separation matters.
    ...finalizeBindingShape(draft, condition),
    verification_status: "needs_review"
  };

  if (!gate.passed) {
    return { binding, reasons: gate.reasons };
  }

  if (binding.bindability === "non_bindable") {
    binding.verification_status = "verified";
    return { binding, reasons: [] };
  }

  // sourceText is the binding's own evidence_span (already gate-verified as
  // a verbatim substring of condition_text), not the full condition_text.
  // This narrows the entailment question to exactly the interpretation risk
  // that matters — "is this predicate a fair reading of the specific span
  // the model grounded it in" — rather than re-litigating whether the
  // broader condition_text supports an "applies only when" exclusivity
  // claim it was never written to make (see claimTextForBinding's comment).
  const entailment = await verifyClaim({
    claim: claimTextForBinding(binding),
    sourceText: binding.evidence_span,
    client,
    model: verificationModel
  });
  if (!entailment.entailed) {
    return { binding, reasons: [`entailment failed: ${entailment.reason}`] };
  }

  if (binding.binding_role === "full_scope") {
    if (!hasTargetRule) {
      binding.binding_role = "partial_scope";
    } else {
      const fullScopeResult = await checkFullScopeGate({ condition, siblingConditionTexts, client, model: verificationModel });
      if (!fullScopeResult.confirmed) {
        binding.binding_role = "partial_scope";
      }
    }
  }

  binding.verification_status = "verified";
  return { binding, reasons: [] };
}

module.exports = {
  draftBindingSchema,
  proposeBinding,
  runDeterministicGates,
  buildPredicate,
  resolveBindingRole,
  finalizeBindingShape,
  bindingIdFor,
  claimTextForBinding,
  checkFullScopeGate,
  proposeAndVerifyBinding,
  findSlot,
  slotVocabulary,
  NON_BINDABLE_REASONS
};
