# Regulatory Guideline Archive

This repository builds a traceable structured-data archive for regulatory guidelines. The current pilot source is ICH M10, and the current work focuses on source-preserving knowledge structuring.

## Current Status

- Original pilot PDF exists at `Guideline Files/ICH M10.pdf`.
- Initial PDF assessment exists at `working_docs/pdf_assessment_M10.md`.
- Conceptual data model exists at `working_docs/schema.md` as version `0.1.0`.
- JSON Schema, pilot JSON, validation scripts, automated extraction, database, and web application have not been created yet.
- The next phase is the M10 pilot using the current conceptual model.

## Repository Map

- `Guideline Files/`: immutable original guideline PDFs.
- `working_docs/`: project scope, conceptual model, PDF assessments, decisions, and review logs.
- `structured_data/`: future machine-readable structured outputs and schemas.
- `scripts/`: future reproducible extraction and validation scripts.
- `.agents/skills/`: future reusable workflows after validation.

## Key Documents

- `working_docs/project_scope.md`: project scope, product direction, phases, and non-goals.
- `working_docs/schema.md`: current conceptual data model.
- `working_docs/decisions.md`: accepted material decisions and rationale.
- `working_docs/pdf_assessment_M10.md`: technical assessment of the ICH M10 PDF and extraction risks.
- `working_docs/review_log.md`: completed human review records.
- `AGENTS.md`: repository-wide operating rules for agents.
