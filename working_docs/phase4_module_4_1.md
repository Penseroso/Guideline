# Phase 4 Module 4.1: Derived Contract Schema Scaffold

Status: implemented, pending independent repository review.

## Scope implemented

Module 4.1 adds the initial draft-07 JSON Schema scaffold for derived contract `0.1.0`.

- Regulator-neutral shared definitions live under `structured_data/schemas/derived/core.schema.json`.
- Per-artifact schemas live under `structured_data/schemas/derived/artifacts/`.
- The initial ICH profile lives under `structured_data/schemas/derived/profiles/ich.schema.json`.
- The artifact schemas cover GuidanceFamily, DocumentEdition, EditionSource, LifecycleRelationship, AmendmentMapping, EffectiveRecord, EffectiveStateSnapshot, ReviewAttestation, and RiskAssessment.

All contract-conformant artifacts declare `derived_model_version="0.1.0"` and use an artifact envelope with `artifact_type`, `regulator_profile`, and `records`.

## Validation boundary

`scripts/validate_derived.js` now has separate validation entry points:

- `validateLegacyDerivedArtifacts(...)` preserves the Module 3.5 validator for the frozen Phase 3 prototype shapes.
- `validateContractArtifacts(...)` validates contract artifacts by running JSON Schema first, then contract-shape-aware graph checks.
- The existing three-file CLI remains available and dispatches the exact Phase 3 prototype paths to legacy validation.

The Phase 3 prototype artifacts remain explicitly exempt from derived `0.1.0` schema enforcement:

- `structured_data/derived/s6_r1_amendment_mappings.json`
- `structured_data/derived/s6_r1_effective_records.json`

They remain covered by the existing Module 3.5 cross-object validator and are not migrated in this module.

All other derived artifacts must be contract-marked with `derived_model_version` and `artifact_type`, and must pass JSON Schema before graph validation.

## Schema and profile boundary

The regulator-neutral core schema has no direct dependency on the ICH profile schema. Artifact schemas apply profile-specific constraints where needed.

- `AmendmentMapping` carries amendment endpoint, relation, mapped scope, analyst rationale, contextual cross-reference evidence, source evidence, review, and technical history fields. It does not carry `derivation_basis` or ICH derivation details in Module 4.1.
- `EffectiveRecord` carries `derivation_basis`, synthesis rationale, and structured representation limitations. ICH derivation details are required only where the EffectiveRecord derivation basis needs ICH profile detail.
- Review, risk, family, snapshot, and other metadata artifacts are not required to carry derivation-specific ICH details.
- `current_risk_assessment_id` is required but nullable before Module 4.5, so absence of a current RiskAssessment is explicit without prematurely requiring RiskAssessment production artifacts.

## Migration-fidelity scaffold

Module 4.1 includes fixture-only successor artifacts demonstrating that reviewed Phase 3 derived meaning can be represented without migrating the frozen production prototypes.

- Existing reviewed strings, IDs, and review states are preserved exactly in the fixture successors.
- Legacy-to-contract field renaming is structural normalization, for example Parent/Addendum endpoint names to source/amending endpoint names.
- `source_references` reconstructed from source-bundle trace are trace-derived enrichment.
- `technical_migration.source_artifact_paths` and `technical_migration.migration_note` preserve technical migration evidence without representing regulatory lifecycle replacement or supersession.

## Contract graph checks

The Module 4.1 contract graph validator checks source-reference resolution, object-layer correctness, AmendmentMapping endpoint resolution, contextual CrossReference resolution, EffectiveRecord mapping coverage, provenance closure, family or document identity when registry artifacts are supplied, reviewed-contributor invariants demonstrated by Module 3.5, and rejection of `reviewed_cross_document_synthesis` or cross-family synthesis by default.

LifecycleRelationship graph validation resolves declared GuidanceFamily, source and target DocumentEdition records, family consistency, jurisdiction consistency, source references, reviewed source-unit evidence where applicable, and rejects self-relations in Module 4.1.

When relevant EditionSource artifacts are supplied, contract graph validation uses EditionSource as the source-document authorization boundary for AmendmentMapping and EffectiveRecord source references. Module 4.1 does not require EditionSource completeness when registry artifacts are absent; production registry completeness remains Module 4.2 scope.

Reviewed EffectiveRecords may depend on unresolved or unreviewed CrossReferences only when a structured representation limitation names the affected CrossReference and the affected IDs resolve to contributors or referenced evidence. Free-form limitation notes without affected IDs are rejected.

Full risk-tier satisfaction, review-attestation aggregation, and disagreement-resolution policy remain assigned to later Phase 4 modules.

## Non-goals preserved

- No source model `0.2.0` change.
- No change to `structured_data/schemas/guideline_bundle.schema.json`.
- No change to reviewed pilots, probes, or Phase 3 derived prototypes.
- No production registry artifact creation.
- No FDA or EMA production profile.
- No ingest, extraction, orchestration, UI, decision engine, or derived contract `1.0.0`.

## Items requiring additional review

- Independent repository review must confirm the schemas express the Module 3.6 contract without expanding it.
- Later modules must extend cross-object validation for production registry, risk, review-attestation, and snapshot rules when those production artifacts exist.
- Module 4.6 remains responsible for non-destructive migration of Phase 3 prototype artifacts into contract-conformant successor artifacts.
