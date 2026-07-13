# Phase 4 Handoff Plan

Status: planned. This handoff is prepared by Phase 3 Module 3.6 and is not an implementation plan for the current task.

## Milestones

Intermediate milestone:

- Build a reusable engine capable of processing one complete ICH PDF from beginning to end, such as the full S6 PDF.

Final expansion milestone:

- Apply the same regulator-neutral core architecture to FDA and EMA through regulator profiles.

## Processing boundary

Phase 4 processes one PDF per extraction run.

The engine must:

- ingest one PDF;
- identify document structure;
- generate complete source-layer records under source model `0.2.0`;
- generate or update derived artifacts where applicable;
- validate source and derived outputs;
- create review attestations;
- create versioned risk assessments;
- produce query-ready effective-state artifacts.

The engine must not:

- extract multiple PDFs simultaneously;
- overwrite historical effective states;
- re-extract unchanged older PDFs unless explicitly required;
- perform automatic unreviewed cross-document synthesis;
- become a regulatory decision engine.

## Module authority

`working_docs/phase4_plan.md` is the sole authority for Phase 4 module numbering, scope, dependencies,
and sequencing (modules 4.1 through 4.12, the regulator-neutral engine, and the M10 baseline / S6
stress-test corpus). This document's earlier "Ordered Phase 4 modules" section (a 4.1–4.10 list with
different module boundaries than the concretized plan) is superseded and removed to avoid presenting a
second, conflicting module list. The remaining sections below — milestones, processing boundary,
impact-analysis strategy, and deferred work — remain valid handoff context and are not restated in
`phase4_plan.md`.

## Impact analysis strategy

When a new family document is added, limit reassessment to records affected by:

- same `guidance_family_id`;
- lifecycle relationship type and review status;
- source records cited by existing mappings or EffectiveRecords;
- changed sections, source units, KnowledgeRecords, Conditions, QuantitativeCriteria, or CrossReferences;
- amendment mapping endpoints;
- jurisdiction and `as_of_date` scope;
- review-policy changes;
- calculation-policy version changes.

Unresolved lifecycle relationships may create candidate `needs_review` EffectiveRecords but must not retire, supersede, or replace existing effective state.

## Validation strategy

Phase 4 validation remains layered:

- source JSON Schema validation;
- source cross-object validation;
- derived JSON Schema validation;
- derived cross-object validation;
- risk/review-policy validation;
- snapshot identity and historical preservation validation.

Existing M10/source-pilot validation behavior must remain unchanged.

## Deferred work

- FDA production profile.
- EMA production profile.
- UI.
- answer generation.
- RAG/search/embeddings.
- regulatory decision automation.
- full applicability ontology.
- bulk ICH corpus processing.
