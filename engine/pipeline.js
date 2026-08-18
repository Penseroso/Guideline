/**
 * Wires engine/extraction_agent.js and engine/verification_agent.js
 * into one automatic step (product_roadmap.md §2.5 step 4 / §2.5.1):
 * draft, then verify every drafted object, then set review_status from
 * the verification result — no human spot-check in the loop, and no
 * retry-until-passes loop either (considered and deliberately deferred,
 * working_docs/milestone_log.md M1: a bounded retry is a reasonable
 * future addition, but the immediate value is closing the loop that
 * already exists — a human manually gluing extract+verify together in
 * ad hoc test scripts — not adding self-correction on top of that yet).
 *
 * `review_status` semantics per §2.5.1: `reviewed` means "passed the
 * extraction + verification pipeline," not "a human read it." A record
 * that fails verification is never dropped or silently promoted — it
 * stays `needs_review`, visible, with its rejection reason attached in
 * the parallel verification report (never inside the record itself,
 * which must stay valid against the closed archive JSON Schema).
 */

const { verifyClaim, claimTextFor } = require("./verification_agent");

function sourceTextForUnits(sourceUnits, ids) {
  const byId = new Map(sourceUnits.map((su) => [su.source_unit_id, su]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => (a.unit_order ?? 0) - (b.unit_order ?? 0))
    .map((su) => su.source_text)
    .join("\n");
}

async function verifyKnowledgeRecord(kr, { sourceUnits, client, model }) {
  const claim = [kr.subject, kr.action, kr.object].filter(Boolean).join(" ") || kr.original_modal_text || "";
  const sourceText = sourceTextForUnits(sourceUnits, kr.source_unit_ids);
  return verifyClaim({ claim, sourceText, client, model });
}

async function verifyQuantitativeCriterion(qc, { client, model }) {
  const claim = claimTextFor({
    type: "quantitative_criterion",
    parameter: qc.parameter,
    comparator: qc.comparator,
    value: qc.value,
    value_fraction: qc.value_fraction,
    unit: qc.unit
  });
  // Verified against the criterion's own extracted source_text (a
  // deliberately minimal quote), not the full SourceUnit paragraph —
  // known limitation, see the verification-granularity finding in
  // working_docs/milestone_log.md M1: this can flag a correctly-scoped
  // partial criterion (e.g. a general rule split from its own exception
  // record) as not entailed. Not fixed here; tracked, not silently
  // patched over.
  return verifyClaim({ claim, sourceText: qc.source_text, client, model });
}

async function verifyCondition(condition, { sourceUnits, client, model }) {
  const byId = new Map(sourceUnits.map((su) => [su.source_unit_id, su]));
  const sourceText = byId.get(condition.source_unit_id)?.source_text || condition.condition_text;
  return verifyClaim({ claim: condition.condition_text, sourceText, client, model });
}

/**
 * @param {object} draft - output of extraction_agent.extractSection().
 * @param {object} opts
 * @param {object[]} opts.sourceUnits - the same SourceUnits given to extractSection.
 * @param {object} opts.client - engine/llm_client.js client (extraction's own by default).
 * @param {string} [opts.model] - optional cheaper/different model override for
 *   verification calls (e.g. "gpt-5.6-luna"), kept out of verification_agent.js
 *   itself to stay provider-neutral — the caller decides, per product_roadmap.md
 *   §2.5.1's "prefer a different model for verification" note.
 */
async function verifyDraft(draft, { sourceUnits, client, model }) {
  const report = [];

  const knowledge_records = [];
  for (const kr of draft.knowledge_records) {
    const v = await verifyKnowledgeRecord(kr, { sourceUnits, client, model });
    report.push({ id: kr.knowledge_record_id, type: "knowledge_record", ...v });
    knowledge_records.push({ ...kr, review_status: v.entailed ? "reviewed" : "needs_review" });
  }

  const quantitative_criteria = [];
  for (const qc of draft.quantitative_criteria) {
    const v = await verifyQuantitativeCriterion(qc, { client, model });
    report.push({ id: qc.criterion_id, type: "quantitative_criterion", ...v });
    quantitative_criteria.push({ ...qc, review_status: v.entailed ? "reviewed" : "needs_review" });
  }

  const conditions = [];
  for (const c of draft.conditions) {
    const v = await verifyCondition(c, { sourceUnits, client, model });
    report.push({ id: c.condition_id, type: "condition", ...v });
    conditions.push({ ...c, review_status: v.entailed ? "reviewed" : "needs_review" });
  }

  const summary = {
    total: report.length,
    entailed: report.filter((r) => r.entailed).length,
    needs_review: report.filter((r) => !r.entailed).length
  };

  return { draft: { knowledge_records, quantitative_criteria, conditions }, report, summary };
}

const { extractSection } = require("./extraction_agent");

/**
 * One automatic call: extract, then verify, then finalize review_status.
 * `verifyModel` lets the caller run verification on a different/cheaper
 * model than extraction without touching either agent's internals.
 */
async function extractAndVerifySection({ section, sourceUnits, client, verifyModel }) {
  const draft = await extractSection({ section, sourceUnits, client });
  return verifyDraft(draft, { sourceUnits, client, model: verifyModel });
}

module.exports = { verifyDraft, extractAndVerifySection, sourceTextForUnits };
