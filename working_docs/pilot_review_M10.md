# Pilot Review: ICH M10 Sections 3.2.5.2 and 6.1

## Pilot Scope and Files

- Source document: `Guideline Files/ICH M10.pdf`
- Structured sections: `3.2.5.2 Evaluation of Accuracy and Precision`; `6.1 Partial Validation`
- Output files: `structured_data/pilots/m10_3_2_5_2.json`; `structured_data/pilots/m10_6_1.json`
- Phase 1 model version: `0.1.0`
- Current migrated model version: `0.2.0`
- Phase 1 out of scope: other ICH M10 sections, JSON Schema, validation scripts, database/search/RAG/web implementation, and source PDF modification.

## PDF Checksum and Model Version

- SHA-256: `E306F3B6DC367EB2913CE242093A8F6C9DCD095A139A9FDB6D6F5E25201FA6AF`
- Conceptual model: `working_docs/schema.md`, `schema_model_version=0.1.0`
- Decisions applied: source immutability, SourceUnit as archival unit, source/semantic separation, status separation, no separate footnote or exception object, and page trace fields from DEC-013.

## Source Coverage and Boundary Verification

- Section `3.2.5.2` was verified on physical PDF page index `13`, printed page label `14`.
- Section `3.2.5.2` starts at heading `3.2.5.2 Evaluation of Accuracy and Precision` and ends immediately before `3.2.6 Carry-over`.
- Section `6.1` was verified on physical PDF page indexes `34` and `35`, printed page labels `35` and `36`.
- Section `6.1` starts at heading `6.1 Partial Validation` after parent heading `6. PARTIAL AND CROSS VALIDATION` and ends immediately before `6.2 Cross Validation`.
- Neighboring text was checked only to confirm boundaries.
- No target-section tables, footnotes, notes, or explicit cross-references were found.
- Source text was manually compared against rendered PDF page images for `±`, bullet markers, `%CV`, `2/3`, `50%`, page labels, and wrapped list items.
- Independent review defects in the `±` and bullet characters were corrected in the pilot JSON.

## Model-Fit Findings

- The model cleanly represents source text with `SourceUnit`, semantic statements with `KnowledgeRecord`, quantitative thresholds with `QuantitativeCriterion`, and applicability or exception text with `Condition`.
- Section `3.2.5.2` quantitative criteria fit the current model without adding fields.
- Section `6.1` bullet lists are represented as `SourceUnit.unit_type=list_item` and `KnowledgeRecord.record_type=example`, with the list lead-ins represented as `scope_statement`; both values are allowed by model `0.1.0`.
- The phrase "can range from as little as one within-run accuracy and precision determination, to a nearly full validation" was not converted into a `QuantitativeCriterion` because the current comparator vocabulary does not define a clean range/minimum representation for "as little as".
- The source expression `2/3` is preserved in `QuantitativeCriterion.source_text`; `value` is `null` and `value_status=needs_review` because model `0.1.0` has no exact fraction value representation.
- The phrase "To enable the evaluation of any trends over time within one run" is preserved in the SourceUnit and KnowledgeRecord context but is not represented as a Condition because it is purpose/rationale rather than applicability, precondition, or exception.
- No inferred cross-references or analyst-derived cross-document mappings were created.

## Needs Review Items

- `ich_m10.kr.6_1.002`: `modality=may` is used for source wording "can range"; review whether `may` or `other` is preferred for this non-deontic capability wording.
- `ich_m10.kr.6_1.003`: `modality=none` is used for "does not necessarily need to be repeated"; review whether this should remain descriptive or use `other`.
- `ich_m10.kr.6_1.023`: `modality=other` is used for "is warranted"; review whether this should be treated as recommendation-like language in downstream validation.
- `ich_m10.qc.3_2_5_2.010`: source value `2/3` is preserved as source text, but exact typed fraction representation needs review.
- No `needs_review` SourceUnit text, page trace, ID, or reference issue remains after manual comparison.

## Object Counts

| Pilot file | Document | Section | SourceUnit | KnowledgeRecord | QuantitativeCriterion | Condition | CrossReference |
|---|---:|---:|---:|---:|---:|---:|---:|
| `structured_data/pilots/m10_3_2_5_2.json` | 1 | 4 | 5 | 14 | 12 | 7 | 0 |
| `structured_data/pilots/m10_6_1.json` | 1 | 2 | 21 | 23 | 0 | 6 | 0 |

## Manual Review Results

- Exact source wording was compared against the rendered PDF pages before finalizing the JSON.
- Printed page labels are stored as strings in `printed_page_label`.
- `normalized_ko` is `null` throughout the pilot.
- `cross_references` arrays are empty because no explicit cross-references occur in the target sections.
- Parent Section records are included only to resolve section hierarchy within each self-contained pilot bundle.
- Repeated `Document` records are intentionally identical across both pilot files.

## Model 0.1.0 Sufficiency for Phase 2

Model `0.1.0` is provisionally sufficient to proceed toward Phase 2 JSON Schema and validation for these two pilot sections after retaining `2/3` as a reviewed model-fit limitation. Phase 2 should clarify modality guidance for non-deontic wording such as "can range", "does not necessarily need", and "is warranted", and decide whether exact fraction support is needed before broader quantitative extraction.

## Phase 2 Migration to Model 0.2.0

- Date: 2026-07-01
- Model migration: both pilot JSON files now use `schema_model_version=0.2.0`.
- Exact fraction resolution: `ich_m10.qc.3_2_5_2.010` now preserves source text `2/3` and represents the typed value as `value_fraction={"numerator":2,"denominator":3}`, with `value=null`, `unit="fraction"`, and `value_status=known`.
- Criterion review status: all `QuantitativeCriterion` records now include required `review_status`; all current pilot criteria are `reviewed`.
- Modality resolution: `ich_m10.kr.6_1.002` uses `modality=other` with `original_modal_text="can range"`; `ich_m10.kr.6_1.003` uses `modality=other` with `original_modal_text="does not necessarily need to be repeated"`; `ich_m10.kr.6_1.023` retains `modality=other` with `original_modal_text="is warranted"`. All three are now `reviewed` under the accepted Phase 2 modality guidance.
- Current validation status: `npm run validate:pilots` passes for the model `0.2.0` pilot bundles.
- No source wording, PDF trace fields, checksum, or pilot section scope was intentionally changed during migration.
