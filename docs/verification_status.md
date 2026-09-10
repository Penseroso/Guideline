# Verification Status

This is the active verification summary. Detailed historical measurements are frozen in `history/verification/engine_test_record_through_2026-08-28.md`.

## Current baseline

- Engine version: `0.6.0`
- Unit and integration tests: 459/459 passing as of 2026-09-10
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
- Production SLO baseline (`docs/production_slo.md`, 2026-09-10): a
  72-question typed corpus (detail/list/overview/process/comparison/
  ambiguous/refusal) ran 72/72 with 0 final errors; 100% answerability,
  claim grounding, and retrieval-groundedness across every type where
  applicable, 18/19 (94.7%) routing-abstention rate for the `ambiguous`
  type, and 100% cross-scope-safe rate (the one known real cross-document
  answer-mixing defect, `ws3_ambiguous_tie.days`, is fixed — see below).
  A new `retrieval_scope_correct_rate` check measured 93.9% (62/66); 4 real,
  unfixed retrieval-quality gaps are documented in `docs/production_slo.md`
  as follow-up. Overall p50/p95/max 7,276/20,007/25,134 ms, 131 LLM calls,
  ~$1.24 total. Reproducible via `npm run audit:production-slo`;
  regression-checked via `npm run audit:production-slo -- --check`
  (passes cleanly as of this baseline).
- Cross-document answer-mixing fix (2026-09-10): `engine/answer_envelope.js`
  now blocks a fallback answer that blends claims from more than one
  document after deterministic routing already flagged a genuine
  ambiguity tie, returning an explicit `ambiguous_document_scope` refusal
  naming the candidate documents instead. Also fixed the same day: the
  envelope's `refusal.kind` previously read only `refusal_reason`,
  silently dropping the richer `fallback_reason` values (`model_declined`,
  `language_mismatch`, `verification_failed: <detail>`,
  `generation_not_configured`) whenever only the latter was set — it now
  surfaces whichever is actually present.
- The Response Intelligence milestone is complete: Workstream 8 (Corpus
  Expansion / Reusability Test) was cancelled by explicit decision, not
  deferred. Full narrative frozen at
  `history/milestones/response_intelligence_2026-09-10.md`.

Do not append per-run narratives here. Update this summary only when the current accepted baseline changes; preserve detailed run evidence under `history/verification/`.
