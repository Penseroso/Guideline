# Minimal Data Model

Document status: Draft

Schema model version: `0.5.0`

## Purpose and scope

This document defines the minimum data model for preserving regulatory guideline content as traceable structured data, and grounds the retrieval/answer layer built on top of it (`engine/`, `docs/product_roadmap.md`). See `docs/milestone_log.md` for the current, up-to-date list of reviewed sections and guidelines — this file describes the model, not a snapshot of coverage, which changes faster than this document is updated.

The model is intended for source preservation and knowledge structuring. It is not a regulatory decision engine and must not create requirements, recommendations, study-design advice, or suitability conclusions that are not present in the source.

Model `0.5.0` is implemented as a machine-validatable JSON bundle contract with JSON Schema (`data/schemas/guideline_bundle.schema.json`) plus a reusable validator (`validation/validate_structured_data.js`). It defines source preservation and knowledge structuring only — extraction/verification agents, retrieval, and generation live in `engine/`, not in this model.

An earlier derived-layer design (AmendmentMapping, EffectiveRecord, a family/edition registry) was explored but never adopted into the product build, so it is not described here as current.

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
- `schema_model_version`: Model version used for records derived from the document. Current value: `0.5.0`.

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

For continued tables, `row_index` and `column_index` are manually reviewed source coordinates within the logical table. They preserve the reviewed table position and are not required to be automatically derivable from extraction order.

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

`related_source_unit_ids` may be directional and need not be reciprocal. For example, a table cell may link to a footnote needed to complete its meaning without requiring the footnote source unit to link back to every referring cell.

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

Record-type classification for evaluative language:

- Use `record_type=recommendation` when the statement determines the selection, allowance, exclusion, necessity, sufficiency, justification, or appropriateness of a regulatory action, study, method, or evidence.
- Use `record_type=description` only when the statement describes information value, function, capability, or factual characteristics without directing a regulatory choice.
- `record_type` and `modality` remain independent: a statement can be a `recommendation` while its modality is `other`.
- Preserve non-enum evaluative wording — for example `appropriate`, `sufficient`, `justified`, `critical`, `prudent`, `recommended`, `not warranted`, `there is no need`, and `calls for` — with `modality=other` and the exact wording in `original_modal_text`. Do not convert these expressions to `must`, `should`, or `may`.
- Use `record_type=example` with `modality=none` for one item of an enumerated list introduced by a framing sentence (e.g. "typical modifications ... include, but are not limited to, the following"). Link only that item's own source unit, not the framing sentence's — and do not restate the framing sentence's scope claim (e.g. "is a typical modification applicable to X") as the item's own `action`; that claim belongs to the framing sentence, not to each list item, so asserting it per-item fails citation verification against the item's own source text. Keep the action minimal (e.g. `includes`), matching the framing's own list relationship rather than re-deriving it (established pattern: `ich_m10.kr.6_1.005`-`007`).

### QuantitativeCriterion

Represents a structured quantitative criterion derived from source text.

Core fields:

- `criterion_id`: Stable quantitative criterion ID.
- `source_unit_id`: Source unit containing the criterion.
- `knowledge_record_id`: Related semantic record ID, or `null` if not yet linked.
- `parameter`: Parameter being constrained, for example accuracy or precision.
- `comparator`: One of `within`, `not_exceed`, `at_least`, `equals`. Use `equals` for an exact count or value stated as such (e.g. "two relevant species," "a single species") — `at_least`/`not_exceed` assert an open-ended bound that a source stating an exact number does not.
- `value`: Numeric value, or `null` if unavailable or uncertain.
- `value_fraction`: Exact fraction object, or `null`.
- `unit`: Unit, for example `%`, or `null`.
- `value_status`: Status of the typed value.
- `denominator_or_reference`: Reference basis, for example nominal concentration, total QCs, or concentration level.
- `condition_ids`: Conditions or exceptions that affect the criterion.
- `joint_with_ids`: Other `QuantitativeCriterion` records that, together with this one, jointly restate a single compound source statement (all must hold at once — not alternatives, not a general-rule/exception pair). Empty array when this criterion is independent.
- `is_default_with_exception`: `true` when this value is the normal/typical case rather than an absolute bound, and the source recognizes a specific exception that may permit a different value. Requires at least one entry in `condition_ids` (the exception itself). `false` for the ordinary case (the current, unqualified meaning of `comparator`+`value`).
- `is_illustrative_example`: `true` when the source introduces this value only as one example (e.g. "e.g., a repeated dose toxicity study of ≤14 days") of a broader, less specific requirement, not itself a specified threshold. `false` for the ordinary case.
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

Use multiple `QuantitativeCriterion` records when one sentence contains both a general criterion and an exception criterion, such as a general threshold and an LLOQ threshold. Do not link a general criterion and its own exception via `joint_with_ids` — they are alternatives (the exception's circumstance excludes the general one), not a compound statement that must hold all at once. `joint_with_ids` is reserved for records that split one sentence's *concurrent* numeric facts, such as a count-fraction threshold and the tolerance value that fraction must meet (e.g. "at least 2/3 of QCs... within ±15%").

`joint_with_ids` must be declared reciprocally: if `A.joint_with_ids` includes `B`, `B.joint_with_ids` must include `A`. This is enforced by the validator (`validation/validate_structured_data.js`) so the relationship is always a grounded, extractor-time fact rather than inferred later from incidental structural similarity (e.g. a shared `knowledge_record_id`), which was found to produce false positives (`docs/milestone_log.md` M1: a general accuracy criterion and its own LLOQ exception were once wrongly inferred as "jointly applicable" from a shared `knowledge_record_id` alone).

`QuantitativeCriterion` uses `condition_ids` and `joint_with_ids` only. There is no separate `exception_ids` field.

When `is_default_with_exception=true`, link the exception `Condition` into **this** (the default) record's own `condition_ids` too, not only onto a separately-extracted exception record — the default value's own claim needs that link to read correctly (e.g. "normally 2 species (qualified by: one relevant species may suffice in certain justified cases)"), and the validator requires it.

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

When source wording contains both an applicability condition and an explicit cross-reference, the condition should normally apply to the related `KnowledgeRecord`, not directly to the `CrossReference`. `CrossReference` preserves the reference target and resolution state; `Condition` preserves applicability of the source statement.

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

For an unresolved external section reference, preserve the exact `raw_reference_text`, use `target_type=section`, set `target_document_label` to the external document label when available, set `target_id=null`, and use `resolution_status=unresolved` when the target is clear.

## Validation contract

The machine-validatable contract for model `0.5.0` is split between JSON Schema and a reusable validator.

JSON Schema validates object structure, required fields, primitive and nullable types, controlled vocabularies, additional-property rejection, model version `0.5.0`, local value/status combinations, and positive fraction denominators.

The reusable validator validates JSON parsing, JSON Schema conformance, object ID uniqueness, reference resolution, self-contained bundle rules, repeated `Document` and `Section` consistency across files, `SourceUnit` ordering, provenance consistency, value/status consistency, and actionable non-zero failures.

Use `npm run validate -- <json-file> [json-file ...]` to validate explicit files. Use `npm run validate:pilots` to discover and validate all JSON files under `data/pilots/` without relying on shell wildcard expansion.

## Relationships

- `Document` contains many `Section` records.
- `Section` contains many `SourceUnit` records.
- `Section.heading_source_unit_id` links a section to the source unit preserving its heading text when available.
- `SourceUnit` is the source anchor for all derived records.
- `KnowledgeRecord.source_unit_ids` links semantic statements to one or more source units.
- `QuantitativeCriterion.source_unit_id` preserves the direct source anchor.
- `QuantitativeCriterion.knowledge_record_id` links a criterion to a semantic statement when available.
- `QuantitativeCriterion.condition_ids` links criteria to applicability conditions or exceptions.
- `QuantitativeCriterion.joint_with_ids` links criteria that jointly restate one compound source statement; always reciprocal.
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

## Deliberate non-extraction (not an omission)

A recall/completeness audit (`docs/milestone_log.md` M1, 2026-08-18) found real omissions in `s6_r1_species_selection.json` and also surfaced a separate category that looks like an omission but isn't one: source text that is deliberately not given its own `KnowledgeRecord`/`Condition`. Three patterns, confirmed against actual source text, not to be re-flagged as missing in future audits unless the specific instance carries independent, freestanding regulatory content:

- **Narrative/scene-setting sentences** with no discrete regulatory content of their own (e.g. "In recent years, there has been much progress in the development of animal models that are thought to be similar to the human disease.") — context for the sentences that follow, not itself an assertion to preserve separately.
- **Incidental parentheticals embedded in another sentence's directive** (e.g. "(choice of species to be justified by the sponsor)" inside a sentence about when a short-term safety study can be considered) — part of the host sentence's own record, not a separate `Condition`.
- **Concessive framing clauses** ("even where X may be necessary...") that set up a contrast rather than state a precondition — read as prose framing, not a `Condition.condition_type=precondition`.

A compound sentence combining a descriptive clause and a regulatory determination (e.g. "X may be misleading and are discouraged") is not split into two `KnowledgeRecord`s and does not need a new `record_type` value to hold both senses — merge into one record's `action`/`original_modal_text` (already-established pattern, e.g. `ich_s6_r1.kr.part2.2_2.006`), keeping `record_type` set to whichever sense is the operative regulatory determination.

## Model 0.3.0: `QuantitativeCriterion.joint_with_ids`

Added 2026-08-18 (`docs/milestone_log.md` M1) after a verification-agent investigation found that the "is this criterion part of a larger compound statement" relationship had no grounded representation anywhere in the archive — it was being inferred after the fact from incidental structural similarity (a shared `knowledge_record_id`, overlapping `condition_ids`), and that inference was demonstrably wrong at least once (grouping a general rule with its own exception as if they were concurrent facts). A schema change was considered and rejected for the underlying values themselves — `QuantitativeCriterion` still holds exactly one of `value`/`value_fraction` per record, because the sub-facts of a compound statement (e.g. a count-fraction threshold and the tolerance it must meet) are independently true and may vary independently in a future amendment, and merging them into one multi-value record would only relocate the same complexity, not remove it. What the archive was actually missing was a place to *state* the joint relationship as a fact grounded at extraction time, instead of leaving it to be inferred later. `joint_with_ids` fills that gap as an additive, reciprocal-only link field; it does not replace or loosen the existing one-value-per-record rule.

## Model 0.4.0: `QuantitativeCriterion.is_default_with_exception` / `is_illustrative_example`

Added 2026-08-19 (`docs/milestone_log.md` M1) after live extraction+verification runs on S6(R1) §3.3 surfaced two real patterns `comparator` alone can't represent, both reproducing consistently across repeated runs:

1. **Default value with a recognized exception** — "Safety evaluation programs should normally include two relevant species... in certain justified cases one relevant species may suffice." `comparator` (`within`/`not_exceed`/`at_least`) always asserts an unconditional bound, so this always read as a false claim and failed verification. This is a genuinely different pattern from the already-working "general rule + exception, as two separate records" case (e.g. the M10 3.2.5.2 accuracy pair, `within ±15%` general / `within ±20%` at the LLOQ): there, the general record's own `denominator_or_reference` already excludes the exception's domain ("...except LLOQ"), so the two records partition the space and neither contradicts the other. The species-count case has no such partition — it's the same question, sometimes answered differently — so it needed its own field, not reuse of the existing general/exception pattern.
2. **Illustrative example, not a specified value** — "...e.g., a repeated dose toxicity study of ≤14 days duration" as one example of a "limited toxicity evaluation," not itself a specified requirement. This exact record already existed in the reviewed archive (`ich_s6_r1.qc.part1.3_3.001`), accepted under the pre-agent-pipeline human review process; live re-verification correctly rejects it as currently modeled, since nothing distinguishes an asserted threshold from an illustrative one.

A single combined enum (e.g. `criterion_type: specified|default|illustrative`) was considered and rejected: the two patterns are not the same axis. A default-with-exception value still carries real prescriptive force (it's the recommended answer, just not absolute); an illustrative-example value carries none (it's one instantiation of a broader, unspecified requirement). Collapsing them into one field would either conflate two different strengths of claim or need an unevidenced third "both" state. Two independent boolean fields, both defaulting to `false` (today's existing, unchanged meaning), keep the axes separate and are fully additive — no existing record's meaning changes.

`is_default_with_exception=true` requires a non-empty `condition_ids` (enforced by `validation/validate_structured_data.js`), mirroring `Condition.condition_type=exception` already requiring non-empty `applies_to_ids` — a claimed default with no linkable exception is a contradiction. `is_illustrative_example` has no such requirement; it's independent of whether the value happens to be conditioned.

## Model 0.5.0: `QuantitativeCriterion.comparator=equals`

Added 2026-08-19 (`docs/milestone_log.md` M1), closing the third comparator-semantics gap found in the same S6(R1) §3.3 live-verification round that produced Model 0.4.0. Once the 0.4.0 fields removed the false-conjunction noise obscuring it, every remaining rejection converged on one clean pattern: a source stating an *exact* count ("two relevant species," "a single species," "one relevant species may suffice") was rendered as `at_least N`, which the verifier correctly read as asserting an open-ended floor ("N or more is fine") the source never stated.

Unlike `is_default_with_exception`/`is_illustrative_example` (modifiers layered on top of an existing `comparator`+`value` pair), an exact count is a genuinely different *comparator relationship*, not a modifier — so it's added as a fourth `comparator` enum value, `equals`, rather than another boolean field. No existing record needed migration to it; all 15 existing `QuantitativeCriterion` records already use `within`/`not_exceed`/`at_least` correctly for genuinely open-ended bounds.

## Model 0.6.0: Hierarchical Scope and Applicability Ontology

Added 2026-08-19 (`docs/milestone_log.md` M2) after M2 real-usage query analysis showed that flattening records into naked values caused cross-domain semantic contamination (e.g. queries about small-molecule species selection matching biotechnology-specific study duration criteria). 

The 5-dimensional Scope Ontology models applicability as a first-class property derived from the document and section hierarchy:

1. **`molecule_scope`**: `biotechnology` (biologics, mAbs, proteins) | `small_molecule` (chemicals, synthetics) | `all`
2. **`study_context_scope`**: `nonclinical_safety` | `bioanalytical_validation` | `early_clinical_fih` | `clinical_immunogenicity`
3. **`assay_technology_scope`**: `chromatography` (LC-MS/MS, GC) | `ligand_binding_assay` (LBA, ELISA) | `ada_multi_tiered` | `in_vivo_toxicology` | `none`
4. **`topic_scope`**: `species_selection` | `study_duration` | `acceptance_criteria` | `starting_dose` | `partial_validation`
5. **`explicit_exclusions` (Negative Scope)**: Hard-exclusion filters preventing cross-domain false positives (e.g. S6 excludes `small_molecule`, FDA ADA excludes `nonclinical` and `small_molecule`, EMA FIH excludes `atmp`).

These fields are deterministically synthesized at load time from `Document` and `Section` ancestor trees (`engine/data_store.js`), and enforced via a multi-dimensional **Scope Guard** in `engine/query_router.js`.

## Applicability Layer 0.1.0 (in progress, M6 — Regulatory World Model spike)

Added 2026-08-25 (`docs/milestone_log.md` M6). A derived, additive layer that evaluates whether a specific rule (`KnowledgeRecord`/`QuantitativeCriterion`) applies given a structured **RegulatoryContext**, using the archive's existing `Condition` records as the evidence base — moving from "search guidelines and answer" toward "given this regulatory context, which rules apply and why." Model 0.6.0's scope ontology is a document/section-level classification; this layer is a rule-level, `Condition`-level one, and the two are independent additions to the same graph.

**Independently versioned from the source model** (same separation principle `history/derived_contract/derived_contract_module_3_6.md` established for the earlier, since-archived derived-contract layer: "AmendmentMapping and EffectiveRecord must not be added to `guideline_bundle.schema.json`"). `applicability_model_version: "0.1.0"` never appears in `guideline_bundle.schema.json` or any `data/pilots/*.json` file — this layer only ever reads the source archive, never writes to it.

**Three new artifacts, all under `data/ontology/` and `data/derived/` (outside `data/pilots/`, since `validation/validate_pilots.js`'s `discoverJsonFiles` recursively treats everything under `data/pilots/` as a bundle to be schema-validated and loaded — new files must live outside that tree)**:

- `data/ontology/document_scope_profiles.json` — the Model 0.6.0 document/section classification table, moved out of a hardcoded if/else chain in `engine/data_store.js` (`deriveRecordScope()`) into data. Behavior-preserving except two fixes made in the same change: (1) document matching is now exact `document_id` equality instead of `docId.includes("s6")`-style substring matching (closes a latent false-positive risk); (2) `topic_rules` gained FDA-ADA-specific entries, closing the gap where all 132 FDA ADA `KnowledgeRecord`s fell through to `topic_scope="general"` because no branch in the old chain ever matched an FDA ADA section path — verified via a full 866-record parity diff against the prior hardcoded logic: 199 diffs, all in `fda_ada`, all `general` → one of `multi_tiered_testing`/`cut_point`/`drug_tolerance`/`neutralizing_antibody`; zero diffs on any other document or dimension.
- `data/ontology/context_slots.json` — the RegulatoryContext slot vocabulary (`program_slots`: `molecule_class`, `product_modality`, `development_stage`, `route_of_administration`, `regulatory_authority`, `question_domain`; `program_finding_slots`: `relevant_species_availability`, `target_nature`, `tcr_study_feasible`, `conjugated_toxin_novelty`, `subject_population`, `assay_tier`), plus a separate `retrieval_slots` section that table-ifies the pre-existing Option A/B query-scope keyword chain (`engine/text_utils.js` `extractQueryScope`) without changing its behavior (verified against 52 real and synthetic queries, 0 diffs). The two are kept in separate top-level keys deliberately: `retrieval_slots` answers "which existing records should this query retrieve," `program_slots`/`program_finding_slots` answer "what does the user's program actually look like" — conflating them would make the Applicability Engine implicitly dependent on Option A/B's retrieval routing.
- `data/schemas/condition_binding.schema.json` + `data/derived/condition_bindings/<document_id>.json` — a `Condition` → context-predicate binding. Validated by `validation/validate_bindings.js` (`npm run validate:bindings`): schema shape, cross-file `binding_id` uniqueness, `condition_id` existence in the live archive, `evidence_span` verbatim-substring-of-`condition_text` (the same grounding-gate philosophy as the source archive's citation verification, applied to this derived layer), and predicate slot/value membership in `context_slots.json`.

**`verification_status` (binding) is a deliberately separate vocabulary from `review_status` (source record)**: `review_status` describes a source record's own review state; `verification_status ∈ {verified, needs_review}` describes only whether a derived binding passed the automated binding pipeline's gates (`engine/binding_agent.js`). The binding schema has no `review_status` field at all, to make the name collision structurally impossible rather than a documentation-only caveat.

**`binding_role ∈ {full_scope, partial_scope, exception}` controls which verdict a binding is allowed to produce** — this is the layer's central guardrail against overclaiming a rule doesn't apply:

- `exception`: derived deterministically from `Condition.condition_type = "exception"`, never proposed by the model — a structural fact, not a judgment call.
- `full_scope`: this one condition, alone, is the *complete* applicability boundary for the rule it qualifies. Only reachable after passing a dedicated stricter check (a separate LLM call weighing sibling conditions on the same rule, `engine/binding_agent.js` `checkFullScopeGate`) — and a condition with no target rule at all (`applies_to_ids` empty) is demoted without even attempting that check, since there is nothing to confirm "full scope of" in the first place.
- `partial_scope`: the conservative default for every other bindable condition. A `partial_scope` predicate evaluating false narrows the applicability engine's verdict to `conditional`, never `not_applicable` — only a `full_scope` (or `exception`) predicate can produce `not_applicable`. This was a deliberate correction during design review: an earlier draft let *any* bindable predicate evaluating false produce `not_applicable`, which overclaims on a `Condition` archive that is 279 records deep but only ~71 planned for binding in the M6 spike slice — most rules have conditions this layer hasn't evaluated yet, and treating a `partial_scope` mismatch as "does not apply" would assert something the incomplete binding coverage doesn't support.

**Automated binding pipeline (`engine/binding_agent.js`)** — same extraction/verification separation `product_roadmap.md` §2.5.1 already established for the source archive, applied to this derived layer instead of a manual/seeded process: (1) LLM proposes `bindability`/`non_bindable_reason`/`binding_role`/predicate/`evidence_span` for one `Condition`; (2) a deterministic gate checks schema shape, `evidence_span` substring, and slot/value vocabulary membership; (3) a separate verification-agent call (reusing `verification_agent.js`'s `verifyClaim`, not a new entailment mechanism) checks the predicate's natural-language restatement is actually entailed by `condition_text`; (4) a proposed `full_scope` role is never trusted from step 1 alone — it must additionally pass step 4's stricter gate or is demoted (never rejected) to `partial_scope`; (5) `verification_status="verified"` only if every gate passed, otherwise `needs_review` — kept and visible, never discarded. The S6(R1) slice runs through this same pipeline first and is used as a regression fixture for the EMA FIH and FDA ADA slices that follow, but — being agent-authored rather than human-curated — is not treated as golden ground truth the way the hand-reviewed source archive is.

Status: `engine/data_store.js`, `engine/text_utils.js`, `data/schemas/condition_binding.schema.json`, `validation/validate_bindings.js`, `engine/binding_agent.js`, and `engine/applicability.js` (the deterministic evaluator) are implemented and tested. The ICH S6(R1) slice (all 30 conditions) has run through the live binding pipeline (`scripts/bind_conditions.js`) against the real OpenAI-backed archive: 24/30 `verified`, 6/30 `needs_review`, 0 schema violations. Three real defects were found and fixed by that live run before trusting the pipeline, not assumed from design alone:

1. **Claim-wording bug** (`engine/binding_agent.js` `claimTextForBinding`): the first version interpolated a slot's long `description` sentence as if it were a short noun phrase, and asserted "applies only when X" exclusivity the condition text never states — the verifier correctly rejected 13/13 bindable proposals on the first live run. Fixed by adding `value_labels` (short, natural-language paraphrases) to `context_slots.json` and rephrasing the claim as a neutral "describes the following circumstance," and by checking entailment against the binding's own `evidence_span` rather than the full `condition_text` — narrowing the check to exactly the interpretation risk that matters, the same "separate, narrower verification" principle `product_roadmap.md` §2.5.1 already established for the source archive.
2. **`resolveBindingRole` precedence bug**: `condition_type="exception"` was checked before `bindability`, so a Condition whose source schema type is structurally "exception" but whose actual wording is genuinely non-machine-bindable (e.g. "unless there is a scientific rationale for using non-rodents" — an expert-judgment hedge) got forced into `binding_role="exception"` even when the model correctly proposed `non_bindable`. This was both a schema-invalidity bug (the persisted shape violated `non_bindable` ⟹ `binding_role=null`) and a correctness bug (it would have let a hedge-qualified exception deterministically flip a verdict to `not_applicable` with no actual checkable evidence). Fixed by checking `bindability !== "bindable"` first.
3. **Non-schema-valid persistence on a gate failure**: when the model proposed `bindability="non_bindable"` but omitted `non_bindable_reason` (an incomplete proposal correctly caught by the deterministic gate, `verification_status="needs_review"`), the binding object was still persisted with `non_bindable_reason: null` — schema-invalid, even though the pipeline correctly flagged it as unverified. Fixed by adding `finalizeBindingShape()`, which guarantees the *persisted* shape is always structurally schema-valid regardless of what the model proposed (falling back to `expert_judgment_required` / the full `condition_text` / downgrading an empty-predicate "bindable" claim to `non_bindable`), while `runDeterministicGates` still grades the model's raw, unsanitized proposal for `verification_status` — the same separation `engine/pipeline.js` already draws for the source archive ("a record that fails verification... stays `needs_review`... with its rejection reason attached in the parallel verification report, never inside the record itself, which must stay valid against the closed archive JSON Schema").

`engine/applicability.js` itself also had two gaps found during its own implementation review (not live-run failures — caught before any live use): the injected `bindingsByConditionId` test-seam was shadowed and silently ignored in favor of always loading from disk, and the plan's explicit guard — a `needs_review` binding must be exposed in `basis` but must never itself produce `not_applicable` — was never implemented. Both fixed; `conditional_reason="unverified_binding"` is the new value covering a `full_scope`/`exception` binding whose predicate would otherwise disqualify the rule, but which hasn't passed verification yet.

**`conditional_reason` (4 values, `engine/applicability.js`)**: `non_bindable_condition` (a condition attached to the rule is genuinely not machine-evaluable), `partial_scope_mismatch` (a `partial_scope` predicate evaluated false), `unbound_condition` (a condition is attached but has no authored binding yet — most of the archive's 279 conditions, outside this spike's ~71-condition slice), `unverified_binding` (a `full_scope`/`exception` binding's predicate would otherwise disqualify the rule, but `verification_status="needs_review"` — see finding 3 above). Only the first two were in the original spike design; the latter two were added during implementation once real gaps in binding coverage and verification trust turned out to need their own explicit reason rather than being silently folded into one of the first two or left unhandled.

**Complete as of this entry**: `engine/regulatory_context.js` (RegulatoryContext validation, `matchSlotsFromText`, and a fail-closed `proposeContext` — never a validated context on its own), `engine/applicability_cli.js` (`npm run applicability propose "<question>"` / `evaluate --context <file> --rules <ids>`), `engine/cli.js`'s `:context` command and `--context <file>` flag, `test/fixtures/applicability_cases.json` + `engine/eval_applicability.js` (`npm run eval:applicability`, 29 real cases across all three guidelines, no LLM call, CI-wired). See `docs/milestone_log.md` M6 for the full narrative and `docs/test_record.md` Entry 006 for the measured numbers.

