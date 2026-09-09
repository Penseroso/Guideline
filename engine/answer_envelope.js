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
const { buildReviewedSemanticCoverage } = require("./semantic_routing");
const { createAnswerTelemetry, finalizeTelemetry, measureSync, recordTelemetryEvent } = require("./answer_telemetry");

const ENVELOPE_VERSION = "2.6.0";

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

/**
 * envelope.semantic_coverage is best-effort disclosure, never load-bearing:
 * a bug or unexpected shape in the derived-layer read path must never turn
 * into a failed or degraded answer for a question that would otherwise have
 * succeeded. Every caller of answerEnvelope gets this safety for free,
 * rather than each one (server.js, cli.js, eval_harness.js) needing its own
 * try/catch.
 */
function safeReviewedSemanticCoverage(question, envelope) {
  try {
    return buildReviewedSemanticCoverage(question, envelope);
  } catch (error) {
    console.error("[semantic-coverage] failed, omitting from envelope:", error.stack || error.message || error);
    return null;
  }
}

function semanticCoverageSupportsRouting(match, semanticCoverage) {
  if (!match || !match.routingManifestId) return true;
  const manifest = semanticCoverage && (semanticCoverage.manifests || [])
    .find((item) => item.manifest_id === match.routingManifestId);
  if (!manifest) return false;
  const facets = (manifest.groups || []).flatMap((group) => group.facets || []);
  const surfacedIds = new Set(facets.map((facet) => facet.facet_id));
  if (!(match.routingFacetIds || []).every((id) => surfacedIds.has(id))) return false;
  return facets.some((facet) => facet.effective && facet.effective.covered > 0);
}

// A candidate set this small has little room for the model to legitimately
// treat one as redundant. A real regression case: the router retrieved
// exactly 3 candidates (including the source's own stated quantitative-
// risk-assessment limitation), the model silently narrated only 2, and
// nothing caught it since none of the three shape checks below
// (document_overview/multi_criterion/comparison) applied to this plain
// narrow-topic question. A large candidate set can genuinely have
// overlapping/redundant excerpts worth consolidating, so this floor only
// applies below a small fixed ceiling, not to every question.
const SMALL_CANDIDATE_SET_CEILING = 3;

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
  if (match.isComparison) {
    const expectedDocuments = new Set((match.claims || [])
      .map((claim) => claim.record && claim.record.document_id).filter(Boolean));
    const generatedDocuments = new Set((generated.claims || [])
      .map((claim) => claim.record && claim.record.document_id).filter(Boolean));
    return [...expectedDocuments].every((documentId) => generatedDocuments.has(documentId));
  }
  const expectedUnits = new Set((match.claims || []).map((claim) => claim.source_unit_id).filter(Boolean));
  if (expectedUnits.size > 0 && expectedUnits.size <= SMALL_CANDIDATE_SET_CEILING) {
    return generatedUnits.size >= expectedUnits.size;
  }
  return true;
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
  const telemetry = createAnswerTelemetry();
  const finish = (envelope) => {
    const finalized = finalizeTelemetry(telemetry);
    envelope.timing_ms = Math.round(finalized.total_ms);
    envelope.telemetry = finalized;
    return envelope;
  };
  let match = measureSync(telemetry, "routing", () => structuredQuery(question, records, index, { telemetry }));
  let structuredSemanticCoverage = null;

  // A manifest-backed partial broad answer is only valid when its complete
  // applicable facet set can be disclosed and at least one of those facets
  // is grounded by the selected claims. This prevents a coincidental single
  // record hit from masquerading as a broad answer.
  if (match && match.routingManifestId) {
    const deterministicMode = modeForMatch(match);
    structuredSemanticCoverage = measureSync(telemetry, "routing", () => safeReviewedSemanticCoverage(question, {
      mode: deterministicMode,
      semantic_mode: deterministicMode,
      claims: match.claims || [],
      scope: match.scope || null,
      answer_intent: match.answerIntent || null
    }));
    if (!semanticCoverageSupportsRouting(match, structuredSemanticCoverage)) {
      recordTelemetryEvent(telemetry, "structured_routing_rejected", { reason: "semantic_coverage_inadequate" });
      match = null;
    }
  }

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
        fallbackMode: "grounded_generation",
        telemetry
      });
      if (generated.answered && generated.route === "grounded_generation" && generatedCoverageIsAdequate(match, generated)) {
        const envelope = {
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
          review_status: generated.review_status
        };
        // Disclosure-only for the grounded_generation synthesis box — this
        // never changes `prose`, `claims`, or the structured citation
        // contract below it, and only ever reflects `reviewed`, non-stale
        // manifests (see docs/derived_semantic_layer.md §10).
        envelope.semantic_coverage = measureSync(telemetry, "presentation", () => safeReviewedSemanticCoverage(question, envelope));
        if (semanticCoverageSupportsRouting(match, envelope.semantic_coverage)) return finish(envelope);
        recordTelemetryEvent(telemetry, "generated_answer_rejected", { reason: "semantic_coverage_inadequate" });
      } else if (generated.answered && generated.route === "grounded_generation") {
        recordTelemetryEvent(telemetry, "generated_answer_rejected", { reason: "generated_coverage_inadequate" });
      } else {
        recordTelemetryEvent(telemetry, "generated_answer_rejected", {
          reason: generated.fallback_reason || generated.refusal_reason || generated.route || "fallback"
        });
      }
    }
    const structuredEnvelope = measureSync(telemetry, "presentation", () => ({
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
        review_status: reviewStatusFor(match)
      }));
    // Also computed for the structured route: several reviewed manifests
    // are most often exercised here, not on grounded_generation (e.g.
    // ich_m10's run_acceptance branch comes back as route:"structured",
    // mode:"multi_criterion"). Same disclosure-only contract as the
    // grounded_generation branch above: never touches `prose`/`claims`/
    // citations, best-effort, swallowed on failure.
    if (!structuredSemanticCoverage) {
      structuredEnvelope.semantic_coverage = measureSync(telemetry, "presentation", () => safeReviewedSemanticCoverage(question, structuredEnvelope));
    } else {
      structuredEnvelope.semantic_coverage = structuredSemanticCoverage;
    }
    return finish(structuredEnvelope);
  }

  if (!store) {
    const refusalKind = measureSync(telemetry, "routing", () => explainRefusal(question, records));
    return finish({
      envelope_version: ENVELOPE_VERSION,
      answered: false,
      mode: "refusal",
      semantic_mode: "refusal",
      route: "refusal",
      generation_preference: generationPreference,
      prose: NOT_FOUND,
      refusal: { kind: refusalKind, reason: null },
      claims: [],
      answer_units: [],
      scope: null,
      coverage: null,
      answer_intent: null,
      review_status: null
    });
  }

  const result = await answerFallback(question, records, {
    generatorClient,
    verifierClient,
    store,
    responseLanguage,
    signal,
    fallbackMode,
    telemetry
  });
  if (!result.answered) {
    return finish({
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
      review_status: null
    });
  }

  return finish({
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
    review_status: result.review_status
  });
}

module.exports = { answerEnvelope, ENVELOPE_VERSION, safeReviewedSemanticCoverage };
