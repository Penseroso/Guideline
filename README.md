# Regulatory Guideline Archive

This repository builds a traceable structured-data archive for regulatory guidelines. The current pilot source is ICH M10, and the current work focuses on source-preserving knowledge structuring.

## Current Status

- Original pilot PDF exists at `Guideline Files/ICH M10.pdf`.
- Initial PDF assessment exists at `working_docs/pdf_assessment_M10.md`.
- Phase 1 is complete for the limited ICH M10 pilot sections `3.2.5.2` and `6.1`.
- Reviewed pilot JSON files exist at `structured_data/pilots/m10_3_2_5_2.json` and `structured_data/pilots/m10_6_1.json`.
- The data model exists at `working_docs/schema.md` as model version `0.2.0`.
- Phase 2 core implementation is complete for the current M10 pilots: model `0.2.0`, JSON Schema, reusable validator, and migrated pilot files validate with `npm run validate -- structured_data/pilots/m10_3_2_5_2.json structured_data/pilots/m10_6_1.json`.
- Structural pressure testing and broader validation beyond the two pilot sections remain pending.
- Automated extraction, database, search, embeddings, RAG, and web application work remain out of scope.

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
- `working_docs/pilot_review_M10.md`: completed pilot review and Phase 2 migration notes for M10 sections `3.2.5.2` and `6.1`.
- `working_docs/review_log.md`: human review log template and completed review records.
- `AGENTS.md`: repository-wide operating rules for agents.
