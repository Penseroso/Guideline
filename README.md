# Regulatory Guideline Archive

This repository builds a traceable structured-data archive for regulatory guidelines. The current structured pilot source is ICH M10, and Phase 3 has started with S6(R1) foundation and architecture work.

## Current Status

- Original pilot PDF exists at `Guideline Files/ICH M10.pdf`.
- Initial PDF assessment exists at `working_docs/pdf_assessment_M10.md`.
- Phase 1 is complete for the limited ICH M10 pilot sections `3.2.5.2` and `6.1`.
- Reviewed pilot JSON files exist at `structured_data/pilots/m10_3_2_5_2.json` and `structured_data/pilots/m10_6_1.json`.
- The data model exists at `working_docs/schema.md` as model version `0.2.0`.
- Phase 2 implementation is complete for the current M10 pilots: model `0.2.0`, JSON Schema, reusable validator, and migrated pilot files validate with `npm run validate:pilots`.
- Selected M10 structural pressure testing is complete, and model `0.2.0` is retained.
- The files `structured_data/pilots/m10_phase2_table_pressure.json` and `structured_data/pilots/m10_phase2_reference_condition_pressure.json` are reviewed structural probes. They should later be retired or absorbed if the same leaf sections are replaced by fuller canonical bundles.
- Phase 3 has started. Module 3.0 foundation is complete, and Module 3.1 S6 Parent-Addendum pilot scope selection is approved after repository review.
- The S6(R1) source PDF exists at `Guideline Files/ICH S6.pdf`, with assessment at `working_docs/pdf_assessment_S6_R1.md`.
- S6 cross-guideline validation is not complete.
- Source model `0.2.0` remains unchanged.
- Amendment mapping and `EffectiveRecord` are provisional derived-layer designs, not JSON Schema objects, and remain unimplemented.
- S6 structured JSON, schema changes, full extraction, database, search, embeddings, RAG, web application, and regulatory decision automation are not started.

## Repository Map

- `Guideline Files/`: immutable original guideline PDFs.
- `working_docs/`: project scope, conceptual model, PDF assessments, decisions, and review logs.
- `structured_data/`: machine-readable structured outputs and schemas.
- `scripts/`: reproducible extraction and validation scripts.
- `.agents/skills/`: future reusable workflows after validation.

## Key Documents

- `working_docs/project_scope.md`: project scope, product direction, phases, and non-goals.
- `working_docs/schema.md`: current conceptual data model.
- `working_docs/decisions.md`: accepted material decisions and rationale.
- `working_docs/pdf_assessment_M10.md`: technical assessment of the ICH M10 PDF and extraction risks.
- `working_docs/pdf_assessment_S6_R1.md`: technical assessment of the local ICH S6(R1) PDF and extraction risks.
- `working_docs/phase3_plan.md`: Phase 3 module plan.
- `working_docs/pilot_scope_S6_R1.md`: selected S6(R1) Parent-Addendum pilot scope for Module 3.2, approved after repository review.
- `working_docs/amendment_effective_strategy.md`: provisional derived-layer strategy for Parent-Addendum mappings and effective-state records.
- `working_docs/pilot_review_M10.md`: completed pilot review and Phase 2 migration notes for M10 sections `3.2.5.2` and `6.1`.
- `working_docs/review_log.md`: human review log template and completed review records.
- `AGENTS.md`: repository-wide operating rules for agents.
