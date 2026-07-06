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

`scripts/validate_derived.js` now runs JSON Schema validation for contract-marked derived artifacts before legacy cross-object validation. Schema validation applies to artifacts that declare `derived_model_version` or `artifact_type`.

The Phase 3 prototype artifacts remain explicitly exempt from derived `0.1.0` schema enforcement:

- `structured_data/derived/s6_r1_amendment_mappings.json`
- `structured_data/derived/s6_r1_effective_records.json`

They remain covered by the existing Module 3.5 cross-object validator and are not migrated in this module.

## Non-goals preserved

- No source model `0.2.0` change.
- No change to `structured_data/schemas/guideline_bundle.schema.json`.
- No change to reviewed pilots, probes, or Phase 3 derived prototypes.
- No production registry artifact creation.
- No FDA or EMA production profile.
- No ingest, extraction, orchestration, UI, decision engine, or derived contract `1.0.0`.

## Items requiring additional review

- Independent repository review must confirm the schemas express the Module 3.6 contract without expanding it.
- Later modules must add cross-object validation for registry, risk, review-attestation, and snapshot graph rules when those production artifacts exist.
- Module 4.6 remains responsible for non-destructive migration of Phase 3 prototype artifacts into contract-conformant successor artifacts.
