# Decisions

This document records material project decisions after they are made. It should not be used to record assumptions as decisions.

## Initial Decisions

### DEC-001: Preserve original PDFs as immutable sources

- Date: 2026-06-30
- Status: Accepted
- Decision: Original guideline PDFs are stored under `Guideline Files/` and must not be modified, renamed, moved, or overwritten.
- Rationale: The archive needs a stable highest-authority source for traceability and later verification.

### DEC-002: Use ICH M10 as the pilot document

- Date: 2026-06-30
- Status: Accepted
- Decision: ICH M10 is the current pilot document for building the archive foundation.
- Rationale: The repository currently contains `Guideline Files/ICH M10.pdf` and an initial PDF assessment for that document.

### DEC-003: Keep interpretation separate from source-derived records

- Date: 2026-06-30
- Status: Accepted
- Decision: Source text, normalized Korean text, quantitative criteria, applicability conditions, exceptions, footnotes, cross-references, and interpretation or review notes must remain conceptually and structurally separate.
- Rationale: The archive must preserve source meaning without adding unsupported requirements or recommendations.

### DEC-004: Use SourceUnit as the base archival unit

- Date: 2026-06-30
- Status: Accepted
- Decision: The base archival unit is `SourceUnit`; `Requirement` is not a base object and is represented only as `KnowledgeRecord.record_type=requirement` when supported by source text.
- Rationale: Regulatory guideline text includes descriptions, examples, definitions, scope statements, recommendations, and requirements. Treating every sentence as a requirement would create unsupported regulatory classifications.
- Consequences: All semantic records must retain source-unit traceability.
- Related files: `working_docs/schema.md`

### DEC-005: Separate source preservation from semantic structuring

- Date: 2026-06-30
- Status: Accepted
- Decision: Source-preservation records and semantic knowledge records are separate layers.
- Rationale: Preserved source text must remain independently verifiable and must not be overwritten by normalized text or interpretation.
- Consequences: `SourceUnit` preserves source text; `KnowledgeRecord` stores semantic structure and optional Korean normalization.
- Related files: `working_docs/schema.md`

### DEC-006: Keep Korean normalization only on KnowledgeRecord

- Date: 2026-06-30
- Status: Accepted
- Decision: In the minimum model, `normalized_ko` is stored only on `KnowledgeRecord` and is optional and nullable.
- Rationale: Duplicating Korean normalization on both source and semantic records increases maintenance risk without adding necessary source traceability.
- Consequences: `SourceUnit` remains source-text focused.
- Related files: `working_docs/schema.md`

### DEC-007: Separate record type from modality

- Date: 2026-06-30
- Status: Accepted
- Decision: `record_type` and `modality` are separate fields. `record_type` is limited to `requirement`, `recommendation`, `description`, `definition`, `example`, and `scope_statement`; `modality` is limited to `must`, `should`, `may`, `none`, and `other`.
- Rationale: A semantic statement's function and its modal wording are related but not identical.
- Consequences: Descriptive or rationale text without modal verbs can be represented without misclassifying it as a requirement.
- Related files: `working_docs/schema.md`

### DEC-008: Use review_status and value_status for state

- Date: 2026-06-30
- Status: Accepted
- Decision: The minimum model uses `review_status` for record review state and `value_status` for uncertain typed values. Typed fields must contain actual typed values or `null`, not status strings. Cross-reference target resolution uses a separate `resolution_status` field because it is not a typed-value status.
- Rationale: Keeping state separate from typed values prevents invalid numeric, date, and page fields.
- Consequences: `review_status` is limited to `unreviewed`, `needs_review`, and `reviewed`; `value_status` is limited to `known`, `unknown`, `not_applicable`, and `needs_review`. `section_order_status`, `unit_order_status`, `pdf_page_index_status`, and `printed_page_label_status` use the `value_status` vocabulary.
- Related files: `working_docs/schema.md`

### DEC-009: Represent footnotes and exceptions without separate objects

- Date: 2026-06-30
- Status: Accepted
- Decision: Footnotes are represented as `SourceUnit.unit_type=footnote`; exceptions are represented as `Condition.condition_type=exception`.
- Rationale: The minimum model should avoid extra objects unless needed to prevent information loss.
- Consequences: Footnotes can be linked through `related_source_unit_ids`; exception conditions must use `applies_to_ids`, and exception conditions require at least one target.
- Related files: `working_docs/schema.md`

### DEC-010: Add table context only for table-cell source units

- Date: 2026-06-30
- Status: Accepted
- Decision: `SourceUnit.table_context` is available only when `SourceUnit.unit_type=table_cell` and is `null` for all other source-unit types.
- Rationale: Table cells can lose meaning without row and column context, while non-table source units do not need this field.
- Consequences: `table_context` includes `table_id`, `row_index`, `column_index`, `row_header_text`, and `column_header_text`.
- Related files: `working_docs/schema.md`

### DEC-011: Limit current-stage versioning

- Date: 2026-06-30
- Status: Accepted
- Decision: Current-stage versioning is limited to `document_version_label`, `source_file_checksum`, and `schema_model_version`; the initial `schema_model_version` is `0.1.0`.
- Rationale: Record-level revisioning is premature before sample structured data and validation workflows exist.
- Consequences: Draft state is represented as document status in `schema.md`, not in the version string.
- Related files: `working_docs/schema.md`

### DEC-012: Restrict condition links and unresolved cross-references

- Date: 2026-06-30
- Status: Accepted
- Decision: In the minimum model, `Condition.applies_to_ids` may reference only `SourceUnit`, `KnowledgeRecord`, and `QuantitativeCriterion`. `CrossReference.target_id` may contain only IDs that exist in the current archive. `CrossReference.target_type` classifies the referenced target, and `CrossReference.resolution_status` records whether the target is resolved.
- Rationale: Restricting links prevents unverified references from appearing resolved.
- Consequences: External or not-yet-structured targets preserve `raw_reference_text`, may use `target_document_label`, set `target_id=null`, and use `resolution_status=unresolved` when the target is clear. Use `resolution_status=needs_review` when the target interpretation, target type, or target scope is uncertain.
- Related files: `working_docs/schema.md`

### DEC-013: Simplify page trace fields

- Date: 2026-06-30
- Status: Accepted
- Decision: `SourceUnit.trace` stores the physical PDF page as `pdf_page_index_zero_based` and the displayed document page label as `printed_page_label`, each with its own status field. `pdf_page_number_one_based`, `printed_page_number`, and `page_value_status` are not part of the minimum model.
- Rationale: A one-based PDF page number can be derived from the zero-based index, while printed page labels may include Roman numerals, appendix labels, or other non-numeric strings. Separate status fields prevent one page status from applying incorrectly to multiple page values.
- Consequences: `pdf_page_index_status` and `printed_page_label_status` use the `value_status` vocabulary. `printed_page_label` preserves the displayed label as a string or `null`, with no meaning-level normalization beyond trimming leading and trailing whitespace. `schema_model_version` remains `0.1.0` because this is a review correction before the first baseline model is finalized.
- Related files: `working_docs/schema.md`

### DEC-014: Link sections to heading source units

- Date: 2026-06-30
- Status: Accepted
- Decision: `Section.trace_status` is removed. `Section.heading_source_unit_id` optionally links a section to the source unit preserving its heading text.
- Rationale: A direct link to the heading source unit is more verifiable than a general trace status field.
- Consequences: `heading_source_unit_id` must be `null` or reference an existing `SourceUnit` in the current archive with `unit_type=heading`. If no heading source unit exists or the link is not confirmed, use `null`.
- Related files: `working_docs/schema.md`

### DEC-015: Increment machine-validatable model to 0.2.0

- Date: 2026-07-01
- Status: Accepted
- Decision: The Phase 2 data contract uses `schema_model_version=0.2.0`.
- Rationale: Phase 2 adds machine-validatable bundle rules and a new required `QuantitativeCriterion.review_status` field plus exact fraction support, so unmodified `0.1.0` pilot files are not valid under the new contract.
- Consequences: Existing pilot bundles must update their document model version and migrate quantitative criteria before validation.
- Related files: `working_docs/schema.md`, `structured_data/schemas/guideline_bundle.schema.json`, `scripts/validate_structured_data.js`

### DEC-016: Represent exact source fractions without decimal approximation

- Date: 2026-07-01
- Status: Accepted
- Decision: Exact source fractions are represented with nullable `QuantitativeCriterion.value_fraction` containing integer `numerator` and positive integer `denominator`; `value` remains numeric-or-null.
- Rationale: Source values such as `2/3` are exact and reusable as structured data, while decimal approximation would lose source fidelity and source-text-only storage would leave a confident value unresolved.
- Consequences: `value_status=known` requires exactly one of `value` or `value_fraction`; non-known statuses require both to be `null`.
- Related files: `working_docs/schema.md`, `structured_data/pilots/m10_3_2_5_2.json`

### DEC-017: Clarify modality assignment without changing vocabulary

- Date: 2026-07-01
- Status: Accepted
- Decision: The modality vocabulary remains `must`, `should`, `may`, `none`, and `other`. `may` is reserved for permission or allowance; indirect or non-enum modal wording uses `other` with `original_modal_text`; non-modal descriptive wording uses `none`.
- Rationale: The pilot issues were assignment-guidance issues, not evidence that the controlled vocabulary needs expansion.
- Consequences: The M10 Phase 1 modality review items for "can range", "does not necessarily need to be repeated", and "is warranted" are resolved under this guidance.
- Related files: `working_docs/schema.md`, `structured_data/pilots/m10_6_1.json`

### DEC-018: Validate structured JSON as self-contained bundles

- Date: 2026-07-01
- Status: Accepted
- Decision: Each structured JSON file is a self-contained bundle for all non-`CrossReference` relationships. Repeated `Document` records across a validation set are allowed only when identical. Repeated `Section` IDs are allowed only when the `Section` objects are identical and context-only in every bundle where they appear; context-only means another section references it through `parent_section_id` and no `SourceUnit` directly uses it as `section_id`. All other primary object IDs must be unique across the validation set.
- Rationale: Pilot files need repeated document and ancestor-section context for local traceability, but duplicate semantic or source records across files would make archive identity ambiguous.
- Consequences: Cross-reference targets may resolve across the validated archive only when `resolution_status=resolved`; unresolved or uncertain targets use `target_id=null`.
- Related files: `working_docs/schema.md`, `scripts/validate_structured_data.js`

### DEC-019: Use JSON Schema plus one reusable validator

- Date: 2026-07-01
- Status: Accepted
- Decision: Phase 2 validation uses draft-07 JSON Schema for structural rules and a single Node/Ajv validator script for cross-object and cross-file rules.
- Rationale: This is the smallest maintainable validation architecture in the current repository environment; Node and `npm.cmd` are available, while Python is not reliably available.
- Consequences: `ajv` is the only direct dependency, and validation is run with `npm run validate -- <json files>`.
- Related files: `package.json`, `package-lock.json`, `scripts/validate_structured_data.js`

### DEC-020: Retain model 0.2.0 after structural pressure tests

- Date: 2026-07-01
- Status: Accepted
- Decision: Model `0.2.0` is retained after Phase 2 structural pressure testing.
- Rationale: Minimal probes covering continued Table 1 cells, the related `††` table note, explicit internal and external cross-references, and a compound section `6.2` applicability or exception paragraph produced no demonstrated information loss under the current model.
- Consequences: No JSON Schema, validator, model-version, dependency, or source-PDF change is required from this review. Follow-up is limited to documentation guidance and any later human semantic-classification review.
- Related files: `working_docs/schema.md`, `working_docs/review_log.md`, `structured_data/pilots/m10_phase2_table_pressure.json`, `structured_data/pilots/m10_phase2_reference_condition_pressure.json`

## Decision Template

### DEC-000: Title

- Date: YYYY-MM-DD
- Status: Proposed | Accepted | Superseded
- Decision:
- Rationale:
- Consequences:
- Related files:
