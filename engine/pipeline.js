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

const { extractSection, nextId } = require("./extraction_agent");

/**
 * One automatic call: extract, then verify, then finalize review_status.
 * `verifyModel` lets the caller run verification on a different/cheaper
 * model than extraction without touching either agent's internals.
 */
async function extractAndVerifySection({ section, sourceUnits, client, verifyModel }) {
  const draft = await extractSection({ section, sourceUnits, client });
  return verifyDraft(draft, { sourceUnits, client, model: verifyModel });
}

// --- Self-consistency: multiple extraction passes, merged by content ---
//
// Real, measured run-to-run variance on identical input (same section,
// same prompt, different counts — working_docs/milestone_log.md M1) is
// exploited here rather than just tolerated: run extraction N times and
// take the union, deduped by content fingerprint, instead of trusting
// any single pass. This is the field's standard answer to LLM extraction
// recall (GraphRAG "gleanings", self-consistency sampling) — verified
// entailment (verifyDraft) still runs afterward on the merged result;
// self-consistency addresses *recall*, which entailment checking cannot
// (a record that was never drafted has nothing to verify).
//
// Cross-references between drafted objects (QuantitativeCriterion.knowledge_record_id/
// condition_ids, Condition.applies_to_ids) are dropped during merge, not
// remapped — after deduping across N independently-numbered passes, a
// stale intra-pass link would point to an ID that may not exist in the
// merged set. A dangling reference is worse than an empty one, so these
// come back null/empty and `needs_review`-worthy for later re-linking.
// This is a scoped simplification, not an oversight: proving the merge
// improves raw recall was the immediate goal, not a perfect graph.

function normalizeText(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function qcFingerprint(qc) {
  const val = qc.value_fraction ? `${qc.value_fraction.numerator}/${qc.value_fraction.denominator}` : qc.value;
  return `${qc.source_unit_id}|${qc.comparator}|${val}|${qc.unit || ""}`;
}

function conditionFingerprint(c) {
  return `${c.source_unit_id}|${c.condition_type}|${normalizeText(c.condition_text).slice(0, 40)}`;
}

function krFingerprint(kr) {
  return `${[...kr.source_unit_ids].sort().join(",")}|${kr.record_type}|${kr.modality}|${normalizeText(kr.action).slice(0, 40)}`;
}

function groupByFingerprint(items, fingerprintFn) {
  const groups = new Map();
  for (const item of items) {
    const fp = fingerprintFn(item);
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp).push(item);
  }
  return [...groups.values()].map((group) => ({ item: group[0], agreementCount: group.length }));
}

function mergeExtractionPasses(drafts, { documentId, sectionNumber }) {
  const allKR = drafts.flatMap((d) => d.knowledge_records);
  const allQC = drafts.flatMap((d) => d.quantitative_criteria);
  const allCond = drafts.flatMap((d) => d.conditions);

  const krGroups = groupByFingerprint(allKR, krFingerprint);
  const qcGroups = groupByFingerprint(allQC, qcFingerprint);
  const condGroups = groupByFingerprint(allCond, conditionFingerprint);

  const knowledge_records = krGroups.map(({ item, agreementCount }, i) => ({
    ...item,
    knowledge_record_id: nextId(documentId, "kr", sectionNumber, i + 1),
    review_status: "needs_review",
    _agreementCount: agreementCount
  }));
  const quantitative_criteria = qcGroups.map(({ item, agreementCount }, i) => ({
    ...item,
    criterion_id: nextId(documentId, "qc", sectionNumber, i + 1),
    knowledge_record_id: null,
    condition_ids: [],
    review_status: "needs_review",
    _agreementCount: agreementCount
  }));
  const conditions = condGroups.map(({ item, agreementCount }, i) => ({
    ...item,
    condition_id: nextId(documentId, "cond", sectionNumber, i + 1),
    applies_to_ids: [],
    review_status: "needs_review",
    _agreementCount: agreementCount
  }));

  const agreement = {
    knowledge_records: knowledge_records.map((r) => ({ id: r.knowledge_record_id, agreementCount: r._agreementCount, ofPasses: drafts.length })),
    quantitative_criteria: quantitative_criteria.map((r) => ({ id: r.criterion_id, agreementCount: r._agreementCount, ofPasses: drafts.length })),
    conditions: conditions.map((r) => ({ id: r.condition_id, agreementCount: r._agreementCount, ofPasses: drafts.length }))
  };

  // Strip the temporary bookkeeping field so returned records stay valid
  // against the closed archive JSON Schema (additionalProperties: false).
  const strip = (r) => { const { _agreementCount, ...rest } = r; return rest; };
  return {
    draft: {
      knowledge_records: knowledge_records.map(strip),
      quantitative_criteria: quantitative_criteria.map(strip),
      conditions: conditions.map(strip)
    },
    agreement
  };
}

/**
 * Runs extraction `passes` times and merges by content fingerprint
 * before handing off to verifyDraft. Cost scales linearly with `passes`
 * (each is a full extraction call) — call sites should treat `passes`
 * as a real cost/recall trade-off, not a free win.
 */
async function extractSectionSelfConsistent({ section, sourceUnits, client, passes = 3, verifyModel }) {
  const drafts = [];
  for (let i = 0; i < passes; i++) {
    drafts.push(await extractSection({ section, sourceUnits, client }));
  }
  const { draft: merged, agreement } = mergeExtractionPasses(drafts, {
    documentId: section.document_id,
    sectionNumber: section.section_number
  });
  const verified = await verifyDraft(merged, { sourceUnits, client, model: verifyModel });
  return { ...verified, agreement, passes };
}

// --- Ensemble verification: require repeated agreement before "reviewed" ---
//
// A single entailment call was directly shown to have a false-negative
// mode (working_docs/milestone_log.md M1: the range-vs-requirement
// distortion passed as entailed=true on the first pipeline run). This
// does not replace that fix (the claimTextFor phrasing fix stands); it
// adds a second, independent layer: call verifyClaim `times` times and
// require *all* calls to agree entailed=true before trusting it.
// Disagreement is treated as needs_review, not averaged into a pass —
// the conservative failure mode (see product_roadmap.md TPP §1.3).
async function verifyClaimEnsemble({ claim, sourceText, client, model, times = 2 }) {
  const results = [];
  for (let i = 0; i < times; i++) {
    results.push(await verifyClaim({ claim, sourceText, client, model }));
  }
  const allEntailed = results.every((r) => r.entailed);
  return {
    entailed: allEntailed,
    reason: allEntailed ? results[0].reason : results.filter((r) => !r.entailed).map((r) => r.reason).join(" | "),
    agreement: results.filter((r) => r.entailed).length,
    of: times
  };
}

module.exports = {
  verifyDraft,
  extractAndVerifySection,
  sourceTextForUnits,
  mergeExtractionPasses,
  extractSectionSelfConsistent,
  verifyClaimEnsemble,
  qcFingerprint,
  conditionFingerprint,
  krFingerprint
};
