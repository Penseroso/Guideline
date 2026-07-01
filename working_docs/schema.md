# Minimal Data Model

Document status: Draft

Schema model version: `0.2.0`

## Purpose and scope

This document defines the minimum data model for preserving regulatory guideline content as traceable structured data. The model is based on the current ICH M10 pilot design scope:

- `3.2.5.2 Evaluation of Accuracy and Precision`
- `6.1 Partial Validation`

The model is intended for source preservation and knowledge structuring. It is not a regulatory decision engine and must not create requirements, recommendations, study-design advice, or suitability conclusions that are not present in the source.

Model `0.2.0` is implemented as a machine-validatable JSON bundle contract with JSON Schema plus reusable validation rules. It does not define full-guideline extraction, database storage, search, embeddings, regulatory decision logic, or an application interface.

## Core principles

- Preserve source text before semantic interpretation.
- Use `SourceUnit` as the base archival unit, not `Requirement`.
- Represent a requirement only as `KnowledgeRecord.record_type=requirement` when supported by source text.
- Keep source text, Korean normalization, quantitative criteria, conditions, exceptions, footnotes, and cross-references structurally separate.
- Store Korean normalization only on `KnowledgeRecord`.
- Use `review_status` for record review state and `value_status` for uncertain typed values.
- Store typed values as actual typed values or `null`; do not place status strings such as `unknown` or `needs_review` in typed fields.
- Preserve exact source fractions as structured fractions rather than approximate decimals when the source provides an exact fraction.
- Treat each structured JSON file as a self-contained bundle for non-cross-reference relationships.

## Shared status values

### review_status

`review_status` is the only review state field in the minimum model.

Allowed values:

- `unreviewed`
- `needs_review`
- `reviewed`

### value_status

`value_status` describes the state of a specific value when the field itself is typed or may be unavailable.

Allowed values:

- `known`
- `unknown`
- `not_applicable`
- `needs_review`

Typed fields such as numbers, dates, page indexes, percentages, and object indexes must contain a valid typed value or `null`. If the value is absent or uncertain, use `null` plus the appropriate `value_status`.

The following fields use the `value_status` vocabulary:

- `section_order_status`
- `unit_order_status`
- `pdf_page_index_status`
- `printed_page_label_status`
- `QuantitativeCriterion.value_status`

For typed values governed by `value_status`:

- `known` requires a non-null typed value.
- `unknown`, `not_applicable`, and `needs_review` require the typed value to be `null`.
- `QuantitativeCriterion` has special exact-fraction rules described below.

## Bundle contract

Each structured JSON file is a self-contained bundle with these required top-level arrays:

- `documents`
- `sections`
- `source_units`
- `knowledge_records`
- `quantitative_criteria`
- `conditions`
- `cross_references`

All non-`CrossReference` relationships must resolve inside the same file. Repeated `Document` records across a validation set are allowed only when every field is identical. Repeated `Section` IDs across a validation set are allowed only when the `Section` objects are identical and the section is context-only in every bundle where it appears. A context-only section is referenced by another `Section.parent_section_id` in that bundle and is not directly used by any `SourceUnit.section_id` in that bundle. Repeated leaf or directly structured sections are rejected even when identical. All other primary object IDs must be unique across the validation set.

Resolved `CrossReference.target_id` values must exist in the validated archive. External, not-yet-structured, or uncertain targets must use `target_id=null` with `resolution_status=unresolved` or `resolution_status=needs_review`.

Within each section, `SourceUnit` records with `unit_order_status=known` must appear in deterministic increasing `unit_order` order and must not reuse the same order value.

## Objects

### Document

Represents one source guideline document.

Core fields:

- `document_id`: Stable archive ID, for example `ich_m10`.
- `title`: Document title.
- `guideline_code`: Guideline code, for example `M10`.
- `issuing_body`: Issuing organization, for example `ICH`.
- `document_version_label`: Version or publication label as supported by the source.
- `source_file_path`: Path to the immutable source file.
- `source_file_checksum`: Checksum of the source file used for extraction or review.
- `schema_model_version`: Model version used for records derived from the document. Current value: `0.2.0`.

### Section

Represents a source section heading and its position in the document hierarchy.

Core fields:

- `section_id`: Stable section ID, for example `ich_m10.sec.3_2_5_2`.
- `document_id`: Parent document ID.
- `section_number`: Printed section number, for example `3.2.5.2`.
- `title`: Section title.
- `parent_section_id`: Parent section ID, or `null` for top-level sections.
- `section_order`: Numeric order within the document, or `null` if not confirmed.
- `section_order_status`: Status of `section_order` using the `value_status` vocabulary.
- `heading_source_unit_id`: Optional source unit ID for the source heading text, or `null` if no heading source unit exists or the link is not confirmed.

`heading_source_unit_id`, when present, must reference an existing `SourceUnit` in the current archive, and that source unit must have `unit_type=heading`.

### SourceUnit

Represents the minimum source-preservation unit. All semantic records must retain a link to one or more `SourceUnit` records.

Core fields:

- `source_unit_id`: Stable source unit ID, for example `ich_m10.su.3_2_5_2.001`.
- `document_id`: Parent document ID.
- `section_id`: Parent section ID.
- `unit_type`: One of `heading`, `paragraph`, `list_item`, `table_cell`, `footnote`.
- `unit_order`: Numeric order within the section, or `null` if not confirmed.
- `unit_order_status`: Status of `unit_order` using the `value_status` vocabulary.
- `source_text`: Preserved source text.
- `related_source_unit_ids`: Related source units needed to complete meaning, such as a footnote linked to a table cell.
- `table_context`: Optional table context, used only when `unit_type=table_cell`; otherwise `null`.
- `trace`: Source trace object.
- `review_status`: Review state.

`table_context` fields:

- `table_id`
- `row_index`
- `column_index`
- `row_header_text`
- `column_header_text`

For every `SourceUnit` where `unit_type` is not `table_cell`, `table_context` must be `null`.

`trace` fields:

- `source_file_path`
- `document_id`
- `section_id`
- `pdf_page_index_zero_based`
- `pdf_page_index_status`
- `printed_page_label`
- `printed_page_label_status`
- `extraction_method`

PDF page positions are provisional until reviewed. `pdf_page_index_zero_based` may be an integer or `null`; its status is stored in `pdf_page_index_status`. `printed_page_label` may be a string or `null`; its status is stored in `printed_page_label_status`.

`printed_page_label` preserves the page label displayed in the document. Do not convert Roman numerals, appendix labels, or other page labels into numbers. Do not perform meaning-level normalization beyond trimming leading and trailing whitespace.

Footnotes are represented as `SourceUnit.unit_type=footnote`. There is no separate `Footnote` object in the minimum model.

### KnowledgeRecord

Represents a semantic statement derived from source text. A `KnowledgeRecord` may be based on one or more `SourceUnit` records.

Core fields:

- `knowledge_record_id`: Stable semantic record ID.
- `source_unit_ids`: One or more supporting source unit IDs.
- `record_type`: One of `requirement`, `recommendation`, `description`, `definition`, `example`, `scope_statement`.
- `modality`: One of `must`, `should`, `may`, `none`, `other`.
- `original_modal_text`: Source wording supporting the modality, or `null`.
- `subject`: Statement subject, or `null`.
- `action`: Statement action, or `null`.
- `object`: Statement object, or `null`.
- `normalized_ko`: Korean normalized text, optional and nullable.
- `review_status`: Review state.

`record_type` and `modality` are independent. For example, descriptive or rationale text without a modal verb should use `record_type=description` and `modality=none`.

Modality assignment guidance:

- `may` is for permission or allowance, not every occurrence of "can".
- Indirect or non-enum modal wording uses `modality=other` with `original_modal_text` preserving the source wording.
- Non-modal descriptive wording uses `modality=none` and `original_modal_text=null`.
- Preserve the source wording in `original_modal_text` when `modality=other`.

### QuantitativeCriterion

Represents a structured quantitative criterion derived from source text.

Core fields:

- `criterion_id`: Stable quantitative criterion ID.
- `source_unit_id`: Source unit containing the criterion.
- `knowledge_record_id`: Related semantic record ID, or `null` if not yet linked.
- `parameter`: Parameter being constrained, for example accuracy or precision.
- `comparator`: Comparator, for example `within`, `not_exceed`, `at_least`.
- `value`: Numeric value, or `null` if unavailable or uncertain.
- `value_fraction`: Exact fraction object, or `null`.
- `unit`: Unit, for example `%`, or `null`.
- `value_status`: Status of the typed value.
- `denominator_or_reference`: Reference basis, for example nominal concentration, total QCs, or concentration level.
- `condition_ids`: Conditions or exceptions that affect the criterion.
- `source_text`: Source text supporting the criterion.
- `review_status`: Review state.

`value_fraction` fields:

- `numerator`
- `denominator`

`denominator` must be an integer greater than zero.

For `QuantitativeCriterion`:

- `value_status=known` requires exactly one of non-null `value` or non-null `value_fraction`.
- `value_status=unknown`, `not_applicable`, or `needs_review` requires both `value` and `value_fraction` to be `null`.
- Exact source expressions such as `2/3` use `value=null`, `value_fraction={"numerator":2,"denominator":3}`, `unit="fraction"`, and preserve the exact source expression in `source_text`.
- `denominator_or_reference` retains the reference basis, such as total QCs, when applicable.

Use multiple `QuantitativeCriterion` records when one sentence contains both a general criterion and an exception criterion, such as a general threshold and an LLOQ threshold.

`QuantitativeCriterion` uses `condition_ids` only. There is no separate `exception_ids` field.

### Condition

Represents an applicability condition, scope condition, precondition, or exception.

Core fields:

- `condition_id`: Stable condition ID.
- `source_unit_id`: Source unit containing the condition.
- `condition_text`: Source text supporting the condition.
- `condition_type`: One of `applicability`, `scope`, `precondition`, `exception`.
- `applies_to_ids`: IDs of records affected by the condition.
- `review_status`: Review state.

In the minimum model, `applies_to_ids` may reference only these object types:

- `SourceUnit`
- `KnowledgeRecord`
- `QuantitativeCriterion`

If `condition_type=exception`, `applies_to_ids` must contain at least one ID.

There is no separate `Exception` object in the minimum model. Exceptions are represented with `Condition.condition_type=exception`.

### CrossReference

Represents a source cross-reference to another section, table, figure, document, or guideline.

Core fields:

- `xref_id`: Stable cross-reference ID.
- `source_unit_id`: Source unit containing the reference.
- `raw_reference_text`: Required source reference text.
- `target_type`: One of `section`, `table`, `figure`, `document`, `guideline`, `unknown`.
- `target_document_label`: Optional label for an external or referenced document.
- `target_id`: Existing archive target ID, or `null`.
- `resolution_status`: One of `resolved`, `unresolved`, `needs_review`.
- `review_status`: Review state.

`target_id` must contain only IDs that actually exist in the current archive.

Use `resolution_status=resolved` only when `target_id` exists in the current archive. Use `resolution_status=unresolved` when the reference target is clear but has not yet been structured in the archive; in that case set `target_id=null`. Use `resolution_status=needs_review` when the target interpretation, `target_type`, or target scope is uncertain.

## Validation contract

The machine-validatable contract for model `0.2.0` is split between JSON Schema and a reusable validator.

JSON Schema validates object structure, required fields, primitive and nullable types, controlled vocabularies, additional-property rejection, model version `0.2.0`, local value/status combinations, and positive fraction denominators.

The reusable validator validates JSON parsing, JSON Schema conformance, object ID uniqueness, reference resolution, self-contained bundle rules, repeated `Document` and `Section` consistency across files, `SourceUnit` ordering, provenance consistency, value/status consistency, and actionable non-zero failures.

## Relationships

- `Document` contains many `Section` records.
- `Section` contains many `SourceUnit` records.
- `Section.heading_source_unit_id` links a section to the source unit preserving its heading text when available.
- `SourceUnit` is the source anchor for all derived records.
- `KnowledgeRecord.source_unit_ids` links semantic statements to one or more source units.
- `QuantitativeCriterion.source_unit_id` preserves the direct source anchor.
- `QuantitativeCriterion.knowledge_record_id` links a criterion to a semantic statement when available.
- `QuantitativeCriterion.condition_ids` links criteria to applicability conditions or exceptions.
- `QuantitativeCriterion.value_fraction` preserves exact source fractions without replacing them with approximate decimals.
- `Condition.applies_to_ids` links conditions to affected source units, semantic records, or quantitative criteria.
- `CrossReference.source_unit_id` preserves the source anchor for reference text.
- `CrossReference.target_type` classifies the referenced target, and `CrossReference.resolution_status` records whether the target has been resolved to an existing archive ID.

## ID conventions

Use stable, human-readable IDs that include the document ID and object type.

Suggested patterns:

- `document_id`: `ich_m10`
- `section_id`: `ich_m10.sec.3_2_5_2`
- `source_unit_id`: `ich_m10.su.3_2_5_2.001`
- `knowledge_record_id`: `ich_m10.kr.3_2_5_2.001`
- `criterion_id`: `ich_m10.qc.3_2_5_2.001`
- `condition_id`: `ich_m10.cond.3_2_5_2.001`
- `xref_id`: `ich_m10.xref.3_2_5_2.001`

Do not encode review status, extraction status, or mutable interpretation into IDs.

## Extension notes

The model should remain usable beyond M10 for ICH M3(R2), S6(R1), and S9. Those guidelines may contain more condition-, exception-, species-, study-type-, and development-stage-centered language than the M10 pilot sections.

For the minimum model, such content should be represented through:

- `KnowledgeRecord.record_type`
- `KnowledgeRecord.modality`
- `Condition.condition_text`
- `Condition.condition_type`
- `Condition.applies_to_ids`

Guideline-specific controlled vocabularies for condition types, species, study type, product type, or development stage should be added only after actual sample records show that free-text conditions are insufficient.
