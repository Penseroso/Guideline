# Semantic overlay Stage E2 verification — 2026-09-08

## Scope

Stage E2 fills in the Korean sentence text Stage E1 left as `text: null`. Narrow scope only: the 3 existing presentation files (`ema_fih`, `ich_m3_r2`, `ich_s6_r1`). `fda_ada` and `fda_ada_2014` have a `summary_spec` (from the pre-existing pilot scope) but no presentation file — that gap is deliberately not authored here (deferred to Stage F) and shows up as an expected `text: null`, not a bug.

## Change

- `validation/validate_semantic_overlay.js`: exported `recordSourceText` (previously internal) so `engine/semantic_overlay_store.js` can reuse the exact same evidence-freshness computation instead of a second implementation.
- `engine/semantic_overlay_store.js`: `presentationEntryIsFresh(archive, entry)` + `evidenceRefIsFresh(archive, ref)` now filter `data/derived/presentation/ko/*.json` at load time. An entry with any stale or unresolvable `evidence_refs` is dropped whole — not truncated to its still-fresh units — since a "scope" entry silently missing its own exception/boundary sentence could read as broader than the source actually supports. Previously this directory loaded with no freshness check at all (only the validator caught staleness, at authoring time).
- `engine/semantic_shadow.js`:
  - `orderedPresentationText(sentenceRoles, units)`: orders a presentation entry's units by the summary_spec's own `sentence_roles`, not the entry's storage order.
  - `presentationTextFor(summaryPlan, documentId, semanticStore)`: finds the presentation entry sharing the summary_spec's `summary_id` as its own `semantic_id`; requires that entry's own `review_status === "reviewed"` (independent of the summary_spec's review_status — a structurally-approved summary can still show no prose if the sentences themselves haven't been reviewed).
  - `servedSummary()` now calls `presentationTextFor()` instead of always returning `text: null`.
- `web/render.js`: `renderCuratedOverview(envelope, i18n)` renders the first served manifest's non-empty `summary.text` as a `curated-overview` box, inserted directly under `renderSectionOverviewLayout`'s intro header — separate from the existing per-group `synopsisText()` raw-record excerpt (docs §9: a presentation summary and `normalized_ko` are never each other's substitute). Renders nothing when no served summary has text.
- `web/i18n.js`: added `curatedOverviewTitle` (ko: "개요", en: "Overview").
- `engine/answer_envelope.js`: `ENVELOPE_VERSION` `"2.3.0"` → `"2.4.0"`.
- `test/ko_presentation.test.js`: updated its hardcoded envelope-version literal to `"2.4.0"`.
- New tests:
  - `test/engine_semantic_overlay_store.test.js` (new file): a presentation entry with fresh evidence loads unchanged; a stale unit drops the whole entry; an unresolvable `record_id` drops the whole entry.
  - `test/engine_semantic_shadow.test.js`: presentation text renders once both the summary_spec and its presentation entry are reviewed; text ordering follows `sentence_roles`, not storage order (verified by reversing storage order and confirming output order is unaffected); a document with a reviewed summary_spec but no presentation file serves `text: null`.
  - `test/web_render.test.js`: the curated overview box renders when a served summary has text; it renders nothing when absent.
- `scripts/run_semantic_stage_e2_audit.js` (new, offline, no LLM call): confirms all 3 existing presentation files render in their summary_spec's declared sentence-role order.
- `scripts/promote_semantic_stage_e2.js` (new): same gate shape as `promote_semantic_stage_e1.js` (schema validation, clean offline audit, complete live 50-question audit on contract `2.4.0`, established-16-suitable-case regression guard, explicit review attestation) before flipping any presentation entry's `review_status` to `reviewed`.
- `package.json`: added `audit:semantic:stage-e2`, `promote:semantic:stage-e2`.

## Verification

- `npm.cmd test` — 376/376 passed (368 prior + 8 new).
- `node validation/validate_semantic_overlay.js` — 6 overlays + 3 presentation files pass.
- `node validation/validate_pilots.js` — 6/6 pilot bundles passed.
- `node engine/eval_harness.js` — 24/24 passed, citation precision/claim grounding/refusal correctness all 100% (unchanged).
- `node scripts/run_semantic_stage_e2_audit.js` — 3/3 presentation entries render in the correct sentence-role order.
- `node scripts/promote_semantic_stage_e2.js` (without a live audit input) — correctly refuses with "Set GUIDELINE_STAGE_E2_LIVE_AUDIT_INPUT...".

## Engineering completion vs. final promotion

Same limitation as Stage E1: no `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` in this environment, so the live 50-question audit `promote_semantic_stage_e2.js` requires cannot be run here. All 3 presentation entries remain `review_status: "needs_review"`. To complete promotion in an environment with API access: run `node scripts/run_answer_suitability_audit.js` for a fresh raw JSON on contract `2.4.0`, then `GUIDELINE_STAGE_E2_LIVE_AUDIT_INPUT=<path> GUIDELINE_STAGE_E2_AUDIT_REVIEW_ATTESTED=true npm run promote:semantic:stage-e2` after reviewing that audit.
