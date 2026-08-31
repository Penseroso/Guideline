# History

This directory holds frozen, superseded planning, process, and prototype artifacts. They are historical record only — not active plans, not the current source of truth, and not binding on current work. Everything here is retired; if it's needed again, rebuilding fresh against the live schema is expected to be cheaper than reviving it. See root `README.md` and `docs/product_roadmap.md` for what's actually current.

## Layout

- `phase_plans/`: superseded module-sequencing plans from the original Phase 3/4 archive-building effort (Phase 3 complete, Phase 4 stalled at Module 4.1). Assumed an old non-goal boundary (no application layer) that no longer holds.
- `pilot_review/`: pilot scoping/review notes for the M10 and S6(R1) pilots. The pilot JSON files themselves remain active under `data/pilots/` — only the process notes are archived.
- `decision_log/`: the full pre-2026-08-18 per-decision/per-review governance log (`decisions.md`: DEC-001–DEC-050, `review_log.md`: REV-001–REV-011), archived when logging switched to `docs/milestone_log.md` (one entry per roadmap milestone instead of one per decision/review).
- `derived_contract/`: the entire "derived contract" layer explored during Phase 3 — design notes, prototypes (AmendmentMapping, EffectiveRecord), schemas, validator, and its test suite/fixtures. Paused since an early audit and never adopted by the product build; archived whole rather than kept half-alive.
- `structural_probes/`: two M10 pilot bundles used only as schema stress tests (tables, reference-condition patterns), never given full content review. If those M10 sections are needed for real, extract them fresh against the live schema.
- `applicability_engine/`: the entire M6 "Applicability Engine" spike — a derived `Condition`→predicate binding pipeline, deterministic evaluator, RegulatoryContext ontology, rule discovery, and their test suites. Explored, measured (0 new slot types needed across 3 guidelines), then discontinued as a separate module after a real-usage review found it too much maintenance surface for a narrow coverage island; two findings were cherry-picked live into `engine/text_utils.js` and `engine/query_router.js` instead (see that directory's own `README.md` for detail) — archived whole rather than kept half-alive, same as `derived_contract/`.
- `audits/`: dated repository audits that informed earlier roadmap decisions.
- `source_assessments/`: one-time source PDF and extraction-risk assessments.
- `verification/`: detailed engine measurements superseded by `docs/verification_status.md`.
- `milestones/`: completed milestone narratives superseded by the active index in `docs/milestone_log.md`.
- `usage/`: frozen real-use logs and derived reports, never live runtime inputs.

## Current source of truth

See root `README.md`, `docs/project_scope.md`, and `docs/product_roadmap.md` for the active product direction, and `docs/milestone_log.md` for the active decision record.
