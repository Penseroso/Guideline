# History

This directory holds frozen, superseded planning and process artifacts from the original Phase 0-4 archive-building effort (2026-06-30 to 2026-07-06). They are historical record only — not active plans, not the current source of truth, and not binding on current work.

## Why these were archived

The original project treated this repository as a pure "traceable structured-data archive" with an explicit non-goal on any application layer (search, embeddings, RAG, web application, chatbot). That framing is superseded: the project now targets an actual product (a hallucination-resistant guideline chatbot), and the Phase 3/4 module sequence, non-goal lists, and "not started" framing in these files no longer describe current intent.

The underlying data layer these documents describe (source model `0.2.0`, the derived contract scaffold, the validators) is **not** deprecated by this move — it remains active and is referenced from the current root docs. Only the *planning/process* documents that assumed the old phase sequence and the old non-goal boundary are archived here.

## Files

- `phase3_plan.md`, `phase4_plan.md`, `phase4_handoff_plan.md`, `phase4_module_4_1.md`: superseded module-sequencing plans (Phase 3 complete, Phase 4 stalled at Module 4.1).
- `pilot_scope_S6_R1.md`, `pilot_review_M10.md`, `pilot_review_S6_R1.md`: pilot scoping/review notes for the frozen M10 and S6(R1) pilots. The pilot JSON files themselves remain active under `structured_data/pilots/`.
- `amendment_effective_strategy.md`, `amendment_prototype_S6_R1.md`, `effective_state_prototype_S6_R1.md`, `derived_contract_module_3_6.md`, `derived_layer_validator_module_3_5.md`: Phase 3 derived-layer design notes. The derived contract they describe is still active under `structured_data/schemas/derived/`; these notes are the historical rationale trail, not the current spec.
- `decisions.md` (DEC-001 through DEC-050), `review_log.md` (REV-001 through REV-011): the full pre-2026-08-18 per-decision/per-review governance log, archived when logging switched to `working_docs/milestone_log.md` (one entry per roadmap milestone instead of one per decision/review). Kept in full for historical rationale — not maintained further.

## Current source of truth

See root `README.md`, `working_docs/project_scope.md`, and `working_docs/product_roadmap.md` for the active product direction, and `working_docs/milestone_log.md` for the active decision record.
