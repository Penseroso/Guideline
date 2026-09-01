# Verification Status

This is the active verification summary. Detailed historical measurements are frozen in `history/verification/engine_test_record_through_2026-08-28.md`.

## Current baseline

- Engine version: `0.6.0`
- Unit and integration tests: 231/231 passing as of 2026-09-01
- Pilot validation: 6/6 bundles passing
- Korean presentation validation: 1,131/1,131 entries passing
- Gold evaluation: 24/24 passing as of 2026-09-01
- Citation precision: 100%
- Claim grounding rate: 100%
- Refusal correctness: 100%
- Live semantic-route API test: 19/19 passing with an OpenAI same-provider cross-model generator/verifier pair as of 2026-09-01
- Production dependency audit as of 2026-08-28: 0 known vulnerabilities

## Open verification work

- Run the grounded-generation route against two distinct live providers. Same-provider cross-model behavior is now covered live; cross-provider security and behavior coverage remains mocked.
- Build representative post-M1 ground truth before re-measuring extraction accuracy for KnowledgeRecord, QuantitativeCriterion, and Condition.

Do not append per-run narratives here. Update this summary only when the current accepted baseline changes; preserve detailed run evidence under `history/verification/`.
