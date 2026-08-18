const path = require("path");

const bundleSchema = require("../structured_data/schemas/guideline_bundle.schema.json");

/**
 * Schema-constrained extraction (product_roadmap.md §2.5 step 2).
 * One call per Section. The LLM never invents object IDs (those are
 * assigned deterministically after the call, following the existing
 * ID convention in working_docs/schema.md) and never generates
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
    replaceWithTempIdArray: { knowledge_record_id: "knowledge_record_temp_id", condition_ids: "condition_temp_ids" }
  });
  schema.properties.value_fraction = nullableFractionSchema();
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
    "quote the exact minimal supporting excerpt from the given source units.";

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

  const quantitativeCriteria = (draft.quantitative_criteria || []).map((qc, i) => ({
    criterion_id: nextId(documentId, "qc", section.section_number, i + 1),
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
    source_text: qc.source_text,
    review_status: "needs_review"
  }));

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
