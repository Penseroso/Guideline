# Derived-Layer Contract Decision: Phase 3 Module 3.6

Status: implemented pending repository review.

This document records the Module 3.6 derived-layer contract and workflow boundary decision. It is a documentation and planning artifact only. It does not implement derived schemas, migrations, validators, source model changes, or the Phase 4 engine.

## Decision baseline

Module 3.6 preserves these completed Phase 3 findings:

- Source model `0.2.0` remains valid for source-layer records.
- AmendmentMapping and EffectiveRecord remain outside the source bundle schema.
- Module 3.3 produced reviewed AmendmentMapping prototypes.
- Module 3.4 produced reviewed EffectiveRecord prototypes.
- Module 3.5 produced a reviewed derived-layer validator.
- Existing source, M10, pilot, and derived validation behavior remains unchanged.

The initial derived-layer contract version is provisional:

- `derived_model_version`: `0.1.0`
- `1.0.0` is reserved for a later stability gate after schemas, validators, migration, and Phase 4 evidence are reviewed.

## Contract separation

The source model and derived-layer model are independently versioned.

- Source model `0.2.0` remains the canonical contract for source bundles.
- Derived-layer contract `0.1.0` is a separate contract for family lifecycle, amendment mapping, effective-state synthesis, review attestations, risk assessment, and query-ready snapshots.
- AmendmentMapping and EffectiveRecord must not be added to `structured_data/schemas/guideline_bundle.schema.json`.

The derived contract uses:

- a regulator-neutral core contract;
- regulator profile contracts for ICH, FDA, and EMA.

Profiles extend or constrain the core. They must not duplicate the full core model.

Recommended future schema structure:

- separate artifact schemas sharing common definitions;
- common core definitions for IDs, artifact metadata, derivation basis, review attestation, aggregate review status, risk assessment references, lifecycle relationship, effective-state context, and provenance references;
- separate profile definitions for regulator-specific document types, lifecycle terminology, and derivation details.

## Family and edition registry

The existing source `Document` remains the canonical physical-PDF record for:

- source file path;
- source file checksum;
- source version label;
- source identity.

The derived family/edition registry must not duplicate those fields. It references existing source `document_id` values and stores only family, edition, lifecycle, jurisdiction, risk-reference, and registry-specific metadata.

Logical derived registry objects:

- `GuidanceFamily`: stable family identity. `guidance_family_id` is independent of folder names under `Guideline Files/`.
- `DocumentEdition`: logical edition or document role in a family, such as draft, final, revised final, addendum, Q&A, annex, supplement, withdrawal notice, replacement notice, integrated package, or textually consolidated edition.
- `EditionSource`: registry link from a `DocumentEdition` to one or more existing source `document_id` values. This replaces any separate `SourceDocument` duplicate in the derived layer.
- `LifecycleRelationship`: reviewed or unresolved relationship between editions, with source evidence, relationship wording, normalized relationship type, jurisdiction, and review status.

User-supplied folder names under `Guideline Files/` may be used as family-classification input, but not as permanent identifiers.

## Effective-state lifecycle

Effective state is determined by:

- document or edition status;
- publication date;
- effective date when available;
- replacement, withdrawal, amendment, or supplementation relationships;
- jurisdiction;
- `as_of_date`;
- review results and review policy.

Upload order must never determine regulatory priority or current status.

Lifecycle relationship rules:

- Reviewed lifecycle relationships may support reviewed EffectiveRecords.
- Unresolved lifecycle relationships may produce only candidate `needs_review` EffectiveRecords.
- Unresolved lifecycle relationships must not automatically supersede, replace, or retire an existing effective state.
- Replacement, withdrawal, amendment, or supplementation effects require explicit lifecycle evidence and sufficient review-policy satisfaction.

Effective-state output is jurisdiction- and date-dependent. A single global `current` flag is not sufficient for the stable derived contract.

## Effective-state snapshots

`EffectiveStateSnapshot` identifies a query-ready set of EffectiveRecords for a semantic calculation scope.

Snapshot identity derives from:

- `guidance_family_id`;
- jurisdiction;
- `as_of_date`;
- review policy;
- derived contract version;
- source corpus identity;
- calculation-policy version.

Execution metadata such as `calculated_at`, tool version, runtime, and operator belongs in snapshot metadata. `calculated_at` alone must not create a new semantic snapshot identity.

Historical preservation rules:

- Never overwrite prior EffectiveRecords.
- Preserve previous EffectiveRecord versions and their provenance.
- Link successors to predecessors explicitly.
- Preserve prior snapshots for prior dates, jurisdictions, review policies, source corpus identities, or calculation-policy versions.
- When a new PDF changes current state, create new EffectiveRecord versions and a new snapshot; keep older records queryable as historical.

## Derivation basis

The regulator-neutral core uses an explicit derivation basis for EffectiveRecord creation:

- `direct_source`
- `consolidated_source`
- `amendment_synthesis`
- `supplementary_source`
- `reviewed_cross_document_synthesis`

Regulator-specific derivation details belong in controlled profile fields, not in free-text notes.

Examples:

- ICH `addendum_only` migrates to core `derivation_basis=supplementary_source` plus ICH profile detail such as `ich_derivation_detail=addendum_without_parent_counterpart`.
- ICH parent/addendum synthesis uses core `derivation_basis=amendment_synthesis` plus ICH profile detail.
- FDA final-guidance replacement, EMA annex handling, and Q&A supplementation should be modeled through profile-specific controlled details.

`addendum_only` is not a universal core concept.

## Amendment relation vocabulary

The core relation vocabulary is closed and regulator-neutral:

- `clarifies`
- `supplements`
- `modifies`
- `narrows`
- `broadens`
- `replaces`
- `supersedes`
- `conflicts_with`

The regulator's original relationship wording must be preserved separately. The core enum must not be expanded solely because an agency uses different prose.

## Cross-document synthesis

Automatic semantic synthesis across different GuidanceFamily objects is prohibited by default.

Rules:

- Same-family synthesis may use reviewed same-family lifecycle relationships.
- Unresolved same-family lifecycle relationships may support only candidate `needs_review` EffectiveRecords.
- Cross-family synthesis requires an explicit cross-document mapping that has passed the required review policy.
- A normal CrossReference may support navigation and provenance but does not authorize semantic merging.

## Applicability boundary

Preserve source-derived Condition records.

First-class effective-state context includes:

- jurisdiction;
- `as_of_date`;
- guidance family;
- document edition;
- document status.

Do not create a full applicability ontology in Module 3.6. Product type, development phase, route, population, indication, and similar dimensions should become typed fields only after demonstrated need across documents.

Applicability must not be stored if inferred without source support.

## Review attestations

Human review is optional, not structurally mandatory.

Use explicit review attestations for validator, model, human, or legacy repository review events. A review attestation records:

- reviewer type;
- provider;
- reviewer or model name when known;
- model identifier or version when known;
- review date/time;
- review scope;
- review outcome;
- notes or identified issues;
- artifact or record IDs covered.

Recommended structure: hybrid.

- Store attestations in shared review artifacts.
- Records reference attestation IDs and carry aggregate `review_status`.

Aggregate review states:

- `unreviewed`: no qualifying attestation and no validator pass;
- `needs_review`: unresolved issues, missing required tier, conflicting reviews, or unresolved lifecycle/material provenance;
- `reviewed`: required tier satisfied, validator passed, no unresolved material issues;
- `rejected`: explicit rejection attestation or failed review outcome requiring correction.

Conflicting independent reviews must not be silently resolved. Preserve disagreement and aggregate it as `needs_review` unless a defined resolution attestation resolves the conflict.

### Legacy review migration

Import REV-005 through REV-010 only at their documented scope.

Rules:

- Do not infer model/provider identity that was not recorded.
- Do not expand artifact-level review into record-level coverage.
- Do not infer reviewer identity beyond documented `Repository review`.
- Represent historical reviewed state through explicit legacy or repository-review attestations with traceable scope.
- Include review log reference, date, files reviewed, and covered artifact or record IDs only when those IDs were documented.

## Risk assessments

Risk assessments are versioned events, not overwritten fields.

Use a separate RiskAssessment history. The family/edition registry stores only a reference to the current RiskAssessment ID.

RiskAssessment fields:

- risk assessment ID;
- target type and target ID;
- risk level;
- risk factors;
- rationale;
- assessor attestation ID;
- assessment date/time;
- required review tier;
- prior or superseded assessment ID when applicable;
- override reason and override attestation when applicable.

Risk scale:

- `low`
- `medium`
- `high`
- `critical`

Risk factors include:

- draft/final/withdrawn status uncertainty;
- unclear publication or effective date;
- unclear replacement or supplementation scope;
- addendum or partial-amendment structure;
- integrated versus consolidated structure;
- complex layout, tables, notes, OCR, or cross-references;
- likely impact on current EffectiveRecords.

Artifact-type minimum risk:

- metadata: low;
- SourceUnit extraction: medium;
- KnowledgeRecord/Condition/QuantitativeCriterion structuring: medium;
- AmendmentMapping: high;
- EffectiveRecord: high;
- cross-document synthesis: critical.

The required review tier is based on the higher of current document risk and artifact-type minimum risk.

Review tier policy:

- low: validator or one designated review;
- medium: validator plus one model review;
- high: validator plus two independent model reviews;
- critical: validator plus multiple independent reviews, with unresolved disagreement remaining `needs_review`.

## Use of needs_review

Phase 4 may use `needs_review` records in user-facing output only with explicit warning and provenance.

Supported review policies:

- `include_needs_review`
- `reviewed_only`

Operational default: `include_needs_review`.

Rationale: the project is an archive and knowledge-structuring workflow, not a regulatory decision engine, and approved requirements allow use of `needs_review` records when warnings and provenance are explicit. `reviewed_only` remains the strict option for conservative downstream use.

Mandatory `include_needs_review` behavior:

- disclose each record's aggregate review status;
- disclose completed and missing review attestations;
- disclose material unresolved issues;
- preserve source provenance;
- distinguish reviewed and needs-review content;
- do not merge reviewed and needs-review claims into one unqualified conclusion;
- do not present needs-review output as equivalent to fully reviewed output.

## Current S6 migration strategy

Do not migrate the S6 prototype in Module 3.6.

Future migration strategy:

- Add derived artifact metadata with `derived_model_version=0.1.0`, `guidance_family_id`, regulator profile, jurisdiction, source corpus references, and profile version.
- Keep source `Document` `ich_s6_r1` as the canonical physical-PDF record.
- Create an ICH GuidanceFamily for S6.
- Create a DocumentEdition for the S6(R1) integrated package.
- Create an EditionSource reference from that edition to source `document_id=ich_s6_r1`.
- Convert current AmendmentMappings into derived-contract mapping artifacts without changing endpoint semantics.
- Convert current EffectiveRecords into date/jurisdiction-scoped records.
- Migrate the Addendum-only ADC record to core `derivation_basis=supplementary_source` plus ICH profile detail.
- Represent REV-005 through REV-010 as legacy/repository-review attestations only at documented scope.
- Add validator-passed attestations where validation command outputs are documented.

## Validation separation

Validation remains separated into:

- source validation: existing source JSON Schema and `scripts/validate_structured_data.js`;
- pilot discovery validation: existing `scripts/validate_pilots.js`;
- future derived JSON Schema validation: structural core and profile schema validation;
- cross-object derived validation: reference resolution, endpoint coverage, provenance graph closure, lifecycle identity, and no unauthorized cross-family synthesis;
- risk/review-policy validation: risk history integrity, required attestation tier, aggregate review status, disagreement handling, and output-policy compliance.

Module 3.5 validator rules that remain code-level after schemas:

- cross-file source reference resolution;
- wrong object-layer reference checks;
- mapping endpoint review and coverage checks;
- contributor review status checks;
- provenance graph closure;
- identity consistency across artifacts and source records;
- lifecycle/effective-state calculations;
- risk/review policy satisfaction;
- unauthorized cross-family synthesis detection.

## Phase 4 boundary

Phase 4 is a single-guideline full-processing engine.

One extraction run processes exactly one PDF:

- ingest one PDF;
- identify structure;
- generate complete source-layer records;
- generate or update derived artifacts where applicable;
- validate;
- create review attestations;
- produce query-ready artifacts.

The contract supports cumulative family history, but extraction does not process multiple PDFs simultaneously.

When a new PDF is assigned to an existing GuidanceFamily:

- process only the new PDF at extraction;
- register it as an existing source Document reference plus derived edition metadata;
- compare lifecycle relationships with the existing family corpus;
- reassess only affected mappings and EffectiveRecords;
- preserve previous EffectiveRecord versions and provenance;
- do not overwrite historical effective states;
- do not re-extract unchanged older PDFs unless explicitly required.

## Completion boundary

This Module 3.6 implementation ends as `Implemented pending repository review`.

A later independent review task must:

- add REV-011;
- verify this decision and handoff plan;
- mark Module 3.6 complete if accepted;
- mark Phase 3 complete if all Phase 3 criteria pass.

## Non-goals

- No derived schema implementation.
- No migration implementation.
- No validator changes.
- No source model `0.2.0` redesign.
- No source PDF or reviewed structured artifact changes.
- No REV-011 in the initial implementation.
- No Phase 3 completion before REV-011.
- No Phase 4 engine implementation.
- No FDA or EMA production profile implementation.
- No simultaneous corpus extraction.
- No automatic unreviewed cross-document synthesis.
- No UI, answer generation, RAG, search, scoring, or decision engine.
- No full applicability ontology.
- No bulk ICH corpus processing.
