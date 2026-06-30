# Regulatory Guideline Archive

This repository builds a traceable structured-data archive for regulatory guidelines. The current pilot source is ICH M10, and the project is limited to archiving and knowledge structuring.

## Folders

- `Guideline Files/`: immutable original guideline PDFs.
- `working_docs/`: scope, assessments, decisions, review logs, and future schema documentation.
- `structured_data/`: future machine-readable structured outputs and schemas.
- `scripts/`: future reproducible extraction and validation scripts.
- `.agents/skills/`: future reusable workflows after validation.

## Current Status

- Original pilot PDF exists at `Guideline Files/ICH M10.pdf`.
- Initial PDF assessment exists at `working_docs/pdf_assessment_M10.md`.
- No schema, structured extraction output, validation script, or web application has been created yet.

## Basic Workflow

1. Inspect the source PDF and relevant working documents.
2. Define or confirm the limited section scope before extraction.
3. Create a small representative structured sample before broader processing.
4. Preserve source traceability for every structured record.
5. Validate structured outputs when they are added or changed.
6. Record material design decisions and human review results in `working_docs/`.
