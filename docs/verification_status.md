# Verification Status

This is the active verification summary. Detailed historical measurements are frozen in `history/verification/engine_test_record_through_2026-08-28.md`.

## Current baseline

- Engine version: `0.5.0`
- Unit and integration tests: 223/223 passing as of 2026-08-31
- Pilot validation: 6/6 bundles passing
- Korean presentation validation: 1,131/1,131 entries passing
- Gold evaluation: 24/24 passing as of 2026-08-28
- Citation precision: 100%
- Claim grounding rate: 100%
- Refusal correctness: 100%
- Production dependency audit as of 2026-08-28: 0 known vulnerabilities

## Open verification work

- Run the hardened generative Option B path against two distinct live providers. Current security and behavior coverage uses mocked providers.
- Build representative post-M1 ground truth before re-measuring extraction accuracy for KnowledgeRecord, QuantitativeCriterion, and Condition.

Do not append per-run narratives here. Update this summary only when the current accepted baseline changes; preserve detailed run evidence under `history/verification/`.
