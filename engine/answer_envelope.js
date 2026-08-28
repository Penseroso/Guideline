/**
 * engine/answer_envelope.js
 * M5 Phase 2 (docs/test_record.md Entry 008 / .claude/plans/scalable-
 * floating-elephant.md): a thin, uniform HTTP-ready shape over answer()'s
 * five previously-inconsistent return shapes. Deliberately minimal per
 * the round-2 plan correction — no per-mode nested schema (no
 * `comparison: {doc_groups}` / `amendment: {key_notes}` types): every
 * mode already reduces to the same flat `claims[]` a UI can group or
 * render generically, since Phase 1 made every answer-producing function
 * attach `claims` to its match object before formatting.
 *
 * Mirrors structuredQuery/answerOptionB's own control flow directly,
 * rather than wrapping answer()'s already-lossy `text` output — mode
 * isn't recoverable from that string. `prose` is still exactly what
 * answer()/the CLI would show, so the API and CLI can never tell two
 * different stories about the same question.
 */

const { structuredQuery, formatAnswer, answerOptionB, explainRefusal, NOT_FOUND } = require("./query_router");
const { presentClaims } = require("./answer_presenter");

const ENVELOPE_VERSION = "1.1.0";

function modeForMatch(match) {
  if (match.isComparison) return "comparison";
  if (match.isAmendment) return "amendment";
  if (match.isListComposite) return "list";
  if (match.isComposite) return "criterion_composite";
  return "structured";
}

function reviewStatusFor(match) {
  if (match.record && match.record.review_status) return match.record.review_status;
  if (match.claims && match.claims.length > 0) {
    return match.claims.some((c) => c.record && c.record.review_status !== "reviewed") ? "needs_review" : "reviewed";
  }
  return "reviewed";
}

/**
 * answerEnvelope(question, records, { generatorClient, verifierClient,
 * store, index, signal, optionBMode }) -> envelope
 *
 * Always returns the same shape:
 *   { envelope_version, answered, mode, path, prose, refusal, claims,
 *     answer_units, review_status, timing_ms }
 *
 * `refusal` is null when answered; otherwise
 *   { kind: "no_match"|"scope_excluded"|"no_candidates"|"model_declined"|"verification_failed"|"no_provider", reason: string|null }
 *
 * `claims` entries are always { record, source_unit_id, citation } — see
 * engine/query_router.js's deriveClaimsFromRecords / answerOptionB, and
 * comparison_engine.js/amendment_engine.js's own claim construction.
 * Deliberately no `score`/confidence field anywhere (product_roadmap.md
 * §1.4 — path A/B is the only sanctioned confidence signal).
 */
async function answerEnvelope(question, records, {
  client,
  generatorClient = client,
  verifierClient = client,
  store,
  index,
  responseLanguage = "ko",
  signal,
  optionBMode
} = {}) {
  const start = Date.now();
  const match = structuredQuery(question, records, index);

  if (match) {
    return {
      envelope_version: ENVELOPE_VERSION,
      answered: true,
      mode: modeForMatch(match),
      path: "A",
      prose: formatAnswer(match),
      refusal: null,
      claims: match.claims || [],
      answer_units: presentClaims(match.claims || [], responseLanguage),
      review_status: reviewStatusFor(match),
      timing_ms: Date.now() - start
    };
  }

  if ((!generatorClient && optionBMode !== "extractive") || !store) {
    return {
      envelope_version: ENVELOPE_VERSION,
      answered: false,
      mode: "refusal",
      path: null,
      prose: NOT_FOUND,
      refusal: { kind: !generatorClient && !store ? "no_provider" : explainRefusal(question, records), reason: null },
      claims: [],
      answer_units: [],
      review_status: null,
      timing_ms: Date.now() - start
    };
  }

  const result = await answerOptionB(question, records, { generatorClient, verifierClient, store, responseLanguage, signal, optionBMode });
  if (!result.answered) {
    return {
      envelope_version: ENVELOPE_VERSION,
      answered: false,
      mode: "refusal",
      path: "B",
      prose: result.text,
      refusal: { kind: result.refusal_reason || "no_match", reason: result.text === NOT_FOUND ? null : result.text },
      claims: [],
      answer_units: [],
      review_status: null,
      timing_ms: Date.now() - start
    };
  }

  return {
    envelope_version: ENVELOPE_VERSION,
    answered: true,
    mode: result.mode || "rag",
    path: "B",
    prose: result.text,
    refusal: null,
    claims: result.claims || [],
    answer_units: result.answer_units || [],
    review_status: result.review_status,
    timing_ms: Date.now() - start
  };
}

module.exports = { answerEnvelope, ENVELOPE_VERSION };
