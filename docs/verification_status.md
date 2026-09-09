# Verification Status

This is the active verification summary. Detailed historical measurements are frozen in `history/verification/engine_test_record_through_2026-08-28.md`.

## Current baseline

- Engine version: `0.6.0`
- Unit and integration tests: 417/417 passing as of 2026-09-09
- Guideline bundle validation (`npm run validate:guidelines`): 6/6 bundles passing
- Korean presentation validation: 2,693/2,693 entries passing
- Korean normalization corpus audit: 1,495/1,495 KnowledgeRecords reviewed, 0 issues
- Semantic overlay validation: 6/6 overlays passing on contract `0.3.0`; 55/55 final unique manifests reviewed and selected in the post-authoring audit
- Semantic presentation (public answer contract `2.5.0`): 50/50 applicable summary_specs have a fresh reviewed Korean presentation entry; 0 explicit facet gaps
- Answer-routing hardening: 55 reviewed + fresh + evidence-bearing manifests are currently eligible; all 220 generated probes (4 per eligible manifest) returned structured, reviewed, cited evidence in the intended document scope. Stale, unreviewed, ambiguous, unrelated, and scope-excluded inputs are tested separately as negative regressions.
- Gold evaluation: 24/24 passing as of 2026-09-09
- Citation precision: 100%
- Claim grounding rate: 100%
- Refusal correctness: 100%
- Live semantic-route API test: 23/23 passing with an OpenAI same-provider cross-model generator/verifier pair as of 2026-09-02
- Live 50-question user-path audit: 50/50 answered envelopes completed with 0 final runtime errors and 0 refusals as of 2026-09-09 (two transient provider failures passed targeted per-question retry). All 16 established suitable cases passed the pre-Workstream-1 production baseline policy: the 6 deterministic cases retained exact claim sets, while the 10 `grounded_generation` cases retained route/mode/`answered`/reviewed grounding; Q25 and Q45 had non-gating stochastic claim-set diagnostics.
- Preliminary request-level latency observation from that run: all questions (n=50) p50 8,945 ms / p95 26,600 ms / max 40,415 ms; structured (n=22) p50 90 ms / p95 23,793 ms / max 28,973 ms; grounded generation (n=28) p50 10,986 ms / p95 26,600 ms / max 40,415 ms. This is not the Workstream 2 stage-level latency/cost baseline.
- Last manually adjudicated answer-suitability snapshot: 16 suitable / 34 partially suitable / 0 unsuitable across 50 Korean broad-to-detail questions. The 2026-09-09 routing run verifies envelope completion and established-case regression, not a new manual suitability adjudication.
- Production dependency audit as of 2026-08-28: 0 known vulnerabilities

Do not append per-run narratives here. Update this summary only when the current accepted baseline changes; preserve detailed run evidence under `history/verification/`.
