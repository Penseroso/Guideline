# Derived-Layer Validator: Phase 3 Module 3.5

Status: implemented pending repository review.

This module adds automated validation for provisional S6 derived-layer artifacts without changing source model `0.2.0`, the source JSON Schema, source-bundle validation, or reviewed structured data.

## Artifacts validated

- Source bundle: `structured_data/pilots/s6_r1_species_selection.json`
- Amendment mappings: `structured_data/derived/s6_r1_amendment_mappings.json`
- EffectiveRecords: `structured_data/derived/s6_r1_effective_records.json`

The derived-layer artifacts remain outside the source JSON Schema. The validator is a code-level integrity check for demonstrated Module 3.3 and 3.4 failure modes.

## CLI

```powershell
npm.cmd run validate:derived
```

Equivalent direct command:

```powershell
node scripts/validate_derived.js --source structured_data/pilots/s6_r1_species_selection.json --amendments structured_data/derived/s6_r1_amendment_mappings.json --effective structured_data/derived/s6_r1_effective_records.json
```

Exit codes:

- `0`: validation passed.
- `1`: validation failed.
- `2`: usage or configuration failure.

## Validation scope

The validator checks artifact metadata, ID uniqueness, source-reference resolution, object-layer correctness, review-state consistency, required provenance fields, amendment endpoint coverage, and EffectiveRecord provenance graph integrity.

Configured file paths are converted to repository-relative paths with `/` separators before comparison. This avoids false failures from Windows absolute paths.

## Key rules

- Amendment mappings must use reviewed source `KnowledgeRecord` endpoints when marked reviewed.
- Amendment relation types are limited to the provisional vocabulary in `working_docs/amendment_effective_strategy.md`.
- EffectiveRecords require a non-empty `effective_status` string, but no effective-status vocabulary is enforced in Module 3.5.
- `review_status` is limited to `reviewed` or `needs_review`.
- Empty `amendment_relation_ids` means mapping-independent; no Addendum-only discriminator is inferred.
- Non-empty `amendment_relation_ids` require each mapping to exist, be reviewed, and contribute at least one Parent and one Addendum `KnowledgeRecord` endpoint to the EffectiveRecord.
- Conditions, QuantitativeCriteria, CrossReferences, and direct SourceUnits must be represented in the EffectiveRecord provenance graph.
- Unreviewed CrossReferences may be referenced by a reviewed EffectiveRecord only when the limitation is explicitly documented in `representation_limitations`.

## Non-goals

- No source model or model-version change.
- No source JSON Schema expansion.
- No semantic regulatory judgment.
- No automated amendment detection.
- No Module 3.6 decision.
- No full S6 extraction or application/UI work.

## Review status

Module 3.5 is implemented pending independent repository review. Do not mark it complete and do not add REV-010 until a later review task validates the implementation.
