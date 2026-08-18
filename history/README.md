# History

This directory holds frozen, superseded planning and process artifacts from the original Phase 0-4 archive-building effort (2026-06-30 to 2026-07-06). They are historical record only — not active plans, not the current source of truth, and not binding on current work.

## Why these were archived

The original project treated this repository as a pure "traceable structured-data archive" with an explicit non-goal on any application layer (search, embeddings, RAG, web application, chatbot). That framing is superseded: the project now targets an actual product (a hallucination-resistant guideline chatbot), and the Phase 3/4 module sequence, non-goal lists, and "not started" framing in these files no longer describe current intent.

The core data layer these documents describe (source model, now `0.3.0`, the 3 fully-reviewed pilot bundles, both validators) is **not** deprecated by this move — it remains active and is referenced from the current root docs. The derived contract scaffold specifically was reassessed later (M1, 2026-08-18) and is now also archived — see "Retired data/tooling" below — since it was never adopted by the actual product build. Only the *planning/process* documents that assumed the old phase sequence and the old non-goal boundary, plus that one unused subsystem, are archived here.

## Files

- `phase3_plan.md`, `phase4_plan.md`, `phase4_handoff_plan.md`, `phase4_module_4_1.md`: superseded module-sequencing plans (Phase 3 complete, Phase 4 stalled at Module 4.1).
- `pilot_scope_S6_R1.md`, `pilot_review_M10.md`, `pilot_review_S6_R1.md`: pilot scoping/review notes for the frozen M10 and S6(R1) pilots. The pilot JSON files themselves remain active under `structured_data/pilots/`.
- `amendment_effective_strategy.md`, `amendment_prototype_S6_R1.md`, `effective_state_prototype_S6_R1.md`, `derived_contract_module_3_6.md`, `derived_layer_validator_module_3_5.md`: Phase 3 derived-layer design notes. The derived contract they describe is still active under `structured_data/schemas/derived/`; these notes are the historical rationale trail, not the current spec.
- `decisions.md` (DEC-001 through DEC-050), `review_log.md` (REV-001 through REV-011): the full pre-2026-08-18 per-decision/per-review governance log, archived when logging switched to `working_docs/milestone_log.md` (one entry per roadmap milestone instead of one per decision/review). Kept in full for historical rationale — not maintained further.

## Retired data/tooling (2026-08-18, M1)

Archived after the M1 build made clear these were never used by the actual chatbot/engine and, per the project's evidence-first policy, were adding maintenance surface without current product value. If any of this is needed again, rebuilding fresh against the live schema (`0.3.0`) is expected to be cheaper than reviving frozen code/data — see `working_docs/milestone_log.md` M1 for the reasoning.

- `m10_phase2_table_pressure.json`, `m10_phase2_reference_condition_pressure.json`: M10 structural-pressure-test pilot bundles (tables, reference-condition patterns) — never fully reviewed content, only schema stress tests. Formerly under `structured_data/pilots/`.
- `s6_r1_amendment_mappings.json`, `s6_r1_effective_records.json`: Phase 3 Module 3.3/3.4 frozen prototypes (AmendmentMapping, EffectiveRecord), human-reviewed under the old REV-005/REV-007/REV-009 process (2026-07-06) — predates this session's agent-verification pipeline and had gone stale relative to the ground-truth recall audit's additions to the same S6(R1) subsections. Formerly under `structured_data/derived/`.
- `validate_legacy_derived.js`: the validator for the two files above. Formerly under `scripts/`.
- `derived_contract_layer/`: the entire "derived contract `0.1.0`" layer (family/edition registry schemas, `validate_derived.js`, its ~60-test suite, and all its fixtures) — paused since the M0 audit and never adopted by the M1 engine. Formerly `structured_data/schemas/derived/`, `scripts/validate_derived.js`, `test/validate_derived.test.js`, `test/fixtures/derived/`, `test/fixtures/derived_contract/`.

## Current source of truth

See root `README.md`, `working_docs/project_scope.md`, and `working_docs/product_roadmap.md` for the active product direction, and `working_docs/milestone_log.md` for the active decision record.
