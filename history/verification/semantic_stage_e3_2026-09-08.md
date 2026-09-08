# Semantic overlay Stage E3 verification — 2026-09-08

## Scope

Stage E3 applies `salience_profiles` exposure tiers (`primary`/`supporting`/`detail`) to served coverage disclosure. Narrow scope only: the 7 pre-existing pilot salience_profiles across all 6 documents (`ema_fih` document_overview; `fda_ada` assay_validation and screening_performance; `fda_ada_2014` risk_factors; `ich_m10` run_acceptance; `ich_m3_r2` scope; `ich_s6_r1` scope). Authoring salience for Stage D's 47 newly generated manifests is out of scope (deferred Stage F).

## Change

- `engine/semantic_shadow.js`:
  - Fixed a latent bug in `buildSaliencePlans()`: it never included `target_id` in its returned shape, so `buildShadowPlan()`'s `profilePlan.target_id === documentId` document-level branch always compared `undefined` to a string and was dead code since Stage B (`review_status` was also missing, now included since Stage E0 added the field).
  - `selectServedSalience(overlay, manifest)`: matches a salience_profile to a manifest by exact `target_id` (a bare id, directly comparable to `manifest.target.id`) first, then by facet containment as a fallback — the same pattern `selectServedSummary()` already uses.
  - `buildManifestPlan()` now attaches `salience: selectServedSalience(overlay, manifest)`, unfiltered by review_status (diagnostic, same pattern as summary/manifests).
  - `servedSalience(saliencePlan)` + `buildReviewedSemanticCoverage()`: strips the diagnostic salience down to `null` unless `review_status === "reviewed"`, otherwise groups its items into `{ profile_id, context, primary: [facet_id...], supporting: [...], detail: [...] }` (each tier sorted by `display_order`).
- `web/render.js`: `partitionBySalience()` splits a manifest's disclosed facet list into `visible` (primary/supporting, or unmentioned facets) and `hidden` (detail-tier). `renderSemanticCoverage` renders `hidden` facets inside a `<details class="semantic-coverage-detail">` widget instead of the normal list — salience narrows exposure order, never disclosure itself, so an unmentioned facet stays visible by default.
- `web/i18n.js`: added `semanticCoverageDetailLabel` (ko: "추가 세부 항목", en: "Additional detail").
- `engine/answer_envelope.js`: `ENVELOPE_VERSION` `"2.4.0"` → `"2.5.0"`.
- `test/ko_presentation.test.js`: updated its hardcoded envelope-version literal to `"2.5.0"`.
- `test/engine_semantic_shadow.test.js`: `fullyReviewedStore()` now also forces `salience_profiles` to reviewed. New tests: shadow diagnostic attaches a matched salience_profile regardless of review_status (exact target_id match, ich_m10 run_acceptance); reviewed-manifest-but-unreviewed-salience serves `null`; a reviewed salience_profile groups facets into the correct tiers in display_order; a facet-containment match works for a target_id that doesn't exactly match the manifest (fda_ada screening_performance, exercised via the real served-selector path).
- `test/web_render.test.js`: a detail-tier facet collapses behind the disclosure widget while primary/supporting stay visible; with no salience attached, every facet stays visible and no disclosure widget renders.
- `scripts/run_semantic_stage_e3_audit.js` (new, offline, no LLM call): confirms all 7 existing salience_profiles attach to their intended manifest.
- `scripts/promote_semantic_stage_e3.js` (new): same gate shape as `promote_semantic_stage_e1.js`/`promote_semantic_stage_e2.js` (schema validation, clean offline audit, complete live 50-question audit on contract `2.5.0`, established-16-suitable-case regression guard, explicit review attestation) before flipping any `salience_profile.review_status` to `reviewed`.
- `package.json`: added `audit:semantic:stage-e3`, `promote:semantic:stage-e3`.

## Verification

- `npm.cmd test` — 382/382 passed (376 prior + 6 new).
- `node validation/validate_semantic_overlay.js` — 6 overlays + 3 presentation files pass.
- `node engine/eval_harness.js` — 24/24 passed, citation precision/claim grounding/refusal correctness all 100% (unchanged).
- `node scripts/run_semantic_stage_e3_audit.js` — 7/7 salience_profiles attached to their intended manifest.
- `node scripts/promote_semantic_stage_e3.js` (without a live audit input) — correctly refuses with "Set GUIDELINE_STAGE_E3_LIVE_AUDIT_INPUT...".

## Engineering completion vs. final promotion

Same limitation as Stage E1/E2: no `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` in this environment, so the live 50-question audit `promote_semantic_stage_e3.js` requires cannot be run here. All 7 salience_profiles remain `review_status: "needs_review"`. To complete promotion in an environment with API access: run `node scripts/run_answer_suitability_audit.js` for a fresh raw JSON on contract `2.5.0`, then `GUIDELINE_STAGE_E3_LIVE_AUDIT_INPUT=<path> GUIDELINE_STAGE_E3_AUDIT_REVIEW_ATTESTED=true npm run promote:semantic:stage-e3` after reviewing that audit.

## Stage E summary

Stage E0 (salience `review_status` field), E1 (`summary_specs` structure), E2 (presentation sentence text), and E3 (salience exposure tiers) are all engineering-complete and offline-verified against the narrow pre-existing pilot scope (5 summary_specs, 3 presentation files, 7 salience_profiles). All four sub-stages' data remains `needs_review` pending a live 50-question audit in an environment with LLM API access. Extending authoring to Stage D's 47 newly generated manifests is separate future work (Stage F), not attempted here.
