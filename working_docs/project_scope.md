# Project Scope

## Mission and Product Value

Build a traceable regulatory knowledge archive that preserves official guideline source text and supports reusable structured records. The archive should help users find relevant regulatory statements, understand requirements, quantitative criteria, conditions, and exceptions, verify results against exact source text and PDF locations, compare related content across sections and later documents, and reuse reviewed structured information.

## Users and Initial Product Target

The primary users are internal reviewers and analysts who need to inspect and verify regulatory guideline content. The initial product target is a future read-only internal review tool; Phase 0 does not implement that application.

## Canonical Data and Design Principles

Canonical sources are immutable official PDFs and reviewed, Git-managed structured JSON. Databases, search indexes, embeddings, retrieval context, comparison views, and application data are derived and reproducible.

The foundation must preserve source traceability, separate source-derived records from analyst-derived mappings or interpretations, support multiple documents and coexisting document versions, and remain compatible with future cross-document comparison.

## Current Status

Phase 2 Data Contract and Validation is complete for the current ICH M10 pilot. Phase 1 produced reviewed pilot JSON for ICH M10 sections `3.2.5.2` and `6.1`; Phase 2 formalized that pilot into model `0.2.0`, JSON Schema, and reusable validation scripts. Selected M10 structural pressure testing is also complete, and model `0.2.0` is retained.

The current structured pilot document remains ICH M10, with the source PDF at `Guideline Files/ICH M10.pdf`, the PDF assessment at `working_docs/pdf_assessment_M10.md`, the data model at `working_docs/schema.md`, and pilot outputs under `structured_data/pilots/`.

The files `structured_data/pilots/m10_phase2_table_pressure.json` and `structured_data/pilots/m10_phase2_reference_condition_pressure.json` are reviewed structural probes, not fuller canonical bundles for their leaf sections. They should later be retired or absorbed if those same leaf sections are replaced by fuller canonical bundles.

Phase 3 is complete after REV-011. Modules 3.0 through 3.6 completed the S6(R1) foundation, approved Parent-Addendum pilot scope, reviewed source-layer pilot, reviewed amendment-relation prototype, reviewed current effective-state prototype, derived-layer validator, and provisional derived-layer contract plus Phase 4 handoff plan.

Source model `0.2.0` remains unchanged. AmendmentMapping and `EffectiveRecord` are provisional derived-layer artifacts under `structured_data/derived/`, documented in `working_docs/amendment_effective_strategy.md`, `working_docs/amendment_prototype_S6_R1.md`, and `working_docs/effective_state_prototype_S6_R1.md`. They remain outside the source JSON Schema and are validated separately by `scripts/validate_derived.js`. Module 3.6 documents the provisional derived-layer contract boundary in `working_docs/derived_contract_module_3_6.md`, with Phase 4 planned but not started.

## Project Phases

- Phase 0 - Foundation Alignment: align documentation, roles, terminology, and current status.
- Phase 1 - M10 Pilot: create a limited reviewed JSON pilot from ICH M10 using the conceptual model.
- Phase 2 - Data Contract and Validation: complete for the current M10 pilots and selected M10 structural pressure tests.
- Phase 3 - S6 Foundation and Derived-Layer Strategy: complete after REV-011; source model `0.2.0` is retained, derived-layer prototypes and validation are reviewed, and the provisional derived contract plus Phase 4 handoff plan are documented.
- Phase 4 - Single-guideline full-processing engine: planned, not started.

## Non-Goals

The following are outside the current scope unless explicitly requested:

- Full-guideline extraction.
- Full-guideline structured data creation.
- Additional S6 JSON pilot creation outside the approved Module 3.2 scope.
- Schema changes before an actual S6 pilot demonstrates a limitation.
- Automated extraction script implementation.
- Database, search, embedding, RAG, or web application implementation.
- Regulatory suitability conclusions.
- Study-design recommendations.
- Automated decision making.
- Go/No-Go judgments.
- Scoring systems.
