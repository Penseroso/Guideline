const path = require("path");

const bundleSchema = require("../data/schemas/guideline_bundle.schema.json");

/**
 * Schema-constrained extraction (product_roadmap.md §2.5 step 2).
 * One call per Section. The LLM never invents object IDs (those are
 * assigned deterministically after the call, following the existing
 * ID convention in docs/schema.md) and never generates
 * SourceUnit-level source_text (that's mechanical, from step 1 — the
 * LLM only ever sees it as input, never re-emits it as its own text).
 * Cross-links within one extraction call (e.g. a QuantitativeCriterion
 * pointing at a Condition drafted in the same call) use a small
 * LLM-assigned `temp_id` local to this call, remapped to real IDs
 * after parsing — the LLM is never trusted to know the archive's real
 * ID space.
 */

// Draft schemas derived from the real object schemas in
// guideline_bundle.schema.json, with archive-assigned ID fields
// replaced by a local `temp_id` and cross-reference ID arrays
// replaced by arrays of temp_ids. Everything else (enums, required-
// ness) is reused as-is so drift between the extraction contract and
// the actual archive schema isn't possible.
function draftKnowledgeRecordSchema() {
  const src = bundleSchema.definitions.knowledgeRecord;
  return withTempId(src, {
    drop: ["knowledge_record_id", "review_status"],
    keep: ["source_unit_ids", "record_type", "modality", "original_modal_text", "subject", "action", "object", "normalized_ko"]
  });
}

// value_fraction in the real schema is `oneOf: [{type:null}, {$ref:
// fractionValue}]` — valid JSON Schema, but OpenAI's structured-output
// strict mode rejects `oneOf` outright (verified against the live API,
// error: "'oneOf' is not permitted"). Rebuilt as a nullable object via
// `type: ["object", "null"]`, which strict mode does accept.
function nullableFractionSchema() {
  const fraction = bundleSchema.definitions.fractionValue;
  return { type: ["object", "null"], additionalProperties: false, required: fraction.required, properties: fraction.properties };
}

function draftQuantitativeCriterionSchema() {
  const src = bundleSchema.definitions.quantitativeCriterion;
  const schema = withTempId(src, {
    drop: ["criterion_id", "review_status"],
    keep: ["source_unit_id", "parameter", "comparator", "value", "value_fraction", "unit", "value_status", "denominator_or_reference", "source_text"],
    replaceWithTempIdArray: { knowledge_record_id: "knowledge_record_temp_id", condition_ids: "condition_temp_ids", joint_with_ids: "joint_with_temp_ids" }
  });
  schema.properties.value_fraction = nullableFractionSchema();
  // Reciprocity (schema.md: "A.joint_with_ids includes B => B.joint_with_ids
  // includes A") is enforced in code below (see the symmetrization pass in
  // finalizeDraft), not left to the model to get right on its own — same
  // trust posture as temp_id itself: the model proposes, deterministic code
  // guarantees the invariant.
  schema.properties.joint_with_temp_ids.description =
    "temp_ids of OTHER QuantitativeCriterion drafts in this same call that, together with this one, " +
    "jointly restate a single compound source statement — all values must hold AT THE SAME TIME " +
    "(e.g. a count-fraction threshold and the tolerance that fraction must meet, both from one sentence). " +
    "Do NOT use this to link a general criterion to its own exception (e.g. a general threshold and a " +
    "separate LLOQ threshold) — those are alternatives, not a joint/concurrent statement. Leave empty when independent.";
  return schema;
}

function draftConditionSchema() {
  const src = bundleSchema.definitions.condition;
  return withTempId(src, {
    drop: ["condition_id", "review_status"],
    keep: ["source_unit_id", "condition_text", "condition_type"],
    replaceWithTempIdArray: { applies_to_ids: "applies_to_temp_ids" }
  });
}

// OpenAI/Anthropic structured-output ("strict") modes require the
// submitted schema to be fully self-contained (no dangling $ref into a
// separate `definitions` block the API never sees) and, for OpenAI
// strict mode specifically, every property in `properties` must also
// appear in `required` — both verified the hard way against the real
// API, not assumed from documentation.
function dereference(node) {
  if (Array.isArray(node)) return node.map(dereference);
  if (node && typeof node === "object") {
    if (typeof node.$ref === "string" && node.$ref.startsWith("#/definitions/")) {
      const key = node.$ref.slice("#/definitions/".length);
      const target = bundleSchema.definitions[key];
      if (!target) throw new Error(`extraction_agent: unresolved $ref ${node.$ref}`);
      return dereference(target);
    }
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = dereference(v);
    return out;
  }
  return node;
}

function withTempId(sourceSchema, { drop, keep, replaceWithTempIdArray = {} }) {
  const properties = { temp_id: { type: "integer", description: "Local ID for this extraction call only, referenced by other drafts in the same call. Not an archive ID." } };
  for (const key of keep) properties[key] = sourceSchema.properties[key];
  const replacementKeys = [];
  for (const [, replacementKey] of Object.entries(replaceWithTempIdArray)) {
    properties[replacementKey] = { type: "array", items: { type: "integer" } };
    replacementKeys.push(replacementKey);
  }
  const required = ["temp_id", ...sourceSchema.required.filter((f) => keep.includes(f)), ...replacementKeys];
  return dereference({ type: "object", additionalProperties: false, required, properties });
}

function extractionOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["knowledge_records", "quantitative_criteria", "conditions"],
    properties: {
      knowledge_records: { type: "array", items: draftKnowledgeRecordSchema() },
      quantitative_criteria: { type: "array", items: draftQuantitativeCriterionSchema() },
      conditions: { type: "array", items: draftConditionSchema() }
    }
  };
}

function slugifySectionNumber(sectionNumber) {
  return String(sectionNumber).replace(/\./g, "_");
}

function nextId(documentId, kind, sectionNumber, n) {
  return `${documentId}.${kind}.${slugifySectionNumber(sectionNumber)}.${String(n).padStart(3, "0")}`;
}

/**
 * Rejects any source_unit_id the model references that wasn't in the
 * input for this section — the model must only cite what it was
 * actually given, never a source unit from outside this call.
 */
function validateSourceUnitIds(ids, allowedIds) {
  const allowed = new Set(allowedIds);
  return (ids || []).filter((id) => allowed.has(id));
}

async function extractSection({ section, sourceUnits, client }) {
  const allowedSourceUnitIds = sourceUnits.map((su) => su.source_unit_id);

  const system =
    "You extract regulatory guideline content into structured records. " +
    "Only use information present in the given source units. " +
    "Never invent a source_unit_id that wasn't provided. " +
    "Never restate or paraphrase whole paragraphs as source_text/condition_text — " +
    "quote the exact minimal supporting excerpt from the given source units. " +
    // Added after a real dry-run (M10 3.2.5.2) showed 0 wrong values but
    // real under-extraction: a quantitative fact embedded in a sentence
    // already captured as a KnowledgeRecord did not also get its own
    // QuantitativeCriterion. The schema already supported it (the
    // human-reviewed archive has the same record) — the prompt just
    // never told the model to keep decomposing after the first hit.
    "Be exhaustive, not just non-fabricating: a sentence can produce a KnowledgeRecord " +
    "AND one or more QuantitativeCriterion/Condition records at the same time. Do not stop " +
    "at the first record type that fits — if a sentence already captured as a KnowledgeRecord " +
    "also contains a number+comparator+unit, or a distinct applicability/scope/precondition/exception " +
    "clause, extract those too as their own records, exactly as you would if the sentence had not " +
    "already produced a KnowledgeRecord.";
  // A follow-up instruction telling the model not to duplicate Condition
  // objects was tried and measured against the same section: it fixed
  // one duplicate (LLOQ merged correctly via applies_to_temp_ids) but
  // regressed QuantitativeCriterion recall (12/12 -> 10/12) and caused a
  // *worse* new failure mode (fragmenting plain descriptive qualifiers
  // like "at each concentration level" into spurious Condition records).
  // Reverted. Three prompt versions on one section produced non-monotonic
  // results (QC 11->12->10, Condition 5->10->12) — tuning further against
  // a single section is not reliable signal; needs a multi-section eval
  // before another attempt (see docs/milestone_log.md).

  const userText = [
    `Section ${section.section_number}: ${section.title}`,
    "",
    "Source units (id | text):",
    ...sourceUnits
      .slice()
      .sort((a, b) => (a.unit_order ?? 0) - (b.unit_order ?? 0))
      .map((su) => `${su.source_unit_id} | ${su.source_text}`)
  ].join("\n");

  const draft = await client.complete({
    system,
    messages: [{ role: "user", content: userText }],
    schema: extractionOutputSchema(),
    // GPT-5.6 is a reasoning model: max_completion_tokens covers hidden
    // reasoning tokens *and* the visible output. The adapter's 1024
    // default was entirely consumed by reasoning on a real 14-source-unit
    // section (finish_reason: "length", 0 content chars) — verified
    // against the live API, not assumed. Extraction output is the
    // biggest of the three call types here, so it gets the largest budget.
    maxTokens: 8000
  });

  return finalizeDraft(draft, { section, allowedSourceUnitIds });
}

function finalizeDraft(draft, { section, allowedSourceUnitIds }) {
  const documentId = section.document_id;

  const conditionIdByTempId = new Map();
  const conditions = (draft.conditions || []).map((c, i) => {
    const id = nextId(documentId, "cond", section.section_number, i + 1);
    conditionIdByTempId.set(c.temp_id, id);
    return {
      condition_id: id,
      source_unit_id: allowedSourceUnitIds.includes(c.source_unit_id) ? c.source_unit_id : null,
      condition_text: c.condition_text,
      condition_type: c.condition_type,
      applies_to_ids: [], // resolved below once knowledge_record/criterion IDs exist
      review_status: "needs_review"
    };
  });

  const krIdByTempId = new Map();
  const knowledgeRecords = (draft.knowledge_records || []).map((kr, i) => {
    const id = nextId(documentId, "kr", section.section_number, i + 1);
    krIdByTempId.set(kr.temp_id, id);
    return {
      knowledge_record_id: id,
      source_unit_ids: validateSourceUnitIds(kr.source_unit_ids, allowedSourceUnitIds),
      record_type: kr.record_type,
      modality: kr.modality,
      original_modal_text: kr.original_modal_text ?? null,
      subject: kr.subject ?? null,
      action: kr.action ?? null,
      object: kr.object ?? null,
      normalized_ko: kr.normalized_ko ?? null,
      review_status: "needs_review"
    };
  });

  // criterion_id must be assigned before joint_with_ids can be resolved
  // (criteria reference each other, unlike KR/Condition which are only
  // referenced one-directionally) — a separate id-assignment pass first.
  const qcIdByTempId = new Map();
  (draft.quantitative_criteria || []).forEach((qc, i) => {
    qcIdByTempId.set(qc.temp_id, nextId(documentId, "qc", section.section_number, i + 1));
  });

  const quantitativeCriteria = (draft.quantitative_criteria || []).map((qc) => ({
    criterion_id: qcIdByTempId.get(qc.temp_id),
    source_unit_id: allowedSourceUnitIds.includes(qc.source_unit_id) ? qc.source_unit_id : null,
    knowledge_record_id: krIdByTempId.get(qc.knowledge_record_temp_id) ?? null,
    parameter: qc.parameter,
    comparator: qc.comparator,
    value: qc.value ?? null,
    value_fraction: qc.value_fraction ?? null,
    unit: qc.unit ?? null,
    value_status: qc.value_status,
    denominator_or_reference: qc.denominator_or_reference ?? null,
    condition_ids: (qc.condition_temp_ids || []).map((t) => conditionIdByTempId.get(t)).filter(Boolean),
    joint_with_ids: (qc.joint_with_temp_ids || [])
      .map((t) => qcIdByTempId.get(t))
      .filter((id) => id && id !== qcIdByTempId.get(qc.temp_id)),
    source_text: qc.source_text,
    review_status: "needs_review"
  }));

  // joint_with_ids is symmetric AND transitive by definition (every member
  // is a facet of ONE compound source statement, not a "friend of a
  // friend" social link) — so even a partial chain from the model (e.g.
  // q1 declares {q2,q3}, q3 declares {q1}, q2 declares nothing) is closed
  // into the full clique everyone in the chain belongs to, not just made
  // pairwise-reciprocal. Enforces the schema.md reciprocity invariant
  // (validated by validation/validate_structured_data.js) without trusting
  // the model to declare every direction itself.
  const adjacency = new Map(quantitativeCriteria.map((qc) => [qc.criterion_id, new Set(qc.joint_with_ids)]));
  for (const qc of quantitativeCriteria) {
    for (const otherId of qc.joint_with_ids) {
      adjacency.get(otherId)?.add(qc.criterion_id);
    }
  }
  const componentOf = new Map();
  for (const qc of quantitativeCriteria) {
    if (componentOf.has(qc.criterion_id)) continue;
    const stack = [qc.criterion_id];
    const component = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (component.has(id)) continue;
      component.add(id);
      for (const neighbor of adjacency.get(id) || []) stack.push(neighbor);
    }
    for (const id of component) componentOf.set(id, component);
  }
  for (const qc of quantitativeCriteria) {
    qc.joint_with_ids = [...componentOf.get(qc.criterion_id)].filter((id) => id !== qc.criterion_id).sort();
  }

  // Resolve applies_to_ids now that knowledge_record/criterion real IDs exist.
  // The draft schema only asked for temp-id references to *records
  // drafted in the same call*, so this pass is a closed remap.
  for (const [i, c] of (draft.conditions || []).entries()) {
    const resolved = (c.applies_to_temp_ids || [])
      .map((t) => krIdByTempId.get(t))
      .filter(Boolean);
    conditions[i].applies_to_ids = resolved;
  }

  return { knowledge_records: knowledgeRecords, quantitative_criteria: quantitativeCriteria, conditions };
}

module.exports = {
  extractionOutputSchema,
  extractSection,
  finalizeDraft,
  validateSourceUnitIds,
  slugifySectionNumber,
  nextId
};
