/**
 * engine/answer_envelope.js
 * M5 Phase 2 (history/verification/engine_test_record_through_2026-08-28.md Entry 008 / .claude/plans/scalable-
 * floating-elephant.md): a thin, uniform HTTP-ready shape over answer()'s
 * five previously-inconsistent return shapes. Deliberately minimal per
 * the round-2 plan correction — no per-mode nested schema (no
 * `comparison: {doc_groups}` / `amendment: {key_notes}` types): every
 * mode already reduces to the same flat `claims[]` a UI can group or
 * render generically, since Phase 1 made every answer-producing function
 * attach `claims` to its match object before formatting.
 *
 * Mirrors structuredQuery/answerFallback's own control flow directly,
 * rather than wrapping answer()'s already-lossy `text` output — mode
 * isn't recoverable from that string. `prose` is still exactly what
 * answer()/the CLI would show, so the API and CLI can never tell two
 * different stories about the same question.
 */

const { structuredQuery, formatAnswer, answerFallback, explainRefusal, NOT_FOUND } = require("./query_router");
const { presentClaims } = require("./answer_presenter");

const ENVELOPE_VERSION = "2.1.0";

function modeForMatch(match) {
  if (match.isComparison) return "comparison";
  if (match.isAmendment) return "amendment";
  if (match.isDocumentOverview) return "document_overview";
  if (match.isProcess) return "process";
  if (match.isWithinDocumentComparison) return "within_document_comparison";
  if (match.isMultiCriterion) return "multi_criterion";
  if (match.isSectionOverview) return "section_overview";
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

function shouldGenerate(match, preference, generatorClient, verifierClient) {
  if (!generatorClient || !verifierClient || !match.claims || match.claims.length === 0) return false;
  if (preference === "prefer_generated") return true;
  if (preference !== "auto") return false;
  // Section overviews already have an exact hierarchy UI. Direct facts and
  // compact rule sets remain deterministic. Synthesis-heavy modes get a
  // coherent generated answer while keeping the same scoped evidence below.
  return [
    "document_overview",
    "process",
    "within_document_comparison",
    "multi_criterion",
    "list",
    "comparison"
  ].includes(modeForMatch(match));
}

function generatedCoverageIsAdequate(match, generated) {
  const generatedUnits = new Set((generated.claims || []).map((claim) => claim.source_unit_id).filter(Boolean));
  if (match.isDocumentOverview) {
    const expectedSections = new Set((match.claims || [])
      .map((claim) => claim.record && claim.record.section_id).filter(Boolean));
    return generatedUnits.size >= Math.min(3, expectedSections.size);
  }
  if (match.isMultiCriterion) {
    const expectedUnits = new Set((match.claims || []).map((claim) => claim.source_unit_id).filter(Boolean));
    if (generatedUnits.size < Math.min(2, expectedUnits.size)) return false;
  }
  if (!match.isComparison) return true;
  const expectedDocuments = new Set((match.claims || [])
    .map((claim) => claim.record && claim.record.document_id).filter(Boolean));
  const generatedDocuments = new Set((generated.claims || [])
    .map((claim) => claim.record && claim.record.document_id).filter(Boolean));
  return [...expectedDocuments].every((documentId) => generatedDocuments.has(documentId));
}

/**
 * answerEnvelope(question, records, { generatorClient, verifierClient,
 * store, index, signal, fallbackMode }) -> envelope
 *
 * Always returns the same shape:
 *   { envelope_version, answered, mode, route, prose, refusal, claims,
 *     answer_units, review_status, timing_ms }
 *
 * `refusal` is null when answered; otherwise
 *   { kind: "no_match"|"scope_excluded"|"no_candidates"|"model_declined"|"verification_failed"|"no_provider", reason: string|null }
 *
 * `claims` entries are always { record, source_unit_id, citation } — see
 * engine/query_router.js's deriveClaimsFromRecords / answerFallback, and
 * comparison_engine.js/amendment_engine.js's own claim construction.
 * Deliberately no `score`/confidence field anywhere (product_roadmap.md
 * §1.4 — the semantic route is the only sanctioned confidence signal).
 */
async function answerEnvelope(question, records, {
  client,
  generatorClient = client,
  verifierClient = client,
  store,
  index,
  responseLanguage = "ko",
  signal,
  fallbackMode,
  generationPreference = "auto"
} = {}) {
  const start = Date.now();
  const match = structuredQuery(question, records, index);

  if (match) {
    const deterministicMode = modeForMatch(match);
    if (shouldGenerate(match, generationPreference, generatorClient, verifierClient)) {
      const scopedRecords = [...new Map(match.claims
        .filter((claim) => claim.record)
        .map((claim) => [claim.record.id, claim.record])).values()];
      const scopedStore = {
        mode: "structured_claims",
        search: async () => scopedRecords.map((record) => ({ record, score: 100, matched_token_count: 100 }))
      };
      const generated = await answerFallback(question, records, {
        generatorClient,
        verifierClient,
        store: scopedStore,
        responseLanguage,
        signal,
        fallbackMode: "grounded_generation"
      });
      if (generated.answered && generated.route === "grounded_generation" && generatedCoverageIsAdequate(match, generated)) {
        return {
          envelope_version: ENVELOPE_VERSION,
          answered: true,
          mode: "generated",
          semantic_mode: deterministicMode,
          route: "grounded_generation",
          generation_preference: generationPreference,
          prose: generated.text,
          refusal: null,
          claims: generated.claims || [],
          answer_units: generated.answer_units || [],
          scope: match.scope || generated.scope || null,
          coverage: {
            ...(match.coverage || {}),
            generated_claim_count: (generated.claims || []).length,
            generation_scope_limited_to_structured_claims: true
          },
          answer_intent: match.answerIntent || generated.answer_intent || null,
          review_status: generated.review_status,
          timing_ms: Date.now() - start
        };
      }
    }
    return {
      envelope_version: ENVELOPE_VERSION,
      answered: true,
      mode: deterministicMode,
      semantic_mode: deterministicMode,
      route: "structured",
      generation_preference: generationPreference,
      prose: formatAnswer(match),
      refusal: null,
      claims: match.claims || [],
      answer_units: presentClaims(match.claims || [], responseLanguage),
      scope: match.scope || null,
      coverage: match.coverage || null,
      answer_intent: match.answerIntent || null,
      review_status: reviewStatusFor(match),
      timing_ms: Date.now() - start
    };
  }

  if (!store) {
    return {
      envelope_version: ENVELOPE_VERSION,
      answered: false,
      mode: "refusal",
      semantic_mode: "refusal",
      route: "refusal",
      generation_preference: generationPreference,
      prose: NOT_FOUND,
      refusal: { kind: explainRefusal(question, records), reason: null },
      claims: [],
      answer_units: [],
      scope: null,
      coverage: null,
      answer_intent: null,
      review_status: null,
      timing_ms: Date.now() - start
    };
  }

  const result = await answerFallback(question, records, { generatorClient, verifierClient, store, responseLanguage, signal, fallbackMode });
  if (!result.answered) {
    return {
      envelope_version: ENVELOPE_VERSION,
      answered: false,
      mode: "refusal",
      semantic_mode: "refusal",
      route: "refusal",
      generation_preference: generationPreference,
      prose: result.text,
      refusal: { kind: result.refusal_reason || "no_match", reason: result.text === NOT_FOUND ? null : result.text },
      claims: [],
      answer_units: [],
      scope: result.scope || null,
      coverage: result.coverage || null,
      answer_intent: result.answer_intent || null,
      review_status: null,
      timing_ms: Date.now() - start
    };
  }

  return {
    envelope_version: ENVELOPE_VERSION,
    answered: true,
    mode: result.mode || "generated",
    semantic_mode: result.mode || "generated",
    route: result.route,
    generation_preference: generationPreference,
    prose: result.text,
    refusal: null,
    claims: result.claims || [],
    answer_units: result.answer_units || [],
    scope: result.scope || null,
    coverage: result.coverage || null,
    answer_intent: result.answer_intent || null,
    review_status: result.review_status,
    timing_ms: Date.now() - start
  };
}

module.exports = { answerEnvelope, ENVELOPE_VERSION };
