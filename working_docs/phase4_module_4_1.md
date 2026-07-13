# Phase 4 Module 4.1: Derived Contract Schema Scaffold

Status: Module 4.1 complete after REV-012. Later Phase 4 module status is tracked in `working_docs/phase4_plan.md` and `README.md`, not restated here.

## Scope implemented

Module 4.1 adds the initial draft-07 JSON Schema scaffold for derived contract `0.1.0`.

- Regulator-neutral shared definitions live under `structured_data/schemas/derived/core.schema.json`.
- Per-artifact schemas live under `structured_data/schemas/derived/artifacts/`.
- The initial ICH profile lives under `structured_data/schemas/derived/profiles/ich.schema.json`.
- The artifact schemas cover GuidanceFamily, DocumentEdition, EditionSource, LifecycleRelationship, AmendmentMapping, EffectiveRecord, EffectiveStateSnapshot, ReviewAttestation, and RiskAssessment.

All contract-conformant artifacts declare `derived_model_version="0.1.0"` and use an artifact envelope with `artifact_type`, `regulator_profile`, and `records`.

## Validation boundary

Production contract validation and Phase 3 legacy validation are separate code paths:

- `scripts/validate_derived.js` is the production contract validator for derived contract `0.1.0`.
- `validateDerivedContractArtifact(...)` validates a single contract artifact against JSON Schema.
- `validateContractArtifacts(...)` validates supplied contract artifacts by running JSON Schema first, then contract-shape-aware graph checks.
- The production CLI accepts `--manifest <manifest.json>`, where the manifest names one source bundle and a list of contract artifact files.
- `scripts/validate_legacy_derived.js` preserves the Module 3.5 validator for the frozen Phase 3 prototype shapes and is exposed by `npm run validate:legacy`.

The production contract validator contains no Phase 3 prototype paths and performs no filename-based legacy dispatch. The Phase 3 prototype artifacts remain historical regression assets:

- `structured_data/derived/s6_r1_amendment_mappings.json`
- `structured_data/derived/s6_r1_effective_records.json`

They remain covered by the isolated legacy validator and are not migrated in this module.

All other derived artifacts must be contract-marked with `derived_model_version` and `artifact_type`, and must pass JSON Schema before graph validation.

## Schema and profile boundary

The regulator-neutral core schema has no direct dependency on the ICH profile schema. Artifact schemas apply profile-specific constraints where needed.

- `AmendmentMapping` carries amendment endpoint, relation, mapped scope, analyst rationale, contextual cross-reference evidence, source evidence, review, and technical history fields. It does not carry `derivation_basis` or ICH derivation details in Module 4.1.
- `EffectiveRecord` carries `derivation_basis`, synthesis rationale, and structured representation limitations. ICH derivation details are required only where the EffectiveRecord derivation basis needs ICH profile detail.
- Review, risk, family, snapshot, and other metadata artifacts are not required to carry derivation-specific ICH details.
- `current_risk_assessment_id` is required but nullable before Module 4.5, so absence of a current RiskAssessment is explicit without prematurely requiring RiskAssessment production artifacts.
- `GuidanceFamily` uses the artifact envelope `regulator_profile`; the record does not repeat that field.
- Source references are ID-based only, and the core schema separates two closed reference shapes. A document-level reference (`documentLevelSourceRef`) carries only `document_id`. A source-unit-level reference (`sourceUnitLevelSourceRef`) requires all three of `document_id`, `section_id`, and `source_unit_id`. LifecycleRelationship, AmendmentMapping, and EffectiveRecord `source_references` accept only source-unit-level references, so partial evidence that names a document without its section and source unit is rejected at schema validation. Source text, page index, and printed page labels remain authoritative in the source bundle and are not re-added to derived artifacts.

## Repository artifact authority

The normative artifact authority boundary is stated once, in `README.md` under "Artifact Authority
Boundary". Module 4.1 introduced and follows that boundary: derived JSON Schemas and the production
contract validator are the normative runtime contract; contract fixtures and manifests under
`test/fixtures/derived_contract/` are test-only; Phase 1-3 plans, prototypes, and review records are
historical/non-normative. The production engine must use only normative runtime artifacts, and Phase 3
prototypes remain comparison references, not production migration inputs.

## Source bundle revalidation

`npm run validate:derived` revalidates the supplied source bundle before any derived validation. The manifest validator runs, in order: (1) source JSON Schema and source cross-object validation, reusing `validateBundles` from `scripts/validate_structured_data.js`; (2) derived artifact JSON Schema validation; (3) derived contract graph validation. It reuses the existing source validator rather than copying source rules. If source validation fails, the derived contract graph validation does not run, so a derived artifact is never graph-checked against a source bundle that is itself invalid.

## Contract graph checks

The Module 4.1 contract graph validator checks source-reference resolution, object-layer correctness, AmendmentMapping endpoint resolution and provenance closure, contextual CrossReference resolution, EffectiveRecord mapping coverage, EffectiveRecord provenance closure including direct SourceUnit contributors, family or document identity when registry artifacts are supplied, reviewed-contributor invariants demonstrated by Module 3.5, global contract ID uniqueness, predecessor-history self-reference and cycle checks, and rejection of `reviewed_cross_document_synthesis` or cross-family synthesis by default.

Predecessor-history integrity additionally requires that a `history.predecessor_record_ids` entry present in the supplied contract graph shares the referencing record's `artifact_type`; referencing a different artifact type as a predecessor fails. Predecessor IDs that are not present in the supplied graph are treated as historical lineage and allowed.

LifecycleRelationship graph validation resolves declared GuidanceFamily, source and target DocumentEdition records, family consistency, jurisdiction consistency, source references, reviewed source-unit evidence where applicable, and rejects self-relations in Module 4.1.

When relevant EditionSource artifacts are supplied, contract graph validation uses EditionSource as the source-document authorization boundary for LifecycleRelationship, AmendmentMapping, and EffectiveRecord source references. AmendmentMapping validates source and amending endpoint evidence against the corresponding edition separately. Module 4.1 does not require EditionSource completeness when registry artifacts are absent; production registry completeness remains Module 4.2 scope.

Partial EditionSource coverage is rejected per validated record. For the editions a record references — LifecycleRelationship from/to editions, AmendmentMapping source/amending editions, and EffectiveRecord own edition plus the editions its referenced AmendmentMappings require — either none of those editions has an EditionSource, in which case the authorization check is skipped, or all of them do, in which case authorization runs. If some but not all of the referenced editions carry an EditionSource, validation fails with an incomplete-registry error. Whole-of-production registry completeness remains Module 4.2 scope.

Reviewed EffectiveRecords may depend on unresolved or unreviewed CrossReferences only when a structured representation limitation names the affected CrossReference and the affected IDs resolve to contributors or referenced evidence. Free-form limitation notes without affected IDs are rejected.

Module 4.1 fixes the structural contract and generic graph rules. Module 4.2 owns production registry data and reviewed controlled vocabularies for DocumentEdition roles, document statuses, and LifecycleRelationship types. Current free-string registry lifecycle fields are provisional until 4.2. The ICH profile currently constrains EffectiveRecord derivation detail only.

Full risk-tier satisfaction, review-attestation aggregation, and disagreement-resolution policy remain assigned to later Phase 4 modules.

## Non-goals preserved

- No source model `0.2.0` change.
- No change to `structured_data/schemas/guideline_bundle.schema.json`.
- No change to reviewed pilots, probes, or Phase 3 derived prototypes.
- No production registry artifact creation.
- No FDA or EMA production profile.
- No ingest, extraction, orchestration, UI, decision engine, or derived contract `1.0.0`.
- No production migration of Phase 3 prototypes.

## Items requiring additional review

- REV-012 confirmed that the schemas express the Module 3.6 contract without expanding it; Module 4.1 is complete.
- Later modules must extend cross-object validation for production registry, risk, review-attestation, and snapshot rules when those production artifacts exist.
- Module 4.6 remains responsible for generated derived artifacts and regression reconciliation against frozen Phase 3 references where scopes overlap.
