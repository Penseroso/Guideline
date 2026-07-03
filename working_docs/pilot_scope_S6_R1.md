# Pilot Scope: ICH S6(R1) Parent-Addendum

## Status

Selected, pending repository review.

This scope is for Phase 3 Module 3.1 only. It does not create S6 structured JSON, amendment mappings, or effective-state records.

## Selected scope

### Parent Guideline

- Part: Part I
- Section: `3.3 Animal Species/Model Selection`
- Physical PDF pages: zero-based indexes `6` and `7`
- Printed page labels: `3` and `4`
- Included title: `3.3 Animal Species/Model Selection`
- Start boundary: section heading `3.3 Animal Species/Model Selection` on PDF index `6`, printed label `3`
- End boundary: final paragraph before heading `3.4 Number/Gender of Animals` on PDF index `7`, printed label `4`
- Included source units:
  - 1 heading source unit for section `3.3`
  - 5 paragraph source units in section `3.3`
  - 1 cross-reference to Part I `Note 1`
- Included note needed for meaning:
  - Part I `NOTES`, `Note 1`
  - Physical PDF page: zero-based index `12`
  - Printed page label: `9`
  - Start boundary: `Note 1 Animal models of disease...`
  - End boundary: final sentence before `Note 2`
  - Expected source units: 1 note source unit, plus a context heading if needed for traceability

### Addendum

- Part: Part II
- Section: `2 Species Selection`
- Subsections: `2.1 General Principles`; `2.2 One or Two Species`
- Physical PDF pages: zero-based indexes `14` and `15`
- Printed page labels: `11` and `12`
- Included titles:
  - `2. Species Selection`
  - `2.1 General Principles`
  - `2.2 One or Two Species`
- Start boundary: heading `2. Species Selection` on PDF index `14`, printed label `11`
- End boundary: final paragraph of `2.2 One or Two Species` before heading `2.3 Use of Homologous Proteins` on PDF index `15`, printed label `12`
- Included source units:
  - 3 heading source units for sections `2`, `2.1`, and `2.2`
  - 7 paragraph source units in `2.1`
  - 2 paragraph source units in `2.2`
  - Cross-references to Part II `Note 1`, Part II `Note 2`, ICH S6 Guideline, and ICH S6 Guideline Section `3.3`
- Included notes needed for meaning:
  - Part II `NOTES`, `Note 1`
    - Physical PDF pages: zero-based indexes `19` and `20`
    - Printed page labels: `16` and `17`
    - Start boundary: `Note 1 Tissue cross-reactivity...`
    - End boundary: final paragraph before `Note 2`
    - Expected source units: 7 note paragraph source units, plus a context heading if needed for traceability
  - Part II `NOTES`, `Note 2`
    - Physical PDF page: zero-based index `20`
    - Printed page label: `17`
    - Start boundary: `Note 2 If two species...`
    - End boundary: final sentence before `Note 3`
    - Expected source units: 1 note paragraph source unit, plus a context heading if needed for traceability

## Excluded adjacent content

- Part I section `3.2 Biological Activity/Pharmacodynamics`: excluded because it precedes the selected Parent section and is not required to test the Parent-Addendum species-selection relationship.
- Part I section `3.4 Number/Gender of Animals`: excluded because it starts the next topic after the Parent species/model-selection section.
- Part I Notes `Note 2` and `Note 3`: excluded because selected Parent section `3.3` references only Part I `Note 1`.
- Part II section `1` and subsections `1.1` through `1.3`: excluded because they provide Addendum introduction and scope context but are not needed for the smallest coherent species-selection pilot.
- Part II section `2.3 Use of Homologous Proteins`: excluded because the candidate scope ends after one/two-species handling; references to homologous proteins inside selected sections can be preserved as source text and cross-references without extracting section `2.3`.
- Part II section `3 Study Design` and later sections: excluded as unrelated to the smallest species-selection pilot.
- Part II Notes `Note 3` through `Note 6`: excluded because selected Addendum sections reference only Part II `Note 1` and `Note 2`.
- References section: excluded because external guideline citations can be represented as unresolved cross-references without extracting the references list.

## Why this scope is sufficient

This scope is the smallest coherent S6(R1) sample that exercises the Phase 3 pressure points:

- Part-aware source identity, because Part I and Part II both use low-level section numbering that can collide.
- Parent-Addendum provenance, because the local PDF is an integrated package with separate Parent and Addendum Parts.
- Relevant-species conditions, including pharmacological activity, target binding, tissue specificity, functional activity, homologous molecules, transgenic models, animal models of disease, and ADC-specific species considerations.
- One/two-species conditions, including short-term and longer-term study contexts and one-species justification scenarios.
- Mixed semantic types, including requirements, recommendations, rationale or explanation, applicability conditions, exceptions, and cross-references.
- Later amendment-mapping suitability, because Addendum section `2` directly addresses and references the Parent species-selection concepts in Part I section `3.3`.

## Expected source-layer objects

Expected source-layer object types for Module 3.2:

- 1 `Document` for the integrated S6(R1) PDF.
- Part-aware `Section` records for:
  - `Part I`
  - `Part I 3.3`
  - `Part I Notes`
  - `Part II`
  - `Part II 2`
  - `Part II 2.1`
  - `Part II 2.2`
  - `Part II Notes`
- `SourceUnit` records for selected headings, paragraphs, list items if identified during structuring, and included note paragraphs.
- `KnowledgeRecord` records only where source wording supports semantic structuring.
- `Condition` records for applicability, scope, precondition, and exception language.
- `CrossReference` records for internal note references, Part/section references, and external ICH guideline references.
- `QuantitativeCriterion` records are not expected unless Module 3.2 review identifies a true structured quantitative criterion inside the selected source units.

Provisional Part-aware ID pattern:

- `document_id`: `ich_s6_r1`
- Parent section IDs: `ich_s6_r1.sec.part1.3_3`, `ich_s6_r1.sec.part1.notes.note1`
- Addendum section IDs: `ich_s6_r1.sec.part2.2`, `ich_s6_r1.sec.part2.2_1`, `ich_s6_r1.sec.part2.2_2`, `ich_s6_r1.sec.part2.notes.note1`, `ich_s6_r1.sec.part2.notes.note2`
- Parent source-unit IDs: `ich_s6_r1.su.part1.3_3.001`
- Addendum source-unit IDs: `ich_s6_r1.su.part2.2_1.001`
- Note source-unit IDs: `ich_s6_r1.su.part1.notes.note1.001`, `ich_s6_r1.su.part2.notes.note1.001`
- Knowledge-record IDs: `ich_s6_r1.kr.part1.3_3.001`, `ich_s6_r1.kr.part2.2_1.001`
- Condition IDs: `ich_s6_r1.cond.part2.2_2.001`
- Cross-reference IDs: `ich_s6_r1.xref.part2.2_1.001`

## Source-unit segmentation rules

- Preserve each selected section heading as a `SourceUnit` with `unit_type=heading` when it is directly represented in the bundle.
- Segment body text by source paragraph, not by sentence, unless a paragraph contains clearly separable list items or table-like structures.
- Preserve numbered or bulleted list items as separate `SourceUnit` records with `unit_type=list_item` when the list structure is part of the selected source unit.
- Preserve each included note paragraph as a source unit. If a note contains multiple paragraphs, do not collapse them into one unit.
- Do not merge Parent and Addendum source units even when they discuss the same topic.
- Do not rewrite Parent source text using Addendum wording.
- Record zero-based PDF page index and printed page label independently.
- Record cross-references as `CrossReference` objects rather than embedding resolved interpretation into source text.

## Candidate comparison questions

These are candidate review questions for later modules. They are not amendment mappings.

- How does Part II section `2.1` clarify the evidence used to determine species relevancy compared with Part I section `3.3`?
- How does Part II section `2.2` affect the Parent statement that safety evaluation programs normally include two relevant species?
- Which selected Addendum statements provide additional conditions for using one species?
- Which selected Addendum statements address cases where no pharmacologically relevant species can be identified?
- How do the selected Parent and Addendum passages treat homologous molecules, transgenic models, and animal models of disease?
- Which note material is needed to interpret TCR and ADC-related species-selection statements?

## Module 3.2 completion criteria

Module 3.2 is complete when:

- A source-layer S6 pilot JSON bundle exists only for the selected scope.
- The bundle uses source model `0.2.0` without schema or validator changes unless a demonstrated limitation blocks validation.
- Parent and Addendum source provenance remain separate and Part-aware.
- All selected source units include source file path, document ID, section ID, zero-based PDF page index, printed page label, extraction method, and review status.
- Internal note references and external ICH references are represented as cross-references with appropriate resolution status.
- Conditions and exceptions are represented only where supported by source text.
- No amendment mappings or effective-state records are created.
- `npm test`, `npm run validate:pilots`, and `git diff --check` pass or failures are documented as blockers.
