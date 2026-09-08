# Semantic overlay Stage E1 verification — 2026-09-08

## Scope

Stage E1 activates `summary_specs` structurally — no Korean sentence text yet (Stage E2), only the `facet_ids` order/`sentence_roles` a summary_spec declares, connected to the manifest it describes. Narrow scope only: the 5 pre-existing pilot `summary_specs` (`ema_fih`, `fda_ada`, `fda_ada_2014`, `ich_m3_r2`, `ich_s6_r1`; `ich_m10` has none). Authoring summary_specs for the 47 manifests Stage D added is out of scope (deferred Stage F).

## Change

- `engine/semantic_shadow.js`:
  - `manifestFacetIds(manifest)` factored out (previously inlined in `selectServedManifests`).
  - `selectServedSummary(overlay, manifest)`: matches a summary_spec to a manifest by exact `target` (type+id) first, then by facet containment (all of the summary's `facet_ids` present in the manifest's own coverage-group facets) as a narrower-scope fallback. Ties prefer more facets covered.
  - `buildManifestPlan()` now attaches `summary: selectServedSummary(overlay, manifest)` to every manifest in the Stage B shadow plan, unfiltered by `review_status` (diagnostic, same pattern as everything else here).
  - `servedSummary(summaryPlan)` + `buildReviewedSemanticCoverage()`: strips the diagnostic summary down to `null` unless `review_status === "reviewed"`, otherwise exposes `{ summary_id, summary_kind, facet_ids, sentence_roles, text: null }`.
- `web/render.js`: `orderFacetsBySummary()` reorders a manifest's disclosed facets (including the missing-facet list) by `summary.facet_ids` when a served summary is present; declaration order is unchanged otherwise.
- `engine/answer_envelope.js`: `ENVELOPE_VERSION` `"2.2.0"` → `"2.3.0"` (additive `semantic_coverage.manifests[].summary` field).
- `test/ko_presentation.test.js`: updated its hardcoded envelope-version literal to `"2.3.0"`.
- New tests in `test/engine_semantic_shadow.test.js` (shadow diagnostic carries an unreviewed summary; reviewed-manifest-but-unreviewed-summary is served as `null`; reviewed summary is served with `text: null`; containment match for ich_m3_r2's §1.3-targeted "scope" summary onto the broader §1 "section_1_introduction" manifest) and `test/web_render.test.js` (facet order follows `summary.facet_ids`; falls back to declaration order without a summary).
- `scripts/run_semantic_stage_e1_audit.js` (new, offline, no LLM call): for each of the 5 existing summary_specs, asks a real question through the deterministic engine and confirms `buildReviewedSemanticCoverage` (against a store with everything forced `reviewed`) attaches that summary to its intended manifest.
- `scripts/stage_e_promotion_shared.js` (new): generalizes `promote_semantic_stage_d.js`'s live-audit regression guard (expected envelope version + overridable baseline path) for reuse by every Stage E1/E2/E3 promotion script.
- `scripts/promote_semantic_stage_e1.js` (new): requires schema validation, a clean offline attachment audit, a complete live 50-question audit on contract `2.3.0`, the same established-16-suitable-case regression guard Stage D used, and an explicit review attestation, before flipping any `summary_spec.review_status` from `needs_review` to `reviewed`.
- `package.json`: added `migrate:semantic:v0_3`, `audit:semantic:stage-e1`, `promote:semantic:stage-e1`.

## Verification

- `npm.cmd test` — 368/368 passed (362 prior + 6 new).
- `node validation/validate_semantic_overlay.js` — 6 overlays + 3 presentation files pass.
- `node engine/eval_harness.js` — 24/24 passed, citation precision/claim grounding/refusal correctness all 100% (unchanged).
- `node validation/validate_pilots.js` — 6/6 pilot bundles passed.
- `node scripts/run_semantic_stage_e1_audit.js` — 5/5 summary_specs attached to their intended manifest, including the ich_m3_r2/ich_s6_r1 containment-match case.
- `node scripts/promote_semantic_stage_e1.js` (without a live audit input) — correctly refuses with "Set GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT...".

## Engineering completion vs. final promotion

This environment has no `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, so the live 50-question audit `promote_semantic_stage_e1.js` requires cannot be run here — the same limitation `docs/schema.md`'s Stage D section documents ("If live execution is unavailable, engineering completion and final reviewed promotion remain distinct"). All 5 summary_specs remain `review_status: "needs_review"`. To complete promotion in an environment with API access: run the existing 50-question live audit driver (`node scripts/run_answer_suitability_audit.js`, producing a fresh raw JSON on contract `2.3.0`), then run `GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT=<path> GUIDELINE_STAGE_E1_AUDIT_REVIEW_ATTESTED=true npm run promote:semantic:stage-e1` after reviewing that audit.
