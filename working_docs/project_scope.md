# Project Scope

## Mission and Product Value

Build a traceable regulatory knowledge archive that preserves official guideline source text and supports reusable structured records. The archive should help users find relevant regulatory statements, understand requirements, quantitative criteria, conditions, and exceptions, verify results against exact source text and PDF locations, compare related content across sections and later documents, and reuse reviewed structured information.

## Users and Initial Product Target

The primary users are internal reviewers and analysts who need to inspect and verify regulatory guideline content. The initial product target is a future read-only internal review tool; Phase 0 does not implement that application.

## Canonical Data and Design Principles

Canonical sources are immutable official PDFs and reviewed, Git-managed structured JSON. Databases, search indexes, embeddings, retrieval context, comparison views, and application data are derived and reproducible.

The foundation must preserve source traceability, separate source-derived records from analyst-derived mappings or interpretations, support multiple documents and coexisting document versions, and remain compatible with future cross-document comparison.

## Current Scope

Phase 0 is limited to aligning repository documentation before the M10 JSON pilot. The current pilot document is ICH M10, with the source PDF at `Guideline Files/ICH M10.pdf`, the PDF assessment at `working_docs/pdf_assessment_M10.md`, and the conceptual data model at `working_docs/schema.md` version `0.1.0`.

## Project Phases

- Phase 0 — Foundation Alignment: align documentation, roles, terminology, and current status.
- Phase 1 — M10 Pilot: create a limited reviewed JSON pilot from ICH M10 using the conceptual model.
- Phase 2 — Data Contract and Validation: add JSON Schema and reproducible validation tooling for structured data.
- Phase 3 — Expansion and Application: expand across sections/documents and support derived review-tool capabilities.

## Non-Goals

The following are outside the current scope unless explicitly requested:

- Full-guideline extraction.
- JSON Schema implementation.
- Structured data creation.
- Extraction or validation script implementation.
- Database, search, embedding, or web application implementation.
- Regulatory suitability conclusions.
- Study-design recommendations.
- Automated decision making.
- Go/No-Go judgments.
- Scoring systems.
