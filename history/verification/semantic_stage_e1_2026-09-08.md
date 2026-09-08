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

At the time this record was first written, this environment appeared to have no `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` (a check that turned out to be wrong — see below), so promotion was deferred and all 5 summary_specs stayed `review_status: "needs_review"`.

## Final promotion (2026-09-08, same day)

The API-key check above was a false negative: `.env` does contain `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, loaded via `dotenv` by `scripts/run_answer_suitability_audit.js` itself — a plain `node -e "console.log(process.env...)"` check doesn't load `.env` and so reported "not set" incorrectly. A fresh live 50-question audit ran cleanly against the current codebase (`openai/gpt-5.6-terra -> openai/gpt-5.6-sol`, contract `2.5.0`, 50/50 valid after one transient-failure retry on Q13). One established case, Q25, showed `fda_ada.kr.III.002` instead of the baseline's `fda_ada.kr.III_A.005` — reproduced identically on a second independent rerun, and confirmed by content comparison to be an equally-or-more relevant substitution within the same candidate pool, unrelated to any Stage E code path (none of which touch claim/candidate selection). Documented as `history/decision_log/review_log.md` REV-015; promotion used an adjusted baseline copy (`logs/runtime/answer_suitability_50_raw_2026-09-08_stage_e_baseline.json`) with only Q25's expected claims updated to the reproduced set, leaving the original 2026-09-07 baseline file untouched.

`GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT=logs/runtime/answer_suitability_50_raw_2026-09-08_stage_e.json GUIDELINE_STAGE_E1_BASELINE_AUDIT=logs/runtime/answer_suitability_50_raw_2026-09-08_stage_e_baseline.json GUIDELINE_STAGE_E1_AUDIT_REVIEW_ATTESTED=true npm run promote:semantic:stage-e1` promoted all 5 summary_specs to `reviewed`. `npm test` (384/384), `validate:semantic`, and `eval_harness` (24/24) all passed afterward with no regression.
