# Pilot Review: ICH S6(R1) Source-Layer Pilot

Status: implemented, pending repository review.

## Structured scope

Implemented bundle: `structured_data/pilots/s6_r1_species_selection.json`

Exact structured scope:

- Part I `3.3 Animal Species/Model Selection`
- Part I directly referenced `Note 1`
- Part II `2 Species Selection`
- Part II `2.1 General Principles`
- Part II `2.2 One or Two Species`
- Part II directly referenced `Note 1`
- Part II directly referenced `Note 2`

No Part II `2.3` content or other adjacent section content was structured.

## Object counts

- `Document`: 1
- `Section`: 8
- `SourceUnit`: 29
- `KnowledgeRecord`: 51
- `QuantitativeCriterion`: 16
- `Condition`: 29
- `CrossReference`: 7

## Source-unit segmentation summary

- Parent Part I `3.3`: 1 heading and 5 paragraph source units.
- Parent Part I `NOTES`: 1 heading and 1 Note 1 paragraph source unit.
- Addendum Part II `2`: 1 heading source unit.
- Addendum Part II `2.1`: 1 heading and 7 paragraph source units.
- Addendum Part II `2.2`: 1 heading and 2 paragraph source units.
- Addendum Part II `NOTES`: 1 heading, 7 Note 1 paragraph source units, and 1 Note 2 paragraph source unit.

Source text was segmented by source paragraph. No selected table cells were present, so all `table_context` values are `null`.

## Page and section coverage

- Part I `3.3`: zero-based PDF indexes `6` and `7`; printed page labels `3` and `4`.
- Part I `Note 1`: zero-based PDF index `12`; printed page label `9`.
- Part II `2`, `2.1`, and first paragraph of `2.2`: zero-based PDF index `14`; printed page label `11`.
- Part II second paragraph of `2.2`: zero-based PDF index `15`; printed page label `12`.
- Part II `Note 1`: zero-based PDF indexes `19` and `20`; printed page labels `16` and `17`.
- Part II `Note 2`: zero-based PDF index `20`; printed page label `17`.

## Semantic classifications requiring review

The following `KnowledgeRecord` objects are marked `needs_review` because recommendation, description, or modality classification is materially ambiguous:

- `ich_s6_r1.kr.part1.3_3.005`
- `ich_s6_r1.kr.part1.3_3.007`
- `ich_s6_r1.kr.part1.3_3.008`
- `ich_s6_r1.kr.part1.3_3.011`
- `ich_s6_r1.kr.part1.3_3.013`
- `ich_s6_r1.kr.part1.notes.002`
- `ich_s6_r1.kr.part2.2_1.005`
- `ich_s6_r1.kr.part2.2_1.008`
- `ich_s6_r1.kr.part2.2_1.010`
- `ich_s6_r1.kr.part2.2_1.011`
- `ich_s6_r1.kr.part2.2_1.012`
- `ich_s6_r1.kr.part2.2_2.002`
- `ich_s6_r1.kr.part2.2_2.004`
- `ich_s6_r1.kr.part2.2_2.005`
- `ich_s6_r1.kr.part2.notes.006`
- `ich_s6_r1.kr.part2.notes.011`

The following `QuantitativeCriterion` objects are marked `needs_review` because model `0.2.0` does not distinguish exact-count constraints from minimum-count constraints:

- `ich_s6_r1.qc.part1.3_3.001`
- `ich_s6_r1.qc.part1.3_3.002`
- `ich_s6_r1.qc.part1.3_3.003`
- `ich_s6_r1.qc.part1.3_3.004`
- `ich_s6_r1.qc.part2.2_1.001`
- `ich_s6_r1.qc.part2.2_2.001`
- `ich_s6_r1.qc.part2.2_2.002`
- `ich_s6_r1.qc.part2.2_2.003`
- `ich_s6_r1.qc.part2.2_2.005`
- `ich_s6_r1.qc.part2.2_2.006`
- `ich_s6_r1.qc.part2.2_2.007`
- `ich_s6_r1.qc.part2.notes.002`
- `ich_s6_r1.qc.part2.notes.003`

## Quantitative-criterion summary

The pilot represents 16 explicit numeric constraints from the selected scope. These cover species counts, rodent and non-rodent species counts, one-species and two-species criteria, `<= 14 days`, `up to 1 month`, and `at least one species`.

Duration constraints with direct upper bounds are represented as reviewed criteria. Exact one-species and two-species source wording is represented with the available `at_least` comparator and marked `needs_review` where the model cannot preserve exact-count semantics. No illustrative example was converted into an unconditional criterion.

## Condition-linkage decisions

- Part II Note 1 unexpected human-tissue binding applies to `ich_s6_r1.kr.part2.notes.014`, which records that evaluation of selected animal tissues can provide supplemental information regarding potential correlations or lack thereof with preclinical toxicity.
- The same unexpected-binding condition is not applied to `ich_s6_r1.kr.part2.notes.013`, which records that tissue cross-reactivity studies using a full panel of animal tissues are not recommended.
- Part II Note 2 `unless the toxin is not active in the rodent` applies to `ich_s6_r1.kr.part2.notes.015`, which records that a rodent is preferred.
- The rodent exception is not applied to `ich_s6_r1.kr.part2.notes.009`, which records the additional unconjugated-toxin study.

## Cross-reference resolution decisions

- Note references are preserved as `CrossReference` records but left `needs_review` with `target_id=null`. Model `0.2.0` has no `Note` target type and the approved scope uses `Part I Notes` and `Part II Notes` as section records rather than separate Note sections.
- `ICH S6 Guideline` references are left unresolved with `target_id=null` to avoid falsely resolving Addendum references to the integrated S6(R1) PDF as if the Addendum referred to itself.
- `ICH S9 Guideline` is represented as an unresolved external guideline reference.
- No `ICH S6 Guideline Section 3.3` cross-reference was created from Part II `2.1` or `2.2`; that explicit reference occurs only in excluded section `2.3`.

## Model `0.2.0` fit assessment

Model `0.2.0` can represent the selected S6 source-layer pilot without schema or validator changes.

Confirmed fit:

- One physical integrated S6(R1) `Document`.
- Part-aware `Section`, `SourceUnit`, `KnowledgeRecord`, `Condition`, and `CrossReference` IDs.
- Separate Parent and Addendum source provenance.
- Paragraph-level source-unit segmentation.
- Source trace fields for zero-based PDF page index and printed page label.
- Explicit quantitative constraints as `QuantitativeCriterion` records when supported by source wording.
- Conditions, exceptions, and unresolved cross-references without creating amendment or effective-state records.

## Information loss or workaround

Note-specific cross-reference targets cannot be represented precisely as resolved targets without either creating Note-specific `Section` objects, which Module 3.1 disallowed, or targeting `SourceUnit` records with a `target_type` vocabulary that does not include source units. The pilot preserves note references as `needs_review` cross-references and links related source units through `related_source_unit_ids`.

## Demonstrated model limitation

Potential Module 3.5 candidate: model `0.2.0` lacks a note-specific cross-reference target type or a controlled way to resolve a `CrossReference` directly to a `SourceUnit`. This did not block schema-valid source preservation, but it prevents reviewed resolution of Note 1 and Note 2 references at the intended granularity.

Potential Module 3.5 candidate: model `0.2.0` lacks an exact-count comparator for quantitative criteria. The pilot uses `at_least` with `needs_review` for exact one-species and two-species source wording so the numeric constraint remains traceable without overstating reviewed semantics.

## Amendment and effective-state confirmation

No amendment mappings were created.

No `EffectiveRecord` content or effective-state synthesis was created.
