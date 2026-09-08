# Verification Status

This is the active verification summary. Detailed historical measurements are frozen in `history/verification/engine_test_record_through_2026-08-28.md`.

## Current baseline

- Engine version: `0.6.0`
- Unit and integration tests: 404/404 passing as of 2026-09-08
- Guideline bundle validation (`npm run validate:guidelines`): 6/6 bundles passing
- Korean presentation validation: 2,693/2,693 entries passing
- Korean normalization corpus audit: 1,495/1,495 KnowledgeRecords reviewed, 0 issues
- Semantic overlay validation: 6/6 overlays passing on contract `0.3.0`; 55/55 final unique manifests reviewed and selected in the post-authoring audit
- Semantic presentation (Stage G, public answer contract `2.5.0`): 50/50 applicable summary_specs have a fresh reviewed Korean presentation entry; 0 explicit facet gaps (the 13 S6(R1) gaps recorded at Stage G completion were closed by a later structured-evidence backfill)
- Gold evaluation: 24/24 passing as of 2026-09-02
- Citation precision: 100%
- Claim grounding rate: 100%
- Refusal correctness: 100%
- Live semantic-route API test: 23/23 passing with an OpenAI same-provider cross-model generator/verifier pair as of 2026-09-02
- Live 50-question user-path audit: 50/50 valid envelopes completed with 0 final runtime errors as of 2026-09-08 (two transient provider failures passed targeted retry); the public answer contract has since advanced to `2.5.0` — see `history/verification/semantic_stage_g_2026-09-08.md` for the latest post-activation live-audit record on that contract
- Answer-suitability audit after Stage D: 16 suitable / 34 partially suitable / 0 unsuitable across 50 Korean broad-to-detail questions; all 16 established suitable cases have retained route, mode, and (for the 6 deterministic cases) identical claim IDs through every later Stage E/F/G promotion — see `scripts/stage_e_promotion_shared.js`'s route-keyed regression policy for the 10 `grounded_generation` cases, whose claim *selection* is not required to be reproducible run-to-run
- Production dependency audit as of 2026-08-28: 0 known vulnerabilities

## Open verification work

- Run the grounded-generation route against two distinct live providers. Same-provider cross-model behavior is now covered live; cross-provider security and behavior coverage remains mocked.
- Build representative post-M1 ground truth before re-measuring extraction accuracy for KnowledgeRecord, QuantitativeCriterion, and Condition.

Do not append per-run narratives here. Update this summary only when the current accepted baseline changes; preserve detailed run evidence under `history/verification/`.
