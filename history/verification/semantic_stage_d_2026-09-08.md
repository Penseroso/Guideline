# Semantic overlay Stage D verification — 2026-09-08

## Scope and ordering

Stage D0 preceded all new authoring. It migrated the semantic overlay schema and six overlays from `0.1.0` to `0.2.0`, added explicit facet `coverage_basis`, made `effective` the sole status denominator, and advanced the public answer envelope to `2.2.0`. Existing overlay/manifest regressions were checked before hierarchy expansion.

Stage D authoring was derived from the six core section trees rather than from test questions. The final inventory is 55 de-duplicated manifests: 6 document overviews + 42 substantive parent sections + 5 leaf process/conditional topics + 2 independent specialized manifests. Three of the five pre-existing manifests were absorbed or migrated into those hierarchy categories (EMA FIH document overview, FDA ADA assay validation, FDA 2014 risk factors); M10 run acceptance and FDA ADA screening performance remain separate specialized manifests.

Runtime activation of `summary_specs`, semantic presentation text, and salience profiles was intentionally excluded.

## Verification findings and fixes

- The first all-manifest selector audit exposed parent/child and same-title ambiguity. Served selection now prefers an explicitly named section/topic, then compatible answer intent, then resolved evidence distance; broad shadow candidates remain diagnostic-only.
- Explicit section numbers disambiguate M10's duplicate titles and allow a named S6 Part II section to expose a Part I router miss rather than attaching the wrong manifest.
- Independent topology verification found an ID collision between S6 Part I and Part II `Notes`. Generated Notes facet IDs now include their section path.
- The fresh live audit found that a chapter-level `section_census` ignored records filed directly on the parent section. A parent body is now one census bucket when it exists, preventing cited EMA chapter overviews from being reported as missing.

## Audit and promotion evidence

- Post-authoring audit: 55/55 manifests appeared in shadow diagnostics and 55/55 were selected by the future reviewed selector.
- Deterministic verification: schema/invariants pass, no stale overlays, 55 total/55 unique, all 42 parent direct-child sets match the core hierarchy, all 6 document overview area sets match their declarations, and all 5 leaf member sets resolve to their declared section.
- Live audit: OpenAI `gpt-5.6-terra` generator → `gpt-5.6-sol` verifier, 50/50 valid responses, answer contract `2.2.0` throughout. Two transient provider failures (Q21/Q31) succeeded on targeted retry.
- Regression guard: all 16 previously suitable cases retained identical route, mode, and claim IDs. The 12 envelopes whose route or claim set varied were reviewed against their per-question minimum contracts; no new unsuitable response was found. Final result remained 16 suitable / 34 partially suitable / 0 unsuitable.
- Promotion: `promote_semantic_stage_d.js` required deterministic completion, the complete live audit, the exact 16-case regression guard, and explicit remaining-set review attestation. It promoted the Stage D facet/manifest/comparison-binding objects; the final 55 manifests are reviewed.

If the live audit cannot be executed in another environment, `verify:semantic:stage-d` may still report engineering completion, but final reviewed promotion must remain pending.

## Final validation commands

- `npm.cmd test` — 361/361 passed.
- `node validation/validate_structured_data.js <six pilot files>` — 6/6 bundles passed.
- `node validation/validate_pilots.js` — 6/6 pilot bundles passed.
- `node validation/validate_ko_presentation.js` — 2,484/2,484 entries passed.
- `node scripts/audit_ko_normalization.js` — 1,353 reviewed KnowledgeRecords, 0 issues.
- `node validation/validate_semantic_overlay.js` — 6 semantic overlays and 3 semantic presentation files passed.
- `node engine/eval_harness.js` — 24/24 passed; citation precision, claim grounding, and refusal correctness all 100%.
- `node scripts/run_semantic_stage_d_audit.js` — shadow 55/55, served selector 55/55.
- `node scripts/verify_semantic_stage_d.js` with the live audit input — engineering completion complete, final reviewed promotion eligible.
