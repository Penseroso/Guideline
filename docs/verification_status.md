# Verification Status

This is the active verification summary. Detailed historical measurements are frozen in `history/verification/engine_test_record_through_2026-08-28.md`.

## Current baseline

- Engine version: `0.6.0`
- Unit and integration tests: 464/464 passing as of 2026-09-10
- Guideline bundle validation (`npm run validate:guidelines`): 6/6 bundles passing
- Korean presentation validation: 2,693/2,693 entries passing
- Korean normalization corpus audit: 1,495/1,495 KnowledgeRecords reviewed, 0 issues
- Semantic overlay validation: 6/6 overlays passing on contract `0.3.0`; 55/55 final unique manifests reviewed and selected in the post-authoring audit
- Semantic presentation (public answer contract `2.6.0`): 50/50 applicable summary_specs have a fresh reviewed Korean presentation entry; 0 explicit facet gaps
- Answer-routing hardening: 55 reviewed + fresh + evidence-bearing manifests are currently eligible; all 220 generated probes (4 per eligible manifest) returned structured, reviewed, cited evidence in the intended document scope. Stale, unreviewed, ambiguous, unrelated, and scope-excluded inputs are tested separately as negative regressions.
- Gold evaluation: 24/24 passing as of 2026-09-09
- Citation precision: 100%
- Claim grounding rate: 100%
- Refusal correctness: 100%
- Live semantic-route API test: 23/23 passing with an OpenAI same-provider cross-model generator/verifier pair as of 2026-09-02
- Live 50-question user-path audit: 50/50 answered envelopes completed with 0 final runtime errors and 0 refusals as of 2026-09-09 (two transient provider failures passed targeted per-question retry). All 16 established suitable cases passed the pre-Workstream-1 production baseline policy: the 6 deterministic cases retained exact claim sets, while the 10 `grounded_generation` cases retained route/mode/`answered`/reviewed grounding; Q25 and Q45 had non-gating stochastic claim-set diagnostics.
- Workstream 2 production-path baseline: 50/50 completed with 0 runtime errors; all-question p50/p95/max 8,075/30,087/35,446 ms; structured (n=23) 1,891/30,087/35,446 ms; grounded generation (n=26) 9,980/23,388/34,379 ms; one source-excerpts fallback 18,537 ms. The run made 94 LLM calls, used 165,901 tokens, and has an estimated USD 1.0107562 cost under the frozen 2026-09-09 price snapshot.
- Structured-tail diagnosis: the full baseline had 12/23 final structured answers that attempted generation/verification before deterministic fallback (30 calls total), versus 11 deterministic-only structured answers. In the event-level tail rerun, deterministic-only structured measured p50 15 ms / p95 66 ms and LLM-attempt-then-structured-fallback measured p50 11,043 ms / p95 24,741 ms. Verification failure/retry, language retry, model decline, and generated facet-coverage rejection account for the tail; routing/retrieval/presentation do not. Detailed evidence: `history/verification/response_intelligence_workstream_2_2026-09-09.md`.
- Last manually adjudicated answer-suitability snapshot: 16 suitable / 34 partially suitable / 0 unsuitable across 50 Korean broad-to-detail questions. The 2026-09-09 routing run verifies envelope completion and established-case regression, not a new manual suitability adjudication.
- Production dependency audit as of 2026-08-28: 0 known vulnerabilities
- Production SLO baseline (`docs/production_slo.md`, final rerun
  2026-09-10): a 72-question typed corpus (detail/list/overview/process/
  comparison/ambiguous/refusal) ran 72/72 with 0 final errors; 100%
  answerability, claim grounding, and retrieval-groundedness across every
  type where applicable, 18/19 (94.7%) routing-abstention rate for the
  `ambiguous` type, and 100% cross-scope-safe rate. `retrieval_scope_correct_rate`
  measured **98.5% (67/68)**, up from 93.9% (62/66) on the prior baseline
  — all four previously-tracked gaps (`fifty_q_Q11`, `fifty_q_Q22`,
  `fifty_q_Q25`, `ws3_ambiguous_tie.analysts`) are fixed deterministically
  (document-identity resolution, document-ranking specificity, an eval-
  corpus annotation correction, and router→fallback tie propagation,
  respectively — see `docs/production_slo.md`); one new real gap,
  `fifty_q_Q23`, surfaced and is documented there as open follow-up.
  Overall p50/p95/max 8,315/27,694/46,229 ms, 138 LLM calls, ~$1.38 total.
  Reproducible via `npm run audit:production-slo`; regression-checked via
  `npm run audit:production-slo -- --check` (passes cleanly as of this
  baseline).
- Cross-document answer-mixing fix: `engine/answer_envelope.js`/
  `engine/query_router.js` now propagate a same-document routing tie into
  `answerFallback` as a document restriction (surviving its own internal
  repair-retry), and refuse immediately with every candidate disclosed
  when a tie spans more than one document — a genuine multi-document
  ambiguity is never silently narrowed to one candidate. Also fixed: the
  envelope's `refusal.kind` previously read only `refusal_reason`,
  silently dropping the richer `fallback_reason` values (`model_declined`,
  `language_mismatch`, `verification_failed: <detail>`,
  `generation_not_configured`) whenever only the latter was set — it now
  surfaces whichever is actually present.
- Document-resolution fixes for the two remaining retrieval-scope gaps: a
  bare "ADA" mention with no competing topic/assay/molecule scope now
  resolves to the ADA document family at document-identity resolution
  (`engine/query_router.js`'s `resolveRequestedDocumentIds`), and
  `tryCoverageCompositeQuery`'s document-ranking tie-break now uses a
  section-deduped `aggregate` so a document with many records about one
  narrow point no longer outranks one with fewer but more topically
  distributed records. Both verified against the full 220-probe/24-
  question/464-test corpus with zero regressions before landing; a global
  `scoreRecord` IDF-weighting alternative was evaluated and rejected for
  causing real regressions elsewhere in the corpus.
- The Response Intelligence milestone is complete: Workstream 8 (Corpus
  Expansion / Reusability Test) was cancelled by explicit decision, not
  deferred. Full narrative frozen at
  `history/milestones/response_intelligence_2026-09-10.md`.

Do not append per-run narratives here. Update this summary only when the current accepted baseline changes; preserve detailed run evidence under `history/verification/`.
