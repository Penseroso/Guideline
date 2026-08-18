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

## Ordered Phase 4 modules

### 4.1 Derived contract schema scaffold

- Implement derived core schemas using `derived_model_version=0.1.0`.
- Implement the initial ICH profile schemas.
- Keep FDA and EMA profiles as planned extensions unless explicitly approved.
- Preserve source schema `0.2.0`.

Dependencies:

- DEC-030 accepted.
- Module 3.6 reviewed.

### 4.2 Family registry and lifecycle artifacts

- Implement GuidanceFamily, DocumentEdition, EditionSource, LifecycleRelationship, RiskAssessment, ReviewAttestation, and EffectiveStateSnapshot artifact structures.
- Reference existing source `document_id` values instead of duplicating source Document path, checksum, or source version fields.
- Add validation for family/edition identity, lifecycle status, current RiskAssessment reference, and risk history.

Dependencies:

- 4.1 schemas.

### 4.3 Single-PDF ingest and structure detection

- Ingest exactly one PDF per run.
- Compute or verify checksum.
- Preserve immutable source file path through source Document records.
- Identify section hierarchy, pages, tables, notes, and cross-reference candidates.

Dependencies:

- source model `0.2.0`;
- existing source validation.

### 4.4 Complete source-layer extraction

- Generate full source-layer bundles for one ICH PDF.
- Preserve SourceUnits, Sections, KnowledgeRecords, Conditions, QuantitativeCriteria, and CrossReferences.
- Do not create unsupported requirements or inferred applicability.

Dependencies:

- 4.3 structure detection.
- `scripts/validate_structured_data.js`.

### 4.5 Source validation and risk assessment

- Run source schema and cross-object validation.
- Create an initial versioned RiskAssessment event.
- Set required review tier from the higher of document risk and artifact-type minimum risk.

Dependencies:

- 4.4 source extraction.
- Module 3.6 risk policy.

### 4.6 Derived artifact generation or update

- Generate or update AmendmentMappings where applicable.
- Generate candidate or reviewed EffectiveRecords according to lifecycle relationship review status.
- Use neutral derivation basis plus ICH profile details.
- Preserve historical EffectiveRecord versions.

Dependencies:

- 4.2 family/lifecycle artifacts.
- 4.5 source validation and risk assessment.

### 4.7 Review attestation workflow

- Create validator, model, human, or legacy review attestations.
- Preserve provider/model metadata only when known.
- Calculate aggregate `review_status`.
- Preserve disagreements as `needs_review` unless a resolution policy is satisfied.

Dependencies:

- 4.5 and 4.6 outputs.

### 4.8 Effective-state snapshot generation

- Generate snapshots by family, jurisdiction, `as_of_date`, review policy, derived contract version, source corpus identity, and calculation-policy version.
- Treat `calculated_at` as metadata, not semantic identity.
- Support `include_needs_review` and `reviewed_only` policies.

Dependencies:

- 4.6 derived artifacts.
- 4.7 review status.

### 4.9 Incremental family update

- Add one new PDF to an existing GuidanceFamily.
- Register the source Document if needed.
- Create or update edition and lifecycle metadata.
- Identify impacted mappings and EffectiveRecords.
- Reassess only affected records.
- Preserve unchanged older records and snapshots.

Dependencies:

- 4.2 family registry.
- 4.8 snapshot generation.

### 4.10 Phase 4 review and expansion readiness

- Review the complete ICH single-PDF engine.
- Decide whether the architecture is stable enough for derived contract `1.0.0`.
- Decide whether FDA and EMA profile implementation can begin.

Dependencies:

- successful complete ICH PDF processing;
- reviewed validators and migrations;
- reviewed effective-state snapshots.

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
