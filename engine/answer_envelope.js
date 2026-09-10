/**
 * engine/answer_envelope.js
 *
 * answerEnvelope() is the canonical production serving path: it is the only
 * function `engine/server.js`'s `/api/ask` handler calls, so every
 * production-facing safety/quality gate (semantic-coverage gating,
 * generation-skip/coverage-adequacy checks, telemetry, the cross-document
 * ambiguity guard below) belongs here. `engine/query_router.js`'s `answer()`
 * is a separate, lighter entry point used only by the CLI and the legacy
 * gold eval (`npm run eval`) — it calls `structuredQuery`/`answerFallback`
 * directly with no telemetry and none of this file's gates. New
 * production-facing behavior should be added here, not to `answer()`.
 *
 * A uniform HTTP-ready shape over what would otherwise be several
 * inconsistent per-mode return shapes: deliberately minimal, no per-mode
 * nested schema (no `comparison: {doc_groups}` / `amendment: {key_notes}`
 * types) — every mode already reduces to the same flat `claims[]` a UI can
 * group or render generically, since every answer-producing function
 * attaches `claims` to its match object before formatting.
 *
 * Mirrors structuredQuery/answerFallback's own control flow directly,
 * rather than wrapping answer()'s already-lossy `text` output — mode isn't
 * recoverable from that string. `prose` is still exactly what answer()/the
 * CLI would show for the same underlying match, so the API and CLI can
 * never tell two different stories about the same question — though the
 * CLI, lacking this file's gates, can still answer a question this file
 * would refuse or shape differently.
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

function shouldGenerate(match, preference, generatorClient, verifierClient, telemetry) {
  if (!generatorClient || !verifierClient || !match.claims || match.claims.length === 0) return false;
  if (preference === "prefer_generated") return true;
  if (preference !== "auto") return false;
  // Section overviews already have an exact hierarchy UI. Direct facts and
  // compact rule sets remain deterministic. Synthesis-heavy modes get a
  // coherent generated answer while keeping the same scoped evidence below.
  const mode = modeForMatch(match);
  if (!["document_overview", "process", "within_document_comparison", "multi_criterion", "list", "comparison"].includes(mode)) {
    return false;
  }
  // A claim set at exactly this size already satisfies
  // generatedCoverageIsAdequate's own completeness bar below (see
  // isSmallCompleteClaimSet for why this size specifically), so skipping
  // never fails the coverage check a generated candidate would otherwise
  // have to pass. That is a latency/cost argument, not proof that a
  // generated narrative would add no value here.
  if (isSmallCompleteClaimSet(match, mode)) {
    recordTelemetryEvent(telemetry, "generation_skipped_adequate", { mode, expected_unit_count: expectedUnitsOf(match).size });
    return false;
  }
  return true;
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

function expectedUnitsOf(match) {
  return new Set((match.claims || []).map((claim) => claim.source_unit_id).filter(Boolean));
}

/**
 * The deterministic composite is, by construction, the expected unit set
 * for a `multi_criterion`/`list`/`within_document_comparison` match, so it
 * always trivially satisfies `generatedCoverageIsAdequate`'s completeness
 * bar below for these modes (`document_overview`/`comparison` use a
 * different, breadth/distinct-count-based bar, not identity with
 * `match.claims`, so they're excluded here). That guarantees skipping
 * generation never fails this specific coverage check — it does not prove
 * a generated narrative would add no value for the user. `process` is
 * deliberately excluded despite sharing the same generic bar: a pinned
 * regression case ("auto preference synthesizes broad semantic modes...",
 * test/engine_answer_envelope.test.js) shows a real 3-unit process
 * question where narrated sequencing has genuine synthesis value over the
 * same evidence shape. The same could be true for the modes still in
 * scope here and has not been ruled out, only not yet observed — treat
 * this as a latency/cost optimization for a coverage-bar failure mode,
 * not a proven no-value-lost guarantee, and revisit if that turns out to
 * matter for these modes too.
 *
 * The bound is exactly `SMALL_CANDIDATE_SET_CEILING` (3), not a wider
 * range: observed outcomes at 1-2 expected units did not show a decisive,
 * one-sided pattern, so the threshold stays narrow rather than
 * extrapolated from thin evidence. Widen it only with more data. Shared
 * by `shouldGenerate` (skip the call) and `generatedCoverageIsAdequate`
 * (judge the call's result) so both use one identical definition — no
 * drift.
 */
function isSmallCompleteClaimSet(match, mode) {
  if (!["multi_criterion", "list", "within_document_comparison"].includes(mode)) return false;
  const expectedUnits = expectedUnitsOf(match);
  return expectedUnits.size === SMALL_CANDIDATE_SET_CEILING;
}

function generatedCoverageIsAdequate(match, generated) {
  const generatedUnits = new Set((generated.claims || []).map((claim) => claim.source_unit_id).filter(Boolean));
  if (match.isDocumentOverview) {
    const expectedSections = new Set((match.claims || [])
      .map((claim) => claim.record && claim.record.section_id).filter(Boolean));
    return generatedUnits.size >= Math.min(3, expectedSections.size);
  }
  if (match.isMultiCriterion) {
    const expectedUnits = expectedUnitsOf(match);
    if (generatedUnits.size < Math.min(2, expectedUnits.size)) return false;
  }
  if (match.isComparison) {
    const expectedDocuments = new Set((match.claims || [])
      .map((claim) => claim.record && claim.record.document_id).filter(Boolean));
    const generatedDocuments = new Set((generated.claims || [])
      .map((claim) => claim.record && claim.record.document_id).filter(Boolean));
    return [...expectedDocuments].every((documentId) => generatedDocuments.has(documentId));
  }
  if (isSmallCompleteClaimSet(match, modeForMatch(match))) {
    return generatedUnits.size >= expectedUnitsOf(match).size;
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
 *   { kind: "no_match"|"scope_excluded"|"no_candidates"|"generation_not_configured"|
 *     "model_declined"|"language_mismatch"|"verification_failed"|"ambiguous_document_scope",
 *     reason: string|null }
 * `kind` surfaces whichever of `result.refusal_reason`/`result.fallback_reason`
 * `answerFallback` actually set (a `verification_failed` kind may carry a
 * ": <detail>" suffix); `ambiguous_document_scope` is set by this file itself
 * when the cross-document ambiguity guard below fires.
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
    if (shouldGenerate(match, generationPreference, generatorClient, verifierClient, telemetry)) {
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

  // Deterministic routing already found this question ambiguous
  // (routing_ambiguous_tie / routing_list_ambiguous_tie /
  // manifest_ambiguous_tie) and abstained. A fresh, unconstrained fallback
  // search has no memory of that tie -- traced live to two distinct real
  // failure shapes: (a) a same-document tie ("analysts acceptance
  // criteria", tied_document_ids=["fda_ada"]) where the correct records
  // matched only 1 literal keyword and got crowded out by unrelated
  // ich_m10 records that happened to literally contain 2+ generic query
  // words, so fallback confidently cited the wrong document entirely; (b)
  // a genuine multi-document tie where an unconstrained-within-the-tied-
  // set search could just as easily converge on a *single* one of the
  // tied documents by the same kind of accident, silently presenting it
  // with no disclosure that the other tied documents were equally
  // plausible ("days acceptance criteria" mixing fda_ada and ich_m10 was
  // the original observed case of this).
  //
  // Fix: a length-1 tie is resolved (document-wise) by definition -- the
  // router just couldn't pick the record -- so restrict the fallback
  // search to that one document (reusing answerFallback's own
  // requestedDocumentIds gate) and let it resolve the record normally. A
  // length>1 tie is NOT resolved -- nothing downstream should be allowed
  // to silently narrow it to one either, so skip the fallback attempt
  // entirely and disclose all tied documents immediately (cheaper than a
  // wasted LLM call, and strictly safer than judging its output after the
  // fact).
  const tieEvent = telemetry.events.find((event) =>
    ["routing_ambiguous_tie", "routing_list_ambiguous_tie", "manifest_ambiguous_tie"].includes(event.event));
  const tiedDocumentIds = tieEvent ? [...new Set(tieEvent.tied_document_ids || [])] : [];

  function labelForDocument(documentId) {
    const record = records.find((r) => r.document_id === documentId);
    return (record && record.guideline_code) || (record && record.document_title) || documentId;
  }

  if (tiedDocumentIds.length > 1) {
    recordTelemetryEvent(telemetry, "cross_scope_mixing_blocked", { document_ids: tiedDocumentIds });
    return finish({
      envelope_version: ENVELOPE_VERSION,
      answered: false,
      mode: "refusal",
      semantic_mode: "refusal",
      route: "refusal",
      generation_preference: generationPreference,
      prose: NOT_FOUND,
      refusal: { kind: "ambiguous_document_scope", reason: `Matched evidence in multiple documents: ${tiedDocumentIds.map(labelForDocument).join(", ")}. Ask again naming the document you mean.` },
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
    telemetry,
    preferredDocumentIds: tiedDocumentIds.length === 1 ? tiedDocumentIds : null
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
      refusal: { kind: result.refusal_reason || result.fallback_reason || "no_match", reason: result.text === NOT_FOUND ? null : result.text },
      claims: [],
      answer_units: [],
      scope: result.scope || null,
      coverage: result.coverage || null,
      answer_intent: result.answer_intent || null,
      review_status: null
    });
  }

  // Defense in depth, scoped to only when routing actually detected a tie
  // (tieEvent truthy -- by this point always the length-1 case, since
  // length>1 already short-circuited above): the preferredDocumentIds
  // restriction should make it impossible for a length-1 tie's fallback
  // to still span multiple documents, but if it somehow did, disclose
  // rather than silently answer. Deliberately NOT applied when there was
  // no tie event at all -- an ordinary fresh fallback search spanning
  // multiple documents with no router-detected ambiguity to disclose is
  // not this guard's concern (no ambiguity was ever flagged to hide).
  const documentIds = [...new Set((result.claims || [])
    .map((claim) => claim.record && claim.record.document_id).filter(Boolean))];
  if (tieEvent && documentIds.length >= 2 && result.mode !== "comparison") {
    const labels = documentIds.map((documentId) => {
      const claim = (result.claims || []).find((c) => c.record && c.record.document_id === documentId);
      return (claim && claim.citation && claim.citation.guideline_code) || labelForDocument(documentId);
    });
    recordTelemetryEvent(telemetry, "cross_scope_mixing_blocked", { document_ids: documentIds });
    return finish({
      envelope_version: ENVELOPE_VERSION,
      answered: false,
      mode: "refusal",
      semantic_mode: "refusal",
      route: "refusal",
      generation_preference: generationPreference,
      prose: NOT_FOUND,
      refusal: { kind: "ambiguous_document_scope", reason: `Matched evidence in multiple documents: ${labels.join(", ")}. Ask again naming the document you mean.` },
      claims: [],
      answer_units: [],
      scope: result.scope || null,
      coverage: null,
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

module.exports = { answerEnvelope, ENVELOPE_VERSION, safeReviewedSemanticCoverage, shouldGenerate, modeForMatch, isSmallCompleteClaimSet };
